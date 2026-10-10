window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};
window.TimTools.Modules.KmlExport = window.TimTools.Modules.KmlExport || {};

(function () {
    const logger = window.TimTools.Logger ? window.TimTools.Logger.create('KmlExport') : {
        log: (...args) => console.log('[GP-TimTools][KmlExport]', ...args),
        warn: (...args) => console.warn('[GP-TimTools][KmlExport]', ...args),
        error: (...args) => console.error('[GP-TimTools][KmlExport]', ...args)
    };

    const INFO_BUTTON_SELECTOR = 'div[jscontroller="baFRdd"] button';
    const MAP_LINK_SELECTOR = 'a[jsname="ZOOy2"]';
    const FILENAME_CONTAINER_SELECTOR = 'div[jsname="AFXoCf"]';
    const DATE_CONTAINER_SELECTOR = 'div[jscontroller="uhoNVb"]';

    const Extractor = {
        run: async function (masterId) {
            logger.log('Extraction Mode Started. MasterID:', masterId);

            const waitFor = window.TimTools.DOM.waitFor;

            try {
                // 1. Wait for and Click Info Button
                logger.log('Waiting for info button:', INFO_BUTTON_SELECTOR);
                const infoBtn = await waitFor(INFO_BUTTON_SELECTOR);
                logger.log('Info button found, checking map link...');

                let mapLink = document.querySelector(MAP_LINK_SELECTOR);
                if (!mapLink) {
                    logger.log('Map link not found, clicking info button...');
                    infoBtn.click();
                    // Reduced timeout
                    try {
                        mapLink = await waitFor(MAP_LINK_SELECTOR, 4000);
                    } catch (e) {
                        logger.warn('Map link wait timeout.');
                    }
                }

                if (!mapLink) {
                    throw new Error('Map link not found (no geotag?)');
                }
                logger.log('Map link found:', mapLink.href);

                // 2. Extract Data
                const href = mapLink.href;
                const match = href.match(/loc:([^&]+)/);

                if (!match || !match[1]) {
                    throw new Error('No coordinates in link');
                }

                const coords = match[1];
                logger.log('Coords:', coords);

                // Filename
                let filename = 'Unknown';
                try {
                    const filenameContainer = document.querySelector(FILENAME_CONTAINER_SELECTOR);
                    if (filenameContainer) {
                        const nameDiv = filenameContainer.querySelector('.R9U8ab');
                        if (nameDiv) filename = nameDiv.textContent.trim();
                    }
                } catch (e) { }
                logger.log('Filename:', filename);

                // Date
                let timestamp = Date.now();
                try {
                    let dateStr = "";
                    let timeStr = "";
                    let zoneStr = "";

                    const dateEl = document.querySelector('.R9U8ab[aria-label^="Date taken"], .R9U8ab');
                    if (dateEl) dateStr = dateEl.innerText.trim();

                    const timeEl = document.querySelector('.oBMhZb span[aria-label^="Time taken"]');
                    if (timeEl) timeStr = timeEl.innerText.trim();

                    const zoneEl = document.querySelector('.oBMhZb span[aria-label^="GMT"]');
                    if (zoneEl) zoneStr = zoneEl.innerText.trim();

                    if (!dateStr || !timeStr) {
                        const dateContainer = document.querySelector(DATE_CONTAINER_SELECTOR);
                        if (dateContainer) {
                            const dateDiv = dateContainer.querySelector('div[aria-label^="Date taken"], div[aria-label^="Дата зйомки"]');
                            const timeSpan = dateContainer.querySelector('span[aria-label^="Time taken"], span[aria-label^="Час зйомки"]');
                            if (!dateStr && dateDiv) dateStr = dateDiv.innerText.trim();
                            if (!timeStr && timeSpan) timeStr = timeSpan.innerText.trim();
                        }
                    }

                    if (dateStr) {
                        timestamp = this.parseFlexibleDate(dateStr, timeStr, zoneStr);
                    }
                } catch (e) {
                    logger.warn('Date extraction failed', e);
                }
                logger.log('Timestamp:', timestamp, new Date(timestamp));

                // 3. Send back
                if (!masterId) logger.warn('No masterId provided!');

                logger.log('Sending GP_KML_DATA to Master:', masterId);
                chrome.runtime.sendMessage({
                    type: 'GP_KML_DATA',
                    payload: {
                        filename: filename,
                        coords: coords,
                        timestamp: timestamp,
                        originalUrl: window.location.href.split('?')[0],
                        masterId: masterId
                    }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        logger.error('SendMessage Error:', chrome.runtime.lastError);
                    } else {
                        logger.log('Message sent. Response:', response);
                    }
                });

            } catch (e) {
                logger.error('Extraction Error:', e);
                chrome.runtime.sendMessage({
                    type: 'GP_KML_ERROR',
                    payload: e.message,
                    masterId: masterId
                });
            }
        },

        parseFlexibleDate: function (dateStr, timeStr, zoneStr) {
            // Reusing the robust logic from old script
            let now = new Date();
            const isToday = /Today|Сьогодні/i.test(dateStr) || /Today|Сьогодні/i.test(timeStr);
            const isYesterday = /Yesterday|Вчора/i.test(dateStr) || /Yesterday|Вчора/i.test(timeStr);

            if (isToday || isYesterday) {
                let d = new Date();
                if (isYesterday) d.setDate(d.getDate() - 1);
                if (timeStr) {
                    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
                    if (timeMatch) {
                        let hours = parseInt(timeMatch[1], 10);
                        let minutes = parseInt(timeMatch[2], 10);
                        let seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
                        const meridiem = timeMatch[4];
                        if (meridiem) {
                            if (meridiem.toUpperCase() === 'PM' && hours < 12) hours += 12;
                            if (meridiem.toUpperCase() === 'AM' && hours === 12) hours = 0;
                        }
                        d.setHours(hours, minutes, seconds, 0);
                    }
                }
                return d.getTime();
            }

            if (timeStr) {
                timeStr = timeStr.replace(/^[A-Za-zа-яА-Яii\.]{2,4},\s*/, '');
            }
            if (dateStr && !/\d{4}/.test(dateStr)) {
                dateStr += `, ${now.getFullYear()}`;
            }
            let fullStr = `${dateStr} ${timeStr} ${zoneStr}`.trim();
            let d = new Date(fullStr);
            if (!isNaN(d.getTime())) return d.getTime();

            // UA Months
            const uaMonths = {
                'січ': 0, 'січня': 0, 'лют': 1, 'лютого': 1, 'бер': 2, 'березня': 2,
                'квіт': 3, 'квітня': 3, 'трав': 4, 'травня': 4, 'черв': 5, 'червня': 5,
                'лип': 6, 'липня': 6, 'серп': 7, 'серпня': 7, 'вер': 8, 'вересня': 8,
                'жовт': 9, 'жовтня': 9, 'лист': 10, 'листопада': 10, 'груд': 11, 'грудня': 11
            };
            const uaDateRegex = /(\d{1,2})\s+([а-яА-ЯіІїЇ]+)\.?\s+(\d{4})/;
            const match = dateStr.match(uaDateRegex);

            if (match) {
                const day = parseInt(match[1], 10);
                const monthName = match[2].toLowerCase();
                const year = parseInt(match[3], 10);
                let monthStart = 0;
                for (const [key, val] of Object.entries(uaMonths)) {
                    if (monthName.startsWith(key)) { monthStart = val; break; }
                }
                let hours = 12, minutes = 0, seconds = 0;
                if (timeStr) {
                    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
                    if (timeMatch) {
                        hours = parseInt(timeMatch[1], 10);
                        minutes = parseInt(timeMatch[2], 10);
                        if (timeMatch[3]) seconds = parseInt(timeMatch[3], 10);
                        const meridiem = timeMatch[4];
                        if (meridiem) {
                            if (meridiem.toUpperCase() === 'PM' && hours < 12) hours += 12;
                            if (meridiem.toUpperCase() === 'AM' && hours === 12) hours = 0;
                        }
                    }
                }
                const manualDate = new Date(year, monthStart, day, hours, minutes, seconds);
                return manualDate.getTime();
            }

            const cleanedDateStr = dateStr.replace(/р\.$/, '').trim();
            d = new Date(`${cleanedDateStr} ${timeStr}`);
            if (!isNaN(d.getTime())) return d.getTime();

            return Date.now();
        }
    };

    window.TimTools.Modules.KmlExport.Extractor = Extractor;
})();
