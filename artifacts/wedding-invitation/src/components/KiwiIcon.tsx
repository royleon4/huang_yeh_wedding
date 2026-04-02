export function KiwiIcon({ className = "", size = 80 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Kiwi fruit cross-section */}
      {/* Outer skin */}
      <ellipse cx="50" cy="50" rx="44" ry="44" fill="#8B6914" />
      {/* Inner flesh */}
      <ellipse cx="50" cy="50" rx="40" ry="40" fill="#C8B432" />
      {/* White core */}
      <ellipse cx="50" cy="50" rx="10" ry="10" fill="#F5F0D0" />
      {/* Segments - radiating lines */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 360) / 24;
        const rad = (angle * Math.PI) / 180;
        const x1 = 50 + 10 * Math.cos(rad);
        const y1 = 50 + 10 * Math.sin(rad);
        const x2 = 50 + 38 * Math.cos(rad);
        const y2 = 50 + 38 * Math.sin(rad);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#6B8E23"
            strokeWidth="0.8"
            opacity="0.6"
          />
        );
      })}
      {/* Seeds */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 360) / 16 + 11;
        const rad = (angle * Math.PI) / 180;
        const r = 26;
        const cx = 50 + r * Math.cos(rad);
        const cy = 50 + r * Math.sin(rad);
        return (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx="2.5"
            ry="4"
            fill="#1a1a0a"
            transform={`rotate(${angle}, ${cx}, ${cy})`}
          />
        );
      })}
      {/* Highlight */}
      <ellipse cx="38" cy="35" rx="8" ry="5" fill="rgba(255,255,255,0.2)" transform="rotate(-30, 38, 35)" />
    </svg>
  );
}

export function KiwiFruit({ className = "", size = 60 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.4}
      viewBox="0 0 60 84"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Whole kiwi fruit */}
      <ellipse cx="30" cy="45" rx="26" ry="33" fill="#6B4F2A" />
      <ellipse cx="30" cy="44" rx="22" ry="30" fill="#5A4020" />
      {/* Fuzzy texture */}
      {Array.from({ length: 20 }).map((_, i) => {
        const x = 8 + Math.random() * 44;
        const y = 15 + Math.random() * 58;
        return (
          <line
            key={i}
            x1={x}
            y1={y}
            x2={x + (Math.random() - 0.5) * 4}
            y2={y - 3}
            stroke="#8B6935"
            strokeWidth="0.5"
            opacity="0.5"
          />
        );
      })}
      {/* Stem */}
      <rect x="27" y="10" width="6" height="12" rx="3" fill="#4A7C20" />
      <ellipse cx="30" cy="10" rx="5" ry="3" fill="#5A9230" />
    </svg>
  );
}
