window.TimTools = window.TimTools || {};

(function () {
    const logger = (window.TimTools.Logger && window.TimTools.Logger.create)
        ? window.TimTools.Logger.create('API')
        : {
            log: (...args) => console.log('[GP-TimTools][API]', ...args),
            warn: (...args) => console.warn('[GP-TimTools][API]', ...args),
            error: (...args) => console.error('[GP-TimTools][API]', ...args)
        };

    let cachedWizData = null;

    const API = {
        /**
         * Extract and cache Google Photos session tokens (SNlM0e, FdrFJe, cfb2h, eptZe).
         * Since content scripts run in an isolated world, we inspect script tags if window.WIZ_global_data is absent.
         */
        getSessionData: function (forceRefresh = false) {
            if (!forceRefresh && cachedWizData && cachedWizData.at) {
                return cachedWizData;
            }

            let at = null, fsid = null, bl = null, path = null, account = null;

            // Direct read if accessible
            if (typeof window !== 'undefined' && window.WIZ_global_data) {
                const w = window.WIZ_global_data;
                at = w.SNlM0e || null;
                fsid = w.FdrFJe || null;
                bl = w.cfb2h || null;
                path = w.eptZe || null;
                account = w.oPEP7c || w.S06Grb || null;
            }

            // Fallback: search injected script tags
            if (!at) {
                const scripts = document.querySelectorAll('script');
                for (let s of scripts) {
                    const content = s.textContent || '';
                    if (content.includes('SNlM0e')) {
                        const atMatch = content.match(/"SNlM0e":"([^"]+)"/);
                        const fsidMatch = content.match(/"FdrFJe":"([^"]+)"/);
                        const blMatch = content.match(/"cfb2h":"([^"]+)"/);
                        const pathMatch = content.match(/"eptZe":"([^"]+)"/);
                        if (atMatch) at = atMatch[1];
                        if (fsidMatch) fsid = fsidMatch[1];
                        if (blMatch) bl = blMatch[1];
                        if (pathMatch) path = pathMatch[1];
                        if (at) break;
                    }
                }
            }

            if (at) {
                cachedWizData = { at, fsid, bl, path, account };
                logger.log('Google Photos session data resolved:', {
                    at: at.substring(0, 8) + '...',
                    fsid, bl, path, account
                });
            } else {
                logger.warn('Could not extract SNlM0e session token from page.');
            }

            return cachedWizData || { at, fsid, bl, path };
        },

        clearSessionCache: function () {
            cachedWizData = null;
        },

        /**
         * Perform Google Photos internal RPC via batchexecute
         * @param {string} rpcid - The Google Photos RPC ID (e.g. Z5xsfc, snAcKc, w7TP3c, DaSgWe, VrseUb, ycV3Nd)
         * @param {Array} requestData - The inner payload array
         * @param {string} [sourcePath] - Optional override for source-path parameter
         */
        makeRequest: async function (rpcid, requestData, sourcePath) {
            const wizData = this.getSessionData();
            if (!wizData || !wizData.at) {
                throw new Error('Google Photos session token (SNlM0e) not found. Please ensure you are logged into Google Photos.');
            }

            const wrappedData = [[[rpcid, JSON.stringify(requestData), null, 'generic']]];
            const requestDataString = `f.req=${encodeURIComponent(JSON.stringify(wrappedData))}&at=${encodeURIComponent(wizData.at)}&`;

            const params = {
                rpcids: rpcid,
                'source-path': sourcePath || window.location.pathname,
                'f.sid': wizData.fsid || '',
                bl: wizData.bl || '',
                pageId: 'none',
                rt: 'c'
            };

            const paramsString = Object.keys(params)
                .map((key) => `${key}=${encodeURIComponent(params[key])}`)
                .join('&');

            const basePath = wizData.path || '/_/PhotosUi/';
            const url = `https://photos.google.com${basePath}data/batchexecute?${paramsString}`;

            logger.log(`Executing RPC [${rpcid}]...`);

            const response = await fetch(url, {
                headers: {
                    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
                },
                body: requestDataString,
                method: 'POST',
                credentials: 'include'
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
                logger.warn(`No 'wrb.fr' payload line found in response for [${rpcid}].`);
                return null;
            }

            try {
                const parsedData = JSON.parse(jsonLines[0]);
                if (parsedData?.[0]?.[2]) {
                    return JSON.parse(parsedData[0][2]);
                }
            } catch (e) {
                logger.warn(`Could not parse JSON payload for [${rpcid}]:`, e);
            }

            return null;
        }
    };

    window.TimTools.API = API;
})();
