// Global variables for Stream Deck connection
let websocket = null;
let uuid = null;
let actionInfo = {};
let settings = {};

// Connect to Stream Deck
function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    uuid = inUUID;
    actionInfo = JSON.parse(inActionInfo);
    settings = actionInfo.payload.settings;

    // Open websocket connection
    websocket = new WebSocket('ws://127.0.0.1:' + inPort);

    websocket.onopen = function () {
        // Register the property inspector
        const json = {
            event: inRegisterEvent,
            uuid: uuid
        };
        websocket.send(JSON.stringify(json));

        // Load saved settings into the UI
        loadSettings();
    };

    websocket.onmessage = function (evt) {
        const jsonObj = JSON.parse(evt.data);
        const event = jsonObj.event;

        if (event === 'didReceiveSettings') {
            settings = jsonObj.payload.settings;
            loadSettings();
        }
    };
}

// Load settings into the UI
function loadSettings() {
    document.getElementById('handle').value = settings.handle || '';
    document.getElementById('appPassword').value = settings.appPassword || '';
    document.getElementById('message').value = settings.message || '';
    document.getElementById('twitchUrl').value = settings.twitchUrl || 'https://twitch.tv/yourchannel';
    document.getElementById('duration').value = settings.duration || '120';
    document.getElementById('imagePath').value = settings.imagePath || '';
    document.getElementById('imageAltText').value = settings.imageAltText || '';
}

// Save settings to Stream Deck
function saveSettings() {
    settings.handle = document.getElementById('handle').value;
    settings.appPassword = document.getElementById('appPassword').value;
    settings.message = document.getElementById('message').value;
    settings.twitchUrl = document.getElementById('twitchUrl').value;
    settings.duration = document.getElementById('duration').value;
    settings.imagePath = document.getElementById('imagePath').value;
    settings.imageAltText = document.getElementById('imageAltText').value;

    // Send settings to Stream Deck
    if (websocket && websocket.readyState === 1) {
        const json = {
            event: 'setSettings',
            context: uuid,
            payload: settings
        };
        websocket.send(JSON.stringify(json));
    }
}

// Add event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Add change listeners to all input fields
    const inputs = ['handle', 'appPassword', 'message', 'twitchUrl', 'duration', 'imagePath', 'imageAltText'];

    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', saveSettings);
            element.addEventListener('change', saveSettings);
        }
    });

    // Handle browse button for file selection
    const browseButton = document.getElementById('browseButton');
    const fileInput = document.getElementById('fileInput');
    const imagePathInput = document.getElementById('imagePath');

    if (browseButton && fileInput) {
        browseButton.addEventListener('click', function() {
            fileInput.click();
        });

        fileInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                // Try to get the full path (works in Electron/Stream Deck)
                let path = file.path || file.webkitRelativePath || file.name;
                // Decode URL-encoded paths
                try {
                    path = decodeURIComponent(path);
                } catch (err) {
                    // If decoding fails, use the original path
                }
                imagePathInput.value = path;
                saveSettings();
            }
        });
    }
});
