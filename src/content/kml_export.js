// Selector for the toolbar container (Main)
const TOOLBAR_SELECTOR = '.c9yG5b.txMZRd';
// Selector for the inner action buttons container
const TOOLBAR_ACTIONS_SELECTOR = 'div[jscontroller="MHDZYd"]';
// Selector for selected photos in the grid
const SELECTED_PHOTO_SELECTOR = '.rtIMgb.nV0gYe.WjVZdb.R1sU4e';

// Info Button Selector
const INFO_BUTTON_SELECTOR = 'div[jscontroller="baFRdd"] button';
// Map Link Selector
const MAP_LINK_SELECTOR = 'a[jsname="ZOOy2"]';
// Filename Container Selector
const FILENAME_CONTAINER_SELECTOR = 'div[jsname="AFXoCf"]';
// Date Container Selector (often the info panel sidebar)
const DATE_CONTAINER_SELECTOR = 'div[jscontroller="uhoNVb"]';

const LOG_PREFIX = '[TimMapExport]';

function log(msg, data = null) {
    if (data) console.log(`${LOG_PREFIX} ${msg}`, data);
    else console.log(`${LOG_PREFIX} ${msg}`);
}

function warn(msg, data = null) {
    if (data) console.warn(`${LOG_PREFIX} ${msg}`, data);
    else console.warn(`${LOG_PREFIX} ${msg}`);
}

function error(msg, data = null) {
    if (data) console.error(`${LOG_PREFIX} ${msg}`, data);
    else console.error(`${LOG_PREFIX} ${msg}`);
}

function getIconSvg() {
    return chrome.runtime.getURL('assets/icon-timeline-24.png');
}

function getStopIconUrl() {
    return chrome.runtime.getURL('assets/icon-stop-24.png');
}

// === POPUP MANAGER ===
const PopupManager = {
    timerId: null,

    show(current, total, startTime, status = "Processing...") {
        this.render(current, total, startTime, status);
        this.startTimer(current, total, startTime, status);
    },

    update(current, total, startTime, status) {
        this.render(current, total, startTime, status);
    },

    close() {
        if (this.timerId) clearInterval(this.timerId);
        const popup = document.getElementById('gp-processing-popup');
        if (popup) popup.remove();
    },

    render(current, total, startTime, status) {
        let existing = document.getElementById('gp-processing-popup');
        const stopIcon = getStopIconUrl();
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
            // Initial Structure
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

            // Attach Stop Listener ONCE
            const btn = document.getElementById('gp-stop-btn');
            if (btn) {
                btn.onclick = () => {
                    const masterId = new URL(window.location.href).searchParams.get('gp_master_id');

                    // Notify system
                    chrome.runtime.sendMessage({
                        type: 'STOP_EXTRACT',
                        childTabId: childTabId,
                        masterId: masterId
                    });

                    // If Master, stop immediately. If Child, also stop/close.
                    stopProcessing();
                };
                btn.onmouseover = () => btn.style.opacity = "1";
                btn.onmouseout = () => btn.style.opacity = "0.8";
            }
        }

        // DOM Updates
        const elStatus = document.getElementById('gp-msg-status');
        const elCount = document.getElementById('gp-msg-count');
        const elTime = document.getElementById('gp-msg-time');
        const elBar = document.getElementById('gp-msg-bar');

        if (elStatus) elStatus.textContent = status;
        if (elCount) elCount.textContent = `${current}/${total} done`;
        if (elTime) elTime.textContent = timeDetails;
        if (elBar) elBar.style.width = `${percent}%`;
    },

    startTimer(current, total, startTime, status) {
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = setInterval(() => {
            // We only need to re-render to update the time text
            // `current` and `total` won't change inside this interval, but `elapsed` will
            this.render(current, total, startTime, status);
        }, 1000);
    },

    formatTime(ms) {
        if (ms < 0) return "0s";
        const s = Math.floor(ms / 1000) % 60;
        const m = Math.floor(ms / 60000);
        return `${m}m ${s}s`;
    }
};

// === STATE MANAGEMENT ===
let photoQueue = [];
let extractedData = [];
let isProcessing = false;
let childTabId = null; // Tracked locally in Master
let startTime = 0;



