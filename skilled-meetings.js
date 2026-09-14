(function(){
'use strict';

let overlay=null;
let stream=null;
let audioContext=null;
let analyser=null;
let sourceNode=null;
let meterTimer=0;
let recognition=null;
let active=false;
let paused=false;
let startedAt=0;
let speechActive=false;
let speechStartedAt=0;
let silenceStartedAt=0;
let noiseFloor=0.008;
let featureFrames=[];
let speakerTimeline=[];
let speakers=[];
let transcript=[];
let segmentSequence=0;
let lastSpeakerKey='';
let currentSpeakerKey='';
let segmentSpeakerVotes=[];
let countdownBusy=false;
let emailBusy=false;
let saveBusy=false;
let pendingFinals=[];
let pendingFinalTimer=0;
let mediaRecorder=null;
let recordedChunks=[];
let recordedMimeType='';
let bridgeProcessBusy=false;
let recognitionStartedAt=0;
let lastRecognitionActivityAt=0;
let lastRecognitionTextAt=0;
let lastVoiceDetectedAt=0;
let recognitionRestartTimer=0;
let recognitionWatchdogTimer=0;
let recognitionGeneration=0;
let recognitionRestartCount=0;
let recognitionStarting=false;
let recognitionBlocked=false;
let checkpointCandidateKey='';
let checkpointCandidateCount=0;
let pendingNewSignature=null;
let pendingNewCount=0;
let liveInterimText='';
let liveInterimSpeakerKey='';
let liveInterimAt=0;
let interimCommittedText='';
let interimCommitTimer=0;
let interimRenderTimer=0;
let liveInterimStartedAt=0;
let lastAudioChunkAt=0;
let audioChunkSequence=0;
let recorderWatchdogTimer=0;
let recorderRestartCount=0;
let recorderGeneration=0;
let activeSpeakerLockedAt=0;
let lastTranscriptCheckpointAt=0;
const MAX_SPEAKERS=8;
const VOICE_THRESHOLD_MIN=0.011;
const SILENCE_CLOSE_MS=430;
const FEATURE_INTERVAL_MS=55;
const RECOGNITION_ROTATE_MS=56000;
const RECOGNITION_VOICE_STALL_MS=6200;
const RECOGNITION_WATCHDOG_MS=1000;
const SPEAKER_SWITCH_CONFIRMATIONS=8;
const NEW_SPEAKER_CONFIRMATIONS=8;
const NEW_SPEAKER_MIN_VOICE_MS=1200;
const INTERIM_COMMIT_MS=2800;
const TRANSCRIPT_MERGE_WINDOW_MS=16000;
const RECENT_TRANSCRIPT_ROWS=24;

const text=v=>String(v??'').trim();
const html=v=>text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const nowClock=()=>new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const formatDuration=ms=>{const total=Math.max(0,Math.round(ms/1000));const m=Math.floor(total/60),s=total%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function meetingNormalize(value){return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ\s]/g,' ').replace(/\s+/g,' ').trim()}
function meetingWords(value){return text(value).replace(/\s+/g,' ').trim().split(' ').filter(Boolean)}
function normalizedWords(value){return meetingWords(value).map(meetingNormalize).filter(Boolean)}
function recentTranscriptText(limit=RECENT_TRANSCRIPT_ROWS){return transcript.slice(-limit).map(row=>row.text).join(' ')}
function overlapWordCount(left,right,maxWords=42){
    const a=normalizedWords(left),b=normalizedWords(right);if(!a.length||!b.length)return 0;
    const max=Math.min(maxWords,a.length,b.length);
    for(let size=max;size>=1;size--){let same=true;for(let i=0;i<size;i++){if(a[a.length-size+i]!==b[i]){same=false;break}}if(same)return size}
    return 0;
}
function stripKnownPrefix(value,context=''){
    const source=meetingWords(value);if(!source.length)return '';
    const known=meetingWords(context);if(!known.length)return source.join(' ');
    const overlap=overlapWordCount(known.join(' '),source.join(' '));
    if(overlap>=2||overlap===source.length)return source.slice(overlap).join(' ').trim();
    const nSource=meetingNormalize(source.join(' ')),nKnown=meetingNormalize(known.join(' '));
    if(nSource&&nKnown.endsWith(nSource))return '';
    return source.join(' ');
}
function mergeTextOverlap(left,right){
    const a=text(left).replace(/\s+/g,' '),b=text(right).replace(/\s+/g,' ');if(!a)return b;if(!b)return a;
    const na=meetingNormalize(a),nb=meetingNormalize(b);if(na===nb||na.endsWith(nb))return a;if(nb.includes(na)&&nb.length<=na.length+12)return a;
    const overlap=overlapWordCount(a,b,48);if(overlap>=1){const words=meetingWords(b);return `${a} ${words.slice(overlap).join(' ')}`.replace(/\s+/g,' ').trim()}
    return `${a} ${b}`.replace(/\s+/g,' ').trim();
}
function transcriptSimilarity(a,b){
    const aa=new Set(normalizedWords(a)),bb=new Set(normalizedWords(b));if(!aa.size||!bb.size)return 0;
    let common=0;aa.forEach(word=>{if(bb.has(word))common++});return common/Math.max(aa.size,bb.size);
}
function speakMeeting(value){return new Promise(resolve=>{const message=text(value);if(!message||!window.speechSynthesis){resolve();return}try{window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(message);utterance.lang='es-MX';utterance.rate=.96;utterance.pitch=1.03;const voices=window.speechSynthesis.getVoices?.()||[];utterance.voice=voices.find(v=>/^es[-_]/i.test(v.lang)&&/mex|sabina|paulina|dalia|female|mujer/i.test(v.name))||voices.find(v=>/^es[-_]/i.test(v.lang))||null;utterance.onend=resolve;utterance.onerror=resolve;window.speechSynthesis.speak(utterance)}catch(_){resolve()}})}
function isMeetingEndCommand(value){const n=meetingNormalize(value);if(!n)return false;const wake=/\bskill\b/.test(n);const finish=/\b(?:termina|terminar|terminamos|finaliza|finalizar|finalizamos|acaba|acabamos|cerrar|cierra|ya termino|ya terminamos|ya finalizo|se acabo|hemos terminado)\b/.test(n);const meeting=/\b(?:reunion|junta|minuta|grabacion|grabación)\b/.test(n);const polite=/\bgracias\b/.test(n);return wake&&finish&&(meeting||polite)}
async function finishByVoice(){if(!active)return;setState('Cerrando reunión','Comando de voz reconocido. Preparando la minuta…');await speakMeeting('Reunión finalizada. Preparando minuta.');await stop({final:true});setState('Reunión finalizada por voz','La minuta está lista. Puedes guardarla, descargarla en Word o PDF, o enviarla por correo.')}
async function startWithCountdown(){if(active||countdownBusy)return;if(!navigator.mediaDevices?.getUserMedia){setState('Micrófono no disponible','Este navegador no permite captura de audio.');return}countdownBusy=true;const layer=document.getElementById('skill-meeting-countdown'),value=document.getElementById('skill-meeting-countdown-value'),label=document.getElementById('skill-meeting-countdown-label');try{const probe=await navigator.mediaDevices.getUserMedia({audio:true,video:false});probe.getTracks().forEach(track=>track.stop());if(layer)layer.classList.add('show');if(label)label.textContent='Empezando grabación';await speakMeeting('Empezando grabación');for(const n of [3,2,1]){if(value)value.textContent=String(n);await speakMeeting(String(n));await sleep(180)}if(value)value.textContent='●';if(label)label.textContent='Grabando';await sleep(220);if(layer)layer.classList.remove('show');await start()}catch(error){if(layer)layer.classList.remove('show');setState('No se pudo iniciar',error?.message||'Autoriza el micrófono para usar Modo reunión.')}finally{countdownBusy=false}}
function safeFileName(value){return (text(value)||'Reunion_SKILL').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'Reunion_SKILL'}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function loadScriptOnce(url,test){if(test())return;await new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src===url);if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('No se pudo cargar una librería de exportación.')),{once:true});return}const script=document.createElement('script');script.src=url;script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar una librería de exportación.'));document.head.appendChild(script)});if(!test())throw new Error('La librería de exportación no quedó disponible.')}
const xmlEsc=v=>text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function docxParagraph(value,{bold=false,size=22,color='1F2937',spaceAfter=100}={}){const lines=String(value??'').split('\n');return lines.map(line=>`<w:p><w:pPr><w:spacing w:after="${spaceAfter}"/></w:pPr><w:r><w:rPr>${bold?'<w:b/>':''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(line||' ')}</w:t></w:r></w:p>`).join('')}
async function buildWordBlob(){await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',()=>Boolean(window.JSZip));const title=text(document.getElementById('skill-meeting-name')?.value)||'Reunión de trabajo',participants=text(document.getElementById('skill-meeting-participants')?.value),date=new Date(startedAt||Date.now()).toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'}),rows=transcript.map(row=>{const speaker=speakers.find(s=>s.key===row.speakerKey);return `[${formatDuration(row.elapsed)}] ${speaker?.label||'Voz'}: ${row.text}`});const agreements=transcript.filter(row=>/\b(acuerdo|acordamos|queda|quedamos|vamos a|se va a|debe|pendiente|responsable|compromiso|fecha limite|fecha límite)\b/i.test(row.text));let body='';body+=docxParagraph('SKILLED PROYECTOS INDUSTRIALES',{bold:true,size:20,color:'00416B',spaceAfter:60});body+=docxParagraph('SKILL · MINUTA DE REUNIÓN',{bold:true,size:32,color:'00416B',spaceAfter:180});body+=docxParagraph(title,{bold:true,size:26,color:'111827',spaceAfter:120});body+=docxParagraph(`Fecha: ${date}`,{size:20,color:'475569'});if(participants)body+=docxParagraph(`Participantes / referencia: ${participants}`,{size:20,color:'475569',spaceAfter:180});body+=docxParagraph('Resumen',{bold:true,size:24,color:'00416B',spaceAfter:80});body+=docxParagraph(meetingSummary(),{size:20,color:'334155',spaceAfter:160});if(agreements.length){body+=docxParagraph('Acuerdos y pendientes',{bold:true,size:24,color:'00416B',spaceAfter:80});agreements.forEach(row=>{const speaker=speakers.find(s=>s.key===row.speakerKey);body+=docxParagraph(`• ${speaker?.label||'Voz'}: ${row.text}`,{size:20,color:'334155',spaceAfter:60})})}body+=docxParagraph('Transcripción',{bold:true,size:24,color:'00416B',spaceAfter:80});rows.forEach(row=>body+=docxParagraph(row,{size:19,color:'334155',spaceAfter:60}));const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;const zip=new window.JSZip();zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');zip.folder('_rels').file('.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');zip.folder('word').file('document.xml',documentXml);return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'})}
async function buildPdfBlob(){await loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>Boolean(window.jspdf?.jsPDF));const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'letter'}),title=text(document.getElementById('skill-meeting-name')?.value)||'Reunión de trabajo',participants=text(document.getElementById('skill-meeting-participants')?.value),date=new Date(startedAt||Date.now()).toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'});let y=18;const addPage=()=>{doc.addPage();y=18};const write=(value,{size=9,bold=false,color=[51,65,85],gap=4}={})=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);const lines=doc.splitTextToSize(String(value??''),180);for(const line of lines){if(y>260)addPage();doc.text(line,18,y);y+=size*.42+1.2}y+=gap};doc.setDrawColor(0,65,107);doc.setLineWidth(.8);doc.line(18,12,198,12);write('SKILLED PROYECTOS INDUSTRIALES',{size:8,bold:true,color:[0,65,107],gap:2});write('SKILL · MINUTA DE REUNIÓN',{size:16,bold:true,color:[0,65,107],gap:5});write(title,{size:13,bold:true,color:[17,24,39],gap:3});write(`Fecha: ${date}`,{size:8,color:[71,85,105],gap:1});if(participants)write(`Participantes / referencia: ${participants}`,{size:8,color:[71,85,105],gap:5});write('Resumen',{size:11,bold:true,color:[0,65,107],gap:2});write(meetingSummary(),{size:8,gap:5});write('Transcripción',{size:11,bold:true,color:[0,65,107],gap:2});transcript.forEach(row=>{const speaker=speakers.find(s=>s.key===row.speakerKey);write(`[${formatDuration(row.elapsed)}] ${speaker?.label||'Voz'}: ${row.text}`,{size:8,gap:1.5})});const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(100,116,139);doc.text(`Skilled Proyectos Industriales · SKILL Reuniones · Página ${i} de ${pages}`,108,272,{align:'center'})}return doc.output('blob')}
async function downloadWord(){if(!transcript.length)return setState('Sin contenido','Primero registra una reunión.');try{const blob=await buildWordBlob(),name=`${safeFileName(document.getElementById('skill-meeting-name')?.value)}_${new Date().toISOString().slice(0,10)}.docx`;downloadBlob(blob,name);setState('Word generado',name)}catch(error){setState('No se pudo generar Word',error?.message||'Error de exportación.') }}
async function downloadPdf(){if(!transcript.length)return setState('Sin contenido','Primero registra una reunión.');try{const blob=await buildPdfBlob(),name=`${safeFileName(document.getElementById('skill-meeting-name')?.value)}_${new Date().toISOString().slice(0,10)}.pdf`;downloadBlob(blob,name);setState('PDF generado',name)}catch(error){setState('No se pudo generar PDF',error?.message||'Error de exportación.') }}
async function blobBase64(blob){const buffer=await blob.arrayBuffer(),bytes=new Uint8Array(buffer);let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary)}
async function sendMinutesViaLocalSmtp(recipients,subject,title,attachments){
    const base=text(window.SKILLED_CONFIG?.skillMeetingBridgeUrl).replace(/\/+$/,'');
    if(!base)throw new Error('El bridge local de SKILL no está configurado.');
    const token=text(window.SKILLED_CONFIG?.skillMeetingBridgeToken);
    const response=await fetch(`${base}/email-browser`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Skill-Token':token}:{})},body:JSON.stringify({to:recipients,subject,body:`${title}\n\n${meetingSummary()}`,attachments})});
    if(!response.ok){let detail='';try{const data=await response.json();detail=text(data?.detail||data?.error)}catch(_){detail=await response.text()}throw new Error(detail||`SMTP local respondió HTTP ${response.status}`)}
    return response.json();
}

async function emailMinutes(){
    if(emailBusy)return;
    if(!transcript.length)return setState('Sin contenido','Primero registra una reunión.');
    const raw=prompt('Escribe uno o varios correos separados por coma:');if(raw===null)return;
    const recipients=raw.split(/[,;\s]+/).map(text).filter(Boolean);
    if(!recipients.length||recipients.some(mail=>!/^\S+@\S+\.\S+$/.test(mail)))return alert('Revisa los correos capturados.');
    emailBusy=true;const button=document.getElementById('skill-meeting-email');if(button){button.disabled=true;button.textContent='Enviando…'}
    try{
        setState('Preparando correo','Generando Word y PDF…');
        const [wordBlob,pdfBlob]=await Promise.all([buildWordBlob(),buildPdfBlob()]),base=safeFileName(document.getElementById('skill-meeting-name')?.value),date=new Date().toISOString().slice(0,10),title=text(document.getElementById('skill-meeting-name')?.value)||'Reunión de trabajo',subject=`Minuta SKILL · ${title}`,attachments=[{filename:`${base}_${date}.docx`,content:await blobBase64(wordBlob),contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},{filename:`${base}_${date}.pdf`,content:await blobBase64(pdfBlob),contentType:'application/pdf'}];
        const mode=meetingNormalize(window.SKILLED_CONFIG?.skillMeetingEmailMode||'auto');
        const localAvailable=Boolean(text(window.SKILLED_CONFIG?.skillMeetingBridgeUrl));
        let sent=false,localError=null;
        if(localAvailable&&mode!=='resend'){
            try{setState('Enviando minuta','Usando el correo local de SKILL sin servicio de pago…');await sendMinutesViaLocalSmtp(recipients,subject,title,attachments);sent=true;setState('Minuta enviada',`Correo enviado a ${recipients.join(', ')} mediante el buzón local de SKILL.`)}catch(error){localError=error;if(mode==='smtp local'||mode==='smtp-local'||mode==='local')throw error}
        }
        if(!sent){
            if(!window.SkilledDB?.client?.functions)throw localError||new Error('No hay correo local configurado ni conexión de Supabase disponible.');
            setState('Enviando minuta','Usando el servicio transaccional configurado en Supabase…');
            const {data,error}=await window.SkilledDB.client.functions.invoke('skill-enviar-minuta',{body:{to:recipients,subject,title,summary:meetingSummary(),attachments}});
            if(error)throw error;if(data?.error)throw new Error(data.error);
            sent=true;setState('Minuta enviada',`Correo enviado a ${recipients.join(', ')} con Word y PDF adjuntos.`);
        }
    }catch(error){setState('No se pudo enviar',error?.message||'Configura el SMTP local de SKILL o un servicio de correo en Supabase.')}finally{emailBusy=false;if(button){button.disabled=false;button.textContent='Correo'}}
}

function styles(){
    if(document.getElementById('skill-meeting-style-v119'))return;
    const style=document.createElement('style');
    style.id='skill-meeting-style-v119';
    style.textContent=`
.skill-meeting-overlay{position:fixed;inset:0;z-index:188;background:rgba(2,5,14,.82);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:18px}.skill-meeting-overlay.open{display:flex}.skill-meeting-modal{width:min(1180px,100%);height:min(820px,94vh);border:1px solid #29476f;border-radius:14px;background:#08111f;box-shadow:0 30px 90px rgba(0,0,0,.55);display:grid;grid-template-rows:auto 1fr;overflow:hidden}.skill-meeting-head{min-height:72px;padding:14px 18px;border-bottom:1px solid #1b2b47;display:flex;align-items:center;justify-content:space-between;gap:14px}.skill-meeting-title{font-size:16px;font-weight:900;color:#f8fafc}.skill-meeting-sub{margin-top:4px;color:#71819b;font-size:9px;line-height:1.45}.skill-meeting-head-actions{display:flex;align-items:center;gap:7px}.skill-meeting-head-actions button{height:36px;border:1px solid #2a4168;border-radius:9px;background:#0d1729;color:#9db4d4;padding:0 11px;font-size:9px;font-weight:850}.skill-meeting-head-actions button:hover{color:#fff;border-color:#4d78b5}.skill-meeting-head-actions .danger{color:#fda4af}.skill-meeting-body{min-height:0;display:grid;grid-template-columns:330px minmax(0,1fr)}.skill-meeting-side{min-height:0;border-right:1px solid #1b2b47;background:#070e1b;padding:16px;overflow:auto}.skill-meeting-main{min-height:0;display:grid;grid-template-rows:auto 1fr auto;background:#091220}.skill-meeting-field{display:block;margin-top:12px}.skill-meeting-field:first-child{margin-top:0}.skill-meeting-field span{display:block;color:#70829e;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.09em}.skill-meeting-field input,.skill-meeting-field textarea{width:100%;margin-top:6px;border:1px solid #263d61;border-radius:10px;background:#050b16;color:#eaf2ff;padding:9px 10px;font-size:10px;outline:none}.skill-meeting-field textarea{resize:vertical;min-height:66px}.skill-meeting-field input:focus,.skill-meeting-field textarea:focus{border-color:#4d8fff;box-shadow:0 0 0 3px rgba(59,130,246,.08)}.skill-meeting-note{margin-top:12px;border:1px solid rgba(96,165,250,.18);border-radius:11px;background:rgba(37,99,235,.06);padding:10px;color:#7890b0;font-size:8px;line-height:1.55}.skill-meeting-status{margin-top:12px;border:1px solid #203554;border-radius:11px;background:#081426;padding:11px}.skill-meeting-status-line{display:flex;align-items:center;justify-content:space-between;gap:10px}.skill-meeting-status strong{color:#dbeafe;font-size:10px}.skill-meeting-status span{color:#71819b;font-size:8px}.skill-meeting-meter{height:28px;margin-top:9px;display:flex;align-items:center;gap:3px}.skill-meeting-meter i{display:block;flex:1;height:4px;border-radius:999px;background:#22344f;transition:.08s}.skill-meeting-meter.live i{background:#60a5fa}.skill-meeting-speakers{margin-top:14px}.skill-meeting-speakers-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.skill-meeting-speakers-head strong{font-size:9px;color:#cbd5e1}.skill-meeting-speakers-head span{font-size:8px;color:#64748b}.skill-meeting-speaker-list{display:grid;gap:7px;margin-top:8px}.skill-meeting-speaker{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:center;border:1px solid #1f3454;border-radius:9px;background:#0a1527;padding:7px}.skill-meeting-speaker-badge{width:28px;height:28px;border-radius:8px;background:#102541;border:1px solid #294d76;color:#93c5fd;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900}.skill-meeting-speaker input{width:100%;border:0;background:transparent;color:#e5edf9;font-size:9px;outline:none}.skill-meeting-summary{margin-top:14px;border-top:1px solid #172641;padding-top:13px}.skill-meeting-summary strong{font-size:9px;color:#cbd5e1}.skill-meeting-summary pre{white-space:pre-wrap;margin-top:8px;color:#8191a9;font:9px/1.6 Inter,system-ui,sans-serif}.skill-meeting-topbar{padding:12px 14px;border-bottom:1px solid #172641;display:flex;align-items:center;justify-content:space-between;gap:10px}.skill-meeting-topbar-left{display:flex;align-items:center;gap:8px;min-width:0}.skill-meeting-indicator{width:8px;height:8px;border-radius:50%;background:#64748b}.skill-meeting-indicator.live{background:#34d399;box-shadow:0 0 0 5px rgba(52,211,153,.08)}.skill-meeting-topbar strong{font-size:10px;color:#e5edf9}.skill-meeting-topbar span{font-size:8px;color:#64748b}.skill-meeting-controls{display:flex;gap:7px;flex-wrap:wrap}.skill-meeting-controls button{height:34px;border:1px solid #294064;border-radius:9px;background:#0d1729;color:#9db4d4;padding:0 10px;font-size:8px;font-weight:850}.skill-meeting-controls button.primary{background:#2563eb;border-color:#3b82f6;color:#fff}.skill-meeting-controls button.warn{border-color:#7c5b20;color:#fcd34d}.skill-meeting-controls button:disabled{opacity:.45;cursor:not-allowed}.skill-meeting-transcript{min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px}.skill-meeting-empty{margin:auto;text-align:center;color:#64748b;font-size:9px;line-height:1.6}.skill-meeting-turn{border:1px solid #1d3150;border-radius:11px;background:#0b1628;padding:10px 11px}.skill-meeting-turn-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px}.skill-meeting-turn-dot{width:8px;height:8px;border-radius:50%;background:#60a5fa}.skill-meeting-turn select{min-width:0;border:1px solid #274365;border-radius:7px;background:#071020;color:#bcd2ed;padding:5px 7px;font-size:8px}.skill-meeting-turn time{color:#5f718d;font-size:7px}.skill-meeting-turn p{margin-top:7px;color:#dbe5f3;font-size:10px;line-height:1.5;white-space:pre-wrap;word-break:break-word}.skill-meeting-turn-live{border-style:dashed;border-color:#2f6da8;background:rgba(37,99,235,.08)}.skill-meeting-turn-live .skill-meeting-turn-dot{background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.08)}.skill-meeting-turn-live strong{font-size:8px;color:#9fc5f2}.skill-meeting-turn-live time{color:#34d399;font-weight:800}.skill-meeting-footer{border-top:1px solid #172641;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#64748b;font-size:8px}.skill-meeting-footer-actions{display:flex;gap:7px}.skill-meeting-footer button{height:34px;border:1px solid #294064;border-radius:9px;background:#0d1729;color:#9db4d4;padding:0 10px;font-size:8px;font-weight:850}.skill-meeting-footer button.primary{background:#0b6ea8;border-color:#1484c0;color:#fff}.skill-meeting-countdown{position:absolute;inset:0;z-index:4;display:none;place-items:center;background:rgba(2,6,15,.86);backdrop-filter:blur(5px)}.skill-meeting-countdown.show{display:grid}.skill-meeting-countdown strong{font-size:clamp(54px,10vw,110px);color:#fff;text-shadow:0 0 35px rgba(59,130,246,.55)}.skill-meeting-countdown span{display:block;margin-top:12px;text-align:center;font-size:11px;color:#93c5fd}.skill-meeting-main{position:relative}body.tema-claro .skill-meeting-modal{background:#fff;border-color:#cbd7e8}body.tema-claro .skill-meeting-side{background:#f7f9fc;border-color:#d9e2ef}body.tema-claro .skill-meeting-main{background:#fff}body.tema-claro .skill-meeting-title,body.tema-claro .skill-meeting-topbar strong,body.tema-claro .skill-meeting-speakers-head strong{color:#111827}body.tema-claro .skill-meeting-field input,body.tema-claro .skill-meeting-field textarea,body.tema-claro .skill-meeting-speaker,body.tema-claro .skill-meeting-turn{background:#fff;color:#111827;border-color:#cbd5e1}body.tema-claro .skill-meeting-turn p{color:#334155}@media(max-width:850px){.skill-meeting-overlay{padding:0;align-items:stretch}.skill-meeting-modal{height:100dvh;max-height:100dvh;width:100%;border:0;border-radius:0}.skill-meeting-body{grid-template-columns:1fr}.skill-meeting-side{display:none}.skill-meeting-head{padding-top:max(12px,env(safe-area-inset-top))}.skill-meeting-topbar{align-items:flex-start;flex-direction:column}.skill-meeting-controls{width:100%}.skill-meeting-controls button{flex:1}.skill-meeting-footer{padding-bottom:calc(10px + env(safe-area-inset-bottom));align-items:stretch;flex-direction:column}.skill-meeting-footer-actions{display:grid;grid-template-columns:1fr 1fr}.skill-meeting-footer button{width:100%}}
`;
    document.head.appendChild(style);
}

function create(){
    if(overlay)return;
    styles();
    overlay=document.createElement('div');
    overlay.id='skill-meeting-overlay';
    overlay.className='skill-meeting-overlay';
    overlay.innerHTML=`
<section class="skill-meeting-modal" role="dialog" aria-modal="true" aria-labelledby="skill-meeting-title">
<header class="skill-meeting-head"><div><div id="skill-meeting-title" class="skill-meeting-title">SKILL · Modo reunión <span style="color:#60a5fa;font-size:9px">V136</span></div><div class="skill-meeting-sub">Sesión continua V136: el audio se graba de forma independiente a la transcripción, conserva más contexto entre reinicios del navegador, elimina solapamientos repetidos y estabiliza cada turno antes de crear una voz nueva. El audio se captura en bloques de 750 ms mientras la reunión está activa.</div></div><div class="skill-meeting-head-actions"><button id="skill-meeting-help" type="button">Cómo funciona</button><button id="skill-meeting-close" type="button">Cerrar</button></div></header>
<div class="skill-meeting-body">
<aside class="skill-meeting-side">
<label class="skill-meeting-field"><span>Título</span><input id="skill-meeting-name" value="Reunión de trabajo" maxlength="160"></label>
<label class="skill-meeting-field"><span>Participantes / referencia</span><textarea id="skill-meeting-participants" placeholder="Ej. Leobardo, Compras, Planeación. Sirve como referencia; SKILL no asume que una voz pertenece a una persona hasta que la etiquetes."></textarea></label>
<div class="skill-meeting-note"><strong style="color:#9fc5f2">Diferenciación de voces:</strong> SKILL agrupa turnos por características acústicas temporales y crea etiquetas como “Voz 1” y “Voz 2”. Puedes renombrarlas durante la reunión. No es reconocimiento biométrico de identidad y no se conserva una huella de voz.</div>
<div class="skill-meeting-status"><div class="skill-meeting-status-line"><strong id="skill-meeting-mic-state">Micrófono detenido</strong><span id="skill-meeting-clock">00:00</span></div><div id="skill-meeting-meter" class="skill-meeting-meter">${'<i></i>'.repeat(18)}</div><div class="skill-meeting-status-line" style="margin-top:6px"><span id="skill-meeting-engine">Texto · esperando</span><span id="skill-meeting-noise">Ruido base —</span></div><div class="skill-meeting-status-line" style="margin-top:5px"><span id="skill-meeting-recorder">Audio · esperando</span><span>bloques de 1 s</span></div></div>
<section class="skill-meeting-speakers"><div class="skill-meeting-speakers-head"><strong>Voces detectadas</strong><span id="skill-meeting-speaker-count">0</span></div><div id="skill-meeting-speaker-list" class="skill-meeting-speaker-list"><span style="font-size:8px;color:#64748b">Aparecerán al comenzar a hablar.</span></div></section>
<section class="skill-meeting-summary"><strong>Resumen de trabajo</strong><pre id="skill-meeting-summary">Todavía no hay intervenciones.</pre></section>
</aside>
<main class="skill-meeting-main"><div id="skill-meeting-countdown" class="skill-meeting-countdown"><div><strong id="skill-meeting-countdown-value">3</strong><span id="skill-meeting-countdown-label">Empezando grabación</span></div></div><div class="skill-meeting-topbar"><div class="skill-meeting-topbar-left"><i id="skill-meeting-indicator" class="skill-meeting-indicator"></i><div><strong id="skill-meeting-live-label">Reunión detenida</strong><span id="skill-meeting-live-detail" style="display:block;margin-top:2px">Pulsa Iniciar o di “Skill, vamos a iniciar reunión”.</span></div></div><div class="skill-meeting-controls"><button id="skill-meeting-start" class="primary" type="button">Iniciar</button><button id="skill-meeting-pause" type="button" disabled>Pausar</button><button id="skill-meeting-stop" class="warn" type="button" disabled>Finalizar</button></div></div><section id="skill-meeting-transcript" class="skill-meeting-transcript"><div class="skill-meeting-empty">SKILL puede separar turnos por voz y transcribir lo que se dice. Durante una reunión puedes decir “ya terminó la reunión, Skill, gracias” para finalizarla.</div></section><footer class="skill-meeting-footer"><span id="skill-meeting-foot">Audio temporal en memoria durante la reunión; no se guarda permanentemente por defecto.</span><div class="skill-meeting-footer-actions"><button id="skill-meeting-copy" type="button">Copiar</button><button id="skill-meeting-word" type="button">Word</button><button id="skill-meeting-pdf" type="button">PDF</button><button id="skill-meeting-email" type="button">Correo</button><button id="skill-meeting-save" class="primary" type="button">Guardar</button></div></footer></main>
</div></section>`;
    document.body.appendChild(overlay);
    document.getElementById('skill-meeting-close').addEventListener('click',close);
    document.getElementById('skill-meeting-help').addEventListener('click',()=>alert('Modo reunión V136: la grabación continua funciona separada del reconocimiento de texto y conserva el audio aunque Chrome reinicie su motor de voz. SKILL mantiene una ventana mayor de contexto, fusiona repeticiones y decide una voz nueva al cerrar un turno completo, no por cambios momentáneos de volumen o tono. Si configuras el motor local gratuito, al finalizar reprocesa el audio completo con Whisper y Pyannote cuando esté disponible; si no hay diarización local, conserva la mejor asignación de voces obtenida en vivo.'));
    document.getElementById('skill-meeting-start').addEventListener('click',startWithCountdown);
    document.getElementById('skill-meeting-pause').addEventListener('click',togglePause);
    document.getElementById('skill-meeting-stop').addEventListener('click',()=>stop({final:true}));
    document.getElementById('skill-meeting-copy').addEventListener('click',copyMinutes);
    document.getElementById('skill-meeting-word').addEventListener('click',downloadWord);
    document.getElementById('skill-meeting-pdf').addEventListener('click',downloadPdf);
    document.getElementById('skill-meeting-email').addEventListener('click',emailMinutes);
        document.getElementById('skill-meeting-save').addEventListener('click',saveMinutes);
    overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
}

function setState(title,detail=''){
    const label=document.getElementById('skill-meeting-live-label');
    const sub=document.getElementById('skill-meeting-live-detail');
    if(label)label.textContent=title;
    if(sub)sub.textContent=detail;
}

function updateControls(){
    const startButton=document.getElementById('skill-meeting-start');
    const pauseButton=document.getElementById('skill-meeting-pause');
    const stopButton=document.getElementById('skill-meeting-stop');
    if(startButton){startButton.disabled=active;startButton.textContent=active?'En curso':'Iniciar'}
    if(pauseButton){pauseButton.disabled=!active;pauseButton.textContent=paused?'Continuar':'Pausar'}
    if(stopButton)stopButton.disabled=!active;
    document.getElementById('skill-meeting-indicator')?.classList.toggle('live',active&&!paused);
}

function open(options={}){
    create();
    overlay.classList.add('open');
    renderSpeakers();
    renderTranscript();
    refreshSummary();
    if(options?.autoStart)window.setTimeout(()=>startWithCountdown(),120);
    return true;
}

async function close(){
    if(active){
        const ok=confirm('La reunión sigue activa. ¿Quieres finalizar la captura antes de cerrar?');
        if(!ok)return;
        await stop({final:true});
    }
    overlay?.classList.remove('open');
}

async function start(){
    if(active)return;
    if(!navigator.mediaDevices?.getUserMedia){setState('Micrófono no disponible','Este navegador no permite captura de audio.');return}
    try{
        stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false,channelCount:1,sampleRate:{ideal:48000}},video:false});
        audioContext=new (window.AudioContext||window.webkitAudioContext)();
        await audioContext.resume();
        sourceNode=audioContext.createMediaStreamSource(stream);
        analyser=audioContext.createAnalyser();
        analyser.fftSize=2048;
        analyser.smoothingTimeConstant=.55;
        sourceNode.connect(analyser);
        startMeetingRecorder();
        active=true;paused=false;startedAt=Date.now();speechActive=false;featureFrames=[];speakerTimeline=[];lastSpeakerKey='';currentSpeakerKey='';segmentSpeakerVotes=[];pendingFinals=[];window.clearTimeout(pendingFinalTimer);pendingFinalTimer=0;window.clearTimeout(interimCommitTimer);interimCommitTimer=0;window.clearTimeout(interimRenderTimer);interimRenderTimer=0;liveInterimText='';liveInterimSpeakerKey='';liveInterimAt=0;liveInterimStartedAt=0;interimCommittedText='';recognitionBlocked=false;recognitionRestartCount=0;recognitionStartedAt=0;lastRecognitionActivityAt=Date.now();lastRecognitionTextAt=0;lastVoiceDetectedAt=0;checkpointCandidateKey='';checkpointCandidateCount=0;pendingNewSignature=null;pendingNewCount=0;activeSpeakerLockedAt=0;lastTranscriptCheckpointAt=Date.now();recorderRestartCount=0;
        setState('Calibrando ambiente','Habla con normalidad; SKILL ajustará el ruido base durante los primeros segundos.');
        document.getElementById('skill-meeting-mic-state').textContent='Micrófono activo';
        document.getElementById('skill-meeting-engine').textContent='Texto · preparando sesión extendida';
        updateControls();
        startRecognition();
        startRecognitionWatchdog();
        meterTimer=window.setInterval(analyseFrame,FEATURE_INTERVAL_MS);
        window.setTimeout(()=>{if(active&&!paused)setState('Escuchando reunión','SKILL conserva el hilo de la conversación, registra audio continuo y solo crea una nueva voz cuando el cambio acústico se mantiene.');},1800);
    }catch(error){
        setState('No se pudo iniciar',error?.message||'Autoriza el micrófono para usar Modo reunión.');
        document.getElementById('skill-meeting-mic-state').textContent='Sin permiso de micrófono';
        await releaseAudio();
    }
}

