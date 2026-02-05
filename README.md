# BlueSkyGoLive - Stream Deck Plugin

A Stream Deck plugin that lets you announce your stream on Bluesky with a single action activation or press. Create a post with a custom message, thumbnail (including animated GIFs), and automatically set your Bluesky "Go Live" status badge to your desired stream length. When your stream ends, a second action clears the live status if you activate or press it.

## How to Use

### Prerequisites

- [Elgato Stream Deck](https://www.elgato.com/stream-deck) with Stream Deck software v6.9 or later
- A [Bluesky](https://bsky.app) account
- A Bluesky **App Password** (see [Getting a Bluesky App Password](#getting-a-bluesky-app-password) below)

### Installing the Plugin

1. Build the plugin (see [Development](#development) below) or install it from the Stream Deck store if available.
2. The plugin adds two actions to the **BlueSkyGoLive** category in Stream Deck:
    - **Go Live on Bluesky** - Creates a post and sets your live status
    - **End Stream on Bluesky** - Clears your live status

### Setting Up the "Go Live" Action

1. Drag the **Go Live on Bluesky** action onto a Stream Deck button.
2. In the action settings panel, fill in the following fields:

| Field                | Required | Description                                                                                                                        |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Bluesky Handle**   | Yes      | Your Bluesky handle (e.g. `yourname.bsky.social`)                                                                                  |
| **App Password**     | Yes      | Your Bluesky App Password (not your account password)                                                                              |
| **Post Message**     | No       | The text content of your post (e.g. "Going live with some D&D tonight!")                                                           |
| **Twitch URL**       | No       | Your stream URL. If provided, this enables the Go Live status badge on your Bluesky profile and links to your stream.              |
| **Go Live Duration** | No       | How long the live badge stays on your profile. Options range from 5 minutes to 4 hours. Defaults to 2 hours.                       |
| **Thumbnail Path**   | No       | Path to an image file for your post. Supports PNG, JPG, and animated GIF. Use the **Browse** button or paste a file path directly. |
| **Image Alt Text**   | No       | Alt text for the thumbnail image (defaults to "Stream Thumbnail").                                                                 |

3. Press the button or activate the action in conjunction with others (e.g. you have a start button that sets the screen to Starting, music on, and this action) on your Stream Deck to go live. The plugin will:
    - Create a Bluesky post with your message and thumbnail
    - If you provided a stream URL, set your profile's Go Live status badge with a link to your stream
    - Show a checkmark on the button if successful, or an alert icon if something went wrong

### Setting Up the "End Stream" Action

1. Drag the **End Stream on Bluesky** action onto a Stream Deck button.
2. In the settings panel, enter your **Bluesky Handle** and **App Password** (same credentials as the Go Live action).
3. Press the button when your stream ends. The plugin will clear your Go Live status badge from your Bluesky profile.

If your stream runs longer than the duration you set, the live badge may have already expired by the time you press End Stream. The plugin handles this gracefully and will still show success.

### Supported Image Formats

- **PNG / JPG** - Uploaded as a static image. Automatically compressed if the file exceeds Bluesky's size limit (~976 KB). Large images are resized to fit within 2000x2000 pixels.
- **Animated GIF** - Automatically converted to MP4 video and uploaded using Bluesky's video service, preserving the animation. If video conversion fails, the plugin falls back to uploading the first frame as a static image.

## Getting a Bluesky App Password

App Passwords let third-party apps like this plugin post on your behalf without exposing your main account password. You can revoke an App Password at any time without changing your real password.
This plugin does not store your app password anywhere but your computer, it is not sent to a server. If you feel like looking up the source code, feel free to do so (and suggest any improvements too!)

1. Log into your Bluesky account at [bsky.app](https://bsky.app).
2. Click on your avatar in the left sidebar, then click **Settings**.
3. Scroll down to the **Advanced** section and click **App passwords**.
4. Click **Add App Password**.
5. Give it a name (e.g. "Stream Deck") and click **Next**.
6. Bluesky will generate a password that looks like `xxxx-xxxx-xxxx-xxxx`. **Copy this immediately** - you will not be able to see it again.
7. Paste the App Password into the **App Password** field in the Stream Deck action settings.

You can use the same App Password for Post and End actions.

To revoke access later, return to **Settings > App passwords** and delete the entry.

## Development

### Requirements

- Node.js 20+
- npm

### Setup

```bash
npm install
```

The plugin's runtime dependencies (sharp, fluent-ffmpeg, @ffmpeg-installer/ffmpeg) also need to be installed in the plugin directory:

```bash
cd com.mesos.blueskygolive.sdPlugin
npm install
cd ..
```

### Build

```bash
npm run build
```

This compiles TypeScript and bundles the plugin into `com.mesos.blueskygolive.sdPlugin/bin/plugin.js` using Rollup.

### Watch (development)

```bash
npm run watch
```

Rebuilds automatically on file changes.

### Project Structure

```
blueskygolive/
  src/
    actions/
      bluesky-post.ts    # Go Live action (post + status)
      bluesky-end.ts     # End Stream action (clear status)
    ui/
      property-inspector.html      # Go Live settings UI
      property-inspector.js        # Go Live settings logic
      property-inspector-end.html  # End Stream settings UI
      property-inspector-end.js    # End Stream settings logic
    plugin.ts            # Plugin entry point
  com.mesos.blueskygolive.sdPlugin/
    manifest.json        # Stream Deck plugin manifest
    bin/                 # Compiled output
    imgs/                # Plugin icons
    ui/                  # Copied UI files
  rollup.config.mjs     # Build configuration
```

### Key Dependencies

- **@elgato/streamdeck** - Stream Deck SDK
- **@atproto/api** - Bluesky AT Protocol client
- **sharp** - Image compression and metadata
- **fluent-ffmpeg** / **@ffmpeg-installer/ffmpeg** - GIF to MP4 conversion
