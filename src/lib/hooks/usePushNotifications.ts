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
      userAgent: navigator.userAgent,
      isSecure: location.protocol === 'https:',
      isLocalhost: location.hostname === 'localhost'
    });
    
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
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm !== "granted") {
        return { success: false, error: "Permission denied" };
      }
      
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      
      // Save subscription to database
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: "Not authenticated" };
      }
      
      const subscriptionJSON = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: subscriptionJSON.endpoint!,
        p256dh: subscriptionJSON.keys!.p256dh,
        auth: subscriptionJSON.keys!.auth,
        user_agent: navigator.userAgent,
      });
      
      if (error) throw error;
      
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
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
