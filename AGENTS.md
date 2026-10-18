# AI Developer Guidelines & Architecture Reference (Google Photos Tim Tools)

This document is the single source of truth for AI agents and human developers modifying, maintaining, or creating new features in the **Google Photos Tim Tools** extension.

---

## 1. Extension Architecture Overview

- **Platform:** Google Chrome Extension (Manifest V3).
- **Core Scope:** Injected into `*://photos.google.com/*`.
- **Global Namespace:** Everything is scoped under `window.TimTools`:
  - `window.TimTools.Logger` — Unified debug logger.
  - `window.TimTools.Settings` — Synchronized `chrome.storage.sync` settings wrapper.
  - `window.TimTools.DOM` — DOM manipulation & element creation helpers.
  - `window.TimTools.Theme` — Theme detector & manager (`dark` vs `light`).
  - `window.TimTools.API` — Centralized Google Photos batchexecute RPC client & token extractor.
  - `window.TimTools.Modules` — Container for all feature modules (e.g. `UpButton`, `DateSearch`, `DragInTime`, `SmartArchiving`, `AlbumQuickRemove`).

---

## 2. Standard Checklist for Creating a New Module

When adding a new module named `<NewModule>` (e.g., `MyFeature`):

### Step 1: Module Directory & Files

Create a subfolder in `src/content/modules/<my_feature>/`:

- `src/content/modules/<my_feature>/<my_feature>.js`
- `src/content/modules/<my_feature>/<my_feature>.css`

Structure of `<my_feature>.js`:

```javascript
window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};

(function () {
  const logger =
    window.TimTools.Logger && window.TimTools.Logger.create
      ? window.TimTools.Logger.create("MyFeature")
      : {
          log: (...args) => console.log("[GP-TimTools][MyFeature]", ...args),
          warn: (...args) => console.warn("[GP-TimTools][MyFeature]", ...args),
          error: (...args) =>
            console.error("[GP-TimTools][MyFeature]", ...args),
        };

  const MyFeature = {
    init: function () {
      logger.log("Init MyFeature");
      // Attach observers, listeners, etc.
    },
  };

  window.TimTools.Modules.MyFeature = MyFeature;
})();
```

### Step 2: Register in `manifest.json`

- Add `"src/content/modules/<my_feature>/<my_feature>.js"` to `content_scripts[0].js` (before `src/content/main.js`).
- Add `"src/content/modules/<my_feature>/<my_feature>.css"` to `content_scripts[0].css`.

### Step 3: Add Default Settings in `src/core/settings.js`

In `DEFAULTS`:

```javascript
enableMyFeature: true,
```

### Step 4: Register in Options Page

1. **`src/options/options.html`:**
   Add a `<section class="feature-card" id="card-myFeature">` with icon, title, toggle `<input type="checkbox" id="enableMyFeature">`, and description.
2. **`src/options/styles.css`:**
   Add a mask definition for the card icon:
   ```css
   .icon-my-feature {
     mask-image: url("../../assets/icons/my-icon.svg");
     -webkit-mask-image: url("../../assets/icons/my-icon.svg");
   }
   ```
3. **`src/options/options.js`:**
   - Define `const enableMyFeature = document.getElementById('enableMyFeature');`.
   - Add to `cards` object: `myFeature: { toggle: enableMyFeature, card: document.getElementById('card-myFeature') }`.
   - Add to `checkableInputs` array.
   - Restore in `restoreOptions()`: `if (enableMyFeature) enableMyFeature.checked = items.enableMyFeature !== false;`.
   - Save in `saveOptions()`: `enableMyFeature: enableMyFeature ? enableMyFeature.checked : true,`.

### Step 5: Initialize in `src/content/main.js`

In `init()`:

```javascript
if (settings.enableMyFeature) {
  if (Modules.MyFeature) {
    Modules.MyFeature.init();
    logger.log("MyFeature module loaded.");
  } else {
    logger.error("MyFeature module missing!");
  }
}
```

### Step 6: Accent Colors Integration in `src/content/main.js`

In `applyCustomIconColors(settings)`:

- Determine icon color:
  ```javascript
  const myFeatureLightColor = isCustom ? customDarkAccent : "#444746";
  const myFeatureDarkColor = isCustom ? customLightAccent : "#C4C7C5";
  ```
- Add CSS rules to `#gp-timtools-custom-colors` for light and dark themes.

---

## 3. Crucial Google Photos SPA & DOM Gotchas

### A. DOM Virtualization (Duplicate Inactive Elements)

- Google Photos keeps cached virtual slides for adjacent photos in the DOM (often 9+ identical container elements).
- **Rule:** NEVER use `document.querySelector('.some-class')` directly without checking geometry.
- **Always filter by visibility and viewport:**
  ```javascript
  function getActiveContainer() {
    const elements = document.querySelectorAll(".some-class");
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.left < window.innerWidth
      ) {
        if (!el.closest('[aria-hidden="true"]')) {
          return el;
        }
      }
    }
    return null;
  }
  ```

### B. Single Page Navigation (SPA Routing)

- Google Photos transitions views and photos via History API without full page reloads.
- **Rule:** Combine a `MutationObserver` on `document.body` (monitoring `childList`, `subtree`, and `attributes` like `class`, `style`, `aria-hidden`) with a safety polling interval (`setInterval(..., 500)`).
- Keep track of `lastUrl = window.location.href` to trigger logic when the photo or route changes.

