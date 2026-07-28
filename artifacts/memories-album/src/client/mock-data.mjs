import { PROCESS_DEFINITIONS } from "./gallery-model.mjs";

const PALETTES = [
  ["#173f34", "#d5dfc8", "#f1c66a"],
  ["#6e3b34", "#ead7c9", "#afc7a4"],
  ["#3e5949", "#f2e7c8", "#c6806f"],
  ["#243f4a", "#d6e1dc", "#d8af63"],
  ["#5a4935", "#ece2d0", "#9fb29b"],
  ["#364c3d", "#efd8b6", "#b96b5c"],
];

function svgDataUri({ title, subtitle, palette, tall, seed }) {
  const [dark, paper, accent] = palette;
  const width = 900;
  const height = tall ? 1240 : 760;
  const circles = Array.from({ length: 7 }, (_, index) => {
    const x = 80 + ((seed * 137 + index * 163) % 740);
    const y = 100 + ((seed * 211 + index * 191) % (height - 180));
    const r = 26 + ((seed * 17 + index * 29) % 84);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${index % 2 ? accent : dark}" opacity="${index % 2 ? 0.22 : 0.11}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${paper}"/>
    <path d="M0 ${height * 0.72} C ${width * 0.2} ${height * 0.57}, ${width * 0.58} ${height * 0.9}, ${width} ${height * 0.62} L ${width} ${height} L 0 ${height} Z" fill="${dark}" opacity=".88"/>
    ${circles}
    <path d="M90 130 C 250 40, 430 240, 620 110 S 850 150, 900 70" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round" opacity=".7"/>
    <text x="72" y="${height - 128}" fill="#fffaf1" font-family="Georgia, serif" font-size="58" letter-spacing="8">${title}</text>
    <text x="76" y="${height - 72}" fill="#fffaf1" font-family="Arial, sans-serif" font-size="24" letter-spacing="4" opacity=".82">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const MOCK_PHOTOS = Array.from({ length: 30 }, (_, index) => {
  const process = PROCESS_DEFINITIONS[index % PROCESS_DEFINITIONS.length];
  const extra = PROCESS_DEFINITIONS[(index + 3) % PROCESS_DEFINITIONS.length];
  const source = index % 7 === 0 ? "guest" : "official";
  const tall = index % 3 !== 1;
  return {
    id: `mock-photo-${String(index + 1).padStart(2, "0")}`,
    thumbnailUrl: svgDataUri({
      title: process.zh,
      subtitle: source === "guest" ? "GUEST MEMORY" : "20 JUN 2026",
      palette: PALETTES[index % PALETTES.length],
      tall,
      seed: index + 1,
    }),
    mediaUrl: svgDataUri({
      title: process.zh,
      subtitle: "LEON & YEHY · 20 JUN 2026",
      palette: PALETTES[index % PALETTES.length],
      tall,
      seed: index + 17,
    }),
    width: 900,
    height: tall ? 1240 : 760,
    source,
    uploaderName: source === "guest" ? ["小安", "Reina", "葉輔銘"][index % 3] : "婚禮攝影",
    processIds: source === "guest" ? [] : index % 5 === 0 ? [process.id, extra.id] : [process.id],
    createdAt: new Date(Date.UTC(2026, 5, 20, 2, index)).toISOString(),
  };
});
