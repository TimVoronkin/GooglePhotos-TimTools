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
        console.log('[TimTools] Initializing...');

        const settings = await Settings.getAll();
        console.log('[TimTools] Settings loaded:', settings);

        if (settings.enableUpLink) {
            if (Modules.BackButton) {
                Modules.BackButton.init();
                console.log('[TimTools] Back Button module loaded.');
            } else {
                console.error('[TimTools] Back Button module missing!');
            }
        }

        if (settings.enableDateSearch) {
            if (Modules.DatePicker) {
                Modules.DatePicker.init();
                console.log('[TimTools] Date Picker module loaded.');
            }
        }

        if (settings.enableKmlExport) {
            // KML Controller is nested
            if (Modules.KmlExport && Modules.KmlExport.Controller) {
                console.log('[TimTools] Initializing KML Export Controller...');
                Modules.KmlExport.Controller.init();
                console.log('[TimTools] KML Export module loaded.');
            } else {
                console.error('[TimTools] KML Export Controller not found!', Modules.KmlExport);
            }
        }
    }
})();
