import React from 'react';

const Logo = ({ size = 32, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width={size} height={size} className={className}>
    <defs>
      <linearGradient id="dtGrad1" x1="0" y1="0" x2="50" y2="50">
        <stop offset="0%" stopColor="#6366f1"/>
        <stop offset="50%" stopColor="#8b5cf6"/>
        <stop offset="100%" stopColor="#a855f7"/>
      </linearGradient>
      <linearGradient id="dtGrad2" x1="0" y1="50" x2="50" y2="0">
        <stop offset="0%" stopColor="#3b82f6"/>
        <stop offset="100%" stopColor="#6366f1"/>
      </linearGradient>
      <linearGradient id="dtAccent" x1="25" y1="10" x2="40" y2="45">
        <stop offset="0%" stopColor="#f59e0b"/>
        <stop offset="100%" stopColor="#f97316"/>
      </linearGradient>
    </defs>
    {/* Background rounded square */}
    <rect width="50" height="50" rx="12" fill="url(#dtGrad1)"/>
    {/* Inner glow circle */}
    <circle cx="25" cy="25" r="18" fill="url(#dtGrad2)" opacity="0.3"/>
    {/* D letter - main stroke */}
    <path d="M14 12 L14 38 L26 38 C34 38 39 32 39 25 C39 18 34 12 26 12 Z M19 17 L25 17 C31 17 34 20 34 25 C34 30 31 33 25 33 L19 33 Z" fill="white"/>
    {/* Clock hand accent - orange dot */}
    <circle cx="36" cy="14" r="4.5" fill="url(#dtAccent)"/>
    {/* Clock tick on the dot */}
    <line x1="36" y1="11.5" x2="36" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="36" y1="14" x2="38" y2="15.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export default Logo;
