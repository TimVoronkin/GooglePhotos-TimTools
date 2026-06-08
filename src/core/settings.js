window.TimTools = window.TimTools || {};

(function () {
    const DEFAULTS = {
        enableUpLink: true,
        upLinkClosePhoto: false,
        enableDateSearch: true,
        enableKmlExport: true,
        kmlCreateSubfolder: true,
        kmlFolderName: "GooglePhotosExports",
        kmlFilePrefix: "MyExport_"
    };

    window.TimTools.Settings = {
        get: function (keys) {
            return new Promise((resolve) => {
                chrome.storage.sync.get(keys || DEFAULTS, (items) => {
                    // Merge with defaults to ensure all keys exist
                    resolve({ ...DEFAULTS, ...items });
                });
            });
        },

        set: function (items) {
            return new Promise((resolve) => {
                chrome.storage.sync.set(items, () => {
                    resolve();
                });
            });
        },

        getAll: function () {
            return this.get(null);
        }
    };
})();
