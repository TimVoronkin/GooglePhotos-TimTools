// ===================================================
// Google Photos TimTools - Album Quick Remove Module
// ===================================================

window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
    const logger = (window.TimTools.Logger && window.TimTools.Logger.create)
        ? window.TimTools.Logger.create('AlbumQuickRemove')
        : {
            log: (...args) => console.log('[GP-TimTools][AlbumQuickRemove]', ...args),
            warn: (...args) => console.warn('[GP-TimTools][AlbumQuickRemove]', ...args),
            error: (...args) => console.error('[GP-TimTools][AlbumQuickRemove]', ...args)
        };

    // Bolder cross icon with stroke-width 2.6
    const CLOSE_ICON_SVG = `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    `;

    const SPINNER_SVG = `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8zm0 16c4.41 0 8-3.59 8-8h2c0 5.52-4.48 10-10 10v-2z"/>
        </svg>
    `;

    const PLAYLIST_REMOVE_SVG = `
        <svg viewBox="0 -960 960 960" aria-hidden="true" fill="currentColor">
            <path d="m576-80-56-56 104-104-104-104 56-56 104 104 104-104 56 56-104 104 104 104-56 56-104-104L576-80ZM120-320v-80h280v80H120Zm0-160v-80h440v80H120Zm0-160v-80h440v80H120Z"/>
        </svg>
    `;

    const AlbumQuickRemove = {
        _observer: null,
        _intervalId: null,
        _lastUrl: '',
        _cachedWizData: null,

        init: function () {
            logger.log('Init AlbumQuickRemove');
            this._lastUrl = window.location.href;

            // 1. Observe DOM changes to detect when Info panel / albums list is opened
            this._observer = new MutationObserver(() => {
                if (window.location.href !== this._lastUrl) {
                    this._lastUrl = window.location.href;
                    logger.log('URL changed to:', this._lastUrl);
                }
                this.scanAndInject();
            });

            this._observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'aria-hidden']
            });

            // 2. Periodic safety check
            this._intervalId = setInterval(() => {
                this.scanAndInject();
            }, 600);

            // Initial scan
            this.scanAndInject();
        },

        // Locate the currently visible Albums container in the active Info sidebar
        getActiveAlbumsContainer: function () {
            const containers = document.querySelectorAll('.KlIBpb');
            for (const el of containers) {
                const rect = el.getBoundingClientRect();
                // Must be physically visible in viewport
                if (rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth) {
                    // Must not be inside hidden wrapper (e.g. inactive virtual slide)
                    if (!el.closest('[aria-hidden="true"]')) {
                        return el;
                    }
                }
            }
            return null;
        },

        // Extract the current photo's media key from URL or DOM
        getCurrentPhotoKey: function () {
            // Priority 1: From pathname /photo/AF1Qip... or /u/0/album/.../photo/AF1Qip...
            const pathMatch = window.location.pathname.match(/\/photo\/([A-Za-z0-9_-]+)/);
            if (pathMatch && pathMatch[1]) {
                return pathMatch[1];
            }

            // Priority 2: From query or hash if any
            const hashMatch = window.location.hash.match(/photo\/([A-Za-z0-9_-]+)/);
            if (hashMatch && hashMatch[1]) {
                return hashMatch[1];
            }

            // Priority 3: DOM search in active viewport for photo elements
            const activeSlide = document.querySelector('c-wiz[data-item-id]:not([aria-hidden="true"]), [data-media-key]:not([aria-hidden="true"])');
            if (activeSlide) {
                const key = activeSlide.getAttribute('data-item-id') || activeSlide.getAttribute('data-media-key');
                if (key) return key;
            }

            return null;
        },

        scanAndInject: function () {
            // Only relevant when viewing a photo
            if (!window.location.href.includes('/photo/')) {
                return;
            }

            const container = this.getActiveAlbumsContainer();
            if (!container) return;

            const items = container.querySelectorAll('li.hH3Q8d');
            for (const li of items) {
                const existingBtn = li.querySelector('.gp-album-remove-btn');
                if (existingBtn) {
                    this.alignWithDetailsPencil(existingBtn, li);
                    continue;
                }

                this.injectRemoveButton(li, container);
            }
        },

        injectRemoveButton: function (li, container) {
            const link = li.querySelector('a.rugHuc') || li.querySelector('a[href*="album/"]');
            if (!link) return;

            const href = link.getAttribute('href') || '';
            const hrefMatch = href.match(/album\/([A-Za-z0-9_-]+)/);
            const jslogMatch = (link.getAttribute('jslog') || '').match(/9:([A-Za-z0-9_-]+)/);

            const albumKey = (hrefMatch && hrefMatch[1]) || (jslogMatch && jslogMatch[1]);
            if (!albumKey) return;

            const titleEl = li.querySelector('.AJM7gb');
            const albumTitle = titleEl ? titleEl.textContent.trim() : 'Album';

            // Mark container
            li.classList.add('gp-album-item-container');
            li.setAttribute('data-gp-remove-injected', 'true');
            li.setAttribute('data-gp-album-key', albumKey);

            // Create remove button ("✕")
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gp-album-remove-btn';
            btn.setAttribute('aria-label', `Remove from ${albumTitle}`);
            btn.setAttribute('title', `Remove from "${albumTitle}"`);
            btn.innerHTML = CLOSE_ICON_SVG;

            // Handle remove click
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                await this.handleRemoveClick(albumKey, albumTitle, li, btn);
            });

            // Prevent link navigation if mousedown happens on button
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            li.appendChild(btn);
            this.alignWithDetailsPencil(btn, li);
        },

        alignWithDetailsPencil: function (btn, li) {
            const sidebar = li.closest('.YW656b') || document;
            const pencil = sidebar.querySelector('.F6wuZ');
            if (pencil) {
                const liRect = li.getBoundingClientRect();
                const pencilRect = pencil.getBoundingClientRect();
                if (liRect.width > 0 && pencilRect.width > 0 && liRect.right > 0) {
                    const pencilCenterFromRight = liRect.right - (pencilRect.left + pencilRect.width / 2);
                    const btnWidth = btn.offsetWidth || 30;
                    const targetRight = Math.round(pencilCenterFromRight - btnWidth / 2);
                    if (targetRight > 0 && targetRight < 60) {
                        btn.style.right = `${targetRight}px`;
                        return;
                    }
                }
            }
            btn.style.right = '21px';
        },

        handleRemoveClick: async function (albumKey, albumTitle, li, btn) {
            const photoKey = this.getCurrentPhotoKey();
            if (!photoKey) {
                logger.error('Could not determine current photo key for removal');
                alert('Could not determine current photo ID. Please try again.');
                return;
            }

            // Check if confirmation modal is enabled in settings
            let needConfirm = true;
            if (window.TimTools && window.TimTools.Settings) {
                try {
                    const settings = await window.TimTools.Settings.getAll();
                    needConfirm = settings.albumQuickRemoveConfirm !== false;
                } catch (e) {
                    logger.warn('Error reading settings, defaulting to confirm:', e);
                }
            }

            if (needConfirm) {
                const confirmed = await this.showConfirmModal(albumTitle);
                if (!confirmed) {
                    return;
                }
            }

            // Visual feedback: loading spinner
            btn.classList.add('is-loading');
            btn.innerHTML = SPINNER_SVG;

            try {
                logger.log(`Initiating removal of photo [${photoKey}] from album [${albumKey}] (${albumTitle})...`);
                await this.removePhotoFromAlbum(albumKey, photoKey);

                logger.log(`Photo successfully removed from album [${albumKey}]`);

                // Animate removal
                li.classList.add('gp-album-removing');
                requestAnimationFrame(() => {
                    li.classList.add('is-hidden');
                });

                setTimeout(() => {
                    li.remove();
                }, 300);

                this.showToast(`Removed from "${albumTitle}"`);
            } catch (err) {
                logger.error('Failed to remove photo from album:', err);
                btn.classList.remove('is-loading');
                btn.innerHTML = CLOSE_ICON_SVG;
                alert(`Failed to remove photo from album: ${err.message || err}`);
            }
        },

        // Confirmation dialog with keyboard support (Enter = confirm, Escape = cancel)
        showConfirmModal: function (albumTitle) {
            return new Promise((resolve) => {
                const existing = document.querySelector('.gp-album-modal-overlay');
                if (existing) existing.remove();

                const overlay = document.createElement('div');
                overlay.className = 'gp-album-modal-overlay';
                overlay.innerHTML = `
                    <div class="gp-album-modal-box" role="dialog" aria-modal="true">
                        <div class="gp-album-modal-header">
                            <div class="gp-album-modal-icon-wrapper">
                                ${PLAYLIST_REMOVE_SVG}
                            </div>
                            <h2 class="gp-album-modal-title">Remove from album?</h2>
                        </div>
                        <div class="gp-album-modal-body">
                            Are you sure you want to remove this photo from album<br><span class="gp-album-modal-target-album">"${this.escapeHtml(albumTitle)}"</span>?
                            <span class="gp-album-modal-subtext">The photo will remain in your Google Photos library.</span>
                        </div>
                        <div class="gp-album-modal-footer">
                            <button type="button" class="gp-album-modal-btn gp-album-modal-cancel-btn">Cancel</button>
                            <button type="button" class="gp-album-modal-btn gp-album-modal-confirm-btn">Remove</button>
                        </div>
                    </div>
                `;

                const cancelBtn = overlay.querySelector('.gp-album-modal-cancel-btn');
                const confirmBtn = overlay.querySelector('.gp-album-modal-confirm-btn');

                let resolved = false;
                const cleanup = (result) => {
                    if (resolved) return;
                    resolved = true;
                    window.removeEventListener('keydown', handleKeyDown, true);
                    overlay.remove();
                    resolve(result);
                };

                const handleKeyDown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        cleanup(true);
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        cleanup(false);
                    }
                };

                window.addEventListener('keydown', handleKeyDown, true);

                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    cleanup(false);
                });

                confirmBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    cleanup(true);
                });

                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        cleanup(false);
                    }
                });

                document.body.appendChild(overlay);

                // Focus confirm button for accessibility
                confirmBtn.focus();
            });
        },

        // Show a brief toast notification matching Google Photos styling
        showToast: function (message) {
            const existing = document.querySelector('.gp-album-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'gp-album-toast';
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.classList.add('is-leaving');
                setTimeout(() => toast.remove(), 250);
            }, 3000);
        },

        escapeHtml: function (str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        getWizGlobalData: function () {
            return (window.TimTools && window.TimTools.API)
                ? window.TimTools.API.getSessionData()
                : { at: null };
        },

        // Universal batchexecute RPC caller
        makeApiRequest: function (rpcid, requestData, sourcePath) {
            if (window.TimTools && window.TimTools.API) {
                return window.TimTools.API.makeRequest(rpcid, requestData, sourcePath);
            }
            throw new Error('window.TimTools.API is not available');
        },

        // Resolve the specific item ID inside the album (item[0]) corresponding to the photo
        findAlbumItemKey: async function (albumMediaKey, photoKey) {
            logger.log(`Resolving album item key inside album [${albumMediaKey}] for photo [${photoKey}]...`);

            let pageId = null;
            let pageCount = 0;
            let resolvedDedupKey = null;

            do {
                const albumData = await this.makeApiRequest('snAcKc', [albumMediaKey, pageId, null, null], `/album/${albumMediaKey}`);
                if (!albumData || !Array.isArray(albumData[1])) {
                    break;
                }

                const items = albumData[1];

                // 1. Direct match: it[0] is albumItemKey, it[3] is photo dedupKey
                for (const it of items) {
                    const albumItemKey = it?.[0];
                    const dedupKey = it?.[3];
                    if (albumItemKey === photoKey || dedupKey === photoKey) {
                        logger.log(`Found direct match in album! albumItemKey: ${albumItemKey}, dedupKey: ${dedupKey}`);
                        return albumItemKey;
                    }
                }

                // 2. If no direct match on first page, resolve photo dedupKey via VrseUb
                if (!resolvedDedupKey && pageCount === 0) {
                    try {
                        const info = await this.makeApiRequest('VrseUb', [photoKey, null, null, null, null], `/album/${albumMediaKey}`);
                        if (info && info[0] && info[0][3]) {
                            resolvedDedupKey = info[0][3];
                            logger.log(`Resolved dedupKey via VrseUb: ${resolvedDedupKey}`);
                            for (const it of items) {
                                if (it?.[3] === resolvedDedupKey) {
                                    logger.log(`Found match using resolved dedupKey! albumItemKey: ${it[0]}`);
                                    return it[0];
                                }
                            }
                        }
                    } catch (err) {
                        logger.warn('Failed to resolve dedupKey via VrseUb:', err);
                    }
                } else if (resolvedDedupKey) {
                    for (const it of items) {
                        if (it?.[3] === resolvedDedupKey) {
                            logger.log(`Found match using resolved dedupKey! albumItemKey: ${it[0]}`);
                            return it[0];
                        }
                    }
                }

                pageId = albumData[2] || null;
                pageCount++;
            } while (pageId && pageCount < 10);

            logger.warn(`Could not find specific albumItemKey in album [${albumMediaKey}], using photoKey fallback: [${photoKey}]`);
            return photoKey;
        },

        // Execute ycV3Nd RPC to remove photo from specified album
        removePhotoFromAlbum: async function (albumMediaKey, photoMediaKey) {
            // First resolve the internal album item ID
            const albumItemKey = await this.findAlbumItemKey(albumMediaKey, photoMediaKey);
            logger.log(`Target item key to remove from album [${albumMediaKey}]: [${albumItemKey}]`);

            const rpcid = 'ycV3Nd';
            const requestData = [[albumItemKey]];
            const sourcePath = `/album/${albumMediaKey}`;

            logger.log(`Sending batchexecute [ycV3Nd] with item [${albumItemKey}] and source-path [${sourcePath}]...`);
            const result = await this.makeApiRequest(rpcid, requestData, sourcePath);

            logger.log('RPC ycV3Nd completed. Result:', result);
            return true;
        }
    };

    window.TimTools.Modules.AlbumQuickRemove = AlbumQuickRemove;
})();
