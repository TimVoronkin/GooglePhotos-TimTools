window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};
window.TimTools.Modules.KmlExport = window.TimTools.Modules.KmlExport || {};

(function () {
    const logger = (window.TimTools.Logger && window.TimTools.Logger.create)
        ? window.TimTools.Logger.create('KmlExport')
        : {
            log: (...args) => console.log('[GP-TimTools][KmlExport]', ...args),
            warn: (...args) => console.warn('[GP-TimTools][KmlExport]', ...args),
            error: (...args) => console.error('[GP-TimTools][KmlExport]', ...args)
        };

    // Selectors
    const TOOLBAR_ACTIONS_SELECTOR = 'div[jscontroller="MHDZYd"]';
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
                            <span id="gp-stop-btn" style="cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.85; transition: opacity 0.2s;" title="Stop Processing">
                                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#ea868f">
                                    <path d="M320-320h320v-320H320v320ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
                                </svg>
                            </span>
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
                            const event = new CustomEvent('gp-stop-processing');
                            document.dispatchEvent(event);
                        };
                        btn.onmouseover = () => btn.style.opacity = "1";
                        btn.onmouseout = () => btn.style.opacity = "0.85";
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
            if (document.querySelector('.gp-kml-export-container')) return;

            let targetContainer = document.querySelector(TOOLBAR_ACTIONS_SELECTOR);

            if (!targetContainer) {
                const toolbar = document.querySelector(TOOLBAR_SELECTOR);
                if (toolbar) {
                    targetContainer = toolbar;
                }
            }

            if (!targetContainer) {
                const buttons = document.querySelectorAll('div[role="button"]');
                for (let btn of buttons) {
                    const label = btn.getAttribute("aria-label");
                    const text = btn.innerText;
                    if (text === "Share" || label === "Share" || label === "Поділитися") {
                        targetContainer = btn.parentElement;
                        logger.log('Found toolbar via Share button:', label);
                        break;
                    }
                }
            }

            if (!targetContainer) return;

            const container = document.createElement('div');
            container.className = 'DNAsC G6iPcb gp-kml-export-container';
            container.style.display = 'inline-flex';
            container.style.alignItems = 'center';
            container.style.marginLeft = '8px';

            const SVG_KML_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M120-240q-33 0-56.5-23.5T40-320q0-33 23.5-56.5T120-400h10.5q4.5 0 9.5 2l182-182q-2-5-2-9.5V-600q0-33 23.5-56.5T400-680q33 0 56.5 23.5T480-600q0 2-2 20l102 102q5-2 9.5-2h21q4.5 0 9.5 2l142-142q-2-5-2-9.5V-640q0-33 23.5-56.5T840-720q33 0 56.5 23.5T920-640q0 33-23.5 56.5T840-560h-10.5q-4.5 0-9.5-2L678-420q2 5 2 9.5v10.5q0 33-23.5 56.5T600-320q-33 0-56.5-23.5T520-400v-10.5q0-4.5 2-9.5L420-522q-5 2-9.5 2H400q-2 0-20-2L198-340q2 5 2 9.5v10.5q0 33-23.5 56.5T120-240Z"/></svg>`;

            const button = document.createElement('button');
            button.className = 'pYTkkf-Bz112c-LgbsSe pYTkkf-Bz112c-LgbsSe-OWXEXe-SfQLQb-suEOdc gp-kml-export-btn';
            button.title = 'Export Selected to KML';
            button.ariaLabel = 'Export KML';
            button.style.background = 'transparent';
            button.style.border = 'none';
            button.style.cursor = 'pointer';
            button.style.width = '40px';
            button.style.height = '40px';
            button.style.padding = '0';
            button.style.borderRadius = '50%';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.color = 'inherit';
            button.style.transition = 'background-color 0.2s';

            button.onmouseover = () => button.style.backgroundColor = 'rgba(128, 128, 128, 0.16)';
            button.onmouseout = () => button.style.backgroundColor = 'transparent';

            button.innerHTML = `<span class="pYTkkf-Bz112c-kBDsod-Rtc0Jf" aria-hidden="true" style="display:flex;align-items:center;justify-content:center;">${SVG_KML_ICON}</span>`;
            button.addEventListener('click', callback);

            container.appendChild(button);
            targetContainer.prepend(container);
            logger.log('KML Export button injected.');
        },

        showToast: function (msg) {
            logger.log(msg);
        }
    };

    window.TimTools.Modules.KmlExport.UI = UI;
})();
