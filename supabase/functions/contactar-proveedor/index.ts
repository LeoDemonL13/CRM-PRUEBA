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

const clean = (value: unknown, max = 5000) => String(value ?? '').trim().slice(0, max)
const digits = (value: unknown) => clean(value, 100).replace(/\D/g, '')
const envNamedJson = (name: string, key = 'default') => { try { const raw = Deno.env.get(name) || ''; const parsed = raw ? JSON.parse(raw) : {}; return clean(parsed?.[key] || '', 10000) } catch (_) { return '' } }
const bytesBase64 = (bytes: Uint8Array) => { let out=''; const step=0x8000; for(let i=0;i<bytes.length;i+=step){ out += String.fromCharCode(...bytes.subarray(i,Math.min(i+step,bytes.length))) } return btoa(out) }
const esc = (value: unknown) => clean(value, 20000)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

function requestMessage(request: any) {
  const items = Array.isArray(request?.co_solicitud_proveedor_items) ? request.co_solicitud_proveedor_items : []
  const detail = items.map((item: any) => `• ${clean(item.cantidad, 40)} ${clean(item.unidad, 40)} · ${clean(item.material_codigo, 80)} · ${clean(item.descripcion, 220)}`).join('\n')
  return [
    clean(request?.mensaje, 3500),
    `Orden: ${clean(request?.orden_compra, 120)}`,
    detail ? `Materiales:\n${detail}` : ''
  ].filter(Boolean).join('\n\n')
}

