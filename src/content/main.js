window.TimTools = window.TimTools || {};

(function () {
    const Settings = window.TimTools.Settings;
    const Modules = window.TimTools.Modules;

    // Wait for window load or run immediately if already loaded
    if (document.readyState === 'loading') {
        window.addEventListener('load', init);
    } else {
        init();
    }

    async function init() {
        console.log('[GP-TimTools] Initializing...');

        const settings = await Settings.getAll();
        console.log('[GP-TimTools] Settings loaded:', settings);

        if (settings.enableUpButton) {
            if (Modules.UpButton) {
                Modules.UpButton.init();
                console.log('[GP-TimTools] Up Button module loaded.');
            } else {
                console.error('[GP-TimTools] Up Button module missing!');
            }
        }

        if (settings.enableDateSearch) {
            if (Modules.DateSearch) {
                Modules.DateSearch.init();
                console.log('[GP-TimTools] Date Search module loaded.');
            }
        }

        if (settings.enableDeleteShortcut) {
            if (Modules.DeleteShortcut) {
                Modules.DeleteShortcut.init();
                console.log('[GP-TimTools] Delete Shortcut module loaded.');
            }
        }

        if (settings.enableKmlExport) {
            // KML Controller is nested
            if (Modules.KmlExport && Modules.KmlExport.Controller) {
                console.log('[GP-TimTools] Initializing KML Export Controller...');
                Modules.KmlExport.Controller.init();
                console.log('[GP-TimTools] KML Export module loaded.');
            } else {
                console.error('[GP-TimTools] KML Export Controller not found!', Modules.KmlExport);
            }
        }

        if (settings.enableDragInTime) {
            if (Modules.DragInTime) {
                Modules.DragInTime.init();
                console.log('[GP-TimTools] Drag in Time module loaded.');
            } else {
                console.error('[GP-TimTools] Drag in Time module missing!');
            }
        }
    }
})();
