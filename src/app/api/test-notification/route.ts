import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

if (vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:test@millennialreign.app', // This can be any email
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id);
    
    console.log('User ID:', user.id);
    console.log('Subscriptions found:', subscriptions?.length || 0);
    console.log('Subscriptions:', subscriptions);
    
    if (subError) {
      console.error('Database error:', subError);
      return NextResponse.json({ error: 'Failed to get subscriptions' }, { status: 500 });
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No push subscriptions found in database. Please enable notifications first.',
        subscriptions: 0 
      }, { status: 404 });
    }
    
    // Send actual push notifications
    const notificationPayload = JSON.stringify({
      title: '🔔 Test Notification',
      body: 'This is a test notification from Millennial Reign App!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: {
        url: '/account',
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'view',
          title: 'View Details'
        }
      ]
    });
    
    const results = [];
    
    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        };
        
        await webpush.sendNotification(pushSubscription, notificationPayload);
        results.push({ success: true, subscriptionId: subscription.id });
      } catch (error) {
        console.error('Failed to send notification to subscription:', subscription.id, error);
        results.push({ success: false, subscriptionId: subscription.id, error: String(error) });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({ 
      success: true, 
      message: `Test notification sent to ${successCount}/${subscriptions.length} devices`,
      results,
      subscriptions: subscriptions.length
    });
    
  } catch (error) {
    console.error('Test notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
