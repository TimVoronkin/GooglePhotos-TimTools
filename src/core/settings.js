window.TimTools = window.TimTools || {};

(function () {
    const DEFAULTS = {
        enableUpButton: true,
        upButtonClosePhoto: false,
        enableDateSearch: true,
        enableDeleteShortcut: true,
        enableKmlExport: true,
        enableDragInTime: true,
        enableSmartArchiving: true,
        smartArchivingFilters: [],
        smartArchivingFiltersByAccount: {},
        kmlCreateSubfolder: true,
        kmlFolderName: "GooglePhotosExports",
        kmlFilePrefix: "MyExport_",
        appTheme: "dark",
        enableCustomIconColors: false,
        customIconColorDark: "#0B57D0",
        customIconColorLight: "#A8C7FA"
    };

    window.TimTools.Settings = {
        get: function (keys) {
            return new Promise((resolve) => {
                chrome.storage.sync.get(keys || DEFAULTS, (items) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[GP-TimTools] chrome.storage.sync.get warning:', chrome.runtime.lastError.message);
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
                        console.error('[GP-TimTools] chrome.storage.sync.set error:', chrome.runtime.lastError.message);
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
