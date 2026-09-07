window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
    const LOG_PREFIX = '[GP-TimTools][DragInTime]';

    function log(...args) {
        console.log(LOG_PREFIX, ...args);
    }

    function warn(...args) {
        console.warn(LOG_PREFIX, ...args);
    }

    function error(...args) {
        console.error(LOG_PREFIX, ...args);
    }

    // Precise Selectors for Google Photos Grid DOM
    const LISTBOX_SELECTOR = 'ul[role="listbox"]';
    const SELECTED_PHOTO_SELECTOR = 'div.rtIMgb.nV0gYe.WjVZdb.R1sU4e';
    const ALL_PHOTO_CARDS_SELECTOR = 'div.rtIMgb.nV0gYe';
    const ROW_CONTAINER_SELECTOR = 'div.I9QCXd';
    const TOOLBAR_ACTIONS_SELECTOR = 'div[jscontroller="MHDZYd"]';
    const TOOLBAR_SELECTOR = '.c9yG5b.txMZRd';

    const DragInTime = {
        isActive: false,
        observer: null,
        selectedPhotos: [], // Array of photo objects
        modifiedTimestamps: new Map(), // photoId/label -> Date object
        cloneOverlays: new Map(), // cardEl -> cloneEl

        // Custom Mouse Drag State
        isDragging: false,
        draggedCard: null,
        dragPhantom: null,
        dropIndicator: null,
        currentTargetCard: null,
        dropPosition: 'before',

        // Grid re-render & zoom observers
        gridObserver: null,
        resizeHandler: null,

        // Track modified neighbor styles to cleanly restore layout
        shiftedCards: new Map(), // cardEl -> { origTransform, origWidth, origTransition, origOverflow }

        restoreNeighborStyles: function () {
            if (this.shiftedCards.size === 0) return;
            log(`Restoring original styles for ${this.shiftedCards.size} shifted cards...`);
            this.shiftedCards.forEach((orig, el) => {
                el.style.width = orig.origWidth || '';
                el.style.transform = orig.origTransform || '';
                el.style.transition = orig.origTransition || '';
                el.style.overflow = orig.origOverflow || '';
            });
            this.shiftedCards.clear();
        },

        init: function () {
            log('Initializing Drag in Time module...');
            this.startModalObserver();
            log('Modal observer active.');
        },

        // --- Step 1: Detect and Inject 3rd Option into "Edit date & time" Modal ---
        startModalObserver: function () {
            this.observer = new MutationObserver(() => {
                this.checkAndInjectMenuItem();
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
            this.checkAndInjectMenuItem();
        },

        checkAndInjectMenuItem: function () {
            const listbox = document.querySelector(LISTBOX_SELECTOR);
            if (!listbox) return;

            if (listbox.querySelector('li[data-name="DragInTime"]')) return;

            const options = listbox.querySelectorAll('li[role="option"]');
            if (options.length < 2) return;

            log(`Found modal listbox with ${options.length} native options. Injecting 3rd option...`);

            const templateOption = options[0];
            const newOption = templateOption.cloneNode(true);

            newOption.setAttribute('data-name', 'DragInTime');
            newOption.setAttribute('aria-selected', 'false');
            newOption.removeAttribute('jsaction');
            newOption.removeAttribute('jscontroller');
            newOption.removeAttribute('jsname');
            newOption.removeAttribute('jslog');

            const allDescendants = newOption.querySelectorAll('*');
            allDescendants.forEach(el => {
                el.removeAttribute('jsaction');
                el.removeAttribute('jscontroller');
                el.removeAttribute('jsname');
                el.removeAttribute('jslog');
            });

            const titleSpan = newOption.querySelector('[jsname="K4r5Ff"]') || newOption.querySelector('.aqdrmf-rymPhb-fpDzbe-fmcmS');
            const subSpan = newOption.querySelector('[jsname="uyy0gb"]') || newOption.querySelector('.aqdrmf-rymPhb-L8ivfd-fmcmS');

            if (titleSpan) titleSpan.textContent = 'Drag in Time';
            if (subSpan) subSpan.textContent = 'Drag selected photos chronologically or edit date & time';

            const iconContainer = newOption.querySelector('.aqdrmf-rymPhb-KkROqb');
            if (iconContainer) {
                iconContainer.innerHTML = `
                    <span class="notranslate aqdrmf-rymPhb-Abojl aqdrmf-rymPhb-H09UMb-bN97Pc" aria-hidden="true">
                        <svg width="24px" height="24px" class="v1262d F72gab" viewBox="0 -960 960 960" fill="currentColor">
                            <path d="M480-80 310-250l57-57 73 73v-206H235l73 72-58 58L80-480l169-169 57 57-72 72h206v-206l-73 73-57-57 170-170 170 170-57 57-73-73v206h205l-73-72 58-58 170 170-170 170-57-57 73-73H520v205l72-73 58 58L480-80Z"/>
                        </svg>
                    </span>
                `;
            }

            newOption.style.cursor = 'pointer';
            newOption.style.transition = 'background-color 0.15s ease';
            newOption.addEventListener('mouseenter', () => {
                newOption.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            });
            newOption.addEventListener('mouseleave', () => {
                newOption.style.backgroundColor = 'transparent';
            });

            const handleSelect = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                log('"Drag in Time" option clicked in modal listbox!');
                this.closeDateModal();
                setTimeout(() => {
                    this.activateMode();
                }, 60);
            };

            newOption.addEventListener('click', handleSelect, true);

            listbox.appendChild(newOption);
            log('Successfully injected 3rd option "Drag in Time".');
        },

        closeDateModal: function () {
            log('Closing Google Photos date modal dialog...');
            const listbox = document.querySelector(LISTBOX_SELECTOR);
            const dialog = (listbox && listbox.closest('[role="dialog"]')) || document.querySelector('div[role="dialog"], c-wiz[role="dialog"]');

            let closeBtn = null;
            if (dialog) {
                // 1. Search for close button inside dialog by SVG close path
                const paths = dialog.querySelectorAll('svg path');
                for (let p of paths) {
                    const d = p.getAttribute('d') || '';
                    if (d.includes('19 6.41') || d.includes('18.3 5.71') || d.includes('19 5') || d.includes('12 10.59') || d.startsWith('M19 6.41')) {
                        closeBtn = p.closest('button');
                        if (closeBtn) break;
                    }
                }

                // 2. Search by aria-label keywords
                if (!closeBtn) {
                    const buttons = dialog.querySelectorAll('button');
                    for (let b of buttons) {
                        const label = (b.getAttribute('aria-label') || '').toLowerCase();
                        if (/close|закр|скасув|отмен|cancel/i.test(label)) {
                            closeBtn = b;
                            break;
                        }
                    }
                }

                // 3. Search by dialog action attributes
                if (!closeBtn) {
                    closeBtn = dialog.querySelector('button[data-mdc-dialog-action], button[jsname="V67aGc"]');
                }
            }

            // Fallback global search
            if (!closeBtn) {
                closeBtn = document.querySelector('button[data-mdc-dialog-action="TvD9Pc"], button[aria-label*="Close" i], button[aria-label*="Закр" i], button[aria-label*="Скасув" i]');
            }

            if (closeBtn) {
                log('Modal closed via close button click:', closeBtn);
                closeBtn.click();
            } else {
                log('Close button not found, falling back to Escape key and backdrop dismissal.');
            }

            // Always dispatch Escape key events as well
            const escTarget = dialog || document.activeElement || document.body;
            const escDown = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
            const escUp = new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
            escTarget.dispatchEvent(escDown);
            escTarget.dispatchEvent(escUp);

            // Also click backdrop scrim if present
            const scrim = document.querySelector('.mdc-dialog__scrim, .VfPpkd-T34Ek-haAclf');
            if (scrim) {
                try { scrim.click(); } catch (err) {}
            }
        },

        // --- Step 2: Activate Drag-in-Time Mode ---
        activateMode: function () {
            if (this.isActive) {
                warn('Drag in Time Mode is already active.');
                return;
            }

            this.isActive = true;
            log('====================================================');
            log('ACTIVATING DRAG IN TIME MODE (CLEAN GRID, NO INITIAL DISTORTION)');
            log('====================================================');

            const selectedEls = document.querySelectorAll(SELECTED_PHOTO_SELECTOR);
            log(`Found ${selectedEls.length} selected photo cards on page.`);

            this.selectedPhotos = Array.from(selectedEls).map((el, index) => {
                const info = this.extractPhotoInfo(el, index);
                log(`Selected Photo #${index + 1}:`, info);
                return info;
            });

            this.injectTopToolbarControls();
            this.renderPhotoOverlays();

            // Listen to window resize (page zoom Ctrl +/-)
            this.resizeHandler = () => {
                if (!this.isActive) return;
                log('Window resized / zoomed. Re-checking overlays...');
                this.renderPhotoOverlays();
                this.injectTopToolbarControls();
            };
            window.addEventListener('resize', this.resizeHandler);

            // Continuous DOM observer to restore overlays if Google Photos re-renders cards on zoom/scroll
            this.gridObserver = new MutationObserver(() => {
                if (!this.isActive) return;
                const selected = document.querySelectorAll(SELECTED_PHOTO_SELECTOR);
                let missing = false;
                for (let card of selected) {
                    if (!card.querySelector('.gp-drag-time-overlay')) {
                        missing = true;
                        break;
                    }
                }
                if (missing) {
                    this.renderPhotoOverlays();
                }
                if (!document.querySelector('.gp-drag-time-toolbar')) {
                    this.injectTopToolbarControls();
                }
            });
            this.gridObserver.observe(document.body, { childList: true, subtree: true });

            log('Drag in Time Mode fully activated with clean grid.');
        },

        deactivateMode: function () {
            if (!this.isActive) return;
            log('====================================================');
            log('DEACTIVATING DRAG IN TIME MODE');
            log('====================================================');
            this.isActive = false;

            if (this.resizeHandler) {
                window.removeEventListener('resize', this.resizeHandler);
                this.resizeHandler = null;
            }
            if (this.gridObserver) {
                this.gridObserver.disconnect();
                this.gridObserver = null;
            }

            const toolbarContainer = document.querySelector('.gp-drag-time-toolbar');
            if (toolbarContainer) toolbarContainer.remove();

            // Remove created clones
            this.cloneOverlays.forEach((cloneEl) => cloneEl.remove());
            this.cloneOverlays.clear();

            // Restore all shifted neighbor styles cleanly
            this.restoreNeighborStyles();

            // Restore original selected photo cards styling
            this.selectedPhotos.forEach(p => {
                if (p.element) {
                    p.element.style.opacity = '';
                    p.element.style.filter = '';
                    p.element.style.outline = '';
                    p.element.style.pointerEvents = '';
                }
            });

            document.querySelectorAll('.gp-drag-time-overlay').forEach(el => el.remove());

            this.selectedPhotos = [];
            this.modifiedTimestamps.clear();
            this.cleanupCustomDrag();

            log('Drag in Time Mode deactivated.');
        },

        // --- Step 3: Top Toolbar Controls (Vertically Centered) ---
        injectTopToolbarControls: function () {
            log('Injecting vertically centered top toolbar controls...');
            const existing = document.querySelector('.gp-drag-time-toolbar');
            if (existing) existing.remove();

            let targetContainer = document.querySelector(TOOLBAR_ACTIONS_SELECTOR) || document.querySelector(TOOLBAR_SELECTOR);
            if (!targetContainer) {
                warn('Toolbar actions container not found, appending fallback.');
                targetContainer = document.body;
            }

            const container = document.createElement('div');
            container.className = 'gp-drag-time-toolbar';
            container.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                gap: 8px;
                margin-left: 12px;
                align-self: center;
                z-index: 10000;
            `;

            const applyBtn = document.createElement('button');
            applyBtn.className = 'gp-apply-time-btn';
            applyBtn.textContent = 'Apply date & time changes';
            applyBtn.style.cssText = `
                background-color: #8ab4f8;
                color: #202124;
                border: none;
                border-radius: 18px;
                padding: 6px 16px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                height: 32px;
            `;
            applyBtn.onclick = () => this.handleApplyChanges();

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'gp-cancel-time-btn';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = `
                background-color: rgba(255,255,255,0.1);
                color: #e8eaed;
                border: 1px solid rgba(255,255,255,0.3);
                border-radius: 18px;
                padding: 6px 14px;
                font-size: 13px;
                cursor: pointer;
                display: flex;
                align-items: center;
                height: 32px;
            `;
            cancelBtn.onclick = () => this.deactivateMode();

            container.appendChild(applyBtn);
            container.appendChild(cancelBtn);
            targetContainer.prepend(container);

            log('Top toolbar controls injected and vertically centered.');
        },

        // --- Step 4: Extract Photo Info & Custom Date Formatting (YYYY.M.D HH:mm) ---
        extractPhotoInfo: function (cardEl, fallbackIndex) {
            const linkEl = cardEl.querySelector('a');
            const href = linkEl ? linkEl.href : '';
            const ariaLabel = linkEl ? linkEl.getAttribute('aria-label') : (cardEl.getAttribute('aria-label') || '');

            const parsedDate = this.parseDateFromAriaLabel(ariaLabel);
            const photoId = href || `photo_${fallbackIndex}_${Date.now()}`;

            return {
                id: photoId,
                element: cardEl,
                ariaLabel: ariaLabel,
                timestamp: parsedDate || new Date(),
                isOriginalSelected: true
            };
        },

        parseDateFromAriaLabel: function (text) {
            if (!text) return null;

            try {
                const cleanText = text.replace(/^(Photo|Світлина|Video|Відео)\s*[\–\-]\s*/i, '').trim();
                const d = new Date(cleanText);
                if (!isNaN(d.getTime())) {
                    return d;
                }
            } catch (err) {
                warn('Failed to parse date string:', text, err);
            }

            return null;
        },

        formatCustomDate: function (date) {
            if (!date || isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${year}.${month}.${day} ${hours}:${minutes}`;
        },

        parseCustomDateString: function (str) {
            if (!str) return null;
            const match = str.trim().match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
            if (!match) return null;

            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const day = parseInt(match[3], 10);
            const hours = parseInt(match[4], 10);
            const minutes = parseInt(match[5], 10);

            const d = new Date(year, month, day, hours, minutes);
            return isNaN(d.getTime()) ? null : d;
        },

        parseTransformXYZ: function (transformStr) {
            if (!transformStr || transformStr === 'none') return { x: 0, y: 0, z: 0 };

            // 1. translate3d(X, Y, Z)
            const t3d = transformStr.match(/translate3d\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
            if (t3d) {
                return {
                    x: parseFloat(t3d[1]) || 0,
                    y: parseFloat(t3d[2]) || 0,
                    z: parseFloat(t3d[3]) || 0
                };
            }

            // 2. translate(X, Y)
            const t2d = transformStr.match(/translate\(([^,]+)(?:,\s*([^)]+))?\)/);
            if (t2d) {
                return {
                    x: parseFloat(t2d[1]) || 0,
                    y: parseFloat(t2d[2]) || 0,
                    z: 0
                };
            }

            // 3. 2D matrix(a, b, c, d, tx, ty)
            const mat2d = transformStr.match(/^matrix\((.+)\)$/);
            if (mat2d) {
                const parts = mat2d[1].split(',').map(s => parseFloat(s.trim()));
                if (parts.length >= 6) {
                    return { x: parts[4] || 0, y: parts[5] || 0, z: 0 };
                }
            }

            // 4. 3D matrix3d(...)
            const mat3d = transformStr.match(/^matrix3d\((.+)\)$/);
            if (mat3d) {
                const parts = mat3d[1].split(',').map(s => parseFloat(s.trim()));
                if (parts.length >= 16) {
                    return { x: parts[12] || 0, y: parts[13] || 0, z: parts[14] || 0 };
                }
            }

            return { x: 0, y: 0, z: 0 };
        },

        getCardTransform: function (cardEl) {
            if (!cardEl) return { x: 0, y: 0, z: 0 };
            if (cardEl.style && cardEl.style.transform && cardEl.style.transform !== 'none') {
                const tf = this.parseTransformXYZ(cardEl.style.transform);
                if (tf.x !== 0 || tf.y !== 0) return tf;
            }
            return this.parseTransformXYZ(window.getComputedStyle(cardEl).transform);
        },

        // --- Step 5: Render Clean Photo Overlays (No Initial Distortion) ---
        renderPhotoOverlays: function () {
            log('Rendering clean photo overlays on grid cards...');

            const allCards = document.querySelectorAll(ALL_PHOTO_CARDS_SELECTOR);
            log(`Scanning photo cards (div.rtIMgb.nV0gYe): found ${allCards.length}`);

            allCards.forEach((card, index) => {
                if (card.querySelector('.gp-drag-time-overlay')) return;

                const isSelected = card.classList.contains('R1sU4e');
                const linkEl = card.querySelector('a');
                const ariaLabel = linkEl ? linkEl.getAttribute('aria-label') : (card.getAttribute('aria-label') || '');
                const parsedDate = this.parseDateFromAriaLabel(ariaLabel) || new Date();
                const tzOffset = -parsedDate.getTimezoneOffset() / 60;
                const tzString = `UTC${tzOffset >= 0 ? '+' + tzOffset : tzOffset}`;
                const customDateStr = this.formatCustomDate(parsedDate);

                const overlay = document.createElement('div');
                overlay.className = 'gp-drag-time-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    bottom: 4px;
                    left: 4px;
                    right: 4px;
                    background: rgba(0, 0, 0, 0.85);
                    color: #fff;
                    padding: 4px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-family: monospace;
                    z-index: 100;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    pointer-events: auto;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    user-select: none;
                `;

                if (isSelected) {
                    overlay.style.border = '1px solid #8ab4f8';
                    overlay.style.background = 'rgba(20, 30, 55, 0.95)';

                    overlay.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 9px; opacity: 0.8; color: #8ab4f8; font-weight: bold;">EDIT TIME</span>
                            <span style="font-size: 9px; opacity: 0.8;">${tzString}</span>
                        </div>
                        <input type="text" class="gp-custom-time-input" value="${customDateStr}" style="
                            background: #202124;
                            color: #fff;
                            border: 1px solid #555;
                            border-radius: 3px;
                            font-size: 11px;
                            font-family: monospace;
                            padding: 2px 4px;
                            width: 100%;
                            box-sizing: border-box;
                            text-align: center;
                        ">
                        <div class="gp-drag-handle" style="
                            cursor: grab;
                            background: #8ab4f8;
                            color: #202124;
                            text-align: center;
                            font-weight: bold;
                            font-size: 10px;
                            padding: 4px;
                            border-radius: 3px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 4px;
                            user-select: none;
                        ">
                            <span>☰ Drag in Time</span>
                        </div>
                    `;

                    // Custom Date Input listener (YYYY.M.D HH:mm)
                    const inputEl = overlay.querySelector('.gp-custom-time-input');
                    inputEl.addEventListener('change', (e) => {
                        const newDate = this.parseCustomDateString(e.target.value);
                        if (newDate) {
                            log(`Manual date input change on card #${index}:`, this.formatCustomDate(newDate));
                            this.handleManualTimeChange(card, newDate);
                        } else {
                            warn('Invalid custom date string entered:', e.target.value);
                            inputEl.value = customDateStr;
                        }
                    });

                    // Attach Custom Mouse Drag
                    const handleEl = overlay.querySelector('.gp-drag-handle');
                    this.attachCustomMouseDrag(handleEl, card);

                } else {
                    overlay.innerHTML = `
                        <div style="font-size: 10px; opacity: 0.9;">${customDateStr}</div>
                        <div style="font-size: 9px; opacity: 0.6;">${tzString}</div>
                    `;
                }

                // card.style.position = 'relative';
                card.appendChild(overlay);
            });

            log('Finished rendering clean photo overlays.');
        },

        // --- Step 6: Custom Mouse Drag-and-Drop Implementation ---
        attachCustomMouseDrag: function (handleEl, cardEl) {
            handleEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                log('Mouse Down on Drag Handle of card:', cardEl);
                this.startCustomDrag(e, cardEl);
            });
        },

        startCustomDrag: function (e, cardEl) {
            this.isDragging = true;
            // Support dragging from either original card or clone card
            const originalCard = cardEl._originalCard || cardEl;
            this.draggedCard = originalCard;

            const rect = cardEl.getBoundingClientRect();
            this.dragPhantom = document.createElement('div');
            this.dragPhantom.className = 'gp-drag-phantom';
            this.dragPhantom.style.cssText = `
                position: fixed;
                top: ${e.clientY - 20}px;
                left: ${e.clientX - 60}px;
                width: ${Math.min(rect.width, 180)}px;
                height: 60px;
                background: rgba(32, 33, 36, 0.95);
                border: 2px solid #8ab4f8;
                border-radius: 8px;
                color: #fff;
                padding: 8px;
                font-size: 12px;
                font-family: sans-serif;
                z-index: 999999;
                pointer-events: none;
                box-shadow: 0 8px 16px rgba(0,0,0,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            `;
            this.dragPhantom.textContent = 'Dragging photo in time...';
            document.body.appendChild(this.dragPhantom);

            this.dropIndicator = document.createElement('div');
            this.dropIndicator.className = 'gp-drop-indicator';
            this.dropIndicator.style.cssText = `
                position: fixed;
                width: 4px;
                height: 120px;
                background-color: #8ab4f8;
                box-shadow: 0 0 8px #8ab4f8;
                z-index: 999998;
                pointer-events: none;
                display: none;
                border-radius: 2px;
            `;
            document.body.appendChild(this.dropIndicator);

            cardEl.style.opacity = '0.4';

            this.onMouseMove = (evt) => this.handleCustomDragMove(evt);
            this.onMouseUp = (evt) => this.handleCustomDragEnd(evt);

            window.addEventListener('mousemove', this.onMouseMove, true);
            window.addEventListener('mouseup', this.onMouseUp, true);
            log('Custom Mouse Drag started for card:', originalCard);
        },

        handleCustomDragMove: function (e) {
            if (!this.isDragging || !this.dragPhantom) return;

            this.dragPhantom.style.top = `${e.clientY - 20}px`;
            this.dragPhantom.style.left = `${e.clientX - 60}px`;

            const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
            let targetCard = null;

            for (let el of elementsUnder) {
                // Ignore clone overlays and phantom
                if (el.closest('.gp-drag-phantom') || el.closest('.gp-photo-duplicate-clone')) continue;

                if (el.matches && el.matches(ALL_PHOTO_CARDS_SELECTOR)) {
                    targetCard = el;
                    break;
                }
                const parentCard = el.closest ? el.closest(ALL_PHOTO_CARDS_SELECTOR) : null;
                if (parentCard) {
                    targetCard = parentCard;
                    break;
                }
            }

            if (targetCard && targetCard !== this.draggedCard) {
                this.currentTargetCard = targetCard;
                const rect = targetCard.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;

                this.dropPosition = (e.clientX < midX) ? 'before' : 'after';

                this.dropIndicator.style.display = 'block';
                this.dropIndicator.style.top = `${rect.top}px`;
                this.dropIndicator.style.height = `${rect.height}px`;
                this.dropIndicator.style.left = (this.dropPosition === 'before') ? `${rect.left - 2}px` : `${rect.right - 2}px`;
            } else {
                this.dropIndicator.style.display = 'none';
            }
        },

        handleCustomDragEnd: function (e) {
            log('Mouse Up: finishing custom drag...');

            const originalCard = this.draggedCard;

            if (this.currentTargetCard && this.currentTargetCard !== originalCard) {
                log('Dropped onto target card:', this.currentTargetCard, 'Position:', this.dropPosition);
                this.executeDropReorderAndExpandGaps(originalCard, this.currentTargetCard, this.dropPosition);
            } else {
                warn('Custom drag released without valid target.');
                if (originalCard) {
                    originalCard.style.opacity = this.cloneOverlays.has(originalCard) ? '0.35' : '1';
                }
            }

            this.cleanupCustomDrag();
        },

        cleanupCustomDrag: function () {
            this.isDragging = false;
            this.draggedCard = null;
            this.currentTargetCard = null;

            if (this.dragPhantom) {
                this.dragPhantom.remove();
                this.dragPhantom = null;
            }

            if (this.dropIndicator) {
                this.dropIndicator.remove();
                this.dropIndicator = null;
            }

            if (this.onMouseMove) {
                window.removeEventListener('mousemove', this.onMouseMove, true);
                this.onMouseMove = null;
            }

            if (this.onMouseUp) {
                window.removeEventListener('mouseup', this.onMouseUp, true);
                this.onMouseUp = null;
            }
        },

        // --- Step 7: Local Neighbor Gap Creation & Insert Clone With Drag Handle ---
        executeDropReorderAndExpandGaps: function (draggedOriginalCard, targetCard, position) {
            log('Executing drop reorder, local gap creation, and positioning...');

            // 1. Cleanly restore any previously shifted neighbor cards
            this.restoreNeighborStyles();

            const allCards = Array.from(document.querySelectorAll(ALL_PHOTO_CARDS_SELECTOR))
                .filter(c => c !== draggedOriginalCard && !c.classList.contains('gp-photo-duplicate-clone'));
            const targetIndex = allCards.indexOf(targetCard);

            let neighborLeft = null;
            let neighborRight = null;

            if (position === 'before') {
                neighborRight = targetCard;
                neighborLeft = (targetIndex > 0) ? allCards[targetIndex - 1] : null;
            } else {
                neighborLeft = targetCard;
                neighborRight = (targetIndex < allCards.length - 1) ? allCards[targetIndex + 1] : null;
            }

            const getCardAriaLabel = (card) => {
                if (!card) return '';
                const linkEl = card.querySelector('a');
                return linkEl ? linkEl.getAttribute('aria-label') : (card.getAttribute('aria-label') || '');
            };

            const dateLeft = neighborLeft ? this.parseDateFromAriaLabel(getCardAriaLabel(neighborLeft)) : null;
            const dateRight = neighborRight ? this.parseDateFromAriaLabel(getCardAriaLabel(neighborRight)) : null;

            log('Neighbor Left Date:', dateLeft ? this.formatCustomDate(dateLeft) : 'None');
            log('Neighbor Right Date:', dateRight ? this.formatCustomDate(dateRight) : 'None');

            let newTimestampMs;
            if (dateLeft && dateRight) {
                const timeA = dateLeft.getTime();
                const timeB = dateRight.getTime();
                newTimestampMs = Math.round(timeA + (timeB - timeA) / 2);
                log(`Calculated midpoint: ${this.formatCustomDate(dateLeft)} <-> ${this.formatCustomDate(dateRight)}`);
            } else if (dateLeft) {
                newTimestampMs = dateLeft.getTime() - 60000;
            } else if (dateRight) {
                newTimestampMs = dateRight.getTime() + 60000;
            } else {
                newTimestampMs = Date.now();
            }

            const calculatedDate = new Date(newTimestampMs);
            const customDateStr = this.formatCustomDate(calculatedDate);

            log('NEW INTERPOLATED TIMESTAMP:', customDateStr);

            // 2. Perform LOCAL ONLY neighbor adjustment and place clone
            this.insertCloneBetweenNeighbors(draggedOriginalCard, targetCard, neighborLeft, neighborRight, position, customDateStr, calculatedDate);

            // 3. Save modified timestamp
            const photoId = getCardAriaLabel(draggedOriginalCard) || 'dragged_photo';
            this.modifiedTimestamps.set(photoId, calculatedDate);
        },

        insertCloneBetweenNeighbors: function (draggedOriginalCard, targetCard, neighborLeft, neighborRight, position, customDateStr, calculatedDate) {
            const targetTf = this.getCardTransform(targetCard);
            const targetHeight = targetCard.offsetHeight || 180;

            const leftTf = neighborLeft ? this.getCardTransform(neighborLeft) : null;
            const rightTf = neighborRight ? this.getCardTransform(neighborRight) : null;

            // Check if neighbors are on the same visual line (within 25px Y)
            const leftInRow = neighborLeft && (Math.abs(leftTf.y - targetTf.y) < 25);
            const rightInRow = neighborRight && (Math.abs(rightTf.y - targetTf.y) < 25);

            // Fixed, clear, visible width for the inserted moved card
            const cloneWidth = 150;
            const gap = 4;
            const spaceNeeded = cloneWidth + gap;

            let cloneX = targetTf.x;
            let cloneY = targetTf.y;

            if (leftInRow && rightInRow) {
                // Both neighbors in row: create gap between them by gently shrinking each
                const shrinkEach = Math.round(spaceNeeded / 2);

                this.saveOriginalNeighborStyle(neighborLeft);
                const origLeftW = neighborLeft.offsetWidth;
                const newLeftW = Math.max(origLeftW - shrinkEach, 60);
                neighborLeft.style.transition = 'width 0.3s ease, transform 0.3s ease';
                neighborLeft.style.overflow = 'hidden';
                neighborLeft.style.width = `${newLeftW}px`;

                cloneX = leftTf.x + newLeftW + gap;
                cloneY = leftTf.y;

                this.saveOriginalNeighborStyle(neighborRight);
                const origRightW = neighborRight.offsetWidth;
                const newRightW = Math.max(origRightW - shrinkEach, 60);
                const newRightX = cloneX + cloneWidth + gap;
                neighborRight.style.transition = 'width 0.3s ease, transform 0.3s ease';
                neighborRight.style.overflow = 'hidden';
                neighborRight.style.width = `${newRightW}px`;
                neighborRight.style.transform = `translate3d(${newRightX}px, ${rightTf.y}px, ${rightTf.z}px)`;

            } else if (rightInRow) {
                // Drop before start of a row
                cloneX = rightTf.x;
                cloneY = rightTf.y;

                this.saveOriginalNeighborStyle(neighborRight);
                const origRightW = neighborRight.offsetWidth;
                const shrink = Math.min(Math.round(spaceNeeded * 0.4), origRightW - 60);
                const newRightW = Math.max(origRightW - shrink, 60);
                const newRightX = cloneX + cloneWidth + gap;

                neighborRight.style.transition = 'width 0.3s ease, transform 0.3s ease';
                neighborRight.style.overflow = 'hidden';
                neighborRight.style.width = `${newRightW}px`;
                neighborRight.style.transform = `translate3d(${newRightX}px, ${rightTf.y}px, ${rightTf.z}px)`;

            } else if (leftInRow) {
                // Drop after end of a row
                this.saveOriginalNeighborStyle(neighborLeft);
                const origLeftW = neighborLeft.offsetWidth;
                const shrink = Math.min(Math.round(spaceNeeded * 0.4), origLeftW - 60);
                const newLeftW = Math.max(origLeftW - shrink, 60);

                neighborLeft.style.transition = 'width 0.3s ease, transform 0.3s ease';
                neighborLeft.style.overflow = 'hidden';
                neighborLeft.style.width = `${newLeftW}px`;

                cloneX = leftTf.x + newLeftW + gap;
                cloneY = leftTf.y;

            } else {
                // Single card in row
                if (position === 'before') {
                    cloneX = targetTf.x;
                    cloneY = targetTf.y;
                    this.saveOriginalNeighborStyle(targetCard);
                    const newTargetX = cloneX + cloneWidth + gap;
                    targetCard.style.transition = 'transform 0.3s ease';
                    targetCard.style.transform = `translate3d(${newTargetX}px, ${targetTf.y}px, ${targetTf.z}px)`;
                } else {
                    cloneX = targetTf.x + targetCard.offsetWidth + gap;
                    cloneY = targetTf.y;
                }
            }

            // Position and render clone
            this.renderOrUpdateClone(draggedOriginalCard, targetCard, cloneX, cloneY, cloneWidth, targetHeight, customDateStr, calculatedDate);
        },

        renderOrUpdateClone: function (draggedOriginalCard, targetCard, x, y, width, height, customDateStr, calculatedDate) {
            let cloneEl = this.cloneOverlays.get(draggedOriginalCard);
            // Append clone to targetCard's parent so it shares the exact coordinate space
            const gridContainer = targetCard.parentElement || draggedOriginalCard.parentElement || document.body;

            const tzOffset = -calculatedDate.getTimezoneOffset() / 60;
            const tzString = `UTC${tzOffset >= 0 ? '+' + tzOffset : tzOffset}`;

            if (!cloneEl) {
                cloneEl = document.createElement('div');
                cloneEl.className = 'gp-photo-duplicate-clone';
                cloneEl.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: ${width}px;
                    height: ${height}px;
                    z-index: 500;
                    border: 2px solid #8ab4f8;
                    border-radius: 8px;
                    box-shadow: 0 0 16px rgba(138, 180, 248, 0.6), 0 4px 12px rgba(0,0,0,0.8);
                    box-sizing: border-box;
                    background: #1e1f20;
                    overflow: hidden;
                    transition: transform 0.3s ease, width 0.3s ease, height 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    pointer-events: auto;
                    user-select: none;
                `;
                gridContainer.appendChild(cloneEl);
                this.cloneOverlays.set(draggedOriginalCard, cloneEl);
            } else if (cloneEl.parentElement !== gridContainer) {
                gridContainer.appendChild(cloneEl);
            }

            cloneEl.style.width = `${width}px`;
            cloneEl.style.height = `${height}px`;
            cloneEl.style.transform = `translate3d(${x}px, ${y}px, 0px)`;

            // Render thumbnail container, badge, time input, and drag handle
            cloneEl.innerHTML = `
                <div class="gp-clone-thumb-wrap" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; z-index: 1;">
                </div>
                <div style="position: relative; z-index: 5; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); color: #8ab4f8; font-size: 9px; font-weight: bold; padding: 2px 6px; border-bottom-right-radius: 6px; align-self: flex-start; letter-spacing: 0.5px; border-bottom: 1px solid rgba(138,180,248,0.4); border-right: 1px solid rgba(138,180,248,0.4);">
                    MOVED PHOTO
                </div>
                <div class="gp-clone-controls" style="position: relative; z-index: 5; background: rgba(20, 30, 55, 0.94); backdrop-filter: blur(6px); color: #fff; padding: 4px 6px; display: flex; flex-direction: column; gap: 3px; font-family: monospace; border-top: 1px solid rgba(138, 180, 248, 0.4);">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 8px; opacity: 0.85; color: #8ab4f8; font-weight: bold;">NEW TIME</span>
                        <span style="font-size: 8px; opacity: 0.8;">${tzString}</span>
                    </div>
                    <input type="text" class="gp-custom-time-input" value="${customDateStr}" style="
                        background: #202124;
                        color: #fff;
                        border: 1px solid #555;
                        border-radius: 3px;
                        font-size: 10px;
                        font-family: monospace;
                        padding: 2px 4px;
                        width: 100%;
                        box-sizing: border-box;
                        text-align: center;
                    ">
                    <div class="gp-drag-handle" style="
                        cursor: grab;
                        background: #8ab4f8;
                        color: #202124;
                        text-align: center;
                        font-weight: bold;
                        font-size: 10px;
                        padding: 3px;
                        border-radius: 3px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 4px;
                        user-select: none;
                        transition: background-color 0.15s ease;
                    ">
                        <span>☰ Drag in Time</span>
                    </div>
                </div>
            `;

            // Reliably populate image into thumb wrap by cloning the actual node
            const thumbWrap = cloneEl.querySelector('.gp-clone-thumb-wrap');
            const origImg = draggedOriginalCard.querySelector('img');
            const origBg = draggedOriginalCard.querySelector('[style*="background-image"]');

            if (origImg) {
                const imgCopy = origImg.cloneNode(true);
                imgCopy.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; display: block; filter: brightness(1.05);';
                imgCopy.referrerPolicy = 'no-referrer';
                if (origImg.currentSrc) imgCopy.src = origImg.currentSrc;
                thumbWrap.appendChild(imgCopy);
            } else if (origBg) {
                const bgCopy = origBg.cloneNode(true);
                bgCopy.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center;';
                thumbWrap.appendChild(bgCopy);
            } else {
                thumbWrap.innerHTML = '<div style="width: 100%; height: 100%; background: #2b2c2f; display: flex; align-items: center; justify-content: center; color: #8ab4f8; font-size: 11px;">PHOTO</div>';
            }

            // Wire input listener
            const inputEl = cloneEl.querySelector('.gp-custom-time-input');
            if (inputEl) {
                inputEl.addEventListener('change', (e) => {
                    const newDate = this.parseCustomDateString(e.target.value);
                    if (newDate) {
                        this.handleManualTimeChange(draggedOriginalCard, newDate);
                    } else {
                        inputEl.value = customDateStr;
                    }
                });
            }

            // Wire drag handle on clone to allow MULTIPLE re-drags!
            const handleEl = cloneEl.querySelector('.gp-drag-handle');
            if (handleEl) {
                cloneEl._originalCard = draggedOriginalCard;
                this.attachCustomMouseDrag(handleEl, cloneEl);
            }

            // Dim original card and keep interactions enabled
            draggedOriginalCard.style.opacity = '0.35';
            draggedOriginalCard.style.filter = 'grayscale(0.4)';
            draggedOriginalCard.style.outline = '2px dashed #8ab4f8';
            draggedOriginalCard.style.pointerEvents = 'auto';

            log(`Rendered clone card at translate3d(${x}px, ${y}px, 0px) [${width}x${height}px] with active drag handle.`);
        },

        saveOriginalNeighborStyle: function (cardEl) {
            if (this.shiftedCards.has(cardEl)) return;

            this.shiftedCards.set(cardEl, {
                origWidth: cardEl.style.width,
                origTransform: cardEl.style.transform,
                origTransition: cardEl.style.transition,
                origOverflow: cardEl.style.overflow
            });
        },

        handleManualTimeChange: function (originalCard, newDate) {
            if (isNaN(newDate.getTime())) {
                warn('Invalid manual date entered.');
                return;
            }

            const customDateStr = this.formatCustomDate(newDate);
            log('Manual timestamp update:', customDateStr);

            const linkEl = originalCard.querySelector('a');
            const photoId = linkEl ? linkEl.getAttribute('aria-label') : (originalCard.getAttribute('aria-label') || 'manual_photo');

            this.modifiedTimestamps.set(photoId, newDate);

            const inputEl = originalCard.querySelector('.gp-custom-time-input');
            if (inputEl) inputEl.value = customDateStr;
        },

        // --- Step 8: Apply All Changes ---
        handleApplyChanges: function () {
            log('====================================================');
            log(`APPLYING CHANGES FOR ${this.modifiedTimestamps.size} MODIFIED PHOTOS`);

            if (this.modifiedTimestamps.size === 0) {
                alert('No date/time changes were made.');
                log('No entries in modifiedTimestamps map.');
                return;
            }

            let summaryMsg = `Successfully calculated new dates for ${this.modifiedTimestamps.size} photos!\n\n`;
            this.modifiedTimestamps.forEach((newDate, photoId) => {
                const formatted = this.formatCustomDate(newDate);
                log(`Photo Label: "${photoId}" => New Date: ${formatted}`);
                summaryMsg += `• ${formatted} (${photoId.substring(0, 30)}...)\n`;
            });

            alert(summaryMsg + '\nCheck browser console for detailed logs.');
            log('====================================================');

            this.deactivateMode();
        }
    };

    window.TimTools.Modules.DragInTime = DragInTime;
    log('Module registered under window.TimTools.Modules.DragInTime');
})();
