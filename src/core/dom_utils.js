window.TimTools = window.TimTools || {};

(function () {
    window.TimTools.DOM = {
        waitFor: function (selector, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);

                const observer = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (el) {
                        observer.disconnect();
                        resolve(el);
                    }
                });

                observer.observe(document.body, { childList: true, subtree: true });

                if (timeout > 0) {
                    setTimeout(() => {
                        observer.disconnect();
                        reject(new Error(`Timeout waiting for ${selector}`));
                    }, timeout);
                }
            });
        },

        createElement: function (tag, options = {}) {
            const el = document.createElement(tag);
            if (options.id) el.id = options.id;
            if (options.className) el.className = options.className;
            if (options.text) el.textContent = options.text;
            if (options.html) el.innerHTML = options.html;

            if (options.style) {
                Object.assign(el.style, options.style);
            }

            if (options.attrs) {
                for (const [key, value] of Object.entries(options.attrs)) {
                    el.setAttribute(key, value);
                }
            }

            if (options.events) {
                for (const [key, handler] of Object.entries(options.events)) {
                    el.addEventListener(key, handler);
                }
            }

            return el;
        }
    };
})();
