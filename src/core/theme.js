window.TimTools = window.TimTools || {};

(function () {
    const logger = window.TimTools.Logger ? window.TimTools.Logger.create('Theme') : {
        log: (...args) => console.log('[GP-TimTools][Theme]', ...args)
    };

    const Theme = {
        _isDark: true,

        init: function () {
            logger.log('Theme system initialized');
            // Apply default immediately so classes exist synchronously
            this.setTheme(this._isDark ? 'dark' : 'light');

            if (chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get({ appTheme: 'dark' }, (items) => {
                    this.setTheme(items.appTheme || 'dark');
                });
            } else if (window.TimTools.Settings) {
                window.TimTools.Settings.getAll().then(settings => {
                    this.setTheme(settings.appTheme || 'dark');
                });
            }

            if (chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.addListener((changes, area) => {
                    if (area === 'sync' && changes.appTheme) {
                        this.setTheme(changes.appTheme.newValue || 'dark');
                    }
                });
            }
        },

        isDark: function () {
            return this._isDark;
        },

        setTheme: function (theme) {
            this._isDark = (theme !== 'light');
            logger.log('Theme set to:', this._isDark ? 'dark' : 'light');
            const doc = document.documentElement;
            if (doc) {
                const themeVal = this._isDark ? 'dark' : 'light';
                doc.setAttribute('data-gp-theme', themeVal);
                doc.classList.toggle('gp-theme-dark', this._isDark);
                doc.classList.toggle('gp-theme-light', !this._isDark);
                doc.classList.toggle('gp-timtools-theme-dark', this._isDark);
                doc.classList.toggle('gp-timtools-theme-light', !this._isDark);
            }
        }
    };

    window.TimTools.Theme = Theme;
    Theme.init();
})();
