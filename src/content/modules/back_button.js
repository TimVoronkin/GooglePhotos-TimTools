window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
    const BackButton = {
        init: function () {
            console.log('[TimTools] BackButton: Init');
            let lastUrl = location.href;
            new MutationObserver(() => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    console.log('[TimTools] BackButton: URL changed to', lastUrl);
                }
                // Continuously ensure button state matches the current URL/DOM
                this.checkAndAddButton();
            }).observe(document, { subtree: true, childList: true });

            this.checkAndAddButton();
        },

        checkAndAddButton: function () {
            var url = window.location.href;
            var isValidContext = url.includes('/photo/') && (url.includes('/album/') || url.includes('/search/'));
            var existingButton = document.getElementById('show-in-timeline-btn');

            if (isValidContext) {
                if (!existingButton) {
                    const containers = document.querySelectorAll('.QtDoYb.MJvped .rMGHCb');

                    let targetContainer = null;
                    for (let i = 0; i < containers.length; i++) {
                        const c = containers[i];
                        const rect = c.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0;

                        if (isVisible && !targetContainer) {
                            targetContainer = c;
                            console.log(`[TimTools] BackButton: Found VISIBLE container at index ${i}`);
                        }
                    }

                    if (targetContainer) {
                        console.log('[TimTools] BackButton: Injecting button into the visible container.');
                        this.injectButton(targetContainer);
                    } else {
                        if (!this._missingContainerLogged) {
                            console.log(`[TimTools] BackButton: Missing container. Looked at ${containers.length} potential containers, but none were visible.`);
                            this._missingContainerLogged = true;
                        }
                    }
                } else {
                    this._missingContainerLogged = false;
                    const rect = existingButton.getBoundingClientRect();
                    const isVisible = rect.width > 0 && rect.height > 0;

                    if (!isVisible && !this._warnedHidden) {
                        console.log('[TimTools] BackButton: WARNING! Button exists in DOM but is HIDDEN.');
                        this._warnedHidden = true;
                        existingButton.remove();
                    } else if (isVisible) {
                        this._warnedHidden = false; // reset
                    }
                }
            } else {
                if (existingButton) {
                    console.log('[TimTools] BackButton: Invalid context. Removing button.');
                    existingButton.remove();
                }
            }
        },

        injectButton: function (container) {
            var button = document.createElement('button');
            button.id = 'show-in-timeline-btn';
            button.title = 'Back to Album/Search';
            button.style.position = 'relative';
            button.style.zIndex = '99999';
            button.style.background = 'rgba(0,0,0,0.3)';
            button.style.padding = '8px';
            button.style.border = 'none';
            button.style.borderRadius = '50%';
            button.style.cursor = 'pointer';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.marginLeft = '8px';

            const iconUrl = chrome.runtime.getURL('assets/icons/up_button.svg');
            const icon = document.createElement('img');
            icon.src = iconUrl;
            icon.style.cssText = 'width: 28px; height: 28px; display: block;';

            button.appendChild(icon);
            button.addEventListener('click', function () {
                let currentUrl = window.location.href;
                let newUrl;
                if (currentUrl.includes('/album/') || currentUrl.includes('/search/')) {
                    // Current: https://photos.google.com/search/XYZ/photo/ABC
                    // Desired: https://photos.google.com/photo/ABC

                    const urlParts = currentUrl.split('/photo/');
                    if (urlParts.length > 1) {
                        // urlParts[1] contains the photo ID (e.g., 'AF1QipODaVyjC0f0vwUzOLOw-8p4yHrQAorNh3DofN-X')
                        newUrl = `https://photos.google.com/photo/${urlParts[1]}`;
                    }
                }

                console.log('[TimTools] BackButton: Navigating to', newUrl);
                if (newUrl) {
                    window.location.href = newUrl;
                }
            });

            // Insert at the second position (index 1) if possible
            if (container.children.length > 1) {
                container.insertBefore(button, container.children[1]);
                console.log('[TimTools] BackButton: Button successfully injected at position 2.');
            } else {
                container.appendChild(button);
                console.log('[TimTools] BackButton: Button appended to container (not enough children).');
            }
        }
    };

    window.TimTools.Modules.BackButton = BackButton;
})();
