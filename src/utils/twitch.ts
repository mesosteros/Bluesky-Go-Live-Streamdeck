import streamDeck from '@elgato/streamdeck';

const TWITCH_API = 'https://api.twitch.tv/helix';

export type TwitchClip = {
    id: string;
    url: string;
    title: string;
    thumbnailUrl: string;
};

function twitchHeaders(clientId: string, accessToken: string): Record<string, string> {
    return {
        'Client-Id': clientId,
        Authorization: `Bearer ${accessToken}`,
    };
}

export async function getBroadcasterId(
    clientId: string,
    accessToken: string,
    channel: string,
): Promise<string> {
    const login = channel.trim().toLowerCase().replace(/^@/, '');
    const res = await fetch(`${TWITCH_API}/users?login=${encodeURIComponent(login)}`, {
        headers: twitchHeaders(clientId, accessToken),
    });

    if (res.status === 401) {
        throw new Error('Twitch token invalid or expired — generate a new one');
    }
    if (!res.ok) {
        throw new Error(`Twitch user lookup failed: ${res.status} - ${await res.text()}`);
    }

    const data = (await res.json()) as { data: Array<{ id: string }> };
    if (!data.data?.length) {
        throw new Error(`Twitch channel not found: ${login}`);
    }

    return data.data[0].id;
}

export async function createClip(
    clientId: string,
    accessToken: string,
    broadcasterId: string,
): Promise<string> {
    const res = await fetch(`${TWITCH_API}/clips?broadcaster_id=${broadcasterId}`, {
        method: 'POST',
        headers: twitchHeaders(clientId, accessToken),
    });

    if (res.status === 401) {
        throw new Error('Twitch token invalid, expired, or missing clips:edit scope');
    }
    if (res.status === 404) {
        throw new Error('Cannot create clip — channel is not live or clips are disabled');
    }
    if (!res.ok) {
        throw new Error(`Twitch clip creation failed: ${res.status} - ${await res.text()}`);
    }

    const data = (await res.json()) as { data: Array<{ id: string }> };
    if (!data.data?.length) {
        throw new Error('Twitch returned no clip id');
    }

    streamDeck.logger.info(`🎬 Clip creation started: ${data.data[0].id}`);
    return data.data[0].id;
}

export async function waitForClip(
    clientId: string,
    accessToken: string,
    clipId: string,
): Promise<TwitchClip> {
    const maxAttempts = 15;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const res = await fetch(`${TWITCH_API}/clips?id=${encodeURIComponent(clipId)}`, {
            headers: twitchHeaders(clientId, accessToken),
        });

        if (!res.ok) {
            streamDeck.logger.warn(`⚠️ Clip status check failed: ${res.status}`);
            continue;
        }

        const data = (await res.json()) as {
            data: Array<{ id: string; url: string; title: string; thumbnail_url: string }>;
        };

        if (data.data?.length) {
            const clip = data.data[0];
            streamDeck.logger.info(`✅ Clip ready: ${clip.url}`);
            return {
                id: clip.id,
                url: clip.url,
                title: clip.title,
                thumbnailUrl: clip.thumbnail_url,
            };
        }

        streamDeck.logger.info(`⏳ Waiting for clip to process (${attempt}/${maxAttempts})...`);
    }

    throw new Error('Clip did not finish processing in time — check Twitch and retry');
}
