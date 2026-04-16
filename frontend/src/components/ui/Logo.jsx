import React from 'react';

const Logo = ({ size = 32, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 115" fill="none" width={size} height={size * 1.15} className={className}>
    <defs>
      <linearGradient id="cfBlue" x1="0" y1="0" x2="50" y2="115">
        <stop offset="0%" stopColor="#42A5F5"/>
        <stop offset="100%" stopColor="#1E88E5"/>
      </linearGradient>
      <linearGradient id="cfOrange" x1="50" y1="20" x2="80" y2="100">
        <stop offset="0%" stopColor="#FFA726"/>
        <stop offset="100%" stopColor="#FB8C00"/>
      </linearGradient>
    </defs>
    {/* Hexagon */}
    <polygon points="50,2 95,27 95,77 50,102 5,77 5,27" fill="url(#cfBlue)"/>
    {/* Inner white */}
    <polygon points="50,18 78,34 78,70 50,86 22,70 22,34" fill="white"/>
    {/* C left bar */}
    <rect x="22" y="34" width="14" height="36" fill="url(#cfBlue)"/>
    {/* C top */}
    <polygon points="22,34 50,18 78,34 78,40 50,25 36,34" fill="url(#cfBlue)"/>
    {/* C bottom */}
    <polygon points="22,70 50,86 78,70 78,64 50,79 36,70" fill="url(#cfBlue)"/>
    {/* F vertical */}
    <rect x="45" y="30" width="12" height="48" fill="url(#cfOrange)"/>
    {/* F top bar */}
    <rect x="45" y="30" width="30" height="10" fill="url(#cfOrange)"/>
    {/* F middle bar */}
    <rect x="45" y="49" width="22" height="9" fill="url(#cfOrange)"/>
    {/* Blue triangle */}
    <polygon points="57,78 70,70 57,70" fill="#1E88E5"/>
  </svg>
);

export default Logo;
