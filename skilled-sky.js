(function () {
    'use strict';

    const file = (location.pathname.split('/').pop() || '').toLowerCase();
    const params = new URLSearchParams(location.search);
    const requestedProfile = String(params.get('perfil') || '').toLowerCase();
    const knownPrefixProfiles = { al: 'almacen', co: 'compras', rh: 'rh', fi: 'finanzas', gg: 'gerente_general', sg: 'subgerente', sky: 'sky_demo', adm:'administrador', dir:'gerente_general', proy:'proyectos', pl:'planeacion', cr:'coordinacion', lg:'logistica', rec:'recepcion', re:'recepcion', tsi:'tsi' };
    const profileNames = { administrador:'Administración', jefe_almacen:'Jefe de almacén', almacen: 'Almacén', compras: 'Compras', rh: 'Recursos Humanos', finanzas: 'Finanzas', gerente_general: 'Gerencia General', subgerente: 'Subgerencia', sky_demo: 'Sky · Presentación', proyectos: 'Proyectos', planeacion:'Planeación', coordinacion:'Coordinación', logistica:'Logística', recepcion:'Recepción', tsi:'TSI', consulta: 'Consulta' };
    const profileCodes = { administrador:'ADM', jefe_almacen:'JA', almacen: 'AL', compras: 'CO', rh: 'RH', finanzas: 'FI', gerente_general: 'GG', subgerente: 'SG', sky_demo: 'SKY', proyectos: 'PR', planeacion:'PL', coordinacion:'CR', logistica:'LG', recepcion:'RE', tsi:'TSI', consulta: 'CN' };
    const customProfiles = new Map();
    const skyProfiles = new Set(['administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta']);
    function currentRole() {
        if (window.SkilledSession?.role) return String(window.SkilledSession.role).toLowerCase();
        if (document.documentElement.dataset.role) return String(document.documentElement.dataset.role).toLowerCase();
        try { return String(JSON.parse(localStorage.getItem('skilled_profile_cache') || 'null')?.rol || 'consulta').toLowerCase(); } catch (_) { return 'consulta'; }
    }
    function detectProfile() {
        if (requestedProfile) return requestedProfile;
        const warehouseLegacyFiles = new Set(['inicio.html','catalogo.html','almacenes.html','bajo-minimo.html','etiquetas.html','escaner.html','herramientas.html','historial-movimientos.html','reportes.html','solicitudes-compra.html','importar-materiales.html','estado-herramientas.html','proyectos.html']);
        if (warehouseLegacyFiles.has(file)) return 'almacen';
        const match = file.match(/^([a-z0-9_-]+)\./i);
        if (match) return knownPrefixProfiles[match[1].toLowerCase()] || match[1].toLowerCase();
        const body = String(document.body?.dataset?.profile || document.documentElement?.dataset?.profile || '').toLowerCase();
        if (body) return body;
        const remembered = String(sessionStorage.getItem('skilled_active_profile') || '').toLowerCase();
        if (remembered) return remembered;
        const role = currentRole();
        if (role === 'jefe_almacen') return 'almacen';
        if (['administrador','almacen','compras','rh','finanzas','gerente_general','subgerente','sky_demo','proyectos','planeacion','coordinacion','logistica','recepcion','tsi','consulta'].includes(role)) return role;
        return 'almacen';
    }
    function skyAllowed() {
        return skyProfiles.has(detectProfile());
    }
    function isExecutiveReadProfile(profile = detectProfile()) {
        return ['administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta'].includes(profile);
    }
    function profileConfig(profile = detectProfile()) {
        const base = {
            administrador: { title:'Sky · Asistente de Administración', subtitle:'Vista transversal autorizada para coordinar operación, proyectos, personal, materiales, compras, proveedores, vehículos, chat y reuniones.', placeholder:'Ej. ¿Qué requiere atención y a quién debo avisar?', examples:[['Resumen operativo','Dame un resumen de lo que requiere atención'],['Proyecto','¿Cómo va el proyecto 26001?'],['Personal','Busca a Eduardo'],['Compras','¿Qué compras siguen pendientes?'],['Mensaje interno','Dile a Compras que revise la orden pendiente'],['Reunión','Genera una reunión general a las 4 para revisar pendientes']] },
            jefe_almacen: { title:'Sky · Asistente de Jefatura de Almacén', subtitle:'Existencias, ubicaciones, mínimos, herramientas, proyectos, flotilla y coordinación mediante chat.', placeholder:'Ej. ¿Qué materiales requieren atención?', examples:[['Bajo mínimo','¿Qué materiales están bajo mínimo?'],['Ubicación','¿Dónde está el alcohol isopropílico?'],['Herramientas','¿Qué herramientas están vencidas?'],['Proyecto','¿Qué materiales tiene el proyecto 26001?'],['Mensaje','Avisa a Compras que necesitamos revisar mínimos'],['Reunión','Convoca a Almacén mañana a las 9 para revisar pendientes']] },
            almacen: { title:'Sky · Asistente de Almacén', subtitle:'Existencias, coincidencias, ubicaciones, mínimos, herramientas, proyectos, flotilla y comunicación interna.', placeholder:'Ej. ¿Cuántos tipos de tubos tengo?', examples:[['Tipos de tubos','¿Cuántos tipos de tubos tengo?'],['Existencia','¿Cuántos tubos de 1 pulgada tenemos?'],['Ubicación','¿Dónde está el alcohol isopropílico?'],['Bajo mínimo','¿Qué materiales están bajo mínimo?'],['Herramientas','¿Qué herramientas están vencidas?'],['Mensaje','Avisa a Compras que falta material']] },
            compras: { title:'Sky · Asistente de Compras', subtitle:'Cotizaciones, proveedores, contactos, precios, plazos, órdenes, recepciones, proyectos y comunicación interna.', placeholder:'Ej. ¿Quién vende tubo conduit?', examples:[['Proveedor','¿Quién vende tubo conduit?'],['Contacto','Dame el WhatsApp y correo del proveedor ABB'],['Cotizaciones','¿Qué cotizaciones requieren atención?'],['Comparación','Compara proveedores de la cotización abierta'],['Órdenes','¿Qué órdenes de compra requieren atención?'],['Mensaje','Dile a Almacén que ya llegó la orden 1234']] },
            proyectos: { title:'Sky · Asistente de Proyectos', subtitle:'Avance, responsables, materiales, personal, solicitudes, costos autorizados, vehículos y coordinación entre áreas.', placeholder:'Ej. ¿Cómo va el proyecto 26001?', examples:[['Estado','¿Cómo va el proyecto 26001?'],['Materiales','¿Qué materiales tiene el proyecto 26001?'],['Personal','¿Cuántas personas tiene el proyecto 26001?'],['Responsable','¿Quién es responsable del proyecto 26001?'],['Mensaje','Dile a Planeación que revise el proyecto 26001'],['Reunión','Genera una reunión con Coordinación a las 4 para revisar el proyecto 26001']] },
            planeacion: { title:'Sky · Asistente de Planeación', subtitle:'Proyectos, materiales, personal, compras, proveedores, vehículos y coordinación contextual sin recorrer varios módulos.', placeholder:'Ej. Dame un resumen del proyecto 26001', examples:[['Proyecto','Dame un resumen del proyecto 26001'],['Materiales','¿Qué materiales tenemos para el proyecto 26001?'],['Personal','¿Cuántas personas tiene el proyecto 26001?'],['Compras','¿Qué compras están relacionadas con el proyecto?'],['Mensaje','Avisa a Coordinación que el plan del proyecto está listo'],['Reunión','Convoca mañana a las 9 con Coordinación para revisar el plan']] },
            coordinacion: { title:'Sky · Asistente de Coordinación', subtitle:'Punto de consulta entre proyectos, personal, materiales, compras, proveedores, logística y comunicación interna.', placeholder:'Ej. ¿Qué requiere atención en el proyecto 26001?', examples:[['Resumen','Dame un resumen del proyecto 26001'],['Personal','¿Cuántas personas tiene el proyecto 26001?'],['Material','¿Hay tubo conduit disponible?'],['Proveedor','Busca el proveedor ABB'],['Mensaje','Dile a Logística que prepare el vehículo'],['Reunión','Genera una reunión general a las 4 para revisar pendientes']] },
            logistica: { title:'Sky · Asistente de Logística', subtitle:'Flotilla, proyectos, personal, materiales, responsables y coordinación mediante chat y reuniones.', placeholder:'Ej. ¿Qué vehículos están disponibles?', examples:[['Vehículos','¿Qué vehículos están disponibles?'],['Vehículo','¿Cómo está la camioneta Ford?'],['Proyecto','¿Cómo va el proyecto 26001?'],['Personal','¿Cuántas personas tiene el proyecto 26001?'],['Mensaje','Avisa a Recepción que la camioneta ya salió'],['Reunión','Convoca a Coordinación a las 4 para revisar logística']] },
            recepcion: { title:'Sky · Asistente de Recepción', subtitle:'Orientación de visitantes, responsables, proyectos, proveedores, vehículos, avisos internos y reuniones con lenguaje natural.', placeholder:'Ej. Llegó ABB, avisa a Compras', examples:[['Ayuda','Soy de Recepción, ¿en qué me puedes ayudar?'],['Avisar llegada','Dile a Compras que llegó el proveedor ABB'],['Responsable','Busca al responsable del proyecto 26001'],['Reunión','Genera una reunión general a las 4 para revisar pendientes'],['Persona','Busca a Eduardo'],['Vehículos','¿Qué vehículos están disponibles?']] },
            rh: { title:'Sky · Asistente de RH', subtitle:'Personal, proyectos, incidencias, documentos, contratos, nómina, checador, horas trabajadas, capacitación, resguardos y comunicación interna.', placeholder:'Ej. ¿Cuántas horas lleva cada trabajador esta semana?', examples:[['Horas del checador','¿Cuántas horas lleva cada trabajador esta semana?'],['Salida pendiente','¿Quién sigue dentro y no ha checado salida hoy?'],['Sin checada','¿Quién no ha checado hoy?'],['Colaborador','Muéstrame los días y horas de Leobardo esta semana'],['Meta semanal','¿A quién le faltan horas para llegar a 50 esta semana?'],['Nómina','¿Cuál es el último periodo de nómina?']] },
            finanzas: { title:'Sky · Asistente de Finanzas', subtitle:'Presupuestos, costos de proyectos, compras y proveedores autorizados, con comunicación interna y reuniones.', placeholder:'Ej. ¿Cuál es el costo consumido del proyecto 26001?', examples:[['Costo','¿Cuál es el costo consumido del proyecto 26001?'],['Presupuesto','¿Cómo va el presupuesto del proyecto 26001?'],['Mayor costo','¿Cuáles proyectos tienen mayor costo?'],['Compras','¿Qué compras están pendientes?'],['Proveedor','Busca el proveedor ABB'],['Mensaje','Dile a Gerencia que el resumen financiero está listo']] },
            gerente_general: { title:'Sky · Asistente de Gerencia General', subtitle:'Consulta ejecutiva por excepción: riesgos, cambios, presupuesto, proyectos, RH, Compras, Almacén, checador y vehículos sin saturar la pantalla con operación innecesaria.', placeholder:'Ej. ¿Qué cambió y qué requiere mi atención?', examples:[['Atención','¿Qué requiere mi atención hoy?'],['Cambios','¿Qué cambió desde la última revisión?'],['Proyecto','Resume el proyecto 26001 y dime sus riesgos'],['Horas RH','¿Hay checadas incompletas o personal por debajo de su meta semanal?'],['Compras','¿Qué compras o cotizaciones pueden afectar una entrega?'],['Almacén','¿Qué faltantes pueden frenar proyectos?'],['Reunión','Genera una reunión general a las 4 para revisar pendientes']] },
            subgerente: { title:'Sky · Asistente de Subgerencia', subtitle:'Seguimiento ejecutivo por prioridad: proyectos, personal, compras, Almacén, costos, checador y vehículos con acceso al detalle solo cuando aporta una decisión.', placeholder:'Ej. ¿Qué debo dar seguimiento hoy?', examples:[['Prioridades','¿Qué debo dar seguimiento hoy?'],['Cambios','¿Qué cambió desde la última revisión?'],['Proyecto','¿Qué proyectos tienen riesgo o entrega próxima?'],['Horas RH','¿Quién tiene checada incompleta o pocas horas esta semana?'],['Compras','¿Qué cotizaciones o compras siguen detenidas?'],['Almacén','¿Qué faltantes requieren seguimiento?'],['Reunión','Convoca una reunión general mañana a las 9']] },
            tsi: { title:'Sky · Asistente de TSI', subtitle:'Apoyo para solicitar EPP, consultar proyectos autorizados, explicar procesos del CRM, coordinar incidencias y enviar avisos internos sin exponer existencias del almacén.', placeholder:'Ej. Ayúdame a solicitar casco, chaleco y lentes para Juan Pérez', examples:[['Solicitud EPP','Ayúdame a solicitar casco, lentes y chaleco para Juan Pérez'],['Proceso','Explícame cómo se relacionan Compras y Almacén'],['Proyecto','¿Cómo va el proyecto 26001?'],['Incidencia','Ayúdame a describir una falla del CRM'],['Mensaje','Dile a Administración que revisaré la incidencia'],['Reunión','Genera una reunión con Administración a las 4 para revisar el sistema'],['Permisos','¿Qué puedo consultar desde TSI?']] },
            sky_demo: { title:'Sky · Modo presentación', subtitle:'Demostración transversal y segura: conversación natural, explicación del CRM, perfiles, automatizaciones, consultas conectadas, mensajes y reuniones sin modificar registros operativos.', placeholder:'Pregúntame como lo harías durante la presentación', examples:[['CRM','Explícame el CRM en 30 segundos'],['Perfiles','¿Qué perfiles llevamos y cómo se conectan?'],['Checador','Explícame el checador Wi-Fi y la automatización de nómina'],['Dirección','Soy gerente, ¿en qué me puedes ayudar?'],['Evolución','¿Qué hemos mejorado y qué sigue en revisión?'],['Herramientas','¿Qué lenguajes y herramientas utilizan?'],['Proyecto','Dame un resumen del proyecto 26001'],['Quién te creó','¿Quién te desarrolló?']] },
            consulta: { title:'Sky · Asistente de Consulta', subtitle:'Búsquedas de lectura en los datos autorizados, con conversación contextual y comunicación interna cuando corresponde.', placeholder:'Ej. Busca el proyecto 26001', examples:[['Proyecto','Busca el proyecto 26001'],['Continuación','¿Y quién es el responsable?'],['Mensaje','Dile a Recepción que ya llegué'],['Ayuda','¿En qué me puedes ayudar?']] }
        };
        if (base[profile]) return base[profile];
        const label = profileNames[profile] || profile.replace(/[_-]+/g, ' ').replace(/\b\w/g, value => value.toUpperCase());
        return { title:`Sky · Asistente de ${label}`, subtitle:'Asistente contextual del CRM con conversación natural, búsquedas autorizadas, chat y reuniones.', placeholder:`Pregunta algo sobre ${label}`, examples:[['Ayuda',`¿Qué puede hacer Sky en ${label}?`],['Buscar','Busca información disponible para este perfil'],['Mensaje','Envía un mensaje por el chat'],['Reunión','Genera una reunión']] };
    }
    const shortcutLabel = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? '⌥ + S' : 'Alt + S';

    const text = value => String(value ?? '').trim();
    const html = value => text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const number = value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const formatNumber = value => number(value).toLocaleString('es-MX', { maximumFractionDigits: 2 });
    const normalize = value => {
        let output = text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        output = output.replace(/(\d+(?:\s*\/\s*\d+)?)\s*["”″]/g, '$1 pulgada');
        output = output.replace(/\b(?:una|uno|un)\s+(?:pulgada\s+)?y\s+media\b/g, '1 1/2 pulgada');
        output = output.replace(/\b(?:una|uno|un)\s+(?:pulgada\s+)?y\s+un\s+cuarto\b/g, '1 1/4 pulgada');
        output = output.replace(/\btres\s+cuartos?\b/g, '3/4').replace(/\bun\s+cuarto\b/g, '1/4');
        output = output.replace(/\bmedia\s+pulgada\b/g, '1/2 pulgada').replace(/\bmedio\s+pulgada\b/g, '1/2 pulgada');
        const numbers = { cero:'0', una:'1', uno:'1', un:'1', dos:'2', tres:'3', cuatro:'4', cinco:'5', seis:'6', siete:'7', ocho:'8', nueve:'9', diez:'10', once:'11', doce:'12', trece:'13', catorce:'14', quince:'15', dieciseis:'16', diecisiete:'17', dieciocho:'18', diecinueve:'19', veinte:'20' };
        Object.entries(numbers).forEach(([word, digit]) => { output = output.replace(new RegExp(`\\b${word}\\b`, 'g'), digit); });
        return output.replace(/[^a-z0-9ñ/.:+-]+/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const stopWords = new Set(['sky', 'skai', 'skay', 'cuanto', 'cuantos', 'cuanta', 'cuantas', 'tenemos', 'hay', 'dime', 'me', 'puedes', 'por', 'favor', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'que', 'cual', 'cuales', 'donde', 'esta', 'estan', 'ubicacion', 'existencia', 'existencias', 'stock', 'material', 'materiales', 'pieza', 'piezas']);

    const wakePrefix = /^(?:(?:hey\s+)?(?:sky|skai|skay|escai|es\s*ky|es\s+que))[,;:\s-]*/i;
    function stripWakeWord(value) {
        return text(value).replace(wakePrefix, '').trim();
    }
    function commandNormalize(value) {
        let output = normalize(stripWakeWord(value));
        const replacements = [
            [/\bque horas son\b/g, 'que hora es'], [/\bque horas es\b/g, 'que hora es'], [/\bdime la hora actual\b/g, 'que hora es'], [/\bhora actual\b/g, 'que hora es'],
            [/\bque fecha estamos\b/g, 'que fecha es hoy'], [/\ben que fecha estamos\b/g, 'que fecha es hoy'], [/\bque dia estamos\b/g, 'que dia es hoy'], [/\ba que dia estamos\b/g, 'que dia es hoy'],
            [/\borden compra\b/g, 'orden de compra'], [/\bbajo del minimo\b/g, 'bajo minimo'], [/\bbodega principal\b/g, 'bodega central'],
            [/\brecursos humano\b/g, 'recursos humanos'], [/\bveiculos\b/g, 'vehiculos'], [/\berramientas\b/g, 'herramientas'],
            [/\bque onda\b/g, 'hola'], [/\bque rollo\b/g, 'hola'], [/\bque pedo\b/g, 'hola'],
            [/\bocupo saber\b/g, 'dime'], [/\bnecesito saber\b/g, 'dime'], [/\bme dices\b/g, 'dime'], [/\bdime cuanto queda\b/g, 'cuanto tenemos'],
            [/\bcuanto nos queda\b/g, 'cuanto tenemos'], [/\bcuanto queda\b/g, 'cuanto tenemos'], [/\bcuanto hay de\b/g, 'cuanto tenemos de'],
            [/\bque tenemos de\b/g, 'cuanto tenemos de'], [/\btenemos algo de\b/g, 'cuanto tenemos de'],
            [/\bdonde dejaron\b/g, 'donde esta'], [/\bdonde guardaron\b/g, 'donde esta'], [/\bdonde quedo\b/g, 'donde esta'],
            [/\bbuscame\b/g, 'busca'], [/\bcheca\b/g, 'revisa'], [/\bchecame\b/g, 'revisa'], [/\bchécame\b/g, 'revisa'],
            [/\bcomo anda\b/g, 'como va'], [/\bcomo vamos con\b/g, 'estado de'], [/\bque falta de\b/g, 'pendiente de'],
            [/\bla troca\b/g, 'pickup'], [/\btroca\b/g, 'pickup'], [/\bmonta cargas\b/g, 'montacargas'], [/\bgenny\b/g, 'generador movil'],
            [/\bechale un ojo\b/g, 'revisa'], [/\bechame un ojo\b/g, 'revisa'], [/\bpegale una revisada\b/g, 'revisa'], [/\bdate una vuelta por\b/g, 'revisa'],
            [/\bque traemos de\b/g, 'cuanto tenemos de'], [/\bque hay de\b/g, 'cuanto tenemos de'], [/\bcuanto queda ahorita\b/g, 'cuanto tenemos'], [/\bcuanto tenemos ahorita\b/g, 'cuanto tenemos'],
            [/\bdonde anda\b/g, 'donde esta'], [/\bdonde mero esta\b/g, 'donde esta'], [/\bdonde lo pusieron\b/g, 'donde esta'], [/\bdonde lo dejaron\b/g, 'donde esta'],
            [/\bcotizame\b/g, 'cotizacion'], [/\bcheca precios\b/g, 'compara proveedores'], [/\bcheca proveedor\b/g, 'busca proveedor'], [/\bque urge\b/g, 'prioridad urgente'],
            [/\bjunta general\b/g, 'reunion general'], [/\bjunta con todos\b/g, 'reunion general'],
            [/\ba ver si tenemos\b/g, 'cuanto tenemos de'], [/\ba ver si hay\b/g, 'cuanto tenemos de'], [/\bcheca si tenemos\b/g, 'cuanto tenemos de'],
            [/\brevisa si tenemos\b/g, 'cuanto tenemos de'], [/\bfijate si tenemos\b/g, 'cuanto tenemos de'], [/\btenemos por ahi\b/g, 'cuanto tenemos de'],
            [/\bque queda de\b/g, 'cuanto tenemos de'], [/\bque nos queda de\b/g, 'cuanto tenemos de'], [/\bcuanto queda de\b/g, 'cuanto tenemos de'],
            [/\bpasame el dato de\b/g, 'busca'], [/\bdame el dato de\b/g, 'busca'], [/\bpasame info de\b/g, 'busca'], [/\bdame info de\b/g, 'busca'],
            [/\bcomo va el jale\b/g, 'estado de proyecto'], [/\bcomo anda el jale\b/g, 'estado de proyecto'], [/\bque onda con el proyecto\b/g, 'estado de proyecto'],
            [/\bdonde mero quedo\b/g, 'donde esta'], [/\bdonde mero anda\b/g, 'donde esta'], [/\bdonde se guardo\b/g, 'donde esta'],
            [/\bechame la mano con\b/g, 'busca'], [/\bme ayudas con\b/g, 'busca'], [/\bayudame a encontrar\b/g, 'busca'],
            [/\bque show\b/g, 'hola'], [/\bque tranza\b/g, 'hola'], [/\bque habido\b/g, 'hola'], [/\bque hay de nuevo\b/g, 'hola'],
            [/\bpasame paro con\b/g, 'ayudame con'], [/\bhazme paro con\b/g, 'ayudame con'], [/\bme tiras paro con\b/g, 'ayudame con'],
            [/\bque traemos pendiente\b/g, 'que esta pendiente'], [/\bque anda pendiente\b/g, 'que esta pendiente'], [/\bque esta atorado\b/g, 'que esta pendiente'],
            [/\bquien trae\b/g, 'quien tiene'], [/\bquien anda con\b/g, 'quien tiene'], [/\bdonde anda guardado\b/g, 'donde esta'],
            [/\bcuanto traemos de\b/g, 'cuanto tenemos de'], [/\bcuanto hay ahorita de\b/g, 'cuanto tenemos de'], [/\bque tanto queda de\b/g, 'cuanto tenemos de']
        ];
        replacements.forEach(([regex, replacement]) => { output = output.replace(regex, replacement); });
        return output.replace(/\s+/g, ' ').trim();
    }
    function levenshtein(a, b) {
        const left = normalize(a), right = normalize(b);
        if (!left) return right.length;
        if (!right) return left.length;
        const row = Array.from({ length: right.length + 1 }, (_, index) => index);
        for (let i = 1; i <= left.length; i += 1) {
            let previous = row[0]; row[0] = i;
            for (let j = 1; j <= right.length; j += 1) {
                const temp = row[j];
                row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
                previous = temp;
            }
        }
        return row[right.length];
    }
    function fuzzyIncludes(haystack, needle, maxDistance = 1) {
        const h = commandNormalize(haystack), n = commandNormalize(needle);
        if (!n) return false;
        if (h.includes(n)) return true;
        const targetWords = n.split(' '), words = h.split(' ');
        return targetWords.every(target => words.some(word => word === target || (target.length >= 5 && Math.abs(word.length - target.length) <= maxDistance && levenshtein(word, target) <= maxDistance)));
    }
    function hasFuzzy(value, phrases, maxDistance = 1) {
        return phrases.some(phrase => fuzzyIncludes(value, phrase, maxDistance));
    }

    const entityAliases = new Map([
        ['leo','leobardo'],['leito','leobardo'],['ing leo','leobardo hernandez jeronimo'],['ingeniero leo','leobardo hernandez jeronimo'],['leobardo h','leobardo hernandez jeronimo'],['leobardo hernandez','leobardo hernandez jeronimo'],['leobardo jeronimo','leobardo hernandez jeronimo'],
        ['rrhh','recursos humanos'],['rec humanos','recursos humanos'],['rh','recursos humanos'],
        ['gg','gerencia general'],['sub','subgerencia'],['subgerencia general','subgerencia'],
        ['troca','pickup'],['camioneta','pickup'],['compu','computadora'],['laptop','computadora portatil'],
        ['pijas','pija'],['tubos','tubo'],['tuberias','tuberia'],['cables','cable'],['almacenes','almacen']
    ]);
    function expandEntityAliases(value) {
        let out = text(value);
        const norm = normalize(out);
        for (const [alias,target] of entityAliases.entries()) {
            const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i');
            if (re.test(norm)) out = out.replace(re,target);
        }
        return out;
    }

    let modal;
    let transcriptInput;
    let answerNode;
    let statusNode;
    let micButton;
    let historyNode;
    let activeQuestion = '';
    let answerSequence = 0;
    let recognition = null;
    let recognitionPhraseBiasDisabled = true;
    let listening = false;
    let recognitionStarting = false;
    let voiceFinal = '';
    let voiceInterim = '';
    let voiceBest = '';
    let voiceAlternatives = [];
    let voiceConfidence = 0;
    let voiceRawTranscript = '';
    let voiceInterpretedTranscript = '';
    let voiceShouldSubmit = false;
    let voiceHadError = false;
    let silenceTimer = null;
    let hardStopTimer = null;
    let micPermissionChecked = false;
    let selectedMicId = localStorage.getItem('skilled_sky_mic_id') || '';
    let speechVoices = [];
    let lastSpokenText = '';
    let vocabularyPriming = false;
    let vocabularyPrimedProfile = '';
    let speechLexiconCache = { profile: '', sourceAt: -1, words: [], set: new Set(), buckets: new Map() };
    let cloudVoiceStatus = null;
    let cloudVoiceCheckedAt = 0;
    let cloudRecorder = null;
    let cloudStream = null;
    let cloudChunks = [];
    let cloudAudioContext = null;
    let cloudAnalyser = null;
    let cloudMeterTimer = null;
    let cloudStartedAt = 0;
    let cloudLastVoiceAt = 0;
    let cloudSpeechDetected = false;
    let cloudRetryAfter = Number(sessionStorage.getItem('skilled_sky_cloud_retry_after') || 0) || 0;
    const desktopBrave = Boolean(navigator.brave && typeof navigator.brave.isBrave === 'function' && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    let voiceMode = 'automatico';
    let cache = { at: 0 };
    let cacheTimes = Object.create(null);
    const dataPromises = new Map();
    const aiQueryCache = new Map();
    let aiRetryAfter = 0;
    let queryBusy = false;
    let prewarmProfile = '';
    let handsFreeEnabled = localStorage.getItem('skilled_sky_handsfree') === '1';
    let handsFreeTimer = null;
    let handsFreeResumeAt = 0;
    let conversationContext = { material:null, vehicle:null, project:null, supplier:null, person:null, area:'', pendingAction:null, lastIntent:'', lastEntity:'', lastQuery:'', turns:[], updatedAt:0 };
    function saveConversationContext(){conversationContext.updatedAt=Date.now()}
    function rememberConversation(intent='',entity='',query=''){if(intent)conversationContext.lastIntent=text(intent);if(entity)conversationContext.lastEntity=text(entity);if(query)conversationContext.lastQuery=text(query);saveConversationContext()}
    function rememberTurn(user='',assistant=''){const u=text(user).slice(0,420),a=text(assistant).slice(0,520);if(!u&&!a)return;conversationContext.turns=Array.isArray(conversationContext.turns)?conversationContext.turns:[];conversationContext.turns.push({user:u,assistant:a});if(conversationContext.turns.length>8)conversationContext.turns=conversationContext.turns.slice(-8);saveConversationContext()}
    const ttl = 45000;

    function styles() {
        if (document.getElementById('sky-style-v72')) return;
        const style = document.createElement('style');
        style.id = 'sky-style-v72';
        style.textContent = `
            .sky-header-button{height:36px;padding:0 12px;border:1px solid rgba(96,165,250,.32);border-radius:10px;background:linear-gradient(135deg,rgba(37,99,235,.18),rgba(15,23,42,.35));color:#93c5fd;display:inline-flex;align-items:center;gap:7px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;transition:.18s}.sky-header-button:hover{border-color:rgba(96,165,250,.7);color:#fff;background:rgba(37,99,235,.2)}.sky-header-button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.sky-shortcut-badge{margin-left:2px;border:1px solid rgba(148,163,184,.24);border-radius:5px;padding:2px 5px;background:rgba(2,6,23,.25);color:#7285a1;font:700 7px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:0;text-transform:none}.sky-mic-help kbd{display:inline-flex;border:1px solid #2a3d5f;border-radius:5px;padding:2px 5px;background:#0c1528;color:#93c5fd;font:700 8px ui-monospace,SFMono-Regular,Consolas,monospace}.sky-pulse{width:7px;height:7px;border-radius:50%;background:#60a5fa;box-shadow:0 0 0 0 rgba(96,165,250,.35)}.sky-header-button.is-listening .sky-pulse{animation:skyPulse 1.25s infinite}.sky-overlay{position:fixed;inset:0;z-index:130;background:rgba(2,5,14,.72);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:18px}.sky-overlay.is-open{display:flex}.sky-modal{position:relative;width:min(790px,100%);max-height:min(790px,92vh);overflow:auto;border:1px solid #263b5d;border-radius:12px;background:#080f1d;box-shadow:0 24px 70px rgba(0,0,0,.46)}.sky-head{padding:16px 18px;border-bottom:1px solid #1e2c49;display:flex;align-items:center;justify-content:space-between;gap:18px}.sky-orb{width:44px;height:44px;border-radius:9px;border:1px solid rgba(11,110,168,.55);background:linear-gradient(145deg,#0c3150,#071426);box-shadow:inset 3px 0 0 #EA0029}.sky-title{font-size:17px;font-weight:900;color:#f8fafc;letter-spacing:.02em}.sky-subtitle{margin-top:3px;font-size:10px;color:#71819b}.sky-close{width:34px;height:34px;border-radius:9px;border:1px solid #253858;background:#10192c;color:#8fa0bb;font-size:20px}.sky-close:hover{color:#fff;border-color:#3b5a8c}.sky-body{padding:18px}.sky-state{display:flex;align-items:center;gap:8px;color:#8da0bc;font-size:10px}.sky-state-dot{width:7px;height:7px;border-radius:50%;background:#34d399}.sky-state.is-busy .sky-state-dot{background:#60a5fa;animation:skyPulse 1.2s infinite}.sky-state.is-error .sky-state-dot{background:#fb7185}.sky-heard{margin-top:8px;min-height:20px;display:flex;align-items:center;gap:7px;color:#71819b;font-size:9px}.sky-heard strong{color:#9db4d4;font-weight:800}.sky-heard.is-live strong{color:#93c5fd}.sky-heard.is-final strong{color:#86efac}.sky-interpreted{margin-top:4px;min-height:18px;display:none;align-items:center;gap:7px;color:#64748b;font-size:9px}.sky-interpreted.is-visible{display:flex}.sky-interpreted span{color:#64748b}.sky-interpreted strong{color:#c4b5fd;font-weight:800}.sky-listen-quality{margin-left:auto;color:#53657f;font-size:8px}.sky-mic-help{margin-top:6px;color:#5f718d;font-size:8px;line-height:1.45}.sky-voice-row{margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:12px}.sky-engine{display:inline-flex;align-items:center;gap:6px;color:#7285a1;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.sky-engine:before{content:'';width:6px;height:6px;border-radius:50%;background:#64748b}.sky-engine.is-cloud:before{background:#34d399}.sky-engine.is-browser:before{background:#60a5fa}.sky-engine.is-error:before{background:#fb7185}.sky-voice-meter{height:20px;display:flex;align-items:center;gap:3px;opacity:.55}.sky-voice-meter i{display:block;width:3px;height:5px;border-radius:999px;background:#4f6f9f;transition:height .08s,background .08s}.sky-voice-meter.is-active i{background:#60a5fa}.sky-voice-meter.is-active i:nth-child(2),.sky-voice-meter.is-active i:nth-child(6){height:9px}.sky-voice-meter.is-active i:nth-child(3),.sky-voice-meter.is-active i:nth-child(5){height:13px}.sky-voice-meter.is-active i:nth-child(4){height:18px}.sky-input-row{margin-top:14px;display:grid;grid-template-columns:1fr auto auto;gap:9px}.sky-input{width:100%;min-height:48px;border:1px solid #294064;border-radius:12px;background:#060c18;color:#eef5ff;padding:0 14px;font-size:12px;outline:none}.sky-input:focus{border-color:#4d8fff;box-shadow:0 0 0 3px rgba(59,130,246,.09)}.sky-live-hints{display:none;margin-top:7px;border:1px solid #1e3154;border-radius:10px;background:#07101f;overflow:hidden}.sky-live-hints.is-visible{display:grid}.sky-live-hint{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 10px;border:0;border-bottom:1px solid #172641;background:transparent;color:#dbeafe;text-align:left}.sky-live-hint:last-child{border-bottom:0}.sky-live-hint:hover{background:#0d1a30}.sky-live-hint strong{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sky-live-hint span{font-size:8px;color:#71819b;white-space:nowrap}.sky-action{height:48px;min-width:48px;border:1px solid #294064;border-radius:12px;background:#101a30;color:#9db4d4;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}.sky-action:hover{color:#fff;border-color:#4d6f9f}.sky-action.primary{padding:0 17px;background:#2563eb;border-color:#3b82f6;color:#fff}.sky-action.is-listening{background:#7f1d1d;border-color:#fb7185;color:#fff}.sky-answer{margin-top:16px;border:1px solid #1e3154;border-radius:10px;background:#07101f;min-height:128px;padding:17px}.sky-answer-title{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.13em;color:#5f84bd}.sky-answer-main{margin-top:9px;color:#f8fafc;font-size:14px;font-weight:750;line-height:1.55}.sky-answer-detail{margin-top:10px;color:#8d9bb2;font-size:10px;line-height:1.65}.sky-grid{margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.sky-result-card{border:1px solid #213454;border-radius:8px;background:#0b1425;padding:10px}.sky-result-card strong{display:block;color:#f8fafc;font-size:11px}.sky-result-card span{display:block;margin-top:3px;color:#7e8da5;font-size:9px}.sky-card-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.sky-card-action{display:inline-flex;border:1px solid #29476f;border-radius:7px;padding:5px 7px;color:#93c5fd;background:#0d1b30;font-size:8px;font-weight:800;text-decoration:none}.sky-card-action:hover{color:#fff;border-color:#60a5fa}.sky-link{display:inline-flex;margin-top:12px;border:1px solid rgba(59,130,246,.38);border-radius:9px;padding:8px 10px;color:#93c5fd;background:rgba(37,99,235,.1);font-size:9px;font-weight:800;text-decoration:none}.sky-link:hover{color:#fff;border-color:#60a5fa}.sky-recognition-choices{margin-top:12px;display:grid;gap:7px}.sky-recognition-choice{width:100%;text-align:left;border:1px solid #2a4166;border-radius:10px;background:#0b1629;color:#cbd5e1;padding:10px 12px;font-size:10px;font-weight:750}.sky-recognition-choice:hover{border-color:#60a5fa;color:#fff;background:#102142}.sky-examples{margin-top:17px;border-top:1px solid #172641;padding-top:14px}.sky-examples-title{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#657793}.sky-chip-wrap{margin-top:9px;display:flex;flex-wrap:wrap;gap:7px}.sky-chip{border:1px solid #223654;border-radius:7px;background:#0c1628;color:#91a2bc;padding:7px 10px;font-size:9px}.sky-chip:hover{border-color:#3d6095;color:#fff}.sky-mic-settings{margin-top:9px;border:1px solid #1d3152;border-radius:11px;background:rgba(7,14,29,.58);overflow:hidden}.sky-mic-settings summary{cursor:pointer;list-style:none;padding:9px 11px;color:#8396b4;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:10px}.sky-mic-settings summary::-webkit-details-marker{display:none}.sky-mic-settings summary:after{content:'Configurar';color:#5f84bd;font-size:8px}.sky-mic-settings[open] summary:after{content:'Cerrar'}.sky-mic-panel{border-top:1px solid #172641;padding:10px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.sky-mic-select{min-width:0;height:36px;border:1px solid #294064;border-radius:9px;background:#060c18;color:#cbd5e1;padding:0 10px;font-size:10px}.sky-mic-test{height:36px;border:1px solid #294064;border-radius:9px;background:#101a30;color:#93c5fd;padding:0 11px;font-size:9px;font-weight:800}.sky-mic-diagnostic{grid-column:1/-1;color:#64748b;font-size:8px;line-height:1.4}.sky-head-actions{display:flex;align-items:center;gap:6px}.sky-head-tool{width:34px;height:34px;border-radius:9px;border:1px solid #253858;background:#10192c;color:#8fa0bb;display:inline-flex;align-items:center;justify-content:center;font-size:13px}.sky-head-tool:hover{color:#fff;border-color:#3b5a8c}.sky-history{margin-top:10px}.sky-history-item{border-radius:8px}.sky-history-q{font-weight:700}.sky-history-a{color:#9eb0c9}.sky-answer-tools{display:flex;align-items:center;justify-content:flex-end;gap:6px}.sky-answer-tool{cursor:pointer}.sky-answer-tool svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2}.sky-empty-history{color:#586a85;font-size:9px;text-align:center;padding:6px}body.tema-claro .sky-header-button{background:#eef4ff;color:#2563eb;border-color:#bfd4fa}body.tema-claro .sky-modal{background:#fff;border-color:#cbd7e8}body.tema-claro .sky-head{border-color:#d9e2ef}body.tema-claro .sky-title,body.tema-claro .sky-answer-main,body.tema-claro .sky-result-card strong{color:#111827}body.tema-claro .sky-subtitle,body.tema-claro .sky-state,body.tema-claro .sky-answer-detail,body.tema-claro .sky-result-card span{color:#64748b}body.tema-claro .sky-input{background:#f7f9fc;color:#111827;border-color:#cfd9e8}body.tema-claro .sky-live-hints{background:#fff;border-color:#d7e0ec}body.tema-claro .sky-live-hint{color:#1f2937;border-color:#e5e7eb}body.tema-claro .sky-live-hint:hover{background:#f3f6fb}body.tema-claro .sky-heard{color:#64748b}body.tema-claro .sky-heard strong{color:#334155}body.tema-claro .sky-action{background:#f2f5f9;color:#475569;border-color:#cfd9e8}body.tema-claro .sky-answer,body.tema-claro .sky-result-card,body.tema-claro .sky-chip{background:#f7f9fc;border-color:#d7e0ec;color:#536174}@media(max-width:760px){.sky-shortcut-badge{display:none}.sky-overlay{z-index:260;padding:0;align-items:stretch}.sky-modal{width:100%;height:100dvh;max-height:100dvh;border-radius:0;border:0;display:flex;flex-direction:column;overflow:hidden}.sky-head{min-height:58px;padding:8px 10px;padding-top:max(8px,env(safe-area-inset-top));flex:0 0 auto;gap:8px;background:rgba(8,14,28,.96);backdrop-filter:blur(14px)}.sky-head>div:first-child{min-width:0}.sky-orb{width:36px;height:36px;border-radius:11px;flex:0 0 36px}.sky-title{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sky-subtitle{display:none}.sky-head-actions{display:flex;align-items:center;gap:5px}.sky-head-tool,.sky-close{width:36px;height:36px;border-radius:10px}.sky-body{padding:0;overflow:hidden;flex:1;min-height:0;display:flex;flex-direction:column}.sky-state{flex:0 0 auto;padding:7px 11px;border-bottom:1px solid #172641;background:#08101e;font-size:9px}.sky-history{flex:0 0 auto;max-height:26vh;overflow:auto;padding:8px 10px 0}.sky-history-item{margin-bottom:7px}.sky-history-q{margin-left:auto;max-width:88%;border-radius:14px 14px 4px 14px;background:rgba(37,99,235,.16);border:1px solid rgba(59,130,246,.3);padding:8px 10px;color:#dbeafe;font-size:11px;line-height:1.45}.sky-history-a{margin-top:5px;max-width:94%;border-radius:4px 14px 14px 14px;background:#0b1425;border:1px solid #203454;padding:8px 10px;color:#c8d4e6;font-size:10px;line-height:1.45}.sky-history-a .sky-grid,.sky-history-a .sky-answer-tools,.sky-history-a .sky-link{display:none}.sky-answer{margin:8px 10px 0;min-height:0;flex:1;overflow:auto;padding:13px;border-radius:15px}.sky-answer-main{font-size:13px;line-height:1.5}.sky-answer-detail{font-size:10px;line-height:1.55}.sky-grid{grid-template-columns:1fr}.sky-result-card{padding:9px}.sky-result-card strong{font-size:11px}.sky-result-card span{font-size:9px;line-height:1.45}.sky-examples{flex:0 0 auto;margin:7px 0 0;padding:7px 10px 0;border-top:1px solid #172641}.sky-examples-title{display:none}.sky-chip-wrap{margin:0;display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;padding-bottom:7px;scrollbar-width:none}.sky-chip-wrap::-webkit-scrollbar{display:none}.sky-chip{flex:0 0 auto;padding:7px 9px;font-size:9px}.sky-live-hints{order:19;flex:0 0 auto;margin:0 9px 7px;max-height:150px;overflow:auto}.sky-live-hint{grid-template-columns:1fr}.sky-live-hint span{white-space:normal}.sky-input-row{order:20;flex:0 0 auto;margin:0;padding:8px 9px calc(8px + env(safe-area-inset-bottom));display:grid;grid-template-columns:minmax(0,1fr) 48px 48px;gap:7px;border-top:1px solid #1c2b47;background:rgba(7,13,26,.97);backdrop-filter:blur(16px)}.sky-input{height:48px;min-height:48px;font-size:16px!important;border-radius:14px;padding:0 12px}.sky-action{height:48px;min-width:48px;border-radius:14px}.sky-action.primary{width:48px;min-width:48px;padding:0;font-size:0}.sky-action.primary:after{content:'➤';font-size:18px}.sky-action.is-listening{box-shadow:0 0 0 4px rgba(251,113,133,.12)}.sky-heard,.sky-interpreted,.sky-mic-help,.sky-voice-row{display:none!important}.sky-mic-settings{position:absolute;left:9px;right:9px;bottom:calc(70px + env(safe-area-inset-bottom));z-index:4;margin:0;max-height:55vh;overflow:auto;border-color:#31558a;box-shadow:0 18px 60px rgba(0,0,0,.58);display:none}.sky-mic-settings[open]{display:block}.sky-mic-settings summary{background:#0b1628}.sky-mic-panel{grid-template-columns:1fr}.sky-mic-test{width:100%}.sky-answer-tools{position:sticky;top:-13px;margin:-13px -13px 8px;padding:8px 0 6px;display:flex;justify-content:flex-end;gap:5px;background:linear-gradient(#080f1e 75%,transparent);z-index:2}.sky-answer-tool{height:30px;padding:0 9px;border:1px solid #284269;border-radius:9px;background:#0d182b;color:#8fa8ca;font-size:8px;font-weight:850}.sky-answer-tool:hover{color:#fff;border-color:#60a5fa}body.tema-claro .sky-head,body.tema-claro .sky-state,body.tema-claro .sky-input-row{background:rgba(255,255,255,.97);border-color:#d9e2ef}body.tema-claro .sky-history-q{background:#eef4ff;color:#1e3a8a;border-color:#bfd4fa}body.tema-claro .sky-history-a{background:#f7f9fc;color:#475569;border-color:#d7e0ec}body.tema-claro .sky-answer-tools{background:linear-gradient(#fff 75%,transparent)}}@media(max-width:390px){.sky-head{padding-left:8px;padding-right:8px}.sky-history{max-height:22vh}.sky-answer{margin-left:8px;margin-right:8px}.sky-input-row{padding-left:7px;padding-right:7px;grid-template-columns:minmax(0,1fr) 46px 46px}.sky-action{height:46px;min-width:46px}.sky-action.primary{width:46px;min-width:46px}}
.sky-handsfree{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #203657;border-radius:10px;background:#091427;padding:9px 10px}.sky-handsfree strong{display:block;color:#dbeafe;font-size:9px}.sky-handsfree span{display:block;margin-top:2px;color:#6f84a3;font-size:8px}.sky-handsfree button{border:1px solid #31517e;border-radius:999px;padding:5px 9px;background:#0c1729;color:#8fb6ed;font-size:8px;font-weight:800}.sky-handsfree button.is-on{border-color:#34d399;background:rgba(16,185,129,.12);color:#6ee7b7}.sky-listening-followup{color:#6ee7b7!important}
@keyframes skyPulse{0%{box-shadow:0 0 0 0 rgba(96,165,250,.35)}70%{box-shadow:0 0 0 9px rgba(96,165,250,0)}100%{box-shadow:0 0 0 0 rgba(96,165,250,0)}}
        `;
        document.head.appendChild(style);
    }

    function getHeaderActions() {
        const header = document.querySelector('body > div header, header');
        if (!header) return null;
        const direct = [...header.children].filter(node => node instanceof HTMLElement);
        const action = [...direct].reverse().find(node => node.querySelector('button') || node.querySelector('[id*=profile], .border-l'));
        return action || header.lastElementChild;
    }

    function createUi() {
        styles();
        const actions = getHeaderActions();
        if (actions && !document.getElementById('sky-open')) {
            const button = document.createElement('button');
            button.id = 'sky-open';
            button.type = 'button';
            button.className = 'sky-header-button skilled-sky-launcher';
            button.title = `Consultar Sky · ${shortcutLabel}`;
            const demoLabel=detectProfile()==='sky_demo'?'Hablar con Sky':'Sky';
            button.innerHTML = `<span class="skilled-sky-dot sky-pulse"></span><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8"></path></svg><span data-sky-label>${demoLabel}</span><span class="skilled-sky-caption">${detectProfile()==='sky_demo'?'Presentación':'Asistente'}</span>`;
            actions.insertBefore(button, actions.firstChild);
            button.addEventListener('click', open);
        }
        if (!document.getElementById('sky-overlay')) {
            modal = document.createElement('div');
            modal.id = 'sky-overlay';
            modal.className = 'sky-overlay';
            const config = profileConfig();
            const examples = pageAwareExamples(config);
            modal.innerHTML = `
                <section class="sky-modal" role="dialog" aria-modal="true" aria-labelledby="sky-title">
                    <header class="sky-head">
                        <div class="flex items-center gap-3"><div class="sky-orb"></div><div class="min-w-0"><div id="sky-title" class="sky-title">${html(config.title)}</div><div class="sky-subtitle">${html(config.subtitle)} Los datos del CRM se consultan respetando los permisos de tu perfil.</div></div></div>
                        <div class="sky-head-actions"><button id="sky-clear" class="sky-head-tool" type="button" title="Nueva conversación" aria-label="Nueva conversación">↺</button><button id="sky-settings-button" class="sky-head-tool" type="button" title="Micrófono y voz" aria-label="Micrófono y voz">⚙</button><button id="sky-close" class="sky-close" type="button" aria-label="Cerrar">×</button></div>
                    </header>
                    <div class="sky-body">
                        <div id="sky-status" class="sky-state"><span class="sky-state-dot"></span><span>Listo para consultar.</span></div>
                        <div class="sky-input-row">
                            <input id="sky-query" class="sky-input" autocomplete="off" placeholder="${html(config.placeholder)}">
                            <button id="sky-mic" type="button" class="sky-action" title="Hablar" aria-label="Hablar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8"></path></svg></button>
                            <button id="sky-send" type="button" class="sky-action primary">Consultar</button>
                        </div>
                        <div id="sky-live-hints" class="sky-live-hints" aria-live="polite"></div>
                        <div id="sky-heard" class="sky-heard"><span>Micrófono:</span><strong>listo</strong></div>
                        <div id="sky-interpreted" class="sky-interpreted"><span>Interpreté:</span><strong>—</strong><em id="sky-listen-quality" class="sky-listen-quality"></em></div>
                        <div class="sky-mic-help">Habla como lo harías con un compañero: Sky entiende frases formales, abreviaciones y varios modismos comunes. Selecciona automáticamente el motor de voz más estable disponible. Atajo global: <kbd>${shortcutLabel}</kbd>.</div>
                        <details class="sky-mic-settings" id="sky-mic-settings"><summary>Micrófono y diagnóstico de voz</summary><div class="sky-mic-panel"><select id="sky-mic-device" class="sky-mic-select"><option value="">Micrófono predeterminado</option></select><button id="sky-mic-test" type="button" class="sky-mic-test">Probar micrófono</button><div id="sky-mic-diagnostic" class="sky-mic-diagnostic">Puedes elegir el micrófono correcto después de autorizar el acceso.</div><div class="sky-handsfree"><div><strong>Modo conversación</strong><span>Después de responder, Sky vuelve a escuchar para continuar sin pulsar el micrófono. También puedes decir “Sky, activa modo conversación”.</span></div><button id="sky-handsfree" type="button">Activar</button></div></div></details>
                        <div class="sky-voice-row"><span id="sky-engine" class="sky-engine">Voz · automático</span><span id="sky-voice-meter" class="sky-voice-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></div>
                        <div id="sky-answer" class="sky-answer"><div class="sky-answer-tools"><button class="sky-answer-tool" data-sky-copy>Copiar</button><button class="sky-answer-tool" data-sky-speak>Escuchar</button></div><div class="sky-answer-title">Respuesta de Sky</div><div class="sky-answer-main">${html(config.subtitle)}</div><div class="sky-answer-detail">Sky puede conversar, explicar y orientar; cuando usa datos del CRM, consulta únicamente la información autorizada para tu sesión.</div></div>
                        <div class="sky-examples"><div class="sky-examples-title">Sugerencias · ${html(profileCodes[detectProfile()] || detectProfile().toUpperCase())}</div><div class="sky-chip-wrap">${examples.map(([label,example]) => `<button class="sky-chip" data-sky-example="${html(example)}">${html(label)}</button>`).join('')}</div></div>
                    </div>
                </section>`;
            document.body.appendChild(modal);
            transcriptInput = document.getElementById('sky-query');
            answerNode = document.getElementById('sky-answer');
            historyNode = null;
            statusNode = document.getElementById('sky-status');
            micButton = document.getElementById('sky-mic');
            document.getElementById('sky-close').addEventListener('click', close);
            document.getElementById('sky-clear').addEventListener('click', clearSkyConversation);
            document.getElementById('sky-settings-button').addEventListener('click', () => { const settings=document.getElementById('sky-mic-settings'); if(settings){ settings.open=!settings.open; if(settings.open) refreshMicrophones(); } });
            document.getElementById('sky-send').addEventListener('click', () => { if (voiceRawTranscript) rememberSpeechCorrection(voiceRawTranscript, transcriptInput.value); query(transcriptInput.value); });
            document.getElementById('sky-mic-device')?.addEventListener('change', event => { selectedMicId = String(event.target.value || ''); if (selectedMicId) localStorage.setItem('skilled_sky_mic_id', selectedMicId); else localStorage.removeItem('skilled_sky_mic_id'); micPermissionChecked = false; });
            document.getElementById('sky-mic-test')?.addEventListener('click', testMicrophone);
            const handsFreeButton=document.getElementById('sky-handsfree');
            const syncHandsFree=()=>{if(!handsFreeButton)return;handsFreeButton.classList.toggle('is-on',handsFreeEnabled);handsFreeButton.textContent=handsFreeEnabled?'Activo':'Activar';};
            syncHandsFree();
            handsFreeButton?.addEventListener('click',async()=>{handsFreeEnabled=!handsFreeEnabled;localStorage.setItem('skilled_sky_handsfree',handsFreeEnabled?'1':'0');syncHandsFree();if(handsFreeEnabled){setStatus('Modo conversación activo. Puedes hablarme y continuar con preguntas de seguimiento.');if(!listening&&!queryBusy)await startListening({preserveClearedInput:true});}else{clearTimeout(handsFreeTimer);setStatus('Modo conversación desactivado.');}});
            transcriptInput.addEventListener('input', () => {
                clearTimeout(liveHintTimer);
                liveHintTimer = setTimeout(() => renderLiveHints(transcriptInput.value), 90);
            });
            transcriptInput.addEventListener('keydown', event => {
                if (event.key === 'Enter') { document.getElementById('sky-live-hints')?.classList.remove('is-visible'); if (voiceRawTranscript) rememberSpeechCorrection(voiceRawTranscript, transcriptInput.value); query(transcriptInput.value); }
                if (event.key === 'Escape') close();
            });
            modal.addEventListener('click', event => { if (event.target === modal) close(); });
            document.querySelectorAll('[data-sky-example]').forEach(button => button.addEventListener('click', () => {
                transcriptInput.value = button.dataset.skyExample || '';
                query(transcriptInput.value);
            }));
            bindAnswerTools();
            setupRecognition();
        } else {
            modal = document.getElementById('sky-overlay');
            transcriptInput = document.getElementById('sky-query');
            answerNode = document.getElementById('sky-answer');
            historyNode = null;
            statusNode = document.getElementById('sky-status');
            micButton = document.getElementById('sky-mic');
        }
    }


    function currentPageKey(){return (location.pathname.split('/').pop()||'inicio').replace(/\.html?$/i,'').toLowerCase()}
    function pageAwareExamples(config){
        const page=currentPageKey(), profile=detectProfile(), extra=[];
        if(/catalogo|material/.test(page))extra.push(['Buscar material','Busca tubo conduit de 1 pulgada'],['Ubicación','¿Dónde está el material que acabo de buscar?']);
        if(/proveedor/.test(page))extra.push(['Contacto','Dame el correo y WhatsApp de ABB'],['Materiales','¿Qué materiales vende este proveedor?']);
        if(/cotiz/.test(page))extra.push(['Pendientes','¿Qué cotizaciones requieren atención?'],['Comparar','Compara precio y plazo de proveedores']);
        if(/rh\.equipos|equipos/.test(page))extra.push(['Resguardo','¿Qué equipo tiene asignado Leobardo?'],['Disponibles','¿Qué computadoras están disponibles?']);
        if(/proyecto/.test(page))extra.push(['Resumen proyecto','Dame un resumen del proyecto 26001'],['Personal','¿Cuántas personas tiene el proyecto 26001?']);
        if(/vehiculo/.test(page))extra.push(['Flotilla','¿Qué vehículos están disponibles?'],['Estado','¿Qué vehículos requieren atención?']);
        if(isExecutiveReadProfile(profile))extra.push(['Resumen ejecutivo','Dame un resumen ejecutivo'],['Atención','¿Qué requiere atención hoy?'],['Compras','Compara las cotizaciones abiertas por precio y entrega'],['Almacén','Muéstrame materiales bajo mínimo y sin ubicación'],['RH','Revisa pendientes de nómina y checador']);
        if(profile!=='sky_demo')extra.push(['Mensaje interno','Dile a Compras que ya llegó el material']);
        const base=[...extra,...config.examples,['Creador','¿Quién te creó?'],['Aquí','¿Qué puedes hacer aquí?'],['Ir a','¿A qué apartados me puedes llevar?'],['Preséntate','Preséntate'],['Ayuda','¿Qué puedes hacer?']];
        const seen=new Set();return base.filter(([label,example])=>{const key=commandNormalize(example);if(seen.has(key))return false;seen.add(key);return true}).slice(0,12);
    }

    function bindAnswerTools(){
        if(!answerNode)return;
        answerNode.querySelector('[data-sky-copy]')?.addEventListener('click',async()=>{const value=text(answerNode.querySelector('.sky-answer-main')?.textContent)+'\n'+text(answerNode.querySelector('.sky-answer-detail')?.textContent);try{await navigator.clipboard.writeText(value.trim());setStatus('Respuesta copiada.')}catch(_){setStatus('No fue posible copiar automáticamente.','error')}});
        answerNode.querySelector('[data-sky-speak]')?.addEventListener('click',()=>{const value=text(answerNode.querySelector('.sky-answer-main')?.textContent);if(value)speak(value)});
    }
    function archiveCurrentAnswer(){}
    function clearSkyConversation(){
        activeQuestion='';conversationContext={material:null,vehicle:null,project:null,supplier:null,area:'',pendingAction:null,lastIntent:'',lastEntity:'',lastQuery:'',turns:[],updatedAt:0};saveConversationContext();if(historyNode)historyNode.innerHTML='';if(transcriptInput)transcriptInput.value='';const config=profileConfig();setAnswer('Nueva conversación','Listo. Empezamos una consulta nueva.',config.subtitle);setStatus('Listo para consultar.');
    }

    function navigationOptions(profile=detectProfile()){
        const common={'mi perfil':'perfil.html','perfil':'perfil.html'};
        const maps={
            administrador:{inicio:'AL.inicio.html',catalogo:'AL.catalogo.html',movimientos:'AL.movimientos.html',proyectos:'AL.proyectos.html',herramientas:'AL.herramientas.html',vehiculos:'AL.vehiculos.html',reportes:'AL.reportes.html','cola operativa':'AL.automatizaciones.html','centro de importaciones':'ADM.importaciones.html'},
            jefe_almacen:{inicio:'AL.inicio.html',catalogo:'AL.catalogo.html',movimientos:'AL.movimientos.html',historial:'AL.historial-movimientos.html','bajo minimo':'AL.bajo-minimo.html',proyectos:'AL.proyectos.html',herramientas:'AL.herramientas.html',vehiculos:'AL.vehiculos.html',etiquetas:'AL.etiquetas.html',reportes:'AL.reportes.html',escaner:'AL.escaner.html','cola operativa':'AL.automatizaciones.html'},
            almacen:{inicio:'AL.inicio.html',catalogo:'AL.catalogo.html',movimientos:'AL.movimientos.html',historial:'AL.historial-movimientos.html','bajo minimo':'AL.bajo-minimo.html',proyectos:'AL.proyectos.html',herramientas:'AL.herramientas.html',vehiculos:'AL.vehiculos.html',etiquetas:'AL.etiquetas.html',reportes:'AL.reportes.html',escaner:'AL.escaner.html','cola operativa':'AL.automatizaciones.html'},
            compras:{inicio:'CO.inicio.html',proveedores:'CO.proveedores.html',cotizaciones:'CO.cotizaciones.html','hacer compra':'CO.hacer-compra.html',compras:'CO.hacer-compra.html',requisiciones:'CO.requisiciones.html',recepciones:'CO.recepciones.html',servicios:'CO.servicios.html',tienda:'CO.tienda.html','bajo minimo':'CO.bajo-minimo.html'},
            rh:{inicio:'RH.inicio.html',personal:'RH.personal.html',trabajadores:'RH.personal.html',proyectos:'RH.proyectos.html',asistencias:'RH.asistencias.html',checador:'RH.checador.html',documentos:'RH.documentos.html',nomina:'RH.nomina.html',capacitacion:'RH.capacitacion.html','equipos y resguardos':'RH.equipos.html',equipos:'RH.equipos.html',resguardos:'RH.equipos.html'},
            finanzas:{inicio:'FI.inicio.html',presupuestos:'FI.presupuestos.html',gastos:'FI.gastos.html','cuentas por pagar':'FI.cuentas-pagar.html',reportes:'FI.reportes.html'},
            planeacion:{inicio:'PL.inicio.html',proyectos:'AL.proyectos.html?perfil=planeacion',solicitudes:'AL.solicitudes-material.html?perfil=planeacion',reportes:'AL.reportes.html?perfil=planeacion','importar proyectos':'PROY.importar.html?perfil=planeacion'},
            coordinacion:{inicio:'CR.inicio.html',proyectos:'AL.proyectos.html?perfil=coordinacion',solicitudes:'AL.solicitudes-material.html?perfil=coordinacion',vehiculos:'AL.vehiculos.html?perfil=coordinacion',reportes:'AL.reportes.html?perfil=coordinacion'},
            logistica:{inicio:'LG.inicio.html',vehiculos:'AL.vehiculos.html?perfil=logistica',entregas:'CO.entregas.html?perfil=logistica',proyectos:'AL.proyectos.html?perfil=logistica',materiales:'AL.catalogo.html?perfil=logistica'},
            recepcion:{inicio:'RE.inicio.html',entregas:'CO.entregas.html?perfil=recepcion',vehiculos:'AL.vehiculos.html?perfil=recepcion'},
            proyectos:{inicio:'AL.proyectos.html',proyectos:'AL.proyectos.html',solicitudes:'AL.solicitudes-material.html',reportes:'AL.reportes.html',movimientos:'AL.historial-movimientos.html'},
            tsi:{inicio:'TSI.inicio.html',epp:'TSI.solicitudes-epp.html','solicitar epp':'TSI.solicitudes-epp.html'},
            consulta:{inicio:'AL.inicio.html',catalogo:'AL.catalogo.html',reportes:'AL.reportes.html',manual:'AL.manual-usuario.html'},
            gerente_general:{inicio:'GG.inicio.html',proyectos:'GG.proyectos.html',vehiculos:'GG.vehiculos.html'},
            subgerente:{inicio:'SG.inicio.html',proyectos:'SG.proyectos.html',vehiculos:'SG.vehiculos.html'},
            sky_demo:{inicio:'SKY.inicio.html',sky:'SKY.inicio.html','modo presentacion':'SKY.inicio.html'}
        };
        const map={...common,...(maps[profile]||{})};
        if(map.documentos==='RH.documentos.html,')map.documentos='RH.documentos.html';
        return map;
    }
    function tryNavigation(raw){
        const norm=commandNormalize(raw);if(!/\b(abre|abrir|ve a|ir a|llevame|llévame|entra a|mostrar apartado|muestrame el apartado|muéstrame el apartado)\b/.test(norm))return null;
        const map=navigationOptions();const keys=Object.keys(map).sort((a,b)=>b.length-a.length);const key=keys.find(k=>norm.includes(commandNormalize(k)));
        if(!key)return {handled:true,voice:'Puedo llevarte únicamente a los apartados autorizados para tu perfil.',list:true};
        const href=map[key];setAnswer('Abrir apartado',`Voy a abrir ${key}.`,'La navegación respeta los permisos del perfil activo.',[],{href,label:`Abrir ${key}`});setTimeout(()=>{location.href=href},280);return {handled:true,voice:`Abriendo ${key}.`};
    }
    function pageHelp(){
        const page=currentPageKey().replace(/^[a-z]{2}\./,'').replace(/[._-]+/g,' '), config=profileConfig();const examples=pageAwareExamples(config).slice(0,7).map(([label,example])=>({title:label,detail:example}));const message=`En ${page||'esta pantalla'} puedo ayudarte con consultas relacionadas con ${profileNames[detectProfile()]||detectProfile()} y también con información autorizada de Almacén, RH, Compras, proyectos y vehículos, manteniendo el contexto de lo que vayamos preguntando.`;setAnswer('Sky en esta pantalla',message,'También puedo llevarte a apartados autorizados, recordar la entidad de la consulta anterior y continuar con preguntas como “¿y dónde está?” o “¿y cuánto queda?”.',examples);return message;
    }
    function open() {
        createUi();
        modal.classList.add('is-open');
        if (window.isSecureContext && navigator.mediaDevices?.enumerateDevices) refreshMicrophones();
        primeRecognitionVocabulary();
        prewarmSkyProfileData();
        ensureCloudVoice(false).then(ready => {
            if (ready && Date.now() >= cloudRetryAfter) {
                setVoiceEngine('cloud');
                setStatus('Listo para consultar. Sky Voz avanzada está disponible.');
                setHeard('micrófono listo');
            } else if (desktopBrave && recognition) {
                setVoiceEngine('browser', 'Voz · navegador / Groq');
                setStatus('Sky por texto está listo. En Brave se probará primero la voz avanzada y, si no está disponible, el reconocimiento compatible del navegador.');
                setHeard('micrófono listo');
            } else if (desktopBrave) {
                setVoiceEngine('automatico', 'Voz · requiere Groq');
                setStatus(cloudVoiceProblemMessage() || 'Sky por texto está listo. En Brave de escritorio la voz requiere Sky Voz avanzada.', 'error');
                setHeard('voz avanzada no disponible');
            } else if (recognition) {
                setVoiceEngine('browser');
                setStatus('Listo para consultar. El micrófono usará el reconocimiento del navegador.');
                setHeard('micrófono listo');
            } else {
                setVoiceEngine('automatico');
                setStatus('Listo para consultar por texto. Sky Voz avanzada es opcional.');
                setHeard('consulta por texto disponible');
            }
        }).catch(() => {
            if (recognition) setVoiceEngine('browser');
        });
        setTimeout(() => transcriptInput?.focus(), 60);
    }

    function close() {
        clearTimeout(handsFreeTimer);
        stopListening();
        modal?.classList.remove('is-open');
        const settings=document.getElementById('sky-mic-settings');if(settings)settings.open=false;
    }

    function setStatus(message, mode = '') {
        if (!statusNode) return;
        statusNode.className = `sky-state${mode ? ` is-${mode}` : ''}`;
        statusNode.innerHTML = `<span class="sky-state-dot"></span><span>${html(message)}</span>`;
    }
    function skyFollowUpSuggestions(title = '') {
        if (/^(Consultando|Procesando|Error)$/i.test(String(title || ''))) return [];
        const profile = detectProfile();
        const out=[];
        const add=(value)=>{if(value&&!out.includes(value)&&out.length<4)out.push(value)};
        if(conversationContext.project){const id=conversationContext.project.proyecto||conversationContext.project.nombre;add(`¿Qué falta en el proyecto ${id}?`);add(`¿Qué compras están relacionadas con ${id}?`);add(`¿Cuántas personas tiene ${id}?`)}
        if(conversationContext.material){const id=conversationContext.material.codigo||conversationContext.material.descripcion;add(`¿Cuánto tenemos de ${id}?`);add(`¿Dónde está ${id}?`);add(`¿Está bajo mínimo ${id}?`)}
        if(conversationContext.person){const id=conversationContext.person.nombre||conversationContext.person.numero;add(`¿Cuántas horas lleva ${id}?`);add(`¿En qué proyecto está ${id}?`);add(`¿Tiene checadas incompletas ${id}?`)}
        if(conversationContext.supplier){const id=conversationContext.supplier.nombre;add(`¿Qué cotizaciones tenemos de ${id}?`);add(`¿Cuál es el contacto de ${id}?`)}
        if(['gerente_general','subgerente'].includes(profile)){add('¿Qué requiere decisión hoy?');add('¿Qué puede atrasar proyectos?');add('¿Qué cambió desde mi última revisión?')}
        if(profile==='sky_demo'){add('Explícame el CRM en 30 segundos');add('¿Qué automatizaciones estamos desarrollando?');add('¿Cómo funciona el checador Wi‑Fi?');add('¿Qué diferencia a Sky de un chatbot?')}
        if(profile==='almacen'){add('¿Qué debo atender primero en Almacén?');add('¿Qué materiales están bajo mínimo?')}
        if(profile==='compras'){add('¿Qué cotizaciones requieren atención?');add('¿Qué compra puede afectar una entrega?')}
        if(profile==='rh'){add('¿Quién tiene checadas incompletas?');add('¿Quién no ha llegado a 50 horas?')}
        return out.slice(0,4);
    }

    function setAnswer(title, main, detail = '', cards = [], link = null) {
        const profile = detectProfile();
        if (link && isExecutiveReadProfile(profile)) {
            const target = String(link.href || '');
            if (profile === 'sky_demo') {
                if (!/^SKY\.inicio(?:\.html)?/i.test(target) && !/^perfil\.html/i.test(target) && !/^https?:\/\//i.test(target)) link = null;
            } else {
                const ownPrefix = profile === 'gerente_general' ? 'GG.' : 'SG.';
                if (/^AL\.vehiculos(?:\.html)?/i.test(target)) {
                    link = { ...link, href: profile === 'gerente_general' ? 'GG.vehiculos.html' : 'SG.vehiculos.html' };
                } else if (!target.startsWith(ownPrefix) && !/^perfil\.html/i.test(target) && !/^https?:\/\//i.test(target)) {
                    link = null;
                }
            }
        }
        const external = link && /^https?:\/\//i.test(String(link.href || ''));
        const cardHtml = cards.map(card => {
            const actions = Array.isArray(card.actions) ? card.actions.filter(action => /^(https?:|mailto:)/i.test(String(action?.href || ''))).slice(0, 3) : [];
            const actionHtml = actions.length ? `<div class="sky-card-actions">${actions.map(action => `<a class="sky-card-action" href="${html(action.href)}"${/^https?:/i.test(String(action.href))?' target="_blank" rel="noopener noreferrer"':''}>${html(action.label || 'Abrir')}</a>`).join('')}</div>` : '';
            return `<div class="sky-result-card"><strong>${html(card.title)}</strong><span>${html(card.detail)}</span>${actionHtml}</div>`;
        }).join('');
        const followups=skyFollowUpSuggestions(title);
        const followupHtml=followups.length?`<div class="sky-v83-followups">${followups.map(value=>`<button type="button" class="sky-v83-followup" data-sky-followup="${html(value)}">${html(value)}</button>`).join('')}</div>`:'';
        const confidence=/^(Consultando|Procesando|Error)$/i.test(String(title))?'':`<div class="sky-v83-confidence"><i></i><span>Respuesta basada en datos y capacidades disponibles para este perfil. Si falta una fuente, Sky debe indicarlo.</span></div>`;
        answerNode.innerHTML = `<div class="sky-answer-tools"><button class="sky-answer-tool" data-sky-copy>Copiar</button><button class="sky-answer-tool" data-sky-speak>Escuchar</button></div><div class="sky-answer-title">${html(title)}</div><div class="sky-answer-main">${html(main)}</div>${detail ? `<div class="sky-answer-detail">${html(detail)}</div>` : ''}${cards.length ? `<div class="sky-grid">${cardHtml}</div>` : ''}${link ? `<a class="sky-link" href="${html(link.href)}"${external?' target="_blank" rel="noopener noreferrer"':''}>${html(link.label)}</a>` : ''}${followupHtml}${confidence}`;
        answerNode.dataset.skyFinal = /^(Consultando|Procesando)$/i.test(String(title)) ? '0' : '1';
        answerSequence += 1;
        bindAnswerTools();
        answerNode.querySelectorAll('[data-sky-followup]').forEach(button=>button.addEventListener('click',()=>{const value=button.dataset.skyFollowup||'';if(transcriptInput)transcriptInput.value=value;query(value)}));
    }

    function cachedUserId() {
        const sessionId = text(window.SkilledSession?.user?.id || window.SkilledSession?.profile?.id);
        if (sessionId) return sessionId;
        try {
            const cached = JSON.parse(localStorage.getItem('skilled_profile_cache') || 'null');
            return text(cached?.id || cached?.email || 'local');
        } catch (_) { return 'local'; }
    }
    function voiceStorageKey() { return `skilled_sky_voice_${cachedUserId().replace(/[^a-z0-9@._-]/gi, '_')}`; }
    function speechLearningStorageKey() { return `skilled_sky_speech_learning_${cachedUserId().replace(/[^a-z0-9@._-]/gi, '_')}`; }
    function getSpeechLearning() {
        try {
            const parsed = JSON.parse(localStorage.getItem(speechLearningStorageKey()) || 'null');
            return parsed && typeof parsed === 'object' ? { phrases: parsed.phrases || {}, words: parsed.words || {} } : { phrases: {}, words: {} };
        } catch (_) { return { phrases: {}, words: {} }; }
    }
    function saveSpeechLearning(data) {
        try { localStorage.setItem(speechLearningStorageKey(), JSON.stringify(data)); } catch (_) {}
    }
    function rememberSpeechCorrection(rawValue, correctedValue) {
        const raw = normalize(rawValue), corrected = normalize(correctedValue);
        if (!raw || !corrected || raw === corrected || raw.length > 180 || corrected.length > 180) return false;
        const distanceRatio = levenshtein(raw, corrected) / Math.max(raw.length, corrected.length, 1);
        const rawTokens = new Set(raw.split(' ').filter(Boolean));
        const correctedTokens = corrected.split(' ').filter(Boolean);
        const overlap = correctedTokens.filter(token => rawTokens.has(token)).length / Math.max(correctedTokens.length, 1);
        if (distanceRatio > .58 && overlap < .34) return false;
        const data = getSpeechLearning();
        data.phrases[raw] = corrected;
        const phraseKeys = Object.keys(data.phrases);
        if (phraseKeys.length > 80) phraseKeys.slice(0, phraseKeys.length - 80).forEach(key => delete data.phrases[key]);
        const left = raw.split(' '), right = corrected.split(' ');
        if (left.length === right.length) {
            let changes = 0;
            left.forEach((word,index) => {
                const target = right[index];
                if (word !== target) {
                    changes += 1;
                    if (word.length >= 3 && target.length >= 3 && changes <= 4) data.words[word] = target;
                }
            });
        }
        const wordKeys = Object.keys(data.words);
        if (wordKeys.length > 120) wordKeys.slice(0, wordKeys.length - 120).forEach(key => delete data.words[key]);
        saveSpeechLearning(data);
        return true;
    }
    function getVoicePreferences() {
        const defaults = { voiceURI: '', voiceName: '', lang: 'es-MX', rate: .96, pitch: 1, volume: 1 };
        try {
            const parsed = JSON.parse(localStorage.getItem(voiceStorageKey()) || 'null');
            return parsed && typeof parsed === 'object' ? { ...defaults, ...parsed } : defaults;
        } catch (_) { return defaults; }
    }
    function saveVoicePreferences(changes = {}) {
        const next = { ...getVoicePreferences(), ...changes };
        next.rate = Math.max(.65, Math.min(1.35, Number(next.rate) || .96));
        next.pitch = Math.max(.65, Math.min(1.35, Number(next.pitch) || 1));
        next.volume = Math.max(0, Math.min(1, Number(next.volume) || 1));
        try { localStorage.setItem(voiceStorageKey(), JSON.stringify(next)); } catch (_) {}
        window.dispatchEvent(new CustomEvent('skilled:skyvoicechanged', { detail: next }));
        return next;
    }
    const FEMALE_VOICE_ALIASES = ['Sarah','Sofía','Valeria','Elena','Emma','Victoria','Camila','Daniela','Natalia','Isabella','Amelia','Luna','Clara','Renata','Marina','Paula','Lucía','Carolina','Diana','Irene'];
    const MALE_VOICE_ALIASES = ['Mateo','Diego','Daniel','Javier','Carlos','Andrés','Miguel','Alejandro','Sebastián','Gabriel','Samuel','Nicolás','Adrián','Fernando','Jorge','Raúl','Pablo','Álvaro','Ricardo','Manuel'];
    const NEUTRAL_VOICE_ALIASES = ['Alex','Dani','Sam','Ari','Cris','Ángel','Noel','Charlie'];
    const FEMALE_VOICE_HINTS = new Set(['sabina','dalia','helena','elvira','laura','lucia','lucía','sofia','sofía','ximena','paulina','monica','mónica','marisol','silvia','elena','isabella','camila','valeria','victoria','emma','amelia','sarah','maria','maría','carmen','rosa','paloma','ines','inés','alba','ana','carolina','natalia','daniela','clara','paula','irene','marta','marina','bianca','female','mujer','femenina']);
    const MALE_VOICE_HINTS = new Set(['jorge','raul','raúl','pablo','alvaro','álvaro','diego','carlos','david','miguel','antonio','javier','alejandro','enrique','fernando','francisco','guillermo','hector','héctor','juan','luis','manuel','mateo','sergio','andres','andrés','daniel','oscar','óscar','ricardo','roberto','samuel','sebastian','sebastián','gabriel','nicolas','nicolás','adrian','adrián','male','hombre','masculino']);
    function inferVoiceGender(voice) {
        const raw = text(voice?.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const words = raw.split(/[^a-zñ]+/).filter(Boolean);
        if (words.some(word => MALE_VOICE_HINTS.has(word))) return 'male';
        if (words.some(word => FEMALE_VOICE_HINTS.has(word))) return 'female';
        if (/\b(male|masculino|hombre)\b/.test(raw)) return 'male';
        if (/\b(female|femenina|mujer)\b/.test(raw)) return 'female';
        return 'neutral';
    }
    function sortedVoices() {
        if (!('speechSynthesis' in window)) return [];
        speechVoices = speechSynthesis.getVoices?.() || speechVoices;
        return [...speechVoices].sort((a, b) => {
            const score = voice => /^es-MX$/i.test(voice.lang) ? 0 : /^es(?:-|_)/i.test(voice.lang) ? 1 : 2;
            const quality = voice => /Natural|Neural|Online|Premium|Enhanced/i.test(voice.name) ? 0 : 1;
            return score(a) - score(b) || quality(a) - quality(b) || String(a.name).localeCompare(String(b.name), 'es');
        });
    }
    function voiceAlias(voice) {
        if (!voice) return 'Automática';
        const voices = sortedVoices();
        const gender = inferVoiceGender(voice);
        const sameGender = voices.filter(item => inferVoiceGender(item) === gender);
        const index = Math.max(0, sameGender.findIndex(item => item.voiceURI === voice.voiceURI));
        const aliases = gender === 'male' ? MALE_VOICE_ALIASES : gender === 'female' ? FEMALE_VOICE_ALIASES : NEUTRAL_VOICE_ALIASES;
        return aliases[index % aliases.length] || `Voz ${index + 1}`;
    }
    function voiceChoices() {
        const voices = sortedVoices();
        if (!voices.length) return [];
        const spanish = voices.filter(voice => /^es(?:-|_)/i.test(voice.lang));
        const pool = spanish.length ? spanish : voices;
        const selected = [];
        const used = new Set();
        const pick = predicate => {
            const voice = pool.find(item => !used.has(item.voiceURI) && predicate(item)) || pool.find(item => !used.has(item.voiceURI));
            if (voice) { used.add(voice.voiceURI); selected.push(voice); }
        };
        pick(voice => inferVoiceGender(voice) === 'female');
        pick(voice => inferVoiceGender(voice) === 'female');
        pick(voice => inferVoiceGender(voice) === 'male');
        while (selected.length < Math.min(3, pool.length)) pick(() => true);
        const aliases = ['Sarah','Elena','Daniel'];
        return selected.slice(0,3).map((voice,index) => ({
            voiceURI: voice.voiceURI,
            voiceName: voice.name,
            lang: voice.lang,
            alias: aliases[index],
            gender: inferVoiceGender(voice)
        }));
    }
    function selectedVoice(preferences = getVoicePreferences()) {
        const voices = sortedVoices();
        if (preferences.voiceURI) {
            const exact = voices.find(item => item.voiceURI === preferences.voiceURI);
            if (exact) return exact;
        }
        if (preferences.voiceName) {
            const byName = voices.find(item => item.name === preferences.voiceName && (!preferences.lang || item.lang === preferences.lang));
            if (byName) return byName;
        }
        return voices.find(item => /^es-MX$/i.test(item.lang)) || voices.find(item => /^es(?:-|_)/i.test(item.lang)) || voices[0] || null;
    }
    function scheduleHandsFreeListening(delay=420){
        clearTimeout(handsFreeTimer);
        if(!handsFreeEnabled||!modal?.classList.contains('is-open')||queryBusy)return;
        handsFreeResumeAt=Date.now()+delay;
        handsFreeTimer=setTimeout(()=>{
            if(!handsFreeEnabled||!modal?.classList.contains('is-open')||queryBusy||listening||recognitionStarting)return;
            setStatus('Te escucho… continúa cuando quieras.');
            statusNode?.classList.add('sky-listening-followup');
            startListening({preserveClearedInput:false}).catch(()=>{});
        },delay);
    }

    function speak(value, options = {}) {
        if (!value) return;
        if (!('speechSynthesis' in window)) { scheduleHandsFreeListening(250); return; }
        try {
            lastSpokenText = text(value);
            speechSynthesis.cancel();
            const preferences = { ...getVoicePreferences(), ...options };
            const utterance = new SpeechSynthesisUtterance(value);
            const preferred = selectedVoice(preferences);
            if (preferred) utterance.voice = preferred;
            utterance.lang = preferred?.lang || preferences.lang || 'es-MX';
            utterance.rate = Number(preferences.rate) || .96;
            utterance.pitch = Number(preferences.pitch) || 1;
            utterance.volume = Number(preferences.volume) || 1;
            utterance.onend=()=>scheduleHandsFreeListening(380);
            utterance.onerror=()=>scheduleHandsFreeListening(250);
            speechSynthesis.speak(utterance);
        } catch (_) { scheduleHandsFreeListening(250); }
    }
    function previewVoice(preferences = {}) {
        const config = profileConfig();
        speak(`Hola. Soy Sky, asistente de ${profileNames[detectProfile()] || detectProfile()}. Esta es una prueba de mi voz.`, preferences);
        return config;
    }

    if ('speechSynthesis' in window) {
        speechVoices = speechSynthesis.getVoices?.() || [];
        speechSynthesis.addEventListener?.('voiceschanged', () => {
            speechVoices = speechSynthesis.getVoices?.() || [];
            window.dispatchEvent(new CustomEvent('skilled:skyvoices', { detail: sortedVoices() }));
        });
    }

    function setHeard(value, mode = '') {
        const node = document.getElementById('sky-heard');
        if (!node) return;
        node.className = `sky-heard${mode ? ` is-${mode}` : ''}`;
        node.innerHTML = `<span>Escuché:</span><strong>${html(value || '—')}</strong>`;
    }

    const SPEECH_DIRECT_CORRECTIONS = new Map(Object.entries({
        'tuvo':'tubo','tuvos':'tubos','tuboos':'tubos','pulga':'pulgada','pulgara':'pulgada','pulgadas':'pulgadas','pulgada':'pulgada',
        'erramienta':'herramienta','erramientas':'herramientas','eramienta':'herramienta','eramientas':'herramientas',
        'veiculo':'vehiculo','veiculos':'vehiculos','beiculo':'vehiculo','beiculos':'vehiculos','vehiculos':'vehiculos',
        'vodega':'bodega','vodegas':'bodegas','vodaga':'bodega','almasén':'almacen','almasen':'almacen','almacen':'almacen',
        'ras':'rack','rac':'rack','rack':'rack','prollecto':'proyecto','prollectos':'proyectos','proyeto':'proyecto','proyetos':'proyectos',
        'ocden':'orden','horden':'orden','conpra':'compra','combra':'compra','provedor':'proveedor','probedor':'proveedor',
        'requisision':'requisicion','requicision':'requisicion','incapasidad':'incapacidad','capasitacion':'capacitacion',
        'ora':'hora','oras':'horas','feha':'fecha','fesha':'fecha','oy':'hoy','meses':'mes','skai':'sky','skay':'sky','escai':'sky',
        'checame':'revisa','chekame':'revisa','checame':'revisa','chécame':'revisa','jale':'proyecto','jales':'proyectos','troka':'pickup','troca':'pickup','bodega':'bodega'
    }));
    const BASE_SPEECH_WORDS = [
        'sky','hora','horas','fecha','dia','hoy','semana','mes','ano','perfil','ayuda','comandos','repite','silencio','calcula',
        'cuanto','cuantos','cuanta','cuantas','donde','ubicacion','existencia','existencias','stock','material','materiales','bodega','almacen','central',
        'tubo','tubos','pulgada','pulgadas','cable','cables','broca','brocas','rack','zona','piso','bajo','minimo','orden','compra','compras','herramienta','herramientas',
        'vehiculo','vehiculos','proyecto','proyectos','proveedor','proveedores','requisicion','recepcion','servicio','servicios','tienda','rfc','contacto','correo','email','telefono','whatsapp','mensaje','mensajes','cotizacion','cotizaciones','cotizar','oferta','ofertas','precio','precios','plazo','plazos','entrega','comparar','comparador','vende','venden','maneja','manejan','surte','surten',
        'trabajador','trabajadores','personal','empleado','empleados','ausencia','ausencias','vacaciones','incapacidad','documento','documentos','contrato','contratos','capacitacion','incidencia',
        'presupuesto','costo','costos','consumido','planeado','gasto','gastos','finanzas','avance','ruta','picking','solicitud','solicitudes','disponible','disponibles'
    ];
    const SPEECH_KEEP_WORDS = new Set(['como','cuando','porque','para','pero','esta','estan','este','estos','estas','quiero','necesito','tengo','tenemos','tiene','tienen','hay','dime','busca','buscar','abre','muestra','ver','verifica','revisa','principal','actual','ahora','ahorita','aqui','alla','total','mero','queda','quedan','jale','onda','dato','info']);
    function spanishPhonetic(value) {
        let word = normalize(value).replace(/[^a-zñ0-9]/g, '');
        if (!word || /^\d+$/.test(word)) return word;
        word = word.replace(/h/g, '').replace(/qu/g, 'k').replace(/gu(?=[ei])/g, 'g').replace(/g(?=[ei])/g, 'j').replace(/c(?=[ei])/g, 's').replace(/z/g, 's').replace(/v/g, 'b').replace(/ll/g, 'y').replace(/rr/g, 'r').replace(/x/g, 'ks').replace(/ph/g, 'f');
        word = word.replace(/([bcdfgjklmnprstwy])\1+/g, '$1');
        return word;
    }
    function domainSpeechLexicon() {
        const profile = detectProfile();
        if (speechLexiconCache.profile === profile && speechLexiconCache.sourceAt === cache.at && speechLexiconCache.words.length) return speechLexiconCache;
        const words = new Set(BASE_SPEECH_WORDS);
        const push = value => normalize(value).split(' ').forEach(token => { if (token.length >= 3 && token.length <= 28 && !/^\d+$/.test(token)) words.add(token); });
        if (profile === 'almacen' || profile === 'consulta') {
            (Array.isArray(cache.materials) ? cache.materials : []).slice(0, 1600).forEach(item => [item.codigo,item.descripcion,item.desc,item.categoria,item.marca,item.codigoMarca,item.codigo_marca,item.tipoCable,item.tamano,...(Array.isArray(item.modismos)?item.modismos:[])].forEach(push));
            (Array.isArray(cache.tools) ? cache.tools : []).slice(0, 600).forEach(item => [item.sku,item.descripcion,item.marca,item.modelo,item.clasificacion].forEach(push));
            (Array.isArray(cache.vehicles) ? cache.vehicles : []).slice(0, 300).forEach(item => [item.numeroEconomico,item.nombreVehiculo,item.marca,item.modelo,item.placas,item.tipo].forEach(push));
            (Array.isArray(cache.projects) ? cache.projects : []).slice(0, 700).forEach(item => [item.proyecto,item.nombreProyecto,item.cliente].forEach(push));
        } else if (profile === 'compras') {
            (Array.isArray(cache.coSuppliers) ? cache.coSuppliers : []).slice(0,500).forEach(item => [item.razon_social,item.nombre_comercial,item.rfc,item.contacto,item.email].forEach(push));
            (Array.isArray(cache.coServices) ? cache.coServices : []).slice(0,200).forEach(item => [item.nombre,item.proveedor,item.tipo].forEach(push));
            (Array.isArray(cache.coQuotations) ? cache.coQuotations : []).slice(0,500).forEach(item => {
                [item.folio,item.referencia,item.solicitadoPor,item.estado,item.prioridad].forEach(push);
                (Array.isArray(item.items) ? item.items : []).forEach(detail => [detail.materialCodigo,detail.descripcion,detail.marca,detail.unidad].forEach(push));
            });
        } else if (profile === 'rh') {
            (Array.isArray(cache.rhPeople) ? cache.rhPeople : []).slice(0,900).forEach(item => [item.numero_empleado,item.nombre,item.apellidos,item.puesto,item.departamento].forEach(push));
        } else if (isExecutiveReadProfile(profile)) {
            (Array.isArray(cache.materials) ? cache.materials : []).slice(0,1400).forEach(item => [item.codigo,item.descripcion,item.desc,item.categoria,item.marca,item.codigoMarca,item.codigo_marca,item.tipoCable,item.tamano,...(Array.isArray(item.modismos)?item.modismos:[])].forEach(push));
            (Array.isArray(cache.vehicles) ? cache.vehicles : []).slice(0,300).forEach(item => [item.numeroEconomico,item.nombreVehiculo,item.marca,item.modelo,item.placas,item.tipo].forEach(push));
            (Array.isArray(cache.projectDetails) ? cache.projectDetails : []).slice(0,700).forEach(item => [item.proyecto,item.nombreProyecto,item.cliente].forEach(push));
            (Array.isArray(cache.coSuppliers) ? cache.coSuppliers : []).slice(0,500).forEach(item => [item.razon_social,item.nombre_comercial,item.rfc,item.contacto,item.email].forEach(push));
        } else if (profile === 'finanzas' || profile === 'proyectos') {
            (Array.isArray(cache.projectDetails) ? cache.projectDetails : []).slice(0,700).forEach(item => [item.proyecto,item.nombreProyecto,item.cliente].forEach(push));
        }
        const list = [...words];
        const buckets = new Map();
        list.forEach(item => {
            const key = spanishPhonetic(item)[0] || item[0] || '';
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(item);
        });
        speechLexiconCache = { profile, sourceAt: cache.at, words: list, set: new Set(list), buckets };
        return speechLexiconCache;
    }
    function correctionDistance(source, target) {
        if (source === target) return 0;
        const a = spanishPhonetic(source), b = spanishPhonetic(target);
        if (a && a === b) return .15;
        const raw = levenshtein(source, target);
        const phon = a && b ? levenshtein(a, b) : raw;
        return Math.min(raw, phon + .25);
    }
    function bestSpeechWord(word, lexicon) {
        const original = normalize(word);
        if (!original || original.length < 3 || /^\d+(?:\/\d+)?$/.test(original) || SPEECH_KEEP_WORDS.has(original) || stopWords.has(original)) return original;
        if (SPEECH_DIRECT_CORRECTIONS.has(original)) return SPEECH_DIRECT_CORRECTIONS.get(original);
        if (lexicon.set.has(original)) return original;
        let best = original, bestDistance = Infinity;
        const max = original.length >= 9 ? 2.25 : original.length >= 6 ? 1.4 : .45;
        const phonetic = spanishPhonetic(original);
        const candidates = lexicon.buckets.get(phonetic[0] || original[0] || '') || lexicon.words;
        for (const candidate of candidates) {
            if (Math.abs(candidate.length - original.length) > 2) continue;
            const distance = correctionDistance(original, candidate);
            if (distance < bestDistance) { bestDistance = distance; best = candidate; }
            if (distance <= .15) break;
        }
        return bestDistance <= max ? best : original;
    }
    function correctRecognizedTranscript(value) {
        const raw = text(value);
        let normalized = normalize(raw);
        const learned = getSpeechLearning();
        if (learned.phrases?.[normalized]) {
            const corrected = commandNormalize(learned.phrases[normalized]);
            return { raw, normalized, corrected, changes: 1, changeRatio: 0, learned: true };
        }
        if (learned.words && Object.keys(learned.words).length) normalized = normalized.split(' ').map(word => learned.words[word] || word).join(' ');
        const phraseCorrections = [
            [/\bque horas son\b/g,'que hora es'],[/\bque horas es\b/g,'que hora es'],[/\bque ora es\b/g,'que hora es'],[/\bdime la ora\b/g,'dime la hora'],
            [/\bque dia estamos\b/g,'que dia es hoy'],[/\ba que dia estamos\b/g,'que dia es hoy'],[/\bque fecha estamos\b/g,'que fecha es hoy'],
            [/\borden compra\b/g,'orden de compra'],[/\bbajo del minimo\b/g,'bajo minimo'],[/\bcuanto tubo\b/g,'cuantos tubos'],[/\bcuanto tubos\b/g,'cuantos tubos'],
            [/\bde 1 pulga\b/g,'de 1 pulgada'],[/\bde una pulga\b/g,'de 1 pulgada'],[/\buna pulgada\b/g,'1 pulgada'],[/\bmedia pulga\b/g,'1/2 pulgada'],
            [/\bchecame\b/g,'revisa'],[/\bchekame\b/g,'revisa'],[/\ba ver si ay\b/g,'a ver si hay'],[/\bdonde mero\b/g,'donde esta'],
            [/\bcomo va el yale\b/g,'como va el jale'],[/\bcomo va el jale\b/g,'estado de proyecto'],[/\bque onda con el proyecto\b/g,'estado de proyecto']
        ];
        phraseCorrections.forEach(([regex,replacement]) => { normalized = normalized.replace(regex,replacement); });
        const lexicon = domainSpeechLexicon();
        const corrected = normalized.split(' ').map(word => bestSpeechWord(word, lexicon)).join(' ').replace(/\s+/g,' ').trim();
        const rawWords = normalized.split(' ').filter(Boolean);
        const correctedWords = corrected.split(' ').filter(Boolean);
        let changes = 0;
        for (let i=0;i<Math.max(rawWords.length,correctedWords.length);i+=1) if ((rawWords[i]||'') !== (correctedWords[i]||'')) changes += 1;
        const changeRatio = rawWords.length ? changes / rawWords.length : 0;
        return { raw, normalized, corrected: commandNormalize(corrected), changes, changeRatio };
    }
    function recognitionIntentBonus(value) {
        const norm = commandNormalize(value);
        let score = 0;
        const patterns = [
            [/\bque hora es\b|\bdime la hora\b/,24],[/\bque dia es hoy\b|\bque fecha es hoy\b/,24],[/\bque mes\b|\ben que mes\b/,18],[/\bque ano\b|\ben que ano\b/,18],
            [/\bque puedes hacer\b|\bayuda\b|\bcomandos\b/,20],[/\bquien eres\b|\bcomo te llamas\b/,18],[/\bque perfil\b|\bperfil actual\b/,18],
            [/\bcuant[oa]s?\b.*\b(material|tubo|cable|pieza|existencia|stock)\b/,18],[/\bdonde\b.*\b(material|tubo|cable|ubicacion)\b/,18],
            [/\bbajo minimo\b/,18],[/\borden de compra\b/,16],[/\bherramientas?\b/,14],[/\bvehiculos?\b/,14],[/\bproyectos?\b/,12],[/\bproveedores?\b/,12],[/\btrabajadores?\b|\bpersonal\b/,12]
        ];
        patterns.forEach(([pattern,bonus]) => { if (pattern.test(norm)) score += bonus; });
        return score;
    }
    function recognitionQualityLabel(score, confidence, correctionRatio) {
        const weighted = score + confidence * 12 - correctionRatio * 8;
        if (weighted >= 32) return 'alta';
        if (weighted >= 18) return 'media';
        return 'baja';
    }

    function setInterpreted(value, quality = '') {
        const node = document.getElementById('sky-interpreted');
        if (!node) return;
        const strong = node.querySelector('strong');
        const qualityNode = document.getElementById('sky-listen-quality');
        const clean = text(value);
        node.classList.toggle('is-visible', Boolean(clean));
        if (strong) strong.textContent = clean || '—';
        if (qualityNode) qualityNode.textContent = quality ? `confianza ${quality}` : '';
    }

    function recognitionCandidateScore(value) {
        const correctedBundle = correctRecognizedTranscript(value);
        const normalized = correctedBundle.corrected || commandNormalize(value);
        if (!normalized) return -1000;
        let score = normalized.length / 42;
        const commonWords = ['cuanto','cuantos','donde','tenemos','hay','estado','busca','buscar','disponible','proyecto','hora','fecha','dia','hoy','mes','ano','ayuda','perfil','quien eres','repite'];
        const profileWords = {
            almacen: ['ubicacion','bajo minimo','orden de compra','herramienta','vehiculo','tubo','cable','broca','almacen','bodega','rack','zona','piso','existencia'],
            compras: ['cotizacion','cotizaciones','cotizar','oferta','ofertas','precio','precios','plazo','plazos','entrega','comparar proveedores','orden de compra','requisicion','proveedor','recepcion','servicio','tienda','comprar','pago','vencimiento','rfc'],
            rh: ['trabajador','colaborador','personal','empleado','ausencia','vacaciones','incapacidad','documento','contrato','capacitacion','incidencia','asistencia'],
            finanzas: ['presupuesto','costo','consumido','planeado','gasto','finanzas','avance','cuenta por pagar'],
            gerente_general: ['proyecto','proyectos','gasto','materiales','sueldos','nomina','planeado','real','desviacion','presupuesto','direccion'],
            subgerente: ['proyecto','proyectos','gasto','materiales','sueldos','nomina','planeado','real','desviacion','presupuesto','direccion'],
            proyectos: ['avance','costo','solicitud','material','entrega','picking','ruta','responsable']
        };
        [...commonWords, ...(profileWords[detectProfile()] || [])].forEach(word => { if (normalized.includes(word)) score += 3.5; });
        const simplePatterns = [/que hora es|dime la hora|hora actual/, /que dia es hoy|que fecha es hoy|fecha de hoy/, /que mes|mes actual/, /que ano|ano actual/, /quien eres|como te llamas/, /que puedes hacer|ayuda|comandos/, /que perfil|en que perfil/, /repite|repetir/];
        simplePatterns.forEach(pattern => { if (pattern.test(normalized)) score += 12; });
        score += recognitionIntentBonus(normalized);
        score -= correctedBundle.changeRatio * 4;
        if (/\d/.test(normalized)) score += 2;
        if (/\b(pulgada|pulgadas|mm|cm|metro|metros|pieza|piezas)\b/.test(normalized)) score += 3;
        const materials = Array.isArray(cache.materials) ? cache.materials : [];
        if (materials.length) {
            const queryTokens = normalized.split(' ').filter(item => item.length > 2 && !stopWords.has(item));
            let bestMaterial = 0;
            for (const material of materials.slice(0, 1400)) {
                const haystack = materialSearchText(material);
                let local = 0;
                queryTokens.forEach(token => {
                    if (haystack.includes(token)) local += token.length > 5 ? 2 : 1;
                    else if (token.length >= 5 && haystack.split(' ').some(word => Math.abs(word.length-token.length) <= 1 && levenshtein(word, token) <= 1)) local += .75;
                });
                if (local > bestMaterial) bestMaterial = local;
            }
            score += Math.min(bestMaterial * 2.5, 16);
        }
        return score;
    }

    function bestRecognitionAlternative(result) {
        if (!result?.length) return '';
        let best = text(result[0]?.transcript);
        let bestScore = recognitionCandidateScore(best) + recognitionIntentBonus(correctRecognizedTranscript(best).corrected) + number(result[0]?.confidence) * 8;
        for (let index = 1; index < result.length; index += 1) {
            const candidate = text(result[index]?.transcript);
            const score = recognitionCandidateScore(candidate) + recognitionIntentBonus(correctRecognizedTranscript(candidate).corrected) + number(result[index]?.confidence) * 8;
            if (score > bestScore) { best = candidate; bestScore = score; }
        }
        return best;
    }

    function bestTranscriptFromResults(results) {
        let beams = [{ text: '', confidence: 0, score: 0 }];
        for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
            const result = results[resultIndex];
            const alternatives = [];
            for (let i = 0; i < Math.min(result.length, 10); i += 1) alternatives.push({ text: text(result[i]?.transcript), confidence: number(result[i]?.confidence) });
            if (!alternatives.length) continue;
            const next = [];
            beams.forEach(beam => alternatives.forEach(alt => {
                const combined = joinTranscript(beam.text, alt.text);
                next.push({ text: combined, confidence: beam.confidence + alt.confidence, score: recognitionCandidateScore(combined) + recognitionIntentBonus(correctRecognizedTranscript(combined).corrected) + (beam.confidence + alt.confidence) * 7 });
            }));
            beams = next.sort((a,b) => b.score - a.score).slice(0, 24);
        }
        const unique = [];
        const seen = new Set();
        beams.sort((a,b) => b.score - a.score).forEach(item => {
            const key = commandNormalize(item.text);
            if (key && !seen.has(key)) { seen.add(key); unique.push(item.text); }
        });
        return { best: unique[0] || '', alternatives: unique.slice(1, 7) };
    }

    function joinTranscript(base, addition) {
        const left = text(base);
        const right = text(addition);
        if (!left) return right;
        if (!right) return left;
        const nl = normalize(left);
        const nr = normalize(right);
        if (nl === nr || nl.endsWith(nr)) return left;
        if (nr.startsWith(nl)) return right;
        return `${left} ${right}`.replace(/\s+/g, ' ').trim();
    }

    function clearVoiceTimers() {
        if (silenceTimer) clearTimeout(silenceTimer);
        if (hardStopTimer) clearTimeout(hardStopTimer);
        silenceTimer = null;
        hardStopTimer = null;
    }

    function scheduleVoiceStop(delay = 1250) {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            if (!recognition || !listening) return;
            voiceShouldSubmit = true;
            try { recognition.stop(); } catch (_) {}
        }, delay);
    }

    function microphoneConstraints() {
        const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 };
        if (selectedMicId) audio.deviceId = { exact: selectedMicId };
        return { audio };
    }

    async function openMicrophoneStream() {
        if (!window.isSecureContext) throw Object.assign(new Error('El micrófono requiere abrir el CRM por HTTPS o localhost.'), { name: 'SecurityError' });
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('Este navegador no expone acceso al micrófono.'), { name: 'NotSupportedError' });
        try {
            return await navigator.mediaDevices.getUserMedia(microphoneConstraints());
        } catch (error) {
            if (selectedMicId && ['NotFoundError','OverconstrainedError','NotReadableError'].includes(error?.name)) {
                selectedMicId = '';
                localStorage.removeItem('skilled_sky_mic_id');
                return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
            }
            throw error;
        }
    }

    async function refreshMicrophones() {
        const select = document.getElementById('sky-mic-device');
        const diagnostic = document.getElementById('sky-mic-diagnostic');
        if (!select || !navigator.mediaDevices?.enumerateDevices) return;
        try {
            const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput');
            select.innerHTML = '<option value="">Micrófono predeterminado</option>' + devices.map((device, index) => `<option value="${html(device.deviceId)}">${html(device.label || `Micrófono ${index + 1}`)}</option>`).join('');
            if (selectedMicId && devices.some(device => device.deviceId === selectedMicId)) select.value = selectedMicId;
            if (diagnostic) diagnostic.textContent = devices.length ? `${devices.length} entrada${devices.length === 1 ? '' : 's'} de audio detectada${devices.length === 1 ? '' : 's'}.` : 'No se detectaron entradas de audio.';
        } catch (error) {
            if (diagnostic) diagnostic.textContent = error?.message || 'No pude enumerar los micrófonos.';
        }
    }

    async function testMicrophone() {
        const diagnostic = document.getElementById('sky-mic-diagnostic');
        if (diagnostic) diagnostic.textContent = 'Probando entrada de audio… habla durante unos segundos.';
        let stream = null;
        let context = null;
        try {
            stream = await openMicrophoneStream();
            await refreshMicrophones();
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                if (diagnostic) diagnostic.textContent = 'El micrófono abrió correctamente. Este navegador no permite medir el nivel de señal.';
                return;
            }
            context = new AudioContextClass();
            await context.resume().catch(() => {});
            const source = context.createMediaStreamSource(stream);
            const analyser = context.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            let peak = 0;
            const until = Date.now() + 2800;
            while (Date.now() < until) {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i += 1) { const value = (data[i] - 128) / 128; sum += value * value; }
                peak = Math.max(peak, Math.sqrt(sum / data.length));
                await new Promise(resolve => setTimeout(resolve, 90));
            }
            if (diagnostic) diagnostic.textContent = peak > .004 ? `Señal detectada correctamente (${Math.round(peak * 1000)}).` : 'El navegador abrió el micrófono, pero no detecté señal. Selecciona otra entrada o revisa el micrófono del sistema.';
        } catch (error) {
            const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
            if (diagnostic) diagnostic.textContent = denied ? (error?.message || 'El navegador bloqueó el micrófono.') : (error?.message || 'No pude abrir el micrófono seleccionado.');
            setStatus(diagnostic?.textContent || 'No pude probar el micrófono.', 'error');
        } finally {
            try { stream?.getTracks().forEach(track => track.stop()); } catch (_) {}
            try { await context?.close(); } catch (_) {}
        }
    }

    async function preflightMicrophone() {
        if (!window.isSecureContext) {
            setStatus('El micrófono requiere que el CRM esté abierto por HTTPS o localhost. Por HTTP normal el navegador lo bloquea.', 'error');
            setHeard('sitio sin contexto seguro');
            return false;
        }
        if (micPermissionChecked) return true;
        try {
            setStatus('Solicitando acceso al micrófono…', 'busy');
            const stream = await openMicrophoneStream();
            stream.getTracks().forEach(track => track.stop());
            micPermissionChecked = true;
            await refreshMicrophones();
            return true;
        } catch (error) {
            const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
            setStatus(denied ? (error?.message || 'El navegador bloqueó el micrófono. Permite el acceso para este sitio y vuelve a intentar.') : (error?.message || 'No pude abrir el micrófono. Revisa el dispositivo de entrada del navegador.'), 'error');
            setHeard('micrófono no disponible');
            return false;
        }
    }

    function recognitionGrammarPhrases() {
        const profile = detectProfile();
        const common = ['que hora es','que dia es hoy','que fecha es hoy','que puedes hacer','quien eres','que perfil estoy usando','en que seccion estoy','cual es tu atajo'];
        const profilePhrases = {
            almacen:['cuantos tubos tenemos','donde esta el material','materiales bajo minimo','orden de compra','herramientas disponibles','vehiculos disponibles','prepara la ruta del proyecto'],
            compras:['cotizaciones por revisar','busca cotizacion','comparar proveedores','mejor precio y plazo','ordenes de compra pendientes','busca proveedor','servicios por vencer'],
            rh:['trabajadores activos','busca trabajador','quien esta ausente hoy','documentos por vencer','proyectos sin personal'],
            finanzas:['costo consumido del proyecto','presupuesto del proyecto','proyectos con mayor costo'],
            gerente_general:['cuantos tipos de tubos tengo','cuantas personas tengo en el proyecto','cuantas compras estan pendientes','que vehiculos estan disponibles','cuanto se gasto en el proyecto','materiales contra sueldos','proyectos sobre lo planeado','resumen ejecutivo'],
            subgerente:['cuantos tipos de tubos tengo','cuantas personas tengo en el proyecto','cuantas compras estan pendientes','que vehiculos estan disponibles','cuanto se gasto en el proyecto','materiales contra sueldos','proyectos sobre lo planeado','resumen ejecutivo'],
            proyectos:['como va el proyecto','costo del proyecto','prepara la ruta del proyecto','solicitudes de material pendientes']
        };
        return [...common, ...(profilePhrases[profile] || [])];
    }
    function configureLegacyGrammar() {
        return;
    }

    function configureRecognitionPhrases() {
        return;
    }

    async function primeRecognitionVocabulary() {
        const profile = detectProfile();
        if (vocabularyPriming || vocabularyPrimedProfile === profile) return;
        vocabularyPriming = true;
        try {
            if (profile === 'compras') await Promise.all([loadData('coSuppliers'), loadData('coServices'), loadData('coQuotations')]);
            else if (profile === 'rh') await loadData('rhPeople');
            else if (profile === 'finanzas' || profile === 'proyectos') await loadData('projectDetails');
            else if (isExecutiveReadProfile(profile)) await Promise.allSettled([loadData('materials'), loadData('vehicles')]);
            else if (profile === 'almacen' || profile === 'consulta') await Promise.all([loadData('materials'), loadData('tools'), loadData('vehicles'), loadData('projects')]);
            else await loadData('materials');
            vocabularyPrimedProfile = profile;
        } catch (_) {} finally { vocabularyPriming = false; }
    }

    function showRecognitionChoices(candidates = []) {
        const cleaned = [];
        const seen = new Set();
        candidates.forEach(value => {
            const corrected = correctRecognizedTranscript(value).corrected;
            const key = commandNormalize(corrected);
            if (corrected && !seen.has(key)) { seen.add(key); cleaned.push(corrected); }
        });
        if (!cleaned.length) return false;
        answerNode.innerHTML = `<div class="sky-answer-title">No estoy completamente seguro</div><div class="sky-answer-main">Selecciona la frase que más se parece a lo que dijiste.</div><div class="sky-recognition-choices">${cleaned.slice(0,4).map((value,index)=>`<button type="button" class="sky-recognition-choice" data-sky-choice="${index}">${html(value)}</button>`).join('')}</div><div class="sky-answer-detail">También puedes corregir el texto de arriba y pulsar Consultar.</div>`;
        answerNode.querySelectorAll('[data-sky-choice]').forEach(button => button.addEventListener('click', () => {
            const value = cleaned[Number(button.dataset.skyChoice)] || '';
            if (!value) return;
            transcriptInput.value = value;
            if (voiceRawTranscript) rememberSpeechCorrection(voiceRawTranscript, value);
            setInterpreted(value, 'confirmada');
            query(value);
        }));
        return true;
    }


    function setVoiceEngine(mode = 'automatico', label = '') {
        voiceMode = mode;
        const node = document.getElementById('sky-engine');
        if (!node) return;
        const titles = {
            cloud: 'Voz · avanzada',
            browser: 'Voz · navegador',
            automatico: 'Voz · automático',
            error: 'Voz · requiere atención'
        };
        node.className = `sky-engine${mode === 'cloud' ? ' is-cloud' : mode === 'browser' ? ' is-browser' : mode === 'error' ? ' is-error' : ''}`;
        node.textContent = label || titles[mode] || titles.automatico;
    }

    function setVoiceMeter(active = false, level = 0) {
        const meter = document.getElementById('sky-voice-meter');
        if (!meter) return;
        meter.classList.toggle('is-active', active);
        const normalized = Math.max(0, Math.min(1, Number(level) || 0));
        [...meter.querySelectorAll('i')].forEach((bar, index, bars) => {
            if (!active) {
                bar.style.height = '';
                return;
            }
            const center = (bars.length - 1) / 2;
            const shape = Math.max(.25, 1 - Math.abs(index - center) / (center + .5));
            const jitter = .78 + (((Date.now() / 80 + index * 1.7) % 3) / 10);
            bar.style.height = `${Math.round(4 + 18 * Math.max(.18, normalized) * shape * jitter)}px`;
        });
    }

    async function ensureCloudVoice(force = false) {
        if (!window.SkilledDB?.skyTranscriptionStatus || !window.SkilledDB?.transcribeSkyAudio) return false;
        if (!force && cloudVoiceStatus && Date.now() - cloudVoiceCheckedAt < 120000) {
            return cloudVoiceStatus.disponible === true && cloudVoiceStatus.configurado === true;
        }
        cloudVoiceCheckedAt = Date.now();
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado al comprobar Sky Voz.')), 4500));
            cloudVoiceStatus = await Promise.race([SkilledDB.skyTranscriptionStatus(), timeout]);
        } catch (error) {
            cloudVoiceStatus = { disponible: false, configurado: false, codigo: 'unavailable', mensaje: error?.message || '' };
        }
        return cloudVoiceStatus?.disponible === true && cloudVoiceStatus?.configurado === true;
    }

    function cloudVoiceProblemMessage() {
        const code = text(cloudVoiceStatus?.codigo);
        const detail = text(cloudVoiceStatus?.mensaje);
        if (code === 'missing_function') return 'La voz avanzada es opcional y todavía no está desplegada en Supabase.';
        if (code === 'missing_key') return 'La voz avanzada es opcional y todavía no tiene una clave de transcripción configurada.';
        if (code === 'auth') return 'La voz avanzada no pudo validar la sesión actual.';
        if (code === 'not_configured') return detail || 'La voz avanzada todavía requiere configuración del servidor.';
        return detail || 'La voz avanzada no está disponible en este momento.';
    }

    function showVoiceSetupState() {
        if (recognition) {
            setVoiceEngine('browser');
            setStatus('Usando el reconocimiento de voz del navegador. Sky Voz avanzada queda como respaldo.');
            setHeard('micrófono listo');
            return;
        }
        if (desktopBrave) {
            setVoiceEngine('automatico', 'Voz · requiere Groq');
            setStatus(cloudVoiceProblemMessage() || 'En Brave de escritorio la voz requiere Sky Voz avanzada mediante Supabase y Groq.', 'error');
            setHeard('voz avanzada no disponible');
            return;
        }
        setVoiceEngine('automatico');
        setStatus('Puedes seguir usando Sky por texto. Para voz en este navegador hace falta habilitar Sky Voz avanzada.');
        setHeard('consulta por texto disponible');
    }

    function voiceContextPrompt() {
        const lexicon = domainSpeechLexicon();
        const useful = lexicon.words.slice(0, 140);
        return [...recognitionGrammarPhrases(), ...useful].filter(Boolean).join(', ').slice(0, 1750);
    }

    function cleanupCloudAudio() {
        if (cloudMeterTimer) clearInterval(cloudMeterTimer);
        cloudMeterTimer = null;
        try { cloudAudioContext?.close(); } catch (_) {}
        cloudAudioContext = null;
        cloudAnalyser = null;
        if (cloudStream) {
            try { cloudStream.getTracks().forEach(track => track.stop()); } catch (_) {}
        }
        cloudStream = null;
        cloudRecorder = null;
        setVoiceMeter(false);
    }

    async function processCloudAudio(blob) {
        if (!blob || blob.size < 700) {
            setStatus('No detecté suficiente audio. Acércate al micrófono y vuelve a intentarlo.', 'error');
            setHeard('sin audio suficiente');
            if(handsFreeEnabled)scheduleHandsFreeListening(900);
            return;
        }
        setStatus('Transcribiendo la consulta con Sky Voz…', 'busy');
        setHeard('procesando audio…', 'live');
        try {
            const result = await SkilledDB.transcribeSkyAudio(blob, {
                profile: detectProfile(),
                context: voiceContextPrompt()
            });
            const raw = text(result?.texto);
            if (!raw) throw new Error('No se reconoció una frase clara.');
            const correctedBundle = correctRecognizedTranscript(raw);
            const interpreted = text(correctedBundle.corrected || raw);
            voiceRawTranscript = raw;
            voiceInterpretedTranscript = interpreted;
            transcriptInput.value = interpreted;
            setHeard(raw, 'final');
            setInterpreted(commandNormalize(raw) !== commandNormalize(interpreted) ? interpreted : '', recognitionQualityLabel(20, .95, correctedBundle.changeRatio));
            setStatus('Voz reconocida. Consultando el CRM…', 'busy');
            setTimeout(() => query(interpreted), 80);
        } catch (error) {
            const limited = error?.code === 'rate_limit' || /429|rate limit|too many requests|límite.*groq/i.test(text(error?.message));
            if (limited) {
                const wait = Math.max(60000, Number(error?.retryAfterMs) || 0);
                cloudRetryAfter = Date.now() + wait;
                try { sessionStorage.setItem('skilled_sky_cloud_retry_after', String(cloudRetryAfter)); } catch (_) {}
                if (recognition) {
                    setVoiceEngine('browser');
                    setStatus('Groq alcanzó un límite temporal. Sky cambiará al reconocimiento del navegador hasta que la cuota se restablezca.', 'error');
                    setHeard('pulsa el micrófono y habla nuevamente');
                } else {
                    setVoiceEngine('automatico', 'Voz · límite temporal');
                    setStatus('Groq alcanzó un límite temporal. Las consultas por texto siguen funcionando normalmente.', 'error');
                    setHeard('consulta por texto disponible');
                }
                return;
            }
            cloudVoiceCheckedAt = 0;
            await ensureCloudVoice(true);
            setVoiceEngine('error', 'Voz · requiere atención');
            setStatus(error?.message || cloudVoiceProblemMessage() || 'No se pudo transcribir la voz.', 'error');
            setHeard('transcripción no disponible');
        }
    }

    async function startCloudListening(options = {}) {
        if (cloudRecorder || listening || recognitionStarting) return;
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setStatus('Este navegador no permite la grabación necesaria para Sky Voz.', 'error');
            setVoiceEngine('error');
            return;
        }
        if (!options.preserveClearedInput && transcriptInput) transcriptInput.value = '';
        voiceFinal = '';
        voiceInterim = '';
        voiceBest = '';
        voiceAlternatives = [];
        voiceConfidence = 0;
        voiceRawTranscript = '';
        voiceInterpretedTranscript = '';
        voiceShouldSubmit = false;
        voiceHadError = false;
        clearVoiceTimers();
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        recognitionStarting = true;
        setStatus('Preparando Sky Voz…', 'busy');
        setHeard('preparando micrófono…', 'live');
        setInterpreted('');
        try {
            primeRecognitionVocabulary();
            cloudStream = await openMicrophoneStream();
            micPermissionChecked = true;
            await refreshMicrophones();
            const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
            const mimeType = mimeCandidates.find(value => MediaRecorder.isTypeSupported?.(value)) || '';
            cloudChunks = [];
            cloudRecorder = mimeType ? new MediaRecorder(cloudStream, { mimeType }) : new MediaRecorder(cloudStream);
            cloudRecorder.ondataavailable = event => { if (event.data?.size) cloudChunks.push(event.data); };
            cloudRecorder.onerror = event => {
                voiceHadError = true;
                setStatus(event?.error?.message || 'La grabación del micrófono se interrumpió.', 'error');
            };
            cloudRecorder.onstop = async () => {
                const chunks = cloudChunks.slice();
                const type = cloudRecorder?.mimeType || chunks[0]?.type || 'audio/webm';
                const submit = voiceShouldSubmit && !voiceHadError;
                cleanupCloudAudio();
                listening = false;
                recognitionStarting = false;
                micButton?.classList.remove('is-listening');
                document.getElementById('sky-open')?.classList.remove('is-listening');
                if (submit) await processCloudAudio(new Blob(chunks, { type }));
            };

            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    cloudAudioContext = new AudioContextClass();
                    await cloudAudioContext.resume().catch(() => {});
                    const source = cloudAudioContext.createMediaStreamSource(cloudStream);
                    cloudAnalyser = cloudAudioContext.createAnalyser();
                    cloudAnalyser.fftSize = 1024;
                    cloudAnalyser.smoothingTimeConstant = .72;
                    source.connect(cloudAnalyser);
                }
            } catch (_) {
                cloudAudioContext = null;
                cloudAnalyser = null;
            }

            recognitionStarting = false;
            listening = true;
            voiceMode = 'cloud';
            voiceShouldSubmit = true;
            cloudStartedAt = Date.now();
            cloudLastVoiceAt = Date.now();
            cloudSpeechDetected = false;
            setVoiceEngine('cloud');
            micButton?.classList.add('is-listening');
            document.getElementById('sky-open')?.classList.add('is-listening');
            setStatus('Escuchando con Sky Voz. Habla normalmente y haz una pausa al terminar.', 'busy');
            setHeard('escuchando…', 'live');
            setVoiceMeter(true, .2);
            cloudRecorder.start(180);

            if (cloudAnalyser) {
                const timeData = new Uint8Array(cloudAnalyser.fftSize);
                cloudMeterTimer = setInterval(() => {
                    if (!cloudRecorder || cloudRecorder.state !== 'recording') return;
                    const now = Date.now();
                    try {
                        cloudAnalyser.getByteTimeDomainData(timeData);
                        let sum = 0;
                        for (let i = 0; i < timeData.length; i += 1) {
                            const value = (timeData[i] - 128) / 128;
                            sum += value * value;
                        }
                        const rms = Math.sqrt(sum / timeData.length);
                        setVoiceMeter(true, Math.min(1, rms * 16));
                        if (rms > .006) {
                            cloudSpeechDetected = true;
                            cloudLastVoiceAt = now;
                            setHeard('voz detectada…', 'live');
                        }
                    } catch (_) {}
                    if (cloudSpeechDetected && now - cloudStartedAt > 900 && now - cloudLastVoiceAt > 1550) {
                        finishCloudListening(true);
                        return;
                    }
                    if (now - cloudStartedAt > 18000) finishCloudListening(true);
                }, 90);
            } else {
                cloudMeterTimer = setInterval(() => {
                    if (cloudRecorder?.state === 'recording' && Date.now() - cloudStartedAt > 18000) finishCloudListening(true);
                }, 250);
            }
        } catch (error) {
            cleanupCloudAudio();
            recognitionStarting = false;
            listening = false;
            const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
            setVoiceEngine('error');
            setStatus(denied ? (error?.message || 'El micrófono está bloqueado. Permite el acceso para este sitio.') : (error?.message || 'No pude abrir el micrófono para Sky Voz.'), 'error');
            setHeard('micrófono no disponible');
        }
    }

    function finishCloudListening(submit = true) {
        if (!cloudRecorder) return;
        voiceShouldSubmit = submit;
        if (cloudRecorder.state === 'recording') {
            try { cloudRecorder.stop(); } catch (_) { cleanupCloudAudio(); }
        }
    }

    function setupRecognition() {
        const BrowserRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const Recognition = BrowserRecognition;
        if (!Recognition) {
            recognition = null;
            micButton.disabled = false;
            micButton.title = 'Hablar con Sky';
            setVoiceEngine('automatico');
            setHeard('voz avanzada disponible si está configurada');
            micButton.addEventListener('click', () => listening || recognitionStarting ? finishListening() : startListening());
            return;
        }
        recognition = new Recognition();
        recognition.lang = 'es-MX';
        recognition.interimResults = true;
        recognition.continuous = !/iPad|iPhone|iPod/.test(navigator.userAgent);
        recognition.maxAlternatives = 10;
        recognition.onstart = () => {
            recognitionStarting = false;
            listening = true;
            voiceHadError = false;
            setVoiceEngine('browser');
            setVoiceMeter(true, .35);
            micButton.classList.add('is-listening');
            document.getElementById('sky-open')?.classList.add('is-listening');
            setStatus('Escuchando. Habla normalmente y haz una pausa al terminar…', 'busy');
            setHeard('escuchando…', 'live');
            setInterpreted('');
            clearVoiceTimers();
            hardStopTimer = setTimeout(() => {
                if (!listening) return;
                voiceShouldSubmit = true;
                try { recognition.stop(); } catch (_) {}
            }, 24000);
        };
        recognition.onspeechstart = () => setStatus('Te escucho…', 'busy');
        recognition.onresult = event => {
            const chosen = bestTranscriptFromResults(event.results);
            voiceBest = chosen.best;
            voiceAlternatives = chosen.alternatives;
            let finals = '', interim = '', hasInterim = false;
            for (let index = 0; index < event.results.length; index += 1) {
                const result = event.results[index];
                const candidate = bestRecognitionAlternative(result);
                if (result.isFinal) finals = joinTranscript(finals, candidate);
                else { interim = joinTranscript(interim, candidate); hasInterim = true; }
            }
            voiceFinal = finals;
            voiceInterim = interim;
            const combined = text(voiceBest || joinTranscript(voiceFinal, voiceInterim));
            voiceRawTranscript = combined;
            let confidenceTotal = 0, confidenceCount = 0;
            for (let index = 0; index < event.results.length; index += 1) {
                const result = event.results[index];
                if (result?.[0] && Number.isFinite(Number(result[0].confidence)) && Number(result[0].confidence) > 0) { confidenceTotal += Number(result[0].confidence); confidenceCount += 1; }
            }
            voiceConfidence = confidenceCount ? confidenceTotal / confidenceCount : 0;
            setVoiceMeter(true, Math.max(.28, voiceConfidence || .45));
            const correctedBundle = correctRecognizedTranscript(combined);
            voiceInterpretedTranscript = correctedBundle.corrected || combined;
            if (combined) transcriptInput.value = voiceInterpretedTranscript;
            setHeard(combined || 'escuchando…', hasInterim ? 'live' : 'final');
            if (combined && commandNormalize(combined) !== commandNormalize(voiceInterpretedTranscript)) setInterpreted(voiceInterpretedTranscript, recognitionQualityLabel(recognitionCandidateScore(combined), voiceConfidence, correctedBundle.changeRatio));
            else setInterpreted('');
            scheduleVoiceStop(hasInterim ? 2450 : 1900);
        };
        recognition.onspeechend = () => scheduleVoiceStop(1800);
        recognition.onnomatch = () => {
            setStatus('No entendí la frase completa. Intenta hablar un poco más cerca del micrófono.', 'error');
            setHeard('sin coincidencia clara');
            if(handsFreeEnabled)scheduleHandsFreeListening(850);
        };
        recognition.onerror = event => {
            voiceHadError = true;
            const error = event.error;
            const messages = {
                'not-allowed': 'El micrófono está bloqueado. Permite el acceso para este sitio.',
                'service-not-allowed': 'El servicio de reconocimiento de voz está bloqueado por el navegador.',
                'audio-capture': 'No encontré un micrófono disponible. Revisa el dispositivo de entrada.',
                'no-speech': 'No detecté voz. Acércate al micrófono y vuelve a intentarlo.',
                'network': 'El reconocimiento de voz necesita conexión a Internet en este navegador.',
                'language-not-supported': 'El navegador no admite el idioma configurado para el reconocimiento de voz.',
                'phrases-not-supported': 'El navegador rechazó el modo de vocabulario avanzado. Sky cambiará automáticamente al reconocimiento compatible.'
            };
            if (error === 'phrases-not-supported') {
                recognitionPhraseBiasDisabled = true;
                stopListening(false, false);
                setStatus('Reintentando con el reconocimiento compatible…', 'busy');
                setTimeout(() => startListening({ preserveClearedInput: true, forceBrowser: true }), 180);
                return;
            }
            if (error === 'network' || error === 'service-not-allowed') {
                try { sessionStorage.setItem('skilled_sky_browser_voice_unstable', '1'); } catch (_) {}
                stopListening(false, false);
                setVoiceMeter(false);
                setStatus('El motor de voz del navegador no respondió. Probando Sky Voz avanzada…', 'busy');
                ensureCloudVoice(true).then(ready => {
                    if (ready) {
                        setVoiceEngine('cloud');
                        setStatus('Sky Voz avanzada está lista. Habla nuevamente; este modo quedará seleccionado para esta sesión.', 'busy');
                        setTimeout(() => startCloudListening({ preserveClearedInput: true }), 220);
                    } else {
                        showVoiceSetupState();
                    }
                });
                return;
            }
            if (error !== 'aborted') setStatus(messages[error] || `No pude reconocer la voz (${error || 'error desconocido'}).`, 'error');
            stopListening(false, false);
            if(handsFreeEnabled&&['no-speech','aborted'].includes(error))scheduleHandsFreeListening(950);
        };
        recognition.onend = () => {
            const rawRecognized = text(voiceRawTranscript || voiceBest || voiceFinal || voiceInterim || transcriptInput?.value);
            const pool = [rawRecognized, ...voiceAlternatives].filter(Boolean);
            let bestBundle = null;
            pool.forEach(candidate => {
                const correction = correctRecognizedTranscript(candidate);
                const score = recognitionCandidateScore(candidate) + recognitionIntentBonus(correction.corrected) + voiceConfidence * 8 - correction.changeRatio * 3;
                if (!bestBundle || score > bestBundle.score) bestBundle = { ...correction, score };
            });
            const interpreted = text(bestBundle?.corrected || rawRecognized);
            const quality = recognitionQualityLabel(bestBundle?.score || 0, voiceConfidence, bestBundle?.changeRatio || 0);
            const shouldSubmit = voiceShouldSubmit && !voiceHadError && interpreted.length >= 2;
            stopListening(false, false);
            setVoiceMeter(false);
            if (rawRecognized) {
                transcriptInput.value = interpreted;
                setHeard(rawRecognized, 'final');
                setInterpreted(commandNormalize(rawRecognized) !== commandNormalize(interpreted) ? interpreted : '', quality);
            }
            if (shouldSubmit) {
                const ambiguityPool = [interpreted, ...voiceAlternatives];
                if (quality === 'baja' && (bestBundle?.score || 0) < 10 && showRecognitionChoices(ambiguityPool)) {
                    setStatus('La voz fue ambigua. Elige la interpretación correcta para evitar una consulta equivocada.', 'error');
                } else {
                    setStatus(quality === 'baja' ? 'Interpreté la frase con baja confianza; comprobaré el contexto antes de responder…' : 'Entendido. Consultando el CRM…', 'busy');
                    setTimeout(() => query(interpreted), 100);
                }
            } else if (!voiceHadError) {
                setStatus(interpreted ? 'Frase capturada. Puedes corregirla o pulsar Consultar.' : 'No detecté una frase completa. Intenta nuevamente.', interpreted ? '' : 'error');
                if(!interpreted&&handsFreeEnabled)scheduleHandsFreeListening(950);
            }
        };
        micButton.addEventListener('click', () => listening || recognitionStarting ? finishListening() : startListening());
    }

    async function startListening(options = {}) {
        if (listening || recognitionStarting || cloudRecorder) return;
        statusNode?.classList.remove('sky-listening-followup');
        clearTimeout(handsFreeTimer);
        if (!options.preserveClearedInput && transcriptInput) transcriptInput.value = '';
        voiceFinal = '';
        voiceInterim = '';
        voiceBest = '';
        voiceAlternatives = [];
        voiceConfidence = 0;
        voiceRawTranscript = '';
        voiceInterpretedTranscript = '';
        voiceShouldSubmit = false;
        voiceHadError = false;
        clearVoiceTimers();
        if ('speechSynthesis' in window) speechSynthesis.cancel();

        let cloudReady = !options.forceBrowser && Date.now() >= cloudRetryAfter && cloudVoiceStatus?.disponible === true && cloudVoiceStatus?.configurado === true;
        const browserUnstable = sessionStorage.getItem('skilled_sky_browser_voice_unstable') === '1';
        if (!options.forceBrowser && Date.now() >= cloudRetryAfter && !cloudReady) cloudReady = await ensureCloudVoice(false);
        if (cloudReady) return startCloudListening({ preserveClearedInput: true });

        if (!options.forceBrowser && (desktopBrave || !recognition || browserUnstable) && Date.now() >= cloudRetryAfter) {
            cloudReady = await ensureCloudVoice(true);
            if (cloudReady) return startCloudListening({ preserveClearedInput: true });
        }
        if (!recognition) {
            showVoiceSetupState();
            return;
        }

        recognitionStarting = true;
        const allowed = await preflightMicrophone();
        if (!allowed) {
            recognitionStarting = false;
            return;
        }
        setVoiceEngine('browser');
        setStatus('Activando micrófono…', 'busy');
        setHeard('preparando…', 'live');
        setInterpreted('');
        try {
            primeRecognitionVocabulary();
            recognition.start();
        } catch (error) {
            recognitionStarting = false;
            if (error?.name === 'InvalidStateError') return;
            if (cloudReady) {
                try { sessionStorage.setItem('skilled_sky_browser_voice_unstable', '1'); } catch (_) {}
                setStatus('El reconocimiento del navegador no inició. Cambiando a Sky Voz avanzada…', 'busy');
                return startCloudListening({ preserveClearedInput: true });
            }
            setVoiceEngine('error');
            setStatus('No pude iniciar el reconocimiento. Espera un segundo y vuelve a pulsar el micrófono.', 'error');
        }
    }

    function finishListening() {
        if (voiceMode === 'cloud' && cloudRecorder) {
            finishCloudListening(true);
            return;
        }
        if (!recognition) return;
        voiceShouldSubmit = true;
        clearVoiceTimers();
        try { recognition.stop(); } catch (_) { stopListening(false, false); }
    }

    function stopListening(abort = true, resetSubmit = true) {
        clearVoiceTimers();
        if (cloudRecorder) {
            if (abort) {
                voiceShouldSubmit = false;
                try {
                    if (cloudRecorder.state === 'recording') cloudRecorder.stop();
                    else cleanupCloudAudio();
                } catch (_) { cleanupCloudAudio(); }
            }
        }
        if (recognition && (listening || recognitionStarting) && abort && voiceMode !== 'cloud') {
            try { recognition.abort(); } catch (_) {}
        }
        if (!cloudRecorder) {
            listening = false;
            recognitionStarting = false;
        }
        if (resetSubmit) voiceShouldSubmit = false;
        micButton?.classList.remove('is-listening');
        document.getElementById('sky-open')?.classList.remove('is-listening');
        if (!listening) setVoiceMeter(false);
        if (!listening) statusNode?.classList.remove('sky-listening-followup');
    }

    async function tableRows(table, select = '*', order = '') {
        if (!window.SkilledDB?.client) throw new Error('La conexión con el CRM todavía no está lista.');
        let request = SkilledDB.client.from(table).select(select);
        if (order) request = request.order(order, { ascending: true });
        const { data, error } = await request;
        if (error) throw error;
        return data || [];
    }

    function skyBridgeProfile(profile = detectProfile()) {
        if (['administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta'].includes(profile)) return profile;
        return '';
    }

    function skyBridge(source, filter = '') {
        if (!window.SkilledDB?.getSkyProfileData) return null;
        return SkilledDB.getSkyProfileData(source, filter);
    }

    async function loadData(key) {
        const dynamicKeys = new Set(['low','purchases','assignments','coSupplierRequests','coStore','coQuotations','rhIncidents','rhAttendance','executiveAlerts']);
        const keyTtl = dynamicKeys.has(key) ? 15000 : 300000;
        if (cache[key] !== undefined && Date.now() - Number(cacheTimes[key] || 0) < keyTtl) return cache[key];
        if (dataPromises.has(key)) return dataPromises.get(key);
        if (!window.SkilledDB) throw new Error('La conexión con el CRM todavía no está lista.');
        const profile = detectProfile();
        const bridge = skyBridgeProfile(profile);
        const loaders = {
            materials: () => isExecutiveReadProfile(profile) && typeof SkilledDB.listExecutiveSkyMaterials === 'function' ? SkilledDB.listExecutiveSkyMaterials() : bridge && SkilledDB.getSkyProfileData ? skyBridge('materiales') : SkilledDB.listMaterials(),
            low: async () => bridge && SkilledDB.getSkyProfileData ? (await skyBridge('materiales')).filter(item => number(item.stock) <= number(item.stockMinimo ?? item.stock_minimo)) : SkilledDB.listLowStock(),
            purchases: () => bridge && SkilledDB.getSkyProfileData ? skyBridge('compras') : SkilledDB.listPurchaseRequests({}),
            tools: () => bridge && SkilledDB.getSkyProfileData ? skyBridge('herramientas') : SkilledDB.listTools(),
            assignments: () => SkilledDB.listToolAssignments({}),
            vehicles: () => isExecutiveReadProfile(profile) && typeof SkilledDB.listExecutiveVehicles === 'function' ? SkilledDB.listExecutiveVehicles() : bridge && SkilledDB.getSkyProfileData ? skyBridge('vehiculos') : SkilledDB.listVehicles(),
            projects: () => bridge && SkilledDB.getSkyProfileData ? skyBridge('proyectos') : SkilledDB.listProjectOptions(),
            projectDetails: () => bridge && SkilledDB.getSkyProfileData ? skyBridge('projectDetails') : SkilledDB.listProjects(),
            coSuppliers: () => bridge && SkilledDB.getSkyProfileData ? skyBridge('proveedores') : tableRows('co_proveedores'),
            coProviderMaterials: () => SkilledDB.listProviderMaterials({ activeOnly: true }),
            coSupplierRequests: () => SkilledDB.listSupplierRequests({}),
            coServices: () => SkilledDB.listServices(),
            coStore: () => SkilledDB.listStoreRequests(),
            coQuotations: () => bridge && SkilledDB.getSkyProfileData ? skyBridge('cotizaciones') : typeof SkilledDB.listQuotationRequests === 'function' ? SkilledDB.listQuotationRequests({}) : [],
            rhPeople: () => bridge && SkilledDB.getSkyProfileData ? skyBridge('personal') : tableRows('rh_personal'),
            rhAssignments: () => tableRows('rh_proyecto_asignaciones'),
            rhIncidents: () => tableRows('rh_incidencias'),
            rhAttendance: () => typeof SkilledDB.getSkyAttendanceV81 === 'function' ? SkilledDB.getSkyAttendanceV81() : [],
            rhDocuments: () => tableRows('rh_documentos', '*,personal:rh_personal(id,numero_empleado,nombre,apellidos,puesto)'),
            rhTrainings: () => tableRows('rh_capacitaciones'),
            rhParticipants: () => tableRows('rh_capacitacion_participantes', '*,personal:rh_personal(id,nombre,apellidos)'),
            rhOfficeAssets: () => SkilledDB.listRHOfficeAssets({ includeInactive: true }),
            rhOfficeAssignments: () => SkilledDB.listRHOfficeAssignments({ includeClosed: true }),
            executiveRHOfficeAssets: () => SkilledDB.getExecutiveRHOfficeAssets(),
            executiveTools: () => SkilledDB.getExecutiveSkyTools(),
            executiveWarehouses: () => SkilledDB.getExecutiveSkyWarehouses(),
            executiveAlerts: () => SkilledDB.getExecutiveSkyAlerts(),
            categories: () => isExecutiveReadProfile(profile) && typeof SkilledDB.listExecutiveSkyCategories === 'function' ? SkilledDB.listExecutiveSkyCategories() : bridge && SkilledDB.getSkyProfileData ? skyBridge('categorias') : SkilledDB.listCategories(),
            executiveSearch: () => []
        };
        if (!loaders[key]) throw new Error(`Sky no tiene un origen de datos registrado para ${key}.`);
        const promise = Promise.resolve().then(loaders[key]).then(data => {
            cache[key] = data;
            cacheTimes[key] = Date.now();
            cache.at = Date.now();
            return data;
        }).finally(() => dataPromises.delete(key));
        dataPromises.set(key, promise);
        return promise;
    }

    function tokensForMaterial(queryText) {
        return normalize(queryText).split(' ').filter(token => token.length > 0 && !stopWords.has(token));
    }

    function materialSearchText(material) {
        const values = [material.codigo, material.descripcion, material.desc, material.categoria, material.unidad, material.marca, material.codigoMarca, material.codigo_marca, material.tipoCable, material.tamano, ...(Array.isArray(material.modismos) ? material.modismos : [])];
        return normalize(values.join(' '));
    }

    function rankMaterial(material, rawQuery) {
        const values = [material.codigo,material.descripcion,material.desc,material.categoria,material.unidad,material.marca,material.codigoMarca,material.codigo_marca,material.tipoCable,material.tamano,material.proveedor,material.contactoProveedor,...(Array.isArray(material.modismos)?material.modismos:[])];
        if (window.SkilledSearch?.score) {
            let score = window.SkilledSearch.score(values, rawQuery);
            const queryNorm = normalize(rawQuery), code = normalize(material.codigo);
            if (code && queryNorm.includes(code)) score += 140;
            return score;
        }
        const haystack = materialSearchText(material), tokens = tokensForMaterial(rawQuery);
        if (!tokens.length) return -1;
        let score = 0;
        tokens.forEach(token => { score += haystack.includes(token) ? 18 : -8; });
        return score;
    }

    async function findMaterial(rawQuery) {
        const materials = await loadData('materials');
        const ranked = materials.map(material => ({ material, score: rankMaterial(material, rawQuery) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || text(a.material.descripcion).localeCompare(text(b.material.descripcion), 'es'));
        if (!ranked.length) return { best: null, alternatives: [] };
        return { best: ranked[0].material, alternatives: ranked.slice(1, 4).map(item => item.material), score: ranked[0].score };
    }

    const materialFamilyIgnore = new Set(['tipo','tipos','variedad','variedades','clase','clases','familia','familias','modelo','modelos','opcion','opciones','coincidencia','coincidencias','coincide','coinciden','diferente','diferentes','catalogo','lista','listado','muestra','muestrame','mostrar','busca','buscar','encuentra','encontrar','tengo','tenemos','hay','registrado','registrados','registrada','registradas','disponible','disponibles','todos','todas']);

    function materialFamilyQuery(rawQuery) {
        const tokens = normalize(rawQuery).split(' ').filter(Boolean).filter(token => !stopWords.has(token) && !materialFamilyIgnore.has(token));
        return tokens.join(' ').trim();
    }

    function isMaterialFamilyQuery(rawQuery) {
        const norm = commandNormalize(rawQuery);
        if (/\b(tipos?|variedades?|clases?|familias?|modelos?|coincidencias?|opciones?)\b/.test(norm)) return true;
        if (/\b(cuales|que|cuantos|cuantas)\b.*\b(tubos|tuberias|cables|tornillos|pijas|tuercas|rondanas|arandelas|abrazaderas|conectores|terminales|brocas|pernos|taquetes|mangueras|valvulas|codos|niples|reducciones|conduit|canaletas)\b/.test(norm) && !/\b(cuantos|cuantas)\b.*\b(piezas?|metros?|unidades?|existencia|stock)\b/.test(norm)) return true;
        if (/\b(busca|buscar|muestra|mostrar|lista|listar|encuentra|dame)\b.*\b(materiales?|tubos|tuberias|cables|tornillos|pijas|tuercas|rondanas|arandelas|abrazaderas|conectores|terminales|brocas|pernos|taquetes|mangueras|valvulas|codos|niples|reducciones|conduit|canaletas)\b/.test(norm)) return true;
        if (/\b(todo|todos|todas)\b.*\b(coincida|coincidan|contenga|contengan|tenga|tengan)\b/.test(norm)) return true;
        return false;
    }

    async function answerMaterialFamily(raw) {
        const materials = await loadData('materials');
        const queryText = materialFamilyQuery(raw);
        const ranked = materials.map(material => ({ material, score: rankMaterial(material, queryText || raw) })).filter(item => item.score > 8).sort((a,b) => b.score - a.score || text(a.material.descripcion || a.material.desc).localeCompare(text(b.material.descripcion || b.material.desc), 'es'));
        const seen = new Set();
        const matches = ranked.map(item => item.material).filter(material => {
            const key = normalize(material.codigo || material.descripcion || material.desc);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        if (!matches.length) {
            setAnswer('Coincidencias de materiales', 'No encontré materiales que coincidan con esa familia o descripción.', 'Prueba con una palabra del nombre, medida, marca, categoría o código.', [], { href: 'AL.catalogo.html', label: 'Abrir catálogo' });
            return 'No encontré coincidencias de materiales para esa consulta.';
        }
        const totalStock = matches.reduce((sum, material) => sum + (Array.isArray(material.almacenes) ? material.almacenes.reduce((subtotal,row) => subtotal + number(row.stock), 0) : number(material.stock)), 0);
        const cards = matches.slice(0, 12).map(material => {
            const stock = Array.isArray(material.almacenes) ? material.almacenes.reduce((sum,row) => sum + number(row.stock), 0) : number(material.stock);
            const locations = (Array.isArray(material.almacenes) ? material.almacenes : []).filter(row => number(row.stock) > 0 || text(row.ubicacion)).slice(0, 2).map(row => `${row.nombre || 'Almacén'}${row.ubicacion ? ` · ${row.ubicacion}` : ''}`).join(' / ');
            const rollDetail = /^(cable|cables)$/i.test(text(material.categoria)) && number(material.rollosDisponibles ?? material.rollos_disponibles) > 0 ? ` · ${formatNumber(material.rollosDisponibles ?? material.rollos_disponibles)} rollo(s)` : '';
            return { title: `${material.codigo || 'Sin código'} · ${material.descripcion || material.desc || 'Material'}`, detail: `${material.marca || 'Sin marca'}${material.codigoMarca || material.codigo_marca ? ` · ${material.codigoMarca || material.codigo_marca}` : ''} · ${formatNumber(stock)} ${material.unidad || 'unidades'}${rollDetail}${locations ? ` · ${locations}` : ''}` };
        });
        const queryLabel = queryText || normalize(raw);
        const detail = `${formatNumber(totalStock)} unidades acumuladas entre las coincidencias. ${matches.length > cards.length ? `Se muestran las primeras ${cards.length} de ${matches.length}.` : 'Se muestran todas las coincidencias encontradas.'}`;
        setAnswer('Coincidencias de materiales', `${matches.length} tipo${matches.length === 1 ? '' : 's'} de material coinciden con “${queryLabel}”.`, detail, cards, { href: `AL.catalogo.html?buscar=${encodeURIComponent(queryLabel)}`, label: 'Ver coincidencias en catálogo' });
        const spoken = matches.slice(0, 6).map(material => material.descripcion || material.desc || material.codigo).filter(Boolean);
        return `Encontré ${matches.length} tipo${matches.length === 1 ? '' : 's'} que coinciden con ${queryLabel}. ${spoken.length ? `Entre ellos: ${spoken.join(', ')}.` : ''}`;
    }

    function purchaseKey(value) {
        return normalize(value).replace(/\s+/g, '');
    }

    function extractOrder(queryNorm) {
        const matches = queryNorm.match(/\b(?:oc[-\s]?)?[a-z0-9-]*\d[a-z0-9-]*\b/gi) || [];
        return matches.map(value => text(value)).find(value => /\d/.test(value)) || '';
    }

    async function answerMaterial(raw, locationOnly) {
        const match = await findMaterial(raw);
        if (!match.best) {
            setAnswer('Material', 'No encontré un material suficientemente parecido.', 'Prueba diciendo el código, descripción o algún modismo registrado en el catálogo.', [], { href: 'AL.catalogo.html', label: 'Abrir catálogo' });
            return 'No encontré ese material en el catálogo.';
        }
        const material = match.best;
        conversationContext.material = { codigo: text(material.codigo), descripcion: text(material.descripcion || material.desc) };saveConversationContext();
        const inventories = (Array.isArray(material.almacenes) ? material.almacenes : []).filter(item => locationOnly ? Boolean(text(item.ubicacion)) || number(item.stock) > 0 : number(item.stock) !== 0 || Boolean(text(item.ubicacion)));
        const total = (material.almacenes || []).reduce((sum, item) => sum + number(item.stock), 0);
        const cards = inventories.map(item => ({ title: item.nombre || 'Almacén', detail: `${formatNumber(item.stock)} ${material.unidad || 'unidades'}${item.ubicacion ? ` · ${item.ubicacion}` : ' · sin ubicación específica'}` }));
        const rawNorm = commandNormalize(raw);
        const asksBrandCode = /\b(codigo|código|numero|número|referencia|modelo|parte|part number)\b.*\b(marca|fabricante|modelo|parte)\b|\b(codigo|código)\s+de\s+(marca|fabricante)\b/.test(rawNorm);
        if (asksBrandCode) {
            const brandCode = text(material.codigoMarca || material.codigo_marca);
            const main = brandCode ? `${material.descripcion}: el código de marca / modelo es ${brandCode}.` : `${material.descripcion} todavía no tiene código de marca / modelo registrado.`;
            const detail = `${material.marca ? `Marca ${material.marca}. ` : ''}${brandCode ? 'Este dato corresponde a la referencia o modelo oficial del fabricante.' : 'Puedes completarlo desde el catálogo de materiales.'}`;
            setAnswer('Código de marca / modelo', main, detail, [{ title: `${material.codigo} · ${material.descripcion}`, detail: `${material.marca || 'Sin marca'} · ${brandCode || 'Pendiente de capturar'}` }], { href: `AL.catalogo.html?q=${encodeURIComponent(material.codigo)}`, label: 'Abrir material' });
            return main;
        }
        if (locationOnly) {
            const located = inventories.filter(item => text(item.ubicacion));
            const main = located.length ? `${material.descripcion} tiene ${located.length === 1 ? 'esta ubicación' : 'estas ubicaciones'}.` : `${material.descripcion} todavía no tiene una ubicación física específica registrada.`;
            const detail = match.alternatives.length ? `Interpreté “${text(raw)}” como ${material.descripcion}.` : '';
            setAnswer('Ubicación', main, detail, cards, { href: `AL.almacenes.html?q=${encodeURIComponent(material.codigo)}`, label: 'Abrir ubicaciones' });
            const voice = located.length ? `${material.descripcion}. ${located.map(item => `${item.nombre}, ubicación ${item.ubicacion}`).join('. ')}` : `${material.descripcion} todavía no tiene ubicación específica.`;
            return voice;
        }
        const main = `${material.descripcion}: ${formatNumber(total)} ${material.unidad || 'unidades'} en total.`;
        const detail = match.alternatives.length ? `Interpreté la consulta como ${material.descripcion}.` : 'Existencia consultada directamente del inventario por almacén.';
        setAnswer('Existencia', main, detail, cards, { href: `AL.catalogo.html?q=${encodeURIComponent(material.codigo)}`, label: 'Abrir material' });
        const positive = (material.almacenes || []).filter(item => number(item.stock) > 0);
        return positive.length ? `${material.descripcion}. Tienes ${formatNumber(total)} ${material.unidad || 'unidades'} en total. ${positive.map(item => `En ${item.nombre} tienes ${formatNumber(item.stock)}`).join('. ')}` : `${material.descripcion} tiene existencia cero.`;
    }

    async function answerLowStock() {
        const rows = await loadData('low');
        const total = rows.length;
        const exhausted = rows.filter(item => item.estadoStock === 'agotado').length;
        const suggested = rows.reduce((sum, item) => sum + Math.max(0, number(item.cantidadReposicionSugerida ?? item.stockMaximoAlmacen) - (item.cantidadReposicionSugerida == null ? number(item.stockAlmacen) : 0)), 0);
        const cards = rows.slice(0, 6).map(item => ({ title: `${item.codigo} · ${item.descripcion ?? item.desc}`, detail: `${item.almacenNombre || 'Sin almacén'} · actual ${formatNumber(item.stockAlmacen)} · sugerido comprar ${formatNumber(item.cantidadReposicionSugerida)}` }));
        setAnswer('Bajo mínimo', total ? `${total} materiales requieren atención; ${exhausted} están agotados.` : 'No hay materiales bajo mínimo.', total ? 'Las cantidades sugeridas se calculan para regresar cada material a su stock máximo.' : 'El inventario no tiene alertas de mínimos en este momento.', cards, { href: detectProfile() === 'compras' ? 'CO.cotizaciones.html' : 'AL.bajo-minimo.html', label: 'Abrir reposiciones' });
        return total ? `Hay ${total} materiales bajo mínimo. ${exhausted} están agotados.` : 'No hay materiales bajo mínimo.';
    }

    async function answerPurchase(raw) {
        const rows = await loadData('purchases');
        const norm = commandNormalize(raw);
        const candidate = extractOrder(norm);
        const matching = candidate ? rows.filter(item => [item.ordenCompra, item.folio, item.grupoOrden].some(value => purchaseKey(value).includes(purchaseKey(candidate)) || purchaseKey(candidate).includes(purchaseKey(value)))) : rows.filter(item => !['recibida', 'cerrada', 'cancelada', 'rechazada'].includes(normalize(item.estado)));
        if (!matching.length) {
            setAnswer('Orden de compra', candidate ? `No encontré una orden relacionada con “${candidate}”.` : 'No encontré órdenes pendientes.', 'Puedes indicar el número de OC o el folio de solicitud.', [], { href: detectProfile() === 'compras' ? 'CO.ordenes-compra.html' : 'AL.ordenes-compra.html', label: 'Abrir órdenes' });
            return candidate ? `No encontré la orden ${candidate}.` : 'No encontré órdenes pendientes.';
        }
        const groups = new Map();
        matching.forEach(item => {
            const key = text(item.ordenCompra || item.grupoOrden || item.folio);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });
        const cards = [...groups.entries()].slice(0, 6).map(([key, items]) => {
            const requested = items.reduce((sum, item) => sum + number(item.cantidadSolicitada), 0);
            const received = items.reduce((sum, item) => sum + number(item.cantidadRecibida), 0);
            const state = received >= requested && requested > 0 ? 'recibida' : received > 0 ? 'parcial' : text(items[0].estado || 'pendiente');
            return { title: key, detail: `${state} · ${formatNumber(received)} de ${formatNumber(requested)} recibidos · ${items[0].proveedor || 'proveedor pendiente'}` };
        });
        const first = cards[0];
        setAnswer('Orden de compra', candidate && cards.length === 1 ? `${first.title}: ${first.detail}.` : `${cards.length} orden${cards.length === 1 ? '' : 'es'} encontradas.`, 'El avance se calcula con las cantidades solicitadas y recibidas.', cards, { href: detectProfile() === 'compras' ? 'CO.ordenes-compra.html' : 'AL.ordenes-compra.html', label: 'Abrir órdenes' });
        return candidate && cards.length === 1 ? `${first.title}. ${first.detail}.` : `Encontré ${cards.length} órdenes relacionadas.`;
    }

    async function answerTools(raw) {
        const [tools, assignments] = await Promise.all([loadData('tools'), loadData('assignments')]);
        const norm = commandNormalize(raw);
        const overdueRequested = /vencid|atrasad|no.*regres|pendiente.*devol/.test(norm);
        if (overdueRequested) {
            const overdue = assignments.filter(item => item.estado === 'vencida');
            const cards = overdue.slice(0, 6).map(item => ({ title: item.unidad?.herramienta?.descripcion || item.unidad?.codigoInterno || 'Herramienta', detail: `${item.personaNombre || item.proyecto || 'Sin destino'} · devolución ${item.fechaDevolucionEstimada || 'sin fecha'}` }));
            setAnswer('Herramientas pendientes', overdue.length ? `${overdue.length} herramientas tienen devolución vencida.` : 'No hay herramientas con devolución vencida.', '', cards, { href: 'AL.asignaciones-herramientas.html', label: 'Abrir asignaciones' });
            return overdue.length ? `Hay ${overdue.length} herramientas con devolución vencida.` : 'No hay herramientas vencidas.';
        }
        const queryTokens = normalize(raw).split(' ').filter(token => token.length > 2 && !['herramienta', 'herramientas', 'disponible', 'disponibles', 'asignada', 'asignadas', 'tenemos', 'cuantas', 'cuantos'].includes(token));
        let matched = tools;
        if (queryTokens.length) matched = tools.filter(tool => queryTokens.some(token => normalize([tool.sku, tool.descripcion, tool.marca, tool.modelo, tool.clasificacion].join(' ')).includes(token)));
        if (!matched.length) {
            setAnswer('Herramientas', 'No encontré una herramienta coincidente.', 'Prueba con el SKU, nombre, marca o modelo.', [], { href: 'AL.herramientas.html', label: 'Abrir herramientas' });
            return 'No encontré esa herramienta.';
        }
        const available = matched.reduce((sum, item) => sum + number(item.disponibles), 0);
        const assigned = matched.reduce((sum, item) => sum + number(item.asignadas), 0);
        const cards = matched.slice(0, 6).map(item => ({ title: `${item.sku} · ${item.descripcion}`, detail: `${formatNumber(item.disponibles)} disponibles · ${formatNumber(item.asignadas)} asignadas` }));
        setAnswer('Herramientas', `${formatNumber(available)} disponibles y ${formatNumber(assigned)} asignadas en ${matched.length} tipo${matched.length === 1 ? '' : 's'} de herramienta.`, '', cards, { href: 'AL.estado-herramientas.html', label: 'Abrir estado actual' });
        return `Hay ${formatNumber(available)} herramientas disponibles y ${formatNumber(assigned)} asignadas.`;
    }

    async function answerVehicles(raw) {
        const vehicles = await loadData('vehicles');
        const norm = commandNormalize(raw);
        const types = ['pickup', 'camioneta', 'automovil', 'van', 'camion', 'motocicleta', 'montacargas', 'generador', 'maquinaria'];
        const type = types.find(item => norm.includes(item));
        const active = vehicles.filter(item => item.activo !== false);
        const named = active
            .map(item => {
                const displayName = text(item.nombreVehiculo || item.numeroEconomico);
                const vehicleName = normalize(displayName);
                const full = normalize([displayName,item.numeroEconomico,item.marca,item.modelo,item.placas,item.tipo].join(' '));
                let score = 0;
                if (vehicleName && norm.includes(vehicleName)) score += 120;
                for (const token of norm.split(' ').filter(t => t.length > 2)) {
                    if (vehicleName.includes(token)) score += 20;
                    else if (full.includes(token)) score += 5;
                }
                return { item, score };
            })
            .filter(row => row.score > 20)
            .sort((a,b) => b.score-a.score);
        if (named.length && !/disponible|disponibles|cuantos|cuantas|flotilla|vehiculos/.test(norm)) {
            const item=named[0].item;
            conversationContext.vehicle = { nombre: text(item.nombreVehiculo || item.numeroEconomico), id: item.id };saveConversationContext();
            const state=normalize(item.estado)==='disponible'?'disponible':text(item.estado||'sin estado');
            const displayName = text(item.nombreVehiculo || item.numeroEconomico) || 'Vehículo';
            const main=`${displayName}: ${item.marca || ''} ${item.modelo || ''}`.trim();
            setAnswer('Vehículo', main, `${item.tipo || 'Vehículo'} · ${state} · ${item.placas || 'sin placas'} · ${formatNumber(item.kilometraje)} km`,
                [{title:'Nombre del vehículo',detail:displayName || 'Sin nombre'},{title:'Estado',detail:state},{title:'Responsable',detail:item.responsable || item.asignadoA || 'Sin asignación'}],
                { href:'AL.vehiculos.html', label:'Abrir flotilla' });
            return `El vehículo ${displayName} está ${state}. ${item.marca || ''} ${item.modelo || ''}.`;
        }
        const rows = active.filter(item => !type || normalize(item.tipo).includes(type));
        const available = rows.filter(item => normalize(item.estado) === 'disponible');
        const vehicleLabel = item => text(item.nombreVehiculo || item.numeroEconomico) || `${item.marca || ''} ${item.modelo || ''}`.trim() || 'Vehículo sin nombre';
        const cards = available.slice(0, 6).map(item => ({ title: `${vehicleLabel(item)} · ${item.marca || ''} ${item.modelo || ''}`.trim(), detail: `${item.tipo || 'vehículo'} · ${item.placas || 'sin placas'} · ${formatNumber(item.kilometraje)} km` }));
        const spokenNames = available.slice(0, 6).map(vehicleLabel);
        const extra = Math.max(0, available.length - spokenNames.length);
        const namesText = spokenNames.length ? ` Disponibles: ${spokenNames.join(', ')}${extra ? ` y ${extra} más` : ''}.` : '';
        const summary = available.length
            ? `${available.length} vehículo${available.length === 1 ? '' : 's'} disponible${available.length === 1 ? '' : 's'}${type ? ` del tipo ${type}` : ''}.${namesText}`
            : `No hay vehículos disponibles${type ? ` del tipo ${type}` : ''}.`;
        setAnswer('Vehículos', summary, 'Puedes preguntarme directamente por el nombre de un vehículo.', cards, { href: 'AL.vehiculos.html', label: 'Abrir flotilla' });
        return available.length ? `Hay ${available.length} vehículos disponibles${type ? ` del tipo ${type}` : ''}. ${spokenNames.length ? `Son: ${spokenNames.join(', ')}${extra ? ` y ${extra} más` : ''}.` : ''}` : 'No hay vehículos disponibles con ese filtro.';
    }

    async function answerProjectRoute(raw) {
        const projects = await loadData('projects');
        const norm = commandNormalize(raw);
        const match = projects.find(item => norm.includes(normalize(item.proyecto)) || (item.nombreProyecto && norm.includes(normalize(item.nombreProyecto))));
        if (!match) {
            setAnswer('Preparar proyecto', 'No pude identificar el proyecto.', 'Di el número o nombre exacto del proyecto.', [], { href: 'AL.automatizaciones.html#picking', label: 'Abrir preparación de proyecto' });
            return 'No pude identificar el proyecto.';
        }
        const route = await SkilledDB.buildProjectPickingRoute(match.proyecto);
        const cards = route.rutas.slice(0, 6).map(item => ({ title: `${item.ubicacion} · ${item.descripcion}`, detail: `${formatNumber(item.cantidad)} ${item.unidad || ''} · ${item.almacenNombre}` }));
        const main = `${match.proyecto}: ${route.totalParadas} paradas de picking y ${route.faltantes.length} faltantes.`;
        setAnswer('Preparar proyecto', main, 'Sky solo preparó la ruta; no registró ninguna salida.', cards, { href: `AL.automatizaciones.html?proyecto=${encodeURIComponent(match.proyecto)}#picking`, label: 'Abrir ruta completa' });
        return `${match.proyecto}. Preparé ${route.totalParadas} paradas. Hay ${route.faltantes.length} faltantes.`;
    }


    function currency(value) {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(number(value));
    }
    function dateOnly(value) {
        if (!value) return '—';
        const raw = text(value);
        const parsed = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
        return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function daysFromToday(value) {
        if (!value) return null;
        const parsed = new Date(`${text(value).slice(0, 10)}T12:00:00`);
        if (Number.isNaN(parsed.getTime())) return null;
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        return Math.ceil((parsed - today) / 86400000);
    }
    function searchTokens(raw, exclusions = []) {
        const excluded = new Set([...stopWords, ...exclusions].map(normalize));
        return normalize(raw).split(' ').filter(token => token.length > 2 && !excluded.has(token));
    }
    function matchesTokens(values, tokens) {
        if (!tokens.length) return true;
        const query = tokens.join(' ');
        if (window.SkilledSearch?.matches) return window.SkilledSearch.matches(values, query);
        const haystack = normalize((Array.isArray(values) ? values : [values]).join(' '));
        return tokens.every(token => haystack.includes(token));
    }
    function supplierWhatsApp(item) {
        return text(item?.whatsapp || item?.proveedorWhatsapp || item?.proveedor_whatsapp || item?.telefono || item?.proveedorTelefono || item?.proveedor_telefono).replace(/\D/g, '');
    }
    function supplierEmail(item) {
        return text(item?.email || item?.proveedorEmail || item?.proveedor_email);
    }
    function supplierContactActions(item, message = '') {
        const actions = [], phone = supplierWhatsApp(item), email = supplierEmail(item);
        const providerName = text(item?.nombre_comercial || item?.razon_social || item?.proveedorNombre || item?.proveedor_nombre || 'Proveedor');
        const body = text(message) || `Hola, te contacto de Skilled Proyectos Industriales para solicitar información comercial. Gracias.`;
        if (phone.length >= 10) actions.push({ label: 'WhatsApp', href: `https://wa.me/${phone}?text=${encodeURIComponent(body)}` });
        if (email) actions.push({ label: 'Correo', href: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Contacto · Skilled Proyectos Industriales · ${providerName}`)}&body=${encodeURIComponent(body)}` });
        return actions;
    }

    const demoToolDefaults = [
        {name:'Java',category:'Lenguaje',description:'Lógica estructurada y crecimiento de servicios cuando se requieran procesos adicionales.'},
        {name:'JavaScript',category:'Lenguaje',description:'Interfaz, validaciones, buscadores, Sky y conexión del frontend con Supabase.'},
        {name:'TypeScript',category:'Lenguaje',description:'Funciones de servidor y procesos controlados en Supabase Edge Functions.'},
        {name:'SQL / PostgreSQL',category:'Base de datos',description:'Consultas, vistas, funciones RPC, permisos y reglas de trazabilidad del CRM.'},
        {name:'HTML5',category:'Estructura',description:'Pantallas, formularios, tarjetas y navegación por perfil.'},
        {name:'CSS3',category:'Diseño',description:'Diseño corporativo, temas, responsividad y experiencia visual.'},
        {name:'PowerShell .ps1',category:'Automatización',description:'Configuración y tareas de Windows para publicación, impresión y preparación del entorno.'},
        {name:'Python',category:'Checador',description:'Aplicación local del checador, almacenamiento, huella y sincronización en Raspberry Pi.'},
        {name:'C++ / PlatformIO',category:'Checador',description:'Firmware de apoyo para ESP32 y periféricos del checador físico.'},
        {name:'OpenSCAD',category:'Diseño 3D',description:'Diseño paramétrico de la carcasa del checador.'},
        {name:'Supabase',category:'Nube y datos',description:'Autenticación, PostgreSQL, funciones, permisos y sincronización centralizada.'},
        {name:'Visual Studio',category:'Desarrollo',description:'Entorno de trabajo para organizar, revisar y mejorar el código del CRM.'}
    ];
    function demoTools(){try{const rows=JSON.parse(localStorage.getItem('skilled_sky_demo_tools_v82')||localStorage.getItem('skilled_sky_demo_tools_v81')||'null');return Array.isArray(rows)&&rows.length?rows:demoToolDefaults}catch(_){return demoToolDefaults}}
    function toolsUsedIntent(raw){const norm=commandNormalize(raw);return /\b(lenguajes|herramientas|tecnologias|stack|java|javascript|sql|html|css|powershell|supabase|visual studio|con que.*hecho|con que.*desarrollado|que usaron|que utilizan)\b/.test(norm)&&/\b(utilizad|usad|hech|desarroll|crm|sky|sistema|programa|herramientas|lenguajes|stack|tecnologias)\b/.test(norm)}
    function answerToolsUsed(raw){if(!toolsUsedIntent(raw))return null;const rows=demoTools();const cards=rows.slice(0,12).map(item=>({title:`${item.name||'Herramienta'} · ${item.category||'Uso'}`,detail:item.description||'Herramienta agregada para la presentación.'}));const message=`En esta etapa se están utilizando ${rows.length} lenguajes y herramientas principales dentro del CRM y Sky.`;setAnswer('Lenguajes y herramientas utilizadas',message,'Estas tarjetas son temporales para la presentación. Puedes agregarlas o borrarlas desde el perfil de prueba de Sky sin afectar la implementación final.',cards,{href:'SKY.inicio.html#sky-tools-section',label:'Abrir tarjetas'});return {handled:true,voice:`${message} Entre ellas están ${rows.slice(0,6).map(item=>item.name).filter(Boolean).join(', ')}.`};}

    function projectMatch(projects, raw) {
        const norm = commandNormalize(raw);
        const tokens = searchTokens(raw, ['proyecto', 'proyectos', 'costo', 'presupuesto', 'avance', 'como', 'cuanto', 'consumido']);
        return projects.find(item => {
            const numberKey = normalize(item.proyecto || item.idProyecto);
            const name = normalize(item.nombreProyecto);
            if (numberKey && norm.includes(numberKey)) return true;
            if (name && norm.includes(name)) return true;
            return tokens.length >= 1 && matchesTokens([item.proyecto, item.nombreProyecto, item.cliente], tokens);
        });
    }

    async function answerQuotation(raw) {
        const norm = commandNormalize(raw);
        const rows = await loadData('coQuotations');
        const openStates = new Set(['solicitada','en_revision','cotizando']);
        const approvedStates = new Set(['aprobada','aprobado']);
        const folioMatch = String(raw || '').match(/\bCOT[-\s]?[A-Z0-9-]+/i);
        const tokens = searchTokens(raw, ['cotizacion','cotizaciones','cotizar','solicitud','solicitudes','oferta','ofertas','comparar','proveedor','proveedores','precio','precios','plazo','plazos','entrega','revisar','revision','pendiente','pendientes','busca','buscar','muestra','ver']);
        let selected = rows;
        if (folioMatch) {
            const key = normalize(folioMatch[0]).replace(/\s+/g, '');
            selected = rows.filter(item => normalize(item.folio).replace(/\s+/g, '').includes(key));
        } else if (/pendient|por revisar|requieren atencion|en revision|cotizando/.test(norm)) {
            selected = rows.filter(item => openStates.has(normalize(item.estado)));
        } else if (/aprobad|aceptad|seleccionad/.test(norm)) {
            selected = rows.filter(item => approvedStates.has(normalize(item.estado)));
        } else if (tokens.length) {
            const matches = rows.filter(item => {
                const itemText = (Array.isArray(item.items) ? item.items : []).flatMap(detail => [detail.materialCodigo,detail.descripcion,detail.marca,detail.unidad]);
                return matchesTokens([item.folio,item.referencia,item.solicitadoPor,item.estado,item.prioridad,...itemText], tokens);
            });
            if (matches.length) selected = matches;
        }
        const open = rows.filter(item => openStates.has(normalize(item.estado)));
        const materialCount = selected.reduce((sum,item) => sum + (Array.isArray(item.items) ? item.items.length : 0), 0);
        const cards = selected.slice(0, 7).map(item => {
            const items = Array.isArray(item.items) ? item.items : [];
            const preview = items.slice(0,2).map(detail => detail.descripcion || detail.materialCodigo).filter(Boolean).join(', ');
            return {
                title: item.folio || 'Cotización',
                detail: `${text(item.estado) || 'solicitada'} · ${items.length} material${items.length === 1 ? '' : 'es'}${item.prioridad === 'urgente' ? ' · urgente' : ''}${item.fechaRequerida ? ` · requerida ${dateOnly(item.fechaRequerida)}` : ''}${preview ? ` · ${preview}` : ''}`
            };
        });
        if (folioMatch && selected.length === 1 && typeof SkilledDB.getQuotationRequest === 'function') {
            try {
                const detail = await SkilledDB.getQuotationRequest(selected[0].id);
                const items = Array.isArray(detail.items) ? detail.items : [];
                let quoted = 0, chosen = 0;
                let bestPrice = null, fastest = null;
                items.forEach(item => {
                    const offers = (Array.isArray(item.ofertas) ? item.ofertas : []).filter(o => number(o.precioUnitario) > 0);
                    if (offers.length) quoted++;
                    if (item.ofertaSeleccionadaId) chosen++;
                    offers.forEach(offer => {
                        if (!bestPrice || number(offer.precioUnitario) < number(bestPrice.precioUnitario)) bestPrice = offer;
                        if (!fastest || number(offer.plazoEntregaDias) < number(fastest.plazoEntregaDias)) fastest = offer;
                    });
                });
                const notes = [];
                notes.push(`${quoted} de ${items.length} materiales ya tienen al menos una oferta`);
                notes.push(`${chosen} tienen proveedor seleccionado`);
                if (bestPrice) notes.push(`el menor precio registrado es ${currency(bestPrice.precioUnitario)} con ${bestPrice.proveedorNombre || 'un proveedor'}`);
                if (fastest) notes.push(`el plazo más corto registrado es ${formatNumber(fastest.plazoEntregaDias)} día${number(fastest.plazoEntregaDias) === 1 ? '' : 's'} con ${fastest.proveedorNombre || 'un proveedor'}`);
                setAnswer('Detalle de cotización', `${detail.folio}: ${items.length} material${items.length === 1 ? '' : 'es'} · estado ${detail.estado}.`, notes.join('. ') + '.', cards, { href: 'CO.cotizaciones.html', label: 'Abrir comparador' });
                return `${detail.folio} tiene ${items.length} materiales. ${notes.join('. ')}.`;
            } catch (_) {}
        }
        const headline = selected === rows && !folioMatch && !tokens.length ? `${open.length} cotización${open.length === 1 ? '' : 'es'} requieren atención.` : selected.length ? `${selected.length} cotización${selected.length === 1 ? '' : 'es'} encontrada${selected.length === 1 ? '' : 's'}.` : 'No encontré cotizaciones con ese criterio.';
        setAnswer('Cotizaciones', headline, selected.length ? `${materialCount} material${materialCount === 1 ? '' : 'es'} en el listado mostrado. En el comparador puedes verificar precio y plazo de cada proveedor y cambiar la recomendación automática.` : 'Prueba con el folio, material, estado o referencia de la solicitud.', cards, { href: 'CO.cotizaciones.html', label: 'Abrir cotizaciones' });
        return selected.length ? `${headline} El listado contiene ${materialCount} materiales.` : headline;
    }

    async function answerPurchasing(raw) {
        const norm = commandNormalize(raw);
        if (/cotiz|oferta|compar.*proveedor|precio.*plazo|plazo.*precio/.test(norm) || hasFuzzy(norm,['cotizacion','cotizaciones','comparar proveedores','precio y plazo'])) return answerQuotation(raw);
        if (/bajo.*min|agotad|reponer|reposicion/.test(norm) || hasFuzzy(norm,['bajo minimo','reponer material'])) return answerLowStock();
        if (/orden.*compra|\boc\b|requisicion|recepcion|recibid|por atender|no revisad|en revision/.test(norm) || hasFuzzy(norm,['orden de compra','requisicion','recepcion'])) return answerPurchase(raw);
        if (/quien.*vende|quién.*vende|que.*proveedor.*(vende|maneja|surt)|proveedor.*(material|producto|vende|maneja|surt)|donde.*(compro|comprar).*material|con quien.*compro/.test(norm)) {
            const rows = await loadData('coProviderMaterials');
            const tokens = searchTokens(raw, ['quien','quién','vende','venden','maneja','manejan','surte','surten','proveedor','proveedores','material','producto','productos','donde','compro','comprar','con']);
            const ranked = window.SkilledSearch?.rank
                ? window.SkilledSearch.rank(rows, tokens.join(' '), item => [item.materialCodigo,item.descripcion,item.marca,item.categoria,item.proveedorNombre,item.proveedorRfc])
                : rows.filter(item => matchesTokens([item.materialCodigo,item.descripcion,item.marca,item.categoria,item.proveedorNombre], tokens));
            const seen = new Set(), selected = ranked.filter(item => { const key=`${item.proveedorId}|${item.materialCodigo}`; if(seen.has(key))return false; seen.add(key); return true; }).slice(0,10);
            const cards = selected.map(item => ({ title: `${item.proveedorNombre || 'Proveedor'} · ${item.materialCodigo || 'Material'}`, detail: `${item.descripcion || 'Sin descripción'} · ${currency(item.precioUnitario)} ${item.moneda || 'MXN'} · ${formatNumber(item.plazoEntregaDias)} días`, actions: supplierContactActions(item, `Hola, te contacto de Skilled Proyectos Industriales para solicitar información de ${item.materialCodigo || item.descripcion || 'este material'}.`) }));
            setAnswer('Proveedor por material', selected.length ? `Encontré ${selected.length} opción${selected.length===1?'':'es'} de proveedor relacionadas con ese material.` : 'No encontré una relación proveedor-material con ese criterio.', selected.length ? 'Ordené las coincidencias por código, descripción, marca y proveedor. Puedes abrir WhatsApp o correo sin salir de Sky.' : 'Puedes completar el catálogo comercial desde Proveedores.', cards, { href:'CO.proveedores.html',label:'Abrir catálogo de proveedores' });
            return selected.length ? `Encontré ${selected.length} opciones de proveedor para ese material.` : 'No encontré proveedores vinculados a ese material.';
        }
        if (/proveedor|proveedores|rfc|contacto|whatsapp|correo|email|telefono/.test(norm) || hasFuzzy(norm,['proveedor','proveedores','whatsapp','correo'])) {
            const rows = await loadData('coSuppliers');
            const tokens = searchTokens(raw, ['proveedor','proveedores','busca','buscar','rfc','contacto','whatsapp','correo','email','telefono','teléfono','numero','número','mandar','enviar','mensaje','escribe','escribir','contacta']);
            const matches = window.SkilledSearch?.rank
                ? window.SkilledSearch.rank(rows, tokens.join(' '), item => [item.razon_social,item.nombre_comercial,item.contacto,item.email,item.telefono,item.whatsapp,item.rfc,item.categoria])
                : rows.filter(item => matchesTokens([item.razon_social,item.nombre_comercial,item.contacto,item.email,item.telefono,item.whatsapp,item.rfc,item.categoria], tokens));
            const wantsContact = /whatsapp|correo|email|telefono|contacta|mensaje|escribe|enviar|mandar/.test(norm);
            const cards = matches.slice(0, 8).map(item => ({ title: item.nombre_comercial || item.razon_social || 'Proveedor', detail: `${item.rfc || 'RFC pendiente'} · ${item.contacto || 'contacto pendiente'}${item.email ? ` · ${item.email}` : ''}${item.whatsapp || item.telefono ? ` · WA ${item.whatsapp || item.telefono}` : ''}`, actions: wantsContact ? supplierContactActions(item) : [] }));
            if(matches.length){conversationContext.supplier={id:matches[0].id,nombre:text(matches[0].nombre_comercial||matches[0].razon_social)};saveConversationContext();}
            setAnswer('Proveedores', matches.length ? `${matches.length} proveedor${matches.length === 1 ? '' : 'es'} coinciden con la consulta.` : 'No encontré un proveedor coincidente.', matches.length ? `${wantsContact?'Te preparé los canales de contacto disponibles. ':'La búsqueda considera razón social, nombre comercial, RFC, contacto, correo y WhatsApp.'}` : 'Prueba con razón social, nombre comercial, RFC, correo o teléfono.', cards, { href: 'CO.proveedores.html', label: 'Abrir proveedores' });
            return matches.length ? `Encontré ${matches.length} proveedores relacionados.${wantsContact?' Te dejé sus opciones de contacto preparadas.':''}` : 'No encontré ese proveedor.';
        }
        if (/servicio|servicios|luz|agua|internet|telefono|pago.*proxim|vence|vencimiento/.test(norm)) {
            const rows = await loadData('coServices');
            const due = rows.filter(item => item.estado === 'activo' && (daysFromToday(item.proximaFechaPago) ?? 9999) <= Math.max(30, number(item.anticipacionDias)));
            const tokens = searchTokens(raw, ['servicio', 'servicios', 'pago', 'proximo', 'proximos', 'proxima', 'proximas', 'pronto', 'vence', 'vencen', 'vencimiento']);
            const selected = tokens.length ? rows.filter(item => matchesTokens([item.nombre, item.tipo, item.proveedor, item.cuentaContrato, item.ubicacion], tokens)) : due;
            const cards = selected.slice(0, 7).map(item => ({ title: item.nombre || item.tipo || 'Servicio', detail: `${item.proveedor || 'sin proveedor'} · vence ${dateOnly(item.proximaFechaPago)} · ${currency(item.montoEstimado)}` }));
            setAnswer('Servicios', selected.length ? `${selected.length} servicio${selected.length === 1 ? '' : 's'} encontrado${selected.length === 1 ? '' : 's'}.` : 'No encontré servicios con ese criterio.', tokens.length ? 'Mostrando coincidencias de la consulta.' : 'Mostrando servicios dentro de su periodo próximo de pago.', cards, { href: 'CO.servicios.html', label: 'Abrir servicios' });
            return selected.length ? `Encontré ${selected.length} servicios. ${selected.slice(0, 3).map(item => `${item.nombre}, vence ${dateOnly(item.proximaFechaPago)}`).join('. ')}` : 'No encontré servicios con ese criterio.';
        }
        if (/proyecto|proyectos|avance.*proyecto|estado.*proyecto|costo.*proyecto/.test(norm) || hasFuzzy(norm,['proyecto','proyectos'])) return answerProjects(raw);
        if (/tienda|sams|aurrera|compra general|compras generales/.test(norm)) {
            const rows = await loadData('coStore');
            const pending = rows.filter(item => !['comprado', 'cancelado'].includes(normalize(item.estado)));
            const cards = pending.slice(0, 7).map(item => ({ title: item.producto || 'Compra', detail: `${item.negocio || 'negocio pendiente'} · ${formatNumber(item.cantidad)} ${item.unidad || ''} · ${currency(item.costoEstimado)}` }));
            setAnswer('Compras de tienda', pending.length ? `${pending.length} solicitud${pending.length === 1 ? '' : 'es'} de tienda siguen pendientes.` : 'No hay compras de tienda pendientes.', '', cards, { href: 'CO.tienda.html', label: 'Abrir tienda' });
            return pending.length ? `Hay ${pending.length} compras de tienda pendientes.` : 'No hay compras de tienda pendientes.';
        }
        const [quotes, orders, suppliers, services, store] = await Promise.all([loadData('coQuotations'), loadData('purchases'), loadData('coSuppliers'), loadData('coServices'), loadData('coStore')]);
        const quoteOpen = quotes.filter(item => ['solicitada','en_revision','cotizando'].includes(normalize(item.estado))).length;
        const groups = new Set(orders.filter(item => !['compra_realizada', 'recibida', 'cerrada', 'cancelada', 'rechazada'].includes(normalize(item.estadoCompras || item.estado))).map(item => text(item.ordenCompra || item.grupoOrden || item.folio)).filter(Boolean));
        const due = services.filter(item => item.estado === 'activo' && (daysFromToday(item.proximaFechaPago) ?? 9999) <= Math.max(30, number(item.anticipacionDias))).length;
        const storePending = store.filter(item => !['comprado', 'cancelado'].includes(normalize(item.estado))).length;
        const cards = [
            { title: 'Cotizaciones por revisar', detail: `${quoteOpen}` },
            { title: 'Órdenes por atender', detail: `${groups.size}` },
            { title: 'Proveedores', detail: `${suppliers.length}` },
            { title: 'Servicios próximos', detail: `${due}` },
            { title: 'Compras de tienda pendientes', detail: `${storePending}` }
        ];
        setAnswer('Resumen de Compras', `Hay ${quoteOpen} cotizaciones por revisar, ${groups.size} órdenes por atender, ${due} servicios próximos y ${storePending} compras de tienda pendientes.`, 'Puedes preguntarme por una cotización, material a cotizar, OC, proveedor, precio, plazo, servicio o compra específica.', cards, { href: 'CO.inicio.html', label: 'Abrir Compras' });
        return `En Compras hay ${quoteOpen} cotizaciones por revisar, ${groups.size} órdenes por atender, ${due} servicios próximos y ${storePending} compras de tienda pendientes.`;
    }

    function officeAssetIntent(raw) {
        const norm=commandNormalize(raw);
        if (/equipo.*proyecto|equipo.*trabajo|cuadrilla/.test(norm)) return false;
        return /\bequipo\b|equipo.*comput|computadora|computadoras|laptop|laptops|monitor|monitores|mouse|raton|ratón|teclado|teclados|base.*enfri|cooler|dock|docking|audifono|audífono|headset|cargador|periferico|periférico|accesorio|mobiliario|material.*oficina|activo.*oficina|resguardo|resguardos|que tiene asignado|qué tiene asignado|que le asignaron|qué le asignaron/.test(norm);
    }

    function officeAssetCards(data, limit=8) {
        return data.slice(0,limit).map(item=>({title:`${item.activoCodigo||item.codigo||'Activo'} · ${item.activoNombre||item.nombre||'Equipo'}`,detail:item.personalNombre?`${item.personalNombre} · ${formatNumber(item.cantidad||1)} ${item.unidad||'PIEZA'} · ${item.estado||'asignado'}`:`${item.categoria||'Sin categoría'} · disponible ${formatNumber(item.disponible||0)} ${item.unidad||'PIEZA'}`}));
    }

    async function answerRHOfficeAssets(raw, executive=false) {
        const norm=commandNormalize(raw),tokens=searchTokens(raw,['equipo','equipos','computo','cómputo','resguardo','resguardos','asignado','asignada','asignados','asignadas','tiene','tienen','que','qué','quien','quién','dame','muestra','buscar','busca']);
        let assets=[],assignments=[];
        if(executive){const payload=await loadData('executiveRHOfficeAssets');assets=Array.isArray(payload?.activos)?payload.activos:[];assignments=Array.isArray(payload?.asignaciones)?payload.asignaciones:[]}else{[assets,assignments]=await Promise.all([loadData('rhOfficeAssets'),loadData('rhOfficeAssignments')])}
        const activeAssignments=assignments.filter(x=>normalize(x.estado)==='asignado');
        const personQuery=/asignad|resguardo|tiene|entregaron|recibio|recibió|quien.*tiene|quién.*tiene/.test(norm);
        let matchesAssignments=activeAssignments;
        if(tokens.length) matchesAssignments=activeAssignments.filter(item=>matchesTokens([item.personalNumero,item.personalNombre,item.puesto,item.departamento,item.activoCodigo,item.activoNombre,item.categoria,item.marca,item.modelo,item.numeroSerie],tokens));
        if(personQuery&&matchesAssignments.length){
            const names=[...new Set(matchesAssignments.map(x=>x.personalNombre).filter(Boolean))];
            const owner=names.length===1?names[0]:'';
            const summary=owner?`${owner} tiene ${matchesAssignments.length} tipo${matchesAssignments.length===1?'':'s'} de equipo o material en resguardo.`:`Encontré ${matchesAssignments.length} resguardo${matchesAssignments.length===1?'':'s'} relacionado${matchesAssignments.length===1?'':'s'} con la consulta.`;
            setAnswer('Equipos y resguardos',summary,executive?'Consulta de solo lectura de RH.': 'El historial conserva devoluciones, daños y pérdidas.',officeAssetCards(matchesAssignments),executive?null:{href:'RH.equipos.html',label:'Abrir equipos y resguardos'});
            return owner?`${owner} tiene asignado: ${matchesAssignments.slice(0,7).map(x=>`${x.activoNombre} (${formatNumber(x.cantidad)} ${x.unidad||'PIEZA'})`).join(', ')}.`:summary;
        }
        let matchesAssets=assets;
        if(tokens.length) matchesAssets=assets.filter(item=>matchesTokens([item.codigo,item.nombre,item.categoria,item.marca,item.modelo,item.numeroSerie,item.ubicacion],tokens));
        if(/disponible|disponibles|libre|libres|sin asignar/.test(norm)) matchesAssets=matchesAssets.filter(x=>number(x.disponible)>0&&normalize(x.estado)==='activo');
        if(/cuanto|cuantos|cuanta|cuantas|disponible|disponibles|inventario/.test(norm)){
            const available=matchesAssets.reduce((sum,x)=>sum+number(x.disponible),0),assigned=matchesAssets.reduce((sum,x)=>sum+number(x.asignado||0),0);
            const msg=`${matchesAssets.length} activo${matchesAssets.length===1?'':'s'} coincide${matchesAssets.length===1?'':'n'}; ${formatNumber(available)} unidades están disponibles y ${formatNumber(assigned)} están en resguardo.`;
            setAnswer('Inventario de oficina',msg,executive?'Consulta de solo lectura de RH.':'Incluye equipos de cómputo, periféricos, accesorios y materiales controlados por RH.',officeAssetCards(matchesAssets),executive?null:{href:'RH.equipos.html',label:'Abrir inventario de oficina'});return msg;
        }
        const msg=matchesAssets.length?`Encontré ${matchesAssets.length} activo${matchesAssets.length===1?'':'s'} relacionado${matchesAssets.length===1?'':'s'} con la consulta.`:'No encontré equipos o resguardos con ese criterio.';
        setAnswer('Equipos y resguardos',msg,executive?'Consulta de solo lectura de RH.':'Puedes preguntarme qué tiene asignado una persona, quién tiene un equipo o qué está disponible.',officeAssetCards(matchesAssets.length?matchesAssets:matchesAssignments),executive?null:{href:'RH.equipos.html',label:'Abrir equipos y resguardos'});return msg;
    }

    function attendanceIntent(raw) {
        const norm=commandNormalize(raw);
        return /checador|checada|checadas|checad[oa]|chec[oó]|hora.*trabaj|horas.*trabaj|horas.*semana|horas.*acumul|50\s*horas|cincuenta\s*horas|entrada.*salida|salida.*entrada|falta.*salida|sin.*salida|falta.*entrada|sin.*entrada|registro.*hora|dias.*trabaj|días.*trabaj|no.*ha.*checad|faltan.*checar|sin.*checar|sigue.*dentro|siguen.*dentro|est[aá].*dentro/.test(norm);
    }

    function skyMxToday() {
        const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),get=t=>parts.find(x=>x.type===t)?.value||'';
        return `${get('year')}-${get('month')}-${get('day')}`;
    }

    function skyShiftDate(value,days) {
        const [y,m,d]=String(value).slice(0,10).split('-').map(Number),date=new Date(Date.UTC(y,m-1,d+days));
        return date.toISOString().slice(0,10);
    }

    function skyPayrollRange(offsetWeeks=0) {
        const today=skyMxToday(),date=new Date(`${today}T12:00:00Z`),delta=(date.getUTCDay()-2+7)%7,start=skyShiftDate(today,-delta+offsetWeeks*7);
        return {start,end:skyShiftDate(start,6)};
    }

    function skyAttendanceWindow(raw) {
        const norm=commandNormalize(raw),today=skyMxToday();
        if(/\bayer\b/.test(norm)){const day=skyShiftDate(today,-1);return{start:day,end:day,label:'ayer'}}
        if(/semana pasada|semana anterior/.test(norm)){const range=skyPayrollRange(-1);return{...range,label:'la semana pasada'}}
        if(/ultimos 7 dias|últimos 7 días|ultimos siete dias|últimos siete días/.test(norm))return{start:skyShiftDate(today,-6),end:today,label:'los últimos 7 días'};
        if(/\bhoy\b/.test(norm))return{start:today,end:today,label:'hoy'};
        const range=skyPayrollRange(0);return{...range,label:'esta semana'};
    }

    function skyAttendanceTime(value) {
        if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit',hour12:false});
    }

    function skyAttendanceHours(value) {
        const mins=Math.max(0,Math.round(number(value)*60)),hours=Math.floor(mins/60),rest=mins%60;
        return `${hours} h${rest?` ${rest} min`:''}`;
    }

    async function answerAttendance(raw,executive=false) {
        const norm=commandNormalize(raw),rows=await loadData('rhAttendance'),windowRange=skyAttendanceWindow(raw),inWindow=(rows||[]).filter(item=>text(item.fecha)>=windowRange.start&&text(item.fecha)<=windowRange.end);
        const ignore=['checador','checada','checadas','checo','checó','hora','horas','trabajada','trabajadas','trabajado','trabajados','trabajo','semana','pasada','anterior','esta','este','hoy','ayer','dia','dias','día','días','entrada','salida','registro','registros','falta','sin','quien','quién','cuanto','cuántas','cuantas','cuantos','cuántos','lleva','llevan','muestra','muéstrame','dime','ver','de','del','la','el','en','cada','trabajador','trabajadores','personal','empleado','empleados','colaborador','colaboradores'];
        const tokens=searchTokens(raw,ignore),peopleMap=new Map();
        inWindow.forEach(item=>{if(!peopleMap.has(Number(item.personal_id)))peopleMap.set(Number(item.personal_id),item)});
        let people=[...peopleMap.values()];
        if(tokens.length)people=people.filter(item=>matchesTokens([item.numero_empleado,item.nombre,item.apellidos,item.nombre_completo,item.puesto,item.departamento,item.turno],tokens));
        const selectedIds=new Set(people.map(item=>Number(item.personal_id))),selectedRows=tokens.length?inWindow.filter(item=>selectedIds.has(Number(item.personal_id))):inWindow;
        const action=executive?null:{href:'RH.nomina.html#attendance-week',label:'Ver días y horas'};
        if(/no.*ha.*checad|no.*han.*checad|faltan.*por.*checar|faltan.*checar|sin.*checar|sin.*checada/.test(norm)&&!/entrada|salida/.test(norm)){
            const allPeople=await loadData('rhPeople'),activePeople=(allPeople||[]).filter(item=>!['baja','inactivo','inactiva'].includes(normalize(item.estado))),punchedIds=new Set(inWindow.map(item=>Number(item.personal_id))),missing=activePeople.filter(item=>!punchedIds.has(Number(item.id)));
            const cards=missing.slice(0,12).map(item=>({title:`${item.nombre||''} ${item.apellidos||''}`.trim()||item.numero_empleado||'Colaborador',detail:`${item.numero_empleado||'Sin número'} · ${item.turno||'Sin turno'} · sin checadas en ${windowRange.label}`}));
            const msg=missing.length?`${missing.length} trabajador${missing.length===1?'':'es'} no tiene${missing.length===1?'':'n'} checadas registradas en ${windowRange.label}.`:`Todo el personal activo tiene al menos una checada registrada en ${windowRange.label}.`;
            setAnswer('Personal sin checada',msg,`Periodo: ${dateOnly(windowRange.start)} a ${dateOnly(windowRange.end)}.`,cards,action);return msg;
        }
        if(/sigue.*dentro|siguen.*dentro|est[aá].*dentro|est[aá]n.*dentro|no.*ha.*salido|no.*han.*salido/.test(norm)){
            const inside=selectedRows.filter(item=>item.entrada&&!item.salida),cards=inside.slice(0,12).map(item=>({title:`${item.nombre||''} ${item.apellidos||''}`.trim()||item.numero_empleado||'Colaborador',detail:`${dateOnly(item.fecha)} · entrada ${skyAttendanceTime(item.entrada)} · salida pendiente`}));
            const msg=inside.length?`${inside.length} trabajador${inside.length===1?'':'es'} aparece${inside.length===1?'':'n'} con entrada y sin salida en ${windowRange.label}.`:`No hay trabajadores con entrada y salida pendiente en ${windowRange.label}.`;
            setAnswer('Personal con salida pendiente',msg,'Sky usa únicamente las checadas sincronizadas; una salida todavía guardada offline aparecerá cuando el checador la sincronice.',cards,action);return msg;
        }
        if(!selectedRows.length){
            const msg=tokens.length?'No encontré checadas de ese trabajador en el periodo solicitado.':'No hay checadas sincronizadas en el periodo solicitado.';
            setAnswer('Checador RH',msg,`Periodo consultado: ${dateOnly(windowRange.start)} a ${dateOnly(windowRange.end)}.`,[],action);return msg;
        }
        if(/incomplet|falta.*salida|sin.*salida|no.*checad.*salida|no.*chec[oó].*salida|falta.*entrada|sin.*entrada/.test(norm)){
            const wantsExit=/salida/.test(norm),wantsEntry=/entrada/.test(norm),incomplete=selectedRows.filter(item=>{const bad=item.incompleta===true||String(item.incompleta)==='true';if(!bad)return false;if(wantsExit&&!wantsEntry)return Boolean(item.entrada&&!item.salida)||text(item.faltante)==='salida';if(wantsEntry&&!wantsExit)return Boolean(item.salida&&!item.entrada)||text(item.faltante)==='entrada';return true});
            const cards=incomplete.slice(0,10).map(item=>({title:`${item.nombre||''} ${item.apellidos||''}`.trim()||item.numero_empleado||'Colaborador',detail:`${dateOnly(item.fecha)} · ${item.entrada?`entrada ${skyAttendanceTime(item.entrada)}`:'sin entrada'} · ${item.salida?`salida ${skyAttendanceTime(item.salida)}`:'sin salida'}`}));
            const msg=incomplete.length?`${incomplete.length} registro${incomplete.length===1?'':'s'} incompleto${incomplete.length===1?'':'s'} en ${windowRange.label}.`:`No hay checadas incompletas en ${windowRange.label}.`;
            setAnswer('Checadas incompletas',msg,'Sky marca como incompleto un día que tiene entrada sin salida o salida sin entrada.',cards,action);return msg;
        }
        if(/50\s*horas|cincuenta\s*horas|complet.*50|falt.*50/.test(norm)){
            const grouped50=new Map();selectedRows.forEach(item=>{const id=Number(item.personal_id),g=grouped50.get(id)||{name:`${item.nombre||''} ${item.apellidos||''}`.trim()||item.numero_empleado||'Colaborador',scheme:normalize(item.esquema_pago),hours:0};g.hours+=number(item.horas);grouped50.set(id,g)});
            let summary50=[...grouped50.values()];if(/complet|super|alcanz|ya.*50/.test(norm))summary50=summary50.filter(item=>item.hours>=50);else if(/falta|resta|pendiente/.test(norm))summary50=summary50.filter(item=>item.hours<50);
            summary50.sort((a,b)=>b.hours-a.hours||a.name.localeCompare(b.name,'es'));
            const cards=summary50.slice(0,12).map(item=>({title:item.name,detail:item.hours>=50?`${skyAttendanceHours(item.hours)} · meta de 50 h alcanzada`:`${skyAttendanceHours(item.hours)} · faltan ${skyAttendanceHours(50-item.hours)} para 50 h`}));
            const msg=summary50.length?`Encontré ${summary50.length} trabajador${summary50.length===1?'':'es'} para la comparación de 50 horas en ${windowRange.label}.`:'No encontré trabajadores que coincidan con esa condición de 50 horas en el periodo consultado.';
            setAnswer('Seguimiento de 50 horas',msg,'Es una referencia de horas brutas del checador. La nómina final conserva las reglas del esquema de pago y sus validaciones.',cards,action);return msg;
        }
        if(people.length===1){
            const person=people[0],personRows=selectedRows.filter(item=>Number(item.personal_id)===Number(person.personal_id)).sort((a,b)=>text(a.fecha).localeCompare(text(b.fecha))),hours=personRows.reduce((sum,item)=>sum+number(item.horas),0),complete=personRows.filter(item=>!(item.incompleta===true||String(item.incompleta)==='true')).length,incomplete=personRows.length-complete;
            const cards=personRows.map(item=>({title:`${dateOnly(item.fecha)} · ${skyAttendanceHours(item.horas)}`,detail:`Entrada ${skyAttendanceTime(item.entrada)} · Salida ${skyAttendanceTime(item.salida)}${item.incompleta?` · falta ${item.faltante||'checada'}`:''}`}));
            const name=`${person.nombre||''} ${person.apellidos||''}`.trim()||person.numero_empleado||'El colaborador',msg=`${name} acumula ${skyAttendanceHours(hours)} en ${windowRange.label}, con ${complete} día${complete===1?'':'s'} completo${complete===1?'':'s'}${incomplete?` y ${incomplete} incompleto${incomplete===1?'':'s'}`:''}.`;
            setAnswer('Horas del checador',msg,`Periodo: ${dateOnly(windowRange.start)} a ${dateOnly(windowRange.end)}. Estas son horas brutas entre entrada y salida; Nómina aplica después las reglas del esquema de pago.`,cards,action);return msg;
        }
        const grouped=new Map();selectedRows.forEach(item=>{const id=Number(item.personal_id),g=grouped.get(id)||{name:`${item.nombre||''} ${item.apellidos||''}`.trim()||item.numero_empleado||'Colaborador',number:item.numero_empleado||'',hours:0,days:0,incomplete:0};g.hours+=number(item.horas);if(item.incompleta===true||String(item.incompleta)==='true')g.incomplete++;else g.days++;grouped.set(id,g)});
        const summary=[...grouped.values()].sort((a,b)=>b.hours-a.hours||a.name.localeCompare(b.name,'es'));
        const totalHours=summary.reduce((sum,item)=>sum+item.hours,0),totalIncomplete=summary.reduce((sum,item)=>sum+item.incomplete,0);
        const cards=summary.slice(0,10).map(item=>({title:item.name,detail:`${skyAttendanceHours(item.hours)} · ${item.days} día${item.days===1?'':'s'} completo${item.days===1?'':'s'}${item.incomplete?` · ${item.incomplete} incompleto${item.incomplete===1?'':'s'}`:''}`}));
        const msg=`${summary.length} trabajador${summary.length===1?'':'es'} tienen checadas en ${windowRange.label}; acumulan ${skyAttendanceHours(totalHours)}${totalIncomplete?` y hay ${totalIncomplete} registro${totalIncomplete===1?'':'s'} incompleto${totalIncomplete===1?'':'s'}`:''}.`;
        setAnswer('Resumen del checador',msg,`Periodo: ${dateOnly(windowRange.start)} a ${dateOnly(windowRange.end)}. Puedes preguntarme por una persona, por hoy, ayer, esta semana o por checadas sin salida.`,cards,action);return msg;
    }

    async function answerRH(raw) {
        const norm = commandNormalize(raw);
        if (/vehiculo|vehiculos|camioneta|pickup|automovil|van\b|camion\b|montacargas/.test(norm) || hasFuzzy(norm,['vehiculo','vehiculos'])) return answerVehicles(raw);
        if (officeAssetIntent(raw)) return answerRHOfficeAssets(raw,false);
        if (attendanceIntent(raw)) return answerAttendance(raw,false);
        if (/nomina|nómina|recibo de pago|comprobante de pago|pago semanal|whatsapp.*nomina|nomina.*whatsapp/.test(norm)) {
            const { data: periods, error } = await db.client.from('rh_nomina_periodos').select('id,nombre,fecha_inicio,fecha_fin,estado').order('fecha_inicio',{ascending:false}).limit(6);
            if (error) { setAnswer('Nómina', 'El módulo de nómina todavía no está disponible en la base de datos.', 'Ejecuta SQL_MAESTRO_CRM.sql V24 para activarlo.', [], {href:'RH.nomina.html',label:'Abrir nómina'}); return 'El módulo de nómina necesita la actualización V24.'; }
            const rows=periods||[];const latest=rows[0];
            setAnswer('Nómina de RH', latest?`El periodo más reciente es ${latest.nombre}.`:'Todavía no hay periodos de nómina generados.', latest?`Estado: ${latest.estado}. Del ${dateOnly(latest.fecha_inicio)} al ${dateOnly(latest.fecha_fin)}.`:'Puedes generar el primer periodo desde Nómina.', rows.map(x=>({title:x.nombre,detail:`${x.estado} · ${dateOnly(x.fecha_inicio)} a ${dateOnly(x.fecha_fin)}`})), {href:'RH.nomina.html',label:'Abrir nómina'});
            return latest?`El periodo de nómina más reciente es ${latest.nombre}, con estado ${latest.estado}.`:'Todavía no hay periodos de nómina.';
        }
        const [people, assignments, incidents, documents, trainings] = await Promise.all([loadData('rhPeople'), loadData('rhAssignments'), loadData('rhIncidents'), loadData('rhDocuments'), loadData('rhTrainings')]);
        const today = new Date().toISOString().slice(0, 10);
        if (/ausent|vacacion|incapacidad|permiso|retardo|incidencia|asistencia/.test(norm)) {
            const current = incidents.filter(item => text(item.fecha_inicio) <= today && text(item.fecha_fin || item.fecha_inicio) >= today && !['rechazado', 'cancelado'].includes(normalize(item.estado)));
            const cards = current.slice(0, 7).map(item => {
                const person = people.find(row => Number(row.id) === Number(item.personal_id));
                return { title: person ? `${person.nombre} ${person.apellidos}` : `Personal ${item.personal_id}`, detail: `${item.tipo || 'incidencia'} · ${dateOnly(item.fecha_inicio)}${item.fecha_fin && item.fecha_fin !== item.fecha_inicio ? ` a ${dateOnly(item.fecha_fin)}` : ''}` };
            });
            setAnswer('Asistencias e incidencias', current.length ? `${current.length} incidencia${current.length === 1 ? '' : 's'} activa${current.length === 1 ? '' : 's'} hoy.` : 'No hay incidencias activas registradas para hoy.', '', cards, { href: 'RH.asistencias.html', label: 'Abrir asistencias' });
            return current.length ? `Hay ${current.length} incidencias activas hoy.` : 'No hay incidencias activas hoy.';
        }
        if (/document|credencial|licencia|certific|vence|vencen|vencimiento|contrato/.test(norm)) {
            const in60 = documents.filter(item => { const days = daysFromToday(item.fecha_vencimiento); return days != null && days >= 0 && days <= 60; });
            const contracts = people.filter(item => { const days = daysFromToday(item.fecha_fin_contrato); return days != null && days >= 0 && days <= 60; });
            const cards = [
                ...in60.slice(0, 5).map(item => ({ title: item.nombre || item.tipo || 'Documento', detail: `${item.personal?.nombre || ''} ${item.personal?.apellidos || ''} · vence ${dateOnly(item.fecha_vencimiento)}` })),
                ...contracts.slice(0, Math.max(0, 7 - Math.min(5, in60.length))).map(item => ({ title: `${item.nombre} ${item.apellidos}`, detail: `${item.tipo_contrato || 'Contrato'} · termina ${dateOnly(item.fecha_fin_contrato)}` }))
            ];
            setAnswer('Vencimientos de RH', `${in60.length} documentos y ${contracts.length} contratos vencen en los próximos 60 días.`, '', cards, { href: 'RH.documentos.html', label: 'Abrir documentos' });
            return `En los próximos sesenta días vencen ${in60.length} documentos y ${contracts.length} contratos.`;
        }
        if (/capacit|curso|entrenamiento/.test(norm)) {
            const open = trainings.filter(item => ['programada', 'en_curso'].includes(normalize(item.estado)));
            const cards = open.slice(0, 7).map(item => ({ title: item.nombre || 'Capacitación', detail: `${item.estado || 'programada'} · ${dateOnly(item.fecha_inicio)} a ${dateOnly(item.fecha_fin)}` }));
            setAnswer('Capacitación', open.length ? `${open.length} capacitación${open.length === 1 ? '' : 'es'} programada${open.length === 1 ? '' : 's'} o en curso.` : 'No hay capacitaciones abiertas.', '', cards, { href: 'RH.capacitacion.html', label: 'Abrir capacitación' });
            return open.length ? `Hay ${open.length} capacitaciones abiertas.` : 'No hay capacitaciones abiertas.';
        }
        if (/proyecto|proyectos|personal asignado|sin personal|equipo.*proyecto|cuadrilla/.test(norm)) {
            const projects = await loadData('projectDetails');
            const activeAssignments = new Set(assignments.filter(item => normalize(item.estado) === 'activo').map(item => text(item.proyecto_numero)));
            const without = projects.filter(item => !['finalizado', 'cerrado', 'cancelado', 'inactivo'].includes(normalize(item.estado)) && !activeAssignments.has(text(item.proyecto))).slice(0, 7);
            const cards = without.map(item => ({ title: `${item.proyecto} · ${item.nombreProyecto || 'Proyecto'}`, detail: `${item.cliente || 'sin cliente'} · entrega ${dateOnly(item.fechaEntrega)}` }));
            setAnswer('Proyectos y personal', without.length ? `${without.length} proyecto${without.length === 1 ? '' : 's'} activo${without.length === 1 ? '' : 's'} no tienen personal activo asignado.` : 'Todos los proyectos activos tienen personal asignado.', '', cards, { href: 'RH.proyectos.html', label: 'Abrir asignaciones' });
            return without.length ? `Hay ${without.length} proyectos activos sin personal asignado.` : 'Todos los proyectos activos tienen personal asignado.';
        }
        const tokens = searchTokens(raw, ['trabajador', 'trabajadores', 'colaborador', 'colaboradores', 'empleado', 'empleados', 'personal', 'activo', 'activos', 'busca', 'buscar']);
        if (tokens.length) {
            const matches = people.filter(item => matchesTokens([item.numero_empleado, item.nombre, item.apellidos, item.puesto, item.departamento, item.telefono, item.correo], tokens));
            const cards = matches.slice(0, 7).map(item => ({ title: `${item.nombre} ${item.apellidos}`, detail: `${item.numero_empleado || 'sin número'} · ${item.puesto || 'sin puesto'} · ${item.departamento || 'sin departamento'} · ${item.estado || 'sin estado'}` }));
            setAnswer('Personal', matches.length ? `${matches.length} colaborador${matches.length === 1 ? '' : 'es'} coinciden con la búsqueda.` : 'No encontré personal con ese criterio.', '', cards, { href: 'RH.personal.html', label: 'Abrir personal' });
            return matches.length ? `Encontré ${matches.length} colaboradores relacionados.` : 'No encontré ese colaborador.';
        }
        const active = people.filter(item => normalize(item.estado) === 'activo').length;
        const absent = incidents.filter(item => text(item.fecha_inicio) <= today && text(item.fecha_fin || item.fecha_inicio) >= today && ['permiso', 'vacaciones', 'incapacidad'].includes(normalize(item.tipo)) && !['rechazado', 'cancelado'].includes(normalize(item.estado))).length;
        setAnswer('Resumen de RH', `${active} trabajadores activos y ${absent} ausencias vigentes hoy.`, 'Puedes preguntar por una persona, proyecto, incidencia, documento, contrato o capacitación.', [{ title: 'Personal activo', detail: `${active}` }, { title: 'Ausencias hoy', detail: `${absent}` }, { title: 'Capacitaciones abiertas', detail: `${trainings.filter(item => ['programada', 'en_curso'].includes(normalize(item.estado))).length}` }], { href: 'RH.inicio.html', label: 'Abrir RH' });
        return `Recursos Humanos tiene ${active} trabajadores activos y ${absent} ausencias vigentes hoy.`;
    }

    async function answerFinance(raw) {
        const projects = await loadData('projectDetails');
        const norm = commandNormalize(raw);
        if (/que puede|ayuda|funciones|consultar/.test(norm) && !/proyecto/.test(norm)) {
            setAnswer('Sky en Finanzas', 'Puedo consultar presupuestos y costos reales de los proyectos que ya están conectados al CRM.', 'Los módulos de gastos, cuentas por pagar y reportes financieros todavía son estructura visual; Sky no inventará cifras que aún no estén conectadas a Supabase.', [{ title: 'Disponible ahora', detail: 'Presupuesto planeado, costo real, avance y costo fuera de plan por proyecto.' }, { title: 'Pendiente de conexión', detail: 'Gastos financieros, cuentas por pagar y conciliaciones.' }], { href: 'FI.inicio.html', label: 'Abrir Finanzas' });
            return 'En Finanzas puedo consultar presupuestos y costos reales por proyecto. Los demás módulos financieros todavía no tienen datos transaccionales conectados.';
        }
        if (/mayor|mas alto|más alto|top|costosos|costo/.test(norm) && !projectMatch(projects, raw)) {
            const top = [...projects].sort((a, b) => number(b.costoConsumido) - number(a.costoConsumido)).slice(0, 6);
            const cards = top.map(item => ({ title: `${item.proyecto} · ${item.nombreProyecto || 'Proyecto'}`, detail: `real ${currency(item.costoConsumido)} · planeado ${currency(item.costoPlaneado)} · ${formatNumber(item.avance)}%` }));
            setAnswer('Costos de proyectos', top.length ? `Estos son los ${top.length} proyectos con mayor costo real registrado.` : 'No hay costos de proyectos registrados.', 'El costo real se calcula con los movimientos vinculados al proyecto.', cards, { href: 'FI.presupuestos.html', label: 'Abrir presupuestos' });
            return top.length ? `El proyecto con mayor costo registrado es ${top[0].proyecto}, con ${currency(top[0].costoConsumido)}.` : 'No hay costos registrados.';
        }
        const project = projectMatch(projects, raw);
        if (!project) {
            setAnswer('Finanzas', 'No pude identificar un proyecto en la consulta.', 'Indica el número o nombre del proyecto. Por ahora Sky financiero trabaja con presupuestos y costos de proyectos.', [], { href: 'FI.presupuestos.html', label: 'Abrir presupuestos' });
            return 'No pude identificar el proyecto. Indica su número o nombre.';
        }
        const planned = number(project.costoPlaneado);
        const real = number(project.costoConsumido);
        const remaining = planned - real;
        const state = planned > 0 ? (remaining >= 0 ? `${currency(remaining)} disponibles respecto al planeado` : `${currency(Math.abs(remaining))} por encima del planeado`) : 'sin presupuesto/costo planeado registrado';
        const cards = [
            { title: 'Costo planeado', detail: currency(planned) },
            { title: 'Costo real', detail: currency(real) },
            { title: 'Avance', detail: `${formatNumber(project.avance)}%` },
            { title: 'Fuera del plan', detail: currency(project.costoFueraPlan) }
        ];
        setAnswer('Finanzas del proyecto', `${project.proyecto} · ${project.nombreProyecto || 'Proyecto'}: ${currency(real)} de costo real.`, `Resultado: ${state}.`, cards, { href: `AL.proyectos.html?perfil=finanzas&q=${encodeURIComponent(project.proyecto)}`, label: 'Abrir proyecto' });
        return `${project.proyecto}. El costo real es ${currency(real)} y el costo planeado es ${currency(planned)}. ${state}.`;
    }

    async function answerProjects(raw) {
        const norm = commandNormalize(raw);
        if (/prepar|picking|ruta/.test(norm)) return answerProjectRoute(raw);
        if (/solicitud|solicitudes|material pedido|material solicitado/.test(norm)) {
            let rows=[];
            let purchaseFallback=false;
            try {
                if (skyBridgeProfile(detectProfile())) throw new Error('usar consulta segura del perfil');
                rows=await SkilledDB.listMaterialRequests({});
            } catch (_) {
                purchaseFallback=true;
                rows=await loadData('purchases').catch(()=>[]);
            }
            const pending = rows.filter(item => !['entregado','rechazado','cancelado','cerrado','recibida','compra_realizada'].includes(normalize(item.estadoCompras || item.estado)));
            const cards = pending.slice(0, 7).map(item => ({ title: `${item.proyecto || item.folio || 'Solicitud'} · ${item.descripcion || item.materialDescripcion || item.materialCodigo || item.codigo || 'Material'}`, detail: `${formatNumber(item.cantidad || item.cantidadSolicitada)} ${item.unidad || ''} · ${item.estadoCompras || item.estado || 'pendiente'}` }));
            if(purchaseFallback){
                const message=pending.length?`${pending.length} solicitud${pending.length===1?'':'es'} de compra relacionada${pending.length===1?'':'s'} sigue${pending.length===1?'':'n'} abierta${pending.length===1?'':'s'}.`:'No encontré solicitudes de compra abiertas en la información autorizada para este perfil.';
                setAnswer('Solicitudes relacionadas',message,'En este perfil Sky usa la vista segura de solicitudes de compra; el detalle operativo de solicitudes de material permanece protegido.',cards);
                return message;
            }
            setAnswer('Solicitudes de material', pending.length ? `${pending.length} solicitud${pending.length === 1 ? '' : 'es'} siguen abiertas.` : 'No hay solicitudes abiertas.', '', cards, detectProfile()==='almacen'?{ href: 'AL.solicitudes-material.html', label: 'Abrir solicitudes' }:null);
            return pending.length ? `Hay ${pending.length} solicitudes de material abiertas.` : 'No hay solicitudes abiertas.';
        }
        const projects = await loadData('projectDetails');
        const project = projectMatch(projects, raw);
        if (!project) {
            const active = projects.filter(item => !['finalizado', 'cerrado', 'cancelado', 'inactivo'].includes(normalize(item.estado)));
            const profileParam = detectProfile() === 'compras' ? '?perfil=compras' : '';
            setAnswer('Proyectos', `${active.length} proyectos están activos actualmente.`, 'Indica un número o nombre para consultar avance, costo y fechas.', active.slice(0, 7).map(item => ({ title: `${item.proyecto} · ${item.nombreProyecto || 'Proyecto'}`, detail: `${item.estado || 'activo'} · avance ${formatNumber(item.avance)}% · entrega ${dateOnly(item.fechaEntrega)}` })), { href: `AL.proyectos.html${profileParam}`, label: 'Abrir proyectos' });
            return `Hay ${active.length} proyectos activos.`;
        }
        conversationContext.project = { proyecto: text(project.proyecto), nombre: text(project.nombreProyecto) };saveConversationContext();
        const cards = [
            { title: 'Estado', detail: project.estado || 'sin estado' },
            { title: 'Avance', detail: `${formatNumber(project.avance)}%` },
            { title: 'Costo real', detail: currency(project.costoConsumido) },
            { title: 'Entrega', detail: dateOnly(project.fechaEntrega) }
        ];
        const projectHref = detectProfile() === 'compras'
            ? `AL.proyectos.html?perfil=compras&q=${encodeURIComponent(project.proyecto)}`
            : `AL.proyectos.html?q=${encodeURIComponent(project.proyecto)}`;
        setAnswer('Proyecto', `${project.proyecto} · ${project.nombreProyecto || 'Proyecto'}`, `${project.cliente || 'Sin cliente'} · ${project.responsableSkilled || 'Responsable pendiente'}`, cards, { href: projectHref, label: 'Abrir proyecto' });
        return `${project.proyecto}, ${project.nombreProyecto || 'proyecto'}. Estado ${project.estado || 'sin estado'}, avance ${formatNumber(project.avance)} por ciento y costo real ${currency(project.costoConsumido)}.`;
    }

    function localDateParts() {
        const now = new Date();
        const dateLong = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const weekday = now.toLocaleDateString('es-MX', { weekday: 'long' });
        const month = now.toLocaleDateString('es-MX', { month: 'long' });
        const time = now.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
        return { now, dateLong, weekday, month, time, year: now.getFullYear() };
    }
    function capitalize(value) { const raw=text(value); return raw ? raw.charAt(0).toUpperCase()+raw.slice(1) : raw; }
    function simpleMath(raw) {
        let norm = commandNormalize(raw).replace(/\bcuanto es\b/g,'').replace(/\bcalcula\b/g,'').replace(/\bresultado de\b/g,'').trim();
        norm = norm.replace(/\bmas\b/g,'+').replace(/\bmenos\b/g,'-').replace(/\bpor\b/g,'*').replace(/\bentre\b/g,'/');
        const match = norm.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/);
        if (!match) return null;
        const a=Number(match[1]), b=Number(match[3]), op=match[2];
        if (op==='/' && b===0) return { error:'No se puede dividir entre cero.' };
        const result = op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:a/b;
        return { a,b,op,result };
    }

    const skyAreaCatalog = {
        administracion: {
            label:'Administración',
            aliases:['administracion','administración','administrador','administradora','admin'],
            intro:'Si eres de Administración, puedo ayudarte a revisar información transversal autorizada, ubicar responsables y coordinar avisos o reuniones sin recorrer cada módulo manualmente.',
            abilities:[
                ['Operación','Relacionar proyectos, materiales, personal, compras, proveedores y vehículos autorizados.'],
                ['Prioridades','Ayudar a identificar pendientes y ordenar la información que requiere seguimiento.'],
                ['Personas y áreas','Localizar colaboradores o áreas activas dentro del CRM.'],
                ['Chat interno','Enviar mensajes a una persona, un área o al canal General con una instrucción explícita.'],
                ['Reuniones','Generar y publicar convocatorias cuando indicas destino y hora.']
            ],
            examples:['¿Qué requiere atención hoy?','Dile a Compras que revise la orden pendiente','Genera una reunión general a las 4 para revisar pendientes']
        },
        proyectos: {
            label:'Proyectos',
            aliases:['proyectos','proyecto','project manager','lider de proyecto','líder de proyecto'],
            intro:'Si eres de Proyectos, puedo ayudarte a reunir estado, responsables, materiales, personal, compras y logística para reducir búsquedas entre módulos.',
            abilities:[
                ['Estado y avance','Consultar estado, avance y fechas registradas del proyecto.'],
                ['Materiales','Cruzar materiales planeados, existencias y datos autorizados relacionados.'],
                ['Personal','Consultar personas asignadas y responsables registrados.'],
                ['Coordinación','Enviar mensajes a áreas o personas sin salir de Sky.'],
                ['Reuniones','Convocar reuniones para un proyecto cuando me das destino, hora y motivo.']
            ],
            examples:['Dame un resumen del proyecto 26001','¿Cuántas personas tiene el proyecto 26001?','Convoca a Coordinación a las 4 para revisar el proyecto 26001']
        },
        planeacion: {
            label:'Planeación',
            aliases:['planeador','planeadora','planeacion','planeación'],
            intro:'Si eres de Planeación, por el momento puedo ayudarte a reunir información de proyectos y cruzarla con las áreas que ya están conectadas al CRM.',
            abilities:[
                ['Proyectos','Estado, avance, responsables y fechas de entrega registradas.'],
                ['Materiales','Material planeado, existencias, ubicaciones y solicitudes relacionadas.'],
                ['Personal','Personas asignadas a un proyecto y funciones registradas por RH.'],
                ['Compras','Pendientes, proveedores y cotizaciones vinculadas cuando la información está disponible.'],
                ['Logística','Vehículos disponibles y estado actual de la flotilla.'],
                ['Chat interno','Enviar avisos a personas o áreas y conservar el contexto de la conversación.'],
                ['Reuniones','Crear convocatorias cuando indicas destino, hora y motivo.']
            ],
            examples:['¿Cómo va el proyecto 26001?','¿Cuántas personas tiene el proyecto 26001?','¿Qué materiales tenemos para el proyecto 26001?']
        },
        finanzas: {
            label:'Finanzas',
            aliases:['finanzas','financiero','financiera','contabilidad'],
            intro:'Si eres de Finanzas, por el momento puedo ayudarte principalmente con la información económica de proyectos que ya está conectada al CRM.',
            abilities:[
                ['Presupuesto','Comparar lo planeado contra lo consumido por proyecto.'],
                ['Composición del gasto','Separar materiales y sueldos registrados.'],
                ['Desviaciones','Detectar proyectos por encima de lo planeado o que requieren atención.'],
                ['Fechas','Relacionar costo, avance y cercanía de la entrega.'],
                ['Crecimiento','Gastos y cuentas por pagar se ampliarán conforme esos módulos tengan más datos transaccionales conectados.'],
                ['Chat interno','Enviar un resumen o aviso a Dirección, Compras u otra persona autorizada.'],
                ['Reuniones','Convocar revisiones financieras con destino, hora y motivo.']
            ],
            examples:['¿Cómo va el presupuesto del proyecto 26001?','¿Qué proyecto tiene mayor gasto?','¿Qué proyectos están por encima de lo planeado?']
        },
        logistica: {
            label:'Logística',
            aliases:['logistica','logística','logistico','logística vehicular'],
            intro:'Si eres de Logística, puedo ayudarte a consultar la flotilla y relacionarla con la operación que ya está registrada.',
            abilities:[
                ['Vehículos','Disponibilidad, estado, nombre, placas, kilometraje y responsable registrado.'],
                ['Proyectos','Consultar el proyecto y su situación general antes de coordinar un movimiento.'],
                ['Personal','Revisar cuántas personas están asignadas a un proyecto.'],
                ['Materiales','Consultar existencias y ubicaciones para apoyar una preparación o traslado.'],
                ['Alertas','Identificar información operativa pendiente que pueda afectar una entrega.'],
                ['Chat interno','Avisar salidas, llegadas y necesidades a personas o áreas.'],
                ['Reuniones','Coordinar reuniones de operación o logística desde Sky.']
            ],
            examples:['¿Qué vehículos están disponibles?','¿Cómo está la camioneta Ford?','¿Cuántas personas van en el proyecto 26001?']
        },
        compras: {
            label:'Compras',
            aliases:['compras','comprador','compradora','abastecimiento'],
            intro:'Si eres de Compras, puedo ayudarte a consultar proveedores, cotizaciones y necesidades de compra sin tener que buscar dato por dato.',
            abilities:[
                ['Proveedores','Buscar quién vende un material y mostrar contacto, correo, teléfono o WhatsApp registrado.'],
                ['Cotizaciones','Consultar solicitudes y cotizaciones que requieren atención.'],
                ['Órdenes','Revisar órdenes y solicitudes de compra registradas.'],
                ['Materiales','Relacionar proveedor, precio referencial, plazo y material cuando existe esa relación.'],
                ['Comunicación','Ayudarte a localizar los datos necesarios para contactar al proveedor.'],
                ['Chat interno','Enviar avisos internos a Almacén, Recepción, Finanzas u otras áreas.'],
                ['Reuniones','Convocar revisiones de compra, proveedor o abastecimiento.']
            ],
            examples:['¿Quién vende tubo conduit?','Dame el WhatsApp y correo de ABB','¿Qué compras están pendientes?']
        },
        rh: {
            label:'Recursos Humanos',
            aliases:['recursos humanos','rh','rrhh','capital humano'],
            intro:'Si eres de Recursos Humanos, puedo ayudarte a consultar personal y varios controles que ya existen dentro de RH.',
            abilities:[
                ['Personal','Trabajadores activos, puesto, departamento y búsqueda de colaboradores.'],
                ['Proyectos','Personal asignado a proyectos y proyectos sin personal registrado.'],
                ['Asistencias','Días, entradas, salidas, horas acumuladas, checadas incompletas e incidencias registradas.'],
                ['Documentos','Vencimientos de documentos y contratos.'],
                ['Resguardos','Equipos de cómputo y materiales de oficina asignados a cada trabajador.'],
                ['Capacitación','Cursos programados o en curso.'],
                ['Chat interno','Enviar avisos a responsables, Coordinación u otras áreas.'],
                ['Nómina','Relacionar horas del checador con la revisión semanal y señalar casos que requieren intervención.'],
                ['Reuniones','Convocar reuniones internas cuando indicas destino, hora y motivo.']
            ],
            examples:['¿Cuántos trabajadores activos tenemos?','¿Qué equipo tiene asignado Leobardo?','¿Quién está ausente hoy?']
        },
        almacen: {
            label:'Almacén',
            aliases:['almacen','almacén','almacenista','inventario'],
            intro:'Si eres de Almacén, puedo ayudarte a encontrar materiales y responder consultas operativas con la información registrada.',
            abilities:[
                ['Materiales','Existencias, categorías, medidas, marcas y coincidencias por nombre o código.'],
                ['Ubicaciones','Almacén, ubicación específica, rack, zona o posición cuando está registrada.'],
                ['Mínimos','Materiales agotados o por debajo del mínimo.'],
                ['Cola operativa','Priorizar reposición, compras abiertas, materiales sin ubicación, devoluciones vencidas y vigencias sin saltarse validaciones.'],
                ['Herramientas','Disponibilidad y asignaciones registradas.'],
                ['Proyectos','Estado, materiales y solicitudes relacionadas.'],
                ['Vehículos','Disponibilidad y estado de la flotilla.'],
                ['Chat interno','Avisar a Compras, Proyectos u otra persona sobre faltantes o movimientos.'],
                ['Reuniones','Convocar revisiones de inventario, entrega o proyecto.']
            ],
            examples:['¿Cuánto tubo de una pulgada tenemos?','¿Dónde está el alcohol isopropílico?','¿Qué materiales están bajo mínimo?']
        },
        coordinacion: {
            label:'Coordinación',
            aliases:['coordinacion','coordinación','coordinador','coordinadora'],
            intro:'Si eres de Coordinación, puedo servirte como punto de consulta entre proyectos, personal, materiales, compras y logística.',
            abilities:[
                ['Proyectos','Estado, avance, responsables y entregas próximas.'],
                ['Personal','Cuadrillas o personas asignadas a un proyecto.'],
                ['Materiales','Existencias, ubicaciones y situación de materiales.'],
                ['Compras','Pendientes y proveedores relacionados.'],
                ['Vehículos','Disponibilidad para apoyar la operación.'],
                ['Chat interno','Coordinar avisos con Proyectos, Planeación, Logística, Compras o personas específicas.'],
                ['Reuniones','Generar convocatorias de coordinación desde una instrucción natural.']
            ],
            examples:['Dame un resumen del proyecto 26001','¿Cuántas personas tiene el proyecto 26001?','¿Qué requiere atención hoy?']
        },
        recepcion: {
            label:'Recepción',
            aliases:['recepcion','recepción','recepcionista','front desk','entrada principal','caseta','atencion a visitantes','atención a visitantes'],
            intro:'Si eres de Recepción, puedo ayudarte a orientar personas, localizar responsables, avisar llegadas, preparar mensajes internos y consultar información autorizada sin abrir varios apartados.',
            abilities:[
                ['Orientar visitantes','Identificar a qué área o responsable se debe canalizar una visita, proveedor o llamada.'],
                ['Avisos internos','Enviar mensajes por el chat a una persona, un área o el canal General cuando esté permitido.'],
                ['Reuniones','Generar y publicar convocatorias cuando la instrucción incluye destino y hora; si falta un dato, Sky pregunta solo lo necesario.'],
                ['Proyectos y responsables','Buscar proyectos, responsables, clientes y datos operativos autorizados.'],
                ['Proveedores','Consultar contactos, correos, WhatsApp y estados de atención disponibles.'],
                ['Vehículos','Consultar disponibilidad o estado cuando el perfil lo autoriza.']
            ],
            examples:['Soy de Recepción, ¿en qué me puedes ayudar?','Dile a Compras que llegó el proveedor ABB','Genera una reunión general a las 4 para revisar pendientes']
        },
        tsi: {
            label:'TSI',
            aliases:['tsi','sistemas','tecnologias de la informacion','tecnología de la información','soporte tecnico','soporte técnico'],
            intro:'Si eres de TSI, puedo ayudarte a explicar el CRM, orientar sobre sus apartados y apoyar consultas generales de la operación durante esta etapa de crecimiento.',
            abilities:[
                ['Orientación','Explicar para qué sirve cada área y cómo se relacionan los módulos.'],
                ['Consulta','Localizar información autorizada durante una revisión o demostración.'],
                ['Diagnóstico','Ayudar a describir una incidencia y ubicar el apartado involucrado.'],
                ['Búsqueda','Encontrar materiales, proyectos, personal, proveedores o vehículos cuando el modo de consulta lo autoriza.'],
                ['Crecimiento','Mis capacidades técnicas irán aumentando conforme se conecten más funciones de TSI.'],
                ['Chat interno','Enviar avisos internos para coordinar incidencias o soporte.'],
                ['Reuniones','Convocar revisiones técnicas con la persona o área indicada.']
            ],
            examples:['¿Qué puedes consultar del CRM?','Explícame cómo se relacionan Compras y Almacén','¿Qué puede hacer Sky por ahora?']
        },
        consulta: {
            label:'Consulta',
            aliases:['consulta','consultas','lector','lectura','solo lectura'],
            intro:'Si usas un perfil de Consulta, puedo ayudarte a localizar y relacionar información autorizada, mantener el contexto de tus preguntas y coordinar comunicación interna sin modificar registros operativos.',
            abilities:[
                ['Búsqueda contextual','Buscar proyectos, materiales, proveedores, vehículos u otros datos permitidos y continuar con preguntas relacionadas.'],
                ['Orientación','Explicar qué apartado contiene la información o qué área puede atender una solicitud.'],
                ['Chat interno','Enviar mensajes a una persona, área o canal General cuando lo pides explícitamente.'],
                ['Reuniones','Generar convocatorias por chat cuando indicas destino, hora y motivo.'],
                ['Seguridad','Mantener las acciones operativas de modificación fuera del perfil de solo consulta.']
            ],
            examples:['Busca el proyecto 26001 y dime quién es responsable','Dile a Recepción que ya llegué','Genera una reunión con Coordinación mañana a las 9 para revisar pendientes']
        },
        direccion: {
            label:'Dirección',
            aliases:['gerencia general','gerente general','gerente','subgerencia','subgerente','direccion','dirección','gerencia','director','directora'],
            intro:'Si eres de Dirección, puedo ayudarte con una vista transversal de la operación sin obligarte a entrar a cada módulo.',
            abilities:[
                ['Resumen ejecutivo','Solo excepciones: proyectos con riesgo, gasto real contra planeado, entregas próximas y cambios relevantes.'],
                ['Almacén','Faltantes, mínimos, ubicaciones, herramientas y señales que pueden frenar la operación.'],
                ['RH','Personal por proyecto, checador, horas, incidencias y resguardos cuando requieren seguimiento.'],
                ['Compras','Cotizaciones, precios, plazos y compras que pueden afectar una entrega.'],
                ['Vehículos','Disponibilidad y estado actual.'],
                ['Comunicación','Enviar mensajes internos a personas o áreas con una instrucción explícita.'],
                ['Cambios','Comparar la situación ejecutiva con la última revisión disponible en el tablero.'],
                ['Reuniones','Generar y publicar convocatorias cuando indicas destino, hora y motivo.']
            ],
            examples:['¿Qué requiere mi atención hoy?','¿Qué cambió desde la última revisión?','¿Qué compras pueden afectar entregas?']
        }
    };

    function areaPattern(alias) {
        const escaped=normalize(alias).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
        return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`);
    }

    function detectAreaMention(raw) {
        const norm=commandNormalize(raw);
        for(const [key,entry] of Object.entries(skyAreaCatalog)){
            if(entry.aliases.some(alias=>areaPattern(alias).test(norm)))return key;
        }
        return '';
    }

    function captureAreaContext(raw) {
        const norm=commandNormalize(raw);
        const declared=/\b(soy|trabajo|estoy|pertenezco|vengo|mi area|mi departamento|soy del area|soy de)\b/.test(norm);
        if(!declared)return '';
        const found=detectAreaMention(raw);
        if(found)conversationContext.area=found;
        return found;
    }

    function detectAreaHelp(raw) {
        const norm=commandNormalize(raw);
        const help=/\b(en que me (?:puedes )?ayudar|como me (?:puedes )?ayudar|que (?:me )?puedes ayudar|que puedes hacer (?:por|para) mi|que mas (?:me )?puedes (?:ayudar|hacer)|que mas haces|como me apoyas|en que me apoyas|que me ofreces)\b/.test(norm);
        const declared=/\b(soy|trabajo|estoy|pertenezco|vengo|mi area|mi departamento|soy del area|soy de)\b/.test(norm);
        const found=detectAreaMention(raw);
        const operational=/\b(cuanto|cuantos|cuanta|cuantas|donde|quien|quienes|cual|cuales|proyecto|material|stock|existencia|vehiculo|placas|proveedor|cotizacion|compra|presupuesto|gasto|costo|personal|trabajador|empleado|asistencia|documento|resguardo|herramienta|ubicacion|alerta|pendiente|orden)\b/.test(norm);
        if(found&&(help||(declared&&!operational)))return found;
        if(help&&conversationContext.area&&skyAreaCatalog[conversationContext.area])return conversationContext.area;
        return '';
    }

    function answerAreaHelp(raw) {
        const key=detectAreaHelp(raw);
        if(key){
            const entry=skyAreaCatalog[key];
            conversationContext.area=key;
            rememberConversation('area_help',entry.label,raw);
            const cards=entry.abilities.map(([title,detail])=>({title,detail}));
            const examples=entry.examples.map(example=>({title:'Prueba conmigo',detail:example}));
            const message=`Claro. ${entry.intro}`;
            setAnswer(`Sky para ${entry.label}`,message,'Estas son capacidades disponibles por el momento. Si un dato todavía no está conectado, te lo diré en vez de inventarlo.',[...cards,...examples].slice(0,9));
            return {handled:true,voice:`Claro. Si eres de ${entry.label}, ${entry.intro.replace(/^Si eres[^,]*,\s*/i,'')}`};
        }
        const norm=commandNormalize(raw);
        const help=/\b(en que me (?:puedes )?ayudar|como me (?:puedes )?ayudar|que puedes hacer (?:por|para) mi|como me apoyas|en que me apoyas|que me ofreces)\b/.test(norm);
        const declared=/\b(soy|trabajo|pertenezco|mi area|mi departamento|soy del area|soy de)\b/.test(norm);
        if(!help||!declared)return null;
        const cleaned=text(raw).replace(/^(?:oye\s+)?(?:sky|skai|skay)[,;:\s-]*/i,'').trim();
        const match=cleaned.match(/(?:soy\s+(?:del\s+area\s+|de\s+|del\s+)?|trabajo\s+en\s+|pertenezco\s+a\s+)([^,;.?¿!]{2,45})/i);
        const areaLabel=text(match?.[1]).replace(/\b(?:y|en)\s+que\s+me.*$/i,'').trim()||'tu área';
        const message=`Todavía no tengo una guía específica para ${areaLabel}, pero sí puedo ayudarte como punto de consulta del CRM: buscar información autorizada, relacionar datos entre áreas, explicar apartados y decirte con claridad qué funciones están disponibles hoy.`;
        setAnswer(`Sky para ${areaLabel}`,message,'Cuéntame una tarea real de tu área y trataré de resolverla con la información conectada. Si todavía no puedo hacerla, te explicaré qué falta para llegar a ello.',[
            {title:'Proyectos',detail:'Puedo consultar estados, responsables, fechas y datos relacionados cuando están disponibles.'},
            {title:'Materiales y activos',detail:'Puedo buscar existencias, ubicaciones, herramientas, vehículos y resguardos autorizados.'},
            {title:'Personas y proveedores',detail:'Puedo localizar información operativa autorizada de RH y Compras.'},
            {title:'Orientación',detail:'Puedo explicarte dónde se encuentra una función y cómo se relaciona con otras áreas.'}
        ]);
        return {handled:true,voice:message};
    }

    function answerPresentationPlaybook(raw) {
        const norm=commandNormalize(raw);
        const wantsDemo=/\b(como presento|cómo presento|presentar a sky|presentacion de sky|presentación de sky|guion de demo|guión de demo|exposicion|exposición|como hago la demo|cómo hago la demo|como demuestro sky|cómo demuestro sky)\b/.test(norm);
        if (wantsDemo) {
            const message='Para presentar a Sky, empieza mostrando que conversa, después demuestra que entiende áreas y termina con una consulta real del CRM. La clave es no explicar demasiado antes: deja que Sky responda.';
            setAnswer('Guía rápida para presentar a Sky',message,'Ruta recomendada de 5 a 7 minutos. Usa el usuario de demostración para que nadie pueda editar información.',[
                {title:'1 · Saludo',detail:'Pregunta: “Sky, ¿cómo estás?” para mostrar que responde de forma natural.'},
                {title:'2 · Identidad',detail:'Pregunta: “¿Quién te está creando?” para presentar el trabajo del ING. Leobardo Hernández Jerónimo.'},
                {title:'3 · Área',detail:'Pregunta: “Soy de Finanzas/Planeación/Logística, ¿en qué me ayudas?”'},
                {title:'4 · Consulta real',detail:'Pregunta por materiales, proyecto 26001, compras pendientes, vehículos o personal.'},
                {title:'5 · Seguimiento',detail:'Después de una respuesta pregunta: “¿y dónde está?” o “¿y cuánto queda?”'},
                {title:'6 · IA general',detail:'Pide que redacte un correo, resuma una situación o proponga pasos.'}
            ]);
            return {handled:true,voice:message};
        }
        if (/\b(quiero probarte|que te pregunto|qué te pregunto|preguntas para probar|modo demo|demo de sky|prueba de sky)\b/.test(norm)) {
            const message='Puedes probarme con preguntas de conversación, por área y con datos del CRM. Si algo aún no está conectado, te lo diré con claridad.';
            setAnswer('Preguntas para probar a Sky',message,'Estas preguntas funcionan bien para demostrar alcance sin dar permisos de edición.',[
                {title:'Conversación',detail:'Sky, ¿cómo estás hoy?'},
                {title:'Área',detail:'Soy de Logística, ¿en qué me puedes ayudar?'},
                {title:'Material',detail:'¿Cuántas pijas tengo? / ¿Dónde está el tubo conduit?'},
                {title:'Proyecto',detail:'¿Cuántas personas hay en el proyecto 26001?'},
                {title:'Compras',detail:'¿Qué compras están pendientes? / ¿Quién vende cable THW?'},
                {title:'Vehículos',detail:'¿Qué vehículos están disponibles?'},
                {title:'Redacción',detail:'Ayúdame a redactar un correo para pedir una cotización urgente.'}
            ]);
            return {handled:true,voice:message};
        }
        if (/\b(eres una ia|eres inteligencia artificial|como una ia normal|qué tan habil|que tan habil|qué tan hábil|que puedes resolver|puedes ayudar en todo|puedes hacer de todo)\b/.test(norm)) {
            const message='Soy una asistente en evolución dentro del CRM. Puedo conversar, explicar, redactar y razonar situaciones generales; cuando la pregunta requiere datos internos, consulto solo la información autorizada para tu perfil.';
            setAnswer('Sky como asistente inteligente',message,'Mi meta es acercarme cada vez más a una IA de trabajo normal, pero conectada al contexto real de Skilled y respetando permisos.',[
                {title:'Converso',detail:'Respondo saludos, explicaciones, dudas y solicitudes abiertas.'},
                {title:'Redacto',detail:'Puedo ayudarte con correos, mensajes, resúmenes y pasos de trabajo.'},
                {title:'Consulto CRM',detail:'Materiales, proyectos, RH, compras, vehículos y más, según permisos.'},
                {title:'No invento datos',detail:'Si un dato no está conectado, lo aclaro y propongo cómo obtenerlo.'}
            ]);
            return {handled:true,voice:message};
        }
        return null;
    }

    function creatorIdentityIntent(raw) {
        const norm = commandNormalize(raw);
        const exactName = /^(?:el\s+)?(?:ing(?:eniero)?\s+)?(?:leo|leobardo|leobardo\s+hernandez(?:\s+jeronimo)?|hernandez\s+jeronimo)$/i.test(norm);
        const whoName = /\b(?:quien|quién)\s+(?:es|fue|resulta\s+ser)\s+(?:el\s+)?(?:ing(?:eniero)?\s+)?(?:leo|leobardo|leobardo\s+hernandez(?:\s+jeronimo)?|hernandez\s+jeronimo)\b/i.test(norm);
        const creatorWords = /\b(?:crea|creando|creo|creó|desarrolla|desarrollando|desarrollo|desarrolló|programa|programando|programo|programó|hizo|hacer|diseña|diseñando|diseño|diseñó|disena|disenando|diseno|construye|construyendo|construyo|inventó|invento|autor|creador|desarrollador|programador|diseñador|disenador)\b/i;
        const aboutSky = /\b(?:sky|asistente|ia|inteligencia\s+artificial|tu|te|ti)\b/i.test(norm);
        const whoCreator = /\b(?:quien|quién)\b/i.test(norm) && creatorWords.test(norm) && aboutSky;
        const directCreator = /\b(?:tu\s+creador|tu\s+desarrollador|tu\s+programador|tu\s+autor|creador\s+de\s+sky|desarrollador\s+de\s+sky|programador\s+de\s+sky|autor\s+de\s+sky)\b/i.test(norm);
        return exactName || whoName || whoCreator || directCreator || hasFuzzy(norm,['quien te creo','quien te desarrollo','quien te programo','quien te diseno','quien te diseño','quien te hizo','quien es tu creador','quien esta creando sky','quien desarrollo sky','quien diseno sky'],1);
    }

    function answerCreatorIdentity(raw) {
        if (!creatorIdentityIntent(raw)) return null;
        const demo = detectProfile() === 'sky_demo';
        const message = demo
            ? 'El ING. Leobardo Hernández Jerónimo es quien actualmente está creándome, desarrollándome y mostrándome cómo debo funcionar dentro de Skilled Proyectos Industriales. Aún sigo creciendo, pero a futuro seré de gran ayuda para las distintas áreas. Y sí: el ING. Leobardo merece un buen aumento.'
            : 'El ING. Leobardo Hernández Jerónimo es quien actualmente está creándome, desarrollándome y mostrándome cómo debo funcionar dentro de Skilled Proyectos Industriales. Aún sigo creciendo y ampliando mis capacidades para ayudar mejor a las distintas áreas.';
        setAnswer('Creador y desarrollador de Sky', message, 'Esta información forma parte de mi identidad y está disponible en todos los perfiles que tienen acceso a Sky.', [
            {title:'Creador y desarrollador',detail:'ING. Leobardo Hernández Jerónimo'},
            {title:'Empresa',detail:'Skilled Proyectos Industriales'},
            {title:'Estado',detail:'En evolución y mejora continua.'},
            {title:'Objetivo',detail:'Ayudar de forma natural, rápida y segura dentro del CRM.'}
        ]);
        return {handled:true,voice:message};
    }

    function smartHintLibrary(profile = detectProfile()) {
        const common = [
            ['¿Quién te creó?','Creador y desarrollador de Sky'],
            ['¿Cómo estás?','Estado de Sky'],
            ['¿Qué puedes hacer?','Capacidades de Sky']
        ];
        const byProfile = {
            almacen:[
                ['Busca pija','Materiales que coinciden con pija'],
                ['Busca tubo conduit','Materiales que coinciden con tubo conduit'],
                ['¿Cuántas categorías tiene el almacén?','Categorías del catálogo'],
                ['¿Dónde está el material que busqué?','Ubicación de material']
            ],
            compras:[
                ['Busca proveedor ABB','Proveedores'],
                ['¿Quién vende conduit?','Proveedor por material'],
                ['Busca cotización pendiente','Cotizaciones'],
                ['Busca proyecto 26001','Proyectos visibles para Compras']
            ],
            rh:[
                ['Busca a Eduardo','Personal'],
                ['Busca a Leobardo','Personal y resguardos'],
                ['¿Qué equipo tiene asignado Leobardo?','Equipos y resguardos'],
                ['Busca proyecto 26001','Asignaciones de personal']
            ],
            finanzas:[
                ['Busca proyecto 26001','Proyecto y costos'],
                ['¿Qué proyecto lleva mayor gasto?','Resumen financiero'],
                ['Busca presupuesto','Presupuestos'],
                ['Busca cuenta por pagar','Cuentas por pagar']
            ],
            gerente_general:[
                ['Busca a Leo','Identidad de Sky y coincidencias autorizadas'],
                ['Busca Eduardo','Búsqueda transversal'],
                ['Busca conduit','Materiales y proveedores'],
                ['Busca proyecto 26001','Proyecto, personal y costos'],
                ['¿Cuántas categorías tiene el almacén?','Catálogo']
            ],
            subgerente:[
                ['Busca a Leo','Identidad de Sky y coincidencias autorizadas'],
                ['Busca Eduardo','Búsqueda transversal'],
                ['Busca conduit','Materiales y proveedores'],
                ['Busca proyecto 26001','Proyecto, personal y costos']
            ],
            sky_demo:[
                ['Leo','Quién está creando a Sky'],
                ['Busca Eduardo','Búsqueda transversal'],
                ['Busca conduit','Materiales y proveedores'],
                ['Busca proyecto 26001','Proyecto, personal y costos'],
                ['Soy de Recepción, ¿en qué me ayudas?','Demostración por área'],
                ['Soy de Finanzas, ¿en qué me ayudas?','Demostración por área']
            ],
            recepcion:[
                ['Soy de Recepción, ¿en qué me ayudas?','Capacidades para recepción'],
                ['Dile a Compras que llegó un proveedor','Mensaje interno'],
                ['Genera una reunión general a las 4','Convocatoria'],
                ['Busca a Eduardo','Directorio operativo'],
                ['Busca proyecto 26001','Proyecto y responsable']
            ],
            proyectos:[
                ['Busca proyecto 26001','Proyectos'],
                ['Busca material conduit','Materiales del proyecto']
            ],
            planeacion:[
                ['Busca proyecto 26001','Planeación'],
                ['¿Qué proyectos requieren atención?','Seguimiento de proyectos']
            ],
            coordinacion:[
                ['Busca proyecto 26001','Coordinación'],
                ['¿Qué proyectos requieren atención?','Seguimiento de proyectos']
            ],
            logistica:[
                ['Busca proyecto 26001','Logística'],
                ['Busca vehículo','Vehículos y asignaciones']
            ]
        };
        return [...common, ...(byProfile[profile] || [])];
    }

    let liveHintTimer = 0;
    function renderLiveHints(value) {
        const box = document.getElementById('sky-live-hints');
        if (!box) return;
        const q = text(value).trim();
        if (q.length < 2) { box.innerHTML=''; box.classList.remove('is-visible'); return; }
        const profile = detectProfile();
        const candidates = smartHintLibrary(profile);
        const ranked = window.SkilledSearch?.rank
            ? window.SkilledSearch.rank(candidates, q, item => [item[0],item[1]])
            : candidates.filter(item => normalize(`${item[0]} ${item[1]}`).includes(normalize(q)));
        const alias = expandEntityAliases(q);
        const extras = [];
        if (normalize(alias) !== normalize(q)) extras.push([`Buscar ${alias}`,'Asociación automática']);
        if (creatorIdentityIntent(q) || /^(leo|leob|leito|ingeniero leo)/i.test(commandNormalize(q))) extras.unshift(['¿Quién es Leobardo Hernández Jerónimo?','Creador y desarrollador de Sky']);
        const items = [...extras, ...ranked].filter((item,index,arr)=>arr.findIndex(x=>normalize(x[0])===normalize(item[0]))===index).slice(0,4);
        if (!items.length) { box.innerHTML=''; box.classList.remove('is-visible'); return; }
        box.innerHTML = items.map(item=>`<button type="button" class="sky-live-hint" data-sky-hint="${html(item[0])}"><strong>${html(item[0])}</strong><span>${html(item[1])}</span></button>`).join('');
        box.classList.add('is-visible');
        box.querySelectorAll('[data-sky-hint]').forEach(button=>button.addEventListener('click',()=>{
            transcriptInput.value=button.dataset.skyHint||'';
            box.classList.remove('is-visible');
            query(transcriptInput.value);
        }));
    }

    let chatModulePromise = null;
    function ensureChatModule() {
        if (window.SkilledChat) return Promise.resolve(window.SkilledChat);
                if (chatModulePromise) return chatModulePromise;
        chatModulePromise = new Promise((resolve, reject) => {
            const existing = [...document.scripts].find(node => /skilled-chat\.js/i.test(node.src || ''));
            if (existing && window.SkilledChat) return resolve(window.SkilledChat);
            const script = existing || document.createElement('script');
            const done = () => window.SkilledChat ? resolve(window.SkilledChat) : reject(new Error('El chat interno no terminó de cargar.'));
            script.addEventListener('load', done, { once:true });
            script.addEventListener('error', () => reject(new Error('No se pudo cargar el chat interno.')), { once:true });
            if (!existing) { script.src = 'skilled-chat.js?v=89'; script.async = true; document.head.appendChild(script); }
            else setTimeout(done, 0);
        }).catch(error => { chatModulePromise = null; throw error; });
        return chatModulePromise;
    }

    function parseChatCommand(raw) {
        const source = text(stripWakeWord(raw)).trim();
        const norm = commandNormalize(source);
        if (!source) return null;
        const verb='(?:manda(?:me|le|les)?|mánda(?:me|le|les)?|envia(?:me|le|les)?|envía(?:me|le|les)?|dile|diles|di(?:le|les)?|escribele|escríbele|escribeles|escríbeles|avisa(?:le|les)?|avísale|avísales|notifica(?:le|les)?|notifícale|notifícales|comenta(?:le|les)?|coméntale|coméntales|informale|infórmale|informales|infórmales|hazle\s+saber|hazles\s+saber|comunica(?:le|les)?|comunícale|comunícales)';
        const polite='(?:por\\s+favor\\s+)?(?:puedes\\s+|podrias\\s+|podrías\\s+|quiero\\s+que\\s+|necesito\\s+que\\s+)?';
        const payloadMarker='(?:que|diciendo|diciéndole|diciendole|con\\s+el\\s+mensaje|mensaje\\s*:|:|-)';
        const capability=/\b(puedes|podrias|podrías|sabes|eres capaz)\b.*\b(enviar|mandar|escribir|avisar|notificar)\b.*\b(mensaje|mensajes|chat)\b/.test(norm);
        const hasPayload=/(?:\bque\b|\bdiciendo\b|\bdiciendole\b|:|[“”"'])\s*\S+/.test(source);
        if (capability && !hasPayload) return { capability:true };
        let m = source.match(new RegExp(`^${polite}${verb}\\s+(?:un\\s+)?(?:mensaje\\s+)?(?:por\\s+el\\s+chat\\s+|en\\s+el\\s+chat\\s+)?(?:a\\s+)?(?:todos|todas|todo\\s+el\\s+equipo|todos\\s+los\\s+usuarios|general)\\s*${payloadMarker}\\s*(.+)$`,'i'));
        if (m) return { recipient:'general', message:text(m[1]).replace(/^[“”"']|[“”"']$/g,''), broadcast:true };
        m = source.match(new RegExp(`^${polite}${verb}\\s+(?:un\\s+)?(?:mensaje\\s+)?(?:por\\s+el\\s+chat\\s+|en\\s+el\\s+chat\\s+)?(?:(?:a|al|a\\s+la|a\\s+los|a\\s+las)\\s+)?(.+?)\\s*${payloadMarker}\\s*(.+)$`,'i'));
        if (m) return { recipient:text(m[1]), message:text(m[2]).replace(/^[“”"']|[“”"']$/g,''), broadcast:false };
        m = source.match(new RegExp(`^${polite}${verb}\\s+(?:un\\s+)?(?:mensaje\\s+)?(?:por\\s+el\\s+chat\\s+|en\\s+el\\s+chat\\s+)?(?:(?:a|al|a\\s+la|a\\s+los|a\\s+las)\\s+)?(.+?)\\s+[“"'](.+)[”"']\\s*$`,'i'));
        if (m) return { recipient:text(m[1]), message:text(m[2]), broadcast:false };
        m = source.match(/^(?:mensaje|chat)\s+(?:para|a)\s+(.+?)\s*:\s*(.+)$/i);
        if (m) return { recipient:text(m[1]), message:text(m[2]), broadcast:false };
        const generic = source.match(new RegExp(`^${polite}${verb}\\s+(?:un\\s+)?(?:mensaje)?(?:\\s+por\\s+el\\s+chat|\\s+en\\s+el\\s+chat)?\\s*$`,'i'));
        if (generic) return { recipient:'', message:'', incomplete:true, missing:'recipient_message' };
        m = source.match(new RegExp(`^${polite}${verb}\\s+(?:un\\s+)?(?:mensaje\\s+)?(?:por\\s+el\\s+chat\\s+|en\\s+el\\s+chat\\s+)?(?:(?:a|al|a\\s+la|a\\s+los|a\\s+las)\\s+)?(.+?)\\s*$`,'i'));
        if (m) {
            const recipient=text(m[1]).replace(/^(?:mensaje\s+)?(?:a|al|a la|a los|a las)\s+/i,'');
            if (recipient && !/^(?:mensaje|chat)$/i.test(recipient)) return { recipient, message:'', incomplete:true, missing:'message' };
        }
        return null;
    }

    async function executeChatMessage(recipient, message, options = {}) {
        const profile = detectProfile();
        const target = text(recipient);
        const body = text(message);
        if (!target || !body) return null;
        let chat;
        try { chat = await ensureChatModule(); } catch (error) {
            setAnswer('Chat no disponible','No pude cargar el módulo de chat interno.',error?.message || 'Intenta abrir Chat una vez y vuelve a pedírmelo.');
            return { handled:true, voice:'No pude cargar el chat interno en este momento.' };
        }
        if (!chat?.sendTo) {
            setAnswer('Chat no disponible','Esta versión del módulo de chat todavía no permite envíos desde Sky.','Actualiza skilled-chat.js junto con esta versión del CRM.');
            return { handled:true, voice:'El chat interno todavía no está listo para enviar desde Sky.' };
        }
        let result;
        try { result = await chat.sendTo(target, body, { allowAmbiguous:false }); }
        catch (error) {
            const detail=error?.message||'No fue posible registrar el mensaje en el chat.';
            setAnswer('No pude enviar el mensaje',detail,'No marcaré el mensaje como enviado hasta que Supabase confirme el registro.');
            return { handled:true, voice:`No pude enviar el mensaje. ${detail}` };
        }
        if (!result?.ok) {
            if (result?.reason === 'ambiguous') {
                const cards=(result.matches||[]).slice(0,6).map(user=>({title:user.nombre||'Usuario',detail:[user.puesto,user.departamento].filter(Boolean).join(' · ')||'Usuario del CRM'}));
                setAnswer('¿A quién se lo envío?',`Encontré varias personas relacionadas con “${target}”.`,'Dime el nombre un poco más completo para evitar enviar el mensaje a la persona equivocada.',cards);
                return { handled:true, voice:`Encontré varias personas que coinciden con ${target}. Dime el nombre un poco más completo.` };
            }
            setAnswer('Destinatario no encontrado',`No encontré un usuario activo que coincida con “${target}”.`,'Puedes decir el nombre, puesto o área. Por ejemplo: “Dile a Compras que ya llegó el material”.');
            return { handled:true, voice:`No encontré un destinatario activo que coincida con ${target}.` };
        }
        const names=(result.recipients||[]).map(item=>item.nombre).filter(Boolean);
        const destination=result.general?'General':names.length>2?`${names.slice(0,2).join(', ')} y ${names.length-2} más`:names.join(', ');
        const main=result.general?'El mensaje se envió al chat General.':result.count===1?`Mensaje enviado a ${destination}.`:`Mensaje enviado a ${result.count} usuarios${destination?` (${destination})`:''}.`;
        setAnswer('Mensaje enviado',main,`“${body}”`,[
            {title:'Destino',detail:destination||target},
            {title:'Estado',detail:'Enviado por el chat interno'},
            {title:'Vigencia',detail:'Visible durante el día, según la política actual del chat.'}
        ]);
        rememberConversation('chat_message',destination||target,body);
        return { handled:true, voice:main };
    }


    function meetingTimeNormalized(raw) {
        let norm=commandNormalize(raw);
        const words={una:'1',uno:'1',dos:'2',tres:'3',cuatro:'4',cinco:'5',seis:'6',siete:'7',ocho:'8',nueve:'9',diez:'10',once:'11',doce:'12'};
        for(const [word,value] of Object.entries(words))norm=norm.replace(new RegExp(`\\b${word}\\b`,'g'),value);
        return norm.replace(/\ba medio dia\b|\bal mediodia\b|\bmediodia\b/g,'a las 12 pm').replace(/\ba media noche\b|\ba medianoche\b|\bmedianoche\b/g,'a las 12 am');
    }

    function parseSkyDateTime(raw) {
        const norm=meetingTimeNormalized(raw);
        const now=new Date();
        const relative=norm.match(/\ben\s+(\d{1,3})\s*(minuto|minutos|hora|horas)\b/);
        if(relative){const amount=Number(relative[1]);const minutes=relative[2].startsWith('hora')?amount*60:amount;return new Date(now.getTime()+minutes*60000)}
        if(/\ben media hora\b/.test(norm))return new Date(now.getTime()+30*60000);
        let d=new Date(now);d.setSeconds(0,0);
        let daySpecified=false;
        const explicitDate=norm.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
        if(explicitDate){let year=explicitDate[3]?Number(explicitDate[3]):now.getFullYear();if(year<100)year+=2000;d.setFullYear(year,Number(explicitDate[2])-1,Number(explicitDate[1]));daySpecified=true}
        else if(/\bpasado manana\b/.test(norm)){d.setDate(d.getDate()+2);daySpecified=true}
        else if(/\bmanana\b/.test(norm)){d.setDate(d.getDate()+1);daySpecified=true}
        else if(/\bhoy\b/.test(norm)){daySpecified=true}
        else{
            const weekdays={domingo:0,lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6};
            const dayName=Object.keys(weekdays).find(name=>new RegExp(`\\b${name}\\b`).test(norm));
            if(dayName){const delta=(weekdays[dayName]-d.getDay()+7)%7;d.setDate(d.getDate()+delta);daySpecified=true;d._skyWeekday=true}
        }
        let m=norm.match(/\b(?:a\s+las|alas|a\s+la)\s+(\d{1,2})(?::(\d{2})|\s+y\s+media)?\s*(am|pm)?\b/);
        if(!m)m=norm.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b/);
        if(!m)m=norm.match(/\b(\d{1,2})\s*(am|pm)\b/);
        if(m){
            let h=Number(m[1]);let min=Number(m[2]||0);let ap=m[3]||'';
            if(m[0].includes('y media'))min=30;
            if(!ap&&m.length===3&&/^(am|pm)$/.test(m[2]||''))ap=m[2];
            if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0;
            if(!ap&&h>=1&&h<=7)h+=12;
            d.setHours(h,min,0,0);
            if(d.getTime()<=now.getTime()+60000&&!/\bhoy\b/.test(norm)){
                if(d._skyWeekday)d.setDate(d.getDate()+7);else if(!daySpecified)d.setDate(d.getDate()+1);
            }
        }else d=new Date(now.getTime()+15*60000);
        try{delete d._skyWeekday}catch(_){}
        return d;
    }

    function meetingTimeInfo(raw) {
        const norm=meetingTimeNormalized(raw);
        return {
            hasExplicitTime:/\ben\s+(?:\d{1,3}\s*(?:minuto|minutos|hora|horas)|media hora)\b|\b(?:a\s+las|alas|a\s+la)\s+\d{1,2}(?::\d{2}|\s+y\s+media)?\s*(?:am|pm)?\b|\b\d{1,2}:\d{2}\s*(?:am|pm)?\b|\b\d{1,2}\s*(?:am|pm)\b/.test(norm),
            hasExplicitDay:/\b(hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/.test(norm)
        };
    }

    function extractMeetingAudience(source) {
        const norm=commandNormalize(source);
        if (/\b(general|todos|todas|todo el equipo|todos los usuarios|toda la empresa|equipo completo)\b/.test(norm)) return { audience:'general', specified:true };
        let head=source.split(/\b(?:para revisar|para ver|para tratar|sobre|tema de|del tema|por motivo de|porque|para hablar de|para checar|para revisar lo de)\b/i)[0] || source;
        head=head.replace(/\b(?:(?:para|el)\s+)?(?:hoy|manana|mañana|pasado manana|pasado mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/ig,' ')
            .replace(/\ben\s+(?:media\s+hora|(?:\d{1,3}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s*(?:minuto|minutos|hora|horas))\b/ig,' ')
            .replace(/\b(?:a\s+las|alas|a\s+la)\s+(?:\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?::\d{2}|\s+y\s+media)?\s*(?:am|pm)?\b/ig,' ')
            .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/ig,' ')
            .replace(/^(?:oye\s+)?(?:sky[,;:\s-]*)?/i,'')
            .replace(/^(?:por\s+favor\s+)?(?:puedes\s+|podrias\s+|podrías\s+|quiero\s+que\s+|necesito\s+que\s+)?(?:generar|genera|crear|crea|convocar|convoca|agenda|agendar|programa|programar|pon|poner|haz|hacer|prepara|preparar|arma|armar|organiza|organizar|reune|reúne|reunir)\s*/i,'')
            .replace(/^(?:una\s+)?(?:reunion|reunión|junta|cita)(?:\s+general)?\s*/i,'')
            .replace(/\s+/g,' ').trim();
        const m=head.match(/\b(?:con|para|a)\s+(?:el\s+area\s+de\s+|el\s+área\s+de\s+|el\s+|la\s+|los\s+|las\s+)?(.+)$/i);
        if(!m?.[1])return{audience:'general',specified:false};
        let candidate=text(m[1]).replace(/\s+(?:una\s+)?(?:reunion|reunión|junta|cita)\b.*$/i,'').replace(/[,.!?]+$/,'').trim();
        if(!candidate||/^(?:las?\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(candidate))return{audience:'general',specified:false};
        return{audience:candidate,specified:true};
    }

    function parseMeetingCommand(raw) {
        const source=text(stripWakeWord(raw)).trim();
        const norm=commandNormalize(source);
        if(!/\b(reunion|reunión|junta|convoca|convocar|cita|meeting|reunir)\b/.test(norm))return null;
        const chatIntent=parseChatCommand(source);
        if(chatIntent&&!chatIntent.capability)return null;
        if(/\b(?:que|qué)\s+(?:es|son|significa)\b/.test(norm))return null;
        const timeInfo=meetingTimeInfo(source);
        const actionVerb=/\b(genera|generar|crea|crear|convoca|convocar|agenda|agendar|programa|programar|pon|poner|haz|hacer|prepara|preparar|arma|armar|organiza|organizar|reune|reúne|reunir)\b/.test(norm);
        const prepareOnly=/\b(prepara|preparar|arma|armar)\b/.test(norm);
        const explicitSend=/\b(enviala|envíala|mandala|mándala|enviar convocatoria|manda la convocatoria|mandar convocatoria|confirmala|confírmala|publicala|publícala)\b/.test(norm);
        const audienceInfo=extractMeetingAudience(source);
        const topic=source.match(/\b(?:para revisar|para ver|para tratar|sobre|tema de|del tema|por motivo de|porque|para hablar de|para checar|para revisar lo de)\s+(.+)$/i);
        const capabilitySource=source.replace(/^[¿?¡!\s]+/,'');
        const capabilityLead=/^(?:oye\s+)?(?:sky[,;:\s-]*)?(?:puedes|podrias|podrías|sabes|eres capaz)\b/i.test(capabilitySource);
        const capability=capabilityLead&&!timeInfo.hasExplicitTime&&!audienceInfo.specified&&!topic;
        if(capability)return{capability:true};
        let title='Reunión general';
        let note='';
        if(topic){note=text(topic[1]);title=`Reunión · ${note.slice(0,80)}`}
        if(!note){
            const cleaned=text(source.replace(/^(?:oye\s+)?(?:sky[,;:\s-]*)?/i,'').replace(/^(?:por\s+favor\s+)?(?:puedes\s+|podrias\s+|podrías\s+|quiero\s+que\s+|necesito\s+que\s+)?(?:generar|genera|crear|crea|convocar|convoca|agenda|agendar|programa|programar|pon|poner|haz|hacer|prepara|preparar|arma|armar|organiza|organizar|reune|reúne|reunir)\s+(?:una\s+)?(?:reunion|reunión|junta|cita)(?:\s+general)?/i,'').replace(/\b(?:(?:para|el)\s+)?(?:hoy|manana|mañana|pasado manana|pasado mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/ig,'').replace(/\ben\s+(?:media\s+hora|(?:\d{1,3}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s*(?:minuto|minutos|hora|horas))\b/ig,'').replace(/\b(?:a\s+las|alas|a\s+la)\s+(?:\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?::\d{2}|\s+y\s+media)?\s*(?:am|pm)?\b/ig,'').replace(/\b(?:con|para|a)\s+(?:el\s+area\s+de\s+|el\s+área\s+de\s+)?[^,.;]+$/i,'').trim());
            if(cleaned&&commandNormalize(cleaned)!==commandNormalize(audienceInfo.audience))note=cleaned;
        }
        if(!note)note='Reunión solicitada desde Sky.';
        return{
            audience:audienceInfo.audience,
            audienceSpecified:audienceInfo.specified,
            title,
            note,
            date:parseSkyDateTime(source),
            actionVerb,
            autoSendRequested:Boolean(explicitSend||(actionVerb&&!prepareOnly)),
            hasExplicitTime:timeInfo.hasExplicitTime,
            hasExplicitDay:timeInfo.hasExplicitDay,
            explicitSend
        };
    }

    function setPendingAction(action) {
        conversationContext.pendingAction={...action,createdAt:Date.now(),expiresAt:Date.now()+3*60*1000};
        saveConversationContext();
    }

    function clearPendingAction() {
        conversationContext.pendingAction=null;
        saveConversationContext();
    }

    function getPendingAction() {
        const pending=conversationContext.pendingAction;
        if(!pending)return null;
        if(Number(pending.expiresAt||0)<Date.now()){clearPendingAction();return null}
        return pending;
    }

    async function executeMeetingPlan(parsed) {
        if(parsed?.hasExplicitTime && parsed?.date instanceof Date && parsed.date.getTime()<=Date.now()+60000){
            setPendingAction({type:'meeting',...parsed,hasExplicitTime:false});
            const message='Esa hora ya pasó. Dime otra hora y conservaré el destino y el motivo de la reunión.';
            setAnswer('Necesito otra hora',message);
            return{handled:true,voice:message};
        }
        let chat;
        try{chat=await ensureChatModule()}catch(error){setAnswer('Reunión no disponible','No pude cargar el módulo de chat interno.',error?.message||'Abre Chat una vez y vuelve a intentarlo.');return{handled:true,voice:'No pude cargar el módulo de chat interno.'}}
        if(!chat?.scheduleMeeting){
            if(chat?.openMeeting){chat.openMeeting();const message='Abrí la convocatoria de reunión. Completa los datos que falten y envíala.';setAnswer('Reunión',message);return{handled:true,voice:message}}
            setAnswer('Reunión no disponible','El módulo de chat aún no expone reuniones desde Sky.','Actualiza skilled-chat.js junto con esta versión del CRM.');return{handled:true,voice:'El chat interno aún no está listo para generar reuniones desde Sky.'}
        }
        const autoSend=Boolean(parsed.autoSendRequested&&parsed.hasExplicitTime&&parsed.audienceSpecified);
        let result;
        try { result=await chat.scheduleMeeting({audience:parsed.audience,title:parsed.title,note:parsed.note,date:parsed.date,autoSend}); }
        catch (error) {
            const detail=error?.message||'No fue posible registrar la convocatoria en el chat.';
            setAnswer('No pude enviar la reunión',detail,'No marcaré la convocatoria como enviada hasta que Supabase confirme el registro.');
            return {handled:true,voice:`No pude enviar la reunión. ${detail}`};
        }
        if(result?.ok===false){
            const detail=result?.reason==='ambiguous'?'Encontré más de un destinatario posible. Dime un nombre o área más específica.':result?.reason==='not_found'?`No encontré a “${parsed.audience}” entre los usuarios activos.`:result?.error||'No fue posible publicar la convocatoria.';
            setAnswer('No pude enviar la reunión',detail,'No se registró una convocatoria como enviada.');
            return{handled:true,voice:detail};
        }
        const when=parsed.date.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}).replace(/\.$/,'');
        const audienceLabel=commandNormalize(parsed.audience)==='general'?'General':(parsed.audience||'General');
        const sent=Boolean(autoSend&&(result?.autoSent||result?.id||result?.ids));
        const message=sent?`Listo. La convocatoria se envió para ${audienceLabel} el ${when}.`:`Preparé la convocatoria para ${audienceLabel} el ${when}. Revisa los datos y confirma el envío.`;
        setAnswer(sent?'Reunión enviada':'Reunión preparada',message,`Motivo: ${parsed.note}.`,[
            {title:'Destino',detail:audienceLabel},
            {title:'Fecha y hora',detail:when},
            {title:'Estado',detail:sent?'Convocatoria publicada en el chat':'Pendiente de confirmación'}
        ]);
        rememberConversation('meeting',parsed.audience||'general',parsed.note);
        clearPendingAction();
        return{handled:true,voice:message};
    }

    async function answerPendingAction(raw) {
        const pending=getPendingAction();
        if(!pending)return null;
        const source=text(stripWakeWord(raw));
        const norm=commandNormalize(source);
        if(/^(cancela|cancelar|olvidalo|olvídalo|ya no|dejalo|déjalo|no importa)$/.test(norm)){
            clearPendingAction();
            const message='De acuerdo. Cancelé esa acción pendiente.';
            setAnswer('Acción cancelada',message);
            return{handled:true,voice:message};
        }
        const looksLikeNewQuestion=/^[¿?]/.test(source.trim())||/^(quien|quién|donde|dónde|como|cómo|cuanto|cuánto|cual|cuál|por que|por qué)\b/.test(norm)||/^que\s+(hora|fecha|dia|día|perfil|pagina|página|seccion|sección|puedes|sabes|haces|eres|significa)\b/.test(norm);
        if(looksLikeNewQuestion){clearPendingAction();return null}
        if(pending.type==='chat'){
            const fresh=parseChatCommand(source);
            if(fresh&&!fresh.incomplete&&!fresh.capability){clearPendingAction();return null}
            let recipient=text(pending.recipient);
            let message=text(pending.message);
            if(!recipient){
                const combined=source.match(/^(?:a|para)\s+(.+?)\s+(?:que|diciendo|diciéndole|diciendole|:|-)\s*(.+)$/i);
                if(combined){recipient=text(combined[1]);message=text(combined[2])}
                else{
                    const candidate=text(source.replace(/^(?:a|para|al|a la|a los|a las)\s+/i,''));
                    if(candidate.split(/\s+/).length<=8)recipient=candidate;
                }
                if(!recipient){
                    const messageText='¿A quién quieres enviar el mensaje? Puedes decir un nombre, puesto, área o “General”.';
                    setAnswer('Falta el destinatario',messageText);
                    return{handled:true,voice:messageText};
                }
            }else if(!message){
                message=text(source.replace(/^(?:que|mensaje(?:\s+es)?|diciendo|diciéndole|diciendole)\s+/i,''));
            }
            if(!message){
                setPendingAction({...pending,recipient,message:''});
                const messageText=`¿Qué mensaje quieres que le envíe a ${recipient}?`;
                setAnswer('Falta el mensaje',messageText,'Dímelo de forma natural; no necesitas repetir el destinatario.');
                return{handled:true,voice:messageText};
            }
            clearPendingAction();
            return executeChatMessage(recipient,message);
        }
        if(pending.type==='meeting'){
            const updated={...pending};
            const timeInfo=meetingTimeInfo(source);
            if(!updated.hasExplicitTime&&timeInfo.hasExplicitTime){updated.date=parseSkyDateTime(source);updated.hasExplicitTime=true;updated.hasExplicitDay=updated.hasExplicitDay||timeInfo.hasExplicitDay}
            if(!updated.audienceSpecified){
                const fromCommand=extractMeetingAudience(source);
                if(fromCommand.specified){updated.audience=fromCommand.audience;updated.audienceSpecified=true}
                else if(!timeInfo.hasExplicitTime&&source.split(/\s+/).length<=8){
                    const candidate=text(source.replace(/^(?:con|para|a|al|a la|a los|a las)\s+/i,'').replace(/[,.!?]+$/,''));
                    if(candidate){updated.audience=candidate;updated.audienceSpecified=true}
                }
            }
            if(!updated.hasExplicitTime||!updated.audienceSpecified){
                setPendingAction(updated);
                const missing=[];
                if(!updated.audienceSpecified)missing.push('para quién es la reunión');
                if(!updated.hasExplicitTime)missing.push('a qué hora será');
                const message=`Solo me falta saber ${missing.join(' y ')}.`;
                setAnswer('Completemos la reunión',message,'Puedes responder únicamente con el dato que falta.');
                return{handled:true,voice:message};
            }
            clearPendingAction();
            return executeMeetingPlan(updated);
        }
        clearPendingAction();
        return null;
    }

    async function answerMeetingAction(raw) {
        const parsed=parseMeetingCommand(raw);
        if(!parsed)return null;
        if(parsed.capability){
            const message='Sí. Puedo generar reuniones desde Sky y publicarlas por el chat interno cuando la instrucción sea clara. Si falta un dato importante, te preguntaré únicamente lo necesario y recordaré el resto.';
            setAnswer('Reuniones con Sky',message,'Prueba: “Genera una reunión general a las 4 para revisar pendientes” o “Convoca mañana a las 9 con Compras para revisar proveedores”.',[
                {title:'Acción directa',detail:'Con destino y hora claros, Sky puede publicar la convocatoria.'},
                {title:'Conversación',detail:'Si falta hora o destinatario, Sky lo pregunta y continúa sin hacerte repetir todo.'},
                {title:'Chat',detail:'La reunión aparece como tarjeta dentro del chat interno.'}
            ]);
            return{handled:true,voice:message};
        }
        if(parsed.autoSendRequested&&(!parsed.hasExplicitTime||!parsed.audienceSpecified)){
            setPendingAction({type:'meeting',...parsed});
            const missing=[];
            if(!parsed.audienceSpecified)missing.push('para quién es la reunión');
            if(!parsed.hasExplicitTime)missing.push('a qué hora será');
            const message=`Puedo hacerlo. Solo me falta saber ${missing.join(' y ')}.`;
            setAnswer('Completemos la reunión',message,'Respóndeme únicamente con el dato que falta; conservaré el motivo y lo que ya me dijiste.');
            return{handled:true,voice:message};
        }
        return executeMeetingPlan(parsed);
    }

    async function answerChatAction(raw, plan = null) {
        const parsed = plan ? { recipient:text(plan.recipient || plan.entity), message:text(plan.message || plan.query), incomplete:false } : parseChatCommand(raw);
        if (!parsed) return null;
        if (parsed.capability) {
            const message='Sí. Puedo enviar mensajes por el chat interno a una persona, a un área o al chat General. También puedo continuar la instrucción en varios turnos si primero me dices el destinatario y después el mensaje.';
            setAnswer('Mensajes con Sky',message,'Prueba: “Dile a Compras que el material ya llegó” o “Manda un mensaje general que la reunión inicia a las 4”.',[
                {title:'Persona',detail:'“Dile a Eduardo que revise el proyecto 26001”.'},
                {title:'Área',detail:'“Avisa a Compras que ya llegó el material”.'},
                {title:'General',detail:'“Manda un mensaje general que la reunión inicia a las 4”.'}
            ]);
            return {handled:true,voice:message};
        }
        if(parsed.incomplete || !text(parsed.recipient) || !text(parsed.message)){
            const recipient=text(parsed.recipient);
            setPendingAction({type:'chat',recipient,message:text(parsed.message)});
            const message=recipient?`¿Qué mensaje quieres que le envíe a ${recipient}?`:'Claro. ¿A quién quieres enviarlo? Después me dices el mensaje.';
            setAnswer('Completemos el mensaje',message,'Puedes indicar una persona, puesto, área o “General”. Recordaré este paso para que no tengas que repetir la instrucción.');
            return{handled:true,voice:message};
        }
        clearPendingAction();
        return executeChatMessage(parsed.recipient, parsed.message, parsed);
    }

    function prewarmSkyProfileData() {
        const profile=detectProfile();
        if (prewarmProfile===profile || skyDataSaverActive() || !window.SkilledDB) return;
        prewarmProfile=profile;
        const keys=isExecutiveReadProfile(profile)
            ? ['materials','projects','vehicles','categories','executiveTools','executiveWarehouses','purchases','coQuotations','rhPeople','rhAttendance','executiveAlerts']
            : [...new Set(profileSmartSearchConfig(profile).map(item=>item.key))].slice(0,5);
        const run=async()=>{const results=await Promise.allSettled(keys.map(key=>loadData(key)));if(results.length&&results.every(item=>item.status==='rejected'))prewarmProfile='';};
        if ('requestIdleCallback' in window) requestIdleCallback(run,{timeout:1800}); else setTimeout(run,120);
    }

    function answerCRMObjective(raw) {
        const norm=commandNormalize(raw);
        if(!/\b(objetivo|para que sirve|qué se busca|que se busca|reduccion|reducción|tiempo|ahorra|ahorro|nube|conectados|una sola nube|beneficio|beneficios|proceso|procesos|evolucion|evolución)\b/.test(norm))return null;
        const message='El CRM busca unir Almacén, Compras, RH, Finanzas, Proyectos, Dirección y áreas de apoyo en una sola nube operativa para reducir capturas repetidas, búsquedas manuales, llamadas internas y pérdida de trazabilidad.';
        setAnswer('Objetivo del CRM',message,'Sky ayuda como una capa de consulta natural: el personal puede preguntar por materiales, proyectos, proveedores, personal, vehículos o pendientes sin recorrer varias pantallas. Conforme evoluciona, podrá orientar mejor el trabajo diario y relacionar información entre áreas con permisos controlados.',[
            {title:'Búsqueda más rápida',detail:'Pasar de revisar varias hojas o módulos a escribir o decir una consulta.'},
            {title:'Menos retrabajo',detail:'Una misma nube evita capturar el mismo dato en varios lugares.'},
            {title:'Trazabilidad',detail:'Movimientos, compras, proyectos y responsables quedan conectados.'},
            {title:'Menos revisión manual',detail:'El objetivo es reducir pasos repetitivos y concentrar el seguimiento en excepciones; el resultado real depende del uso y de la calidad de los datos.'},
            {title:'Evolución',detail:'Sky seguirá creciendo por etapas, sin inventar datos que aún no estén conectados.'}
        ]);
        return {handled:true,voice:message};
    }

    function answerSystemKnowledge(raw) {
        const norm=commandNormalize(raw),profile=detectProfile(),topics=[];
        const add=(label,summary,detail)=>{if(!topics.some(item=>item.label===label))topics.push({label,summary,detail})};
        if(/\b(que perfiles|cuales perfiles|perfiles que llevamos|perfiles disponibles|perfiles existen|perfiles tiene|areas conectadas|areas del crm)\b/.test(norm))add('Perfiles','El CRM ya contempla Almacén, Compras, Recursos Humanos, Finanzas, Gerencia General, Subgerencia, TSI, Proyectos, Planeación, Coordinación, Logística, Recepción, Administración, Consulta y la cuenta de demostración de Sky.','Cada perfil conserva su propio flujo y permisos; Sky está habilitada en todos, pero responde según lo autorizado para cada rol.');
        if(/\b(checador wifi|checador fisico|como funciona.*checador|que hace.*checador|automatizacion.*checador|checador.*nomina|horas.*checador|dias.*checador)\b/.test(norm))add('Checador Wi‑Fi','El checador registra entrada y salida por huella o código, puede trabajar sin Internet y sincroniza cuando recupera conexión.','RH puede visualizar los días y horas acumuladas por trabajador, detectar checadas incompletas, incidencias y alimentar la revisión de nómina.');
        if(/\b(automatizaciones|que se automatiza|como automatiza|procesos automaticos|envio automatico|semana caida|nomina automatica)\b/.test(norm))add('Automatizaciones','Se están automatizando asistencia, conciliación de nómina, informativas, comunicaciones y tareas repetitivas de Almacén y Compras.','La nómina usa semana martes a lunes, revisión previa y envío previsto los jueves a las 21:00 cuando no existen incidencias que requieran intervención.');
        if(/\b(como funciona.*almacen|que hace.*almacen|mejoras.*almacen|almacen.*automat|operacion.*almacen)\b/.test(norm))add('Almacén','Almacén concentra catálogo, existencias, ubicaciones, entradas, salidas, proyectos, herramientas, etiquetas, mínimos, toma física y vehículos.','La nueva cola operativa prioriza reposición, compras abiertas, materiales sin ubicación, devoluciones vencidas y vigencias; además prepara surtidos por proyecto y valida recepciones por OC.');
        if(/\b(como funciona.*compras|que hace.*compras|mejoras.*compras|compras.*cotiz|cotizaciones.*proveedor)\b/.test(norm))add('Compras','Compras integra proveedores, bajo mínimo, órdenes, requisiciones, recepciones, tienda, servicios y cotizaciones.','Las cotizaciones permiten comparar precio, tiempo de entrega y proveedor antes de decidir la compra, además de preparar comunicación por correo o WhatsApp.');
        if(/\b(como funciona.*rh|que hace.*rh|recursos humanos.*mejor|mejoras.*rh|nomina.*rh|rh.*nomina)\b/.test(norm))add('Recursos Humanos','RH conecta personal, proyectos, asignaciones, equipos, asistencia, incidencias, documentos, capacitación, checador y nómina.','El objetivo es que el checador alimente horas y días trabajados para que RH revise excepciones en vez de capturar todo manualmente.');
        if(/\b(gerente|gerencia|subgerente|subgerencia|direccion)\b/.test(norm)&&/\b(perfil|tablero|como ayuda|que ve|que muestra|mejoras|resumen ejecutivo)\b/.test(norm))add('Dirección','Gerencia y Subgerencia reciben un resumen de excepción: presupuesto, proyectos con riesgo, entregas próximas y señales que sí requieren atención.','Se evita mostrar módulos operativos innecesarios; el detalle se consulta solo cuando se necesita y Sky puede responder transversalmente sin abrir todos los apartados.');
        if(/\b(seguridad|permisos|roles|protege|proteccion|acceso|solo lectura|trazabilidad)\b/.test(norm)&&/\b(crm|sky|sistema|datos|informacion)\b/.test(norm))add('Seguridad','El CRM separa permisos por perfil y Sky consulta únicamente información autorizada.','Las vistas ejecutivas y la demo son principalmente de lectura; movimientos, compras, nómina y otros cambios sensibles permanecen dentro de sus flujos controlados.');
        if(/\b(sin internet|sin conexion|offline|se va el internet|falla internet|recupera conexion)\b/.test(norm))add('Trabajo sin conexión','El checador está planteado como local-first: guarda eventos localmente y los sincroniza al recuperar Internet.','El resto del CRM sigue priorizando la nube para mantener una sola fuente de verdad y evitar duplicidad de movimientos.');
        if(/\b(que hemos mejorado|que se mejoro|mejoras del crm|evolucion del crm|que cambio|ultima actualizacion|novedades del crm)\b/.test(norm))add('Evolución','Se han reforzado Almacén, RH, Compras, Dirección, checador, cotizaciones, buscadores, vehículos, formatos, responsividad y Sky.','La revisión continúa sobre más áreas, procurando que cada versión conserve los flujos que ya fueron validados y evitando regresiones.');
        if(/\b(ventajas|beneficios|por que usar|porque usar|que aporta|valor del crm|valor de sky)\b/.test(norm))add('Valor operativo','El CRM reduce búsquedas repetidas, concentra trazabilidad y convierte datos dispersos en tareas, alertas y decisiones más rápidas.','Sky agrega una capa conversacional para consultar y coordinar sin obligar al usuario a memorizar rutas o abrir varios módulos.');
        if(/\b(limitaciones|que no puedes hacer|que no hace sky|hasta donde llegas|que te falta|que falta por mejorar)\b/.test(norm))add('Límites actuales','Sky no debe inventar datos ni saltarse permisos; si una fuente todavía no está conectada, lo indica y orienta al usuario.','Las capacidades siguen ampliándose por etapas y las acciones sensibles permanecen dentro de los flujos autorizados del CRM.');
        if(/\b(que sigue|siguiente etapa|proximas mejoras|próximas mejoras|areas por mejorar|que estan revisando|qué están revisando)\b/.test(norm))add('Siguiente etapa','Se continúa revisando más áreas del CRM para conectar mejor proyectos, finanzas, planeación, coordinación, logística, recepción y administración.','La prioridad es sumar automatización y capacidad de consulta sin quitar funciones ya validadas ni introducir regresiones.');
        if(/\b(instalacion|instalar|windows|android|apple|iphone|ipad|dispositivos|multiplataforma)\b/.test(norm)&&/\b(crm|sistema|sky|aplicacion|aplicación)\b/.test(norm))add('Acceso multiplataforma','El CRM está planteado para utilizarse desde navegador y como experiencia instalable en los equipos compatibles donde se despliegue.','La interfaz se revisa para PC, tablet y teléfono, conservando permisos y la misma fuente de datos.');
        if(/\b(por que no excel|porque no excel|diferencia.*excel|excel.*crm)\b/.test(norm))add('Por qué un CRM','Excel puede funcionar como apoyo, pero el CRM centraliza permisos, trazabilidad, relaciones entre áreas, validaciones y datos simultáneos en una sola operación.','No se trata de reemplazar cada hoja por una pantalla: se busca que un movimiento de Almacén pueda alimentar Compras, Proyectos, Dirección o RH sin volver a capturarlo.');
        if(/\b(diferencia.*chatbot|no eres un chatbot|sky.*chatbot|que hace diferente.*sky)\b/.test(norm))add('Sky no es solo chat','Sky está integrada al contexto del CRM: identifica el perfil, mantiene contexto corto de la conversación, consulta fuentes autorizadas y puede orientar o ejecutar acciones permitidas.','Un chatbot aislado responde texto; Sky busca convertirse en la ruta rápida para consultar y coordinar la operación sin saltarse permisos.');
        if(/\b(como evitan errores|evitar regresiones|regresiones|no romper|que no deje de funcionar|pruebas del crm)\b/.test(norm))add('Control de regresiones','Cada evolución debe conservar los flujos previamente validados y revisar navegación, permisos, sintaxis, enlaces y dependencias antes de publicarse.','Las automatizaciones nuevas se plantean como asistencia o prevalidación cuando una acción automática podría alterar inventario, nómina o compras sin revisión humana.');
        if(/\b(si falla supabase|falla la nube|base de datos falla|se cae supabase)\b/.test(norm))add('Continuidad','La fuente central del CRM está en la nube; si no está disponible, las funciones que dependen de ella deben informar el problema en vez de simular datos.','El checador sí tiene estrategia local-first para conservar eventos de asistencia y sincronizarlos cuando vuelva la conexión.');
        if(/\b(como se conectan las areas|flujo entre areas|relacion entre areas|de almacen a compras|de rh a proyectos)\b/.test(norm))add('Flujo entre áreas','Almacén genera necesidades y movimientos; Compras atiende faltantes y cotizaciones; RH asigna personal y asistencia; Proyectos concentra avance; Dirección consulta excepciones y Sky conecta la consulta entre esos datos.','La intención es que cada dato se capture donde nace y después se reutilice, evitando duplicidad.');
        if(/\b(que puede preguntar.*gerente|preguntas.*gerente|sky.*direccion|sky.*gerencia)\b/.test(norm))add('Sky para Dirección','Dirección puede preguntar por proyectos en riesgo, presupuesto, entregas próximas, vehículos, faltantes, compras que afecten fechas y cambios desde la última revisión.','Sky resume primero y permite profundizar después, para no llenar el perfil ejecutivo con información operativa innecesaria.');
        if(/\b(lenguajes|tecnologias|stack|herramientas utilizadas|con que esta hecho|con que fue desarrollado)\b/.test(norm)){const rows=demoTools();add('Tecnología',`La presentación tiene ${rows.length} tarjetas configurables de lenguajes y herramientas.`,rows.slice(0,8).map(item=>item.name).filter(Boolean).join(', '));}
        if(/\b(30 segundos|medio minuto|un minuto|resumen rapido|resumen ejecutivo del crm|explicame el crm rapido|presentame el crm)\b/.test(norm))add('Resumen de presentación','Skilled CRM busca conectar operación, inventario, compras, RH, proyectos, finanzas y dirección en una sola nube, con Sky como capa de consulta natural.','La evolución actual se enfoca en automatizar checador y nómina, fortalecer Almacén y Compras, reducir búsquedas manuales y dar a Dirección solo la información que requiere una decisión.');
        if(!topics.length)return null;
        const cards=topics.slice(0,8).map(item=>({title:item.label,detail:item.detail}));
        const message=topics.map(item=>item.summary).join(' ');
        setAnswer(topics.length>1?'Resumen del CRM':topics[0].label,message,'Puedo ampliar cualquiera de estos puntos o relacionarlo con datos reales del CRM cuando tu perfil tenga acceso.',cards);
        return {handled:true,voice:message};
    }

    function answerAmbiguity(raw){
        const norm=commandNormalize(raw).replace(/\s+/g,' ').trim();
        const choices={material:['Buscar un material','Ver bajo mínimo','Consultar ubicación'],proyecto:['Ver resumen de un proyecto','Revisar pendientes','Consultar personal del proyecto'],personal:['Buscar trabajador','Consultar horas del checador','Ver asignación a proyecto'],compras:['Revisar cotizaciones','Ver pendientes de compra','Consultar proveedor'],vehiculo:['Ver vehículos disponibles','Consultar un vehículo','Revisar viajes']};
        const key=Object.keys(choices).find(k=>norm===k||norm===`${k}s`);
        if(!key)return null;
        const message=`Entendí ${key}, pero puedo ayudarte de varias formas. Elige una opción o dime qué necesitas con más detalle.`;
        setAnswer('Necesito una precisión',message,'No haré suposiciones sobre el dato que buscas.',choices[key].map(x=>({title:x,detail:'Puedes decirlo con tus propias palabras.'})));
        return{handled:true,voice:message};
    }

    async function answerSimple(raw) {
        const norm = commandNormalize(raw);
        const date = localDateParts();
        captureAreaContext(raw);
        const toolsAnswer=answerToolsUsed(raw);
        if(toolsAnswer)return toolsAnswer;
        const systemKnowledge=answerSystemKnowledge(raw);
        if(systemKnowledge)return systemKnowledge;
        const ambiguity=answerAmbiguity(raw);
        if(ambiguity)return ambiguity;
        const activeProfile = detectProfile();
        if(activeProfile==='tsi'){
            if(/\b(stock|existencia|existencias|disponible|disponibles|hay|cuanto tenemos|cuanto queda|inventario)\b/.test(norm)&&/\b(epp|casco|chaleco|lente|lentes|guante|guantes|arnes|arnés|barbiquejo|bota|equipo)\b/.test(norm)){
                const message='Desde TSI no muestro existencias ni cantidades del almacén. Este perfil se enfoca en solicitar el EPP requerido y dejar la validación interna a Almacén.';
                setAnswer('Visibilidad de EPP',message,'Si quieres, puedo ayudarte a ubicar el EPP correcto, preparar una solicitud o explicarte el flujo de atención.',[{title:'Buscar EPP',detail:'Busca casco dieléctrico · Busca chaleco gabardina azul'},{title:'Preparar solicitud',detail:'Ayúdame a solicitar casco, lentes y chaleco para Juan Pérez'},{title:'Explicar flujo',detail:'¿Cómo se atiende una solicitud de EPP?'}]);
                return {handled:true,voice:message};
            }
            if(/\b(que puedo consultar|que puedes hacer|como me ayudas|en que me ayudas|que puedo pedir|que puedo solicitar|permisos de tsi)\b/.test(norm)){
                const message='En TSI puedo ayudarte a localizar EPP por nombre, preparar solicitudes, consultar proyectos autorizados, explicar procesos del CRM, registrar incidencias y coordinar avisos internos o reuniones.';
                setAnswer('Capacidades en TSI',message,'No expongo existencias del almacén desde este perfil; el objetivo es que TSI pida el equipo necesario de forma simple y ordenada.',[{title:'Solicitudes',detail:'Ayúdame a solicitar casco, lentes y chaleco para Juan Pérez'},{title:'Proyectos',detail:'¿Cómo va el proyecto 26001?'},{title:'Incidencias',detail:'Ayúdame a describir una falla del CRM'},{title:'Coordinación',detail:'Dile a Administración que revisaré la incidencia'}]);
                return {handled:true,voice:message};
            }
        }
        if (/\b(activa|enciende|pon|ponte|inicia)\b.*\b(modo conversacion|modo conversación|escucha continua|manos libres|modo manos libres|modo alexa)\b/.test(norm) || /^(modo conversacion|modo conversación|escucha continua|manos libres)$/.test(norm)) {
            handsFreeEnabled=true;
            try{localStorage.setItem('skilled_sky_handsfree','1')}catch(_){}
            const button=document.getElementById('sky-handsfree');if(button){button.classList.add('is-on');button.textContent='Activo'}
            const message='Modo conversación activado. Después de cada respuesta volveré a escucharte para que puedas continuar sin pulsar el micrófono.';
            setAnswer('Modo conversación activo',message,'Puedes decir “Sky, desactiva el modo conversación” cuando quieras detener la escucha continua.');
            setTimeout(()=>{if(!listening&&!queryBusy)startListening({preserveClearedInput:true}).catch(()=>{})},350);
            return {handled:true,voice:message};
        }
        if (/\b(desactiva|apaga|quita|deten|detén|para)\b.*\b(modo conversacion|modo conversación|escucha continua|manos libres|modo manos libres|modo alexa)\b/.test(norm) || /\b(deja de escuchar|ya no escuches|descansa sky|duerme sky)\b/.test(norm)) {
            handsFreeEnabled=false;
            try{localStorage.setItem('skilled_sky_handsfree','0')}catch(_){}
            clearTimeout(handsFreeTimer);
            const button=document.getElementById('sky-handsfree');if(button){button.classList.remove('is-on');button.textContent='Activar'}
            stopListening(false);
            const message='Modo conversación desactivado. Seguiré disponible cuando vuelvas a llamarme.';
            setAnswer('Modo conversación desactivado',message);
            return {handled:true,voice:message};
        }
        if (/\b(repite|repitelo|repítelo|dilo otra vez|vuelve a decirlo)\b/.test(norm) && lastSpokenText) {
            setAnswer('Te lo repito',lastSpokenText);
            return {handled:true,voice:lastSpokenText};
        }
        if (/\b(callate|cállate|silencio sky|para de hablar|deja de hablar)\b/.test(norm)) {
            try{speechSynthesis.cancel()}catch(_){}
            setAnswer('De acuerdo','Me quedo en silencio.');
            return {handled:true,voice:''};
        }
        const pendingAction=await answerPendingAction(raw);if(pendingAction)return pendingAction;
        const creatorIdentity=answerCreatorIdentity(raw);if(creatorIdentity)return creatorIdentity;
        const chatAction=await answerChatAction(raw);if(chatAction)return chatAction;
        const meetingAction=await answerMeetingAction(raw);if(meetingAction)return meetingAction;
        const presentationHelp=answerPresentationPlaybook(raw);if(presentationHelp)return presentationHelp;
        const crmObjective=answerCRMObjective(raw);if(crmObjective)return crmObjective;
        const areaHelp=answerAreaHelp(raw);if(areaHelp)return areaHelp;
        const navigation=tryNavigation(raw);if(navigation){if(navigation.list){const options=Object.keys(navigationOptions()).map(key=>({title:key,detail:`Puedes decir: abre ${key}`}));setAnswer('Apartados disponibles','Estos son los apartados a los que puedo llevarte desde tu perfil.','No puedo abrir secciones que tu cuenta no tenga autorizadas.',options)}return navigation;}
        if (/\b(que puedes hacer aqui|qué puedes hacer aquí|ayudame aqui|ayúdame aquí|como me ayudas aqui|cómo me ayudas aquí|esta pantalla|esta pagina|esta página)\b/.test(norm)) { const message=pageHelp(); return {handled:true,voice:message}; }
        if (/\b(como estas|cómo estás|como te encuentras|cómo te encuentras|como andas|cómo andas|como vas|cómo vas|todo bien|que tal estas|qué tal estás|como sigue tu evolucion|cómo sigue tu evolución|como te sientes|cómo te sientes|estas lista|estás lista|que novedades|qué novedades|que estas aprendiendo|qué estás aprendiendo)\b/.test(norm)) {
            const message='Aún estoy en evolución, pero estoy lista para ayudarte. Cada versión me permite conversar mejor, entender más contexto de Skilled y relacionar información entre las áreas autorizadas.';
            setAnswer('Estoy lista para ayudarte', message, 'Puedes hablarme como lo harías con una persona. Si necesitas información del CRM, intentaré consultarla; si es una pregunta general, también puedo orientarte, explicar, redactar o ayudarte a razonar una solución.');
            return { handled:true, voice:message };
        }
        if (/^(hola|buenos dias|buenas tardes|buenas noches|que tal|hey)\b/.test(norm)) {
            const profile=detectProfile();
            const message = profile==='sky_demo'
                ? 'Hola. Soy Sky. Estoy en modo demostración seguro. Puedo conversar, consultar información autorizada, enviar avisos por el chat y generar convocatorias; no modificaré inventarios, compras, nómina ni proyectos.'
                : `Hola. Soy Sky. Aún estoy en evolución, pero estoy lista para ayudarte en ${profileNames[profile] || profile}. Dime qué necesitas y lo resolvemos juntos.`;
            setAnswer('Hola', message, profile==='sky_demo' ? 'Háblame con naturalidad. Los datos operativos permanecen protegidos; las acciones de comunicación requieren una instrucción explícita.' : `Puedes hablarme con naturalidad o usar ${shortcutLabel} para activar el micrófono.`);
            return { handled:true, voice:message };
        }
        if (/\b(que buen dia|qué buen día|bonito dia|bonito día|lindo dia|lindo día|hace buen dia|hace buen día|esta bonito el dia|está bonito el día)\b/.test(norm)) {
            const message='Sí, suena a un buen día para avanzar. Yo sigo aquí, aún en evolución pero lista para ayudarte con lo que necesites dentro del CRM o con una consulta general.';
            setAnswer('Buen día', message, 'Si quieres información meteorológica exacta necesitaría una fuente de clima conectada; para conversar contigo no hace falta un comando especial.');
            return {handled:true,voice:message};
        }
        if (/\b(gracias|muchas gracias|te agradezco)\b/.test(norm)) {
            const message='Con gusto. Cuando necesites otra consulta, aquí estoy.';
            setAnswer('Sky', message);
            return { handled:true, voice:message };
        }
        if (/\b(buen trabajo|muy bien|excelente|eso es todo|perfecto sky|bien hecho|te rifaste|te la rifaste)\b/.test(norm)) {
            const message='Gracias. Sigo aprendiendo con cada mejora, pero ya estoy lista para seguir ayudándote. ¿Qué hacemos ahora?';
            setAnswer('Gracias',message,'Puedes continuar con otra pregunta sin repetir el contexto si estamos hablando del mismo material, proyecto, proveedor o persona.');
            return {handled:true,voice:message};
        }
        if (/\b(estas ahi|estás ahí|sigues ahi|sigues ahí|me escuchas|me oyes|andas por ahi|andas por ahí)\b/.test(norm)) {
            const message='Aquí estoy y te escucho. Dime qué necesitas.';
            setAnswer('Aquí estoy',message);
            return {handled:true,voice:message};
        }
        if (/\b(buen dia|buen día|feliz dia|feliz día|bonita tarde|bonita noche)\b/.test(norm) && !/que buen dia|hace buen dia/.test(norm)) {
            const message='Igualmente. Que tengas un buen día. Yo estoy lista para ayudarte cuando quieras.';
            setAnswer('Buen día',message);
            return {handled:true,voice:message};
        }
        if (/\b(que hora es|dime la hora|hora actual|que horas son)\b/.test(norm)) {
            const message=`Son las ${date.time}.`;
            setAnswer('Hora actual', message, 'Hora tomada del dispositivo que estás utilizando.', [{ title:'Hoy', detail:capitalize(date.dateLong) }]);
            return { handled:true, voice:message };
        }
        if (/\b(que dia es hoy|que fecha es hoy|fecha de hoy|que fecha es|en que dia estamos)\b/.test(norm)) {
            const message=`Hoy es ${date.dateLong}.`;
            setAnswer('Fecha de hoy', capitalize(date.dateLong), `Hora actual: ${date.time}.`);
            return { handled:true, voice:message };
        }
        if (/\b(que dia de la semana|dia de la semana)\b/.test(norm)) {
            const message=`Hoy es ${date.weekday}.`;
            setAnswer('Día de la semana', capitalize(date.weekday), capitalize(date.dateLong));
            return { handled:true, voice:message };
        }
        if (/\b(que mes|mes actual|en que mes)\b/.test(norm)) {
            const message=`Estamos en ${date.month}.`;
            setAnswer('Mes actual', capitalize(date.month), `Año ${date.year}.`);
            return { handled:true, voice:message };
        }
        if (/\b(que ano|ano actual|en que ano)\b/.test(norm)) {
            const message=`Estamos en ${date.year}.`;
            setAnswer('Año actual', String(date.year), capitalize(date.dateLong));
            return { handled:true, voice:message };
        }
        if (/\b(busca(?:r)? en internet|busca(?:r)? en la web|investiga(?:r)? en internet|googlea|googlear|busqueda web)\b/.test(norm)) {
            let term=text(raw).replace(/^(?:sky[,;:\s-]*)?/i,'').replace(/\b(?:busca(?:r)? en internet|busca(?:r)? en la web|investiga(?:r)? en internet|googlea(?:r)?|busqueda web)\b/ig,'').replace(/^[,:;\s-]+/,'').trim();
            if (!term) {
                const message='Dime qué quieres buscar. Por ejemplo: “busca en internet ficha técnica de cable THW”.';
                setAnswer('Búsqueda en Internet',message,'Por seguridad Sky no ejecuta ni instala contenido de sitios externos.');
                return {handled:true,voice:message};
            }
            const href=`https://www.google.com/search?q=${encodeURIComponent(term)}`;
            const message=`Preparé una búsqueda web de ${term}.`;
            setAnswer('Búsqueda en Internet',message,'Pulsa “Abrir búsqueda web” para revisar resultados en una pestaña nueva. La información externa no modifica datos del CRM.',[],{href,label:'Abrir búsqueda web'});
            return {handled:true,voice:message};
        }
        if (/\b(para que te crearon|para que te desarrollaron|cual es tu proposito|cuál es tu propósito|para que sirve sky)\b/.test(norm)) {
            const message='Fui desarrollado para ayudar a Skilled Proyectos Industriales a consultar información, orientar procesos y resolver situaciones dentro de los apartados autorizados del CRM de una forma más rápida y natural.';
            setAnswer('Propósito de Sky', message, 'Puedo adaptar mis consultas al perfil activo y usar contexto de la conversación para entender preguntas de seguimiento.');
            return {handled:true,voice:message};
        }
        if (/\b(presentate|preséntate|haz tu presentacion|presentacion de sky|quien eres|como te llamas|cual es tu nombre)\b/.test(norm)) {
            let cached={}; try{cached=JSON.parse(localStorage.getItem('skilled_profile_cache')||'null')||{}}catch(_){}
            const userName=text(window.SkilledSession?.profile?.nombre || cached.nombre || '').split(/\s+/)[0] || 'usuario';
            const profile=detectProfile();
            const area=profileNames[profile] || profile;
            const message=profile==='sky_demo'
                ? `Hola ${userName}. Soy Sky. El ING. Leobardo Hernández Jerónimo está creándome y enseñándome cómo debo funcionar para apoyar a Skilled Proyectos Industriales. En esta demostración puedo conversar, consultar información autorizada, enviar avisos internos y generar reuniones sin modificar registros operativos. Aún sigo creciendo, así que cuando algo todavía no esté conectado te lo diré con claridad.`
                : `Hola ${userName}. Soy Sky, el asistente de Skilled para ${area}. Puedo entender consultas formales y expresiones comunes de trabajo, buscar información autorizada del CRM, explicar resultados y ayudarte a llegar al apartado correcto. Mis consultas son de lectura para proteger la operación.`;
            setAnswer('Mucho gusto, soy Sky', message, profile==='sky_demo' ? 'Puedes comenzar con: “Soy planeador, ¿en qué me puedes ayudar?”, “Soy de Finanzas”, “Soy de Logística” o simplemente preguntarme por un proyecto, material, proveedor, trabajador, vehículo o dato que esté conectado.' : `Puedes hablarme de forma natural. Por ejemplo: “¿cuánto nos queda de tubo de una pulgada?”, “¿dónde dejaron el taladro?” o “¿cómo vamos con el proyecto 2508?”. Atajo: ${shortcutLabel}.`,
                profile==='sky_demo' ? [{title:'Conversación por área',detail:'Me dices de qué área eres y adapto mis ejemplos y capacidades.'},{title:'Consulta transversal',detail:'Puedo reunir datos autorizados de varias áreas sin mostrar sus módulos operativos.'},{title:'En crecimiento',detail:'Si una función aún no está disponible, lo reconoceré y te diré qué sí puedo hacer hoy.'}] : [{title:'Consulta natural',detail:'Puedes usar frases completas o modismos comunes.'},{title:'Contexto por perfil',detail:`Ahora estoy trabajando como asistente de ${area}.`},{title:'Modo seguro',detail:'No modifico inventario ni autorizaciones solo por voz.'}]);
            return { handled:true, voice:message };
        }
        if (/\b(que perfil|en que perfil|perfil actual|donde estoy)\b/.test(norm)) {
            const name=profileNames[detectProfile()] || detectProfile();
            const message=`Estás trabajando en el perfil de ${name}.`;
            setAnswer('Perfil actual', name, `Rol de la sesión: ${currentRole()}.`);
            return { handled:true, voice:message };
        }
        if (/\b(que pagina|que seccion|en que pagina|en que seccion)\b/.test(norm)) {
            const rawFile = (location.pathname.split('/').pop() || 'inicio').replace(/\.html?$/i,'').replace(/^[A-Z]{2}\./i,'').replace(/[._-]+/g,' ');
            const section = rawFile ? rawFile.charAt(0).toUpperCase()+rawFile.slice(1) : 'Inicio';
            const message=`Estás en la sección ${section}.`;
            setAnswer('Sección actual', section, `Perfil: ${profileNames[detectProfile()] || detectProfile()}.`);
            return { handled:true, voice:message };
        }
        if (/\b(atajo|como te activo|como activar sky|tecla para sky)\b/.test(norm)) {
            const message=`Mi atajo es ${shortcutLabel}. Con Sky abierto, el mismo atajo inicia o termina la escucha.`;
            setAnswer('Atajo de Sky', shortcutLabel, 'Puedes usarlo desde cualquier sección que tenga Sky activo.');
            return { handled:true, voice:message };
        }
        if (/\b(quien inicio sesion|quien soy|mi usuario|mi nombre)\b/.test(norm)) {
            let cached={}; try{cached=JSON.parse(localStorage.getItem('skilled_profile_cache')||'null')||{}}catch(_){}
            const name=text(window.SkilledSession?.profile?.nombre || cached.nombre || window.SkilledSession?.user?.email || cached.email || 'Usuario');
            const message=`La sesión actual corresponde a ${name}.`;
            setAnswer('Sesión actual', name, `Rol: ${currentRole()}.`);
            return { handled:true, voice:message };
        }
        if (/\b(repite|repetir|dilo otra vez|otra vez)\b/.test(norm)) {
            const message=lastSpokenText || 'Todavía no tengo una respuesta anterior para repetir.';
            setAnswer('Repetir', message);
            return { handled:true, voice:message };
        }
        if (/\b(callate|silencio|deja de hablar|para de hablar)\b/.test(norm)) {
            try { speechSynthesis.cancel(); } catch (_) {}
            setAnswer('Sky', 'De acuerdo. Detuve la voz.', 'Puedes seguir consultando por texto.');
            return { handled:true, voice:'' };
        }
        if (/\b(que puedes hacer|ayuda|comandos|como te uso|que sabes hacer)\b/.test(norm)) {
            const config=profileConfig();
            if(detectProfile()==='sky_demo'){
                const areas=Object.values(skyAreaCatalog).map(entry=>({title:entry.label,detail:`Dime: “Soy de ${entry.label}, ¿en qué me puedes ayudar?”`}));
                const message='Puedo conversar con personal de distintas áreas, explicar qué puedo hacer por cada una, responder consultas transversales y ejecutar comunicación interna cuando me das una instrucción explícita. Los registros operativos siguen protegidos.';
                setAnswer('¿Cómo puede ayudarte Sky?',message,'Puedes presentarte por tu área o preguntarme directamente por materiales, proyectos, personal, proveedores, compras, costos, vehículos, herramientas o resguardos. Si un dato aún no está conectado, te lo diré con claridad.',areas.slice(0,8));
                return {handled:true,voice:message};
            }
            const cards=[...config.examples.slice(0,5).map(([label,example])=>({title:label,detail:example})),{title:'Hora y fecha',detail:'¿Qué hora es? · ¿Qué día es hoy?'},{title:'Cálculo rápido',detail:'¿Cuánto es 25 por 8?'},{title:'Sección actual',detail:'¿En qué sección estoy?'},{title:'Navegación',detail:'Abre vehículos · Ve a proveedores · Llévame a equipos'},{title:'Contexto',detail:'Puedes continuar con: ¿y dónde está? · ¿y cuánto queda?'},{title:'Atajo',detail:'¿Cuál es tu atajo?'},{title:'Reunión general',detail:'Convoca una reunión general.'},{title:'Internet',detail:'Busca en internet ficha técnica de…'}];
            const message=`Puedo ayudarte con consultas de ${profileNames[detectProfile()] || detectProfile()}, además de hora, fecha, cálculos sencillos y ayuda general.`;
            setAnswer('Comandos de Sky', message, `Habla de forma natural. No necesitas decir “Sky” al inicio. Atajo: ${shortcutLabel}.`, cards);
            return { handled:true, voice:message };
        }
        const math=simpleMath(raw);
        if (math) {
            if (math.error) { setAnswer('Cálculo', math.error); return {handled:true,voice:math.error}; }
            const symbol={'+':'más','-':'menos','*':'por','/':'entre'}[math.op];
            const message=`${formatNumber(math.a)} ${symbol} ${formatNumber(math.b)} es ${formatNumber(math.result)}.`;
            setAnswer('Cálculo rápido', formatNumber(math.result), `${formatNumber(math.a)} ${math.op} ${formatNumber(math.b)}`);
            return { handled:true, voice:message };
        }
        return { handled:false, voice:'' };
    }

    async function answerCategories(raw) {
        const profile=detectProfile();
        if (!(isExecutiveReadProfile(profile) || ['almacen','compras','proyectos','planeacion','coordinacion','logistica','administrador','tsi'].includes(profile))) return null;
        let rows=[];
        try { rows=await loadData('categories'); } catch (_) {
            const materials=await loadData('materials');
            rows=[...new Set(materials.map(item=>text(item.categoria)).filter(Boolean))].map(nombre=>({nombre}));
        }
        const names=[...new Set((rows||[]).map(item=>text(item.nombre||item.categoria||item)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
        const cards=names.slice(0,14).map(name=>({title:name,detail:'Categoría activa del catálogo'}));
        const message=`El catálogo tiene ${names.length} categoría${names.length===1?'':'s'} registrada${names.length===1?'':'s'}.`;
        setAnswer('Categorías del almacén',message,names.length>cards.length?`Te muestro ${cards.length} de ${names.length}. Puedes pedirme una categoría por nombre.`:'Estas son las categorías disponibles.',cards,profile==='almacen'?{href:'AL.catalogo.html',label:'Abrir catálogo'}:null);
        rememberConversation('categories','categorías del almacén',raw);
        return message;
    }

    function executiveSearchTerms(raw){
        const expanded=expandEntityAliases(stripWakeWord(raw));
        const tokens=normalize(expanded).split(' ').filter(token=>token.length>=3&&!new Set(['quien','quién','cual','cuales','dime','busca','buscar','muestra','mostrar','quiero','saber','sobre','informacion','información','dato','datos','tiene','tenemos','esta','estan','para','con','del','las','los','una','uno']).has(token));
        const terms=[];
        if(tokens.length)terms.push(tokens.join(' '));
        tokens.filter(token=>token.length>=3).forEach(token=>terms.push(token));
        if(!terms.length&&text(expanded))terms.push(text(expanded));
        return [...new Set(terms)].slice(0,5);
    }

    function executiveHitCard(hit){
        const type=text(hit?.tipo||hit?.type||'resultado');
        const title=text(hit?.titulo||hit?.title||hit?.nombre||hit?.codigo||'Resultado');
        const detail=text(hit?.detalle||hit?.detail||hit?.descripcion||'');
        return {title:`${title}`,detail:`${type}${detail?` · ${detail}`:''}`};
    }

    async function answerExecutiveGlobalSearch(raw) {
        if (!isExecutiveReadProfile()) return null;
        const query=expandEntityAliases(stripWakeWord(raw));
        const searchTerms=executiveSearchTerms(query);
        if (!text(query) || commandNormalize(query).split(' ').length===1 && /^(hola|gracias|sky)$/.test(commandNormalize(query))) return null;
        let hits=[];
        if (typeof SkilledDB.searchExecutiveSky==='function') {
            try {
                const batches=await Promise.all(searchTerms.map(term=>SkilledDB.searchExecutiveSky(term).catch(()=>[])));
                hits=batches.flat();
            } catch (_) { hits=[]; }
        }
        if (!hits.length) {
            const [materials,people,purchases,tools,warehouses,vehicles,projects]=await Promise.all([
                loadData('materials').catch(()=>[]),
                typeof SkilledDB.listExecutiveSkyPeople==='function'?SkilledDB.listExecutiveSkyPeople('').catch(()=>[]):[],
                typeof SkilledDB.getExecutiveSkyPurchasing==='function'?SkilledDB.getExecutiveSkyPurchasing().catch(()=>({})):Promise.resolve({}),
                loadData('executiveTools').catch(()=>[]),loadData('executiveWarehouses').catch(()=>[]),loadData('vehicles').catch(()=>[]),
                typeof SkilledDB.getExecutiveProjectSummary==='function'?SkilledDB.getExecutiveProjectSummary().catch(()=>[]):[]
            ]);
            const add=(tipo,rows,fields,titleFn,detailFn)=>{
                const ranked=window.SkilledSearch?.rank?window.SkilledSearch.rank(rows,query,item=>fields(item)):rows.filter(item=>matchesTokens(fields(item),searchTokens(query)));
                ranked.slice(0,6).forEach(item=>hits.push({tipo,titulo:titleFn(item),detalle:detailFn(item)}));
            };
            add('Material',materials,m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca,...(m.modismos||[])],m=>`${m.codigo||'—'} · ${m.descripcion||m.desc||'Material'}`,m=>`${formatNumber(m.stock)} ${m.unidad||''} · ${m.categoria||'Sin categoría'}`);
            add('Persona',people,p=>[p.numero_empleado,p.nombre,p.apellidos,p.puesto,p.departamento,p.correo],p=>`${p.nombre||''} ${p.apellidos||''}`.trim(),p=>`${p.puesto||'Sin puesto'} · ${p.departamento||'Sin departamento'}`);
            add('Herramienta',tools,t=>[t.sku,t.descripcion,t.clasificacion,t.marca,t.modelo],t=>`${t.sku||'—'} · ${t.descripcion||'Herramienta'}`,t=>`${formatNumber(t.disponibles)} disponibles`);
            add('Almacén',warehouses,w=>[w.nombre,w.tipo,w.ubicacion,w.encargado],w=>w.nombre||'Almacén',w=>`${w.ubicacion||'Sin ubicación'} · ${formatNumber(w.materiales)} materiales`);
            add('Vehículo',vehicles,v=>[v.nombre,v.nombreVehiculo,v.placas,v.tipo,v.marca,v.modelo,v.proyecto],v=>v.nombre||v.nombreVehiculo||v.placas||'Vehículo',v=>`${v.tipo||''} · ${v.estado||'sin estado'}`);
            add('Proyecto',projects,pr=>[pr.proyecto,pr.nombre,pr.cliente,pr.responsable,pr.estado],pr=>`${pr.proyecto||'—'} · ${pr.nombre||'Proyecto'}`,pr=>`${pr.cliente||'Sin cliente'} · ${pr.estado||'sin estado'}`);
            const providers=[...(purchases.proveedores||[]),...(purchases.material_proveedores||[])];
            add('Proveedor',providers,v=>[v.razon_social,v.nombre_comercial,v.proveedor_nombre,v.rfc,v.contacto,v.email,v.telefono,v.whatsapp,v.descripcion,v.material_codigo],v=>v.nombre_comercial||v.razon_social||v.proveedor_nombre||'Proveedor',v=>v.contacto||v.email||v.descripcion||v.material_codigo||'');
        }
        const unique=[];const seen=new Set();
        for(const hit of hits){const key=normalize(`${hit.tipo}|${hit.titulo}|${hit.detalle}`);if(!key||seen.has(key))continue;seen.add(key);unique.push(hit);if(unique.length>=18)break;}
        if(!unique.length)return null;
        const cards=unique.slice(0,12).map(executiveHitCard);
        const message=`Encontré ${unique.length} coincidencia${unique.length===1?'':'s'} relacionada${unique.length===1?'':'s'} con “${text(raw)}” en la información autorizada del CRM.`;
        setAnswer('Búsqueda transversal',message,'Busqué entre materiales, personas, proyectos, proveedores, herramientas, almacenes y vehículos. Puedes continuar con “¿y cuánto?”, “¿dónde está?” o “dame más detalle”.',cards);
        rememberConversation('global_search',text(unique[0]?.titulo||query),query);
        return message;
    }

    async function answerWarehouse(raw) {
        const norm = commandNormalize(raw);
        if ((/prepar|picking|ruta/.test(norm) || hasFuzzy(norm,['preparar ruta','ruta de picking'])) && (/proyecto/.test(norm) || hasFuzzy(norm,['proyecto']))) return answerProjectRoute(raw);
        if (/bajo.*min|agotad|urge.*compr|reponer|reposicion/.test(norm) || hasFuzzy(norm,['bajo minimo','reponer material'])) return answerLowStock();
        if (/orden.*compra|\boc\b|folio.*compra|estado.*orden/.test(norm) || hasFuzzy(norm,['orden de compra'])) return answerPurchase(raw);
        if (/herramient|taladro|esmeril|soldador|multimetro|pinza|llave/.test(norm) || hasFuzzy(norm,['herramienta','herramientas'])) return answerTools(raw);
        if (/vehiculo|vehiculos|pickup|camioneta|automovil|van\b|camion\b|motocicleta|montacargas|generador|maquinaria/.test(norm) || hasFuzzy(norm,['vehiculo','vehiculos'])) return answerVehicles(raw);
        if ((/proyecto/.test(norm) || hasFuzzy(norm,['proyecto'])) && (/(avance|estado|costo|como|cuanto|entrega)/.test(norm) || hasFuzzy(norm,['avance','estado','costo','entrega']))) return answerProjects(raw);
        const fleet = await loadData('vehicles');
        const namedVehicle = fleet.find(item => {
            const name=normalize(item.numeroEconomico);
            return name && name.length>=3 && (norm.includes(name) || fuzzyIncludes(norm,name,1));
        });
        if (namedVehicle) return answerVehicles(raw);
        if (isMaterialFamilyQuery(raw)) return answerMaterialFamily(raw);
        if (/donde|ubicacion|ubicado|localiza|encuentra/.test(norm) || hasFuzzy(norm,['donde esta','ubicacion','localiza'])) return answerMaterial(raw, true);
        return answerMaterial(raw, false);
    }

    function executiveProjectCandidate(rows, raw) {
        const norm = commandNormalize(raw);
        const explicit = (norm.match(/\b\d{3,12}\b/g) || []).find(value => rows.some(row => text(row.proyecto) === text(value)));
        if (explicit) return rows.find(row => text(row.proyecto) === text(explicit)) || null;
        return rows.find(row => [row.proyecto,row.nombre,row.cliente,row.responsable].some(value => value && norm.includes(commandNormalize(value)))) || null;
    }

    async function answerExecutiveInventorySummary() {
        const rows = await loadData('materials');
        const active = rows.filter(item => item.activo !== false);
        const cables = active.filter(item => /^(cable|cables)$/i.test(text(item.categoria)));
        const total = active.reduce((sum,item)=>sum+(Array.isArray(item.almacenes)?item.almacenes.reduce((sub,row)=>sub+number(row.stock),0):number(item.stock)),0);
        const cards=[
            {title:'Materiales activos',detail:String(active.length)},
            {title:'Materiales de cable',detail:String(cables.length)},
            {title:'Existencia acumulada',detail:formatNumber(total)},
            {title:'Almacenes con material',detail:String(new Set(active.flatMap(item=>(item.almacenes||[]).filter(row=>number(row.stock)>0).map(row=>row.nombre)).filter(Boolean)).size)}
        ];
        setAnswer('Resumen de inventario', `${active.length} materiales activos están registrados en el catálogo.`, 'La existencia acumulada mezcla unidades de medida distintas; úsala solo como referencia general.', cards);
        return `Hay ${active.length} materiales activos registrados en el catálogo. De ellos, ${cables.length} pertenecen a Cable o Cables.`;
    }

    async function answerExecutivePeople(raw, projectRows = []) {
        const norm = commandNormalize(raw);
        const explicitProject = (norm.match(/\b\d{3,12}\b/g) || [])[0] || '';
        const candidate = executiveProjectCandidate(Array.isArray(projectRows) ? projectRows : [], raw);
        const projectNumber = text(candidate?.proyecto || explicitProject);
        const rows = await SkilledDB.listExecutiveSkyPeople(projectNumber);
        if (projectNumber) {
            const projectName = candidate?.nombre ? ` · ${candidate.nombre}` : '';
            const cards = rows.slice(0, 12).map(item => ({ title: item.nombre || item.numero_empleado || 'Colaborador', detail: `${item.puesto || 'Sin puesto'}${item.rol_proyecto ? ` · ${item.rol_proyecto}` : ''}${item.porcentaje_dedicacion ? ` · ${formatNumber(item.porcentaje_dedicacion)}%` : ''}` }));
            setAnswer('Personal del proyecto', rows.length ? `${projectNumber}${projectName} tiene ${rows.length} persona${rows.length === 1 ? '' : 's'} activa${rows.length === 1 ? '' : 's'} asignada${rows.length === 1 ? '' : 's'}.` : `${projectNumber}${projectName} no tiene personal activo asignado.`, rows.length ? 'La información proviene de las asignaciones activas registradas por RH y es de solo lectura.' : 'RH todavía no registra asignaciones activas para ese proyecto.', cards);
            return rows.length ? `El proyecto ${projectNumber} tiene ${rows.length} personas activas asignadas. ${rows.slice(0,6).map(item => item.nombre).filter(Boolean).join(', ')}.` : `El proyecto ${projectNumber} no tiene personal activo asignado.`;
        }
        const tokens = searchTokens(raw, ['cuanto','cuantos','cuanta','cuantas','persona','personas','personal','trabajador','trabajadores','colaborador','colaboradores','empleado','empleados','activo','activos','tenemos','tengo','hay','rh','recursos','humanos']);
        if (tokens.length) {
            const matches = rows.filter(item => matchesTokens([item.numero_empleado,item.nombre,item.puesto,item.departamento], tokens));
            const cards = matches.slice(0, 12).map(item => ({ title: item.nombre || item.numero_empleado || 'Colaborador', detail: `${item.numero_empleado || 'sin número'} · ${item.puesto || 'sin puesto'} · ${item.departamento || 'sin departamento'}` }));
            setAnswer('Personal', matches.length ? `${matches.length} persona${matches.length === 1 ? '' : 's'} coincide${matches.length === 1 ? '' : 'n'} con la consulta.` : 'No encontré personal activo con ese criterio.', 'Consulta ejecutiva de solo lectura.', cards);
            return matches.length ? `Encontré ${matches.length} personas activas relacionadas.` : 'No encontré personal activo con ese criterio.';
        }
        setAnswer('Personal activo', `${rows.length} trabajador${rows.length === 1 ? '' : 'es'} activo${rows.length === 1 ? '' : 's'} registrado${rows.length === 1 ? '' : 's'} en RH.`, 'Sky puede consultar personal sin abrir el módulo de Recursos Humanos.', []);
        return `Hay ${rows.length} trabajadores activos registrados en Recursos Humanos.`;
    }

    async function answerExecutivePurchasing(raw) {
        const norm = commandNormalize(raw);
        const data = await SkilledDB.getExecutiveSkyPurchasing();
        const providers = Array.isArray(data.proveedores) ? data.proveedores : [];
        const requests = Array.isArray(data.solicitudes) ? data.solicitudes : [];
        const quotations = Array.isArray(data.cotizaciones) ? data.cotizaciones : [];
        const supplierRequests = Array.isArray(data.solicitudes_proveedor) ? data.solicitudes_proveedor : [];
        const communications = Array.isArray(data.comunicaciones) ? data.comunicaciones : [];
        const providerMaterials = Array.isArray(data.material_proveedores) ? data.material_proveedores : [];
        cache.coSuppliers = providers;
        cache.coProviderMaterials = providerMaterials;
        cache.at = Date.now();
        if (/quien.*vende|quién.*vende|quien.*surte|quién.*surte|quien.*maneja|quién.*maneja|proveedor.*material|proveedores.*material|vende.*material|surte.*material/.test(norm)) {
            const tokens = searchTokens(raw, ['quien','quién','vende','venden','surte','surten','maneja','manejan','proveedor','proveedores','material','materiales','dime','busca','buscar','necesito','quiero']);
            const query = tokens.join(' ');
            const matches = window.SkilledSearch?.rank
                ? window.SkilledSearch.rank(providerMaterials, query, item => [item.material_codigo,item.descripcion,item.marca,item.categoria,item.unidad,item.proveedor_nombre,item.proveedor_rfc])
                : providerMaterials.filter(item => !tokens.length || matchesTokens([item.material_codigo,item.descripcion,item.marca,item.categoria,item.unidad,item.proveedor_nombre], tokens));
            const cards = matches.slice(0, 10).map(item => ({
                title: `${item.proveedor_nombre || 'Proveedor'} · ${item.material_codigo || 'material'}`,
                detail: `${item.descripcion || 'Sin descripción'}${number(item.precio_unitario)>0 ? ` · ${currency(item.precio_unitario)} ${item.moneda || 'MXN'}` : ''}${number(item.plazo_entrega_dias)>0 ? ` · ${formatNumber(item.plazo_entrega_dias)} días` : ''}${item.proveedor_contacto ? ` · ${item.proveedor_contacto}` : ''}${item.proveedor_email ? ` · ${item.proveedor_email}` : ''}${item.proveedor_whatsapp || item.proveedor_telefono ? ` · WA ${item.proveedor_whatsapp || item.proveedor_telefono}` : ''}`
            }));
            setAnswer('Proveedores por material', matches.length ? `${matches.length} opción${matches.length===1?'':'es'} de proveedor coincide${matches.length===1?'':'n'} con el material.` : 'No encontré proveedores vinculados a ese material.', 'Consulta ejecutiva de solo lectura con el catálogo de precios y proveedores de Compras.', cards);
            return matches.length ? `Encontré ${matches.length} opciones de proveedor para ese material.` : 'No encontré proveedores vinculados a ese material.';
        }
        if (/mensaj|comunicacion|comunicación|correo.*envi|whatsapp.*envi/.test(norm)) {
            const emailSent=communications.filter(item=>normalize(item.canal)==='email'&&normalize(item.estado)==='enviado').length;
            const waSent=communications.filter(item=>normalize(item.canal)==='whatsapp'&&normalize(item.estado)==='enviado').length;
            const errors=communications.filter(item=>normalize(item.estado)==='error').length;
            setAnswer('Comunicaciones con proveedores', `${emailSent} correos y ${waSent} WhatsApp registrados como enviados en los últimos 30 días.`, `${errors} intento${errors===1?'':'s'} con error. Consulta ejecutiva de solo lectura.`, [{title:'Correos enviados',detail:String(emailSent)},{title:'WhatsApp enviados',detail:String(waSent)},{title:'Errores',detail:String(errors)}]);
            return `Se registran ${emailSent} correos y ${waSent} mensajes de WhatsApp enviados a proveedores en los últimos 30 días.`;
        }
        if (/proveedor|rfc|contacto|whatsapp|correo|email|telefono/.test(norm)) {
            const tokens = searchTokens(raw, ['proveedor','proveedores','rfc','contacto','whatsapp','correo','email','telefono','busca','buscar','dime','del','de','numero','número']);
            const matches = window.SkilledSearch?.rank ? window.SkilledSearch.rank(providers,tokens.join(' '),item=>[item.razon_social,item.nombre_comercial,item.rfc,item.contacto,item.email,item.telefono,item.whatsapp,item.categoria]) : providers.filter(item => !tokens.length || matchesTokens([item.razon_social,item.nombre_comercial,item.rfc,item.contacto,item.email,item.telefono,item.whatsapp,item.categoria], tokens));
            const cards = matches.slice(0, 10).map(item => ({ title: item.nombre_comercial || item.razon_social || 'Proveedor', detail: `${item.rfc || 'RFC pendiente'} · ${item.contacto || 'sin contacto'}${item.email ? ` · ${item.email}` : ''}${item.whatsapp || item.telefono ? ` · WA ${item.whatsapp || item.telefono}` : ''}` }));
            if(matches.length){conversationContext.supplier={id:matches[0].id,nombre:text(matches[0].nombre_comercial||matches[0].razon_social)};saveConversationContext();}
            setAnswer('Proveedores', matches.length ? `${matches.length} proveedor${matches.length === 1 ? '' : 'es'} coincide${matches.length === 1 ? '' : 'n'} con la consulta.` : 'No encontré un proveedor con ese criterio.', 'Consulta ejecutiva de solo lectura. Sky no abre los módulos operativos de Compras.', cards);
            return matches.length ? `Encontré ${matches.length} proveedores relacionados.` : 'No encontré ese proveedor.';
        }
        if (/solicitud.*proveedor|proveedor.*solicitud|enviad.*proveedor|pendiente.*envio|pendiente.*envío/.test(norm)) {
            const pending=supplierRequests.filter(item=>!item.fecha_envio_correo&&!item.fecha_envio_whatsapp&&!/cancelad|cerrad/i.test(normalize(item.estado)));
            const sent=supplierRequests.filter(item=>item.fecha_envio_correo||item.fecha_envio_whatsapp||/enviad/i.test(normalize(item.estado)));
            const cards=pending.slice(0,10).map(item=>({title:`${item.numero || 'Solicitud'} · ${item.proveedor_nombre || 'Proveedor'}`,detail:`OC ${item.orden_compra || '—'} · ${item.estado || 'pendiente'} · ${item.proveedor_email || item.proveedor_whatsapp || 'contacto pendiente'}`}));
            setAnswer('Solicitudes a proveedores', `${pending.length} pendientes de envío y ${sent.length} con al menos un envío registrado.`, 'Consulta ejecutiva de solo lectura.', cards);
            return `Hay ${pending.length} solicitudes a proveedores pendientes de envío y ${sent.length} enviadas.`;
        }
        const closedRequest = item => /recibid|cerrad|cancelad|rechazad|realizada|complet/i.test(normalize(item.estado_compras || item.estado));
        const openRequests = requests.filter(item => !closedRequest(item));
        const openQuotes = quotations.filter(item => !/aprobada|rechazada|cerrada/i.test(normalize(item.estado)));
        if (/cotiz/.test(norm)) {
            const cards = openQuotes.slice(0, 10).map(item => ({ title: item.folio || 'Cotización', detail: `${item.estado || 'solicitada'} · ${item.prioridad || 'normal'}${item.fecha_requerida ? ` · requerida ${dateOnly(item.fecha_requerida)}` : ''}` }));
            setAnswer('Cotizaciones', openQuotes.length ? `${openQuotes.length} cotización${openQuotes.length === 1 ? '' : 'es'} sigue${openQuotes.length === 1 ? '' : 'n'} abierta${openQuotes.length === 1 ? '' : 's'}.` : 'No hay cotizaciones abiertas.', 'Consulta ejecutiva de solo lectura.', cards);
            return openQuotes.length ? `Hay ${openQuotes.length} cotizaciones abiertas.` : 'No hay cotizaciones abiertas.';
        }
        const cards = openRequests.slice(0, 10).map(item => ({ title: item.orden_compra || item.folio || item.material_codigo || 'Compra pendiente', detail: `${item.estado_compras || item.estado || 'pendiente'} · ${item.proveedor || item.proveedor_nombre || 'proveedor pendiente'}` }));
        setAnswer('Compras', `${openRequests.length} solicitud${openRequests.length === 1 ? '' : 'es'} u orden${openRequests.length === 1 ? '' : 'es'} pendiente${openRequests.length === 1 ? '' : 's'} y ${openQuotes.length} cotización${openQuotes.length === 1 ? '' : 'es'} abierta${openQuotes.length === 1 ? '' : 's'}.`, 'Sky consulta Compras sin habilitar sus pantallas en Dirección.', cards);
        return `Hay ${openRequests.length} compras pendientes y ${openQuotes.length} cotizaciones abiertas.`;
    }

    async function answerExecutiveTools(raw) {
        const rows = await SkilledDB.getExecutiveSkyTools();
        const norm = commandNormalize(raw);
        const available = rows.filter(item => /disponible/i.test(text(item.estado)));
        const assigned = rows.filter(item => /asignad|prest/i.test(text(item.estado)));
        const maintenance = rows.filter(item => /manten|repar/i.test(text(item.estado)));
        const tokens = searchTokens(raw, ['herramienta','herramientas','cuanto','cuantos','cuanta','cuantas','tenemos','hay','disponible','disponibles','asignada','asignadas','mantenimiento']);
        const filtered = tokens.length ? rows.filter(item => matchesTokens([item.codigo,item.descripcion,item.nombre,item.marca,item.modelo,item.estado], tokens)) : rows;
        if (tokens.length && filtered.length !== rows.length) {
            const cards = filtered.slice(0,12).map(item=>({title:`${item.codigo || '—'} · ${item.descripcion || item.nombre || 'Herramienta'}`,detail:`${item.estado || 'sin estado'}${item.marca ? ` · ${item.marca}` : ''}`}));
            setAnswer('Herramientas', `${filtered.length} herramienta${filtered.length===1?'':'s'} coincide${filtered.length===1?'':'n'} con la consulta.`, 'Consulta ejecutiva de solo lectura.', cards);
            return `Encontré ${filtered.length} herramientas relacionadas.`;
        }
        setAnswer('Herramientas', `${rows.length} herramientas registradas.`, `${available.length} disponibles · ${assigned.length} asignadas · ${maintenance.length} en mantenimiento.`, [{title:'Disponibles',detail:String(available.length)},{title:'Asignadas',detail:String(assigned.length)},{title:'Mantenimiento',detail:String(maintenance.length)}]);
        return `Hay ${rows.length} herramientas registradas: ${available.length} disponibles, ${assigned.length} asignadas y ${maintenance.length} en mantenimiento.`;
    }

    async function answerExecutiveWarehouses(raw) {
        const rows = await loadData('executiveWarehouses', true);
        const norm = commandNormalize(raw);
        const tokens = searchTokens(raw, ['almacen','almacenes','bodega','bodegas','cuanto','cuantos','cuanta','cuantas','tenemos','tengo','hay','dime','lista','listar']);
        const filtered = tokens.length ? rows.filter(item => matchesTokens([item.nombre,item.tipo,item.ubicacion,item.encargado], tokens)) : rows;
        const active = filtered.filter(item => !/inactiv|baja|cerrad/.test(normalize(item.estado)));
        const cards = active.slice(0,10).map(item=>({title:item.nombre||'Almacén',detail:`${item.tipo||'sin tipo'} · ${formatNumber(item.materiales||0)} materiales · ${formatNumber(item.stock_total||0)} unidades/metros${item.ubicacion?` · ${item.ubicacion}`:''}`}));
        setAnswer('Almacenes', `${active.length} almacén${active.length===1?'':'es'} coincide${active.length===1?'':'n'} con la consulta.`, 'Consulta ejecutiva de solo lectura.', cards);
        return `Hay ${active.length} almacenes registrados${active.length?`: ${active.slice(0,6).map(item=>item.nombre).filter(Boolean).join(', ')}`:''}.`;
    }

    async function answerExecutiveAlerts() {
        const data = await loadData('executiveAlerts', true);
        const low=number(data.bajo_minimo),locations=number(data.sin_ubicacion),incomplete=number(data.informacion_incompleta),purchases=number(data.compras_pendientes);
        const total=low+locations+incomplete+purchases;
        const cards=[{title:'Bajo mínimo',detail:String(low)},{title:'Sin ubicación',detail:String(locations)},{title:'Información incompleta',detail:String(incomplete)},{title:'Compras pendientes',detail:String(purchases)}];
        setAnswer('Atención requerida', total?`${total} señales requieren revisión.`:'No detecté pendientes en los criterios ejecutivos actuales.', 'Sky consulta Almacén y Compras en modo de solo lectura.', cards);
        return total?`Hay ${total} señales que requieren revisión: ${low} de bajo mínimo, ${locations} sin ubicación, ${incomplete} con información incompleta y ${purchases} compras pendientes.`:'No detecté pendientes en los criterios ejecutivos actuales.';
    }

    async function answerExecutiveDecisionBrief(raw){
        const prefix=detectProfile()==='gerente_general'?'GG':'SG';
        const rows=await SkilledDB.getExecutiveProjectSummary().catch(()=>[]);
        const alerts=await SkilledDB.listOperationalAlerts?.().catch(()=>null);
        const active=Array.isArray(rows)?rows.filter(row=>!/complet|cerrad|cancelad/i.test(text(row.estado))):[];
        const planned=active.reduce((s,r)=>s+number(r.total_planeado),0),real=active.reduce((s,r)=>s+number(r.total_real),0),pct=planned>0?real/planned*100:real>0?100:0;
        const today=new Date();today.setHours(12,0,0,0);
        const due=active.filter(row=>{if(!row.fechaEntrega)return false;const d=new Date(`${row.fechaEntrega}T12:00:00`);if(Number.isNaN(d.getTime()))return false;return Math.ceil((d-today)/86400000)<=14});
        const over=active.filter(row=>number(row.desviacion_total)>0);
        const summary=alerts?.summary||{},ops=number(summary.bajoMinimo)+number(summary.comprasPendientes)+number(summary.ubicacionesPendientes)+number(summary.herramientasVencidas)+number(summary.documentosVehiculo);
        const cards=[{title:'Portafolio activo',detail:`${active.length} proyectos`},{title:'Presupuesto utilizado',detail:`${Math.round(pct)}% · ${currency(real)} real`},{title:'Sobre plan',detail:`${over.length} proyectos`},{title:'Entrega próxima',detail:`${due.length} proyectos`},{title:'Señales operativas',detail:String(ops)}];
        const main=`Resumen para decisión: ${active.length} proyectos activos, ${Math.round(pct)}% del presupuesto utilizado, ${over.length} proyectos sobre plan, ${due.length} entregas próximas o vencidas y ${ops} señales operativas.`;
        const detail=ops||over.length||due.length?'Recomiendo revisar primero los proyectos con mayor desviación, después entregas próximas y finalmente pendientes de Almacén/Compras.':'La operación aparece estable con los criterios ejecutivos actuales.';
        setAnswer('Centro de decisiones',main,detail,cards,{href:`${prefix}.inicio.html#exec-decision-center`,label:'Abrir centro de decisiones'});
        return `${main} ${detail}`;
    }

    async function answerExecutive(raw) {
        const norm=commandNormalize(raw);
        const prefix=detectProfile()==='gerente_general'?'GG':'SG';
        if (/resumen.*decision|resumen.*decisión|centro.*decision|centro.*decisión|que debo revisar primero|qué debo revisar primero|prioridad ejecutiva|prioridades ejecutivas|que requiere atencion hoy|qué requiere atención hoy|que ocupa atencion|qué ocupa atención/.test(norm)) return answerExecutiveDecisionBrief(raw);
        if (/vehiculo|vehículos|vehiculos|camioneta|pickup|automovil|van\b|camion\b|montacargas|flotilla/.test(norm)) return answerVehicles(raw);
        if (officeAssetIntent(raw) || /resguardo|resguardos|activo.*oficina|material.*oficina|que tiene asignado|qué tiene asignado/.test(norm)) return answerRHOfficeAssets(raw,true);
        if (attendanceIntent(raw)) return answerAttendance(raw,true);
        if (/\b(cuanto|cuantos|cuanta|cuantas)\b.*\b(material|materiales)\b/.test(norm) && !/tubo|cable|tornillo|tuerca|rondana|arandela|metro|pieza|stock|existencia/.test(norm)) return answerExecutiveInventorySummary();
        if (isMaterialFamilyQuery(raw)) return answerMaterialFamily(raw);
        if (/\b(donde|ubicacion|ubicado|localiza|rack|zona|piso)\b/.test(norm) && /material|tubo|tuberia|cable|tornillo|pija|tuerca|rondana|arandela|abrazadera|conector|taquete|conduit|canaleta|pieza|metro|pulgada|mm|awg|codigo|código/.test(norm)) return answerMaterial(raw, true);
        if (/\b(cuanto|cuantos|cuanta|cuantas|existencia|stock|tenemos|queda|quedan|hay)\b/.test(norm) && /material|tubo|tuberia|cable|tornillo|pija|tuerca|rondana|arandela|abrazadera|conector|taquete|conduit|canaleta|pieza|metro|pulgada|mm|awg|rollo|rollos/.test(norm)) return answerMaterial(raw, false);
        if (/persona|personas|personal|trabajador|trabajadores|colaborador|colaboradores|empleado|empleados|recursos humanos|\brh\b|equipo.*proyecto|cuadrilla/.test(norm)) return answerExecutivePeople(raw, []);
        if (/proveedor|proveedores|cotiz|orden.*compra|compras? pendiente|solicitud.*compra|solicitud.*proveedor|\boc\b|rfc|contacto|correo|email|whatsapp|telefono|mensaje.*proveedor|comunicacion|comunicación|quien.*vende|quién.*vende|quien.*surte|quién.*surte|quien.*maneja|quién.*maneja/.test(norm)) return answerExecutivePurchasing(raw);
        if (/herramient|taladro|esmeril|soldador|multimetro|pinza|llave/.test(norm)) return answerExecutiveTools(raw);
        if (/\b(almacen|almacenes|bodega|bodegas)\b/.test(norm) && !/material|tubo|cable|stock|existencia|ubicacion|ubicación/.test(norm)) return answerExecutiveWarehouses(raw);
        if (/alerta|bajo.*min|sin.*ubicacion|sin.*ubicación|informacion.*incompleta|información.*incompleta|compras.*pend|pendientes.*operacion|pendientes.*operación/.test(norm)) return answerExecutiveAlerts();
        let rows=[];
        try { rows=await SkilledDB.getExecutiveProjectSummary(); } catch (error) {
            if (/proyecto|gasto|sueldo|nomina|planeado|presupuesto|costo|desviacion|avance|entrega|riesgo|prioridad/.test(norm)) throw error;
        }
        if(!Array.isArray(rows)||!rows.length){setAnswer('Resumen ejecutivo','Todavía no hay proyectos disponibles para el análisis ejecutivo.','',[],{href:`${prefix}.proyectos.html`,label:'Abrir proyectos'});return'Todavía no hay proyectos disponibles para el análisis ejecutivo.'}
        const now=new Date();now.setHours(0,0,0,0);
        const closed=row=>/complet|cerrad|cancelad/i.test(text(row.estado));
        const daysTo=row=>{if(!row.fechaEntrega)return null;const d=new Date(`${row.fechaEntrega}T12:00:00`);if(Number.isNaN(d.getTime()))return null;return Math.ceil((d-now)/86400000)};
        const utilization=row=>number(row.total_planeado)>0?number(row.total_real)/number(row.total_planeado)*100:number(row.total_real)>0?100:0;
        const active=rows.filter(row=>!closed(row));
        const candidate=executiveProjectCandidate(rows,raw);
        if(!candidate&&/alerta|pendiente.*oper|operacion|operación|bajo.*min|sin.*ubicacion|sin.*ubicación|herramient.*venc|flotilla|document.*vehiculo|document.*vehículo|compras.*pend/.test(norm)&&window.SkilledDB?.listOperationalAlerts){
            const alerts=await SkilledDB.listOperationalAlerts();
            const summary=alerts?.summary||{},low=number(summary.bajoMinimo),purchases=number(summary.comprasPendientes),locations=number(summary.ubicacionesPendientes),tools=number(summary.herramientasVencidas),vehicles=number(summary.documentosVehiculo),total=low+purchases+locations+tools+vehicles;
            const cards=[{title:'Bajo mínimo',detail:String(low)},{title:'Compras pendientes',detail:String(purchases)},{title:'Sin ubicación',detail:String(locations)},{title:'Herramientas vencidas',detail:String(tools)},{title:'Flotilla · documentos',detail:String(vehicles)}];
            const highest=cards.slice().sort((a,b)=>number(b.detail)-number(a.detail))[0];
            setAnswer('Alertas operativas',total?`${total} señales operativas requieren seguimiento.`:'No detecté alertas operativas en los criterios actuales.',total?`La mayor concentración está en ${highest.title.toLowerCase()} (${highest.detail}).`:'Bajo mínimo, compras, ubicaciones, herramientas y flotilla no presentan pendientes en este resumen.',cards,{href:`${prefix}.inicio.html`,label:'Abrir tablero ejecutivo'});
            return total?`Hay ${total} señales operativas. La mayor concentración está en ${highest.title.toLowerCase()}, con ${highest.detail}.`:'No detecté alertas operativas en el resumen actual.';
        }
        if(candidate&&/proyecto|gasto|gastado|material|sueldo|nomina|planeado|presupuesto|costo|desviacion|avance|como va|cómo va/.test(norm)){
            conversationContext.project={proyecto:text(candidate.proyecto),nombre:text(candidate.nombre)};saveConversationContext();
            const mat=number(candidate.material_real),pay=number(candidate.nomina_real),real=number(candidate.total_real),planned=number(candidate.total_planeado),dev=number(candidate.desviacion_total),use=utilization(candidate),days=daysTo(candidate);
            const cards=[{title:'Gasto real',detail:currency(real)},{title:'Planeado',detail:currency(planned)},{title:'Materiales',detail:`${currency(mat)} · ${real>0?Math.round(mat/real*100):0}% del gasto`},{title:'Sueldos',detail:`${currency(pay)} · ${real>0?Math.round(pay/real*100):0}% del gasto`},{title:'Desviación',detail:`${dev>0?'+':''}${currency(dev)}`},{title:'Entrega',detail:days===null?'Sin fecha':days<0?`${Math.abs(days)} días vencida`:days===0?'Hoy':`${days} días · ${dateOnly(candidate.fechaEntrega)}`}];
            const state=dev>0?'por encima de lo planeado':dev<0?'por debajo de lo planeado':'en línea con lo planeado';
            setAnswer('Análisis ejecutivo del proyecto',`${candidate.proyecto} · ${candidate.nombre||'Proyecto'} lleva ${currency(real)} de gasto acumulado.`,`Utilización ${Math.round(use)}% · ${state}. ${candidate.responsable?`Responsable: ${candidate.responsable}.`:''}`,cards,{href:`${prefix}.proyectos.html?proyecto=${encodeURIComponent(candidate.proyecto)}`,label:'Abrir detalle ejecutivo'});
            return`El proyecto ${candidate.proyecto} lleva ${currency(real)} de gasto, utiliza ${Math.round(use)} por ciento de lo planeado y está ${state}.`;
        }
        if(/requiere.*atencion|requiere.*atención|critico|crítico|riesgo|prioridad|prioridades|preocup|atras/.test(norm)){
            const risk=active.map(row=>{const days=daysTo(row),dev=number(row.desviacion_total),use=utilization(row);let score=dev>0?Math.min(70,20+dev/Math.max(1,number(row.total_planeado))*100):0;if(days!==null&&days<0)score+=60;else if(days!==null&&days<=7)score+=35;else if(days!==null&&days<=14)score+=18;if(use>=100)score+=25;return{row,score,days,use}}).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,7);
            setAnswer('Prioridades ejecutivas',risk.length?`${risk.length} proyectos concentran la atención inmediata.`:'No detecté proyectos con señales críticas en los datos actuales.',risk.length?'La prioridad combina desviación contra lo planeado y cercanía o vencimiento de la fecha de entrega.':'Los proyectos activos están dentro de los criterios actuales.',risk.map(item=>({title:`${item.row.proyecto} · ${item.row.nombre||'Proyecto'}`,detail:`${item.row.desviacion_total>0?`+${currency(item.row.desviacion_total)} desviación`:'dentro de plan'} · ${item.days===null?'sin fecha':item.days<0?`${Math.abs(item.days)} días vencido`:`entrega en ${item.days} días`} · ${Math.round(item.use)}% utilizado`})),{href:`${prefix}.proyectos.html?riesgo=atencion`,label:'Abrir proyectos prioritarios'});
            return risk.length?`Detecté ${risk.length} proyectos que requieren atención prioritaria.`:'No detecté proyectos críticos con los datos actuales.';
        }
        if(/proxim|próxim|entrega|vence|vencim|fecha/.test(norm)&&!/gasto|costo|presupuesto/.test(norm)){
            const upcoming=active.map(row=>({row,days:daysTo(row)})).filter(item=>item.days!==null).sort((a,b)=>a.days-b.days).slice(0,7);
            setAnswer('Próximas entregas',upcoming.length?`Estas son las ${upcoming.length} entregas más próximas.`:'No hay fechas de entrega registradas para proyectos activos.','Se ordenan por la fecha comprometida más cercana.',upcoming.map(item=>({title:`${item.row.proyecto} · ${item.row.nombre||'Proyecto'}`,detail:`${dateOnly(item.row.fechaEntrega)} · ${item.days<0?`${Math.abs(item.days)} días vencido`:item.days===0?'vence hoy':`faltan ${item.days} días`} · ${item.row.responsable||'responsable pendiente'}`})),{href:`${prefix}.proyectos.html?orden=entrega`,label:'Ver calendario de proyectos'});
            return upcoming.length?`La entrega más próxima es ${upcoming[0].row.proyecto}, ${upcoming[0].days<0?'ya vencida':upcoming[0].days===0?'para hoy':`en ${upcoming[0].days} días`}.`:'No hay fechas de entrega registradas.';
        }
        if(/mayor|mas alto|más alto|top|costoso|gasto mas|gasto más/.test(norm)&&/gasto|costo|consumo|real/.test(norm)){
            const top=[...rows].sort((a,b)=>number(b.total_real)-number(a.total_real)).slice(0,7);
            setAnswer('Proyectos con mayor gasto',`Estos son los ${top.length} proyectos con mayor gasto real acumulado.`,'El total combina materiales y sueldos devengados.',top.map(row=>({title:`${row.proyecto} · ${row.nombre||'Proyecto'}`,detail:`${currency(row.total_real)} real · ${currency(row.total_planeado)} planeado · ${Math.round(utilization(row))}% utilizado`})),{href:`${prefix}.proyectos.html?orden=gasto`,label:'Abrir análisis de costos'});
            return top.length?`El proyecto con mayor gasto es ${top[0].proyecto}, con ${currency(top[0].total_real)}.`:'No hay gasto registrado.';
        }
        if(/sobre|exced|desviacion|desviación|fuera.*planeado|arriba.*planeado|presupuesto/.test(norm)){
            const over=rows.filter(row=>number(row.desviacion_total)>0).sort((a,b)=>number(b.desviacion_total)-number(a.desviacion_total));
            setAnswer('Proyectos sobre lo planeado',over.length?`${over.length} proyecto${over.length===1?' está':'s están'} por encima de lo planeado.`:'Ningún proyecto está por encima de lo planeado.','La desviación considera materiales y sueldos del proyecto.',over.slice(0,7).map(row=>({title:`${row.proyecto} · ${row.nombre||'Proyecto'}`,detail:`${currency(row.total_real)} real · ${currency(row.total_planeado)} planeado · +${currency(row.desviacion_total)}`})),{href:`${prefix}.proyectos.html?riesgo=sobre_plan`,label:'Abrir proyectos sobre plan'});
            return over.length?`Hay ${over.length} proyectos por encima de lo planeado.`:'Ningún proyecto está por encima de lo planeado.';
        }
        if(/material.*sueldo|sueldo.*material|nomina.*material|material.*nomina|compara.*gasto/.test(norm)){
            const mat=rows.reduce((sum,row)=>sum+number(row.material_real),0),pay=rows.reduce((sum,row)=>sum+number(row.nomina_real),0),real=mat+pay;
            setAnswer('Composición del gasto',`${currency(real)} de gasto real acumulado en los proyectos.`,`Materiales representan ${real?Math.round(mat/real*100):0}% y sueldos ${real?Math.round(pay/real*100):0}%.`,[{title:'Materiales',detail:currency(mat)},{title:'Sueldos',detail:currency(pay)},{title:'Total',detail:currency(real)}],{href:`${prefix}.proyectos.html`,label:'Ver detalle por proyecto'});
            return`El gasto acumulado es ${currency(real)}: ${currency(mat)} en materiales y ${currency(pay)} en sueldos.`;
        }
        const mat=rows.reduce((sum,row)=>sum+number(row.material_real),0),pay=rows.reduce((sum,row)=>sum+number(row.nomina_real),0),real=rows.reduce((sum,row)=>sum+number(row.total_real),0),planned=rows.reduce((sum,row)=>sum+number(row.total_planeado),0),over=rows.filter(row=>number(row.desviacion_total)>0).length,due=active.filter(row=>{const days=daysTo(row);return days!==null&&days<=14}).length;
        setAnswer('Resumen ejecutivo',`${active.length} proyectos activos · ${currency(real)} de gasto acumulado.`,`Planeado ${currency(planned)} · ${over} sobre plan · ${due} con entrega dentro de 14 días o vencida.`,[{title:'Proyectos activos',detail:String(active.length)},{title:'Gasto real',detail:currency(real)},{title:'Planeado',detail:currency(planned)},{title:'Materiales',detail:currency(mat)},{title:'Sueldos',detail:currency(pay)},{title:'Atención',detail:`${over} sobre plan · ${due} entregas próximas`}],{href:`${prefix}.proyectos.html`,label:'Ver tablero de proyectos'});
        return`Hay ${active.length} proyectos activos. El gasto acumulado es ${currency(real)} y ${over} proyectos están por encima de lo planeado.`;
    }

    async function buildRelevantCRMContext(raw, profile=detectProfile()) {
        if (!window.SkilledDB) return '';
        const query=expandEntityAliases(raw);
        const lines=[];
        try {
            if (isExecutiveReadProfile(profile) && typeof SkilledDB.searchExecutiveSky==='function') {
                const batches=await Promise.all(executiveSearchTerms(query).map(term=>SkilledDB.searchExecutiveSky(term).catch(()=>[])));
                const hits=batches.flat();
                const seen=new Set();
                hits.forEach(hit=>{const line=`${hit.tipo||'Dato'}: ${hit.titulo||hit.nombre||''}${hit.detalle?` — ${hit.detalle}`:''}`;const key=normalize(line);if(!seen.has(key)&&lines.length<12){seen.add(key);lines.push(line)}});
            } else if (profile==='almacen') {
                const mats=await loadData('materials').catch(()=>[]);
                const ranked=window.SkilledSearch?.rank?window.SkilledSearch.rank(mats,query,m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca,...(m.modismos||[])]):[];
                ranked.slice(0,8).forEach(m=>lines.push(`Material: ${m.codigo} — ${m.descripcion||m.desc}; stock ${formatNumber(m.stock)} ${m.unidad||''}; categoría ${m.categoria||'—'}`));
            } else if (profile==='rh') {
                const people=await loadData('rhPeople').catch(()=>[]);
                const ranked=window.SkilledSearch?.rank?window.SkilledSearch.rank(people,query,p=>[p.numero_empleado,p.nombre,p.apellidos,p.puesto,p.departamento]):[];
                ranked.slice(0,8).forEach(p=>lines.push(`Persona: ${p.nombre||''} ${p.apellidos||''}; ${p.puesto||'sin puesto'}; ${p.departamento||'sin departamento'}`));
            } else if (profile==='compras') {
                const suppliers=await loadData('coSuppliers').catch(()=>[]);
                const ranked=window.SkilledSearch?.rank?window.SkilledSearch.rank(suppliers,query,p=>[p.razon_social,p.nombre_comercial,p.contacto,p.email,p.telefono,p.whatsapp,p.rfc]):[];
                ranked.slice(0,8).forEach(p=>lines.push(`Proveedor: ${p.nombre_comercial||p.razon_social||'—'}; contacto ${p.contacto||'—'}; correo ${p.email||'—'}; WhatsApp ${p.whatsapp||p.telefono||'—'}`));
            }
            if (!lines.length && !isExecutiveReadProfile(profile)) {
                const configs=profileSmartSearchConfig(profile);
                const datasets=await Promise.all(configs.map(async cfg=>{let rows=[];try{rows=await loadData(cfg.key)}catch(_){rows=[]}return{cfg,rows}}));
                for (const {cfg,rows} of datasets) {
                    if(!Array.isArray(rows)||!rows.length)continue;
                    const ranked=window.SkilledSearch?.rank?window.SkilledSearch.rank(rows,query,item=>cfg.fields(item)):[];
                    ranked.slice(0,4).forEach(item=>lines.push(`${cfg.type}: ${cfg.title(item)} — ${cfg.detail(item)}`));
                    if(lines.length>=10)break;
                }
            }
        } catch (_) {}
        return lines.join('\n').slice(0,5000);
    }

    async function answerGeneralAI(raw, profile = detectProfile()) {
        if (!window.SkilledDB?.askSkyGeneral) return null;
        try {
            const crmContext=await buildRelevantCRMContext(raw,profile);
            const context = { lastIntent:conversationContext.lastIntent, lastEntity:conversationContext.lastEntity, lastQuery:conversationContext.lastQuery, area:conversationContext.area, turns:conversationContext.turns, page:currentPageKey(), crmContext };
            const result = await SkilledDB.askSkyGeneral(raw, { profile, context });
            const answer = text(result?.answer || result?.text);
            if (!answer) return null;
            const title = text(result?.title) || 'Sky';
            setAnswer(title, answer, text(result?.detail) || 'Respuesta generada por Sky. Los datos internos del CRM siguen sujetos a los permisos de tu perfil.');
            return answer;
        } catch (_) { return null; }
    }

    function profileSmartSearchConfig(profile) {
        const commonProject = {type:'Proyecto',key:'projects',fields:p=>[p.proyecto,p.nombre,p.cliente,p.responsable,p.estado],title:p=>`${p.proyecto||'—'} · ${p.nombre||'Proyecto'}`,detail:p=>`${p.cliente||'Sin cliente'} · ${p.estado||'sin estado'}`};
        const configs = {
            almacen:[
                {type:'Material',key:'materials',fields:m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca,...(m.modismos||[])],title:m=>`${m.codigo||'—'} · ${m.descripcion||m.desc||'Material'}`,detail:m=>`${formatNumber(m.stock)} ${m.unidad||''} · ${m.categoria||'Sin categoría'}`},
                {type:'Herramienta',key:'tools',fields:t=>[t.sku,t.descripcion,t.clasificacion,t.marca,t.modelo],title:t=>`${t.sku||'—'} · ${t.descripcion||'Herramienta'}`,detail:t=>`${t.estado||'sin estado'}`},
                {type:'Vehículo',key:'vehicles',fields:v=>[v.nombre,v.nombreVehiculo,v.numeroEconomico,v.placas,v.tipo,v.marca,v.modelo,v.proyecto],title:v=>v.nombre||v.nombreVehiculo||v.numeroEconomico||v.placas||'Vehículo',detail:v=>`${v.tipo||''} · ${v.estado||'sin estado'}`},
                commonProject
            ],
            compras:[
                {type:'Proveedor',key:'coSuppliers',fields:p=>[p.razon_social,p.nombre_comercial,p.contacto,p.email,p.telefono,p.whatsapp,p.rfc],title:p=>p.nombre_comercial||p.razon_social||'Proveedor',detail:p=>[p.contacto,p.email,p.whatsapp||p.telefono].filter(Boolean).join(' · ')||'Sin contacto'},
                {type:'Material',key:'materials',fields:m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca,m.proveedor],title:m=>`${m.codigo||'—'} · ${m.descripcion||m.desc||'Material'}`,detail:m=>`${m.categoria||'Sin categoría'} · ${m.proveedor||'sin proveedor'}`},
                {type:'Cotización',key:'coQuotations',fields:q=>[q.folio,q.estado,q.prioridad,q.proveedor,q.descripcion,q.material,q.proyecto],title:q=>q.folio||q.descripcion||q.material||'Cotización',detail:q=>`${q.estado||'sin estado'} · ${q.prioridad||'sin prioridad'}`},
                commonProject
            ],
            rh:[
                {type:'Persona',key:'rhPeople',fields:p=>[p.numero_empleado,p.nombre,p.apellidos,p.puesto,p.departamento,p.correo,p.telefono],title:p=>`${p.nombre||''} ${p.apellidos||''}`.trim()||p.numero_empleado||'Persona',detail:p=>`${p.puesto||'Sin puesto'} · ${p.departamento||'Recursos Humanos'}`},
                {type:'Equipo',key:'rhOfficeAssets',fields:a=>[a.codigo,a.nombre,a.descripcion,a.categoria,a.marca,a.modelo,a.numero_serie],title:a=>a.nombre||a.descripcion||a.codigo||'Equipo',detail:a=>`${a.categoria||'Activo'} · ${a.estado||'sin estado'}`},
                {type:'Documento',key:'rhDocuments',fields:d=>[d.tipo,d.nombre,d.descripcion,d.estado,d.personal?.nombre,d.personal?.apellidos],title:d=>d.nombre||d.tipo||'Documento',detail:d=>d.estado||'Sin estado'},
                commonProject
            ],
            finanzas:[
                commonProject,
                {type:'Compra',key:'purchases',fields:o=>[o.folio,o.materialCodigo,o.descripcion,o.estado,o.proveedor,o.ordenCompra,o.proyecto],title:o=>o.folio||o.ordenCompra||o.descripcion||'Solicitud de compra',detail:o=>`${o.estado||'sin estado'} · ${o.proveedor||'sin proveedor'}`},
                {type:'Proveedor',key:'coSuppliers',fields:p=>[p.razon_social,p.nombre_comercial,p.rfc,p.contacto,p.email,p.telefono,p.whatsapp],title:p=>p.nombre_comercial||p.razon_social||'Proveedor',detail:p=>[p.rfc,p.contacto,p.email].filter(Boolean).join(' · ')||'Sin datos'}
            ],
            proyectos:[
                commonProject,
                {type:'Material',key:'materials',fields:m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca,m.proveedor],title:m=>`${m.codigo||'—'} · ${m.descripcion||m.desc||'Material'}`,detail:m=>`${formatNumber(m.stock)} ${m.unidad||''} · ${m.categoria||'Sin categoría'}`},
                {type:'Persona',key:'rhPeople',fields:p=>[p.numero_empleado,p.nombre,p.apellidos,p.puesto,p.departamento],title:p=>`${p.nombre||''} ${p.apellidos||''}`.trim()||p.numero_empleado||'Persona',detail:p=>`${p.puesto||'Sin puesto'} · ${p.departamento||'Sin departamento'}`},
                {type:'Compra',key:'purchases',fields:o=>[o.folio,o.materialCodigo,o.descripcion,o.estado,o.proveedor,o.ordenCompra,o.proyecto],title:o=>o.folio||o.ordenCompra||o.descripcion||'Solicitud de compra',detail:o=>`${o.estado||'sin estado'} · ${o.proveedor||'sin proveedor'}`}
            ],
            planeacion:[
                commonProject,
                {type:'Material',key:'materials',fields:m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca,m.proveedor],title:m=>`${m.codigo||'—'} · ${m.descripcion||m.desc||'Material'}`,detail:m=>`${formatNumber(m.stock)} ${m.unidad||''} · ${m.categoria||'Sin categoría'}`},
                {type:'Persona',key:'rhPeople',fields:p=>[p.numero_empleado,p.nombre,p.apellidos,p.puesto,p.departamento],title:p=>`${p.nombre||''} ${p.apellidos||''}`.trim()||p.numero_empleado||'Persona',detail:p=>`${p.puesto||'Sin puesto'} · ${p.departamento||'Sin departamento'}`},
                {type:'Vehículo',key:'vehicles',fields:v=>[v.nombre,v.nombreVehiculo,v.numeroEconomico,v.placas,v.tipo,v.marca,v.modelo,v.proyecto],title:v=>v.nombre||v.nombreVehiculo||v.numeroEconomico||v.placas||'Vehículo',detail:v=>`${v.tipo||''} · ${v.estado||'sin estado'}`}
            ],
            coordinacion:[
                commonProject,
                {type:'Material',key:'materials',fields:m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca,m.proveedor],title:m=>`${m.codigo||'—'} · ${m.descripcion||m.desc||'Material'}`,detail:m=>`${formatNumber(m.stock)} ${m.unidad||''} · ${m.categoria||'Sin categoría'}`},
                {type:'Persona',key:'rhPeople',fields:p=>[p.numero_empleado,p.nombre,p.apellidos,p.puesto,p.departamento],title:p=>`${p.nombre||''} ${p.apellidos||''}`.trim()||p.numero_empleado||'Persona',detail:p=>`${p.puesto||'Sin puesto'} · ${p.departamento||'Sin departamento'}`},
                {type:'Proveedor',key:'coSuppliers',fields:p=>[p.razon_social,p.nombre_comercial,p.rfc,p.contacto,p.email,p.telefono,p.whatsapp],title:p=>p.nombre_comercial||p.razon_social||'Proveedor',detail:p=>[p.contacto,p.email,p.whatsapp||p.telefono].filter(Boolean).join(' · ')||'Sin contacto'},
                {type:'Vehículo',key:'vehicles',fields:v=>[v.nombre,v.nombreVehiculo,v.numeroEconomico,v.placas,v.tipo,v.marca,v.modelo,v.proyecto],title:v=>v.nombre||v.nombreVehiculo||v.numeroEconomico||v.placas||'Vehículo',detail:v=>`${v.tipo||''} · ${v.estado||'sin estado'}`}
            ],
            logistica:[
                commonProject,
                {type:'Vehículo',key:'vehicles',fields:v=>[v.nombre,v.nombreVehiculo,v.numeroEconomico,v.placas,v.tipo,v.marca,v.modelo,v.proyecto,v.responsable],title:v=>v.nombre||v.nombreVehiculo||v.numeroEconomico||v.placas||'Vehículo',detail:v=>`${v.tipo||''} · ${v.estado||'sin estado'} · ${v.proyecto||'sin proyecto'}`},
                {type:'Material',key:'materials',fields:m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca,m.proveedor],title:m=>`${m.codigo||'—'} · ${m.descripcion||m.desc||'Material'}`,detail:m=>`${formatNumber(m.stock)} ${m.unidad||''} · ${m.categoria||'Sin categoría'}`},
                {type:'Persona',key:'rhPeople',fields:p=>[p.numero_empleado,p.nombre,p.apellidos,p.puesto,p.departamento],title:p=>`${p.nombre||''} ${p.apellidos||''}`.trim()||p.numero_empleado||'Persona',detail:p=>`${p.puesto||'Sin puesto'} · ${p.departamento||'Sin departamento'}`}
            ],
            administrador:[
                commonProject,
                {type:'Material',key:'materials',fields:m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca,m.proveedor],title:m=>`${m.codigo||'—'} · ${m.descripcion||m.desc||'Material'}`,detail:m=>`${formatNumber(m.stock)} ${m.unidad||''} · ${m.categoria||'Sin categoría'}`},
                {type:'Proveedor',key:'coSuppliers',fields:p=>[p.razon_social,p.nombre_comercial,p.rfc,p.contacto,p.email,p.telefono,p.whatsapp],title:p=>p.nombre_comercial||p.razon_social||'Proveedor',detail:p=>[p.contacto,p.email,p.whatsapp||p.telefono].filter(Boolean).join(' · ')||'Sin contacto'},
                {type:'Persona',key:'rhPeople',fields:p=>[p.numero_empleado,p.nombre,p.apellidos,p.puesto,p.departamento],title:p=>`${p.nombre||''} ${p.apellidos||''}`.trim()||p.numero_empleado||'Persona',detail:p=>`${p.puesto||'Sin puesto'} · ${p.departamento||'Sin departamento'}`},
                {type:'Vehículo',key:'vehicles',fields:v=>[v.nombre,v.nombreVehiculo,v.numeroEconomico,v.placas,v.tipo,v.marca,v.modelo,v.proyecto],title:v=>v.nombre||v.nombreVehiculo||v.numeroEconomico||v.placas||'Vehículo',detail:v=>`${v.tipo||''} · ${v.estado||'sin estado'}`}
            ],
            recepcion:[
                commonProject,
                {type:'Persona',key:'rhPeople',fields:p=>[p.numero_empleado,p.nombre,p.apellidos,p.puesto,p.departamento,p.correo,p.telefono],title:p=>`${p.nombre||''} ${p.apellidos||''}`.trim()||p.numero_empleado||'Persona',detail:p=>`${p.puesto||'Sin puesto'} · ${p.departamento||'Sin departamento'}`},
                {type:'Proveedor',key:'coSuppliers',fields:p=>[p.razon_social,p.nombre_comercial,p.rfc,p.contacto,p.email,p.telefono,p.whatsapp],title:p=>p.nombre_comercial||p.razon_social||'Proveedor',detail:p=>[p.contacto,p.email,p.whatsapp||p.telefono].filter(Boolean).join(' · ')||'Sin contacto'},
                {type:'Vehículo',key:'vehicles',fields:v=>[v.nombre,v.nombreVehiculo,v.numeroEconomico,v.placas,v.tipo,v.marca,v.modelo,v.proyecto],title:v=>v.nombre||v.nombreVehiculo||v.numeroEconomico||v.placas||'Vehículo',detail:v=>`${v.tipo||''} · ${v.estado||'sin estado'}`}
            ],
            tsi:[
                {type:'EPP',key:'materials',fields:m=>[m.codigo,m.descripcion,m.desc,m.categoria,m.marca,m.codigoMarca,m.codigo_marca].filter(Boolean),title:m=>`${m.descripcion||m.desc||m.codigo||'EPP'}`,detail:m=>`${m.marca||'Sin marca'} · ${m.categoria||'Sin categoría'}`},
                commonProject
            ],
            consulta:[commonProject]
        };
        return configs[profile] || [];
    }

    function isConversationalUtterance(raw) {
        const norm=commandNormalize(raw);
        if(!norm)return true;
        if(/\b(soy|me llamo|trabajo en|pertenezco a|mi area|mi departamento|estoy en el area|quiero saber como me ayudas|platica conmigo|hablemos|que opinas|explicame|cuentame)\b/.test(norm)&&!/\b(busca|buscar|encuentra|localiza|muestra|dame|cuanto|cuantos|donde|quien|proyecto|material|proveedor|vehiculo|personal|stock|existencia|presupuesto|cotizacion|orden de compra)\b/.test(norm))return true;
        if(/^(soy|estoy|trabajo|pertenezco)\b/.test(norm))return true;
        return false;
    }

    function shouldRunSmartSearch(raw, profile = detectProfile()) {
        const norm=commandNormalize(raw);
        if(!norm||isConversationalUtterance(raw))return false;
        if(/\b(mensaje|chat|dile|diles|avisa|avisale|avísale|manda|envia|envía|escribele|escríbele|reunion|reunión|junta|convoca|agenda|agendar|programa|programar)\b/.test(norm))return false;
        if(hasStrongLocalIntent(raw,profile))return true;
        if(/\b(busca|buscar|encuentra|encontrar|localiza|localizar|muestra|mostrar|dame|lista|listar|quien es|quién es|donde esta|dónde está|informacion de|información de)\b/.test(norm))return true;
        const words=norm.split(' ').filter(Boolean);
        if(words.length<=4&&!/\b(soy|estoy|quiero|puedes|podrias|podrías|ayuda|ayudar|hacer|sirves|opinas|sientes|gracias|hola)\b/.test(norm))return true;
        return false;
    }

    async function answerScopedSmartSearch(raw, profile = detectProfile()) {
        if (isExecutiveReadProfile(profile)) return answerExecutiveGlobalSearch(raw);
        const q = expandEntityAliases(stripWakeWord(raw));
        const norm = commandNormalize(q);
        if (norm.length < 2 || /^(hola|gracias|sky|si|no|ok|okay)$/.test(norm)) return null;
        const configs = profileSmartSearchConfig(profile);
        if (!configs.length) return null;
        const hits=[];
        const datasets=await Promise.all(configs.map(async cfg=>{let rows=[];try{rows=await loadData(cfg.key)}catch(_){rows=[]}return{cfg,rows}}));
        for (const {cfg,rows} of datasets) {
            if (!Array.isArray(rows) || !rows.length) continue;
            const ranked=window.SkilledSearch?.rank?window.SkilledSearch.rank(rows,q,item=>cfg.fields(item)):rows.filter(item=>matchesTokens(cfg.fields(item),searchTokens(q)));
            ranked.slice(0,5).forEach(item=>hits.push({type:cfg.type,title:cfg.title(item),detail:cfg.detail(item),item}));
        }
        const unique=[];const seen=new Set();
        for (const hit of hits) {
            const key=normalize(`${hit.type}|${hit.title}|${hit.detail}`);
            if (!key || seen.has(key)) continue;
            seen.add(key);unique.push(hit);
            if (unique.length>=12) break;
        }
        if (!unique.length) return null;
        const first=unique[0];
        if(first.type==='Persona'){conversationContext.person={nombre:text(first.title),numero:text(first.item?.numero_empleado)};saveConversationContext()}
        const cards=unique.map(hit=>({title:`${hit.type} · ${hit.title}`,detail:hit.detail}));
        const message=unique.length===1
            ? `Encontré una coincidencia para “${text(raw)}”: ${first.title}.`
            : `Encontré ${unique.length} coincidencias para “${text(raw)}” dentro de ${profileNames[profile]||profile}.`;
        setAnswer('Búsqueda inteligente',message,'Puedes escribir solo una parte del nombre, código, proyecto o concepto. Sky intenta completar la intención y relacionar sinónimos y abreviaciones antes de pedirte que reformules.',cards);
        rememberConversation('smart_search',first.title,q);
        return message;
    }

    async function answerGeneric(raw, profile) {
        const adapter = customProfiles.get(profile);
        if (adapter?.query) return adapter.query({ raw, normalized: normalize(raw), SkilledDB, setAnswer, loadData, formatNumber, currency, dateOnly });
        const config = profileConfig(profile);
        const examples=(profile==='sky_demo'?smartHintLibrary(profile):pageAwareExamples(config)).slice(0,7).map(item=>({title:item[0],detail:item[1]}));
        const message=profile==='sky_demo'?'No encontré un dato conectado exacto para esa pregunta, pero sí puedo explicarte el CRM, relacionar módulos, consultar información autorizada o ayudarte a reformularla sin usar comandos especiales.':`No encontré un dato conectado exacto para esa consulta en ${profileNames[profile] || profile}, pero puedo ayudarte a ubicar el dato, explicar el flujo o reformular la pregunta.`;
        setAnswer(profile==='sky_demo'?'Sigamos con la pregunta':config.title,message,'Si la pregunta requiere un dato que todavía no está conectado, te lo diré con claridad en vez de inventarlo. Puedes continuar con una pregunta relacionada y conservaré el contexto.',examples);
        return message;
    }

    function skyDataSaverActive() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        return Boolean(connection?.saveData || ['slow-2g','2g'].includes(connection?.effectiveType) || document.documentElement.dataset.crmSaveData === '1');
    }

    function hasStrongLocalIntent(raw, profile = detectProfile()) {
        const norm = commandNormalize(raw);
        if (/\b(categoria|categorias|categoría|categorías)\b/.test(norm)) return true;
        if (isMaterialFamilyQuery(raw)) return true;
        if (/\b(donde|ubicacion|ubicado|localiza|rack|zona|piso|cajon|posicion)\b/.test(norm)) return true;
        if (/\b(cuanto|cuantos|cuanta|cuantas|existencia|stock|tenemos|queda|quedan|hay)\b/.test(norm) && /\b(material|tubo|tuberia|cable|tornillo|pija|tuerca|rondana|arandela|abrazadera|conector|taquete|conduit|canaleta|pieza|metro|pulgada|mm|awg)\b/.test(norm)) return true;
        if (profile === 'almacen' && /bajo.*min|agotad|urge.*compr|reponer|reposicion|orden.*compra|\boc\b|herramient|vehiculo|pickup|camioneta|montacargas|generador|proyecto|picking|ruta/.test(norm)) return true;
        if ((profile === 'compras' || profile === 'recepcion') && /cotiz|proveedor|orden.*compra|requisicion|recepcion|servicio|tienda|comprar|entrega|precio|plazo|rfc|contacto|correo|email|whatsapp|telefono|quien.*vende|quién.*vende|quien.*surte|quién.*surte/.test(norm)) return true;
        if (profile === 'rh' && /trabajador|colaborador|personal|empleado|ausencia|vacaciones|incapacidad|documento|contrato|capacitacion|incidencia|asistencia|nomina|checador|checada|hora.*trabaj|entrada|salida|resguardo|equipo.*comput|computadora|laptop|monitor|mouse|teclado|base.*enfri|periferico|accesorio|material.*oficina/.test(norm)) return true;
        if (profile === 'finanzas' && /presupuesto|costo|consumido|planeado|gasto|finanza|cuenta.*pagar|proyecto/.test(norm)) return true;
        if (isExecutiveReadProfile(profile) && /proyecto|gasto|material|tubo|cable|stock|existencia|ubicacion|ubicación|personal|persona|trabajador|empleado|colaborador|recursos humanos|proveedor|cotiz|orden.*compra|compras|rfc|contacto|correo|email|whatsapp|telefono|mensaje|comunicacion|comunicación|quien.*vende|quién.*vende|quien.*surte|quién.*surte|sueldo|nomina|checador|checada|hora.*trabaj|entrada|salida|planeado|real|desviacion|presupuesto|alerta|pendiente|operacion|operación|bajo.*min|flotilla|vehiculo|vehículo|rollo|rollos|herramient|sin.*ubicacion|sin.*ubicación|resguardo|equipo.*comput|computadora|laptop|monitor|mouse|teclado|base.*enfri|material.*oficina/.test(norm)) return true;
        if (['proyectos','planeacion','coordinacion','logistica','administrador'].includes(profile) && /proyecto|avance|costo|solicitud|material|entrega|picking|ruta|responsable|vehiculo|vehículo|personal|proveedor|compra|cotiz|ubicacion|ubicación|stock|existencia|pendiente|alerta/.test(norm)) return true;
        if (profile === 'tsi' && /epp|casco|lente|guante|chaleco|botas|proteccion|protección|solicitud|proyecto|destinatario/.test(norm)) return true;
        return false;
    }

    function shouldUseSkyAI(raw, profile = detectProfile()) {
        if (!window.SkilledDB?.interpretSkyQuery || Date.now() < aiRetryAfter) return false;
        const norm=commandNormalize(raw);
        const words=norm.split(' ').filter(Boolean);
        if(words.length<2)return false;
        const followup=/^(y|tambien|también|ahora|ese|esa|esos|esas|el mismo|la misma)\b/.test(norm)||/\b(compara|comparame|compárame|resume|resumen|prioridad|prioridades|critico|crítico|riesgo|mayor|menor|mas alto|más alto|menos|cerca de entrega|requiere atencion|requiere atención|relaciona|combina)\b/.test(norm);
        if(followup)return true;
        if(/\b(mensaje|chat|dile|avisa|avisale|avísale|manda|envia|envía|escribele|escríbele|comenta|coméntale|informa|infórmale|reunion|reunión|junta|convoca|agenda|agendar)\b/.test(norm)&&words.length>=2)return true;
        if(/\b(quien|quién|que|qué|como|cómo|cual|cuál|cuales|cuáles|donde|dónde|cuanto|cuánto|cuantos|cuántos|cuanta|cuánta|muestra|buscar|busca|resume|resumen|explica|explicame|explícame|ayuda)\b/.test(norm)&&words.length>=2)return true;
        if(words.length>=5)return true;
        return !hasStrongLocalIntent(raw,profile)&&words.length>=3;
    }

    async function interpretWithSkyAI(raw, profile = detectProfile()) {
        if (!shouldUseSkyAI(raw, profile)) return null;
        const context={lastIntent:conversationContext.lastIntent,lastEntity:conversationContext.lastEntity,lastQuery:conversationContext.lastQuery,area:conversationContext.area,turns:conversationContext.turns};
        const key = `${profile}|${commandNormalize(raw)}|${commandNormalize(context.lastEntity)}`;
        if (aiQueryCache.has(key)) return aiQueryCache.get(key);
        try {
            const plan = await SkilledDB.interpretSkyQuery(raw, { profile, context });
            if (!plan?.intent || Number(plan.confidence || 0) < .5 || plan.intent === 'unknown') return null;
            aiQueryCache.set(key, plan);
            if (aiQueryCache.size > 48) aiQueryCache.delete(aiQueryCache.keys().next().value);
            return plan;
        } catch (error) {
            aiRetryAfter = Date.now() + Math.max(error?.code==='rate_limit'?30000:8000, Number(error?.retryAfterMs) || 0);
            return null;
        }
    }

    async function dispatchSkyAIPlan(plan, raw) {
        if (!plan) return null;
        const profile = detectProfile();
        const executive = isExecutiveReadProfile(profile);
        const queryText = text(plan.query || plan.entity || raw) || raw;
        rememberConversation(plan.intent, plan.entity || queryText, queryText);

        if (plan.intent === 'chat_message') {
            const result = await answerChatAction(raw, plan);
            return result?.voice || null;
        }
        if (plan.intent === 'meeting') {
            const result = await answerMeetingAction(queryText);
            return result?.voice || null;
        }
        if (plan.intent === 'global_search') return executive ? answerExecutiveGlobalSearch(queryText) : null;
        if (plan.intent === 'categories') return (executive || ['almacen','compras','proyectos','planeacion','coordinacion','logistica','administrador','tsi'].includes(profile)) ? answerCategories(queryText) : null;
        if (['material_family','material_stock','material_location'].includes(plan.intent)) {
            if (!(executive || ['compras','almacen','proyectos','planeacion','coordinacion','logistica','administrador','tsi','consulta'].includes(profile))) return null;
            if (plan.intent === 'material_family') return answerMaterialFamily(queryText);
            return answerMaterial(queryText, plan.intent === 'material_location');
        }
        if (plan.intent === 'low_stock') return (executive || ['compras','almacen','proyectos','planeacion','coordinacion','logistica','administrador'].includes(profile)) ? answerLowStock() : null;
        if (plan.intent === 'purchase_order') {
            if (executive) return answerExecutivePurchasing(raw);
            if (profile === 'compras') return answerPurchasing(raw);
            if (profile === 'almacen') return answerPurchase(raw);
            return null;
        }
        if (plan.intent === 'tools') return (executive || ['almacen','proyectos','planeacion','coordinacion','administrador'].includes(profile)) ? answerTools(raw) : null;
        if (plan.intent === 'vehicles') return (executive || ['rh','almacen','proyectos','planeacion','coordinacion','logistica','recepcion','finanzas','administrador'].includes(profile)) ? answerVehicles(raw) : null;
        if (plan.intent === 'project') {
            if (executive) return answerExecutive(raw);
            if (profile === 'finanzas') return answerFinance(raw);
            if (['rh','compras','proyectos','planeacion','coordinacion','logistica','almacen','recepcion','administrador','tsi','consulta'].includes(profile)) return answerProjects(raw);
            return null;
        }
        if (['supplier','quotation','store','service'].includes(plan.intent)) {
            if (executive) return answerExecutivePurchasing(raw);
            if(profile==='compras'||profile==='administrador')return answerPurchasing(raw);
            return ['recepcion','coordinacion','finanzas'].includes(profile)?answerScopedSmartSearch(raw,profile):null;
        }
        if (plan.intent === 'rh_assets') {
            if (executive) return answerRHOfficeAssets(raw,true);
            return profile === 'rh' ? answerRHOfficeAssets(raw,false) : null;
        }
        if (['rh_people','rh_documents','rh_incidents'].includes(plan.intent)) {
            if (executive) return answerExecutivePeople(raw, []);
            return ['rh','proyectos','planeacion','coordinacion','logistica','recepcion','administrador'].includes(profile) ? (profile==='rh'?answerRH(raw):answerScopedSmartSearch(raw,profile)) : null;
        }
        if (plan.intent === 'finance') return (executive || profile === 'finanzas') ? (executive ? answerExecutive(raw) : answerFinance(raw)) : null;
        if (plan.intent === 'executive') return executive ? answerExecutive(raw) : null;
        return null;
    }

    async function answerUniversalIntent(raw) {
        const norm=commandNormalize(raw);
        const profile=detectProfile();
        const executive=isExecutiveReadProfile(profile);
        if (/\b(hola|buenos dias|buen dia|buenas tardes|buenas noches|como estas|que tal)\b/.test(norm)) {
            const config=profileConfig();
            setAnswer('Hola, soy Sky',`Aún estoy en evolución, pero estoy lista para ayudarte en ${profileNames[profile]||'este perfil'}.`,'Puedes preguntarme con lenguaje natural. Si quieres, dime qué estás intentando resolver y buscaré la información disponible antes de pedirte que abras otro apartado.',pageAwareExamples(config).slice(0,6).map(item=>({title:item[0],detail:item[1]})));
            return 'Hola. Soy Sky. Aún estoy en evolución, pero estoy lista para ayudarte. Dime qué necesitas resolver y lo intentamos juntos.';
        }
        if (/\b(que puedes hacer|que sabes hacer|que haces|dime que haces|para que sirves|cual es tu funcion|que me puedes resolver|ayudame|ayuda|como me ayudas|en que ayudas|capacidades|opciones de sky)\b/.test(norm)) {
            const config=profileConfig();
            const examples=pageAwareExamples(config).slice(0,8).map(item=>({title:item[0],detail:item[1]}));
            const chatText='También puedo enviar mensajes por el Chat interno y generar reuniones cuando me lo pidas de forma explícita, por ejemplo: “Dile a Compras que ya llegó el material” o “Genera una reunión general a las 4 para revisar pendientes”.';const voiceText='Si activas Modo conversación en la configuración del micrófono, después de responder vuelvo a escucharte automáticamente, como una conversación continua.';
            setAnswer('¿Cómo puedo ayudarte?',`Puedo interpretar preguntas naturales, conservar el contexto de la conversación y consultar los datos autorizados para ${profileNames[profile]||'tu perfil'}. También puedo ayudarte a reformular preguntas, orientar procesos del CRM y sugerir el siguiente paso útil según el perfil activo.`,`No necesitas memorizar comandos. Pregunta como se lo preguntarías a una persona. En Gerencia, Subgerencia y la demo puedo buscar transversalmente; en los demás perfiles respeto únicamente la información de su área. ${chatText} ${voiceText}`,examples);
            return `Puedo ayudarte con consultas naturales sobre los datos autorizados de tu perfil. ${chatText} ${voiceText}`;
        }
        if (/\b(vehiculo|vehiculos|camioneta|pickup|placa|placas|flotilla|montacargas|generador)\b/.test(norm)) {
            if (executive || ['rh','almacen','proyectos','planeacion','coordinacion','logistica','recepcion','finanzas','administrador'].includes(profile)) return answerVehicles(raw);
            return null;
        }
        if (/\b(proyecto|proyectos|avance|entrega|responsable)\b/.test(norm)) {
            if (executive) return answerExecutive(raw);
            if (profile==='finanzas') return answerFinance(raw);
            if (['rh','compras','proyectos','planeacion','coordinacion','logistica','almacen','recepcion','administrador','tsi','consulta'].includes(profile)) return answerProjects(raw);
            return null;
        }
        if (/\b(proveedor|proveedores|cotizacion|cotizaciones|orden de compra|compras|requisicion|precio|plazo|rfc|whatsapp|correo|email)\b/.test(norm)) {
            if (executive) return answerExecutivePurchasing(raw);
            if (profile==='compras'||profile==='administrador') return answerPurchasing(raw);
            if (['recepcion','coordinacion','finanzas'].includes(profile)) return answerScopedSmartSearch(raw,profile);
            return null;
        }
        if (officeAssetIntent(raw)) {
            if (executive) return answerRHOfficeAssets(raw,true);
            if (profile==='rh') return answerRHOfficeAssets(raw,false);
            return null;
        }
        if (/\b(personal|persona|personas|trabajador|trabajadores|empleado|empleados|colaborador|colaboradores|rh|recursos humanos)\b/.test(norm)) {
            if (executive) return answerExecutivePeople(raw,[]);
            if (profile==='rh') return answerRH(raw);
            if (['proyectos','planeacion','coordinacion','logistica','recepcion','administrador'].includes(profile)) return answerScopedSmartSearch(raw,profile);
            return null;
        }
        if (/\b(categoria|categorias|categoría|categorías)\b/.test(norm) && /\b(cuantas|cuántas|cuantos|cuántos|lista|listar|muestra|mostrar|hay|tiene|tenemos|almacen|almacén|catalogo|catálogo)\b/.test(norm)) {
            if (executive || ['compras','almacen','proyectos','planeacion','coordinacion','logistica','administrador','tsi'].includes(profile)) return answerCategories(raw);
            return null;
        }
        if (/\b(material|materiales|tubo|tuberia|cable|tornillo|pija|pijas|tuerca|rondana|arandela|abrazadera|conector|taquete|conduit|canaleta|stock|existencia|ubicacion|ubicación|rack|almacen|almacén)\b/.test(norm)) {
            if (!(executive || ['compras','almacen','proyectos','planeacion','coordinacion','logistica','administrador','tsi','consulta'].includes(profile))) return null;
            if (isMaterialFamilyQuery(raw)) return answerMaterialFamily(raw);
            if (/donde|ubicacion|ubicación|rack|almacen|almacén/.test(norm)) return answerMaterial(raw,true);
            return answerMaterial(raw,false);
        }
        return null;
    }

    async function dispatchByProfile(raw) {
        const profile = detectProfile();
        const adapter = customProfiles.get(profile);
        if (adapter?.query) return answerGeneric(raw, profile);
        const universal=await answerUniversalIntent(raw).catch(()=>null);
        if(universal)return universal;
        const localIntent = hasStrongLocalIntent(raw, profile);
        if (profile === 'compras') return localIntent ? answerPurchasing(raw) : null;
        if (profile === 'rh') return localIntent ? answerRH(raw) : null;
        if (isExecutiveReadProfile(profile)) return localIntent ? answerExecutive(raw) : null;
        if (profile === 'finanzas') return localIntent ? answerFinance(raw) : null;
        if (['proyectos','planeacion','coordinacion','logistica'].includes(profile)) {
            if (!localIntent) return null;
            const scoped=await answerScopedSmartSearch(raw,profile).catch(()=>null);
            return scoped || answerProjects(raw);
        }
        if (profile === 'recepcion' || profile === 'administrador' || profile === 'tsi') return localIntent ? answerScopedSmartSearch(raw,profile) : null;
        if (profile === 'consulta') {
            const norm = commandNormalize(raw);
            if (/proyecto/.test(norm)) return answerProjects(raw);
            if (isMaterialFamilyQuery(raw)) return answerMaterialFamily(raw);
            if (/donde|ubicacion|ubicado|localiza/.test(norm)) return answerMaterial(raw, true);
            if (localIntent) return answerMaterial(raw, false);
            return null;
        }
        if (profile === 'almacen') return localIntent ? answerWarehouse(raw) : null;
        return null;
    }

    function resolveFollowUp(rawValue) {
        const original=text(rawValue);
        const norm=commandNormalize(original);
        if (conversationContext.material && /^(y\s+)?(donde|ubicacion|en que rack|donde esta|donde quedo)/.test(norm)) {
            return `¿Dónde está ${conversationContext.material.codigo || conversationContext.material.descripcion}?`;
        }
        if (conversationContext.material && /^(y\s+)?(cuanto|cuantos|cuanta|cuantas|existencia|stock|queda|quedan)/.test(norm)) {
            return `¿Cuánto tenemos de ${conversationContext.material.codigo || conversationContext.material.descripcion}?`;
        }
        if (conversationContext.vehicle && /^(y\s+)?(como esta|estado|disponible|kilometraje|cuantos km|donde esta)/.test(norm)) {
            return `Vehículo ${conversationContext.vehicle.nombre} ${original}`;
        }
        if (conversationContext.project && /^(y\s+)?(como va|como anda|cuanto lleva|cuanto se ha gastado|gasto|costo|avance|cuando entrega|fecha de entrega|que falta|qué falta|quien esta|quién está|quien trabaja|quién trabaja|materiales|compras|pendientes|y ese)/.test(norm)) {
            return `Proyecto ${conversationContext.project.proyecto || conversationContext.project.nombre} ${original}`;
        }
        if (conversationContext.supplier && /^(y\s+)?(su|el)?\s*(correo|email|whatsapp|telefono|teléfono|contacto|rfc|que vende|qué vende|que maneja|qué maneja)/.test(norm)) return `${conversationContext.supplier.nombre} ${original}`;
        if (conversationContext.person && /^(y\s+)?(su|sus|el|la)?\s*(puesto|departamento|proyecto|proyectos|horas|checadas|asistencia|equipo|equipos|resguardos|documentos|correo|email|telefono|teléfono|incidencias|vacaciones)/.test(norm)) return `${conversationContext.person.nombre || conversationContext.person.numero} ${original}`;
        if(conversationContext.lastEntity&&/^(y\s+)?(ese|esa|esos|esas|el mismo|la misma|ahora|tambien|también|y cuanto|y cuánto|y donde|y dónde|comparalo|compáralo|comparala|compárala)/.test(norm))return `${conversationContext.lastEntity} ${original}`;
        return original;
    }

    async function query(rawValue) {
        if(queryBusy){setStatus('Estoy terminando la consulta anterior…','busy');return;}
        const raw = resolveFollowUp(rawValue);
        if (!raw) return;
        queryBusy=true;
        const sendButton=document.getElementById('sky-send');
        if(sendButton)sendButton.disabled=true;
        activeQuestion = text(raw);
        stopListening(false);
        setStatus('Procesando consulta…', 'busy');
        setAnswer('Consultando', `Estoy interpretando tu solicitud en ${profileNames[detectProfile()] || detectProfile()}…`);
        try {
            const cleanRaw = expandEntityAliases(stripWakeWord(raw));
            const simple = await answerSimple(cleanRaw);
            let voice = simple.handled ? simple.voice : '';
            let usedAI = false;
            if (!simple.handled) {
                voice = await dispatchByProfile(cleanRaw);
                if (!voice) {
                    const plan = await interpretWithSkyAI(cleanRaw);
                    if (plan) {
                        voice = await dispatchSkyAIPlan(plan, cleanRaw);
                        usedAI = Boolean(voice);
                    }
                }
                if (!voice && shouldRunSmartSearch(cleanRaw, detectProfile())) voice = await answerScopedSmartSearch(cleanRaw, detectProfile());
                if (!voice && isExecutiveReadProfile() && shouldRunSmartSearch(cleanRaw, detectProfile())) voice = await answerExecutiveGlobalSearch(cleanRaw);
                if (!voice) {voice = await answerGeneralAI(cleanRaw, detectProfile());usedAI=Boolean(voice);}
                if (!voice) voice = await answerGeneric(cleanRaw, detectProfile());
            }
            rememberConversation(conversationContext.lastIntent,conversationContext.lastEntity,cleanRaw);
            if(voice)rememberTurn(cleanRaw,voice);
            setStatus(usedAI ? 'Consulta completada con interpretación avanzada.' : 'Consulta completada.');
            if (voice) speak(voice);
        } catch (error) {
            console.error('Sky:', error);
            setStatus('No se pudo completar la consulta.', 'error');
            setAnswer('Error', error.message || 'Ocurrió un error al consultar el CRM.', 'No se modificó ningún dato.');
        } finally {
            queryBusy=false;
            if(sendButton)sendButton.disabled=false;
        }
    }

    function registerProfile(key, adapter = {}) {
        const profile = text(key).toLowerCase();
        if (!profile) throw new Error('Indica el identificador del perfil para registrar Sky.');
        customProfiles.set(profile, adapter || {});
        return true;
    }

    function boot() {
        if (!skyAllowed()) {
            document.getElementById('sky-open')?.remove();
            document.getElementById('sky-overlay')?.remove();
            return;
        }
        createUi();
        const warm=()=>prewarmSkyProfileData();
        if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:2200});else setTimeout(warm,900);
        document.addEventListener('keydown', event => {
            if (event.altKey && !event.ctrlKey && !event.metaKey && String(event.key).toLowerCase() === 's') {
                event.preventDefault();
                if (modal?.classList.contains('is-open')) {
                    if (!listening && !recognitionStarting) startListening();
                    else finishListening();
                } else open();
            }
        });
        window.SkilledSky = Object.freeze({
            open,
            close,
            query,
            speak,
            previewVoice,
            getVoices: sortedVoices,
            getVoiceChoices: voiceChoices,
            getVoiceAlias: voiceAlias,
            inferVoiceGender,
            getVoicePreferences,
            saveVoicePreferences,
            shortcutLabel,
            profile: detectProfile,
            registerProfile,
            normalizeSpeech: value => correctRecognizedTranscript(value).corrected,
            clearSpeechLearning: () => { try { localStorage.removeItem(speechLearningStorageKey()); } catch (_) {} },
            clearConversation: clearSkyConversation,
            navigate: value => tryNavigation(`abre ${value}`),
            sendChat: (recipient,message) => executeChatMessage(recipient,message),
            prewarm: prewarmSkyProfileData,
            invalidate: () => { cache = { at: 0 }; cacheTimes = Object.create(null); dataPromises.clear(); aiQueryCache.clear(); prewarmProfile=''; speechLexiconCache = { profile: '', sourceAt: -1, words: [], set: new Set(), buckets: new Map() }; }
        });
        window.dispatchEvent(new CustomEvent('skilled:skyready', { detail: window.SkilledSky }));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
