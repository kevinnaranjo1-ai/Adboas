import Jimp from 'jimp';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  const logoPath = path.join('public', 'logo.png');
  console.log('Loading image from:', logoPath);

  if (!fs.existsSync(logoPath)) {
    console.error('Error: public/logo.png does not exist.');
    return;
  }

  const image = await Jimp.read(logoPath);
  const width = image.getWidth();
  const height = image.getHeight();
  console.log(`Original image loaded: ${width}x${height}`);

  // The logo is perfectly centered horizontally in the 1408x768 frame.
  // Center: x = 1408 / 2 = 704, y = 768 / 2 = 384. Height = 768 is our diameter.
  // This means the cropping square starts at x = 704 - (768/2) = 320, and y = 0.
  const startX = 320;
  const startY = 0;
  const finalSize = 768;

  console.log(`Cropping square region at x=${startX}, y=${startY} with size=${finalSize}...`);
  
  // Crop image to the perfect square bounding box of the circular logo
  image.crop(startX, startY, finalSize, finalSize);

  // Resize to a standard high-quality high-res logo (e.g. 512x512)
  const targetSize = 512;
  console.log(`Resizing image to standard ${targetSize}x${targetSize}...`);
  image.resize(targetSize, targetSize);

  // Mask all pixels outside the inscribed circle to be completely transparent
  const cx = targetSize / 2;
  const cy = targetSize / 2;
  const r = targetSize / 2 - 2; // Subtract a small fraction of a pixel for clean clipping

  console.log('Applying circular transparency mask...');
  
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const color = image.getPixelColor(x, y);
      const red = (color >> 24) & 0xFF;
      const green = (color >> 16) & 0xFF;
      const blue = (color >> 8) & 0xFF;

      if (distance > r + 0.5) {
        // Outside the circle, make fully transparent
        image.setPixelColor(Jimp.rgbaToInt(0, 0, 0, 0), x, y);
      } else if (distance > r - 1.5) {
        // Antialiasing edge: interpolate alpha for smooth curves
        const alpha = Math.max(0, Math.min(255, Math.floor((r + 0.5 - distance) * 127.5)));
        image.setPixelColor(Jimp.rgbaToInt(red, green, blue, alpha), x, y);
      } else {
        // Inside the circle, make sure the background (if it is black outside the artwork) is transparent.
        // Wait, did the original image have a black border? The logo is circular, so everything inside r is part of the artwork.
        // Leave the artwork as is!
      }
    }
  }

  // Save the image back as transparent PNG.
  // Note: Jimp's mime for output is determined by write output file extension. Saving as logo.png will format it correctly as PNG if the file has .png extension.
  // Since we also want to overwrite the old file, let's write to a temporary file, delete the old file, and then move/rename.
  const tempPath = path.join('public', 'logo_temp.png');
  console.log('Saving processed logo to:', tempPath);
  await image.writeAsync(tempPath);

  // Overwrite the original logo
  fs.copyFileSync(tempPath, logoPath);
  fs.unlinkSync(tempPath);
  
  console.log('Logo background processing completed successfully!');
}

run().catch(console.error);
