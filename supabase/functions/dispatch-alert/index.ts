import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const ride = payload.record || payload
    console.log('Incoming ride payload:', JSON.stringify(ride))

    const { data: subscriptions, error: subError } = await supabaseClient
      .from('driver_push_subscriptions')
      .select('*')

    if (subError || !subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found or error:', subError)
      return new Response(JSON.stringify({ sent: 0, message: 'No registered driver devices found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${subscriptions.length} active subscriptions. Setting VAPID...`)

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!vapidPublic || !vapidPrivate) {
      console.error('Missing VAPID keys in Edge Function secrets!')
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
          console.log(`Push sent successfully to endpoint ${sub.id}`)
        } catch (err: any) {
          console.error(`Push FAILED for sub ${sub.id}: Status ${err.statusCode} - ${err.message} - Body: ${err.body}`)
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabaseClient.from('driver_push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        }
      })
    )

    console.log(`Finished sending. Sent: ${sentCount}/${subscriptions.length}`)
    return new Response(JSON.stringify({ success: true, sent: sentCount, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Fatal Edge Function Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})