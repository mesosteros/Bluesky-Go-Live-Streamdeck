import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import streamDeck from '@elgato/streamdeck';
import { createAgent } from '../utils/bluesky';

@action({ UUID: 'com.mesos.blueskygolive.clearstatus' })
export class BluskyClearStatusAction extends SingletonAction<Settings> {
    override async onKeyDown(ev: KeyDownEvent<Settings>) {
        try {
            streamDeck.logger.info('⏹️ Starting Clear Live Status action...');

            const { handle, appPassword } = ev.payload.settings;

            if (!handle || !appPassword) {
                streamDeck.logger.error('❌ Missing required settings: handle or appPassword');
                await ev.action.showAlert();
                return;
            }

            streamDeck.logger.info(`📝 Logging in as ${handle}...`);
            const agent = await createAgent(handle, appPassword);
            streamDeck.logger.info('✅ Login successful');

            try {
                await agent.com.atproto.repo.deleteRecord({
                    repo: agent.session!.did,
                    collection: 'app.bsky.actor.status',
                    rkey: 'self',
                });
                streamDeck.logger.info('✅ Live status cleared successfully');
            } catch (deleteError: unknown) {
                const errorMessage =
                    deleteError instanceof Error ? deleteError.message : String(deleteError);
                if (
                    errorMessage.includes('RecordNotFound') ||
                    errorMessage.includes('Could not find record')
                ) {
                    streamDeck.logger.info(
                        'ℹ️ Live status was already cleared — no action needed',
                    );
                } else {
                    throw deleteError;
                }
            }

            await ev.action.showOk();
            streamDeck.logger.info('🎉 Live status cleared!');
        } catch (error) {
            streamDeck.logger.error(`❌ Clear Live Status failed: ${error}`);
            await ev.action.showAlert();
        }
    }
}

type Settings = {
    handle: string;
    appPassword: string;
};
