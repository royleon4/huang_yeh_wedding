export function TWMap({ className = "", size = 100 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 100 160"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Taiwan main island (simplified) */}
      <path
        d="M 50 8
           L 58 14
           L 65 22
           L 70 34
           L 72 48
           L 70 62
           L 72 76
           L 70 92
           L 65 108
           L 58 122
           L 50 132
           L 42 138
           L 34 140
           L 26 135
           L 22 125
           L 24 112
           L 28 98
           L 30 84
           L 28 70
           L 30 56
           L 32 42
           L 36 28
           L 42 16
           Z"
        fill="#e0474c"
        stroke="#b03030"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      
      {/* Central Mountain Range */}
      <path
        d="M 48 12 L 60 30 L 65 55 L 62 80 L 58 105 L 48 128"
        stroke="#f07070"
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
      />
      
      {/* Taipei star (capital) */}
      <circle cx="50" cy="30" r="3.5" fill="#f0d030" stroke="#b09020" strokeWidth="0.5" />
      
      {/* Kaohsiung dot */}
      <circle cx="36" cy="128" r="2.5" fill="#ffffff" stroke="#cccccc" strokeWidth="0.5" opacity="0.8" />
      
      {/* Taichung dot */}
      <circle cx="44" cy="80" r="2" fill="#ffffff" stroke="#cccccc" strokeWidth="0.5" opacity="0.7" />
      
      {/* Penghu Islands */}
      <ellipse cx="14" cy="72" rx="5" ry="3" fill="#e0474c" stroke="#b03030" strokeWidth="1" />
      <ellipse cx="8" cy="66" rx="3" ry="2" fill="#e0474c" stroke="#b03030" strokeWidth="0.8" />
      
      {/* Green Island */}
      <ellipse cx="84" cy="110" rx="4" ry="3" fill="#cc3344" stroke="#b03030" strokeWidth="0.8" />
      
      {/* Orchid Island */}
      <ellipse cx="86" cy="125" rx="4" ry="3" fill="#cc3344" stroke="#b03030" strokeWidth="0.8" />
    </svg>
  );
}
