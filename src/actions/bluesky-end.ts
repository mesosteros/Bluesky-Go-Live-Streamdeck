import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import { BskyAgent } from '@atproto/api';
import streamDeck from '@elgato/streamdeck';

@action({ UUID: 'com.mesos.blueskygolive.end' })
export class BlueSkyEndAction extends SingletonAction<Settings> {
    override async onKeyDown(ev: KeyDownEvent<Settings>) {
        try {
            streamDeck.logger.info('🛑 Ending Bluesky stream...');

            const { appPassword, handle } = ev.payload.settings;

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

            // Delete the live status record
            streamDeck.logger.info('⏹️ Clearing live status...');
            await agent.com.atproto.repo.deleteRecord({
                repo: agent.session!.did,
                collection: 'app.bsky.actor.status',
                rkey: 'self',
            });
            streamDeck.logger.info('✅ Live status cleared successfully');

            // Show success
            await ev.action.showOk();
            streamDeck.logger.info('🎉 Stream ended successfully!');
        } catch (error) {
            streamDeck.logger.error(`❌ End stream failed: ${error}`);
            streamDeck.logger.error(`Error details: ${JSON.stringify(error, null, 2)}`);
            await ev.action.showAlert();
        }
    }
}

type Settings = {
    handle: string;
    appPassword: string;
}
