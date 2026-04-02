export function NZMap({ className = "", size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.8}
      viewBox="0 0 120 216"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* New Zealand - North Island (simplified) */}
      <path
        d="M 72 8 
           L 88 18 
           L 95 32 
           L 90 48 
           L 96 62 
           L 88 78 
           L 80 90 
           L 70 95 
           L 58 92 
           L 48 98 
           L 38 105 
           L 32 96 
           L 38 82 
           L 48 72 
           L 44 60 
           L 52 48 
           L 58 34 
           L 62 20 
           Z"
        fill="#5B9B3A"
        stroke="#3d7028"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* North Island highlight */}
      <path
        d="M 72 14 L 84 24 L 88 40 L 82 55 L 88 70 L 80 84"
        stroke="#7ab84a"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      
      {/* New Zealand - South Island (simplified) */}
      <path
        d="M 25 120 
           L 38 112 
           L 52 110 
           L 68 115 
           L 80 120 
           L 92 130 
           L 95 148 
           L 88 165 
           L 78 178 
           L 65 190 
           L 50 198 
           L 38 205 
           L 28 200 
           L 22 185 
           L 18 168 
           L 20 150 
           L 18 135 
           Z"
        fill="#4a8c2a"
        stroke="#3d7028"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Southern Alps ridge */}
      <path
        d="M 40 115 L 55 120 L 68 132 L 75 150 L 68 168"
        stroke="#7ab84a"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      
      {/* Stewart Island */}
      <ellipse cx="48" cy="213" rx="8" ry="4" fill="#4a8c2a" stroke="#3d7028" strokeWidth="1" />
      
      {/* Wellington star (capital) */}
      <circle cx="56" cy="96" r="3" fill="#f0d030" stroke="#b09020" strokeWidth="0.5" />
      <circle cx="56" cy="96" r="1.5" fill="#f0d030" />
      
      {/* Auckland dot */}
      <circle cx="74" cy="30" r="2.5" fill="#e05040" stroke="#c03020" strokeWidth="0.5" />
      
      {/* Christchurch dot */}
      <circle cx="64" cy="148" r="2.5" fill="#e05040" stroke="#c03020" strokeWidth="0.5" />
    </svg>
  );
}
