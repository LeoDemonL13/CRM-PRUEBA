(function(){const profile=new URLSearchParams(location.search).get('perfil');if(profile==='gerente_general'||profile==='subgerente'){const home=profile==='gerente_general'?'GG.inicio.html':'SG.inicio.html';document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('a[href="AL.inicio.html"]').forEach(a=>a.href=home);});}})();
(function(){
'use strict';
const $=id=>document.getElementById(id);
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const lower=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX');
const esc=value=>clean(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const setValue=(id,value)=>{const element=$(id);if(!element)return;let next=value??'';if(element.type==='date'&&next)next=String(next).slice(0,10);element.value=String(next)};
const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0};
const money=value=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(number(value));
const date=value=>{if(!value)return'—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?clean(value):parsed.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:value.includes?.('T')?'short':undefined})};
const dateInput=value=>{const parsed=value?new Date(value):new Date();if(Number.isNaN(parsed.getTime()))return'';const local=new Date(parsed.getTime()-parsed.getTimezoneOffset()*60000);return local.toISOString().slice(0,16)};
const today=()=>new Date().toISOString().slice(0,10);
const typeLabels={pickup:'Pickup',camioneta:'Camioneta',automovil:'Automóvil',van:'Van',camion:'Camión',motocicleta:'Motocicleta',montacargas:'Montacargas',generador_movil:'Generador móvil / Genny',maquinaria_movil:'Maquinaria móvil'};
const typeColors={pickup:'#ef4444',camioneta:'#ef4444',automovil:'#3b82f6',van:'#8b5cf6',camion:'#f59e0b',motocicleta:'#10b981',montacargas:'#f97316',generador_movil:'#06b6d4',maquinaria_movil:'#64748b'};
const allowedVehicleTypes=Object.freeze(Object.keys(typeLabels));
const vehicleTypeAliases=Object.freeze({pickup:'pickup',camioneta:'camioneta',automovil:'automovil',coche:'automovil',sedan:'automovil',van:'van',minivan:'van',camion:'camion',tractocamion:'camion',motocicleta:'motocicleta',moto:'motocicleta',montacargas:'montacargas',genny:'generador_movil',generador:'generador_movil',generador_movil:'generador_movil',maquinaria:'maquinaria_movil',maquinaria_movil:'maquinaria_movil'});
const titleCase=value=>clean(value).toLocaleLowerCase('es-MX').replace(/(^|[\s_-])([a-záéíóúñ])/g,(m,p,c)=>p+c.toLocaleUpperCase('es-MX')).replaceAll('_',' ');
const vehicleTypeKey=value=>lower(value).replace(/\s+/g,'_');
const normalizeVehicleType=value=>vehicleTypeAliases[vehicleTypeKey(value)]||'';
const vehicleTypeLabel=value=>typeLabels[normalizeVehicleType(value)||vehicleTypeKey(value)]||titleCase(value)||'Sin clasificación';
const vehicleTypeColor=value=>{const key=vehicleTypeKey(value);if(typeColors[key])return typeColors[key];const palette=['#ec4899','#14b8a6','#a855f7','#eab308','#0ea5e9','#84cc16','#f43f5e'];let hash=0;for(const ch of key)hash=(hash*31+ch.charCodeAt(0))>>>0;return palette[hash%palette.length]};
const vehicleShapeKey=value=>{const key=normalizeVehicleType(value)||vehicleTypeKey(value);if(key==='pickup')return'pickup';if(key==='camioneta')return'suv';if(key==='automovil')return'car';if(key==='van')return'van';if(key==='camion')return'truck';if(key==='motocicleta')return'motorcycle';if(key==='montacargas')return'forklift';if(key==='generador_movil')return'equipment';if(key==='maquinaria_movil')return'machinery';return'car'};
let vehicleSvgSequence=0;
function vehicleSilhouette(value){
 const shape=vehicleShapeKey(value);
 const uid=`veh-${shape}-${++vehicleSvgSequence}`;
 const common='class="vehicle-silhouette" viewBox="0 0 360 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true"';
 const defs=`<defs>
  <linearGradient id="${uid}-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#36567f"/><stop offset=".32" stop-color="#223b60"/><stop offset=".72" stop-color="#152944"/><stop offset="1" stop-color="#0c1729"/></linearGradient>
  <linearGradient id="${uid}-body2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d4a72"/><stop offset="1" stop-color="#101d31"/></linearGradient>
  <linearGradient id="${uid}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#276593" stop-opacity=".78"/><stop offset=".5" stop-color="#163c61" stop-opacity=".74"/><stop offset="1" stop-color="#071829" stop-opacity=".9"/></linearGradient>
  <linearGradient id="${uid}-cabin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3151"/><stop offset="1" stop-color="#0c182b"/></linearGradient>
  <linearGradient id="${uid}-bed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15263d"/><stop offset="1" stop-color="#091321"/></linearGradient>
  <linearGradient id="${uid}-tire" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#02050a"/><stop offset=".5" stop-color="#131b27"/><stop offset="1" stop-color="#02050a"/></linearGradient>
  <linearGradient id="${uid}-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb1c9"/><stop offset=".5" stop-color="#56677e"/><stop offset="1" stop-color="#27374c"/></linearGradient>
  <filter id="${uid}-shadow" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000" flood-opacity=".42"/></filter>
 </defs>`;
 const tire=(x,y,w=24,h=88)=>`<g class="v19-wheel"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(10,w/2)}" fill="url(#${uid}-tire)" stroke="#334155" stroke-width="1.5"/><rect x="${x+w*.28}" y="${y+8}" width="${w*.44}" height="${h-16}" rx="${Math.max(3,w*.2)}" fill="#1b2737" opacity=".86"/><path d="M${x+3} ${y+18}H${x+w-3}M${x+3} ${y+h/2}H${x+w-3}M${x+3} ${y+h-18}H${x+w-3}" stroke="#64748b" stroke-opacity=".28" stroke-width="1.2"/></g>`;
 const roundTire=(cx,cy,rx,ry)=>`<g><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${uid}-tire)" stroke="#475569" stroke-width="1.8"/><ellipse cx="${cx}" cy="${cy}" rx="${rx*.46}" ry="${ry*.46}" fill="#172234" stroke="#64748b" stroke-opacity=".45" stroke-width="1.2"/></g>`;
 const mirror=(left=true,y=187)=>left?`<path class="v19-mirror" d="M83 ${y}L44 ${y+13}Q36 ${y+17} 41 ${y+27}L91 ${y+18}Z"/>`:`<path class="v19-mirror" d="M277 ${y}L316 ${y+13}Q324 ${y+17} 319 ${y+27}L269 ${y+18}Z"/>`;
 const headlight=(left=true,y=56)=>left?`<path class="v19-headlight" d="M101 ${y}L142 ${y-12}L148 ${y+6}L107 ${y+18}Z"/>`:`<path class="v19-headlight" d="M259 ${y}L218 ${y-12}L212 ${y+6}L253 ${y+18}Z"/>`;
 const shapes={
  car:`
   <ellipse class="v19-ground" cx="180" cy="300" rx="135" ry="240"/>
   <g filter="url(#${uid}-shadow)">${tire(29,105,24,86)}${tire(307,105,24,86)}${tire(29,370,24,86)}${tire(307,370,24,86)}
   <path class="v19-body" fill="url(#${uid}-body)" d="M139 16Q180 5 221 16L256 31Q286 48 297 93L306 139L310 426Q311 468 285 505Q257 543 180 554Q103 543 75 505Q49 468 50 426L54 139L63 93Q74 48 104 31Z"/>
   <path class="v19-highlight" d="M121 34Q180 15 239 34Q267 47 279 83"/>
   <path class="v19-hood" fill="url(#${uid}-body2)" d="M101 65Q180 39 259 65L268 149H92Z"/>
   <path class="v19-ridge" d="M130 61Q180 47 230 61M119 91Q180 74 241 91"/>
   <rect class="v19-grille" x="140" y="38" width="80" height="8" rx="4"/>
   ${headlight(true,55)}${headlight(false,55)}
   <path class="v19-glass" fill="url(#${uid}-glass)" d="M103 158Q180 131 257 158L263 222H97Z"/>
   <path class="v19-pillar" d="M114 161L137 218M246 161L223 218"/>
   <path class="v19-cabin" fill="url(#${uid}-cabin)" d="M96 232Q180 210 264 232L260 379Q180 404 100 379Z"/>
   <path class="v19-sideglass" fill="url(#${uid}-glass)" d="M104 244L136 229V369L112 356Z"/><path class="v19-sideglass" fill="url(#${uid}-glass)" d="M256 244L224 229V369L248 356Z"/>
   <path class="v19-door" d="M137 229L131 379M223 229L229 379M101 307H259"/>
   <path class="v19-rearglass" fill="url(#${uid}-glass)" d="M109 390H251L237 445Q180 466 123 445Z"/>
   <path class="v19-trunk" fill="url(#${uid}-body2)" d="M122 452Q180 475 238 452L246 493Q221 517 180 521Q139 517 114 493Z"/>
   <path class="v19-tail" d="M126 481Q180 498 234 481"/>
   ${mirror(true,184)}${mirror(false,184)}
   <path class="v19-taillight" d="M104 474L130 485L124 506L99 493Z"/><path class="v19-taillight" d="M256 474L230 485L236 506L261 493Z"/>
   </g>`,
  suv:`
   <ellipse class="v19-ground" cx="180" cy="301" rx="145" ry="246"/>
   <g filter="url(#${uid}-shadow)">${tire(22,105,29,96)}${tire(309,105,29,96)}${tire(22,373,29,96)}${tire(309,373,29,96)}
   <path class="v19-body" fill="url(#${uid}-body)" d="M132 14Q180 4 228 14L264 27Q295 41 306 84L314 129L314 438Q314 483 284 518Q247 552 180 558Q113 552 76 518Q46 483 46 438L46 129L54 84Q65 41 96 27Z"/>
   <path class="v19-highlight" d="M111 37Q180 15 249 37Q277 51 289 92"/>
   <path class="v19-hood" fill="url(#${uid}-body2)" d="M96 60Q180 34 264 60L274 145H86Z"/>
   <path class="v19-ridge" d="M126 58Q180 45 234 58M112 94Q180 78 248 94"/>
   <rect class="v19-grille" x="132" y="34" width="96" height="9" rx="4.5"/>
   ${headlight(true,52)}${headlight(false,52)}
   <path class="v19-glass" fill="url(#${uid}-glass)" d="M99 154Q180 125 261 154L269 225H91Z"/>
   <path class="v19-cabin" fill="url(#${uid}-cabin)" d="M88 234Q180 211 272 234L270 406Q180 430 90 406Z"/>
   <path class="v19-sideglass" fill="url(#${uid}-glass)" d="M97 246L132 229V397L103 383Z"/><path class="v19-sideglass" fill="url(#${uid}-glass)" d="M263 246L228 229V397L257 383Z"/>
   <path class="v19-door" d="M136 229L130 408M224 229L230 408M91 317H269"/>
   <path class="v19-rail" d="M108 166V408M252 166V408"/>
   <path class="v19-rearglass" fill="url(#${uid}-glass)" d="M99 416H261L246 471Q180 495 114 471Z"/>
   <path class="v19-tail" d="M112 479Q180 503 248 479"/>
   ${mirror(true,184)}${mirror(false,184)}
   <path class="v19-taillight" d="M85 481L113 494L107 518L80 502Z"/><path class="v19-taillight" d="M275 481L247 494L253 518L280 502Z"/>
   </g>`,
  pickup:`
   <ellipse class="v19-ground" cx="180" cy="305" rx="146" ry="248"/>
   <g filter="url(#${uid}-shadow)">${tire(22,104,30,98)}${tire(308,104,30,98)}${tire(22,398,30,102)}${tire(308,398,30,102)}
   <path class="v19-body" fill="url(#${uid}-body)" d="M131 15Q180 4 229 15L264 27Q294 40 305 80L313 120L314 317Q314 333 301 345L294 351V514Q265 543 221 552Q180 560 139 552Q95 543 66 514V351L59 345Q46 333 46 317L47 120L55 80Q66 40 96 27Z"/>
   <path class="v19-fender" d="M53 121Q34 143 42 199M307 121Q326 143 318 199M65 398Q41 422 47 489M295 398Q319 422 313 489"/>
   <path class="v19-highlight" d="M108 38Q180 14 252 38Q280 51 292 91"/>
   <path class="v19-hood" fill="url(#${uid}-body2)" d="M96 57Q180 32 264 57L274 145H86Z"/>
   <path class="v19-ridge" d="M126 55Q180 42 234 55M111 91Q180 72 249 91M145 48V136M215 48V136"/>
   <rect class="v19-grille" x="128" y="33" width="104" height="10" rx="5"/>
   ${headlight(true,50)}${headlight(false,50)}
   <path class="v19-glass" fill="url(#${uid}-glass)" d="M98 154Q180 126 262 154L268 221H92Z"/>
   <path class="v19-pillar" d="M112 157L136 218M248 157L224 218"/>
   <path class="v19-cabin" fill="url(#${uid}-cabin)" d="M91 230Q180 207 269 230L265 318Q180 336 95 318Z"/>
   <path class="v19-sideglass" fill="url(#${uid}-glass)" d="M101 240L137 225V310L108 302Z"/><path class="v19-sideglass" fill="url(#${uid}-glass)" d="M259 240L223 225V310L252 302Z"/>
   <path class="v19-door" d="M138 225L133 319M222 225L227 319M94 275H266"/>
   <path class="v19-rearglass" fill="url(#${uid}-glass)" d="M117 319H243L237 343H123Z"/>
   <path class="v19-bed-rail" fill="url(#${uid}-body2)" d="M68 345H292V518Q264 543 220 551Q180 558 140 551Q96 543 68 518Z"/>
   <rect class="v19-bed" x="84" y="360" width="192" height="143" rx="15" fill="url(#${uid}-bed)"/>
   <rect class="v19-bed-floor" x="96" y="372" width="168" height="118" rx="9"/>
   <path class="v19-bed-rib" d="M113 377V485M140 377V485M167 377V485M194 377V485M221 377V485M248 377V485M96 402H264M96 445H264"/>
   <path class="v19-wheelwell" d="M84 408Q104 390 121 410V463Q103 478 84 461M276 408Q256 390 239 410V463Q257 478 276 461"/>
   <path class="v19-tailgate" d="M84 494H276M119 506H241"/>
   ${mirror(true,182)}${mirror(false,182)}
   <path class="v19-taillight" d="M67 475H86V516H63Z"/><path class="v19-taillight" d="M293 475H274V516H297Z"/>
   </g>`,
  van:`
   <ellipse class="v19-ground" cx="180" cy="302" rx="149" ry="250"/>
   <g filter="url(#${uid}-shadow)">${tire(19,105,31,102)}${tire(310,105,31,102)}${tire(19,388,31,102)}${tire(310,388,31,102)}
   <path class="v19-body" fill="url(#${uid}-body)" d="M119 13Q180 3 241 13L276 23Q303 32 314 68L321 105L321 469Q321 507 291 534Q249 557 180 559Q111 557 69 534Q39 507 39 469L39 105L46 68Q57 32 84 23Z"/>
   <path class="v19-highlight" d="M94 38Q180 14 266 38Q288 50 299 84"/>
   <path class="v19-glass" fill="url(#${uid}-glass)" d="M94 66Q180 40 266 66L274 153H86Z"/>
   <path class="v19-cabin" fill="url(#${uid}-cabin)" d="M81 165Q180 145 279 165L279 438Q180 458 81 438Z"/>
   <path class="v19-sideglass" fill="url(#${uid}-glass)" d="M91 177H132V425H93Z"/><path class="v19-sideglass" fill="url(#${uid}-glass)" d="M269 177H228V425H267Z"/>
   <path class="v19-door" d="M133 160V440M227 160V440M84 248H276M84 328H276M84 407H276"/>
   <path class="v19-rearglass" fill="url(#${uid}-glass)" d="M96 447H264V490Q224 512 180 515Q136 512 96 490Z"/>
   <path class="v19-step" d="M66 235V420M294 235V420"/>
   ${mirror(true,155)}${mirror(false,155)}
   ${headlight(true,47)}${headlight(false,47)}
   <path class="v19-taillight" d="M64 468H83V518H59Z"/><path class="v19-taillight" d="M296 468H277V518H301Z"/>
   </g>`,
  truck:`
   <ellipse class="v19-ground" cx="180" cy="310" rx="154" ry="245"/>
   <g filter="url(#${uid}-shadow)">${tire(16,104,35,106)}${tire(309,104,35,106)}${tire(16,393,35,110)}${tire(309,393,35,110)}
   <path class="v19-cabbody" fill="url(#${uid}-body)" d="M96 15H264Q287 15 293 40L299 74V237Q299 255 285 266H75Q61 255 61 237V74L67 40Q73 15 96 15Z"/>
   <path class="v19-highlight" d="M88 34Q180 17 272 34"/>
   <rect class="v19-grille" x="116" y="25" width="128" height="11" rx="5.5"/>
   <path class="v19-glass" fill="url(#${uid}-glass)" d="M95 65H265L271 148H89Z"/>
   <path class="v19-cabin" fill="url(#${uid}-cabin)" d="M85 159H275V236H85Z"/>
   <path class="v19-sideglass" fill="url(#${uid}-glass)" d="M94 168H132V228H94Z"/><path class="v19-sideglass" fill="url(#${uid}-glass)" d="M266 168H228V228H266Z"/>
   <path class="v19-door" d="M134 158V238M226 158V238M180 150V238"/>
   <path class="v19-chassis" d="M83 265H277V292H83Z"/>
   <rect class="v19-truckbox" x="49" y="289" width="262" height="246" rx="10" fill="url(#${uid}-body2)"/>
   <rect class="v19-bed" x="66" y="305" width="228" height="213" rx="6" fill="url(#${uid}-bed)"/>
   <path class="v19-bed-rib" d="M89 312V511M121 312V511M153 312V511M185 312V511M217 312V511M249 312V511M281 312V511M66 348H294M66 400H294M66 452H294"/>
   ${mirror(true,126)}${mirror(false,126)}
   <path class="v19-headlight" d="M89 45H132V65H89Z"/><path class="v19-headlight" d="M271 45H228V65H271Z"/>
   <path class="v19-taillight" d="M50 496H69V533H50Z"/><path class="v19-taillight" d="M310 496H291V533H310Z"/>
   </g>`,
  motorcycle:`
   <ellipse class="v19-ground" cx="180" cy="300" rx="65" ry="240"/>
   <g filter="url(#${uid}-shadow)">${roundTire(180,54,35,42)}${roundTire(180,506,38,43)}
   <path class="v19-body" fill="url(#${uid}-body)" d="M159 90Q180 72 201 90L216 173L207 236L221 414Q180 446 139 414L153 236L144 173Z"/>
   <path class="v19-glass" fill="url(#${uid}-glass)" d="M157 122Q180 106 203 122L205 165H155Z"/>
   <path class="v19-cabin" fill="url(#${uid}-cabin)" d="M148 197Q180 175 212 197L205 366Q180 388 155 366Z"/>
   <path class="v19-bike-detail" d="M127 181H233M137 168L127 181L137 194M223 168L233 181L223 194M180 177V400"/>
   </g>`,
  forklift:`
   <ellipse class="v19-ground" cx="180" cy="305" rx="120" ry="230"/>
   <g filter="url(#${uid}-shadow)">${tire(50,151,34,82)}${tire(276,151,34,82)}${tire(55,350,31,88)}${tire(274,350,31,88)}
   <rect class="v19-body" x="70" y="88" width="220" height="342" rx="34" fill="url(#${uid}-body)"/>
   <rect class="v19-cabin" x="104" y="129" width="152" height="162" rx="24" fill="url(#${uid}-cabin)"/>
   <path class="v19-cage" d="M103 122V74H257V122M116 74V42M244 74V42M116 42H244"/>
   <path class="v19-door" d="M180 110V409M93 303H267"/>
   <path class="v19-fork" d="M108 427H144V553H108ZM216 427H252V553H216ZM98 426H262"/>
   </g>`,
  equipment:`
   <ellipse class="v19-ground" cx="180" cy="305" rx="128" ry="224"/>
   <g filter="url(#${uid}-shadow)">${tire(43,151,32,96)}${tire(285,151,32,96)}${tire(43,350,32,96)}${tire(285,350,32,96)}
   <rect class="v19-body" x="61" y="82" width="238" height="394" rx="34" fill="url(#${uid}-body)"/>
   <rect class="v19-cabin" x="103" y="122" width="154" height="136" rx="22" fill="url(#${uid}-cabin)"/>
   <path class="v19-door" d="M180 103V454M85 282H275M85 337H275M85 392H275"/>
   <circle class="v19-machine" cx="120" cy="365" r="19"/><circle class="v19-machine" cx="180" cy="365" r="19"/><circle class="v19-machine" cx="240" cy="365" r="19"/>
   </g>`,
  machinery:`
   <ellipse class="v19-ground" cx="180" cy="305" rx="147" ry="230"/>
   <g filter="url(#${uid}-shadow)"><rect class="v19-track" x="22" y="130" width="48" height="358" rx="21"/><rect class="v19-track" x="290" y="130" width="48" height="358" rx="21"/>
   <rect class="v19-body" x="61" y="71" width="238" height="402" rx="35" fill="url(#${uid}-body)"/>
   <rect class="v19-cabin" x="100" y="116" width="160" height="168" rx="24" fill="url(#${uid}-cabin)"/>
   <path class="v19-door" d="M180 93V451M84 307H276"/>
   <path class="v19-arm" d="M180 454V520M180 496L120 548M180 496L240 548"/>
   </g>`
 };
 return`<svg ${common}>${defs}${shapes[shape]||shapes.car}</svg>`
}
function seatGraphicHtml(driver=false){return`<span class="seat-visual" aria-hidden="true"><span class="seat-headrest"></span><span class="seat-backrest"></span><span class="seat-cushion"></span><span class="seat-belt"></span>${driver?'<span class="seat-wheel"></span>':''}</span>`}
function seatRowClass(count){const safe=Math.max(1,Math.min(5,Math.trunc(number(count))||1));return`seat-count-${safe}`}
function cargoLabel(shape){if(shape==='pickup')return'<span class="vehicle-seat-zone-label cargo">Caja de carga</span>';if(shape==='truck')return'<span class="vehicle-seat-zone-label cargo">Área de carga</span>';return''}
function seatShellHtml(vehicle,content,rowCount=1){const shape=vehicleShapeKey(vehicle?.tipo);return`<div class="vehicle-seat-stage"><div class="vehicle-seat-shell" data-shape="${shape}" style="--seat-rows:${Math.max(1,rowCount)}">${vehicleSilhouette(vehicle?.tipo)}<span class="vehicle-seat-front">Frente</span><div class="vehicle-cabin-floor" aria-hidden="true"><span class="vehicle-dashboard"></span><span class="vehicle-console"></span></div><div class="vehicle-seat-cabin">${content}</div>${cargoLabel(shape)}<span class="vehicle-seat-rear">Parte trasera</span></div><div class="seat-map-legend"><span class="driver"><i></i>Conductor</span><span><i></i>Lugar libre</span><span class="assigned"><i></i>Asignado</span></div></div><div class="vehicle-seat-shape-label"><span>Vista superior</span><strong>${esc(vehicleTypeLabel(vehicle?.tipo))}</strong></div>`}
function seatPresetCandidates(capacity,type=''){
 const cap=Math.max(0,Math.trunc(number(capacity)));if(!cap)return[];
 const shape=vehicleShapeKey(type),presets=[];const add=layout=>{layout=parseSeatLayout(layout);if(layout.length&&layoutSum(layout)===cap&&!presets.some(item=>item.join(',')===layout.join(',')))presets.push(layout)};
 add(automaticSeatLayout(cap,type));
 if(['car','suv','pickup'].includes(shape)){if(cap===4)add([2,2]);if(cap===5)add([2,3]);if(cap===6){add([3,3]);add([2,2,2])};if(cap===7)add([2,3,2])}
 if(shape==='van'){if(cap>=6){let left=cap,rows=[];while(left>0){const n=Math.min(rows.length?3:2,left);rows.push(n);left-=n}add(rows)};if(cap===8)add([2,3,3]);if(cap===9)add([3,3,3])}
 if(shape==='truck'){if(cap<=3)add([cap]);else{add([2,Math.min(3,cap-2),...(cap>5?[cap-5]:[])])}}
 if(shape==='motorcycle'){add(Array.from({length:cap},()=>1))}
 if(['forklift','equipment','machinery'].includes(shape))add(Array.from({length:cap},()=>1));
 return presets.slice(0,4)
}
function renderSeatPresets(){const box=$('v-seat-presets');if(!box)return;const cap=Math.max(0,Math.trunc(number($('v-people-capacity').value)));const type=$('v-type').value;const current=parseSeatLayout($('v-seat-layout').value);const presets=seatPresetCandidates(cap,type);if(!cap){box.innerHTML='<span class="seat-layout-note">Indica primero la capacidad total.</span>';return}box.innerHTML=presets.map((layout,index)=>`<button type="button" class="seat-layout-chip ${current.join(',')===layout.join(',')?'is-active':''}" data-seat-preset="${layout.join(',')}">${index===0?'Sugerida':'Opción'} · ${layout.join(' + ')}</button>`).join('')+`<span class="seat-layout-note">${vehicleTypeLabel(type)||'Vehículo'} · ${cap} personas</span>`;box.querySelectorAll('[data-seat-preset]').forEach(button=>button.addEventListener('click',()=>{$('v-seat-layout').value=button.dataset.seatPreset;renderSeatPresets();renderVehicleSeatPreview()}))}
const statusLabels={disponible:'Disponible',asignado:'Asignado',taller:'En taller',fuera_servicio:'Fuera de servicio'};
const expenseLabels={gasolina:'Gasolina',diesel:'Diésel',carga_electrica:'Carga eléctrica',casetas:'Casetas',estacionamiento:'Estacionamiento',mantenimiento:'Mantenimiento',refacciones:'Refacciones',lavado:'Lavado',otro:'Otro'};
const statusColors={disponible:'#10b981',asignado:'#3b82f6',taller:'#f59e0b',fuera_servicio:'#f43f5e'};
let vehicles=[];
let trips=[];
let expenses=[];
let warehouses=[];
let projects=[];
let editingVehicle=null;
function vehicleById(value){const key=String(value??'');return vehicles.find(item=>String(item.id)===key)||null}
let selectedTrip=null;
let activeTab='fleet';
let busy=false;
let operationReady=true;
let vehicleImportRows=[];
let vehicleImportBusy=false;
let tripSeatAssignments={};
const fieldIds=['v-number','v-plates','v-vin','v-brand','v-model','v-year','v-type','v-color','v-fuel','v-transmission','v-ownership','v-status','v-mileage','v-capacity','v-people-capacity','v-seat-layout','v-warehouse','v-project','v-assigned','v-responsible','v-insurer','v-policy','v-insurance-date','v-verification','v-card','v-card-date','v-acquisition-date','v-cost','v-image','v-notes'];
function parseSeatLayout(value){
 const source=Array.isArray(value)?value:clean(value).split(/[,;xX\s]+/).filter(Boolean);
 return source.map(item=>Math.trunc(number(item))).filter(item=>item>0&&item<=10);
}
function automaticSeatLayout(capacity,type=''){
 let remaining=Math.max(0,Math.trunc(number(capacity)));if(!remaining)return[];
 const shape=vehicleShapeKey(type);
 if(shape==='motorcycle')return Array.from({length:remaining},()=>1);
 if(['forklift','equipment','machinery'].includes(shape))return remaining===1?[1]:Array.from({length:remaining},()=>1);
 if(shape==='truck'){if(remaining<=3)return[remaining];const rows=[3];remaining-=3;while(remaining>0){const next=Math.min(3,remaining);rows.push(next);remaining-=next}return rows}
 if(remaining<=2)return[remaining];
 const rows=[2];remaining-=2;
 while(remaining>0){const next=Math.min(3,remaining);rows.push(next);remaining-=next}
 return rows;
}
function vehicleSeatLayout(vehicle={}){
 const capacity=Math.max(0,Math.trunc(number(vehicle.capacidadPersonas??vehicle.capacidad_personas)));
 const configured=parseSeatLayout(vehicle.distribucionAsientos??vehicle.distribucion_asientos);
 return configured.length?configured:automaticSeatLayout(capacity,vehicle.tipo);
}
function seatDefinitions(vehicle={}){
 const rows=vehicleSeatLayout(vehicle);const seats=[];let global=0;
 rows.forEach((count,rowIndex)=>{for(let column=1;column<=count;column+=1){global+=1;seats.push({code:`F${rowIndex+1}-${column}`,row:rowIndex+1,column,driver:global===1,label:global===1?'Conductor':`Lugar ${global}`})}});
 return seats;
}
function layoutSum(layout){return parseSeatLayout(layout).reduce((sum,item)=>sum+item,0)}
function renderMiniSeats(vehicle,occupied=[]){
 const seats=seatDefinitions(vehicle);if(!seats.length)return'';const used=new Set((occupied||[]).map(value=>clean(value)));
 return`<div class="mini-seat-layout" title="Distribución de ${seats.length} lugares">${seats.slice(0,8).map(seat=>`<span class="${seat.driver?'driver':''} ${used.has(seat.code)?'occupied':''}">${seat.driver?'C':seat.code.replace('F','').replace('-','.')}</span>`).join('')}${seats.length>8?`<small>+${seats.length-8}</small>`:''}</div>`;
}
function renderVehicleSeatPreview(){
 const container=$('v-seat-preview');if(!container)return;
 const capacity=Math.max(0,Math.trunc(number($('v-people-capacity').value)));let layout=parseSeatLayout($('v-seat-layout').value);
 if(!layout.length&&capacity)layout=automaticSeatLayout(capacity,$('v-type').value);
 renderSeatPresets();
 if(!capacity){container.classList.add('hidden');container.innerHTML='';return}
 const mismatch=layout.reduce((sum,item)=>sum+item,0)!==capacity;
 const vehicle={tipo:normalizeVehicleType($('v-type').value)||'automovil'};
 let global=0;const rowsHtml=layout.map((count,rowIndex)=>`<div class="seat-row ${seatRowClass(count)}" style="--seat-count:${count}"><span class="seat-row-label">Fila ${rowIndex+1}</span>${Array.from({length:count},()=>{global+=1;const driver=global===1;return`<div class="seat ${driver?'is-driver':''}">${seatGraphicHtml(driver)}<span class="seat-code">${driver?'CONDUCTOR':`LUGAR ${global}`}</span><span class="seat-name">${driver?'Volante':'Disponible'}</span></div>`}).join('')}</div>`).join('');
 container.classList.remove('hidden');container.classList.toggle('seat-error',mismatch);
 container.innerHTML=`<div class="seat-summary"><span><strong>${capacity}</strong> personas en total, incluyendo conductor</span><span>${mismatch?'La distribución no coincide con la capacidad':`Distribución: ${layout.join(' + ')}`}</span></div>${seatShellHtml(vehicle,rowsHtml,layout.length)}`;
}
function passengerNames(){return clean($('trip-passengers')?.value).split(/[\n,;]+/).map(clean).filter(Boolean)}
function selectedTripVehicle(){return vehicleById($('trip-vehicle')?.value)}
function renderTripSeatMap(){
 const section=$('trip-seat-section'),map=$('trip-seat-map'),status=$('trip-capacity-status');if(!section||!map||!status)return;
 const vehicle=selectedTripVehicle();const capacity=Math.max(0,Math.trunc(number(vehicle?.capacidadPersonas)));const seats=vehicle?seatDefinitions(vehicle):[];
 if(!vehicle||!capacity||!seats.length){section.classList.add('hidden');map.innerHTML='';status.textContent='';tripSeatAssignments={};return}
 section.classList.remove('hidden');
 const driver=clean($('trip-driver').value)||'Conductor pendiente';
 const names=passengerNames();
 const validNames=new Set(names);Object.keys(tripSeatAssignments).forEach(code=>{if(!validNames.has(tripSeatAssignments[code]))delete tripSeatAssignments[code]});
 const over=names.length+1>capacity;status.textContent=`${names.length+1} de ${capacity} lugares${over?' · capacidad excedida':''}`;status.classList.toggle('seat-error',over);
 const rows=[...new Set(seats.map(seat=>seat.row))];
 const rowsHtml=rows.map(row=>{const rowSeats=seats.filter(seat=>seat.row===row);return`<div class="seat-row ${seatRowClass(rowSeats.length)}" style="--seat-count:${rowSeats.length}"><span class="seat-row-label">Fila ${row}</span>${rowSeats.map(seat=>{const assigned=seat.driver?driver:tripSeatAssignments[seat.code];return`<button type="button" class="seat ${seat.driver?'is-driver is-assigned':'is-selectable'} ${assigned&&!seat.driver?'is-assigned':''}" ${seat.driver?'disabled':''} data-seat-click="${esc(seat.code)}" title="${seat.driver?'Conductor':assigned?`Asignado a ${esc(assigned)}`:`Seleccionar ${esc(seat.label)}`}">${seatGraphicHtml(seat.driver)}<span class="seat-code">${seat.driver?'CONDUCTOR':esc(seat.label)}</span><span class="seat-name">${esc(assigned||'Disponible')}</span></button>`}).join('')}</div>`}).join('');
 const availableSeats=seats.filter(seat=>!seat.driver);
 const assignmentRows=names.map((name,index)=>{const selected=Object.entries(tripSeatAssignments).find(([,value])=>value===name)?.[0]||'';return`<label class="seat-assignment-row-v24"><div class="seat-person-v24"><span class="seat-person-index-v24">${index+1}</span><div><strong>${esc(name)}</strong><span>Pasajero</span></div></div><select data-passenger-seat="${esc(name)}"><option value="">Selecciona un lugar...</option>${availableSeats.map(seat=>`<option value="${esc(seat.code)}" ${selected===seat.code?'selected':''}>${esc(seat.label)} · Fila ${seat.row}</option>`).join('')}</select></label>`}).join('');
 const assignedCount=Object.keys(tripSeatAssignments).filter(code=>tripSeatAssignments[code]).length;
 map.classList.add('trip-seat-map-v23');
 map.innerHTML=`<div class="seat-assignment-panel-v24"><div class="seat-assignment-head-v24"><div><h4>Asignación de lugares</h4><p>Primero asigna a cada pasajero un lugar. Después puedes confirmar visualmente su posición en el vehículo.</p></div><button type="button" class="seat-auto-v24" data-seat-auto>Asignar automáticamente</button></div><div class="seat-assignment-summary-v24"><span>${assignedCount} de ${names.length} pasajeros con lugar</span><span>Conductor fijo: ${esc(seats.find(seat=>seat.driver)?.label||'Fila 1')}</span></div><div class="seat-assignment-grid-v24">${assignmentRows||'<div class="seat-empty-v24">Escribe los pasajeros arriba para habilitar la asignación de lugares.</div>'}</div></div>${seatShellHtml(vehicle,rowsHtml,rows.length)}`;
 map.querySelector('[data-seat-auto]')?.addEventListener('click',()=>{tripSeatAssignments={};let seatIndex=0;names.forEach(name=>{const seat=availableSeats[seatIndex++];if(seat)tripSeatAssignments[seat.code]=name});renderTripSeatMap()});
 map.querySelectorAll('[data-passenger-seat]').forEach(select=>select.addEventListener('change',()=>{
   const name=select.dataset.passengerSeat;Object.keys(tripSeatAssignments).forEach(code=>{if(tripSeatAssignments[code]===name)delete tripSeatAssignments[code]});
   const code=clean(select.value);if(code){const previous=tripSeatAssignments[code];if(previous&&previous!==name){Object.keys(tripSeatAssignments).forEach(k=>{if(tripSeatAssignments[k]===previous)delete tripSeatAssignments[k]})}tripSeatAssignments[code]=name}
   renderTripSeatMap();
 }));
 map.querySelectorAll('[data-seat-click]').forEach(button=>button.addEventListener('click',()=>{
   if(button.disabled)return;const code=button.dataset.seatClick;if(tripSeatAssignments[code]){delete tripSeatAssignments[code];renderTripSeatMap();return}
   const pending=names.find(name=>!Object.values(tripSeatAssignments).includes(name));if(pending){tripSeatAssignments[code]=pending;renderTripSeatMap()}
 }));
}
function tripPassengersPayload(){
 const vehicle=selectedTripVehicle();const capacity=Math.max(0,Math.trunc(number(vehicle?.capacidadPersonas)));const names=passengerNames();
 if(capacity&&names.length+1>capacity)throw new Error(`El vehículo admite ${capacity} personas en total. Reduce la lista de pasajeros.`);
 const seatByName=new Map(Object.entries(tripSeatAssignments).map(([seat,name])=>[name,seat]));
 return names.map(name=>({nombre:name,asiento:seatByName.get(name)||''}));
}
function canDelete(){return['administrador','jefe_almacen'].includes(lower(window.SkilledSession?.role||document.documentElement.dataset.role))}
function daysTo(value){if(!value)return 9999;const target=new Date(`${value}T12:00:00`);return Math.ceil((target-Date.now())/86400000)}
function setBusy(value){busy=value;$('save-vehicle').disabled=value;$('save-vehicle').textContent=value?'Guardando...':(editingVehicle?'Guardar cambios':'Registrar vehículo')}
function formMessage(text='',type='error'){const box=$('vehicle-form-message');box.textContent=text;box.className=`form-message mx-5 mt-5 rounded-xl border px-4 py-3 text-xs ${text?type:'hidden'}`}
function normalizeDateTime(value){if(!clean(value))return'';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?clean(value):parsed.toISOString()}
function monthRows(rows,getDate){const prefix=new Date().toISOString().slice(0,7);return rows.filter(item=>clean(getDate(item)).slice(0,7)===prefix)}
async function safeLoad(fn,fallback=[]){try{return await fn()}catch(error){if(/vehículos|vehiculares|control diario/i.test(error.message)){operationReady=false;console.warn(error.message);return fallback}throw error}}
async function load(show=true){
 if(show)$('loading').classList.remove('hidden');
 try{
  const results=await Promise.all([
   SkilledDB.listVehicles({includeInactive:true}),
   SkilledDB.listWarehouses(),
   SkilledDB.listProjects(),
   safeLoad(()=>SkilledDB.listVehicleTrips(),[]),
   safeLoad(()=>SkilledDB.listVehicleExpenses(),[])
  ]);
  [vehicles,warehouses,projects,trips,expenses]=results;
  fillSelects();renderAll();
 }catch(error){$('loading').innerHTML=`<span class="text-rose-400">${esc(error.message)}</span>`;console.error(error)}
}
function fillSelects(){
 const vehicleOptions=vehicles.filter(item=>item.activo!==false).map(item=>`<option value="${item.id}">${esc(item.numeroEconomico)} · ${esc(item.marca)} ${esc(item.modelo)}${item.placas?` · ${esc(item.placas)}`:''}</option>`).join('');
 $('trip-vehicle').innerHTML='<option value="">Selecciona...</option>'+vehicleOptions;
 $('expense-vehicle').innerHTML='<option value="">Selecciona...</option>'+vehicleOptions;
 $('v-warehouse').innerHTML='<option value="">Sin base</option>'+warehouses.map(item=>`<option value="${item.id}">${esc(item.nombre)}</option>`).join('');
 const projectOptions=projects.map(item=>`<option value="${esc(item.proyecto)}">${esc(item.proyecto)} · ${esc(item.nombreProyecto||'Sin nombre')}</option>`).join('');
 ['project','v-project','trip-project'].forEach(id=>{const current=$(id)?.value;if(!$(id))return;const first=id==='project'?'Todos los proyectos':'Sin proyecto';$(id).innerHTML=`<option value="">${first}</option>${projectOptions}`;$(id).value=current||''});
 const types=[...new Set(vehicles.map(item=>item.tipo).filter(Boolean))].sort();$('type').innerHTML='<option value="">Todos</option>'+types.map(value=>`<option value="${esc(value)}">${esc(vehicleTypeLabel(value))}</option>`).join('');
 const legend=$('type-legend');if(legend)legend.innerHTML=types.slice(0,12).map(value=>`<button type="button" class="vehicle-type-filter" data-type-filter="${esc(value)}" style="--type-color:${vehicleTypeColor(value)}"><span></span>${esc(vehicleTypeLabel(value))}</button>`).join('');legend?.querySelectorAll('[data-type-filter]').forEach(button=>button.addEventListener('click',()=>{$('type').value=button.dataset.typeFilter;renderAll()}));
}
function searchValue(){return lower($('search').value)}
function vehicleMatches(item){const query=searchValue();return !query||(window.SkilledSearch?.matches?window.SkilledSearch.matches([item.numeroEconomico,item.placas,item.vin,item.marca,item.modelo,item.tipo,item.proyecto,item.asignadoA,item.responsable],query):[item.numeroEconomico,item.placas,item.vin,item.marca,item.modelo,item.tipo,item.proyecto,item.asignadoA,item.responsable].some(value=>lower(value).includes(query)))}
function filteredVehicles(){const status=$('status').value;const type=$('type').value;const project=$('project').value;const inactive=$('inactive').checked;return vehicles.filter(item=>(inactive||item.activo!==false)&&(!status||item.estado===status)&&(!type||item.tipo===type)&&(!project||item.proyecto===project)&&vehicleMatches(item))}
function tripMatches(item){const query=searchValue();return !query||(window.SkilledSearch?.matches?window.SkilledSearch.matches([item.vehiculo?.numeroEconomico,item.vehiculo?.placas,item.conductor,item.proyecto,item.destino,item.motivo,...(item.pasajeros||[]).map(p=>p.nombre)],query):[item.vehiculo?.numeroEconomico,item.vehiculo?.placas,item.conductor,item.proyecto,item.destino,item.motivo,...(item.pasajeros||[]).map(p=>p.nombre)].some(value=>lower(value).includes(query)))}
function expenseMatches(item){const query=searchValue();return !query||(window.SkilledSearch?.matches?window.SkilledSearch.matches([item.vehiculo?.numeroEconomico,item.vehiculo?.placas,item.tipo,item.proveedor,item.comprobante,item.notas],query):[item.vehiculo?.numeroEconomico,item.vehiculo?.placas,item.tipo,item.proveedor,item.comprobante,item.notas].some(value=>lower(value).includes(query)))}
function renderMetrics(){
 const active=vehicles.filter(item=>item.activo!==false);
 const monthExpenses=monthRows(expenses,item=>item.fecha);
 $('metric-total').textContent=active.length.toLocaleString('es-MX');
 $('metric-available').textContent=active.filter(item=>item.estado==='disponible').length.toLocaleString('es-MX');
 $('metric-trips').textContent=trips.filter(item=>item.estado==='en_curso').length.toLocaleString('es-MX');
 $('metric-month-cost').textContent=money(monthExpenses.reduce((sum,item)=>sum+number(item.importe),0));
 $('metric-alerts').textContent=active.filter(item=>[item.vigenciaSeguro,item.vigenciaTarjeta,item.proximaVerificacion].some(value=>daysTo(value)<=30)).length.toLocaleString('es-MX');
 const fuel=monthExpenses.filter(item=>['gasolina','diesel','carga_electrica'].includes(item.tipo)).reduce((sum,item)=>sum+number(item.importe),0);
 const road=monthExpenses.filter(item=>['casetas','estacionamiento'].includes(item.tipo)).reduce((sum,item)=>sum+number(item.importe),0);
 const other=monthExpenses.reduce((sum,item)=>sum+number(item.importe),0)-fuel-road;
 $('expense-fuel').textContent=money(fuel);$('expense-road').textContent=money(road);$('expense-other').textContent=money(other);
}
function vehicleStateBadge(item){return`<span class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-bold" style="border-color:${statusColors[item.estado]}55;color:${statusColors[item.estado]}"><span class="w-1.5 h-1.5 rounded-full" style="background:${statusColors[item.estado]}"></span>${esc(statusLabels[item.estado]||item.estado)}</span>`}
function renderFleet(){
 const rows=filteredVehicles();$('loading').classList.add('hidden');$('empty').classList.toggle('hidden',rows.length>0);$('grid').classList.toggle('hidden',rows.length===0);
 $('grid').innerHTML=rows.map(item=>{
  const activeTrip=trips.find(trip=>trip.vehiculoId===item.id&&trip.estado==='en_curso');
  const assignment=activeTrip?`${activeTrip.conductor} · ${activeTrip.destino}`:(item.proyecto||item.asignadoA||'Sin asignación');
  const alertDocs=[item.vigenciaSeguro,item.vigenciaTarjeta,item.proximaVerificacion].some(value=>daysTo(value)<=30);
  const people=Math.max(0,Math.trunc(number(item.capacidadPersonas)));
  const base=item.almacenBaseNombre||'Sin base';
  const plates=item.placas||item.vin||'Sin placas / VIN';
  const seatText=people?(vehicleSeatLayout(item).join(' + ')||'Automática'):'Sin capacidad registrada';
  const usageLabel=activeTrip?'Destino actual':'Uso / asignación';
  return`<article class="vehicle-card vehicle-card-v13 panel ${item.activo===false?'opacity-60':''}" data-vehicle-id="${item.id}" style="--state:${statusColors[item.estado]||'#3b82f6'};--type-color:${vehicleTypeColor(item.tipo)}">
    <div class="vehicle-card-media-v13">
      <div class="vehicle-photo vehicle-photo-v13">${item.imagen?`<img src="${esc(item.imagen)}" alt="${esc(item.numeroEconomico)}">`:`<div class="vehicle-photo-placeholder vehicle-photo-placeholder-v13">${vehicleSilhouette(item.tipo)}</div>`}</div>
      <div class="vehicle-media-badges-v13"><span class="vehicle-type-badge" style="--type-color:${vehicleTypeColor(item.tipo)}"><i></i>${esc(vehicleTypeLabel(item.tipo))}</span>${vehicleStateBadge(item)}</div>
      <div class="vehicle-id-strip-v13"><span>${esc(item.numeroEconomico)}</span><small>${esc(plates)}</small></div>
    </div>
    <div class="vehicle-card-content-v13">
      <div class="vehicle-card-title-v13"><div class="min-w-0"><div class="flex items-center gap-2"><h3>${esc(item.marca)} ${esc(item.modelo)}</h3>${item.anio?`<span class="vehicle-year-v13">${item.anio}</span>`:''}</div><p>${esc(base)}${item.responsable?` · ${esc(item.responsable)}`:''}</p></div><button type="button" data-edit="${item.id}" class="vehicle-edit-icon-v13" title="Editar información"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg></button></div>
      <div class="vehicle-assignment-v13 ${activeTrip?'is-route':''}"><span class="vehicle-assignment-icon-v13">${activeTrip?'→':'•'}</span><div class="min-w-0"><small>${usageLabel}</small><strong title="${esc(assignment)}">${esc(assignment)}</strong></div>${activeTrip?`<span class="vehicle-route-badge-v13">EN RUTA</span>`:''}</div>
      <div class="vehicle-quick-stats-v13">
        <div><span>Kilometraje</span><strong>${number(item.kilometraje).toLocaleString('es-MX')} km</strong></div>
        <div><span>Capacidad</span><strong>${people?`${people} persona${people===1?'':'s'}`:'—'}</strong></div>
        <div><span>Documentos</span><strong class="${alertDocs?'text-amber-300':'text-emerald-300'}">${alertDocs?'Revisar':'Al día'}</strong></div>
      </div>
      ${people?`<div class="vehicle-seats-line-v13"><div class="min-w-0"><span>Asientos</span><strong>${esc(seatText)}</strong></div>${renderMiniSeats(item)}</div>`:''}
      <div class="vehicle-actions-v13"><button type="button" data-edit="${item.id}" class="vehicle-action-v13 is-edit"><svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg><span>Editar ficha</span></button>${activeTrip?`<button data-return="${activeTrip.id}" class="vehicle-action-v13 is-return"><span>Registrar regreso</span></button>`:item.activo!==false&&item.estado==='disponible'?`<button data-trip="${item.id}" class="vehicle-action-v13 is-trip"><span>Nueva salida</span></button>`:''}<button data-active="${item.id}" class="vehicle-action-v13 is-state"><span>${item.activo===false?'Activar':'Desactivar'}</span></button></div>
    </div>
  </article>`
 }).join('');
 bindFleetEditButtons();
}
function bindFleetEditButtons(){
 $('grid')?.querySelectorAll('[data-edit]').forEach(button=>{
  button.onclick=event=>{event.preventDefault();event.stopPropagation();safeOpenVehicle(button.dataset.edit)};
 });
}
function passengerText(item){const names=(item.pasajeros||[]).map(p=>p.nombre);return names.length?`${item.conductor} + ${names.length} pasajero${names.length===1?'':'s'}`:item.conductor}
function renderTrips(){
 const active=trips.filter(item=>item.estado==='en_curso'&&tripMatches(item));
 $('active-trips').innerHTML=active.length?active.map(item=>`<article class="trip-card"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-bold text-white">${esc(item.vehiculo.numeroEconomico||'Vehículo')}</p><p class="mt-1 text-[10px] text-gray-500">${esc(item.vehiculo.marca)} ${esc(item.vehiculo.modelo)} · ${esc(item.vehiculo.placas||'Sin placas')}</p></div><span class="rounded-full border border-emerald-500/30 bg-emerald-950/15 px-2 py-1 text-[9px] font-bold text-emerald-300">EN RUTA</span></div><div class="trip-route mt-4"><span class="trip-dot"></span><span class="trip-line"></span><span class="text-[9px] text-blue-300 trip-distance">${date(item.fechaSalida)}</span></div><div class="mt-4 grid grid-cols-2 gap-3 text-[10px]"><div><span class="crm-label-uppercase">Conductor</span><p class="mt-1 text-gray-300">${esc(item.conductor)}</p></div><div><span class="crm-label-uppercase">Destino</span><p class="mt-1 text-gray-300">${esc(item.destino)}</p></div><div><span class="crm-label-uppercase">Proyecto</span><p class="mt-1 text-gray-300">${esc(item.proyecto||'Sin proyecto')}</p></div><div><span class="crm-label-uppercase">Pasajeros</span><p class="mt-1 text-gray-300">${item.pasajeros.length}</p></div></div><div class="mt-4 flex justify-end gap-2"><button data-delete-trip="${item.id}" class="danger-button !py-2">Eliminar prueba</button><button data-return="${item.id}" class="crm-primary !py-2 bg-emerald-600 hover:bg-emerald-500">Registrar regreso</button></div></article>`).join(''):'<div class="panel py-12 text-center text-xs text-gray-500">No hay salidas activas.</div>';
 const status=$('trip-status').value;const rows=trips.filter(item=>(!status||item.estado===status)&&tripMatches(item));
 $('trips-body').innerHTML=rows.length?rows.map(item=>`<tr><td class="px-4 py-3"><p class="text-gray-200">${date(item.fechaSalida)}</p><p class="mt-1 text-[9px] text-gray-500">${item.fechaRegresoReal?`Regreso: ${date(item.fechaRegresoReal)}`:'Sin regreso'}</p></td><td class="px-4 py-3"><p class="font-bold text-white">${esc(item.vehiculo.numeroEconomico||'—')}</p><p class="mt-1 text-[9px] text-gray-500">${esc(item.vehiculo.placas||'Sin placas')}</p></td><td class="px-4 py-3"><p class="text-gray-200">${esc(passengerText(item))}</p><div class="mt-1 flex flex-wrap gap-1">${item.pasajeros.slice(0,4).map(p=>`<span class="passenger-chip">${p.asiento?`<strong>${esc(p.asiento)}</strong>`:''}${esc(p.nombre)}</span>`).join('')}</div></td><td class="px-4 py-3"><p class="text-gray-200">${esc(item.destino)}</p><p class="mt-1 text-[9px] text-blue-300">${esc(item.proyecto||'Sin proyecto')}</p></td><td class="px-4 py-3 text-right font-bold">${tripDistance(item)}</td><td class="px-4 py-3"><span class="rounded-full border px-2 py-1 text-[9px] font-bold ${item.estado==='en_curso'?'border-emerald-500/30 text-emerald-300':'border-[#243257] text-gray-400'}">${item.estado==='en_curso'?'En curso':'Finalizado'}</span></td><td class="px-4 py-3 text-right"><div class="flex justify-end gap-2">${item.estado==='en_curso'?`<button data-return="${item.id}" class="crm-secondary !px-3 !py-2 text-emerald-300">Regreso</button>`:''}<button data-delete-trip="${item.id}" class="text-[10px] font-bold text-rose-400">Eliminar</button></div></td></tr>`).join(''):'<tr><td colspan="7" class="px-4 py-12 text-center text-gray-500">No hay salidas con estos filtros.</td></tr>';
 document.querySelectorAll('[data-return]').forEach(button=>button.addEventListener('click',()=>openReturn(Number(button.dataset.return))));
 document.querySelectorAll('[data-delete-trip]').forEach(button=>button.addEventListener('click',()=>removeTrip(Number(button.dataset.deleteTrip))));
}
function renderExpenses(){const type=$('expense-type-filter').value;const rows=expenses.filter(item=>(!type||item.tipo===type)&&expenseMatches(item));$('expenses-body').innerHTML=rows.length?rows.map(item=>`<tr><td class="px-4 py-3">${date(item.fecha)}</td><td class="px-4 py-3"><p class="font-bold text-white">${esc(item.vehiculo.numeroEconomico||'—')}</p><p class="mt-1 text-[9px] text-gray-500">${esc(item.vehiculo.placas||'')}</p></td><td class="px-4 py-3"><span class="expense-type">${esc(expenseLabels[item.tipo]||item.tipo)}</span></td><td class="px-4 py-3 text-right">${item.litros?number(item.litros).toLocaleString('es-MX'):'—'}</td><td class="px-4 py-3 text-right font-bold text-amber-300">${money(item.importe)}</td><td class="px-4 py-3"><p>${esc(item.proveedor||'—')}</p><p class="mt-1 text-[9px] text-gray-500">${esc(item.comprobante||'Sin comprobante')}</p></td><td class="px-4 py-3 text-right"><button data-delete-expense="${item.id}" class="text-[10px] font-bold text-rose-400">Eliminar</button></td></tr>`).join(''):'<tr><td colspan="7" class="px-4 py-12 text-center text-gray-500">No hay gastos con estos filtros.</td></tr>';document.querySelectorAll('[data-delete-expense]').forEach(button=>button.addEventListener('click',()=>removeExpense(Number(button.dataset.deleteExpense))))}
function renderAll(){renderMetrics();renderFleet();renderTrips();renderExpenses();switchTab(activeTab,false)}
function switchTab(tab,focus=true){activeTab=tab;document.querySelectorAll('.vehicle-tab').forEach(button=>button.classList.toggle('is-active',button.dataset.tab===tab));document.querySelectorAll('[data-panel]').forEach(panel=>panel.classList.toggle('hidden',panel.dataset.panel!==tab));if(focus)$('search').focus()}
function applyStatusRules(){const status=$('v-status').value;const project=$('v-project');const assigned=$('v-assigned');const help=$('vehicle-status-help');[project,assigned].forEach(input=>{input.disabled=false;input.closest('label')?.classList.remove('opacity-50')});if(status==='disponible'){help.innerHTML='<strong>Disponible:</strong> la unidad puede utilizarse para una salida diaria. Los campos de asignación fija se limpian.';project.value='';assigned.value='';[project,assigned].forEach(input=>{input.disabled=true;input.closest('label')?.classList.add('opacity-50')})}else if(status==='asignado'){help.innerHTML='<strong>Asignado:</strong> úsalo solamente para resguardos permanentes. Para entregas diarias utiliza “Nueva salida”.'}else if(status==='taller')help.innerHTML='<strong>En taller:</strong> documenta el diagnóstico o fecha estimada en Notas.';else help.innerHTML='<strong>Fuera de servicio:</strong> registra el motivo y la decisión de reparación o baja.'}
function resetVehicle(){editingVehicle=null;$('vehicle-form').reset();$('v-type').value='';$('v-ownership').value='empresa';$('v-status').value='disponible';$('v-mileage').value='0';$('v-capacity').value='0';$('v-people-capacity').value='0';$('v-seat-layout').value='';$('v-cost').value='0';$('save-vehicle').textContent='Registrar vehículo';$('modal-subtitle').textContent='Registra los datos permanentes de la unidad. Las salidas diarias se gestionan por separado.';fieldIds.forEach(id=>$(id)?.classList.remove('border-rose-500'));formMessage();applyStatusRules();renderVehicleSeatPreview();$('delete-vehicle').classList.add('hidden')}
function showVehicleModal(){const modal=$('vehicle-modal');if(!modal)return;modal.classList.remove('hidden');modal.classList.add('flex');modal.style.display='flex';modal.style.zIndex='120';modal.setAttribute('aria-hidden','false');document.body.classList.add('crm-modal-open');document.body.style.overflow='hidden'}
function openVehicle(id=''){resetVehicle();editingVehicle=id!==''&&id!=null?vehicleById(id):null;if(id!==''&&id!=null&&!editingVehicle)throw new Error('No se encontró el vehículo seleccionado. Recarga la flotilla y vuelve a intentarlo.');$('modal-title').textContent=editingVehicle?'Editar información del vehículo':'Nuevo vehículo';$('save-vehicle').textContent=editingVehicle?'Guardar cambios':'Registrar vehículo';$('modal-subtitle').textContent=editingVehicle?'Edita la ficha completa de la unidad. El historial de salidas y gastos se conservará.':'Registra los datos permanentes de la unidad. Las salidas diarias se gestionan por separado.';if(editingVehicle){setValue('v-number',editingVehicle.numeroEconomico);setValue('v-plates',editingVehicle.placas);setValue('v-vin',editingVehicle.vin);setValue('v-brand',editingVehicle.marca);setValue('v-model',editingVehicle.modelo);setValue('v-year',editingVehicle.anio);setValue('v-type',normalizeVehicleType(editingVehicle.tipo));setValue('v-color',editingVehicle.color);setValue('v-fuel',editingVehicle.combustible);setValue('v-transmission',editingVehicle.transmision);setValue('v-ownership',editingVehicle.propiedad||'empresa');setValue('v-status',editingVehicle.estado||'disponible');setValue('v-mileage',editingVehicle.kilometraje||0);setValue('v-capacity',editingVehicle.capacidadCarga||0);setValue('v-people-capacity',editingVehicle.capacidadPersonas||0);setValue('v-seat-layout',vehicleSeatLayout(editingVehicle).join(','));setValue('v-warehouse',editingVehicle.almacenBaseId);setValue('v-project',editingVehicle.proyecto);setValue('v-assigned',editingVehicle.asignadoA);setValue('v-responsible',editingVehicle.responsable);setValue('v-insurer',editingVehicle.aseguradora);setValue('v-policy',editingVehicle.polizaSeguro);setValue('v-insurance-date',editingVehicle.vigenciaSeguro);setValue('v-card',editingVehicle.tarjetaCirculacion);setValue('v-card-date',editingVehicle.vigenciaTarjeta);setValue('v-verification',editingVehicle.proximaVerificacion);setValue('v-acquisition-date',editingVehicle.fechaAdquisicion);setValue('v-cost',editingVehicle.costoAdquisicion||0);setValue('v-image',editingVehicle.imagen);setValue('v-notes',editingVehicle.notas);if(canDelete())$('delete-vehicle').classList.remove('hidden')}applyStatusRules();renderVehicleSeatPreview();showVehicleModal();setTimeout(()=>$('v-number')?.focus(),50)}
function safeOpenVehicle(id=''){try{openVehicle(id)}catch(error){console.error('No se pudo abrir el editor de vehículos:',error);alert(error.message||'No se pudo abrir el editor del vehículo.')}}
function closeVehicle(){if(busy)return;const modal=$('vehicle-modal');modal?.classList.add('hidden');modal?.classList.remove('flex');if(modal){modal.style.display='none';modal.setAttribute('aria-hidden','true')}document.body.classList.remove('crm-modal-open');document.body.style.overflow='';editingVehicle=null;formMessage()}
function vehiclePayload(){const capacity=Math.max(0,Math.trunc(number($('v-people-capacity').value)));const layout=parseSeatLayout($('v-seat-layout').value);return{numeroEconomico:$('v-number').value,placas:$('v-plates').value,vin:$('v-vin').value,marca:$('v-brand').value,modelo:$('v-model').value,anio:$('v-year').value,tipo:normalizeVehicleType($('v-type').value),color:$('v-color').value,combustible:$('v-fuel').value,transmision:$('v-transmission').value,propiedad:$('v-ownership').value,estado:$('v-status').value,kilometraje:$('v-mileage').value,capacidadCarga:$('v-capacity').value,capacidadPersonas:capacity,distribucionAsientos:layout.length?layout:automaticSeatLayout(capacity,$('v-type').value),almacenBaseId:$('v-warehouse').value,proyecto:$('v-project').disabled?'':$('v-project').value,asignadoA:$('v-assigned').disabled?'':$('v-assigned').value,responsable:$('v-responsible').value,aseguradora:$('v-insurer').value,polizaSeguro:$('v-policy').value,vigenciaSeguro:$('v-insurance-date').value,tarjetaCirculacion:$('v-card').value,vigenciaTarjeta:$('v-card-date').value,proximaVerificacion:$('v-verification').value,fechaAdquisicion:$('v-acquisition-date').value,costoAdquisicion:$('v-cost').value,imagen:$('v-image').value,notas:$('v-notes').value,activo:editingVehicle?editingVehicle.activo!==false:true}}
function validateVehicle(){formMessage();let first=null;['v-number','v-brand','v-model','v-type'].forEach(id=>{const input=$(id);const invalid=!clean(input.value);input.classList.toggle('border-rose-500',invalid);if(invalid&&!first)first=input});const selectedType=normalizeVehicleType($('v-type').value);if(clean($('v-type').value)&&!selectedType){first=first||$('v-type');$('v-type').classList.add('border-rose-500');formMessage('Selecciona un tipo de vehículo permitido por el sistema.')}const year=number($('v-year').value);if(year&&(year<1950||year>new Date().getFullYear()+1)){first=first||$('v-year');$('v-year').classList.add('border-rose-500')}const capacity=Math.max(0,Math.trunc(number($('v-people-capacity').value)));const layout=parseSeatLayout($('v-seat-layout').value);const mismatch=layout.length&&layout.reduce((sum,item)=>sum+item,0)!==capacity;$('v-seat-layout').classList.toggle('border-rose-500',Boolean(mismatch));if(mismatch){first=first||$('v-seat-layout');formMessage('La suma de asientos por fila debe coincidir con la capacidad total de personas.');renderVehicleSeatPreview()}if(first){if(!mismatch&&!$('vehicle-form-message').textContent)formMessage('Completa los campos obligatorios y revisa los valores marcados.');first.focus();return false}return true}
async function saveVehicle(event){event.preventDefault();if(!validateVehicle())return;setBusy(true);try{await SkilledDB.saveVehicle(vehiclePayload(),editingVehicle?.id||0);await load(false);formMessage(editingVehicle?'Cambios guardados correctamente.':'Vehículo guardado correctamente.','ok');setTimeout(closeVehicle,450)}catch(error){formMessage(error.message||'No se pudo guardar el vehículo.');console.error(error)}finally{setBusy(false)}}
async function toggleVehicle(id){const item=vehicles.find(row=>row.id===id);if(!item)return;const active=item.activo===false;if(!confirm(`¿Deseas ${active?'activar':'desactivar'} el vehículo ${item.numeroEconomico}?`))return;try{await SkilledDB.setVehicleActive(id,active);item.activo=active;renderAll()}catch(error){alert(error.message)}}
async function removeVehicle(){if(!editingVehicle||!canDelete())return;if(!confirm(`¿Eliminar definitivamente el vehículo de prueba ${editingVehicle.numeroEconomico}?\n\nTambién se eliminarán sus viajes, pasajeros y gastos registrados. Usa esta opción solo para limpiar datos de prueba.`))return;const value=prompt(`Para confirmar, escribe el nombre del vehículo:
${editingVehicle.numeroEconomico}`);if(clean(value).toUpperCase()!==clean(editingVehicle.numeroEconomico).toUpperCase())return alert('La confirmación no coincide.');try{await SkilledDB.deleteVehicleTest(editingVehicle.id);vehicles=vehicles.filter(item=>item.id!==editingVehicle.id);trips=trips.filter(item=>Number(item.vehiculoId)!==Number(editingVehicle.id));expenses=expenses.filter(item=>Number(item.vehiculoId)!==Number(editingVehicle.id));closeVehicle();fillSelects();renderAll();alert('El vehículo de prueba y su operación relacionada fueron eliminados.')}catch(error){alert(error.message)}}
function openTrip(vehicleId=0){if(!operationReady)return alert('Ejecuta SQL_MAESTRO_CRM.sql antes de usar el control diario.');$('trip-form').reset();tripSeatAssignments={};$('trip-date').value=dateInput(new Date());$('trip-return-estimated').value=dateInput(new Date(Date.now()+8*3600000));$('trip-vehicle').value=vehicleId||'';const vehicle=vehicles.find(item=>item.id===Number(vehicleId));$('trip-mileage').value=vehicle?.kilometraje||0;renderTripSeatMap();$('trip-modal').classList.remove('hidden');$('trip-modal').classList.add('flex')}
function closeTrip(){$('trip-modal').classList.add('hidden');$('trip-modal').classList.remove('flex')}
async function saveTrip(event){event.preventDefault();const button=event.submitter;button.disabled=true;button.textContent='Registrando...';try{await SkilledDB.saveVehicleTrip({vehiculoId:$('trip-vehicle').value,fechaSalida:normalizeDateTime($('trip-date').value),fechaRegresoEstimada:normalizeDateTime($('trip-return-estimated').value),conductor:$('trip-driver').value,kilometrajeSalida:$('trip-mileage').value,proyecto:$('trip-project').value,destino:$('trip-destination').value,pasajeros:tripPassengersPayload(),motivo:$('trip-purpose').value,observaciones:$('trip-notes').value});closeTrip();await load(false);switchTab('trips')}catch(error){alert(error.message)}finally{button.disabled=false;button.textContent='Iniciar salida'}}
function openReturn(id){selectedTrip=trips.find(item=>item.id===id)||null;if(!selectedTrip)return;$('return-form').reset();$('return-subtitle').textContent=`${selectedTrip.vehiculo.numeroEconomico} · ${selectedTrip.conductor} · ${selectedTrip.destino}`;$('return-date').value=dateInput(new Date());$('return-mileage').min=String(selectedTrip.kilometrajeSalida||0);$('return-mileage').value=selectedTrip.kilometrajeSalida||0;$('return-modal').classList.remove('hidden');$('return-modal').classList.add('flex')}
function closeReturn(){$('return-modal').classList.add('hidden');$('return-modal').classList.remove('flex');selectedTrip=null}
async function saveReturn(event){event.preventDefault();if(!selectedTrip)return;const button=event.submitter;button.disabled=true;button.textContent='Finalizando...';try{await SkilledDB.closeVehicleTrip(selectedTrip.id,{fechaRegresoReal:normalizeDateTime($('return-date').value),kilometrajeRegreso:$('return-mileage').value,litrosGasolina:$('return-liters').value,gastoGasolina:$('return-fuel-cost').value,proveedorGasolina:$('return-vendor').value,casetas:$('return-tolls').value,comprobante:$('return-receipt').value,observaciones:$('return-notes').value});closeReturn();await load(false);switchTab('trips')}catch(error){alert(error.message)}finally{button.disabled=false;button.textContent='Finalizar salida'}}
function openExpense(vehicleId=0){if(!operationReady)return alert('Ejecuta SQL_MAESTRO_CRM.sql antes de registrar gastos.');$('expense-form').reset();$('expense-date').value=today();$('expense-vehicle').value=vehicleId||'';$('expense-modal').classList.remove('hidden');$('expense-modal').classList.add('flex')}
function closeExpense(){$('expense-modal').classList.add('hidden');$('expense-modal').classList.remove('flex')}
async function saveExpense(event){event.preventDefault();const button=event.submitter;button.disabled=true;button.textContent='Guardando...';try{await SkilledDB.saveVehicleExpense({vehiculoId:$('expense-vehicle').value,fecha:$('expense-date').value,tipo:$('expense-type').value,litros:$('expense-liters').value,importe:$('expense-amount').value,odometro:$('expense-mileage').value,proveedor:$('expense-vendor').value,comprobante:$('expense-receipt').value,notas:$('expense-notes').value});closeExpense();await load(false);switchTab('expenses')}catch(error){alert(error.message)}finally{button.disabled=false;button.textContent='Guardar gasto'}}
async function removeTrip(id){if(!canDelete())return alert('Solo el Jefe de almacén o Administrador puede eliminar registros de prueba.');if(!confirm('¿Eliminar definitivamente esta salida de prueba? También se eliminarán sus pasajeros.'))return;try{await SkilledDB.deleteVehicleTrip(id);await load(false)}catch(error){alert(error.message)}}
async function removeExpense(id){if(!canDelete())return alert('Solo el Jefe de almacén o Administrador puede eliminar registros de prueba.');if(!confirm('¿Eliminar definitivamente este gasto de prueba?'))return;try{await SkilledDB.deleteVehicleExpense(id);await load(false)}catch(error){alert(error.message)}}

function normalizeHeader(value){return lower(value).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function vehicleTemplate(){
 const headers=['Nombre del vehículo','Placas','VIN / serie','Marca','Modelo','Año','Tipo','Color','Combustible','Transmisión','Propiedad','Estado','Kilometraje','Capacidad carga kg','Capacidad personas','Distribución asientos','Almacén base','Proyecto','Asignado a','Responsable','Aseguradora','Póliza','Vigencia seguro','Tarjeta circulación','Vigencia tarjeta','Próxima verificación','Fecha adquisición','Costo adquisición','URL imagen','Notas','Activo'];
 const examples=[
  ['CAM-001','ABC-123-A','','Toyota','Hilux',2024,'camioneta','Rojo','Gasolina','Automática','Empresa','Disponible',12500,900,5,'2,3','Bodega Central','','','','AXA','POL-001','2027-08-01','TC-001','2027-08-01','2027-02-15','2024-01-15',780000,'','Unidad para entregas','Sí'],
  ['MONT-001','','SERIE-MT-001','Toyota','8FGCU25',2022,'montacargas','Naranja','Gas LP','Automática','Empresa','Disponible',1450,2500,1,'1','Bodega Central','','','','','','','','','','2022-06-20',650000,'','Solo operador','Sí'],
  ['GEN-001','','SERIE-GEN-001','Generac','GP6500',2023,'generador_movil','Rojo','Gasolina','','Empresa','Disponible',320,0,0,'','Bodega Central','','','','','','','','','','2023-03-10',28000,'','Generador portátil sin pasajeros','Sí']
 ];
 const ws=XLSX.utils.aoa_to_sheet([headers,...examples]);ws['!freeze']={xSplit:0,ySplit:1};ws['!autofilter']={ref:`A1:AE${examples.length+1}`};ws['!cols']=headers.map((h,i)=>({wch:[0,1,2,3,4,6,15,16,28,29].includes(i)?21:16}));
 const guide=XLSX.utils.aoa_to_sheet([['CAMPO','USO'],['Nombre del vehículo','Obligatorio y único. Si ya existe, la fila actualiza ese vehículo.'],['Marca / Modelo','Obligatorios.'],['Tipo','Usa únicamente: pickup, camioneta, automovil, van, camion, motocicleta, montacargas, generador_movil o maquinaria_movil.'],['Capacidad personas','Total de personas, incluyendo al conductor. Usa 0 si el equipo no transporta personas.'],['Distribución asientos','Opcional. Indica los asientos por fila separados por coma. Ejemplo: 2,3. La suma debe ser igual a la capacidad.'],['Almacén base','Debe coincidir con un almacén del CRM o quedar vacío.'],['Fechas','Usa AAAA-MM-DD.'],['Activo','Sí/No.']]);guide['!cols']=[{wch:26},{wch:95}];
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,ws,'Vehículos');XLSX.utils.book_append_sheet(book,guide,'Guía');book.Props={Title:'Plantilla de vehículos Skilled',Author:'Skilled Proyectos Industriales'};XLSX.writeFile(book,'Plantilla_Vehiculos_Skilled.xlsx');
}
function openVehicleImport(){vehicleImportRows=[];$('vehicle-import-file').value='';$('vehicle-import-status').textContent='Selecciona un archivo para comenzar.';$('vehicle-import-summary').classList.add('hidden');$('vehicle-import-preview').classList.add('hidden');$('run-vehicle-import').disabled=true;$('vehicle-import-progress').style.width='0%';$('vehicle-import-modal').classList.remove('hidden');$('vehicle-import-modal').classList.add('flex')}
function closeVehicleImport(){if(vehicleImportBusy)return;$('vehicle-import-modal').classList.add('hidden');$('vehicle-import-modal').classList.remove('flex')}
function truthy(value){return['si','sí','true','1','activo','yes'].includes(lower(value))}
function mapStatus(value){const key=lower(value).replace(/\s+/g,'_');return({disponible:'disponible',asignado:'asignado',taller:'taller',en_taller:'taller',fuera_de_servicio:'fuera_servicio',fuera_servicio:'fuera_servicio'})[key]||'disponible'}
function mapVehicleImportRow(raw,index){
 const row={};Object.entries(raw||{}).forEach(([key,value])=>row[normalizeHeader(key)]=value);
 const get=(...keys)=>{for(const key of keys){const value=row[normalizeHeader(key)];if(clean(value)!=='')return value}return''};
 const numberEconomic=clean(get('Nombre del vehículo','Nombre vehiculo','No. económico','Numero economico','No economico'));
 const plates=clean(get('Placas')).toUpperCase();const vin=clean(get('VIN / serie','VIN','Numero de serie')).toUpperCase();const brand=clean(get('Marca'));const model=clean(get('Modelo'));const rawType=clean(get('Tipo','Tipo de vehículo'));const type=normalizeVehicleType(rawType);
 const existing=vehicles.find(item=>lower(item.numeroEconomico)===lower(numberEconomic));const errors=[];
 if(!numberEconomic)errors.push('Falta nombre del vehículo');if(!brand)errors.push('Falta marca');if(!model)errors.push('Falta modelo');if(!rawType)errors.push('Falta tipo');else if(!type)errors.push(`Tipo no permitido: ${rawType}`);
 const whName=clean(get('Almacén base','Almacen base'));const warehouse=whName?warehouses.find(item=>lower(item.nombre)===lower(whName)):null;if(whName&&!warehouse)errors.push(`Almacén no encontrado: ${whName}`);
 const duplicateFile=vehicleImportRows.some(item=>lower(item.payload.numeroEconomico)===lower(numberEconomic));if(numberEconomic&&duplicateFile)errors.push('Nombre del vehículo repetido en el archivo');
 const people=Math.max(0,Math.trunc(number(get('Capacidad personas','Capacidad total personas'))));const layout=parseSeatLayout(get('Distribución asientos','Distribucion asientos'));if(layout.length&&layout.reduce((sum,item)=>sum+item,0)!==people)errors.push('La distribución de asientos no coincide con la capacidad de personas');
 const payload={numeroEconomico:numberEconomic,placas:plates,vin,marca:brand,modelo:model,anio:get('Año','Anio'),tipo:type,color:get('Color'),combustible:get('Combustible'),transmision:get('Transmisión','Transmision'),propiedad:get('Propiedad')||'empresa',estado:mapStatus(get('Estado')),kilometraje:get('Kilometraje'),capacidadCarga:get('Capacidad carga kg','Capacidad de carga'),capacidadPersonas:people,distribucionAsientos:layout.length?layout:automaticSeatLayout(people,type),almacenBaseId:warehouse?.id||'',proyecto:get('Proyecto'),asignadoA:get('Asignado a'),responsable:get('Responsable'),aseguradora:get('Aseguradora'),polizaSeguro:get('Póliza','Poliza'),vigenciaSeguro:get('Vigencia seguro'),tarjetaCirculacion:get('Tarjeta circulación','Tarjeta circulacion'),vigenciaTarjeta:get('Vigencia tarjeta'),proximaVerificacion:get('Próxima verificación','Proxima verificacion'),fechaAdquisicion:get('Fecha adquisición','Fecha adquisicion'),costoAdquisicion:get('Costo adquisición','Costo adquisicion'),imagen:get('URL imagen','Imagen'),notas:get('Notas'),activo:clean(get('Activo'))?truthy(get('Activo')):true};
 return{index:index+2,payload,existing,warehouseName:whName,errors,valid:errors.length===0};
}
function renderVehicleImport(){const total=vehicleImportRows.length,valid=vehicleImportRows.filter(r=>r.valid).length,updates=vehicleImportRows.filter(r=>r.valid&&r.existing).length,errors=total-valid;$('vi-total').textContent=total;$('vi-valid').textContent=valid;$('vi-update').textContent=updates;$('vi-errors').textContent=errors;$('vehicle-import-summary').classList.remove('hidden');$('vehicle-import-preview').classList.remove('hidden');$('run-vehicle-import').disabled=valid===0;$('vehicle-import-status').textContent=`${valid} fila(s) lista(s). ${errors?`${errors} requieren corrección.`:'Sin errores detectados.'}`;$('vehicle-import-body').innerHTML=vehicleImportRows.slice(0,80).map(row=>`<tr class="${row.valid?'is-valid':'is-invalid'}"><td class="px-3 py-2">${row.index}</td><td class="px-3 py-2 font-mono text-blue-300">${esc(row.payload.numeroEconomico||'—')}</td><td class="px-3 py-2"><span class="vehicle-type-badge" style="--type-color:${vehicleTypeColor(row.payload.tipo)}"><i></i>${esc(vehicleTypeLabel(row.payload.tipo))}</span></td><td class="px-3 py-2">${esc(`${row.payload.marca} ${row.payload.modelo}`)}</td><td class="px-3 py-2">${esc(row.payload.placas||'—')}</td><td class="px-3 py-2">${esc(row.warehouseName||'Sin base')}</td><td class="px-3 py-2 ${row.valid?'text-emerald-400':'text-rose-400'}">${row.valid?(row.existing?'Actualizar':'Crear'):esc(row.errors.join(' · '))}</td></tr>`).join('')}
async function readVehicleImportFile(file){if(!file)return;try{$('vehicle-import-status').textContent='Leyendo y validando archivo...';const data=await file.arrayBuffer();const book=XLSX.read(data,{type:'array',cellDates:false});const sheet=book.Sheets[book.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});vehicleImportRows=[];rows.forEach((raw,index)=>vehicleImportRows.push(mapVehicleImportRow(raw,index)));renderVehicleImport()}catch(error){vehicleImportRows=[];$('vehicle-import-status').textContent=`No se pudo leer el archivo: ${error.message}`;$('run-vehicle-import').disabled=true}}
async function runVehicleImport(){const rows=vehicleImportRows.filter(row=>row.valid);if(!rows.length)return;vehicleImportBusy=true;$('run-vehicle-import').disabled=true;$('cancel-vehicle-import').disabled=true;let ok=0,fail=0;for(let i=0;i<rows.length;i+=1){const row=rows[i];$('vehicle-import-progress').style.width=`${Math.round((i/rows.length)*100)}%`;$('vehicle-import-status').textContent=`Procesando ${i+1} de ${rows.length}: ${row.payload.numeroEconomico}`;try{await SkilledDB.saveVehicle(row.payload,row.existing?.id||0);ok+=1}catch(error){row.valid=false;row.errors.push(error.message);fail+=1}}$('vehicle-import-progress').style.width='100%';vehicleImportBusy=false;$('cancel-vehicle-import').disabled=false;$('vehicle-import-status').textContent=`Importación terminada: ${ok} correctos, ${fail} con error.`;await load(false);renderVehicleImport();if(!fail)setTimeout(closeVehicleImport,900)}

function exportOperation(){
 const book=XLSX.utils.book_new();
 const fleet=vehicles.map(item=>({'Nombre del vehículo':item.numeroEconomico,Placas:item.placas,VIN:item.vin,Marca:item.marca,Modelo:item.modelo,Año:item.anio,Tipo:vehicleTypeLabel(item.tipo),Estado:statusLabels[item.estado]||item.estado,'Almacén base':item.almacenBaseNombre,Kilometraje:item.kilometraje,'Capacidad carga kg':item.capacidadCarga,'Capacidad personas':item.capacidadPersonas,'Distribución asientos':vehicleSeatLayout(item).join(','),'Vigencia seguro':item.vigenciaSeguro,'Vigencia tarjeta':item.vigenciaTarjeta,'Próxima verificación':item.proximaVerificacion,Activo:item.activo!==false?'Sí':'No'}));
 const tripRows=trips.map(item=>({'Fecha salida':item.fechaSalida,'Fecha regreso':item.fechaRegresoReal,Vehículo:item.vehiculo.numeroEconomico,Placas:item.vehiculo.placas,Conductor:item.conductor,Pasajeros:item.pasajeros.map(p=>`${p.asiento?`${p.asiento}: `:''}${p.nombre}`).join(', '),Proyecto:item.proyecto,Destino:item.destino,Motivo:item.motivo,'KM salida':item.kilometrajeSalida,'KM regreso':item.kilometrajeRegreso,Estado:item.estado,Observaciones:item.observaciones}));
 const expenseRows=expenses.map(item=>({Fecha:item.fecha,Vehículo:item.vehiculo.numeroEconomico,Placas:item.vehiculo.placas,Tipo:expenseLabels[item.tipo]||item.tipo,Litros:item.litros,Importe:item.importe,Odómetro:item.odometro,Proveedor:item.proveedor,Comprobante:item.comprobante,Notas:item.notas}));
 [['Flotilla',fleet],['Salidas',tripRows],['Gastos',expenseRows]].forEach(([name,rows])=>{const sheet=XLSX.utils.json_to_sheet(rows);if(sheet['!ref'])sheet['!autofilter']={ref:sheet['!ref']};sheet['!freeze']={xSplit:0,ySplit:1};sheet['!cols']=Array.from({length:Math.max(1,Object.keys(rows[0]||{}).length)},(_,index)=>({wch:index===5||index===7?32:18}));XLSX.utils.book_append_sheet(book,sheet,name)});book.Props={Title:'Operación vehicular Skilled',Author:'Skilled Proyectos Industriales'};XLSX.writeFile(book,`Operacion_Vehicular_${today()}.xlsx`)
}
$('grid').addEventListener('click',event=>{const edit=event.target.closest('[data-edit]');if(edit){event.preventDefault();event.stopPropagation();safeOpenVehicle(edit.dataset.edit);return}const active=event.target.closest('[data-active]');if(active){event.preventDefault();toggleVehicle(Number(active.dataset.active));return}const trip=event.target.closest('[data-trip]');if(trip){event.preventDefault();openTrip(Number(trip.dataset.trip));return}const ret=event.target.closest('[data-return]');if(ret){event.preventDefault();openReturn(Number(ret.dataset.return))}});
document.querySelectorAll('.vehicle-tab').forEach(button=>button.addEventListener('click',()=>switchTab(button.dataset.tab)));
['search'].forEach(id=>$(id).addEventListener('input',renderAll));['status','type','project','inactive','trip-status','expense-type-filter'].forEach(id=>$(id).addEventListener('change',renderAll));
$('vehicle-template-main').addEventListener('click',vehicleTemplate);$('import-vehicles').addEventListener('click',openVehicleImport);$('close-vehicle-import').addEventListener('click',closeVehicleImport);$('cancel-vehicle-import').addEventListener('click',closeVehicleImport);$('vehicle-template').addEventListener('click',vehicleTemplate);$('vehicle-backup').addEventListener('click',exportOperation);$('run-vehicle-import').addEventListener('click',runVehicleImport);$('vehicle-import-file').addEventListener('change',event=>readVehicleImportFile(event.target.files?.[0]));const vehicleDrop=$('vehicle-import-drop');['dragenter','dragover'].forEach(name=>vehicleDrop.addEventListener(name,event=>{event.preventDefault();vehicleDrop.classList.add('is-drag')}));['dragleave','drop'].forEach(name=>vehicleDrop.addEventListener(name,event=>{event.preventDefault();vehicleDrop.classList.remove('is-drag')}));vehicleDrop.addEventListener('drop',event=>readVehicleImportFile(event.dataTransfer?.files?.[0]));$('vehicle-import-modal').addEventListener('click',event=>{if(event.target===$('vehicle-import-modal'))closeVehicleImport()});
$('global-search').addEventListener('input',event=>{$('search').value=event.target.value;renderAll()});$('refresh').addEventListener('click',()=>load(false));$('new-vehicle').addEventListener('click',()=>safeOpenVehicle());$('new-trip').addEventListener('click',()=>openTrip());$('new-trip-inline').addEventListener('click',()=>openTrip());$('new-expense').addEventListener('click',()=>openExpense());$('new-expense-inline').addEventListener('click',()=>openExpense());$('export').addEventListener('click',exportOperation);
window.editarVehiculo=id=>safeOpenVehicle(id);window.SkilledVehicles={edit:safeOpenVehicle,new:safeOpenVehicle};
$('close-modal').addEventListener('click',closeVehicle);$('cancel-modal').addEventListener('click',closeVehicle);$('vehicle-form').addEventListener('submit',saveVehicle);$('vehicle-modal').addEventListener('click',event=>{if(event.target===$('vehicle-modal'))closeVehicle()});$('delete-vehicle').addEventListener('click',removeVehicle);$('v-status').addEventListener('change',applyStatusRules);$('v-seat-generate').addEventListener('click',renderVehicleSeatPreview);$('v-seat-auto').addEventListener('click',()=>{const cap=Math.max(0,Math.trunc(number($('v-people-capacity').value)));$('v-seat-layout').value=automaticSeatLayout(cap,$('v-type').value).join(',');renderSeatPresets();renderVehicleSeatPreview()});$('v-people-capacity').addEventListener('input',renderVehicleSeatPreview);$('v-seat-layout').addEventListener('input',renderVehicleSeatPreview);$('v-type').addEventListener('input',renderVehicleSeatPreview);$('v-type').addEventListener('change',renderVehicleSeatPreview);['v-number','v-plates','v-vin'].forEach(id=>$(id).addEventListener('input',event=>{event.target.value=event.target.value.toUpperCase()}));
$('close-trip').addEventListener('click',closeTrip);$('cancel-trip').addEventListener('click',closeTrip);$('trip-form').addEventListener('submit',saveTrip);$('trip-modal').addEventListener('click',event=>{if(event.target===$('trip-modal'))closeTrip()});$('trip-vehicle').addEventListener('change',event=>{const item=vehicles.find(row=>row.id===Number(event.target.value));$('trip-mileage').value=item?.kilometraje||0;tripSeatAssignments={};renderTripSeatMap()});$('trip-passengers').addEventListener('input',renderTripSeatMap);$('trip-driver').addEventListener('input',renderTripSeatMap);
$('close-return').addEventListener('click',closeReturn);$('cancel-return').addEventListener('click',closeReturn);$('return-form').addEventListener('submit',saveReturn);$('return-modal').addEventListener('click',event=>{if(event.target===$('return-modal'))closeReturn()});
$('close-expense').addEventListener('click',closeExpense);$('cancel-expense').addEventListener('click',closeExpense);$('expense-form').addEventListener('submit',saveExpense);$('expense-modal').addEventListener('click',event=>{if(event.target===$('expense-modal'))closeExpense()});
load().then(()=>{const q=new URLSearchParams(location.search).get('q');if(q){$('search').value=q;$('global-search').value=q;renderAll()}});
})();

