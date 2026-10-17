# Privacy Policy for Google Photos Tim Tools

**Last Updated:** October 17, 2026

Google Photos Tim Tools ("we", "our", or "the extension") is an open-source browser extension designed to enhance user productivity and management within Google Photos. We are committed to transparency and respecting your privacy.

---

### 1. Zero Data Collection & Zero External Servers

* **No Remote Servers:** The extension does not operate or communicate with any external, third-party, or developer-owned servers.
* **No Analytics or Telemetry:** We do not track, log, or collect your browsing habits, analytics, performance metrics, or diagnostic telemetry.
* **No Selling or Transfer of Data:** We never sell, monetize, or transfer your personal data or photos to any third party.

---

### 2. How Data Is Processed

All operations occur **100% locally** within your browser on your device:

1. **User Preferences & Settings:**
   * Toggles (enabled/disabled modules), custom theme colors, and user-defined Smart Archiving filter album IDs are stored securely using Chrome's native storage API (`chrome.storage.sync` and `chrome.storage.local`).
   * This data remains strictly within your browser profile and Google account sync.

2. **Photo Content and Metadata:**
   * When using features like *Drag in Time*, *Smart Archiving*, *Date Search*, or *KML Geotag Export*, the extension interacts directly with Google Photos pages and the official Google Photos internal endpoints (`photos.google.com`).
   * Media timestamps, album associations, and GPS coordinates are processed entirely inside your local browser tab to execute the requested action.
   * Authentication is inherited directly from your existing active session in Google Photos. The extension never accesses, prompts for, or stores your Google account password or login credentials.

3. **File Downloads & Clipboard:**
   * When you export a KML file, it is generated in local browser memory and saved directly to your device via the `chrome.downloads` API.
   * When you click "Copy Bookmarklet Code" or coordinate strings, the data is written directly to your system clipboard via `navigator.clipboard`.

---

### 3. Permissions Explanation

| Permission | Purpose |
| :--- | :--- |
| `storage` | Stores your custom preferences, module switches, and theme accent colors across sessions. |
| `downloads` | Saves user-initiated KML GPS route exports directly to your computer's Downloads folder. |
| `clipboardWrite` | Enables one-click copying of bookmarklet code and metadata summaries to your clipboard. |
| `photos.google.com` (Host Permission) | Enables the extension to inject user interface controls (calendar picker, buttons, modals) and interact with your Google Photos library strictly while you are on `photos.google.com`. |

---

### 4. Open Source & Auditable

Google Photos Tim Tools is fully open-source. Anyone can inspect and verify the entire source code on GitHub:
[https://github.com/TimVoronkin/GooglePhotos-TimTools](https://github.com/TimVoronkin/GooglePhotos-TimTools)

---

### 5. Contact & Questions

If you have any questions or feedback regarding this Privacy Policy, please open an issue on our GitHub repository:
[https://github.com/TimVoronkin/GooglePhotos-TimTools/issues](https://github.com/TimVoronkin/GooglePhotos-TimTools/issues)

