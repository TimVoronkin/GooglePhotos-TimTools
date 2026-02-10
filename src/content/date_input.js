(function () {
    const CONTAINER_SELECTOR = '.Aul2T.m6aMje';
    const INPUT_SELECTOR = 'input.Ax4B8.ZAGvjd, textarea.Ax4B8.ZAGvjd'; // sometimes search is textarea? usually input
    const ICON_URL = chrome.runtime.getURL('assets/calendar.png');

    // --- Parser Logic ---
    const MONTH_NAMES = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6, 'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
        // Ukrainian
        'січ': 1, 'лют': 2, 'бер': 3, 'кві': 4, 'тра': 5, 'чер': 6, 'лип': 7, 'сер': 8, 'вер': 9, 'жов': 10, 'лис': 11, 'гру': 12,
        'січень': 1, 'лютий': 2, 'березень': 3, 'квітень': 4, 'травень': 5, 'червень': 6, 'липень': 7, 'серпень': 8, 'вересень': 9, 'жовтень': 10, 'листопад': 11, 'грудень': 12,
        'січня': 1, 'лютого': 2, 'березня': 3, 'квітня': 4, 'травня': 5, 'червня': 6, 'липня': 7, 'серпня': 8, 'вересня': 9, 'жовтня': 10, 'листопада': 11, 'грудня': 12,
        // Russian
        'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'май': 5, 'июн': 6, 'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12,
        'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4, 'мая': 5, 'июнь': 6, 'июль': 7, 'август': 8, 'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12,
        'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4, 'июня': 6, 'июля': 7, 'августа': 8, 'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12
    };

    function parseDate(text) {
        if (!text) return null;
        text = text.trim().toLowerCase();

        // Normalize separators
        text = text.replace(/[\.\,\/\-\\]/g, ' ');
        // Split by space
        const parts = text.split(/\s+/).filter(p => p.length > 0);

        let year, month, day;
        let numbers = [];
        let monthFound = false;

        // Extract year (4 digits) and month names
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            const val = parseInt(p, 10);

            if (MONTH_NAMES[p]) {
                month = MONTH_NAMES[p];
                monthFound = true;
            } else if (!isNaN(val)) {
                if (p.length === 4) {
                    year = val;
                } else {
                    numbers.push(val);
                }
            }
        }

        // Determine Day and Month from numbers if not found
        if (!monthFound) {
            if (numbers.length >= 2) {
                // Ambiguity handling
                // Usually [Day, Month] or [Month, Day]
                // Or [Year, Month, Day] if year wasn't 4 digits (unlikely for 2XXX)

                const n1 = numbers[0];
                const n2 = numbers[1];

                if (n1 > 12) {
                    day = n1;
                    month = n2;
                } else if (n2 > 12) {
                    month = n1;
                    day = n2;
                } else {
                    // Both <= 12. Assume DD MM (Day first) standard for UA/EU
                    day = n1;
                    month = n2;
                }

                if (numbers.length >= 3 && !year) {
                    // Maybe 2-digit year? Let's assume the third number might be it?
                    // Or first? YYYY MM DD -> year found above. 
                    // YY MM DD -> not supporting 2 digit years strongly, but let's try
                    if (numbers[2] > 31) year = 1900 + numbers[2]; // very basic fallback
                }
            } else if (numbers.length === 1 && year) {
                // Only year and one number? unlikely
            }
        } else {
            // Month found, remaining number is day
            if (numbers.length >= 1) {
                day = numbers[0];
            }
        }

        const now = new Date();
        if (!year) year = now.getFullYear();
        if (!month) month = 1; // Default
        if (!day) day = 1; // Default

        // Basic validation
        if (month < 1 || month > 12) return null;
        if (day < 1 || day > 31) return null; // Loose check

        // Format YYYY.MM.DD
        const pad = (n) => n.toString().padStart(2, '0');
        return `${year}.${pad(month)}.${pad(day)}`;
    }

    // --- Popup UI ---
    let popupContainer = null;
    let resolveCallback = null;

    function createPopup() {
        if (popupContainer) return popupContainer;

        const overlay = document.createElement('div');
        overlay.id = 'date-picker-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            display: 'none', zIndex: 10000, backgroundColor: 'transparent' // Click outside to close logic
        });

        const popup = document.createElement('div');
        popup.id = 'date-picker-popup';
        Object.assign(popup.style, {
            position: 'absolute',
            backgroundColor: '#1e1f20',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            borderRadius: '8px',
            padding: '16px',
            fontFamily: 'Roboto, sans-serif',
            width: '250px',
            userSelect: 'none'
        });

        // Styles
        const style = document.createElement('style');
        style.innerText = `
            .dp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .dp-btn { background: none; border: none; cursor: pointer; padding: 4px 8px; font-weight: bold; border-radius: 4px; color: #e8eaed; }
            .dp-btn:hover { background-color: rgba(255, 255, 255, 0.08); }
            .dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
            .dp-day-header { font-size: 12px; color: #9aa0a6; padding: 4px 0; }
            .dp-day { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; margin: 2px auto; cursor: pointer; border-radius: 50%; font-size: 13px; color: #e8eaed; }
            .dp-day:hover { background-color: rgba(255, 255, 255, 0.08); }
            .dp-day.selected { background-color: #8ab4f8; color: #202124; }
            .dp-day.today { border: 1px solid #8ab4f8; box-sizing: border-box; }
            .dp-day.empty { pointer-events: none; }
            .dp-year-list { display: flex; flex-direction: column; gap: 2px; height: 230px; overflow-y: auto; padding-right: 4px; margin-top: 5px; }
            .dp-year-list::-webkit-scrollbar { width: 6px; }
            .dp-year-list::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.2); border-radius: 3px; }
            .dp-year-item { padding: 8px 0; cursor: pointer; border-radius: 4px; color: #e8eaed; text-align: center; font-size: 14px; }
            .dp-year-item:hover { background-color: rgba(255, 255, 255, 0.08); }
            .dp-year-item.current { border: 1px solid #8ab4f8; box-sizing: border-box; }
            .dp-year-item.selected { background-color: #424548; } 
         `;
        document.head.appendChild(style);

        // State
        let currentMonth = new Date().getMonth(); // 0-11
        let currentYear = new Date().getFullYear();
        let view = 'calendar'; // 'calendar', 'year'

        // Elements
        const header = document.createElement('div');
        header.className = 'dp-header';

        const prevBtn = document.createElement('button');
        prevBtn.innerText = '<';
        prevBtn.className = 'dp-btn';

        const labelBtn = document.createElement('button');
        labelBtn.className = 'dp-btn';
        labelBtn.style.flexGrow = 1;

        const nextBtn = document.createElement('button');
        nextBtn.innerText = '>';
        nextBtn.className = 'dp-btn';

        header.append(prevBtn, labelBtn, nextBtn);

        const containerDiv = document.createElement('div');
        // We will switch content inside this container or just rebuild popup content?
        // Rebuilding content area is easier.

        const contentArea = document.createElement('div');

        popup.append(header, contentArea);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        popupContainer = overlay;

        // Render Logic
        const render = () => {
            contentArea.innerHTML = '';
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

            if (view === 'calendar') {
                prevBtn.style.visibility = 'visible';
                nextBtn.style.visibility = 'visible';
                labelBtn.innerText = `${monthNames[currentMonth]} ${currentYear}`;

                const grid = document.createElement('div');
                grid.className = 'dp-grid';

                // Day Headers
                ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(d => {
                    const el = document.createElement('div');
                    el.className = 'dp-day-header';
                    el.innerText = d;
                    grid.appendChild(el);
                });

                // Days
                const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
                const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

                // Adjust for Monday start: Mon=1...Sun=7
                let startOffset = firstDay === 0 ? 6 : firstDay - 1;

                // Empty slots
                for (let i = 0; i < startOffset; i++) {
                    const el = document.createElement('div');
                    el.className = 'dp-day empty';
                    grid.appendChild(el);
                }

                const today = new Date();

                for (let d = 1; d <= daysInMonth; d++) {
                    const el = document.createElement('div');
                    el.className = 'dp-day';
                    el.innerText = d;

                    if (currentYear === today.getFullYear() && currentMonth === today.getMonth() && d === today.getDate()) {
                        el.classList.add('today');
                    }

                    el.onclick = (e) => {
                        e.stopPropagation();
                        // Select
                        const finalDate = `${currentYear}.${(currentMonth + 1).toString().padStart(2, '0')}.${d.toString().padStart(2, '0')}`;
                        closePopup(finalDate);
                    };
                    grid.appendChild(el);
                }
                contentArea.appendChild(grid);
            } else if (view === 'year') {
                prevBtn.style.visibility = 'hidden';
                nextBtn.style.visibility = 'hidden';
                labelBtn.innerText = 'Back to Calendar'; // Or just keep it as is? "Select Year"?
                // User said: "пісял натискання на потрібний рік, відкривається знов початковий нормальний календарик"

                const yearList = document.createElement('div');
                yearList.className = 'dp-year-list';

                const todayYear = new Date().getFullYear();
                const startYear = 1950;

                for (let y = startYear; y <= todayYear; y++) {
                    const el = document.createElement('div');
                    el.className = 'dp-year-item';
                    el.innerText = y;

                    if (y === todayYear) el.classList.add('current');
                    if (y === currentYear) el.classList.add('selected'); // Highlight currently selected year too

                    el.onclick = (e) => {
                        e.stopPropagation();
                        currentYear = y;
                        view = 'calendar';
                        render();
                    };
                    yearList.appendChild(el);
                }
                contentArea.appendChild(yearList);

                // Scroll to bottom (current year)
                setTimeout(() => {
                    yearList.scrollTop = yearList.scrollHeight;
                }, 0);
            }
        };

        // Handlers
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            if (view === 'calendar') {
                currentMonth--;
                if (currentMonth < 0) { currentMonth = 11; currentYear--; }
                render();
            }
        };

        nextBtn.onclick = (e) => {
            e.stopPropagation();
            if (view === 'calendar') {
                currentMonth++;
                if (currentMonth > 11) { currentMonth = 0; currentYear++; }
                render();
            }
        };

        labelBtn.onclick = (e) => {
            e.stopPropagation();
            if (view === 'calendar') {
                view = 'year';
                render();
            } else {
                view = 'calendar';
                render();
            }
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) closePopup(null);
        };

        render();
        return overlay;
    }

    function showPopup(button, callback) {
        if (!popupContainer) createPopup();
        resolveCallback = callback;

        popupContainer.style.display = 'block';
        const popup = popupContainer.querySelector('#date-picker-popup');

        // Position near button
        const rect = button.getBoundingClientRect();
        popup.style.top = (rect.bottom + 5) + 'px';
        popup.style.left = Math.max(10, rect.left - 200) + 'px'; // Adjust to keep inside
    }

    function closePopup(date) {
        if (popupContainer) popupContainer.style.display = 'none';
        if (resolveCallback && date) resolveCallback(date);
    }


    // --- Interaction ---
    function setInputValue(newVal) {
        // We need to find the specific input again as it might have changed
        const input = document.querySelector(INPUT_SELECTOR);
        if (!input) return;

        input.value = newVal;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    }

    function onBtnClick(e) {
        const input = document.querySelector(INPUT_SELECTOR);
        const text = input ? input.value : '';
        const parsed = parseDate(text);

        if (parsed) {
            setInputValue(parsed);
        } else {
            showPopup(e.currentTarget, (date) => {
                setInputValue(date);
            });
        }
    }

    function injectButton() {
        // Container: "Aul2T m6aMje"
        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container || container.querySelector('.custom-date-btn')) return;

        const btn = document.createElement('div');
        btn.className = 'custom-date-btn'; // marker class
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.marginRight = '16px';

        const img = document.createElement('img');
        img.src = ICON_URL;
        img.style.width = '24px';
        img.style.height = '24px';
        img.style.opacity = '0.7';

        btn.appendChild(img);
        btn.onclick = onBtnClick;

        container.appendChild(btn);
    }

    // --- Observer ---
    const observer = new MutationObserver(() => {
        injectButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial Try
    injectButton();

})();