// === GRID PAGE LOGIC ===

function handleExportClick() {
    if (isProcessing) {
        alert('Already processing photos. Please wait.');
        return;
    }

    // Find all selected photos
    const selectedPhotos = document.querySelectorAll(SELECTED_PHOTO_SELECTOR);

    if (selectedPhotos.length === 0) {
        alert('No photos selected!');
        return;
    }

    photoQueue = [];
    extractedData = [];

    selectedPhotos.forEach(photoDiv => {
        const linkElement = photoDiv.querySelector('a');
        if (linkElement && linkElement.href) {
            photoQueue.push(linkElement.href);
        }
    });

    if (photoQueue.length === 0) {
        alert('No valid photo links found.');
        return;
    }

    if (!confirm(`Found ${photoQueue.length} photos. Start processing? Please keep this tab open.`)) {
        return;
    }

    isProcessing = true;
    startTime = Date.now();
    showToast(`Starting... 0/${photoQueue.length}`);
    log(`Starting batch process for ${photoQueue.length} photos.`);

    // Open the child window via Background Script (to keep focus)
    // Add progress stats
    const total = photoQueue.length; // Initial total
    const current = 0; // Initial current

    // Show popup on Master Tab too
    PopupManager.show(current, total, startTime, "Starting batch...");

    openNextPhotoInChild(current, total);
}

function openNextPhotoInChild(current, total) {
    if (photoQueue.length === 0) {
        finishProcessing();
        return;
    }

    // Check if stopped
    if (!isProcessing) return;

    const nextUrl = photoQueue.shift(); // Get next URL
    const urlObj = new URL(nextUrl);

    // Use Hash Params to avoid stripping by Google Photos redirects
    const hashParams = new URLSearchParams();
    hashParams.set('gp_kml_extract', 'true');
    hashParams.set('gp_current', current + 1);
    hashParams.set('gp_total', total);
    hashParams.set('gp_start_time', startTime);

    urlObj.hash = hashParams.toString();

    // Legacy: Clear search params just in case they conflict or trigger something
    // urlObj.search = '';

    log(`Requesting background tab for: ${nextUrl} (${current + 1}/${total})`);

    PopupManager.update(current, total, startTime, "Opening next photo...");

    chrome.runtime.sendMessage({
        type: 'OPEN_EXTRACT_TAB',
        url: urlObj.toString(),
        existingTabId: childTabId
    }, (response) => {
        if (response && response.tabId) {
            childTabId = response.tabId;
        } else {
            // If response is undefined, background might not be sending response or created new tab
            // We can proceed, next message will fix it or we rely on background handling
            // But ideally we capture it
        }
    });
}

function finishProcessing() {
    isProcessing = false;
    PopupManager.close();

    showToast('Generating KML...');
    log('Processing complete. Raw data:', extractedData);

    chrome.runtime.sendMessage({ type: 'CLOSE_EXTRACT_TAB', tabId: childTabId });
    childTabId = null;

    if (extractedData.length > 0) {
        // Sort by date (oldest first) so the line is drawn correctly
        extractedData.sort((a, b) => a.timestamp - b.timestamp);

        const kmlContent = generateKML(extractedData);
        downloadKML(kmlContent, extractedData[0].timestamp);
    } else {
        alert('No data extracted.');
    }
}

// Listen for messages from Background Script (relayed from Child)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === 'GP_LOG') {
        console.log(`[TimMapExport] ${message.payload}`); // Log message from background
        return;
    }

    log('Master received message:', message);

    if (message.type === 'GP_KML_DATA') {
        extractedData.push(message.payload);
        log('Received data via background:', message.payload);

        // Compute progress for next step
        const total = extractedData.length + photoQueue.length + 1; // +1 includes the one we are about to pop
        const current = extractedData.length + 1;

        // Update Popup on Master
        PopupManager.show(current, total, startTime, "Photo extracted");

        // Wait a small delay then go to next
        setTimeout(() => openNextPhotoInChild(current, total), 500);

    } else if (message.type === 'GP_KML_ERROR') {
        warn('Skipping photo due to error:', message.payload);

        const total = extractedData.length + photoQueue.length + 1;
        const current = extractedData.length + 1;

        // Update Popup on Master even on error
        PopupManager.show(current, total, startTime, "Error extracting, skipping...");

        setTimeout(() => openNextPhotoInChild(current, total), 500);

    } else if (message.type === 'STOP_EXTRACT') {
        log('Received STOP command.');
        stopProcessing();
    }
});

