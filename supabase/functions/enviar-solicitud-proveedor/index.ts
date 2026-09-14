import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
})

const esc = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const fromEmail = Deno.env.get('CO_FROM_EMAIL') ?? ''
  const fromName = Deno.env.get('CO_FROM_NAME') ?? 'Skilled Proyectos Industriales'
  const authorization = req.headers.get('Authorization') ?? ''

  if (!url || !anonKey || !serviceKey) return json({ error: 'La función no tiene configuradas las credenciales de Supabase.' }, 500)
  if (!resendKey || !fromEmail) return json({ error: 'Configura RESEND_API_KEY y CO_FROM_EMAIL para habilitar el envío directo.' }, 503)
  if (!authorization) return json({ error: 'Sesión no válida.' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const solicitudId = String(body?.solicitudId ?? '').trim()
    if (!solicitudId) return json({ error: 'Falta solicitudId.' }, 400)

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Sesión no válida.' }, 401)

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: profile, error: profileError } = await admin
      .from('perfiles_usuario')
      .select('rol,activo')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile?.activo || !['administrador', 'compras'].includes(String(profile.rol ?? ''))) {
      return json({ error: 'Solo Compras o Administrador puede enviar cotizaciones.' }, 403)
    }

    const { data: request, error: requestError } = await admin
      .from('co_solicitudes_proveedor')
      .select('*,co_solicitud_proveedor_items(*)')
      .eq('id', solicitudId)
      .single()
    if (requestError) throw requestError
    if (!request?.proveedor_email) return json({ error: 'El proveedor no tiene correo registrado.' }, 400)

    const items = Array.isArray(request.co_solicitud_proveedor_items) ? request.co_solicitud_proveedor_items : []
    const rows = items.map((item: any) => `
      <tr>
        <td>${esc(item.material_codigo || '—')}</td>
        <td>${esc(item.descripcion)}</td>
        <td>${esc(item.marca || '—')}</td>
        <td style="text-align:right">${esc(item.cantidad)}</td>
        <td>${esc(item.unidad || '')}</td>
      </tr>`).join('')
    const messageHtml = esc(request.mensaje || '').replaceAll('\n', '<br>')
    const html = `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#182235">
      <div style="max-width:760px;margin:24px auto;background:#fff;border:1px solid #dfe6ef;border-radius:14px;overflow:hidden">
        <div style="padding:22px 26px;background:#07111f;color:#fff"><strong>${esc(fromName)}</strong><div style="font-size:12px;opacity:.72;margin-top:4px">${esc(request.numero)} · ${esc(request.orden_compra)}</div></div>
        <div style="padding:26px"><div style="font-size:14px;line-height:1.6">${messageHtml}</div>
          ${items.length ? `<table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:12px"><thead><tr><th style="text-align:left;border-bottom:1px solid #dfe6ef;padding:9px">Código</th><th style="text-align:left;border-bottom:1px solid #dfe6ef;padding:9px">Material</th><th style="text-align:left;border-bottom:1px solid #dfe6ef;padding:9px">Marca</th><th style="text-align:right;border-bottom:1px solid #dfe6ef;padding:9px">Cantidad</th><th style="text-align:left;border-bottom:1px solid #dfe6ef;padding:9px">Unidad</th></tr></thead><tbody>${rows.replaceAll('<td>', '<td style="padding:9px;border-bottom:1px solid #edf1f6">')}</tbody></table>` : ''}
        </div>
      </div></body></html>`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [request.proveedor_email],
        subject: request.asunto,
        html
      })
    })
    const responseBody = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = String(responseBody?.message || responseBody?.error || `HTTP ${response.status}`)
      await admin.from('co_solicitudes_proveedor').update({ estado: 'error', error_envio: detail, updated_at: new Date().toISOString() }).eq('id', solicitudId)
      return json({ error: `No se pudo enviar el correo: ${detail}` }, 502)
    }

    const sentAt = new Date().toISOString()
    await admin.from('co_solicitudes_proveedor').update({ estado: 'enviada', fecha_envio: sentAt, error_envio: null, updated_at: sentAt }).eq('id', solicitudId)
    return json({ ok: true, solicitudId, proveedor: request.proveedor_nombre, correo: request.proveedor_email, fechaEnvio: sentAt, messageId: responseBody?.id || null })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo enviar el correo.' }, 500)
  }
})
