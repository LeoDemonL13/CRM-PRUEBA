(function () {
    'use strict';

    const root = document.documentElement;
    function currentFile(){let file=(location.pathname.split('/').pop()||'').toLowerCase();if(file&&!/\.html?$/.test(file))file+='.html';return file}
    function darkOnlyPage(){return ['login.html'].includes(currentFile())}
    function themeProfile(){
        const requested=String(new URLSearchParams(location.search).get('perfil')||'').toLowerCase();
        if(['almacen','compras','rh','finanzas','gerente_general','subgerente','proyectos','consulta'].includes(requested))return requested;
        const file=currentFile();
        if(file.startsWith('co.'))return 'compras';
        if(file.startsWith('rh.'))return 'rh';
        if(file.startsWith('fi.'))return 'finanzas';
        if(file.startsWith('gg.'))return 'gerente_general';
        if(file.startsWith('sg.'))return 'subgerente';
        if(file.startsWith('al.'))return 'almacen';
        const remembered=sessionStorage.getItem('skilled_active_profile');
        if(['almacen','compras','rh','finanzas','gerente_general','subgerente','proyectos','consulta'].includes(remembered))return remembered;
        const role=cachedRole();
        if(['compras','rh','finanzas','gerente_general','subgerente','proyectos','consulta'].includes(role))return role;
        return 'almacen';
    }
    const themeStorageKey=()=>`skilled_tema_${themeProfile()}`;
    window.SkilledThemeKey=themeStorageKey();
    const getLightTheme = () => !darkOnlyPage() && localStorage.getItem(themeStorageKey()) === 'claro';
    function cachedRole() {
        try { return String(JSON.parse(localStorage.getItem('skilled_profile_cache') || 'null')?.rol || '').toLowerCase(); } catch (_) { return ''; }
    }
    function sidebarProfile() {
        return themeProfile();
    }
    function applySidebarStateImmediately() {
        const profile = sidebarProfile();
        const compact = localStorage.getItem(`skilled_sidebar_compact_${profile}`) === '1';
        root.dataset.crmSidebarProfile = profile;
        root.dataset.crmSidebarCompact = compact ? '1' : '0';
    }

    function applyThemeImmediately() {
        const light = getLightTheme();
        const background = light ? '#f2f4f9' : '#060814';
        root.dataset.crmTheme = light ? 'claro' : 'oscuro';
        root.classList.toggle('tema-claro', light);
        root.style.backgroundColor = background;
        root.style.colorScheme = light ? 'light' : 'dark';
        if (document.body) {
            document.body.classList.toggle('tema-claro', light);
            document.body.style.backgroundColor = background;
        }
    }

    applyThemeImmediately();
    applySidebarStateImmediately();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyThemeImmediately, { once: true });
    }

    function ensureProgressBar() {
        let bar = document.getElementById('crm-route-progress');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = 'crm-route-progress';
        bar.setAttribute('aria-hidden', 'true');
        root.appendChild(bar);
        return bar;
    }

    let progressSafetyTimer = 0;
    function beginProgress() {
        const bar = ensureProgressBar();
        bar.classList.remove('is-finishing');
        bar.classList.add('is-active');
        window.clearTimeout(progressSafetyTimer);
        progressSafetyTimer = window.setTimeout(finishProgress, 2500);
    }

    function finishProgress() {
        const bar = document.getElementById('crm-route-progress');
        if (!bar) return;
        bar.classList.add('is-finishing');
        window.setTimeout(() => bar.remove(), 220);
    }

    window.addEventListener('pageshow', finishProgress);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', finishProgress, { once: true });
    } else {
        finishProgress();
    }

    function targetUrl(anchor) {
        if (!anchor || anchor.hasAttribute('download') || anchor.hasAttribute('data-no-transition')) return null;
        if (/cerrar\s+sesi/i.test(anchor.textContent || '')) return null;
        if (anchor.target && anchor.target.toLowerCase() !== '_self') return null;
        const raw = anchor.getAttribute('href') || '';
        if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return null;
        let url;
        try {
            url = new URL(raw, location.href);
        } catch (_) {
            return null;
        }
        if (url.origin !== location.origin) return null;
        if (url.pathname === location.pathname && url.search === location.search && !url.hash) return null;
        if (!/\.(?:html?)$/i.test(url.pathname) && !url.pathname.endsWith('/')) return null;
        return url;
    }

    const prefetched = new Set();
    function prefetch(anchor) {
        const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
        if(connection?.saveData||['slow-2g','2g','3g'].includes(connection?.effectiveType))return;
        const url = targetUrl(anchor);
        if (!url || prefetched.has(url.href)) return;
        prefetched.add(url.href);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url.href;
        document.head.appendChild(link);
    }

    let hoverTimer = 0;
    document.addEventListener('pointerover', event => {
        const anchor = event.target.closest?.('a[href]');
        if (!anchor) return;
        window.clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(() => prefetch(anchor), 80);
    }, { passive: true, capture: true });

    document.addEventListener('focusin', event => {
        const anchor = event.target.closest?.('a[href]');
        if (anchor) prefetch(anchor);
    }, true);

    document.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = event.target.closest?.('a[href]');
        if (!targetUrl(anchor)) return;
        beginProgress();
    }, false);

    async function enableServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        if (!window.isSecureContext && !['localhost','127.0.0.1'].includes(location.hostname)) return;
        try {
            const registration = await navigator.serviceWorker.register('./crm-sw.js?v=37', { scope: './', updateViaCache: 'none' });
            registration.update().catch(() => {});
        } catch (_) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enableServiceWorker, { once: true });
    } else {
        enableServiceWorker();
    }

})();
