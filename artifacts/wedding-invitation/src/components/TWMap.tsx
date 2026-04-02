export function TWMap({
  className = "",
  size = 100,
  style,
}: {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size * 1.72}
      viewBox="0 0 100 172"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Lowland plains — west coast & valleys */}
        <linearGradient id="tw-lowland" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6aab4a" />
          <stop offset="100%" stopColor="#4e8c32" />
        </linearGradient>

        {/* Mid-elevation forest */}
        <linearGradient id="tw-forest" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3d7a28" />
          <stop offset="100%" stopColor="#2d5f1a" />
        </linearGradient>

        {/* High mountain ridge */}
        <linearGradient id="tw-ridge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4e8c2" />
          <stop offset="30%" stopColor="#8ab86e" />
          <stop offset="100%" stopColor="#4e8c32" />
        </linearGradient>

        {/* Full island base gradient N→S */}
        <linearGradient id="tw-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a9e3e" />
          <stop offset="40%" stopColor="#4a8830" />
          <stop offset="100%" stopColor="#3d7228" />
        </linearGradient>

        {/* Terrain shadow for depth */}
        <filter id="tw-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#1a3a0a" floodOpacity="0.35" />
        </filter>

        {/* Island contour clip */}
        <clipPath id="tw-clip">
          <path d="
            M 54 5
            C 58 6, 64 10, 67 16
            C 70 22, 72 30, 73 40
            C 74 50, 73 60, 74 68
            C 75 78, 76 88, 74 100
            C 72 112, 68 124, 62 135
            C 57 144, 50 150, 43 152
            C 36 154, 28 151, 23 144
            C 18 137, 17 127, 19 116
            C 21 105, 26 94, 28 83
            C 30 72, 28 62, 29 52
            C 30 42, 33 32, 37 22
            C 41 13, 47 4, 54 5 Z
          " />
        </clipPath>
      </defs>

      {/* === MAIN ISLAND === */}

      {/* Base fill — overall green */}
      <path
        d="
          M 54 5
          C 58 6, 64 10, 67 16
          C 70 22, 72 30, 73 40
          C 74 50, 73 60, 74 68
          C 75 78, 76 88, 74 100
          C 72 112, 68 124, 62 135
          C 57 144, 50 150, 43 152
          C 36 154, 28 151, 23 144
          C 18 137, 17 127, 19 116
          C 21 105, 26 94, 28 83
          C 30 72, 28 62, 29 52
          C 30 42, 33 32, 37 22
          C 41 13, 47 4, 54 5 Z
        "
        fill="url(#tw-base)"
        stroke="#2a5a18"
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter="url(#tw-shadow)"
      />

      {/* West coast lowland plains (lighter green strip on left) */}
      <path
        d="
          M 37 22
          C 33 32, 30 42, 29 52
          C 28 62, 30 72, 28 83
          C 26 94, 21 105, 19 116
          C 17 127, 18 137, 23 144
          C 28 151, 36 154, 43 152
          L 46 148
          C 40 145, 33 139, 30 130
          C 27 121, 29 111, 31 101
          C 33 91, 38 82, 39 72
          C 40 62, 37 52, 39 43
          C 41 34, 44 25, 48 18
          Z
        "
        fill="#7dc055"
        opacity="0.55"
        clipPath="url(#tw-clip)"
      />

      {/* East coast cliffs — darker, steeper */}
      <path
        d="
          M 66 18
          C 70 26, 72 36, 73 46
          C 74 56, 73 66, 74 76
          C 75 86, 76 96, 73 108
          C 70 120, 64 132, 58 141
          L 54 148
          C 60 138, 65 126, 68 114
          C 71 102, 71 90, 70 78
          C 69 66, 70 56, 69 46
          C 68 36, 65 24, 60 16
          Z
        "
        fill="#2d5a1b"
        opacity="0.45"
        clipPath="url(#tw-clip)"
      />

      {/* === CENTRAL MOUNTAIN RANGE (中央山脈) === */}
      {/* Main spine — multiple overlapping ridges for depth */}

      {/* Westmost ridge */}
      <path
        d="M 43 28 C 42 40, 40 55, 39 70 C 38 85, 40 100, 38 115 C 36 128, 37 140, 42 150"
        stroke="#4a8a30"
        strokeWidth="3.5"
        fill="none"
        opacity="0.35"
        strokeLinecap="round"
      />

      {/* Central ridge — main spine */}
      <path
        d="M 52 10 C 55 22, 57 38, 58 54 C 59 70, 58 86, 57 102 C 56 116, 53 130, 49 144"
        stroke="#c8e8a0"
        strokeWidth="2"
        fill="none"
        opacity="0.7"
        strokeLinecap="round"
      />

      {/* Snow cap / high peak area near center-north */}
      <path
        d="M 50 28 L 56 38 L 62 32 L 66 40 L 60 46 L 54 42 L 48 50 L 44 42 L 48 34 Z"
        fill="#d8f0b8"
        opacity="0.5"
        clipPath="url(#tw-clip)"
      />

      {/* Jade Mountain peak area highlight */}
      <path
        d="M 54 60 L 59 70 L 63 65 L 66 74 L 60 80 L 55 74 L 50 80 L 46 72 L 50 66 Z"
        fill="#b8e090"
        opacity="0.45"
        clipPath="url(#tw-clip)"
      />

      {/* Ridge highlight lines — topographic feel */}
      <path
        d="M 48 18 C 52 30, 55 48, 56 66 C 57 84, 56 102, 53 120 C 51 132, 48 142, 46 150"
        stroke="#a8d878"
        strokeWidth="1"
        fill="none"
        opacity="0.6"
        strokeLinecap="round"
      />
      <path
        d="M 60 20 C 63 34, 65 52, 65 70 C 65 88, 63 106, 60 122 C 58 134, 54 144, 51 150"
        stroke="#5a9a3c"
        strokeWidth="0.8"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />

      {/* Terrain contour lines for topographic texture */}
      <path
        d="M 30 55 C 36 52, 44 50, 50 50 C 56 50, 63 52, 70 56"
        stroke="#388a20"
        strokeWidth="0.6"
        fill="none"
        opacity="0.3"
        clipPath="url(#tw-clip)"
      />
      <path
        d="M 28 80 C 34 76, 43 74, 50 74 C 57 74, 65 76, 72 80"
        stroke="#388a20"
        strokeWidth="0.6"
        fill="none"
        opacity="0.3"
        clipPath="url(#tw-clip)"
      />
      <path
        d="M 22 108 C 30 103, 41 101, 50 101 C 58 101, 67 104, 73 109"
        stroke="#388a20"
        strokeWidth="0.6"
        fill="none"
        opacity="0.3"
        clipPath="url(#tw-clip)"
      />

      {/* Island outline stroke for crispness */}
      <path
        d="
          M 54 5
          C 58 6, 64 10, 67 16
          C 70 22, 72 30, 73 40
          C 74 50, 73 60, 74 68
          C 75 78, 76 88, 74 100
          C 72 112, 68 124, 62 135
          C 57 144, 50 150, 43 152
          C 36 154, 28 151, 23 144
          C 18 137, 17 127, 19 116
          C 21 105, 26 94, 28 83
          C 30 72, 28 62, 29 52
          C 30 42, 33 32, 37 22
          C 41 13, 47 4, 54 5 Z
        "
        fill="none"
        stroke="#1e4a10"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* === CITIES === */}
      {/* Taipei (台北) — north */}
      <circle cx="52" cy="23" r="2.8" fill="#f5e840" stroke="#8a7a00" strokeWidth="0.6" opacity="0.9" />

      {/* Taichung (台中) — mid-west */}
      <circle cx="40" cy="80" r="1.8" fill="#ffffff" stroke="#888" strokeWidth="0.4" opacity="0.75" />

      {/* Kaohsiung (高雄) — south */}
      <circle cx="36" cy="132" r="1.8" fill="#ffffff" stroke="#888" strokeWidth="0.4" opacity="0.75" />

      {/* === OUTLYING ISLANDS === */}

      {/* Penghu (澎湖) — west */}
      <ellipse cx="10" cy="88" rx="5" ry="3.5" fill="#5a9e3e" stroke="#2d5a1b" strokeWidth="0.8" opacity="0.8" />
      <ellipse cx="6" cy="82" rx="3" ry="2" fill="#5a9e3e" stroke="#2d5a1b" strokeWidth="0.7" opacity="0.7" />
      <ellipse cx="13" cy="78" rx="2.5" ry="1.5" fill="#5a9e3e" stroke="#2d5a1b" strokeWidth="0.6" opacity="0.65" />

      {/* Green Island (綠島) — southeast */}
      <ellipse cx="86" cy="118" rx="4" ry="3" fill="#4a8a30" stroke="#2d5a1b" strokeWidth="0.7" opacity="0.8" />

      {/* Orchid Island (蘭嶼) — south-east */}
      <ellipse cx="88" cy="134" rx="4.5" ry="3.5" fill="#4a8a30" stroke="#2d5a1b" strokeWidth="0.7" opacity="0.8" />

      {/* Kinmen (金門) — far west, small */}
      <ellipse cx="4" cy="55" rx="4" ry="2.5" fill="#5a9e3e" stroke="#2d5a1b" strokeWidth="0.7" opacity="0.65" />

      {/* Matsu (馬祖) — far north-west, tiny */}
      <ellipse cx="8" cy="28" rx="2.5" ry="1.5" fill="#5a9e3e" stroke="#2d5a1b" strokeWidth="0.6" opacity="0.55" />
    </svg>
  );
}
