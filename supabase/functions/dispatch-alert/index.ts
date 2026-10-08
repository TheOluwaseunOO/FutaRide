import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const ride = payload.record || payload

    // 1. Fetch all driver subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('driver_push_subscriptions')
      .select('*')

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No registered driver devices found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Configure VAPID details
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!vapidPublic || !vapidPrivate) {
      throw new Error('VAPID keys not configured in Edge Function secrets')
    }

    webpush.setVapidDetails('mailto:support@futaride.com', vapidPublic, vapidPrivate)

    const pickup = ride.custom_pickup || 'Campus Hub'
    const dropoff = ride.custom_dropoff || 'Campus Hub'
    const fare = ride.fare ? `₦${ride.fare}` : 'Standard Fare'

    const pushPayload = JSON.stringify({
      title: '🛺 New Ride Request!',
      body: `${pickup} → ${dropoff} (${fare})`,
      message: `${pickup} → ${dropoff} (${fare})`,
      url: '/driver',
      rideId: ride.id,
    })

    // 3. Broadcast to all active driver subscriptions
    let sentCount = 0
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushPayload
          )
          sentCount++
        } catch (err: any) {
          // Clean up expired or revoked endpoints
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabaseClient.from('driver_push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        }
      })
    )

    return new Response(JSON.stringify({ success: true, sent: sentCount, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})