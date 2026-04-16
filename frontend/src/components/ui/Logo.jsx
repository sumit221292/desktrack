import React from 'react';

const Logo = ({ size = 32, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width={size} height={size} className={className}>
    <defs>
      <linearGradient id="lBg" x1="0" y1="0" x2="50" y2="50">
        <stop offset="0%" stopColor="#1e3a5f"/>
        <stop offset="100%" stopColor="#0f172a"/>
      </linearGradient>
      <linearGradient id="lC" x1="8" y1="8" x2="30" y2="42">
        <stop offset="0%" stopColor="#38bdf8"/>
        <stop offset="100%" stopColor="#2563eb"/>
      </linearGradient>
      <linearGradient id="lF" x1="22" y1="12" x2="40" y2="40">
        <stop offset="0%" stopColor="#fb923c"/>
        <stop offset="100%" stopColor="#ea580c"/>
      </linearGradient>
    </defs>
    {/* Dark navy rounded bg */}
    <rect width="50" height="50" rx="11" fill="url(#lBg)"/>
    {/* C letter — open arc */}
    <path d="M24 10 C15 10 8 17 8 25 C8 33 15 40 24 40 L24 35 C18 35 13 31 13 25 C13 19 18 15 24 15 Z" fill="url(#lC)"/>
    {/* F letter */}
    <rect x="24" y="10" width="4.5" height="30" rx="1" fill="url(#lF)"/>
    <rect x="24" y="10" width="18" height="4.5" rx="1" fill="url(#lF)"/>
    <rect x="24" y="22" width="13" height="4" rx="1" fill="url(#lF)"/>
    {/* Accent dot */}
    <circle cx="40" cy="38" r="3" fill="#38bdf8" opacity="0.6"/>
  </svg>
);

export default Logo;
