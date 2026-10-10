// ===================================================
// Google Photos TimTools - Photo Card Template
// ===================================================

window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};
window.TimTools.Modules.DragInTimeTemplates = window.TimTools.Modules.DragInTimeTemplates || {};

window.TimTools.Modules.DragInTimeTemplates.getPhotoCardHtml = function (photo, options) {
    const isDraggable = !!photo.isSelected;
    const timeStr = options.formattedTime || '';
    const gmtStr = options.gmtString || 'GMT';
    const dateStr = options.dateString || '';

    return /* html */ `
        <!-- Top-Left "drag" Badge (Selected) or "Library" Badge (Context) -->
        ${isDraggable ? /* html */ `
            <div class="gp-card-drag-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                </svg>
                <span>drag</span>
            </div>
        ` : (photo.isContextPhoto ? /* html */ `
            <div class="gp-card-context-badge" title="Reference photo from your Main Library timeline">
                <span>Library</span>
            </div>
        ` : '')}

        <!-- Top-Right "modified" Badge -->
        <div class="gp-card-modified-badge">modified</div>

        <!-- Thumbnail Image or Fallback -->
        ${photo.bgUrl ? /* html */ `
            <img class="gp-card-img" src="${photo.bgUrl}" alt="Photo" loading="lazy" />
        ` : /* html */ `
            <div class="gp-card-fallback-img">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
            </div>
        `}

        <!-- Bottom-Right Badges Container (Video duration placed above Filename tag) -->
        <div class="gp-card-bottom-right">
            ${photo.isVideo && photo.duration ? /* html */ `
                <div class="gp-card-video-badge">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    <span>${photo.duration}</span>
                </div>
            ` : ''}
            <div class="gp-card-filename-badge" title="${photo.filename || ''}">
                ${photo.filename || ''}
            </div>
        </div>

        <!-- Bottom-Left Time Display -->
        <div class="gp-card-time-display" ${isDraggable ? 'title="Click to edit date, time & timezone"' : 'title="Photo timestamp"'}>
            ${timeStr}
        </div>

        <!-- Bottom Timeline Slider (Selected photos only) -->
        ${isDraggable ? /* html */ `
            <div class="gp-card-slider-wrapper" title="Drag to adjust time between neighbors" draggable="false">
                <input type="range" class="gp-time-slider" min="0" max="100" value="50" step="1" draggable="false" />
            </div>
        ` : ''}

        <!-- Bottom Blue Bar: Inline Manual Edit (Selected photos only) -->
        ${isDraggable ? /* html */ `
            <div class="gp-card-manual-bar" style="display: none;" draggable="false">
                <div class="gp-manual-bar-content">
                    <input type="text" class="gp-manual-input gp-input-time" value="${timeStr}:00" placeholder="HH:MM:SS" spellcheck="false" title="Time (HH:MM:SS)" />
                    <input type="text" class="gp-manual-input gp-input-tz" value="${gmtStr}" placeholder="GMT+X" spellcheck="false" title="Timezone (GMT+X)" />
                    <input type="text" class="gp-manual-input gp-input-date" value="${dateStr}" placeholder="D.M.YYYY" spellcheck="false" title="Date (D.M.YYYY)" />
                </div>
            </div>
        ` : ''}
    `;
};
