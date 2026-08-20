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
let countdownBusy=false;
let emailBusy=false;
let saveBusy=false;
let pendingFinals=[];
let pendingFinalTimer=0;
const MAX_SPEAKERS=8;
const VOICE_THRESHOLD_MIN=0.016;
const SILENCE_CLOSE_MS=620;
const FEATURE_INTERVAL_MS=90;

const text=v=>String(v??'').trim();
const html=v=>text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const nowClock=()=>new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const formatDuration=ms=>{const total=Math.max(0,Math.round(ms/1000));const m=Math.floor(total/60),s=total%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function meetingNormalize(value){return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ\s]/g,' ').replace(/\s+/g,' ').trim()}
function speakMeeting(value){return new Promise(resolve=>{const message=text(value);if(!message||!window.speechSynthesis){resolve();return}try{window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(message);utterance.lang='es-MX';utterance.rate=.96;utterance.pitch=1.03;const voices=window.speechSynthesis.getVoices?.()||[];utterance.voice=voices.find(v=>/^es[-_]/i.test(v.lang)&&/mex|sabina|paulina|dalia|female|mujer/i.test(v.name))||voices.find(v=>/^es[-_]/i.test(v.lang))||null;utterance.onend=resolve;utterance.onerror=resolve;window.speechSynthesis.speak(utterance)}catch(_){resolve()}})}
function isMeetingEndCommand(value){const n=meetingNormalize(value);if(!n)return false;const wake=/\bskill\b/.test(n);const finish=/\b(?:termina|terminar|terminamos|finaliza|finalizar|finalizamos|acaba|acabamos|cerrar|cierra|ya termino|ya terminamos|ya finalizo|se acabo|hemos terminado)\b/.test(n);const meeting=/\b(?:reunion|junta|minuta|grabacion|grabación)\b/.test(n);const polite=/\bgracias\b/.test(n);return wake&&finish&&(meeting||polite)}
async function finishByVoice(){if(!active)return;setState('Cerrando reunión','Comando de voz reconocido. Preparando la minuta…');await stop({final:true});await speakMeeting('Reunión finalizada. Preparando minuta.');setState('Reunión finalizada por voz','La minuta está lista. Puedes guardarla, descargarla en Word o PDF, o enviarla por correo.')}
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
async function emailMinutes(){if(emailBusy)return;if(!transcript.length)return setState('Sin contenido','Primero registra una reunión.');const raw=prompt('Escribe uno o varios correos separados por coma:');if(raw===null)return;const recipients=raw.split(/[,;\s]+/).map(text).filter(Boolean);if(!recipients.length||recipients.some(mail=>!/^\S+@\S+\.\S+$/.test(mail)))return alert('Revisa los correos capturados.');if(!window.SkilledDB?.client?.functions)return setState('Correo no disponible','No se encontró la conexión de Supabase.');emailBusy=true;const button=document.getElementById('skill-meeting-email');if(button){button.disabled=true;button.textContent='Enviando…'}try{setState('Preparando correo','Generando Word y PDF…');const [wordBlob,pdfBlob]=await Promise.all([buildWordBlob(),buildPdfBlob()]),base=safeFileName(document.getElementById('skill-meeting-name')?.value),date=new Date().toISOString().slice(0,10),attachments=[{filename:`${base}_${date}.docx`,content:await blobBase64(wordBlob),contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},{filename:`${base}_${date}.pdf`,content:await blobBase64(pdfBlob),contentType:'application/pdf'}],{data,error}=await window.SkilledDB.client.functions.invoke('skill-enviar-minuta',{body:{to:recipients,subject:`Minuta SKILL · ${text(document.getElementById('skill-meeting-name')?.value)||'Reunión de trabajo'}`,title:text(document.getElementById('skill-meeting-name')?.value)||'Reunión de trabajo',summary:meetingSummary(),attachments}});if(error)throw error;if(data?.error)throw new Error(data.error);setState('Minuta enviada',`Correo enviado a ${recipients.join(', ')} con Word y PDF adjuntos.`)}catch(error){setState('No se pudo enviar',error?.message||'Configura RESEND_API_KEY y SKILL_MEETING_FROM_EMAIL en Supabase Secrets.')}finally{emailBusy=false;if(button){button.disabled=false;button.textContent='Correo'}}}

