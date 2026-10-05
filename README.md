# Google Photos Tim Tools

A Google Chrome browser extension (Manifest V3) that adds handy utility tools to Google Photos.

## Core Features

1. **Timeline Button (Up Button)**
   - Injects a navigation button when viewing a photo within the context of an album, search, or sharing link.
   - Allows you to escape the album/search context in a single click, opening the current photo directly in the main Google Photos timeline (photostream) by stripping context parameters from the URL.
   - Can be configured in settings to automatically close the photo view and transition back to the main timeline grid immediately.

2. **Date Search & Picker**
   - Integrates a calendar icon directly into the Google Photos search bar.
   - Allows you to select a date via a beautiful, dark-themed custom calendar popup, or parses text input (supporting English, Ukrainian, and Russian natural language dates, e.g., "15 січня" or "may 24") and automatically formats it to `YYYY.MM.DD` for instant search.

3. **Delete Shortcut**
   - Maps the `Delete` key on your keyboard to delete the currently open photo.
   - Intercepts the `Delete` key press inside photo views (while ignoring typing inside text fields) and programmatically triggers the native Google Photos deletion shortcut (`#`), which displays the "Move to trash" confirmation overlay.

4. **KML Export**
   - Scrapes geotags (GPS coordinates), filenames, and date/time info from selected photos and exports them to a KML file (for Google Earth or other mapping tools).
   - Uses a headless Master/Child tab extraction flow to bypass CORS, automatically navigating through selected photos, scraping their metadata from the Info sidebar, and compiling a chronologically sorted route (`LineString`) and individual waypoints (`Placemarks`) containing photo links.

5. **Drag in Time**
   - Injects a "Drag in Time" option into the "Edit date & time" modal.
   - Provides an interactive visual reordering canvas for photo timestamps with infinite timeline auto-loading.

6. **Smart Archiving**
   - Adds a filter button directly into the Google Photos header (to the left of the leftmost icon).
   - Allows assigning albums as censorship / category filters (e.g., alcohol, sensitive documents, private photos).
   - Toggle individual filters On/Off in a sleek dropdown popover.
   - Uses set theory: if a photo belongs to multiple filter albums and at least one is turned Off, the photo is archived.
   - Executes batch archive/unarchive operations via Google Photos internal RPC in chunks of 50 with live progress tracking.
   - Automatically checks on page load to archive any newly added photos from mobile in disabled filters.
   - Edit mode allows selecting albums with auto-sorting (checked albums dynamically jump to the top).

7. **Options Page**
   - A dark-themed settings panel styled like Chrome's native UI.
   - Toggle individual features (Up Button, Date Search, Delete Shortcut, KML Export, Drag in Time, Smart Archiving) on or off.
   - Customize the KML file prefix and download subfolder path (inside your browser's `Downloads` folder).
