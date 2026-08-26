// Генерация PWA-иконок из одного SVG-шаблона (тарелка + вилка + нож).
// Запуск: npm run icons. PNG коммитятся в репозиторий — в CI sharp не нужен.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const ACCENT = "#4a7c59";

const glyph = (scale = 1) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)"
     fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round">
    <circle cx="256" cy="272" r="80"/>
    <circle cx="256" cy="272" r="26" fill="#ffffff" stroke="none"/>
    <path d="M96 150v46"/>
    <path d="M136 150v46"/>
    <path d="M116 150v212"/>
    <path d="M396 150c22 38 22 84 0 118v94"/>
  </g>`;

const svg = (rx, scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  `<rect width="512" height="512" rx="${rx}" fill="${ACCENT}"/>${glyph(scale)}</svg>`;

await mkdir("public/icons", { recursive: true });

const rounded = svg(112, 1);
await writeFile("public/favicon.svg", rounded);

const png = (source, size, file) =>
  sharp(Buffer.from(source), { density: 300 }).resize(size, size).png().toFile(file);

await png(rounded, 192, "public/icons/icon-192.png");
await png(rounded, 512, "public/icons/icon-512.png");
// maskable: фон во весь квадрат, глиф в безопасной зоне (~80%)
await png(svg(0, 0.78), 512, "public/icons/icon-maskable-512.png");
// apple-touch: непрозрачный квадрат, iOS сам скруглит
await png(svg(0, 0.86), 180, "public/icons/apple-touch-icon.png");

console.log("icons generated → public/favicon.svg, public/icons/*.png");
