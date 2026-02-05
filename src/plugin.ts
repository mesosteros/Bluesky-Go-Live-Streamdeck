import streamDeck from '@elgato/streamdeck';

import { BlueskyPostAction } from './actions/bluesky-post';
import { BlueSkyEndAction } from './actions/bluesky-end';

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel('trace');

// Register the actions.
streamDeck.actions.registerAction(new BlueskyPostAction());
streamDeck.actions.registerAction(new BlueSkyEndAction());

// Finally, connect to the Stream Deck.
streamDeck.connect();