function stopProcessing() {
    if (!isProcessing && !document.getElementById('gp-processing-popup')) return; // Already stopped

    isProcessing = false;
    PopupManager.close();

    // If we are the Child (have masterId in URL), we should close ourselves
    // Check both Hash and Search for robustness
    const curHParams = new URLSearchParams(window.location.hash.substring(1));
    const curSParams = new URL(window.location.href).searchParams;
    const masterId = curHParams.get('gp_master_id') || curSParams.get('gp_master_id');

    if (masterId) {
        log('Stop clicked in Child mode. Sending signal and closing...');
        // Notify Background/Master FIRST
        chrome.runtime.sendMessage({
            type: 'STOP_EXTRACT',
            childTabId: childTabId,
            masterId: masterId
        });

        // Give a tiny buffer for the message to leave the content script before killing the process
        setTimeout(() => {
            window.close();
        }, 300);
        return;
    }

    if (childTabId) {
        chrome.runtime.sendMessage({ type: 'CLOSE_EXTRACT_TAB', tabId: childTabId });
        childTabId = null;
    }

    showToast('Processing Stopped by User.');
}


// === KML GENERATION ===

function generateKML(points) {
    // Generate name from first point
    let docName = "Google Photos Selection";
    if (points.length > 0) {
        docName = `GPhotos_Export_${formatDateForFilename(points[0].timestamp)}`;
    }

    const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${docName}</name>
    <Style id="yellowLineGreenPoly">
      <LineStyle>
        <color>7f00ffff</color>
        <width>4</width>
      </LineStyle>
      <PolyStyle>
        <color>7f00ff00</color>
      </PolyStyle>
    </Style>
    <Style id="smallPoint">
      <IconStyle>
        <scale>0.5</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
`;
    const kmlFooter = `
  </Document>
</kml>`;

    let body = "";

    // 1. LineString (Path)
    let coordinatesString = "";
    points.forEach(p => {
        const [lat, lon] = p.coords.split(',');
        coordinatesString += `${lon},${lat},0\n`;
    });

    body += `
    <Placemark>
      <name>Route</name>
      <styleUrl>#yellowLineGreenPoly</styleUrl>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>
          ${coordinatesString}
        </coordinates>
      </LineString>
    </Placemark>
    `;

    // 2. Points
    points.forEach(p => {
        const [lat, lon] = p.coords.split(',');
        // Format date for display
        const d = new Date(p.timestamp);
        // Format: 2026.12.30., 23:59 GMT+01:00
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        // We don't strictly know the original string zone here unless we passed it, 
        // but we can try to reconstruct or just leave it generic.
        // Actually, we can just use the user's requested format structure.

        const dateLine = `${year}.${month}.${day}., ${hours}:${mins}`;

        const description = `
          <![CDATA[
            ${p.filename}<br>
            ${dateLine}<br>
            <a href="${p.originalUrl}">Google Photo Link</a>
          ]]>
        `;

        body += `
    <Placemark>
      <name>${p.filename}</name>
      <description>${description}</description>
      <styleUrl>#smallPoint</styleUrl>
      <Point>
        <coordinates>${lon},${lat},0</coordinates>
      </Point>
    </Placemark>`;
    });

    return kmlHeader + body + kmlFooter;
}

function downloadKML(content, firstTimestamp) {
    const blob = new Blob([content], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Filename format: GPhotos2kml_YYYY-MM-DD_12-00-00.kml
    const filename = `GPhotos2kml_${formatDateForFilename(firstTimestamp)}.kml`;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatDateForFilename(timestamp) {
    const d = new Date(timestamp);
    const p = val => val.toString().padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}


// === UI INJECTION ===

function injectButton(toolbar) {
    if (toolbar.querySelector('.gp-kml-export-container')) {
        return;
    }

    const container = document.createElement('div');
    container.className = 'DNAsC G6iPcb gp-kml-export-container';

    const button = document.createElement('button');
    button.className = 'gp-kml-export-btn';
    button.title = 'Export Selected to KML';
    button.ariaLabel = 'Export KML';

    const iconUrl = getIconSvg();
    const icon = document.createElement('img');
    icon.src = iconUrl;
    // Removed opacity as requested
    icon.style.cssText = 'width: 24px; height: 24px;';

    button.appendChild(icon);
    button.addEventListener('click', handleExportClick);

    container.appendChild(button);

    // Try to find the inner actions container first
    const actionsContainer = toolbar.querySelector(TOOLBAR_ACTIONS_SELECTOR);
    if (actionsContainer) {
        // Insert at the beginning of the actions container
        actionsContainer.prepend(container);
        log('Button Injected into actions container');
    } else {
        // Fallback to main toolbar
        toolbar.prepend(container);
        log('Button Injected into main toolbar (fallback)');
    }
}

// === DETAIL PAGE (AUTOMATION) LOGIC ===

async function runExtraction(masterId) {
    log('Extraction Mode Started in Child Window');
    // We do NOT re-parse URL heare as it might have changed. Use passed masterId.

    const waitFor = (selector, timeout = 10000) => {
        return new Promise((resolve, reject) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);

            log(`Waiting for ${selector}...`);
            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timeout waiting for ${selector}`));
            }, timeout);
        });
    };

    try {
        // No longer checking window.opener directly as we use Messaging
        // But we can check if we are in expected mode


        // 1. Wait for and Click Info Button
        log('Looking for Info button...');
        const infoBtn = await waitFor(INFO_BUTTON_SELECTOR);

        let mapLink = document.querySelector(MAP_LINK_SELECTOR);
        if (!mapLink) {
            log('Map link not found immediately. Clicking Info button.');
            infoBtn.click();
            log('Waiting for Map link to appear...');
            // Reduced timeout to 4000ms (4s) for faster skipping of non-geotagged photos
            mapLink = await waitFor(MAP_LINK_SELECTOR, 4000);
        } else {
            log('Map link found immediately.');
        }

        // 2. Extract Data
        const href = mapLink.href;
        log(`Found map link: ${href}`);
        const match = href.match(/loc:([^&]+)/);

        // Extract Filename
        let filename = 'Unknown';
        try {
            const filenameContainer = document.querySelector(FILENAME_CONTAINER_SELECTOR);
            if (filenameContainer) {
                const nameDiv = filenameContainer.querySelector('.R9U8ab');
                if (nameDiv) {
                    filename = nameDiv.textContent.trim();
                }
            }
            log(`Extracted filename: ${filename}`);
        } catch (e) {
            warn('Filename extraction failed', e);
        }

        // Extract Date
        let timestamp = Date.now();
        try {
            // New Selectors based on user snippet
            // Date: <div class="R9U8ab" jsname="pG3jE" aria-label="Date taken: Feb 1">Feb 1</div>
            // Time: <span class="sprMUb" aria-label="Time taken: Yesterday, 11:36 PM">Yesterday, 11:36 PM</span>

            // Try specific classes first (more reliable if structure matches snippet)
            let dateStr = "";
            let timeStr = "";
            let zoneStr = "";

            const dateEl = document.querySelector('.R9U8ab[aria-label^="Date taken"], .R9U8ab');
            if (dateEl) dateStr = dateEl.innerText.trim();

            const timeEl = document.querySelector('.oBMhZb span[aria-label^="Time taken"]');
            if (timeEl) timeStr = timeEl.innerText.trim();

            const zoneEl = document.querySelector('.oBMhZb span[aria-label^="GMT"]');
            if (zoneEl) zoneStr = zoneEl.innerText.trim();

            // Fallback to generic container search if specific classes fail
            if (!dateStr || !timeStr) {
                const dateContainer = document.querySelector(DATE_CONTAINER_SELECTOR);
                if (dateContainer) {
                    const dateDiv = dateContainer.querySelector('div[aria-label^="Date taken"], div[aria-label^="Дата зйомки"]');
                    const timeSpan = dateContainer.querySelector('span[aria-label^="Time taken"], span[aria-label^="Час зйомки"]');
                    const zoneSpan = dateContainer.querySelector('span[aria-label^="GMT"]');

                    if (!dateStr && dateDiv) dateStr = dateDiv.innerText.trim();
                    if (!timeStr && timeSpan) timeStr = timeSpan.innerText.trim();
                    if (!zoneStr && zoneSpan) zoneStr = zoneSpan.innerText.trim();
                }
            }

            if (dateStr) {
                // Logic moved to parseFlexibleDate to keep this clean
                timestamp = parseFlexibleDate(dateStr, timeStr, zoneStr);
                log(`Extracted Date: "${dateStr}" Time: "${timeStr}" Zone: "${zoneStr}" -> Timestamp: ${timestamp}`);
            }
        } catch (e) {
            warn('Date extraction failed', e);
        }

        if (match && match[1]) {
            const coords = match[1];
            log(`Extracted coords: ${coords}`);

            // 3. Send back to background -> parent
            if (!masterId) {
                warn('WARNING: masterId is missing (passed arg)! This will cause routing errors.');
            }

            chrome.runtime.sendMessage({
                type: 'GP_KML_DATA',
                payload: {
                    filename: filename,
                    coords: coords,
                    timestamp: timestamp,
                    originalUrl: window.location.href.split('?')[0],
                    masterId: masterId // Pass back the ID from URL
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    error('FAILED to send to Background:', chrome.runtime.lastError);
                } else {
                    log('Data sent to Background. Response:', response);
                }
            });
            log('Sent data to background.');

            // Keep window open, waiting for background to update URL
        } else {
            throw new Error('No coordinates regex match in link: ' + href);
        }

    } catch (e) {
        error('Extraction Error:', e);
        chrome.runtime.sendMessage({
            type: 'GP_KML_ERROR',
            payload: e.message,
            masterId: masterId
        });
    }
}


