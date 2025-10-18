"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const supported = "serviceWorker" in navigator && 
                     "PushManager" in window && 
                     "Notification" in window;
    
    // Debug logging
    console.log("Push notification support check:", {
      serviceWorker: "serviceWorker" in navigator,
      pushManager: "PushManager" in window,
      notification: "Notification" in window,
      vapidKey: !!VAPID_PUBLIC_KEY,
      vapidKeyLength: VAPID_PUBLIC_KEY?.length,
      userAgent: navigator.userAgent,
      isSecure: location.protocol === 'https:',
      isLocalhost: location.hostname === 'localhost'
    });
    
    // Check if VAPID key is missing
    if (!VAPID_PUBLIC_KEY) {
      console.error("VAPID_PUBLIC_KEY is missing from environment variables");
    }
    
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);
  
  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Check subscription error:", error);
    }
  };
  
  const subscribe = useCallback(async () => {
    if (!isSupported) return { success: false, error: "Not supported" };
    
    try {
      console.log("Starting push subscription process...");
      
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      console.log("Notification permission:", perm);
      
      if (perm !== "granted") {
        return { success: false, error: "Permission denied" };
      }
      
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      console.log("Service worker ready");
      
      // Convert VAPID key with better error handling
      let applicationServerKey;
      try {
        applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        console.log("VAPID key converted successfully");
      } catch (keyError) {
        console.error("VAPID key conversion failed:", keyError);
        return { success: false, error: "Invalid VAPID key" };
      }
      
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });
      console.log("Push subscription created");
      
      // Save subscription to database
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }
      
      const subscriptionJSON = subscription.toJSON();
      console.log("Saving subscription to database...");
      
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subscriptionJSON.endpoint!,
        p256dh: subscriptionJSON.keys!.p256dh,
        auth: subscriptionJSON.keys!.auth,
        user_agent: navigator.userAgent,
      });
      
      if (error) {
        console.error("Database error:", error);
        throw error;
      }
      
      console.log("Subscription saved successfully");
      setIsSubscribed(true);
      return { success: true };
    } catch (error) {
      console.error("Subscribe error:", error);
      return { success: false, error: String(error) };
    }
  }, [isSupported]);
  
  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove from database
        const supabase = createSupabaseBrowserClient();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
      }
      
      setIsSubscribed(false);
      return { success: true };
    } catch (error) {
      console.error("Unsubscribe error:", error);
      return { success: false, error: String(error) };
    }
  }, []);
  
  return {
    permission,
    isSubscribed,
    isSupported,
    subscribe,
    unsubscribe,
  };
}

function urlBase64ToUint8Array(base64String: string) {
  // iOS Safari compatible base64 to Uint8Array conversion
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  
  // Use a more robust approach for iOS
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}
