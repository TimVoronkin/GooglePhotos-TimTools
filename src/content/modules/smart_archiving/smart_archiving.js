window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
    const LOG_PREFIX = '[GP-TimTools][SmartArchiving]';

    function log(...args) {
        console.log(LOG_PREFIX, ...args);
    }

    function warn(...args) {
        console.warn(LOG_PREFIX, ...args);
    }

    function error(...args) {
        console.error(LOG_PREFIX, ...args);
    }

    const SVG_FILTER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-160q-17 0-28.5-11.5T400-200v-240L168-736q-15-20-4.5-42t36.5-22h560q26 0 36.5 22t-4.5 42L560-440v240q0 17-11.5 28.5T520-160h-80Zm40-308 198-252H282l198 252Zm0 0Z"/></svg>`;
    const SVG_EDIT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>`;

    // Google Material Icons for Switch Thumb
    const SVG_ICON_ARCHIVE = `<svg viewBox="0 0 24 24"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>`;
    const SVG_ICON_IMAGE = `<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;

    const SmartArchiving = {
        initialized: false,
        headerObserver: null,
        popoverEl: null,
        buttonEl: null,
        isOpen: false,
        isEditMode: false,
        isAutoSyncMode: false,
        isLoadingAlbums: false,
        isProcessing: false,
        cachedWizData: null,

        // Filter state: array of { albumMediaKey, albumTitle, itemCount, enabled }
        filters: [],
        workingToggles: new Map(), // albumMediaKey -> boolean (temporary UI state)
        allUserAlbums: [], // cached list of all user albums for edit mode
        editSelectedKeys: new Set(), // Set of albumMediaKeys selected in edit mode

        init: async function () {
            if (this.initialized) return;
            this.initialized = true;
            log('Initializing Smart Archiving module...');

            // Load saved filters (scoped to active account)
            await this.loadFilters();

            // Start DOM observer to inject the button in the header
            this.startHeaderObserver();

            // Auto-check on page load: archive photos from disabled filters (e.g. photos added from phone)
            setTimeout(() => {
                this.performAutoCheck();
            }, 3500);


            document.addEventListener('click', (e) => {
                if (!this.isOpen) return;
                const isBtn = this.buttonEl && this.buttonEl.contains(e.target);
                const isPopover = this.popoverEl && this.popoverEl.contains(e.target);
                if (!isBtn && !isPopover) {
                    this.closePopover();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (this.isOpen && e.key === 'Escape') {
                    this.closePopover();
                }
            });

            // Reposition on window resize or scroll to stay attached
            window.addEventListener('resize', () => {
                if (this.isOpen) this.updatePopoverPosition();
            });
            window.addEventListener('scroll', () => {
                if (this.isOpen) this.updatePopoverPosition();
            }, true);
        },

        // --- Session / RPC Helpers ---
        getWizGlobalData: function () {
            if (this.cachedWizData && this.cachedWizData.at) {
                return this.cachedWizData;
            }

            let at = null, fsid = null, bl = null, path = null, account = null;

            if (typeof window !== 'undefined' && window.WIZ_global_data) {
                const w = window.WIZ_global_data;
                at = w.SNlM0e || null;
                fsid = w.FdrFJe || null;
                bl = w.cfb2h || null;
                path = w.eptZe || null;
                account = w.oPEP7c || w.S06Grb || null;
            }

            if (!at) {
                try {
                    const scripts = document.querySelectorAll('script');
                    for (let s of scripts) {
                        const content = s.textContent || '';
                        if (content.includes('WIZ_global_data') || content.includes('SNlM0e')) {
                            const atMatch = content.match(/"SNlM0e":"([^"]+)"/);
                            const fsidMatch = content.match(/"FdrFJe":"([^"]+)"/);
                            const blMatch = content.match(/"cfb2h":"([^"]+)"/);
                            const pathMatch = content.match(/"eptZe":"([^"]+)"/);
                            const accMatch = content.match(/"oPEP7c":"([^"]+)"/) || content.match(/"S06Grb":"([^"]+)"/);

                            if (atMatch) at = atMatch[1];
                            if (fsidMatch) fsid = fsidMatch[1];
                            if (blMatch) bl = blMatch[1];
                            if (pathMatch) path = pathMatch[1];
                            if (accMatch) account = accMatch[1];
                            if (at) break;
                        }
                    }
                } catch (e) {
                    warn('Error parsing script tags for WIZ_global_data:', e);
                }
            }

            const res = { at, fsid, bl, path, account };
            if (at) {
                this.cachedWizData = res;
            }
            return res;
        },

        getAccountIdentifier: function () {
            const wiz = this.getWizGlobalData();
            if (wiz && wiz.account) {
                return String(wiz.account).trim();
            }

            try {
                const accountEl = document.querySelector('a[href*="SignOutOptions"], a[aria-label*="@"]');
                if (accountEl) {
                    const label = accountEl.getAttribute('aria-label') || '';
                    const emailMatch = label.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                    if (emailMatch) return emailMatch[1].toLowerCase();
                }
            } catch (e) {}

            const uMatch = window.location.pathname.match(/\/u\/(\d+)/);
            if (uMatch) {
                return `u${uMatch[1]}`;
            }

            return 'default_account';
        },

        loadFilters: async function () {
            const settings = await window.TimTools.Settings.getAll();
            const accountKey = this.getAccountIdentifier();
            log(`Loading filters for account [${accountKey}]...`);

            const byAccount = settings.smartArchivingFiltersByAccount || {};
            if (Array.isArray(byAccount[accountKey])) {
                this.filters = byAccount[accountKey];
            } else if (Array.isArray(settings.smartArchivingFilters) && settings.smartArchivingFilters.length > 0) {
                // Migration: adopt existing legacy filters for this account
                this.filters = settings.smartArchivingFilters;
                byAccount[accountKey] = this.filters;
                window.TimTools.Settings.set({ smartArchivingFiltersByAccount: byAccount });
            } else {
                this.filters = [];
            }
            log(`Loaded ${this.filters.length} filters for account [${accountKey}]:`, this.filters);
            return this.filters;
        },

        saveFilters: async function () {
            const accountKey = this.getAccountIdentifier();
            const settings = await window.TimTools.Settings.getAll();
            const byAccount = settings.smartArchivingFiltersByAccount || {};
            byAccount[accountKey] = this.filters;

            await window.TimTools.Settings.set({
                smartArchivingFiltersByAccount: byAccount,
                smartArchivingFilters: this.filters // sync legacy key as well
            });
            log(`Saved ${this.filters.length} filters for account [${accountKey}].`);
        },

        makeApiRequest: async function (rpcid, requestData) {
            const wizData = this.getWizGlobalData();
            if (!wizData || !wizData.at) {
                throw new Error('Google Photos session token (XSRF / SNlM0e) not found. Please ensure you are logged into Google Photos.');
            }

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

        // Fetch all user albums using RPC Z5xsfc
        fetchUserAlbums: async function () {
            log('Fetching user albums via RPC Z5xsfc...');
            const albums = [];
            let pageId = null;
            let pageCount = 0;

            do {
                const requestData = [pageId, null, null, null, 1, null, null, 100, [2], 5];
                const res = await this.makeApiRequest('Z5xsfc', requestData);
                if (!res || !Array.isArray(res[0])) {
                    break;
                }

                const rawItems = res[0];
                for (let item of rawItems) {
                    const mediaKey = item?.[0];
                    const infoObj = item?.at(-1)?.[72930366];
                    const title = infoObj?.[1] || 'Untitled Album';
                    const itemCount = infoObj?.[3] ?? 0;

                    if (mediaKey) {
                        albums.push({ mediaKey, title, itemCount });
                    }
                }

                pageId = res[1] || null;
                pageCount++;
            } while (pageId && pageCount < 5); // limit up to 500 albums

            log(`Fetched ${albums.length} user albums.`);
            return albums;
        },

        // Fetch single album item count via RPC snAcKc
        fetchSingleAlbumCount: async function (albumMediaKey) {
            try {
                const res = await this.makeApiRequest('snAcKc', [albumMediaKey, null, null, null]);
                if (!res) return null;
                const count = res?.[3]?.[21] ?? (Array.isArray(res?.[1]) ? res[1].length : null);
                return typeof count === 'number' ? count : 0;
            } catch (e) {
                warn(`Failed to fetch count for album ${albumMediaKey}:`, e);
                return null;
            }
        },

        // Fetch all photo dedupKeys inside an album using RPC snAcKc
        fetchAlbumDedupKeys: async function (albumMediaKey) {
            log(`Fetching photo keys for album [${albumMediaKey}] via RPC snAcKc...`);
            const dedupKeys = [];
            let pageId = null;
            let pageCount = 0;

            do {
                const requestData = [albumMediaKey, pageId, null, null];
                const res = await this.makeApiRequest('snAcKc', requestData);
                if (!res || !Array.isArray(res[1])) {
                    break;
                }

                const rawItems = res[1];
                for (let item of rawItems) {
                    const dedupKey = item?.[3] || item?.[0];
                    if (dedupKey) {
                        dedupKeys.push(dedupKey);
                    }
                }

                pageId = res[2] || null;
                pageCount++;
            } while (pageId && pageCount < 20); // support up to thousands of photos

            log(`Album [${albumMediaKey}] has ${dedupKeys.length} photos.`);
            const filter = this.filters.find(f => f.albumMediaKey === albumMediaKey);
            if (filter) {
                filter.itemCount = dedupKeys.length;
            }
            return dedupKeys;
        },

        // Bulk Archive / Unarchive using RPC w7TP3c with chunking (50 items per batch)
        batchSetArchive: async function (dedupKeys, isArchive, onProgress) {
            if (!dedupKeys || dedupKeys.length === 0) return 0;
            const actionCode = isArchive ? 1 : 2; // 1 = Archive, 2 = Unarchive
            const CHUNK_SIZE = 50;
            let processed = 0;

            log(`batchSetArchive: ${isArchive ? 'Archiving' : 'Unarchiving'} ${dedupKeys.length} items in chunks of ${CHUNK_SIZE}...`);

            for (let i = 0; i < dedupKeys.length; i += CHUNK_SIZE) {
                const chunk = dedupKeys.slice(i, i + CHUNK_SIZE);
                const mappedKeys = chunk.map((key) => [null, [actionCode], [null, key]]);
                const requestData = [mappedKeys, null, 1];

                await this.makeApiRequest('w7TP3c', requestData);
                processed += chunk.length;

                if (typeof onProgress === 'function') {
                    onProgress(processed, dedupKeys.length);
                }

                // Small delay between chunks to avoid rate limiting
                if (i + CHUNK_SIZE < dedupKeys.length) {
                    await new Promise((r) => setTimeout(r, 120));
                }
            }

            return processed;
        },

        getStoredArchivedKeys: function () {
            const accountKey = this.getAccountIdentifier();
            const storageKey = `sa_archived_keys_${accountKey}`;
            return new Promise((resolve) => {
                chrome.storage.local.get([storageKey, 'smartArchivingActiveArchivedKeys'], (result) => {
                    const keys = result[storageKey] !== undefined ? result[storageKey] : (result.smartArchivingActiveArchivedKeys || null);
                    resolve(keys);
                });
            });
        },

        setStoredArchivedKeys: function (keysArray) {
            const accountKey = this.getAccountIdentifier();
            const storageKey = `sa_archived_keys_${accountKey}`;
            return new Promise((resolve) => {
                chrome.storage.local.set({ [storageKey]: keysArray, smartArchivingActiveArchivedKeys: keysArray }, () => {
                    resolve();
                });
            });
        },

        // Auto-check on page load: detect changes in filter albums, archive new ones and unarchive removed ones
        performAutoCheck: async function () {
            if (this.filters.length === 0) return;
            if (this.isOpen) {
                log('Auto-check: Menu is currently open, skipping auto-check.');
                return;
            }

            log('Auto-check: Scanning filter albums for changes...');
            try {
                const disabledFilters = this.filters.filter(f => !f.enabled);
                const currentOffSet = new Set();
                for (let filter of disabledFilters) {
                    const keys = await this.fetchAlbumDedupKeys(filter.albumMediaKey);
                    keys.forEach(k => currentOffSet.add(k));
                }

                const prevArchivedKeys = await this.getStoredArchivedKeys();

                let toArchive = [];
                let toUnarchive = [];

                if (prevArchivedKeys === null) {
                    // First run on this browser or fresh install:
                    // Initialize the baseline with currentOffSet without redundant archiving,
                    // as these photos are already in their desired state from previous configuration.
                    await this.setStoredArchivedKeys(Array.from(currentOffSet));
                    log(`Auto-check: Initialized baseline on this device with ${currentOffSet.size} keys.`);
                    return;
                } else {
                    const prevSet = new Set(prevArchivedKeys);
                    // Photos currently in disabled albums that were not previously archived
                    toArchive = Array.from(currentOffSet).filter(k => !prevSet.has(k));
                    // Photos previously archived that are no longer in any disabled album
                    toUnarchive = prevArchivedKeys.filter(k => !currentOffSet.has(k));
                }

                log(`Auto-check result: ${toArchive.length} to archive, ${toUnarchive.length} to unarchive.`);

                if (toArchive.length === 0 && toUnarchive.length === 0) {
                    // No changes detected! Quietly keep stored keys in sync
                    await this.setStoredArchivedKeys(Array.from(currentOffSet));
                    log('Auto-check: No photo changes detected. Staying quiet.');
                    return;
                }

                // Wait until header button exists to anchor the popover
                let retries = 0;
                while (!this.buttonEl && retries < 25) {
                    await new Promise(r => setTimeout(r, 200));
                    retries++;
                }

                if (!this.buttonEl) {
                    log('Auto-check: Header button not ready, skipping auto-sync popup.');
                    return;
                }

                if (this.isOpen) return;

                // Changes detected! Open auto-sync mode popup
                this.openAutoSyncMode(toArchive, toUnarchive, currentOffSet);

            } catch (err) {
                warn('Auto-check failed with error:', err);
            }
        },

        openAutoSyncMode: function (toArchive, toUnarchive, currentOffSet) {
            this.isOpen = true;
            this.isEditMode = false;
            this.isAutoSyncMode = true;

            this.renderPopover();

            // Run execution
            this.executeAutoSync(toArchive, toUnarchive, currentOffSet);
        },

        renderAutoSyncMode: function (container) {
            // Header with title only (no filter count badge)
            const header = document.createElement('div');
            header.className = 'gp-smart-archive-header';
            header.innerHTML = `
                <div class="gp-smart-archive-title">
                    ${SVG_FILTER_ICON}
                    <span>Smart Archiving</span>
                </div>
            `;
            container.appendChild(header);

            // Progress bar container (active)
            const progressContainer = document.createElement('div');
            progressContainer.className = 'gp-sa-progress-container active';
            progressContainer.id = 'gp-sa-auto-progress-container';
            progressContainer.innerHTML = `
                <div class="gp-sa-progress-bar">
                    <div class="gp-sa-progress-fill" id="gp-sa-auto-progress-fill" style="width: 5%;"></div>
                </div>
                <div class="gp-sa-progress-text" id="gp-sa-auto-progress-text">Updating photos...</div>
            `;
            container.appendChild(progressContainer);

            // Summary text box (hidden until completion)
            const summaryBox = document.createElement('div');
            summaryBox.className = 'gp-sa-auto-summary';
            summaryBox.id = 'gp-sa-auto-summary';
            summaryBox.style.display = 'none';
            container.appendChild(summaryBox);

            // Actions container with "Refresh page" button (hidden until completion)
            const actions = document.createElement('div');
            actions.className = 'gp-smart-archive-actions';
            actions.id = 'gp-sa-auto-actions';
            actions.style.display = 'none';

            const reloadBtn = document.createElement('button');
            reloadBtn.className = 'gp-sa-btn-primary';
            reloadBtn.textContent = 'Refresh page';
            reloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.reload();
            });

            actions.appendChild(reloadBtn);
            container.appendChild(actions);
        },

        executeAutoSync: async function (toArchive, toUnarchive, currentOffSet) {
            const progressContainer = document.getElementById('gp-sa-auto-progress-container');
            const progressFill = document.getElementById('gp-sa-auto-progress-fill');
            const progressText = document.getElementById('gp-sa-auto-progress-text');
            const summaryBox = document.getElementById('gp-sa-auto-summary');
            const actions = document.getElementById('gp-sa-auto-actions');

            const total = toArchive.length + toUnarchive.length;
            let current = 0;

            try {
                if (toArchive.length > 0) {
                    if (progressText) progressText.textContent = `Archiving (${toArchive.length} photos)...`;
                    await this.batchSetArchive(toArchive, true, (done, count) => {
                        const pct = Math.min(95, Math.round(((current + done) / Math.max(1, total)) * 100));
                        if (progressFill) progressFill.style.width = `${pct}%`;
                        if (progressText) progressText.textContent = `Archiving: ${done}/${count}...`;
                    });
                    current += toArchive.length;
                }

                if (toUnarchive.length > 0) {
                    if (progressText) progressText.textContent = `Unarchiving (${toUnarchive.length} photos)...`;
                    await this.batchSetArchive(toUnarchive, false, (done, count) => {
                        const pct = Math.min(95, Math.round(((current + done) / Math.max(1, total)) * 100));
                        if (progressFill) progressFill.style.width = `${pct}%`;
                        if (progressText) progressText.textContent = `Unarchiving: ${done}/${count}...`;
                    });
                    current += toUnarchive.length;
                }

                // Save updated stored keys
                await this.setStoredArchivedKeys(Array.from(currentOffSet));

                // Finished: hide progress bar container
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }

                // Build flexible summary phrase
                const archPart = toArchive.length > 0
                    ? `${toArchive.length} item${toArchive.length === 1 ? ' was' : 's were'} archived`
                    : '';
                const unarchPart = toUnarchive.length > 0
                    ? `${toUnarchive.length} item${toUnarchive.length === 1 ? ' was' : 's were'} unarchived`
                    : '';

                let summaryText = '';
                if (archPart && unarchPart) {
                    summaryText = `${archPart} and ${unarchPart}, according to the specified filters.`;
                } else if (archPart) {
                    summaryText = `${archPart}, according to the specified filters.`;
                } else if (unarchPart) {
                    summaryText = `${unarchPart}, according to the specified filters.`;
                } else {
                    summaryText = 'Photos are up to date, according to the specified filters.';
                }

                if (summaryBox) {
                    summaryBox.style.display = 'block';
                    summaryBox.innerHTML = `
                        <div class="gp-sa-auto-summary-text">${summaryText}</div>
                        <div class="gp-sa-auto-summary-sub">Refresh the page to see the changes.</div>
                    `;
                }

                if (actions) {
                    actions.style.display = 'flex';
                }

                this.updatePopoverPosition();

            } catch (err) {
                error('Auto-sync execution failed:', err);
                if (progressText) progressText.textContent = 'Error during sync. Check console.';
            }
        },

        // --- DOM Injection & Header Button ---
        startHeaderObserver: function () {
            this.headerObserver = new MutationObserver(() => {
                this.checkAndInjectButton();
            });
            this.headerObserver.observe(document.body, { childList: true, subtree: true });
            this.checkAndInjectButton();
        },

        checkAndInjectButton: function () {
            if (document.getElementById('gp-smart-archive-btn')) return;

            // Target container: <div class="J3TAe">
            const container = document.querySelector('div.J3TAe');
            if (!container) return;

            log('Found header container .J3TAe, injecting Smart Archiving button to the left of the leftmost icon...');

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'gp-smart-archive-wrapper';

            // Create button
            const btn = document.createElement('button');
            btn.id = 'gp-smart-archive-btn';
            btn.className = 'pYTkkf-Bz112c-LgbsSe pYTkkf-Bz112c-LgbsSe-OWXEXe-SfQLQb-suEOdc gp-smart-archive-btn';
            btn.setAttribute('aria-label', 'Smart Archiving');
            btn.setAttribute('title', 'Smart Archiving');
            btn.innerHTML = `<span class="pYTkkf-Bz112c-kBDsod-Rtc0Jf" aria-hidden="true">${SVG_FILTER_ICON}</span>`;

            this.buttonEl = btn;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePopover();
            });

            wrapper.appendChild(btn);

            // Insert to the left of the leftmost child in .J3TAe
            if (container.firstElementChild) {
                container.insertBefore(wrapper, container.firstElementChild);
            } else {
                container.appendChild(wrapper);
            }

            log('Smart Archiving button successfully injected.');
        },

        // --- Popover Positioning with Viewport Clamping ---
        updatePopoverPosition: function () {
            if (!this.popoverEl || !this.buttonEl) return;

            const btnRect = this.buttonEl.getBoundingClientRect();
            const margin = 12; // margin from viewport edges
            const verticalGap = 8; // gap below button

            const top = btnRect.bottom + verticalGap;
            const popoverWidth = this.popoverEl.offsetWidth || 255;

            // Align to the right edge of the button, slightly shifted left
            let left = btnRect.right - popoverWidth + 6;

            // Ensure it doesn't overflow the right edge of the screen
            if (left + popoverWidth > window.innerWidth - margin) {
                left = window.innerWidth - popoverWidth - margin;
            }

            // Ensure it doesn't overflow the left edge of the screen
            if (left < margin) {
                left = margin;
            }

            // Ensure it doesn't overflow the bottom edge of the screen
            const maxAllowedHeight = window.innerHeight - top - margin;
            if (maxAllowedHeight > 180) {
                this.popoverEl.style.maxHeight = `${maxAllowedHeight}px`;
            }

            this.popoverEl.style.top = `${Math.round(top)}px`;
            this.popoverEl.style.left = `${Math.round(left)}px`;
        },

        // --- Popover UI ---
        togglePopover: function () {
            if (this.isOpen) {
                this.closePopover();
            } else {
                this.openPopover();
            }
        },

        openPopover: function () {
            this.isOpen = true;
            this.isEditMode = false;
            this.isAutoSyncMode = false;
            this.isLoadingAlbums = false;

            // Reset working state to current saved filters
            this.workingToggles.clear();
            for (let f of this.filters) {
                this.workingToggles.set(f.albumMediaKey, f.enabled !== false);
            }

            this.renderPopover();

            // Immediately query item counts for filter albums one by one in the background
            this.fetchAndUpdateFilterCounts();
        },

        fetchAndUpdateFilterCounts: async function () {
            if (this.filters.length === 0) return;
            log('Fetching fresh item counts for filter albums...');
            for (let f of this.filters) {
                if (!this.isOpen || this.isEditMode) break;
                try {
                    const count = await this.fetchSingleAlbumCount(f.albumMediaKey);
                    if (typeof count === 'number') {
                        f.itemCount = count;
                        if (this.popoverEl) {
                            const countEl = this.popoverEl.querySelector(`.gp-sa-count[data-key="${f.albumMediaKey}"]`);
                            if (countEl) {
                                countEl.textContent = count === 1 ? '1 item' : `${count} items`;
                            }
                        }
                    }
                } catch (err) {
                    warn(`Failed to fetch count for album ${f.albumMediaKey}:`, err);
                }
            }
            // Save updated counts to settings
            await this.saveFilters();
        },

        closePopover: function () {
            this.isOpen = false;
            this.isEditMode = false;
            this.isAutoSyncMode = false;
            this.isLoadingAlbums = false;
            if (this.popoverEl && this.popoverEl.parentNode) {
                this.popoverEl.parentNode.removeChild(this.popoverEl);
            }
            this.popoverEl = null;
        },

        renderPopover: function () {
            // If popover element doesn't exist, create it once and append to body
            if (!this.popoverEl || !this.popoverEl.parentNode) {
                const popover = document.createElement('div');
                popover.className = 'gp-smart-archive-popover';
                popover.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent clicks inside popover from closing it
                });
                document.body.appendChild(popover);
                this.popoverEl = popover;
            }

            const isDark = window.TimTools.Theme ? window.TimTools.Theme.isDark() : false;

            if (isDark) {
                this.popoverEl.classList.add('gp-theme-dark', 'gp-timtools-theme-dark');
                this.popoverEl.classList.remove('gp-theme-light', 'gp-timtools-theme-light');
            } else {
                this.popoverEl.classList.add('gp-theme-light', 'gp-timtools-theme-light');
                this.popoverEl.classList.remove('gp-theme-dark', 'gp-timtools-theme-dark');
            }

            // Clear previous inner contents without recreating the element
            this.popoverEl.innerHTML = '';

            if (this.isAutoSyncMode) {
                this.renderAutoSyncMode(this.popoverEl);
            } else if (this.isEditMode) {
                this.renderEditMode(this.popoverEl);
            } else {
                this.renderNormalMode(this.popoverEl);
            }

            // Reposition smoothly
            this.updatePopoverPosition();
            requestAnimationFrame(() => {
                this.updatePopoverPosition();
            });
        },

        // --- View 1: Normal View (Toggle Filters) ---
        renderNormalMode: function (container) {
            // Header
            const header = document.createElement('div');
            header.className = 'gp-smart-archive-header';
            const filterCountText = this.filters.length === 1 ? '1 filter' : `${this.filters.length} filters`;
            header.innerHTML = `
                <div class="gp-smart-archive-title">
                    ${SVG_FILTER_ICON}
                    <span>Smart Archiving</span>
                </div>
                <span class="gp-smart-archive-badge">${filterCountText}</span>
            `;
            container.appendChild(header);

            // Column Headers ("Album name" and "Visibility")
            if (this.filters.length > 0) {
                const colHeaders = document.createElement('div');
                colHeaders.className = 'gp-smart-archive-col-headers';
                colHeaders.innerHTML = `
                    <span class="gp-sa-col-name">Album name</span>
                    <span class="gp-sa-col-visibility">Visibility</span>
                `;
                container.appendChild(colHeaders);
            }

            // Filter List
            const list = document.createElement('ul');
            list.className = 'gp-smart-archive-list';

            if (this.filters.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'gp-smart-archive-empty';
                empty.textContent = 'No filters configured yet. Click the edit button below to select albums as filters.';
                list.appendChild(empty);
            } else {
                for (let filter of this.filters) {
                    const li = document.createElement('li');
                    li.className = 'gp-smart-archive-item';

                    const isChecked = this.workingToggles.get(filter.albumMediaKey) !== false;
                    // Initially show blank (will be populated dynamically by fetchAndUpdateFilterCounts)
                    const countText = typeof filter.itemCount === 'number'
                        ? (filter.itemCount === 1 ? '1 item' : `${filter.itemCount} items`)
                        : '&nbsp;';

                    li.innerHTML = `
                        <div class="gp-smart-archive-item-info">
                            <span class="gp-smart-archive-item-title" title="${escapeHtml(filter.albumTitle)}">${escapeHtml(filter.albumTitle)}</span>
                            <span class="gp-smart-archive-item-sub gp-sa-count" data-key="${filter.albumMediaKey}">${countText}</span>
                        </div>
                        <label class="gp-sa-toggle" title="${isChecked ? 'Turn off (hide in archive)' : 'Turn on (show in photostream)'}">
                            <input type="checkbox" data-key="${filter.albumMediaKey}" ${isChecked ? 'checked' : ''}>
                            <span class="gp-sa-slider">
                                <span class="gp-sa-knob">
                                    <span class="gp-sa-icon-off">${SVG_ICON_ARCHIVE}</span>
                                    <span class="gp-sa-icon-on">${SVG_ICON_IMAGE}</span>
                                </span>
                            </span>
                        </label>
                    `;

                    const toggleInput = li.querySelector('input');
                    toggleInput.addEventListener('change', (e) => {
                        this.workingToggles.set(filter.albumMediaKey, e.target.checked);
                        this.updateApplyButtonState();
                    });

                    list.appendChild(li);
                }
            }
            container.appendChild(list);

            // Bottom Actions Row: Apply button on left, Edit icon button on right
            const actions = document.createElement('div');
            actions.className = 'gp-smart-archive-actions';

            const applyBtn = document.createElement('button');
            applyBtn.className = 'gp-sa-btn-primary';
            applyBtn.id = 'gp-sa-apply-btn';
            applyBtn.textContent = 'Apply';
            applyBtn.disabled = true; // disabled initially until changes occur

            applyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.executeApply();
            });

            const editBtn = document.createElement('button');
            editBtn.className = 'gp-sa-btn-icon';
            editBtn.title = 'Edit filters';
            editBtn.innerHTML = SVG_EDIT_ICON;
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditMode();
            });

            actions.appendChild(applyBtn);
            actions.appendChild(editBtn);
            container.appendChild(actions);

            // Progress Bar (below Apply button)
            const progressContainer = document.createElement('div');
            progressContainer.className = 'gp-sa-progress-container';
            progressContainer.id = 'gp-sa-progress-container';
            progressContainer.innerHTML = `
                <div class="gp-sa-progress-bar">
                    <div class="gp-sa-progress-fill" id="gp-sa-progress-fill"></div>
                </div>
                <div class="gp-sa-progress-text" id="gp-sa-progress-text">Processing...</div>
            `;
            container.appendChild(progressContainer);
        },

        updateApplyButtonState: function () {
            const applyBtn = document.getElementById('gp-sa-apply-btn');
            if (!applyBtn) return;

            let hasChanged = false;
            for (let filter of this.filters) {
                const currentVal = this.workingToggles.get(filter.albumMediaKey);
                const originalVal = filter.enabled !== false;
                if (currentVal !== originalVal) {
                    hasChanged = true;
                    break;
                }
            }

            applyBtn.disabled = !hasChanged || this.isProcessing;
        },

        // --- View 2: Edit View (Album Checkboxes & Reordering) ---
        openEditMode: async function () {
            this.isEditMode = true;
            this.editSelectedKeys = new Set(this.filters.map(f => f.albumMediaKey));

            // If albums already cached, render immediately
            if (this.allUserAlbums.length > 0) {
                this.isLoadingAlbums = false;
                this.renderPopover();
                return;
            }

            // Otherwise, show loading indicator in this same popover without closing/flickering
            this.isLoadingAlbums = true;
            this.renderPopover();

            try {
                this.allUserAlbums = await this.fetchUserAlbums();
            } catch (e) {
                warn('Failed to load user albums:', e);
            } finally {
                this.isLoadingAlbums = false;
                // Re-render contents in place
                if (this.isOpen && this.isEditMode) {
                    this.renderPopover();
                }
            }
        },

        renderEditMode: function (container) {
            // Header
            const header = document.createElement('div');
            header.className = 'gp-smart-archive-header';
            header.innerHTML = `
                <div class="gp-smart-archive-title">
                    ${SVG_EDIT_ICON}
                    <span>Edit Filters</span>
                </div>
                <span class="gp-smart-archive-badge">${this.editSelectedKeys.size} selected</span>
            `;
            container.appendChild(header);

            // If albums are loading in background, show clean inline spinner
            if (this.isLoadingAlbums) {
                const loadingContainer = document.createElement('div');
                loadingContainer.className = 'gp-smart-archive-loading';
                loadingContainer.innerHTML = `
                    <div class="gp-sa-spinner"></div>
                    <span>Loading your albums...</span>
                `;
                container.appendChild(loadingContainer);

                // Bottom row with disabled Save and working Cancel
                const actions = document.createElement('div');
                actions.className = 'gp-smart-archive-actions';

                const saveBtn = document.createElement('button');
                saveBtn.className = 'gp-sa-btn-primary';
                saveBtn.textContent = 'Save';
                saveBtn.disabled = true;

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'gp-sa-btn-cancel';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.isEditMode = false;
                    this.isLoadingAlbums = false;
                    this.renderPopover();
                });

                actions.appendChild(saveBtn);
                actions.appendChild(cancelBtn);
                container.appendChild(actions);
                return;
            }

            // Search input
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'gp-sa-edit-search';
            searchInput.placeholder = 'Search albums...';
            container.appendChild(searchInput);

            // Album List Container
            const list = document.createElement('ul');
            list.className = 'gp-smart-archive-list';
            container.appendChild(list);

            const renderAlbumItems = (query = '') => {
                list.innerHTML = '';

                const q = query.trim().toLowerCase();
                let filtered = this.allUserAlbums;
                if (q) {
                    filtered = this.allUserAlbums.filter(a => a.title.toLowerCase().includes(q));
                }

                // Partition: checked albums at top, unchecked below
                const checkedAlbums = [];
                const uncheckedAlbums = [];

                for (let a of filtered) {
                    if (this.editSelectedKeys.has(a.mediaKey)) {
                        checkedAlbums.push(a);
                    } else {
                        uncheckedAlbums.push(a);
                    }
                }

                if (checkedAlbums.length > 0) {
                    const sec = document.createElement('div');
                    sec.className = 'gp-sa-section-divider';
                    sec.textContent = `Selected Filters (${checkedAlbums.length})`;
                    list.appendChild(sec);

                    for (let a of checkedAlbums) {
                        list.appendChild(createAlbumRow(a, true));
                    }
                }

                if (uncheckedAlbums.length > 0) {
                    const sec = document.createElement('div');
                    sec.className = 'gp-sa-section-divider';
                    sec.textContent = `All Albums (${uncheckedAlbums.length})`;
                    list.appendChild(sec);

                    for (let a of uncheckedAlbums) {
                        list.appendChild(createAlbumRow(a, false));
                    }
                }

                if (checkedAlbums.length === 0 && uncheckedAlbums.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'gp-smart-archive-empty';
                    empty.textContent = this.allUserAlbums.length === 0
                        ? 'No albums found in your Google Photos library.'
                        : 'No matching albums found.';
                    list.appendChild(empty);
                }
            };

            const createAlbumRow = (album, isChecked) => {
                const li = document.createElement('li');
                li.className = 'gp-sa-edit-item';
                const photoCountText = album.itemCount === 1 ? '1 photo' : `${album.itemCount} photos`;
                li.innerHTML = `
                    <input type="checkbox" class="gp-sa-edit-checkbox" ${isChecked ? 'checked' : ''}>
                    <span class="gp-sa-edit-title" title="${escapeHtml(album.title)}">${escapeHtml(album.title)}</span>
                    <span class="gp-sa-edit-count">${photoCountText}</span>
                `;

                const checkbox = li.querySelector('input');
                li.addEventListener('click', (e) => {
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                    }
                    if (checkbox.checked) {
                        this.editSelectedKeys.add(album.mediaKey);
                    } else {
                        this.editSelectedKeys.delete(album.mediaKey);
                    }
                    // Re-render list so checked albums immediately move to top!
                    renderAlbumItems(searchInput.value);
                    const badge = container.querySelector('.gp-smart-archive-badge');
                    if (badge) badge.textContent = `${this.editSelectedKeys.size} selected`;
                });

                return li;
            };

            searchInput.addEventListener('input', (e) => {
                renderAlbumItems(e.target.value);
            });

            renderAlbumItems();

            // Bottom Actions Row: Save button on left, Cancel on right
            const actions = document.createElement('div');
            actions.className = 'gp-smart-archive-actions';

            const saveBtn = document.createElement('button');
            saveBtn.className = 'gp-sa-btn-primary';
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.saveEditedFilters();
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'gp-sa-btn-cancel';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isEditMode = false;
                this.renderPopover();
            });

            actions.appendChild(saveBtn);
            actions.appendChild(cancelBtn);
            container.appendChild(actions);
        },

        saveEditedFilters: async function () {
            log('Saving edited filter albums...');
            const newFilters = [];

            // Build new filter list from editSelectedKeys
            for (let key of this.editSelectedKeys) {
                let title = 'Untitled Album';
                let itemCount = 0;
                const foundAlbum = this.allUserAlbums.find(a => a.mediaKey === key);
                if (foundAlbum) {
                    title = foundAlbum.title;
                    itemCount = foundAlbum.itemCount ?? 0;
                } else {
                    const existing = this.filters.find(f => f.albumMediaKey === key);
                    if (existing) {
                        title = existing.albumTitle;
                        itemCount = existing.itemCount ?? 0;
                    }
                }

                // Preserve previous enabled state if existed, otherwise default to true (visible)
                const existing = this.filters.find(f => f.albumMediaKey === key);
                const enabled = existing ? (existing.enabled !== false) : true;

                newFilters.push({
                    albumMediaKey: key,
                    albumTitle: title,
                    itemCount: itemCount,
                    enabled: enabled
                });
            }

            this.filters = newFilters;

            // Save to chrome storage (scoped to account)
            await this.saveFilters();

            log(`Saved ${this.filters.length} filters to storage.`);

            // Return to normal mode
            this.isEditMode = false;
            this.openPopover();
        },

        // --- Core Execution: Apply Filters ---
        executeApply: async function () {
            if (this.isProcessing) return;
            this.isProcessing = true;

            const applyBtn = document.getElementById('gp-sa-apply-btn');
            const progressContainer = document.getElementById('gp-sa-progress-container');
            const progressFill = document.getElementById('gp-sa-progress-fill');
            const progressText = document.getElementById('gp-sa-progress-text');

            if (applyBtn) applyBtn.disabled = true;
            if (progressContainer) progressContainer.classList.add('active');
            if (progressFill) progressFill.style.width = '5%';
            if (progressText) progressText.textContent = 'Reading albums...';

            try {
                // 1. Determine disabled (off) vs enabled (on) filters according to workingToggles
                const offFilters = [];
                const onFilters = [];

                for (let filter of this.filters) {
                    const isEnabled = this.workingToggles.get(filter.albumMediaKey) !== false;
                    if (isEnabled) {
                        onFilters.push(filter);
                    } else {
                        offFilters.push(filter);
                    }
                }

                log(`Applying filters: ${offFilters.length} OFF (to hide), ${onFilters.length} ON (to show).`);

                // 2. Fetch all dedupKeys from OFF filter albums (F_off)
                const fOffSet = new Set();
                for (let i = 0; i < offFilters.length; i++) {
                    const f = offFilters[i];
                    if (progressText) {
                        progressText.textContent = `Scanning: ${f.albumTitle}...`;
                    }
                    const keys = await this.fetchAlbumDedupKeys(f.albumMediaKey);
                    keys.forEach(k => fOffSet.add(k));
                }

                // 3. Fetch all dedupKeys from ON filter albums (F_on)
                const fOnSet = new Set();
                for (let i = 0; i < onFilters.length; i++) {
                    const f = onFilters[i];
                    if (progressText) {
                        progressText.textContent = `Scanning: ${f.albumTitle}...`;
                    }
                    const keys = await this.fetchAlbumDedupKeys(f.albumMediaKey);
                    keys.forEach(k => fOnSet.add(k));
                }

                // 4. Calculate sets according to set theory:
                // If a photo is in at least ONE disabled filter -> MUST BE IN ARCHIVE (F_off)
                // If a photo is in enabled filters and NOT in any disabled filter -> UNARCHIVE (F_on \ F_off)
                const toArchive = Array.from(fOffSet);
                const toUnarchive = Array.from(fOnSet).filter(k => !fOffSet.has(k));

                log(`Photos to archive: ${toArchive.length}, Photos to unarchive: ${toUnarchive.length}`);

                const totalOperations = toArchive.length + toUnarchive.length;
                let currentCompleted = 0;

                // 5. Execute Archiving
                if (toArchive.length > 0) {
                    if (progressText) progressText.textContent = `Archiving (${toArchive.length} photos)...`;
                    await this.batchSetArchive(toArchive, true, (done, count) => {
                        const pct = Math.min(95, Math.round(((currentCompleted + done) / Math.max(1, totalOperations)) * 100));
                        if (progressFill) progressFill.style.width = `${pct}%`;
                        if (progressText) progressText.textContent = `Archiving: ${done}/${count}...`;
                    });
                    currentCompleted += toArchive.length;
                }

                // 6. Execute Unarchiving
                if (toUnarchive.length > 0) {
                    if (progressText) progressText.textContent = `Unarchiving (${toUnarchive.length} photos)...`;
                    await this.batchSetArchive(toUnarchive, false, (done, count) => {
                        const pct = Math.min(95, Math.round(((currentCompleted + done) / Math.max(1, totalOperations)) * 100));
                        if (progressFill) progressFill.style.width = `${pct}%`;
                        if (progressText) progressText.textContent = `Unarchiving: ${done}/${count}...`;
                    });
                    currentCompleted += toUnarchive.length;
                }

                // 7. Update saved filters with new toggle values
                for (let filter of this.filters) {
                    filter.enabled = this.workingToggles.get(filter.albumMediaKey) !== false;
                }

                await this.saveFilters();

                // Update stored archived keys baseline so auto-check stays accurate
                await this.setStoredArchivedKeys(toArchive);

                if (progressFill) progressFill.style.width = '100%';
                if (progressText) {
                    progressText.textContent = `Done! Reloading page...`;
                }

                log('Filter apply complete! Reloading page to reflect changes...');

                setTimeout(() => {
                    window.location.reload();
                }, 800);

            } catch (err) {
                error('Error applying smart archiving filters:', err);
                if (progressText) {
                    progressText.textContent = 'Error applying filters. Check console.';
                }
                this.isProcessing = false;
                if (applyBtn) applyBtn.disabled = false;
            }
        }
    };

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    window.TimTools.Modules.SmartArchiving = SmartArchiving;
    log('Module registered under window.TimTools.Modules.SmartArchiving');
})();
