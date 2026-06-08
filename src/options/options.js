document.addEventListener('DOMContentLoaded', restoreOptions);

// inputs
const kmlCreateSubfolder = document.getElementById('kmlCreateSubfolder');
const kmlFolderName = document.getElementById('kmlFolderName');
const kmlFilePrefix = document.getElementById('kmlFilePrefix');
const enableKmlExport = document.getElementById('enableKmlExport');
const kmlSection = document.getElementById('kml-section');
const folderInputWrapper = document.getElementById('folderInputWrapper');
const enableUpButton = document.getElementById('enableUpButton');
const enableDateSearch = document.getElementById('enableDateSearch');
const enableDeleteShortcut = document.getElementById('enableDeleteShortcut');
const upButtonClosePhoto = document.getElementById('upButtonClosePhoto');
const upButtonSubSection = document.getElementById('up-button-sub-section');

// Elements requiring auto-save
const allInputs = [
    kmlCreateSubfolder,
    kmlFolderName,
    kmlFilePrefix,
    enableKmlExport,
    enableUpButton,
    enableDateSearch,
    enableDeleteShortcut,
    upButtonClosePhoto
];

// Events
allInputs.forEach(el => {
    if (el.type === 'checkbox') {
        el.addEventListener('change', () => {
            updateUI(); // Toggle sections immediately
            saveOptions();
        });
    } else if (el.type === 'text') {
        el.addEventListener('input', () => {
            updateUI(); // Resize inputs immediately
            debouncedSave();
        });
    }
});

let debounceTimer;
function debouncedSave() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveOptions, 500);
}

function restoreOptions() {
    if (!window.TimTools || !window.TimTools.Settings) {
        console.error('[TimTools] Settings module not loaded!');
        return;
    }

    window.TimTools.Settings.getAll().then(items => {
        enableUpButton.checked = items.enableUpButton;
        upButtonClosePhoto.checked = items.upButtonClosePhoto;
        enableDateSearch.checked = items.enableDateSearch;
        enableDeleteShortcut.checked = items.enableDeleteShortcut;
        enableKmlExport.checked = items.enableKmlExport;

        kmlCreateSubfolder.checked = items.kmlCreateSubfolder !== false;
        kmlFolderName.value = items.kmlFolderName;
        kmlFilePrefix.value = items.kmlFilePrefix;

        updateUI();
    });
}

function updateUI() {
    // Toggle Up Button Section
    if (enableUpButton.checked) {
        upButtonSubSection.classList.add('visible');
    } else {
        upButtonSubSection.classList.remove('visible');
    }

    // Toggle KML Section
    if (enableKmlExport.checked) {
        kmlSection.classList.add('visible');
    } else {
        kmlSection.classList.remove('visible');
    }

    // Toggle Folder Input visibility
    const isSubfolder = kmlCreateSubfolder.checked;
    folderInputWrapper.style.display = isSubfolder ? 'inline-flex' : 'none';

    // Auto-resize text inputs
    adjustInputWidth(kmlFolderName);
    adjustInputWidth(kmlFilePrefix);
}

function adjustInputWidth(input) {
    // Create a temporary span to measure text width
    const span = document.createElement('span');
    span.style.font = window.getComputedStyle(input).font;
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';

    // Use placeholder if empty, otherwise value
    span.textContent = input.value || input.placeholder;

    document.body.appendChild(span);
    const width = span.offsetWidth;
    document.body.removeChild(span);

    // Add a little padding (e.g., 10px) and set width
    input.style.width = `${width + 10}px`;
}

function saveOptions() {
    window.TimTools.Settings.set({
        enableUpButton: enableUpButton.checked,
        upButtonClosePhoto: upButtonClosePhoto.checked,
        enableDateSearch: enableDateSearch.checked,
        enableDeleteShortcut: enableDeleteShortcut.checked,
        enableKmlExport: enableKmlExport.checked,
        kmlCreateSubfolder: kmlCreateSubfolder.checked,
        kmlFolderName: kmlFolderName.value,
        kmlFilePrefix: kmlFilePrefix.value
    }).then(() => {
        console.log('[TimTools] Settings saved');
    });
}
