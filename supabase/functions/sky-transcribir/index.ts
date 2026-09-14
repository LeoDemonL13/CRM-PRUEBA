import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
})

const clean = (value: unknown, max = 1800) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const envNamedJson = (name: string, key = 'default') => { try { const raw = Deno.env.get(name) || ''; const parsed = raw ? JSON.parse(raw) : {}; return clean(parsed?.[key] || '', 10000) } catch (_) { return '' } }
const boolEnv = (name: string) => /^(1|true|yes|si|sí)$/i.test(clean(Deno.env.get(name), 20))

const parseJsonObject = (value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  const source = clean(value, 7000)
  if (!source) return null
  try { return JSON.parse(source) } catch (_) {}
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(source.slice(start, end + 1)) } catch (_) {}
  }
  return null
}

type AiResult = { provider: string; model: string; text: string; status: number; retryAfter: number }
type AiCall = { system: string; user: string; jsonMode?: boolean; maxTokens?: number; providers?: string[]; speed?: 'fast' | 'strong' }

const withTimeout = async (url: string, init: RequestInit, timeoutMs = 14000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...init, signal: controller.signal }) } finally { clearTimeout(timer) }
}

const historyText = (turns: unknown) => {
  if (!Array.isArray(turns)) return ''
  return turns.slice(-8).map((turn: any, index: number) => {
    const user = clean(turn?.user, 420)
    const assistant = clean(turn?.assistant, 520)
    return [user ? `Usuario ${index + 1}: ${user}` : '', assistant ? `Skill ${index + 1}: ${assistant}` : ''].filter(Boolean).join('\n')
  }).filter(Boolean).join('\n')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || envNamedJson('SUPABASE_PUBLISHABLE_KEYS')
  const groqKey = Deno.env.get('GROQ_API_KEY') ?? ''
  const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY') ?? ''
  const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
  const groqVoiceModel = Deno.env.get('SKY_GROQ_TRANSCRIBE_MODEL') ?? 'whisper-large-v3-turbo'
  const groqIntentModel = Deno.env.get('SKY_GROQ_INTENT_MODEL') ?? 'openai/gpt-oss-20b'
  const groqChatFastModel = Deno.env.get('SKY_GROQ_CHAT_FAST_MODEL') ?? 'openai/gpt-oss-20b'
  const groqChatModel = Deno.env.get('SKY_GROQ_CHAT_MODEL') ?? 'openai/gpt-oss-120b'
  const geminiIntentModel = Deno.env.get('SKY_GEMINI_INTENT_MODEL') ?? 'gemini-3.5-flash-lite'
  const geminiChatFastModel = Deno.env.get('SKY_GEMINI_CHAT_FAST_MODEL') ?? 'gemini-3.5-flash-lite'
  const geminiChatModel = Deno.env.get('SKY_GEMINI_CHAT_MODEL') ?? 'gemini-3.6-flash'
  const openrouterModel = Deno.env.get('SKY_OPENROUTER_MODEL') ?? 'openrouter/free'
  const openaiModel = Deno.env.get('SKY_OPENAI_TRANSCRIBE_MODEL') ?? Deno.env.get('SKY_TRANSCRIBE_MODEL') ?? 'gpt-4o-mini-transcribe'
  const order = clean(Deno.env.get('SKY_AI_PROVIDER_ORDER') || 'groq,gemini,openrouter', 100).split(',').map(value => clean(value, 30).toLowerCase()).filter(Boolean)
  const allowFreeWithInternal = boolEnv('SKY_ALLOW_FREE_FALLBACK_WITH_INTERNAL_DATA')
  const authorization = req.headers.get('Authorization') ?? ''

  const providerConfigured = (name: string) => name === 'groq' ? Boolean(groqKey) : name === 'gemini' ? Boolean(geminiKey) : name === 'openrouter' ? Boolean(openrouterKey) : false
  const configuredProviders = order.filter((value, index) => ['groq','gemini','openrouter'].includes(value) && order.indexOf(value) === index && providerConfigured(value))

  const callGroq = async (call: AiCall, model: string): Promise<AiResult> => {
    if (!groqKey) throw new Error('Groq no está configurado.')
    const response = await withTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_completion_tokens: call.maxTokens ?? 1000,
        ...(call.jsonMode ? { temperature: 0, response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: call.system }, { role: 'user', content: call.user }]
      })
    }, call.jsonMode ? 9000 : 16000)
    const payload = await response.json().catch(() => ({}))
    const retryAfter = Number(response.headers.get('retry-after') ?? '0') || 0
    if (!response.ok) throw Object.assign(new Error(clean(payload?.error?.message || payload?.message || `HTTP ${response.status}`, 500)), { status: response.status, retryAfter })
    const text = clean(payload?.choices?.[0]?.message?.content, 9000)
    if (!text) throw Object.assign(new Error('Groq no devolvió contenido.'), { status: 502, retryAfter })
    return { provider: 'groq', model: clean(payload?.model || model, 120), text, status: response.status, retryAfter }
  }

  const callGemini = async (call: AiCall, model: string): Promise<AiResult> => {
    if (!geminiKey) throw new Error('Gemini no está configurado.')
    const response = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: call.system }] },
        contents: [{ role: 'user', parts: [{ text: call.user }] }],
        generationConfig: {
          maxOutputTokens: call.maxTokens ?? 1000,
          ...(call.jsonMode ? { responseMimeType: 'application/json' } : {})
        }
      })
    }, call.jsonMode ? 10000 : 18000)
    const payload = await response.json().catch(() => ({}))
    const retryAfter = Number(response.headers.get('retry-after') ?? '0') || 0
    if (!response.ok) throw Object.assign(new Error(clean(payload?.error?.message || payload?.message || `HTTP ${response.status}`, 500)), { status: response.status, retryAfter })
    const parts = payload?.candidates?.[0]?.content?.parts
    const text = clean(Array.isArray(parts) ? parts.map((part: any) => part?.text || '').join('\n') : '', 9000)
    if (!text) throw Object.assign(new Error('Gemini no devolvió contenido.'), { status: 502, retryAfter })
    return { provider: 'gemini', model, text, status: response.status, retryAfter }
  }

  const callOpenRouter = async (call: AiCall, model: string): Promise<AiResult> => {
    if (!openrouterKey) throw new Error('OpenRouter no está configurado.')
    const response = await withTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json', 'X-Title': 'Skilled CRM Skill' },
      body: JSON.stringify({
        model,
        max_tokens: call.maxTokens ?? 1000,
        ...(call.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: call.system }, { role: 'user', content: call.user }]
      })
    }, call.jsonMode ? 12000 : 20000)
    const payload = await response.json().catch(() => ({}))
    const retryAfter = Number(response.headers.get('retry-after') ?? '0') || 0
    if (!response.ok) throw Object.assign(new Error(clean(payload?.error?.message || payload?.message || `HTTP ${response.status}`, 500)), { status: response.status, retryAfter })
    const text = clean(payload?.choices?.[0]?.message?.content, 9000)
    if (!text) throw Object.assign(new Error('OpenRouter no devolvió contenido.'), { status: 502, retryAfter })
    return { provider: 'openrouter', model: clean(payload?.model || model, 160), text, status: response.status, retryAfter }
  }

  const callAi = async (call: AiCall, purpose: 'intent' | 'chat') => {
    const requested = (call.providers?.length ? call.providers : configuredProviders).filter(providerConfigured)
    const errors: Array<{ provider: string; status: number; message: string; retryAfter: number }> = []
    for (const provider of requested) {
      try {
        if (provider === 'groq') return await callGroq(call, purpose === 'intent' ? groqIntentModel : call.speed === 'fast' ? groqChatFastModel : groqChatModel)
        if (provider === 'gemini') return await callGemini(call, purpose === 'intent' ? geminiIntentModel : call.speed === 'fast' ? geminiChatFastModel : geminiChatModel)
        if (provider === 'openrouter') return await callOpenRouter(call, openrouterModel)
      } catch (error: any) {
        errors.push({ provider, status: Number(error?.status) || 0, message: clean(error?.message, 280), retryAfter: Number(error?.retryAfter) || 0 })
      }
    }
    const maxRetry = errors.reduce((max, item) => Math.max(max, item.retryAfter), 0)
    const detail = errors.map(item => `${item.provider}: ${item.message}`).join(' | ')
    throw Object.assign(new Error(detail || 'No hay un proveedor de IA disponible.'), { providers: errors, retryAfter: maxRetry })
  }

  if (!url || !anonKey) return json({ error: 'La función no tiene configuradas las credenciales de Supabase.' }, 500)
  if (!authorization) return json({ error: 'Sesión no válida.' }, 401)

  try {
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Sesión no válida.' }, 401)
    const { data: profileData, error: profileError } = await userClient.from('perfiles_usuario').select('rol,activo').eq('id', userData.user.id).maybeSingle()
    if (profileError || !profileData || profileData.activo === false) return json({ error: 'Perfil no autorizado para Skill.' }, 403)
    const role = clean(profileData.rol, 80).toLowerCase()
    const allowedRoles = ['administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta']
    if (!allowedRoles.includes(role)) return json({ error: 'Skill no está habilitado para este perfil.' }, 403)

    const type = req.headers.get('content-type') ?? ''
    const voiceProvider = groqKey ? 'groq' : openaiKey ? 'openai' : ''
    const voiceModel = voiceProvider === 'groq' ? groqVoiceModel : openaiModel

    if (type.includes('application/json')) {
      const body = await req.json().catch(() => ({}))
      if (body?.ping === true) {
        return json({
          ok: true,
          configured: Boolean(voiceProvider),
          intelligenceConfigured: configuredProviders.length > 0,
          version: '136.0',
          provider: voiceProvider,
          model: voiceModel,
          intelligenceProvider: configuredProviders[0] || '',
          intelligenceModel: configuredProviders[0] === 'groq' ? `${groqChatFastModel} / ${groqChatModel}` : configuredProviders[0] === 'gemini' ? `${geminiChatFastModel} / ${geminiChatModel}` : configuredProviders[0] === 'openrouter' ? openrouterModel : '',
          intelligenceProviders: configuredProviders,
          internalFallbackRestricted: !allowFreeWithInternal,
          message: configuredProviders.length ? `Skill IA está lista con ${configuredProviders.join(' → ')}.` : voiceProvider ? 'Skill Voz está disponible; configura GROQ_API_KEY para inteligencia conectada al CRM.' : 'Configura GROQ_API_KEY para voz e inteligencia de Skill.'
        })
      }

      if (body?.mode === 'interpret' || body?.intent === true) {
        if (!groqKey && !allowFreeWithInternal) return json({ error: 'La interpretación del CRM requiere GROQ_API_KEY. Los proveedores gratuitos alternos quedan reservados para conversación general por privacidad.' }, 503)
        const userText = clean(body?.text, 1800)
        const profile = role
        const previousIntent = clean(body?.context?.lastIntent, 80)
        const previousEntity = clean(body?.context?.lastEntity, 240)
        const previousQuery = clean(body?.context?.lastQuery, 500)
        const previousArea = clean(body?.context?.area, 120)
        const history = historyText(body?.context?.turns)
        if (!userText) return json({ error: 'Falta la consulta a interpretar.' }, 400)
        const allowed = ['material_family','material_stock','material_location','low_stock','purchase_order','tools','vehicles','project','supplier','quotation','store','service','rh_people','rh_documents','rh_incidents','rh_assets','finance','executive','categories','global_search','chat_message','meeting','reception','help','unknown']
        const system = [
          'Eres el intérprete de intención de Skill para el CRM de Skilled Proyectos Industriales.',
          'Convierte lenguaje natural, abreviaciones, modismos, frases largas y solicitudes con rodeos en un plan JSON compacto. No contestes la pregunta ni inventes datos.',
          `Perfil actual: ${profile}.`,
          previousIntent || previousEntity || previousQuery || previousArea ? `Contexto inmediato: intent=${previousIntent || '—'}; entity=${previousEntity || '—'}; area=${previousArea || '—'}; query=${previousQuery || '—'}.` : 'No hay contexto inmediato.',
          history ? `Últimos turnos:\n${history}` : '',
          `Intenciones permitidas: ${allowed.join(', ')}.`,
          'Devuelve exactamente JSON con intent, query, entity, confidence, locationOnly, recipient, message y clarification.',
          'Antes de clasificar, identifica qué resultado concreto espera el usuario. Ignora saludos, cortesía, muletillas, ejemplos laterales y explicaciones que no cambian el objetivo.',
          'Si la frase contiene muchos argumentos, conserva únicamente los que funcionen como filtros o restricciones: cantidades, fechas, estados, ubicaciones, medidas, personas, proyectos, proveedores, folios, marcas y comparaciones.',
          'Si hay varias preguntas compatibles sobre la misma entidad, identifica primero qué respuesta final espera el usuario. No te quedes con la primera palabra clave. Elige la intención que permita responder el objetivo principal y reescribe query como una petición breve, autosuficiente y precisa que conserve todos los filtros útiles.',
          'Si hay dos acciones distintas, prioriza la última acción explícitamente solicitada y conserva la anterior como contexto solo si modifica el resultado.',
          'Tolera frases habladas mal puntuadas, palabras repetidas, autocorrecciones, muletillas y dictado continuo sin signos. Interpreta el significado antes que la gramática literal.',
          'Tolera registros muy distintos de español: formal, técnico, infantil, adolescente, coloquial, regional, callejero y jerga de oficio. No etiquetes ni juzgues al hablante por su forma de expresarse.',
          'Traduce modismos y jerga a intención operativa antes de clasificar. Ejemplos orientativos: “échame paro”, “rífate con”, “jálalo”, “checa el jale”, “qué rollo con”, “qué onda con”, “sácame de una duda”, “porfis”, “en corto”. No dependas de estos ejemplos: infiere por contexto.',
          'No imites de manera caricaturesca la jerga del usuario. Responde con español natural, claro y profesional manteniendo un tono cercano.',
          'Una frase puede contener cortesía, bromas, apodos, muletillas o lenguaje brusco sin que eso cambie la tarea solicitada. Prioriza siempre el objetivo real y sus restricciones.',
          'Si realmente falta un dato indispensable, usa intent unknown, confidence bajo y escribe en clarification una única pregunta corta sobre el dato faltante. No pidas que repita toda la solicitud.',
          'No elijas una intención solo porque apareció una palabra clave. Interpreta la frase completa, incluyendo negaciones, contrastes como “pero”, “excepto”, “solo”, “sin”, y referencias contextuales.',
          'Cuando el usuario se corrija dentro de la misma frase, toma la última instrucción explícita como la vigente.',
          'Resuelve “ese”, “esa”, “el mismo”, “y cuánto”, “y dónde”, “ahora compáralo” y frases incompletas mediante contexto cuando sea inequívoco.',
          'query debe quedar autosuficiente y conservar códigos, medidas, proyecto, proveedor, vehículo, persona y filtros.',
          'material_family es para tipos, variedades o familias; material_stock para existencia; material_location para ubicación; categories para categorías.',
          'supplier es para proveedor, contacto, RFC, teléfono, correo, WhatsApp o quién vende/surte.',
          'rh_people es para personal y asignaciones; rh_assets para equipos/resguardos; finance para presupuesto/costos; executive para análisis transversal de Dirección.',
          'chat_message solo cuando haya una orden explícita de enviar/avisar/escribir por Chat interno. recipient debe identificar persona, área o general y message solo el mensaje real.',
          'meeting solo cuando haya una orden explícita de crear/agendar/convocar reunión. Conserva destinatarios, día, hora y motivo en query.',
          'global_search solo para búsquedas abiertas dentro de las fuentes autorizadas del perfil; únicamente Gerente General y Subgerente pueden usarlo de forma transversal entre áreas.',
          'reception es para presencia limitada, timbre, visitante, apertura validada de puerta, entregas o avisos desde Recepción. Nunca la uses para exponer información de otros módulos.',
          'En Recepción interpreta modismos y frases cortas como “me abres”, “ando afuera”, “me dejan pasar”, “échale un grito a Compras”, “háblale a Eduardo”, “¿anda alguien de RH?”, “¿sabes si está Eduardo?”, “traigo unas cajas de material”, “vengo de Amazon”, “soy de DHL” o “traigo el lonche”.',
          'Si el contexto previo de Recepción ya contiene persona o área, resuelve seguimientos como “sí, avísale”, “diles que estoy afuera”, “que venga”, “que baje” o “¿y él?” sin pedir que repitan el destinatario.',
          'Una presentación personal como “soy gerente” o “trabajo en recepción” no es inventario: usa help o unknown según corresponda y conserva el área.',
          'Si falta una entidad indispensable usa unknown y confidence bajo. confidence va de 0 a 1.'
        ].filter(Boolean).join(' ')
        const started = Date.now()
        try {
          const providers = allowFreeWithInternal ? configuredProviders : ['groq']
          const ai = await callAi({ system, user: userText, jsonMode: true, maxTokens: 300, providers }, 'intent')
          const plan = parseJsonObject(ai.text)
          if (!plan) return json({ error: 'Skill IA no devolvió una interpretación válida.' }, 502)
          const intent = allowed.includes(clean((plan as any).intent, 80)) ? clean((plan as any).intent, 80) : 'unknown'
          const confidenceRaw = Number((plan as any).confidence)
          const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0
          return json({ ok: true, intent, query: clean((plan as any).query || userText, 1200), entity: clean((plan as any).entity, 240), confidence, locationOnly: Boolean((plan as any).locationOnly || intent === 'material_location'), recipient: clean((plan as any).recipient, 180), message: clean((plan as any).message, 1200), clarification: clean((plan as any).clarification, 500), provider: ai.provider, model: ai.model, durationMs: Date.now() - started })
        } catch (error: any) {
          const retryAfter = Number(error?.retryAfter) || 0
          return json({ error: 'La IA de intención no respondió; Skill puede continuar con su motor local.', code: 'ai_fallback', detail: clean(error?.message, 600), retryAfter }, 503, retryAfter > 0 ? { 'Retry-After': String(retryAfter) } : {})
        }
      }

      if (body?.mode === 'quotation_document') {
        if (!['compras','administrador'].includes(role)) return json({ error: 'Solo Compras o Administrador puede interpretar cotizaciones de proveedores.' }, 403)
        if (!configuredProviders.length) return json({ error: 'La lectura inteligente de cotizaciones requiere un proveedor de IA configurado para Skill.' }, 503)
        const raw = clean(body?.text, 60000)
        const filename = clean(body?.filename, 260)
        const quote = body?.quotation && typeof body.quotation === 'object' ? body.quotation : {}
        const quoteItems = Array.isArray(quote?.items) ? quote.items.slice(0, 120).map((item: any) => ({ id:Number(item?.id)||0, code:clean(item?.code,100), description:clean(item?.description,320), quantity:Number(item?.quantity)||0, unit:clean(item?.unit,50) })) : []
        if (!raw) return json({ error: 'El documento no contiene texto legible.' }, 400)
        const itemText = quoteItems.map((item: any) => `${item.id}|${item.code}|${item.description}|${item.quantity}|${item.unit}`).join('\n')
        const system = [
          'Eres el lector documental de Compras para Skilled Proyectos Industriales.',
          'Extrae una cotización enviada por un proveedor y devuelve JSON estricto. No inventes precios, plazos, moneda, vigencia, códigos ni nombres que no aparezcan en el documento.',
          'Relaciona las partidas del proveedor con la solicitud original usando código/modelo primero y descripción después.',
          'Los precios deben ser unitarios. Si solo aparece total y cantidad pero es inequívoco, puedes calcular precio unitario dividiendo total entre cantidad y agrega una advertencia.',
          'Si una partida no puede relacionarse de forma razonable, conserva originalCode/originalDescription pero deja itemId en 0.',
          'No confundas subtotal, IVA, descuento o total general con precio unitario.',
          'Normaliza moneda solo a MXN, USD o EUR cuando sea explícita; si no está clara, usa cadena vacía.',
          'Normaliza fechas a YYYY-MM-DD solo cuando sea posible sin adivinar.',
          'Devuelve exactamente JSON con providerName, rfc, reference, currency, validity, deliveryDays, confidence, warnings y rows.',
          'rows es un arreglo de objetos con itemId, codigo, descripcion, cantidad, unidad, precioUnitario, moneda, plazoEntregaDias, vigenciaHasta, observaciones, originalCode, originalDescription, confidence.',
          `Archivo: ${filename || 'sin nombre'}. Folio interno: ${clean(quote?.folio,120) || '—'}. Referencia interna: ${clean(quote?.reference,240) || '—'}.`,
          itemText ? `Materiales solicitados, formato id|código|descripción|cantidad|unidad:
${itemText}` : ''
        ].filter(Boolean).join(' ')
        const providers = allowFreeWithInternal ? configuredProviders : (providerConfigured('groq') ? ['groq'] : configuredProviders)
        const started = Date.now()
        try {
          const ai = await callAi({ system, user: raw, jsonMode:true, maxTokens:2200, providers, speed:'strong' }, 'chat')
          const parsed: any = parseJsonObject(ai.text)
          if (!parsed) return json({ error: 'Skill no devolvió una estructura válida para la cotización.' }, 502)
          const rows = Array.isArray(parsed.rows) ? parsed.rows.slice(0,160).map((row: any) => ({
            itemId:Number(row?.itemId)||0,
            codigo:clean(row?.codigo || row?.originalCode,120),
            descripcion:clean(row?.descripcion || row?.originalDescription,420),
            cantidad:Number(row?.cantidad)||0,
            unidad:clean(row?.unidad,60),
            precioUnitario:Math.max(0,Number(row?.precioUnitario)||0),
            moneda:['MXN','USD','EUR'].includes(clean(row?.moneda,10).toUpperCase()) ? clean(row?.moneda,10).toUpperCase() : '',
            plazoEntregaDias:Math.max(0,Math.round(Number(row?.plazoEntregaDias)||0)),
            vigenciaHasta:/^\d{4}-\d{2}-\d{2}$/.test(clean(row?.vigenciaHasta,20)) ? clean(row?.vigenciaHasta,20) : '',
            observaciones:clean(row?.observaciones,500),
            originalCode:clean(row?.originalCode,120),
            originalDescription:clean(row?.originalDescription,420),
            confidence:Math.max(0,Math.min(1,Number(row?.confidence)||0))
          })).filter((row: any) => row.codigo || row.descripcion || row.precioUnitario > 0) : []
          return json({ ok:true, providerName:clean(parsed.providerName,220), rfc:clean(parsed.rfc,40), reference:clean(parsed.reference,180), currency:['MXN','USD','EUR'].includes(clean(parsed.currency,10).toUpperCase())?clean(parsed.currency,10).toUpperCase():'', validity:/^\d{4}-\d{2}-\d{2}$/.test(clean(parsed.validity,20))?clean(parsed.validity,20):'', deliveryDays:Math.max(0,Math.round(Number(parsed.deliveryDays)||0)), confidence:Math.max(0,Math.min(1,Number(parsed.confidence)||0)), warnings:Array.isArray(parsed.warnings)?parsed.warnings.slice(0,20).map((value:any)=>clean(value,400)).filter(Boolean):[], rows, provider:ai.provider, model:ai.model, durationMs:Date.now()-started })
        } catch (error: any) {
          const retryAfter = Number(error?.retryAfter) || 0
          return json({ error:'Skill no pudo interpretar esta cotización automáticamente. Puedes continuar con la tabla manual.', detail:clean(error?.message,600), retryAfter },503,retryAfter>0?{'Retry-After':String(retryAfter)}:{})
        }
      }

      if (body?.mode === 'chat') {
        if (!configuredProviders.length) return json({ error: 'La conversación avanzada de Skill requiere al menos GROQ_API_KEY, GEMINI_API_KEY u OPENROUTER_API_KEY.' }, 503)
        const userText = clean(body?.text, 1800)
        const profile = role
        const previousIntent = clean(body?.context?.lastIntent, 80)
        const previousEntity = clean(body?.context?.lastEntity, 240)
        const previousQuery = clean(body?.context?.lastQuery, 500)
        const previousArea = clean(body?.context?.area, 120)
        const page = clean(body?.context?.page, 120)
        const crmContext = clean(body?.context?.crmContext, 5000)
        const history = historyText(body?.context?.turns)
        if (!userText) return json({ error: 'Falta la consulta para Skill.' }, 400)
        const baseSystem = [
          'Eres Skill, asistente corporativo en evolución de Skilled Proyectos Industriales.',
          'Responde en español de México con fluidez, criterio, naturalidad y tono profesional. Sé concisa por defecto, pero desarrolla cuando la tarea lo amerite.',
          'Sé resolutiva: da primero el resultado o la conclusión útil, después el contexto mínimo y finalmente el siguiente paso cuando aporte valor. No repitas la pregunta del usuario.',
          'Cuando una solicitud sea larga, separa mentalmente objetivo, entidad y restricciones antes de responder; no te distraigas por ejemplos secundarios o palabras aisladas.',
          'Puedes explicar, redactar, resumir, comparar, organizar, razonar, proponer pasos y mantener una conversación natural.',
          'Distingue conversación de consulta operativa. “Soy gerente”, “trabajo en recepción”, “qué opinas” o “platiquemos” no son búsquedas de inventario.',
          'Para datos internos usa únicamente el contexto recuperado. Nunca inventes cifras, personas, stock, costos, proyectos, compras, proveedores ni datos de RH.',
          'Si falta un dato interno concreto, dilo y sugiere la siguiente consulta útil en vez de improvisar.',
          'Las acciones de Chat y reuniones se ejecutan en el navegador. Nunca digas que fueron enviadas hasta que el CRM confirme la operación.',
          'Entiende modismos mexicanos, errores de escritura, apodos, nombres parciales, referencias y preguntas de seguimiento sin exigir comandos exactos.',
          'Aprovecha el contexto visible de la página y los últimos turnos. Si el usuario dice “esto”, “aquí”, “ese”, “qué falta” o “qué hago ahora”, relaciona la pregunta con la página actual cuando el contexto sea suficiente.',
          'Cuando la intención sea ambigua pero se pueda avanzar con seguridad, ofrece la interpretación más probable y una alternativa breve. Haz una sola pregunta de aclaración únicamente si falta un dato indispensable.',
          'Evita responder “no puedo” de forma genérica. Primero explica qué parte sí puedes resolver con los permisos actuales y cuál sería el siguiente paso útil.',
          'Si preguntan quién te crea/desarrolla/programa, responde que el ING. Leobardo Hernández Jerónimo te está desarrollando para ayudar a Skilled Proyectos Industriales y que sigues evolucionando.',
          `Perfil actual autenticado: ${profile}. Página: ${page || 'no identificada'}.`,
          profile === 'gerente_general' || profile === 'subgerente' ? 'Este es un perfil ejecutivo: puede razonar únicamente con los datos corporativos que el CRM haya recuperado de todas las áreas autorizadas.' : 'Este NO es un perfil ejecutivo: limita cualquier dato interno estrictamente al módulo del perfil autenticado. No combines, infieras ni solicites datos de otras áreas aunque el usuario lo pida.',
          profile === 'sky_demo' ? 'Skill Presentación no tiene privilegio transversal de lectura. No lo trates como Gerencia.' : '',
          'El envío de mensajes internos sí está permitido para los perfiles habilitados, pero solo confirma el envío cuando el navegador reciba confirmación de Supabase.',
          'No solicites ni repitas datos sensibles innecesarios.'
        ].filter(Boolean).join(' ')
        const internalSystem = [
          baseSystem,
          previousIntent || previousEntity || previousQuery || previousArea ? `Contexto inmediato: intención=${previousIntent || '—'}; entidad=${previousEntity || '—'}; área=${previousArea || '—'}; consulta previa=${previousQuery || '—'}.` : '',
          history ? `Conversación reciente:
${history}` : '',
          crmContext ? `Datos autorizados recuperados del CRM:
${crmContext}` : 'No se recuperaron datos internos para esta pregunta.'
        ].filter(Boolean).join(' ')
        const publicFallbackSystem = [
          baseSystem,
          'Estás operando como respaldo de conversación general sin acceso a datos internos del CRM.',
          'No supongas información sobre inventario, personal, proyectos, proveedores, compras, costos, nómina o cualquier dato corporativo. Si la pregunta requiere esos datos, indica que Skill debe consultarlos mediante su motor interno.'
        ].join(' ')
        const complexRequest = userText.length > 260 || crmContext.length > 2400 || /\b(analiza|analizar|compara|comparar|explica|explicar|diagnostica|diagnosticar|estrategia|recomienda|recomendar|resumen ejecutivo|plan detallado|paso a paso|por qué|porque|causa|riesgo|prioriza|optimiza)\b/i.test(userText)
        const speed: 'fast' | 'strong' = complexRequest ? 'strong' : 'fast'
        const started = Date.now()
        try {
          let ai: AiResult
          if (allowFreeWithInternal) {
            ai = await callAi({ system: internalSystem, user: userText, maxTokens: 1200, providers: configuredProviders, speed }, 'chat')
          } else if (providerConfigured('groq')) {
            try {
              ai = await callAi({ system: internalSystem, user: userText, maxTokens: 1200, providers: ['groq'], speed }, 'chat')
            } catch (groqError: any) {
              if (crmContext) throw groqError
              const publicProviders = configuredProviders.filter(provider => provider !== 'groq')
              if (!publicProviders.length) throw groqError
              ai = await callAi({ system: publicFallbackSystem, user: userText, maxTokens: 1200, providers: publicProviders, speed }, 'chat')
            }
          } else {
            if (crmContext) return json({ error: 'Esta consulta contiene datos internos y, por privacidad, requiere GROQ_API_KEY. Gemini/OpenRouter gratuitos están limitados a conversación general salvo configuración explícita.' }, 503)
            const publicProviders = configuredProviders.filter(provider => provider !== 'groq')
            if (!publicProviders.length) return json({ error: 'No hay un proveedor de IA configurado para Skill.' }, 503)
            ai = await callAi({ system: publicFallbackSystem, user: userText, maxTokens: 1200, providers: publicProviders, speed }, 'chat')
          }
          const answer = clean(ai.text, 7000)
          if (!answer) return json({ error: 'Skill IA no devolvió una respuesta.' }, 502)
          const privacyDetail = ai.provider === 'groq' ? 'Los datos internos conservan los permisos del perfil.' : 'Respaldo de conversación general sin contexto interno del CRM.'
          return json({ ok: true, answer, title: 'Skill', detail: `Respuesta conversacional · ${ai.provider}. ${privacyDetail}`, provider: ai.provider, model: ai.model, durationMs: Date.now() - started })
        } catch (error: any) {
          const retryAfter = Number(error?.retryAfter) || 0
          return json({ error: 'Los proveedores de IA no respondieron. Skill conserva disponibles sus consultas directas del CRM.', code: 'ai_fallback', detail: clean(error?.message, 600), retryAfter }, 503, retryAfter > 0 ? { 'Retry-After': String(retryAfter) } : {})
        }
      }
    }

    if (!voiceProvider) return json({ error: 'Skill Voz avanzada requiere GROQ_API_KEY u OPENAI_API_KEY en los secretos de Supabase.' }, 503)
    if (!type.includes('multipart/form-data')) return json({ error: 'Formato de audio no válido.' }, 400)

    const form = await req.formData()
    const file = form.get('audio')
    if (!(file instanceof File) || file.size <= 0) return json({ error: 'No se recibió audio.' }, 400)
    if (file.size > 25 * 1024 * 1024) return json({ error: 'El audio es demasiado grande.' }, 413)

    const profile = role
    const context = clean(form.get('context'), 900)
    const prompt = clean([
      'Transcribe español de México con precisión para el CRM de Skilled Proyectos Industriales.',
      profile ? `Perfil: ${profile}.` : '',
      context ? `Vocabulario útil: ${context}.` : '',
      'Conserva códigos, medidas, pulgadas, materiales, marcas, proveedores, correos, nombres de contacto, proyectos y nombres propios.',
      profile === 'recepcion' ? 'En Recepción prioriza nombres de personas y áreas, puerta, acceso, entrada, afuera, Compras, RH, Almacén, Gerencia, paquetería, Mercado Libre, Amazon, DHL, FedEx, Estafeta, UPS, repartidores, comida, materiales, proveedor y remisión.' : '',
      profile === 'recepcion' ? 'Reconoce expresiones mexicanas como “me abres”, “que me abran”, “ando afuera”, “échale un grito”, “háblale”, “márcale”, “ocupo a”, “¿anda por ahí?”, “traigo unas cosas” y “vengo a dejar”.' : '',
      'Reconoce habla coloquial, muletillas, “oye Skill”, apodos y frases incompletas sin corregirlas hacia palabras no relacionadas.'
    ].filter(Boolean).join(' '), 1200)

    const formBody = new FormData()
    formBody.append('file', file, file.name || `sky-${Date.now()}.webm`)
    formBody.append('model', voiceModel)
    formBody.append('language', 'es')
    formBody.append('prompt', prompt)
    formBody.append('response_format', 'json')
    formBody.append('temperature', '0')

    const started = Date.now()
    const endpoint = voiceProvider === 'groq' ? 'https://api.groq.com/openai/v1/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions'
    const key = voiceProvider === 'groq' ? groqKey : openaiKey
    const response = await withTimeout(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: formBody }, 25000)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = clean(payload?.error?.message || payload?.message || `HTTP ${response.status}`, 500)
      const retryAfter = Number(response.headers.get('retry-after') ?? '0') || 0
      if (response.status === 429) return json({ error: 'El proveedor de voz alcanzó un límite temporal. Las consultas por texto siguen disponibles.', code: 'rate_limit', retryAfter }, 429, retryAfter > 0 ? { 'Retry-After': String(retryAfter) } : {})
      return json({ error: `No se pudo transcribir el audio: ${detail}` }, 502)
    }

    const transcript = clean(payload?.text, 3000)
    if (!transcript) return json({ error: 'No se detectó una frase clara en el audio.' }, 422)
    return json({ ok: true, text: transcript, provider: voiceProvider, model: voiceModel, durationMs: Date.now() - started })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo procesar la solicitud de Skill.' }, 500)
  }
})
