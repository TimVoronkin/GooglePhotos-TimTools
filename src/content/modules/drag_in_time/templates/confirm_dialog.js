// ===================================================
// Google Photos TimTools - Confirmation Dialog Template
// ===================================================

window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};
window.TimTools.Modules.DragInTimeTemplates = window.TimTools.Modules.DragInTimeTemplates || {};

window.TimTools.Modules.DragInTimeTemplates.getConfirmModalHtml = function (count) {
    return /* html */ `
        <div class="gp-confirm-dialog-box" role="dialog" aria-modal="true">
            <!-- Header -->
            <div style="padding: 24px 28px 0px 28px;">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 8px;">
                    <div style="background: rgba(138, 180, 248, 0.15); width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #8ab4f8; flex-shrink: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                        </svg>
                    </div>
                    <div>
                        <h2 style="margin: 0; font-size: 20px; font-weight: 500; color: #ffffff;">Are you sure?</h2>
                        <div style="font-size: 13px; color: #9aa0a6; margin-top: 4px;">
                            <b>${count}</b> media item(s) will be updated. Changes will be saved to Google Photos and the page will automatically reload.
                        </div>
                    </div>
                </div>
            </div>

            <!-- Table of modified media -->
            <div style="padding: 18px 28px; overflow-y: auto; max-height: 56vh; display: flex; flex-direction: column; gap: 12px;">
                <div style="border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; background: #17181b; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="background: rgba(255, 255, 255, 0.04); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                                <th style="padding: 10px 12px; font-size: 11px; font-weight: 600; color: #9aa0a6; text-transform: uppercase; width: 36px; text-align: center;">#</th>
                                <th style="padding: 10px 14px; font-size: 11px; font-weight: 600; color: #9aa0a6; text-transform: uppercase; letter-spacing: 0.5px; width: 68px;">Preview</th>
                                <th style="padding: 10px 16px; font-size: 11px; font-weight: 600; color: #9aa0a6; text-transform: uppercase; letter-spacing: 0.5px;">Old date, time & timezone ➔ New date, time & timezone</th>
                            </tr>
                        </thead>
                        <tbody class="gp-confirm-table-body"></tbody>
                    </table>
                </div>
                <div class="gp-confirm-error-banner" style="display: none; margin-top: 8px; padding: 10px 14px; background: rgba(234, 67, 53, 0.15); border: 1px solid rgba(234, 67, 53, 0.4); border-radius: 8px; color: #f28b82; font-size: 13px; line-height: 1.4;"></div>
            </div>

            <!-- Actions -->
            <div style="padding: 16px 28px; display: flex; align-items: center; justify-content: flex-end; gap: 12px; background: #202124;">
                <button class="gp-confirm-cancel-btn" style="background: transparent; color: #8ab4f8; border: 1px solid #5f6368; border-radius: 20px; padding: 0 20px; height: 36px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background-color 0.15s;">Cancel</button>
                <button class="gp-confirm-save-btn" style="background-color: #8ab4f8; color: #202124; border: none; border-radius: 20px; padding: 0 24px; height: 36px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: background-color 0.15s, box-shadow 0.15s;">Confirm</button>
            </div>
        </div>
    `;
};

window.TimTools.Modules.DragInTimeTemplates.formatDateDiff = function (oldDate, newDate) {
    const pad = (n) => String(n).padStart(2, '0');
    const oY = oldDate.getFullYear(), oM = oldDate.getMonth() + 1, oD = oldDate.getDate();
    const oH = oldDate.getHours(), oMin = oldDate.getMinutes(), oS = oldDate.getSeconds();
    const nY = newDate.getFullYear(), nM = newDate.getMonth() + 1, nD = newDate.getDate();
    const nH = newDate.getHours(), nMin = newDate.getMinutes(), nS = newDate.getSeconds();

    const getTz = (d) => {
        const off = -d.getTimezoneOffset();
        const sign = off >= 0 ? '+' : '-';
        const h = Math.floor(Math.abs(off) / 60);
        return `GMT${sign}${h}`;
    };
    const oTz = getTz(oldDate);
    const nTz = getTz(newDate);

    const diffTz = oTz !== nTz;

    const spanOld = (val, isDiff) => isDiff
        ? `<strong style="font-weight: 800; color: #f28b82;">${val}</strong>`
        : `<span style="color: #9aa0a6;">${val}</span>`;

    const spanNew = (val, isDiff) => isDiff
        ? `<strong style="font-weight: 800; color: #8ab4f8;">${val}</strong>`
        : `<span style="color: #9aa0a6;">${val}</span>`;

    const oldDateStr = `${spanOld(pad(oD), oD !== nD)}.${spanOld(pad(oM), oM !== nM)}.${spanOld(oY, oY !== nY)}`;
    const oldTimeStr = `${spanOld(pad(oH), oH !== nH)}:${spanOld(pad(oMin), oMin !== nMin)}:${spanOld(pad(oS), oS !== nS)}`;
    const oldTzStr = spanOld(oTz, diffTz);

    const newDateStr = `${spanNew(pad(nD), oD !== nD)}.${spanNew(pad(nM), oM !== nM)}.${spanNew(nY, oY !== nY)}`;
    const newTimeStr = `${spanNew(pad(nH), oH !== nH)}:${spanNew(pad(nMin), oMin !== nMin)}:${spanNew(pad(nS), oS !== nS)}`;
    const newTzStr = spanNew(nTz, diffTz);

    return {
        oldHtml: `<span style="margin-right: 14px; font-weight: 500;">${oldDateStr}</span><span style="margin-right: 14px; font-weight: 500;">${oldTimeStr}</span><span style="font-size: 11px; opacity: 0.9;">${oldTzStr}</span>`,
        newHtml: `<span style="margin-right: 14px; font-weight: 500;">${newDateStr}</span><span style="margin-right: 14px; font-weight: 500;">${newTimeStr}</span><span style="font-size: 11px; opacity: 0.9;">${newTzStr}</span>`
    };
};
