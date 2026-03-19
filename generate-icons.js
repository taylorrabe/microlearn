const sharp = require("sharp");
const path = require("path");

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#0f0f1a"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#a29bfe"/>
      <stop offset="100%" style="stop-color:#00cec9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <text x="256" y="300" text-anchor="middle" font-size="240" font-family="Arial">🧠</text>
  <text x="256" y="430" text-anchor="middle" font-size="72" font-weight="bold" fill="url(#glow)" font-family="Arial, sans-serif">μLearn</text>
</svg>`;

const sizes = [192, 512];

async function generate() {
  for (const size of sizes) {
    await sharp(Buffer.from(SVG))
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, "public", `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }
}

generate().catch(console.error);
