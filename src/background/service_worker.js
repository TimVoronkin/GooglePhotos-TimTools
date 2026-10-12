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
// Backed by chrome.storage.session to survive Manifest V3 Service Worker restarts
const extractionTabs = {};

async function getExtractionTab(tabId) {
    if (!tabId) return null;
    if (chrome.storage && chrome.storage.session) {
        const key = `extract_tab_${tabId}`;
        const res = await chrome.storage.session.get(key);
        return res[key] || null;
    }
    return extractionTabs[tabId] || null;
}

async function setExtractionTab(tabId, data) {
    if (!tabId) return;
    extractionTabs[tabId] = data;
    if (chrome.storage && chrome.storage.session) {
        await chrome.storage.session.set({ [`extract_tab_${tabId}`]: data });
    }
}

async function deleteExtractionTab(tabId) {
    if (!tabId) return;
    delete extractionTabs[tabId];
    if (chrome.storage && chrome.storage.session) {
        await chrome.storage.session.remove(`extract_tab_${tabId}`);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // Command from Master to Open/Update Extraction Tab
    if (message.type === 'OPEN_EXTRACT_TAB') {
        logger.log('Received OPEN_EXTRACT_TAB', message.url);
        let urlStr = message.url;
        const previousTabId = message.existingTabId;
        const masterTabId = sender.tab ? sender.tab.id : null;
        const progress = message.progress || {};

        if (previousTabId) {
            chrome.tabs.update(previousTabId, { url: urlStr, active: true }, async (tab) => {
                if (chrome.runtime.lastError) {
                    logger.log('Tab closed, creating new.');
                    createExtractionTab(urlStr, masterTabId, progress, sendResponse);
                } else {
                    logger.log('Updated tab', tab.id);
                    await setExtractionTab(tab.id, { masterTabId, progress });
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
        const tabId = sender.tab ? sender.tab.id : null;
        getExtractionTab(tabId).then((info) => {
            logger.log('CHECK_EXTRACTION_MODE from tab', tabId, '-> info:', info);
            if (info) {
                sendResponse({ isExtraction: true, masterId: info.masterTabId.toString(), progress: info.progress });
            } else {
                sendResponse({ isExtraction: false });
            }
        });
        return true;
    }

    // Command from Child to Close Itself
    if (message.type === 'CLOSE_EXTRACT_TAB') {
        logger.log('Closing tab', message.tabId);
        if (message.tabId) {
            deleteExtractionTab(message.tabId);
            chrome.tabs.remove(message.tabId);
        }
    }

    // Data from Child -> Background -> Master
    if (message.type === 'GP_KML_DATA' || message.type === 'GP_KML_ERROR') {
        (async () => {
            let masterId = message.masterId;
            if (!masterId && sender.tab) {
                const info = await getExtractionTab(sender.tab.id);
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
        })();
        return true;
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
    chrome.tabs.create({ url: url, active: true }, async (tab) => {
        logger.log('Created tab', tab.id, 'for master', masterTabId);
        await setExtractionTab(tab.id, { masterTabId, progress });
        sendResponse({ tabId: tab.id });
    });
}
