(()=>{
'use strict';
const clean=v=>String(v??'').trim();
const esc=v=>clean(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const normalize=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'_');
const SHAPE_HINTS={pickup:['pickup','pick_up','pick-up','camioneta_pickup','camioneta_de_carga','troca','troka','estacas','hilux','np300','frontier','silverado','cheyenne','ranger','l200','amarok','tacoma','f150','f_150','ram_1500','ram1500','doble_cabina'],suv:['camioneta','suv','suv_camioneta','utilitaria','utilitario','wagon','crossover','todoterreno','terrain','suburban','tahoe','rav4','crv','cr_v','xtrail','x_trail','sportage','sorento','ecosport','escape','duster'],car:['automovil','auto','coche','sedan','hatchback','compacto','coupe','versa','jetta','aveo','march','sentra','mazda_3','civic','corolla','rio','yaris','spark','ibiza','vento'],van:['van','minivan','panel','furgon','furgoneta','sprinter','urban','urvan','transit','hiace','partner','kangoo','crafter','express','master'],truck:['camion','tractocamion','tracto','camion_ligero','camion_mediano','rabon','torton','hino','isuzu','freightliner','kenworth','international','volteo','pipa','mudanza'],motorcycle:['motocicleta','moto'],forklift:['montacargas','forklift'],equipment:['generador_movil','generador','genny','planta_de_luz','planta_luz','planta_electrica'],machinery:['maquinaria_movil','maquinaria','retroexcavadora','minicargador','excavadora','bulldozer','tractor']};
function detectShapeFromText(text){const raw=normalize(text);if(!raw)return'';for(const [shape,hints] of Object.entries(SHAPE_HINTS)){if(hints.includes(raw))return shape;}for(const [shape,hints] of Object.entries(SHAPE_HINTS)){if(hints.some(h=>raw.includes(h)))return shape;}return ''}
const shapeKey=value=>{if(value&&typeof value==='object'){const direct=detectShapeFromText(value.tipo)||detectShapeFromText(value.subtipo)||detectShapeFromText(value.categoria);if(direct)return direct;const combined=[value.tipo,value.subtipo,value.categoria,value.marca,value.modelo,value.apodo,value.numeroEconomico,value.descripcion].map(clean).filter(Boolean).join(' ');return detectShapeFromText(combined)||'car';}return detectShapeFromText(value)||'car'};
const labels={pickup:'Pickup',suv:'Camioneta',car:'Automóvil',van:'Van',truck:'Camión',motorcycle:'Motocicleta',forklift:'Montacargas',equipment:'Generador móvil / equipo',machinery:'Maquinaria móvil'};
const palettes={
 car:{body0:'#5b8dff',body1:'#2a62d8',body2:'#163e8a',body3:'#0d1f4a',body4:'#081226',glass0:'#9be8ff',glass1:'#46a4da',glass2:'#1c5489',tail0:'#ff8ea6',tail1:'#ef4764',tail2:'#85102d'},
 pickup:{body0:'#66d1ff',body1:'#2e8bce',body2:'#1e4f8f',body3:'#0d2140',body4:'#08111d',glass0:'#b9f2ff',glass1:'#63d2f2',glass2:'#1e5d8c',tail0:'#ff9d8d',tail1:'#ff5b4d',tail2:'#9a1d19'},
 suv:{body0:'#7fe4bd',body1:'#2db987',body2:'#17745c',body3:'#0b3c34',body4:'#071a18',glass0:'#c8fff4',glass1:'#79d8c8',glass2:'#246e68',tail0:'#ffb38c',tail1:'#ff7a45',tail2:'#8a2b11'},
 van:{body0:'#be9dff',body1:'#7c5df0',body2:'#4c2da8',body3:'#261353',body4:'#0c0820',glass0:'#d6d9ff',glass1:'#9ba4ff',glass2:'#3f4fa5',tail0:'#ff9fdc',tail1:'#ff56b5',tail2:'#8f175f'},
 truck:{body0:'#ffd36f',body1:'#f4a82a',body2:'#ac6611',body3:'#593109',body4:'#1d0e05',glass0:'#fff0c2',glass1:'#ffd67b',glass2:'#8b641e',tail0:'#ffae8b',tail1:'#f97316',tail2:'#8c2d12'},
 motorcycle:{body0:'#ff92aa',body1:'#f2537f',body2:'#a11f4f',body3:'#4f0b24',body4:'#1a0610',glass0:'#ffe0ef',glass1:'#ff9fc5',glass2:'#975071',tail0:'#ffc6d6',tail1:'#ff7aa1',tail2:'#8d2343'},
 forklift:{body0:'#ffc868',body1:'#f59e0b',body2:'#b45309',body3:'#5a2e05',body4:'#1c1005',glass0:'#fff4d1',glass1:'#ffd773',glass2:'#8d6925',tail0:'#ffd0b0',tail1:'#fb923c',tail2:'#9a3412'},
 equipment:{body0:'#79ecff',body1:'#14b8d4',body2:'#0e7490',body3:'#10324a',body4:'#08141f',glass0:'#e2fdff',glass1:'#8aeaff',glass2:'#2b7ea2',tail0:'#b5f7ff',tail1:'#4ade80',tail2:'#166534'},
 machinery:{body0:'#c5cfdb',body1:'#66758a',body2:'#334155',body3:'#1b2330',body4:'#0a0e15',glass0:'#ecf2f8',glass1:'#b1c2d7',glass2:'#4d6580',tail0:'#ffb4b4',tail1:'#ef4444',tail2:'#991b1b'}
};
let vehicleSvgSequence=0;
function topVisual(value,options={}){
 const shape=shapeKey(value);
 const uid=`veh-${shape}-${++vehicleSvgSequence}`;
 const compact=!!options.compact;
 const classes=['vehicle-visual-v153','vehicle-visual-v152','vehicle-visual-v149','vehicle-silhouette',`shape-${shape}`,compact?'is-compact':''].filter(Boolean).join(' ');
 const preserve=compact?'xMidYMid slice':'xMidYMid meet';
 const common=`class="${classes}" viewBox="0 0 360 560" preserveAspectRatio="${preserve}" aria-hidden="true"`;
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
   <path class="v19-taillight" d="M50 496H69V543H50Z"/><path class="v19-taillight" d="M310 496H291V543H310Z"/>
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
function viewDefs(id,shape='car'){const p=palettes[shape]||palettes.car;return`<defs>
<linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.body0}"/><stop offset=".18" stop-color="${p.body1}"/><stop offset=".5" stop-color="${p.body2}"/><stop offset=".82" stop-color="${p.body3}"/><stop offset="1" stop-color="${p.body4}"/></linearGradient>
<linearGradient id="${id}-body2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.body1}"/><stop offset=".42" stop-color="${p.body2}"/><stop offset="1" stop-color="${p.body4}"/></linearGradient>
<linearGradient id="${id}-body3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.body4}"/><stop offset=".5" stop-color="${p.body2}"/><stop offset="1" stop-color="${p.body4}"/></linearGradient>
<linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.glass0}" stop-opacity=".86"/><stop offset=".25" stop-color="${p.glass1}" stop-opacity=".75"/><stop offset=".66" stop-color="${p.glass2}" stop-opacity=".88"/><stop offset="1" stop-color="#061522" stop-opacity=".97"/></linearGradient>
<linearGradient id="${id}-glass2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.glass1}" stop-opacity=".72"/><stop offset="1" stop-color="#071829" stop-opacity=".96"/></linearGradient>
<linearGradient id="${id}-chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#51687f"/><stop offset=".2" stop-color="#f1f5f9"/><stop offset=".5" stop-color="#8ca1b8"/><stop offset=".8" stop-color="#eef7ff"/><stop offset="1" stop-color="#506176"/></linearGradient>
<radialGradient id="${id}-lamp"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#f8fbff"/><stop offset="1" stop-color="${p.glass1}" stop-opacity=".58"/></radialGradient>
<linearGradient id="${id}-tail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.tail0}"/><stop offset=".45" stop-color="${p.tail1}"/><stop offset="1" stop-color="${p.tail2}"/></linearGradient>
<linearGradient id="${id}-tire" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#010308"/><stop offset=".26" stop-color="#111a27"/><stop offset=".5" stop-color="#050b13"/><stop offset=".74" stop-color="#17202d"/><stop offset="1" stop-color="#010308"/></linearGradient>
<radialGradient id="${id}-rim"><stop offset="0" stop-color="#9fb1c9"/><stop offset=".42" stop-color="#3c536b"/><stop offset="1" stop-color="#111b29"/></radialGradient>
<filter id="${id}-shadow" x="-30%" y="-28%" width="165%" height="185%"><feDropShadow dx="0" dy="18" stdDeviation="12" flood-color="#000" flood-opacity=".52"/></filter>
<filter id="${id}-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`}
function plate(vehicle,x,y,w=78,h=22){const p=esc(vehicle?.placas||'');return`<g class="v153-plate"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/><rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" rx="2" class="v153-plate-inner"/>${p?`<text x="${x+w/2}" y="${y+h*.69}" text-anchor="middle">${p}</text>`:''}</g>`}
function spokes(cx,cy,r1,r2,count=10){let out='';for(let i=0;i<count;i++){const a=(Math.PI*2*i/count)-Math.PI/2;const x1=cx+Math.cos(a)*r1,y1=cy+Math.sin(a)*r1,x2=cx+Math.cos(a)*r2,y2=cy+Math.sin(a)*r2;out+=`<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}"/>`}return out}
function wheelSvg(id,cx,cy,r=57){return`<g class="v153-wheel"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-tire)"/><circle class="v153-tread" cx="${cx}" cy="${cy}" r="${r-5}"/><circle class="v153-rim-outer" cx="${cx}" cy="${cy}" r="${r*.62}"/><circle cx="${cx}" cy="${cy}" r="${r*.53}" fill="url(#${id}-rim)"/><g class="v153-spokes">${spokes(cx,cy,r*.19,r*.48,10)}</g><circle class="v153-brake" cx="${cx}" cy="${cy}" r="${r*.30}"/><circle class="v153-hub" cx="${cx}" cy="${cy}" r="${r*.12}"/><circle class="v153-lug" cx="${cx-7}" cy="${cy}" r="2"/><circle class="v153-lug" cx="${cx+7}" cy="${cy}" r="2"/><circle class="v153-lug" cx="${cx}" cy="${cy-7}" r="2"/><circle class="v153-lug" cx="${cx}" cy="${cy+7}" r="2"/></g>`}
function ground(y=420,rx=305){return`<ellipse class="v153-ground" cx="400" cy="${y}" rx="${rx}" ry="25"/>`}
function mirror(x,y,flip=false){const s=flip?-1:1;return`<g transform="translate(${x} ${y}) scale(${s} 1)"><path class="v153-mirror" d="M0 0Q18 -9 30 4L28 14Q15 20 0 12Z"/><path class="v153-mirror-glass" d="M6 2Q18 -4 25 5L23 10Q14 13 6 9Z"/></g>`}
function handle(x,y,w=25){return`<g class="v153-handle"><rect x="${x}" y="${y}" width="${w}" height="7" rx="3.5"/><path d="M${x+5} ${y+2}H${x+w-5}"/></g>`}
function sidePickup(vehicle,id){return`<g filter="url(#${id}-shadow)">${ground(420,300)}
<path class="v153-underbody" d="M118 332H681L656 361H145Z"/>
<path class="v153-body" fill="url(#${id}-body)" d="M82 319L101 275Q114 244 146 237L294 222L350 165Q370 142 408 140H517Q552 142 575 168L608 209L669 219Q706 226 723 253L738 289L732 319H654Q639 272 585 272Q531 272 516 319H303Q288 272 235 272Q181 272 166 319H91Q82 319 82 319Z"/>
<path class="v153-body-inset" fill="url(#${id}-body2)" d="M100 305L115 276Q126 255 154 248L299 235L356 181Q372 162 406 160H510Q541 162 562 184L593 221L659 230Q688 235 700 257L712 287L649 288Q632 254 585 254Q539 254 521 288H296Q278 254 235 254Q191 254 173 288H106Z"/>
<path class="v153-character-line" d="M146 247Q274 224 428 220Q560 220 660 238"/>
<path class="v153-body2" fill="url(#${id}-body3)" d="M597 224L669 232Q688 236 698 252L705 272L598 271Q587 247 576 232Z"/>
<path class="v153-bed" fill="url(#${id}-body3)" d="M111 251L299 235L296 306H103Z"/>
<path class="v153-bed-inner" d="M129 258L281 244V290H127Z"/>
<path class="v153-bed-rib" d="M152 255V289M182 252V289M212 249V289M242 246V289M272 243V289M128 268H281M128 281H281"/>
<path class="v153-glass" fill="url(#${id}-glass)" d="M362 166H511Q536 170 553 190L579 219H305L326 180Q340 166 362 166Z"/>
<path class="v153-glass-line" d="M407 166V219M489 170L503 219M332 184H558"/>
<path class="v153-door-line" d="M413 219V306M512 219V306M309 246H579M348 219L338 304"/>
<path class="v153-lower-line" d="M309 306H576"/>
<path class="v153-hood-line" d="M582 219L636 226M589 233L660 241"/>
<path class="v153-fender-line" d="M166 319Q178 250 235 250Q293 250 303 319M516 319Q528 250 585 250Q642 250 654 319"/>
<path class="v153-running-board" d="M315 317H532Q536 317 536 321V327Q536 330 532 330H315Q311 330 311 327V321Q311 317 315 317Z"/>
<path class="v153-front-bumper" d="M684 299H729Q734 299 736 304L739 317H683Z"/>
<path class="v153-rear-bumper" d="M84 300H137V319H82Z"/>
<path class="v153-grille" d="M676 257H718L726 292H679Z"/>
<path class="v153-grille-line" d="M684 264H719M686 273H721M688 282H723M698 260V291M709 261V292"/>
<path class="v153-headlight" d="M647 238L690 246L706 257L699 271L662 272L634 257Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/>
<path class="v153-tail-light" d="M96 259H120L122 293H95Z" fill="url(#${id}-tail)"/>
<path class="v153-tail-segment" d="M100 268H118M100 279H118"/>
<path class="v153-roof-rail" d="M377 154H511M387 147H501"/>
<path class="v153-antenna" d="M509 149L522 118"/><circle class="v153-antenna-tip" cx="522" cy="118" r="3"/>
${mirror(308,205,false)}${mirror(579,205,true)}${handle(369,233,24)}${handle(468,233,24)}
${wheelSvg(id,235,319,60)}${wheelSvg(id,585,319,60)}
${plate(vehicle,104,291,64,20)}
</g>`}
function sideTruck(vehicle,id){return`<g filter="url(#${id}-shadow)">${ground(420,310)}
<path class="v153-underbody" d="M96 334H706L681 366H124Z"/>
<path class="v153-body" fill="url(#${id}-body)" d="M90 320L103 244Q109 205 143 190L153 129H347Q389 132 412 166L443 214H665Q706 214 722 243L737 285L736 320H652Q638 273 585 273Q533 273 518 320H315Q301 273 248 273Q196 273 181 320Z"/>
<path class="v153-body-inset" fill="url(#${id}-body2)" d="M107 304L118 246Q124 220 149 210L159 147H336Q368 150 388 177L415 220H654Q686 220 698 246L709 287H646Q627 254 585 254Q544 254 524 287H309Q289 254 248 254Q208 254 188 287H114Z"/>
<path class="v153-glass" fill="url(#${id}-glass)" d="M172 153H330Q361 157 378 186L399 214H160Z"/>
<path class="v153-glass-line" d="M260 153V214"/>
<path class="v153-door-line" d="M262 152V304M415 221V304M159 242H416"/>
<path class="v153-character-line" d="M158 242H416M463 227H660"/>
<path class="v153-truckbox" fill="url(#${id}-body3)" d="M447 227H668Q692 227 704 247L712 304H447Z"/>
<path class="v153-bed-inner" d="M464 240H653Q679 240 686 258L692 291H464Z"/>
<path class="v153-bed-rib" d="M492 241V291M530 241V291M568 241V291M606 241V291M644 241V291M464 256H691M464 273H691"/>
<path class="v153-fender-line" d="M182 320Q192 250 248 250Q304 250 315 320M519 320Q530 250 585 250Q640 250 651 320"/>
<rect class="v153-running-board" x="319" y="318" width="119" height="11" rx="5"/>
<path class="v153-front-bumper" d="M90 301H138L141 319H87Z"/>
<path class="v153-grille" d="M93 270H145L151 301H89Z"/>
<path class="v153-grille-line" d="M99 277H145M101 286H147M103 294H149M111 272V300M123 272V301M135 274V301"/>
<path class="v153-headlight" d="M111 243H149L160 255L157 271L122 273L104 261Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/>
<path class="v153-tail-light" d="M671 249H695L701 286H678Z" fill="url(#${id}-tail)"/>
<path class="v153-tail-segment" d="M676 257H695M678 269H697"/>
${mirror(159,189,false)}${mirror(420,189,true)}${handle(214,232,23)}
${wheelSvg(id,248,320,60)}${wheelSvg(id,585,320,60)}
${plate(vehicle,644,291,64,20)}
</g>`}

function sideCar(vehicle,id){return`<g filter="url(#${id}-shadow)">${ground(420,302)}
<path class="v153-underbody" d="M118 334H686L662 364H146Z"/>
<path class="v153-body" fill="url(#${id}-body)" d="M86 319L103 274Q118 246 147 240L242 230L301 185Q333 153 393 149H480Q526 151 557 171L620 211L678 223Q706 229 721 249L737 286L735 319H654Q639 273 588 273Q536 273 522 319H307Q293 273 244 273Q195 273 181 319Z"/>
<path class="v153-body-inset" fill="url(#${id}-body2)" d="M103 304L118 276Q131 254 156 249L248 240L306 198Q336 171 393 168H475Q516 170 545 188L604 223L660 234Q683 239 696 257L708 288H649Q631 254 588 254Q544 254 525 288H301Q282 254 244 254Q205 254 187 288H107Z"/>
<path class="v153-character-line" d="M147 248Q279 227 397 224Q518 224 659 247"/>
<path class="v153-glass" fill="url(#${id}-glass)" d="M309 185H477Q513 188 540 206L575 223H305L324 199Q340 185 363 185Z"/>
<path class="v153-glass-line" d="M391 185V223M485 189L499 223"/>
<path class="v153-door-line" d="M391 223V307M497 223V307M347 223L339 307M314 250H578"/>
<path class="v153-lower-line" d="M308 308H527"/>
<path class="v153-fender-line" d="M181 320Q193 251 244 251Q294 251 307 320M523 320Q536 251 588 251Q638 251 650 320"/>
<path class="v153-running-board" d="M318 318H524Q529 318 529 322V327Q529 330 524 330H318Q313 330 313 327V322Q313 318 318 318Z"/>
<path class="v153-front-bumper" d="M688 299H734V319H684Z"/><path class="v153-rear-bumper" d="M88 299H141V319H86Z"/>
<path class="v153-grille" d="M676 257H719L727 292H681Z"/><path class="v153-grille-line" d="M684 266H719M686 276H721M689 286H723M697 262V291M708 262V292"/>
<path class="v153-headlight" d="M646 238L690 246L706 257L699 271L661 273L634 257Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/>
<path class="v153-tail-light" d="M98 257H121L124 292H96Z" fill="url(#${id}-tail)"/>
<path class="v153-tail-segment" d="M101 268H120M102 280H121"/>
${mirror(310,207,false)}${mirror(576,206,true)}${handle(365,235,22)}${handle(470,235,22)}
${wheelSvg(id,244,320,60)}${wheelSvg(id,588,320,60)}${plate(vehicle,103,291,64,20)}
</g>`}
function sideSuv(vehicle,id){return`<g filter="url(#${id}-shadow)">${ground(420,306)}
<path class="v153-underbody" d="M112 334H690L666 365H142Z"/>
<path class="v153-body" fill="url(#${id}-body)" d="M82 319L101 271Q116 239 149 232L268 223L329 161Q351 136 392 134H507Q548 136 575 158L621 197L679 210Q709 216 723 237L740 286L737 319H655Q641 272 589 272Q537 272 523 319H307Q292 272 244 272Q196 272 182 319Z"/>
<path class="v153-body-inset" fill="url(#${id}-body2)" d="M101 304L116 274Q130 251 159 245L275 236L334 178Q353 157 392 154H501Q537 156 562 175L606 211L662 222Q686 227 698 244L710 287H649Q631 254 589 254Q548 254 528 287H302Q282 254 244 254Q206 254 187 287H106Z"/>
<path class="v153-character-line" d="M148 246Q286 222 392 222Q521 222 659 244"/>
<path class="v153-glass" fill="url(#${id}-glass)" d="M332 162H505Q535 166 558 184L588 211H309L324 180Q339 162 360 162Z"/>
<path class="v153-glass-line" d="M390 162V211M487 167L503 211M343 183H568"/>
<path class="v153-door-line" d="M390 212V307M498 212V307M339 212L329 307M311 248H589"/>
<path class="v153-lower-line" d="M309 308H531"/>
<path class="v153-fender-line" d="M182 320Q194 250 244 250Q295 250 307 320M525 320Q538 250 589 250Q639 250 651 320"/>
<path class="v153-running-board" d="M318 318H533Q538 318 538 322V327Q538 330 533 330H318Q313 330 313 327V322Q313 318 318 318Z"/>
<path class="v153-front-bumper" d="M689 299H733V319H684Z"/><path class="v153-rear-bumper" d="M86 299H140V319H83Z"/>
<path class="v153-grille" d="M675 256H719L728 292H680Z"/><path class="v153-grille-line" d="M684 265H719M686 275H722M688 285H724M697 261V291M708 261V292"/>
<path class="v153-headlight" d="M645 236L690 245L707 257L701 273L661 274L633 258Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/>
<path class="v153-tail-light" d="M97 254H122L124 291H95Z" fill="url(#${id}-tail)"/>
<path class="v153-tail-segment" d="M100 265H121M101 278H122"/>
<path class="v153-roof-rail" d="M349 145H506M360 138H495"/><path class="v153-antenna" d="M508 140L520 111"/><circle class="v153-antenna-tip" cx="520" cy="111" r="3"/>
${mirror(312,198,false)}${mirror(589,198,true)}${handle(364,230,22)}${handle(472,230,22)}
${wheelSvg(id,244,320,60)}${wheelSvg(id,589,320,60)}${plate(vehicle,103,291,64,20)}
</g>`}
function sideVan(vehicle,id){return`<g filter="url(#${id}-shadow)">${ground(420,314)}
<path class="v153-underbody" d="M110 338H694L670 368H140Z"/>
<path class="v153-body" fill="url(#${id}-body)" d="M76 323L95 255Q104 213 136 196L171 133H514Q561 135 590 162L624 203L684 216Q713 222 727 245L743 290L739 323H655Q640 276 589 276Q537 276 523 323H304Q290 276 241 276Q191 276 177 323Z"/>
<path class="v153-body-inset" fill="url(#${id}-body2)" d="M95 307L109 257Q117 230 144 215L178 151H508Q548 153 573 176L604 214L667 228Q690 233 702 250L714 290H649Q630 257 589 257Q547 257 528 290H299Q279 257 241 257Q201 257 183 290H99Z"/>
<path class="v153-glass" fill="url(#${id}-glass)" d="M181 153H510Q550 157 575 181L601 210H166Z"/>
<path class="v153-glass-line" d="M302 153V210M417 153V210M531 164L550 210"/>
<path class="v153-door-line" d="M302 210V309M419 210V309M553 210V309M180 241H603"/>
<path class="v153-slider" d="M447 242H587M449 254H585"/>
<path class="v153-character-line" d="M167 240H607"/>
<path class="v153-fender-line" d="M176 323Q189 254 241 254Q293 254 304 323M522 323Q534 254 589 254Q644 254 655 323"/>
<rect class="v153-running-board" x="308" y="321" width="250" height="11" rx="5"/>
<path class="v153-front-bumper" d="M690 302H734V323H686Z"/><path class="v153-rear-bumper" d="M82 302H140V323H78Z"/>
<path class="v153-grille" d="M678 261H720L729 297H682Z"/><path class="v153-grille-line" d="M686 269H719M688 279H722M690 289H724M699 265V296M710 265V296"/>
<path class="v153-headlight" d="M649 242L691 249L707 260L700 275L663 276L636 260Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/>
<path class="v153-tail-light" d="M98 258H121L124 296H96Z" fill="url(#${id}-tail)"/>
<path class="v153-tail-segment" d="M100 270H119M101 282H120"/>
${mirror(170,190,false)}${mirror(602,190,true)}${handle(327,231,22)}${handle(456,231,22)}
${wheelSvg(id,241,323,58)}${wheelSvg(id,589,323,58)}${plate(vehicle,104,294,64,20)}
</g>`}
function genericSide(vehicle,shape,id,right=false){const flip=right?'translate(800 0) scale(-1 1)':'';let content=shape==='pickup'?sidePickup(vehicle,id):shape==='truck'?sideTruck(vehicle,id):shape==='car'?sideCar(vehicle,id):shape==='suv'?sideSuv(vehicle,id):shape==='van'?sideVan(vehicle,id):shape==='motorcycle'?sideMotorcycle(id):shape==='forklift'?sideForklift(id):sideMachine(shape,id);return`<g transform="${flip}">${content}</g>`}

function frontRearCar(vehicle,id,rear=false){
 const x=176,top=150,bottom=377,w=448;
 return `<g filter="url(#${id}-shadow)">${ground(423,276)}<path class="v153-body" fill="url(#${id}-body)" d="M${x+34} ${bottom}L${x+52} ${top+92}Q${x+66} ${top+30} ${x+136} ${top}H${x+w-136}Q${x+w-66} ${top+30} ${x+w-52} ${top+92}L${x+w-34} ${bottom}Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M${x+56} ${bottom-13}L${x+72} ${top+101}Q${x+85} ${top+49} ${x+148} ${top+26}H${x+w-148}Q${x+w-85} ${top+49} ${x+w-72} ${top+101}L${x+w-56} ${bottom-13}Z"/>${rear?`<path class="v153-glass" fill="url(#${id}-glass)" d="M${x+138} ${top+48}H${x+w-138}L${x+w-114} ${top+128}H${x+114}Z"/><path class="v153-glass-line" d="M400 ${top+48}V${top+128}"/><path class="v153-tailgate-line" d="M${x+96} ${top+190}Q400 ${top+168} ${x+w-96} ${top+190}M${x+120} ${top+210}H${x+w-120}"/><rect class="v153-tail-cluster" x="${x+68}" y="${bottom-101}" width="70" height="34" rx="9" fill="url(#${id}-tail)"/><rect class="v153-tail-cluster" x="${x+w-138}" y="${bottom-101}" width="70" height="34" rx="9" fill="url(#${id}-tail)"/><path class="v153-tail-segment" d="M${x+76} ${bottom-89}H${x+130}M${x+w-130} ${bottom-89}H${x+w-76}"/><rect class="v153-rear-bumper" x="${x+105}" y="${bottom-31}" width="${w-210}" height="24" rx="10"/>${plate(vehicle,362,bottom-76,76,22)}`:`<path class="v153-glass" fill="url(#${id}-glass)" d="M${x+126} ${top+40}H${x+w-126}L${x+w-100} ${top+130}H${x+100}Z"/><path class="v153-glass-line" d="M400 ${top+40}V${top+130}"/><path class="v153-hood-line" d="M${x+98} ${top+165}Q400 ${top+130} ${x+w-98} ${top+165}M${x+84} ${top+187}H${x+w-84}"/><path class="v153-headlight" d="M${x+70} ${bottom-109}H${x+148}L${x+167} ${bottom-95}L${x+144} ${bottom-74}H${x+72}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><path class="v153-headlight" d="M${x+w-70} ${bottom-109}H${x+w-148}L${x+w-167} ${bottom-95}L${x+w-144} ${bottom-74}H${x+w-72}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><rect class="v153-grille" x="${x+132}" y="${bottom-82}" width="${w-264}" height="39" rx="12"/><path class="v153-grille-line" d="M${x+148} ${bottom-70}H${x+w-148}M${x+148} ${bottom-57}H${x+w-148}"/><circle class="v153-fog" cx="${x+103}" cy="${bottom-53}" r="10"/><circle class="v153-fog" cx="${x+w-103}" cy="${bottom-53}" r="10"/>${plate(vehicle,362,bottom-74,76,22)}`}<path class="v153-front-mirror" d="M${x+32} ${top+117}L${x-6} ${top+134}L${x+10} ${top+154}L${x+43} ${top+141}Z"/><path class="v153-front-mirror" d="M${x+w-32} ${top+117}L${x+w+6} ${top+134}L${x+w-10} ${top+154}L${x+w-43} ${top+141}Z"/><rect class="v153-front-wheel" x="${x+10}" y="${bottom-9}" width="80" height="34" rx="14"/><rect class="v153-front-wheel" x="${x+w-90}" y="${bottom-9}" width="80" height="34" rx="14"/></g>`}
function frontRearSuv(vehicle,id,rear=false){
 const x=162,top=126,bottom=382,w=476;
 return `<g filter="url(#${id}-shadow)">${ground(424,286)}<path class="v153-body" fill="url(#${id}-body)" d="M${x+26} ${bottom}L${x+44} ${top+92}Q${x+56} ${top+22} ${x+126} ${top}H${x+w-126}Q${x+w-56} ${top+22} ${x+w-44} ${top+92}L${x+w-26} ${bottom}Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M${x+47} ${bottom-12}L${x+61} ${top+102}Q${x+72} ${top+40} ${x+139} ${top+22}H${x+w-139}Q${x+w-72} ${top+40} ${x+w-61} ${top+102}L${x+w-47} ${bottom-12}Z"/>${rear?`<path class="v153-glass" fill="url(#${id}-glass)" d="M${x+118} ${top+35}H${x+w-118}L${x+w-90} ${top+138}H${x+90}Z"/><path class="v153-glass-line" d="M400 ${top+35}V${top+138}"/><path class="v153-tailgate" d="M${x+74} ${top+166}H${x+w-74}V${bottom-30}H${x+74}Z"/><path class="v153-tailgate-line" d="M400 ${top+168}V${bottom-34}M${x+94} ${top+194}H${x+w-94}"/><rect class="v153-tail-cluster" x="${x+46}" y="${bottom-104}" width="76" height="42" rx="11" fill="url(#${id}-tail)"/><rect class="v153-tail-cluster" x="${x+w-122}" y="${bottom-104}" width="76" height="42" rx="11" fill="url(#${id}-tail)"/><path class="v153-tail-segment" d="M${x+55} ${bottom-89}H${x+113}M${x+w-113} ${bottom-89}H${x+w-55}"/><rect class="v153-rear-bumper" x="${x+92}" y="${bottom-31}" width="${w-184}" height="24" rx="9"/>${plate(vehicle,362,bottom-80,76,22)}`:`<path class="v153-glass" fill="url(#${id}-glass)" d="M${x+110} ${top+26}H${x+w-110}L${x+w-84} ${top+142}H${x+84}Z"/><path class="v153-glass-line" d="M400 ${top+26}V${top+142}"/><path class="v153-hood-line" d="M${x+94} ${top+172}Q400 ${top+140} ${x+w-94} ${top+172}M${x+82} ${top+198}H${x+w-82}"/><path class="v153-headlight" d="M${x+50} ${bottom-114}H${x+133}L${x+156} ${bottom-95}L${x+131} ${bottom-71}H${x+53}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><path class="v153-headlight" d="M${x+w-50} ${bottom-114}H${x+w-133}L${x+w-156} ${bottom-95}L${x+w-131} ${bottom-71}H${x+w-53}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><rect class="v153-grille" x="${x+120}" y="${bottom-84}" width="${w-240}" height="42" rx="13"/><path class="v153-grille-line" d="M${x+138} ${bottom-70}H${x+w-138}M${x+138} ${bottom-57}H${x+w-138}"/><circle class="v153-fog" cx="${x+86}" cy="${bottom-54}" r="11"/><circle class="v153-fog" cx="${x+w-86}" cy="${bottom-54}" r="11"/>${plate(vehicle,362,bottom-74,76,22)}`}<path class="v153-front-mirror" d="M${x+27} ${top+120}L${x-14} ${top+138}L${x+5} ${top+160}L${x+38} ${top+145}Z"/><path class="v153-front-mirror" d="M${x+w-27} ${top+120}L${x+w+14} ${top+138}L${x+w-5} ${top+160}L${x+w-38} ${top+145}Z"/><rect class="v153-front-wheel" x="${x+5}" y="${bottom-10}" width="84" height="35" rx="14"/><rect class="v153-front-wheel" x="${x+w-89}" y="${bottom-10}" width="84" height="35" rx="14"/></g>`}
function frontRearPickup(vehicle,id,rear=false){
 const x=154,top=130,bottom=383,w=492;
 return `<g filter="url(#${id}-shadow)">${ground(424,292)}<path class="v153-body" fill="url(#${id}-body)" d="M${x+24} ${bottom}L${x+44} ${top+108}Q${x+57} ${top+28} ${x+132} ${top}H${x+w-132}Q${x+w-57} ${top+28} ${x+w-44} ${top+108}L${x+w-24} ${bottom}Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M${x+47} ${bottom-12}L${x+63} ${top+117}Q${x+75} ${top+48} ${x+149} ${top+25}H${x+w-149}Q${x+w-75} ${top+48} ${x+w-63} ${top+117}L${x+w-47} ${bottom-12}Z"/>${rear?`<path class="v153-glass" fill="url(#${id}-glass)" d="M${x+138} ${top+44}H${x+w-138}L${x+w-111} ${top+122}H${x+111}Z"/><path class="v153-glass-line" d="M400 ${top+44}V${top+122}"/><path class="v153-tailgate" d="M${x+84} ${top+162}H${x+w-84}V${bottom-30}H${x+84}Z"/><path class="v153-tailgate-line" d="M400 ${top+162}V${bottom-32}M${x+104} ${top+191}H${x+w-104}"/><path class="v153-bed-rib" d="M${x+132} ${top+175}V${bottom-30}M${x+184} ${top+175}V${bottom-30}M${x+w-184} ${top+175}V${bottom-30}M${x+w-132} ${top+175}V${bottom-30}"/><rect class="v153-tail-cluster" x="${x+52}" y="${bottom-113}" width="64" height="52" rx="10" fill="url(#${id}-tail)"/><rect class="v153-tail-cluster" x="${x+w-116}" y="${bottom-113}" width="64" height="52" rx="10" fill="url(#${id}-tail)"/><path class="v153-tail-segment" d="M${x+60} ${bottom-95}H${x+108}M${x+w-108} ${bottom-95}H${x+w-60}"/><rect class="v153-rear-bumper" x="${x+110}" y="${bottom-31}" width="${w-220}" height="24" rx="9"/>${plate(vehicle,362,bottom-82,76,22)}`:`<path class="v153-glass" fill="url(#${id}-glass)" d="M${x+120} ${top+30}H${x+w-120}L${x+w-92} ${top+139}H${x+92}Z"/><path class="v153-glass-line" d="M400 ${top+30}V${top+139}"/><path class="v153-hood-line" d="M${x+98} ${top+166}Q400 ${top+132} ${x+w-98} ${top+166}M${x+82} ${top+196}H${x+w-82}"/><path class="v153-headlight" d="M${x+48} ${bottom-117}H${x+132}L${x+158} ${bottom-95}L${x+131} ${bottom-68}H${x+50}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><path class="v153-headlight" d="M${x+w-48} ${bottom-117}H${x+w-132}L${x+w-158} ${bottom-95}L${x+w-131} ${bottom-68}H${x+w-50}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><rect class="v153-grille" x="${x+118}" y="${bottom-92}" width="${w-236}" height="50" rx="12"/><path class="v153-grille-line" d="M${x+138} ${bottom-77}H${x+w-138}M${x+138} ${bottom-63}H${x+w-138}M${x+138} ${bottom-49}H${x+w-138}"/><path class="v153-rear-bumper" d="M${x+140} ${bottom-36}H${x+w-140}L${x+w-122} ${bottom-12}H${x+122}Z"/>${plate(vehicle,362,bottom-72,76,22)}`}<path class="v153-front-mirror" d="M${x+25} ${top+123}L${x-18} ${top+143}L${x+4} ${top+165}L${x+38} ${top+149}Z"/><path class="v153-front-mirror" d="M${x+w-25} ${top+123}L${x+w+18} ${top+143}L${x+w-4} ${top+165}L${x+w-38} ${top+149}Z"/><rect class="v153-front-wheel" x="${x+4}" y="${bottom-10}" width="88" height="36" rx="14"/><rect class="v153-front-wheel" x="${x+w-92}" y="${bottom-10}" width="88" height="36" rx="14"/></g>`}
function frontRearVan(vehicle,id,rear=false){
 const x=150,top=92,bottom=385,w=500;
 return `<g filter="url(#${id}-shadow)">${ground(425,294)}<path class="v153-body" fill="url(#${id}-body)" d="M${x+20} ${bottom}L${x+38} ${top+126}Q${x+46} ${top+18} ${x+121} ${top}H${x+w-121}Q${x+w-46} ${top+18} ${x+w-38} ${top+126}L${x+w-20} ${bottom}Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M${x+44} ${bottom-13}L${x+58} ${top+132}Q${x+67} ${top+42} ${x+136} ${top+24}H${x+w-136}Q${x+w-67} ${top+42} ${x+w-58} ${top+132}L${x+w-44} ${bottom-13}Z"/>${rear?`<path class="v153-glass" fill="url(#${id}-glass)" d="M${x+112} ${top+33}H${x+w-112}V${top+166}H${x+112}Z"/><path class="v153-glass-line" d="M400 ${top+33}V${top+166}"/><path class="v153-tailgate" d="M${x+78} ${top+182}H${x+w-78}V${bottom-29}H${x+78}Z"/><path class="v153-tailgate-line" d="M400 ${top+182}V${bottom-31}M${x+112} ${top+215}H${x+w-112}"/><rect class="v153-tail-cluster" x="${x+52}" y="${bottom-130}" width="56" height="78" rx="11" fill="url(#${id}-tail)"/><rect class="v153-tail-cluster" x="${x+w-108}" y="${bottom-130}" width="56" height="78" rx="11" fill="url(#${id}-tail)"/><path class="v153-tail-segment" d="M${x+60} ${bottom-104}H${x+100}M${x+60} ${bottom-85}H${x+100}M${x+w-100} ${bottom-104}H${x+w-60}M${x+w-100} ${bottom-85}H${x+w-60}"/><rect class="v153-rear-bumper" x="${x+95}" y="${bottom-31}" width="${w-190}" height="24" rx="8"/>${plate(vehicle,362,bottom-80,76,22)}`:`<path class="v153-glass" fill="url(#${id}-glass)" d="M${x+103} ${top+25}H${x+w-103}L${x+w-80} ${top+153}H${x+80}Z"/><path class="v153-glass-line" d="M400 ${top+25}V${top+153}M${x+248} ${top+25}V${top+153}M${x+w-248} ${top+25}V${top+153}"/><path class="v153-hood-line" d="M${x+95} ${top+188}Q400 ${top+150} ${x+w-95} ${top+188}M${x+82} ${top+215}H${x+w-82}"/><path class="v153-headlight" d="M${x+44} ${bottom-124}H${x+122}L${x+142} ${bottom-103}L${x+120} ${bottom-74}H${x+48}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><path class="v153-headlight" d="M${x+w-44} ${bottom-124}H${x+w-122}L${x+w-142} ${bottom-103}L${x+w-120} ${bottom-74}H${x+w-48}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><rect class="v153-grille" x="${x+120}" y="${bottom-92}" width="${w-240}" height="45" rx="12"/><path class="v153-grille-line" d="M${x+140} ${bottom-78}H${x+w-140}M${x+140} ${bottom-64}H${x+w-140}M${x+140} ${bottom-50}H${x+w-140}"/><circle class="v153-fog" cx="${x+86}" cy="${bottom-52}" r="11"/><circle class="v153-fog" cx="${x+w-86}" cy="${bottom-52}" r="11"/>${plate(vehicle,362,bottom-72,76,22)}`}<path class="v153-front-mirror" d="M${x+22} ${top+144}L${x-20} ${top+162}L${x+4} ${top+184}L${x+38} ${top+170}Z"/><path class="v153-front-mirror" d="M${x+w-22} ${top+144}L${x+w+20} ${top+162}L${x+w-4} ${top+184}L${x+w-38} ${top+170}Z"/><rect class="v153-front-wheel" x="${x+3}" y="${bottom-10}" width="90" height="36" rx="14"/><rect class="v153-front-wheel" x="${x+w-93}" y="${bottom-10}" width="90" height="36" rx="14"/></g>`}
function frontRearTruck(vehicle,id,rear=false){
 const x=140,top=92,bottom=386,w=520;
 return `<g filter="url(#${id}-shadow)">${ground(425,302)}<path class="v153-body" fill="url(#${id}-body)" d="M${x+18} ${bottom}L${x+36} ${top+128}Q${x+42} ${top+12} ${x+122} ${top}H${x+w-122}Q${x+w-42} ${top+12} ${x+w-36} ${top+128}L${x+w-18} ${bottom}Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M${x+42} ${bottom-13}L${x+55} ${top+136}Q${x+62} ${top+35} ${x+139} ${top+18}H${x+w-139}Q${x+w-62} ${top+35} ${x+w-55} ${top+136}L${x+w-42} ${bottom-13}Z"/>${rear?`<path class="v153-truckbox" fill="url(#${id}-body3)" d="M${x+58} ${top+172}H${x+w-58}V${bottom-27}H${x+58}Z"/><path class="v153-bed-rib" d="M${x+106} ${top+172}V${bottom-27}M${x+154} ${top+172}V${bottom-27}M${x+202} ${top+172}V${bottom-27}M${x+250} ${top+172}V${bottom-27}M${x+w-202} ${top+172}V${bottom-27}M${x+w-154} ${top+172}V${bottom-27}M${x+w-106} ${top+172}V${bottom-27}M${x+58} ${top+204}H${x+w-58}"/><path class="v153-glass" fill="url(#${id}-glass)" d="M${x+145} ${top+34}H${x+w-145}L${x+w-120} ${top+132}H${x+120}Z"/><path class="v153-glass-line" d="M400 ${top+34}V${top+132}"/><rect class="v153-tail-cluster" x="${x+64}" y="${bottom-126}" width="62" height="72" rx="10" fill="url(#${id}-tail)"/><rect class="v153-tail-cluster" x="${x+w-126}" y="${bottom-126}" width="62" height="72" rx="10" fill="url(#${id}-tail)"/><path class="v153-tail-segment" d="M${x+72} ${bottom-103}H${x+118}M${x+72} ${bottom-84}H${x+118}M${x+w-118} ${bottom-103}H${x+w-72}M${x+w-118} ${bottom-84}H${x+w-72}"/><rect class="v153-rear-bumper" x="${x+108}" y="${bottom-30}" width="${w-216}" height="23" rx="8"/>${plate(vehicle,362,bottom-79,76,22)}`:`<path class="v153-glass" fill="url(#${id}-glass)" d="M${x+126} ${top+25}H${x+w-126}L${x+w-95} ${top+150}H${x+95}Z"/><path class="v153-glass-line" d="M400 ${top+25}V${top+150}"/><path class="v153-hood-line" d="M${x+98} ${top+192}Q400 ${top+150} ${x+w-98} ${top+192}M${x+84} ${top+220}H${x+w-84}"/><path class="v153-headlight" d="M${x+46} ${bottom-126}H${x+138}L${x+164} ${bottom-100}L${x+136} ${bottom-68}H${x+50}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><path class="v153-headlight" d="M${x+w-46} ${bottom-126}H${x+w-138}L${x+w-164} ${bottom-100}L${x+w-136} ${bottom-68}H${x+w-50}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><rect class="v153-grille" x="${x+122}" y="${bottom-96}" width="${w-244}" height="51" rx="12"/><path class="v153-grille-line" d="M${x+144} ${bottom-80}H${x+w-144}M${x+144} ${bottom-66}H${x+w-144}M${x+144} ${bottom-52}H${x+w-144}M${x+180} ${bottom-91}V${bottom-47}M${x+w-180} ${bottom-91}V${bottom-47}"/><circle class="v153-fog" cx="${x+93}" cy="${bottom-55}" r="11"/><circle class="v153-fog" cx="${x+w-93}" cy="${bottom-55}" r="11"/>${plate(vehicle,362,bottom-73,76,22)}`}<path class="v153-front-mirror" d="M${x+18} ${top+153}L${x-28} ${top+174}L${x+1} ${top+196}L${x+39} ${top+179}Z"/><path class="v153-front-mirror" d="M${x+w-18} ${top+153}L${x+w+28} ${top+174}L${x+w-1} ${top+196}L${x+w-39} ${top+179}Z"/><rect class="v153-front-wheel" x="${x+2}" y="${bottom-10}" width="93" height="36" rx="14"/><rect class="v153-front-wheel" x="${x+w-95}" y="${bottom-10}" width="93" height="36" rx="14"/></g>`}
function genericFrontRear(vehicle,shape,id,rear=false){if(shape==='motorcycle')return frontRearMotorcycle(id,rear);if(shape==='forklift')return frontRearForklift(id,rear);if(shape==='equipment'||shape==='machinery')return frontRearMachine(shape,id,rear);if(shape==='pickup')return frontRearPickup(vehicle,id,rear);if(shape==='suv')return frontRearSuv(vehicle,id,rear);if(shape==='van')return frontRearVan(vehicle,id,rear);if(shape==='truck')return frontRearTruck(vehicle,id,rear);return frontRearCar(vehicle,id,rear)}
function frontRearMotorcycle(id,rear=false){return`<g filter="url(#${id}-shadow)">${ground(421,190)}<ellipse class="v153-front-wheel-round" cx="400" cy="357" rx="58" ry="67"/><path class="v153-body" fill="url(#${id}-body)" d="M336 332L356 183Q400 130 444 183L464 332Z"/><path class="v153-glass" fill="url(#${id}-glass)" d="M363 201Q400 169 437 201L441 252H359Z"/><path class="v153-bike-line" d="M333 227H467M400 181V328"/>${rear?'<rect class="v153-tail-cluster" x="379" y="286" width="42" height="28" rx="8" fill="url(#'+id+'-tail)"/>':'<circle class="v153-headlight" cx="400" cy="283" r="24" fill="url(#'+id+'-lamp)" filter="url(#'+id+'-glow)"/>'}</g>`}
function frontRearForklift(id,rear=false){return`<g filter="url(#${id}-shadow)">${ground(421,245)}<path class="v153-body" fill="url(#${id}-body)" d="M255 372V181Q255 144 292 138H508Q545 144 545 181V372Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M280 356V204Q280 174 309 169H491Q520 174 520 204V356Z"/><path class="v153-glass" fill="url(#${id}-glass)" d="M311 188H489V283H311Z"/><path class="v153-glass-line" d="M400 188V283"/><path class="v153-cage" d="M276 163V74H524V163M318 74V34M482 74V34M318 34H482"/>${rear?'<rect class="v153-tail-cluster" x="295" y="317" width="47" height="31" rx="7" fill="url(#'+id+'-tail)"/><rect class="v153-tail-cluster" x="458" y="317" width="47" height="31" rx="7" fill="url(#'+id+'-tail)"/>':'<path class="v153-fork" d="M322 371V449M478 371V449"/>'}</g>`}
function frontRearMachine(shape,id,rear=false){return`<g filter="url(#${id}-shadow)">${ground(421,260)}${shape==='machinery'?'<rect class="v153-track" x="204" y="332" width="392" height="77" rx="35"/>':''}<path class="v153-body" fill="url(#${id}-body)" d="M258 376V143Q258 101 302 94H498Q542 101 542 143V376Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M281 356V164Q281 126 316 121H484Q519 126 519 164V356Z"/><path class="v153-glass" fill="url(#${id}-glass)" d="M309 149H491V260H309Z"/><path class="v153-glass-line" d="M400 149V260"/><path class="v153-machine-line" d="M289 286H511M289 310H511"/>${rear?'<rect class="v153-tail-cluster" x="291" y="324" width="48" height="31" rx="7" fill="url(#'+id+'-tail)"/><rect class="v153-tail-cluster" x="461" y="324" width="48" height="31" rx="7" fill="url(#'+id+'-tail)"/>':'<rect class="v153-grille" x="330" y="317" width="140" height="29" rx="9"/>'}</g>`}
function genericFrontRear(vehicle,shape,id,rear=false){if(shape==='motorcycle')return frontRearMotorcycle(id,rear);if(shape==='forklift')return frontRearForklift(id,rear);if(shape==='equipment'||shape==='machinery')return frontRearMachine(shape,id,rear);if(shape==='pickup')return frontRearPickup(vehicle,id,rear);if(shape==='suv')return frontRearSuv(vehicle,id,rear);if(shape==='van')return frontRearVan(vehicle,id,rear);if(shape==='truck')return frontRearTruck(vehicle,id,rear);return frontRearCar(vehicle,id,rear)}
function render(vehicle,view='superior',options={}){const shape=shapeKey(vehicle),safe=['superior','frontal','lado_izquierdo','lado_derecho','trasera'].includes(view)?view:'superior';if(safe==='superior')return topVisual(vehicle,options);const id=`v159-${shape}-${safe}-${++vehicleSvgSequence}`;const content=safe==='frontal'?genericFrontRear(vehicle,shape,id,false):safe==='trasera'?genericFrontRear(vehicle,shape,id,true):safe==='lado_derecho'?genericSide(vehicle,shape,id,true):genericSide(vehicle,shape,id,false);const classes=['vehicle-visual-v153','vehicle-visual-v152','vehicle-visual-v149','vehicle-silhouette',options.compact?'is-compact':''].filter(Boolean).join(' ');let viewBox;if(safe==='frontal'||safe==='trasera'){viewBox=options.compact?(shape==='truck'?'92 72 616 330':shape==='van'?'102 82 596 316':shape==='pickup'?'108 90 584 304':shape==='suv'?'108 88 584 306':'110 92 580 300'):'105 55 590 395';}else{viewBox=options.compact?(shape==='pickup'?'74 132 654 214':shape==='truck'?'56 128 688 220':shape==='suv'?'68 128 666 216':shape==='van'?'58 128 686 220':shape==='car'?'84 132 640 210':'62 120 676 240'):'35 70 730 365';}return`<svg class="${classes}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(labels[shape])} · ${esc(safe)}">${viewDefs(id,shape)}${content}</svg>`}
window.NexusVehicleVisuals={render,type:shapeKey,label:v=>labels[shapeKey(v)]||'Vehículo',version:'159'};
})();
