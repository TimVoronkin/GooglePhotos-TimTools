document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    initMobileBookmarklet();
});

// Main toggles
const enableDragInTime = document.getElementById('enableDragInTime');
const enableSmartArchiving = document.getElementById('enableSmartArchiving');
const enableKmlExport = document.getElementById('enableKmlExport');
const enableDateSearch = document.getElementById('enableDateSearch');
const enableUpButton = document.getElementById('enableUpButton');
const enableDeleteShortcut = document.getElementById('enableDeleteShortcut');
const enableCustomIconColors = document.getElementById('enableCustomIconColors');

// Nested controls
const upButtonClosePhoto = document.getElementById('upButtonClosePhoto');
const upButtonSubSection = document.getElementById('up-button-sub-section');

const kmlSection = document.getElementById('kml-section');
const kmlCreateSubfolder = document.getElementById('kmlCreateSubfolder');
const kmlFolderName = document.getElementById('kmlFolderName');
const kmlFilePrefix = document.getElementById('kmlFilePrefix');
const folderInputWrapper = document.getElementById('folderInputWrapper');

const customColorsSubSection = document.getElementById('custom-colors-sub-section');
const customIconColorDarkPicker = document.getElementById('customIconColorDarkPicker');
const customIconColorDarkHex = document.getElementById('customIconColorDarkHex');
const customIconColorLightPicker = document.getElementById('customIconColorLightPicker');
const customIconColorLightHex = document.getElementById('customIconColorLightHex');

// Theme radios
const themeRadioDark = document.getElementById('themeRadioDark');
const themeRadioLight = document.getElementById('themeRadioLight');
const themeRadios = [themeRadioDark, themeRadioLight].filter(Boolean);

// Status indicator
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

// Cards for visual dimming
const cards = {
    dragInTime: { toggle: enableDragInTime, card: document.getElementById('card-dragInTime') },
    smartArchiving: { toggle: enableSmartArchiving, card: document.getElementById('card-smartArchiving') },
    kmlExport: { toggle: enableKmlExport, card: document.getElementById('card-kmlExport') },
    dateSearch: { toggle: enableDateSearch, card: document.getElementById('card-dateSearch') },
    upButton: { toggle: enableUpButton, card: document.getElementById('card-upButton') },
    deleteShortcut: { toggle: enableDeleteShortcut, card: document.getElementById('card-deleteShortcut') }
};

// Checkbox and text inputs requiring auto-save
const checkableInputs = [
    enableDragInTime,
    enableSmartArchiving,
    enableKmlExport,
    enableDateSearch,
    enableUpButton,
    enableDeleteShortcut,
    enableCustomIconColors,
    upButtonClosePhoto,
    kmlCreateSubfolder
].filter(Boolean);

checkableInputs.forEach(el => {
    el.addEventListener('change', () => {
        updateUI();
        debouncedSave();
    });
});

themeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        updateUI();
        debouncedSave();
    });
});

[kmlFolderName, kmlFilePrefix].filter(Boolean).forEach(el => {
    el.addEventListener('input', () => {
        adjustInputWidth(el);
        debouncedSave();
    });
});

// Color picker synchronization (Dark accent color)
if (customIconColorDarkPicker && customIconColorDarkHex) {
    customIconColorDarkPicker.addEventListener('input', () => {
        customIconColorDarkHex.value = customIconColorDarkPicker.value.toUpperCase();
        updateUI();
        debouncedSave();
    });
    customIconColorDarkHex.addEventListener('input', () => {
        const val = customIconColorDarkHex.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            customIconColorDarkPicker.value = val;
            updateUI();
            debouncedSave();
        }
    });
}

// Color picker synchronization (Light accent color)
if (customIconColorLightPicker && customIconColorLightHex) {
    customIconColorLightPicker.addEventListener('input', () => {
        customIconColorLightHex.value = customIconColorLightPicker.value.toUpperCase();
        updateUI();
        debouncedSave();
    });
    customIconColorLightHex.addEventListener('input', () => {
        const val = customIconColorLightHex.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            customIconColorLightPicker.value = val;
            updateUI();
            debouncedSave();
        }
    });
}

let debounceTimer = null;
function debouncedSave() {
    setSavingState(true);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        saveOptions();
    }, 400);
}

function setSavingState(isSaving) {
    if (!statusIndicator || !statusText) return;
    if (isSaving) {
        statusIndicator.classList.add('saving');
        statusText.textContent = 'Saving...';
    } else {
        statusIndicator.classList.remove('saving');
        statusText.textContent = 'Saved';
    }
}

