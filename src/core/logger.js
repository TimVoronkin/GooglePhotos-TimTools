window.TimTools = window.TimTools || {};

(function () {
    let debugEnabled = false;

    // Load initial setting from storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ enableDebugLogging: false }, (items) => {
            if (!chrome.runtime.lastError && items) {
                debugEnabled = items.enableDebugLogging === true;
            }
        });

        // Listen for live toggle changes
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && changes.enableDebugLogging !== undefined) {
                debugEnabled = changes.enableDebugLogging.newValue === true;
            }
        });
    }

    const Logger = {
        init: function (enabled) {
            debugEnabled = !!enabled;
        },

        setEnabled: function (enabled) {
            debugEnabled = !!enabled;
        },

        isEnabled: function () {
            return debugEnabled;
        },

        create: function (moduleName) {
            const prefix = `[GP-TimTools][${moduleName}]`;
            return {
                log: (...args) => {
                    if (debugEnabled) console.log(prefix, ...args);
                },
                warn: (...args) => {
                    if (debugEnabled) console.warn(prefix, ...args);
                },
                error: (...args) => {
                    if (debugEnabled) console.error(prefix, ...args);
                },
                info: (...args) => {
                    if (debugEnabled) console.info(prefix, ...args);
                }
            };
        }
    };

    window.TimTools.Logger = Logger;
})();