function parseFlexibleDate(dateStr, timeStr, zoneStr) {
    let now = new Date();

    // 0. Handle Relative Descriptors in Date or Time strings
    // "Yesterday, 11:36 PM" -> "Yesterday"
    // Check both dateStr and timeStr for "Today"/"Yesterday" keywords
    const isToday = /Today|Сьогодні/i.test(dateStr) || /Today|Сьогодні/i.test(timeStr);
    const isYesterday = /Yesterday|Вчора/i.test(dateStr) || /Yesterday|Вчора/i.test(timeStr);

    if (isToday || isYesterday) {
        let d = new Date();
        if (isYesterday) d.setDate(d.getDate() - 1);

        // Extract time from timeStr if possible
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

    // 1. Clean Inputs
    // Remove "Mon, ", "Sun, " etc. from timeStr
    if (timeStr) {
        timeStr = timeStr.replace(/^[A-Za-zа-яА-Яii\.]{2,4},\s*/, '');
    }

    // 2. Implied Year Logic (e.g. "Feb 1")
    // If dateStr doesn't have a year (4 digits), append current year
    if (dateStr && !/\d{4}/.test(dateStr)) {
        dateStr += `, ${now.getFullYear()}`;
    }

    // 3. Try standard JS parsing first
    let fullStr = `${dateStr} ${timeStr} ${zoneStr}`.trim();
    let d = new Date(fullStr);
    if (!isNaN(d.getTime())) return d.getTime();

    // 4. Ukrainian Month Mapping
    const uaMonths = {
        'січ': 0, 'січня': 0,
        'лют': 1, 'лютого': 1,
        'бер': 2, 'березня': 2,
        'квіт': 3, 'квітня': 3,
        'трав': 4, 'травня': 4,
        'черв': 5, 'червня': 5,
        'лип': 6, 'липня': 6,
        'серп': 7, 'серпня': 7,
        'вер': 8, 'вересня': 8,
        'жовт': 9, 'жовтня': 9,
        'лист': 10, 'листопада': 10,
        'груд': 11, 'грудня': 11
    };

    // Example UA format: "19 трав. 2024 р." or "1 січня 2023"
    // Regex for: DD Month YYYY
    const uaDateRegex = /(\d{1,2})\s+([а-яА-ЯіІїЇ]+)\.?\s+(\d{4})/;
    const match = dateStr.match(uaDateRegex);

    if (match) {
        const day = parseInt(match[1], 10);
        const monthName = match[2].toLowerCase();
        const year = parseInt(match[3], 10);

        // Find month index
        let monthStart = 0;
        for (const [key, val] of Object.entries(uaMonths)) {
            if (monthName.startsWith(key)) {
                monthStart = val;
                break;
            }
        }

        // Parse Time (HH:MM or HH:MM AM/PM)
        let hours = 12, minutes = 0, seconds = 0;
        if (timeStr) {
            // Try "14:20" or "2:20 PM"
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

    // 5. Fallback: try removing common suffixes like "р." (roku)
    const cleanedDateStr = dateStr.replace(/р\.$/, '').trim();
    d = new Date(`${cleanedDateStr} ${timeStr}`);
    if (!isNaN(d.getTime())) return d.getTime();

    // 6. Last resort: Return now (but log warning previously)
    return Date.now();
}


// === MAIN ENTRY POINT ===

log(`Script loaded on ${window.location.href}`);

try {
    const urlParams = new URL(window.location.href).searchParams;
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const getParam = (key) => hashParams.get(key) || urlParams.get(key);

    const hasUrlParam = getParam('gp_kml_extract') === 'true';
    const isWindowTarget = window.name === 'gp_extractor_window';

    // Trigger if URL flag is present OR if we are in the designated child window
    const isExtractMode = hasUrlParam || isWindowTarget;

    log(`Mode Check: Param=${hasUrlParam}, WindowName=${window.name}, ExtractMode=${isExtractMode}`);

    if (isExtractMode) {
        log('Registering load listener for extraction...');

        // Read values immediately to preserve state
        const current = parseInt(getParam('gp_current') || '0', 10);
        const total = parseInt(getParam('gp_total') || '1', 10);
        const startTimeVal = parseInt(getParam('gp_start_time') || Date.now(), 10);
        const masterId = getParam('gp_master_id');

        if (!masterId) log('WARNING: No masterId found in URL via gp_master_id.');

        const initChildUI = () => {
            PopupManager.show(current - 1, total, startTimeVal, "Loading page...");
        };

        if (document.body) {
            initChildUI();
        } else {
            document.addEventListener('DOMContentLoaded', initChildUI);
        }

        const startExtraction = () => {
            log('Starting extraction sequence...');
            PopupManager.update(current - 1, total, startTimeVal, "Extracting data...");
            // Removed delay to speed up processing
            runExtraction(masterId);
            PopupManager.update(current, total, startTimeVal, "Data extracted!");
        };

        if (document.readyState === 'complete') {
            log('Document complete. Starting...');
            startExtraction();
        } else {
            window.addEventListener('load', () => {
                log('Window load fired. Starting...');
                startExtraction();
            });
        }
    } else {
        // Grid Mode (Master)
        // Only run grid observer if we are NOT in extraction mode
        log('Initializing Grid Mode (Master)...');

        const initMaster = () => {
            const observer = new MutationObserver((mutations) => {
                const toolbar = document.querySelector(TOOLBAR_SELECTOR);
                if (toolbar) {
                    injectButton(toolbar);
                }
            });
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
                const initialToolbar = document.querySelector(TOOLBAR_SELECTOR);
                if (initialToolbar) injectButton(initialToolbar);
            } else {
                warn('document.body missing during initMaster!');
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initMaster);
        } else {
            initMaster();
        }
    }
} catch (e) {
    console.error('[TimMapExport] Critical initialization error:', e);
}

function showToast(message) {
    const existing = document.getElementById('gp-kml-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'gp-kml-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 24px;
        background: #323232;
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        z-index: 10000;
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    if (!message.startsWith('Processing') && !message.startsWith('Starting')) {
        setTimeout(() => { toast.remove(); }, 3000);
    }
}
