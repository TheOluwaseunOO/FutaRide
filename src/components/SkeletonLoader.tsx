import React from 'react'

export function RideHistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-between animate-pulse"
        >
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-neutral-200 rounded w-3/4" />
            <div className="h-3 bg-neutral-100 rounded w-1/3" />
          </div>
          <div className="space-y-2 w-16 text-right">
            <div className="h-4 bg-neutral-200 rounded ml-auto" />
            <div className="h-2.5 bg-neutral-100 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function HubSelectionSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-1.5 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-10 rounded-xl bg-neutral-100" />
      ))}
    </div>
  )
}