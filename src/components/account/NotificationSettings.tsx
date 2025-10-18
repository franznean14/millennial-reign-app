"use client";

import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Send } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function NotificationSettings() {
  const { permission, isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications();
  const [isTesting, setIsTesting] = useState(false);
  
  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground">
        Push notifications are not supported on this device.
      </div>
    );
  }
  
  const handleToggle = async () => {
    if (isSubscribed) {
      const result = await unsubscribe();
      if (result.success) {
        toast.success("Notifications disabled");
      } else {
        toast.error("Failed to disable notifications");
      }
    } else {
      const result = await subscribe();
      if (result.success) {
        toast.success("Notifications enabled!");
      } else {
        toast.error(result.error || "Failed to enable notifications");
      }
    }
  };

  const handleTestNotification = async () => {
    if (!isSubscribed) {
      toast.error("Please enable notifications first");
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Test notification sent! Found ${result.subscriptions} subscription(s)`);
      } else {
        toast.error(result.error || "Failed to send test notification");
      }
    } catch (error) {
      toast.error("Failed to send test notification");
    } finally {
      setIsTesting(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Push Notifications</h3>
          <p className="text-sm text-muted-foreground">
            {isSubscribed 
              ? "You'll receive notifications for assignments and updates"
              : "Enable notifications to stay updated"}
          </p>
          {permission === "denied" && (
            <p className="text-xs text-destructive mt-1">
              Notifications are blocked. Please enable them in your browser settings.
            </p>
          )}
        </div>
        <Button
          variant={isSubscribed ? "default" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={permission === "denied"}
        >
          {isSubscribed ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
          {isSubscribed ? "Enabled" : "Enable"}
        </Button>
      </div>
      
      {isSubscribed && (
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">Test Notifications</h4>
            <p className="text-xs text-muted-foreground">
              Send a test notification to verify everything is working
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestNotification}
            disabled={isTesting}
          >
            <Send className="h-4 w-4 mr-2" />
            {isTesting ? "Sending..." : "Test"}
          </Button>
        </div>
      )}
    </div>
  );
}
