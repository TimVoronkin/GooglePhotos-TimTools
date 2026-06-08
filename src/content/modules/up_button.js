window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
    const UpButton = {
        init: function () {
            console.log('[TimTools] UpButton: Init');
            let lastUrl = location.href;
            
            // 1. Observe child mutations and attribute (class/style) changes for visibility toggles
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

        checkAndAddButton: function () {
            var url = window.location.href;
            var match = url.match(/photos.google.com\/(.+\/)?photo\//);
            var isValidContext = match && match[1] && !match[1].startsWith('photo/');
            var existingButton = document.getElementById('up-button');
            
            // Check if the button is attached to the DOM and belongs to a visible container
            let isAttachedAndVisible = false;
            if (existingButton && document.body.contains(existingButton)) {
                const parentContainer = existingButton.closest('.rMGHCb');
                if (parentContainer) {
                    const rect = parentContainer.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left < window.innerWidth) {
                        isAttachedAndVisible = true;
                    }
                }
            }

            if (isValidContext) {
                if (!isAttachedAndVisible) {
                    if (existingButton) {
                        console.log('[TimTools] UpButton: Removing button from hidden/detached container.');
                        existingButton.remove();
                    }
                    
                    // Option 1: Find the target header container via the native back button SVG path
                    const backArrowPath = "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z";
                    const paths = document.querySelectorAll('svg path');
                    let targetContainer = null;
                    
                    for (let path of paths) {
                        if (path.getAttribute('d') === backArrowPath) {
                            const container = path.closest('.rMGHCb');
                            if (container) {
                                const rect = container.getBoundingClientRect();
                                // Ensure container is visible and within the visible screen area horizontally
                                const isVisible = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left < window.innerWidth;
                                if (isVisible) {
                                    targetContainer = container;
                                    break;
                                }
                            }
                        }
                    }

                    if (targetContainer) {
                        console.log('[TimTools] UpButton: Target container found. Injecting.');
                        this.injectButton(targetContainer);
                    }
                }
            } else {
                if (existingButton) {
                    console.log('[TimTools] UpButton: Invalid context. Removing button.');
                    existingButton.remove();
                }
            }
        },

        injectButton: function (container) {
            var button = document.createElement('button');
            button.id = 'up-button';
            button.title = 'Up Button';
            
            // Layout and styling to blend in with Google Photos top header buttons
            button.style.position = 'relative';
            button.style.zIndex = '99999';
            button.style.background = 'transparent';
            button.style.border = 'none';
            button.style.borderRadius = '50%';
            button.style.padding = '8px';
            button.style.marginLeft = '8px';
            button.style.cursor = 'pointer';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.transition = 'background-color 0.2s';

            // Hover styling matching Google Photos dark overlay headers
            button.addEventListener('mouseenter', function () {
                button.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            });
            button.addEventListener('mouseleave', function () {
                button.style.backgroundColor = 'transparent';
            });

            button.innerHTML = `
                <svg width="24" height="24" viewBox="-0.5 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
                    <path d="M8 13.8599L10.87 10.8C11.0125 10.6416 11.1868 10.5149 11.3815 10.4282C11.5761 10.3415 11.7869 10.2966 12 10.2966C12.2131 10.2966 12.4239 10.3415 12.6185 10.4282C12.8132 10.5149 12.9875 10.6416 13.13 10.8L16 13.8599" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M3 7.41992L3 17.4199C3 19.6291 4.79086 21.4199 7 21.4199H17C19.2091 21.4199 21 19.6291 21 17.4199V7.41992C21 5.21078 19.2091 3.41992 17 3.41992H7C4.79086 3.41992 3 5.21078 3 7.41992Z" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;

            button.addEventListener('click', async function () {
                var url = window.location.href;
                // Remove everything between domain and /photo/ (keep /photo/ and after)
                var newUrl = url.replace(/(photos.google.com\/)\S+?(\/photo\/)/, '$1$2');
                // Remove possible double slash after domain
                newUrl = newUrl.replace('photos.google.com//', 'photos.google.com/');
                
                // Get setting dynamically
                const settings = await window.TimTools.Settings.getAll();

                if (settings.upButtonClosePhoto) {
                    console.log('[TimTools] UpButton: Pushing history state to', newUrl);
                    
                    // 1. Change the address bar to the timeline photo URL without reloading
                    history.pushState(null, '', newUrl);

                    // 2. Find native back button link and change its target to main timeline grid (./)
                    const nativeBackLink = container.querySelector('a[jsname="hSRGPd"]');
                    if (nativeBackLink) {
                        nativeBackLink.setAttribute('href', './');
                        console.log('[TimTools] UpButton: Triggering click on native back link.');
                        nativeBackLink.click();
                    } else {
                        // Fallback: click the button wrapper if anchor is not found
                        const nativeBackButton = container.querySelector('[jsname="LgbsSe"]');
                        if (nativeBackButton) {
                            nativeBackButton.click();
                        }
                    }
                } else {
                    console.log('[TimTools] UpButton: Navigating to timeline photo URL:', newUrl);
                    window.location.href = newUrl;
                }
            });

            // Insert as the second child (right after the back button container)
            if (container.children.length > 1) {
                container.insertBefore(button, container.children[1]);
                console.log('[TimTools] UpButton: Injected button as second child in container.');
            } else {
                container.appendChild(button);
                console.log('[TimTools] UpButton: Appended button to container.');
            }
        }
    };

    window.TimTools.Modules.UpButton = UpButton;
})();
