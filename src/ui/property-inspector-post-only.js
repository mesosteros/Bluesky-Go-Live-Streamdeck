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
    document.getElementById('message').value = settings.message || '';
    document.getElementById('imagePath').value = settings.imagePath || '';
    document.getElementById('imageAltText').value = settings.imageAltText || '';
}

function saveSettings() {
    settings.handle = document.getElementById('handle').value;
    settings.appPassword = document.getElementById('appPassword').value;
    settings.message = document.getElementById('message').value;
    settings.imagePath = document.getElementById('imagePath').value;
    settings.imageAltText = document.getElementById('imageAltText').value;

    if (websocket && websocket.readyState === 1) {
        websocket.send(JSON.stringify({ event: 'setSettings', context: uuid, payload: settings }));
    }
}

document.addEventListener('DOMContentLoaded', function () {
    ['handle', 'appPassword', 'message', 'imagePath', 'imageAltText'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', saveSettings);
            element.addEventListener('change', saveSettings);
        }
    });

    const browseButton = document.getElementById('browseButton');
    const fileInput = document.getElementById('fileInput');
    const imagePathInput = document.getElementById('imagePath');

    if (browseButton && fileInput) {
        browseButton.addEventListener('click', function () {
            fileInput.click();
        });

        fileInput.addEventListener('change', function (e) {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                let path = file.path || file.webkitRelativePath || file.name;
                try { path = decodeURIComponent(path); } catch (err) { /* use original */ }
                imagePathInput.value = path;
                saveSettings();
            }
        });
    }
});
