import { BskyAgent } from '@atproto/api';
import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import streamDeck from '@elgato/streamdeck';
import fs from 'fs';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import os from 'os';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

@action({ UUID: 'com.mesos.blueskygolive.post' })
export class BlueskyPostAction extends SingletonAction<Settings> {
    /**
     * Check if a GIF is animated (has multiple frames)
     */
    private async isAnimatedGif(imagePath: string): Promise<boolean> {
        const image = sharp(imagePath, { animated: true });
        const metadata = await image.metadata();
        return (metadata.pages || 1) > 1;
    }

    /**
     * Convert animated GIF to MP4 format for Bluesky video upload
     */
    private async convertGifToMp4(gifPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const tempDir = os.tmpdir();
            const outputPath = path.join(tempDir, `bluesky-video-${Date.now()}.mp4`);

            streamDeck.logger.info(`🎬 Converting GIF to MP4: ${gifPath} -> ${outputPath}`);

            ffmpeg(gifPath)
                .outputOptions([
                    '-movflags', 'faststart',          // Enable fast start for web playback
                    '-pix_fmt', 'yuv420p',             // Pixel format for compatibility
                    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'  // Ensure even dimensions
                ])
                .videoCodec('libx264')                 // H.264 codec required by Bluesky
                .on('start', (commandLine) => {
                    streamDeck.logger.info(`🎬 FFmpeg command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        streamDeck.logger.info(`🎬 Conversion progress: ${progress.percent.toFixed(1)}%`);
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

    /**
     * Get video dimensions using ffprobe
     */
    private async getVideoDimensions(videoPath: string): Promise<{ width: number; height: number }> {
        return new Promise((resolve) => {
            ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
                if (err) {
                    streamDeck.logger.warn(`⚠️ Could not read video dimensions: ${err.message}`);
                    resolve({ width: 480, height: 270 }); // Safe defaults
                    return;
                }
                const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
                const width = videoStream?.width || 480;
                const height = videoStream?.height || 270;
                resolve({ width, height });
            });
        });
    }

    /**
     * Upload MP4 video to Bluesky
     */
    private async uploadVideoToBluesky(agent: BskyAgent, videoPath: string, gifWidth?: number, gifHeight?: number): Promise<{ blob: any; aspectRatio: { width: number; height: number } } | null> {
        try {
            const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB limit

            // Check file size
            const stats = fs.statSync(videoPath);
            if (stats.size > MAX_VIDEO_SIZE) {
                streamDeck.logger.error(`❌ Video too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB > 50MB limit`);
                return null;
            }

            streamDeck.logger.info(`📊 Video size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

            // Get video dimensions - use provided GIF dimensions or probe the MP4
            let width: number, height: number;
            if (gifWidth && gifHeight) {
                // Ensure even dimensions (same as ffmpeg filter)
                width = Math.floor(gifWidth / 2) * 2;
                height = Math.floor(gifHeight / 2) * 2;
            } else {
                const dims = await this.getVideoDimensions(videoPath);
                width = dims.width;
                height = dims.height;
            }

            streamDeck.logger.info(`📊 Video dimensions: ${width}x${height}`);

            // Read video file
            const videoBuffer = fs.readFileSync(videoPath);

            // Get the PDS server's DID for service auth
            const describeServer = await agent.com.atproto.server.describeServer();
            const pdsDid = describeServer.data.did;
            streamDeck.logger.info(`📋 PDS DID: ${pdsDid}`);

            // Get service auth token for video upload
            const serviceAuth = await agent.com.atproto.server.getServiceAuth({
                aud: pdsDid,
                lxm: 'com.atproto.repo.uploadBlob',
                exp: Math.floor(Date.now() / 1000) + 60 * 30, // 30 minutes
            });

            streamDeck.logger.info(`📤 Uploading video to Bluesky...`);

            // Upload video to Bluesky video service
            const uploadResponse = await fetch(
                `https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=${agent.session!.did}&name=${path.basename(videoPath)}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceAuth.data.token}`,
                        'Content-Type': 'video/mp4',
                        'Content-Length': stats.size.toString(),
                    },
                    body: new Uint8Array(videoBuffer),
                }
            );

            let uploadResult: { jobId: string };

            if (uploadResponse.status === 409) {
                // Video already processed (same content uploaded before)
                const conflictData = await uploadResponse.json() as any;
                streamDeck.logger.info(`📋 Video already processed, reusing job: ${conflictData.jobId}`);
                uploadResult = { jobId: conflictData.jobId };
            } else if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                streamDeck.logger.error(`❌ Video upload failed: ${uploadResponse.status} - ${errorText}`);
                return null;
            } else {
                uploadResult = await uploadResponse.json() as { jobId: string };
                streamDeck.logger.info(`📋 Video processing job started: ${uploadResult.jobId}`);
            }

            // Poll for job completion via video.bsky.app directly
            let jobStatus: any;
            let attempts = 0;
            const maxAttempts = 120; // Wait up to 2 minutes (120 seconds)

            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                const statusRes = await fetch(
                    `https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId=${uploadResult.jobId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${serviceAuth.data.token}`,
                        },
                    }
                );

                if (!statusRes.ok) {
                    streamDeck.logger.error(`❌ Job status check failed: ${statusRes.status}`);
                    attempts++;
                    continue;
                }

                const statusData = await statusRes.json() as any;
                jobStatus = statusData.jobStatus;

                streamDeck.logger.info(`⏳ Video processing: ${jobStatus.state}${jobStatus.progress ? ` (${jobStatus.progress}%)` : ''}`);

                if (jobStatus.state === 'JOB_STATE_COMPLETED') {
                    streamDeck.logger.info(`✅ Video processing completed`);
                    break;
                } else if (jobStatus.state === 'JOB_STATE_FAILED') {
                    streamDeck.logger.error(`❌ Video processing failed: ${jobStatus.error || 'Unknown error'}`);
                    return null;
                }

                attempts++;
            }

            if (!jobStatus?.blob) {
                streamDeck.logger.error(`❌ Video processing timed out or no blob returned`);
                return null;
            }

            streamDeck.logger.info(`✅ Video uploaded successfully`);

            return {
                blob: jobStatus.blob,
                aspectRatio: { width, height }
            };
        } catch (error) {
            streamDeck.logger.error(`❌ Video upload error: ${error}`);
            return null;
        }
    }

    /**
     * Compress static image to meet Bluesky's size requirements
     */
    private async compressImage(imagePath: string): Promise<{ buffer: Buffer; mimeType: string }> {
        const MAX_SIZE = 950 * 1024; // 950KB to have some margin below 976KB limit
        const MAX_WIDTH = 2000;
        const MAX_HEIGHT = 2000;

        streamDeck.logger.info(`🔍 Checking image size...`);
        const stats = fs.statSync(imagePath);
        const originalSize = stats.size;
        streamDeck.logger.info(`📊 Original size: ${(originalSize / 1024).toFixed(2)}KB`);

        // Handle non-GIF images (PNG, JPG, etc.) or static GIFs
        let image = sharp(imagePath);
        const metadata = await image.metadata();

        // Resize if dimensions are too large
        if (metadata.width && metadata.width > MAX_WIDTH || metadata.height && metadata.height > MAX_HEIGHT) {
            streamDeck.logger.info(`📐 Resizing image (${metadata.width}x${metadata.height}) to fit ${MAX_WIDTH}x${MAX_HEIGHT}...`);
            image = image.resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true });
        }

        // Try JPEG compression first (better compression)
        let buffer = await image.jpeg({ quality: 85 }).toBuffer();
        let mimeType = 'image/jpeg';

        // If still too large, reduce quality
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
        streamDeck.logger.info(`✅ Final size: ${(finalSize / 1024).toFixed(2)}KB (saved ${((originalSize - finalSize) / 1024).toFixed(2)}KB)`);

        return { buffer, mimeType };
    }

    override async onKeyDown(ev: KeyDownEvent<Settings>) {
        try {
            streamDeck.logger.info('🚀 Starting Bluesky Go Live action...');

            const {
                handle,
                appPassword,
                message,
                imagePath,
                imageAltText,
            } = ev.payload.settings;

            // Validate required settings
            if (!handle || !appPassword) {
                streamDeck.logger.error('❌ Missing required settings: handle or appPassword');
                await ev.action.showAlert();
                return;
            }

            streamDeck.logger.info(`📝 Logging in as ${handle}...`);
            const agent = new BskyAgent({ service: 'https://bsky.social' });
            await agent.login({ identifier: handle, password: appPassword });
            streamDeck.logger.info('✅ Login successful');

            let embed: any = undefined;

            // Upload Image/GIF if exists
            if (imagePath) {
                try {
                    const isGif = imagePath.toLowerCase().endsWith('.gif');
                    const isAnimated = isGif && await this.isAnimatedGif(imagePath);

                    if (isAnimated) {
                        // Convert animated GIF to MP4 and upload as video
                        streamDeck.logger.info(`📸 Processing animated GIF from ${imagePath}...`);

                        try {
                            // Get GIF dimensions before conversion
                            const gifMeta = await sharp(imagePath, { animated: true }).metadata();
                            const gifWidth = gifMeta.width || 480;
                            const gifHeight = gifMeta.pageHeight || gifMeta.height || 270;

                            // Convert GIF to MP4
                            const mp4Path = await this.convertGifToMp4(imagePath);

                            // Upload MP4 as video
                            const videoResult = await this.uploadVideoToBluesky(agent, mp4Path, gifWidth, gifHeight);

                            // Clean up temporary MP4 file
                            try {
                                fs.unlinkSync(mp4Path);
                                streamDeck.logger.info(`🗑️ Cleaned up temporary file: ${mp4Path}`);
                            } catch (cleanupError) {
                                streamDeck.logger.warn(`⚠️ Could not delete temporary file: ${mp4Path}`);
                            }

                            if (videoResult) {
                                embed = {
                                    $type: 'app.bsky.embed.video',
                                    video: videoResult.blob,
                                    alt: imageAltText || 'Stream Thumbnail',
                                    aspectRatio: videoResult.aspectRatio,
                                };
                                streamDeck.logger.info('✅ Animated GIF uploaded as video');
                            } else {
                                // Fallback to static image if video upload fails
                                streamDeck.logger.warn('⚠️ Video upload failed, falling back to static image');
                                const { buffer, mimeType } = await this.compressImage(imagePath);
                                const fileData = new Uint8Array(buffer);
                                const upload = await agent.uploadBlob(fileData, { encoding: mimeType });
                                embed = {
                                    $type: 'app.bsky.embed.images',
                                    images: [{ alt: imageAltText || 'Stream Thumbnail', image: upload.data.blob }],
                                };
                                streamDeck.logger.info('✅ GIF uploaded as static image (fallback)');
                            }
                        } catch (conversionError) {
                            // Fallback to static image if conversion fails
                            streamDeck.logger.error(`❌ GIF conversion failed: ${conversionError}`);
                            streamDeck.logger.warn('⚠️ Falling back to static image');
                            const { buffer, mimeType } = await this.compressImage(imagePath);
                            const fileData = new Uint8Array(buffer);
                            const upload = await agent.uploadBlob(fileData, { encoding: mimeType });
                            embed = {
                                $type: 'app.bsky.embed.images',
                                images: [{ alt: imageAltText || 'Stream Thumbnail', image: upload.data.blob }],
                            };
                            streamDeck.logger.info('✅ GIF uploaded as static image (fallback)');
                        }
                    } else {
                        // Upload as static image
                        streamDeck.logger.info(`📸 Processing image from ${imagePath}...`);
                        const { buffer, mimeType } = await this.compressImage(imagePath);
                        const fileData = new Uint8Array(buffer);
                        const upload = await agent.uploadBlob(fileData, { encoding: mimeType });
                        embed = {
                            $type: 'app.bsky.embed.images',
                            images: [{ alt: imageAltText || 'Stream Thumbnail', image: upload.data.blob }],
                        };
                        streamDeck.logger.info('✅ Image uploaded successfully');
                    }
                } catch (error) {
                    streamDeck.logger.error(`❌ Failed to upload media: ${error}`);
                    // Continue without image
                }
            }

            // Create post
            streamDeck.logger.info('📮 Creating post...');
            await agent.post({
                text: message,
                embed,
                createdAt: new Date().toISOString(),
            });
            streamDeck.logger.info('✅ Post created successfully');

            // NOTE: "Go Live" Status API is not publicly documented
            // The app.bsky.actor.status collection does not exist in the official AT Protocol lexicon.
            // The "Live Now" badge feature (launched Jan 2026) is only available through:
            // - The official Bluesky app (paste Twitch URL in profile settings)
            // - Third-party services like PurpleSky (purplesky.dremixam.com)
            //
            // Until Bluesky documents the programmatic API for setting live status,
            // this functionality cannot be implemented. The post above will still be
            // created successfully with your message and thumbnail.
            streamDeck.logger.warn('⚠️ Go Live status badge is not available via API');
            streamDeck.logger.warn('⚠️ Use the official Bluesky app or PurpleSky.dremixam.com to set live status');
            streamDeck.logger.info('ℹ️ Post created successfully - users can still see your stream announcement');

            // Show success
            await ev.action.showOk();
            streamDeck.logger.info('🎉 Bluesky Go Live action completed!');
        } catch (error) {
            streamDeck.logger.error(`❌ Bluesky Go Live failed: ${error}`);
            streamDeck.logger.error(`Error details: ${JSON.stringify(error, null, 2)}`);
            await ev.action.showAlert();
        }
    }
}

type Settings = {
    handle: string;
    appPassword: string;
    message?: string;
    twitchUrl: string;
    imagePath?: string;
    imageAltText?: string;
    duration?: string;
};
