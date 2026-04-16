import React from 'react';

const Logo = ({ size = 32, className = '', showBg = false }) => {
  const logo = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" fill="none" width={size} height={size * 1.15} className={className}>
      <defs>
        <linearGradient id="cfB" x1="20" y1="0" x2="180" y2="230">
          <stop offset="0%" stopColor="#5BB8F5"/>
          <stop offset="100%" stopColor="#1A78D2"/>
        </linearGradient>
        <linearGradient id="cfO" x1="100" y1="40" x2="165" y2="200">
          <stop offset="0%" stopColor="#FFB74D"/>
          <stop offset="100%" stopColor="#F57C00"/>
        </linearGradient>
      </defs>
      {/* Outer hexagon - blue */}
      <polygon points="100,4 190,54 190,154 100,204 10,154 10,54" fill="url(#cfB)"/>
      {/* Inner cutout - white to form C */}
      <polygon points="100,40 160,74 160,134 100,168 40,134 40,74" fill="white"/>
      {/* C - left vertical */}
      <polygon points="40,74 40,134 60,144 60,64" fill="url(#cfB)"/>
      {/* C - top arm */}
      <polygon points="40,74 100,40 160,74 160,84 100,52 60,74 60,64" fill="url(#cfB)"/>
      {/* C - bottom arm */}
      <polygon points="40,134 100,168 160,134 160,124 100,156 60,134 60,144" fill="url(#cfB)"/>
      {/* F - vertical bar */}
      <rect x="95" y="60" width="24" height="100" rx="2" fill="url(#cfO)"/>
      {/* F - top horizontal bar */}
      <rect x="95" y="60" width="58" height="22" rx="2" fill="url(#cfO)"/>
      {/* F - middle horizontal bar */}
      <rect x="95" y="100" width="42" height="18" rx="2" fill="url(#cfO)"/>
      {/* Small blue triangle bottom-right */}
      <polygon points="119,160 145,144 119,144" fill="#1A78D2"/>
    </svg>
  );

  if (showBg) {
    return (
      <div className="rounded-2xl p-2 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 shadow-lg" style={{ display: 'inline-flex' }}>
        {logo}
      </div>
    );
  }

  return logo;
};

export default Logo;
