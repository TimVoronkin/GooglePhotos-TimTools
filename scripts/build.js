const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const tempDir = path.join(distDir, 'build_temp');

console.log('=================================================');
console.log('  Google Photos Tim Tools - Release Builder (JS)');
console.log('=================================================');

// 1. Read manifest.json
const manifestPath = path.join(rootDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
    console.error('Error: manifest.json not found!');
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version;
console.log(`[1/5] Read manifest (Version: v${version})...`);

// 2. Prepare build directory
if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}
fs.mkdirSync(tempDir, { recursive: true });

console.log('[2/5] Copying extension files to clean build folder...');

function copyRecursive(src, dest, filterFn = null) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const file of fs.readdirSync(src)) {
            copyRecursive(path.join(src, file), path.join(dest, file), filterFn);
        }
    } else {
        if (!filterFn || filterFn(src)) {
            const destDir = path.dirname(dest);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(src, dest);
        }
    }
}

// Copy src/
copyRecursive(path.join(rootDir, 'src'), path.join(tempDir, 'src'));

// Copy assets/icons/
copyRecursive(path.join(rootDir, 'assets', 'icons'), path.join(tempDir, 'assets', 'icons'));

// Copy assets/logo/ (only PNG, ignore PSD)
copyRecursive(path.join(rootDir, 'assets', 'logo'), path.join(tempDir, 'assets', 'logo'), (file) => {
    return file.endsWith('.png');
});

// 3. Process manifest.json
console.log('[3/5] Processing manifest.json (stripping key for Chrome Web Store)...');
const cleanManifest = { ...manifest };
const keepKey = process.argv.includes('--keep-key');
if (!keepKey && cleanManifest.key) {
    delete cleanManifest.key;
    console.log('      Removed "key" field for Web Store compatibility.');
}
fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(cleanManifest, null, 2), 'utf8');

// 4. Create ZIP
const zipName = `GooglePhotos-TimTools-v${version}.zip`;
const zipPath = path.join(distDir, zipName);
if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
}

console.log(`[4/5] Packing into ZIP archive: ${zipName}...`);

try {
    if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal"`, { stdio: 'inherit' });
    } else {
        execSync(`cd "${tempDir}" && zip -r "${zipPath}" ./*`, { stdio: 'inherit' });
    }
} catch (err) {
    console.error('Failed to create zip archive:', err.message);
    process.exit(1);
}

// Cleanup
fs.rmSync(tempDir, { recursive: true, force: true });

// 5. Summary
const stats = fs.statSync(zipPath);
const sizeKb = (stats.size / 1024).toFixed(2);
console.log(`[5/5] Success! Archive created at:`);
console.log(`      ${zipPath} (${sizeKb} KB)`);
console.log('=================================================');
console.log('Ready for Chrome Web Store Developer Dashboard!');

