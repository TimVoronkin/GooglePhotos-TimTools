# Google Photos Tim Tools

A Google Chrome browser extension (Manifest V3) that adds handy utility tools to Google Photos.

## Core Features

1. **Timeline Button (Up Button)**
   - Injects a navigation button when viewing a photo within the context of an album, search, or sharing link.
   - Allows you to escape the album/search context in a single click, opening the current photo directly in the main Google Photos timeline (photostream) by stripping context parameters from the URL.
   - Can be configured in settings to automatically close the photo view and transition back to the main timeline grid immediately.

2. **Date Search & Picker**
   - Integrates a calendar icon directly into the Google Photos search bar.
   - Allows you to select a date via a beautiful, custom calendar popup, or parses text input (supporting English, Ukrainian, and Russian natural language dates, e.g., "15 січня" or "may 24") and automatically formats it to `YYYY.MM.DD` for instant search.

3. **Delete Shortcut**
   - Maps the `Delete` key on your keyboard to delete the currently open photo.
   - Intercepts the `Delete` key press inside photo views (while ignoring typing inside text fields) and programmatically triggers the native Google Photos deletion button/dialog.

4. **KML Export**
   - Scrapes geotags (GPS coordinates), filenames, and date/time info from selected photos and exports them to a KML file (for Google Earth or other mapping tools).
   - Uses a headless Master/Child tab extraction flow to bypass CORS, automatically navigating through selected photos, scraping their metadata from the Info sidebar, and compiling a chronologically sorted route (`LineString`) and individual waypoints (`Placemarks`) containing photo links.

5. **Drag in Time**
   - Injects a "Drag in Time" option into the "Edit date & time" modal.
   - Provides an interactive visual reordering canvas for photo timestamps with infinite timeline auto-loading.
   - Allows rearranging photos chronologically by drag-and-drop and batch-updating their timestamps via internal Google Photos RPC (`DaSgWe`).

6. **Smart Archiving**
   - Adds a filter button directly into the Google Photos header (to the left of the leftmost icon).
   - Allows assigning albums as category / visibility filters (e.g., receipts, sensitive documents, private albums).
   - Toggle individual filters On/Off in a sleek dropdown popover.
   - Uses set theory: if a photo belongs to multiple filter albums and at least one is turned Off, the photo is archived.
   - Executes batch archive/unarchive operations via Google Photos internal RPC in chunks of 50 with live progress tracking.
   - Automatically checks on page load to archive any newly added photos from mobile in disabled filters.
   - Edit mode allows selecting albums with auto-sorting (checked albums dynamically jump to the top).
   - Includes a mobile bookmarklet generator to run Smart Archiving on mobile browsers (Android / iOS).

7. **Quick Remove from Album (AlbumQuickRemove)**
   - Injects a quick remove button ("✕") next to each album in the photo's Info panel.
   - Instantly detaches the photo from that album without having to navigate away or open the album page.
   - Automatically resolves internal album item membership keys (`snAcKc`) and calls Google Photos RPC (`ycV3Nd`) to guarantee accurate removal.
   - Features a confirmation modal with keyboard shortcuts (**Enter** to confirm, **Escape** to cancel).
   - Confirmation dialog can be enabled or disabled in the extension options.
   - Beautifully aligned with native Info sidebar icons (such as the date edit pencil).

8. **Theme & Custom Accent Colors**
   - Full dark and light theme support adhering to Google Photos appearance.
   - Override Accent Colors: optionally customize light and dark theme accent colors with hex pickers.

9. **Options Page**
   - A modern settings panel styled like Google's native Material 3 / Chrome settings UI.
   - Toggle individual features on or off.
   - Customize KML export folder name and filename prefix.
   - Export and copy the mobile bookmarklet for Smart Archiving.
   - Enable or disable debug logging.

## Installation

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the folder containing this repository.
5. Open [photos.google.com](https://photos.google.com) and enjoy!
