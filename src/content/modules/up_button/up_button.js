window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
    const logger = (window.TimTools.Logger && window.TimTools.Logger.create)
        ? window.TimTools.Logger.create('UpButton')
        : {
            log: (...args) => console.log('[GP-TimTools][UpButton]', ...args),
            warn: (...args) => console.warn('[GP-TimTools][UpButton]', ...args),
            error: (...args) => console.error('[GP-TimTools][UpButton]', ...args)
        };

    const UpButton = {
        init: function () {
            logger.log('Init');
            let lastUrl = location.href;
            
            // Check if we arrived here to auto-close and return to timeline grid
            this.handleAutoCloseOnReturn();

            // 1. Observe child mutations and attribute changes for visibility toggles
            new MutationObserver(() => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    logger.log('URL changed to:', lastUrl);
                }
                this.checkAndAddButton();
            }).observe(document, { 
                subtree: true, 
                childList: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });

            // 2. Polling safety net to handle framework delays and transition periods
            setInterval(() => {
                this.checkAndAddButton();
            }, 500);

            this.checkAndAddButton();
        },

        handleAutoCloseOnReturn: function () {
            if (typeof sessionStorage === 'undefined') return;
            if (sessionStorage.getItem('gp_timtools_autoclose') !== '1') return;
            sessionStorage.removeItem('gp_timtools_autoclose');
            logger.log('Auto-close flag detected. Waiting for photo viewer to mount before dismissing...');

            let attempts = 0;
            const maxAttempts = 50; // up to 5 seconds
            const interval = setInterval(() => {
                attempts++;
                const container = this.findActiveHeaderContainer();
                const backBtn = container ? container.querySelector('a[jsname="hSRGPd"], button[aria-label*="Back"], button[aria-label*="Назад"], button[aria-label*="Close"], button[jsname="LgbsSe"]') : null;

                if (backBtn || attempts >= 20) {
                    clearInterval(interval);
                    logger.log('Photo viewer mounted. Closing photo view to land on main timeline grid.');
                    setTimeout(() => {
                        if (backBtn) {
                            backBtn.click();
                        } else {
                            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, code: 'Escape', bubbles: true }));
                        }
                    }, 250);
                }

                if (attempts >= maxAttempts) {
                    clearInterval(interval);
                }
            }, 100);
        },

        getGlobalPhotoUrl: function (currentUrl) {
            try {
                const urlObj = new URL(currentUrl);
                const photoMatch = urlObj.pathname.match(/\/photo\/([A-Za-z0-9_-]+)/);
                if (!photoMatch) return currentUrl;
                const photoKey = photoMatch[1];
                const accountMatch = urlObj.pathname.match(/^\/u\/(\d+)/);
                const accountPrefix = accountMatch ? `/u/${accountMatch[1]}` : '';
                return `${urlObj.origin}${accountPrefix}/photo/${photoKey}${urlObj.search}`;
            } catch (e) {
                return currentUrl.replace(/(photos\.google\.com\/(?:u\/\d+\/)?)\S+?(\/photo\/)/, '$1$2');
            }
        },

        findActiveHeaderContainer: function () {
            // Strategy 1: Find visible .rMGHCb container in active viewport
            const containers = document.querySelectorAll('.rMGHCb');
            for (let container of containers) {
                const rect = container.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left < window.innerWidth && rect.top >= 0 && rect.top < 200) {
                    return container;
                }
            }

            // Strategy 2: Search for visible back arrow SVG inside active viewport
            const backArrowPaths = [
                "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
                "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z",
                "M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z"
            ];
            const paths = document.querySelectorAll('svg path');
            for (let path of paths) {
                const d = path.getAttribute('d');
                if (d && backArrowPaths.some(p => d.includes(p) || p.includes(d))) {
                    const container = path.closest('.rMGHCb, .aAh6ed, header') || path.parentElement?.parentElement;
                    if (container) {
                        const rect = container.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left < window.innerWidth && rect.top >= 0 && rect.top < 200) {
                            return container;
                        }
                    }
                }
            }

            // Strategy 3: Find visible back button link/button in active viewport
            const backButtons = document.querySelectorAll('a[jsname="hSRGPd"], a[aria-label*="Back"], a[aria-label*="Назад"], button[aria-label*="Back"], button[aria-label*="Назад"]');
            for (let btn of backButtons) {
                const rect = btn.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left < window.innerWidth && rect.top >= 0 && rect.top < 200) {
                    const container = btn.closest('.rMGHCb, .aAh6ed, header') || btn.parentElement;
                    if (container) return container;
                }
            }

            return null;
        },

        checkAndAddButton: function () {
            var url = window.location.href;
            var existingButton = document.getElementById('up-button');

            // Only show Up button when viewing a photo INSIDE a sub-context (album, search, category, etc.)
            // If viewing a photo directly in the main timeline (/photo/XYZ or /u/0/photo/XYZ), hide the button.
            const match = url.match(/photos\.google\.com\/(?:u\/\d+\/)?(.+?)\/photo\//);
            const isPhotoInSubContext = Boolean(match && match[1] && match[1].length > 0 && !match[1].startsWith('photo'));

            if (!isPhotoInSubContext) {
                if (existingButton) {
                    logger.log('Main timeline view or non-photo page. Hiding Up button.');
                    existingButton.remove();
                }
                return;
            }

            // Check if existingButton is attached and visible in the active viewport
            if (existingButton && document.body.contains(existingButton)) {
                const rect = existingButton.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left < window.innerWidth && rect.top >= 0 && rect.top < window.innerHeight) {
                    // Button is already attached and visible in current viewport: do nothing!
                    return;
                } else {
                    // Button is attached to an off-screen/hidden preloader container, remove it so we can inject into active container
                    existingButton.remove();
                }
            }

            // Find the active header container in the visible viewport
            const targetContainer = this.findActiveHeaderContainer();
            if (targetContainer) {
                if (!targetContainer.querySelector('#up-button')) {
                    logger.log('Active target container found. Injecting button.');
                    this.injectButton(targetContainer);
                }
            }
        },

        injectButton: function (container) {
            if (document.getElementById('up-button')) return;

            var button = document.createElement('button');
            button.id = 'up-button';
            button.title = 'Up Navigation Button';
            button.setAttribute('aria-label', 'Up Navigation');
            
            button.className = 'pYTkkf-Bz112c-LgbsSe pYTkkf-Bz112c-LgbsSe-OWXEXe-SfQLQb-suEOdc gp-up-button';

            button.innerHTML = `
                <span class="pYTkkf-Bz112c-kBDsod-Rtc0Jf" aria-hidden="true" style="display:flex;align-items:center;justify-content:center;">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                        <path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z"/>
                    </svg>
                </span>
            `;

            const self = this;
            button.addEventListener('click', async function (e) {
                e.preventDefault();
                e.stopPropagation();

                const newUrl = self.getGlobalPhotoUrl(window.location.href);
                const settings = await window.TimTools.Settings.getAll();

                if (settings.upButtonClosePhoto) {
                    logger.log('Up Button clicked with auto-close enabled. Navigating to:', newUrl);
                    sessionStorage.setItem('gp_timtools_autoclose', '1');
                    window.location.href = newUrl;
                } else {
                    logger.log('Up Button clicked. Navigating to:', newUrl);
                    window.location.href = newUrl;
                }
            });

            // Insert as second child or append
            if (container.children.length > 1) {
                container.insertBefore(button, container.children[1]);
                logger.log('Injected button as second child in active container.');
            } else {
                container.appendChild(button);
                logger.log('Appended button to active container.');
            }
        }
    };

    window.TimTools.Modules.UpButton = UpButton;
})();