function styles(){
    if(document.getElementById('skill-meeting-style-v110'))return;
    const style=document.createElement('style');
    style.id='skill-meeting-style-v110';
    style.textContent=`
.skill-meeting-overlay{position:fixed;inset:0;z-index:188;background:rgba(2,5,14,.82);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:18px}.skill-meeting-overlay.open{display:flex}.skill-meeting-modal{width:min(1180px,100%);height:min(820px,94vh);border:1px solid #29476f;border-radius:14px;background:#08111f;box-shadow:0 30px 90px rgba(0,0,0,.55);display:grid;grid-template-rows:auto 1fr;overflow:hidden}.skill-meeting-head{min-height:72px;padding:14px 18px;border-bottom:1px solid #1b2b47;display:flex;align-items:center;justify-content:space-between;gap:14px}.skill-meeting-title{font-size:16px;font-weight:900;color:#f8fafc}.skill-meeting-sub{margin-top:4px;color:#71819b;font-size:9px;line-height:1.45}.skill-meeting-head-actions{display:flex;align-items:center;gap:7px}.skill-meeting-head-actions button{height:36px;border:1px solid #2a4168;border-radius:9px;background:#0d1729;color:#9db4d4;padding:0 11px;font-size:9px;font-weight:850}.skill-meeting-head-actions button:hover{color:#fff;border-color:#4d78b5}.skill-meeting-head-actions .danger{color:#fda4af}.skill-meeting-body{min-height:0;display:grid;grid-template-columns:330px minmax(0,1fr)}.skill-meeting-side{min-height:0;border-right:1px solid #1b2b47;background:#070e1b;padding:16px;overflow:auto}.skill-meeting-main{min-height:0;display:grid;grid-template-rows:auto 1fr auto;background:#091220}.skill-meeting-field{display:block;margin-top:12px}.skill-meeting-field:first-child{margin-top:0}.skill-meeting-field span{display:block;color:#70829e;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.09em}.skill-meeting-field input,.skill-meeting-field textarea{width:100%;margin-top:6px;border:1px solid #263d61;border-radius:10px;background:#050b16;color:#eaf2ff;padding:9px 10px;font-size:10px;outline:none}.skill-meeting-field textarea{resize:vertical;min-height:66px}.skill-meeting-field input:focus,.skill-meeting-field textarea:focus{border-color:#4d8fff;box-shadow:0 0 0 3px rgba(59,130,246,.08)}.skill-meeting-note{margin-top:12px;border:1px solid rgba(96,165,250,.18);border-radius:11px;background:rgba(37,99,235,.06);padding:10px;color:#7890b0;font-size:8px;line-height:1.55}.skill-meeting-status{margin-top:12px;border:1px solid #203554;border-radius:11px;background:#081426;padding:11px}.skill-meeting-status-line{display:flex;align-items:center;justify-content:space-between;gap:10px}.skill-meeting-status strong{color:#dbeafe;font-size:10px}.skill-meeting-status span{color:#71819b;font-size:8px}.skill-meeting-meter{height:28px;margin-top:9px;display:flex;align-items:center;gap:3px}.skill-meeting-meter i{display:block;flex:1;height:4px;border-radius:999px;background:#22344f;transition:.08s}.skill-meeting-meter.live i{background:#60a5fa}.skill-meeting-speakers{margin-top:14px}.skill-meeting-speakers-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.skill-meeting-speakers-head strong{font-size:9px;color:#cbd5e1}.skill-meeting-speakers-head span{font-size:8px;color:#64748b}.skill-meeting-speaker-list{display:grid;gap:7px;margin-top:8px}.skill-meeting-speaker{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:center;border:1px solid #1f3454;border-radius:9px;background:#0a1527;padding:7px}.skill-meeting-speaker-badge{width:28px;height:28px;border-radius:8px;background:#102541;border:1px solid #294d76;color:#93c5fd;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900}.skill-meeting-speaker input{width:100%;border:0;background:transparent;color:#e5edf9;font-size:9px;outline:none}.skill-meeting-summary{margin-top:14px;border-top:1px solid #172641;padding-top:13px}.skill-meeting-summary strong{font-size:9px;color:#cbd5e1}.skill-meeting-summary pre{white-space:pre-wrap;margin-top:8px;color:#8191a9;font:9px/1.6 Inter,system-ui,sans-serif}.skill-meeting-topbar{padding:12px 14px;border-bottom:1px solid #172641;display:flex;align-items:center;justify-content:space-between;gap:10px}.skill-meeting-topbar-left{display:flex;align-items:center;gap:8px;min-width:0}.skill-meeting-indicator{width:8px;height:8px;border-radius:50%;background:#64748b}.skill-meeting-indicator.live{background:#34d399;box-shadow:0 0 0 5px rgba(52,211,153,.08)}.skill-meeting-topbar strong{font-size:10px;color:#e5edf9}.skill-meeting-topbar span{font-size:8px;color:#64748b}.skill-meeting-controls{display:flex;gap:7px;flex-wrap:wrap}.skill-meeting-controls button{height:34px;border:1px solid #294064;border-radius:9px;background:#0d1729;color:#9db4d4;padding:0 10px;font-size:8px;font-weight:850}.skill-meeting-controls button.primary{background:#2563eb;border-color:#3b82f6;color:#fff}.skill-meeting-controls button.warn{border-color:#7c5b20;color:#fcd34d}.skill-meeting-controls button:disabled{opacity:.45;cursor:not-allowed}.skill-meeting-transcript{min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px}.skill-meeting-empty{margin:auto;text-align:center;color:#64748b;font-size:9px;line-height:1.6}.skill-meeting-turn{border:1px solid #1d3150;border-radius:11px;background:#0b1628;padding:10px 11px}.skill-meeting-turn-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px}.skill-meeting-turn-dot{width:8px;height:8px;border-radius:50%;background:#60a5fa}.skill-meeting-turn select{min-width:0;border:1px solid #274365;border-radius:7px;background:#071020;color:#bcd2ed;padding:5px 7px;font-size:8px}.skill-meeting-turn time{color:#5f718d;font-size:7px}.skill-meeting-turn p{margin-top:7px;color:#dbe5f3;font-size:10px;line-height:1.5;white-space:pre-wrap;word-break:break-word}.skill-meeting-footer{border-top:1px solid #172641;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#64748b;font-size:8px}.skill-meeting-footer-actions{display:flex;gap:7px}.skill-meeting-footer button{height:34px;border:1px solid #294064;border-radius:9px;background:#0d1729;color:#9db4d4;padding:0 10px;font-size:8px;font-weight:850}.skill-meeting-footer button.primary{background:#0b6ea8;border-color:#1484c0;color:#fff}.skill-meeting-countdown{position:absolute;inset:0;z-index:4;display:none;place-items:center;background:rgba(2,6,15,.86);backdrop-filter:blur(5px)}.skill-meeting-countdown.show{display:grid}.skill-meeting-countdown strong{font-size:clamp(54px,10vw,110px);color:#fff;text-shadow:0 0 35px rgba(59,130,246,.55)}.skill-meeting-countdown span{display:block;margin-top:12px;text-align:center;font-size:11px;color:#93c5fd}.skill-meeting-main{position:relative}body.tema-claro .skill-meeting-modal{background:#fff;border-color:#cbd7e8}body.tema-claro .skill-meeting-side{background:#f7f9fc;border-color:#d9e2ef}body.tema-claro .skill-meeting-main{background:#fff}body.tema-claro .skill-meeting-title,body.tema-claro .skill-meeting-topbar strong,body.tema-claro .skill-meeting-speakers-head strong{color:#111827}body.tema-claro .skill-meeting-field input,body.tema-claro .skill-meeting-field textarea,body.tema-claro .skill-meeting-speaker,body.tema-claro .skill-meeting-turn{background:#fff;color:#111827;border-color:#cbd5e1}body.tema-claro .skill-meeting-turn p{color:#334155}@media(max-width:850px){.skill-meeting-overlay{padding:0;align-items:stretch}.skill-meeting-modal{height:100dvh;max-height:100dvh;width:100%;border:0;border-radius:0}.skill-meeting-body{grid-template-columns:1fr}.skill-meeting-side{display:none}.skill-meeting-head{padding-top:max(12px,env(safe-area-inset-top))}.skill-meeting-topbar{align-items:flex-start;flex-direction:column}.skill-meeting-controls{width:100%}.skill-meeting-controls button{flex:1}.skill-meeting-footer{padding-bottom:calc(10px + env(safe-area-inset-bottom));align-items:stretch;flex-direction:column}.skill-meeting-footer-actions{display:grid;grid-template-columns:1fr 1fr}.skill-meeting-footer button{width:100%}}
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
<header class="skill-meeting-head"><div><div id="skill-meeting-title" class="skill-meeting-title">SKILL · Modo reunión <span style="color:#60a5fa;font-size:9px">BETA</span></div><div class="skill-meeting-sub">Transcripción y diferenciación temporal de voces. Las firmas acústicas se usan únicamente durante la reunión y no se guardan.</div></div><div class="skill-meeting-head-actions"><button id="skill-meeting-help" type="button">Cómo funciona</button><button id="skill-meeting-close" type="button">Cerrar</button></div></header>
<div class="skill-meeting-body">
<aside class="skill-meeting-side">
<label class="skill-meeting-field"><span>Título</span><input id="skill-meeting-name" value="Reunión de trabajo" maxlength="160"></label>
<label class="skill-meeting-field"><span>Participantes / referencia</span><textarea id="skill-meeting-participants" placeholder="Ej. Leobardo, Compras, Planeación. Sirve como referencia; SKILL no asume que una voz pertenece a una persona hasta que la etiquetes."></textarea></label>
<div class="skill-meeting-note"><strong style="color:#9fc5f2">Diferenciación de voces:</strong> SKILL agrupa turnos por características acústicas temporales y crea etiquetas como “Voz 1” y “Voz 2”. Puedes renombrarlas durante la reunión. No es reconocimiento biométrico de identidad y no se conserva una huella de voz.</div>
<div class="skill-meeting-status"><div class="skill-meeting-status-line"><strong id="skill-meeting-mic-state">Micrófono detenido</strong><span id="skill-meeting-clock">00:00</span></div><div id="skill-meeting-meter" class="skill-meeting-meter">${'<i></i>'.repeat(18)}</div><div class="skill-meeting-status-line" style="margin-top:6px"><span id="skill-meeting-engine">Voz · esperando</span><span id="skill-meeting-noise">Ruido base —</span></div></div>
<section class="skill-meeting-speakers"><div class="skill-meeting-speakers-head"><strong>Voces detectadas</strong><span id="skill-meeting-speaker-count">0</span></div><div id="skill-meeting-speaker-list" class="skill-meeting-speaker-list"><span style="font-size:8px;color:#64748b">Aparecerán al comenzar a hablar.</span></div></section>
<section class="skill-meeting-summary"><strong>Resumen de trabajo</strong><pre id="skill-meeting-summary">Todavía no hay intervenciones.</pre></section>
</aside>
<main class="skill-meeting-main"><div id="skill-meeting-countdown" class="skill-meeting-countdown"><div><strong id="skill-meeting-countdown-value">3</strong><span id="skill-meeting-countdown-label">Empezando grabación</span></div></div><div class="skill-meeting-topbar"><div class="skill-meeting-topbar-left"><i id="skill-meeting-indicator" class="skill-meeting-indicator"></i><div><strong id="skill-meeting-live-label">Reunión detenida</strong><span id="skill-meeting-live-detail" style="display:block;margin-top:2px">Pulsa Iniciar o di “Skill, vamos a iniciar reunión”.</span></div></div><div class="skill-meeting-controls"><button id="skill-meeting-start" class="primary" type="button">Iniciar</button><button id="skill-meeting-pause" type="button" disabled>Pausar</button><button id="skill-meeting-stop" class="warn" type="button" disabled>Finalizar</button></div></div><section id="skill-meeting-transcript" class="skill-meeting-transcript"><div class="skill-meeting-empty">SKILL puede separar turnos por voz y transcribir lo que se dice. Durante una reunión puedes decir “ya terminó la reunión, Skill, gracias” para finalizarla.</div></section><footer class="skill-meeting-footer"><span id="skill-meeting-foot">No se almacena audio.</span><div class="skill-meeting-footer-actions"><button id="skill-meeting-copy" type="button">Copiar</button><button id="skill-meeting-word" type="button">Word</button><button id="skill-meeting-pdf" type="button">PDF</button><button id="skill-meeting-email" type="button">Correo</button><button id="skill-meeting-save" class="primary" type="button">Guardar</button></div></footer></main>
</div></section>`;
    document.body.appendChild(overlay);
    document.getElementById('skill-meeting-close').addEventListener('click',close);
    document.getElementById('skill-meeting-help').addEventListener('click',()=>alert('SKILL escucha el micrófono, diferencia turnos por rasgos acústicos temporales y asigna cada transcripción a la voz activa. Puedes renombrar Voz 1, Voz 2, etc. No identifica personas biométricamente. Puedes iniciar con “Skill, vamos a iniciar reunión”, finalizar con “ya terminó la reunión, Skill, gracias”, guardar la minuta en el CRM, descargar Word/PDF o enviarlos por correo. El audio y las firmas acústicas no se guardan.'));
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
        stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
        audioContext=new (window.AudioContext||window.webkitAudioContext)();
        await audioContext.resume();
        sourceNode=audioContext.createMediaStreamSource(stream);
        analyser=audioContext.createAnalyser();
        analyser.fftSize=2048;
        analyser.smoothingTimeConstant=.65;
        sourceNode.connect(analyser);
        active=true;paused=false;startedAt=Date.now();speechActive=false;featureFrames=[];speakerTimeline=[];lastSpeakerKey='';currentSpeakerKey='';pendingFinals=[];window.clearTimeout(pendingFinalTimer);pendingFinalTimer=0;
        setState('Calibrando ambiente','Habla con normalidad; SKILL ajustará el ruido base durante los primeros segundos.');
        document.getElementById('skill-meeting-mic-state').textContent='Micrófono activo';
        document.getElementById('skill-meeting-engine').textContent='Voz · diferenciación local';
        updateControls();
        startRecognition();
        meterTimer=window.setInterval(analyseFrame,FEATURE_INTERVAL_MS);
        window.setTimeout(()=>{if(active&&!paused)setState('Escuchando reunión','SKILL está separando turnos por voz y transcribiendo lo que entiende.');},1800);
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
        speechActive=false;featureFrames=[];silenceStartedAt=0;
        try{recognition?.stop()}catch(_){}
        setState('Reunión pausada','No se están registrando intervenciones.');
        document.getElementById('skill-meeting-mic-state').textContent='Pausado';
    }else{
        setState('Escuchando reunión','La captura se reanudó.');
        document.getElementById('skill-meeting-mic-state').textContent='Micrófono activo';
        startRecognition();
    }
    updateControls();
}