async function togglePause(){
    if(!active)return;
    paused=!paused;
    if(paused){
        commitLiveInterim('pausa');
        speechActive=false;featureFrames=[];silenceStartedAt=0;
        stopRecognitionWatchdog();
        clearRecognitionRestart();
        try{recognition?.abort()}catch(_){}
        try{if(mediaRecorder?.state==='recording')mediaRecorder.pause()}catch(_){}
        setState('Reunión pausada','La transcripción y la grabación de audio están pausadas.');
        document.getElementById('skill-meeting-mic-state').textContent='Pausado';
    }else{
        setState('Escuchando reunión','La captura se reanudó sin borrar el contexto anterior.');
        document.getElementById('skill-meeting-mic-state').textContent='Micrófono activo';
        try{if(mediaRecorder?.state==='paused')mediaRecorder.resume()}catch(_){}
        recognitionBlocked=false;
        lastRecognitionActivityAt=Date.now();
        startRecognition();
        startRecognitionWatchdog();
    }
    updateControls();
}

async function stop(options={}){
    if(!active){if(options.final)refreshSummary();return}
    commitLiveInterim('fin');
    if(speechActive)finalizeSpeakerSegment(Date.now());
    await flushPendingFinals(true);
    consolidateMeetingTranscript();
    active=false;paused=false;
    window.clearInterval(meterTimer);meterTimer=0;
    stopRecognitionWatchdog();
    clearRecognitionRestart();
    recognitionBlocked=true;
    try{recognition?.abort()}catch(_){}
    recognition=null;
    const meetingAudio=await stopMeetingRecorder();
    await releaseAudio();
    setState('Reunión finalizada',transcript.length?'Revisa la minuta. Si está configurado el motor local, SKILL hará una segunda pasada de precisión.':'No se registraron intervenciones en vivo.');
    document.getElementById('skill-meeting-mic-state').textContent='Micrófono detenido';
    document.getElementById('skill-meeting-engine').textContent='Texto · detenido';
    setRecorderStatus(meetingAudio?.size?'Audio · captura completa lista':'Audio · sin captura');
    document.getElementById('skill-meeting-indicator')?.classList.remove('live');
    updateControls();
    refreshSummary();
    if(options.final&&meetingAudio?.size)await processRecordedMeetingWithBridge(meetingAudio);
}