async function logCommunication(admin: any, row: Record<string, unknown>) {
  try {
    await admin.from('co_comunicaciones_proveedor').insert(row)
  } catch (_) {}
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || envNamedJson('SUPABASE_PUBLISHABLE_KEYS')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || envNamedJson('SUPABASE_SECRET_KEYS')
  const authorization = req.headers.get('Authorization') ?? ''
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: 'Falta configuración de Supabase en la función.' }, 500)
  if (!authorization) return json({ ok: false, error: 'Sesión no válida.' }, 401)

  try {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ ok: false, error: 'Sesión no válida.' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: profile, error: profileError } = await admin.from('perfiles_usuario').select('rol,activo').eq('id', userData.user.id).maybeSingle()
    if (profileError) throw profileError
    if (!profile?.activo || !['administrador', 'compras'].includes(clean(profile.rol, 80).toLowerCase())) {
      return json({ ok: false, error: 'Solo Compras o Administrador puede contactar proveedores desde el CRM.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const { data: configRow } = await admin.from('co_configuracion_comunicacion').select('*').eq('id', 1).maybeSingle()
    const config: any = configRow || {}
    const resendKey = Deno.env.get('CO_RESEND_API_KEY') || Deno.env.get('RESEND_API_KEY') || ''
    const fromEmail = clean(config.correo_remitente || Deno.env.get('CO_FROM_EMAIL') || '', 320)
    const fromName = clean(config.correo_nombre || Deno.env.get('CO_FROM_NAME') || 'Compras · Skilled', 160)
    const replyTo = clean(config.correo_reply_to || Deno.env.get('CO_REPLY_TO') || '', 320)
    const whatsappToken = Deno.env.get('CO_WHATSAPP_TOKEN') || Deno.env.get('WHATSAPP_TOKEN') || ''
    const whatsappPhoneId = clean(config.whatsapp_phone_number_id || Deno.env.get('CO_WHATSAPP_PHONE_NUMBER_ID') || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '', 160)
    const whatsappWabaId = clean(config.whatsapp_business_account_id || Deno.env.get('CO_WHATSAPP_BUSINESS_ACCOUNT_ID') || Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') || '', 160)
    const whatsappVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v26.0'
    const whatsappTemplate = clean(config.whatsapp_template_name || Deno.env.get('WHATSAPP_SUPPLIER_TEMPLATE_NAME') || '', 160)
    const whatsappLanguage = clean(config.whatsapp_template_language || Deno.env.get('WHATSAPP_SUPPLIER_TEMPLATE_LANGUAGE') || 'es_MX', 30)
    const whatsappCountryCode = digits(Deno.env.get('WHATSAPP_DEFAULT_COUNTRY_CODE') || '52')
    const emailAuto = clean(config.correo_modo || 'manual', 30) === 'resend'
    const whatsappAuto = clean(config.whatsapp_modo || 'manual', 30) === 'cloud_api'

    if (body?.ping === true) {
      return json({
        ok: true,
        email: { mode: emailAuto ? 'resend' : 'manual', configured: emailAuto ? Boolean(resendKey && fromEmail) : true, from: fromEmail, name: fromName, reply_to: replyTo, missing: emailAuto ? [!resendKey && 'CO_RESEND_API_KEY / RESEND_API_KEY', !fromEmail && 'correo remitente'].filter(Boolean) : [] },
        whatsapp: { mode: whatsappAuto ? 'cloud_api' : 'manual', configured: whatsappAuto ? Boolean(whatsappToken && whatsappPhoneId && whatsappTemplate) : true, sender: clean(config.whatsapp_numero_remitente, 80), phone_number_id: whatsappPhoneId, business_account_id: whatsappWabaId, template_name: whatsappTemplate, template_language: whatsappLanguage, graph_version: whatsappVersion, missing: whatsappAuto ? [!whatsappToken && 'CO_WHATSAPP_TOKEN / WHATSAPP_TOKEN', !whatsappPhoneId && 'Phone Number ID', !whatsappTemplate && 'plantilla WhatsApp'].filter(Boolean) : [] }
      })
    }

    const channel = clean(body?.canal || body?.channel, 30).toLowerCase()
    if (!['email', 'whatsapp'].includes(channel)) return json({ ok: false, error: 'Canal no válido.' }, 400)
    const requestId = clean(body?.solicitudId, 100)
    const orderNumber = clean(body?.ordenCompra, 160)
    const attachOrder = body?.adjuntarOrden === true
    let providerId = Number(body?.proveedorId || 0) || null
    let request: any = null
    let orderRows: any[] = []
    let orderPdfPath = ''
    let orderPdfUrl = ''
    let orderPdfName = ''
    let orderPayment = ''
    let orderTerms = ''

    if (orderNumber) {
      let orderQuery = await admin.from('solicitudes_compra').select('*').eq('orden_compra', orderNumber).order('id')
      if (orderQuery.error) throw orderQuery.error
      orderRows = orderQuery.data || []
      if (!orderRows.length) {
        const groupQuery = await admin.from('solicitudes_compra').select('*').eq('grupo_orden', orderNumber).order('id')
        if (groupQuery.error) throw groupQuery.error
        orderRows = groupQuery.data || []
      }
      if (!orderRows.length) return json({ ok:false, error:'No se encontró la orden de compra.' },404)
      const { data: signatureRows, error: signatureError } = await admin.from('co_orden_firmas').select('tipo,firma_data_url').eq('orden_compra', orderNumber)
      if (signatureError) throw signatureError
      const signedTypes = new Set((signatureRows || []).filter((row:any)=>clean(row.firma_data_url,100).length>20).map((row:any)=>clean(row.tipo,30)))
      if (attachOrder && ['solicito','elaboro','reviso','aprobo'].some(t=>!signedTypes.has(t))) return json({ ok:false,error:'La orden requiere las cuatro firmas antes de enviarse.' },409)
      const first = orderRows[0] || {}
      orderPayment = clean(first.metodo_pago,180)
      orderTerms = clean(first.condiciones_pago,300)
      if (attachOrder && !orderPayment) return json({ ok:false,error:'Especifica el método de pago antes de enviar la orden.' },409)
      orderPdfPath = clean(first.pdf_path,900)
      orderPdfUrl = clean(first.pdf_url,1800)
      orderPdfName = clean(first.pdf_nombre || `${orderNumber}.pdf`,240)
      if (attachOrder && !orderPdfPath && !orderPdfUrl) return json({ ok:false,error:'Genera el PDF final autorizado antes de enviar la orden.' },409)
      providerId = Number(first.proveedor_id || 0) || providerId
      request = { proveedor_nombre:first.proveedor, proveedor_contacto:first.contacto_proveedor, proveedor_email:'', proveedor_telefono:'', proveedor_whatsapp:'', asunto:`Orden de compra ${orderNumber} · Skilled Proyectos Industriales`, mensaje:'' }
    }

    if (requestId) {
      const { data, error } = await admin.from('co_solicitudes_proveedor').select('*,co_solicitud_proveedor_items(*)').eq('id', requestId).single()
      if (error || !data) return json({ ok: false, error: 'No se encontró la solicitud al proveedor.' }, 404)
      request = data
      providerId = Number(request.proveedor_id || 0) || providerId
    }

    let provider: any = null
    if (providerId) {
      const { data, error } = await admin.from('co_proveedores').select('*').eq('id', providerId).maybeSingle()
      if (error) throw error
      provider = data
    }
    if (!provider && orderRows.length) {
      const providerNameFromOrder = clean(orderRows[0]?.proveedor, 180)
      if (providerNameFromOrder) {
        const commercial = await admin.from('co_proveedores').select('*').ilike('nombre_comercial', providerNameFromOrder).limit(1).maybeSingle()
        if (commercial.error) throw commercial.error
        provider = commercial.data
        if (!provider) {
          const legal = await admin.from('co_proveedores').select('*').ilike('razon_social', providerNameFromOrder).limit(1).maybeSingle()
          if (legal.error) throw legal.error
          provider = legal.data
        }
        providerId = Number(provider?.id || 0) || providerId
      }
    }
    if (!provider && !request) return json({ ok: false, error: 'No se encontró el proveedor.' }, 404)

    const providerName = clean(provider?.nombre_comercial || provider?.razon_social || request?.proveedor_nombre || 'Proveedor', 180)
    const contactName = clean(provider?.contacto || request?.proveedor_contacto || providerName, 160)
    const email = clean(provider?.email || request?.proveedor_email, 320)
    let whatsapp = digits(provider?.whatsapp || request?.proveedor_whatsapp || provider?.telefono || request?.proveedor_telefono)
    if (whatsapp.length === 10 && whatsappCountryCode) whatsapp = whatsappCountryCode + whatsapp
    const subject = clean(body?.asunto || body?.subject || request?.asunto || (orderNumber ? `Orden de compra ${orderNumber} · Skilled Proyectos Industriales` : `Contacto · Skilled Proyectos Industriales · ${providerName}`), 300)
    const orderDefaultMessage = orderNumber ? [`Buen día${contactName ? ` ${contactName}` : ''}.`,`Compartimos la orden de compra ${orderNumber} autorizada por Skilled Proyectos Industriales.`,`Método de pago: ${orderPayment || 'Por definir'}${orderTerms ? ` · ${orderTerms}` : ''}.`, orderPdfUrl ? `Documento autorizado: ${orderPdfUrl}` : '', 'Quedamos atentos a la confirmación de recepción.'].filter(Boolean).join('\n\n') : ''
    const message = clean(body?.mensaje || body?.message || orderDefaultMessage || (request ? requestMessage(request) : ''), 5000)
    if (!message) return json({ ok: false, error: 'Escribe un mensaje para el proveedor.' }, 400)

    if (channel === 'email') {
      if (!email) return json({ ok: false, error: 'El proveedor no tiene correo registrado.' }, 400)
      if (!emailAuto) return json({ ok: false, error: 'Compras tiene el correo en modo manual. Cambia a Resend en Canales de Compras para enviar desde el CRM.' }, 503)
      if (!resendKey || !fromEmail) return json({ ok: false, error: 'El correo automático no está configurado. Define el remitente en Compras y CO_RESEND_API_KEY (o RESEND_API_KEY) en Supabase Secrets.' }, 503)
      const html = `<!doctype html><html><body style="margin:0;background:#eef3f9;font-family:Arial,sans-serif;color:#132033"><div style="max-width:760px;margin:24px auto;background:#ffffff;border:1px solid #d8e3ef;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(7,17,31,.08)"><div style="padding:24px 28px;background:linear-gradient(135deg,#07111f 0%,#0c2544 100%);color:#fff"><div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.78">Skilled Proyectos Industriales</div><strong style="display:block;font-size:22px;margin-top:10px">${orderNumber ? 'Orden de compra autorizada' : 'Solicitud formal de cotización'}</strong><div style="font-size:12px;opacity:.76;margin-top:6px">${orderNumber ? `Documento dirigido a ${esc(providerName)}` : `Contacto comercial dirigido a ${esc(providerName)}`}</div></div><div style="padding:26px 28px"><div style="margin-bottom:18px;padding:14px 16px;border:1px solid #dbe6f1;border-radius:14px;background:#f8fbff"><div style="font-size:11px;color:#526174;text-transform:uppercase;letter-spacing:.12em;font-weight:700">Remitente</div><div style="margin-top:8px;font-size:15px;font-weight:700;color:#132033">${esc(fromName)}</div>${replyTo?`<div style="margin-top:4px;font-size:12px;color:#526174">Respuesta a: ${esc(replyTo)}</div>`:''}</div><div style="font-size:14px;line-height:1.75;color:#1d2a3f;white-space:pre-line">${esc(message)}</div><div style="margin-top:22px;padding:16px;border-radius:14px;background:#f3f7fc;border:1px solid #dbe6f1"><div style="font-size:11px;color:#526174;text-transform:uppercase;letter-spacing:.12em;font-weight:700">Nota</div><p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#4b5d73">Este mensaje fue generado desde el CRM de Skilled para mantener trazabilidad entre proveedor, material, cotización y orden de compra.</p></div></div><div style="padding:16px 28px;border-top:1px solid #e5edf6;background:#fbfdff;font-size:11px;color:#607189">Skilled Proyectos Industriales · Área de Compras</div></div></body></html>`
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(await (async()=>{
          const payload:any={ from: `${fromName} <${fromEmail}>`, to: [email], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }
          if (attachOrder && (orderPdfPath || orderPdfUrl)) {
            let pdfBytes:Uint8Array|null=null
            if (orderPdfPath) {
              const downloaded = await admin.storage.from('ordenes-compra').download(orderPdfPath)
              if (!downloaded.error && downloaded.data) pdfBytes = new Uint8Array(await downloaded.data.arrayBuffer())
            }
            if (!pdfBytes && orderPdfUrl) { const pdfResponse=await fetch(orderPdfUrl); if(pdfResponse.ok) pdfBytes=new Uint8Array(await pdfResponse.arrayBuffer()) }
            if (!pdfBytes || pdfBytes.length<500) throw new Error('No se pudo recuperar el PDF autorizado para adjuntarlo al correo.')
            payload.attachments=[{ filename:orderPdfName || `${orderNumber}.pdf`, content:bytesBase64(pdfBytes) }]
          }
          return payload
        })())
      })
      const responseBody: any = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = clean(responseBody?.message || responseBody?.error || `HTTP ${response.status}`, 900)
        await logCommunication(admin, { proveedor_id: providerId, solicitud_id: requestId || null, canal: 'email', modo: 'api', destinatario: email, asunto: subject, mensaje: message, estado: 'error', error: detail, creado_por: userData.user.id })
        if (requestId) await admin.from('co_solicitudes_proveedor').update({ error_correo: detail, updated_at: new Date().toISOString() }).eq('id', requestId)
        return json({ ok: false, error: `No se pudo enviar el correo: ${detail}` }, 502)
      }
      const sentAt = new Date().toISOString()
      const externalId = clean(responseBody?.id, 300)
      await logCommunication(admin, { proveedor_id: providerId, solicitud_id: requestId || null, canal: 'email', modo: 'api', destinatario: email, asunto: subject, mensaje: message, estado: 'enviado', proveedor_externo_id: externalId || null, enviado_at: sentAt, creado_por: userData.user.id })
      if (requestId) await admin.from('co_solicitudes_proveedor').update({ estado: 'enviada', fecha_envio: sentAt, fecha_envio_correo: sentAt, error_envio: null, error_correo: null, email_message_id: externalId || null, updated_at: sentAt }).eq('id', requestId)
      if (orderRows.length) await admin.from('solicitudes_compra').update({ orden_enviada_at:sentAt,orden_enviada_por:userData.user.id,orden_envio_canal:'email',orden_envio_destinatario:email,orden_envio_message_id:externalId||null,estado:'ordenada',estado_compras:'compra_realizada',fecha_compra:new Date().toISOString().slice(0,10),updated_at:sentAt }).in('id',orderRows.map((r:any)=>r.id))
      return json({ ok: true, canal: 'email', proveedor: providerName, destinatario: email, fechaEnvio: sentAt, messageId: externalId || null, pdfAdjunto:Boolean(attachOrder), mensaje: attachOrder ? 'Orden de compra enviada por correo con el PDF autorizado adjunto.' : 'Correo enviado desde el CRM.' })
    }

    if (whatsapp.length < 10) return json({ ok: false, error: 'El proveedor no tiene un número de WhatsApp válido.' }, 400)
    if (!whatsappAuto) return json({ ok: false, error: 'Compras tiene WhatsApp en modo manual. Cambia a Cloud API en Canales de Compras para enviar desde el CRM.' }, 503)
    if (!whatsappToken || !whatsappPhoneId || !whatsappTemplate) {
      return json({ ok: false, error: 'WhatsApp automático no está configurado. Define Phone Number ID/plantilla en Compras y CO_WHATSAPP_TOKEN (o WHATSAPP_TOKEN) en Supabase Secrets.' }, 503)
    }
    const apiBase = `https://graph.facebook.com/${encodeURIComponent(whatsappVersion)}/${encodeURIComponent(whatsappPhoneId)}`
    const whatsappMessage = orderNumber && orderPdfUrl && !message.includes(orderPdfUrl) ? `${message} ${orderPdfUrl}` : message
    const compactMessage = clean(whatsappMessage.replace(/\s+/g, ' '), 950)
    const payload = {
      messaging_product: 'whatsapp',
      to: whatsapp,
      type: 'template',
      template: {
        name: whatsappTemplate,
        language: { code: whatsappLanguage },
        components: [{ type: 'body', parameters: [
          { type: 'text', text: contactName || providerName },
          { type: 'text', text: clean(subject, 220) },
          { type: 'text', text: compactMessage }
        ] }]
      }
    }
    const response = await fetch(`${apiBase}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const responseBody: any = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = clean(responseBody?.error?.message || responseBody?.message || `HTTP ${response.status}`, 900)
      await logCommunication(admin, { proveedor_id: providerId, solicitud_id: requestId || null, canal: 'whatsapp', modo: 'api', destinatario: whatsapp, asunto: subject, mensaje: message, estado: 'error', error: detail, creado_por: userData.user.id })
      if (requestId) await admin.from('co_solicitudes_proveedor').update({ error_whatsapp: detail, updated_at: new Date().toISOString() }).eq('id', requestId)
      return json({ ok: false, error: `No se pudo enviar WhatsApp: ${detail}` }, 502)
    }
    const sentAt = new Date().toISOString()
    const externalId = clean(responseBody?.messages?.[0]?.id, 300)
    await logCommunication(admin, { proveedor_id: providerId, solicitud_id: requestId || null, canal: 'whatsapp', modo: 'api', destinatario: whatsapp, asunto: subject, mensaje: message, estado: 'enviado', proveedor_externo_id: externalId || null, enviado_at: sentAt, creado_por: userData.user.id })
    if (requestId) await admin.from('co_solicitudes_proveedor').update({ estado: 'enviada', fecha_envio: sentAt, fecha_envio_whatsapp: sentAt, error_envio: null, error_whatsapp: null, whatsapp_message_id: externalId || null, updated_at: sentAt }).eq('id', requestId)
    if (orderRows.length) await admin.from('solicitudes_compra').update({ orden_enviada_at:sentAt,orden_enviada_por:userData.user.id,orden_envio_canal:'whatsapp',orden_envio_destinatario:whatsapp,orden_envio_message_id:externalId||null,estado:'ordenada',estado_compras:'compra_realizada',fecha_compra:new Date().toISOString().slice(0,10),updated_at:sentAt }).in('id',orderRows.map((r:any)=>r.id))
    return json({ ok: true, canal: 'whatsapp', proveedor: providerName, destinatario: whatsapp, fechaEnvio: sentAt, messageId: externalId || null, mensaje: orderNumber ? 'Orden de compra enviada por WhatsApp con enlace al PDF autorizado.' : 'WhatsApp enviado desde el CRM.' })
  } catch (error) {
    console.error(error)
    return json({ ok: false, error: clean((error as Error)?.message || 'Error inesperado al contactar al proveedor.', 900) }, 500)
  }
})
