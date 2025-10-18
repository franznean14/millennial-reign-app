// Run this script in the browser console at https://localhost:3001
// This will clear the old push subscription and force a fresh start

console.log('🧹 Clearing push subscription and browser cache...');

async function clearPushSubscription() {
  try {
    // Clear localStorage
    localStorage.clear();
    console.log('✅ localStorage cleared');
    
    // Clear sessionStorage
    sessionStorage.clear();
    console.log('✅ sessionStorage cleared');
    
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    console.log('✅ Service worker ready');
    
    // Clear push subscription
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      console.log('🗑️ Found old subscription, removing...');
      await subscription.unsubscribe();
      console.log('✅ Old push subscription cleared');
    } else {
      console.log('ℹ️ No existing subscription found');
    }
    
    // Force service worker update
    console.log('🔄 Forcing service worker update...');
    await registration.update();
    
    // Clear all caches
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      await caches.delete(cacheName);
      console.log(`✅ Cleared cache: ${cacheName}`);
    }
    
    console.log('🎉 Browser cache and push subscription cleared!');
    console.log('📱 Now refresh the page and try enabling notifications again');
    
    // Reload the page
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error clearing subscription:', error);
  }
}

clearPushSubscription();
