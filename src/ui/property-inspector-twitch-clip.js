let websocket = null;
let uuid = null;
let actionInfo = {};
let settings = {};

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    uuid = inUUID;
    actionInfo = JSON.parse(inActionInfo);
    settings = actionInfo.payload.settings;

    websocket = new WebSocket('ws://127.0.0.1:' + inPort);

    websocket.onopen = function () {
        websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: uuid }));
        loadSettings();
    };

    websocket.onmessage = function (evt) {
        const jsonObj = JSON.parse(evt.data);
        if (jsonObj.event === 'didReceiveSettings') {
            settings = jsonObj.payload.settings;
            loadSettings();
        }
    };
}

function loadSettings() {
    document.getElementById('handle').value = settings.handle || '';
    document.getElementById('appPassword').value = settings.appPassword || '';
    document.getElementById('twitchChannel').value = settings.twitchChannel || '';
    document.getElementById('twitchClientId').value = settings.twitchClientId || '';
    document.getElementById('twitchAccessToken').value = settings.twitchAccessToken || '';
    document.getElementById('message').value = settings.message || '';
}

function saveSettings() {
    settings.handle = document.getElementById('handle').value;
    settings.appPassword = document.getElementById('appPassword').value;
    settings.twitchChannel = document.getElementById('twitchChannel').value;
    settings.twitchClientId = document.getElementById('twitchClientId').value;
    settings.twitchAccessToken = document.getElementById('twitchAccessToken').value;
    settings.message = document.getElementById('message').value;

    if (websocket && websocket.readyState === 1) {
        websocket.send(JSON.stringify({ event: 'setSettings', context: uuid, payload: settings }));
    }
}

document.addEventListener('DOMContentLoaded', function () {
    ['handle', 'appPassword', 'twitchChannel', 'twitchClientId', 'twitchAccessToken', 'message'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', saveSettings);
            element.addEventListener('change', saveSettings);
        }
    });
});
