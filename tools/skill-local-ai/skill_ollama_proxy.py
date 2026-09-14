import os, json, time, urllib.request
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

OLLAMA_BASE_URL=os.getenv('OLLAMA_BASE_URL','http://127.0.0.1:11434').rstrip('/')
MODEL=os.getenv('SKILL_OLLAMA_MODEL','qwen3:4b')
ORIGINS=[x.strip() for x in os.getenv('SKILL_LOCAL_AI_CORS','http://localhost,http://127.0.0.1').split(',') if x.strip()]
app=FastAPI(title='SKILL Local AI',version='113')
app.add_middleware(CORSMiddleware,allow_origins=ORIGINS if ORIGINS else ['*'],allow_credentials=False,allow_methods=['POST','GET'],allow_headers=['*'])

class Payload(BaseModel):
    text:str
    profile:str='consulta'
    context:dict={}

def ask(messages,json_mode=False,timeout=60):
    body={'model':MODEL,'messages':messages,'stream':False,'options':{'temperature':0.05 if json_mode else 0.25}}
    if json_mode: body['format']='json'
    req=urllib.request.Request(f'{OLLAMA_BASE_URL}/api/chat',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=timeout) as response:
        data=json.loads(response.read().decode())
    return str(data.get('message',{}).get('content','')).strip()

def history(context):
    rows=[]
    for turn in (context.get('turns') or [])[-8:]:
        user=str(turn.get('user') or '').strip()
        assistant=str(turn.get('assistant') or '').strip()
        if user: rows.append(f'Usuario: {user}')
        if assistant: rows.append(f'SKILL: {assistant}')
    return '\n'.join(rows)

@app.get('/health')
def health():
    return {'ok':True,'version':'113','provider':'ollama-local','model':MODEL}

@app.post('/interpret')
def interpret(payload:Payload):
    started=time.time()
    text=payload.text.strip()[:1800]
    if not text: raise HTTPException(400,'Falta texto.')
    ctx=payload.context or {}
    system='''Eres el intérprete local de SKILL para Skilled CRM. Devuelve solo JSON válido. Comprende español formal, técnico, infantil, adolescente, regional, coloquial, callejero, jerga laboral, abreviaciones y errores de dictado sin juzgar ni caricaturizar al hablante. Detecta el objetivo real antes que palabras clave. Conserva negaciones, cantidades, fechas, estados, medidas, personas, proyectos, proveedores, marcas, folios y ubicaciones. Si el usuario se corrige, manda la última instrucción explícita. Si falta un dato indispensable, usa intent unknown y una sola pregunta corta en clarification. Intenciones: material_family, material_stock, material_location, low_stock, purchase_order, tools, vehicles, project, supplier, quotation, store, service, rh_people, rh_documents, rh_incidents, rh_assets, finance, executive, categories, global_search, chat_message, meeting, reception, help, unknown. Formato exacto: {"intent":"...","query":"...","entity":"...","confidence":0.0,"locationOnly":false,"recipient":"","message":"","clarification":""}.'''
    user=f'''Perfil autenticado: {payload.profile}.\nÚltima intención: {ctx.get('lastIntent','')}.\nÚltima entidad: {ctx.get('lastEntity','')}.\nÚltima consulta: {ctx.get('lastQuery','')}.\nHistorial:\n{history(ctx)}\n\nSolicitud: {text}'''
    try:
        raw=ask([{'role':'system','content':system},{'role':'user','content':user}],True,45)
        data=json.loads(raw)
    except Exception as exc:
        raise HTTPException(502,f'No se pudo interpretar con Ollama: {exc}')
    data['durationMs']=round((time.time()-started)*1000)
    data['model']=MODEL
    data['provider']='ollama-local'
    return data

@app.post('/chat')
def chat(payload:Payload):
    started=time.time()
    text=payload.text.strip()[:1800]
    if not text: raise HTTPException(400,'Falta texto.')
    ctx=payload.context or {}
    crm=str(ctx.get('crmContext') or '')[:5000]
    system=f'''Eres SKILL, asistente de Skilled CRM. Perfil actual: {payload.profile}. Responde en español natural, claro y profesional. Entiende cualquier registro de habla sin imitar de forma caricaturesca la jerga. Solo puedes usar los datos incluidos en CONTEXTO AUTORIZADO y el historial recibido. No inventes datos ni sugieras que tienes acceso a otras áreas. Si el contexto no contiene la respuesta, dilo y pide el dato mínimo necesario. Mantén respuestas útiles y breves.''' 
    user=f'''HISTORIAL:\n{history(ctx)}\n\nCONTEXTO AUTORIZADO:\n{crm or 'No se proporcionaron datos internos.'}\n\nPREGUNTA:\n{text}'''
    try:
        answer=ask([{'role':'system','content':system},{'role':'user','content':user}],False,60)
    except Exception as exc:
        raise HTTPException(502,f'No se pudo responder con Ollama: {exc}')
    return {'answer':answer,'title':'SKILL · IA local','detail':'Respuesta generada localmente con el contexto autorizado del perfil.','durationMs':round((time.time()-started)*1000),'model':MODEL,'provider':'ollama-local'}
