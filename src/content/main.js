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

        if (settings.enableAlbumQuickRemove) {
            if (Modules.AlbumQuickRemove) {
                Modules.AlbumQuickRemove.init();
                logger.log('Album Quick Remove module loaded.');
            } else {
                logger.error('Album Quick Remove module missing!');
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

        // Album Quick Remove cross icon colors:
        // When Override Accent Colors is OFF: Light = #444746, Dark = #C4C7C5
        // When Override Accent Colors is ON: Light = customDarkAccent, Dark = customLightAccent
        const aqrLightColor = isCustom ? customDarkAccent : '#444746';
        const aqrDarkColor = isCustom ? customLightAccent : '#C4C7C5';

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
                --gp-active-accent-12: ${appTheme === 'light' ? lightDialogAlpha12 : darkDialogAlpha12};
                --gp-active-accent-20: ${appTheme === 'light' ? lightDialogAlpha12 : darkDialogAlpha20};
                --gp-up-button-accent: ${upBtnColor};
                --gp-icon-sa: ${appTheme === 'light' ? saLightColor : saDarkColor};
                --gp-icon-ds: ${appTheme === 'light' ? dsLightColor : dsDarkColor};
                --gp-icon-kml: ${appTheme === 'light' ? kmlLightColor : kmlDarkColor};
                --gp-icon-aqr: ${appTheme === 'light' ? aqrLightColor : aqrDarkColor};
            }

            html.gp-theme-light, html.gp-timtools-theme-light {
                --gp-active-accent: ${lightDialogAccent};
                --gp-active-accent-12: ${lightDialogAlpha12};
                --gp-active-accent-20: ${lightDialogAlpha12};
                --gp-icon-sa: ${saLightColor};
                --gp-icon-ds: ${dsLightColor};
                --gp-icon-kml: ${kmlLightColor};
                --gp-icon-aqr: ${aqrLightColor};
            }

            html.gp-theme-dark, html.gp-timtools-theme-dark {
                --gp-active-accent: ${darkDialogAccent};
                --gp-active-accent-12: ${darkDialogAlpha12};
                --gp-active-accent-20: ${darkDialogAlpha20};
                --gp-icon-sa: ${saDarkColor};
                --gp-icon-ds: ${dsDarkColor};
                --gp-icon-kml: ${kmlDarkColor};
                --gp-icon-aqr: ${aqrDarkColor};
            }

            /* Up Navigation Button */
            #up-button, #up-button svg, #up-button svg path,
            .rMGHCb #up-button, .rMGHCb #up-button svg, .rMGHCb #up-button svg path {
                color: ${upBtnColor} !important;
                fill: ${upBtnColor} !important;
            }

            /* Toolbar Icons (Light & Dark dynamic colors) */
            .custom-date-btn, .custom-date-btn svg, .custom-date-btn svg path,
            .gp-date-search-btn, .gp-date-search-btn svg, .gp-date-search-btn svg path {
                color: var(--gp-icon-ds) !important;
                fill: var(--gp-icon-ds) !important;
            }

            .gp-kml-export-btn, .gp-kml-export-btn svg, .gp-kml-export-btn svg path {
                color: var(--gp-icon-kml) !important;
                fill: var(--gp-icon-kml) !important;
            }

            #gp-smart-archive-btn, #gp-smart-archive-btn svg, #gp-smart-archive-btn svg path {
                color: var(--gp-icon-sa) !important;
                fill: var(--gp-icon-sa) !important;
            }

            .gp-album-remove-btn, .gp-album-remove-btn svg {
                color: var(--gp-icon-aqr) !important;
                stroke: var(--gp-icon-aqr) !important;
            }

            /* Fallback toolbar colors before html theme class attaches */
            :root:not(.gp-theme-light):not(.gp-timtools-theme-light) .custom-date-btn svg { fill: ${dsDarkColor}; }
            :root:not(.gp-theme-light):not(.gp-timtools-theme-light) .gp-kml-export-btn svg { fill: ${kmlDarkColor}; }
            :root:not(.gp-theme-light):not(.gp-timtools-theme-light) #gp-smart-archive-btn svg { fill: ${saDarkColor}; }

            ${dragInTimeMenuRule}

            /* Drag in Time Modal Elements */
            .gp-header-icon-box, .gp-confirm-icon-box {
                background: var(--gp-active-accent-12) !important;
                color: var(--gp-active-accent) !important;
            }
            .gp-header-icon-box svg path, .gp-confirm-icon-box svg {
                fill: var(--gp-active-accent) !important;
            }
            .gp-diff-highlight {
                color: var(--gp-active-accent) !important;
            }
            .gp-square-aspect-checkbox, .gp-show-filenames-checkbox {
                accent-color: var(--gp-active-accent) !important;
            }
            .gp-modal-save-btn, .gp-confirm-save-btn {
                background-color: var(--gp-active-accent) !important;
            }
            .gp-modal-back-btn, .gp-confirm-cancel-btn {
                color: var(--gp-active-accent) !important;
                border: 1px solid var(--gp-active-accent) !important;
            }
            .gp-modal-back-btn:hover, .gp-confirm-cancel-btn:hover {
                background: var(--gp-active-accent-12) !important;
            }
            .gp-selected-badge, .gp-modified-badge {
                background: var(--gp-active-accent-12) !important;
                color: var(--gp-active-accent) !important;
                border: 1px solid var(--gp-active-accent) !important;
            }
            .gp-card-modified-badge {
                background: var(--gp-active-accent) !important;
                color: #1a1a1a !important;
            }
            .gp-confirm-arrow, .gp-confirm-arrow-col {
                color: var(--gp-active-accent) !important;
            }
            .gp-confirm-new-box {
                background: var(--gp-active-accent-12) !important;
                border: 1px solid var(--gp-active-accent) !important;
            }

            /* Smart Archiving Popover Elements */
            .gp-smart-archive-title svg {
                fill: var(--gp-active-accent) !important;
            }
            .gp-sa-btn-primary {
                background-color: var(--gp-active-accent) !important;
            }
            .gp-sa-toggle input:checked + .gp-sa-slider {
                background-color: var(--gp-active-accent) !important;
            }
            .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg,
            .gp-sa-toggle input:checked + .gp-sa-slider .gp-sa-icon-on svg path {
                fill: var(--gp-active-accent) !important;
                color: var(--gp-active-accent) !important;
            }

            /* Date Picker Popup Elements */
            #date-picker-popup .dp-day.selected,
            #date-picker-popup .dp-year-item.selected {
                background-color: var(--gp-active-accent) !important;
            }
            #date-picker-popup .dp-day.today,
            #date-picker-popup .dp-year-item.current {
                border-color: var(--gp-active-accent) !important;
            }
        `;
    }
})();
