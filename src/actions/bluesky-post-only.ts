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

@action({ UUID: 'com.mesos.blueskygolive.postonly' })
export class BlueskyPostOnlyAction extends SingletonAction<Settings> {
    override async onKeyDown(ev: KeyDownEvent<Settings>) {
        try {
            streamDeck.logger.info('📮 Starting Post to Bluesky action...');

            const { handle, appPassword, message, imagePath, imageAltText } = ev.payload.settings;

            if (!handle || !appPassword) {
                streamDeck.logger.error('❌ Missing required settings: handle or appPassword');
                await ev.action.showAlert();
                return;
            }

            streamDeck.logger.info(`📝 Logging in as ${handle}...`);
            const agent = await createAgent(handle, appPassword);
            streamDeck.logger.info('✅ Login successful');

            let embed: unknown = undefined;

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
                                    alt: imageAltText || '',
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

            streamDeck.logger.info('📮 Creating post...');
            await postToBluesky(agent, message || '', embed);
            streamDeck.logger.info('✅ Post created successfully');

            await ev.action.showOk();
            streamDeck.logger.info('🎉 Post to Bluesky completed!');
        } catch (error) {
            streamDeck.logger.error(`❌ Post to Bluesky failed: ${error}`);
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
            images: [{ alt: imageAltText || '', image: upload.data.blob }],
        };
    }
}

type Settings = {
    handle: string;
    appPassword: string;
    message?: string;
    imagePath?: string;
    imageAltText?: string;
};
