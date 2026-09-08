// ===================================================
// Google Photos TimTools - Modal Template
// ===================================================

window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};
window.TimTools.Modules.DragInTimeTemplates = window.TimTools.Modules.DragInTimeTemplates || {};

window.TimTools.Modules.DragInTimeTemplates.getModalOverlayHtml = function () {
    return /* html */ `
        <div class="gp-drag-modal-dialog" role="dialog" aria-modal="true">
            <!-- Header -->
            <div class="gp-drag-modal-header">
                <div class="gp-header-title-row">
                    <div class="gp-header-icon-box">
                        <svg width="22" height="22" viewBox="0 -960 960 960" fill="currentColor">
                            <path d="M480-80 310-250l57-57 73 73v-206H235l73 72-58 58L80-480l169-169 57 57-72 72h206v-206l-73 73-57-57 170-170 170 170-57 57-73-73v206h205l-73-72 58-58 170 170-170 170-57-57 73-73H520v205l72-73 58 58L480-80Z"/>
                        </svg>
                    </div>
                    <div>
                        <h2 class="gp-header-title">Drag in Time</h2>
                        <div class="gp-header-subtitle">Reorder photos chronologically or adjust timestamps visually</div>
                    </div>
                </div>
                <button class="gp-modal-close-btn" title="Close window">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>

            <!-- Body Photostream -->
            <div class="gp-drag-modal-body">
                <!-- Top Load Newer Button (Always at the very top before any photo) -->
                <div class="gp-load-top-wrapper">
                    <button class="gp-load-btn gp-load-newer" style="display: none;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5z"/></svg>
                        <span>Load newer photos</span>
                    </button>
                </div>

                <div class="gp-photos-stream-container"></div>

                <!-- Bottom Load Older Button (Always at the very bottom after all photos) -->
                <div class="gp-load-bottom-wrapper">
                    <button class="gp-load-btn gp-load-older" style="display: none;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                        <span>Load older photos</span>
                    </button>
                </div>
            </div>

            <!-- Footer -->
            <div class="gp-drag-modal-footer">
                <div class="gp-modal-status-info">
                    <span class="gp-count-loaded">0 photos loaded</span>
                    <span class="gp-selected-badge" style="display: none; background: rgba(138, 180, 248, 0.15); color: #8ab4f8; padding: 2px 8px; border-radius: 10px; font-weight: 500; font-size: 11px;">0 selected</span>
                    <span class="gp-modified-badge" style="display: none; background: rgba(138, 180, 248, 0.2); color: #8ab4f8; padding: 2px 8px; border-radius: 10px; font-weight: 500; font-size: 11px;">0 modified</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="gp-modal-back-btn">Cancel</button>
                    <button class="gp-modal-save-btn">Next</button>
                </div>
            </div>
        </div>
    `;
};
