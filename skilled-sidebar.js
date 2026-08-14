(function () {
    'use strict';

    const icons = {
        home: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"></path><path d="M5.5 10.5V20h13v-9.5"></path><path d="M9.5 20v-6h5v6"></path></svg>',
        scanner: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"></path><path d="M9 7v10M12 7v10M15 7v10"></path></svg>',
        user: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"></path><path d="M5 21a7 7 0 0114 0"></path></svg>',
        box: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7l-8-4-8 4"></path><path d="M20 7l-8 4-8-4"></path><path d="M20 7v10l-8 4-8-4V7"></path><path d="M12 11v10"></path></svg>',
        alert: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v2m0 4h.01"></path><path d="M10.3 4.4 2.9 17.2A2 2 0 004.6 20h14.8a2 2 0 001.7-2.8L13.7 4.4a2 2 0 00-3.4 0z"></path></svg>',
        warehouse: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"></path><path d="M5 21V6l7-3 7 3v15"></path><path d="M8 9h2m4 0h2M8 13h2m4 0h2"></path><path d="M9 21v-4h6v4"></path></svg>',
        tag: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h.01"></path><path d="M3 11l8.6-8.6A2 2 0 0113 2h5a2 2 0 012 2v5a2 2 0 01-.6 1.4L10.8 19a2 2 0 01-2.8 0l-5-5a2 2 0 010-3z"></path></svg>',
        plus: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
        history: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l3 2"></path></svg>',
        clipboard: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h6"></path><path d="M9 3h6a2 2 0 012 2v1h2v15H5V6h2V5a2 2 0 012-2z"></path><path d="M9 12l2 2 4-4"></path></svg>',
        delivery: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8l-9-5-9 5 9 5 9-5z"></path><path d="M3 8v8l9 5 9-5V8"></path><path d="M12 13v8"></path></svg>',
        request: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6z"></path><path d="M9 7h6M9 11h6M9 15h4"></path></svg>',
        cart: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.5 11h10L20 8H7"></path><path d="M9 20h.01M17 20h.01"></path></svg>',
        folder: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"></path></svg>',
        report: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"></path><path d="M8 17v-5m4 5V7m4 10v-3"></path></svg>',
        tool: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 01-5 5L3 18l3 3 6.7-6.7a4 4 0 005-5l-3 3-3-3 3-3z"></path></svg>',
        layers: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5-10-5z"></path><path d="m2 12 10 5 10-5"></path><path d="m2 17 10 5 10-5"></path></svg>',
        assignment: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a4 4 0 10-8 0M4 21a8 8 0 0116 0"></path><path d="M17 4h5m-2.5-2.5V6.5"></path></svg>',
        vehicle: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13l2-5a2 2 0 012-1h10a2 2 0 012 1l2 5v6h-2v-2H5v2H3v-6z"></path><path d="M5 13h14M7 16h.01M17 16h.01"></path></svg>',
        manual: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"></path><path d="M9 7h7M9 11h7"></path></svg>',
        automation: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"></path><circle cx="12" cy="12" r="4"></circle></svg>',
        server: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="2"></rect><rect x="3" y="14" width="18" height="6" rx="2"></rect><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"></path></svg>',
        logout: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 16l4-4-4-4"></path><path d="M21 12H7"></path><path d="M13 19v1H4V4h9v1"></path></svg>'
    };

    function currentRole(){
        if(window.SkilledSession?.role)return String(window.SkilledSession.role).toLowerCase();
        if(document.documentElement.dataset.role)return document.documentElement.dataset.role.toLowerCase();
        try{return String(JSON.parse(localStorage.getItem('skilled_profile_cache')||'null')?.rol||'consulta').toLowerCase()}catch(_){return'consulta'}
    }
    function pageProfileKey() {
        const requested = String(new URLSearchParams(location.search).get('perfil') || '').toLowerCase();
        if (['administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta'].includes(requested)) return requested;
        const file = currentFile().toLowerCase();
        const warehouseLegacyFiles = new Set(['inicio.html','catalogo.html','almacenes.html','bajo-minimo.html','etiquetas.html','escaner.html','herramientas.html','historial-movimientos.html','reportes.html','solicitudes-compra.html','importar-materiales.html','estado-herramientas.html','proyectos.html']);
        if (warehouseLegacyFiles.has(file)) return 'almacen';
        if (file.startsWith('co.')) return 'compras';
        if (file.startsWith('rh.')) return 'rh';
        if (file.startsWith('fi.')) return 'finanzas';
        if (file.startsWith('gg.')) return 'gerente_general';
        if (file.startsWith('sg.')) return 'subgerente';
        if (file.startsWith('tsi.')) return 'tsi';
        if (file.startsWith('sky.')) return 'sky_demo';
        if (file.startsWith('al.')) return 'almacen';
        const bodyProfile = String(document.body?.dataset?.profile || document.documentElement?.dataset?.profile || '').toLowerCase();
        if (['administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta'].includes(bodyProfile)) return bodyProfile;
        const remembered = sessionStorage.getItem('skilled_active_profile');
        return ['administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta'].includes(remembered) ? remembered : '';
    }
    function sidebarProfileKey(role = currentRole()) {
        const pageProfile = pageProfileKey();
        if (pageProfile) {
            sessionStorage.setItem('skilled_active_profile', pageProfile);
            return pageProfile;
        }
        const value = String(role || 'consulta').toLowerCase();
        if (value === 'jefe_almacen') return 'almacen';
        if (['administrador','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta'].includes(value)) return value;
        return 'almacen';
    }
    const skyProfiles = new Set(['administrador','jefe_almacen','almacen','compras','proyectos','planeacion','coordinacion','logistica','recepcion','rh','finanzas','gerente_general','subgerente','tsi','sky_demo','consulta']);
    function skyAllowed() {
        const profile=pageProfileKey();
        const allowed=skyProfiles.has(profile);
        document.documentElement.dataset.skyAllowed=allowed?'1':'0';
        return allowed;
    }
    function sidebarStorageKey(role = currentRole()) {
        return `skilled_sidebar_compact_${sidebarProfileKey(role)}`;
    }
    function sidebarScrollKey(role = currentRole()) {
        return `skilled_sidebar_scroll_${sidebarProfileKey(role)}`;
    }
    function sidebarCompactFor(role = currentRole()) {
        return localStorage.getItem(sidebarStorageKey(role)) === '1';
    }
    function themeStorageKey(role = currentRole()) {
        return `skilled_tema_${sidebarProfileKey(role)}`;
    }
    function applySidebarWidth(aside, compact) {
        if (!aside) return;
        document.body?.classList.add('skilled-has-sidebar');
        const mobile = window.matchMedia('(max-width: 1023px)').matches;
        if (mobile) {
            aside.style.width = 'min(300px, 88vw)';
            aside.style.flexBasis = 'auto';
        } else {
            const width = compact ? '76px' : '260px';
            aside.style.width = width;
            aside.style.flexBasis = width;
        }
        aside.style.minWidth = mobile ? '0' : (compact ? '76px' : '260px');
        aside.style.overflowX = 'hidden';
        document.documentElement.dataset.crmSidebarCompact = compact ? '1' : '0';
        document.documentElement.dataset.crmSidebarProfile = sidebarProfileKey();
        document.documentElement.style.setProperty('--crm-sidebar-live', mobile ? '0px' : (compact ? '76px' : '260px'));
        requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('skilled:sidebarstate', { detail: { compact, mobile } })));
    }
    const warehouseSections=[
        {title:'Cuenta',items:[['AL.inicio.html','Inicio','home'],['AL.escaner.html','Escáner','scanner'],['perfil.html','Mi perfil','user']]},
        {title:'Materiales',items:[['AL.catalogo.html','Catálogo','box'],['AL.bajo-minimo.html','Bajo mínimo','alert'],['AL.almacenes.html','Almacenes','warehouse'],['AL.etiquetas.html','Etiquetas','tag']]},
        {title:'Automatización',items:[['AL.automatizaciones.html','Centro inteligente','automation']]},
        {title:'Movimientos',items:[['AL.movimientos.html','Registrar movimiento','plus'],['AL.historial-movimientos.html','Historial movimientos','history'],['AL.tomas-fisicas.html','Tomas físicas','clipboard']]},
        {title:'Compras y solicitudes',items:[['AL.entrega-directa.html','Entrega directa','delivery'],['PAQ.paquetes-materiales.html','Paquetes predeterminados','box'],['AL.solicitudes-material.html','Solicitudes de material','request'],['AL.solicitudes-epp-tsi.html','Solicitudes EPP TSI','request'],['AL.ordenes-compra.html','Órdenes de compra','cart']]},
        {title:'Proyectos y reportes',items:[['AL.proyectos.html','Proyectos','folder'],['PROY.importar.html?perfil=almacen','Importar proyectos','delivery'],['AL.reportes.html','Reportes','report']]},
        {title:'Herramientas',items:[['AL.herramientas.html','Herramientas','tool'],['AL.unidades-herramientas.html','Unidades','layers'],['AL.asignaciones-herramientas.html','Asignaciones','assignment'],['AL.estado-herramientas.html','Estado actual','layers'],['AL.historial-herramientas.html','Historial','history']]},
        {title:'Vehículos',items:[['AL.vehiculos.html','Control vehicular','vehicle']]},
        {title:'Ayuda',items:[['AL.manual-usuario.html','Manual de usuario','manual']]}
    ];
    const profileSections={
        compras:[
            {title:'Operación de compras',items:[['CO.inicio.html','Inicio','home'],['CO.cotizaciones.html','Cotizaciones','request'],['CO.requisiciones.html','Requisiciones','clipboard'],['CO.ordenes-compra.html','Órdenes de compra','cart'],['CO.hacer-compra.html','Hacer compra','cart'],['CO.recepciones.html','Recepciones','delivery']]},
            {title:'Red de suministro',items:[['CO.proveedores.html','Proveedores y materiales','folder'],['CO.entregas.html','Información de entrega','delivery'],['AL.catalogo.html?perfil=compras','Consulta de catálogo','box']]},
            {title:'Proyectos',items:[['AL.proyectos.html?perfil=compras','Proyectos','folder']]},
            {title:'Compras generales',items:[['PAQ.paquetes-materiales.html?perfil=compras','Paquetes de materiales','box'],['CO.tienda.html','Tienda','box'],['CO.servicios.html','Servicios','clipboard']]},
            {title:'Consulta',items:[['AL.historial-movimientos.html?perfil=compras','Historial de movimientos','history']]},
            {title:'Cuenta',items:[['perfil.html?perfil=compras','Mi perfil','user']]}
        ],
        rh:[
            {title:'Operación de personal',items:[['RH.inicio.html','Inicio','home'],['RH.personal.html','Personal','user'],['RH.equipos.html','Equipos y resguardos','layers'],['RH.proyectos.html','Proyectos y asignaciones','folder'],['PROY.importar.html?perfil=rh','Importar proyectos','delivery'],['RH.nomina.html','Nómina','clipboard'],['RH.checador.html','Checador de asistencia','history'],['RH.asistencias.html','Asistencias e incidencias','history']]},
            {title:'Desarrollo y cumplimiento',items:[['RH.documentos.html','Documentos','folder'],['RH.capacitacion.html','Capacitación','report']]},
            {title:'Operación compartida',items:[['PAQ.paquetes-materiales.html?perfil=rh','Paquetes de materiales','box'],['AL.vehiculos.html?perfil=rh','Control vehicular','vehicle']]},
            {title:'Cuenta',items:[['perfil.html?perfil=rh','Mi perfil','user']]}
        ],
        finanzas:[{title:'Finanzas',items:[['FI.inicio.html','Inicio','home'],['FI.presupuestos.html','Presupuestos','report'],['FI.gastos.html','Gastos','cart'],['FI.cuentas-pagar.html','Cuentas por pagar','clipboard'],['FI.reportes.html','Reportes financieros','report']]},{title:'Solicitudes internas',items:[['PAQ.paquetes-materiales.html?perfil=finanzas','Paquetes de materiales','box']]},{title:'Consulta',items:[['AL.proyectos.html?perfil=finanzas','Proyectos','folder'],['AL.reportes.html?perfil=finanzas','Reportes operativos','report']]},{title:'Cuenta',items:[['perfil.html?perfil=finanzas','Mi perfil','user']]}],
        gerente_general:[{title:'Dirección',items:[['GG.inicio.html','Inicio ejecutivo','home'],['GG.proyectos.html','Proyectos y costos','report'],['GG.vehiculos.html','Vehículos','vehicle'],['PAQ.paquetes-materiales.html?perfil=gerente_general','Paquetes de materiales','box']]},{title:'Cuenta',items:[['perfil.html?perfil=gerente_general','Mi perfil','user']]}],
        subgerente:[{title:'Dirección',items:[['SG.inicio.html','Inicio ejecutivo','home'],['SG.proyectos.html','Proyectos y costos','report'],['SG.vehiculos.html','Vehículos','vehicle'],['PAQ.paquetes-materiales.html?perfil=subgerente','Paquetes de materiales','box']]},{title:'Cuenta',items:[['perfil.html?perfil=subgerente','Mi perfil','user']]}],
        sky_demo:[{title:'Sky',items:[['SKY.inicio.html','Modo presentación','home']]},{title:'Cuenta',items:[['perfil.html?perfil=sky_demo','Mi perfil','user']]}],
        tsi:[{title:'TSI',items:[['TSI.inicio.html','Inicio','home'],['TSI.solicitudes-epp.html','Solicitar EPP','request'],['PAQ.paquetes-materiales.html?perfil=tsi','Paquetes de materiales','box']]},{title:'Cuenta',items:[['perfil.html?perfil=tsi','Mi perfil','user']]}],
        proyectos:[{title:'Proyectos',items:[['AL.proyectos.html','Proyectos','folder'],['PROY.importar.html?perfil=proyectos','Importar proyectos','delivery'],['PAQ.paquetes-materiales.html?perfil=proyectos','Paquetes de materiales','box'],['AL.solicitudes-material.html','Solicitudes','request'],['AL.reportes.html','Reportes','report'],['AL.historial-movimientos.html','Movimientos','history']]},{title:'Cuenta',items:[['perfil.html','Mi perfil','user']]}],
        consulta:[{title:'Consulta',items:[['AL.inicio.html','Inicio','home'],['PAQ.paquetes-materiales.html','Paquetes de materiales','box'],['AL.catalogo.html','Catálogo','box'],['AL.reportes.html','Reportes','report'],['AL.manual-usuario.html','Manual','manual']]},{title:'Cuenta',items:[['perfil.html','Mi perfil','user']]}]
    };
    function sectionsForRole(){const role=currentRole();const profile=sidebarProfileKey(role);if(role==='administrador'){const base=(profile==='almacen'?warehouseSections:(profileSections[profile]||warehouseSections)).map(section=>({title:section.title,items:[...section.items]}));base.push({title:'Administración',items:[['ADM.importaciones.html','Centro de importaciones','delivery'],['ADM.limpieza.html','Limpieza de pruebas','server']]});return base}return ['jefe_almacen','almacen'].includes(role)?warehouseSections:(profileSections[role]||profileSections.consulta)}


    function currentFile() {
        let file = decodeURIComponent((location.pathname.split('/').pop() || 'AL.inicio.html')).toLowerCase();
        if (file && !/\.html?$/.test(file)) file += '.html';
        if (file === 'al.etiqueta.html') file = 'al.etiquetas.html';
        if (file === 'al.importar-materiales.html') file = 'al.catalogo.html';
        if (file === 'importar-herramientas.html') file = 'al.herramientas.html';
        return file;
    }

    function linkMarkup(item, activeFile) {
        const [href, label, icon] = item;
        const isActive = href.toLowerCase().split('?')[0] === activeFile;
        const classes = isActive
            ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#141d34] border-l-2 border-blue-500 text-white font-semibold'
            : 'flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#11182c] transition text-gray-400 hover:text-white';
        const iconMarkup = icons[icon].replace('class="w-4 h-4 shrink-0"', `class="w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-500'}"`);
        return `<li><a href="${href}" title="${label}" data-sidebar-link class="${classes}">${iconMarkup}<span class="skilled-sidebar-label">${label}</span></a></li>`;
    }

    function scheduleSidebarPrefetch(aside) {
        if (!aside || typeof window.SkilledNavigationPrefetch !== 'function') return;
        const run = () => {
            const links = [...aside.querySelectorAll('a[data-sidebar-link][href]')]
                .filter(link => !link.classList.contains('border-blue-500'))
                .slice(0, 5);
            links.forEach(link => window.SkilledNavigationPrefetch(link.getAttribute('href')));
        };
        if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1800 });
        else setTimeout(run, 900);
    }

    function renderSidebar() {
        const activeFile = currentFile();
        const role = currentRole();
        const sections = sectionsForRole();
        const homeHref = sections[0]?.items?.[0]?.[0] || 'inicio.html';
        const aside = document.createElement('aside');
        aside.id = 'skilled-sidebar';
        aside.dataset.role = role;
        renderedRole = role;
        aside.className = 'skilled-sidebar-shell h-screen sticky top-0 bg-[#090d1a] border-r border-[#161f38] flex flex-col justify-between shrink-0';
        aside.innerHTML = `
            <div class="overflow-y-auto flex-1 lista-scroll">
                <div class="skilled-sidebar-brand border-b border-[#161f38] flex items-center justify-between gap-2">
                    <a href="${homeHref}" title="Ir al inicio" class="skilled-sidebar-logo-link">
                        <img src="logo-reporte.png" alt="Skilled Logo" class="skilled-sidebar-logo h-9 w-auto object-contain">
                    </a>
                    <button type="button" class="skilled-sidebar-collapse" data-sidebar-collapse title="Minimizar menú" aria-label="Minimizar menú">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
                    </button>
                </div>
                <nav class="p-4 space-y-6 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                    ${sections.map(section => `
                        <div>
                            <span class="skilled-sidebar-section-title px-3 block mb-2">${section.title}</span>
                            <ul class="space-y-1 text-xs normal-case text-gray-400 font-medium">
                                ${section.items.map(item => linkMarkup(item, activeFile)).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </nav>
            </div>
            <div class="p-4 border-t border-[#161f38] bg-[#070b16]">
                <a href="login.html" title="Cerrar sesión" class="skilled-sidebar-logout w-full flex items-center justify-center gap-2 bg-[#10172a] hover:bg-red-950/20 border border-[#232f4e] text-red-400 hover:text-red-300 py-2.5 rounded-lg text-xs font-semibold transition">
                    ${icons.logout}
                    <span class="skilled-sidebar-label">Cerrar sesión</span>
                </a>
            </div>`;

        const existing = document.querySelector('body > aside') || document.querySelector('aside');
        if (existing) existing.replaceWith(aside);
        else document.body.prepend(aside);

        const scroll = aside.querySelector('.lista-scroll');
        const scrollKey = sidebarScrollKey(role);
        const saved = Number(sessionStorage.getItem(scrollKey) || 0);
        if (scroll) {
            requestAnimationFrame(() => {
                scroll.scrollTop = Number.isFinite(saved) ? saved : 0;
                const active = scroll.querySelector('a.border-blue-500');
                if (!saved && active) active.scrollIntoView({ block: 'nearest' });
            });
            let timer = null;
            scroll.addEventListener('scroll', () => {
                clearTimeout(timer);
                timer = setTimeout(() => sessionStorage.setItem(scrollKey, String(scroll.scrollTop)), 80);
            }, { passive: true });
            scroll.querySelectorAll('a[href]').forEach(link => link.addEventListener('click', () => {
                sessionStorage.setItem(scrollKey, String(scroll.scrollTop));
            }));
        }
        setupSidebarControls(aside);
        scheduleSidebarPrefetch(aside);
    }

    function setupSidebarControls(aside) {
        if (!aside) return;
        const compact = sidebarCompactFor();
        document.body.classList.toggle('skilled-sidebar-collapsed', compact);
        applySidebarWidth(aside, compact);
        const collapseButton = aside.querySelector('[data-sidebar-collapse]');
        if (collapseButton) {
            collapseButton.title = compact ? 'Expandir menú' : 'Minimizar menú';
            collapseButton.setAttribute('aria-label', collapseButton.title);
        }
        aside.querySelector('[data-sidebar-collapse]')?.addEventListener('click', () => {
            if (window.matchMedia('(max-width: 1023px)').matches) {
                document.body.classList.remove('skilled-mobile-sidebar-open');
                return;
            }
            const next = !document.body.classList.contains('skilled-sidebar-collapsed');
            document.body.classList.toggle('skilled-sidebar-collapsed', next);
            localStorage.setItem(sidebarStorageKey(), next ? '1' : '0');
            applySidebarWidth(aside, next);
            const button = aside.querySelector('[data-sidebar-collapse]');
            if (button) {
                button.title = next ? 'Expandir menú' : 'Minimizar menú';
                button.setAttribute('aria-label', button.title);
            }
        });
        aside.querySelectorAll('a[href]').forEach(link => link.addEventListener('click', () => {
            if (window.matchMedia('(max-width: 1023px)').matches) document.body.classList.remove('skilled-mobile-sidebar-open');
        }));
        ensureMobileSidebarTrigger();
        ensureSidebarOverlay();
        if (aside.dataset.sidebarResizeBound !== '1') {
            aside.dataset.sidebarResizeBound = '1';
            let resizeTimer = 0;
            window.addEventListener('resize', () => {
                window.clearTimeout(resizeTimer);
                resizeTimer = window.setTimeout(() => applySidebarWidth(aside, sidebarCompactFor()), 80);
            }, { passive: true });
        }
        if (document.documentElement.dataset.sidebarEscapeBound !== '1') {
            document.documentElement.dataset.sidebarEscapeBound = '1';
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape') document.body.classList.remove('skilled-mobile-sidebar-open');
            });
        }
    }

    function ensureSidebarOverlay() {
        let overlay = document.getElementById('skilled-sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('button');
            overlay.id = 'skilled-sidebar-overlay';
            overlay.type = 'button';
            overlay.setAttribute('aria-label', 'Cerrar menú');
            overlay.addEventListener('click', () => document.body.classList.remove('skilled-mobile-sidebar-open'));
            document.body.appendChild(overlay);
        }
    }

    function ensureMobileSidebarTrigger() {
        const header = document.querySelector('body > div header, header');
        if (!header || header.querySelector('[data-sidebar-mobile-toggle]')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.sidebarMobileToggle = '1';
        button.className = 'skilled-mobile-sidebar-toggle';
        button.title = 'Abrir menú';
        button.setAttribute('aria-label', 'Abrir menú');
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>';
        button.addEventListener('click', () => document.body.classList.toggle('skilled-mobile-sidebar-open'));
        header.prepend(button);
    }

    function normalizeBreadcrumbHome() {
        const homeSvg = icons.home.replace('class="w-4 h-4 shrink-0"', 'class="w-3.5 h-3.5 shrink-0"');
        document.querySelectorAll('main span, main a').forEach(element => {
            const value = (element.textContent || '').trim();
            if (value === '🏠' || value === '🏡') {
                element.innerHTML = homeSvg;
                element.setAttribute('aria-label', 'Inicio');
                element.setAttribute('title', 'Inicio');
            }
        });
    }

    const badgeCacheKey = 'skilled_sidebar_badges_v70';
    let badgeUpdatePromise = null;
    function renderRequestBadges(data = {}) {
        const setBadge = (href, count, color = 'bg-blue-600') => {
            const link = document.querySelector(`a[href="${href}"],a[href^="${href}?"]`);
            if (!link) return;
            let badge = link.querySelector('[data-request-badge]');
            if (!count) { badge?.remove(); return; }
            if (!badge) {
                badge = document.createElement('span');
                badge.dataset.requestBadge = '1';
                link.appendChild(badge);
            }
            badge.className = `ml-auto min-w-5 h-5 px-1 rounded-full ${color} text-white text-[9px] font-bold flex items-center justify-center`;
            badge.textContent = count > 99 ? '99+' : String(count);
        };
        setBadge('CO.servicios.html', Number(data.serviceCount) || 0, 'bg-amber-500');
        setBadge('AL.solicitudes-material.html', Number(data.materialCount) || 0, 'bg-blue-600');
        setBadge('CO.cotizaciones.html', Number(data.quotationCount) || 0, 'bg-emerald-600');
        setBadge('PAQ.paquetes-materiales.html', Number(data.packageCount) || 0, 'bg-violet-600');
    }
    function cachedBadgeData() {
        try {
            const value = JSON.parse(sessionStorage.getItem(badgeCacheKey) || 'null');
            if (value && Date.now() - Number(value.at || 0) < 30000) return value;
        } catch (_) {}
        return null;
    }
    async function updateRequestBadge(force = false) {
        if (!window.SkilledDB) return;
        const cached = !force ? cachedBadgeData() : null;
        if (cached) { renderRequestBadges(cached); return; }
        if (badgeUpdatePromise) return badgeUpdatePromise;
        badgeUpdatePromise = (async () => {
            const data = { at:Date.now(), serviceCount:0, materialCount:0, quotationCount:0, packageCount:0 };
            try {
                if (typeof window.SkilledDB.listUnreadNotifications === 'function') {
                    const notifications = await window.SkilledDB.listUnreadNotifications();
                    data.serviceCount = notifications.filter(item => item.tipo === 'servicio_proximo_pago').length;
                    data.materialCount = notifications.length - data.serviceCount;
                }
                if (sidebarProfileKey() === 'compras' && typeof window.SkilledDB.listQuotationRequests === 'function') {
                    const quotations = await window.SkilledDB.listQuotationRequests({});
                    data.quotationCount = quotations.filter(item => ['solicitada','en_revision','cotizando'].includes(String(item.estado || '').toLowerCase())).length;
                }
                if (typeof window.SkilledDB.countMaterialPackageRequests === 'function') {
                    data.packageCount = await window.SkilledDB.countMaterialPackageRequests();
                }
                try { sessionStorage.setItem(badgeCacheKey, JSON.stringify(data)); } catch (_) {}
                renderRequestBadges(data);
            } catch (error) {
                console.debug('No se pudieron cargar los indicadores del menú:', error);
            } finally {
                badgeUpdatePromise = null;
            }
        })();
        return badgeUpdatePromise;
    }
    function scheduleRequestBadgeUpdate() {
        const run = () => updateRequestBadge(false);
        if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout:2400 });
        else setTimeout(run, 1200);
    }

    const headerIcons = {
        refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66"></path><path d="M20 4v7h-7"></path></svg>',
        sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>',
        moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"></path></svg>',
        search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.7-3.7"></path></svg>'
    };

    const roleAccess = {
        administrador:['*'],
        jefe_almacen:['al.inicio.html','perfil.html','al.escaner.html','al.catalogo.html','al.importar-materiales.html','al.bajo-minimo.html','al.almacenes.html','al.etiquetas.html','al.movimientos.html','al.historial-movimientos.html','al.tomas-fisicas.html','al.entrega-directa.html','al.solicitudes-material.html','al.ordenes-compra.html','al.reportes.html','al.proyectos.html','al.herramientas.html','al.unidades-herramientas.html','al.asignaciones-herramientas.html','al.estado-herramientas.html','al.historial-herramientas.html','al.vehiculos.html','al.automatizaciones.html','al.manual-usuario.html','paq.paquetes-materiales.html'],
        almacen:['al.inicio.html','perfil.html','al.escaner.html','al.catalogo.html','al.importar-materiales.html','al.bajo-minimo.html','al.almacenes.html','al.etiquetas.html','al.movimientos.html','al.historial-movimientos.html','al.tomas-fisicas.html','al.entrega-directa.html','al.solicitudes-material.html','al.ordenes-compra.html','al.reportes.html','al.proyectos.html','al.herramientas.html','al.unidades-herramientas.html','al.asignaciones-herramientas.html','al.estado-herramientas.html','al.historial-herramientas.html','al.vehiculos.html','al.automatizaciones.html','al.manual-usuario.html','paq.paquetes-materiales.html'],
        compras:['co.inicio.html','co.cotizaciones.html','co.ordenes-compra.html','co.proveedores.html','co.requisiciones.html','co.recepciones.html','co.hacer-compra.html','co.entregas.html','co.tienda.html','co.servicios.html','perfil.html','al.catalogo.html','al.bajo-minimo.html','al.historial-movimientos.html','al.proyectos.html','paq.paquetes-materiales.html'],
        rh:['rh.inicio.html','rh.personal.html','rh.equipos.html','rh.proyectos.html','rh.nomina.html','rh.checador.html','rh.asistencias.html','rh.documentos.html','rh.capacitacion.html','al.vehiculos.html','perfil.html','paq.paquetes-materiales.html'],
        finanzas:['fi.inicio.html','fi.presupuestos.html','fi.gastos.html','fi.cuentas-pagar.html','fi.reportes.html','perfil.html','al.proyectos.html','al.reportes.html','paq.paquetes-materiales.html'],
        gerente_general:['gg.inicio.html','gg.proyectos.html','gg.vehiculos.html','perfil.html','paq.paquetes-materiales.html'],
        subgerente:['sg.inicio.html','sg.proyectos.html','sg.vehiculos.html','perfil.html','paq.paquetes-materiales.html'],
        sky_demo:['sky.inicio.html','perfil.html'],
        tsi:['tsi.inicio.html','tsi.solicitudes-epp.html','perfil.html','paq.paquetes-materiales.html'],
        proyectos:['al.proyectos.html','al.reportes.html','al.solicitudes-material.html','al.historial-movimientos.html','perfil.html','paq.paquetes-materiales.html'],
        consulta:['al.inicio.html','al.catalogo.html','al.reportes.html','al.manual-usuario.html','perfil.html','paq.paquetes-materiales.html']
    };

    let searchIndexPromise = null;
    let searchIndexCreatedAt = 0;
    let activeSearchResult = -1;
    const SEARCH_CACHE_TTL = 30000;
    function searchCacheKey(role) { return `skilled_search_index_v70_${role || 'consulta'}`; }
    function readSearchCache(role) {
        try {
            const value = JSON.parse(sessionStorage.getItem(searchCacheKey(role)) || 'null');
            if (value && Array.isArray(value.entries) && Date.now() - Number(value.at || 0) < SEARCH_CACHE_TTL) return value.entries;
        } catch (_) {}
        return null;
    }
    function writeSearchCache(role, entries) {
        try {
            const json = JSON.stringify({ at:Date.now(), entries });
            if (json.length < 1800000) sessionStorage.setItem(searchCacheKey(role), json);
        } catch (_) {}
    }
    let globalSearchTimer = null;
    let resolvedRole = '';
    let renderedRole = '';

    function cleanText(value) {
        return String(value ?? '').replace(/\s+/g, ' ').trim();
    }

    function searchText(value) {
        if (window.SkilledSearch?.normalize) return window.SkilledSearch.normalize(value);
        return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX');
    }

    function safeHtml(value) {
        return cleanText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function addSharedStyles() {
        if (document.getElementById('skilled-shared-ui-v26')) return;
        const style = document.createElement('style');
        style.id = 'skilled-shared-ui-v26';
        style.textContent = `
            .skilled-header-button{width:36px;height:36px;border:1px solid transparent;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;color:#8794aa;background:transparent;transition:.18s;flex:0 0 auto}.skilled-header-button:hover{color:#fff;background:#11182c;border-color:#243257}.skilled-header-button svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.skilled-header-button:disabled{opacity:.45;cursor:wait}.skilled-global-search-host{position:relative!important}.skilled-global-search-input{padding-left:38px!important}.skilled-global-search-icon{position:absolute;left:13px;top:50%;width:16px;height:16px;transform:translateY(-50%);color:#65718a;pointer-events:none;z-index:2}.skilled-global-search-icon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.skilled-global-results{position:absolute;left:0;right:0;top:calc(100% + 9px);z-index:250;max-height:min(520px,72vh);overflow:auto;border:1px solid #243257;border-radius:13px;background:#0b1120;box-shadow:0 24px 70px rgba(0,0,0,.48);padding:7px}.skilled-global-results[hidden]{display:none!important}.skilled-search-status{padding:15px 14px;color:#7d899f;font-size:11px;text-align:center}.skilled-search-item{display:flex;align-items:center;gap:11px;width:100%;border:1px solid transparent;border-radius:10px;padding:10px;text-decoration:none;color:#d7deeb;transition:.16s}.skilled-search-item:hover,.skilled-search-item.is-active{background:#141d34;border-color:#2b3b5d;color:#fff}.skilled-search-symbol{width:34px;height:34px;border-radius:9px;border:1px solid #243257;background:#10172a;color:#65a4ff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:0 0 auto}.skilled-search-copy{min-width:0;flex:1}.skilled-search-title{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.skilled-search-subtitle{margin-top:2px;color:#78859c;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.skilled-search-type{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#718096;border:1px solid #243257;border-radius:999px;padding:3px 6px;flex:0 0 auto}body.tema-claro .skilled-header-button{color:#5d687b}body.tema-claro .skilled-header-button:hover{background:#e8edf5;color:#111827;border-color:#cfd8e6}body.tema-claro .skilled-global-results{background:#fff;border-color:#d5deeb;box-shadow:0 22px 55px rgba(15,23,42,.18)}body.tema-claro .skilled-search-item{color:#1f2937}body.tema-claro .skilled-search-item:hover,body.tema-claro .skilled-search-item.is-active{background:#eef3fa;border-color:#cad6e6;color:#111827}body.tema-claro .skilled-search-symbol{background:#eef3fa;border-color:#d6deea;color:#2563eb}body.tema-claro .skilled-search-subtitle,body.tema-claro .skilled-search-type{color:#64748b}body.tema-claro header{background:#fff!important;border-color:#dbe3ef!important}body.tema-claro #skilled-sidebar{background:#fff!important;border-color:#dbe3ef!important}body.tema-claro #skilled-sidebar .bg-\[\#070b16\]{background:#f7f9fc!important}body.tema-claro #skilled-sidebar .bg-\[\#10172a\]{background:#eef2f8!important}body.tema-claro #skilled-sidebar .border-\[\#161f38\],body.tema-claro #skilled-sidebar .border-\[\#232f4e\]{border-color:#dbe3ef!important}body.tema-claro #skilled-sidebar .text-gray-400{color:#526079!important}body.tema-claro #skilled-sidebar .text-gray-500{color:#69758a!important}body.tema-claro #skilled-sidebar .text-white{color:#111827!important}.skilled-profile-chip{cursor:pointer;min-width:0}.skilled-profile-avatar{overflow:hidden}.skilled-profile-avatar img{width:100%;height:100%;object-fit:cover;display:block}.skilled-profile-name{max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.skilled-profile-role{max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}body.tema-claro .skilled-profile-name{color:#111827!important}
            #skilled-sidebar{width:260px;min-width:260px;flex-basis:260px;transition:width .2s ease,min-width .2s ease,flex-basis .2s ease,transform .22s ease;z-index:40}@media(min-width:1024px){body{padding-left:260px!important;transition:padding-left .2s ease}body.skilled-sidebar-collapsed{padding-left:76px!important}#skilled-sidebar{position:fixed!important;left:0;top:0;bottom:0;height:100dvh!important;max-height:100dvh!important;z-index:70!important}#skilled-sidebar .lista-scroll{overflow-y:auto!important;overscroll-behavior:contain}body>div.flex-1>header{position:sticky!important;top:0!important;z-index:60!important}}.skilled-sidebar-brand{padding:18px 16px;min-height:72px}.skilled-sidebar-logo-link{min-width:0;display:flex;align-items:center}.skilled-sidebar-logo{max-width:150px;transition:max-width .18s ease,height .18s ease}.skilled-sidebar-collapse,.skilled-mobile-sidebar-toggle{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #243257;border-radius:10px;color:#8190aa;background:#0c1324;transition:.16s;flex:0 0 auto}.skilled-sidebar-collapse:hover,.skilled-mobile-sidebar-toggle:hover{color:#fff;background:#141d34;border-color:#365386}.skilled-sidebar-collapse svg,.skilled-mobile-sidebar-toggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.skilled-mobile-sidebar-toggle{display:none;margin-right:10px}.skilled-sidebar-shell nav{transition:padding .18s ease}.skilled-sidebar-shell [data-sidebar-link]{min-height:40px;white-space:nowrap}.skilled-sidebar-shell .skilled-sidebar-label,.skilled-sidebar-section-title{transition:opacity .12s ease}.skilled-sidebar-shell svg{flex:0 0 auto}.skilled-sidebar-shell .lista-scroll{overscroll-behavior:contain}.skilled-sidebar-logout{min-height:42px}#skilled-sidebar-overlay{display:none;position:fixed;inset:0;z-index:85;border:0;background:rgba(2,5,14,.68);backdrop-filter:blur(2px)}body.skilled-sidebar-collapsed #skilled-sidebar{width:76px;min-width:76px;flex-basis:76px;overflow-x:hidden}body.skilled-sidebar-collapsed .skilled-sidebar-brand{padding:18px 10px;justify-content:center;flex-direction:column;gap:8px}body.skilled-sidebar-collapsed .skilled-sidebar-logo{height:25px;max-width:52px;object-fit:contain}body.skilled-sidebar-collapsed #skilled-sidebar nav{padding-left:10px!important;padding-right:10px!important}body.skilled-sidebar-collapsed .skilled-sidebar-section-title,body.skilled-sidebar-collapsed .skilled-sidebar-label{display:none}body.skilled-sidebar-collapsed #skilled-sidebar nav>div{margin-top:0!important}body.skilled-sidebar-collapsed #skilled-sidebar nav>div+div{margin-top:12px!important;padding-top:12px;border-top:1px solid #161f38}body.skilled-sidebar-collapsed #skilled-sidebar [data-sidebar-link]{justify-content:center;gap:0;padding-left:0!important;padding-right:0!important;overflow:hidden}body.skilled-sidebar-collapsed #skilled-sidebar [data-sidebar-link]>span:not([data-request-badge]),body.skilled-sidebar-collapsed #skilled-sidebar [data-sidebar-link]>.skilled-sidebar-label{display:none!important}body.skilled-sidebar-collapsed #skilled-sidebar [data-sidebar-link] svg{width:19px;height:19px}body.skilled-sidebar-collapsed .skilled-sidebar-collapse svg{transform:rotate(180deg)}body.skilled-sidebar-collapsed #skilled-sidebar>div:last-child{padding:10px!important}body.skilled-sidebar-collapsed .skilled-sidebar-logout{padding-left:0!important;padding-right:0!important}body.tema-claro .skilled-sidebar-collapse,body.tema-claro .skilled-mobile-sidebar-toggle{background:#f3f6fb;border-color:#d7e0ec;color:#5d687b}body.tema-claro .skilled-sidebar-collapse:hover,body.tema-claro .skilled-mobile-sidebar-toggle:hover{background:#e8edf5;color:#111827}@media(max-width:1023px){body{padding-left:0!important}#skilled-sidebar{display:flex!important;position:fixed!important;left:0;top:0;width:min(300px,88vw)!important;min-width:0!important;flex-basis:auto!important;max-width:300px;z-index:90;transform:translateX(-105%);box-shadow:24px 0 65px rgba(0,0,0,.48)}body.skilled-mobile-sidebar-open #skilled-sidebar{transform:translateX(0)}body.skilled-mobile-sidebar-open #skilled-sidebar-overlay{display:block}.skilled-sidebar-collapse svg{transform:rotate(180deg)}.skilled-mobile-sidebar-toggle{display:inline-flex}body.skilled-sidebar-collapsed #skilled-sidebar{width:min(300px,88vw)!important}body.skilled-sidebar-collapsed .skilled-sidebar-brand{padding:18px 16px;justify-content:space-between;flex-direction:row}body.skilled-sidebar-collapsed .skilled-sidebar-logo{height:36px;max-width:150px}body.skilled-sidebar-collapsed #skilled-sidebar nav{padding:16px!important}body.skilled-sidebar-collapsed .skilled-sidebar-section-title,body.skilled-sidebar-collapsed .skilled-sidebar-label{display:inline}body.skilled-sidebar-collapsed #skilled-sidebar nav>div+div{margin-top:24px!important;padding-top:0;border-top:0}body.skilled-sidebar-collapsed #skilled-sidebar [data-sidebar-link]{justify-content:flex-start;gap:12px;padding-left:12px!important;padding-right:12px!important}body.skilled-sidebar-collapsed #skilled-sidebar>div:last-child{padding:16px!important}body.skilled-sidebar-collapsed .skilled-sidebar-logout{padding-left:12px!important;padding-right:12px!important}header{padding-left:12px!important;padding-right:12px!important}.skilled-global-search-host{min-width:0}}@media(max-width:700px){.skilled-global-results{position:fixed;left:12px;right:12px;top:66px;max-height:65vh}.skilled-search-type{display:none}header .skilled-profile-name,header .skilled-profile-role{max-width:95px}.skilled-mobile-sidebar-toggle{width:34px;height:34px;margin-right:8px}}
        `;
        style.textContent += `
#skilled-mobile-dock,#skilled-mobile-search-backdrop,.skilled-mobile-header-copy{display:none}
@media(max-width:760px){
body{padding-bottom:calc(66px + env(safe-area-inset-bottom))!important}
header.skilled-app-header{min-height:56px!important;height:56px!important;padding:0 10px!important;gap:8px!important;overflow:visible!important}
header.skilled-app-header>.skilled-mobile-sidebar-toggle{display:inline-flex!important;margin:0!important;flex:0 0 38px!important;width:38px!important;height:38px!important}
.skilled-mobile-header-copy{display:flex!important;flex-direction:column;justify-content:center;min-width:0;flex:1 1 auto;margin-left:2px}.skilled-mobile-header-copy strong{color:#eef5ff;font-size:11px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.skilled-mobile-header-copy span{margin-top:2px;color:#64748b;font-size:8px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}body.tema-claro .skilled-mobile-header-copy strong{color:#0f172a}body.tema-claro .skilled-mobile-header-copy span{color:#64748b}
header.skilled-app-header>div:first-of-type{min-width:0!important;flex:1 1 auto!important}
header.skilled-app-header>div:last-child{gap:4px!important;margin-left:auto!important;flex:0 0 auto!important}
header.skilled-app-header .skilled-header-button,header.skilled-app-header .crm-icon-button,header.skilled-app-header .skilled-profile-chip{display:none!important}
header.skilled-app-header .skilled-global-search-host{display:none!important}
#skilled-mobile-dock{position:fixed;left:50%;right:auto;transform:translateX(-50%);width:min(360px,calc(100vw - 18px));bottom:calc(6px + env(safe-area-inset-bottom));height:52px;z-index:184;display:flex;align-items:stretch;gap:2px;padding:3px;border:1px solid rgba(71,101,148,.55);border-radius:16px;background:rgba(7,14,28,.94);backdrop-filter:blur(18px) saturate(1.2);box-shadow:0 14px 42px rgba(0,0,0,.42);transition:transform .2s ease,opacity .2s ease}
#skilled-mobile-dock>*{flex:1 1 0;min-width:0}
.skilled-mobile-dock-button,#skilled-mobile-dock #sky-open,#skilled-mobile-dock #chat-open{position:relative!important;inset:auto!important;width:100%!important;height:44px!important;min-width:0!important;min-height:44px!important;padding:4px 3px!important;border:0!important;border-radius:12px!important;background:transparent!important;box-shadow:none!important;color:#8fa3c0!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:5px!important;font-size:8.5px!important;font-weight:850!important;letter-spacing:.01em!important;text-transform:none!important}
.skilled-mobile-dock-button:hover,#skilled-mobile-dock #sky-open:hover,#skilled-mobile-dock #chat-open:hover{background:rgba(37,99,235,.12)!important;color:#fff!important}
#skilled-mobile-dock #sky-open{color:#93c5fd!important;background:linear-gradient(145deg,rgba(37,99,235,.18),rgba(30,64,175,.08))!important}
#skilled-mobile-dock #sky-open span[data-sky-label],#skilled-mobile-dock #chat-open span{display:block!important;line-height:1!important}
#skilled-mobile-dock #sky-open .sky-shortcut-badge,#skilled-mobile-dock #sky-open .sky-pulse,#skilled-mobile-dock #chat-open .chat-badge:not(.show){display:none!important}
#skilled-mobile-dock svg,.skilled-mobile-dock-button svg{width:17px!important;height:17px!important;flex:none!important}body.skilled-mobile-sidebar-open #skilled-mobile-dock,body.skilled-scanner-active #skilled-mobile-dock{opacity:0!important;pointer-events:none!important;transform:translate(-50%,120%)!important}
#skilled-mobile-search-backdrop{display:none;position:fixed;inset:0;z-index:205;background:rgba(2,6,18,.62);backdrop-filter:blur(4px)}
body.skilled-mobile-search-open #skilled-mobile-search-backdrop{display:block}
body.skilled-mobile-search-open header.skilled-app-header .skilled-global-search-host{display:block!important;position:fixed!important;z-index:220!important;left:10px!important;right:10px!important;top:calc(10px + env(safe-area-inset-top));max-width:none!important;width:auto!important;padding:6px!important;border:1px solid #31558a!important;border-radius:16px!important;background:#081224!important;box-shadow:0 20px 70px rgba(0,0,0,.55)!important}
body.skilled-mobile-search-open .skilled-global-search-input{height:48px!important;min-height:48px!important;padding-left:42px!important;padding-right:12px!important;font-size:16px!important;border-radius:11px!important;background:#050b17!important}
body.skilled-mobile-search-open .skilled-global-search-icon{left:18px!important}
body.skilled-mobile-search-open .skilled-global-results{position:fixed!important;left:10px!important;right:10px!important;top:76px!important;max-height:calc(100dvh - 170px)!important;border-radius:15px!important;z-index:221!important}
body.tema-claro #skilled-mobile-dock{background:rgba(255,255,255,.96);border-color:#cbd8e8;box-shadow:0 14px 40px rgba(15,23,42,.16)}
body.tema-claro .skilled-mobile-dock-button,body.tema-claro #skilled-mobile-dock #chat-open{color:#52627a!important}
body.tema-claro #skilled-mobile-dock #sky-open{color:#2563eb!important;background:#eef4ff!important}
body.tema-claro.skilled-mobile-search-open header.skilled-app-header .skilled-global-search-host{background:#fff!important;border-color:#b8c9df!important}
body.tema-claro.skilled-mobile-search-open .skilled-global-search-input{background:#f7f9fc!important;color:#111827!important}
}
@media(max-width:430px){#skilled-mobile-dock{width:calc(100vw - 14px);bottom:calc(4px + env(safe-area-inset-bottom));border-radius:14px}main{padding-bottom:18px!important}}
`;
        document.head.appendChild(style);
    }

    function lightThemeEnabled() {
        if (window.SkilledTheme?.isLight) return window.SkilledTheme.isLight();
        return document.body.classList.contains('tema-claro') || localStorage.getItem(themeStorageKey()) === 'claro';
    }

    function updateThemeButtons() {
        const light = lightThemeEnabled();
        document.querySelectorAll('[data-skilled-theme],button[onclick*="alternarTema"],button[title*="tema" i]').forEach(button => {
            button.dataset.skilledTheme = '1';
            button.type = 'button';
            if (!button.getAttribute('onclick') && button.dataset.skilledThemeBound !== '1') {
                button.addEventListener('click', window.alternarTema);
                button.dataset.skilledThemeBound = '1';
            }
            button.classList.add('skilled-header-button');
            button.innerHTML = light ? headerIcons.moon : headerIcons.sun;
            button.title = light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
            button.setAttribute('aria-label', button.title);
        });
    }

    function setTheme(light) {
        if (window.SkilledTheme?.toggleLight) {
            window.SkilledTheme.toggleLight(Boolean(light)).finally?.(() => requestAnimationFrame(updateThemeButtons));
            return;
        }
        const theme = light ? 'claro' : 'oscuro';
        const background = light ? '#f2f4f9' : '#060814';
        document.documentElement.dataset.crmTheme = theme;
        document.documentElement.classList.toggle('tema-claro', light);
        document.documentElement.style.backgroundColor = background;
        document.documentElement.style.colorScheme = light ? 'light' : 'dark';
        document.body.classList.toggle('tema-claro', light);
        document.body.style.backgroundColor = background;
        localStorage.setItem(themeStorageKey(), theme);
        requestAnimationFrame(() => {
            updateThemeButtons();
            window.dispatchEvent(new CustomEvent('skilled:themechange', { detail: { theme } }));
        });
    }

    window.alternarTema = function () {
        if (window.SkilledTheme?.toggleLight) return window.SkilledTheme.toggleLight();
        setTheme(!lightThemeEnabled());
    };

    function headerActionContainer(header) {
        const children = [...header.children];
        const candidate = children.reverse().find(node => node.matches?.('div') && node.querySelector('button, [class*="border-l"]'));
        return candidate || header.lastElementChild || header;
    }

    function normalizeHeaderButtons() {
        const header = document.querySelector('body > div header, header');
        if (!header) return;
        const container = headerActionContainer(header);
        let refresh = header.querySelector('[data-skilled-refresh],#refresh,#btnActualizar,#btnActualizarTop,button[title*="Actualizar" i],button[onclick*="reload"]');
        if (!refresh) {
            refresh = document.createElement('button');
            refresh.type = 'button';
            refresh.dataset.skilledRefresh = '1';
            refresh.className = 'skilled-header-button';
            refresh.addEventListener('click', () => location.reload());
            const profile = [...container.children].find(node => node.matches?.('[class*="border-l"]'));
            if (profile) container.insertBefore(refresh, profile);
            else container.prepend(refresh);
        }
        refresh.dataset.skilledRefresh = '1';
        refresh.title = 'Actualizar información';
        refresh.setAttribute('aria-label', refresh.title);
        refresh.innerHTML = headerIcons.refresh;
        refresh.classList.add('skilled-header-button');

        let theme = header.querySelector('[data-skilled-theme],button[onclick*="alternarTema"],button[title*="tema" i]');
        if (!theme) {
            theme = document.createElement('button');
            theme.type = 'button';
            theme.dataset.skilledTheme = '1';
            theme.className = 'skilled-header-button';
            const profile = [...container.children].find(node => node.matches?.('[class*="border-l"]'));
            if (profile) container.insertBefore(theme, profile);
            else container.appendChild(theme);
        }
        updateThemeButtons();
    }

    const profileRoleLabels = {
        administrador: 'Administrador',
        jefe_almacen: 'Jefe de almacén',
        almacen: 'Almacén',
        compras: 'Compras',
        proyectos: 'Proyectos',
        consulta: 'Consulta',
        rh: 'Recursos Humanos',
        finanzas: 'Finanzas',
        gerente_general: 'Gerencia General',
        subgerente: 'Subgerencia',
        sky_demo: 'Sky · Presentación',
        tsi: 'TSI'
    };

    function profileInitials(value) {
        const words = cleanText(value).split(' ').filter(Boolean);
        return (words.slice(0, 2).map(word => word[0]).join('') || 'U').toUpperCase();
    }

    function cachedProfile() {
        try {
            const raw = localStorage.getItem('skilled_profile_cache');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function storeProfile(profile) {
        if (!profile) return;
        try { localStorage.setItem('skilled_profile_cache', JSON.stringify(profile)); } catch (_) {}
    }

    function profileHost(header) {
        const candidates = [...header.querySelectorAll('div')];
        return candidates.find(node => node.className.includes('border-l') && node.querySelector('.text-right')) || null;
    }

    function applyProfileIdentity(profile) {
        if (!profile) return;
        const header = document.querySelector('body > div header, header');
        if (!header) return;
        let host = profileHost(header);
        if (!host) {
            const actions = headerActionContainer(header);
            host = document.createElement('div');
            host.className = 'skilled-profile-chip border-l border-[#161f38] pl-4 flex items-center gap-3';
            host.innerHTML = '<div class="hidden sm:block text-right"><div class="skilled-profile-name text-xs font-bold text-white">Usuario</div><div class="skilled-profile-role text-[10px] text-gray-500">Perfil</div></div><div class="skilled-profile-avatar w-8 h-8 rounded-full bg-[#1b253c] border border-blue-500/30 flex items-center justify-center text-xs font-bold">U</div>';
            actions.appendChild(host);
        }
        host.classList.add('skilled-profile-chip');
        host.title = 'Abrir mi perfil';
        if (host.dataset.skilledProfileBound !== '1') {
            host.dataset.skilledProfileBound = '1';
            host.addEventListener('click', () => { location.href = 'perfil.html'; });
        }
        const copy = host.querySelector('.text-right') || host.firstElementChild;
        const nameNode = copy?.children?.[0];
        const roleNode = copy?.children?.[1];
        if (nameNode) {
            nameNode.classList.add('skilled-profile-name');
            nameNode.textContent = cleanText(profile.nombre) || cleanText(profile.email).split('@')[0] || 'Usuario';
        }
        if (roleNode) {
            roleNode.classList.add('skilled-profile-role');
            const role = searchText(profile.rol) || 'consulta';
            roleNode.textContent = cleanText(profile.puesto) || profileRoleLabels[role] || role;
        }
        const avatar = [...host.children].find(node => node.className.includes('rounded-full')) || host.lastElementChild;
        if (avatar) {
            avatar.classList.add('skilled-profile-avatar');
            const photo = cleanText(profile.fotoUrl ?? profile.foto_url);
            if (photo) avatar.innerHTML = `<img src="${safeHtml(photo)}" alt="${safeHtml(profile.nombre || 'Usuario')}" onerror="this.parentElement.textContent='${safeHtml(profileInitials(profile.nombre || profile.email))}'">`;
            else avatar.textContent = profileInitials(profile.nombre || profile.email);
        }
        document.documentElement.dataset.profileName = cleanText(profile.nombre);
    }

    async function syncProfileIdentity(force = false) {
        const cache = cachedProfile();
        if (cache) applyProfileIdentity(cache);
        try {
            if (!window.SkilledDB?.getMyProfile) return;
            if (!force && window.SkilledSession?.profile) {
                const sessionProfile = {
                    ...window.SkilledSession.profile,
                    email: window.SkilledSession.user?.email,
                    fotoUrl: window.SkilledSession.profile?.foto_url
                };
                applyProfileIdentity(sessionProfile);
            }
            const profile = await window.SkilledDB.getMyProfile();
            storeProfile(profile);
            applyProfileIdentity(profile);
            window.dispatchEvent(new CustomEvent('skilled:profileloaded', { detail: profile }));
        } catch (error) {
            console.debug('No se pudo sincronizar el perfil visible:', error);
        }
    }

    async function resolveCurrentRole() {
        if (resolvedRole) return resolvedRole;
        if (window.SkilledSession?.role) {
            resolvedRole = searchText(window.SkilledSession.role) || 'consulta';
            return resolvedRole;
        }
        try {
            const client = window.SkilledDB?.client;
            if (!client) return 'consulta';
            const { data: { session } } = await client.auth.getSession();
            if (!session) return 'consulta';
            const { data } = await client.from('perfiles_usuario').select('rol').eq('id', session.user.id).maybeSingle();
            resolvedRole = searchText(data?.rol) || 'consulta';
        } catch (_) {
            resolvedRole = 'consulta';
        }
        return resolvedRole;
    }

    function canOpen(role, page) {
        const access = roleAccess[role] || roleAccess.consulta;
        return access.includes('*') || access.includes(String(page).toLowerCase());
    }

    function pageSearchEntries(role) {
        const sections = sectionsForRole();
        const extras = [
            ['AL.escaner.html', 'Escáner universal', 'Consultar tickets, materiales, ubicaciones, proyectos y categorías'],
            ['AL.importar-materiales.html', 'Importación masiva de materiales', 'Cargar o actualizar el catálogo desde Excel']
        ];
        const entries = [];
        sections.forEach(section => section.items.forEach(([href, label]) => {
            if (!canOpen(role, href)) return;
            entries.push({ type: 'Apartado', symbol: '↗', title: label, subtitle: section.title, url: href, terms: searchText(`${label} ${section.title} ${href}`) });
        }));
        extras.forEach(([href, label, subtitle]) => {
            if (canOpen(role, href)) entries.push({ type: 'Apartado', symbol: '↗', title: label, subtitle, url: href, terms: searchText(`${label} ${subtitle} ${href}`) });
        });
        return entries;
    }

    function addEntry(entries, entry) {
        const title = cleanText(entry.title);
        if (!title || !entry.url) return;
        entries.push({
            type: cleanText(entry.type) || 'Resultado',
            symbol: cleanText(entry.symbol) || '•',
            title,
            subtitle: cleanText(entry.subtitle),
            url: entry.url,
            terms: searchText([title, entry.subtitle, entry.terms].filter(Boolean).join(' '))
        });
    }

    async function createSearchIndex() {
        const role = await resolveCurrentRole();
        const entries = pageSearchEntries(role);
        const tasks = [];
        const taskNames = [];
        const addTask = (name, page, fn) => {
            if (!canOpen(role, page) || typeof fn !== 'function') return;
            taskNames.push(name);
            tasks.push(Promise.resolve().then(fn));
        };
        const db = window.SkilledDB || {};
        addTask('materials', 'AL.catalogo.html', () => db.listMaterials());
        addTask('purchases', 'AL.ordenes-compra.html', () => db.listPurchaseRequests());
        addTask('projects', 'AL.proyectos.html', () => db.listProjects());
        addTask('tools', 'AL.herramientas.html', () => db.listTools({ includeInactive: true }));
        addTask('units', 'AL.unidades-herramientas.html', () => db.listToolUnits({ includeInactive: true }));
        addTask('assignments', 'AL.asignaciones-herramientas.html', () => db.listToolAssignments());
        addTask('toolHistory', 'AL.historial-herramientas.html', () => typeof db.listToolHistory === 'function' ? db.listToolHistory() : []);
        const vehicleSearchPage = role === 'gerente_general' ? 'GG.vehiculos.html' : role === 'subgerente' ? 'SG.vehiculos.html' : 'AL.vehiculos.html';
        addTask('vehicles', vehicleSearchPage, () => ['gerente_general','subgerente'].includes(role) && typeof db.listExecutiveVehicles === 'function' ? db.listExecutiveVehicles() : db.listVehicles({ includeInactive: true }));
        addTask('warehouses', 'AL.almacenes.html', () => db.listWarehouses());
        addTask('locations', 'AL.almacenes.html', () => db.listWarehouseLocations());
        addTask('movements', 'AL.historial-movimientos.html', () => db.listMovementGroups());
        addTask('rhPeople', 'RH.personal.html', () => db.client.from('rh_personal').select('*').then(result => { if (result.error) throw result.error; return result.data || []; }));
        addTask('rhAssets', 'RH.equipos.html', () => typeof db.listRHOfficeAssets === 'function' ? db.listRHOfficeAssets({ includeInactive: true }) : []);
        addTask('rhAssetAssignments', 'RH.equipos.html', () => typeof db.listRHOfficeAssignments === 'function' ? db.listRHOfficeAssignments({ includeClosed: true }) : []);
        addTask('rhProjects', 'RH.proyectos.html', () => db.client.from('proyectos').select('*').then(result => { if (result.error) throw result.error; return result.data || []; }));
        addTask('coSuppliers', 'CO.proveedores.html', () => db.client.from('co_proveedores').select('*').then(result => { if (result.error) throw result.error; return result.data || []; }));
        addTask('coProviderMaterials', 'CO.proveedores.html', () => typeof db.listProviderMaterials === 'function' ? db.listProviderMaterials({ activeOnly: true }) : []);
        addTask('coQuotations', 'CO.cotizaciones.html', () => typeof db.listQuotationRequests === 'function' ? db.listQuotationRequests({}) : []);
        addTask('coDeliveries', 'CO.entregas.html', () => typeof db.listDeliveryInfos === 'function' ? db.listDeliveryInfos() : []);
        addTask('coStore', 'CO.tienda.html', () => typeof db.listStoreRequests === 'function' ? db.listStoreRequests() : []);
        addTask('coServices', 'CO.servicios.html', () => typeof db.listServices === 'function' ? db.listServices() : []);
        addTask('coSupplierRequests', 'CO.hacer-compra.html', () => typeof db.listSupplierRequests === 'function' ? db.listSupplierRequests() : []);
        const results = await Promise.allSettled(tasks);
        results.forEach((result, index) => {
            if (result.status !== 'fulfilled' || !Array.isArray(result.value)) return;
            const name = taskNames[index];
            const rows = result.value;
            if (name === 'materials') rows.forEach(item => addEntry(entries, {
                type: 'Material', symbol: 'M', title: item.descripcion || item.desc || item.codigo,
                subtitle: `${item.codigo || 'Sin código'} · ${item.categoria || 'Sin categoría'}${item.stock != null ? ` · Stock ${Number(item.stock) || 0}` : ''}`,
                url: `AL.catalogo.html?q=${encodeURIComponent(item.codigo || item.descripcion || '')}`,
                terms: [item.codigo,item.descripcion,item.desc,item.categoria,item.marca,item.proveedor,item.contactoProveedor,item.contacto_proveedor,item.unidad,item.tipoCable,item.tamano,item.ubicacion,item.esIncompleto?'informacion incompleta':'',...(item.modismos||[])].join(' ')
            }));
            if (name === 'purchases') {
                const groups = new Map();
                rows.forEach(item => {
                    const key = cleanText(item.ordenCompra || item.folio || item.id);
                    if (!key) return;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(item);
                });
                groups.forEach((items, key) => {
                    const first = items[0] || {};
                    addEntry(entries, {
                        type: first.ordenCompra ? 'Orden de compra' : 'Solicitud de compra', symbol: 'OC',
                        title: first.ordenCompra ? `Orden ${first.ordenCompra}` : `Solicitud ${first.folio || key}`,
                        subtitle: `${items.length} material${items.length === 1 ? '' : 'es'} · ${first.proveedor || 'Proveedor no asignado'} · ${first.estado || 'pendiente'}`,
                        url: `AL.ordenes-compra.html?q=${encodeURIComponent(first.ordenCompra || first.folio || key)}`,
                        terms: items.flatMap(item => [item.folio,item.ordenCompra,item.materialCodigo,item.descripcion,item.proveedor,item.contactoProveedor,item.referencia,item.estado]).join(' ')
                    });
                });
            }
            if (name === 'projects') rows.forEach(item => addEntry(entries, {
                type: 'Proyecto', symbol: 'P', title: `${item.proyecto || item.numeroProyecto || ''} · ${item.nombreProyecto || 'Proyecto'}`,
                subtitle: `${item.cliente || 'Sin cliente'} · ${item.responsableSkilled || 'Sin responsable'}`,
                url: `AL.proyectos.html?q=${encodeURIComponent(item.proyecto || item.numeroProyecto || item.nombreProyecto || '')}`,
                terms: [item.proyecto,item.numeroProyecto,item.nombreProyecto,item.cliente,item.ordenCompra,item.responsableSkilled,item.planta,item.nave,item.estatus].join(' ')
            }));
            if (name === 'tools') rows.forEach(item => addEntry(entries, {
                type: 'Herramienta', symbol: 'H', title: item.descripcion || item.sku,
                subtitle: `${item.sku || 'Sin SKU'} · ${item.marca || 'Sin marca'} ${item.modelo || ''}`,
                url: `AL.herramientas.html?q=${encodeURIComponent(item.sku || item.descripcion || '')}`,
                terms: [item.sku,item.descripcion,item.clasificacion,item.marca,item.modelo,item.uso,item.unidad].join(' ')
            }));
            if (name === 'units') rows.forEach(item => addEntry(entries, {
                type: 'Unidad de herramienta', symbol: 'U', title: item.herramienta?.descripcion || item.codigoInterno || 'Unidad',
                subtitle: `${item.codigoInterno || 'Sin código'} · Serie ${item.numeroSerie || 'sin serie'} · ${item.estado || 'disponible'}`,
                url: `AL.unidades-herramientas.html?q=${encodeURIComponent(item.codigoInterno || item.numeroSerie || item.herramienta?.sku || '')}`,
                terms: [item.codigoInterno,item.numeroSerie,item.almacenNombre,item.ubicacionNombre,item.ubicacionCodigo,item.estado,item.asignadoA,item.proyecto,item.herramienta?.sku,item.herramienta?.descripcion,item.herramienta?.marca].join(' ')
            }));
            if (name === 'assignments') rows.forEach(item => addEntry(entries, {
                type: 'Asignación de herramienta', symbol: 'AS', title: item.unidad?.herramienta?.descripcion || item.unidad?.codigoInterno || 'Asignación',
                subtitle: `${item.unidad?.codigoInterno || 'Sin código'} · ${item.proyecto ? `Proyecto ${item.proyecto}` : item.personaNombre || 'Sin destino'} · ${item.estado || 'activa'}`,
                url: `AL.asignaciones-herramientas.html?q=${encodeURIComponent(item.unidad?.codigoInterno || item.proyecto || item.personaNombre || '')}`,
                terms: [item.unidad?.codigoInterno,item.unidad?.numeroSerie,item.unidad?.herramienta?.sku,item.unidad?.herramienta?.descripcion,item.proyecto,item.personaNombre,item.personaContacto,item.responsableEntrega,item.estado].join(' ')
            }));
            if (name === 'toolHistory') rows.slice(0, 2000).forEach(item => addEntry(entries, {
                type: 'Historial de herramienta', symbol: 'HH', title: item.unidad?.herramienta?.descripcion || item.unidad?.codigoInterno || item.tipoEvento || 'Evento de herramienta',
                subtitle: `${item.unidad?.codigoInterno || 'Sin código'} · ${item.tipoEvento || 'evento'} · ${item.estadoNuevo || item.estadoAnterior || 'sin estado'}`,
                url: `AL.historial-herramientas.html?q=${encodeURIComponent(item.unidad?.codigoInterno || item.unidad?.numeroSerie || item.unidad?.herramienta?.sku || item.tipoEvento || '')}`,
                terms: [item.tipoEvento,item.estadoAnterior,item.estadoNuevo,item.proyecto,item.personaNombre,item.responsable,item.detalle,item.unidad?.codigoInterno,item.unidad?.numeroSerie,item.unidad?.herramienta?.sku,item.unidad?.herramienta?.descripcion,item.unidad?.herramienta?.marca].join(' ')
            }));
            if (name === 'rhPeople') rows.forEach(item => addEntry(entries, {
                type: 'Colaborador', symbol: 'RH', title: `${item.nombre || ''} ${item.apellidos || ''}`.trim() || item.numero_empleado,
                subtitle: `${item.numero_empleado || 'Sin número'} · ${item.puesto || 'Sin puesto'} · ${item.departamento || 'Sin departamento'}`,
                url: `RH.personal.html?q=${encodeURIComponent(item.numero_empleado || item.nombre || '')}`,
                terms: [item.numero_empleado,item.nombre,item.apellidos,item.curp,item.rfc,item.nss,item.correo,item.correo_corporativo,item.puesto,item.departamento,item.jefe_directo].join(' ')
            }));
            if (name === 'rhAssets') rows.forEach(item => addEntry(entries, {
                type: 'Equipo / activo RH', symbol: 'EQ', title: item.nombre || item.codigo || 'Activo',
                subtitle: `${item.codigo || 'Sin código'} · ${item.categoria || 'Sin categoría'} · ${Number(item.disponible || 0)} ${item.unidad || 'PIEZA'} disponible(s)`,
                url: `RH.equipos.html?q=${encodeURIComponent(item.codigo || item.numeroSerie || item.nombre || '')}`,
                terms: [item.codigo,item.nombre,item.categoria,item.marca,item.modelo,item.numeroSerie,item.ubicacion,item.estado,item.unidad].join(' ')
            }));
            if (name === 'rhAssetAssignments') rows.forEach(item => addEntry(entries, {
                type: 'Resguardo RH', symbol: 'RG', title: `${item.personalNombre || 'Colaborador'} · ${item.activoNombre || item.activoCodigo || 'Activo'}`,
                subtitle: `${item.activoCodigo || 'Sin código'} · ${Number(item.cantidad || 0)} ${item.unidad || 'PIEZA'} · ${item.estado || 'asignado'}`,
                url: `RH.equipos.html?persona=${encodeURIComponent(item.personalId || '')}&q=${encodeURIComponent(item.activoCodigo || item.personalNombre || '')}`,
                terms: [item.personalNumero,item.personalNombre,item.puesto,item.departamento,item.activoCodigo,item.activoNombre,item.categoria,item.marca,item.modelo,item.numeroSerie,item.estado,item.condicionEntrega,item.responsableEntrega].join(' ')
            }));
            if (name === 'rhProjects') rows.forEach(item => addEntry(entries, {
                type: 'Proyecto RH', symbol: 'PR', title: `${item.numero_proyecto || ''} · ${item.nombre_proyecto || 'Proyecto'}`,
                subtitle: `${item.cliente || 'Sin cliente'} · ${item.responsable_skilled || 'Sin responsable'}`,
                url: `RH.proyectos.html?q=${encodeURIComponent(item.numero_proyecto || item.nombre_proyecto || '')}`,
                terms: [item.numero_proyecto,item.nombre_proyecto,item.cliente,item.orden_compra,item.responsable_skilled,item.planta,item.nave,item.estado].join(' ')
            }));
            if (name === 'coQuotations') rows.forEach(item => addEntry(entries, {
                type: 'Cotización', symbol: 'COT', title: `${item.folio || 'Cotización'} · ${item.estado || 'solicitada'}`,
                subtitle: `${(item.items||[]).length} material${(item.items||[]).length===1?'':'es'} · ${item.solicitadoPor || 'Almacén'} · ${item.prioridad || 'normal'}`,
                url: `CO.cotizaciones.html?id=${encodeURIComponent(item.id || '')}`,
                terms: [item.folio,item.estado,item.prioridad,item.solicitadoPor,item.referencia,item.notas,...(item.items||[]).flatMap(x=>[x.materialCodigo,x.descripcion,x.marca,x.almacenNombre])].join(' ')
            }));
            if (name === 'coSuppliers') rows.forEach(item => addEntry(entries, {
                type: 'Proveedor', symbol: 'PV', title: item.nombre_comercial || item.razon_social,
                subtitle: `${item.contacto || 'Sin contacto'} · ${item.email || 'Sin correo'} · ${item.categoria || 'Sin categoría'}`,
                url: `CO.proveedores.html?q=${encodeURIComponent(item.nombre_comercial || item.razon_social || '')}`,
                terms: [item.clave,item.razon_social,item.nombre_comercial,item.rfc,item.contacto,item.email,item.telefono,item.whatsapp,item.categoria,item.direccion].join(' ')
            }));
            if (name === 'coProviderMaterials') rows.slice(0, 1800).forEach(item => addEntry(entries, {
                type: 'Proveedor · material', symbol: 'PM', title: `${item.materialCodigo || 'Material'} · ${item.proveedorNombre || 'Proveedor'}`,
                subtitle: `${item.descripcion || 'Sin descripción'} · ${Number(item.precioUnitario || 0).toLocaleString('es-MX',{style:'currency',currency:item.moneda || 'MXN'})} · ${Number(item.plazoEntregaDias || 0)} días`,
                url: `CO.proveedores.html?q=${encodeURIComponent(item.materialCodigo || item.descripcion || item.proveedorNombre || '')}`,
                terms: [item.materialCodigo,item.descripcion,item.marca,item.categoria,item.proveedorNombre,item.proveedorContacto,item.proveedorEmail,item.proveedorTelefono,item.proveedorWhatsapp,item.proveedorRfc,item.moneda,item.plazoEntregaDias].join(' ')
            }));
            if (name === 'coDeliveries') rows.forEach(item => addEntry(entries, {
                type: 'Entrega', symbol: 'EN', title: item.nombre,
                subtitle: `${item.direccion || 'Sin dirección'} · ${item.responsablePrincipal || 'Sin responsable'}`,
                url: `CO.entregas.html?q=${encodeURIComponent(item.nombre || item.direccion || '')}`,
                terms: [item.nombre,item.empresa,item.direccion,item.referencias,item.horarioRecepcion,item.responsablePrincipal,item.telefono,item.email,...(item.receptoresAutorizados||[])].join(' ')
            }));
            if (name === 'coStore') rows.forEach(item => addEntry(entries, {
                type: 'Tienda', symbol: 'TI', title: item.producto,
                subtitle: `${item.negocio || 'Sin negocio'} · ${item.estado || 'no revisada'} · ${item.cantidad || 0} ${item.unidad || ''}`,
                url: `CO.tienda.html?q=${encodeURIComponent(item.folio || item.producto || '')}`,
                terms: [item.folio,item.negocio,item.producto,item.marcaEspecifica,item.presentacion,item.estado,item.solicitadoPor,item.responsableCompra].join(' ')
            }));
            if (name === 'coServices') rows.forEach(item => addEntry(entries, {
                type: 'Servicio', symbol: 'SV', title: item.nombre,
                subtitle: `${item.proveedor || item.tipo || 'Servicio'} · vence ${item.proximaFechaPago || 'sin fecha'}`,
                url: `CO.servicios.html?q=${encodeURIComponent(item.codigo || item.nombre || '')}`,
                terms: [item.codigo,item.nombre,item.tipo,item.proveedor,item.cuentaContrato,item.ubicacion,item.referenciaPago,item.responsable].join(' ')
            }));
            if (name === 'coSupplierRequests') rows.forEach(item => addEntry(entries, {
                type: 'Solicitud a proveedor', symbol: 'SP', title: `${item.numero} · ${item.proveedorNombre}`,
                subtitle: `Orden ${item.ordenCompra} · ${item.estado || 'borrador'} · ${(item.items||[]).length} materiales`,
                url: `CO.hacer-compra.html?q=${encodeURIComponent(item.numero || item.ordenCompra || '')}`,
                terms: [item.numero,item.ordenCompra,item.proveedorNombre,item.proveedorContacto,item.proveedorEmail,item.proveedorTelefono,item.proveedorWhatsapp,item.estado,...(item.items||[]).flatMap(x=>[x.materialCodigo,x.descripcion,x.marca])].join(' ')
            }));
            if (name === 'vehicles') rows.forEach(item => addEntry(entries, {
                type: 'Vehículo', symbol: 'V', title: `${item.numeroEconomico || 'Vehículo'} · ${item.marca || ''} ${item.modelo || ''}`,
                subtitle: `${item.placas || 'Sin placas'} · ${item.estado || 'disponible'} · ${item.proyecto ? `Proyecto ${item.proyecto}` : item.asignadoA || 'Sin asignar'}`,
                url: `${sidebarProfileKey()==='gerente_general'?'GG.vehiculos.html':sidebarProfileKey()==='subgerente'?'SG.vehiculos.html':'AL.vehiculos.html'}?q=${encodeURIComponent(item.numeroEconomico || item.placas || item.vin || '')}`,
                terms: [item.numeroEconomico,item.placas,item.vin,item.marca,item.modelo,item.anio,item.tipo,item.estado,item.almacenBaseNombre,item.proyecto,item.asignadoA,item.responsable,item.aseguradora,item.polizaSeguro].join(' ')
            }));
            if (name === 'warehouses') rows.forEach(item => addEntry(entries, {
                type: 'Almacén', symbol: 'A', title: item.nombre,
                subtitle: `${item.tipo || 'Almacén'} · ${item.ubicacion || 'Sin ubicación'} · ${item.estado || 'Activo'}`,
                url: `AL.almacenes.html?q=${encodeURIComponent(item.nombre || '')}`,
                terms: [item.nombre,item.tipo,item.ubicacion,item.encargado,item.estado,item.notas].join(' ')
            }));
            if (name === 'locations') rows.forEach(item => addEntry(entries, {
                type: 'Ubicación', symbol: 'UB', title: item.etiqueta || item.nombre,
                subtitle: `${item.almacenNombre || 'Sin almacén'} · ${item.tipo || 'Ubicación'}`,
                url: `AL.almacenes.html?q=${encodeURIComponent(item.codigo || item.nombre || '')}`,
                terms: [item.nombre,item.codigo,item.tipo,item.nota,item.almacenNombre,item.etiqueta].join(' ')
            }));
            if (name === 'movements') rows.slice(0, 2000).forEach(item => {
                const reference = item.referencia || item.folioEntrega || item.requestId;
                addEntry(entries, {
                    type: 'Movimiento', symbol: 'MV', title: `${item.tipo || 'Movimiento'} · ${reference || 'Sin referencia'}`,
                    subtitle: `${item.proyecto ? `Proyecto ${item.proyecto}` : 'Sin proyecto'} · ${(item.productos || []).length} material${(item.productos || []).length === 1 ? '' : 'es'}`,
                    url: `AL.historial-movimientos.html?q=${encodeURIComponent(reference || item.requestId || '')}`,
                    terms: [item.requestId,item.referencia,item.folioEntrega,item.tipo,item.proyecto,item.bodegaOrigen,item.bodegaDestino,item.recibeNombre,...(item.productos || []).flatMap(product => [product.codigo,product.descripcion,product.producto?.desc])].join(' ')
                });
            });
        });
        searchIndexCreatedAt = Date.now();
        writeSearchCache(role, entries);
        return entries;
    }

    function getSearchIndex() {
        const role = currentRole();
        if (!searchIndexPromise) {
            const cached = readSearchCache(role);
            if (cached) { searchIndexCreatedAt = Date.now(); searchIndexPromise = Promise.resolve(cached); }
        }
        if (!searchIndexPromise || Date.now() - searchIndexCreatedAt > SEARCH_CACHE_TTL) searchIndexPromise = createSearchIndex();
        return searchIndexPromise;
    }

    function scoreEntry(entry, query) {
        const normalized = searchText(query);
        if (!normalized) return entry.type === 'Apartado' ? 20 : 0;
        if (window.SkilledSearch?.score) {
            const base = window.SkilledSearch.score([entry.title, entry.subtitle, entry.terms], query);
            if (base < 0) return -1;
            const titleScore = window.SkilledSearch.score(entry.title, query);
            return base + Math.max(0, titleScore) * 0.35 + (entry.type === 'Apartado' ? 8 : 0);
        }
        const tokens = normalized.split(' ').filter(Boolean);
        if (!tokens.every(token => entry.terms.includes(token))) return -1;
        const title = searchText(entry.title);
        let score = 10;
        if (title === normalized) score += 100;
        else if (title.startsWith(normalized)) score += 75;
        else if (title.includes(normalized)) score += 55;
        if (searchText(entry.subtitle).includes(normalized)) score += 20;
        if (entry.type === 'Apartado') score += 8;
        return score;
    }

    function searchResultsNode(input) {
        const host = input.parentElement;
        host.classList.add('skilled-global-search-host');
        let node = host.querySelector('#skilled-global-results');
        if (!node) {
            node = document.createElement('div');
            node.id = 'skilled-global-results';
            node.className = 'skilled-global-results';
            node.hidden = true;
            host.appendChild(node);
        }
        return node;
    }

    function setActiveResult(container, index) {
        const items = [...container.querySelectorAll('.skilled-search-item')];
        if (!items.length) {
            activeSearchResult = -1;
            return;
        }
        activeSearchResult = Math.max(0, Math.min(index, items.length - 1));
        items.forEach((item, itemIndex) => item.classList.toggle('is-active', itemIndex === activeSearchResult));
        items[activeSearchResult]?.scrollIntoView({ block: 'nearest' });
    }

    function rankedSearch(entries, query, limit = 12) {
        return entries.map(entry => ({ entry, score: scoreEntry(entry, query) })).filter(item => item.score >= 0).sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'es')).slice(0, limit).map(item => item.entry);
    }
    function renderSearchEntries(container, results, query, loading = false) {
        if (!results.length) {
            container.innerHTML = loading ? '<div class="skilled-search-status">Buscando datos del CRM…</div>' : `<div class="skilled-search-status">No se encontraron resultados para “${safeHtml(query)}”.</div>`;
            activeSearchResult = -1;
            return;
        }
        container.innerHTML = results.map(entry => `<a class="skilled-search-item" href="${safeHtml(entry.url)}"><span class="skilled-search-symbol">${safeHtml(entry.symbol)}</span><span class="skilled-search-copy"><span class="skilled-search-title">${safeHtml(entry.title)}</span><span class="skilled-search-subtitle">${safeHtml(entry.subtitle)}</span></span><span class="skilled-search-type">${safeHtml(entry.type)}</span></a>`).join('') + (loading ? '<div class="skilled-search-status">Completando resultados…</div>' : '');
        setActiveResult(container, 0);
    }
    async function performGlobalSearch(input, query, openFirst = false) {
        const container = searchResultsNode(input);
        container.hidden = false;
        const quick = rankedSearch(pageSearchEntries(currentRole()), query, 8);
        renderSearchEntries(container, quick, query, true);
        const requested = cleanText(query);
        try {
            const index = await getSearchIndex();
            if (cleanText(input.value) !== requested && !openFirst) return;
            const results = rankedSearch(index, query, 12);
            renderSearchEntries(container, results, query, false);
            if (openFirst && results[0]) location.href = results[0].url;
        } catch (error) {
            if (!quick.length) container.innerHTML = `<div class="skilled-search-status">No fue posible consultar el CRM: ${safeHtml(error.message)}</div>`;
        }
    }

    function globalHeaderInput() {
        const header = document.querySelector('body > div header, header');
        if (!header) return null;
        return header.querySelector('input[type="search"],input[placeholder*="Buscar" i],input[id*="search" i],input[id*="buscar" i]');
    }

    function normalizeGlobalSearch() {
        const input = globalHeaderInput();
        if (!input || input.dataset.skilledGlobalSearch === '1') return;
        input.dataset.skilledGlobalSearch = '1';
        input.autocomplete = 'off';
        input.placeholder = 'Busca con palabras sueltas: pija 1/4x1, tubo 1 pulgada, proyecto 26028...';
        input.classList.add('skilled-global-search-input');
        const host = input.parentElement;
        host.classList.add('skilled-global-search-host');
        const previousIcon = host.querySelector('svg');
        if (previousIcon) previousIcon.style.display = 'none';
        if (!host.querySelector('.skilled-global-search-icon')) {
            const icon = document.createElement('span');
            icon.className = 'skilled-global-search-icon';
            icon.innerHTML = headerIcons.search;
            host.insertBefore(icon, input);
        }
        const results = searchResultsNode(input);
        input.addEventListener('focus', () => {
            if (cleanText(input.value)) performGlobalSearch(input, input.value);
        });
        input.addEventListener('input', () => {
            clearTimeout(globalSearchTimer);
            const value = cleanText(input.value);
            if (!value) {
                results.hidden = true;
                return;
            }
            globalSearchTimer = setTimeout(() => performGlobalSearch(input, value), 120);
        });
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                results.hidden = true;
                return;
            }
            if (!results.hidden && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                setActiveResult(results, activeSearchResult + (event.key === 'ArrowDown' ? 1 : -1));
                return;
            }
            if (event.key === 'Enter' && cleanText(input.value)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const active = results.querySelector('.skilled-search-item.is-active') || results.querySelector('.skilled-search-item');
                if (active) location.href = active.href;
                else performGlobalSearch(input, input.value, true);
            }
        }, true);
        document.addEventListener('click', event => {
            if (!host.contains(event.target)) results.hidden = true;
        });
        if (!document.documentElement.dataset.skilledSearchShortcuts) {
            document.documentElement.dataset.skilledSearchShortcuts = '1';
            document.addEventListener('keydown', event => {
                const target = event.target;
                const typing = target && /^(input|textarea|select)$/i.test(target.tagName);
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                    event.preventDefault(); input.focus(); input.select();
                } else if (!typing && event.key === '/') {
                    event.preventDefault(); input.focus(); input.select();
                }
            });
        }
        const query = new URLSearchParams(location.search).get('q');
        if (query) {
            input.value = query;
            setTimeout(() => {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                results.hidden = true;
            }, 450);
        }
    }


    function ensureMobileHeaderCopy(){
        const header=document.querySelector('body > div header, header');if(!header)return;
        let copy=header.querySelector('.skilled-mobile-header-copy');
        if(!copy){copy=document.createElement('div');copy.className='skilled-mobile-header-copy';const toggle=header.querySelector('[data-sidebar-mobile-toggle]');if(toggle?.nextSibling)header.insertBefore(copy,toggle.nextSibling);else if(toggle)header.appendChild(copy);else header.prepend(copy)}
        const profileLabels={almacen:'Almacén',compras:'Compras',rh:'Recursos Humanos',finanzas:'Finanzas',gerente_general:'Gerencia General',subgerente:'Subgerencia',sky_demo:'Sky · Presentación',tsi:'TSI',proyectos:'Proyectos',consulta:'Consulta'};
        const profile=sidebarProfileKey();let section=currentFile().replace(/\.html?$/i,'').replace(/^[A-Z]{2}\./i,'').replace(/[._-]+/g,' ').trim();section=section?section.charAt(0).toUpperCase()+section.slice(1):'Inicio';
        const markup=`<strong>${safeHtml(profileLabels[profile]||'Skilled CRM')}</strong><span>${safeHtml(section)}</span>`;
        if(copy.innerHTML!==markup)copy.innerHTML=markup;
    }

    function ensureMobileDock() {
        let dock = document.getElementById('skilled-mobile-dock');
        if (!dock) {
            dock = document.createElement('nav');
            dock.id = 'skilled-mobile-dock';
            dock.setAttribute('aria-label','Acciones rápidas');
            const menu = document.createElement('button');
            menu.id = 'skilled-mobile-menu-open';
            menu.type = 'button';
            menu.className = 'skilled-mobile-dock-button';
            menu.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menú</span>`;
            menu.addEventListener('click', () => document.body.classList.add('skilled-mobile-sidebar-open'));
            dock.appendChild(menu);
            const search = document.createElement('button');
            search.id = 'skilled-mobile-search-open';
            search.type = 'button';
            search.className = 'skilled-mobile-dock-button';
            search.innerHTML = `${headerIcons.search}<span>Buscar</span>`;
            search.addEventListener('click', () => {
                document.body.classList.add('skilled-mobile-search-open');
                const input = globalHeaderInput();
                setTimeout(() => { input?.focus(); input?.select(); }, 40);
            });
            dock.appendChild(search);
            document.body.appendChild(dock);
        }
        let backdrop = document.getElementById('skilled-mobile-search-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('button');
            backdrop.id = 'skilled-mobile-search-backdrop';
            backdrop.type = 'button';
            backdrop.setAttribute('aria-label','Cerrar búsqueda');
            backdrop.addEventListener('click', () => document.body.classList.remove('skilled-mobile-search-open'));
            document.body.appendChild(backdrop);
        }
        return dock;
    }

    function syncMobileDock() {
        const mobile = window.matchMedia('(max-width: 760px)').matches;
        ensureMobileHeaderCopy();
        const dock = ensureMobileDock();
        const header = document.querySelector('body > div header, header');
        const actions = header ? headerActionContainer(header) : null;
        const sky = document.getElementById('sky-open');
        const chat = document.getElementById('chat-open');
        const demoProfile=sidebarProfileKey()==='sky_demo';
        const searchButton=document.getElementById('skilled-mobile-search-open');
        if(searchButton)searchButton.hidden=demoProfile;
        if(chat)chat.hidden=false;
        if (mobile) {
            if (sky && sky.parentElement !== dock) dock.appendChild(sky);
            if (chat && !demoProfile && chat.parentElement !== dock) dock.appendChild(chat);
            dock.hidden = false;
        } else {
            document.body.classList.remove('skilled-mobile-search-open');
            if (actions) {
                if (sky && sky.parentElement === dock) actions.insertBefore(sky, actions.firstChild);
                if (chat && chat.parentElement === dock) {
                    if (sky && sky.parentElement === actions) actions.insertBefore(chat, sky.nextSibling);
                    else actions.insertBefore(chat, actions.firstChild);
                }
            }
            dock.hidden = true;
        }
    }

    function bindMobileDockSync() {
        if (document.documentElement.dataset.skilledMobileDockBound === '1') return;
        document.documentElement.dataset.skilledMobileDockBound = '1';
        let resizeTimer = 0;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(syncMobileDock, 90);
        }, { passive:true });
        let syncQueued=false;
        const scheduleSync=()=>{if(syncQueued)return;syncQueued=true;requestAnimationFrame(()=>{syncQueued=false;syncMobileDock()})};
        window.addEventListener('skilled:contentchanged',scheduleSync);
        window.addEventListener('skilled:profileupdated',scheduleSync);
        window.addEventListener('skilled:skyready',scheduleSync);
        document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSync()});
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') document.body.classList.remove('skilled-mobile-search-open');
        });
    }

    const optionalScripts = new Map();

    function loadOptionalScript(src) {
        if (optionalScripts.has(src)) return optionalScripts.get(src);
        const promise = new Promise((resolve, reject) => {
            const existing = [...document.scripts].find(node => node.src === new URL(src, location.href).href);
            if (existing?.dataset.loaded === '1') return resolve(existing);
            const script = existing || document.createElement('script');
            const done = () => { script.dataset.loaded = '1'; resolve(script); };
            const fail = () => reject(new Error('No se pudo cargar el módulo.'));
            script.addEventListener('load', done, { once:true });
            script.addEventListener('error', fail, { once:true });
            if (!existing) { script.src = src; script.async = true; document.head.appendChild(script); }
        });
        optionalScripts.set(src, promise);
        return promise;
    }

    function lazyActionHost() {
        const header = document.querySelector('body > div header, header');
        return header ? headerActionContainer(header) : null;
    }

    function createLazySkyButton() {
        if (document.getElementById('sky-open')) return;
        const host = lazyActionHost();
        if (!host) return;
        const button = document.createElement('button');
        button.id = 'sky-open';
        button.type = 'button';
        button.className = 'skilled-header-button skilled-sky-launcher';
        button.title = 'Consultar Sky';
        button.innerHTML = '<span class="skilled-sky-dot"></span><svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8"></path></svg><span data-sky-label>Sky</span><span class="skilled-sky-caption">Asistente</span>';
        button.addEventListener('click', async () => {
            button.disabled = true;
            button.remove();
            syncMobileDock();
            try {
                await loadOptionalScript('skilled-sky.js?v=77');
                window.SkilledSky?.open?.();
            } catch (_) {
                createLazySkyButton();
            }
            syncMobileDock();
        }, { once:true });
        host.insertBefore(button, host.firstChild);
    }

    function createLazyChatButton() {
        if (document.getElementById('chat-open')) return;
        const host = lazyActionHost();
        if (!host) return;
        const button = document.createElement('button');
        button.id = 'chat-open';
        button.type = 'button';
        button.className = 'skilled-header-button skilled-chat-launcher';
        button.title = 'Chat interno';
        button.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5Z"></path><path d="M8 9h8M8 12h5"></path></svg><span>Chat</span>';
        button.addEventListener('click', async () => {
            button.disabled = true;
            button.remove();
            syncMobileDock();
            try {
                await loadOptionalScript('skilled-chat.js?v=77');
                window.SkilledChat?.open?.();
            } catch (_) {
                createLazyChatButton();
            }
            syncMobileDock();
        }, { once:true });
        const sky = document.getElementById('sky-open');
        if (sky && sky.parentElement === host) host.insertBefore(button, sky.nextSibling);
        else host.insertBefore(button, host.firstChild);
    }

    function ensureSky() {
        if (!skyAllowed()) {
            document.getElementById('sky-open')?.remove();
            document.getElementById('sky-overlay')?.remove();
            document.querySelectorAll('[data-skilled-sky]').forEach(node => node.remove());
            return;
        }
        if (window.SkilledSky) return;
        if (sidebarProfileKey() === 'sky_demo') {
            loadOptionalScript('skilled-sky.js?v=77').catch(() => createLazySkyButton());
            return;
        }
        if (document.querySelector('script[src*="skilled-sky.js"]')) return;
        createLazySkyButton();
    }

    let chatIdleScheduled = false;
    function scheduleChatNotifications() {
        if (chatIdleScheduled || window.SkilledChat) return;
        chatIdleScheduled = true;
        const load = async () => {
            if (document.hidden || window.SkilledChat || !document.getElementById('chat-open')) return;
            document.getElementById('chat-open')?.remove();
            try { await loadOptionalScript('skilled-chat.js?v=77'); } catch (_) { createLazyChatButton(); }
            syncMobileDock();
        };
        if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout:7000 });
        else setTimeout(load, 6000);
    }

    function ensureChat() {
        if (window.SkilledChat || document.querySelector('script[src*="skilled-chat.js"]')) return;
        createLazyChatButton();
        scheduleChatNotifications();
    }

    function normalizeSharedHeader() {
        addSharedStyles();
        if (window.SkilledTheme?.applyStored) window.SkilledTheme.applyStored(); else if (localStorage.getItem(themeStorageKey()) === 'claro') { document.documentElement.classList.add('tema-claro'); document.body.classList.add('tema-claro'); } else { document.documentElement.classList.remove('tema-claro'); document.body.classList.remove('tema-claro'); }
        normalizeHeaderButtons();
        normalizeGlobalSearch();
        updateThemeButtons();
        syncProfileIdentity();
        bindMobileDockSync();
        syncMobileDock();
    }

    window.addEventListener('skilled:sessionready', () => {
        ensureSky();
        ensureChat();
        const role = currentRole();
        if (!document.getElementById('skilled-sidebar') || renderedRole !== role) {
            renderSidebar();
            scheduleRequestBadgeUpdate();
        } else {
            const aside = document.getElementById('skilled-sidebar');
            const compact = sidebarCompactFor(role);
            document.body.classList.toggle('skilled-sidebar-collapsed', compact);
            applySidebarWidth(aside, compact);
        }
        normalizeSharedHeader();
        syncProfileIdentity(true);
    });
    window.addEventListener('skilled:profileupdated', event => {
        const profile = event.detail || cachedProfile();
        if (profile) { storeProfile(profile); applyProfileIdentity(profile); }
        else syncProfileIdentity(true);
    });

    function initialize() {
        ensureSky();
        ensureChat();
        renderSidebar();
        normalizeBreadcrumbHome();
        scheduleRequestBadgeUpdate();
        normalizeSharedHeader();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