function startMeetingRecorder(recovery=false){
    if(!recovery){recordedChunks=[];recordedMimeType='';audioChunkSequence=0;lastAudioChunkAt=0;}
window.clearInterval(recorderWatchdogTimer);recorderWatchdogTimer=0;
    if(!stream||typeof MediaRecorder==='undefined'){setRecorderStatus('Audio · grabación continua no disponible');return}
    try{
        const candidates=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
        const mime=candidates.find(value=>MediaRecorder.isTypeSupported?.(value))||'';
        mediaRecorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:64000}:{audioBitsPerSecond:64000});
        const recorder=mediaRecorder;
        recordedMimeType=recorder.mimeType||mime||'audio/webm';
        recorder.ondataavailable=event=>{if(event.data?.size){recordedChunks.push(event.data);audioChunkSequence+=1;lastAudioChunkAt=Date.now();setRecorderStatus(`Audio · continuo · ${audioChunkSequence} bloques`)}};
        const generation=++recorderGeneration;
        recorder.onerror=event=>{setRecorderStatus(`Audio · error${event?.error?.name?` · ${event.error.name}`:''}`)};
        recorder.onstart=()=>setRecorderStatus(`Audio · continuo V136${recorderRestartCount?` · R${recorderRestartCount}`:''}`);
        recorder.onpause=()=>setRecorderStatus('Audio · pausado');
        recorder.onresume=()=>setRecorderStatus('Audio · grabando de forma continua');
        recorder.onstop=()=>{
            if(generation!==recorderGeneration)return;
            if(mediaRecorder===recorder)mediaRecorder=null;
            if(!active||paused||!stream)return;
            recorderRestartCount+=1;
            setRecorderStatus(`Audio · recuperando grabación · R${recorderRestartCount}`);
            window.setTimeout(()=>{if(active&&!paused&&stream&&!mediaRecorder)startMeetingRecorder(true)},120);
        };
        recorder.start(750);
        recorderWatchdogTimer=window.setInterval(()=>{
            if(!mediaRecorder||mediaRecorder.state!=='recording')return;
            const age=lastAudioChunkAt?Date.now()-lastAudioChunkAt:0;
            if(lastAudioChunkAt&&age>3500){
                try{mediaRecorder.requestData();setRecorderStatus('Audio · recuperando flujo continuo')}catch(_){}
            }
        },2200);
    }catch(_){mediaRecorder=null;recordedChunks=[];recordedMimeType='';window.clearInterval(recorderWatchdogTimer);recorderWatchdogTimer=0;setRecorderStatus('Audio · grabación continua no disponible')}
}

