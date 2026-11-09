window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
    const logger = window.TimTools.Logger ? window.TimTools.Logger.create('DragInTime') : {
        log: (...args) => console.log('[GP-TimTools][DragInTime]', ...args),
        warn: (...args) => console.warn('[GP-TimTools][DragInTime]', ...args),
        error: (...args) => console.error('[GP-TimTools][DragInTime]', ...args)
    };

    function log(...args) {
        logger.log(...args);
    }

    function warn(...args) {
        logger.warn(...args);
    }

    function error(...args) {
        logger.error(...args);
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
        showFilenames: false,
        isSquareAspect: true,
        filenameCache: new Map(), // mediaKey -> filename
        albumPhotoKeys: new Set(),
        albumDedupKeys: new Set(),
        isDragging: false,
        draggedPhotoId: null,
        dragSourceIndex: -1,
        activeDropTarget: null,
        highlightedCards: [],
        lastIndicatorCard: null,
        lastIndicatorSide: null,

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
                const isDarkTheme = window.TimTools.Theme ? window.TimTools.Theme.isDark() : false;
                newOption.style.backgroundColor = isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
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
            const selectedElements = Array.from(document.querySelectorAll(SELECTED_PHOTO_SELECTOR + ', div.rtIMgb [role="checkbox"][aria-checked="true"]'));
            const uniqueCards = Array.from(new Set(selectedElements.map(el => el.closest('div.rtIMgb') || el)));
            log(`Found ${uniqueCards.length} selected DOM cards on main page.`);
            uniqueCards.forEach((card, i) => {
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
                // 1. Strip media type and orientation prefix
                let clean = text.replace(/^[^\w\dа-яА-ЯіІїЇєЄ]*(?:Photo|Світлина|Фотография|Фото|Video|Відео|Видео)\s*[-–—−]\s*(?:Landscape|Portrait|Square|Портрет|Пейзаж|Панорама|Альбом)?\s*[-–—−]?\s*/iu, '').trim();
                clean = clean.replace(/^[^\w\dа-яА-ЯіІїЇєЄ]*(?:Photo|Світлина|Фотография|Фото|Video|Відео|Видео)\s+/iu, '').trim();

                // Strip leading day-of-week if present (e.g. "середа, ", "Wed, ")
                clean = clean.replace(/^(?:пн|вт|ср|чт|пт|сб|нд|понеділок|вівторок|середа|четвер|п['ʼ`]ятниця|субота|неділя|mon|tue|wed|thu|fri|sat|sun)[\.,\s–—\-]+/iu, '').trim();

                let hours = 12, minutes = 0, seconds = 0;
                const timeMatch = clean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|дп|пп)?/iu);
                if (timeMatch) {
                    hours = parseInt(timeMatch[1], 10);
                    minutes = parseInt(timeMatch[2], 10);
                    seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
                    const meridiem = (timeMatch[4] || '').toUpperCase();
                    if ((meridiem === 'PM' || meridiem === 'ПП') && hours < 12) hours += 12;
                    if ((meridiem === 'AM' || meridiem === 'ДП') && hours === 12) hours = 0;
                }

                // Check for Today / Yesterday
                const isToday = /^(?:today|сьогодні|сегодня)/iu.test(clean);
                const isYesterday = /^(?:yesterday|вчора|вчера)/iu.test(clean);
                if (isToday || isYesterday) {
                    let d = new Date();
                    if (isYesterday) d.setDate(d.getDate() - 1);
                    d.setHours(hours, minutes, seconds, 0);
                    return d;
                }

                // Month dictionary mapping all prefixes to month 0..11
                const monthMap = {
                    // UA
                    'січ': 0, 'лют': 1, 'бер': 2, 'кві': 3, 'тра': 4, 'чер': 5,
                    'лип': 6, 'сер': 7, 'вер': 8, 'жов': 9, 'лис': 10, 'гру': 11,
                    // RU
                    'янв': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'май': 4, 'мая': 4, 'июн': 5,
                    'июл': 6, 'авг': 7, 'сен': 8, 'окт': 9, 'ноя': 10, 'дек': 11,
                    // EN
                    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                };

                const findMonth = (str) => {
                    if (!str) return -1;
                    const s = str.trim().toLowerCase();
                    for (const [key, val] of Object.entries(monthMap)) {
                        if (s.startsWith(key)) return val;
                    }
                    return -1;
                };

                // Pattern A: Day Month Year (e.g. "12 трав. 2024 р." or "12 мая 2024 г." or "12 May 2024")
                const dayMonthYearMatch = clean.match(/(\d{1,2})\s+([а-яА-ЯіІїЇєЄa-zA-Z]+)\.?\s+(\d{4})/iu);
                if (dayMonthYearMatch) {
                    const day = parseInt(dayMonthYearMatch[1], 10);
                    const month = findMonth(dayMonthYearMatch[2]);
                    const year = parseInt(dayMonthYearMatch[3], 10);
                    if (month !== -1) {
                        return new Date(year, month, day, hours, minutes, seconds);
                    }
                }

                // Pattern B: Month Day, Year (e.g. "May 12, 2024" or "травня 12, 2024")
                const monthDayYearMatch = clean.match(/([а-яА-ЯіІїЇєЄa-zA-Z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/iu);
                if (monthDayYearMatch) {
                    const month = findMonth(monthDayYearMatch[1]);
                    const day = parseInt(monthDayYearMatch[2], 10);
                    const year = parseInt(monthDayYearMatch[3], 10);
                    if (month !== -1) {
                        return new Date(year, month, day, hours, minutes, seconds);
                    }
                }

                // Pattern C: Numeric format YYYY.MM.DD or YYYY-MM-DD
                const numericMatch = clean.match(/(\d{4})[\.\/\-](\d{1,2})[\.\/\-](\d{1,2})/);
                if (numericMatch) {
                    const year = parseInt(numericMatch[1], 10);
                    const month = parseInt(numericMatch[2], 10) - 1;
                    const day = parseInt(numericMatch[3], 10);
                    return new Date(year, month, day, hours, minutes, seconds);
                }

                // Pattern D: Day Month without year (e.g. "12 трав." or "May 12")
                const dayMonthNoYearMatch = clean.match(/(\d{1,2})\s+([а-яА-ЯіІїЇєЄa-zA-Z]+)/iu);
                if (dayMonthNoYearMatch) {
                    const day = parseInt(dayMonthNoYearMatch[1], 10);
                    const month = findMonth(dayMonthNoYearMatch[2]);
                    if (month !== -1) {
                        return new Date(new Date().getFullYear(), month, day, hours, minutes, seconds);
                    }
                }

                // Pattern E: Standard English JS Date
                const cleanedDateStr = clean.replace(/[рг]\./iu, '').trim();
                const nativeDate = new Date(cleanedDateStr);
                if (!isNaN(nativeDate.getTime())) {
                    return nativeDate;
                }
            } catch (err) {}
            return null;
        },

        formatDateHeader: function (date) {
            if (!date || isNaN(date.getTime())) return 'Unknown Date';
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            try {
                return date.toLocaleDateString('en-US', options);
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

        formatTimezoneString: function (date) {
            if (!date || isNaN(date.getTime())) return 'GMT';
            const offsetMin = -date.getTimezoneOffset();
            const offsetHours = offsetMin / 60;
            const sign = offsetHours >= 0 ? '+' : '';
            return `GMT${sign}${offsetHours % 1 === 0 ? offsetHours : offsetHours.toFixed(1)}`;
        },

        formatDateDisplay: function (date) {
            if (!date || isNaN(date.getTime())) return '';
            return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
        },

        parseManualInputs: function (dateStr, timeStr, tzStr) {
            if (!dateStr || !timeStr) return null;
            let year, month, day;
            const dotMatch = dateStr.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
            const isoMatch = dateStr.trim().match(/^(\d{4})[-\.](\d{1,2})[-\.](\d{1,2})$/);
            if (dotMatch) {
                day = parseInt(dotMatch[1], 10);
                month = parseInt(dotMatch[2], 10) - 1;
                year = parseInt(dotMatch[3], 10);
            } else if (isoMatch) {
                year = parseInt(isoMatch[1], 10);
                month = parseInt(isoMatch[2], 10) - 1;
                day = parseInt(isoMatch[3], 10);
            } else {
                return null;
            }

            let hours = 12, minutes = 0, seconds = 0;
            const timeMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
            if (timeMatch) {
                hours = parseInt(timeMatch[1], 10);
                minutes = parseInt(timeMatch[2], 10);
                if (timeMatch[3]) seconds = parseInt(timeMatch[3], 10);
            } else {
                return null;
            }

            const d = new Date(year, month, day, hours, minutes, seconds);
            return isNaN(d.getTime()) ? null : d;
        },

        extractFilename: function (ariaLabel, cardEl) {
            if (!ariaLabel && !cardEl) return '';

            // 1. Check aria-label for explicit filename with extension
            const extMatch = ariaLabel ? ariaLabel.match(/\b([a-zA-Z0-9_\-\.\(\)]+\.(?:jpe?g|png|webp|heic|mp4|mov|avi|mkv|3gp|gif|dng|raw|tiff|bmp))\b/i) : null;
            if (extMatch) return extMatch[1];

            // 2. Check camera pattern names in aria-label (e.g. IMG_20240515_142205 or PXL_... or DSC...)
            const camMatch = ariaLabel ? ariaLabel.match(/\b((?:IMG|PXL|VID|DSC|SAM|MVI|MOV|PIC|DCIM|Screenshot|Screen)[_\-\d][a-zA-Z0-9_\-\.\(\)]*)\b/i) : null;
            if (camMatch) return camMatch[1];

            // 3. Check img alt or title in card
            if (cardEl) {
                const img = cardEl.querySelector('img');
                if (img) {
                    const alt = img.getAttribute('alt') || '';
                    const altMatch = alt.match(/\b([a-zA-Z0-9_\-\.\(\)]+\.(?:jpe?g|png|webp|heic|mp4|mov|avi|mkv|3gp|gif|dng|raw))\b/i);
                    if (altMatch) return altMatch[1];

                    const imgTitle = img.getAttribute('title') || '';
                    const titleMatch = imgTitle.match(/\b([a-zA-Z0-9_\-\.\(\)]+\.(?:jpe?g|png|webp|heic|mp4|mov|avi|mkv|3gp|gif|dng|raw))\b/i);
                    if (titleMatch) return titleMatch[1];
                }

                // 4. Check card or link title
                const title = cardEl.getAttribute('title') || (cardEl.querySelector('a') ? cardEl.querySelector('a').getAttribute('title') : '');
                if (title) {
                    const tMatch = title.match(/\b([a-zA-Z0-9_\-\.\(\)]+\.(?:jpe?g|png|webp|heic|mp4|mov|avi|mkv|3gp|gif|dng|raw))\b/i);
                    if (tMatch) return tMatch[1];
                }
            }

            return '';
        },

        extractCardInfo: function (cardEl, index) {
            const linkEl = cardEl.querySelector('a');
            const ariaLabel = linkEl ? linkEl.getAttribute('aria-label') : (cardEl.getAttribute('aria-label') || '');
            let parsedDate = this.parseDateFromAriaLabel(ariaLabel);
            if (!parsedDate) {
                // Sibling fallback: look at nearby cards to preserve chronology instead of jumping to 2026
                if (cardEl) {
                    let sibling = cardEl.previousElementSibling || cardEl.nextElementSibling;
                    while (sibling && !parsedDate) {
                        const sLabel = sibling.querySelector('a')?.getAttribute('aria-label') || sibling.getAttribute('aria-label') || '';
                        parsedDate = this.parseDateFromAriaLabel(sLabel);
                        sibling = sibling.previousElementSibling || sibling.nextElementSibling;
                    }
                }
                if (!parsedDate) {
                    if (this.photos && this.photos.length > 0) {
                        parsedDate = new Date(this.photos[this.photos.length - 1].timestamp.getTime() - (index + 1) * 60000);
                    } else {
                        parsedDate = new Date(Date.now() - (index + 1) * 60000);
                    }
                }
            }

            // Extract media key:
            let mediaKey = '';
            const currentAlbumMatch = window.location.href.match(/\/(?:album|share)\/(AF1Qip[a-zA-Z0-9_\-]{20,})/i);
            const currentAlbumKey = currentAlbumMatch ? currentAlbumMatch[1] : null;

            // 1. Direct photo URL (/photo/AF1Q...) from link
            const link = cardEl.matches('a') ? cardEl : (cardEl.querySelector('a') || cardEl.closest('a'));
            const linkHref = link ? (link.getAttribute('href') || link.href || '') : '';
            const photoUrlMatch = linkHref.match(/\/photo\/(AF1Qip[a-zA-Z0-9_\-]{20,})/i);
            if (photoUrlMatch && photoUrlMatch[1] !== currentAlbumKey) {
                mediaKey = photoUrlMatch[1];
            }

            // 2. Scan card outerHTML for any AF1Qip keys that are NOT the album key
            if (!mediaKey) {
                const cardHtml = cardEl.outerHTML || '';
                const allAf1qMatches = Array.from(cardHtml.matchAll(/AF1Qip[a-zA-Z0-9_\-]{25,}/gi), m => m[0]);
                const validPhotoKeys = allAf1qMatches.filter(k => k !== currentAlbumKey);
                if (validPhotoKeys.length > 0) {
                    mediaKey = validPhotoKeys[0];
                }
            }

            // 3. Data attributes: data-id, data-media-key, data-guid
            if (!mediaKey) {
                const dataId = cardEl.getAttribute('data-id') || cardEl.getAttribute('data-media-key') || cardEl.getAttribute('data-guid');
                if (dataId && dataId !== currentAlbumKey && !dataId.includes('photo_')) {
                    mediaKey = dataId;
                }
            }

            // 4. jslog item key: 1:AF1Q...
            if (!mediaKey) {
                const jslog = cardEl.getAttribute('jslog') || (link ? link.getAttribute('jslog') : '');
                const itemMkMatch = jslog ? jslog.match(/1:(AF1Qip[a-zA-Z0-9_\-]{20,})/i) : null;
                if (itemMkMatch && itemMkMatch[1] !== currentAlbumKey) {
                    mediaKey = itemMkMatch[1];
                }
            }

            // 5. Fallback URL segment
            if (!mediaKey && linkHref) {
                const cleanHref = linkHref.split('?')[0].split('#')[0];
                const urlParts = cleanHref.split('/');
                const lastPart = urlParts[urlParts.length - 1];
                if (lastPart && lastPart !== currentAlbumKey && !lastPart.includes('album')) {
                    mediaKey = lastPart;
                }
            }

            if (!mediaKey) {
                mediaKey = `photo_${index}_${parsedDate ? parsedDate.getTime() : Date.now()}`;
            }

            // Extract filename from cache or DOM
            let filename = this.filenameCache.get(mediaKey) || this.extractFilename(ariaLabel, cardEl);
            if (filename) {
                this.filenameCache.set(mediaKey, filename);
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
                if (img) {
                    bgUrl = img.getAttribute('src') || img.src || '';
                    if (bgUrl.startsWith('data:') || !bgUrl) {
                        bgUrl = img.getAttribute('data-src') || img.getAttribute('data-latest-bg') || '';
                    }
                    if (!bgUrl && img.getAttribute('srcset')) {
                        const srcMatch = img.getAttribute('srcset').match(/(https?:\/\/[^\s,]+)/);
                        if (srcMatch) bgUrl = srcMatch[1];
                    }
                    if (!bgUrl && img.currentSrc && !img.currentSrc.startsWith('data:')) {
                        bgUrl = img.currentSrc;
                    }
                }
            }

            // Video info
            let isVideo = false;
            let duration = '';

            const durationEl = cardEl.querySelector('.KhS5De');
            if (durationEl) {
                const text = durationEl.textContent.trim();
                const durMatch = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
                if (durMatch) {
                    isVideo = true;
                    duration = durMatch[1];
                }
            }

            if (/^(video|відео|видео)\b/i.test(ariaLabel) || cardEl.classList.contains('e37Orb')) {
                isVideo = true;
                if (!duration) {
                    const durMatch = ariaLabel.match(/(?:duration|тривалість|длительность)\s*[:\-–]?\s*(\d{1,2}:\d{2}(?::\d{2})?)/i);
                    if (durMatch) duration = durMatch[1];
                }
            }

            if (!isVideo) {
                const playSvg = cardEl.querySelector('svg path[d*="8 5v14l11-7"], svg path[d*="M8 5v14l11-7z"]');
                if (playSvg) {
                    isVideo = true;
                }
            }

            // Final sanity clean: ensure duration has no extra text like "Duration 0:08"
            if (duration) {
                const cleanMatch = duration.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
                if (cleanMatch) duration = cleanMatch[1];
            }

            if (!filename && isVideo) {
                const vMatch = ariaLabel.match(/\b([a-zA-Z0-9_\-\.]+\.(?:mp4|mov|avi|mkv|3gp))\b/i);
                if (vMatch) {
                    filename = vMatch[1];
                    this.filenameCache.set(mediaKey, filename);
                }
            }

            // Aspect ratio calculation (safe, no synchronous layout reflow)
            let aspectRatio = isVideo ? (16 / 9) : 1;
            if (cardEl) {
                const img = cardEl.querySelector('img');
                if (img && img.naturalWidth && img.naturalHeight) {
                    aspectRatio = img.naturalWidth / img.naturalHeight;
                } else if (cardEl.style && cardEl.style.width && cardEl.style.height) {
                    const sw = parseFloat(cardEl.style.width);
                    const sh = parseFloat(cardEl.style.height);
                    if (sw > 0 && sh > 0) aspectRatio = sw / sh;
                }
            }

            const isSelected = cardEl.classList.contains('R1sU4e') ||
                               (this.selectedMediaKeys && this.selectedMediaKeys.has(mediaKey)) ||
                               (cardEl.querySelector('[role="checkbox"]') && cardEl.querySelector('[role="checkbox"]').getAttribute('aria-checked') === 'true') ||
                               cardEl.querySelector('[aria-checked="true"]') !== null;

            return {
                id: mediaKey,
                mediaKey: mediaKey,
                filename: filename,
                aspectRatio: aspectRatio || 1,
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

            // Ensure all selected photos are guaranteed to be in the filtered list
            selectedPhotos.forEach(sp => {
                if (!filtered.some(p => p.mediaKey === sp.mediaKey)) {
                    filtered.push(sp);
                }
            });

            // Sort chronologically (earliest to latest or latest to earliest matching Google Photos order)
            // In Google Photos, photostream starts from newest at top down to oldest.
            filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            return filtered;
        },

        // --- Step 3: Open Google-styled Modal Window ---
        openDragModal: async function () {
            if (this.modalOverlay) {
                this.closeDragModal();
            }

            const initialPhotos = this.collectPhotosForModal();
            this.modifiedTimestamps.clear();
            this.hasReachedOldestEnd = false;
            this.hasReachedNewestEnd = false;
            this.newerSearchStepDays = 30;
            this.isAlbumContextMode = false;
            this.libraryNextPageOlderToken = null;

            log(`Initial scan: found ${initialPhotos.length} photos in DOM.`);

            const isAlbum = /\/(?:u\/\d+\/)?(album|share)\//i.test(window.location.href);
            const allSelected = initialPhotos.length > 0 && initialPhotos.every(p => p.isSelected);

            this.photos = initialPhotos;
            log(`Opening modal with ${this.photos.length} photos. Mode: ${isAlbum ? 'Album' : 'Main Stream'}, AllSelected: ${allSelected}`);
            this.buildModalDOM();

            // If we are in an album or all visible photos are selected, fetch real library timeline context!
            if ((isAlbum || allSelected) && initialPhotos.length > 0) {
                this.isAlbumContextMode = true;
                await this.loadLibraryTimelineContext(initialPhotos);
            }
        },

        loadLibraryTimelineContext: async function (selectedPhotos) {
            log('[API Context] Fetching Main Library timeline photos around album dates...');
            this.showStreamLoadingIndicator('older', true);

            try {
                // Ignore any future timestamps beyond today + 1 day
                let validTimestamps = selectedPhotos
                    .map(p => p.timestamp.getTime())
                    .filter(t => !isNaN(t) && t <= (Date.now() + 86400000));
                if (validTimestamps.length === 0) {
                    validTimestamps = selectedPhotos.map(p => p.timestamp.getTime()).filter(t => !isNaN(t));
                }
                if (validTimestamps.length === 0) validTimestamps = [Date.now()];
                const maxTime = Math.max(...validTimestamps);

                log(`[API Context] Target timeline anchor date: ${new Date(maxTime).toLocaleDateString()} (${maxTime})`);

                const wizData = this.getWizGlobalData();
                if (!wizData || !wizData.at) {
                    warn('[API Context] WIZ session data not found, skipping library context fetch.');
                    return;
                }

                // If in an album, fetch exact photo mediaKeys from album API snAcKc
                const albumMatch = window.location.href.match(/\/(?:album|share)\/(AF1Qip[a-zA-Z0-9_\-]{20,})/i);
                if (albumMatch) {
                    const albumKey = albumMatch[1];
                    try {
                        const albumRes = await this.makeApiRequest('snAcKc', [albumKey, null, null, null], wizData);
                        if (albumRes && Array.isArray(albumRes[1])) {
                            albumRes[1].forEach(item => {
                                if (item[0]) this.albumPhotoKeys.add(item[0]);
                                if (item[3]) this.albumDedupKeys.add(item[3]);
                            });
                            log(`[API Context] Loaded ${this.albumPhotoKeys.size} true photo keys from album [${albumKey}] via snAcKc.`);
                        }
                    } catch (e) {
                        warn('[API Context] Could not fetch album keys via snAcKc:', e);
                    }
                }

                // Call lcxiM RPC around maxTime + 1 day so we capture both newer and older
                const requestData = [null, maxTime + (24 * 60 * 60 * 1000), 80, null, 1, 1];
                const res = await this.makeApiRequest('lcxiM', requestData, wizData);

                if (res && Array.isArray(res[0])) {
                    const rawItems = res[0];
                    const existingKeys = new Set(this.photos.map(p => p.mediaKey).filter(Boolean));
                    const existingFingerprints = new Set(
                        this.photos.map(p => this.getThumbFingerprint(p.bgUrl)).filter(fp => fp && fp.length > 15)
                    );
                    let added = 0;

                    for (const item of rawItems) {
                        const parsed = this.parseLibraryItem(item);
                        if (!parsed) continue;

                        const fp = this.getThumbFingerprint(parsed.bgUrl);
                        const isDuplicate = 
                            existingKeys.has(parsed.mediaKey) ||
                            (this.albumPhotoKeys && this.albumPhotoKeys.has(parsed.mediaKey)) ||
                            (this.albumDedupKeys && parsed.dedupKey && this.albumDedupKeys.has(parsed.dedupKey)) ||
                            (fp && existingFingerprints.has(fp));

                        if (!isDuplicate) {
                            this.photos.push(parsed);
                            existingKeys.add(parsed.mediaKey);
                            if (fp) existingFingerprints.add(fp);
                            added++;
                        } else {
                            const existing = this.photos.find(p => p.mediaKey === parsed.mediaKey || (fp && this.getThumbFingerprint(p.bgUrl) === fp));
                            if (existing && !existing.dedupKey && parsed.dedupKey) {
                                existing.dedupKey = parsed.dedupKey;
                            }
                            log(`[API Context] Filtered duplicate item from Library: ${parsed.mediaKey}`);
                        }
                    }

                    log(`[API Context] Loaded ${added} surrounding photos from Main Library timeline.`);
                    if (res[1]) this.libraryNextPageOlderToken = res[1];

                    // Sort chronologically (newest down to oldest)
                    this.photos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                    this.renderModalPhotos();
                } else {
                    log('[API Context] No library photos returned or empty response from lcxiM.');
                }
            } catch (err) {
                error('[API Context] Error loading library timeline context:', err);
            } finally {
                this.showStreamLoadingIndicator('older', false);
            }
        },

        getThumbFingerprint: function (url) {
            if (!url || typeof url !== 'string' || url.startsWith('data:') || url.startsWith('blob:')) return '';
            try {
                // If it contains a Google CDN token like AP1Gcz... or AN-o3...
                const cdnTokenMatch = url.match(/(AP1Gcz[a-zA-Z0-9_\-]+|AN-o3[a-zA-Z0-9_\-]+)/);
                if (cdnTokenMatch) return cdnTokenMatch[1];

                // Otherwise strip size parameters (=...) and query string (?...)
                const clean = url.split('?')[0].split('=')[0].trim();
                const parts = clean.split('/');
                const last = parts[parts.length - 1];
                return (last && last.length > 15) ? last : clean;
            } catch (e) {
                return '';
            }
        },

        deduplicatePhotos: function () {
            const result = [];
            const seenMediaKeys = new Set();
            const seenDedupKeys = new Set();
            const seenFingerprints = new Set();

            for (const p of this.photos) {
                const mk = p.mediaKey && !p.mediaKey.startsWith('photo_') ? p.mediaKey : null;
                const dk = p.dedupKey || null;
                const fp = this.getThumbFingerprint(p.bgUrl);

                let existingMatch = null;

                if (mk && seenMediaKeys.has(mk)) {
                    existingMatch = result.find(x => x.mediaKey === mk);
                } else if (dk && seenDedupKeys.has(dk)) {
                    existingMatch = result.find(x => x.dedupKey === dk);
                } else if (fp && fp.length > 15 && seenFingerprints.has(fp)) {
                    existingMatch = result.find(x => this.getThumbFingerprint(x.bgUrl) === fp);
                } else {
                    // Only compare unselected context photos against album/selected photos
                    // Two selected items (or items with different mediaKeys/fingerprints) are distinct and never duplicates of each other
                    existingMatch = result.find(x => {
                        const oneIsContext = (p.isContextPhoto && !x.isContextPhoto) || (!p.isContextPhoto && x.isContextPhoto);
                        if (!oneIsContext) return false;
                        if (p.isVideo !== x.isVideo) return false;

                        const timeA = p.timestamp ? p.timestamp.getTime() : null;
                        const timeB = x.timestamp ? x.timestamp.getTime() : null;
                        if (!timeA || !timeB || timeA !== timeB) return false;

                        if (p.filename && x.filename && p.filename === x.filename) return true;
                        if (p.isVideo && p.duration && x.duration && p.duration === x.duration) return true;
                        return false;
                    });
                }

                if (existingMatch) {
                    // Preserve selection and merge metadata
                    if (p.isSelected && !existingMatch.isSelected) {
                        existingMatch.isSelected = true;
                    }
                    if (!existingMatch.dedupKey && p.dedupKey) existingMatch.dedupKey = p.dedupKey;
                    if (!existingMatch.filename && p.filename) existingMatch.filename = p.filename;
                    if (!existingMatch.duration && p.duration) existingMatch.duration = p.duration;
                    if (!existingMatch.element && p.element) existingMatch.element = p.element;
                    continue;
                }

                if (mk) seenMediaKeys.add(mk);
                if (dk) seenDedupKeys.add(dk);
                if (fp && fp.length > 15) seenFingerprints.add(fp);
                result.push(p);
            }

            this.photos = result;
        },

        parseLibraryItem: function (itemData) {
            if (!itemData || !itemData[0]) return null;
            const mediaKey = itemData[0];
            const timestampMs = parseInt(itemData[2], 10);
            if (isNaN(timestampMs)) return null;

            const thumbUrl = itemData[1]?.[0] || '';
            const resW = itemData[1]?.[1];
            const resH = itemData[1]?.[2];
            const isVideo = Boolean(itemData?.at(-1)?.[76647426]?.[0]);
            const duration = itemData?.at(-1)?.[76647426]?.[0] || '';
            const dedupKey = itemData[3] || null;
            const date = new Date(timestampMs);

            return {
                id: mediaKey,
                mediaKey: mediaKey,
                dedupKey: dedupKey,
                filename: '',
                aspectRatio: (resW && resH) ? (resW / resH) : (isVideo ? 16 / 9 : 1),
                element: null,
                ariaLabel: '',
                timestamp: date,
                originalTimestamp: new Date(timestampMs),
                bgUrl: thumbUrl,
                isVideo: isVideo,
                duration: duration,
                isSelected: false,
                isContextPhoto: true,
                isModified: false
            };
        },

        closeDragModal: function () {
            if (this.modalOverlay) {
                this.modalOverlay.remove();
                this.modalOverlay = null;
            }
            this.isDragging = false;
            this.draggedPhotoId = null;
            this.dragSourceIndex = -1;
            this.activeDropTarget = null;
            this.cleanupDropIndicators();
            document.body.style.overflow = '';
        },

        buildModalDOM: function () {
            const templates = window.TimTools.Modules.DragInTimeTemplates;
            const overlay = document.createElement('div');
            overlay.className = 'gp-drag-modal-overlay';

            const isDark = window.TimTools.Theme ? window.TimTools.Theme.isDark() : false;
            overlay.classList.add(isDark ? 'gp-theme-dark' : 'gp-theme-light', isDark ? 'gp-timtools-theme-dark' : 'gp-timtools-theme-light');

            overlay.innerHTML = templates.getModalOverlayHtml();

            // Prevent background page from receiving mousewheel events outside modalBody
            overlay.addEventListener('wheel', (e) => {
                if (!e.target.closest('.gp-drag-modal-body')) {
                    e.preventDefault();
                }
            }, { passive: false });

            // Backdrop click closes modal
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeDragModal();
                }
            });

            // Wire buttons
            const closeBtn = overlay.querySelector('.gp-modal-close-btn');
            if (closeBtn) closeBtn.onclick = () => this.closeDragModal();

            const backBtn = overlay.querySelector('.gp-modal-back-btn');
            if (backBtn) backBtn.onclick = () => this.closeDragModal();

            const saveBtn = overlay.querySelector('.gp-modal-save-btn');
            if (saveBtn) saveBtn.onclick = () => this.handleSaveModalChanges();

            const topLoadBtn = overlay.querySelector('.gp-load-newer');
            if (topLoadBtn) topLoadBtn.onclick = () => this.loadMorePhotos('newer');

            const bottomLoadBtn = overlay.querySelector('.gp-load-older');
            if (bottomLoadBtn) bottomLoadBtn.onclick = () => this.loadMorePhotos('older');

            const squareAspectToggle = overlay.querySelector('.gp-square-aspect-checkbox');
            if (squareAspectToggle) {
                squareAspectToggle.checked = this.isSquareAspect;
                squareAspectToggle.addEventListener('change', (e) => {
                    this.toggleSquareAspect(e.target.checked);
                });
            }

            const filenameToggle = overlay.querySelector('.gp-show-filenames-checkbox');
            if (filenameToggle) {
                filenameToggle.checked = this.showFilenames;
                filenameToggle.addEventListener('change', (e) => {
                    this.toggleShowFilenames(e.target.checked);
                });
            }

            document.body.appendChild(overlay);
            this.modalOverlay = overlay;

            // Wire seamless container-level drag & drop (zero dead zones between photo cards)
            const streamContainer = overlay.querySelector('.gp-photos-stream-container');
            if (streamContainer) {
                let dragOverRaf = null;

                streamContainer.addEventListener('dragover', (e) => {
                    if (!this.isDragging) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';

                    const clientX = e.clientX;
                    const clientY = e.clientY;

                    if (dragOverRaf) return;
                    dragOverRaf = requestAnimationFrame(() => {
                        dragOverRaf = null;
                        if (!this.isDragging) return;

                        const target = this.getDropTargetFromPoint(clientX, clientY);
                        if (target && target.card) {
                            if (target.mediaKey !== this.draggedPhotoId) {
                                this.showDropIndicator(target.card, target.side);
                                this.activeDropTarget = target;
                            } else {
                                this.cleanupDropIndicators();
                                this.activeDropTarget = null;
                            }
                        }
                    });
                });

                streamContainer.addEventListener('dragleave', (e) => {
                    const related = e.relatedTarget;
                    if (!streamContainer.contains(related)) {
                        if (dragOverRaf) {
                            cancelAnimationFrame(dragOverRaf);
                            dragOverRaf = null;
                        }
                        this.cleanupDropIndicators();
                        this.activeDropTarget = null;
                    }
                });

                streamContainer.addEventListener('drop', (e) => {
                    if (dragOverRaf) {
                        cancelAnimationFrame(dragOverRaf);
                        dragOverRaf = null;
                    }
                    if (!this.isDragging || !this.draggedPhotoId) return;
                    e.preventDefault();
                    e.stopPropagation();

                    const target = this.activeDropTarget || this.getDropTargetFromPoint(e.clientX, e.clientY);
                    if (target && target.mediaKey && target.mediaKey !== this.draggedPhotoId) {
                        const dropBefore = target.side === 'left';
                        log(`Dropped photo ${this.draggedPhotoId} onto target ${target.mediaKey} via container (${dropBefore ? 'before' : 'after'})`);
                        this.executeModalDrop(this.draggedPhotoId, target.mediaKey, dropBefore);
                    }
                    this.cleanupDropIndicators();
                    this.activeDropTarget = null;
                });
            }

            // Auto-scroll infinite stream loader: automatically fetches older photos at bottom and newer photos at top
            const modalBody = overlay.querySelector('.gp-drag-modal-body');

            if (modalBody) {
                let autoScrollTimer = null;
                const checkAutoScroll = () => {
                    if (this.isLoadingMore || this.isDragging) return;

                    const scrollTop = modalBody.scrollTop;
                    const scrollHeight = modalBody.scrollHeight;
                    const clientHeight = modalBody.clientHeight;

                    // 1. Approaching bottom (within 400px) -> load older photos automatically!
                    if (scrollTop + clientHeight >= scrollHeight - 400 && !this.hasReachedOldestEnd) {
                        this.loadMorePhotos('older');
                    }
                    // 2. Approaching top (within 150px) and not already at newest -> load newer photos automatically!
                    else if (scrollTop <= 150 && !this.hasReachedNewestEnd) {
                        const prevScrollHeight = modalBody.scrollHeight;
                        const prevScrollTop = modalBody.scrollTop;
                        this.loadMorePhotos('newer', (count) => {
                            if (count > 0 && modalBody) {
                                const newScrollHeight = modalBody.scrollHeight;
                                modalBody.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
                            }
                        });
                    }
                };

                const scheduleCheck = () => {
                    if (autoScrollTimer) return;
                    autoScrollTimer = setTimeout(() => {
                        autoScrollTimer = null;
                        checkAutoScroll();
                    }, 120);
                };

                modalBody.addEventListener('scroll', scheduleCheck, { passive: true });

                // Also listen to wheel events so that when the user is at the very bottom or top,
                // attempting to scroll further still triggers loadMorePhotos even if scrollTop doesn't change
                modalBody.addEventListener('wheel', (e) => {
                    if (this.isLoadingMore || this.isDragging) return;

                    const scrollTop = modalBody.scrollTop;
                    const scrollHeight = modalBody.scrollHeight;
                    const clientHeight = modalBody.clientHeight;

                    if (e.deltaY > 0 && !this.hasReachedOldestEnd && (scrollTop + clientHeight >= scrollHeight - 120)) {
                        scheduleCheck();
                    } else if (e.deltaY < 0 && !this.hasReachedNewestEnd && scrollTop <= 120) {
                        scheduleCheck();
                    }
                }, { passive: true });
            }

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
            this.deduplicatePhotos();

            const container = this.modalOverlay ? this.modalOverlay.querySelector('.gp-photos-stream-container') : null;
            if (!container) return;

            container.innerHTML = '';

            if (this.showFilenames) {
                container.classList.add('gp-show-filenames');
            } else {
                container.classList.remove('gp-show-filenames');
            }

            if (this.isSquareAspect) {
                container.classList.add('gp-square-mode');
                container.classList.remove('gp-original-aspect');
            } else {
                container.classList.remove('gp-square-mode');
                container.classList.add('gp-original-aspect');
            }

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

                const headerEl = document.createElement('div');
                headerEl.className = 'gp-date-group-header';
                headerEl.innerHTML = `
                    <span>${dayHeader}</span>
                    <span class="gp-date-group-count">(${items.length} ${items.length === 1 ? 'item' : 'items'})</span>
                `;
                groupSection.appendChild(headerEl);

                const cardGrid = document.createElement('div');
                cardGrid.className = 'gp-date-group-grid';

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

        toggleSquareAspect: function (isSquare) {
            this.isSquareAspect = !!isSquare;
            const container = this.modalOverlay ? this.modalOverlay.querySelector('.gp-photos-stream-container') : null;
            if (container) {
                if (this.isSquareAspect) {
                    container.classList.add('gp-square-mode');
                    container.classList.remove('gp-original-aspect');
                } else {
                    container.classList.remove('gp-square-mode');
                    container.classList.add('gp-original-aspect');
                }
            }
        },

        toggleShowFilenames: function (isEnabled) {
            this.showFilenames = !!isEnabled;
            const container = this.modalOverlay ? this.modalOverlay.querySelector('.gp-photos-stream-container') : null;
            if (container) {
                if (this.showFilenames) {
                    container.classList.add('gp-show-filenames');
                    this.fetchMissingFilenames();
                } else {
                    container.classList.remove('gp-show-filenames');
                }
            }
        },

        fetchMissingFilenames: async function () {
            if (!this.showFilenames) return;
            const wizData = this.getWizGlobalData();
            if (!wizData || !wizData.at) return;

            const missing = this.photos.filter(p => !p.filename && p.mediaKey && !p.mediaKey.startsWith('photo_'));
            if (missing.length === 0) return;

            log(`[Filenames] Fetching missing filenames for ${missing.length} photos in background...`);

            for (let i = 0; i < missing.length; i += 6) {
                if (!this.showFilenames || !this.modalOverlay) break;
                const batch = missing.slice(i, i + 6);
                await Promise.allSettled(batch.map(async (photo) => {
                    try {
                        let name = '';
                        const info = await this.makeApiRequest('VrseUb', [photo.mediaKey, null, null, null, null], wizData);
                        if (info && info[0]) {
                            for (let field of info[0]) {
                                if (typeof field === 'string' && /\.[a-zA-Z0-9]{3,4}$/.test(field.trim())) {
                                    name = field.trim();
                                    break;
                                }
                            }
                            if (!name && typeof info[0][2] === 'string' && info[0][2]) {
                                name = info[0][2];
                            }
                        }

                        if (!name) {
                            const details = await this.makeApiRequest('fDcn4b', [photo.mediaKey, 1], wizData);
                            if (details) {
                                const str = JSON.stringify(details);
                                const match = str.match(/"([^"]+\.(?:jpe?g|png|webp|heic|mp4|mov|avi|mkv|3gp|gif|dng|raw))"/i);
                                if (match) name = match[1];
                            }
                        }

                        if (name) {
                            photo.filename = name;
                            this.filenameCache.set(photo.mediaKey, name);
                            if (this.modalOverlay) {
                                const card = this.modalOverlay.querySelector(`.gp-modal-photo-card[data-photo-id="${photo.mediaKey}"]`);
                                if (card) {
                                    const badge = card.querySelector('.gp-card-filename-badge');
                                    if (badge) {
                                        badge.textContent = name;
                                        badge.title = name;
                                    }
                                }
                            }
                        }
                    } catch (e) {}
                }));
            }
        },

        createModalPhotoCard: function (photo) {
            const templates = window.TimTools.Modules.DragInTimeTemplates;
            const card = document.createElement('div');
            card.className = `gp-modal-photo-card ${photo.isSelected ? 'is-draggable' : ''} ${photo.isModified ? 'is-modified' : ''}`;
            card.setAttribute('data-photo-id', photo.mediaKey);
            card.setAttribute('data-is-selected', photo.isSelected ? 'true' : 'false');
            card.setAttribute('draggable', photo.isSelected ? 'true' : 'false');

            const options = {
                formattedTime: this.formatShortTime(photo.timestamp),
                fullDateTime: this.formatCustomDate(photo.timestamp),
                gmtString: this.formatTimezoneString(photo.timestamp),
                dateString: this.formatDateDisplay(photo.timestamp)
            };

            card.innerHTML = templates.getPhotoCardHtml(photo, options);

            // Aspect ratio setup for original aspect mode
            if (photo.aspectRatio) {
                card.style.aspectRatio = `${photo.aspectRatio}`;
            }

            const cardImg = card.querySelector('.gp-card-img');
            if (cardImg) {
                const onImageReady = () => {
                    if (cardImg.naturalWidth && cardImg.naturalHeight) {
                        const ratio = cardImg.naturalWidth / cardImg.naturalHeight;
                        photo.aspectRatio = ratio;
                        card.style.aspectRatio = `${ratio}`;
                    }
                };
                if (cardImg.complete && cardImg.naturalWidth) {
                    onImageReady();
                } else {
                    cardImg.addEventListener('load', onImageReady);
                }
            }

            // 1. Setup Bottom Timeline Slider (State 2)
            this.setupCardSlider(card, photo);

            // 2. Setup Manual Date & Time Editor (State 3)
            this.setupCardManualEdit(card, photo);

            // 3. Drag & Drop event wiring
            this.wireCardDragEvents(card, photo);

            return card;
        },

        setupCardSlider: function (card, photo) {
            const sliderWrapper = card.querySelector('.gp-card-slider-wrapper');
            const slider = card.querySelector('.gp-time-slider');
            if (!slider || !sliderWrapper) return;

            // Stop pointer/mouse events from propagating to prevent card drag
            const stopDrag = (e) => {
                e.stopPropagation();
            };
            sliderWrapper.addEventListener('mousedown', stopDrag);
            sliderWrapper.addEventListener('pointerdown', stopDrag);
            slider.addEventListener('mousedown', stopDrag);
            slider.addEventListener('pointerdown', stopDrag);

            // Calculate neighbor timestamps
            // Photos are sorted descending by time (newer at index 0, older at end)
            let newerTime = (photo._index > 0)
                ? this.photos[photo._index - 1].timestamp.getTime()
                : (photo.timestamp.getTime() + 3600000);
            let olderTime = (photo._index < this.photos.length - 1)
                ? this.photos[photo._index + 1].timestamp.getTime()
                : (photo.timestamp.getTime() - 3600000);

            if (newerTime <= olderTime) {
                newerTime = photo.timestamp.getTime() + 60000;
                olderTime = photo.timestamp.getTime() - 60000;
            }

            const diffMs = newerTime - olderTime;
            const totalMinutes = Math.round(diffMs / 60000);
            const stepCount = Math.max(10, Math.min(totalMinutes, 500));

            slider.min = '0';
            slider.max = String(stepCount);

            // Left edge = newerTime (val = 0), Right edge = olderTime (val = stepCount)
            const currentTime = photo.timestamp.getTime();
            const currentFraction = Math.max(0, Math.min(1, (newerTime - currentTime) / diffMs));
            slider.value = String(Math.round(currentFraction * stepCount));

            slider.addEventListener('input', (e) => {
                e.stopPropagation();
                const val = parseInt(slider.value, 10);
                const fraction = val / stepCount;
                const newTimestampMs = Math.round(newerTime - fraction * diffMs);
                const newDate = new Date(newTimestampMs);

                photo.timestamp = newDate;
                photo.isModified = true;

                // Update digits in bottom-left in real time
                const timeDisplay = card.querySelector('.gp-card-time-display');
                if (timeDisplay) {
                    timeDisplay.textContent = this.formatShortTime(newDate);
                }

                // Update manual bar inputs in background
                const inputTime = card.querySelector('.gp-input-time');
                const inputDate = card.querySelector('.gp-input-date');
                if (inputTime) inputTime.value = `${this.formatShortTime(newDate)}:${String(newDate.getSeconds()).padStart(2, '0')}`;
                if (inputDate) inputDate.value = this.formatDateDisplay(newDate);

                // Add modified badge
                card.classList.add('is-modified');
                const modBadge = card.querySelector('.gp-card-modified-badge');
                if (modBadge) modBadge.style.display = 'block';

                // Record in modifiedTimestamps
                this.modifiedTimestamps.set(photo.mediaKey, {
                    photo: photo,
                    oldDate: photo.originalTimestamp,
                    newDate: newDate
                });

                this.updateModifiedCounter();
            });
        },

        setupCardManualEdit: function (card, photo) {
            // ONLY initially selected photos can be manually edited!
            if (!photo.isSelected) return;

            const timeDisplay = card.querySelector('.gp-card-time-display');
            const manualBar = card.querySelector('.gp-card-manual-bar');
            if (!timeDisplay || !manualBar) return;

            const inputTime = manualBar.querySelector('.gp-input-time');
            const inputTz = manualBar.querySelector('.gp-input-tz');
            const inputDate = manualBar.querySelector('.gp-input-date');
            if (!inputTime || !inputTz || !inputDate) return;

            // Stop pointer/mouse/keyboard events from bubbling to prevent card drag and background hotkeys
            const stopProp = (e) => e.stopPropagation();
            manualBar.addEventListener('mousedown', stopProp);
            manualBar.addEventListener('pointerdown', stopProp);
            manualBar.addEventListener('keydown', stopProp);
            manualBar.addEventListener('keyup', stopProp);

            const openManualBar = (e) => {
                if (e) e.stopPropagation();
                card.classList.add('is-manual-mode');
                manualBar.style.display = 'flex';

                const d = photo.timestamp;
                inputTime.value = `${this.formatShortTime(d)}:${String(d.getSeconds()).padStart(2, '0')}`;
                inputTz.value = this.formatTimezoneString(d);
                inputDate.value = this.formatDateDisplay(d);

                inputTime.focus();
                inputTime.select();
            };

            const closeManualBar = () => {
                card.classList.remove('is-manual-mode');
                manualBar.style.display = 'none';
            };

            const commitChanges = () => {
                if (!card.classList.contains('is-manual-mode')) return;

                const parsedDate = this.parseManualInputs(inputDate.value, inputTime.value, inputTz.value);
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    const timeChanged = parsedDate.getTime() !== photo.timestamp.getTime();
                    photo.timestamp = parsedDate;

                    if (timeChanged || parsedDate.getTime() !== photo.originalTimestamp.getTime()) {
                        photo.isModified = true;
                        this.modifiedTimestamps.set(photo.mediaKey, {
                            photo: photo,
                            oldDate: photo.originalTimestamp,
                            newDate: parsedDate
                        });
                        this.updateModifiedCounter();
                    }

                    closeManualBar();

                    // Re-sort chronologically (newest at top) and immediately re-render stream
                    this.photos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                    this.renderModalPhotos();
                } else {
                    closeManualBar();
                }
            };

            timeDisplay.addEventListener('click', openManualBar);

            // Smart time formatter: automatically adds ':' after 2 and 4 digits (e.g. 195216 -> 19:52:16)
            const formatTimeDigits = (val, isBackspace = false) => {
                let digits = val.replace(/\D/g, '').slice(0, 6);
                if (isBackspace && val.endsWith(':')) {
                    digits = digits.slice(0, -1);
                }
                if (digits.length === 0) return '';
                if (digits.length < 2) return digits;
                if (digits.length === 2) return isBackspace ? digits : `${digits}:`;
                if (digits.length === 3) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
                if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}${isBackspace ? '' : ':'}`;
                return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
            };

            let lastInputType = '';
            inputTime.addEventListener('beforeinput', (e) => {
                lastInputType = e.inputType || '';
                // Block any non-digit character from being entered directly
                if (e.data && !/^\d+$/.test(e.data)) {
                    e.preventDefault();
                }
            });

            inputTime.addEventListener('input', (e) => {
                const isBackspace = (e.inputType || lastInputType) === 'deleteContentBackward';
                inputTime.value = formatTimeDigits(inputTime.value, isBackspace);
            });

            inputTime.addEventListener('paste', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const pasteText = (e.clipboardData || window.clipboardData)?.getData('text') || '';
                inputTime.value = formatTimeDigits(pasteText, false);
            });

            // Prevent arrow keys or typing from exiting fields or triggering Google Photos shortcuts
            [inputTime, inputTz, inputDate].forEach(input => {
                input.addEventListener('keydown', (e) => {
                    e.stopPropagation(); // Traps key events inside the modal input

                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commitChanges();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeManualBar();
                    } else if (input === inputTime) {
                        // Allow navigation, deletion, clipboard
                        if (
                            e.key === 'Backspace' || e.key === 'Delete' ||
                            e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                            e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
                            e.key === 'Home' || e.key === 'End' || e.key === 'Tab' ||
                            e.ctrlKey || e.metaKey
                        ) {
                            return;
                        }
                        // Disallow non-digits
                        if (!/^\d$/.test(e.key)) {
                            e.preventDefault();
                        }
                    }
                });
            });

            // Commit when focus leaves the manual bar
            manualBar.addEventListener('focusout', (e) => {
                if (e.relatedTarget && manualBar.contains(e.relatedTarget)) {
                    return;
                }
                setTimeout(() => {
                    if (!manualBar.contains(document.activeElement)) {
                        commitChanges();
                    }
                }, 100);
            });
        },

        // --- Step 5: Smooth Drag & Drop Inside Modal ---
        wireCardDragEvents: function (card, photo) {
            if (photo.isSelected) {
                // Disable draggable whenever pointer touches the bottom 25% (1/4) of the card,
                // or slider / manual bar / time digits, so dragging the card is impossible from the bottom.
                card.addEventListener('pointerdown', (e) => {
                    const rect = card.getBoundingClientRect();
                    const relY = e.clientY - rect.top;
                    if (relY > rect.height * 0.75 || e.target.closest('.gp-card-slider-wrapper, .gp-time-slider, .gp-card-manual-bar, .gp-card-time-display, input')) {
                        card.setAttribute('draggable', 'false');
                    } else {
                        card.setAttribute('draggable', 'true');
                    }
                });

                window.addEventListener('pointerup', () => {
                    if (photo.isSelected) {
                        card.setAttribute('draggable', 'true');
                    }
                }, { passive: true });

                card.addEventListener('dragstart', (e) => {
                    const rect = card.getBoundingClientRect();
                    const relY = e.clientY - rect.top;
                    // Prevent drag if starting from the bottom 25% or interactive elements
                    if (relY > rect.height * 0.75 || e.target.closest('.gp-card-slider-wrapper, .gp-time-slider, .gp-card-manual-bar, .gp-card-time-display, input')) {
                        e.preventDefault();
                        return false;
                    }

                    this.isDragging = true;
                    this.draggedPhotoId = photo.mediaKey;
                    this.dragSourceIndex = this.photos.findIndex(p => p.mediaKey === photo.mediaKey);

                    card.classList.add('is-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', photo.mediaKey);

                    log('Drag started on card:', photo.mediaKey, 'Index:', this.dragSourceIndex);
                });

                card.addEventListener('dragend', () => {
                    card.classList.remove('is-dragging');
                    this.cleanupDropIndicators();
                    this.isDragging = false;
                    this.draggedPhotoId = null;
                    this.dragSourceIndex = -1;
                });
            } else {
                card.setAttribute('draggable', 'false');
                card.addEventListener('dragstart', (e) => {
                    e.preventDefault();
                    return false;
                });
            }

            // CRITICAL: Both selected and unselected photos MUST receive drop events!
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Avoid triggering streamContainer redundantly
                e.dataTransfer.dropEffect = 'move';

                if (!this.isDragging || this.draggedPhotoId === photo.mediaKey) return;

                const rect = card.getBoundingClientRect();
                const isLeft = e.clientX < (rect.left + rect.width / 2);
                const side = isLeft ? 'left' : 'right';

                this.showDropIndicator(card, side);
                this.activeDropTarget = {
                    card: card,
                    mediaKey: photo.mediaKey,
                    side: side
                };
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (!this.isDragging || !this.draggedPhotoId || this.draggedPhotoId === photo.mediaKey) {
                    this.cleanupDropIndicators();
                    this.activeDropTarget = null;
                    return;
                }

                const rect = card.getBoundingClientRect();
                const dropBefore = e.clientX < (rect.left + rect.width / 2);

                log(`Dropped photo ${this.draggedPhotoId} onto card ${photo.mediaKey} (${dropBefore ? 'before' : 'after'})`);
                this.executeModalDrop(this.draggedPhotoId, photo.mediaKey, dropBefore);
                this.cleanupDropIndicators();
                this.activeDropTarget = null;
            });
        },

        getDropTargetFromPoint: function (clientX, clientY) {
            if (!this.modalOverlay) return null;

            // 1. Direct hit on a card or child of a card
            let el = document.elementFromPoint(clientX, clientY);
            let card = el ? el.closest('.gp-modal-photo-card:not(.is-dragging)') : null;
            if (card) {
                const rect = card.getBoundingClientRect();
                const isLeft = clientX < (rect.left + rect.width / 2);
                const mediaKey = card.getAttribute('data-media-key') || card.getAttribute('data-id');
                return { card, mediaKey, side: isLeft ? 'left' : 'right' };
            }

            // 2. Fast offset probe for the 12px gap between cards (instant, zero full-DOM loops)
            const probeOffsets = [
                [-8, 0, 'right'], // probed left -> cursor is to the right of this card
                [8, 0, 'left'],   // probed right -> cursor is to the left of this card
                [-14, 0, 'right'],
                [14, 0, 'left'],
                [0, -8, 'right'],
                [0, 8, 'left']
            ];

            for (let i = 0; i < probeOffsets.length; i++) {
                const p = probeOffsets[i];
                el = document.elementFromPoint(clientX + p[0], clientY + p[1]);
                card = el ? el.closest('.gp-modal-photo-card:not(.is-dragging)') : null;
                if (card) {
                    const mediaKey = card.getAttribute('data-media-key') || card.getAttribute('data-id');
                    return { card, mediaKey, side: p[2] };
                }
            }

            // 3. Fallback only if all probes miss (cursor outside grid boundaries)
            const allCards = this.modalOverlay.querySelectorAll('.gp-modal-photo-card:not(.is-dragging)');
            if (allCards.length === 0) return null;

            let closestCard = null;
            let minDistance = Infinity;

            for (let i = 0; i < allCards.length; i++) {
                const c = allCards[i];
                const rect = c.getBoundingClientRect();
                const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
                const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
                const dist = dx * dx + dy * dy;

                if (dist < minDistance) {
                    minDistance = dist;
                    closestCard = c;
                    if (dist < 400) break;
                }
            }

            if (closestCard) {
                const rect = closestCard.getBoundingClientRect();
                const isLeft = clientX < (rect.left + rect.width / 2);
                const mediaKey = closestCard.getAttribute('data-media-key') || closestCard.getAttribute('data-id');
                return { card: closestCard, mediaKey, side: isLeft ? 'left' : 'right' };
            }

            return null;
        },

        showDropIndicator: function (card, side) {
            if (!card) return;

            // If already active on this card and side, avoid ANY DOM updates or recalculations!
            if (card === this.lastIndicatorCard && side === this.lastIndicatorSide) {
                return;
            }

            // Clean up ONLY previously highlighted cards (maximum 2 elements)
            this.cleanupDropIndicators();

            this.lastIndicatorCard = card;
            this.lastIndicatorSide = side;

            const cardsToHighlight = [card];

            if (side === 'left') {
                card.classList.add('drag-over-before');

                // Find previous card in DOM directly without querySelectorAll
                let prevCard = card.previousElementSibling;
                while (prevCard && !prevCard.classList.contains('gp-modal-photo-card')) {
                    prevCard = prevCard.previousElementSibling;
                }
                if (!prevCard) {
                    const prevSection = card.closest('.gp-date-group-section')?.previousElementSibling;
                    prevCard = prevSection ? prevSection.querySelector('.gp-modal-photo-card:last-child') : null;
                }
                if (prevCard && !prevCard.classList.contains('is-dragging')) {
                    prevCard.classList.add('drag-over-after');
                    cardsToHighlight.push(prevCard);
                }
            } else {
                card.classList.add('drag-over-after');

                // Find next card in DOM directly without querySelectorAll
                let nextCard = card.nextElementSibling;
                while (nextCard && !nextCard.classList.contains('gp-modal-photo-card')) {
                    nextCard = nextCard.nextElementSibling;
                }
                if (!nextCard) {
                    const nextSection = card.closest('.gp-date-group-section')?.nextElementSibling;
                    nextCard = nextSection ? nextSection.querySelector('.gp-modal-photo-card:first-child') : null;
                }
                if (nextCard && !nextCard.classList.contains('is-dragging')) {
                    nextCard.classList.add('drag-over-before');
                    cardsToHighlight.push(nextCard);
                }
            }

            this.highlightedCards = cardsToHighlight;
        },

        cleanupCardIndicator: function (card) {
            if (!card) return;
            card.classList.remove('drag-over-before', 'drag-over-after');
        },

        cleanupDropIndicators: function () {
            if (this.highlightedCards && this.highlightedCards.length > 0) {
                for (let i = 0; i < this.highlightedCards.length; i++) {
                    const c = this.highlightedCards[i];
                    c.classList.remove('drag-over-before', 'drag-over-after');
                }
                this.highlightedCards = [];
            }
            this.lastIndicatorCard = null;
            this.lastIndicatorSide = null;
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
            const neighborPrev = (insertIdx > 0) ? this.photos[insertIdx - 1] : null;
            const neighborNext = (insertIdx < this.photos.length - 1) ? this.photos[insertIdx + 1] : null;

            let newTimestampMs;

            if (neighborPrev && neighborNext) {
                const timeA = neighborPrev.timestamp.getTime();
                const timeB = neighborNext.timestamp.getTime();
                newTimestampMs = Math.round(timeA + (timeB - timeA) / 2);
                log(`Calculated midpoint between ${this.formatCustomDate(neighborPrev.timestamp)} and ${this.formatCustomDate(neighborNext.timestamp)}`);
            } else if (neighborNext) {
                const timeNext = neighborNext.timestamp.getTime();
                newTimestampMs = timeNext + 60000;
            } else if (neighborPrev) {
                const timePrev = neighborPrev.timestamp.getTime();
                newTimestampMs = timePrev - 60000;
            } else {
                newTimestampMs = Date.now();
            }

            const calculatedDate = new Date(newTimestampMs);
            draggedPhoto.timestamp = calculatedDate;
            draggedPhoto.isModified = true;

            log(`NEW TIMESTAMP FOR ${draggedPhoto.mediaKey}:`, this.formatCustomDate(calculatedDate));

            this.modifiedTimestamps.set(draggedPhoto.mediaKey, {
                photo: draggedPhoto,
                oldDate: draggedPhoto.originalTimestamp,
                newDate: calculatedDate
            });

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

            const modalNewest = this.photos[0];
            const isFirstCardInModal = modalNewest.mediaKey === firstCardInfo.mediaKey ||
                                       modalNewest.timestamp.getTime() >= firstCardInfo.timestamp.getTime();

            return isPageAtTop && isFirstCardInModal;
        },

        updateLoadButtonsVisibility: function () {
            if (!this.modalOverlay) return;
            const topLoadBtn = this.modalOverlay.querySelector('.gp-load-newer');
            const bottomLoadBtn = this.modalOverlay.querySelector('.gp-load-older');

            // Managed seamlessly via auto-scroll
            if (topLoadBtn) topLoadBtn.style.display = 'none';
            if (bottomLoadBtn) bottomLoadBtn.style.display = 'none';
        },

        showStreamLoadingIndicator: function (direction, isVisible) {
            if (!this.modalOverlay) return;
            let indicator = this.modalOverlay.querySelector('.gp-stream-loading-indicator');
            if (isVisible) {
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.className = 'gp-stream-loading-indicator';
                    indicator.innerHTML = `
                        <div class="gp-stream-spinner"></div>
                        <span>Loading more photos...</span>
                    `;
                    const container = this.modalOverlay.querySelector('.gp-photos-stream-container');
                    if (container) {
                        if (direction === 'newer') {
                            container.prepend(indicator);
                        } else {
                            container.appendChild(indicator);
                        }
                    }
                }
            } else if (indicator) {
                indicator.remove();
            }
        },

        // --- Step 7: Load More Photos (Top / Bottom) ---
        loadMorePhotos: function (direction, onComplete) {
            if (this.isLoadingMore) {
                if (onComplete) onComplete(0);
                return;
            }

            if (direction === 'older' && this.hasReachedOldestEnd) {
                if (onComplete) onComplete(0);
                return;
            }
            if (direction === 'newer' && this.hasReachedNewestEnd) {
                if (onComplete) onComplete(0);
                return;
            }

            this.isLoadingMore = true;

            // In Album / Context mode, fetch from Google Photos Main Library via RPC
            if (this.isAlbumContextMode) {
                this.loadMoreLibraryPhotos(direction, onComplete);
                return;
            }

            log(`[Auto-Scroll] Checking for more photos (${direction})...`);

            const currentKeys = new Set(this.photos.map(p => p.mediaKey));
            const allCards = Array.from(document.querySelectorAll(ALL_PHOTO_CARDS_SELECTOR));
            const allParsed = allCards.map((el, i) => this.extractCardInfo(el, i));

            // 1. Check if unrendered photo cards already exist in the background page DOM
            let candidates = [];
            if (direction === 'newer') {
                const firstModalIdx = allParsed.findIndex(p => currentKeys.has(p.mediaKey));
                if (firstModalIdx > 0) {
                    candidates = allParsed.slice(0, firstModalIdx).filter(p => !currentKeys.has(p.mediaKey));
                }
                if (candidates.length === 0) {
                    const newestTime = this.photos.length > 0 ? this.photos[0].timestamp.getTime() : 0;
                    candidates = allParsed.filter(p => !currentKeys.has(p.mediaKey) && p.timestamp.getTime() >= newestTime);
                }
            } else {
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
                if (candidates.length === 0) {
                    const oldestTime = this.photos.length > 0 ? this.photos[this.photos.length - 1].timestamp.getTime() : Infinity;
                    candidates = allParsed.filter(p => !currentKeys.has(p.mediaKey) && p.timestamp.getTime() <= oldestTime);
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
                log(`[Auto-Scroll] Instantly added ${addedCount} ${direction} photos from available DOM cards.`);
                this.photos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                this.renderModalPhotos();
                this.updateModifiedCounter();
                this.isLoadingMore = false;
                if (onComplete) onComplete(addedCount);
                return;
            }

            // 2. No cached DOM cards -> Load next batch directly from Google Photos API (lcxiM RPC)
            log(`[Auto-Scroll] No cached DOM cards. Fetching ${direction} photos directly via Library API...`);
            this.loadMoreLibraryPhotos(direction, onComplete);
        },

        loadMoreLibraryPhotos: async function (direction, onComplete) {
            log(`[API Context] Loading more ${direction} library photos via RPC lcxiM...`);
            this.showStreamLoadingIndicator(direction, true);

            try {
                const wizData = this.getWizGlobalData();
                if (!wizData || !wizData.at) {
                    warn('[API Context] WIZ session data missing.');
                    if (direction === 'older') this.hasReachedOldestEnd = true;
                    if (direction === 'newer') this.hasReachedNewestEnd = true;
                    this.isLoadingMore = false;
                    this.showStreamLoadingIndicator(direction, false);
                    if (onComplete) onComplete(0);
                    return;
                }

                let added = 0;

                if (direction === 'older') {
                    let requestData = null;
                    if (this.libraryNextPageOlderToken) {
                        requestData = [this.libraryNextPageOlderToken, null, 60, null, 1, 1];
                    } else {
                        const oldestTimestamp = this.photos.length > 0 ? this.photos[this.photos.length - 1].timestamp.getTime() : Date.now();
                        requestData = [null, oldestTimestamp, 60, null, 1, 1];
                    }

                    const res = await this.makeApiRequest('lcxiM', requestData, wizData);
                    if (res && Array.isArray(res[0]) && res[0].length > 0) {
                        const rawItems = res[0];
                        const existingKeys = new Set(this.photos.map(p => p.mediaKey).filter(Boolean));
                        const existingFingerprints = new Set(
                            this.photos.map(p => this.getThumbFingerprint(p.bgUrl)).filter(fp => fp && fp.length > 15)
                        );

                        for (const item of rawItems) {
                            const parsed = this.parseLibraryItem(item);
                            if (!parsed) continue;

                            const fp = this.getThumbFingerprint(parsed.bgUrl);
                            const isDuplicate = 
                                existingKeys.has(parsed.mediaKey) ||
                                (this.albumPhotoKeys && this.albumPhotoKeys.has(parsed.mediaKey)) ||
                                (this.albumDedupKeys && parsed.dedupKey && this.albumDedupKeys.has(parsed.dedupKey)) ||
                                (fp && existingFingerprints.has(fp));

                            if (!isDuplicate) {
                                this.photos.push(parsed);
                                existingKeys.add(parsed.mediaKey);
                                if (fp) existingFingerprints.add(fp);
                                added++;
                            }
                        }

                        if (res[1]) this.libraryNextPageOlderToken = res[1];
                        if (added === 0) this.hasReachedOldestEnd = true;
                    } else {
                        this.hasReachedOldestEnd = true;
                    }
                } else {
                    // direction === 'newer'
                    const newestTimestamp = this.photos.length > 0 ? this.photos[0].timestamp.getTime() : Date.now();
                    const now = Date.now() + 86400000; // allow up to tomorrow

                    if (newestTimestamp >= Date.now()) {
                        log('[API Context] Current newest photo is already at or beyond today.');
                        this.hasReachedNewestEnd = true;
                        this.isLoadingMore = false;
                        this.showStreamLoadingIndicator(direction, false);
                        if (onComplete) onComplete(0);
                        return;
                    }

                    let stepDays = this.newerSearchStepDays || 30;
                    let attempts = 0;

                    while (added === 0 && attempts < 4) {
                        attempts++;
                        let targetTimestamp = newestTimestamp + (stepDays * 24 * 60 * 60 * 1000);
                        if (targetTimestamp > now) {
                            targetTimestamp = now;
                        }

                        const requestData = [null, targetTimestamp, 80, null, 1, 1];
                        const res = await this.makeApiRequest('lcxiM', requestData, wizData);

                        if (res && Array.isArray(res[0]) && res[0].length > 0) {
                            const rawItems = res[0];
                            const existingKeys = new Set(this.photos.map(p => p.mediaKey).filter(Boolean));
                            const existingFingerprints = new Set(
                                this.photos.map(p => this.getThumbFingerprint(p.bgUrl)).filter(fp => fp && fp.length > 15)
                            );

                            for (const item of rawItems) {
                                const parsed = this.parseLibraryItem(item);
                                if (!parsed) continue;

                                const fp = this.getThumbFingerprint(parsed.bgUrl);
                                const isDuplicate = 
                                    existingKeys.has(parsed.mediaKey) ||
                                    (this.albumPhotoKeys && this.albumPhotoKeys.has(parsed.mediaKey)) ||
                                    (this.albumDedupKeys && parsed.dedupKey && this.albumDedupKeys.has(parsed.dedupKey)) ||
                                    (fp && existingFingerprints.has(fp));

                                if (!isDuplicate) {
                                    this.photos.push(parsed);
                                    existingKeys.add(parsed.mediaKey);
                                    if (fp) existingFingerprints.add(fp);
                                    added++;
                                }
                            }
                        }

                        if (added > 0) {
                            this.newerSearchStepDays = 30;
                            break;
                        }

                        if (targetTimestamp >= now) {
                            this.hasReachedNewestEnd = true;
                            break;
                        }

                        stepDays = stepDays * 3;
                        this.newerSearchStepDays = stepDays;
                    }
                }

                if (added > 0) {
                    log(`[API Context] Fetched ${added} more ${direction} photos from library.`);
                    this.photos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                    this.renderModalPhotos();
                    this.updateModifiedCounter();
                } else {
                    log(`[API Context] No further ${direction} photos returned from Library.`);
                }
                if (onComplete) onComplete(added);
            } catch (err) {
                error(`[API Context] Error loading more ${direction} library photos:`, err);
                if (direction === 'older') this.hasReachedOldestEnd = true;
                if (direction === 'newer') this.hasReachedNewestEnd = true;
                if (onComplete) onComplete(0);
            } finally {
                this.showStreamLoadingIndicator(direction, false);
                this.isLoadingMore = false;
            }
        },

        // --- Step 8: Save Changes via Google Photos API / Batch Handler ---
        handleSaveModalChanges: function () {
            log('====================================================');
            log(`SAVING CHANGES FOR ${this.modifiedTimestamps.size} MODIFIED PHOTOS`);

            if (this.modifiedTimestamps.size === 0) {
                alert('No photo positions or timestamps were changed. Drag photos or move sliders to change their time.');
                return;
            }

            this.showConfirmationModal();
        },

        showConfirmationModal: function () {
            const existing = document.querySelector('.gp-confirm-dialog-overlay');
            if (existing) existing.remove();

            const templates = window.TimTools.Modules.DragInTimeTemplates;
            const confirmOverlay = document.createElement('div');
            confirmOverlay.className = 'gp-confirm-dialog-overlay';

            const isDark = window.TimTools.Theme ? window.TimTools.Theme.isDark() : false;
            confirmOverlay.classList.add(isDark ? 'gp-theme-dark' : 'gp-theme-light', isDark ? 'gp-timtools-theme-dark' : 'gp-timtools-theme-light');

            confirmOverlay.innerHTML = templates.getConfirmModalHtml(this.modifiedTimestamps.size);

            const tbody = confirmOverlay.querySelector('.gp-confirm-table-body');
            const errorBanner = confirmOverlay.querySelector('.gp-confirm-error-banner');
            const cancelBtn = confirmOverlay.querySelector('.gp-confirm-cancel-btn');
            const confirmBtn = confirmOverlay.querySelector('.gp-confirm-save-btn');

            let rowIdx = 1;
            this.modifiedTimestamps.forEach(({ photo, oldDate, newDate }) => {
                const diff = templates.formatDateDiff(oldDate, newDate);

                const row = document.createElement('tr');
                row.style.cssText = `
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    transition: background-color 0.15s;
                `;
                row.onmouseenter = () => { row.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; };
                row.onmouseleave = () => { row.style.backgroundColor = 'transparent'; };

                // Index # cell
                const tdIndex = document.createElement('td');
                tdIndex.style.cssText = `padding: 10px 12px; vertical-align: middle; text-align: center; color: #80868b; font-weight: 600; font-size: 13px; width: 36px;`;
                tdIndex.textContent = String(rowIdx++);

                // Thumbnail cell
                const tdThumb = document.createElement('td');
                tdThumb.style.cssText = `padding: 10px 14px; vertical-align: middle; width: 68px;`;

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

                // Old Date column
                const tdOld = document.createElement('td');
                tdOld.style.cssText = `padding: 10px 16px; vertical-align: middle;`;
                tdOld.innerHTML = `
                    <div class="gp-confirm-old-box" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 6px 12px; font-family: 'Roboto Mono', monospace, sans-serif; font-size: 13px; display: inline-flex; align-items: center;">
                        ${diff.oldHtml}
                    </div>
                `;

                // Arrow column
                const tdArrow = document.createElement('td');
                tdArrow.style.cssText = `padding: 10px 4px; vertical-align: middle; text-align: center; width: 36px;`;
                tdArrow.innerHTML = `
                    <span class="gp-confirm-arrow" style="font-size: 16px; font-weight: bold; display: inline-block;">➔</span>
                `;

                // New Date column
                const tdNew = document.createElement('td');
                tdNew.style.cssText = `padding: 10px 16px; vertical-align: middle;`;
                tdNew.innerHTML = `
                    <div class="gp-confirm-new-box" style="border-radius: 8px; padding: 6px 12px; font-family: 'Roboto Mono', monospace, sans-serif; font-size: 13px; display: inline-flex; align-items: center;">
                        ${diff.newHtml}
                    </div>
                `;

                row.appendChild(tdIndex);
                row.appendChild(tdThumb);
                row.appendChild(tdOld);
                row.appendChild(tdArrow);
                row.appendChild(tdNew);
                tbody.appendChild(row);
            });

            cancelBtn.onclick = () => confirmOverlay.remove();

            confirmBtn.onclick = async () => {
                confirmBtn.disabled = true;
                cancelBtn.disabled = true;
                confirmBtn.style.opacity = '0.7';
                cancelBtn.style.opacity = '0.5';
                confirmBtn.style.cursor = 'not-allowed';
                confirmBtn.textContent = 'Saving to Google Photos...';
                errorBanner.style.display = 'none';

                try {
                    await this.applyBatchDateChanges(this.modifiedTimestamps);

                    confirmBtn.style.backgroundColor = '#81c995';
                    confirmBtn.textContent = '✓ Saved! Reloading page...';
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
                    confirmBtn.textContent = 'Try again';

                    errorBanner.textContent = `Error saving changes: ${err.message || err}`;
                    errorBanner.style.display = 'block';
                }
            };

            confirmOverlay.addEventListener('click', (e) => {
                if (e.target === confirmOverlay && !confirmBtn.disabled) {
                    confirmOverlay.remove();
                }
            });

            document.body.appendChild(confirmOverlay);
        },

        getWizGlobalData: function () {
            return (window.TimTools && window.TimTools.API)
                ? window.TimTools.API.getSessionData()
                : { at: null };
        },

        makeApiRequest: function (rpcid, requestData, sourcePathOrWizData) {
            const sourcePath = typeof sourcePathOrWizData === 'string' ? sourcePathOrWizData : undefined;
            if (window.TimTools && window.TimTools.API) {
                return window.TimTools.API.makeRequest(rpcid, requestData, sourcePath);
            }
            throw new Error('window.TimTools.API is not available');
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
