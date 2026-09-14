(()=>{
'use strict';
const clean=v=>String(v??'').trim();
const esc=v=>clean(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const normalize=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'_');
const shapeKey=value=>{const raw=normalize(value?.tipo??value);if(['pickup','camioneta_pickup'].includes(raw))return'pickup';if(['camioneta','suv'].includes(raw))return'suv';if(['automovil','auto','coche','sedan'].includes(raw))return'car';if(['van','minivan'].includes(raw))return'van';if(['camion','tractocamion'].includes(raw))return'truck';if(['motocicleta','moto'].includes(raw))return'motorcycle';if(['montacargas','forklift'].includes(raw))return'forklift';if(['generador_movil','generador','genny'].includes(raw))return'equipment';if(['maquinaria_movil','maquinaria'].includes(raw))return'machinery';return'car'};
const labels={pickup:'Pickup',suv:'Camioneta',car:'Automóvil',van:'Van',truck:'Camión',motorcycle:'Motocicleta',forklift:'Montacargas',equipment:'Generador móvil / equipo',machinery:'Maquinaria móvil'};
let vehicleSvgSequence=0;
function topVisual(value){
 const shape=shapeKey(value);
 const uid=`veh-${shape}-${++vehicleSvgSequence}`;
 const common='class="vehicle-visual-v153 vehicle-visual-v152 vehicle-visual-v149 vehicle-silhouette" viewBox="0 0 360 560" preserveAspectRatio="xMidYMid meet" aria-hidden="true"';
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
function viewDefs(id){return`<defs>
<linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#426b9b"/><stop offset=".18" stop-color="#2d527f"/><stop offset=".5" stop-color="#1a3659"/><stop offset=".82" stop-color="#10243e"/><stop offset="1" stop-color="#081626"/></linearGradient>
<linearGradient id="${id}-body2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#335982"/><stop offset=".42" stop-color="#1d3c62"/><stop offset="1" stop-color="#0c1b2f"/></linearGradient>
<linearGradient id="${id}-body3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#11243c"/><stop offset=".5" stop-color="#27496e"/><stop offset="1" stop-color="#0a1728"/></linearGradient>
<linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ac7f4" stop-opacity=".82"/><stop offset=".25" stop-color="#2e7bb0" stop-opacity=".72"/><stop offset=".66" stop-color="#133d62" stop-opacity=".86"/><stop offset="1" stop-color="#061522" stop-opacity=".97"/></linearGradient>
<linearGradient id="${id}-glass2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f93c7" stop-opacity=".72"/><stop offset="1" stop-color="#071829" stop-opacity=".96"/></linearGradient>
<linearGradient id="${id}-chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#51687f"/><stop offset=".2" stop-color="#d9e6f3"/><stop offset=".5" stop-color="#8ca1b8"/><stop offset=".8" stop-color="#eef7ff"/><stop offset="1" stop-color="#506176"/></linearGradient>
<radialGradient id="${id}-lamp"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#dff3ff"/><stop offset="1" stop-color="#58b9f5" stop-opacity=".58"/></radialGradient>
<linearGradient id="${id}-tail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8793"/><stop offset=".45" stop-color="#ef4055"/><stop offset="1" stop-color="#8c102a"/></linearGradient>
<linearGradient id="${id}-tire" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#010308"/><stop offset=".26" stop-color="#111a27"/><stop offset=".5" stop-color="#050b13"/><stop offset=".74" stop-color="#17202d"/><stop offset="1" stop-color="#010308"/></linearGradient>
<radialGradient id="${id}-rim"><stop offset="0" stop-color="#73879d"/><stop offset=".42" stop-color="#33485e"/><stop offset="1" stop-color="#111b29"/></radialGradient>
<filter id="${id}-shadow" x="-30%" y="-28%" width="165%" height="185%"><feDropShadow dx="0" dy="16" stdDeviation="12" flood-color="#000" flood-opacity=".5"/></filter>
<filter id="${id}-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`}
function plate(vehicle,x,y,w=78,h=22){const p=esc(vehicle?.placas||'');return`<g class="v153-plate"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/><rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" rx="2" class="v153-plate-inner"/>${p?`<text x="${x+w/2}" y="${y+h*.69}" text-anchor="middle">${p}</text>`:''}</g>`}
function spokes(cx,cy,r1,r2,count=10){let out='';for(let i=0;i<count;i++){const a=(Math.PI*2*i/count)-Math.PI/2;const x1=cx+Math.cos(a)*r1,y1=cy+Math.sin(a)*r1,x2=cx+Math.cos(a)*r2,y2=cy+Math.sin(a)*r2;out+=`<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}"/>`}return out}
function wheelSvg(id,cx,cy,r=57){return`<g class="v153-wheel"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-tire)"/><circle class="v153-tread" cx="${cx}" cy="${cy}" r="${r-5}"/><circle class="v153-rim-outer" cx="${cx}" cy="${cy}" r="${r*.62}"/><circle cx="${cx}" cy="${cy}" r="${r*.53}" fill="url(#${id}-rim)"/><g class="v153-spokes">${spokes(cx,cy,r*.19,r*.48,10)}</g><circle class="v153-brake" cx="${cx}" cy="${cy}" r="${r*.30}"/><circle class="v153-hub" cx="${cx}" cy="${cy}" r="${r*.12}"/><circle class="v153-lug" cx="${cx-7}" cy="${cy}" r="2"/><circle class="v153-lug" cx="${cx+7}" cy="${cy}" r="2"/><circle class="v153-lug" cx="${cx}" cy="${cy-7}" r="2"/><circle class="v153-lug" cx="${cx}" cy="${cy+7}" r="2"/></g>`}
function ground(y=420,rx=305){return`<ellipse class="v153-ground" cx="400" cy="${y}" rx="${rx}" ry="25"/>`}
function mirror(x,y,flip=false){const s=flip?-1:1;return`<g transform="translate(${x} ${y}) scale(${s} 1)"><path class="v153-mirror" d="M0 0Q18 -9 30 4L28 14Q15 20 0 12Z"/><path class="v153-mirror-glass" d="M6 2Q18 -4 25 5L23 10Q14 13 6 9Z"/></g>`}
function handle(x,y,w=25){return`<g class="v153-handle"><rect x="${x}" y="${y}" width="${w}" height="7" rx="3.5"/><path d="M${x+5} ${y+2}H${x+w-5}"/></g>`}
function sidePickup(vehicle,id){return`<g filter="url(#${id}-shadow)">${ground(414,315)}
<path class="v153-underbody" d="M91 331H716L690 362H122Z"/>
<path class="v153-body" fill="url(#${id}-body)" d="M79 318L88 274Q94 246 122 236L265 208L302 152Q316 130 348 126H500Q532 128 550 151L593 207L670 222Q699 228 713 251L731 318H654Q642 271 591 271Q540 271 526 318H291Q278 271 226 271Q175 271 161 318Z"/>
<path class="v153-body-inset" fill="url(#${id}-body2)" d="M101 306L110 275Q116 258 137 251L278 224L315 168Q326 151 352 149H491Q515 150 531 170L567 220L663 237Q682 241 690 258L702 306H655Q638 256 591 256Q544 256 525 306H292Q274 256 226 256Q178 256 160 306Z"/>
<path class="v153-bed" fill="url(#${id}-body3)" d="M92 246L281 213L286 300H101Z"/>
<path class="v153-bed-inner" d="M112 253L264 226L268 286H110Z"/>
<path class="v153-bed-rib" d="M139 251L144 285M174 245L179 282M209 239L214 279M244 232L249 276M111 267L269 240M110 281L270 254"/>
<path class="v153-roof" fill="url(#${id}-body2)" d="M306 157Q318 134 349 130H497Q523 132 541 156L584 210H274Z"/>
<path class="v153-glass" fill="url(#${id}-glass)" d="M322 151H490Q511 153 526 173L555 209H290Z"/>
<path class="v153-glass-line" d="M404 151V209M487 153L500 209"/>
<path class="v153-door-line" d="M405 211V307M510 211L523 307M294 244H558M348 211L338 307"/>
<path class="v153-character-line" d="M115 265Q292 220 557 227L678 245"/>
<path class="v153-lower-line" d="M296 311H524"/>
<path class="v153-fender-line" d="M160 318Q171 247 226 247Q282 247 292 318M525 318Q536 247 591 247Q646 247 655 318"/>
<path class="v153-hood" fill="url(#${id}-body3)" d="M558 219L670 233Q694 237 706 257L716 285L593 281L548 250Z"/>
<rect class="v153-running-board" x="301" y="316" width="222" height="11" rx="5"/>
<rect class="v153-rear-bumper" x="76" y="301" width="60" height="23" rx="7"/>
<rect class="v153-front-bumper" x="684" y="300" width="48" height="24" rx="7"/>
<path class="v153-tail-light" d="M91 260H111L116 296H92Z" fill="url(#${id}-tail)"/>
<path class="v153-headlight" d="M660 241L700 251L711 269L676 276L648 260Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/>
<path class="v153-grille" d="M681 270H718L726 294H689Z"/>
<path class="v153-grille-line" d="M687 277H718M690 284H721M697 272V292M708 273V293"/>
${mirror(290,198,false)}${mirror(559,198,true)}${handle(351,231,26)}${handle(452,231,26)}
<path class="v153-roof-rail" d="M331 139H505M342 132H493"/>
<path class="v153-antenna" d="M505 132L519 97"/><circle class="v153-antenna-tip" cx="519" cy="96" r="3"/>
<path class="v153-door-line" d="M330 212L317 306M547 212L560 306"/>
<path class="v153-character-line" d="M304 250H553"/>
${wheelSvg(id,226,318,60)}${wheelSvg(id,591,318,60)}
${plate(vehicle,94,291,64,20)}
</g>`}
function sideTruck(vehicle,id){return`<g filter="url(#${id}-shadow)">${ground(414,325)}
<path class="v153-underbody" d="M112 333H706L681 371H147Z"/>
<path class="v153-body" fill="url(#${id}-body)" d="M66 327L91 226Q101 191 144 178L157 113H365Q407 116 430 157L468 218H712Q728 219 735 237L749 327H658Q642 278 592 278Q542 278 526 327H322Q306 278 256 278Q206 278 190 327Z"/>
<path class="v153-roof" fill="url(#${id}-body2)" d="M171 127H347Q382 131 399 167L421 214H148Z"/>
<path class="v153-glass" fill="url(#${id}-glass)" d="M182 139H340Q369 143 383 176L400 213H160Z"/>
<path class="v153-glass-line" d="M281 139V213"/>
<path class="v153-door-line" d="M285 137V306M423 219V306M149 246H423"/>
<path class="v153-truckbox" fill="url(#${id}-body3)" d="M466 229H710L728 311H466Z"/>
<path class="v153-bed-inner" d="M481 241H699L709 298H481Z"/>
<path class="v153-bed-rib" d="M503 242V297M545 242V297M587 242V297M629 242V297M671 242V297"/>
<path class="v153-fender-line" d="M189 327Q202 256 256 256Q311 256 323 327M525 327Q538 256 592 256Q647 256 659 327"/>
<rect class="v153-running-board" x="324" y="318" width="137" height="11" rx="5"/>
<path class="v153-headlight" d="M96 254H151L164 274L119 284L91 273Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/>
<path class="v153-tail-light" d="M710 246H731L738 281H717Z" fill="url(#${id}-tail)"/>
<path class="v153-grille" d="M81 281H145L151 308H75Z"/><path class="v153-grille-line" d="M87 287H143M90 296H146M103 282V306M120 282V307M137 284V308"/>
${mirror(151,188,false)}${mirror(431,188,true)}${handle(218,235,25)}
${wheelSvg(id,256,327,62)}${wheelSvg(id,592,327,62)}${wheelSvg(id,675,327,56)}
${plate(vehicle,671,295,61,20)}
</g>`}
function sideCarLike(vehicle,shape,id){const c={car:{front:91,rear:716,roofL:237,roofR:534,roofY:151,glassL:248,glassR:518,windowBottom:222,w1:265,w2:575},suv:{front:82,rear:724,roofL:210,roofR:554,roofY:129,glassL:225,glassR:536,windowBottom:222,w1:255,w2:584},van:{front:71,rear:731,roofL:158,roofR:576,roofY:101,glassL:176,glassR:556,windowBottom:224,w1:244,w2:603}}[shape]||{};const van=shape==='van';return`<g filter="url(#${id}-shadow)">${ground(414,325)}
<path class="v153-underbody" d="M130 333H692L668 369H166Z"/>
<path class="v153-body" fill="url(#${id}-body)" d="M${c.front} 326L112 272Q123 236 164 220L${c.roofL} ${c.roofY}Q280 ${c.roofY-30} 346 ${c.roofY-22}L${c.roofR} ${c.roofY+12}Q585 165 621 211L${c.rear} 283L${c.rear-7} 326H647Q633 278 584 278Q535 278 519 326H320Q304 278 255 278Q206 278 191 326Z"/>
<path class="v153-body-inset" fill="url(#${id}-body2)" d="M109 316L128 274Q140 249 174 238L${c.roofL+15} ${c.roofY+22}H${c.roofR-8}Q572 177 604 219L690 291L686 316H648Q629 264 584 264Q539 264 518 316H321Q301 264 255 264Q210 264 190 316Z"/>
<path class="v153-roof" fill="url(#${id}-body3)" d="M${c.roofL} ${c.roofY}Q282 ${c.roofY-27} 345 ${c.roofY-20}L${c.roofR} ${c.roofY+13}L566 220H192Z"/>
<path class="v153-glass" fill="url(#${id}-glass)" d="M${c.glassL} ${c.roofY+11}L344 ${c.roofY-9}L${c.glassR} ${c.roofY+25}L550 ${c.windowBottom}H208Z"/>
<path class="v153-glass-line" d="M365 ${c.roofY-6}V${c.windowBottom}M493 ${c.roofY+18}L509 ${c.windowBottom}${van?`M260 ${c.roofY+7}L274 ${c.windowBottom}`:''}"/>
<path class="v153-door-line" d="M368 ${c.windowBottom}V307M498 ${c.windowBottom}L511 307M${van?270:224} ${c.windowBottom+14}H552M${van?270:224} 275H552"/>
<path class="v153-character-line" d="M121 271Q314 226 594 229L690 291"/>
<path class="v153-fender-line" d="M190 326Q204 257 255 257Q307 257 321 326M518 326Q532 257 584 257Q636 257 649 326"/>
<rect class="v153-running-board" x="323" y="319" width="193" height="10" rx="5"/>
<path class="v153-headlight" d="M116 255L176 236L191 248L149 274L112 273Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/>
<path class="v153-tail-light" d="M681 252H705L716 287H693Z" fill="url(#${id}-tail)"/>
<path class="v153-grille" d="M91 278H141L148 305H85Z"/><path class="v153-grille-line" d="M96 285H139M99 294H143M109 281V303M122 281V304M135 283V305"/>
${mirror(198,197,false)}${mirror(561,196,true)}${handle(300,242,24)}${handle(426,242,24)}
${van?'<path class="v153-slider" d="M513 238V305M532 247V298"/>':''}
${wheelSvg(id,c.w1,326,61)}${wheelSvg(id,c.w2,326,61)}
${plate(vehicle,642,296,64,20)}
</g>`}
function sideMotorcycle(id){return`<g filter="url(#${id}-shadow)">${ground(414,292)}${wheelSvg(id,245,337,63)}${wheelSvg(id,566,337,63)}<path class="v153-frame" d="M282 319L351 232L432 226L493 286L534 300L553 324H471L417 273H354L324 319Z"/><path class="v153-body" fill="url(#${id}-body)" d="M350 239Q405 193 462 223L487 273L426 287L372 274Z"/><path class="v153-body2" fill="url(#${id}-body2)" d="M331 256L368 222L417 224L389 273Z"/><path class="v153-glass" fill="url(#${id}-glass)" d="M432 210L459 170L501 173L526 218H479Z"/><path class="v153-bike-line" d="M410 226L452 164H511M506 169L539 227M346 246L306 196H251M307 196L286 176M438 281L496 323M365 274L306 322"/><rect class="v153-seat" x="371" y="204" width="91" height="24" rx="12"/><circle class="v153-headlight" cx="526" cy="264" r="17" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/></g>`}
function sideForklift(id){return`<g filter="url(#${id}-shadow)">${ground(414,305)}${wheelSvg(id,273,336,61)}${wheelSvg(id,524,349,46)}<path class="v153-body" fill="url(#${id}-body)" d="M185 322V246Q188 210 231 201H467Q505 204 521 240L543 322Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M208 307V260Q210 234 240 230H455Q483 232 495 258L510 307Z"/><path class="v153-cage" d="M286 244V110H462V244M319 110V70M429 110V70M319 70H429"/><path class="v153-glass" fill="url(#${id}-glass)" d="M312 139H433L453 232H292Z"/><path class="v153-glass-line" d="M373 139V232"/><path class="v153-fork" d="M536 118V390M574 118V390M540 374H717M540 399H717"/><rect class="v153-machine" x="211" y="261" width="116" height="49" rx="10"/><path class="v153-machine-line" d="M227 273H311M227 286H311M227 299H311"/></g>`}
function sideMachine(shape,id){return`<g filter="url(#${id}-shadow)">${ground(414,320)}${shape==='machinery'?'<rect class="v153-track" x="150" y="333" width="500" height="76" rx="36"/>':wheelSvg(id,251,342,58)+wheelSvg(id,566,342,58)}<path class="v153-body" fill="url(#${id}-body)" d="M176 324L218 181Q228 142 275 137H522Q569 141 595 183L655 324Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M205 308L237 197Q244 168 282 165H508Q547 168 566 199L612 308Z"/><path class="v153-glass" fill="url(#${id}-glass)" d="M278 161H508Q546 165 565 204L584 244H255Z"/><path class="v153-glass-line" d="M386 161V244M512 171L529 244"/><path class="v153-door-line" d="M385 244V309M514 244V309"/><rect class="v153-machine" x="278" y="264" width="236" height="43" rx="9"/><path class="v153-machine-line" d="M293 277H499M293 290H499"/>${shape==='machinery'?'<path class="v153-arm" d="M582 187L687 105L719 126L636 228"/>':''}</g>`}
function genericSide(vehicle,shape,id,right=false){const flip=right?'translate(800 0) scale(-1 1)':'';let content=shape==='pickup'?sidePickup(vehicle,id):shape==='truck'?sideTruck(vehicle,id):['car','suv','van'].includes(shape)?sideCarLike(vehicle,shape,id):shape==='motorcycle'?sideMotorcycle(id):shape==='forklift'?sideForklift(id):sideMachine(shape,id);return`<g transform="${flip}">${content}</g>`}
function frontRearCarLike(vehicle,shape,id,rear=false){const width=shape==='truck'?520:shape==='van'?500:shape==='suv'?470:shape==='pickup'?480:425;const x=(800-width)/2,top=shape==='truck'||shape==='van'?93:shape==='suv'||shape==='pickup'?118:140,bottom=374;const glassX=x+68,glassW=width-136;const lampW=shape==='truck'?78:shape==='van'?70:66;const bodyPath=`M${x+24} ${bottom}L${x+42} ${top+82}Q${x+48} ${top+24} ${x+105} ${top}H${x+width-105}Q${x+width-48} ${top+24} ${x+width-42} ${top+82}L${x+width-24} ${bottom}Z`;const windshield=`M${glassX} ${top+36}H${glassX+glassW}L${glassX+glassW-28} ${top+135}H${glassX+28}Z`;const mirrors=`<path class="v153-front-mirror" d="M${x+29} ${top+116}L${x-10} ${top+134}L${x+7} ${top+154}L${x+40} ${top+141}Z"/><path class="v153-front-mirror" d="M${x+width-29} ${top+116}L${x+width+10} ${top+134}L${x+width-7} ${top+154}L${x+width-40} ${top+141}Z"/>`;const pickupTail=shape==='pickup'?`<path class="v153-tailgate" d="M${x+65} ${top+178}H${x+width-65}V${bottom-31}H${x+65}Z"/><path class="v153-tailgate-line" d="M${x+102} ${top+197}H${x+width-102}M400 ${top+180}V${bottom-34}"/>`:'';const truckRear=shape==='truck'?`<path class="v153-bed-rib" d="M${x+58} ${top+175}H${x+width-58}M${x+108} ${top+175}V${bottom-32}M${x+162} ${top+175}V${bottom-32}M${x+216} ${top+175}V${bottom-32}M${x+270} ${top+175}V${bottom-32}M${x+324} ${top+175}V${bottom-32}"/>`:'';return`<g filter="url(#${id}-shadow)">${ground(421,285)}<path class="v153-body" fill="url(#${id}-body)" d="${bodyPath}"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M${x+47} ${bottom-12}L${x+62} ${top+92}Q${x+69} ${top+45} ${x+115} ${top+25}H${x+width-115}Q${x+width-69} ${top+45} ${x+width-62} ${top+92}L${x+width-47} ${bottom-12}Z"/><path class="v153-glass" fill="url(#${id}-glass)" d="${windshield}"/><path class="v153-glass-line" d="M400 ${top+36}V${top+135}"/>${mirrors}<path class="v153-hood-line" d="M${x+93} ${top+160}Q400 ${top+137} ${x+width-93} ${top+160}M${x+75} ${top+183}H${x+width-75}"/>${rear?`${pickupTail}${truckRear}<rect class="v153-tail-cluster" x="${x+60}" y="${bottom-103}" width="${lampW}" height="38" rx="8" fill="url(#${id}-tail)"/><rect class="v153-tail-cluster" x="${x+width-60-lampW}" y="${bottom-103}" width="${lampW}" height="38" rx="8" fill="url(#${id}-tail)"/><path class="v153-tail-segment" d="M${x+66} ${bottom-90}H${x+60+lampW-6}M${x+width-54-lampW} ${bottom-90}H${x+width-66}"/><rect class="v153-rear-bumper" x="${x+88}" y="${bottom-32}" width="${width-176}" height="22" rx="8"/>${plate(vehicle,363,bottom-80,74,22)}`:`<path class="v153-headlight" d="M${x+58} ${bottom-112}H${x+58+lampW}Q${x+58+lampW+14} ${bottom-112} ${x+58+lampW+19} ${bottom-99}L${x+58+lampW-2} ${bottom-78}H${x+58}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><path class="v153-headlight" d="M${x+width-58-lampW} ${bottom-112}H${x+width-58}V${bottom-78}H${x+width-58-lampW+2}L${x+width-58-lampW-19} ${bottom-99}Q${x+width-58-lampW-14} ${bottom-112} ${x+width-58-lampW} ${bottom-112}Z" fill="url(#${id}-lamp)" filter="url(#${id}-glow)"/><rect class="v153-grille" x="${x+112}" y="${bottom-79}" width="${width-224}" height="39" rx="11"/><path class="v153-grille-line" d="M${x+128} ${bottom-68}H${x+width-128}M${x+128} ${bottom-56}H${x+width-128}"/><circle class="v153-fog" cx="${x+83}" cy="${bottom-54}" r="11"/><circle class="v153-fog" cx="${x+width-83}" cy="${bottom-54}" r="11"/>${plate(vehicle,363,bottom-72,74,22)}`}<rect class="v153-front-wheel" x="${x+8}" y="${bottom-9}" width="82" height="34" rx="14"/><rect class="v153-front-wheel" x="${x+width-90}" y="${bottom-9}" width="82" height="34" rx="14"/></g>`}
function frontRearMotorcycle(id,rear=false){return`<g filter="url(#${id}-shadow)">${ground(421,190)}<ellipse class="v153-front-wheel-round" cx="400" cy="357" rx="58" ry="67"/><path class="v153-body" fill="url(#${id}-body)" d="M336 332L356 183Q400 130 444 183L464 332Z"/><path class="v153-glass" fill="url(#${id}-glass)" d="M363 201Q400 169 437 201L441 252H359Z"/><path class="v153-bike-line" d="M333 227H467M400 181V328"/>${rear?'<rect class="v153-tail-cluster" x="379" y="286" width="42" height="28" rx="8" fill="url(#'+id+'-tail)"/>':'<circle class="v153-headlight" cx="400" cy="283" r="24" fill="url(#'+id+'-lamp)" filter="url(#'+id+'-glow)"/>'}</g>`}
function frontRearForklift(id,rear=false){return`<g filter="url(#${id}-shadow)">${ground(421,245)}<path class="v153-body" fill="url(#${id}-body)" d="M255 372V181Q255 144 292 138H508Q545 144 545 181V372Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M280 356V204Q280 174 309 169H491Q520 174 520 204V356Z"/><path class="v153-glass" fill="url(#${id}-glass)" d="M311 188H489V283H311Z"/><path class="v153-glass-line" d="M400 188V283"/><path class="v153-cage" d="M276 163V74H524V163M318 74V34M482 74V34M318 34H482"/>${rear?'<rect class="v153-tail-cluster" x="295" y="317" width="47" height="31" rx="7" fill="url(#'+id+'-tail)"/><rect class="v153-tail-cluster" x="458" y="317" width="47" height="31" rx="7" fill="url(#'+id+'-tail)"/>':'<path class="v153-fork" d="M322 371V449M478 371V449"/>'}</g>`}
function frontRearMachine(shape,id,rear=false){return`<g filter="url(#${id}-shadow)">${ground(421,260)}${shape==='machinery'?'<rect class="v153-track" x="204" y="332" width="392" height="77" rx="35"/>':''}<path class="v153-body" fill="url(#${id}-body)" d="M258 376V143Q258 101 302 94H498Q542 101 542 143V376Z"/><path class="v153-body-inset" fill="url(#${id}-body2)" d="M281 356V164Q281 126 316 121H484Q519 126 519 164V356Z"/><path class="v153-glass" fill="url(#${id}-glass)" d="M309 149H491V260H309Z"/><path class="v153-glass-line" d="M400 149V260"/><path class="v153-machine-line" d="M289 286H511M289 310H511"/>${rear?'<rect class="v153-tail-cluster" x="291" y="324" width="48" height="31" rx="7" fill="url(#'+id+'-tail)"/><rect class="v153-tail-cluster" x="461" y="324" width="48" height="31" rx="7" fill="url(#'+id+'-tail)"/>':'<rect class="v153-grille" x="330" y="317" width="140" height="29" rx="9"/>'}</g>`}
function genericFrontRear(vehicle,shape,id,rear=false){if(shape==='motorcycle')return frontRearMotorcycle(id,rear);if(shape==='forklift')return frontRearForklift(id,rear);if(shape==='equipment'||shape==='machinery')return frontRearMachine(shape,id,rear);return frontRearCarLike(vehicle,shape,id,rear)}
function render(vehicle,view='superior',options={}){const shape=shapeKey(vehicle),safe=['superior','frontal','lado_izquierdo','lado_derecho','trasera'].includes(view)?view:'superior';if(safe==='superior')return topVisual(vehicle?.tipo??vehicle).replace('vehicle-visual-v153 vehicle-visual-v152','vehicle-visual-v153 vehicle-visual-v152');const id=`v153-${shape}-${safe}-${++vehicleSvgSequence}`;const content=safe==='frontal'?genericFrontRear(vehicle,shape,id,false):safe==='trasera'?genericFrontRear(vehicle,shape,id,true):safe==='lado_derecho'?genericSide(vehicle,shape,id,true):genericSide(vehicle,shape,id,false);const classes=['vehicle-visual-v153','vehicle-visual-v152','vehicle-visual-v149','vehicle-silhouette',options.compact?'is-compact':''].filter(Boolean).join(' ');const viewBox=safe==='frontal'||safe==='trasera'?'105 55 590 395':'35 70 730 365';return`<svg class="${classes}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(labels[shape])} · ${esc(safe)}">${viewDefs(id)}${content}</svg>`}
window.NexusVehicleVisuals={render,type:shapeKey,label:v=>labels[shapeKey(v)]||'Vehículo',version:'154'};
})();