function stopMeetingRecorder(){
    window.clearInterval(recorderWatchdogTimer);recorderWatchdogTimer=0;
    return new Promise(resolve=>{
        if(!mediaRecorder){resolve(null);return}
        const recorder=mediaRecorder;mediaRecorder=null;recorderGeneration+=1;
        let finished=false;
        let timeoutId=0;
        const finish=()=>{
            if(finished)return;
            finished=true;
            if(timeoutId)window.clearTimeout(timeoutId);
            try{recorder.removeEventListener('stop',finish)}catch(_){}
            try{const blob=recordedChunks.length?new Blob(recordedChunks,{type:recordedMimeType||recorder.mimeType||'audio/webm'}):null;recordedChunks=[];resolve(blob)}catch(_){recordedChunks=[];resolve(null)}
        };
        if(recorder.state==='inactive'){finish();return}
        recorder.addEventListener('stop',finish,{once:true});
        try{recorder.requestData()}catch(_){}
        try{recorder.stop()}catch(_){finish();return}
        timeoutId=window.setTimeout(finish,1800);
    });
}

async function processRecordedMeetingWithBridge(blob){
    const base=text(window.SKILLED_CONFIG?.skillMeetingBridgeUrl).replace(/\/+$/,'');
    if(!base||!blob||bridgeProcessBusy)return;
    bridgeProcessBusy=true;
    try{
        setState('Afinando voces y transcripción','SKILL está reprocesando el audio completo con el motor local gratuito. La transcripción en vivo se conserva hasta comprobar que el resultado local sea mejor.');
        setRecognitionStatus('Precisión · verificando reunión completa');
        const form=new FormData();
        const ext=/ogg/i.test(blob.type)?'ogg':'webm';
        form.append('audio',blob,`reunion.${ext}`);
        form.append('title',text(document.getElementById('skill-meeting-name')?.value)||'Reunión de trabajo');
        form.append('participants',text(document.getElementById('skill-meeting-participants')?.value));
        const token=text(window.SKILLED_CONFIG?.skillMeetingBridgeToken);
        const response=await fetch(`${base}/process-browser`,{method:'POST',headers:token?{'X-Skill-Token':token}:{},body:form});
        if(!response.ok)throw new Error(await response.text()||`HTTP ${response.status}`);
        const data=await response.json();
        const applied=applyBridgeMeetingResult(data);
        if(applied?.applied){
            setState('Reunión reprocesada',applied.diarization?'Se aplicó Whisper local con diarización de hablantes.':'Se aplicó Whisper local y se conservaron las voces detectadas durante la reunión porque la diarización local no estaba disponible.');
            setRecognitionStatus(`Precisión · ${speakers.length} voces · motor local`);
        }else{
            setState('Reunión finalizada','El resultado local tenía menos contenido que la captura en vivo, por lo que SKILL conservó la minuta más completa.');
            setRecognitionStatus('Precisión · se conservó captura en vivo');
        }
    }catch(error){
        setState('Reunión finalizada','La transcripción en vivo quedó disponible. El motor de precisión local no respondió; puedes seguir usando esta minuta.');
        setRecognitionStatus('Precisión local · no disponible');
        console.warn('SKILL meeting bridge:',error);
    }finally{bridgeProcessBusy=false}
}

