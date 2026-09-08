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

    // Selectors
    const LISTBOX_SELECTOR = 'ul[role="listbox"]';
    const ALL_PHOTO_CARDS_SELECTOR = 'div.rtIMgb';
    const SELECTED_PHOTO_SELECTOR = 'div.rtIMgb.R1sU4e';

    const DragInTime = {
        observer: null,
        modalOverlay: null,
        photos: [], // Array of photo objects in modal
        selectedMediaKeys: new Set(), // Set of mediaKeys that were originally selected
        modifiedTimestamps: new Map(), // mediaKey/id -> { photo, oldDate, newDate }
        isDragging: false,
        draggedPhotoId: null,
        dragSourceIndex: -1,

        init: function () {
            log('Initializing Drag in Time module (Modal Edition)...');
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
            if (subSpan) subSpan.textContent = 'Reorder photos chronologically in a visual window';

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
                this.captureSelectedKeys();
                this.closeDateModal();
                setTimeout(() => {
                    this.openDragModal();
                }, 80);
            };

            newOption.addEventListener('click', handleSelect, true);
            listbox.appendChild(newOption);
            log('Successfully injected 3rd option "Drag in Time".');
        },

        captureSelectedKeys: function () {
            this.selectedMediaKeys.clear();
            const selectedCards = Array.from(document.querySelectorAll(SELECTED_PHOTO_SELECTOR + ', div.rtIMgb [role="checkbox"][aria-checked="true"]'));
            log(`Found ${selectedCards.length} selected DOM cards on main page.`);
            selectedCards.forEach((el, i) => {
                const card = el.closest('div.rtIMgb') || el;
                const info = this.extractCardInfo(card, i);
                if (info && info.mediaKey) {
                    this.selectedMediaKeys.add(info.mediaKey);
                }
            });
            log(`Captured ${this.selectedMediaKeys.size} initially selected photo mediaKeys.`);
        },

        closeDateModal: function () {
            log('Closing Google Photos native date modal dialog...');
            const listbox = document.querySelector(LISTBOX_SELECTOR);
            const dialog = (listbox && listbox.closest('[role="dialog"]')) || document.querySelector('div[role="dialog"], c-wiz[role="dialog"]');

            let closeBtn = null;
            if (dialog) {
                const paths = dialog.querySelectorAll('svg path');
                for (let p of paths) {
                    const d = p.getAttribute('d') || '';
                    if (d.includes('19 6.41') || d.includes('18.3 5.71') || d.includes('19 5') || d.includes('12 10.59') || d.startsWith('M19 6.41')) {
                        closeBtn = p.closest('button');
                        if (closeBtn) break;
                    }
                }

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

                if (!closeBtn) {
                    closeBtn = dialog.querySelector('button[data-mdc-dialog-action], button[jsname="V67aGc"]');
                }
            }

            if (closeBtn) {
                closeBtn.click();
            }

            const escTarget = dialog || document.activeElement || document.body;
            const escDown = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
            const escUp = new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
            escTarget.dispatchEvent(escDown);
            escTarget.dispatchEvent(escUp);

            const scrim = document.querySelector('.mdc-dialog__scrim, .VfPpkd-T34Ek-haAclf');
            if (scrim) {
                try { scrim.click(); } catch (err) {}
            }
        },

        // --- Step 2: Extract Photos from DOM ---
        parseDateFromAriaLabel: function (text) {
            if (!text) return null;
            try {
                // Strip prefix like "Photo - Landscape - " or "Світлина - Портрет - "
                const cleanText = text.replace(/^(Photo|Світлина|Video|Відео)\s*[\–\-]\s*(Landscape|Portrait|Square|[\w\s]+)?[\–\-]?\s*/i, '').trim();
                const d = new Date(cleanText);
                if (!isNaN(d.getTime())) {
                    return d;
                }
            } catch (err) {}
            return null;
        },

        formatDateHeader: function (date) {
            if (!date || isNaN(date.getTime())) return 'Unknown Date';
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            try {
                return date.toLocaleDateString(undefined, options);
            } catch (e) {
                return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
            }
        },

        formatCustomDate: function (date) {
            if (!date || isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`;
        },

        formatShortTime: function (date) {
            if (!date || isNaN(date.getTime())) return '';
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        },

        parseCustomDateString: function (str) {
            if (!str) return null;
            const match = str.trim().match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
            if (!match) return null;

            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const day = parseInt(match[3], 10);
            const hours = parseInt(match[4], 10);
            const minutes = parseInt(match[5], 10);
            const seconds = match[6] ? parseInt(match[6], 10) : 0;

            const d = new Date(year, month, day, hours, minutes, seconds);
            return isNaN(d.getTime()) ? null : d;
        },

        extractCardInfo: function (cardEl, index) {
            const linkEl = cardEl.querySelector('a');
            const ariaLabel = linkEl ? linkEl.getAttribute('aria-label') : (cardEl.getAttribute('aria-label') || '');
            const parsedDate = this.parseDateFromAriaLabel(ariaLabel) || new Date();

            // Extract media key from jslog="...; 8:AF1Qip..."
            let mediaKey = '';
            const jslog = cardEl.getAttribute('jslog') || (linkEl ? linkEl.getAttribute('jslog') : '');
            const mkMatch = jslog.match(/8:(AF1Q[^\s;,]+)/);
            if (mkMatch) {
                mediaKey = mkMatch[1];
            } else if (linkEl && linkEl.href) {
                const urlParts = linkEl.href.split('/');
                mediaKey = urlParts[urlParts.length - 1] || `photo_${index}`;
            } else {
                mediaKey = `photo_${index}_${parsedDate.getTime()}`;
            }

            // Thumbnail background or image
            let bgUrl = '';
            const bgDiv = cardEl.querySelector('[style*="background-image"]');
            if (bgDiv && bgDiv.style.backgroundImage) {
                const urlMatch = bgDiv.style.backgroundImage.match(/url\(["']?([^"']+)["']?\)/);
                if (urlMatch) bgUrl = urlMatch[1];
            }
            if (!bgUrl) {
                const img = cardEl.querySelector('img');
                if (img) bgUrl = img.currentSrc || img.src;
            }

            // Video info
            let isVideo = false;
            let duration = '';

            if (/^(video|відео|видео)\b/i.test(ariaLabel)) {
                isVideo = true;
                const durMatch = ariaLabel.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
                if (durMatch) duration = durMatch[1];
            }

            const durationEl = cardEl.querySelector('.KhS5De');
            if (durationEl) {
                const text = durationEl.textContent.trim();
                if (/\d+:\d+/.test(text)) {
                    isVideo = true;
                    duration = text;
                }
            }

            if (!isVideo) {
                const playSvg = cardEl.querySelector('svg path[d*="8 5v14l11-7"], svg path[d*="M8 5v14l11-7z"]');
                if (playSvg) {
                    isVideo = true;
                }
            }

            const isSelected = cardEl.classList.contains('R1sU4e') ||
                               (this.selectedMediaKeys && this.selectedMediaKeys.has(mediaKey)) ||
                               (cardEl.querySelector('[role="checkbox"]') && cardEl.querySelector('[role="checkbox"]').getAttribute('aria-checked') === 'true') ||
                               cardEl.querySelector('[aria-checked="true"]') !== null;

            return {
                id: mediaKey,
                mediaKey: mediaKey,
                element: cardEl,
                ariaLabel: ariaLabel,
                timestamp: parsedDate,
                originalTimestamp: new Date(parsedDate.getTime()),
                bgUrl: bgUrl,
                isVideo: isVideo,
                duration: duration,
                isSelected: isSelected,
                isModified: false
            };
        },

        collectPhotosForModal: function () {
            log('Scanning DOM photo cards for Drag in Time modal...');
            const allCards = Array.from(document.querySelectorAll(ALL_PHOTO_CARDS_SELECTOR));
            if (allCards.length === 0) {
                warn('No photo cards found in DOM.');
                return [];
            }

            const allParsed = allCards.map((el, i) => this.extractCardInfo(el, i));
            // Filter unique by mediaKey
            const uniqueMap = new Map();
            allParsed.forEach(p => {
                if (!uniqueMap.has(p.mediaKey)) {
                    uniqueMap.set(p.mediaKey, p);
                }
            });
            const uniqueList = Array.from(uniqueMap.values());

            const selectedPhotos = uniqueList.filter(p => p.isSelected);
            log(`Found ${selectedPhotos.length} selected photos out of ${uniqueList.length} cards.`);

            if (selectedPhotos.length === 0) {
                // If user didn't select, take all visible photos
                return uniqueList;
            }

            // Find min and max time of selected photos
            let minTime = Infinity;
            let maxTime = -Infinity;
            selectedPhotos.forEach(p => {
                const t = p.timestamp.getTime();
                if (t < minTime) minTime = t;
                if (t > maxTime) maxTime = t;
            });

            // Expand range by ±2 days (2 * 24 * 60 * 60 * 1000 = 172,800,000 ms)
            const rangeBufferMs = 2 * 24 * 60 * 60 * 1000;
            const expandedMin = minTime - rangeBufferMs;
            const expandedMax = maxTime + rangeBufferMs;

            log(`Time range filter: ${new Date(expandedMin).toLocaleDateString()} to ${new Date(expandedMax).toLocaleDateString()}`);

            let filtered = uniqueList.filter(p => {
                const t = p.timestamp.getTime();
                return t >= expandedMin && t <= expandedMax;
            });

            // If filtered list has too few photos, include surrounding 10 cards anyway for context
            if (filtered.length < selectedPhotos.length + 4 && uniqueList.length > filtered.length) {
                const firstIdx = uniqueList.findIndex(p => p.mediaKey === selectedPhotos[0].mediaKey);
                const lastIdx = uniqueList.findIndex(p => p.mediaKey === selectedPhotos[selectedPhotos.length - 1].mediaKey);
                const start = Math.max(0, Math.min(firstIdx, lastIdx) - 6);
                const end = Math.min(uniqueList.length, Math.max(firstIdx, lastIdx) + 7);
                filtered = uniqueList.slice(start, end);
            }

            // Sort chronologically (earliest to latest or latest to earliest matching Google Photos order)
            // In Google Photos, photostream starts from newest at top down to oldest.
            filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            return filtered;
        },

        // --- Step 3: Open Google-styled Modal Window ---
        openDragModal: function () {
            if (this.modalOverlay) {
                this.closeDragModal();
            }

            this.photos = this.collectPhotosForModal();
            this.modifiedTimestamps.clear();

            log(`Opening modal with ${this.photos.length} photos.`);
            this.buildModalDOM();
        },

        closeDragModal: function () {
            if (this.modalOverlay) {
                this.modalOverlay.remove();
                this.modalOverlay = null;
            }
            this.isDragging = false;
            this.draggedPhotoId = null;
            this.dragSourceIndex = -1;
            document.body.style.overflow = '';
        },

        buildModalDOM: function () {
            document.body.style.overflow = 'hidden';

            const overlay = document.createElement('div');
            overlay.className = 'gp-drag-modal-overlay uW2Fw-Sx9Kwc yaahMe V639qd un6WHd QaJAKf W6ZbFb';
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.65);
                z-index: 1000000;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
                font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
                animation: gpFadeIn 0.2s ease-out;
            `;

            // Backdrop click closes modal
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeDragModal();
                }
            });

            // Dialog container
            const dialog = document.createElement('div');
            dialog.className = 'gp-drag-modal-dialog uW2Fw-P5QLlc cPSYW';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.style.cssText = `
                background: #202124;
                color: #e8eaed;
                width: 860px;
                max-width: 95vw;
                height: 85vh;
                max-height: 850px;
                border-radius: 28px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
                overflow: hidden;
                position: relative;
            `;

            // 1. Header
            const header = document.createElement('div');
            header.className = 'gp-drag-modal-header uW2Fw-oclYLd Sj2qkc';
            header.style.cssText = `
                padding: 20px 24px 16px 24px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                flex-shrink: 0;
            `;
            header.innerHTML = `
                <div style="display: flex; align-items: baseline; gap: 12px;">
                    <h2 class="uW2Fw-k2Wrsb yu9oGe zBRznc AQxBIc" style="margin: 0; font-size: 22px; font-weight: 400; color: #e8eaed; letter-spacing: 0;">
                        Preview changes
                    </h2>
                    <span style="font-size: 13px; color: #9aa0a6; font-weight: 400;">
                        Drag in Time • Drag photos to reorder
                    </span>
                </div>
                <button class="gp-modal-close-x" style="
                    background: transparent;
                    border: none;
                    color: #9aa0a6;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.15s;
                " title="Close">
                    <svg width="20px" height="20px" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            `;
            header.querySelector('.gp-modal-close-x').onclick = () => this.closeDragModal();

            // 2. Scrollable Body
            const body = document.createElement('div');
            body.className = 'gp-drag-modal-body';
            body.style.cssText = `
                flex: 1;
                overflow-y: auto;
                padding: 16px 24px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                scroll-behavior: smooth;
            `;

            // Top "Load newer photos" button
            const topLoadBtn = document.createElement('button');
            topLoadBtn.className = 'gp-load-btn gp-load-newer';
            topLoadBtn.style.cssText = `
                align-self: center;
                background: rgba(255, 255, 255, 0.08);
                color: #8ab4f8;
                border: 1px dashed rgba(138, 180, 248, 0.5);
                border-radius: 18px;
                padding: 8px 20px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 4px auto 8px auto;
                transition: background-color 0.2s, border-color 0.2s;
            `;
            topLoadBtn.innerHTML = `<span>▲ Load newer photos</span>`;
            topLoadBtn.onmouseenter = () => { topLoadBtn.style.background = 'rgba(138, 180, 248, 0.15)'; };
            topLoadBtn.onmouseleave = () => { topLoadBtn.style.background = 'rgba(255, 255, 255, 0.08)'; };
            topLoadBtn.onclick = () => this.loadMorePhotos('newer');
            body.appendChild(topLoadBtn);

            // Container for photo cards grouped by date
            const gridContainer = document.createElement('div');
            gridContainer.className = 'gp-photos-stream-container';
            gridContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 20px;
                min-height: 120px;
            `;
            body.appendChild(gridContainer);

            // Bottom "Load older photos" button
            const bottomLoadBtn = document.createElement('button');
            bottomLoadBtn.className = 'gp-load-btn gp-load-older';
            bottomLoadBtn.style.cssText = `
                align-self: center;
                background: rgba(255, 255, 255, 0.08);
                color: #8ab4f8;
                border: 1px dashed rgba(138, 180, 248, 0.5);
                border-radius: 18px;
                padding: 8px 20px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 16px auto 24px auto;
                transition: background-color 0.2s, border-color 0.2s;
            `;
            bottomLoadBtn.innerHTML = `<span>▼ Load older photos</span>`;
            bottomLoadBtn.onmouseenter = () => { bottomLoadBtn.style.background = 'rgba(138, 180, 248, 0.15)'; };
            bottomLoadBtn.onmouseleave = () => { bottomLoadBtn.style.background = 'rgba(255, 255, 255, 0.08)'; };
            bottomLoadBtn.onclick = () => this.loadMorePhotos('older');
            body.appendChild(bottomLoadBtn);

            // 3. Footer
            const footer = document.createElement('div');
            footer.className = 'gp-drag-modal-footer uW2Fw-T0kwCb IdSMxc';
            footer.style.cssText = `
                padding: 16px 24px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                flex-shrink: 0;
                background: #202124;
            `;

            const statusInfo = document.createElement('div');
            statusInfo.className = 'gp-modal-status-info';
            statusInfo.style.cssText = `
                font-size: 13px;
                color: #9aa0a6;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            const selectedCount = this.photos.filter(p => p.isSelected).length;
            statusInfo.innerHTML = `
                <span class="gp-count-loaded">${this.photos.length} photos loaded</span>
                <span class="gp-selected-badge" style="${selectedCount > 0 ? '' : 'display: none;'} background: rgba(138, 180, 248, 0.15); color: #8ab4f8; padding: 2px 8px; border-radius: 10px; font-weight: 500; font-size: 11px;">
                    ${selectedCount} selected
                </span>
                <span class="gp-modified-badge" style="display: none; background: rgba(138, 180, 248, 0.2); color: #8ab4f8; padding: 2px 8px; border-radius: 10px; font-weight: 500; font-size: 11px;">
                    0 modified
                </span>
            `;

            const btnGroup = document.createElement('div');
            btnGroup.style.cssText = `display: flex; align-items: center; gap: 12px;`;

            const backBtn = document.createElement('button');
            backBtn.className = 'mUIrbf-LgbsSe oFJeZc gp-modal-back-btn';
            backBtn.style.cssText = `
                background: transparent;
                color: #8ab4f8;
                border: 1px solid #5f6368;
                border-radius: 20px;
                padding: 0 24px;
                height: 36px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.15s, border-color 0.15s;
            `;
            backBtn.textContent = 'Back';
            backBtn.onclick = () => this.closeDragModal();

            const saveBtn = document.createElement('button');
            saveBtn.className = 'UywwFc-LgbsSe kDryjd gp-modal-save-btn';
            saveBtn.style.cssText = `
                background-color: #8ab4f8;
                color: #202124;
                border: none;
                border-radius: 20px;
                padding: 0 24px;
                height: 36px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.15s, box-shadow 0.15s;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            `;
            saveBtn.textContent = 'Save';
            saveBtn.onclick = () => this.handleSaveModalChanges();

            btnGroup.appendChild(backBtn);
            btnGroup.appendChild(saveBtn);

            footer.appendChild(statusInfo);
            footer.appendChild(btnGroup);

            dialog.appendChild(header);
            dialog.appendChild(body);
            dialog.appendChild(footer);
            overlay.appendChild(dialog);

            document.body.appendChild(overlay);
            this.modalOverlay = overlay;

            // Render photo cards into container
            this.renderModalPhotos();

            // Auto-scroll modal body to the first selected photo card if present
            setTimeout(() => {
                if (!this.modalOverlay) return;
                const firstSelected = this.modalOverlay.querySelector('.gp-modal-photo-card[data-is-selected="true"]');
                if (firstSelected) {
                    firstSelected.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 80);

            // Keyboard Escape listener
            const escListener = (e) => {
                if (e.key === 'Escape' && this.modalOverlay) {
                    this.closeDragModal();
                    window.removeEventListener('keydown', escListener);
                }
            };
            window.addEventListener('keydown', escListener);
        },

        // --- Step 4: Render Photos in Modal Grouped by Day ---
        renderModalPhotos: function () {
            const container = this.modalOverlay ? this.modalOverlay.querySelector('.gp-photos-stream-container') : null;
            if (!container) return;

            container.innerHTML = '';

            if (this.photos.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; color: #9aa0a6; padding: 40px; font-size: 14px;">
                        No photos found in this range.
                    </div>
                `;
                return;
            }

            // Group photos by day string
            const groups = new Map();
            this.photos.forEach((photo, idx) => {
                photo._index = idx;
                const dayHeader = this.formatDateHeader(photo.timestamp);
                if (!groups.has(dayHeader)) {
                    groups.set(dayHeader, []);
                }
                groups.get(dayHeader).push(photo);
            });

            // Render each date group
            groups.forEach((items, dayHeader) => {
                const groupSection = document.createElement('div');
                groupSection.className = 'gp-date-group-section';
                groupSection.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                `;

                // Date Header styled like Google's H2.ZEmz6b
                const headerEl = document.createElement('h2');
                headerEl.className = 'ZEmz6b';
                headerEl.style.cssText = `
                    font-size: 14px;
                    font-weight: 500;
                    color: #9aa0a6;
                    margin: 0;
                    padding: 4px 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                `;
                headerEl.innerHTML = `
                    <span>${dayHeader}</span>
                    <span style="font-size: 11px; opacity: 0.6;">(${items.length} ${items.length === 1 ? 'item' : 'items'})</span>
                `;
                groupSection.appendChild(headerEl);

                // Row of photo cards
                const cardGrid = document.createElement('div');
                cardGrid.className = 'gp-cards-row-grid';
                cardGrid.style.cssText = `
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    align-items: flex-start;
                `;

                items.forEach(photo => {
                    const card = this.createModalPhotoCard(photo);
                    cardGrid.appendChild(card);
                });

                groupSection.appendChild(cardGrid);
                container.appendChild(groupSection);
            });

            this.updateModifiedCounter();
            this.updateLoadButtonsVisibility();
        },

        createModalPhotoCard: function (photo) {
            const card = document.createElement('div');
            card.className = 'gp-modal-photo-card rtIMgb GQzRlf Blknbd';
            card.setAttribute('data-photo-id', photo.mediaKey);

            const isSelected = !!photo.isSelected;
            const isModified = !!photo.isModified;
            const customDateStr = this.formatCustomDate(photo.timestamp);
            const shortTimeStr = this.formatShortTime(photo.timestamp);

            card.setAttribute('data-is-selected', isSelected ? 'true' : 'false');
            if (isSelected) {
                card.setAttribute('draggable', 'true');
            } else {
                card.setAttribute('draggable', 'false');
            }

            card.style.cssText = `
                width: 146px;
                height: 138px;
                border-radius: 8px;
                overflow: hidden;
                position: relative;
                background: #28292c;
                box-sizing: border-box;
                border: 2px solid ${isModified ? '#8ab4f8' : (isSelected ? 'rgba(138, 180, 248, 0.85)' : 'rgba(255, 255, 255, 0.1)')};
                cursor: ${isSelected ? 'grab' : 'default'};
                transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                user-select: none;
                box-shadow: ${isModified ? '0 0 10px rgba(138, 180, 248, 0.5)' : (isSelected ? '0 0 8px rgba(138, 180, 248, 0.25)' : 'none')};
            `;

            // Card Inner HTML
            card.innerHTML = `
                <!-- Thumbnail Image Area -->
                <div class="gp-thumb-area" style="
                    position: absolute;
                    inset: 0;
                    background-image: url('${photo.bgUrl || ''}');
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                    z-index: 1;
                ">
                    <!-- Top Gradient for badges -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 32px; background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%);"></div>
                    <!-- Bottom Gradient for time label -->
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 48px; background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%);"></div>
                </div>

                <!-- Top Row: Selected badge & Video duration -->
                <div style="position: relative; z-index: 5; padding: 4px 6px; display: flex; align-items: center; justify-content: space-between;">
                    ${isSelected ? `
                        <span style="background: #8ab4f8; color: #202124; font-size: 9px; font-weight: bold; padding: 1px 5px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                            SELECTED
                        </span>
                    ` : `<span></span>`}

                    ${photo.isVideo ? `
                        <div class="KhS5De" style="background: rgba(0,0,0,0.65); color: #fff; font-size: 10px; padding: 2px 5px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-weight: 500;">
                            <svg width="10px" height="10px" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            <span>${photo.duration || 'VIDEO'}</span>
                        </div>
                    ` : `<span></span>`}
                </div>

                <!-- Bottom Row: Time label and editable input -->
                <div class="gp-card-bottom" style="position: relative; z-index: 5; padding: 4px 6px; display: flex; flex-direction: column; gap: 2px;">
                    ${isModified ? `
                        <div style="align-self: flex-start; background: #8ab4f8; color: #202124; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 3px; letter-spacing: 0.5px;">
                            NEW TIME
                        </div>
                    ` : ''}
                    <div class="gp-time-display" style="color: #fff; font-size: 11px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: space-between;" title="${isSelected ? 'Drag to reorder photo in time' : ''}">
                        <span>${shortTimeStr}</span>
                        ${isSelected ? `<span style="font-size: 9px; opacity: 0.7;">☰ drag</span>` : ''}
                    </div>
                    <input type="text" class="gp-inline-time-input" value="${customDateStr}" style="
                        display: none;
                        background: #202124;
                        color: #fff;
                        border: 1px solid #8ab4f8;
                        border-radius: 3px;
                        font-size: 9px;
                        font-family: monospace;
                        padding: 2px 3px;
                        width: 100%;
                        box-sizing: border-box;
                    ">
                </div>
            `;

            // Inline date editing on click
            const timeDisplay = card.querySelector('.gp-time-display');
            const timeInput = card.querySelector('.gp-inline-time-input');

            timeDisplay.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                timeDisplay.style.display = 'none';
                timeInput.style.display = 'block';
                timeInput.focus();
                timeInput.select();
            });

            timeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    timeInput.blur();
                } else if (e.key === 'Escape') {
                    timeInput.value = customDateStr;
                    timeInput.style.display = 'none';
                    timeDisplay.style.display = 'flex';
                }
            });

            timeInput.addEventListener('blur', () => {
                timeInput.style.display = 'none';
                timeDisplay.style.display = 'flex';
                const parsed = this.parseCustomDateString(timeInput.value);
                if (parsed && !isNaN(parsed.getTime())) {
                    log(`Manual time edit for photo ${photo.mediaKey}:`, this.formatCustomDate(parsed));
                    photo.timestamp = parsed;
                    photo.isModified = true;
                    this.modifiedTimestamps.set(photo.mediaKey, {
                        photo: photo,
                        oldDate: photo.originalTimestamp,
                        newDate: parsed
                    });
                    this.renderModalPhotos();
                } else {
                    timeInput.value = customDateStr;
                }
            });

            // Drag & Drop event wiring
            this.wireCardDragEvents(card, photo);

            return card;
        },

        // --- Step 5: Smooth Drag & Drop Inside Modal ---
        wireCardDragEvents: function (card, photo) {
            if (!photo.isSelected) {
                // Unselected photos cannot be dragged
                card.addEventListener('dragstart', (e) => {
                    e.preventDefault();
                    return false;
                });
            } else {
                card.addEventListener('dragstart', (e) => {
                    this.isDragging = true;
                    this.draggedPhotoId = photo.mediaKey;
                    this.dragSourceIndex = this.photos.findIndex(p => p.mediaKey === photo.mediaKey);

                    card.style.opacity = '0.35';
                    card.style.transform = 'scale(0.95)';
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', photo.mediaKey);

                    log('Drag started on card:', photo.mediaKey, 'Index:', this.dragSourceIndex);
                });

                card.addEventListener('dragend', () => {
                    card.style.opacity = '1';
                    card.style.transform = '';
                    this.cleanupDropIndicators();
                    this.isDragging = false;
                    this.draggedPhotoId = null;
                    this.dragSourceIndex = -1;
                });
            }

            // Both selected and unselected photos can receive drop events!
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (!this.isDragging || this.draggedPhotoId === photo.mediaKey) return;

                const rect = card.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                const isLeft = e.clientX < midX;

                this.showDropIndicator(card, isLeft ? 'left' : 'right');
            });

            card.addEventListener('dragleave', (e) => {
                const related = e.relatedTarget;
                if (!card.contains(related)) {
                    this.cleanupCardIndicator(card, photo);
                }
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (!this.isDragging || !this.draggedPhotoId || this.draggedPhotoId === photo.mediaKey) {
                    this.cleanupDropIndicators();
                    return;
                }

                const rect = card.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                const dropBefore = e.clientX < midX;

                log(`Dropped photo ${this.draggedPhotoId} onto target ${photo.mediaKey} (${dropBefore ? 'before' : 'after'})`);
                this.executeModalDrop(this.draggedPhotoId, photo.mediaKey, dropBefore);
                this.cleanupDropIndicators();
            });
        },

        showDropIndicator: function (card, side) {
            this.cleanupDropIndicators();
            if (side === 'left') {
                card.style.borderLeft = '4px solid #8ab4f8';
            } else {
                card.style.borderRight = '4px solid #8ab4f8';
            }
        },

        cleanupCardIndicator: function (card, photo) {
            card.style.borderLeft = '';
            card.style.borderRight = '';
            const isSelected = photo.isSelected;
            const isModified = photo.isModified;
            card.style.border = `2px solid ${isModified ? '#8ab4f8' : (isSelected ? 'rgba(138, 180, 248, 0.85)' : 'rgba(255, 255, 255, 0.1)')}`;
        },

        cleanupDropIndicators: function () {
            if (!this.modalOverlay) return;
            const cards = this.modalOverlay.querySelectorAll('.gp-modal-photo-card');
            cards.forEach(c => {
                c.style.borderLeft = '';
                c.style.borderRight = '';
            });
        },

        // --- Step 6: Execute Drop & Midpoint Timestamp Interpolation ---
        executeModalDrop: function (draggedId, targetId, dropBefore) {
            const fromIdx = this.photos.findIndex(p => p.mediaKey === draggedId);
            const targetIdx = this.photos.findIndex(p => p.mediaKey === targetId);

            if (fromIdx === -1 || targetIdx === -1) {
                warn('Could not find source or target photo in array.');
                return;
            }

            // Remove dragged photo from current position
            const [draggedPhoto] = this.photos.splice(fromIdx, 1);

            // Calculate new insertion index
            let insertIdx = this.photos.findIndex(p => p.mediaKey === targetId);
            if (!dropBefore) {
                insertIdx += 1;
            }

            // Insert dragged photo at new position
            this.photos.splice(insertIdx, 0, draggedPhoto);

            // Calculate new timestamp based on neighbors
            // Note: In our array, photos are in reverse chronological order (newest to oldest),
            // or chronologically. Let's inspect neighbor timestamps:
            const neighborPrev = (insertIdx > 0) ? this.photos[insertIdx - 1] : null;
            const neighborNext = (insertIdx < this.photos.length - 1) ? this.photos[insertIdx + 1] : null;

            let newTimestampMs;

            if (neighborPrev && neighborNext) {
                const timeA = neighborPrev.timestamp.getTime();
                const timeB = neighborNext.timestamp.getTime();
                // Midpoint between previous and next
                newTimestampMs = Math.round(timeA + (timeB - timeA) / 2);
                log(`Calculated midpoint between ${this.formatCustomDate(neighborPrev.timestamp)} and ${this.formatCustomDate(neighborNext.timestamp)}`);
            } else if (neighborNext) {
                // At very start of list: 1 minute difference in same trend direction
                const timeNext = neighborNext.timestamp.getTime();
                newTimestampMs = timeNext + 60000;
            } else if (neighborPrev) {
                // At very end of list: 1 minute difference
                const timePrev = neighborPrev.timestamp.getTime();
                newTimestampMs = timePrev - 60000;
            } else {
                newTimestampMs = Date.now();
            }

            const calculatedDate = new Date(newTimestampMs);
            draggedPhoto.timestamp = calculatedDate;
            draggedPhoto.isModified = true;

            log(`NEW TIMESTAMP FOR ${draggedPhoto.mediaKey}:`, this.formatCustomDate(calculatedDate));

            // Record in modified map
            this.modifiedTimestamps.set(draggedPhoto.mediaKey, {
                photo: draggedPhoto,
                oldDate: draggedPhoto.originalTimestamp,
                newDate: calculatedDate
            });

            // Re-render modal photo stream
            this.renderModalPhotos();
        },

        updateModifiedCounter: function () {
            if (!this.modalOverlay) return;
            const badge = this.modalOverlay.querySelector('.gp-modified-badge');
            if (badge) {
                const count = this.modifiedTimestamps.size;
                if (count > 0) {
                    badge.style.display = 'inline-block';
                    badge.textContent = `${count} modified`;
                } else {
                    badge.style.display = 'none';
                }
            }
            const countLoaded = this.modalOverlay.querySelector('.gp-count-loaded');
            if (countLoaded) {
                countLoaded.textContent = `${this.photos.length} photos loaded`;
            }
        },

        checkIfAtNewestPhotos: function () {
            if (!this.photos || this.photos.length === 0) return true;

            const isPageAtTop = (window.scrollY || document.documentElement.scrollTop || 0) <= 50;
            const allCards = Array.from(document.querySelectorAll(ALL_PHOTO_CARDS_SELECTOR));
            if (allCards.length === 0) {
                return isPageAtTop;
            }

            const firstCard = allCards[0];
            const firstCardInfo = this.extractCardInfo(firstCard, 0);

            // In our photos array (sorted newest to oldest), photos[0] is the newest photo currently in modal
            const modalNewest = this.photos[0];
            const isFirstCardInModal = modalNewest.mediaKey === firstCardInfo.mediaKey ||
                                       modalNewest.timestamp.getTime() >= firstCardInfo.timestamp.getTime();

            return isPageAtTop && isFirstCardInModal;
        },

        updateLoadButtonsVisibility: function () {
            if (!this.modalOverlay) return;
            const topLoadBtn = this.modalOverlay.querySelector('.gp-load-newer');
            const bottomLoadBtn = this.modalOverlay.querySelector('.gp-load-older');

            if (topLoadBtn) {
                const isAtNewest = this.checkIfAtNewestPhotos();
                topLoadBtn.style.display = isAtNewest ? 'none' : 'flex';
                log('Top button (load newer) visibility:', isAtNewest ? 'HIDDEN (already at newest photos)' : 'VISIBLE');
            }

            if (bottomLoadBtn) {
                bottomLoadBtn.style.display = (this.photos && this.photos.length > 0) ? 'flex' : 'none';
            }
        },

        // --- Step 7: Load More Photos (Top / Bottom) ---
        loadMorePhotos: function (direction) {
            log(`Loading more photos (${direction})...`);
            const currentKeys = new Set(this.photos.map(p => p.mediaKey));
            const allCards = Array.from(document.querySelectorAll(ALL_PHOTO_CARDS_SELECTOR));
            const allParsed = allCards.map((el, i) => this.extractCardInfo(el, i));

            let candidates = [];
            if (direction === 'newer') {
                const newestTime = this.photos.length > 0 ? this.photos[0].timestamp.getTime() : 0;
                candidates = allParsed.filter(p => !currentKeys.has(p.mediaKey) && p.timestamp.getTime() >= newestTime);
                if (candidates.length === 0) {
                    const firstModalIdx = allParsed.findIndex(p => currentKeys.has(p.mediaKey));
                    if (firstModalIdx > 0) {
                        candidates = allParsed.slice(0, firstModalIdx).filter(p => !currentKeys.has(p.mediaKey));
                    }
                }
            } else {
                const oldestTime = this.photos.length > 0 ? this.photos[this.photos.length - 1].timestamp.getTime() : Infinity;
                candidates = allParsed.filter(p => !currentKeys.has(p.mediaKey) && p.timestamp.getTime() <= oldestTime);
                if (candidates.length === 0) {
                    let lastModalIdx = -1;
                    for (let i = allParsed.length - 1; i >= 0; i--) {
                        if (currentKeys.has(allParsed[i].mediaKey)) {
                            lastModalIdx = i;
                            break;
                        }
                    }
                    if (lastModalIdx !== -1 && lastModalIdx < allParsed.length - 1) {
                        candidates = allParsed.slice(lastModalIdx + 1).filter(p => !currentKeys.has(p.mediaKey));
                    }
                }
            }

            let addedCount = 0;
            candidates.forEach(p => {
                if (!currentKeys.has(p.mediaKey)) {
                    this.photos.push(p);
                    currentKeys.add(p.mediaKey);
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                log(`Added ${addedCount} ${direction} photos from DOM.`);
                this.photos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                this.renderModalPhotos();
            } else {
                log(`No extra ${direction} cards currently in DOM. Scrolling main page to fetch more...`);
                // Scroll up for newer (-800), down for older (+800)
                const scrollDelta = (direction === 'newer') ? -800 : 800;
                window.scrollBy({ top: scrollDelta, behavior: 'smooth' });

                setTimeout(() => {
                    const freshCards = Array.from(document.querySelectorAll(ALL_PHOTO_CARDS_SELECTOR));
                    freshCards.forEach((el, i) => {
                        const info = this.extractCardInfo(el, i);
                        if (!currentKeys.has(info.mediaKey)) {
                            if (direction === 'newer' && this.photos.length > 0 && info.timestamp.getTime() < this.photos[0].timestamp.getTime()) {
                                return;
                            }
                            if (direction === 'older' && this.photos.length > 0 && info.timestamp.getTime() > this.photos[this.photos.length - 1].timestamp.getTime()) {
                                return;
                            }
                            this.photos.push(info);
                            currentKeys.add(info.mediaKey);
                            addedCount++;
                        }
                    });
                    log(`After scroll: added ${addedCount} more photos.`);
                    this.photos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                    this.renderModalPhotos();
                }, 600);
            }
        },

        // --- Step 8: Save Changes via Google Photos API / Batch Handler ---
        handleSaveModalChanges: function () {
            log('====================================================');
            log(`SAVING CHANGES FOR ${this.modifiedTimestamps.size} MODIFIED PHOTOS`);

            if (this.modifiedTimestamps.size === 0) {
                alert('Немає змінених дат для збереження. Перетягніть фотографії, щоб змінити їхній час.');
                return;
            }

            this.showConfirmationModal();
        },

        formatDateDiff: function (oldDate, newDate) {
            const pad = (n) => String(n).padStart(2, '0');

            const oY = oldDate.getFullYear();
            const oM = oldDate.getMonth() + 1;
            const oD = oldDate.getDate();
            const oH = oldDate.getHours();
            const oMin = oldDate.getMinutes();
            const oS = oldDate.getSeconds();

            const nY = newDate.getFullYear();
            const nM = newDate.getMonth() + 1;
            const nD = newDate.getDate();
            const nH = newDate.getHours();
            const nMin = newDate.getMinutes();
            const nS = newDate.getSeconds();

            const diffY = oY !== nY;
            const diffM = oM !== nM;
            const diffD = oD !== nD;
            const diffH = oH !== nH;
            const diffMin = oMin !== nMin;
            const diffS = oS !== nS;

            const wrapOld = (val, isDiff) => isDiff
                ? `<strong style="font-weight: 800; color: #f28b82;">${val}</strong>`
                : `<span style="color: #9aa0a6; font-weight: 400;">${val}</span>`;

            const wrapNew = (val, isDiff) => isDiff
                ? `<strong style="font-weight: 800; color: #8ab4f8;">${val}</strong>`
                : `<span style="color: #9aa0a6; font-weight: 400;">${val}</span>`;

            const oldStr = `${wrapOld(oY, diffY)}.${wrapOld(pad(oM), diffM)}.${wrapOld(pad(oD), diffD)} ${wrapOld(pad(oH), diffH)}:${wrapOld(pad(oMin), diffMin)}:${wrapOld(pad(oS), diffS)}`;
            const newStr = `${wrapNew(nY, diffY)}.${wrapNew(pad(nM), diffM)}.${wrapNew(pad(nD), diffD)} ${wrapNew(pad(nH), diffH)}:${wrapNew(pad(nMin), diffMin)}:${wrapNew(pad(nS), diffS)}`;

            return {
                oldHtml: oldStr,
                newHtml: newStr
            };
        },

        showConfirmationModal: function () {
            // Remove any existing confirm dialog
            const existing = document.querySelector('.gp-confirm-dialog-overlay');
            if (existing) existing.remove();

            const confirmOverlay = document.createElement('div');
            confirmOverlay.className = 'gp-confirm-dialog-overlay';
            confirmOverlay.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.75);
                z-index: 1000002;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(5px);
                font-family: 'Google Sans', Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
                animation: gpFadeIn 0.2s ease-out;
            `;

            const dialog = document.createElement('div');
            dialog.className = 'gp-confirm-dialog-box';
            dialog.style.cssText = `
                background: #202124;
                color: #e8eaed;
                width: 660px;
                max-width: 95vw;
                max-height: 85vh;
                border-radius: 24px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.1);
                overflow: hidden;
            `;

            // 1. Header
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 24px 24px 16px 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            `;
            header.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="background: rgba(138, 180, 248, 0.15); width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #8ab4f8; flex-shrink: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                        </svg>
                    </div>
                    <div>
                        <h2 style="margin: 0; font-size: 18px; font-weight: 500; color: #ffffff;">Чи ви впевнені, що хочете змінити дати цих медіа?</h2>
                        <div style="font-size: 13px; color: #9aa0a6; margin-top: 4px;">
                            Буде оновлено <b>${this.modifiedTimestamps.size}</b> елемент(ів). Після підтвердження зміни буде надіслано в Google Photos, а сторінка автоматично перезавантажиться.
                        </div>
                    </div>
                </div>
            `;

            // 2. Content
            const content = document.createElement('div');
            content.style.cssText = `
                padding: 16px 24px;
                overflow-y: auto;
                max-height: 52vh;
                display: flex;
                flex-direction: column;
                gap: 12px;
            `;

            const tableContainer = document.createElement('div');
            tableContainer.style.cssText = `
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                background: #17181b;
                overflow: hidden;
            `;

            const table = document.createElement('table');
            table.style.cssText = `
                width: 100%;
                border-collapse: collapse;
                text-align: left;
            `;

            table.innerHTML = `
                <thead>
                    <tr style="background: rgba(255, 255, 255, 0.04); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                        <th style="padding: 10px 14px; font-size: 11px; font-weight: 600; color: #9aa0a6; text-transform: uppercase; letter-spacing: 0.5px; width: 68px;">Прев'ю</th>
                        <th style="padding: 10px 14px; font-size: 11px; font-weight: 600; color: #9aa0a6; text-transform: uppercase; letter-spacing: 0.5px;">Стара дата та час ➔ Нові дата та час</th>
                    </tr>
                </thead>
                <tbody class="gp-confirm-table-body"></tbody>
            `;

            const tbody = table.querySelector('.gp-confirm-table-body');

            this.modifiedTimestamps.forEach(({ photo, oldDate, newDate }, key) => {
                const diff = this.formatDateDiff(oldDate, newDate);

                const row = document.createElement('tr');
                row.style.cssText = `
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    transition: background-color 0.15s;
                `;
                row.onmouseenter = () => { row.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; };
                row.onmouseleave = () => { row.style.backgroundColor = 'transparent'; };

                // Thumbnail cell
                const tdThumb = document.createElement('td');
                tdThumb.style.cssText = `padding: 10px 14px; vertical-align: middle;`;

                const thumbBox = document.createElement('div');
                thumbBox.style.cssText = `
                    width: 54px;
                    height: 54px;
                    border-radius: 8px;
                    background: #2d2e31;
                    overflow: hidden;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                `;

                if (photo.bgUrl) {
                    thumbBox.innerHTML = `
                        <img src="${photo.bgUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="preview" />
                    `;
                } else {
                    thumbBox.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#9aa0a6">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                        </svg>
                    `;
                }

                if (photo.isVideo) {
                    const videoTag = document.createElement('div');
                    videoTag.style.cssText = `
                        position: absolute;
                        bottom: 2px;
                        left: 2px;
                        background: rgba(0,0,0,0.7);
                        color: #ffffff;
                        font-size: 9px;
                        padding: 1px 4px;
                        border-radius: 3px;
                        display: flex;
                        align-items: center;
                        gap: 2px;
                    `;
                    videoTag.innerHTML = `
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        <span>${photo.duration || 'VIDEO'}</span>
                    `;
                    thumbBox.appendChild(videoTag);
                }

                tdThumb.appendChild(thumbBox);

                // Date comparison cell
                const tdDates = document.createElement('td');
                tdDates.style.cssText = `padding: 10px 14px; vertical-align: middle;`;

                tdDates.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 6px 10px; font-family: 'Roboto Mono', monospace, sans-serif; font-size: 13px; display: inline-flex; align-items: center;">
                            ${diff.oldHtml}
                        </div>
                        <span style="color: #8ab4f8; font-size: 14px; font-weight: bold; flex-shrink: 0;">➔</span>
                        <div style="background: rgba(138, 180, 248, 0.08); border: 1px solid rgba(138, 180, 248, 0.25); border-radius: 6px; padding: 6px 10px; font-family: 'Roboto Mono', monospace, sans-serif; font-size: 13px; display: inline-flex; align-items: center;">
                            ${diff.newHtml}
                        </div>
                    </div>
                `;

                row.appendChild(tdThumb);
                row.appendChild(tdDates);
                tbody.appendChild(row);
            });

            tableContainer.appendChild(table);
            content.appendChild(tableContainer);

            // Error banner placeholder
            const errorBanner = document.createElement('div');
            errorBanner.className = 'gp-confirm-error-banner';
            errorBanner.style.cssText = `
                display: none;
                margin-top: 10px;
                padding: 10px 14px;
                background: rgba(234, 67, 53, 0.15);
                border: 1px solid rgba(234, 67, 53, 0.4);
                border-radius: 8px;
                color: #f28b82;
                font-size: 13px;
                line-height: 1.4;
            `;
            content.appendChild(errorBanner);

            // 3. Footer
            const footer = document.createElement('div');
            footer.style.cssText = `
                padding: 16px 24px;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                background: #202124;
            `;

            const cancelBtn = document.createElement('button');
            cancelBtn.style.cssText = `
                background: transparent;
                color: #8ab4f8;
                border: 1px solid #5f6368;
                border-radius: 20px;
                padding: 0 20px;
                height: 36px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.15s;
            `;
            cancelBtn.textContent = 'Скасувати';
            cancelBtn.onmouseenter = () => { cancelBtn.style.backgroundColor = 'rgba(138, 180, 248, 0.08)'; };
            cancelBtn.onmouseleave = () => { cancelBtn.style.backgroundColor = 'transparent'; };
            cancelBtn.onclick = () => {
                confirmOverlay.remove();
            };

            const confirmBtn = document.createElement('button');
            confirmBtn.style.cssText = `
                background-color: #8ab4f8;
                color: #202124;
                border: none;
                border-radius: 20px;
                padding: 0 24px;
                height: 36px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                transition: background-color 0.15s, box-shadow 0.15s;
            `;
            confirmBtn.textContent = 'Підтвердити';
            confirmBtn.onmouseenter = () => { confirmBtn.style.backgroundColor = '#aecbfa'; };
            confirmBtn.onmouseleave = () => { confirmBtn.style.backgroundColor = '#8ab4f8'; };

            confirmBtn.onclick = async () => {
                confirmBtn.disabled = true;
                cancelBtn.disabled = true;
                confirmBtn.style.opacity = '0.7';
                cancelBtn.style.opacity = '0.5';
                confirmBtn.style.cursor = 'not-allowed';
                confirmBtn.textContent = 'Збереження в Google Photos...';
                errorBanner.style.display = 'none';

                try {
                    await this.applyBatchDateChanges(this.modifiedTimestamps);

                    confirmBtn.style.backgroundColor = '#81c995';
                    confirmBtn.textContent = '✓ Збережено! Оновлюємо сторінку...';
                    log('Date update successfully applied. Reloading page in 800ms...');

                    setTimeout(() => {
                        window.location.reload();
                    }, 800);
                } catch (err) {
                    error('Failed to apply date changes:', err);
                    confirmBtn.disabled = false;
                    cancelBtn.disabled = false;
                    confirmBtn.style.opacity = '1';
                    cancelBtn.style.opacity = '1';
                    confirmBtn.style.cursor = 'pointer';
                    confirmBtn.textContent = 'Спробувати знову';

                    errorBanner.textContent = `Помилка збереження: ${err.message || err}`;
                    errorBanner.style.display = 'block';
                }
            };

            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);

            dialog.appendChild(header);
            dialog.appendChild(content);
            dialog.appendChild(footer);
            confirmOverlay.appendChild(dialog);

            // Backdrop click closes dialog if not busy
            confirmOverlay.addEventListener('click', (e) => {
                if (e.target === confirmOverlay && !confirmBtn.disabled) {
                    confirmOverlay.remove();
                }
            });

            document.body.appendChild(confirmOverlay);
        },

        getWizGlobalData: function () {
            if (this._cachedWizData && this._cachedWizData.at) {
                return this._cachedWizData;
            }

            let at = '', fsid = '', bl = '', path = '/_/PhotosUi/', account = '';

            // Method 1: Execute inline script in page context to grab window.WIZ_global_data
            try {
                const nonceEl = document.querySelector('script[nonce]');
                const nonce = nonceEl ? nonceEl.getAttribute('nonce') : '';
                const script = document.createElement('script');
                if (nonce) script.setAttribute('nonce', nonce);
                script.textContent = `
                    (function() {
                        try {
                            const w = window.WIZ_global_data || {};
                            const data = {
                                at: w.SNlM0e || '',
                                fsid: w.FdrFJe || '',
                                bl: w.cfb2h || '',
                                path: w.eptZe || '/_/PhotosUi/',
                                account: w.oPEP7c || ''
                            };
                            document.documentElement.setAttribute('data-gp-wiz', JSON.stringify(data));
                        } catch (e) {}
                    })();
                `;
                (document.head || document.documentElement).appendChild(script);
                script.remove();

                const attr = document.documentElement.getAttribute('data-gp-wiz');
                if (attr) {
                    document.documentElement.removeAttribute('data-gp-wiz');
                    const parsed = JSON.parse(attr);
                    if (parsed && parsed.at) {
                        this._cachedWizData = parsed;
                        return parsed;
                    }
                }
            } catch (e) {
                warn('DOM script bridge for WIZ_global_data threw:', e);
            }

            // Method 2: Scan DOM script tags for WIZ_global_data JSON
            try {
                const scripts = document.querySelectorAll('script');
                for (const s of scripts) {
                    const content = s.textContent || '';
                    if (content.includes('WIZ_global_data') || content.includes('SNlM0e')) {
                        const atMatch = content.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
                        const fsidMatch = content.match(/"FdrFJe"\s*:\s*"([^"]+)"/);
                        const blMatch = content.match(/"cfb2h"\s*:\s*"([^"]+)"/);
                        const pathMatch = content.match(/"eptZe"\s*:\s*"([^"]+)"/);
                        const accMatch = content.match(/"oPEP7c"\s*:\s*"([^"]+)"/);

                        if (atMatch) at = atMatch[1];
                        if (fsidMatch) fsid = fsidMatch[1];
                        if (blMatch) bl = blMatch[1];
                        if (pathMatch) path = pathMatch[1];
                        if (accMatch) account = accMatch[1];

                        if (at) break;
                    }
                }
            } catch (e) {
                warn('Script tag regex search for WIZ_global_data threw:', e);
            }

            const res = { at, fsid, bl, path, account };
            if (at) {
                this._cachedWizData = res;
            }
            return res;
        },

        makeApiRequest: async function (rpcid, requestData, wizData) {
            const wrappedData = [[[rpcid, JSON.stringify(requestData), null, 'generic']]];
            const requestDataString = `f.req=${encodeURIComponent(JSON.stringify(wrappedData))}&at=${encodeURIComponent(wizData.at)}&`;
            const params = {
                rpcids: rpcid,
                'source-path': window.location.pathname,
                'f.sid': wizData.fsid || '',
                bl: wizData.bl || '',
                pageId: 'none',
                rt: 'c',
            };
            const paramsString = Object.keys(params)
                .map((key) => `${key}=${encodeURIComponent(params[key])}`)
                .join('&');
            const basePath = wizData.path || '/_/PhotosUi/';
            const url = `https://photos.google.com${basePath}data/batchexecute?${paramsString}`;

            log(`Making batchexecute RPC request [${rpcid}] to ${url}...`);

            const response = await fetch(url, {
                headers: {
                    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                body: requestDataString,
                method: 'POST',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status} ${response.statusText}`);
            }

            const responseBody = await response.text();
            if (!responseBody) {
                throw new Error('Empty response body from Google Photos server');
            }

            const jsonLines = responseBody.split('\n').filter((line) => line.includes('wrb.fr'));
            if (jsonLines.length === 0) {
                return null;
            }

            try {
                const parsedData = JSON.parse(jsonLines[0]);
                if (parsedData?.[0]?.[2]) {
                    return JSON.parse(parsedData[0][2]);
                }
            } catch (e) {
                warn(`Could not parse JSON payload from response line for [${rpcid}]:`, e);
            }
            return null;
        },

        applyBatchDateChanges: async function (modifiedMap) {
            log('Executing batch date update handler for modified photos...');
            const wizData = this.getWizGlobalData();

            if (!wizData || !wizData.at) {
                throw new Error('Google Photos session token (XSRF / SNlM0e) not found. Please ensure you are logged into Google Photos.');
            }

            log(`Session tokens detected: XSRF Token: Present, Session: ${wizData.fsid ? 'Present' : 'None'}`);

            // Prepare items for DaSgWe RPC
            // Format: [ [dedupKey, timestampSec, timezoneSec], ... ]
            const updateItems = [];

            for (let [key, { photo, newDate }] of modifiedMap.entries()) {
                log(`Preparing photo ${key} for date update to ${newDate.toISOString()} (${newDate.getTime()})`);

                let dedupKey = key;
                let tzSec = -Math.floor(new Date().getTimezoneOffset() * 60);

                // Try to resolve dedupKey and original timezoneOffset from Google Photos via VrseUb
                try {
                    const itemInfo = await this.makeApiRequest('VrseUb', [key, null, null, null, null], wizData);
                    if (itemInfo && itemInfo[0]) {
                        if (itemInfo[0][3]) {
                            dedupKey = itemInfo[0][3];
                            log(`Resolved dedupKey for ${key} -> ${dedupKey}`);
                        }
                        if (typeof itemInfo[0][4] === 'number') {
                            tzSec = Math.floor(itemInfo[0][4] / 1000);
                            log(`Resolved timezoneSec for ${key} -> ${tzSec}`);
                        }
                    }
                } catch (err) {
                    warn(`VrseUb info lookup for ${key} failed, falling back to mediaKey:`, err);
                }

                const timestampSec = Math.floor(newDate.getTime() / 1000);
                updateItems.push([dedupKey, timestampSec, tzSec]);
            }

            log(`Sending DaSgWe RPC with ${updateItems.length} items:`, updateItems);
            const requestData = [updateItems];
            await this.makeApiRequest('DaSgWe', requestData, wizData);

            log('DaSgWe RPC call completed successfully!');
            return true;
        }
    };

    window.TimTools.Modules.DragInTime = DragInTime;
    log('Module registered under window.TimTools.Modules.DragInTime');
})();
