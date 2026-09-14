import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-device-code,x-device-token',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
const clean = (v: unknown, n = 500) => String(v ?? '').trim().slice(0, n)
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0
const envNamedJson = (name: string, key = 'default') => {
  try { const raw = Deno.env.get(name) || ''; const parsed = raw ? JSON.parse(raw) : {}; return clean(parsed?.[key] || '', 10000) } catch (_) { return '' }
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function localDateFromIso(iso: string, timeZone = 'America/Mexico_City') {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new Error('Fecha de checada no válida.')
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = (type: string) => clean(parts.find(p => p.type === type)?.value, 8)
  return `${get('year')}-${get('month')}-${get('day')}`
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'Falta configuración de Supabase.' }, 500)

  try {
    const body: any = await req.json().catch(() => ({}))
    const deviceCode = clean(req.headers.get('x-device-code') || body?.device_code, 80)
    const deviceToken = clean(req.headers.get('x-device-token') || body?.device_token, 300)
    if (!deviceCode || !deviceToken) return json({ ok: false, error: 'Faltan credenciales de la terminal.' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: device, error: deviceError } = await admin.from('rh_checador_dispositivos').select('*').eq('codigo', deviceCode).maybeSingle()
    if (deviceError) throw deviceError
    if (!device?.activo) return json({ ok: false, error: 'Terminal no autorizada o desactivada.' }, 403)
    const tokenHash = await sha256Hex(deviceToken)
    if (tokenHash !== clean(device.token_hash, 128)) return json({ ok: false, error: 'Credencial de terminal no válida.' }, 403)

    const ping = body?.ping === true
    const ip = clean((req.headers.get('x-forwarded-for') || '').split(',')[0], 120)
    const firmware = clean(body?.firmware, 80) || null
    const pendingBefore = Math.max(0, Math.floor(num(body?.pending_count)))
    if (ping) {
      await admin.from('rh_checador_dispositivos').update({ ultima_sincronizacion_at: new Date().toISOString(), ultimo_ip: ip || null, version_firmware: firmware, pendientes_locales: pendingBefore, ultimo_estado: { source: clean(body?.source,80)||'device', server_time: new Date().toISOString() }, ultimo_error: null, updated_at: new Date().toISOString() }).eq('id', device.id)
      return json({ ok: true, device: { id: device.id, codigo: device.codigo, nombre: device.nombre, ubicacion: device.ubicacion, tipo: device.tipo }, server_time: new Date().toISOString() })
    }

    const rawEvents = Array.isArray(body?.events) ? body.events : []
    if (rawEvents.length > 2000) return json({ ok: false, error: 'El lote supera 2000 checadas. Envía varios lotes para evitar pérdida de datos.', max_events: 2000 }, 413)
    const events = rawEvents
    const syncType = ['incremental', 'cierre_semanal', 'manual'].includes(clean(body?.sync_type, 30)) ? clean(body.sync_type, 30) : 'incremental'
    const batchUuid = clean(body?.batch_uuid, 80)
    if (!batchUuid) return json({ ok: false, error: 'Falta batch_uuid.' }, 400)

    const result = { received: events.length, inserted: 0, duplicates: 0, rejected: 0, errors: [] as any[] }
    const employeeCache = new Map<string, any>()

    for (const event of events) {
      try {
        const eventUuid = clean(event?.event_uuid, 80)
        const employeeNumber = clean(event?.employee_number, 80)
        const kind = clean(event?.type, 20).toLowerCase()
        const timestamp = clean(event?.timestamp, 80)
        const method = clean(event?.method, 40).toLowerCase() || 'numero_empleado'
        if (!eventUuid || !employeeNumber || !timestamp || !['entrada', 'salida'].includes(kind)) throw new Error('Evento incompleto.')
        if (!['numero_empleado', 'qr', 'rfid', 'huella', 'rostro', 'manual'].includes(method)) throw new Error('Método de identificación no válido.')
        const when = new Date(timestamp)
        if (Number.isNaN(when.getTime())) throw new Error('Fecha no válida.')
        if (when.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new Error('La fecha está demasiado adelantada.')

        const { data: existing } = await admin.from('rh_checadas').select('id').eq('evento_uuid', eventUuid).maybeSingle()
        if (existing?.id) { result.duplicates++; continue }

        let person = employeeCache.get(employeeNumber.toLowerCase())
        if (!person) {
          const { data, error } = await admin.from('rh_personal').select('id,numero_empleado,nombre,apellidos,estado').ilike('numero_empleado', employeeNumber).eq('estado', 'activo').limit(1).maybeSingle()
          if (error) throw error
          if (!data) throw new Error(`No existe colaborador activo ${employeeNumber}.`)
          person = data
          employeeCache.set(employeeNumber.toLowerCase(), person)
        }

        const row = {
          personal_id: person.id,
          tipo: kind,
          fecha_hora: when.toISOString(),
          fecha_local: localDateFromIso(when.toISOString()),
          dispositivo: clean(device.nombre, 160) || device.codigo,
          dispositivo_id: device.id,
          origen: 'importacion',
          notas: clean(event?.notes, 1000) || null,
          evento_uuid: eventUuid,
          metodo_identificacion: method,
          biometrico_ref: clean(event?.biometric_ref, 160) || null,
          confianza: event?.confidence === null || event?.confidence === undefined ? null : Math.max(0, Math.min(1, num(event.confidence))),
          sincronizado_at: new Date().toISOString(),
          registrado_por: null
        }
        const { error: insertError } = await admin.from('rh_checadas').insert(row)
        if (insertError) {
          if (clean(insertError.code, 30) === '23505') result.duplicates++
          else throw insertError
        } else result.inserted++
      } catch (error) {
        result.rejected++
        if (result.errors.length < 50) result.errors.push({ event_uuid: clean(event?.event_uuid, 80), error: clean((error as Error)?.message || error, 500) })
      }
    }

    let payroll: any = null
    const wantsClosure = syncType === 'cierre_semanal' || body?.finalize_week === true
    const closureBlocked = wantsClosure && result.rejected > 0
    if (wantsClosure && !closureBlocked) {
      const reference = clean(body?.reference_date, 20) || localDateFromIso(new Date().toISOString())
      const { data, error } = await admin.rpc('rh_preparar_nomina_desde_checador_v75', { p_fecha_referencia: reference })
      if (error) throw error
      payroll = data
    }

    const now = new Date().toISOString()
    const detail = { errors: result.errors, firmware, source: clean(body?.source, 80) || 'device' }
    const { data: syncRow, error: syncError } = await admin.from('rh_checador_sincronizaciones').upsert({
      dispositivo_id: device.id,
      lote_uuid: batchUuid,
      tipo: syncType,
      recibidos: result.received,
      insertados: result.inserted,
      duplicados: result.duplicates,
      rechazados: result.rejected,
      periodo_id: Number(payroll?.periodo_id || 0) || null,
      detalle: detail
    }, { onConflict: 'lote_uuid' }).select('id').single()
    if (syncError) throw syncError

    await admin.from('rh_checador_dispositivos').update({
      ultima_sincronizacion_at: now,
      ultimo_cierre_at: wantsClosure && !closureBlocked ? now : device.ultimo_cierre_at,
      ultimo_ip: ip || null,
      version_firmware: firmware,
      pendientes_locales: Math.max(0, pendingBefore - result.inserted - result.duplicates),
      ultimo_estado: { sync_type: syncType, received: result.received, inserted: result.inserted, duplicates: result.duplicates, rejected: result.rejected, closure_blocked: closureBlocked },
      ultimo_error: closureBlocked ? `Cierre bloqueado: ${result.rejected} checadas rechazadas` : result.rejected ? `${result.rejected} eventos rechazados` : null,
      updated_at: now
    }).eq('id', device.id)

    return json({ ok: !closureBlocked, batch_id: syncRow.id, ...result, payroll, closure_blocked: closureBlocked, error: closureBlocked ? 'No se cerró la semana porque existen checadas rechazadas. Corrige los registros y vuelve a sincronizar.' : undefined, server_time: now }, closureBlocked ? 422 : result.rejected ? 207 : 200)
  } catch (error) {
    console.error(error)
    return json({ ok: false, error: clean((error as Error)?.message || 'Error de sincronización.', 900) }, 500)
  }
})
