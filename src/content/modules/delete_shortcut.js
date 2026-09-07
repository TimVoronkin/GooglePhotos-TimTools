window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
    const DeleteShortcut = {
        init: function () {
            console.log('[GP-TimTools] DeleteShortcut: Init');
            // Listen in the capturing phase to intercept the key before page handlers
            window.addEventListener('keydown', this.handleKeyDown.bind(this), true);
        },

        handleKeyDown: function (event) {
            // Check if we are currently viewing a photo
            const url = window.location.href;
            const isPhotoView = url.includes('/photo/');

            if (!isPhotoView) return;

            // Intercept 'Delete' key press
            if (event.key === 'Delete') {
                // Ignore if the user is typing inside input fields, textareas or editables
                const activeEl = document.activeElement;
                if (activeEl) {
                    const tagName = activeEl.tagName.toLowerCase();
                    if (tagName === 'input' || tagName === 'textarea' || activeEl.isContentEditable) {
                        return;
                    }
                }

                console.log('[TimTools] DeleteShortcut: Intercepted Delete key. Searching for native delete button.');

                // Prevent default delete key action
                event.preventDefault();
                event.stopPropagation();

                // Find and click the native delete button
                const deleteBtn = this.findDeleteButton();
                if (deleteBtn) {
                    console.log('[TimTools] DeleteShortcut: Clicking native delete button.');
                    deleteBtn.click();
                } else {
                    console.warn('[TimTools] DeleteShortcut: Delete button not found in DOM.');
                }
            }
        },

        findDeleteButton: function () {
            // 1. Search by aria-label keywords (supports English, Ukrainian, Russian)
            const keywords = ['delete', 'trash', 'видалити', 'удалить', 'кошик', 'корзин'];
            const buttons = document.querySelectorAll('button[aria-label]');
            for (let btn of buttons) {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                if (keywords.some(kw => label.includes(kw))) {
                    // Ensure it is visible
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        return btn;
                    }
                }
            }

            // 2. Search by SVG path keywords as fallback
            const paths = document.querySelectorAll('svg path');
            for (let path of paths) {
                const d = path.getAttribute('d') || '';
                // Common trash can shapes in Material Design icons
                if (d.startsWith('M6 19') || d.startsWith('M16 9') || d.includes('M15 4') || d.includes('19c0 1.1')) {
                    const btn = path.closest('button');
                    if (btn) {
                        const rect = btn.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            return btn;
                        }
                    }
                }
            }

            return null;
        }
    };

    window.TimTools.Modules.DeleteShortcut = DeleteShortcut;
})();
