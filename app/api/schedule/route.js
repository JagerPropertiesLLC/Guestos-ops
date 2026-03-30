import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  try {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.SCHEDULE_API_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, units, generatedAt } = body

    if (!date || !units || !Array.isArray(units)) {
      return Response.json({ error: 'Missing date or units' }, { status: 400 })
    }

    const { data: schedule, error: schedErr } = await supabase
      .from('cleaning_schedules')
      .upsert({
        date,
        generated_at: generatedAt || new Date().toISOString(),
        overall_status: 'pending',
        total_units: units.length,
        completed_units: 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'date' })
      .select()
      .single()

    if (schedErr) throw schedErr

    await supabase
      .from('schedule_units')
      .delete()
      .eq('schedule_id', schedule.id)

    const unitRows = units.map((u, i) => ({
      schedule_id: schedule.id,
      sort_order: i + 1,
      property_name: u.propertyName,
      unit_number: u.unitNumber || null,
      guest_name: u.guestName || null,
      checkout_time: u.checkoutTime || null,
      early_checkin_time: u.earlyCheckinTime || null,
      early_checkin_fee: u.earlyCheckinFee || null,
      payment_method: u.paymentMethod || null,
      is_priority: u.isPriority || false,
      no_reply: u.noReply || false,
      prior_stay_nights: u.priorStayNights || null,
      status: 'pending',
      notes: [],
      created_at: new Date().toISOString()
    }))

    const { error: unitErr } = await supabase
      .from('schedule_units')
      .insert(unitRows)

    if (unitErr) throw unitErr

    return Response.json({
      success: true,
      scheduleId: schedule.id,
      unitsCreated: unitRows.length,
      date
    })

  } catch (err) {
    console.error('Schedule API error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const { data: schedule, error } = await supabase
    .from('cleaning_schedules')
    .select('*, schedule_units(*)')
    .eq('date', date)
    .single()

  if (error) return Response.json({ schedule: null })
  return Response.json({ schedule })
}
