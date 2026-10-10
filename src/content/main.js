window.TimTools = window.TimTools || {};

(function () {
    const Settings = window.TimTools.Settings;
    const Modules = window.TimTools.Modules;
    const Theme = window.TimTools.Theme;

    // Wait for window load or run immediately if already loaded
    if (document.readyState === 'loading') {
        window.addEventListener('load', init);
    } else {
        init();
    }

    async function init() {
        const settings = await Settings.getAll();
        if (window.TimTools.Logger) {
            window.TimTools.Logger.init(settings.enableDebugLogging === true);
        }

        const logger = (window.TimTools.Logger && window.TimTools.Logger.create)
            ? window.TimTools.Logger.create('Main')
            : {
                log: (...args) => console.log('[GP-TimTools][Main]', ...args),
                warn: (...args) => console.warn('[GP-TimTools][Main]', ...args),
                error: (...args) => console.error('[GP-TimTools][Main]', ...args)
            };

        logger.log('Initializing modules...');

        if (Theme && typeof Theme.init === 'function') {
            Theme.init();
        }

        logger.log('Settings loaded:', settings);

        if (Theme && typeof Theme.setTheme === 'function') {
            Theme.setTheme(settings.appTheme || 'dark');
        }

        // Apply custom icon and accent colors
        applyCustomIconColors(settings);

        // Listen for settings changes dynamically
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync') {
                    if (changes.enableDebugLogging !== undefined && window.TimTools.Logger) {
                        window.TimTools.Logger.setEnabled(changes.enableDebugLogging.newValue === true);
                    }
                    Settings.getAll().then(updated => {
                        if (Theme && typeof Theme.setTheme === 'function') {
                            Theme.setTheme(updated.appTheme || 'dark');
                        }
                        applyCustomIconColors(updated);
                    });
                }
            });
        }

        if (settings.enableUpButton) {
            if (Modules.UpButton) {
                Modules.UpButton.init();
                logger.log('Up Button module loaded.');
            } else {
                logger.error('Up Button module missing!');
            }
        }

        if (settings.enableDateSearch) {
            if (Modules.DateSearch) {
                Modules.DateSearch.init();
                logger.log('Date Search module loaded.');
            }
        }

        if (settings.enableDeleteShortcut) {
            if (Modules.DeleteShortcut) {
                Modules.DeleteShortcut.init();
                logger.log('Delete Shortcut module loaded.');
            }
        }

        if (settings.enableKmlExport) {
            // KML Controller is nested
            if (Modules.KmlExport && Modules.KmlExport.Controller) {
                Modules.KmlExport.Controller.init();
                logger.log('KML Export module loaded.');
            } else {
                logger.error('KML Export Controller not found!', Modules.KmlExport);
            }
        }

        if (settings.enableDragInTime) {
            if (Modules.DragInTime) {
                Modules.DragInTime.init();
                logger.log('Drag in Time module loaded.');
            } else {
                logger.error('Drag in Time module missing!');
            }
        }

        if (settings.enableSmartArchiving) {
            if (Modules.SmartArchiving) {
                Modules.SmartArchiving.init();
                logger.log('Smart Archiving module loaded.');
            } else {
                logger.error('Smart Archiving module missing!');
            }
        }
    }

    function hexToRgba(hex, alpha) {
        if (!hex) return `rgba(138, 180, 248, ${alpha})`;
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const num = parseInt(hex, 16);
        if (isNaN(num)) return `rgba(138, 180, 248, ${alpha})`;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function applyCustomIconColors(settings) {
        let styleEl = document.getElementById('gp-timtools-custom-colors');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'gp-timtools-custom-colors';
            (document.head || document.documentElement).appendChild(styleEl);
        }

        const isCustom = !!settings.enableCustomIconColors;
        const appTheme = settings.appTheme || 'dark';

        // Google native accent colors (when Override is OFF)
        const GOOGLE_LIGHT_ACCENT = '#0B57D0';
        const GOOGLE_DARK_ACCENT = '#A8C7FA';

        // Custom accent colors (when Override is ON)
        const customDarkAccent = settings.customIconColorDark || GOOGLE_LIGHT_ACCENT;
        const customLightAccent = settings.customIconColorLight || GOOGLE_DARK_ACCENT;

        // Active accents for modals/dialogs/actions
        const lightDialogAccent = isCustom ? customDarkAccent : GOOGLE_LIGHT_ACCENT;
        const darkDialogAccent = isCustom ? customLightAccent : GOOGLE_DARK_ACCENT;

        const lightDialogAlpha12 = hexToRgba(lightDialogAccent, 0.12);
        const darkDialogAlpha12 = hexToRgba(darkDialogAccent, 0.12);
        const darkDialogAlpha20 = hexToRgba(darkDialogAccent, 0.20);

        // Toolbar icon colors:
        // When Override Accent Colors is OFF:
        //   Smart Archiving: Light = #444746, Dark = #C4C7C5
        //   Date Search & Picker: Light = #444746, Dark = #C4C7C5
        //   KML Geotag Export: Light = #0B57D0, Dark = #A8C7FA
        //   Up Navigation Button: ALWAYS #FFFFFF
        // When Override Accent Colors is ON:
        //   Light theme icons: customDarkAccent
        //   Dark theme icons: customLightAccent
        //   Up Navigation Button: customLightAccent
        const saLightColor = isCustom ? customDarkAccent : '#444746';
        const saDarkColor = isCustom ? customLightAccent : '#C4C7C5';

        const dsLightColor = isCustom ? customDarkAccent : '#444746';
        const dsDarkColor = isCustom ? customLightAccent : '#C4C7C5';

        const kmlLightColor = isCustom ? customDarkAccent : GOOGLE_LIGHT_ACCENT;
        const kmlDarkColor = isCustom ? customLightAccent : GOOGLE_DARK_ACCENT;

        const upBtnColor = isCustom ? customLightAccent : '#FFFFFF';

        let dragInTimeMenuRule = '';
        if (isCustom) {
            dragInTimeMenuRule = `
                /* Drag in Time menu option: colored ONLY when Override Accent Colors is enabled */
                html.gp-theme-light li[data-name="DragInTime"] .aqdrmf-rymPhb-fpDzbe-fmcmS,
                html.gp-theme-light li[data-name="DragInTime"] [jsname="K4r5Ff"],
                html.gp-theme-light li[data-name="DragInTime"] svg,
                html.gp-theme-light li[data-name="DragInTime"] svg path,
                html.gp-timtools-theme-light li[data-name="DragInTime"] .aqdrmf-rymPhb-fpDzbe-fmcmS,
                html.gp-timtools-theme-light li[data-name="DragInTime"] [jsname="K4r5Ff"],
                html.gp-timtools-theme-light li[data-name="DragInTime"] svg,
                html.gp-timtools-theme-light li[data-name="DragInTime"] svg path {
                    color: ${customDarkAccent} !important;
                    fill: ${customDarkAccent} !important;
                }

                html.gp-theme-dark li[data-name="DragInTime"] .aqdrmf-rymPhb-fpDzbe-fmcmS,
                html.gp-theme-dark li[data-name="DragInTime"] [jsname="K4r5Ff"],
                html.gp-theme-dark li[data-name="DragInTime"] svg,
                html.gp-theme-dark li[data-name="DragInTime"] svg path,
                html.gp-timtools-theme-dark li[data-name="DragInTime"] .aqdrmf-rymPhb-fpDzbe-fmcmS,
                html.gp-timtools-theme-dark li[data-name="DragInTime"] [jsname="K4r5Ff"],
                html.gp-timtools-theme-dark li[data-name="DragInTime"] svg,
                html.gp-timtools-theme-dark li[data-name="DragInTime"] svg path {
                    color: ${customLightAccent} !important;
                    fill: ${customLightAccent} !important;
                }
            `;
        }

        styleEl.textContent = `
            :root {
                --gp-accent-dark: ${customDarkAccent};
                --gp-accent-light: ${customLightAccent};
                --gp-active-accent: ${appTheme === 'light' ? lightDialogAccent : darkDialogAccent};
                --gp-up-button-accent: ${upBtnColor};
            }

            html.gp-theme-light, html.gp-timtools-theme-light {
                --gp-active-accent: ${lightDialogAccent};
            }

            html.gp-theme-dark, html.gp-timtools-theme-dark {
                --gp-active-accent: ${darkDialogAccent};
            }

            /* 1. UP BUTTON (ALWAYS #FFFFFF when override is off, or customLightAccent when override is on) */
            #up-button,
            #up-button svg,
            #up-button svg path,
            .rMGHCb #up-button,
            .rMGHCb #up-button svg,
            .rMGHCb #up-button svg path {
                color: ${upBtnColor} !important;
                fill: ${upBtnColor} !important;
            }

            /* 2. TOOLBAR ICONS IN LIGHT THEME */
            html.gp-theme-light .custom-date-btn,
            html.gp-theme-light .custom-date-btn svg,
            html.gp-theme-light .custom-date-btn svg path,
            html.gp-timtools-theme-light .custom-date-btn,
            html.gp-timtools-theme-light .custom-date-btn svg,
            html.gp-timtools-theme-light .custom-date-btn svg path {
                color: ${dsLightColor} !important;
                fill: ${dsLightColor} !important;
            }

            html.gp-theme-light .gp-kml-export-btn,
            html.gp-theme-light .gp-kml-export-btn svg,
            html.gp-theme-light .gp-kml-export-btn svg path,
            html.gp-timtools-theme-light .gp-kml-export-btn,
            html.gp-timtools-theme-light .gp-kml-export-btn svg,
            html.gp-timtools-theme-light .gp-kml-export-btn svg path {
                color: ${kmlLightColor} !important;
                fill: ${kmlLightColor} !important;
            }

            html.gp-theme-light #gp-smart-archive-btn,
            html.gp-theme-light #gp-smart-archive-btn svg,
            html.gp-theme-light #gp-smart-archive-btn svg path,
            html.gp-timtools-theme-light #gp-smart-archive-btn,
            html.gp-timtools-theme-light #gp-smart-archive-btn svg,
            html.gp-timtools-theme-light #gp-smart-archive-btn svg path {
                color: ${saLightColor} !important;
                fill: ${saLightColor} !important;
            }

            /* 3. TOOLBAR ICONS IN DARK THEME */
            html.gp-theme-dark .custom-date-btn,
            html.gp-theme-dark .custom-date-btn svg,
            html.gp-theme-dark .custom-date-btn svg path,
            html.gp-timtools-theme-dark .custom-date-btn,
            html.gp-timtools-theme-dark .custom-date-btn svg,
            html.gp-timtools-theme-dark .custom-date-btn svg path {
                color: ${dsDarkColor} !important;
                fill: ${dsDarkColor} !important;
            }

            html.gp-theme-dark .gp-kml-export-btn,
            html.gp-theme-dark .gp-kml-export-btn svg,
            html.gp-theme-dark .gp-kml-export-btn svg path,
            html.gp-timtools-theme-dark .gp-kml-export-btn,
            html.gp-timtools-theme-dark .gp-kml-export-btn svg,
            html.gp-timtools-theme-dark .gp-kml-export-btn svg path {
                color: ${kmlDarkColor} !important;
                fill: ${kmlDarkColor} !important;
            }

            html.gp-theme-dark #gp-smart-archive-btn,
            html.gp-theme-dark #gp-smart-archive-btn svg,
            html.gp-theme-dark #gp-smart-archive-btn svg path,
            html.gp-timtools-theme-dark #gp-smart-archive-btn,
            html.gp-timtools-theme-dark #gp-smart-archive-btn svg,
            html.gp-timtools-theme-dark #gp-smart-archive-btn svg path {
                color: ${saDarkColor} !important;
                fill: ${saDarkColor} !important;
            }

            /* Fallback toolbar colors before root class is attached */
            :root:not(.gp-theme-light):not(.gp-timtools-theme-light) .custom-date-btn svg {
                fill: ${dsDarkColor};
            }
            :root:not(.gp-theme-light):not(.gp-timtools-theme-light) .gp-kml-export-btn svg {
                fill: ${kmlDarkColor};
            }
            :root:not(.gp-theme-light):not(.gp-timtools-theme-light) #gp-smart-archive-btn svg {
                fill: ${saDarkColor};
            }

            ${dragInTimeMenuRule}

            /* 4. DRAG IN TIME MODAL - LIGHT THEME */
            html.gp-theme-light .gp-drag-modal-dialog,
            html.gp-theme-light .gp-confirm-dialog-box,
            html.gp-timtools-theme-light .gp-drag-modal-dialog,
            html.gp-timtools-theme-light .gp-confirm-dialog-box {
                background-color: #ffffff !important;
                color: #202124 !important;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.1) !important;
            }
            html.gp-theme-light .gp-drag-modal-header,
            html.gp-theme-light .gp-drag-modal-footer,
            html.gp-theme-light .gp-confirm-dialog-header,
            html.gp-theme-light .gp-confirm-dialog-footer,
            html.gp-timtools-theme-light .gp-drag-modal-header,
            html.gp-timtools-theme-light .gp-drag-modal-footer,
            html.gp-timtools-theme-light .gp-confirm-dialog-header,
            html.gp-timtools-theme-light .gp-confirm-dialog-footer {
                background-color: #ffffff !important;
                border-color: #e0e0e0 !important;
            }
            html.gp-theme-light .gp-drag-modal-body,
            html.gp-theme-light .gp-confirm-dialog-body,
            html.gp-timtools-theme-light .gp-drag-modal-body,
            html.gp-timtools-theme-light .gp-confirm-dialog-body {
                background-color: #f8f9fa !important;
            }
            html.gp-theme-light .gp-header-title,
            html.gp-theme-light .gp-confirm-title,
            html.gp-timtools-theme-light .gp-header-title,
            html.gp-timtools-theme-light .gp-confirm-title {
                color: #202124 !important;
            }
            html.gp-theme-light .gp-header-subtitle,
            html.gp-theme-light .gp-confirm-subtitle,
            html.gp-timtools-theme-light .gp-modal-status-info,
            html.gp-timtools-theme-light .gp-header-subtitle,
            html.gp-timtools-theme-light .gp-confirm-subtitle,
            html.gp-timtools-theme-light .gp-modal-status-info {
                color: #5f6368 !important;
            }
            html.gp-theme-light .gp-header-icon-box,
            html.gp-timtools-theme-light .gp-header-icon-box {
                background: ${lightDialogAlpha12} !important;
                color: ${lightDialogAccent} !important;
            }
            html.gp-theme-light .gp-header-icon-box svg path,
            html.gp-timtools-theme-light .gp-header-icon-box svg path {
                fill: ${lightDialogAccent} !important;
            }
            html.gp-theme-light .gp-confirm-icon-box,
            html.gp-timtools-theme-light .gp-confirm-icon-box {
                background: ${lightDialogAlpha12} !important;
                color: ${lightDialogAccent} !important;
            }
            html.gp-theme-light .gp-confirm-icon-box svg,
            html.gp-timtools-theme-light .gp-confirm-icon-box svg {
                color: ${lightDialogAccent} !important;
                fill: ${lightDialogAccent} !important;
            }
            html.gp-theme-light .gp-confirm-table-card,
            html.gp-timtools-theme-light .gp-confirm-table-card {
                background: #ffffff !important;
                border: 1px solid #dadce0 !important;
            }
            html.gp-theme-light .gp-confirm-table-head-row,
            html.gp-timtools-theme-light .gp-confirm-table-head-row {
                background: #f1f3f4 !important;
                border-bottom: 1px solid #dadce0 !important;
            }
            html.gp-theme-light .gp-confirm-table-head-row th,
            html.gp-timtools-theme-light .gp-confirm-table-head-row th {
                color: #5f6368 !important;
            }
            html.gp-theme-light .gp-confirm-table-row,
            html.gp-timtools-theme-light .gp-confirm-table-row {
                border-bottom: 1px solid #e0e0e0 !important;
                color: #202124 !important;
            }
            html.gp-theme-light .gp-confirm-table-row:hover,
            html.gp-timtools-theme-light .gp-confirm-table-row:hover {
                background: #f1f3f4 !important;
            }
            html.gp-theme-light .gp-diff-highlight,
            html.gp-timtools-theme-light .gp-diff-highlight {
                color: ${lightDialogAccent} !important;
            }

            /* 5. DRAG IN TIME MODAL - DARK THEME */
            html.gp-theme-dark .gp-drag-modal-dialog,
            html.gp-theme-dark .gp-confirm-dialog-box,
            html.gp-timtools-theme-dark .gp-drag-modal-dialog,
            html.gp-timtools-theme-dark .gp-confirm-dialog-box {
                background-color: #202124 !important;
                color: #e8eaed !important;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
            }
            html.gp-theme-dark .gp-drag-modal-header,
            html.gp-theme-dark .gp-drag-modal-footer,
            html.gp-theme-dark .gp-confirm-dialog-header,
            html.gp-theme-dark .gp-confirm-dialog-footer,
            html.gp-timtools-theme-dark .gp-drag-modal-header,
            html.gp-timtools-theme-dark .gp-drag-modal-footer,
            html.gp-timtools-theme-dark .gp-confirm-dialog-header,
            html.gp-timtools-theme-dark .gp-confirm-dialog-footer {
                background-color: #202124 !important;
                border-color: rgba(255, 255, 255, 0.1) !important;
            }
            html.gp-theme-dark .gp-drag-modal-body,
            html.gp-theme-dark .gp-confirm-dialog-body,
            html.gp-timtools-theme-dark .gp-drag-modal-body,
            html.gp-timtools-theme-dark .gp-confirm-dialog-body {
                background-color: #17181b !important;
            }
            html.gp-theme-dark .gp-header-title,
            html.gp-theme-dark .gp-confirm-title,
            html.gp-timtools-theme-dark .gp-header-title,
            html.gp-timtools-theme-dark .gp-confirm-title {
                color: #ffffff !important;
            }
            html.gp-theme-dark .gp-header-subtitle,
            html.gp-theme-dark .gp-confirm-subtitle,
            html.gp-timtools-theme-dark .gp-header-subtitle,
            html.gp-timtools-theme-dark .gp-confirm-subtitle,
            html.gp-timtools-theme-dark .gp-modal-status-info {
                color: #9aa0a6 !important;
            }
            html.gp-theme-dark .gp-header-icon-box,
            html.gp-timtools-theme-dark .gp-header-icon-box {
                background: ${darkDialogAlpha12} !important;
                color: ${darkDialogAccent} !important;
            }
            html.gp-theme-dark .gp-header-icon-box svg path,
            html.gp-timtools-theme-dark .gp-header-icon-box svg path {
                fill: ${darkDialogAccent} !important;
            }
            html.gp-theme-dark .gp-confirm-icon-box,
            html.gp-timtools-theme-dark .gp-confirm-icon-box {
                background: ${darkDialogAlpha12} !important;
                color: ${darkDialogAccent} !important;
            }
            html.gp-theme-dark .gp-confirm-icon-box svg,
            html.gp-timtools-theme-dark .gp-confirm-icon-box svg {
                color: ${darkDialogAccent} !important;
                fill: ${darkDialogAccent} !important;
            }
            html.gp-theme-dark .gp-confirm-table-card,
            html.gp-timtools-theme-dark .gp-confirm-table-card {
                background: #17181b !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
            }
            html.gp-theme-dark .gp-confirm-table-head-row,
            html.gp-timtools-theme-dark .gp-confirm-table-head-row {
                background: rgba(255, 255, 255, 0.04) !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
            }
            html.gp-theme-dark .gp-confirm-table-head-row th,
            html.gp-timtools-theme-dark .gp-confirm-table-head-row th {
                color: #9aa0a6 !important;
            }
            html.gp-theme-dark .gp-confirm-table-row,
            html.gp-timtools-theme-dark .gp-confirm-table-row {
                border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                color: #e8eaed !important;
            }
            html.gp-theme-dark .gp-confirm-table-row:hover,
            html.gp-timtools-theme-dark .gp-confirm-table-row:hover {
                background: rgba(255, 255, 255, 0.04) !important;
            }
            html.gp-theme-dark .gp-diff-highlight,
            html.gp-timtools-theme-dark .gp-diff-highlight {
                color: ${darkDialogAccent} !important;
            }

            /* CHECKBOXES & LABELS */
            html.gp-theme-light .gp-square-aspect-checkbox,
            html.gp-theme-light .gp-show-filenames-checkbox,
            html.gp-timtools-theme-light .gp-square-aspect-checkbox,
            html.gp-timtools-theme-light .gp-show-filenames-checkbox {
                accent-color: ${lightDialogAccent} !important;
            }
            html.gp-theme-dark .gp-square-aspect-checkbox,
            html.gp-theme-dark .gp-show-filenames-checkbox,
            html.gp-timtools-theme-dark .gp-square-aspect-checkbox,
            html.gp-timtools-theme-dark .gp-show-filenames-checkbox {
                accent-color: ${darkDialogAccent} !important;
            }

            /* Checkbox text labels: PURE WHITE or PURE BLACK (never accent color) */
            html.gp-theme-light .gp-checkbox-text,
            html.gp-timtools-theme-light .gp-checkbox-text {
                color: #202124 !important;
            }
            html.gp-theme-dark .gp-checkbox-text,
            html.gp-timtools-theme-dark .gp-checkbox-text {
                color: #ffffff !important;
            }
            html.gp-theme-light .gp-header-checkbox-label,
            html.gp-timtools-theme-light .gp-header-checkbox-label {
                color: #202124 !important;
                background: #f1f3f4 !important;
                border: 1px solid #dadce0 !important;
            }
            html.gp-theme-light .gp-header-checkbox-label:hover,
            html.gp-timtools-theme-light .gp-header-checkbox-label:hover {
                background: #e8eaed !important;
                border-color: #bdc1c6 !important;
            }
            html.gp-theme-dark .gp-header-checkbox-label,
            html.gp-timtools-theme-dark .gp-header-checkbox-label {
                color: #ffffff !important;
                background: rgba(255, 255, 255, 0.08) !important;
                border: 1px solid rgba(255, 255, 255, 0.16) !important;
            }
            html.gp-theme-dark .gp-header-checkbox-label:hover,
            html.gp-timtools-theme-dark .gp-header-checkbox-label:hover {
                background: rgba(255, 255, 255, 0.14) !important;
                border-color: rgba(255, 255, 255, 0.25) !important;
            }

            /* ACTION BUTTONS (Next / Confirm) */
            html.gp-theme-light .gp-modal-save-btn,
            html.gp-theme-light .gp-confirm-save-btn,
            html.gp-timtools-theme-light .gp-modal-save-btn,
            html.gp-timtools-theme-light .gp-confirm-save-btn {
                background-color: ${lightDialogAccent} !important;
                color: #ffffff !important;
                border: none !important;
            }
            html.gp-theme-light .gp-modal-save-btn:hover,
            html.gp-theme-light .gp-confirm-save-btn:hover,
            html.gp-timtools-theme-light .gp-modal-save-btn:hover,
            html.gp-timtools-theme-light .gp-confirm-save-btn:hover {
                opacity: 0.92 !important;
            }
            html.gp-theme-dark .gp-modal-save-btn,
            html.gp-theme-dark .gp-confirm-save-btn,
            html.gp-timtools-theme-dark .gp-modal-save-btn,
            html.gp-timtools-theme-dark .gp-confirm-save-btn {
                background-color: ${darkDialogAccent} !important;
                color: #202124 !important;
                border: none !important;
            }
            html.gp-theme-dark .gp-modal-save-btn:hover,
            html.gp-theme-dark .gp-confirm-save-btn:hover,
            html.gp-timtools-theme-dark .gp-modal-save-btn:hover,
            html.gp-timtools-theme-dark .gp-confirm-save-btn:hover {
                opacity: 0.92 !important;
            }

            /* ACTION BUTTONS (Cancel / Back) */
            html.gp-theme-light .gp-modal-back-btn,
            html.gp-theme-light .gp-confirm-cancel-btn,
            html.gp-timtools-theme-light .gp-modal-back-btn,
            html.gp-timtools-theme-light .gp-confirm-cancel-btn {
                color: ${lightDialogAccent} !important;
                border: 1px solid ${lightDialogAccent} !important;
                background: transparent !important;
            }
            html.gp-theme-light .gp-modal-back-btn:hover,
            html.gp-theme-light .gp-confirm-cancel-btn:hover,
            html.gp-timtools-theme-light .gp-modal-back-btn:hover,
            html.gp-timtools-theme-light .gp-confirm-cancel-btn:hover {
                background: ${lightDialogAlpha12} !important;
            }
            html.gp-theme-dark .gp-modal-back-btn,
            html.gp-theme-dark .gp-confirm-cancel-btn,
            html.gp-timtools-theme-dark .gp-modal-back-btn,
            html.gp-timtools-theme-dark .gp-confirm-cancel-btn {
                color: ${darkDialogAccent} !important;
                border: 1px solid ${darkDialogAccent} !important;
                background: transparent !important;
            }
            html.gp-theme-dark .gp-modal-back-btn:hover,
            html.gp-theme-dark .gp-confirm-cancel-btn:hover,
            html.gp-timtools-theme-dark .gp-modal-back-btn:hover,
            html.gp-timtools-theme-dark .gp-confirm-cancel-btn:hover {
                background: ${darkDialogAlpha12} !important;
            }

            /* MODAL FOOTER BADGES */
            html.gp-theme-light .gp-selected-badge,
            html.gp-theme-light .gp-modified-badge,
            html.gp-timtools-theme-light .gp-selected-badge,
            html.gp-timtools-theme-light .gp-modified-badge {
                background: ${lightDialogAlpha12} !important;
                color: ${lightDialogAccent} !important;
            }
            html.gp-theme-dark .gp-selected-badge,
            html.gp-theme-dark .gp-modified-badge,
            html.gp-timtools-theme-dark .gp-selected-badge,
            html.gp-timtools-theme-dark .gp-modified-badge {
                background: ${darkDialogAlpha20} !important;
                color: ${darkDialogAccent} !important;
            }

            /* 6. SMART ARCHIVING POPOVER */
            html.gp-theme-light .gp-smart-archive-popover,
            html.gp-timtools-theme-light .gp-smart-archive-popover {
                background-color: #ffffff !important;
                border: 1px solid #dadce0 !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.12) !important;
                color: #202124 !important;
            }
            html.gp-theme-dark .gp-smart-archive-popover,
            html.gp-timtools-theme-dark .gp-smart-archive-popover {
                background-color: #202124 !important;
                border: 1px solid #3c4043 !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.35) !important;
                color: #e8eaed !important;
            }

            html.gp-theme-light .gp-smart-archive-title svg,
            html.gp-timtools-theme-light .gp-smart-archive-title svg {
                fill: ${lightDialogAccent} !important;
            }
            html.gp-theme-dark .gp-smart-archive-title svg,
            html.gp-timtools-theme-dark .gp-smart-archive-title svg {
                fill: ${darkDialogAccent} !important;
            }

            html.gp-theme-light .gp-sa-btn-primary,
            html.gp-timtools-theme-light .gp-sa-btn-primary {
                background-color: ${lightDialogAccent} !important;
                color: #ffffff !important;
            }
            html.gp-theme-dark .gp-sa-btn-primary,
            html.gp-timtools-theme-dark .gp-sa-btn-primary {
                background-color: ${darkDialogAccent} !important;
                color: #202124 !important;
            }

            /* SWITCHES & KNOBS */
            html.gp-theme-light .gp-sa-slider,
            html.gp-timtools-theme-light .gp-sa-slider {
                background-color: #dadce0 !important;
            }
            html.gp-theme-dark .gp-sa-slider,
            html.gp-timtools-theme-dark .gp-sa-slider {
                background-color: #3c4043 !important;
            }

            .gp-sa-knob {
                background-color: #ffffff !important;
            }

            .gp-sa-icon-off,
            .gp-sa-icon-off svg,
            .gp-sa-icon-off svg path {
                fill: #202124 !important;
                color: #202124 !important;
            }

            /* ON: Light theme */
            html.gp-theme-light .gp-sa-toggle input:checked + .gp-sa-slider,
            html.gp-timtools-theme-light .gp-sa-toggle input:checked + .gp-sa-slider {
                background-color: ${lightDialogAccent} !important;
            }
            html.gp-theme-light .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-knob,
            html.gp-timtools-theme-light .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-knob {
                background-color: #ffffff !important;
            }
            html.gp-theme-light .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg,
            html.gp-theme-light .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg path,
            html.gp-timtools-theme-light .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg,
            html.gp-timtools-theme-light .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg path {
                fill: ${lightDialogAccent} !important;
                color: ${lightDialogAccent} !important;
            }

            /* ON: Dark theme */
            html.gp-theme-dark .gp-sa-toggle input:checked + .gp-sa-slider,
            html.gp-timtools-theme-dark .gp-sa-toggle input:checked + .gp-sa-slider {
                background-color: ${darkDialogAccent} !important;
            }
            html.gp-theme-dark .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-knob,
            html.gp-timtools-theme-dark .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-knob {
                background-color: #202124 !important;
            }
            html.gp-theme-dark .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg,
            html.gp-theme-dark .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg path,
            html.gp-timtools-theme-dark .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg,
            html.gp-timtools-theme-dark .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg path {
                fill: ${darkDialogAccent} !important;
                color: ${darkDialogAccent} !important;
            }

            /* 7. DATE PICKER POPUP */
            html.gp-theme-light #date-picker-popup,
            html.gp-timtools-theme-light #date-picker-popup {
                background-color: #ffffff !important;
                color: #202124 !important;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
                border: 1px solid #dadce0 !important;
            }
            html.gp-theme-light .dp-btn,
            html.gp-theme-light .dp-day,
            html.gp-theme-light .dp-year-item,
            html.gp-timtools-theme-light .dp-btn,
            html.gp-timtools-theme-light .dp-day,
            html.gp-timtools-theme-light .dp-year-item {
                color: #202124 !important;
            }
            html.gp-theme-light .dp-day-header,
            html.gp-timtools-theme-light .dp-day-header {
                color: #5f6368 !important;
            }
            html.gp-theme-light .dp-btn:hover,
            html.gp-theme-light .dp-day:hover,
            html.gp-theme-light .dp-year-item:hover,
            html.gp-timtools-theme-light .dp-btn:hover,
            html.gp-timtools-theme-light .dp-day:hover,
            html.gp-timtools-theme-light .dp-year-item:hover {
                background-color: #f1f3f4 !important;
            }
            html.gp-theme-light #date-picker-popup .dp-day.selected,
            html.gp-timtools-theme-light #date-picker-popup .dp-day.selected {
                background-color: ${lightDialogAccent} !important;
                color: #ffffff !important;
            }
            html.gp-theme-light #date-picker-popup .dp-day.today,
            html.gp-timtools-theme-light #date-picker-popup .dp-year-item.current,
            html.gp-timtools-theme-light #date-picker-popup .dp-day.today,
            html.gp-timtools-theme-light #date-picker-popup .dp-year-item.current {
                border-color: ${lightDialogAccent} !important;
            }

            html.gp-theme-dark #date-picker-popup .dp-day.selected,
            html.gp-timtools-theme-dark #date-picker-popup .dp-day.selected {
                background-color: ${darkDialogAccent} !important;
                color: #202124 !important;
            }
            html.gp-theme-dark #date-picker-popup .dp-day.today,
            html.gp-theme-dark #date-picker-popup .dp-year-item.current,
            html.gp-timtools-theme-dark #date-picker-popup .dp-day.today,
            html.gp-timtools-theme-dark #date-picker-popup .dp-year-item.current {
                border-color: ${darkDialogAccent} !important;
            }
        `;
    }
})();
