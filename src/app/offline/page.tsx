"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <WifiOff className="h-16 w-16 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">You're Offline</h1>
          <p className="text-muted-foreground">
            It looks like you're not connected to the internet. Some features may not be available.
          </p>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Don't worry! You can still:
          </p>
          <ul className="text-sm text-left space-y-1 text-muted-foreground">
            <li>• View cached data from your last visit</li>
            <li>• Access your profile information</li>
            <li>• Browse previously loaded content</li>
          </ul>
        </div>
        
        <Button 
          onClick={() => window.location.reload()} 
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        
        <p className="text-xs text-muted-foreground">
          The app will automatically sync when you're back online.
        </p>
      </div>
    </div>
  );
}