async function stop(options={}){
    if(!active){if(options.final)refreshSummary();return}
    if(speechActive)finalizeSpeakerSegment(Date.now());
    await flushPendingFinals(true);
    active=false;paused=false;
    window.clearInterval(meterTimer);meterTimer=0;
    try{recognition?.stop()}catch(_){}
    recognition=null;
    await releaseAudio();
    setState('Reunión finalizada',transcript.length?'Revisa la minuta, corrige nombres de voces y guárdala cuando esté lista.':'No se registraron intervenciones.');
    document.getElementById('skill-meeting-mic-state').textContent='Micrófono detenido';
    document.getElementById('skill-meeting-engine').textContent='Voz · detenido';
    document.getElementById('skill-meeting-indicator')?.classList.remove('live');
    updateControls();
    refreshSummary();
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
    const features=frequencyFeatures(freqData,zcr/timeData.length,rms);
    const threshold=Math.max(VOICE_THRESHOLD_MIN,noiseFloor*2.25);
    const isVoice=rms>threshold;
    if(!speechActive&&!isVoice){noiseFloor=noiseFloor*.94+rms*.06}
    if(isVoice){
        if(!speechActive){speechActive=true;speechStartedAt=Date.now();featureFrames=[];silenceStartedAt=0;currentSpeakerKey=''}
        featureFrames.push(features);
        if(!currentSpeakerKey&&featureFrames.length>=4){const current=clusterSpeaker(aggregateFeatures(featureFrames));currentSpeakerKey=current?.key||''}
        silenceStartedAt=0;
    }else if(speechActive){
        if(!silenceStartedAt)silenceStartedAt=Date.now();
        if(Date.now()-silenceStartedAt>=SILENCE_CLOSE_MS)finalizeSpeakerSegment(Date.now());
    }
    updateMeter(rms,threshold);
    const clock=document.getElementById('skill-meeting-clock');if(clock)clock.textContent=formatDuration(Date.now()-startedAt);
    const noise=document.getElementById('skill-meeting-noise');if(noise)noise.textContent=`Ruido base ${(noiseFloor*1000).toFixed(1)}`;
}

