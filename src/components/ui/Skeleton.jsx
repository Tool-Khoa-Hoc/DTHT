import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const ASPECT_CLASS_MAP = {
  '16/9': 'aspect-video',
  '4/3': 'aspect-4/3',
  '1/1': 'aspect-square',
};

export function Skeleton({ className = '', aspectRatio }) {
  const aspectClass = aspectRatio ? ASPECT_CLASS_MAP[aspectRatio] || 'aspect-video' : '';
  return (
    <div
      className={`animate-pulse rounded-xl bg-surface-alt border border-border/60 ${aspectClass} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="paper-card p-5 space-y-4" aria-hidden="true">
      <Skeleton aspectRatio="16/9" className="w-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border" aria-hidden="true">
      <Skeleton className="w-12 h-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
    </div>
  );
}

export function PageSkeleton() {
  const { t } = useLanguage();
  return (
    <div
      className="min-h-dvh bg-background p-4 md:p-8 space-y-6"
      role="status"
      aria-label={t('skeleton.loadingPage')}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-[75vw]" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="paper-card p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
