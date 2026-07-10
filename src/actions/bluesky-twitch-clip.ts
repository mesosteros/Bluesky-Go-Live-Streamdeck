import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import streamDeck from '@elgato/streamdeck';
import { createAgent, postToBluesky, buildExternalEmbed } from '../utils/bluesky';
import { createClip, getBroadcasterId, waitForClip } from '../utils/twitch';

@action({ UUID: 'com.mesos.blueskygolive.twitchclip' })
export class BlueskyTwitchClipAction extends SingletonAction<Settings> {
    override async onKeyDown(ev: KeyDownEvent<Settings>) {
        try {
            streamDeck.logger.info('🎬 Starting Post Twitch Clip action...');

            const {
                handle,
                appPassword,
                twitchChannel,
                twitchClientId,
                twitchAccessToken,
                message,
            } = ev.payload.settings;

            if (!handle || !appPassword) {
                streamDeck.logger.error('❌ Missing required settings: handle or appPassword');
                await ev.action.showAlert();
                return;
            }

            if (!twitchChannel || !twitchClientId || !twitchAccessToken) {
                streamDeck.logger.error(
                    '❌ Missing required Twitch settings: channel, clientId or accessToken',
                );
                await ev.action.showAlert();
                return;
            }

            streamDeck.logger.info(`🔍 Looking up Twitch channel ${twitchChannel}...`);
            const broadcasterId = await getBroadcasterId(
                twitchClientId,
                twitchAccessToken,
                twitchChannel,
            );

            streamDeck.logger.info('🎬 Creating clip...');
            const clipId = await createClip(twitchClientId, twitchAccessToken, broadcasterId);

            streamDeck.logger.info('⏳ Waiting for clip to process...');
            const clip = await waitForClip(twitchClientId, twitchAccessToken, clipId);

            streamDeck.logger.info(`📝 Logging in as ${handle}...`);
            const agent = await createAgent(handle, appPassword);
            streamDeck.logger.info('✅ Login successful');

            const embed = await buildExternalEmbed(
                agent,
                clip.url,
                clip.title || 'Twitch Clip',
                `Clip from ${twitchChannel}'s stream on Twitch`,
                clip.thumbnailUrl,
            );

            streamDeck.logger.info('📮 Creating post...');
            await postToBluesky(agent, message || '', embed);
            streamDeck.logger.info('✅ Post created successfully');

            await ev.action.showOk();
            streamDeck.logger.info('🎉 Twitch clip posted to Bluesky!');
        } catch (error) {
            streamDeck.logger.error(`❌ Post Twitch Clip failed: ${error}`);
            await ev.action.showAlert();
        }
    }
}

type Settings = {
    handle: string;
    appPassword: string;
    twitchChannel: string;
    twitchClientId: string;
    twitchAccessToken: string;
    message?: string;
};