function frequencyFeatures(freqData,zcr,rms){
    let total=0,weighted=0,low=0,mid=0,high=0;
    const nyquist=(audioContext?.sampleRate||48000)/2;
    for(let i=0;i<freqData.length;i++){
        const db=freqData[i];
        const amp=Number.isFinite(db)?Math.pow(10,db/20):0;
        const energy=amp*amp;
        const hz=i/freqData.length*nyquist;
        total+=energy;weighted+=energy*hz;
        if(hz<500)low+=energy;else if(hz<2000)mid+=energy;else if(hz<5000)high+=energy;
    }
    total=Math.max(total,1e-12);
    return [clamp((weighted/total)/5000,0,1.5),clamp(zcr*8,0,1.5),low/total,mid/total,high/total,clamp(rms*12,0,1.5)];
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
    const weights=[1.45,1.15,1.1,1.25,1.25,.25];
    let sum=0,weight=0;
    for(let i=0;i<Math.min(a.length,b.length);i++){sum+=Math.pow((a[i]-b[i])*weights[i],2);weight+=weights[i]}
    return Math.sqrt(sum/Math.max(1,weight));
}

function clusterSpeaker(signature){
    if(!signature){return ensureSpeaker('Voz 1',signature)}
    if(!speakers.length)return ensureSpeaker('Voz 1',signature);
    const ranked=speakers.map(speaker=>({speaker,distance:featureDistance(signature,speaker.signature)})).sort((a,b)=>a.distance-b.distance);
    const best=ranked[0];
    const adaptive=best?.speaker?.samples>=5?.19:.23;
    if(best&&best.distance<=adaptive){
        const speaker=best.speaker;
        speaker.samples+=1;
        if(speaker.signature)speaker.signature=speaker.signature.map((value,index)=>value*.84+signature[index]*.16);else speaker.signature=signature;
        speaker.lastDistance=best.distance;
        return speaker;
    }
    if(speakers.length>=MAX_SPEAKERS)return best.speaker;
    return ensureSpeaker(`Voz ${speakers.length+1}`,signature);
}

