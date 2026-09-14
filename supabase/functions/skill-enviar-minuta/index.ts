import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } })
}

function clean(value: unknown, max = 5000) {
  return String(value ?? '').trim().slice(0, max)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const authHeader = req.headers.get('Authorization') || ''
    if (!supabaseUrl || !anonKey || !authHeader) return json({ error: 'No se pudo validar la sesión.' }, 401)

    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError || !userData?.user) return json({ error: 'Sesión no válida.' }, 401)

    const body = await req.json().catch(() => ({}))
    const to = Array.isArray(body?.to) ? body.to.map((v: unknown) => clean(v, 320)).filter(Boolean).slice(0, 8) : []
    if (!to.length || to.some((mail: string) => !/^\S+@\S+\.\S+$/.test(mail))) return json({ error: 'Revisa los correos destinatarios.' }, 400)

    const resendKey = Deno.env.get('RESEND_API_KEY') || ''
    const fromEmail = clean(Deno.env.get('SKILL_MEETING_FROM_EMAIL') || Deno.env.get('CO_FROM_EMAIL') || '', 320)
    const fromName = clean(Deno.env.get('SKILL_MEETING_FROM_NAME') || 'SKILL Reuniones · Skilled', 160)
    if (!resendKey || !fromEmail) return json({ error: 'Configura RESEND_API_KEY y SKILL_MEETING_FROM_EMAIL en Supabase Secrets.' }, 503)

    const subject = clean(body?.subject || 'Minuta de reunión · SKILL', 300)
    const title = clean(body?.title || 'Reunión de trabajo', 300)
    const summary = clean(body?.summary || '', 12000)
    const rawAttachments = Array.isArray(body?.attachments) ? body.attachments.slice(0, 3) : []
    const attachments = rawAttachments.map((item: any) => ({
      filename: clean(item?.filename, 180),
      content: clean(item?.content, 8_000_000),
    })).filter((item: any) => item.filename && item.content)

    const html = `
      <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.55">
        <div style="border-top:5px solid #00416B;padding-top:18px">
          <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#00416B">SKILLED PROYECTOS INDUSTRIALES</div>
          <h1 style="margin:8px 0 4px;font-size:22px;color:#0f172a">${title.replace(/[<>&]/g, '')}</h1>
          <p style="margin:0 0 18px;color:#64748b">Minuta generada por SKILL Reuniones.</p>
        </div>
        <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px">${summary.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
        <p style="font-size:12px;color:#64748b">Se adjuntan las versiones Word y PDF de la minuta. El audio y las firmas acústicas de los hablantes no se almacenan.</p>
      </div>`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to, subject, html, attachments }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) return json({ error: `No se pudo enviar el correo: ${clean(result?.message || result?.error || response.statusText, 1200)}` }, 502)

    return json({ ok: true, id: result?.id || null, to })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo enviar la minuta.' }, 500)
  }
})
