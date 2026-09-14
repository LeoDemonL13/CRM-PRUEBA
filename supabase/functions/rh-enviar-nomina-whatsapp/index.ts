import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
const clean = (v: unknown, n = 1000) => String(v ?? '').trim().slice(0, n)
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')
const envNamedJson = (name: string, key = 'default') => {
  try { const raw = Deno.env.get(name) || ''; const parsed = raw ? JSON.parse(raw) : {}; return clean(parsed?.[key] || '', 10000) } catch (_) { return '' }
}
const money = (v: unknown) => num(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
const dateLabel = (v: unknown) => {
  const s = clean(v, 20)
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : s
}
const fileSafe = (v: unknown) => clean(v, 100).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-')
const normalizePhone = (value: unknown, countryCode: string) => {
  let phone = digits(value)
  if (phone.startsWith('00')) phone = phone.slice(2)
  if (phone.length === 10 && countryCode) phone = countryCode + phone
  return phone
}

function localClock(timeZone: string) {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (type: string) => clean(parts.find(p => p.type === type)?.value, 8)
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
  return { date, weekday, hour: Number(get('hour') || 0), minute: Number(get('minute') || 0), iso: now.toISOString() }
}

function wrap(font: any, text: string, size: number, maxWidth: number) {
  const words = clean(text, 500).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test
    else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

async function buildPayrollPdf(detail: any, logoUrl: string) {
  const person = detail.rh_personal || {}
  const period = detail.rh_nomina_periodos || {}
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([841.89, 595.28])
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const blue = rgb(0 / 255, 65 / 255, 107 / 255)
  const red = rgb(234 / 255, 0, 41 / 255)
  const ink = rgb(25 / 255, 43 / 255, 60 / 255)
  const muted = rgb(91 / 255, 108 / 255, 126 / 255)
  const line = rgb(205 / 255, 216 / 255, 226 / 255)
  const soft = rgb(246 / 255, 249 / 255, 251 / 255)
  const white = rgb(1, 1, 1)
  const x = 40, w = 762
  page.drawRectangle({ x:0, y:0, width:842, height:596, color:white })
  let logoDrawn = false
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl)
      if (response.ok) {
        const bytes = new Uint8Array(await response.arrayBuffer())
        const type = (response.headers.get('content-type') || '').toLowerCase()
        const image = type.includes('jpeg') || type.includes('jpg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
        const scale = Math.min(150 / image.width, 49 / image.height)
        page.drawImage(image, { x:42, y:530, width:image.width*scale, height:image.height*scale })
        logoDrawn = true
      }
    } catch (_) {}
  }
  if (!logoDrawn) { page.drawText('SKILLED', { x:42, y:550, size:22, font:bold, color:blue }); page.drawText('PROYECTOS INDUSTRIALES',{x:43,y:536,size:7,font:bold,color:muted}) }
  page.drawText('INFORMATIVA DE PAGO', { x:573, y:554, size:20, font:bold, color:blue })
  page.drawText('RECURSOS HUMANOS · SKILLED PROYECTOS INDUSTRIALES', { x:523, y:537, size:7.5, font:normal, color:muted })
  page.drawLine({start:{x:40,y:516},end:{x:195,y:516},thickness:2,color:red})
  page.drawLine({start:{x:195,y:516},end:{x:802,y:516},thickness:.7,color:blue})
  const infoY=430, infoH=66
  page.drawRectangle({x,y:infoY,width:w,height:infoH,color:soft,borderColor:line,borderWidth:.8})
  const meta=[['NO. EMPLEADO',clean(person.numero_empleado||'—',24),102],['COLABORADOR',clean(`${person.nombre||''} ${person.apellidos||''}`,140).toUpperCase()||'—',290],['FECHA DE PAGO',dateLabel(period.fecha_pago),118],['PERIODO',`Sem ${period.semana_pago||'—'} · ${dateLabel(period.fecha_inicio)} - ${dateLabel(period.fecha_fin)}`,252]]
  let mx=x
  meta.forEach((m:any,i:number)=>{if(i)page.drawLine({start:{x:mx,y:infoY+10},end:{x:mx,y:infoY+infoH-10},thickness:.55,color:line});page.drawText(m[0],{x:mx+12,y:infoY+45,size:6.4,font:bold,color:muted});const value=wrap(i===1?bold:normal,m[1],i===1?9:8.2,m[2]-24).slice(0,2);value.forEach((v:string,j:number)=>page.drawText(v,{x:mx+12,y:infoY+25-j*11,size:i===1?9:8.2,font:i===1?bold:normal,color:ink}));mx+=m[2]})
  const rows:any[]=[['01','Sueldo / horas trabajadas',detail.horas_trabajadas?`${num(detail.horas_trabajadas).toFixed(2)} hrs.`:'1 semana',num(detail.salario_base),0],['02','INFONAVIT / FONACOT','',0,num(detail.infonavit_fonacot)],['03','Horas extra',`${num(detail.horas_extra).toFixed(2)} hrs.`,num(detail.importe_horas_extra),0],['04',`Viáticos${detail.viaticos_proyecto?` · ${clean(detail.viaticos_proyecto,80)}`:''}`,detail.viaticos_inicio?`${dateLabel(detail.viaticos_inicio)} - ${dateLabel(detail.viaticos_fin)}`:'',num(detail.viaticos),0],['05','Día festivo laborado','',num(detail.dia_festivo),0],['06','Adelanto Inbursa','',0,num(detail.adelanto_inbursa)],['07','Descuento préstamo personal','',0,num(detail.prestamo_personal)],['08','Ajuste de viáticos / otros','',Math.max(num(detail.ajuste_viaticos),0),Math.max(-num(detail.ajuste_viaticos),0)],['99','Otros / bonos / ajustes','',num(detail.otros_percepcion)+num(detail.bonos),num(detail.otros_deduccion)+num(detail.descuentos)]]
  const tableY=150, headH=29, rowH=23.5, totH=33, tcols=[54,312,119,112,112,53], tableH=headH+rows.length*rowH+totH
  page.drawRectangle({x,y:tableY,width:w,height:tableH,color:white,borderColor:line,borderWidth:.8})
  page.drawRectangle({x,y:tableY+tableH-headH,width:w,height:headH,color:blue})
  let tx=x;['CLAVE','CONCEPTO','CANT. / PERIODO','PERCEPCIÓN','DEDUCCIONES','NETO'].forEach((h,i)=>{page.drawText(h,{x:tx+9,y:tableY+tableH-18,size:6.8,font:bold,color:white});tx+=tcols[i]})
  rows.forEach((r,i)=>{const ry=tableY+tableH-headH-(i+1)*rowH;if(i%2===1)page.drawRectangle({x,y:ry,width:w,height:rowH,color:soft});page.drawLine({start:{x,y:ry},end:{x:x+w,y:ry},thickness:.4,color:line});page.drawText(r[0],{x:x+15,y:ry+8,size:7,font:bold,color:muted});page.drawText(wrap(normal,r[1],7.5,tcols[1]-16)[0],{x:x+tcols[0]+9,y:ry+8,size:7.5,font:normal,color:ink});page.drawText(wrap(normal,r[2],6.5,tcols[2]-15)[0],{x:x+tcols[0]+tcols[1]+8,y:ry+8,size:6.5,font:normal,color:muted});page.drawText(money(r[3]),{x:x+tcols[0]+tcols[1]+tcols[2]+8,y:ry+8,size:7.2,font:normal,color:ink});page.drawText(money(r[4]),{x:x+tcols[0]+tcols[1]+tcols[2]+tcols[3]+8,y:ry+8,size:7.2,font:normal,color:ink})})
  const perceptions=rows.reduce((s,r)=>s+num(r[3]),0), deductions=rows.reduce((s,r)=>s+num(r[4]),0), fy=tableY
  page.drawRectangle({x,y:fy,width:w,height:totH,color:rgb(236/255,242/255,247/255)})
  page.drawText('TOTALES',{x:x+245,y:fy+12,size:9,font:bold,color:blue})
  page.drawText(money(perceptions),{x:x+495,y:fy+12,size:9,font:bold,color:blue})
  page.drawText(money(deductions),{x:x+607,y:fy+12,size:9,font:bold,color:blue})
  page.drawText(money(detail.total_neto),{x:x+w-7,y:fy+12,size:10,font:bold,color:red})
  const summaryY=119
  if(clean(detail.observaciones,250))page.drawText(wrap(normal,`Observaciones: ${clean(detail.observaciones,250)}`,7,470)[0],{x,y:summaryY,size:7,font:normal,color:muted})
  page.drawRectangle({x:600,y:102,width:202,height:42,color:soft,borderColor:line,borderWidth:.6})
  page.drawText('NETO A PAGAR',{x:614,y:128,size:6.5,font:bold,color:muted})
  page.drawText(money(detail.total_neto),{x:788,y:112,size:14,font:bold,color:red})
  page.drawLine({start:{x,y:75},end:{x:x+w,y:75},thickness:.6,color:line})
  page.drawText('Documento informativo generado por el CRM de Skilled Proyectos Industriales.',{x,y:57,size:6.2,font:normal,color:muted})
  page.drawText(`RH · ${clean(period.nombre||`Semana ${period.semana_pago||''}`,80)}`,{x:690,y:57,size:6.2,font:bold,color:blue})
  return await pdf.save()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || envNamedJson('SUPABASE_PUBLISHABLE_KEYS')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || envNamedJson('SUPABASE_SECRET_KEYS')
  const whatsappToken = Deno.env.get('RH_WHATSAPP_TOKEN') || Deno.env.get('WHATSAPP_TOKEN') || ''
  const envPhoneNumberId = Deno.env.get('RH_WHATSAPP_PHONE_NUMBER_ID') || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
  const envWabaId = Deno.env.get('RH_WHATSAPP_BUSINESS_ACCOUNT_ID') || Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') || ''
  const graphVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v26.0'
  const envTemplate = Deno.env.get('WHATSAPP_NOMINA_TEMPLATE_NAME') || Deno.env.get('WHATSAPP_TEMPLATE_NAME') || ''
  const envLanguage = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') || ''
  const countryCode = digits(Deno.env.get('WHATSAPP_DEFAULT_COUNTRY_CODE') || '52')
  const resendKey = Deno.env.get('RH_RESEND_API_KEY') || Deno.env.get('RESEND_API_KEY') || ''
  const envFromEmail = Deno.env.get('RH_FROM_EMAIL') ?? ''
  const envFromName = Deno.env.get('RH_FROM_NAME') ?? ''
  const envReplyTo = Deno.env.get('RH_REPLY_TO') ?? ''
  const cronSharedSecret = Deno.env.get('CRON_SHARED_SECRET') || ''
  const logoUrl = Deno.env.get('SKILLED_LOGO_URL') || 'https://crm-prueba-cnf.pages.dev/logo-reporte.png?v=78'
  const authorization = req.headers.get('Authorization') ?? ''
  const bearer = authorization.replace(/^Bearer\s+/i, '').trim()
  const apiKeyHeader = req.headers.get('apikey') || ''
  const requestCronSecret = req.headers.get('x-cron-secret') || ''

  if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: 'Falta configuración de Supabase en la función.' }, 500)

  try {
    const body = await req.json().catch(() => ({}))
    const mode = clean(body?.mode || (body?.ping ? 'ping' : 'single'), 20).toLowerCase()
    const admin = createClient(supabaseUrl, serviceKey)
    const isCron = Boolean(cronSharedSecret && requestCronSecret === cronSharedSecret)
    let userId: string | null = null

    if (!isCron) {
      if (!authorization) return json({ ok: false, error: 'Sesión no válida.' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
      const { data: userData, error: userError } = await userClient.auth.getUser()
      if (userError || !userData.user) return json({ ok: false, error: 'Sesión no válida.' }, 401)
      userId = userData.user.id
      const { data: profile } = await admin.from('perfiles_usuario').select('rol,activo').eq('id', userId).maybeSingle()
      if (!profile?.activo || !['administrador', 'rh'].includes(String(profile.rol || '').toLowerCase())) return json({ ok: false, error: 'Tu perfil no puede enviar nómina.' }, 403)
    }

    const { data: configRow } = await admin.from('rh_nomina_configuracion').select('*').eq('id', 1).maybeSingle()
    const config: any = configRow || {}
    const phoneNumberId = clean(config.whatsapp_phone_number_id || envPhoneNumberId, 160)
    const wabaId = clean(config.whatsapp_business_account_id || envWabaId, 160)
    const templateName = clean(envTemplate || config.template_name || 'nomina_informativa_pago', 120)
    const templateLanguage = clean(envLanguage || config.template_language || 'es_MX', 20)
    const emailFrom = clean(config.email_remitente || envFromEmail, 320)
    const emailName = clean(config.email_nombre || envFromName || 'Recursos Humanos · Skilled', 160)
    const emailReplyTo = clean(config.email_reply_to || envReplyTo, 320)
    const whatsappReady = Boolean(whatsappToken && phoneNumberId && templateName)
    const emailReady = Boolean(resendKey && emailFrom)
    const requestedChannel = clean(body?.channel || body?.canal || 'configured', 30).toLowerCase()

    if (mode === 'ping') {
      let metaPhone: any = null
      let metaPhoneError = ''
      let templateCheck: any = null
      let templateError = ''
      if (whatsappToken && phoneNumberId) {
        try {
          const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${whatsappToken}` } })
          const payload: any = await response.json().catch(() => ({}))
          if (response.ok) metaPhone = { display_phone_number: clean(payload?.display_phone_number, 60), verified_name: clean(payload?.verified_name, 120) }
          else metaPhoneError = clean(payload?.error?.message || 'Meta no aceptó el token o el Phone Number ID.', 500)
        } catch (error) { metaPhoneError = clean((error as Error)?.message || error, 500) }
      }
      if (wabaId && whatsappToken && templateName) {
        try {
          const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(wabaId)}/message_templates?name=${encodeURIComponent(templateName)}&fields=name,status,language,category,components&limit=20`, { headers: { Authorization: `Bearer ${whatsappToken}` } })
          const payload: any = await response.json().catch(() => ({}))
          if (response.ok) {
            const list = Array.isArray(payload?.data) ? payload.data : []
            const found = list.find((item: any) => clean(item?.language, 20).toLowerCase() === templateLanguage.toLowerCase()) || list[0]
            if (found) {
              const components = Array.isArray(found.components) ? found.components : []
              templateCheck = { name: clean(found.name, 120), status: clean(found.status, 40), language: clean(found.language, 20), category: clean(found.category, 40), document_header: components.some((component: any) => clean(component?.type, 30).toUpperCase() === 'HEADER' && clean(component?.format, 30).toUpperCase() === 'DOCUMENT') }
            } else templateError = `No se encontró la plantilla ${templateName} en la cuenta de WhatsApp.`
          } else templateError = clean(payload?.error?.message || 'No se pudo revisar la plantilla de WhatsApp.', 500)
        } catch (error) { templateError = clean((error as Error)?.message || error, 500) }
      }
      let logoReady = false
      let logoError = ''
      if (logoUrl) {
        try { const response = await fetch(logoUrl, { method: 'GET' }); logoReady = response.ok && String(response.headers.get('content-type') || '').toLowerCase().startsWith('image/'); if (!logoReady) logoError = `El logo respondió HTTP ${response.status}.` } catch (error) { logoError = clean((error as Error)?.message || error, 500) }
      }
      const templateReady = wabaId ? Boolean(templateCheck && templateCheck.status.toUpperCase() === 'APPROVED' && templateCheck.document_header) : null
      return json({
        ok: true,
        configured: (config.enviar_whatsapp !== false ? whatsappReady : true) && (config.enviar_email === true ? emailReady : true),
        version: '75',
        graph_version: graphVersion,
        template_name: templateName,
        template_language: templateLanguage,
        whatsapp: { configured: whatsappReady && templateReady !== false, sender: clean(config.whatsapp_numero_remitente || metaPhone?.display_phone_number, 80), meta_phone: metaPhone, meta_phone_error: metaPhoneError, template_check: templateCheck, template_error: templateError, missing: [!whatsappToken && 'RH_WHATSAPP_TOKEN / WHATSAPP_TOKEN', !phoneNumberId && 'Phone Number ID de RH', !templateName && 'WHATSAPP_NOMINA_TEMPLATE_NAME'].filter(Boolean) },
        email: { configured: emailReady, from: emailFrom, name: emailName, reply_to: emailReplyTo, missing: [!resendKey && 'RH_RESEND_API_KEY / RESEND_API_KEY', !emailFrom && 'RH_FROM_EMAIL / correo remitente'].filter(Boolean) },
        automatic_enabled: config.envio_automatico === true,
        channels: { whatsapp: config.enviar_whatsapp !== false, email: config.enviar_email === true },
        schedule: { day: Number(config.dia_envio || 4), time: clean(config.hora_envio || '21:00', 8), timezone: clean(config.zona_horaria || 'America/Mexico_City', 80) },
        cron_secret_configured: Boolean(cronSharedSecret),
        logo_url: logoUrl,
        logo_ready: logoReady,
        logo_error: logoError
      })
    }

    async function loadDetail(detailId: number) {
      const { data, error } = await admin.from('rh_nomina_detalles')
        .select('id,periodo_id,salario_base,bonos,descuentos,total_neto,horas_trabajadas,horas_extra,importe_horas_extra,infonavit_fonacot,viaticos,viaticos_inicio,viaticos_fin,viaticos_proyecto,dia_festivo,adelanto_inbursa,prestamo_personal,ajuste_viaticos,otros_percepcion,otros_deduccion,observaciones,estado,rh_nomina_periodos!inner(id,nombre,fecha_inicio,fecha_fin,fecha_pago,semana_pago,estado),rh_personal!inner(id,numero_empleado,nombre,apellidos,puesto,departamento,telefono,telefono_whatsapp,whatsapp_nomina,correo,correo_corporativo,correo_nomina)')
        .eq('id', detailId).single()
      if (error || !data) throw new Error('No se encontró el comprobante de nómina.')
      return data as any
    }

    async function alreadySent(detailId: number, channel: string) {
      const { data } = await admin.from('rh_nomina_envios').select('id').eq('detalle_id', detailId).eq('canal', channel).eq('estado', 'enviado').limit(1)
      return Boolean(data?.length)
    }

    function base64(bytes: Uint8Array) {
      let binary = ''
      const step = 0x8000
      for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)))
      return btoa(binary)
    }

    async function sendWhatsAppDetail(detail: any, force = false) {
      const person = detail.rh_personal || {}
      const period = detail.rh_nomina_periodos || {}
      if (!person.whatsapp_nomina) return { ok: false, skipped: true, channel: 'whatsapp', reason: 'WhatsApp no habilitado', detail_id: detail.id }
      if (!whatsappReady) throw new Error('WhatsApp automático no está configurado.')
      const telefono = normalizePhone(person.telefono_whatsapp || person.telefono, countryCode)
      if (telefono.length < 11) return { ok: false, skipped: true, channel: 'whatsapp', reason: 'Número de WhatsApp no válido', detail_id: detail.id }
      if (!force && await alreadySent(Number(detail.id), 'whatsapp')) return { ok: true, skipped: true, channel: 'whatsapp', reason: 'Ya enviado', detail_id: detail.id, telefono }
      const pdfBytes = await buildPayrollPdf(detail, logoUrl)
      const filename = `Nomina-${fileSafe(person.numero_empleado || detail.id)}-${clean(period.fecha_fin, 10)}.pdf`
      const apiBase = `https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(phoneNumberId)}`
      const authHeaders = { Authorization: `Bearer ${whatsappToken}` }
      const mediaForm = new FormData()
      mediaForm.append('messaging_product', 'whatsapp')
      mediaForm.append('type', 'application/pdf')
      mediaForm.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), filename)
      const mediaResponse = await fetch(`${apiBase}/media`, { method: 'POST', headers: authHeaders, body: mediaForm })
      const mediaData: any = await mediaResponse.json().catch(() => ({}))
      if (!mediaResponse.ok || !mediaData?.id) throw new Error(clean(mediaData?.error?.message || 'No se pudo cargar el PDF en WhatsApp.', 800))
      const fullName = clean(`${person.nombre || ''} ${person.apellidos || ''}`, 120) || clean(person.numero_empleado, 80)
      const templatePayload = { messaging_product: 'whatsapp', to: telefono, type: 'template', template: { name: templateName, language: { code: templateLanguage }, components: [{ type: 'header', parameters: [{ type: 'document', document: { id: mediaData.id, filename } }] }, { type: 'body', parameters: [{ type: 'text', text: fullName }, { type: 'text', text: clean(period.nombre || `Sem ${period.semana_pago || ''}`, 120) }, { type: 'text', text: money(detail.total_neto) }] }] } }
      const messageResponse = await fetch(`${apiBase}/messages`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(templatePayload) })
      const messageData: any = await messageResponse.json().catch(() => ({}))
      if (!messageResponse.ok) throw new Error(clean(messageData?.error?.message || 'Meta rechazó el envío de la nómina.', 800))
      const providerId = clean(messageData?.messages?.[0]?.id, 200)
      await admin.from('rh_nomina_envios').insert({ detalle_id: detail.id, telefono, canal: 'whatsapp', estado: 'enviado', proveedor_id: providerId || null, enviado_at: new Date().toISOString(), creado_por: userId })
      return { ok: true, channel: 'whatsapp', detail_id: detail.id, telefono, message_id: providerId, filename }
    }

    async function sendEmailDetail(detail: any, force = false) {
      const person = detail.rh_personal || {}
      const period = detail.rh_nomina_periodos || {}
      if (!person.correo_nomina) return { ok: false, skipped: true, channel: 'email', reason: 'Correo no habilitado', detail_id: detail.id }
      if (!emailReady) throw new Error('El correo automático de RH no está configurado.')
      const recipient = clean(person.correo_corporativo || person.correo, 320)
      if (!recipient) return { ok: false, skipped: true, channel: 'email', reason: 'Correo no registrado', detail_id: detail.id }
      if (!force && await alreadySent(Number(detail.id), 'email')) return { ok: true, skipped: true, channel: 'email', reason: 'Ya enviado', detail_id: detail.id, email: recipient }
      const pdfBytes = await buildPayrollPdf(detail, logoUrl)
      const filename = `Nomina-${fileSafe(person.numero_empleado || detail.id)}-${clean(period.fecha_fin, 10)}.pdf`
      const fullName = clean(`${person.nombre || ''} ${person.apellidos || ''}`, 120) || clean(person.numero_empleado, 80)
      const subject = `Informativa de pago · ${clean(period.nombre || `Semana ${period.semana_pago || ''}`, 150)}`
      const html = `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#182235"><div style="max-width:720px;margin:24px auto;background:#fff;border:1px solid #dfe6ef;border-radius:14px;overflow:hidden"><div style="padding:22px 26px;background:#07111f;color:#fff"><strong>${emailName}</strong><div style="font-size:12px;opacity:.72;margin-top:4px">Skilled Proyectos Industriales</div></div><div style="padding:26px;font-size:14px;line-height:1.65"><p>Hola ${fullName},</p><p>Te compartimos tu informativa de pago correspondiente a <strong>${clean(period.nombre || '', 180)}</strong>.</p><p>Neto a pagar: <strong>${money(detail.total_neto)}</strong>.</p><p>El comprobante PDF se encuentra adjunto.</p></div></div></body></html>`
      const payload: any = { from: `${emailName} <${emailFrom}>`, to: [recipient], subject, html, attachments: [{ filename, content: base64(pdfBytes) }] }
      if (emailReplyTo) payload.reply_to = emailReplyTo
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const responseData: any = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(clean(responseData?.message || responseData?.error || `HTTP ${response.status}`, 800))
      const providerId = clean(responseData?.id, 200)
      await admin.from('rh_nomina_envios').insert({ detalle_id: detail.id, telefono: recipient, canal: 'email', estado: 'enviado', proveedor_id: providerId || null, enviado_at: new Date().toISOString(), creado_por: userId })
      return { ok: true, channel: 'email', detail_id: detail.id, email: recipient, message_id: providerId, filename }
    }

    async function sendDetail(detail: any, force = false, channel = 'configured') {
      const channels: string[] = []
      if (channel === 'whatsapp' || channel === 'email') channels.push(channel)
      else {
        if (config.enviar_whatsapp !== false && config.whatsapp_modo === 'cloud_api') channels.push('whatsapp')
        if (config.enviar_email === true && config.email_modo === 'resend') channels.push('email')
      }
      if (!channels.length) return { ok: false, skipped: true, reason: 'No hay canales automáticos habilitados', detail_id: detail.id, results: [] }
      const results: any[] = []
      for (const current of channels) {
        try { results.push(current === 'email' ? await sendEmailDetail(detail, force) : await sendWhatsAppDetail(detail, force)) }
        catch (error) { results.push({ ok: false, channel: current, detail_id: detail.id, error: clean((error as Error)?.message || error, 800) }) }
      }
      const errors = results.filter(r => !r.ok && !r.skipped).length
      const sent = results.filter(r => r.ok && !r.skipped).length
      const skipped = results.filter(r => r.skipped).length
      return { ok: errors === 0, detail_id: detail.id, sent, errors, skipped, results }
    }

    async function sendPeriod(periodId: number, force = false, channel = 'configured') {
      const { data: period, error: periodError } = await admin.from('rh_nomina_periodos').select('*').eq('id', periodId).single()
      if (periodError || !period) throw new Error('No se encontró el periodo de nómina.')
      if (config.solo_revisada === true && !['revisada', 'cerrada'].includes(String(period.estado || '').toLowerCase())) return { ok: true, skipped: true, reason: 'El periodo requiere revisión', period_id: periodId, sent: 0, errors: 0, skipped_count: 0 }
      const { data: ids, error: idsError } = await admin.from('rh_nomina_detalles').select('id').eq('periodo_id', periodId).neq('estado', 'cancelado').order('id')
      if (idsError) throw idsError
      const detailIds = (ids || []).map(row => Number(row.id)).filter(Boolean)
      const results: any[] = []
      for (let i = 0; i < detailIds.length; i += 4) {
        const batch = detailIds.slice(i, i + 4)
        const batchResults = await Promise.all(batch.map(async detailId => {
          try { return await sendDetail(await loadDetail(detailId), force, channel) }
          catch (error) { return { ok: false, detail_id: detailId, error: clean((error as Error)?.message || error, 800) } }
        }))
        results.push(...batchResults)
      }
      const sent = results.reduce((sum, r) => sum + Number(r.sent || 0), 0)
      const errors = results.reduce((sum, r) => sum + Number(r.errors || (!r.ok && !r.skipped ? 1 : 0)), 0)
      const skippedCount = results.reduce((sum, r) => sum + Number(r.skipped || (r.skipped ? 1 : 0)), 0)
      return { ok: errors === 0, period_id: periodId, sent, errors, skipped_count: skippedCount, results }
    }

    if (mode === 'single') {
      const detailId = Number(body?.detalle_id || 0)
      if (!detailId) return json({ ok: false, error: 'Falta el detalle de nómina.' }, 400)
      const result = await sendDetail(await loadDetail(detailId), true, requestedChannel)
      return json(result, result.errors ? 207 : 200)
    }

    if (mode === 'period') {
      const periodId = Number(body?.periodo_id || 0)
      if (!periodId) return json({ ok: false, error: 'Falta el periodo de nómina.' }, 400)
      const result = await sendPeriod(periodId, body?.force === true, requestedChannel)
      return json(result, result.errors ? 207 : 200)
    }

    if (mode === 'auto') {
      if (!isCron) return json({ ok: false, error: 'La ejecución automática requiere autenticación del programador.' }, 403)
      if (config.envio_automatico !== true) return json({ ok: true, skipped: true, reason: 'Envío automático desactivado.' })
      const zone = clean(config.zona_horaria || 'America/Mexico_City', 80)
      const clock = localClock(zone)
      const sendDay = Number(config.dia_envio || 4)
      const [sendHour] = clean(config.hora_envio || '21:00', 8).split(':').map(Number)
      if (clock.weekday !== sendDay || clock.hour < sendHour) return json({ ok: true, skipped: true, reason: 'Fuera del horario configurado.', clock, schedule: { day: sendDay, hour: sendHour, timezone: zone } })
      if (clean(config.ultimo_envio_local, 10) === clock.date) return json({ ok: true, skipped: true, reason: 'La nómina de hoy ya fue procesada.', date: clock.date, previous: config.ultimo_resultado || {} })
      await admin.from('rh_nomina_configuracion').update({ ultimo_intento_at: clock.iso, updated_at: clock.iso }).eq('id', 1)
      let periodId = 0
      if (config.generar_automatico !== false) {
        const { data, error } = await admin.rpc('crm_generar_nomina_semana_caida', { p_fecha_referencia: clock.date })
        if (error) throw error
        periodId = Number(data || 0)
      }
      if (!periodId) {
        const end = new Date(`${clock.date}T12:00:00Z`)
        const day = end.getUTCDay() || 7
        end.setUTCDate(end.getUTCDate() - (day - 1))
        const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6)
        const startIso = start.toISOString().slice(0, 10), endIso = end.toISOString().slice(0, 10)
        const { data: period } = await admin.from('rh_nomina_periodos').select('id').eq('fecha_inicio', startIso).eq('fecha_fin', endIso).neq('estado', 'cancelada').order('id', { ascending: false }).limit(1).maybeSingle()
        periodId = Number(period?.id || 0)
      }
      if (!periodId) throw new Error('No existe un periodo listo para el envío automático.')
      const { count: reviewCount, error: reviewError } = await admin.from('rh_nomina_detalles').select('id', { count: 'exact', head: true }).eq('periodo_id', periodId).eq('requiere_revision', true)
      if (reviewError) throw reviewError
      if (Number(reviewCount || 0) > 0) {
        const hold = { ok: true, skipped: true, reason: 'Hay colaboradores que requieren revisión antes de enviar informativas.', period_id: periodId, requiere_revision: Number(reviewCount || 0) }
        await admin.from('rh_nomina_configuracion').update({ ultimo_intento_at: clock.iso, ultimo_resultado: hold, updated_at: clock.iso }).eq('id', 1)
        return json({ ...hold, automatic: true, local_date: clock.date })
      }
      const result = await sendPeriod(periodId, false, 'configured')
      const updateResult: any = { ultimo_intento_at: clock.iso, ultimo_resultado: result, updated_at: clock.iso }
      if (Number(result.errors || 0) === 0) updateResult.ultimo_envio_local = clock.date
      await admin.from('rh_nomina_configuracion').update(updateResult).eq('id', 1)
      return json({ ...result, automatic: true, local_date: clock.date, completed_for_day: Number(result.errors || 0) === 0 })
    }

    return json({ ok: false, error: 'Modo de operación no válido.' }, 400)
  } catch (error) {
    console.error(error)
    return json({ ok: false, error: clean((error as Error)?.message || 'Error inesperado al procesar la nómina.', 800) }, 500)
  }
})
