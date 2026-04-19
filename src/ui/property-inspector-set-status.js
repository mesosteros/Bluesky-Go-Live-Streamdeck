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
    document.getElementById('streamUrl').value = settings.streamUrl || '';
    document.getElementById('duration').value = settings.duration || '120';
}

function saveSettings() {
    settings.handle = document.getElementById('handle').value;
    settings.appPassword = document.getElementById('appPassword').value;
    settings.streamUrl = document.getElementById('streamUrl').value;
    settings.duration = document.getElementById('duration').value;

    if (websocket && websocket.readyState === 1) {
        websocket.send(JSON.stringify({ event: 'setSettings', context: uuid, payload: settings }));
    }
}

document.addEventListener('DOMContentLoaded', function () {
    ['handle', 'appPassword', 'streamUrl', 'duration'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', saveSettings);
            element.addEventListener('change', saveSettings);
        }
    });
});