function applyBridgeMeetingResult(data){
    const rows=Array.isArray(data?.transcript)?data.transcript.filter(row=>text(row?.text)):[];
    if(!rows.length)return {applied:false,reason:'empty'};
    const liveChars=transcript.reduce((sum,row)=>sum+text(row.text).length,0);
    const bridgeChars=rows.reduce((sum,row)=>sum+text(row.text).length,0);
    if(liveChars>220&&bridgeChars<liveChars*.58)return {applied:false,reason:'shorter'};
    const hasDiarization=data?.meta?.diarization===true;
    if(hasDiarization){
        const labels=[];
        rows.forEach(row=>{const label=text(row.speaker)||'Voz 1';if(!labels.includes(label))labels.push(label)});
        speakers=labels.slice(0,MAX_SPEAKERS).map((label,index)=>({key:`voz_${index+1}`,label,samples:1,signature:null,anchorSignature:null,lastDistance:0}));
        const byLabel=new Map(speakers.map(s=>[s.label,s]));
        transcript=rows.map((row,index)=>{
            const label=text(row.speaker)||labels[0]||'Voz 1';
            const speaker=byLabel.get(label)||speakers[0]||{key:'voz_1'};
            const seconds=Math.max(0,Number(row.start)||0);
            return {id:index+1,speakerKey:speaker.key,text:text(row.text),at:(startedAt||Date.now())+seconds*1000,elapsed:seconds*1000,confidence:1};
        });
    }else{
        if(!speakers.length)ensureSpeaker('Voz 1',null);
        const mapped=[];
        rows.forEach(row=>{
            const start=Math.max(0,Number(row.start)||0),end=Math.max(start,Number(row.end)||start),mid=(start+end)/2;
            const absolute=(startedAt||Date.now())+mid*1000;
            const speaker=speakerForTimestamp(absolute)||speakers[0];
            const clean=text(row.text);if(!clean)return;
            const last=mapped[mapped.length-1];
            if(last&&last.speakerKey===speaker.key&&start*1000-last.elapsed<1800){last.text=mergeTextOverlap(last.text,clean);last.at=(startedAt||Date.now())+start*1000;return}
            mapped.push({id:mapped.length+1,speakerKey:speaker.key,text:clean,at:(startedAt||Date.now())+start*1000,elapsed:start*1000,confidence:.95});
        });
        transcript=mapped;
    }
    segmentSequence=transcript.length;
    renderSpeakers();renderTranscript();refreshSummary();
    return {applied:true,diarization:hasDiarization};
}

async function releaseAudio(){
    try{sourceNode?.disconnect()}catch(_){}
    sourceNode=null;analyser=null;
    try{if(audioContext&&audioContext.state!=='closed')await audioContext.close()}catch(_){}
    audioContext=null;
    try{stream?.getTracks()?.forEach(track=>track.stop())}catch(_){}
    stream=null;
}

function analyseFrame(){
    if(!active||paused||!analyser)return;
    const timeData=new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeData);
    let sum=0,zcr=0,prev=timeData[0]||0;
    for(let i=0;i<timeData.length;i++){
        const value=timeData[i];sum+=value*value;
        if(i&&((value>=0&&prev<0)||(value<0&&prev>=0)))zcr++;
        prev=value;
    }
    const rms=Math.sqrt(sum/timeData.length);
    const freqData=new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(freqData);
    const pitchInfo=estimatePitch(timeData,audioContext?.sampleRate||48000);
    const features=frequencyFeatures(freqData,zcr/timeData.length,rms,pitchInfo);
    const threshold=Math.max(VOICE_THRESHOLD_MIN,noiseFloor*2.05);
    const isVoice=rms>threshold;
    const now=Date.now();
    if(!speechActive&&!isVoice){noiseFloor=noiseFloor*.965+rms*.035}
    if(isVoice){
        lastVoiceDetectedAt=now;
        if(!speechActive){
            speechActive=true;speechStartedAt=now;featureFrames=[];silenceStartedAt=0;currentSpeakerKey='';segmentSpeakerVotes=[];activeSpeakerLockedAt=0;
            checkpointCandidateKey='';checkpointCandidateCount=0;pendingNewSignature=null;pendingNewCount=0;
        }
        featureFrames.push(features);
        if(featureFrames.length>42)featureFrames=featureFrames.slice(-42);
        if(featureFrames.length>=5&&featureFrames.length%3===0){
            const signature=aggregateFeatures(featureFrames.slice(-10));
            const checkpoint=classifySpeakerWindow(signature);
            if(checkpoint?.speaker){
                const key=checkpoint.speaker.key;
                segmentSpeakerVotes.push(key);
                if(segmentSpeakerVotes.length>28)segmentSpeakerVotes=segmentSpeakerVotes.slice(-28);
                if(!currentSpeakerKey){currentSpeakerKey=key;activeSpeakerLockedAt=now;checkpointCandidateKey=key;checkpointCandidateCount=1}
                else if(key===currentSpeakerKey){checkpointCandidateKey=key;checkpointCandidateCount=0}
                else{
                    if(checkpointCandidateKey===key)checkpointCandidateCount+=1;else{checkpointCandidateKey=key;checkpointCandidateCount=1}
                    if(checkpoint.strong&&checkpointCandidateCount>=SPEAKER_SWITCH_CONFIRMATIONS&&now-speechStartedAt>1250&&(!activeSpeakerLockedAt||now-activeSpeakerLockedAt>1100)){
                        splitActiveSpeakerTurn(key,now,signature);
                        checkpointCandidateCount=0;
                    }
                }
            }
        }
        silenceStartedAt=0;
    }else if(speechActive){
        if(!silenceStartedAt)silenceStartedAt=now;
        if(now-silenceStartedAt>=SILENCE_CLOSE_MS)finalizeSpeakerSegment(now);
    }
    updateMeter(rms,threshold);
    const clock=document.getElementById('skill-meeting-clock');if(clock)clock.textContent=formatDuration(now-startedAt);
    const noise=document.getElementById('skill-meeting-noise');if(noise)noise.textContent=`Ruido base ${(noiseFloor*1000).toFixed(1)}`;
}

function estimatePitch(samples,sampleRate){
    if(!samples?.length||!sampleRate)return {hz:0,clarity:0};
    let mean=0;for(let i=0;i<samples.length;i++)mean+=samples[i];mean/=samples.length;
    let energy=0;for(let i=0;i<samples.length;i++){const v=samples[i]-mean;energy+=v*v}
    if(energy/samples.length<0.000015)return {hz:0,clarity:0};
    const minLag=Math.max(2,Math.floor(sampleRate/360));
    const maxLag=Math.min(samples.length-2,Math.ceil(sampleRate/70));
    let bestLag=0,bestCorr=0;
    for(let lag=minLag;lag<=maxLag;lag+=2){
        let corr=0,a2=0,b2=0;
        for(let i=0;i<samples.length-lag;i+=2){const a=samples[i]-mean,b=samples[i+lag]-mean;corr+=a*b;a2+=a*a;b2+=b*b}
        const norm=corr/Math.sqrt(Math.max(1e-12,a2*b2));
        if(norm>bestCorr){bestCorr=norm;bestLag=lag}
    }
    if(!bestLag||bestCorr<.28)return {hz:0,clarity:clamp(bestCorr,0,1)};
    return {hz:sampleRate/bestLag,clarity:clamp(bestCorr,0,1)};
}

function frequencyFeatures(freqData,zcr,rms,pitchInfo={hz:0,clarity:0}){
    let total=0,weighted=0,low=0,mid=0,high=0,veryHigh=0;
    let logSum=0,flatCount=0,rollAccum=0,rolloffHz=0,pitchHz=0,pitchDb=-Infinity;
    const sampleRate=audioContext?.sampleRate||48000;
    const nyquist=sampleRate/2;
    const binHz=nyquist/freqData.length;
    const energies=new Float32Array(freqData.length);
    for(let i=1;i<freqData.length;i++){
        const db=freqData[i];
        const amp=Number.isFinite(db)?Math.pow(10,db/20):0;
        const energy=amp*amp;
        energies[i]=energy;
        const hz=i*binHz;
        total+=energy;weighted+=energy*hz;
        if(hz<350)low+=energy;else if(hz<1200)mid+=energy;else if(hz<3500)high+=energy;else if(hz<7000)veryHigh+=energy;
        if(hz>=70&&hz<=360&&db>pitchDb){pitchDb=db;pitchHz=hz}
        if(hz>=80&&hz<=7000){logSum+=Math.log(Math.max(energy,1e-15));flatCount++}
    }
    total=Math.max(total,1e-12);
    const target=total*.85;
    for(let i=1;i<energies.length;i++){
        rollAccum+=energies[i];
        if(rollAccum>=target){rolloffHz=i*binHz;break}
    }
    const arithmetic=Math.max(total/Math.max(1,flatCount),1e-15);
    const geometric=Math.exp(logSum/Math.max(1,flatCount));
    const flatness=clamp(geometric/arithmetic,0,1);
    const centroid=weighted/total;
    const fftPitch=(pitchDb>-75&&pitchHz>=70&&pitchHz<=360)?pitchHz:0;
    const voicedPitch=Number(pitchInfo?.hz)||fftPitch;
    return [
        clamp(centroid/5000,0,1.8),
        clamp(zcr*8,0,1.8),
        low/total,
        mid/total,
        high/total,
        veryHigh/total,
        clamp(rms*12,0,1.8),
        voicedPitch?clamp((voicedPitch-70)/290,0,1):.5,
        clamp(rolloffHz/7000,0,1.4),
        flatness,
        clamp(Number(pitchInfo?.clarity)||0,0,1)
    ];
}

function splitActiveSpeakerTurn(newKey,at,signature){
    if(!speechActive||!newKey||newKey===currentSpeakerKey)return;
    const previousKey=currentSpeakerKey||majoritySpeakerKey(segmentSpeakerVotes)||lastSpeakerKey;
    commitLiveInterim('cambio de voz',previousKey);
    const boundary=Math.max(speechStartedAt+100,at-140);
    if(previousKey&&boundary>speechStartedAt){
        speakerTimeline.push({speakerKey:previousKey,start:speechStartedAt,end:boundary,confidence:.78});
        if(speakerTimeline.length>160)speakerTimeline=speakerTimeline.slice(-160);
        lastSpeakerKey=previousKey;
    }
    currentSpeakerKey=newKey;
    activeSpeakerLockedAt=at;
    speechStartedAt=boundary;
    featureFrames=featureFrames.slice(-8);
    segmentSpeakerVotes=[newKey,newKey];
    const speaker=speakers.find(item=>item.key===newKey);
    if(speaker&&signature){speaker.samples+=1;speaker.signature=speaker.signature?speaker.signature.map((value,index)=>value*.9+signature[index]*.1):signature.slice()}
}

function speakerReference(speaker){return speaker?.anchorSignature||speaker?.signature||null}

