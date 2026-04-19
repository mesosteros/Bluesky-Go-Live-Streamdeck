import { action, KeyDownEvent, SingletonAction } from '@elgato/streamdeck';
import streamDeck from '@elgato/streamdeck';
import { createAgent } from '../utils/bluesky';

@action({ UUID: 'com.mesos.blueskygolive.setstatus' })
export class BlueskySetStatusAction extends SingletonAction<Settings> {
    override async onKeyDown(ev: KeyDownEvent<Settings>) {
        try {
            streamDeck.logger.info('🔴 Starting Set Live Status action...');

            const { handle, appPassword, streamUrl, duration } = ev.payload.settings;

            if (!handle || !appPassword) {
                streamDeck.logger.error('❌ Missing required settings: handle or appPassword');
                await ev.action.showAlert();
                return;
            }

            if (!streamUrl) {
                streamDeck.logger.error('❌ Missing required setting: streamUrl');
                await ev.action.showAlert();
                return;
            }

            streamDeck.logger.info(`📝 Logging in as ${handle}...`);
            const agent = await createAgent(handle, appPassword);
            streamDeck.logger.info('✅ Login successful');

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
                            uri: streamUrl,
                            title: '',
                            description: '',
                        },
                    },
                    durationMinutes: durationMins,
                    createdAt: new Date().toISOString(),
                },
            });

            streamDeck.logger.info(`✅ Live status set successfully (${durationMins} minutes)`);
            await ev.action.showOk();
        } catch (error) {
            streamDeck.logger.error(`❌ Set Live Status failed: ${error}`);
            await ev.action.showAlert();
        }
    }
}

type Settings = {
    handle: string;
    appPassword: string;
    streamUrl: string;
    duration?: string;
};
