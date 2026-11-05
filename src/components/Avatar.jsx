import React, { useState } from 'react';

const AVATAR_TONES = [
  'bg-primary text-white border-gold',
  'bg-jade text-white border-jade-border',
  'bg-accent text-white border-gold',
  'bg-sky-700 text-white border-sky-300',
  'bg-indigo-700 text-white border-indigo-300',
  'bg-emerald-700 text-white border-emerald-300',
];

export default function Avatar({ src, name, className = 'w-10 h-10', textSize = 'text-base' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const imgError = Boolean(src) && failedSrc === src;

  const getInitial = (fullName) => {
    if (!fullName) return 'U';
    const parts = fullName.trim().split(' ');
    const lastPart = parts[parts.length - 1];
    return lastPart.charAt(0).toUpperCase();
  };

  const getToneClass = (str) => {
    if (!str) return AVATAR_TONES[0];
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
  };

  const initial = getInitial(name);
  const toneClass = getToneClass(name || 'User');

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        width={64}
        height={64}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
        className={`rounded-full object-cover no-shrink border border-border-strong ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-display font-bold select-none no-shrink border shadow-xs ${toneClass} ${className} ${textSize}`}
    >
      {initial}
    </div>
  );
}
