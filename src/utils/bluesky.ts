import { BskyAgent, RichText } from '@atproto/api';
import streamDeck from '@elgato/streamdeck';
import fs from 'fs';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import os from 'os';

export async function createAgent(handle: string, appPassword: string): Promise<BskyAgent> {
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({ identifier: handle, password: appPassword });
    return agent;
}

export async function postToBluesky(
    agent: BskyAgent,
    text: string,
    embed?: unknown,
): Promise<void> {
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    await agent.post({
        text: rt.text,
        facets: rt.facets,
        embed: embed as never,
        createdAt: new Date().toISOString(),
    });
}

export async function buildExternalEmbed(
    agent: BskyAgent,
    uri: string,
    title: string,
    description: string,
    thumbnailUrl?: string,
): Promise<unknown> {
    let thumb: unknown = undefined;

    if (thumbnailUrl) {
        try {
            streamDeck.logger.info(`🖼️ Fetching link card thumbnail...`);
            const res = await fetch(thumbnailUrl);
            if (res.ok) {
                const buffer = Buffer.from(await res.arrayBuffer());
                const jpeg = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
                const upload = await agent.uploadBlob(new Uint8Array(jpeg), {
                    encoding: 'image/jpeg',
                });
                thumb = upload.data.blob;
                streamDeck.logger.info('✅ Thumbnail uploaded');
            } else {
                streamDeck.logger.warn(`⚠️ Thumbnail fetch failed: ${res.status}`);
            }
        } catch (error) {
            streamDeck.logger.warn(`⚠️ Thumbnail upload failed, posting card without it: ${error}`);
        }
    }

    return {
        $type: 'app.bsky.embed.external',
        external: {
            uri,
            title,
            description,
            ...(thumb ? { thumb } : {}),
        },
    };
}

export async function isAnimatedGif(imagePath: string): Promise<boolean> {
    const image = sharp(imagePath, { animated: true });
    const metadata = await image.metadata();
    return (metadata.pages || 1) > 1;
}

export async function convertGifToMp4(gifPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const tempDir = os.tmpdir();
        const outputPath = path.join(tempDir, `bluesky-video-${Date.now()}.mp4`);

        streamDeck.logger.info(`🎬 Converting GIF to MP4: ${gifPath} -> ${outputPath}`);

        ffmpeg(gifPath)
            .outputOptions([
                '-movflags',
                'faststart',
                '-pix_fmt',
                'yuv420p',
                '-vf',
                'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            ])
            .videoCodec('libx264')
            .on('start', (commandLine) => {
                streamDeck.logger.info(`🎬 FFmpeg command: ${commandLine}`);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    streamDeck.logger.info(
                        `🎬 Conversion progress: ${progress.percent.toFixed(1)}%`,
                    );
                }
            })
            .on('end', () => {
                streamDeck.logger.info(`✅ GIF to MP4 conversion completed: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                streamDeck.logger.error(`❌ GIF to MP4 conversion failed: ${err.message}`);
                reject(err);
            })
            .save(outputPath);
    });
}

export async function convertVideoToMp4(inputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const tempDir = os.tmpdir();
        const outputPath = path.join(tempDir, `bluesky-replay-${Date.now()}.mp4`);

        streamDeck.logger.info(`🎬 Converting video to MP4: ${inputPath} -> ${outputPath}`);

        ffmpeg(inputPath)
            .outputOptions(['-movflags', 'faststart'])
            .videoCodec('libx264')
            .audioCodec('aac')
            .on('start', (commandLine) => {
                streamDeck.logger.info(`🎬 FFmpeg command: ${commandLine}`);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    streamDeck.logger.info(
                        `🎬 Conversion progress: ${progress.percent.toFixed(1)}%`,
                    );
                }
            })
            .on('end', () => {
                streamDeck.logger.info(`✅ Video conversion completed: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                streamDeck.logger.error(`❌ Video conversion failed: ${err.message}`);
                reject(err);
            })
            .save(outputPath);
    });
}

export async function getVideoDimensions(
    videoPath: string,
): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(videoPath, (err: unknown, metadata: any) => {
            if (err) {
                streamDeck.logger.warn(
                    `⚠️ Could not read video dimensions: ${err instanceof Error ? err.message : err}`,
                );
                resolve({ width: 480, height: 270 });
                return;
            }
            const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
            const width = videoStream?.width || 480;
            const height = videoStream?.height || 270;
            resolve({ width, height });
        });
    });
}

