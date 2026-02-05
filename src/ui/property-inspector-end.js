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
}

// Save settings to Stream Deck
function saveSettings() {
    settings.handle = document.getElementById('handle').value;
    settings.appPassword = document.getElementById('appPassword').value;

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
    // Add change listeners to input fields
    const inputs = ['handle', 'appPassword'];

    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', saveSettings);
            element.addEventListener('change', saveSettings);
        }
    });
});