function classifySpeakerWindow(signature){
    if(!signature)return null;
    if(!speakers.length)return {speaker:ensureSpeaker('Voz 1',signature),distance:0,newSpeaker:true,strong:true};
    const ranked=speakers.map(speaker=>({speaker,distance:featureDistance(signature,speakerReference(speaker))})).sort((a,b)=>a.distance-b.distance);
    const best=ranked[0],second=ranked[1];
    const strongLimit=.095;
    const matchLimit=best?.speaker?.samples>=8?.15:.165;
    if(best&&best.distance<=matchLimit){
        const strong=best.distance<=strongLimit||(!second||best.distance+.026<second.distance);
        if(strong&&best.speaker.key===currentSpeakerKey){
            best.speaker.samples+=1;
            best.speaker.signature=best.speaker.signature?best.speaker.signature.map((value,index)=>value*.99+signature[index]*.01):signature.slice();
        }
        return {...best,newSpeaker:false,strong};
    }
    // Durante un turno activo no se crea una identidad nueva por una variación momentánea.
    // La decisión de una voz nueva se toma con la firma acústica completa al cerrar el turno.
    return best?{...best,newSpeaker:false,provisional:true,strong:false}:null;
}

function clusterCompletedTurn(signature,durationMs=0){
    if(!signature){const speaker=speakers[0]||ensureSpeaker('Voz 1',signature);return {speaker,newSpeaker:false,distance:0}}
    if(!speakers.length)return {speaker:ensureSpeaker('Voz 1',signature),newSpeaker:true,distance:0};
    const ranked=speakers.map(speaker=>({speaker,distance:featureDistance(signature,speakerReference(speaker))})).sort((a,b)=>a.distance-b.distance);
    const best=ranked[0];
    const matchLimit=best?.speaker?.samples>=10?.165:.18;
    if(best&&best.distance<=matchLimit){
        const speaker=best.speaker;
        speaker.samples+=1;
        if(best.distance<.13)speaker.signature=speaker.signature?speaker.signature.map((value,index)=>value*.965+signature[index]*.035):signature.slice();
        speaker.lastDistance=best.distance;
        return {speaker,newSpeaker:false,distance:best.distance};
    }
    if(durationMs>=850&&speakers.length<MAX_SPEAKERS){
        const speaker=ensureSpeaker('',signature);
        return {speaker,newSpeaker:true,distance:best?.distance??0};
    }
    return {speaker:best?.speaker||speakers[0],newSpeaker:false,distance:best?.distance??99};
}

function updateMeter(rms,threshold){
    const meter=document.getElementById('skill-meeting-meter');if(!meter)return;
    meter.classList.toggle('live',rms>threshold);
    const level=clamp(rms/Math.max(.08,threshold*4),0,1);
    [...meter.children].forEach((bar,index)=>{bar.style.height=`${4+Math.max(0,level-index/meter.children.length)*22}px`;bar.style.opacity=index/meter.children.length<=level?'1':'.32'});
}

function aggregateFeatures(frames){
    if(!frames.length)return null;
    const out=Array(frames[0].length).fill(0);
    frames.forEach(frame=>frame.forEach((value,index)=>out[index]+=value));
    return out.map(value=>value/frames.length);
}

function featureDistance(a,b){
    if(!a||!b)return 99;
    const weights=[1.2,.75,1.0,1.08,1.02,.75,.12,2.25,.7,.55,1.15];
    let sum=0,weight=0;
    for(let i=0;i<Math.min(a.length,b.length);i++){sum+=Math.pow((a[i]-b[i])*weights[i],2);weight+=weights[i]}
    return Math.sqrt(sum/Math.max(1,weight));
}

function majoritySpeakerKey(votes){
    if(!Array.isArray(votes)||!votes.length)return '';
    const counts=new Map();
    votes.forEach(key=>{if(key)counts.set(key,(counts.get(key)||0)+1)});
    return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
}

function classifySpeakerCheckpoint(signature){
    if(!signature)return null;
    if(!speakers.length)return ensureSpeaker('Voz 1',signature);
    const ranked=speakers.map(speaker=>({speaker,distance:featureDistance(signature,speakerReference(speaker))})).sort((a,b)=>a.distance-b.distance);
    const best=ranked[0];
    const threshold=best?.speaker?.samples>=8?.145:.155;
    if(best&&best.distance<=threshold)return best.speaker;
    return null;
}

function clusterSpeaker(signature){
    if(!signature)return speakers[0]||ensureSpeaker('Voz 1',signature);
    if(!speakers.length)return ensureSpeaker('Voz 1',signature);
    const ranked=speakers.map(speaker=>({speaker,distance:featureDistance(signature,speakerReference(speaker))})).sort((a,b)=>a.distance-b.distance);
    const best=ranked[0];
    if(best){
        const speaker=best.speaker;
        if(best.distance<=.16){speaker.samples+=1;if(best.distance<.1)speaker.signature=speaker.signature?speaker.signature.map((value,index)=>value*.975+signature[index]*.025):signature.slice()}
        speaker.lastDistance=best.distance;
        return speaker;
    }
    return speakers[0];
}

function nextSpeakerKey(){let index=1;while(speakers.some(item=>item.key===`voz_${index}`))index+=1;return `voz_${index}`}
function nextSpeakerLabel(){let index=1;while(speakers.some(item=>meetingNormalize(item.label)===meetingNormalize(`Voz ${index}`)))index+=1;return `Voz ${index}`}
function ensureSpeaker(label,signature){
    const key=nextSpeakerKey();
    const seed=signature?signature.slice():null;
    const speaker={key,label:text(label)||nextSpeakerLabel(),samples:1,signature:seed,anchorSignature:seed?seed.slice():null,lastDistance:0};
    speakers.push(speaker);renderSpeakers();return speaker;
}

function mergeSpeakerClones(){
    if(speakers.length<2)return;
    let changed=false;
    for(let i=speakers.length-1;i>=0;i--){
        const candidate=speakers[i];if(!candidate||candidate.samples>10||!speakerReference(candidate))continue;
        const matches=speakers.filter(other=>other.key!==candidate.key&&other.samples>=candidate.samples&&speakerReference(other)).map(other=>({other,distance:featureDistance(speakerReference(candidate),speakerReference(other))})).sort((a,b)=>a.distance-b.distance);
        const best=matches[0];if(!best||best.distance>(candidate.samples<=4?.072:.058))continue;
        speakerTimeline.forEach(segment=>{if(segment.speakerKey===candidate.key)segment.speakerKey=best.other.key});
        transcript.forEach(row=>{if(row.speakerKey===candidate.key)row.speakerKey=best.other.key});
        if(lastSpeakerKey===candidate.key)lastSpeakerKey=best.other.key;
        if(currentSpeakerKey===candidate.key)currentSpeakerKey=best.other.key;
        if(liveInterimSpeakerKey===candidate.key)liveInterimSpeakerKey=best.other.key;
        segmentSpeakerVotes=segmentSpeakerVotes.map(key=>key===candidate.key?best.other.key:key);
        speakers.splice(i,1);changed=true;
    }
    if(changed){renderSpeakers();renderTranscript();refreshSummary()}
}

function consolidateMeetingTranscript(){
    mergeSpeakerClones();
    const cleaned=[];
    for(const row of transcript){
        const item={...row,text:text(row.text).replace(/\s+/g,' ')};if(!item.text)continue;
        const last=cleaned[cleaned.length-1];
        if(last&&last.speakerKey===item.speakerKey&&item.at-last.at<18000){last.text=mergeTextOverlap(last.text,item.text);last.at=Math.max(last.at,item.at);last.confidence=Math.max(last.confidence||0,item.confidence||0);continue}
        const dup=cleaned.slice(-10).find(prev=>Math.abs(item.at-prev.at)<24000&&transcriptSimilarity(prev.text,item.text)>=.93);
        if(dup){dup.confidence=Math.max(dup.confidence||0,item.confidence||0);continue}
        cleaned.push(item);
    }
    transcript=cleaned.map((row,index)=>({...row,id:index+1}));segmentSequence=transcript.length;
    renderSpeakers();renderTranscript();refreshSummary();
}

function finalizeSpeakerSegment(endAt){
    if(!speechActive)return;
    const signature=aggregateFeatures(featureFrames);
    const duration=Math.max(0,endAt-speechStartedAt);
    const completed=clusterCompletedTurn(signature,duration);
    const finalCandidate=completed?.speaker||speakers[0]||ensureSpeaker('Voz 1',signature);
    if(finalCandidate)segmentSpeakerVotes.push(finalCandidate.key);
    const votedKey=majoritySpeakerKey(segmentSpeakerVotes)||currentSpeakerKey||lastSpeakerKey||finalCandidate?.key||'';
    // Una voz nueva decidida con el turno completo tiene prioridad sobre votos provisionales del mismo turno.
    const winnerKey=completed?.newSpeaker?finalCandidate.key:votedKey;
    const speaker=speakers.find(item=>item.key===winnerKey)||finalCandidate;
    const votes=segmentSpeakerVotes.filter(Boolean);const winnerVotes=votes.filter(key=>key===speaker.key).length;
    const speakerConfidence=completed?.newSpeaker ? .86 : (votes.length?winnerVotes/votes.length:.6);
    speakerTimeline.push({speakerKey:speaker.key,start:speechStartedAt,end:endAt,confidence:speakerConfidence});
    if(speakerTimeline.length>220)speakerTimeline=speakerTimeline.slice(-220);
    lastSpeakerKey=speaker.key;
    speechActive=false;featureFrames=[];segmentSpeakerVotes=[];silenceStartedAt=0;speechStartedAt=0;currentSpeakerKey='';activeSpeakerLockedAt=0;
    mergeSpeakerClones();
}

function clearRecognitionRestart(){
    window.clearTimeout(recognitionRestartTimer);recognitionRestartTimer=0;
}

function stopRecognitionWatchdog(){
    window.clearInterval(recognitionWatchdogTimer);recognitionWatchdogTimer=0;
}

function setRecognitionStatus(label){
    const host=document.getElementById('skill-meeting-engine');
    if(host)host.textContent=label;
}

function setRecorderStatus(label){
    const host=document.getElementById('skill-meeting-recorder');
    if(host)host.textContent=label;
}

function scheduleRecognitionRestart(reason='reinicio',delay=180){
    if(!active||paused||recognitionBlocked)return;
    commitLiveInterim(`reinicio: ${reason}`);
    clearRecognitionRestart();
    recognitionRestartTimer=window.setTimeout(()=>{
        if(!active||paused||recognitionBlocked)return;
        recognitionRestartCount+=1;
        setRecognitionStatus(`Texto · recuperando · ${recognitionRestartCount}`);
        try{recognition?.abort()}catch(_){}
        recognition=null;
        recognitionStarting=false;
        startRecognition(true,reason);
    },delay);
}

