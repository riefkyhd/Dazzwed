import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base luxury dark-room skeleton box with warm stone pulse animation.
 */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-stone-900/80 border border-stone-800/60 rounded-xl ${className}`}
      {...props}
    />
  );
}

/**
 * KPI Metric Stat Card Skeleton (Title, Large Stat Number, Subtitle).
 */
export function KpiCardSkeleton({ className = "" }: { className?: string } = {}) {
  return (
    <div
      className={`p-5 rounded-2xl bg-stone-950/80 border border-stone-800/80 shadow-lg space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24 rounded-md" />
        <Skeleton className="h-6 w-6 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-28 rounded-lg" />
      <Skeleton className="h-3 w-36 rounded-md" />
    </div>
  );
}

/**
 * Responsive Contact-Sheet Photo Gallery Grid Skeleton (2 to 4 columns).
 */
export function GalleryGridSkeleton({ count = 12 }: { count?: number } = {}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-[3/4] relative overflow-hidden rounded-xl bg-stone-950 border border-stone-800/80 p-3 flex flex-col justify-between shadow-md"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-14 rounded-md" />
            <Skeleton className="h-4 w-8 rounded-md" />
          </div>
          <div className="w-full flex flex-col items-center justify-center my-auto">
            <Skeleton className="h-10 w-10 rounded-full mb-2 bg-stone-900" />
            <Skeleton className="h-2.5 w-16 rounded-md" />
          </div>
          <div className="space-y-1.5 pt-2 border-t border-stone-800/60">
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-2 w-12 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Table Skeleton (Header + Row Placeholders).
 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number } = {}) {
  return (
    <div className="w-full rounded-2xl bg-stone-950/80 border border-stone-800/80 overflow-hidden shadow-lg">
      {/* Table Header */}
      <div className="grid grid-cols-4 gap-4 p-4 border-b border-stone-800/80 bg-stone-900/40">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-20 rounded-md" />
        ))}
      </div>
      {/* Table Rows */}
      <div className="divide-y divide-stone-800/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid grid-cols-4 gap-4 p-4 items-center">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-md justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Analytical Chart / Leaderboard Panel Skeleton for /admin/health.
 */
export function ChartPanelSkeleton({ bars = 4, height = "" }: { bars?: number; height?: string } = {}) {
  return (
    <div className={`p-5 rounded-2xl bg-stone-950/80 border border-stone-800/80 shadow-lg space-y-4 ${height}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>
      <div className="space-y-3 pt-2">
        {Array.from({ length: bars }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-3 w-12 rounded-md" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Form Card Skeleton with labels, input fields, and action buttons.
 */
export function FormCardSkeleton({ fields = 3, rows }: { fields?: number; rows?: number } = {}) {
  const count = rows ?? fields;
  return (
    <div className="p-6 rounded-2xl bg-stone-950/80 border border-stone-800/80 shadow-lg space-y-5">
      <div className="space-y-1.5 pb-3 border-b border-stone-800/80">
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="h-3 w-64 rounded-md" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="pt-2 flex justify-end">
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
    </div>
  );
}
