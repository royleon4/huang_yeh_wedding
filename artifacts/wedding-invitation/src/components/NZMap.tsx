export function NZMap({
  className = "",
  size = 120,
  style,
}: {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size * 1.9}
      viewBox="0 0 120 228"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* North Island base gradient */}
        <linearGradient id="nz-north-base" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#72bb4e" />
          <stop offset="60%" stopColor="#5aaa38" />
          <stop offset="100%" stopColor="#3d8a22" />
        </linearGradient>

        {/* South Island base — more alpine */}
        <linearGradient id="nz-south-base" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5aaa38" />
          <stop offset="50%" stopColor="#3d8a22" />
          <stop offset="100%" stopColor="#2d6a18" />
        </linearGradient>

        {/* Southern Alps gradient — E-W slope */}
        <linearGradient id="nz-alps" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a5e14" />
          <stop offset="40%" stopColor="#e8f4d8" />
          <stop offset="55%" stopColor="#c0dca0" />
          <stop offset="100%" stopColor="#4a8c2a" />
        </linearGradient>

        <filter id="nz-shadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="1.5" dy="2.5" stdDeviation="2.5" floodColor="#1a3a0a" floodOpacity="0.3" />
        </filter>

        <clipPath id="nz-north-clip">
          <path d="
            M 70 6
            C 76 8, 85 14, 90 22
            C 95 30, 96 40, 93 50
            C 91 58, 94 65, 92 74
            C 90 82, 84 88, 76 93
            C 70 97, 63 99, 57 97
            C 51 95, 47 99, 40 103
            C 34 106, 28 103, 28 96
            C 28 89, 33 82, 40 76
            C 47 70, 45 61, 48 53
            C 51 45, 56 36, 60 26
            C 63 17, 65 5, 70 6 Z
          " />
        </clipPath>

        <clipPath id="nz-south-clip">
          <path d="
            M 28 120
            C 36 115, 50 112, 64 116
            C 74 119, 84 124, 92 134
            C 99 144, 102 157, 98 170
            C 95 182, 87 192, 77 200
            C 66 208, 53 213, 42 212
            C 32 211, 22 206, 18 196
            C 14 186, 15 173, 17 161
            C 19 148, 16 135, 22 126
            C 24 122, 26 121, 28 120 Z
          " />
        </clipPath>
      </defs>

      {/* ======= NORTH ISLAND (北島) ======= */}

      {/* Base fill */}
      <path
        d="
          M 70 6
          C 76 8, 85 14, 90 22
          C 95 30, 96 40, 93 50
          C 91 58, 94 65, 92 74
          C 90 82, 84 88, 76 93
          C 70 97, 63 99, 57 97
          C 51 95, 47 99, 40 103
          C 34 106, 28 103, 28 96
          C 28 89, 33 82, 40 76
          C 47 70, 45 61, 48 53
          C 51 45, 56 36, 60 26
          C 63 17, 65 5, 70 6 Z
        "
        fill="url(#nz-north-base)"
        stroke="#2d6018"
        strokeWidth="1"
        strokeLinejoin="round"
        filter="url(#nz-shadow)"
      />

      {/* Taranaki peninsula / west protrusion */}
      <path
        d="M 36 78 C 30 78, 24 81, 22 86 C 20 91, 24 96, 28 96 C 28 89, 33 82, 36 78 Z"
        fill="#5aaa38"
        stroke="#2d6018"
        strokeWidth="0.8"
      />

      {/* East coast — slightly darker, steeper */}
      <path
        d="M 88 22 C 93 32, 95 44, 92 56 C 90 66, 93 73, 90 82 L 82 90 C 85 80, 88 72, 88 62 C 88 50, 92 38, 88 26 Z"
        fill="#3d8a22"
        opacity="0.4"
        clipPath="url(#nz-north-clip)"
      />

      {/* Volcanic plateau highlight — central north island */}
      <path
        d="M 62 55 C 66 58, 70 62, 72 68 C 74 74, 72 80, 68 84 C 64 80, 62 74, 61 68 C 60 62, 60 56, 62 55 Z"
        fill="#c8e098"
        opacity="0.4"
        clipPath="url(#nz-north-clip)"
      />

      {/* Mt Ruapehu / volcanic peak highlight */}
      <path
        d="M 56 72 L 62 62 L 68 72 L 62 76 Z"
        fill="#d8eebc"
        opacity="0.55"
        clipPath="url(#nz-north-clip)"
      />

      {/* Coromandel peninsula ridge */}
      <path
        d="M 82 28 C 86 36, 88 44, 86 52"
        stroke="#8acc58"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
        strokeLinecap="round"
      />

      {/* North Island topographic lines */}
      <path
        d="M 46 42 C 54 38, 64 38, 74 42 C 82 46, 88 52, 90 58"
        stroke="#3a7820"
        strokeWidth="0.6"
        fill="none"
        opacity="0.28"
        clipPath="url(#nz-north-clip)"
      />
      <path
        d="M 36 72 C 44 68, 56 66, 66 68 C 76 70, 84 76, 88 82"
        stroke="#3a7820"
        strokeWidth="0.6"
        fill="none"
        opacity="0.28"
        clipPath="url(#nz-north-clip)"
      />

      {/* North Island outline */}
      <path
        d="
          M 70 6
          C 76 8, 85 14, 90 22
          C 95 30, 96 40, 93 50
          C 91 58, 94 65, 92 74
          C 90 82, 84 88, 76 93
          C 70 97, 63 99, 57 97
          C 51 95, 47 99, 40 103
          C 34 106, 28 103, 28 96
          C 28 89, 33 82, 40 76
          C 47 70, 45 61, 48 53
          C 51 45, 56 36, 60 26
          C 63 17, 65 5, 70 6 Z
        "
        fill="none"
        stroke="#1e5010"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />

      {/* ======= COOK STRAIT gap ======= */}

      {/* ======= SOUTH ISLAND (南島) ======= */}

      {/* Base fill */}
      <path
        d="
          M 28 120
          C 36 115, 50 112, 64 116
          C 74 119, 84 124, 92 134
          C 99 144, 102 157, 98 170
          C 95 182, 87 192, 77 200
          C 66 208, 53 213, 42 212
          C 32 211, 22 206, 18 196
          C 14 186, 15 173, 17 161
          C 19 148, 16 135, 22 126
          C 24 122, 26 121, 28 120 Z
        "
        fill="url(#nz-south-base)"
        stroke="#2d6018"
        strokeWidth="1"
        strokeLinejoin="round"
        filter="url(#nz-shadow)"
      />

      {/* West coast — fiordland, darker ragged */}
      <path
        d="
          M 22 126 C 18 132, 14 144, 15 158
          C 16 170, 18 182, 18 196
          C 22 206, 32 211, 42 212
          L 38 206 C 28 200, 22 190, 20 178
          C 18 166, 19 152, 21 140
          C 23 130, 24 124, 26 122 Z
        "
        fill="#2a5e14"
        opacity="0.5"
        clipPath="url(#nz-south-clip)"
      />

      {/* Canterbury plains east coast — lighter */}
      <path
        d="
          M 80 126 C 88 132, 96 144, 98 158
          C 100 170, 96 182, 88 192
          L 80 198 C 88 188, 94 176, 94 162
          C 94 148, 90 136, 84 128 Z
        "
        fill="#7dcc50"
        opacity="0.35"
        clipPath="url(#nz-south-clip)"
      />

      {/* ===== SOUTHERN ALPS (南阿爾卑斯山) ===== */}
      {/* Main alpine spine — with snow on peaks */}

      {/* Wide mountain body */}
      <path
        d="M 50 118 C 56 122, 64 128, 70 138 C 76 148, 76 162, 70 174 C 64 186, 56 196, 50 204"
        stroke="#3d8022"
        strokeWidth="7"
        fill="none"
        opacity="0.3"
        strokeLinecap="round"
      />

      {/* Ridge line */}
      <path
        d="M 52 118 C 58 126, 66 136, 70 148 C 73 160, 70 172, 64 184 C 60 192, 54 200, 50 206"
        stroke="#b8e088"
        strokeWidth="1.8"
        fill="none"
        opacity="0.75"
        strokeLinecap="round"
      />

      {/* Snow / glacier patches */}
      <path d="M 56 126 L 64 118 L 72 128 L 66 136 L 58 132 Z"
        fill="#e8f8d0" opacity="0.6" clipPath="url(#nz-south-clip)" />
      <path d="M 62 148 L 70 140 L 76 150 L 70 158 L 64 154 Z"
        fill="#d8f0c0" opacity="0.5" clipPath="url(#nz-south-clip)" />
      <path d="M 58 170 L 66 162 L 72 170 L 66 178 L 60 174 Z"
        fill="#c8e8b0" opacity="0.45" clipPath="url(#nz-south-clip)" />

      {/* Secondary ridges */}
      <path
        d="M 40 122 C 44 132, 44 146, 42 158 C 40 170, 36 182, 34 194"
        stroke="#4a8c28"
        strokeWidth="0.8"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />
      <path
        d="M 74 120 C 80 132, 82 146, 80 160 C 78 174, 72 186, 66 196"
        stroke="#4a8c28"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
        strokeLinecap="round"
      />

      {/* South Island topographic contours */}
      <path
        d="M 22 140 C 32 136, 46 134, 58 136 C 70 138, 82 144, 92 152"
        stroke="#2e6016"
        strokeWidth="0.55"
        fill="none"
        opacity="0.28"
        clipPath="url(#nz-south-clip)"
      />
      <path
        d="M 18 164 C 28 160, 44 158, 58 160 C 72 162, 84 168, 94 176"
        stroke="#2e6016"
        strokeWidth="0.55"
        fill="none"
        opacity="0.28"
        clipPath="url(#nz-south-clip)"
      />
      <path
        d="M 20 186 C 30 182, 44 180, 56 182 C 68 184, 78 190, 86 196"
        stroke="#2e6016"
        strokeWidth="0.55"
        fill="none"
        opacity="0.25"
        clipPath="url(#nz-south-clip)"
      />

      {/* South Island outline */}
      <path
        d="
          M 28 120
          C 36 115, 50 112, 64 116
          C 74 119, 84 124, 92 134
          C 99 144, 102 157, 98 170
          C 95 182, 87 192, 77 200
          C 66 208, 53 213, 42 212
          C 32 211, 22 206, 18 196
          C 14 186, 15 173, 17 161
          C 19 148, 16 135, 22 126
          C 24 122, 26 121, 28 120 Z
        "
        fill="none"
        stroke="#1e5010"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />

      {/* ======= STEWART ISLAND (史都华岛) ======= */}
      <path
        d="M 36 220 C 40 216, 48 215, 53 218 C 57 221, 56 226, 50 227 C 44 228, 36 224, 36 220 Z"
        fill="#4a8c2a"
        stroke="#2d6018"
        strokeWidth="0.8"
      />

      {/* ======= CITY MARKERS ======= */}
      {/* Auckland (奧克蘭) */}
      <circle cx="74" cy="22" r="3" fill="#f5e840" stroke="#7a6a00" strokeWidth="0.6" opacity="0.95" />

      {/* Wellington (威靈頓) — capital */}
      <circle cx="57" cy="96" r="2.8" fill="#f5e840" stroke="#7a6a00" strokeWidth="0.6" opacity="0.9" />
      <circle cx="57" cy="96" r="1.2" fill="#fff" opacity="0.8" />

      {/* Christchurch (基督城) */}
      <circle cx="76" cy="158" r="2.2" fill="#ffffff" stroke="#888" strokeWidth="0.5" opacity="0.8" />

      {/* Queenstown (皇后鎮) — near alps south */}
      <circle cx="46" cy="188" r="1.8" fill="#ffffff" stroke="#888" strokeWidth="0.4" opacity="0.7" />
    </svg>
  );
}
