"use client";

import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

export function NotificationSettings() {
  const { permission, isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications();
  
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
    </div>
  );
}
