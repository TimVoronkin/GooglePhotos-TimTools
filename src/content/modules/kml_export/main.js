window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};
window.TimTools.Modules.KmlExport = window.TimTools.Modules.KmlExport || {};

(function () {
    const KmlExport = {
        photoQueue: [],
        extractedData: [],
        isProcessing: false,
        childTabId: null,
        startTime: 0,

        init: function () {
            console.log('[TimTools] KML Controller: Init');

            // Ask the service worker if this tab is an extraction tab
            // (We can't use URL hash because Google Photos strips it)
            chrome.runtime.sendMessage({ type: 'CHECK_EXTRACTION_MODE' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[TimTools] KML Controller: Error checking mode:', chrome.runtime.lastError);
                    // Fallback to Master Mode
                    this.startMasterMode();
                    return;
                }

                console.log('[TimTools] KML Controller: Mode check response:', response);

                if (response && response.isExtraction) {
                    console.log('[TimTools] KML Controller: Child Mode, masterId:', response.masterId);
                    // Show progress popup on child tab
                    const p = response.progress || {};
                    if (p.current !== undefined && p.total !== undefined) {
                        window.TimTools.Modules.KmlExport.UI.PopupManager.show(
                            p.current, p.total, p.startTime || Date.now(), `Extracting ${p.current + 1}/${p.total}...`
                        );
                    }
                    window.TimTools.Modules.KmlExport.Extractor.run(response.masterId);
                } else {
                    this.startMasterMode();
                }
            });

            // Message Listener
            chrome.runtime.onMessage.addListener((message) => this.onMessage(message));
        },

        startMasterMode: function () {
            console.log('[TimTools] KML Controller: Master Mode');
            this.listenForStop();
            this.initMaster();
        },

        initMaster: function () {
            console.log('[TimTools] KML Controller: Starting Observer');
            // Observe for toolbar
            const observer = new MutationObserver((mutations) => {
                // Throttle or just log occasionally if needed, but for now just call inject
                // console.log('[TimTools] DOM Mutation detected'); 
                window.TimTools.Modules.KmlExport.UI.injectButton(() => this.handleExportClick());
            });
            observer.observe(document.body, { childList: true, subtree: true });

            // Initial attempt
            window.TimTools.Modules.KmlExport.UI.injectButton(() => this.handleExportClick());
        },

        handleExportClick: function () {
            if (this.isProcessing) {
                alert('Already processing photos.');
                return;
            }

            const SELECTED_PHOTO_SELECTOR = '.rtIMgb.nV0gYe.WjVZdb.R1sU4e';
            const selectedPhotos = document.querySelectorAll(SELECTED_PHOTO_SELECTOR);

            if (selectedPhotos.length === 0) {
                alert('No photos selected!');
                return;
            }

            this.photoQueue = [];
            this.extractedData = [];

            selectedPhotos.forEach(photoDiv => {
                const linkElement = photoDiv.querySelector('a');
                if (linkElement && linkElement.href) {
                    this.photoQueue.push(linkElement.href);
                }
            });

            if (this.photoQueue.length === 0) {
                alert('No valid photo links found.');
                return;
            }

            if (!confirm(`Found ${this.photoQueue.length} photos. Start processing?`)) return;

            this.isProcessing = true;
            this.startTime = Date.now();

            const total = this.photoQueue.length;
            const current = 0;

            window.TimTools.Modules.KmlExport.UI.PopupManager.show(current, total, this.startTime, "Starting batch...");
            this.openNextPhotoInChild(current, total);
        },

        openNextPhotoInChild: function (current, total) {
            if (this.photoQueue.length === 0) {
                this.finishProcessing();
                return;
            }

            if (!this.isProcessing) return;

            const nextUrl = this.photoQueue.shift();
            // No need to add hash params — the service worker tracks extraction tabs internally

            window.TimTools.Modules.KmlExport.UI.PopupManager.update(current, total, this.startTime, "Opening next photo...");

            chrome.runtime.sendMessage({
                type: 'OPEN_EXTRACT_TAB',
                url: nextUrl,
                existingTabId: this.childTabId,
                progress: { current, total, startTime: this.startTime }
            }, (response) => {
                if (response && response.tabId) {
                    this.childTabId = response.tabId;
                }
            });
        },

        onMessage: function (message) {
            console.log('[TimTools] KML Controller: Received message', message.type);
            if (message.type === 'GP_KML_DATA') {
                this.extractedData.push(message.payload);

                const total = this.extractedData.length + this.photoQueue.length + 1;
                const current = this.extractedData.length + 1;

                window.TimTools.Modules.KmlExport.UI.PopupManager.show(current, total, this.startTime, "Photo extracted");
                setTimeout(() => this.openNextPhotoInChild(current, total), 500);

            } else if (message.type === 'GP_KML_ERROR') {
                console.warn('Skipping photo due to error:', message.payload);
                const total = this.extractedData.length + this.photoQueue.length + 1;
                const current = this.extractedData.length + 1;
                window.TimTools.Modules.KmlExport.UI.PopupManager.show(current, total, this.startTime, "Error extracting, skipping...");
                setTimeout(() => this.openNextPhotoInChild(current, total), 500);

            } else if (message.type === 'STOP_EXTRACT') {
                this.stopProcessing();
            }
        },

        finishProcessing: function () {
            this.isProcessing = false;
            window.TimTools.Modules.KmlExport.UI.PopupManager.close();

            chrome.runtime.sendMessage({ type: 'CLOSE_EXTRACT_TAB', tabId: this.childTabId });
            this.childTabId = null;

            // Switch focus back to this (master) tab
            chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', tabId: 'self' });

            if (this.extractedData.length > 0) {
                this.extractedData.sort((a, b) => a.timestamp - b.timestamp);
                const kmlContent = window.TimTools.Modules.KmlExport.Generator.generateKML(this.extractedData);
                window.TimTools.Modules.KmlExport.Generator.downloadKML(kmlContent, this.extractedData[0].timestamp);
            } else {
                alert('No data extracted.');
            }
        },

        listenForStop: function () {
            document.addEventListener('gp-stop-processing', () => {
                this.stopProcessing();
            });
        },

        stopProcessing: function () {
            if (!this.isProcessing) return;
            this.isProcessing = false;
            window.TimTools.Modules.KmlExport.UI.PopupManager.close();

            if (this.childTabId) {
                chrome.runtime.sendMessage({ type: 'CLOSE_EXTRACT_TAB', tabId: this.childTabId });
                this.childTabId = null;
            }
        }
    };

    window.TimTools.Modules.KmlExport.Controller = KmlExport;
})();
