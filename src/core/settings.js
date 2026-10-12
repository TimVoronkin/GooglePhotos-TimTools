window.TimTools = window.TimTools || {};

(function () {
    const DEFAULTS = {
        enableUpButton: true,
        upButtonClosePhoto: true,
        enableDateSearch: true,
        enableDeleteShortcut: true,
        enableKmlExport: true,
        enableDragInTime: true,
        enableSmartArchiving: true,
        enableAlbumQuickRemove: true,
        albumQuickRemoveConfirm: true,
        smartArchivingFilters: [],
        smartArchivingFiltersByAccount: {},
        kmlCreateSubfolder: true,
        kmlFolderName: "GooglePhotosExports",
        kmlFilePrefix: "MyExport_",
        appTheme: "dark",
        enableCustomIconColors: false,
        customIconColorDark: "#709900",
        customIconColorLight: "#B8F500",
        enableDebugLogging: false
    };

    const logger = (window.TimTools.Logger && window.TimTools.Logger.create)
        ? window.TimTools.Logger.create('Settings')
        : {
            log: (...args) => console.log('[GP-TimTools][Settings]', ...args),
            warn: (...args) => console.warn('[GP-TimTools][Settings]', ...args),
            error: (...args) => console.error('[GP-TimTools][Settings]', ...args)
        };

    window.TimTools.Settings = {
        get: function (keys) {
            return new Promise((resolve) => {
                chrome.storage.sync.get(keys || DEFAULTS, (items) => {
                    if (chrome.runtime.lastError) {
                        logger.warn('chrome.storage.sync.get warning:', chrome.runtime.lastError.message);
                    }
                    // Merge with defaults to ensure all keys exist
                    resolve({ ...DEFAULTS, ...(items || {}) });
                });
            });
        },

        set: function (items) {
            return new Promise((resolve) => {
                chrome.storage.sync.set(items, () => {
                    if (chrome.runtime.lastError) {
                        logger.error('chrome.storage.sync.set error:', chrome.runtime.lastError.message);
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
            });
        },

        getAll: function () {
            return this.get(null);
        }
    };
})();