function restoreOptions() {
    if (!window.TimTools || !window.TimTools.Settings) {
        console.error('[GP-TimTools] Settings module not loaded!');
        return;
    }

    window.TimTools.Settings.getAll().then(items => {
        const isLight = items.appTheme === 'light';
        if (themeRadioLight) themeRadioLight.checked = isLight;
        if (themeRadioDark) themeRadioDark.checked = !isLight;

        if (enableDragInTime) enableDragInTime.checked = items.enableDragInTime !== false;
        if (enableSmartArchiving) enableSmartArchiving.checked = items.enableSmartArchiving !== false;
        if (enableKmlExport) enableKmlExport.checked = items.enableKmlExport !== false;
        if (enableDateSearch) enableDateSearch.checked = items.enableDateSearch !== false;
        if (enableUpButton) enableUpButton.checked = items.enableUpButton !== false;
        if (enableDeleteShortcut) enableDeleteShortcut.checked = items.enableDeleteShortcut !== false;
        if (enableCustomIconColors) enableCustomIconColors.checked = items.enableCustomIconColors === true;

        if (upButtonClosePhoto) upButtonClosePhoto.checked = items.upButtonClosePhoto === true;
        if (kmlCreateSubfolder) kmlCreateSubfolder.checked = items.kmlCreateSubfolder !== false;
        if (kmlFolderName) kmlFolderName.value = items.kmlFolderName || 'GooglePhotosExports';
        if (kmlFilePrefix) kmlFilePrefix.value = items.kmlFilePrefix || 'MyExport_';

        const darkColor = items.customIconColorDark || '#0B57D0';
        const lightColor = items.customIconColorLight || '#A8C7FA';

        if (customIconColorDarkPicker) customIconColorDarkPicker.value = darkColor;
        if (customIconColorDarkHex) customIconColorDarkHex.value = darkColor.toUpperCase();
        if (customIconColorLightPicker) customIconColorLightPicker.value = lightColor;
        if (customIconColorLightHex) customIconColorLightHex.value = lightColor.toUpperCase();

        updateUI();
        adjustInputWidth(kmlFolderName);
        adjustInputWidth(kmlFilePrefix);
    });
}

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(138, 180, 248, ${alpha})`;
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    if (isNaN(num)) return `rgba(138, 180, 248, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyOptionsTheme() {
    const isCustom = enableCustomIconColors && enableCustomIconColors.checked;
    const lightColor = customIconColorLightHex ? customIconColorLightHex.value : '#8AB4F8';
    const lightAlpha12 = hexToRgba(lightColor, 0.12);

    if (isCustom) {
        document.documentElement.style.setProperty('--accent-blue', lightColor);
        document.documentElement.style.setProperty('--accent-blue-hover', lightColor);
        document.documentElement.style.setProperty('--switch-on', lightColor);

        document.querySelectorAll('.card-icon').forEach(el => {
            el.style.backgroundColor = lightColor;
        });
        document.querySelectorAll('.card-icon-wrapper').forEach(el => {
            el.style.background = lightAlpha12;
            el.style.color = lightColor;
        });
        const vTag = document.querySelector('.version-tag');
        if (vTag) {
            vTag.style.color = lightColor;
            vTag.style.background = lightAlpha12;
        }
    } else {
        document.documentElement.style.removeProperty('--accent-blue');
        document.documentElement.style.removeProperty('--accent-blue-hover');
        document.documentElement.style.removeProperty('--switch-on');

        document.querySelectorAll('.card-icon').forEach(el => {
            el.style.backgroundColor = '';
        });
        document.querySelectorAll('.card-icon-wrapper').forEach(el => {
            el.style.background = '';
            el.style.color = '';
        });
        const vTag = document.querySelector('.version-tag');
        if (vTag) {
            vTag.style.color = '';
            vTag.style.background = '';
        }
    }
}

function updateUI() {
    // 1. Update dimmed appearance of cards based on toggle state
    Object.values(cards).forEach(({ toggle, card }) => {
        if (toggle && card) {
            card.classList.toggle('disabled', !toggle.checked);
        }
    });

    // 2. Toggle folder input visibility inside KML Export
    if (folderInputWrapper && kmlCreateSubfolder) {
        folderInputWrapper.style.display = kmlCreateSubfolder.checked ? 'inline-flex' : 'none';
    }

    // 3. Toggle Custom Colors sub-section visibility
    if (customColorsSubSection && enableCustomIconColors) {
        customColorsSubSection.style.display = enableCustomIconColors.checked ? 'block' : 'none';
    }

    // 4. Update options page accent colors dynamically
    applyOptionsTheme();
}

function adjustInputWidth(input) {
    if (!input) return;
    const span = document.createElement('span');
    span.style.font = window.getComputedStyle(input).font;
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    span.textContent = input.value || input.placeholder || '';

    document.body.appendChild(span);
    const width = span.offsetWidth;
    document.body.removeChild(span);

    input.style.width = `${Math.max(width + 12, 50)}px`;
}

function saveOptions() {
    if (!window.TimTools || !window.TimTools.Settings) return;

    const selectedTheme = themeRadioLight && themeRadioLight.checked ? 'light' : 'dark';

    window.TimTools.Settings.set({
        appTheme: selectedTheme,
        enableDragInTime: enableDragInTime ? enableDragInTime.checked : true,
        enableSmartArchiving: enableSmartArchiving ? enableSmartArchiving.checked : true,
        enableKmlExport: enableKmlExport ? enableKmlExport.checked : true,
        enableDateSearch: enableDateSearch ? enableDateSearch.checked : true,
        enableUpButton: enableUpButton ? enableUpButton.checked : true,
        enableDeleteShortcut: enableDeleteShortcut ? enableDeleteShortcut.checked : true,
        enableCustomIconColors: enableCustomIconColors ? enableCustomIconColors.checked : false,
        upButtonClosePhoto: upButtonClosePhoto ? upButtonClosePhoto.checked : false,
        kmlCreateSubfolder: kmlCreateSubfolder ? kmlCreateSubfolder.checked : true,
        kmlFolderName: kmlFolderName ? kmlFolderName.value : 'GooglePhotosExports',
        kmlFilePrefix: kmlFilePrefix ? kmlFilePrefix.value : 'MyExport_',
        customIconColorDark: customIconColorDarkHex ? customIconColorDarkHex.value : '#0B57D0',
        customIconColorLight: customIconColorLightHex ? customIconColorLightHex.value : '#A8C7FA'
    }).then(() => {
        setSavingState(false);
    });
}

async function initMobileBookmarklet() {
    const dragLink = document.getElementById('dragBookmarkletLink');
    const copyBtn = document.getElementById('copyBookmarkletBtn');

    let bookmarkletCode = '';
    try {
        const fileUrl = chrome.runtime.getURL('src/content/modules/smart_archiving/mobile_bookmarklet.js');
        const res = await fetch(fileUrl);
        if (res.ok) {
            bookmarkletCode = (await res.text()).trim();
        }
    } catch (e) {
        console.warn('[GP-TimTools] Could not load mobile bookmarklet file:', e);
    }

    if (dragLink && bookmarkletCode) {
        dragLink.href = bookmarkletCode;

        const BOOKMARK_TITLE = 'TimTools - Smart Archiving';
        const BUTTON_LABEL = 'Drag to Bookmarks Bar';

        dragLink.title = BOOKMARK_TITLE;

        const setDragTitle = () => {
            const label = dragLink.querySelector('.bookmarklet-drag-label');
            if (label) label.textContent = BOOKMARK_TITLE;
        };

        const resetLabel = () => {
            const label = dragLink.querySelector('.bookmarklet-drag-label');
            if (label) label.textContent = BUTTON_LABEL;
        };

        // Must change BEFORE drag initialization starts (pointerdown / mousedown)
        dragLink.addEventListener('pointerdown', setDragTitle);
        dragLink.addEventListener('mousedown', setDragTitle);

        dragLink.addEventListener('dragstart', (e) => {
            setDragTitle();
            if (e.dataTransfer) {
                try {
                    e.dataTransfer.setData('text/plain', BOOKMARK_TITLE);
                } catch (_) {}
            }
        });

        dragLink.addEventListener('dragend', resetLabel);
        dragLink.addEventListener('mouseup', resetLabel);

        dragLink.addEventListener('click', (e) => {
            e.preventDefault();
            resetLabel();
            alert('To save this bookmarklet:\n\n1. Simply drag and drop this button onto your Chrome Bookmarks Bar (press Ctrl+Shift+B if the bar is hidden).\n\n2. Or click "Copy Bookmarklet Code" to copy the script and paste it into a new bookmark manually.');
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            if (bookmarkletCode) {
                try {
                    await navigator.clipboard.writeText(bookmarkletCode);
                    const span = copyBtn.querySelector('span');
                    const origText = span ? span.textContent : copyBtn.textContent;
                    if (span) span.textContent = 'Copied to clipboard!';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        if (span) span.textContent = origText;
                        copyBtn.classList.remove('copied');
                    }, 2200);
                } catch (err) {
                    console.error('Failed to copy to clipboard:', err);
                }
            }
        });
    }
}
