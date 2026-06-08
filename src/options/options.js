document.addEventListener('DOMContentLoaded', restoreOptions);

// inputs
const kmlCreateSubfolder = document.getElementById('kmlCreateSubfolder');
const kmlFolderName = document.getElementById('kmlFolderName');
const kmlFilePrefix = document.getElementById('kmlFilePrefix');
const enableKmlExport = document.getElementById('enableKmlExport');
const kmlSection = document.getElementById('kml-section');
const folderInputWrapper = document.getElementById('folderInputWrapper');
const enableUpLink = document.getElementById('enableUpLink');
const enableDateSearch = document.getElementById('enableDateSearch');

// Elements requiring auto-save
const allInputs = [
    kmlCreateSubfolder,
    kmlFolderName,
    kmlFilePrefix,
    enableKmlExport,
    enableUpLink,
    enableDateSearch
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
        enableUpLink.checked = items.enableUpLink;
        enableDateSearch.checked = items.enableDateSearch;
        enableKmlExport.checked = items.enableKmlExport;

        kmlCreateSubfolder.checked = items.kmlCreateSubfolder !== false;
        kmlFolderName.value = items.kmlFolderName;
        kmlFilePrefix.value = items.kmlFilePrefix;

        updateUI();
    });
}

function updateUI() {
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
        enableUpLink: enableUpLink.checked,
        enableDateSearch: enableDateSearch.checked,
        enableKmlExport: enableKmlExport.checked,
        kmlCreateSubfolder: kmlCreateSubfolder.checked,
        kmlFolderName: kmlFolderName.value,
        kmlFilePrefix: kmlFilePrefix.value
    }).then(() => {
        console.log('[TimTools] Settings saved');
    });
}
