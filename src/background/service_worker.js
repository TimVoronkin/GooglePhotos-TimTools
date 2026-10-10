// Background Service Worker
// Stateless architecture: Tab IDs are passed around via messages and URL parameters

let debugLoggingEnabled = false;

if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ enableDebugLogging: false }, (res) => {
        debugLoggingEnabled = !!res.enableDebugLogging;
    });
}
if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.enableDebugLogging) {
            debugLoggingEnabled = !!changes.enableDebugLogging.newValue;
        }
    });
}

const logger = {
    log: (...args) => { if (debugLoggingEnabled) console.log('[GP-TimTools][ServiceWorker]', ...args); },
    warn: (...args) => { if (debugLoggingEnabled) console.warn('[GP-TimTools][ServiceWorker]', ...args); },
    error: (...args) => { if (debugLoggingEnabled) console.error('[GP-TimTools][ServiceWorker]', ...args); }
};

// Open Options Page on Icon Click
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

// Track extraction tabs: { childTabId: { masterTabId, progress } }
const extractionTabs = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // Command from Master to Open/Update Extraction Tab
    if (message.type === 'OPEN_EXTRACT_TAB') {
        logger.log('Received OPEN_EXTRACT_TAB', message.url);
        let urlStr = message.url;
        const previousTabId = message.existingTabId;
        const masterTabId = sender.tab.id;
        const progress = message.progress || {};

        if (previousTabId) {
            chrome.tabs.update(previousTabId, { url: urlStr, active: true }, (tab) => {
                if (chrome.runtime.lastError) {
                    logger.log('Tab closed, creating new.');
                    createExtractionTab(urlStr, masterTabId, progress, sendResponse);
                } else {
                    logger.log('Updated tab', tab.id);
                    extractionTabs[tab.id] = { masterTabId, progress };
                    sendResponse({ tabId: tab.id });
                }
            });
        } else {
            logger.log('Creating new tab.');
            createExtractionTab(urlStr, masterTabId, progress, sendResponse);
        }
        return true; // async response
    }

    // Child tab asks: "Am I an extraction tab?"
    if (message.type === 'CHECK_EXTRACTION_MODE') {
        const tabId = sender.tab.id;
        const info = extractionTabs[tabId];
        logger.log('CHECK_EXTRACTION_MODE from tab', tabId, '-> info:', info);
        if (info) {
            sendResponse({ isExtraction: true, masterId: info.masterTabId.toString(), progress: info.progress });
        } else {
            sendResponse({ isExtraction: false });
        }
        return true;
    }

    // Command from Child to Close Itself
    if (message.type === 'CLOSE_EXTRACT_TAB') {
        logger.log('Closing tab', message.tabId);
        if (message.tabId) {
            delete extractionTabs[message.tabId];
            chrome.tabs.remove(message.tabId);
        }
    }

    // Data from Child -> Background -> Master
    if (message.type === 'GP_KML_DATA' || message.type === 'GP_KML_ERROR') {
        // masterId can come from the message payload or from our tracking
        let masterId = message.masterId;
        if (!masterId && sender.tab) {
            const info = extractionTabs[sender.tab.id];
            if (info) masterId = info.masterTabId;
        }
        logger.log('Received', message.type, 'from child. Relaying to Master:', masterId);
        if (masterId) {
            // Ensure masterId is in the payload for the master to read
            const relay = { ...message, masterId: masterId };
            chrome.tabs.sendMessage(parseInt(masterId), relay, (response) => {
                if (chrome.runtime.lastError) {
                    logger.error('Error relaying to master:', chrome.runtime.lastError.message);
                }
            });
        } else {
            logger.warn('No masterId for this child tab!');
        }
    }

    // Command to Download KML
    if (message.type === 'DOWNLOAD_KML') {
        const { content, filename, folder } = message.payload;

        const dataUrl = 'data:application/vnd.google-earth.kml+xml;charset=utf-8,' + encodeURIComponent(content);

        let path = filename;
        if (folder && folder.trim() !== '') {
            const cleanFolder = folder.replace(/^\/|\/$/g, '');
            path = `${cleanFolder}/${filename}`;
        }

        logger.log('Downloading KML to:', path);
        chrome.downloads.download({
            url: dataUrl,
            filename: path,
            saveAs: false
        });
    }

    // Activate a specific tab (used to switch back to master after processing)
    if (message.type === 'ACTIVATE_TAB') {
        let tabId = message.tabId;
        if (tabId === 'self' && sender.tab) {
            tabId = sender.tab.id;
        }
        logger.log('Activating tab', tabId);
        if (tabId) {
            chrome.tabs.update(parseInt(tabId), { active: true });
        }
    }
});

function createExtractionTab(url, masterTabId, progress, sendResponse) {
    chrome.tabs.create({ url: url, active: true }, (tab) => {
        logger.log('Created tab', tab.id, 'for master', masterTabId);
        extractionTabs[tab.id] = { masterTabId, progress };
        sendResponse({ tabId: tab.id });
    });
}