export async function uploadVideoToBluesky(
    agent: BskyAgent,
    videoPath: string,
    gifWidth?: number,
    gifHeight?: number,
): Promise<{ blob: any; aspectRatio: { width: number; height: number } } | null> {
    try {
        const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

        const stats = fs.statSync(videoPath);
        if (stats.size > MAX_VIDEO_SIZE) {
            streamDeck.logger.error(
                `❌ Video too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB > 50MB limit`,
            );
            return null;
        }

        streamDeck.logger.info(`📊 Video size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

        let width: number, height: number;
        if (gifWidth && gifHeight) {
            width = Math.floor(gifWidth / 2) * 2;
            height = Math.floor(gifHeight / 2) * 2;
        } else {
            const dims = await getVideoDimensions(videoPath);
            width = dims.width;
            height = dims.height;
        }

        streamDeck.logger.info(`📊 Video dimensions: ${width}x${height}`);

        const videoBuffer = fs.readFileSync(videoPath);

        const describeServer = await agent.com.atproto.server.describeServer();
        const pdsDid = describeServer.data.did;

        const serviceAuth = await agent.com.atproto.server.getServiceAuth({
            aud: pdsDid,
            lxm: 'com.atproto.repo.uploadBlob',
            exp: Math.floor(Date.now() / 1000) + 60 * 30,
        });

        streamDeck.logger.info(`📤 Uploading video to Bluesky...`);

        const uploadResponse = await fetch(
            `https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=${agent.session!.did}&name=${path.basename(videoPath)}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${serviceAuth.data.token}`,
                    'Content-Type': 'video/mp4',
                    'Content-Length': stats.size.toString(),
                },
                body: new Uint8Array(videoBuffer),
            },
        );

        let uploadResult: { jobId: string };

        if (uploadResponse.status === 409) {
            const conflictData = (await uploadResponse.json()) as any;
            streamDeck.logger.info(
                `📋 Video already processed, reusing job: ${conflictData.jobId}`,
            );
            uploadResult = { jobId: conflictData.jobId };
        } else if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            streamDeck.logger.error(
                `❌ Video upload failed: ${uploadResponse.status} - ${errorText}`,
            );
            return null;
        } else {
            uploadResult = (await uploadResponse.json()) as { jobId: string };
            streamDeck.logger.info(`📋 Video processing job started: ${uploadResult.jobId}`);
        }

        let jobStatus: any;
        let attempts = 0;
        const maxAttempts = 120;

        while (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const statusRes = await fetch(
                `https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=${uploadResult.jobId}`,
                {
                    headers: { Authorization: `Bearer ${serviceAuth.data.token}` },
                },
            );

            if (!statusRes.ok) {
                streamDeck.logger.error(`❌ Job status check failed: ${statusRes.status}`);
                attempts++;
                continue;
            }

            const statusData = (await statusRes.json()) as any;
            jobStatus = statusData.jobStatus;

            streamDeck.logger.info(
                `⏳ Video processing: ${jobStatus.state}${jobStatus.progress ? ` (${jobStatus.progress}%)` : ''}`,
            );

            if (jobStatus.state === 'JOB_STATE_COMPLETED') {
                streamDeck.logger.info(`✅ Video processing completed`);
                break;
            } else if (jobStatus.state === 'JOB_STATE_FAILED') {
                streamDeck.logger.error(
                    `❌ Video processing failed: ${jobStatus.error || 'Unknown error'}`,
                );
                return null;
            }

            attempts++;
        }

        if (!jobStatus?.blob) {
            streamDeck.logger.error(`❌ Video processing timed out or no blob returned`);
            return null;
        }

        streamDeck.logger.info(`✅ Video uploaded successfully`);
        return { blob: jobStatus.blob, aspectRatio: { width, height } };
    } catch (error) {
        streamDeck.logger.error(`❌ Video upload error: ${error}`);
        return null;
    }
}

export async function compressImage(
    imagePath: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
    const MAX_SIZE = 950 * 1024;
    const MAX_WIDTH = 2000;
    const MAX_HEIGHT = 2000;

    streamDeck.logger.info(`🔍 Checking image size...`);
    const stats = fs.statSync(imagePath);
    const originalSize = stats.size;
    streamDeck.logger.info(`📊 Original size: ${(originalSize / 1024).toFixed(2)}KB`);

    let image = sharp(imagePath);
    const metadata = await image.metadata();

    if (
        (metadata.width && metadata.width > MAX_WIDTH) ||
        (metadata.height && metadata.height > MAX_HEIGHT)
    ) {
        streamDeck.logger.info(
            `📐 Resizing image (${metadata.width}x${metadata.height}) to fit ${MAX_WIDTH}x${MAX_HEIGHT}...`,
        );
        image = image.resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true });
    }

    let buffer = await image.jpeg({ quality: 85 }).toBuffer();
    const mimeType = 'image/jpeg';

    if (buffer.length > MAX_SIZE) {
        streamDeck.logger.info(`🗜️ Further compressing image...`);
        let quality = 75;
        while (buffer.length > MAX_SIZE && quality > 30) {
            buffer = await sharp(imagePath)
                .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality })
                .toBuffer();
            quality -= 10;
        }
    }

    const finalSize = buffer.length;
    streamDeck.logger.info(
        `✅ Final size: ${(finalSize / 1024).toFixed(2)}KB (saved ${((originalSize - finalSize) / 1024).toFixed(2)}KB)`,
    );

    return { buffer, mimeType };
}
