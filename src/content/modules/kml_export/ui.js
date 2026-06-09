window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};
window.TimTools.Modules.KmlExport = window.TimTools.Modules.KmlExport || {};

(function () {
    // Selectors
    // 'div[jscontroller="MHDZYd"]' is the container for action buttons (Share, Add to album, etc.) when photos are selected.
    const TOOLBAR_ACTIONS_SELECTOR = 'div[jscontroller="MHDZYd"]';
    // Fallback: The main floating toolbar container.
    const TOOLBAR_SELECTOR = '.c9yG5b.txMZRd';

    const UI = {
        PopupManager: {
            timerId: null,

            show: function (current, total, startTime, status = "Processing...") {
                this.render(current, total, startTime, status);
                this.startTimer(current, total, startTime, status);
            },

            update: function (current, total, startTime, status) {
                this.render(current, total, startTime, status);
            },

            close: function () {
                if (this.timerId) clearInterval(this.timerId);
                const popup = document.getElementById('gp-processing-popup');
                if (popup) popup.remove();
            },

            render: function (current, total, startTime, status) {
                let existing = document.getElementById('gp-processing-popup');
                const stopIcon = chrome.runtime.getURL('assets/active/stop-icon.svg');
                const percent = total > 0 ? (current / total) * 100 : 0;

                let timeDetails = "Calculating...";
                if (startTime && current >= 0) {
                    const now = Date.now();
                    const elapsed = now - startTime;
                    let eta = "---";
                    if (current > 0) {
                        const avg = elapsed / current;
                        const remaining = avg * (total - current);
                        eta = this.formatTime(remaining);
                    }
                    timeDetails = `Elapsed: ${this.formatTime(elapsed)} | ETA: ${eta}`;
                }

                if (!existing) {
                    existing = document.createElement('div');
                    existing.id = 'gp-processing-popup';
                    existing.style.cssText = `
                        position: fixed;
                        top: 24px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #202124;
                        color: #e8eaed;
                        padding: 16px 24px;
                        border-radius: 8px;
                        z-index: 99999;
                        font-family: 'Google Sans', Roboto, Arial, sans-serif;
                        font-size: 14px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                        text-align: center;
                        min-width: 250px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 8px;
                    `;
                    existing.innerHTML = `
                        <div style="font-weight: bold;">Processing media</div>
                        <div id="gp-msg-status" style="font-size: 12px; opacity: 0.9;"></div>
                        <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                            <span id="gp-msg-count"></span>
                            <img id="gp-stop-btn" src="${stopIcon}" style="width: 20px; height: 20px; cursor: pointer; opacity: 0.8; transition: opacity 0.2s;" title="Stop Processing">
                        </div>
                        <div id="gp-msg-time" style="font-size: 11px; opacity: 0.7; font-family: monospace;"></div>
                        <div style="width: 100%; background: #555; height: 4px; border-radius: 2px; overflow: hidden; margin-top: 4px;">
                            <div id="gp-msg-bar" style="width: 0%; background: #8ab4f8; height: 100%;"></div>
                        </div>
                    `;
                    document.body.appendChild(existing);

                    const btn = document.getElementById('gp-stop-btn');
                    if (btn) {
                        btn.onclick = () => {
                            // Dispatch custom event for controller to handle
                            const event = new CustomEvent('gp-stop-processing');
                            document.dispatchEvent(event);
                        };
                        btn.onmouseover = () => btn.style.opacity = "1";
                        btn.onmouseout = () => btn.style.opacity = "0.8";
                    }
                }

                const elStatus = document.getElementById('gp-msg-status');
                const elCount = document.getElementById('gp-msg-count');
                const elTime = document.getElementById('gp-msg-time');
                const elBar = document.getElementById('gp-msg-bar');

                if (elStatus) elStatus.textContent = status;
                if (elCount) elCount.textContent = `${current}/${total} done`;
                if (elTime) elTime.textContent = timeDetails;
                if (elBar) elBar.style.width = `${percent}%`;
            },

            startTimer: function (current, total, startTime, status) {
                if (this.timerId) clearInterval(this.timerId);
                this.timerId = setInterval(() => {
                    this.render(current, total, startTime, status);
                }, 1000);
            },

            formatTime: function (ms) {
                if (ms < 0) return "0s";
                const s = Math.floor(ms / 1000) % 60;
                const m = Math.floor(ms / 60000);
                return `${m}m ${s}s`;
            }
        },

        injectButton: function (callback) {
            // Check if button already exists
            if (document.querySelector('.gp-kml-export-container')) return;

            // Try to find the actions container first (most reliable for where we want to put it)
            let targetContainer = document.querySelector(TOOLBAR_ACTIONS_SELECTOR);

            // If not found, try the general toolbar
            if (!targetContainer) {
                const toolbar = document.querySelector(TOOLBAR_SELECTOR);
                if (toolbar) {
                    // If we found the toolbar but not the actions container, maybe prepend to toolbar?
                    // Or maybe the selector changed. Let's try to prepend to the toolbar itself as fallback.
                    targetContainer = toolbar;
                }
            }

            if (!targetContainer) {
                // If still not found, search specifically for text content "Share" or aria-labels to identify the toolbar
                // This is a "Hail Mary" fallback for robustness. Supports English and Ukrainian.
                const buttons = document.querySelectorAll('div[role="button"]');
                for (let btn of buttons) {
                    const label = btn.getAttribute("aria-label");
                    const text = btn.innerText;
                    if (text === "Share" || label === "Share" || label === "Поділитися") {
                        // The parent of the share button is likely the actions container
                        targetContainer = btn.parentElement;
                        console.log('[TimTools] Found toolbar via Share button:', label);
                        break;
                    }
                }
            }

            if (!targetContainer) {
                // Debug: why not found?
                // console.log('[TimTools] Toolbar not found. Photos selected?');
                return;
            }

            // Create Container
            const container = document.createElement('div');
            container.className = 'DNAsC G6iPcb gp-kml-export-container';
            // Styling to match existing toolbar items if possible (margins etc)
            container.style.display = 'inline-flex';
            container.style.alignItems = 'center';
            container.style.marginLeft = '8px';

            const button = document.createElement('button');
            button.className = 'gp-kml-export-btn';
            button.title = 'Export Selected to KML';
            button.ariaLabel = 'Export KML';
            // Reset button styles to blend in
            button.style.background = 'transparent';
            button.style.border = 'none';
            button.style.cursor = 'pointer';
            button.style.padding = '8px';
            button.style.borderRadius = '50%';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';

            button.onmouseover = () => button.style.backgroundColor = 'rgba(255,255,255,0.1)';
            button.onmouseout = () => button.style.backgroundColor = 'transparent';

            const iconUrl = chrome.runtime.getURL('assets/active/kml-export-icon.svg');
            const icon = document.createElement('img');
            icon.src = iconUrl;
            icon.style.cssText = 'width: 24px; height: 24px; display: block;';

            button.appendChild(icon);
            button.addEventListener('click', callback);

            container.appendChild(button);

            // Insert: prepend to target container so it appears on the left or start of actions
            targetContainer.prepend(container);
            console.log('[TimTools] KML Export button injected.');
        },

        showToast: function (msg) {
            console.log(msg);
        }
    };

    window.TimTools.Modules.KmlExport.UI = UI;
})();
