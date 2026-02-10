(function () {
    function addTimelineButton() {
        // Remove existing button if present
        var oldButton = document.getElementById('show-in-timeline-btn');
        if (oldButton) oldButton.remove();

        var url = window.location.href;
        var match = url.match(/photos.google.com\/(.+\/)?photo\//);
        // Show button only if 'photo/' is present and not at the start
        if (match && match[1] && !match[1].startsWith('photo/')) {
            var button = document.createElement('button');
            button.id = 'show-in-timeline-btn';
            button.title = 'Show in timeline';
            button.style.position = 'fixed';
            button.style.top = '10px';
            button.style.left = '58px';
            button.style.zIndex = '9999';
            button.style.background = 'none';
            button.style.padding = '8px';
            button.style.border = 'none';
            button.style.boxShadow = 'none';
            button.style.cursor = 'pointer';
            button.style.display = 'block';
            button.style.alignItems = null;
            button.innerHTML = `
                <svg width="28" height="28" viewBox="-0.5 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
                    <path d="M8 13.8599L10.87 10.8C11.0125 10.6416 11.1868 10.5149 11.3815 10.4282C11.5761 10.3415 11.7869 10.2966 12 10.2966C12.2131 10.2966 12.4239 10.3415 12.6185 10.4282C12.8132 10.5149 12.9875 10.6416 13.13 10.8L16 13.8599" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M3 7.41992L3 17.4199C3 19.6291 4.79086 21.4199 7 21.4199H17C19.2091 21.4199 21 19.6291 21 17.4199V7.41992C21 5.21078 19.2091 3.41992 17 3.41992H7C4.79086 3.41992 3 5.21078 3 7.41992Z" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            button.addEventListener('click', function () {
                // Remove everything between domain and /photo/ (keep /photo/ and after)
                var newUrl = url.replace(/(photos.google.com\/)\S+?(\/photo\/)/, '$1$2');
                // Remove possible double slash after domain
                newUrl = newUrl.replace('photos.google.com//', 'photos.google.com/');
                window.location.href = newUrl;
            });
            document.body.appendChild(button);
        }
    }

    // Observe URL changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            addTimelineButton();
        }
    }).observe(document, { subtree: true, childList: true });

    window.addEventListener('load', addTimelineButton);
})();
