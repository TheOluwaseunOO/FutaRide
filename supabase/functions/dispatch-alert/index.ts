import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@futa-ride.vercel.app'

    if (!supabaseUrl || !supabaseServiceKey || !vapidPublicKey || !vapidPrivateKey) {
      throw new Error('Missing environment configuration in Supabase Secrets.')
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const record = body.record || body

    // 1. Detect if this is an accepted or cancelled ride (DISMISSAL)
    const isDismissal = record.status === 'accepted' || record.status === 'cancelled'
    const rideId = String(record.id || '')

    const pushPayload = JSON.stringify({
      action: isDismissal ? 'dismiss' : 'notify',
      rideId,
      status: record.status,
      title: isDismissal ? '' : '🛺 New Ride Request!',
      body: isDismissal
        ? ''
        : `${record.custom_pickup || 'North Gate'} → ${record.custom_dropoff || 'Campus Hub'} (₦${record.fare || 'Custom'})`,
      url: '/driver',
    })

    // 2. Fetch all active device subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('driver_push_subscriptions')
      .select('*')

    if (subError) throw subError

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 3. Dispatch payload to all registered devices concurrently
    let sentCount = 0
    const deadSubscriptions: string[] = []

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          }
          await webpush.sendNotification(pushSubscription, pushPayload)
          sentCount++
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            deadSubscriptions.push(sub.endpoint)
          }
        }
      })
    )

    // 4. Remove expired/stale endpoints
    if (deadSubscriptions.length > 0) {
      await supabase
        .from('driver_push_subscriptions')
        .delete()
        .in('endpoint', deadSubscriptions)
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: subscriptions.length,
        isDismissal,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})