function startRecognitionWatchdog(){
    stopRecognitionWatchdog();
    recognitionWatchdogTimer=window.setInterval(()=>{
        if(!active||paused||recognitionBlocked)return;
        const now=Date.now();
        if(!recognition||!recognitionStartedAt){scheduleRecognitionRestart('sin motor',80);return}
        if(now-recognitionStartedAt>RECOGNITION_ROTATE_MS){scheduleRecognitionRestart('rotación preventiva',80);return}
        const voiceRecently=lastVoiceDetectedAt&&now-lastVoiceDetectedAt<2200;
        const recognizerQuiet=now-lastRecognitionActivityAt>RECOGNITION_VOICE_STALL_MS;
        if(voiceRecently&&recognizerQuiet){scheduleRecognitionRestart('voz sin texto',80);return}
    },RECOGNITION_WATCHDOG_MS);
}

function startRecognition(forceNew=false,reason='inicio'){
    if(!active||paused||recognitionBlocked||recognitionStarting)return;
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){setRecognitionStatus('Texto · reconocimiento no disponible');return}
    recognitionStarting=true;
    const generation=++recognitionGeneration;
    clearRecognitionRestart();
    if(forceNew){try{recognition?.abort()}catch(_){}recognition=null}
    const engine=new Recognition();
    recognition=engine;
    engine.lang='es-MX';engine.continuous=true;engine.interimResults=true;engine.maxAlternatives=3;
    engine.onstart=()=>{
        if(generation!==recognitionGeneration)return;
        recognitionStarting=false;
        recognitionStartedAt=Date.now();
        lastRecognitionActivityAt=Date.now();
        liveInterimText='';liveInterimSpeakerKey='';liveInterimAt=0;liveInterimStartedAt=0;
        setRecognitionStatus(`Texto · continuo V136${recognitionRestartCount?` · R${recognitionRestartCount}`:''}`);
    };
    engine.onaudiostart=()=>{if(generation===recognitionGeneration)lastRecognitionActivityAt=Date.now()};
    engine.onspeechstart=()=>{if(generation===recognitionGeneration)lastRecognitionActivityAt=Date.now()};
    engine.onresult=event=>{
        if(generation!==recognitionGeneration)return;
        lastRecognitionActivityAt=Date.now();
        for(let i=event.resultIndex;i<event.results.length;i++){
            const result=event.results[i];
            let best='';let confidence=-1;
            for(let j=0;j<result.length;j++){
                const value=text(result[j]?.transcript);
                const score=Number(result[j]?.confidence)||0;
                if(value&&(score>confidence||!best)){best=value;confidence=score}
            }
            if(!best)continue;
            if(!result.isFinal){updateLiveInterim(best);continue}
            lastRecognitionTextAt=Date.now();
            if(isMeetingEndCommand(best)){clearLiveInterim();finishByVoice();return}
            const eventAt=liveInterimStartedAt||liveInterimAt||Date.now();
            const speakerKey=liveInterimSpeakerKey||currentSpeakerKey||lastSpeakerKey;
            const resolvedSpeaker=speakerForTimestamp(eventAt,speakerKey)||speakerForTranscript();
            const delta=transcriptDelta(best,interimCommittedText);
            clearLiveInterim();
            interimCommittedText='';
            if(delta&&!isRecentTranscriptDuplicate(delta))appendTranscript(delta,confidence,resolvedSpeaker,eventAt);
        }
    };
    engine.onerror=event=>{
        if(generation!==recognitionGeneration)return;
        recognitionStarting=false;
        const error=text(event?.error)||'error';
        if(['not-allowed','service-not-allowed'].includes(error)){
            recognitionBlocked=true;
            setRecognitionStatus('Texto · permiso bloqueado');
            setState('Micrófono de transcripción bloqueado','Autoriza el micrófono y vuelve a iniciar la reunión.');
            return;
        }
        if(error==='audio-capture'){
            setRecognitionStatus('Texto · micrófono ocupado');
            scheduleRecognitionRestart(error,900);
            return;
        }
        if(!['no-speech','aborted'].includes(error))setRecognitionStatus(`Texto · ${error} · recuperando`);
        scheduleRecognitionRestart(error,error==='network'?1200:260);
    };
    engine.onend=()=>{
        if(generation!==recognitionGeneration)return;
        recognitionStarting=false;
        recognitionStartedAt=0;
        if(active&&!paused&&!recognitionBlocked)scheduleRecognitionRestart('fin automático',180);
    };
    try{
        engine.start();
        setRecognitionStatus(reason==='inicio'?'Texto · iniciando modo continuo V136':'Texto · reiniciando con contexto conservado');
    }catch(error){
        recognitionStarting=false;
        scheduleRecognitionRestart('start',500);
    }
}

function transcriptDelta(full,committed=''){
    const source=text(full).replace(/\s+/g,' ');if(!source)return '';
    const localContext=[recentTranscriptText(),text(committed)].filter(Boolean).join(' ');
    const stripped=stripKnownPrefix(source,localContext);
    if(!stripped)return '';
    const n=meetingNormalize(stripped);
    if(!n)return '';
    const recent=transcript.slice(-RECENT_TRANSCRIPT_ROWS);
    if(recent.some(row=>{const r=meetingNormalize(row.text);return r===n||(n.length>22&&(r.endsWith(n)||n===r))}))return '';
    return stripped;
}

function isRecentTranscriptDuplicate(value){
    const n=meetingNormalize(value);if(!n)return true;
    const words=normalizedWords(value);
    return transcript.slice(-RECENT_TRANSCRIPT_ROWS).some(row=>{
        const r=meetingNormalize(row.text);if(r===n)return true;
        if(n.length>22&&(r.includes(n)||n.includes(r)))return true;
        if(words.length>=4&&transcriptSimilarity(value,row.text)>=.88)return true;
        return false;
    });
}

function clearLiveInterim(){
    window.clearTimeout(interimCommitTimer);interimCommitTimer=0;
    liveInterimText='';liveInterimSpeakerKey='';liveInterimAt=0;liveInterimStartedAt=0;
    renderTranscript();
}

function updateLiveInterim(value){
    const clean=text(value).replace(/\s+/g,' ');if(!clean)return;
    const now=Date.now();
    if(!liveInterimText)liveInterimStartedAt=now;
    if(liveInterimText){
        const oldWords=meetingWords(liveInterimText),newWords=meetingWords(clean);
        const similarity=transcriptSimilarity(liveInterimText,clean);
        if(newWords.length>=oldWords.length||similarity<.55)liveInterimText=clean;
        else if(overlapWordCount(liveInterimText,clean)>=2)liveInterimText=mergeTextOverlap(liveInterimText,clean);
    }else liveInterimText=clean;
    const stableKey=currentSpeakerKey||lastSpeakerKey||liveInterimSpeakerKey||'';
    if(stableKey)liveInterimSpeakerKey=stableKey;
    liveInterimAt=now;
    window.clearTimeout(interimCommitTimer);
    interimCommitTimer=window.setTimeout(()=>commitLiveInterim('respaldo de texto en vivo'),INTERIM_COMMIT_MS);
    window.clearTimeout(interimRenderTimer);
    interimRenderTimer=window.setTimeout(()=>{interimRenderTimer=0;renderTranscript()},70);
}

function commitLiveInterim(reason='',speakerKeyOverride=''){
    window.clearTimeout(interimCommitTimer);interimCommitTimer=0;
    const delta=transcriptDelta(liveInterimText,interimCommittedText);
    if(!delta||delta.split(/\s+/).filter(Boolean).length<2)return;
    const key=speakerKeyOverride||liveInterimSpeakerKey||currentSpeakerKey||lastSpeakerKey;
    const at=liveInterimStartedAt||liveInterimAt||Date.now();
    const speaker=(key&&speakers.find(s=>s.key===key))||speakerForTimestamp(at,key)||speakerForTranscript();
    interimCommittedText=mergeTextOverlap(interimCommittedText,liveInterimText);
    if(!isRecentTranscriptDuplicate(delta))appendTranscript(delta,.45,speaker,at);
    else renderTranscript();
    liveInterimSpeakerKey=currentSpeakerKey||speaker?.key||'';
}

function speakerForTimestamp(at,tentativeKey=''){
    const tentative=tentativeKey?speakers.find(s=>s.key===tentativeKey):null;
    const exact=[...speakerTimeline].reverse().find(segment=>at>=segment.start-250&&at<=segment.end+900);
    if(exact)return speakers.find(s=>s.key===exact.speakerKey)||tentative||null;
    const recent=[...speakerTimeline].reverse().find(segment=>Math.abs(at-segment.end)<2200);
    if(recent)return speakers.find(s=>s.key===recent.speakerKey)||tentative||null;
    if(tentative)return tentative;
    return null;
}

function queueTranscript(value,confidence=0){
    const clean=text(value).replace(/\s+/g,' ');if(!clean)return;
    const at=Date.now();
    let tentative=currentSpeakerKey||'';
    if(!tentative&&speechActive&&featureFrames.length>=3){const current=clusterSpeaker(aggregateFeatures(featureFrames));tentative=current?.key||'';if(tentative)currentSpeakerKey=tentative}
    pendingFinals.push({text:clean,confidence:Number(confidence)||0,at,tentativeKey:tentative});
    if(pendingFinals.length>12)pendingFinals=pendingFinals.slice(-12);
    window.clearTimeout(pendingFinalTimer);
    pendingFinalTimer=window.setTimeout(()=>flushPendingFinals(false),Math.max(760,SILENCE_CLOSE_MS+180));
}

async function flushPendingFinals(force=false){
    window.clearTimeout(pendingFinalTimer);pendingFinalTimer=0;
    if(!pendingFinals.length)return;
    if(!force&&speechActive){pendingFinalTimer=window.setTimeout(()=>flushPendingFinals(false),260);return}
    const queue=pendingFinals.splice(0);
    for(const item of queue){
        const speaker=speakerForTimestamp(item.at,item.tentativeKey)||speakerForTranscript();
        appendTranscript(item.text,item.confidence,speaker);
    }
}

function speakerForTranscript(){
    if(speechActive){if(currentSpeakerKey){const current=speakers.find(s=>s.key===currentSpeakerKey);if(current)return current}if(featureFrames.length>=3){const current=clusterSpeaker(aggregateFeatures(featureFrames));currentSpeakerKey=current?.key||'';if(current)return current}}
    const now=Date.now();
    const recent=[...speakerTimeline].reverse().find(segment=>now-segment.end<2500);
    if(recent)return speakers.find(s=>s.key===recent.speakerKey)||null;
    if(lastSpeakerKey)return speakers.find(s=>s.key===lastSpeakerKey)||null;
    return speakers[0]||ensureSpeaker('Voz 1',null);
}

