const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const iconPath = path.join(root, "assets/images/icon.png");
const outPath = path.join(root, "assets/images/splash-icon.png");

const canvas = 1024;
const circleSize = 720;
const offset = Math.round((canvas - circleSize) / 2);
const radius = circleSize / 2;

async function run() {
  const resized = await sharp(iconPath)
    .resize(circleSize, circleSize, { fit: "cover" })
    .toBuffer();

  const mask = Buffer.from(
    `<svg width="${circleSize}" height="${circleSize}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${radius}" cy="${radius}" r="${radius}" fill="white"/>
    </svg>`,
  );

  const circled = await sharp(resized)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: circled, top: offset, left: offset }])
    .png()
    .toFile(outPath);

  console.log("wrote", outPath);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