function ensureSpeaker(label,signature){
    const key=`voz_${speakers.length+1}`;
    const speaker={key,label,samples:1,signature:signature?signature.slice():null,lastDistance:0};
    speakers.push(speaker);renderSpeakers();return speaker;
}

function finalizeSpeakerSegment(endAt){
    if(!speechActive)return;
    const signature=aggregateFeatures(featureFrames);
    let speaker=currentSpeakerKey?speakers.find(item=>item.key===currentSpeakerKey):null;
    if(!speaker)speaker=clusterSpeaker(signature);
    else if(signature){speaker.samples+=1;speaker.signature=speaker.signature?speaker.signature.map((value,index)=>value*.9+signature[index]*.1):signature.slice()}
    speakerTimeline.push({speakerKey:speaker.key,start:speechStartedAt,end:endAt});
    if(speakerTimeline.length>40)speakerTimeline=speakerTimeline.slice(-40);
    lastSpeakerKey=speaker.key;
    speechActive=false;featureFrames=[];silenceStartedAt=0;speechStartedAt=0;currentSpeakerKey='';
}

function startRecognition(){
    if(!active||paused)return;
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){document.getElementById('skill-meeting-engine').textContent='Texto · reconocimiento no disponible';return}
    try{recognition?.abort()}catch(_){}
    recognition=new Recognition();
    recognition.lang='es-MX';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=3;
    recognition.onresult=event=>{
        for(let i=event.resultIndex;i<event.results.length;i++){
            const result=event.results[i];
            if(!result.isFinal)continue;
            let best='';let confidence=-1;
            for(let j=0;j<result.length;j++){const value=text(result[j]?.transcript);const score=Number(result[j]?.confidence)||0;if(value&&(score>confidence||!best)){best=value;confidence=score}}
            if(best){if(isMeetingEndCommand(best)){finishByVoice();return}queueTranscript(best,confidence)}
        }
    };
    recognition.onerror=event=>{if(['no-speech','aborted'].includes(event.error))return;document.getElementById('skill-meeting-engine').textContent=`Texto · ${event.error||'error'}`};
    recognition.onend=()=>{if(active&&!paused)window.setTimeout(()=>{try{recognition?.start()}catch(_){}},250)};
    try{recognition.start();document.getElementById('skill-meeting-engine').textContent='Voz · sincronización de hablante V112'}catch(_){}
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

