import React, { useState, useEffect } from 'react';

const COLORS = [
  'bg-blue-500', 
  'bg-purple-500', 
  'bg-emerald-500', 
  'bg-rose-500', 
  'bg-amber-500', 
  'bg-indigo-500', 
  'bg-cyan-500', 
  'bg-pink-500'
];

/**
 * Deterministically pick a color based on a string (ID or name)
 */
const getDeterministicColor = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
};

/**
 * Get the first letter of a name for initials
 */
const getInitial = (name = '') => {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
};

export default function Avatar({ src, name, id, size = 'w-12 h-12', rounded = 'rounded-xl', className = '' }) {
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Reset error if src changes
  useEffect(() => {
    setError(false);
  }, [src]);

  const initials = getInitial(name);
  const bgColor = getDeterministicColor(id || name || 'default');

  // If no source or an error occurred, show the initials
  if (!src || error) {
    return (
      <div 
        className={`${size} ${rounded} ${bgColor} flex items-center justify-center text-white font-black text-lg select-none shadow-sm ${className}`}
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className={`relative ${size} ${className}`}>
      {!isVisible && (
        <div className={`absolute inset-0 ${size} ${rounded} animate-pulse bg-slate-200 dark:bg-slate-700`} />
      )}
      <img
        src={src}
        alt={name || 'Avatar'}
        onLoad={() => setIsVisible(true)}
        onError={() => setError(true)}
        className={`${size} ${rounded} object-cover border border-slate-200 dark:border-white/10 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
