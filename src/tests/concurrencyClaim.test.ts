import { createClient } from '@supabase/supabase-js'

// Replace with your project URL and service_role or anon key for testing
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function runConcurrencyTest() {
  console.log('--- Starting Simultaneous Driver Claim Concurrency Test ---')

  // 1. Setup mock driver IDs (or fetch two existing drivers)
  const { data: drivers, error: driverErr } = await supabase
    .from('driver_profiles')
    .select('id')
    .limit(2)

  if (driverErr || !drivers || drivers.length < 2) {
    console.error('Test setup requires at least 2 registered driver profiles in the DB.')
    return
  }

  const driverA = drivers[0].id
  const driverB = drivers[1].id

  console.log(`Driver A: ${driverA}`)
  console.log(`Driver B: ${driverB}`)

  // 2. Insert a temporary test ride in 'requested' status
  const { data: testRide, error: insertErr } = await supabase
    .from('rides')
    .insert({
      fare: 500,
      status: 'requested',
      custom_pickup: 'Concurrency Test Pickup',
      custom_dropoff: 'Concurrency Test Dropoff',
    })
    .select()
    .single()

  if (insertErr || !testRide) {
    console.error('Failed to create test ride:', insertErr)
    return
  }

  console.log(`Test ride created: ${testRide.id}`)

  // 3. Fire simultaneous claims using Promise.all
  console.log('Dispatching simultaneous claim_ride RPC calls...')
  const [resultA, resultB] = await Promise.all([
    supabase.rpc('claim_ride', { p_ride_id: testRide.id, p_driver_id: driverA }),
    supabase.rpc('claim_ride', { p_ride_id: testRide.id, p_driver_id: driverB }),
  ])

  console.log('Driver A Response:', resultA.data)
  console.log('Driver B Response:', resultB.data)

  // 4. Assertions
  const successA = resultA.data?.success === true
  const successB = resultB.data?.success === true

  const exactlyOneWinner = (successA && !successB) || (!successA && successB)

  // 5. Check database state
  const { data: finalRide } = await supabase
    .from('rides')
    .select('driver_id, status')
    .eq('id', testRide.id)
    .single()

  console.log('\n--- Test Results ---')
  console.log(`Exactly one winner: ${exactlyOneWinner ? 'PASSED ✅' : 'FAILED ❌'}`)
  console.log(`Final DB status: ${finalRide?.status} (expected: 'accepted')`)
  console.log(`Winning Driver in DB: ${finalRide?.driver_id}`)

  // 6. Cleanup test row
  await supabase.from('rides').delete().eq('id', testRide.id)
  console.log('Cleaned up test ride row.')
}

runConcurrencyTest().catch(console.error)