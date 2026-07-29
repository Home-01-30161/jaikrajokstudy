const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

async function cropImages() {
  const dir = path.join(__dirname, 'CollagePics');
  if (!fs.existsSync(dir)) {
    console.error('CollagePics directory not found');
    return;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      console.log(`Processing ${file}...`);
      const image = await Jimp.read(filePath);
      
      // Auto crop transparent pixels
      image.autocrop();
      
      // Save back to the same file
      await image.writeAsync(filePath);
      console.log(`Successfully cropped and saved ${file}`);
    } catch (e) {
      console.error(`Error processing ${file}:`, e);
    }
  }
}

cropImages();
