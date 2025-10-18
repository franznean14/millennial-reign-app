#!/usr/bin/env node

/**
 * Script to clear all push subscriptions from production database
 * Run this after updating VAPID keys in production
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your production values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_PRODUCTION_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_URL.includes('YOUR_')) {
  console.error('❌ Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  console.log('Usage: SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/clear-production-subscriptions.js');
  process.exit(1);
}

async function clearSubscriptions() {
  console.log('🧹 Clearing all push subscriptions from production database...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    // Get count before deletion
    const { count: beforeCount } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Found ${beforeCount} subscriptions to clear`);
    
    if (beforeCount === 0) {
      console.log('✅ No subscriptions to clear');
      return;
    }
    
    // Delete all subscriptions
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (error) {
      console.error('❌ Error clearing subscriptions:', error);
      process.exit(1);
    }
    
    console.log('✅ Successfully cleared all push subscriptions');
    console.log('📱 Users will need to re-enable notifications with the new VAPID keys');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearSubscriptions();
