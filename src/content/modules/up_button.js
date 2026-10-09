window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
    const UpButton = {
        init: function () {
            console.log('[GP-TimTools] UpButton: Init');
            let lastUrl = location.href;
            
            // 1. Observe child mutations and attribute changes for visibility toggles
            new MutationObserver(() => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    console.log('[TimTools] UpButton: URL changed to', lastUrl);
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
                    console.log('[TimTools] UpButton: Main timeline photo view or non-photo page. Hiding Up button.');
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
                    console.log('[TimTools] UpButton: Active target container found. Injecting.');
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
            
            button.className = 'pYTkkf-Bz112c-LgbsSe pYTkkf-Bz112c-LgbsSe-OWXEXe-SfQLQb-suEOdc';
            button.style.position = 'relative';
            button.style.zIndex = '99999';
            button.style.background = 'transparent';
            button.style.border = 'none';
            button.style.borderRadius = '50%';
            button.style.width = '40px';
            button.style.height = '40px';
            button.style.padding = '0';
            button.style.marginLeft = '4px';
            button.style.cursor = 'pointer';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.color = 'inherit';
            button.style.transition = 'background-color 0.2s';
            button.style.flexShrink = '0';
            button.style.alignSelf = 'center';

            button.addEventListener('mouseenter', function () {
                button.style.backgroundColor = 'rgba(128, 128, 128, 0.16)';
            });
            button.addEventListener('mouseleave', function () {
                button.style.backgroundColor = 'transparent';
            });

            button.innerHTML = `
                <span class="pYTkkf-Bz112c-kBDsod-Rtc0Jf" aria-hidden="true" style="display:flex;align-items:center;justify-content:center;">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                        <path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z"/>
                    </svg>
                </span>
            `;

            button.addEventListener('click', async function (e) {
                e.preventDefault();
                e.stopPropagation();

                var url = window.location.href;
                var newUrl = url.replace(/(photos.google.com\/)\S+?(\/photo\/)/, '$1$2');
                newUrl = newUrl.replace('photos.google.com//', 'photos.google.com/');
                
                const settings = await window.TimTools.Settings.getAll();

                if (settings.upButtonClosePhoto) {
                    console.log('[TimTools] UpButton: Closing photo view via native back button.');
                    history.pushState(null, '', newUrl);

                    const nativeBackBtn = container.querySelector('a[jsname="hSRGPd"], button[aria-label*="Back"], button[aria-label*="Назад"], button[jsname="LgbsSe"]');
                    if (nativeBackBtn) {
                        nativeBackBtn.click();
                    }
                } else {
                    console.log('[TimTools] UpButton: Navigating to:', newUrl);
                    window.location.href = newUrl;
                }
            });

            // Insert as second child or append
            if (container.children.length > 1) {
                container.insertBefore(button, container.children[1]);
                console.log('[TimTools] UpButton: Injected button as second child in active container.');
            } else {
                container.appendChild(button);
                console.log('[TimTools] UpButton: Appended button to active container.');
            }
        }
    };

    window.TimTools.Modules.UpButton = UpButton;
})();
