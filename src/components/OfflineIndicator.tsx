"use client";

import { useEffect, useState } from "react";

interface OfflineIndicatorProps {
  className?: string;
  showLastUpdated?: boolean;
  lastUpdated?: Date | null;
  variant?: "default" | "inline";
}

export function OfflineIndicator({ 
  className = "", 
  showLastUpdated = false, 
  lastUpdated,
  variant = "default"
}: OfflineIndicatorProps) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    // Set initial state
    setIsOffline(!navigator.onLine);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showLastUpdated) return null;

  const baseClasses = variant === "inline" 
    ? "flex items-center gap-1 text-xs" 
    : "flex items-center gap-2 text-sm";

  return (
    <div className={`${baseClasses} ${className}`}>
      {isOffline && (
        <div className="flex items-center gap-1 text-amber-500">
          <div className={`${variant === "inline" ? "w-1.5 h-1.5" : "w-2 h-2"} bg-amber-500 rounded-full animate-pulse`}></div>
          <span>Offline</span>
        </div>
      )}
      {showLastUpdated && lastUpdated && !isOffline && (
        <div className="text-xs text-gray-500">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}