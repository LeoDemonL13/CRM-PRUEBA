import os, tempfile, threading
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

DEVICE=os.getenv('OPENVOICE_DEVICE','cpu')
CHECKPOINTS=Path(os.getenv('OPENVOICE_CHECKPOINTS','checkpoints_v2'))
VOICE_FILES={
    'sarah':os.getenv('SKILL_VOICE_SARAH_REF','voices/sarah.wav'),
    'elena':os.getenv('SKILL_VOICE_ELENA_REF','voices/elena.wav'),
    'daniel':os.getenv('SKILL_VOICE_DANIEL_REF','voices/daniel.wav')
}
ORIGINS=[x.strip() for x in os.getenv('SKILL_VOICE_CORS_ORIGINS','http://localhost,http://127.0.0.1').split(',') if x.strip()]
app=FastAPI(title='SKILL Local Voice',version='113')
app.add_middleware(CORSMiddleware,allow_origins=ORIGINS if ORIGINS else ['*'],allow_credentials=False,allow_methods=['POST','GET'],allow_headers=['*'])
lock=threading.Lock()
state={}

class VoiceRequest(BaseModel):
    text:str
    voice:str='Sarah'

def load_engine():
    if state: return
    import torch
    from openvoice import se_extractor
    from openvoice.api import ToneColorConverter
    from melo.api import TTS
    converter=ToneColorConverter(str(CHECKPOINTS/'converter'/'config.json'),device=DEVICE)
    converter.load_ckpt(str(CHECKPOINTS/'converter'/'checkpoint.pth'))
    tts=TTS(language='ES',device=DEVICE)
    src=torch.load(str(CHECKPOINTS/'base_speakers'/'ses'/'es.pth'),map_location=DEVICE)
    targets={}
    for alias,path in VOICE_FILES.items():
        ref=Path(path)
        if ref.exists():
            targets[alias],_=se_extractor.get_se(str(ref),converter,vad=True)
    state.update({'torch':torch,'converter':converter,'tts':tts,'src':src,'targets':targets})

@app.get('/health')
def health():
    return {'ok':True,'version':'113','provider':'openvoice-local','voices':[k.title() for k,v in VOICE_FILES.items() if Path(v).exists()]}

@app.post('/tts')
def tts(req:VoiceRequest):
    value=' '.join(req.text.split())[:2600]
    if not value: raise HTTPException(400,'Falta texto.')
    alias=req.voice.strip().lower() or 'sarah'
    try:
        with lock:
            load_engine()
            target=state['targets'].get(alias) or state['targets'].get('sarah') or next(iter(state['targets'].values()),None)
            if target is None: raise RuntimeError('No hay muestras de voz configuradas.')
            speaker_ids=state['tts'].hps.data.spk2id
            speaker_id=speaker_ids.get('ES') if isinstance(speaker_ids,dict) else None
            if speaker_id is None and isinstance(speaker_ids,dict): speaker_id=next(iter(speaker_ids.values()))
            work=Path(tempfile.mkdtemp(prefix='skill-voice-'))
            base=work/'base.wav'; out=work/'skill.wav'
            state['tts'].tts_to_file(value,speaker_id,str(base),speed=1.0)
            state['converter'].convert(audio_src_path=str(base),src_se=state['src'],tgt_se=target,output_path=str(out),message='SKILL')
        return FileResponse(str(out),media_type='audio/wav',filename='skill.wav',background=None)
    except Exception as exc:
        raise HTTPException(500,f'No se pudo generar voz local: {exc}')
