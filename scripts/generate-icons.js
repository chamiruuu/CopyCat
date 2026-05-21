import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
let iconGen;
try {
  iconGen = (await import('icon-gen')).default || (await import('icon-gen'));
} catch (e) {
  iconGen = null;
}

const root = path.resolve(process.cwd());
const iconsDir = path.join(root, 'src-tauri', 'icons');
const source = path.join(iconsDir, 'source.png');

if (!fs.existsSync(source)) {
  console.error('Source icon not found:', source);
  console.error('Please place your provided image as src-tauri/icons/source.png and re-run `npm run gen:icons`.');
  process.exit(1);
}

const sizes = [32, 64, 128, 256, 512];

(async () => {
  try {
    // Ensure icons directory exists
    if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

    // Generate PNGs
    for (const s of sizes) {
      const out = path.join(iconsDir, `${s}x${s}.png`);
      await sharp(source).resize(s, s).png().toFile(out);
      console.log('Written', out);
    }

    // Also write icon.png as 512x512
    const iconPng = path.join(iconsDir, 'icon.png');
    await sharp(source).resize(512, 512).png().toFile(iconPng);
    console.log('Written', iconPng);

    // Write 128x128@2x (256)
    const double128 = path.join(iconsDir, '128x128@2x.png');
    await sharp(source).resize(256, 256).png().toFile(double128);
    console.log('Written', double128);

    // Generate ICO from 32,64,128,256
    const icoBuf = await pngToIco([
      path.join(iconsDir, '32x32.png'),
      path.join(iconsDir, '64x64.png'),
      path.join(iconsDir, '128x128.png'),
      path.join(iconsDir, '256x256.png'),
    ]);
    fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuf);
    console.log('Written', path.join(iconsDir, 'icon.ico'));

    // Generate ICNS using icon-gen if available
    if (iconGen) {
      try {
        await iconGen(path.join(iconsDir, 'icon.png'), iconsDir, { report: true, modes: ['icns'] });
        console.log('Generated ICNS with icon-gen');
      } catch (e) {
        console.warn('icon-gen failed:', e.message || e);
      }
    } else {
      console.warn('icon-gen not available - skipping ICNS generation. You can install icon-gen globally or in devDependencies.');
    }

    console.log('Icon generation complete.');
  } catch (e) {
    console.error('Error generating icons:', e);
    process.exit(1);
  }
})();
