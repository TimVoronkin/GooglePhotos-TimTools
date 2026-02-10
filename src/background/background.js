// Background Service Worker
// Stateless architecture: Tab IDs are passed around via messages and URL parameters

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // Command from Master to Open/Update Extraction Tab
    if (message.type === 'OPEN_EXTRACT_TAB') {
        let urlStr = message.url;
        const previousTabId = message.existingTabId;
        const masterTabId = sender.tab.id;

        // Append Master ID to URL Hash so it survives redirects
        // (Service Workers are ephemeral, so we can't rely on global vars)
        try {
            const urlObj = new URL(urlStr);
            const hashParams = new URLSearchParams(urlObj.hash.substring(1));
            hashParams.set('gp_master_id', masterTabId);
            urlObj.hash = hashParams.toString();
            urlStr = urlObj.toString();
        } catch (e) {
            console.error('[TimMapExport] [BG] Invalid URL:', urlStr);
        }

        if (previousTabId) {
            // User requested robust "Close and Open" strategy
            chrome.tabs.remove(previousTabId, () => {
                const err = chrome.runtime.lastError; // Consume error if tab doesn't exist
                createExtractionTab(urlStr, sendResponse);
            });
        } else {
            createExtractionTab(urlStr, sendResponse);
        }

        return true; // Keep message channel open for async response
    }

    // Command from Child (Extraction Tab) sending Data
    if (message.type === 'GP_KML_DATA' || message.type === 'GP_KML_ERROR') {
        const masterId = message.payload.masterId;
        const senderTabId = sender.tab ? sender.tab.id : null;

        const logToChild = (msg) => {
            if (senderTabId) {
                chrome.tabs.sendMessage(senderTabId, { type: 'GP_LOG', payload: `[TimMapExport] ${msg}` }).catch(() => { });
            }
        };

        logToChild(`[BG] Received data. Routing to Master ID: ${masterId}`);

        if (masterId && masterId !== 'null' && masterId !== 'undefined') {
            const masterIdInt = parseInt(masterId);

            // Check if Master exists first
            chrome.tabs.get(masterIdInt, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    console.error('[TimMapExport] [BG] Master tab not found:', chrome.runtime.lastError);
                    logToChild(`[BG] ERROR: Master tab ${masterId} not found! It might be closed.`);
                    // Send error back to child to display
                    if (senderTabId) {
                        chrome.tabs.sendMessage(senderTabId, {
                            type: 'GP_KML_ERROR',
                            payload: 'Connection Lost: Master tab closed or unreachable.',
                            masterId: masterId
                        }).catch(() => { });
                    }
                    return;
                }

                if (tab.discarded) {
                    console.error('[TimMapExport] [BG] Master tab is DISCARDED (frozen). Cannot send data.');
                    logToChild('[BG] CRITICAL: Master tab was frozed/discarded by Chrome to save memory. State is lost.');
                    return;
                }

                logToChild(`[BG] Master tab found (id: ${tab.id}, status: ${tab.status}). Sending data...`);

                chrome.tabs.sendMessage(masterIdInt, message, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[TimMapExport] [BG] Failed to send to Master:', chrome.runtime.lastError.message);
                        logToChild(`[BG] ERROR sending to Master: ${chrome.runtime.lastError.message}`);
                    } else {
                        console.log('[TimMapExport] [BG] Delivered to Master successfully.');
                        logToChild('[BG] Data delivered to Master. Waiting for Master processing...');
                    }
                });
            });
        } else {
            console.error('[TimMapExport] [BG] GP_KML_DATA received without valid masterId in payload', message);
            logToChild(`[BG] ERROR: No valid Master ID provided! (Got: ${masterId})`);
        }

        // Acknowledge receipt to Child
        sendResponse({ status: "received_by_bg" });
        return true; // Keep channel open
    }

    // Command to Close Extraction Tab
    if (message.type === 'CLOSE_EXTRACT_TAB') {
        const childTabId = message.tabId;
        if (childTabId) {
            chrome.tabs.remove(childTabId).catch(() => { });
        }
        // Activate the Master (Sender) tab
        if (sender.tab && sender.tab.id) {
            chrome.tabs.update(sender.tab.id, { active: true }).catch(() => { });
        }
    }

    // Command to Stop Process
    if (message.type === 'STOP_EXTRACT') {
        // Broadcast to child if ID provided
        const childTabId = message.childTabId;
        if (childTabId) {
            chrome.tabs.sendMessage(childTabId, { type: 'STOP_EXTRACT' }).catch(() => { });
        }

        // If masterId provided (e.g. from Child), tell Master
        const masterId = message.masterId;
        if (masterId) {
            chrome.tabs.sendMessage(parseInt(masterId), { type: 'STOP_EXTRACT' }).catch(() => { });
        }
    }
});

function createExtractionTab(url, sendResponse) {
    chrome.tabs.create({ url: url, active: true }, (tab) => {
        sendResponse({ tabId: tab.id });
    });
}