### C. Event Bubbling & Google `jsaction`

- Google Photos uses event delegation on parent containers and anchor tags (`<a class="rugHuc" ...>`).
- If you inject custom buttons inside or adjacent to Google links, you **MUST** isolate click events:
  ```javascript
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    // Handle action
  });
  btn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });
  ```

### D. Isolated Content Script World & Session Tokens

- Content scripts run in an isolated execution world and **cannot** read `window.WIZ_global_data` directly.
- **Centralized Helper:** Always use `window.TimTools.API.getSessionData()` or `window.TimTools.API.makeRequest(rpcid, data, sourcePath)` from `src/core/api.js`.
- It automatically parses DOM `<script>` tags for `SNlM0e`, `FdrFJe`, `cfb2h`, `eptZe`, and caches them across calls.

---

## 4. Google Photos Internal RPC (`batchexecute`) Mechanics

Google Photos web communicates with its servers via POST requests to:
`https://photos.google.com${basePath}data/batchexecute?${paramsString}`

### Request Structure

- **Query parameters:** `rpcids`, `source-path`, `f.sid`, `bl`, `hl=en`, `soc-app=165`, `soc-platform=1`, `soc-device=1`, `pageId=none`, `rt=c`.
- **Form Data body:**
  ```javascript
  const wrapped = [[[rpcid, JSON.stringify(requestData), null, "generic"]]];
  const body = `f.req=${encodeURIComponent(JSON.stringify(wrapped))}&at=${encodeURIComponent(wizData.at)}&`;
  ```
- **Response Parsing:**
  - Google returns `)]}'\n` followed by line chunks.
  - Filter lines by `line.includes('wrb.fr')`.
  - Parse line `JSON.parse(line)[0][2]` as inner JSON payload.

### Known RPCs in this Extension

| RPC ID   | Purpose                              | Request Data Structure                                      |
| -------- | ------------------------------------ | ----------------------------------------------------------- |
| `Z5xsfc` | Fetch all user albums                | `[null, null, null, null, 1, null, null, 100, [2], 5]`      |
| `snAcKc` | Fetch items / photo keys in an album | `[albumMediaKey, pageId, null, null]`                       |
| `w7TP3c` | Archive / Unarchive media items      | `[mappedKeys, null, 1]`                                     |
| `DaSgWe` | Batch modify timestamps & timezones  | `[[[dedupKey, timestampSec, timezoneSec], ...]]`            |
| `VrseUb` | Resolve item info (dedupKey, tz)     | `[mediaKey, null, null, null, null]`                        |
| `ycV3Nd` | Remove item from album               | `[[albumItemKey]]` (with `source-path: /album/${albumKey}`) |

### CRITICAL: Global Library Photo Key vs Album Item Key

- A photo has a **global `dedupKey` / `mediaKey`** in the main timeline (shown in `/photo/<key>`).
- When added to an album, Google Photos assigns an **internal `albumItemKey`** representing that photo's membership in that specific album.
- In `snAcKc` response items:
  - `item[0]` is the **`albumItemKey`**.
  - `item[3]` is the global **`dedupKey`**.
- Calling album removal (`ycV3Nd`) **REQUIRES `albumItemKey` (`item[0]`)**, not the global photo key!
- **Rule:** Before calling `ycV3Nd`, always query `snAcKc` for that album to match the photo's global key and retrieve its `albumItemKey`.

---

## 5. UI, Theme, & Styling Rules

- **Theme Support:** Must always support both Dark (`#202124`) and Light (`#ffffff`) modes.
- **Default Icon Colors (when Override Accent Colors is OFF):**
  - Light theme: `#444746`.
  - Dark theme: `#C4C7C5`.
- **Custom Accent Colors:** Respect `:root` and `html` classes `--gp-active-accent`.
- **Dialogs & Modals:**
  - Follow Google Photos Material 3 dialog styling (rounded corners `24px`, subtle shadow, blurred backdrop).
  - Trap key events so they do not bubble up to Google Photos background handlers.
- **Icons & SVG Masks:**
  - Icons stored in `assets/icons/` and rendered via CSS `mask-image` must be strictly well-formed, valid XML SVGs without extra content or unclosed tags.
  - Keep viewBox aspect ratio 1:1 (square) and ensure ~85-88% optical fill (matching Material Design 24x24 keylines) so all toolbar, button, and card icons have consistent visual weight.

---

## 6. Build, Release, & Store Information

- **Chrome Web Store ID:** `jfbkeejcoccjomdfcnihgcohfmflaojn`
- **Store URL:** `https://chromewebstore.google.com/detail/jfbkeejcoccjomdfcnihgcohfmflaojn`
- **Reviews URL:** `https://chromewebstore.google.com/detail/jfbkeejcoccjomdfcnihgcohfmflaojn/reviews`
- **Building a Release:**
  - Run `npm run build` (or `.\build.ps1` in PowerShell).
  - Always bump `"version"` in `manifest.json` before building a new release for Chrome Web Store.
  - The build script outputs a clean `dist/GooglePhotos-TimTools-v<version>.zip` ready for upload to the Chrome Web Store Developer Dashboard.
  - It automatically strips the local `"key"` property required only for unpacked development.
