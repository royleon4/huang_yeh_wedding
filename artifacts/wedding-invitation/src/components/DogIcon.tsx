export function BlackDog({ className = "", size = 120 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body */}
      <ellipse cx="100" cy="130" rx="55" ry="45" fill="#1a1a1a" />
      
      {/* Tail */}
      <path
        d="M 150 115 Q 175 95 168 75 Q 162 60 155 70 Q 165 85 148 100 Z"
        fill="#1a1a1a"
      />
      
      {/* Head */}
      <ellipse cx="72" cy="82" rx="32" ry="28" fill="#1a1a1a" />
      
      {/* Left ear (floppy) */}
      <path
        d="M 50 62 Q 35 45 42 68 Q 46 55 55 70 Z"
        fill="#111111"
      />
      
      {/* Right ear (slightly raised) */}
      <path
        d="M 85 58 Q 100 40 95 65 Q 90 50 83 68 Z"
        fill="#111111"
      />
      
      {/* Snout */}
      <ellipse cx="58" cy="95" rx="18" ry="13" fill="#2a2a2a" />
      
      {/* Nose */}
      <ellipse cx="58" cy="89" rx="8" ry="5" fill="#111111" />
      <ellipse cx="56" cy="87" rx="2" ry="1.5" fill="#444" />
      
      {/* Eyes */}
      <ellipse cx="70" cy="76" rx="7" ry="7" fill="#2a2a2a" />
      <ellipse cx="70" cy="76" rx="5" ry="5" fill="#0a0a0a" />
      <ellipse cx="68" cy="74" rx="1.5" ry="1.5" fill="white" />
      
      {/* Mouth / smile */}
      <path
        d="M 50 99 Q 58 106 66 99"
        stroke="#111"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Tongue */}
      <ellipse cx="58" cy="103" rx="5" ry="4" fill="#e05070" />
      <line x1="58" y1="100" x2="58" y2="104" stroke="#c03060" strokeWidth="1" />
      
      {/* Legs */}
      {/* Front left */}
      <rect x="68" y="162" width="16" height="28" rx="8" fill="#1a1a1a" />
      {/* Front right */}
      <rect x="88" y="162" width="16" height="28" rx="8" fill="#1a1a1a" />
      {/* Back left */}
      <rect x="108" y="162" width="16" height="28" rx="8" fill="#1a1a1a" />
      {/* Back right */}
      <rect x="128" y="162" width="16" height="28" rx="8" fill="#1a1a1a" />
      
      {/* Paws */}
      <ellipse cx="76" cy="191" rx="9" ry="6" fill="#111" />
      <ellipse cx="96" cy="191" rx="9" ry="6" fill="#111" />
      <ellipse cx="116" cy="191" rx="9" ry="6" fill="#111" />
      <ellipse cx="136" cy="191" rx="9" ry="6" fill="#111" />
      
      {/* Collar */}
      <rect x="53" y="105" width="38" height="8" rx="4" fill="#cc3344" />
      <ellipse cx="72" cy="114" rx="5" ry="5" fill="#ddaa00" />
      
      {/* White chest patch */}
      <ellipse cx="100" cy="120" rx="15" ry="20" fill="#2a2a2a" />
      
      {/* Subtle fur texture on body */}
      <path d="M 80 105 Q 85 100 90 105" stroke="#222" strokeWidth="1" fill="none" />
      <path d="M 105 100 Q 110 95 115 100" stroke="#222" strokeWidth="1" fill="none" />
      <path d="M 92 115 Q 97 110 102 115" stroke="#222" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function DogWithBow({ className = "", size = 140 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body */}
      <ellipse cx="100" cy="130" rx="55" ry="45" fill="#1a1a1a" />
      
      {/* Tail wagging */}
      <path
        d="M 150 110 Q 180 85 172 65 Q 166 50 158 62 Q 168 78 148 98 Z"
        fill="#1a1a1a"
      />
      
      {/* Head */}
      <ellipse cx="72" cy="80" rx="33" ry="30" fill="#1a1a1a" />
      
      {/* Left ear */}
      <path
        d="M 48 60 Q 30 42 40 70 Q 44 56 54 72 Z"
        fill="#111111"
      />
      
      {/* Right ear */}
      <path
        d="M 88 57 Q 105 38 98 65 Q 93 50 85 66 Z"
        fill="#111111"
      />
      
      {/* Snout */}
      <ellipse cx="57" cy="93" rx="19" ry="14" fill="#2a2a2a" />
      
      {/* Nose */}
      <ellipse cx="57" cy="87" rx="9" ry="6" fill="#111111" />
      <ellipse cx="55" cy="85" rx="2.5" ry="2" fill="#444" />
      
      {/* Eyes - happy/squinting */}
      <path d="M 63 74 Q 70 68 77 74" stroke="#2a2a2a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="70" cy="74" rx="6" ry="6" fill="#0a0a0a" />
      <ellipse cx="68" cy="72" rx="1.5" ry="1.5" fill="white" />
      
      {/* Mouth */}
      <path
        d="M 48 97 Q 57 106 66 97"
        stroke="#111"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Tongue out */}
      <ellipse cx="57" cy="103" rx="6" ry="5" fill="#e05070" />
      <line x1="57" y1="100" x2="57" y2="105" stroke="#c03060" strokeWidth="1.2" />
      
      {/* Bow tie */}
      <path d="M 53 108 L 62 114 L 53 120 Z" fill="#4a9a30" />
      <path d="M 71 108 L 62 114 L 71 120 Z" fill="#4a9a30" />
      <ellipse cx="62" cy="114" rx="4" ry="4" fill="#6ab840" />
      
      {/* Collar */}
      <rect x="50" y="103" width="44" height="7" rx="3.5" fill="#cc3344" />
      
      {/* Legs */}
      <rect x="68" y="163" width="16" height="26" rx="8" fill="#1a1a1a" />
      <rect x="88" y="163" width="16" height="26" rx="8" fill="#1a1a1a" />
      <rect x="108" y="163" width="16" height="26" rx="8" fill="#1a1a1a" />
      <rect x="128" y="163" width="16" height="26" rx="8" fill="#1a1a1a" />
      
      {/* Paws */}
      <ellipse cx="76" cy="190" rx="9" ry="6" fill="#111" />
      <ellipse cx="96" cy="190" rx="9" ry="6" fill="#111" />
      <ellipse cx="116" cy="190" rx="9" ry="6" fill="#111" />
      <ellipse cx="136" cy="190" rx="9" ry="6" fill="#111" />
    </svg>
  );
}
