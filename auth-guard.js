(function () {
    'use strict';

    function pageNameFromPath(pathname = location.pathname) {
        let raw = '';
        try { raw = decodeURIComponent(String(pathname || '').split('/').pop() || ''); } catch (_) { raw = String(pathname || '').split('/').pop() || ''; }
        raw = raw.trim().toLowerCase();
        if (!raw) return 'index.html';
        if (!raw.endsWith('.html') && !raw.endsWith('.htm')) raw += '.html';
        return raw;
    }

    const file = pageNameFromPath();
    const publicPages = new Set(['login.html', 'index.html', 'limpiar-cache.html', 'recuperar-crm.html']);
    if (publicPages.has(file)) return;

    const access = {
        administrador: ['*'],
        jefe_almacen: ['al.inicio.html','perfil.html','al.escaner.html','al.catalogo.html','al.importar-materiales.html','al.bajo-minimo.html','al.almacenes.html','al.etiquetas.html','al.etiqueta.html','al.movimientos.html','al.historial-movimientos.html','al.tomas-fisicas.html','al.entrega-directa.html','al.solicitudes-material.html','al.ordenes-compra.html','al.reportes.html','al.proyectos.html','proy.importar.html','al.herramientas.html','al.unidades-herramientas.html','al.asignaciones-herramientas.html','al.estado-herramientas.html','al.historial-herramientas.html','al.vehiculos.html','al.automatizaciones.html','al.manual-usuario.html','al.prueba-ticket.html','paq.paquetes-materiales.html'],
        almacen: ['al.inicio.html','perfil.html','al.escaner.html','al.catalogo.html','al.importar-materiales.html','al.bajo-minimo.html','al.almacenes.html','al.etiquetas.html','al.etiqueta.html','al.movimientos.html','al.historial-movimientos.html','al.tomas-fisicas.html','al.entrega-directa.html','al.solicitudes-material.html','al.ordenes-compra.html','al.reportes.html','al.proyectos.html','proy.importar.html','al.herramientas.html','al.unidades-herramientas.html','al.asignaciones-herramientas.html','al.estado-herramientas.html','al.historial-herramientas.html','al.vehiculos.html','al.automatizaciones.html','al.manual-usuario.html','paq.paquetes-materiales.html'],
        compras: ['co.inicio.html','co.cotizaciones.html','co.ordenes-compra.html','co.proveedores.html','co.requisiciones.html','co.recepciones.html','co.hacer-compra.html','co.entregas.html','co.tienda.html','co.servicios.html','perfil.html','al.catalogo.html','co.bajo-minimo.html','al.bajo-minimo.html','al.historial-movimientos.html','al.proyectos.html','al.ordenes-compra.html','al.reportes.html','paq.paquetes-materiales.html'],
        rh: ['rh.inicio.html','rh.personal.html','rh.equipos.html','rh.proyectos.html','proy.importar.html','rh.nomina.html','rh.checador.html','rh.asistencias.html','rh.documentos.html','rh.capacitacion.html','al.vehiculos.html','perfil.html','paq.paquetes-materiales.html'],
        finanzas: ['fi.inicio.html','fi.presupuestos.html','fi.gastos.html','fi.cuentas-pagar.html','fi.reportes.html','perfil.html','al.reportes.html','al.proyectos.html','paq.paquetes-materiales.html'],
        gerente_general: ['gg.inicio.html','gg.proyectos.html','gg.vehiculos.html','perfil.html','paq.paquetes-materiales.html'],
        subgerente: ['sg.inicio.html','sg.proyectos.html','sg.vehiculos.html','perfil.html','paq.paquetes-materiales.html'],
        sky_demo: ['sky.inicio.html','perfil.html'],
        tsi: ['tsi.inicio.html','perfil.html','paq.paquetes-materiales.html'],
        proyectos: ['al.proyectos.html','proy.importar.html','al.reportes.html','al.solicitudes-material.html','al.historial-movimientos.html','al.catalogo.html','perfil.html','paq.paquetes-materiales.html'],
        consulta: ['al.inicio.html','perfil.html','al.escaner.html','al.catalogo.html','al.reportes.html','al.manual-usuario.html','paq.paquetes-materiales.html']
    };

    const homeByRole = {
        administrador: 'AL.inicio.html',
        jefe_almacen: 'AL.inicio.html',
        almacen: 'AL.inicio.html',
        compras: 'CO.inicio.html',
        rh: 'RH.inicio.html',
        finanzas: 'FI.inicio.html',
        gerente_general: 'GG.inicio.html',
        subgerente: 'SG.inicio.html',
        sky_demo: 'SKY.inicio.html',
        tsi: 'TSI.inicio.html',
        proyectos: 'AL.proyectos.html',
        consulta: 'AL.inicio.html'
    };

    const normalize = value => String(value ?? '').trim().toLowerCase();
    const root = document.documentElement;
    const PROFILE_VALIDATION_KEY = 'skilled_profile_validated_at';
    const PROFILE_VALIDATION_TTL = 300000;

    function readCachedProfile() {
        try {
            const raw = localStorage.getItem('skilled_profile_cache');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function hasStoredSession() {
        try {
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index) || '';
                if (!/^sb-.+-auth-token(?:\..+)?$/.test(key)) continue;
                const value = localStorage.getItem(key) || '';
                if (value && (/access_token/.test(value) || /refresh_token/.test(value))) return true;
            }
        } catch (_) {}
        return false;
    }

    function normalizePageTarget(target) {
        const value = String(target || '').trim().toLowerCase();
        if (!value) return file;
        if (value.includes('/') || value.startsWith('http')) {
            try { return pageNameFromPath(new URL(value, location.origin).pathname); } catch (_) {}
        }
        return value.endsWith('.html') || value.endsWith('.htm') ? value : `${value}.html`;
    }

    function allowedFor(role, target = file) {
        const allowed = access[role] || access.consulta;
        const normalizedTarget = normalizePageTarget(target);
        return allowed.includes('*') || allowed.includes(normalizedTarget);
    }

    function exposeSession(user, profile, role, cached = false, degraded = false) {
        window.SkilledSession = Object.freeze({ user, profile, role, cached, degraded });
        root.dataset.role = role;
        root.classList.remove('auth-pending');
        root.classList.add('auth-ready');
        root.classList.toggle('auth-cached', cached);
    }

    function clearProfileCache() {
        try { localStorage.removeItem('skilled_profile_cache'); } catch (_) {}
        try { sessionStorage.removeItem(PROFILE_VALIDATION_KEY); } catch (_) {}
    }

    function recentProfileValidation() {
        try {
            const at = Number(sessionStorage.getItem(PROFILE_VALIDATION_KEY) || 0);
            return at > 0 && Date.now() - at < PROFILE_VALIDATION_TTL;
        } catch (_) {
            return false;
        }
    }

    function markProfileValidated() {
        try { sessionStorage.setItem(PROFILE_VALIDATION_KEY, String(Date.now())); } catch (_) {}
    }

    let redirecting = false;
    function redirectToLogin(state = '') {
        if (redirecting) return;
        redirecting = true;
        const next = encodeURIComponent(location.href);
        location.replace(`login.html?next=${next}${state ? `&estado=${encodeURIComponent(state)}` : ''}`);
    }

    function redirectHome(role) {
        if (redirecting) return;
        redirecting = true;
        location.replace(homeByRole[role] || homeByRole.consulta);
    }

    const cached = readCachedProfile();
    const cachedRole = normalize(cached?.rol) || 'consulta';
    const canUseCache = Boolean(cached && cached.activo !== false && hasStoredSession() && allowedFor(cachedRole));

    root.classList.add('auth-pending');
    root.classList.toggle('auth-cached', canUseCache);

    if (!document.getElementById('skilled-auth-gate-style')) {
        const style = document.createElement('style');
        style.id = 'skilled-auth-gate-style';
        style.textContent = `
            html.auth-pending:not(.auth-cached) body{min-height:100vh!important;background:#060814!important;overflow:hidden!important}
            html.auth-pending:not(.auth-cached) body>*{visibility:hidden!important}
            html.auth-pending:not(.auth-cached) body::before{content:"";visibility:visible!important;position:fixed;inset:0;z-index:2147483645;background:#060814}
            html.auth-pending:not(.auth-cached) body::after{content:"Validando acceso al CRM…";visibility:visible!important;position:fixed;z-index:2147483646;left:50%;top:50%;transform:translate(-50%,-50%);min-width:230px;padding:58px 24px 20px;border:1px solid #243257;border-radius:16px;background:rgba(9,13,26,.96) url('logo-reporte.png') center 17px/118px auto no-repeat;box-shadow:0 24px 70px rgba(0,0,0,.4);color:#93a4bc;text-align:center;font:600 11px Inter,system-ui,sans-serif}
            html[data-crm-theme="claro"].auth-pending:not(.auth-cached) body,html[data-crm-theme="claro"].auth-pending:not(.auth-cached) body::before{background:#f2f4f9!important}
            html[data-crm-theme="claro"].auth-pending:not(.auth-cached) body::after{background-color:#fff;border-color:#d8e0ec;color:#64748b;box-shadow:0 22px 55px rgba(15,23,42,.12)}
        `;
        document.head.appendChild(style);
    }

    if (canUseCache) {
        exposeSession({ email: cached.email || '' }, cached, cachedRole, true, false);
    }

    let attempts = 0;
    function waitForClient() {
        return new Promise((resolve, reject) => {
            const poll = () => {
                if (window.SkilledDB?.client) return resolve(window.SkilledDB.client);
                attempts += 1;
                if (attempts >= 300) return reject(new Error('No se pudo iniciar la conexión con Supabase.'));
                window.setTimeout(poll, 50);
            };
            poll();
        });
    }

    function withTimeout(value, milliseconds, message) {
        let timer = 0;
        const timeout = new Promise((_, reject) => {
            timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
        });
        return Promise.race([Promise.resolve(value), timeout]).finally(() => window.clearTimeout(timer));
    }

    function applyNavigation(client, allowed) {
        const run = () => {
            addScannerLinks();
            hideRestrictedLinks(allowed);
            wireLogout(client);
        };
        run();
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
        window.setTimeout(run, 300);
    }

    async function validate() {
        let client;
        try {
            client = await waitForClient();
        } catch (error) {
            if (canUseCache) {
                exposeSession({ email: cached.email || '' }, cached, cachedRole, true, true);
                window.dispatchEvent(new CustomEvent('skilled:sessionready', { detail: window.SkilledSession }));
                return;
            }
            redirectToLogin('conexion');
            return;
        }

        try {
            const { data: { session }, error: sessionError } = await withTimeout(client.auth.getSession(), 10000, 'La validación de sesión excedió el tiempo de espera.');
            if (sessionError || !session) {
                clearProfileCache();
                redirectToLogin('sesion_requerida');
                return;
            }

            if (canUseCache && recentProfileValidation() && (!cached?.id || String(cached.id) === String(session.user.id))) {
                exposeSession(session.user, cached, cachedRole, true, false);
                applyNavigation(client, access[cachedRole] || access.consulta);
                window.dispatchEvent(new CustomEvent('skilled:sessionready', { detail: window.SkilledSession }));
                return;
            }

            const { data: profile, error: profileError } = await withTimeout(
                client
                    .from('perfiles_usuario')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle(),
                12000,
                'La consulta del perfil excedió el tiempo de espera.'
            );

            if (profileError) {
                if (canUseCache) {
                    exposeSession(session.user, cached, cachedRole, true, true);
                    applyNavigation(client, access[cachedRole] || access.consulta);
                    window.dispatchEvent(new CustomEvent('skilled:sessionready', { detail: window.SkilledSession }));
                    return;
                }
                redirectToLogin('conexion');
                return;
            }

            if (!profile || !profile.activo) {
                clearProfileCache();
                await client.auth.signOut().catch(() => {});
                redirectToLogin('sin_acceso');
                return;
            }

            const role = normalize(profile.rol) || 'consulta';
            if (!allowedFor(role)) {
                redirectHome(role);
                return;
            }

            try {
                localStorage.setItem('skilled_profile_cache', JSON.stringify({ ...profile, email: session.user.email, fotoUrl: profile.foto_url }));
            } catch (_) {}
            markProfileValidated();

            exposeSession(session.user, profile, role, false, false);
            applyNavigation(client, access[role] || access.consulta);
            window.dispatchEvent(new CustomEvent('skilled:sessionready', { detail: window.SkilledSession }));
        } catch (error) {
            console.error('No se pudo validar la sesión:', error, { pagina: file, ruta: location.pathname });
            if (canUseCache) {
                exposeSession({ email: cached.email || '' }, cached, cachedRole, true, true);
                applyNavigation(client, access[cachedRole] || access.consulta);
                window.dispatchEvent(new CustomEvent('skilled:sessionready', { detail: window.SkilledSession }));
                return;
            }
            redirectToLogin('conexion');
        }
    }

    function addScannerLinks() {
        if (document.getElementById('skilled-sidebar')) return;
        document.querySelectorAll('aside nav ul, aside nav').forEach(nav => {
            if (nav.querySelector('a[href="AL.escaner.html"]')) return;
            const home = nav.querySelector('a[href="AL.inicio.html"]');
            if (!home) return;
            const wrapper = home.closest('li') || home;
            const item = document.createElement(wrapper.tagName.toLowerCase() === 'li' ? 'li' : 'div');
            item.innerHTML = '<a href="AL.escaner.html" title="Escáner" data-sidebar-link class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#11182c] transition text-gray-400 hover:text-white"><span class="text-blue-400" aria-hidden="true">⌗</span><span class="skilled-sidebar-label">Escáner</span></a>';
            wrapper.insertAdjacentElement('afterend', item);
        });
    }

    function hideRestrictedLinks(allowed) {
        if (allowed.includes('*')) return;
        document.querySelectorAll('a[href$=".html"],a[href*=".html?"]').forEach(link => {
            const target = (link.getAttribute('href') || '').split('?')[0].split('/').pop().toLowerCase();
            if (target && target !== 'login.html' && !allowed.includes(target)) {
                const item = link.closest('li') || link;
                item.style.display = 'none';
            }
        });
    }

    function wireLogout(client) {
        document.querySelectorAll('a[href="login.html"]').forEach(link => {
            if (!/cerrar sesi/i.test(link.textContent || '') || link.dataset.skilledLogoutBound === '1') return;
            link.dataset.skilledLogoutBound = '1';
            link.addEventListener('click', async event => {
                event.preventDefault();
                clearProfileCache();
                await client.auth.signOut().catch(() => {});
                location.replace('login.html');
            });
        });
    }

    validate();
})();
