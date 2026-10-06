import React, { useEffect, useState } from 'react'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

interface NetworkBannerProps {
  onReconnect?: () => void
}

export default function NetworkBanner({ onReconnect }: NetworkBannerProps) {
  const { isOnline, wasOffline, setWasOffline } = useNetworkStatus()
  const [showReconnectedMsg, setShowReconnectedMsg] = useState(false)

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnectedMsg(true)
      if (onReconnect) onReconnect()

      const timer = setTimeout(() => {
        setShowReconnectedMsg(false)
        setWasOffline(false)
      }, 3500)

      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline, onReconnect, setWasOffline])

  if (!isOnline) {
    return (
      <div className="sticky top-0 z-50 bg-red-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-md animate-in fade-in duration-200">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>You are currently offline. Retrying network connection...</span>
        </div>
        <span className="text-[10px] bg-red-800/80 px-2 py-0.5 rounded font-mono">OFFLINE</span>
      </div>
    )
  }

  if (showReconnectedMsg) {
    return (
      <div className="sticky top-0 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-md animate-in fade-in duration-200">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white" />
          <span>Network re-established! Synchronized latest trip state.</span>
        </div>
        <span className="text-[10px] bg-emerald-800/80 px-2 py-0.5 rounded font-mono">RECONNECTED</span>
      </div>
    )
  }

  return null
}