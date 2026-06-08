window.TimTools = window.TimTools || {};
window.TimTools.Modules = window.TimTools.Modules || {};
window.TimTools.Modules.KmlExport = window.TimTools.Modules.KmlExport || {};

(function () {
  const Generator = {
    generateKML: function (points) {
      let docName = "Google Photos Selection";
      if (points.length > 0) {
        docName = `GPhotos_Export_${this.formatDateForFilename(points[0].timestamp)}`;
      }

      const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${docName}</name>
    <Style id="yellowLineGreenPoly">
      <LineStyle>
        <color>7f00ffff</color>
        <width>4</width>
      </LineStyle>
      <PolyStyle>
        <color>7f00ff00</color>
      </PolyStyle>
    </Style>
    <Style id="smallPoint">
      <IconStyle>
        <scale>0.5</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
`;
      const kmlFooter = `
  </Document>
</kml>`;

      let body = "";

      // 1. LineString (Path)
      let coordinatesString = "";
      points.forEach(p => {
        const [lat, lon] = p.coords.split(',');
        coordinatesString += `${lon},${lat},0\n`;
      });

      body += `
    <Placemark>
      <name>Route</name>
      <styleUrl>#yellowLineGreenPoly</styleUrl>
      <LineString>
        <extrude>1</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>
          ${coordinatesString}
        </coordinates>
      </LineString>
    </Placemark>
    `;

      // 2. Points
      points.forEach(p => {
        const [lat, lon] = p.coords.split(',');
        const d = new Date(p.timestamp);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');

        const dateLine = `${year}.${month}.${day}., ${hours}:${mins}`;

        const description = `
          <![CDATA[
            ${p.filename}<br>
            ${dateLine}<br>
            <a href="${p.originalUrl}">Google Photo Link</a>
          ]]>
        `;

        body += `
    <Placemark>
      <name>${p.filename}</name>
      <description>${description}</description>
      <styleUrl>#smallPoint</styleUrl>
      <Point>
        <coordinates>${lon},${lat},0</coordinates>
      </Point>
    </Placemark>`;
      });

      return kmlHeader + body + kmlFooter;
    },

    downloadKML: async function (content, firstTimestamp) {
      // Get settings for filename and folder
      const settings = await window.TimTools.Settings.getAll();

      // Logic for folder: if createSubfolder is false, pass empty string for folder
      let folder = settings.kmlFolderName || "";
      if (settings.kmlCreateSubfolder === false) {
        folder = "";
      }

      const prefix = settings.kmlFilePrefix || "GPhotos2kml_";
      const filename = `${prefix}${this.formatDateForFilename(firstTimestamp)}.kml`;

      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_KML',
        payload: {
          content: content,
          filename: filename,
          folder: folder
        }
      });
    },

    formatDateForFilename: function (timestamp) {
      const d = new Date(timestamp);
      const p = val => val.toString().padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${d.getMonth() + 1}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
    }
  };

  window.TimTools.Modules.KmlExport.Generator = Generator;
})();