function appendTranscript(value,confidence=0,resolvedSpeaker=null,eventAt=Date.now()){
    const clean=text(value).replace(/\s+/g,' ');if(!clean)return;
    const at=Number(eventAt)||Date.now();
    const speaker=resolvedSpeaker||speakerForTimestamp(at)||speakerForTranscript();
    const last=transcript[transcript.length-1];
    if(last&&last.speakerKey===speaker.key&&at-last.at<TRANSCRIPT_MERGE_WINDOW_MS){
        const merged=mergeTextOverlap(last.text,clean);
        if(meetingNormalize(merged)!==meetingNormalize(last.text))last.text=merged;
        last.confidence=Math.max(last.confidence||0,confidence||0);last.at=Math.max(last.at,at);
    }else{
        const duplicate=transcript.slice(-RECENT_TRANSCRIPT_ROWS).find(row=>transcriptSimilarity(row.text,clean)>=.92&&Math.abs(at-row.at)<20000);
        if(duplicate){duplicate.confidence=Math.max(duplicate.confidence||0,confidence||0);renderTranscript();refreshSummary();return}
        transcript.push({id:++segmentSequence,speakerKey:speaker.key,text:clean,at,elapsed:Math.max(0,at-startedAt),confidence:Number(confidence)||0});
    }
    renderTranscript();refreshSummary();
}

function renderSpeakers(){
    const host=document.getElementById('skill-meeting-speaker-list');if(!host)return;
    document.getElementById('skill-meeting-speaker-count').textContent=String(speakers.length);
    if(!speakers.length){host.innerHTML='<span style="font-size:8px;color:#64748b">Aparecerán al comenzar a hablar.</span>';return}
    host.innerHTML=speakers.map((speaker,index)=>`<div class="skill-meeting-speaker"><div class="skill-meeting-speaker-badge">V${index+1}</div><input data-speaker-name="${html(speaker.key)}" value="${html(speaker.label)}" maxlength="60" aria-label="Nombre de ${html(speaker.label)}"></div>`).join('');
    host.querySelectorAll('[data-speaker-name]').forEach(input=>input.addEventListener('change',()=>{const speaker=speakers.find(item=>item.key===input.dataset.speakerName);if(!speaker)return;speaker.label=text(input.value)||speaker.label;input.value=speaker.label;renderTranscript();refreshSummary()}));
}

function speakerOptions(selected){return speakers.map(speaker=>`<option value="${html(speaker.key)}" ${speaker.key===selected?'selected':''}>${html(speaker.label)}</option>`).join('')}

function renderTranscript(){
    const host=document.getElementById('skill-meeting-transcript');if(!host)return;
    const committed=transcript.map(row=>{const speaker=speakers.find(s=>s.key===row.speakerKey);return `<article class="skill-meeting-turn" data-turn="${row.id}"><div class="skill-meeting-turn-head"><i class="skill-meeting-turn-dot"></i><select data-turn-speaker="${row.id}" aria-label="Asignar hablante">${speakerOptions(row.speakerKey)}</select><time>${html(formatDuration(row.elapsed))}</time></div><p>${html(row.text)}</p></article>`}).join('');
    const liveDelta=transcriptDelta(liveInterimText,interimCommittedText);
    let live='';
    if(liveDelta){const liveSpeaker=(liveInterimSpeakerKey&&speakers.find(s=>s.key===liveInterimSpeakerKey))||speakerForTranscript();live=`<article class="skill-meeting-turn skill-meeting-turn-live"><div class="skill-meeting-turn-head"><i class="skill-meeting-turn-dot"></i><strong>${html(liveSpeaker?.label||'Voz en vivo')}</strong><time>EN VIVO</time></div><p>${html(liveDelta)}</p></article>`}
    if(!committed&&!live){host.innerHTML='<div class="skill-meeting-empty">SKILL escribe texto provisional mientras las personas siguen hablando. No necesitas esperar una pausa larga para verlo en pantalla.</div>';return}
    host.innerHTML=committed+live;
    host.querySelectorAll('[data-turn-speaker]').forEach(select=>select.addEventListener('change',()=>{const row=transcript.find(item=>item.id===Number(select.dataset.turnSpeaker));if(row){row.speakerKey=select.value;refreshSummary()}}));
    host.scrollTop=host.scrollHeight;
}

function meetingSummary(){
    const turns=transcript.length;
    const duration=startedAt?formatDuration((active?Date.now():transcript.at(-1)?.at||Date.now())-startedAt):'00:00';
    const agreements=transcript.filter(row=>/\b(acuerdo|acordamos|queda|quedamos|vamos a|se va a|debe|pendiente|responsable|compromiso|para mañana|para el lunes|fecha limite|fecha límite|hay que|necesitamos|me encargo|te encargas|se encarga)\b/i.test(row.text)).slice(-12);
    const decisions=transcript.filter(row=>/\b(decidimos|se decide|queda aprobado|aprobado|definimos|se define|entonces queda|vamos con|se autoriza)\b/i.test(row.text)).slice(-8);
    const questions=transcript.filter(row=>/[?¿]|\b(falta definir|por confirmar|queda la duda|hay que revisar|revisar si)\b/i.test(row.text)).slice(-8);
    const lines=[`Duración aproximada: ${duration}`,`Voces diferenciadas: ${speakers.length}`,`Intervenciones transcritas: ${turns}`];
    if(decisions.length){lines.push('',`Decisiones detectadas (${decisions.length}):`);decisions.forEach(row=>{const speaker=speakers.find(s=>s.key===row.speakerKey);lines.push(`• ${speaker?.label||'Voz'}: ${row.text}`)})}
    if(agreements.length){lines.push('',`Acuerdos / pendientes detectados (${agreements.length}):`);agreements.forEach(row=>{const speaker=speakers.find(s=>s.key===row.speakerKey);lines.push(`• ${speaker?.label||'Voz'}: ${row.text}`)})}
    if(questions.length){lines.push('',`Temas por confirmar (${questions.length}):`);questions.forEach(row=>{const speaker=speakers.find(s=>s.key===row.speakerKey);lines.push(`• ${speaker?.label||'Voz'}: ${row.text}`)})}
    if(!decisions.length&&!agreements.length&&!questions.length)lines.push('','Aún no se detectan decisiones, acuerdos o temas por confirmar.');
    return lines.join('\n');
}

function refreshSummary(){const node=document.getElementById('skill-meeting-summary');if(node)node.textContent=meetingSummary()}

function minutesText(){
    const title=text(document.getElementById('skill-meeting-name')?.value)||'Reunión de trabajo';
    const participants=text(document.getElementById('skill-meeting-participants')?.value);
    const date=new Date(startedAt||Date.now()).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});
    const rows=transcript.map(row=>{const speaker=speakers.find(s=>s.key===row.speakerKey);return `[${formatDuration(row.elapsed)}] ${speaker?.label||'Voz'}: ${row.text}`});
    return `${title}\nFecha: ${date}${participants?`\nParticipantes / referencia: ${participants}`:''}\n\n${meetingSummary()}\n\nTRANSCRIPCIÓN\n${rows.join('\n')}`;
}

async function copyMinutes(){
    try{await navigator.clipboard.writeText(minutesText());setState('Minuta copiada','Puedes pegarla en correo, documento o chat.')}catch(_){setState('No se pudo copiar','El navegador bloqueó el portapapeles.')}
}

function printMinutes(){
    const title=text(document.getElementById('skill-meeting-name')?.value)||'Reunión de trabajo';
    const body=minutesText();
    const win=window.open('','_blank','width=920,height=760');if(!win)return setState('Impresión bloqueada','Permite ventanas emergentes para generar la hoja.');
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${html(title)}</title><style>body{font-family:Arial,sans-serif;color:#111;padding:32px;line-height:1.45}h1{font-size:22px;margin:0 0 18px;border-bottom:2px solid #00416B;padding-bottom:10px}pre{white-space:pre-wrap;font:12px/1.6 Arial,sans-serif}.brand{font-size:10px;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:.12em}@media print{body{padding:10mm}}</style></head><body><div class="brand">Skilled Proyectos Industriales · SKILL Reuniones</div><h1>${html(title)}</h1><pre>${html(body.replace(title+'\n',''))}</pre></body></html>`);win.document.close();win.focus();setTimeout(()=>win.print(),250);
}

async function saveMinutes(){
    if(saveBusy)return;
    if(!transcript.length){setState('No hay minuta para guardar','Registra al menos una intervención.');return}
    if(!window.SkilledDB?.saveSkillMeetingV105){setState('Base de datos pendiente','Ejecuta SQL_MAESTRO_CRM.sql y publica skilled-supabase.js V105.');return}
    saveBusy=true;const button=document.getElementById('skill-meeting-save');if(button){button.disabled=true;button.textContent='Guardando…'}
    try{
        const payload={titulo:text(document.getElementById('skill-meeting-name')?.value)||'Reunión de trabajo',participantes:text(document.getElementById('skill-meeting-participants')?.value).split(/[,;\n]+/).map(text).filter(Boolean),inicio_at:new Date(startedAt||Date.now()).toISOString(),fin_at:new Date().toISOString(),duracion_seg:Math.max(0,Math.round((Date.now()-(startedAt||Date.now()))/1000)),resumen:meetingSummary(),acuerdos:transcript.filter(row=>/\b(acuerdo|acordamos|queda|quedamos|vamos a|se va a|pendiente|responsable|compromiso)\b/i.test(row.text)).map(row=>row.text).slice(-20)};
        const interventions=transcript.map((row,index)=>({turno:index+1,hablante_clave:row.speakerKey,hablante_nombre:speakers.find(s=>s.key===row.speakerKey)?.label||'Voz',texto:row.text,inicio_ms:row.elapsed,fin_ms:row.elapsed,confianza:row.confidence||0}));
        const result=await window.SkilledDB.saveSkillMeetingV105(payload,interventions);
        setState('Minuta guardada',`Reunión ${result?.id?String(result.id).slice(0,8):''} registrada en el CRM. El audio y las firmas de voz no se almacenaron.`);
        document.getElementById('skill-meeting-foot').textContent='Minuta guardada · audio no almacenado.';
    }catch(error){setState('No se pudo guardar',error?.message||'Revisa la conexión y SQL_MAESTRO_CRM.sql.')}finally{saveBusy=false;if(button){button.disabled=false;button.textContent='Guardar minuta'}}
}

function reset(){if(active)return false;speakers=[];transcript=[];speakerTimeline=[];segmentSpeakerVotes=[];pendingFinals=[];window.clearTimeout(pendingFinalTimer);pendingFinalTimer=0;window.clearTimeout(interimCommitTimer);interimCommitTimer=0;window.clearTimeout(interimRenderTimer);interimRenderTimer=0;liveInterimText='';liveInterimSpeakerKey='';liveInterimAt=0;liveInterimStartedAt=0;interimCommittedText='';segmentSequence=0;lastSpeakerKey='';currentSpeakerKey='';startedAt=0;renderSpeakers();renderTranscript();refreshSummary();setState('Reunión detenida','Pulsa Iniciar para calibrar el micrófono.');document.getElementById('skill-meeting-clock').textContent='00:00';return true}

window.SkilledMeetings=Object.freeze({open,close,start,startWithCountdown,stop,reset,isActive:()=>active,getTranscript:()=>transcript.map(row=>({...row})),getSpeakers:()=>speakers.map(({signature,...speaker})=>({...speaker}))});
})();