function appendTranscript(value,confidence=0,resolvedSpeaker=null){
    const clean=text(value).replace(/\s+/g,' ');if(!clean)return;
    const speaker=resolvedSpeaker||speakerForTranscript();
    const last=transcript[transcript.length-1];
    if(last&&last.speakerKey===speaker.key&&Date.now()-last.at<1800){last.text=`${last.text} ${clean}`.trim();last.confidence=Math.max(last.confidence||0,confidence||0);last.at=Date.now();}
    else transcript.push({id:++segmentSequence,speakerKey:speaker.key,text:clean,at:Date.now(),elapsed:Math.max(0,Date.now()-startedAt),confidence:Number(confidence)||0});
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
    if(!transcript.length){host.innerHTML='<div class="skill-meeting-empty">SKILL puede separar turnos por voz y transcribir lo que se dice. Si el navegador no ofrece reconocimiento de voz, podrás seguir usando el registro manual y la diferenciación acústica.</div>';return}
    host.innerHTML=transcript.map(row=>{const speaker=speakers.find(s=>s.key===row.speakerKey);return `<article class="skill-meeting-turn" data-turn="${row.id}"><div class="skill-meeting-turn-head"><i class="skill-meeting-turn-dot"></i><select data-turn-speaker="${row.id}" aria-label="Asignar hablante">${speakerOptions(row.speakerKey)}</select><time>${html(formatDuration(row.elapsed))}</time></div><p>${html(row.text)}</p></article>`}).join('');
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

function reset(){if(active)return false;speakers=[];transcript=[];speakerTimeline=[];pendingFinals=[];window.clearTimeout(pendingFinalTimer);pendingFinalTimer=0;segmentSequence=0;lastSpeakerKey='';currentSpeakerKey='';startedAt=0;renderSpeakers();renderTranscript();refreshSummary();setState('Reunión detenida','Pulsa Iniciar para calibrar el micrófono.');document.getElementById('skill-meeting-clock').textContent='00:00';return true}

window.SkilledMeetings=Object.freeze({open,close,start,startWithCountdown,stop,reset,isActive:()=>active,getTranscript:()=>transcript.map(row=>({...row})),getSpeakers:()=>speakers.map(({signature,...speaker})=>({...speaker}))});
})();
