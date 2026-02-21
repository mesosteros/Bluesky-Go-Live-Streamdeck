import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import streamDeck from '@elgato/streamdeck';
import fs from 'fs';
import sharp from 'sharp';
import {
    createAgent,
    postToBluesky,
    isAnimatedGif,
    convertGifToMp4,
    uploadVideoToBluesky,
    compressImage,
} from '../utils/bluesky';

@action({ UUID: 'com.mesos.blueskygolive.post' })
export class BlueskyPostAction extends SingletonAction<Settings> {
    override async onKeyDown(ev: KeyDownEvent<Settings>) {
        try {
            streamDeck.logger.info('🚀 Starting Bluesky Go Live action...');

            const { handle, appPassword, message, twitchUrl, imagePath, imageAltText, duration } =
                ev.payload.settings;

            if (!handle || !appPassword) {
                streamDeck.logger.error('❌ Missing required settings: handle or appPassword');
                await ev.action.showAlert();
                return;
            }

            streamDeck.logger.info(`📝 Logging in as ${handle}...`);
            const agent = await createAgent(handle, appPassword);
            streamDeck.logger.info('✅ Login successful');

            let embed: unknown = undefined;

            // Upload Image/GIF if provided
            if (imagePath) {
                try {
                    const isGif = imagePath.toLowerCase().endsWith('.gif');
                    const isAnimated = isGif && (await isAnimatedGif(imagePath));

                    if (isAnimated) {
                        streamDeck.logger.info(`📸 Processing animated GIF from ${imagePath}...`);

                        try {
                            const gifMeta = await sharp(imagePath, { animated: true }).metadata();
                            const gifWidth = gifMeta.width || 480;
                            const gifHeight = gifMeta.pageHeight || gifMeta.height || 270;

                            const mp4Path = await convertGifToMp4(imagePath);
                            const videoResult = await uploadVideoToBluesky(
                                agent,
                                mp4Path,
                                gifWidth,
                                gifHeight,
                            );

                            try {
                                fs.unlinkSync(mp4Path);
                                streamDeck.logger.info(`🗑️ Cleaned up temporary file: ${mp4Path}`);
                            } catch {
                                streamDeck.logger.warn(
                                    `⚠️ Could not delete temporary file: ${mp4Path}`,
                                );
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
                                streamDeck.logger.warn(
                                    '⚠️ Video upload failed, falling back to static image',
                                );
                                embed = await this.uploadStaticImage(
                                    agent,
                                    imagePath,
                                    imageAltText,
                                );
                                streamDeck.logger.info(
                                    '✅ GIF uploaded as static image (fallback)',
                                );
                            }
                        } catch (conversionError) {
                            streamDeck.logger.error(
                                `❌ GIF conversion failed: ${conversionError}`,
                            );
                            streamDeck.logger.warn('⚠️ Falling back to static image');
                            embed = await this.uploadStaticImage(agent, imagePath, imageAltText);
                            streamDeck.logger.info('✅ GIF uploaded as static image (fallback)');
                        }
                    } else {
                        streamDeck.logger.info(`📸 Processing image from ${imagePath}...`);
                        embed = await this.uploadStaticImage(agent, imagePath, imageAltText);
                        streamDeck.logger.info('✅ Image uploaded successfully');
                    }
                } catch (error) {
                    streamDeck.logger.error(`❌ Failed to upload media: ${error}`);
                }
            }

            // Create post
            streamDeck.logger.info('📮 Creating post...');
            const postText = twitchUrl ? `${message || ''} ${twitchUrl}`.trim() : message || '';
            await postToBluesky(agent, postText, embed);
            streamDeck.logger.info('✅ Post created successfully');

            // Set Go Live status
            if (twitchUrl) {
                try {
                    streamDeck.logger.info('🔴 Setting Go Live status...');
                    const durationMins = parseInt(duration || '120', 10);
                    await agent.com.atproto.repo.putRecord({
                        repo: agent.session!.did,
                        collection: 'app.bsky.actor.status',
                        rkey: 'self',
                        record: {
                            $type: 'app.bsky.actor.status',
                            status: 'app.bsky.actor.status#live',
                            embed: {
                                $type: 'app.bsky.embed.external',
                                external: {
                                    uri: twitchUrl,
                                    title: '',
                                    description: '',
                                },
                            },
                            durationMinutes: durationMins,
                            createdAt: new Date().toISOString(),
                        },
                    });
                    streamDeck.logger.info(
                        `✅ Go Live status set successfully (${durationMins} minutes)`,
                    );
                } catch (statusError) {
                    streamDeck.logger.error(`❌ Failed to set Go Live status: ${statusError}`);
                }
            }

            await ev.action.showOk();
            streamDeck.logger.info('🎉 Bluesky Go Live action completed!');
        } catch (error) {
            streamDeck.logger.error(`❌ Bluesky Go Live failed: ${error}`);
            await ev.action.showAlert();
        }
    }

    private async uploadStaticImage(
        agent: Awaited<ReturnType<typeof createAgent>>,
        imagePath: string,
        imageAltText?: string,
    ): Promise<unknown> {
        const { buffer, mimeType } = await compressImage(imagePath);
        const fileData = new Uint8Array(buffer);
        const upload = await agent.uploadBlob(fileData, { encoding: mimeType });
        return {
            $type: 'app.bsky.embed.images',
            images: [{ alt: imageAltText || 'Stream Thumbnail', image: upload.data.blob }],
        };
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
