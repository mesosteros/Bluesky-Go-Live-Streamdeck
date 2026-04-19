import streamDeck from '@elgato/streamdeck';

import { BlueskyPostAction } from './actions/bluesky-post';
import { BlueSkyEndAction } from './actions/bluesky-end';
import { BlueskyPostOnlyAction } from './actions/bluesky-post-only';
import { BlueskySetStatusAction } from './actions/bluesky-set-status';
import { BluskyClearStatusAction } from './actions/bluesky-clear-status';

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel('trace');

// Register the actions.
streamDeck.actions.registerAction(new BlueskyPostAction());
streamDeck.actions.registerAction(new BlueSkyEndAction());
streamDeck.actions.registerAction(new BlueskyPostOnlyAction());
streamDeck.actions.registerAction(new BlueskySetStatusAction());
streamDeck.actions.registerAction(new BluskyClearStatusAction());

// Finally, connect to the Stream Deck.
streamDeck.connect();
