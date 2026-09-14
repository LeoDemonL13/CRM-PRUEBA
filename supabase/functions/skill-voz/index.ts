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
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const authorization = req.headers.get('Authorization') || ''
    if (!supabaseUrl || !anonKey || !authorization) return json({ error: 'No se pudo validar la sesión.' }, 401)

    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError || !userData?.user) return json({ error: 'Sesión no válida.' }, 401)
    const { data: profile, error: profileError } = await client.from('perfiles_usuario').select('rol,activo').eq('id', userData.user.id).maybeSingle()
    if (profileError || !profile || profile.activo === false) return json({ error: 'Perfil no autorizado para Skill.' }, 403)

    const allowedRoles = ['administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta']
    if (!allowedRoles.includes(clean(profile.rol, 80).toLowerCase())) return json({ error: 'Skill no está habilitado para este perfil.' }, 403)

    const body = await req.json().catch(() => ({}))
    if (body?.ping === true) {
      const localUrl = clean(Deno.env.get('SKILL_LOCAL_TTS_URL'), 500)
      const eleven = Boolean(Deno.env.get('ELEVENLABS_API_KEY') && (Deno.env.get('SKILL_VOICE_SARAH_ID') || Deno.env.get('ELEVENLABS_VOICE_ID_SARAH') || Deno.env.get('SKILL_VOICE_ELENA_ID') || Deno.env.get('ELEVENLABS_VOICE_ID_ELENA') || Deno.env.get('SKILL_VOICE_DANIEL_ID') || Deno.env.get('ELEVENLABS_VOICE_ID_DANIEL')))
      return json({ ok: true, configured: Boolean(localUrl || eleven), provider: localUrl ? 'local' : eleven ? 'elevenlabs' : '', voices: ['Sarah','Elena','Daniel'], version:'113' })
    }

    const value = clean(body?.text, 2600)
    if (!value) return json({ error: 'No hay texto para convertir a voz.' }, 400)
    const alias = clean(body?.voice || 'Sarah', 40).toLowerCase()
    const localUrl = clean(Deno.env.get('SKILL_LOCAL_TTS_URL'), 500)
    const preferred = clean(Deno.env.get('SKILL_TTS_PROVIDER') || 'auto', 40).toLowerCase()
    if (localUrl && preferred !== 'elevenlabs') {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 20000)
        const response = await fetch(localUrl, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({text:value,voice:alias}), signal:controller.signal
        }).finally(()=>clearTimeout(timer))
        if (response.ok) {
          const audio = await response.arrayBuffer()
          const type = response.headers.get('content-type') || 'audio/wav'
          return new Response(audio, { status:200, headers:{...cors,'Content-Type':type,'Cache-Control':'no-store','X-Skill-Voice':alias,'X-Skill-TTS':'local'} })
        }
      } catch (_) {}
      if (preferred === 'local') return json({ error:'El motor de voz local no respondió.' }, 503)
    }
    const voiceMap: Record<string,string> = {
      sarah: Deno.env.get('SKILL_VOICE_SARAH_ID') || Deno.env.get('ELEVENLABS_VOICE_ID_SARAH') || '',
      elena: Deno.env.get('SKILL_VOICE_ELENA_ID') || Deno.env.get('ELEVENLABS_VOICE_ID_ELENA') || '',
      daniel: Deno.env.get('SKILL_VOICE_DANIEL_ID') || Deno.env.get('ELEVENLABS_VOICE_ID_DANIEL') || '',
    }
    const voiceId = voiceMap[alias] || voiceMap.sarah || voiceMap.elena || voiceMap.daniel
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY') || ''
    const modelId = Deno.env.get('SKILL_TTS_MODEL') || 'eleven_multilingual_v2'
    if (!apiKey || !voiceId) return json({ error: 'Voz personalizada no configurada. Usa las voces locales o configura ELEVENLABS_API_KEY y los IDs de voz de SKILL.' }, 503)

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text: value,
        model_id: modelId,
        language_code: 'es',
        voice_settings: {
          stability: Number(Deno.env.get('SKILL_TTS_STABILITY') || '0.52'),
          similarity_boost: Number(Deno.env.get('SKILL_TTS_SIMILARITY') || '0.72'),
          style: Number(Deno.env.get('SKILL_TTS_STYLE') || '0.18'),
          use_speaker_boost: true,
        },
      }),
    })
    if (!response.ok) {
      const detail = clean(await response.text().catch(() => ''), 1200)
      return json({ error: `No se pudo generar la voz personalizada (${response.status}). ${detail}` }, 502)
    }
    const audio = await response.arrayBuffer()
    return new Response(audio, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Skill-Voice': alias },
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo generar la voz de Skill.' }, 500)
  }
})
