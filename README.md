# Bluesky Go Live - Streamdeck Plugin

A Stream Deck plugin that lets you manage your Bluesky presence while streaming — post announcements, control your live status badge, and share clips, all from a single button press.

## How to Use

### The Quick Way

The plugin is available on the [Elgato Marketplace](https://marketplace.elgato.com/product/blueskygolive-4a429189-e5d3-44d5-8a7a-38a5975385dc), simply install it and follow the setting up instructions below.

### Prerequisites

- [Elgato Stream Deck](https://www.elgato.com/stream-deck) with Stream Deck software v6.9 or later
- A [Bluesky](https://bsky.app) account
- A Bluesky **App Password** (see [Getting a Bluesky App Password](#getting-a-bluesky-app-password) below)

### Available Actions

The plugin adds the following actions to the **BlueSkyGoLive** category in Stream Deck:

| Action                           | Description                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------ |
| **Go Live on Bluesky**           | Posts to Bluesky and sets your live status badge in one press                  |
| **End Stream on Bluesky**        | Clears your live status and posts a stream-end message                         |
| **Post to Bluesky**              | Posts a message and optional image to Bluesky, without touching the live badge |
| **Set Live Status on Bluesky**   | Sets your live badge only, without posting                                     |
| **Clear Live Status on Bluesky** | Clears your live badge only, without posting                                   |

**Which should I use?** If you want everything in one button, use **Go Live on Bluesky**. If you prefer finer control — for example, triggering your post and your live badge separately, or combining them with other Stream Deck actions — use the standalone actions.

---

## Action Setup

### Go Live on Bluesky

Drag the action onto a button and fill in the settings panel:

| Field                                                               | Required | Description                                                                                |
| ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| **Bluesky Handle**                                                  | Yes      | Your Bluesky handle (e.g. `yourname.bsky.social`)                                          |
| **App Password**                                                    | Yes      | Your Bluesky App Password (not your account password)                                      |
| **Post Message**                                                    | No       | The text content of your post                                                              |
| **Twitch, Youtube, Substack, beehiiv, Streamplace or Bluecast URL** | No       | Your stream URL. If provided, enables the Go Live badge and appends the link to your post. |
| **Go Live Duration**                                                | No       | How long the live badge stays on your profile (5 min – 4 hours). Defaults to 2 hours.      |
| **Thumbnail Path**                                                  | No       | Path to an image or animated GIF. Use **Browse** or paste a path directly.                 |
| **Image Alt Text**                                                  | No       | Alt text for the thumbnail (defaults to "Stream Thumbnail").                               |

When pressed, the action will:

- Create a Bluesky post with your message and thumbnail
- If a stream URL is provided, set your profile's live badge with a link to your stream
- Show a checkmark on the button if successful, or an alert icon if something went wrong

> **Tip:** Leave the **Twitch, Youtube, Substack, beehiiv, Streamplace or Bluecast URL** field empty to post without setting the live badge.

---

### End Stream on Bluesky

Drag the action onto a button and enter your **Bluesky Handle** and **App Password**. Press it when your stream ends to clear the live badge from your profile.

If the live badge has already expired by the time you press it, the plugin handles this gracefully and still shows success.

---

### Post to Bluesky

Posts a message and optional image to Bluesky without affecting the live badge. Useful for announcements, mid-stream updates, or any post you want to send independently from your stream status.

| Field                | Required | Description                                |
| -------------------- | -------- | ------------------------------------------ |
| **Bluesky Handle**   | Yes      | Your Bluesky handle                        |
| **App Password**     | Yes      | Your Bluesky App Password                  |
| **Post Message**     | No       | The text content of your post              |
| **Image / GIF Path** | No       | Path to an image or animated GIF to attach |
| **Image Alt Text**   | No       | Alt text for the image                     |

---

### Set Live Status on Bluesky

Sets your Bluesky live badge without creating a post. Pair this with **Post to Bluesky** if you want to control the two separately, or use it on its own alongside another key that starts your stream.

| Field              | Required | Description                                                                                     |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| **Bluesky Handle** | Yes      | Your Bluesky handle                                                                             |
| **App Password**   | Yes      | Your Bluesky App Password                                                                       |
| **Stream URL**     | Yes      | Your stream URL (must be a recognised streaming platform, e.g. `https://twitch.tv/yourchannel`) |
| **Live Duration**  | No       | How long the badge stays active. Defaults to 2 hours.                                           |

---

### Clear Live Status on Bluesky

Clears your Bluesky live badge without posting. Use this alongside **Set Live Status** for full manual control, or whenever you want to remove the badge without triggering the full end-stream flow.

| Field              | Required | Description               |
| ------------------ | -------- | ------------------------- |
| **Bluesky Handle** | Yes      | Your Bluesky handle       |
| **App Password**   | Yes      | Your Bluesky App Password |

---

### Supported Image Formats

- **PNG / JPG** — Uploaded as a static image. Automatically compressed if the file exceeds Bluesky's size limit (~976 KB). Large images are resized to fit within 2000×2000 pixels.
- **Animated GIF** — Automatically converted to MP4 and uploaded via Bluesky's video service, preserving the animation. If conversion fails, the plugin falls back to uploading the first frame as a static image.

---

## Getting a Bluesky App Password

App Passwords let third-party apps like this plugin post on your behalf without exposing your main account password. You can revoke one at any time without changing your real password.

This plugin does not store your App Password anywhere other than your own computer. It is never sent to an external server.

1. Log into your Bluesky account at [bsky.app](https://bsky.app).
2. Click on your avatar in the left sidebar, then click **Settings**.
3. Scroll down to the **Advanced** section and click **App passwords**.
4. Click **Add App Password**.
5. Give it a name (e.g. "Stream Deck") and click **Next**.
6. Bluesky will generate a password in the format `xxxx-xxxx-xxxx-xxxx`. **Copy it immediately** — you will not be able to see it again.
7. Paste the App Password into the **App Password** field in any action's settings.

You can use the same App Password across all actions. To revoke access, return to **Settings > App passwords** and delete the entry.

---

## Development

### Requirements

- Node.js 20+
- npm

### Setup

```bash
npm install
```

The plugin's runtime dependencies also need to be installed in the plugin directory:

```bash
cd com.mesos.blueskygolive.sdPlugin
npm install
cd ..
```

### Build

```bash
npm run build
```

Compiles TypeScript, bundles the plugin into `com.mesos.blueskygolive.sdPlugin/bin/plugin.js`, and copies all UI files from `src/ui/` to the plugin folder automatically.

### Watch (development)

```bash
npm run watch
```

Rebuilds and syncs UI files automatically on every change, then restarts the plugin in Stream Deck.

### Linting & Formatting

```bash
npm run lint          # Check for lint errors
npm run lint:fix      # Auto-fix lint errors
npm run format        # Format TypeScript files with Prettier
npm run format:check  # Check formatting without writing
```

### Project Structure

```
blueskygolive/
  src/
    actions/
      bluesky-post.ts             # Go Live action (post + status)
      bluesky-end.ts              # End Stream action (clear status)
      bluesky-post-only.ts        # Post to Bluesky action
      bluesky-set-status.ts       # Set Live Status action
      bluesky-clear-status.ts     # Clear Live Status action
    utils/
      bluesky.ts                  # Shared Bluesky utilities (auth, post, video, image)
    ui/
      property-inspector.html/.js             # Go Live settings
      property-inspector-end.html/.js         # End Stream settings
      property-inspector-post-only.html/.js   # Post to Bluesky settings
      property-inspector-set-status.html/.js  # Set Live Status settings
      property-inspector-clear-status.html/.js # Clear Live Status settings
    plugin.ts                     # Plugin entry point
  com.mesos.blueskygolive.sdPlugin/
    manifest.json        # Stream Deck plugin manifest
    bin/                 # Compiled output
    imgs/                # Plugin icons
    ui/                  # Copied UI files (auto-generated on build)
  eslint.config.mjs     # ESLint configuration
  .prettierrc            # Prettier configuration
  rollup.config.mjs      # Build configuration
```

### Key Dependencies

- **@elgato/streamdeck** - Stream Deck SDK
- **@atproto/api** - Bluesky AT Protocol client
- **sharp** - Image compression and metadata
- **fluent-ffmpeg** / **@ffmpeg-installer/ffmpeg** - GIF to MP4 conversion
- **eslint** / **prettier** - Code linting and formatting
