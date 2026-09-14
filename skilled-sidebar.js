(function () {
    'use strict';

    const icons = {
        home: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"></path><path d="M5.5 10.5V20h13v-9.5"></path><path d="M9.5 20v-6h5v6"></path></svg>',
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
        logout: '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 16l4-4-4-4"></path><path d="M21 12H7"></path><path d="M13 19v1H4V4h9v1"></path></svg>'
    };

    const sections = [
        {
            title: 'Cuenta',
            items: [
                ['inicio.html', 'Inicio', 'home'],
                ['perfil.html', 'Mi perfil', 'user']
            ]
        },
        {
            title: 'Materiales',
            items: [
                ['catalogo.html', 'Catálogo', 'box'],
                ['bajo-minimo.html', 'Bajo mínimo', 'alert'],
                ['almacenes.html', 'Almacenes', 'warehouse'],
                ['etiquetas.html', 'Etiquetas', 'tag']
            ]
        },
        {
            title: 'Movimientos',
            items: [
                ['Almacen.html', 'Registrar movimiento', 'plus'],
                ['historial-movimientos.html', 'Historial movimientos', 'history'],
                ['tomas-fisicas.html', 'Tomas físicas', 'clipboard']
            ]
        },
        {
            title: 'Compras y solicitudes',
            items: [
                ['entrega-directa.html', 'Entrega directa', 'delivery'],
                ['solicitudes-material.html', 'Solicitudes de material', 'request'],
                ['solicitudes-compra.html', 'Solicitudes de compra', 'cart']
            ]
        },
        {
            title: 'Proyectos y reportes',
            items: [
                ['proyectos.html', 'Proyectos', 'folder'],
                ['reportes.html', 'Reportes', 'report']
            ]
        }
    ];

    function currentFile() {
        let file = decodeURIComponent((location.pathname.split('/').pop() || 'inicio.html')).toLowerCase();
        if (file === 'etiqueta.html') file = 'etiquetas.html';
        if (file === 'importar-materiales.html') file = 'catalogo.html';
        return file;
    }

    function linkMarkup(item, activeFile) {
        const [href, label, icon] = item;
        const isActive = href.toLowerCase() === activeFile;
        const classes = isActive
            ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#141d34] border-l-2 border-blue-500 text-white font-semibold'
            : 'flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#11182c] transition text-gray-400 hover:text-white';
        const iconMarkup = icons[icon].replace('class="w-4 h-4 shrink-0"', `class="w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-500'}"`);
        return `<li><a href="${href}" class="${classes}">${iconMarkup}<span>${label}</span></a></li>`;
    }

    function renderSidebar() {
        const activeFile = currentFile();
        const aside = document.createElement('aside');
        aside.id = 'skilled-sidebar';
        aside.className = 'w-[260px] h-screen sticky top-0 bg-[#090d1a] border-r border-[#161f38] flex-col justify-between hidden lg:flex shrink-0';
        aside.innerHTML = `
            <div class="overflow-y-auto flex-1 lista-scroll">
                <div class="p-6 border-b border-[#161f38] flex items-center justify-between">
                    <a href="inicio.html" title="Ir al inicio">
                        <img src="https://erp.skilledmx.cloud/logo.png" alt="Skilled Logo" class="h-9 w-auto object-contain">
                    </a>
                </div>
                <nav class="p-4 space-y-6 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                    ${sections.map(section => `
                        <div>
                            <span class="px-3 block mb-2">${section.title}</span>
                            <ul class="space-y-1 text-xs normal-case text-gray-400 font-medium">
                                ${section.items.map(item => linkMarkup(item, activeFile)).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </nav>
            </div>
            <div class="p-4 border-t border-[#161f38] bg-[#070b16]">
                <a href="login.html" class="w-full flex items-center justify-center gap-2 bg-[#10172a] hover:bg-red-950/20 border border-[#232f4e] text-red-400 hover:text-red-300 py-2.5 rounded-lg text-xs font-semibold transition">
                    ${icons.logout}
                    <span>Cerrar sesión</span>
                </a>
            </div>`;

        const existing = document.querySelector('body > aside') || document.querySelector('aside');
        if (existing) existing.replaceWith(aside);
        else document.body.prepend(aside);
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

    async function updateRequestBadge() {
        try {
            const link = document.querySelector('a[href="solicitudes-material.html"],a[href="AL.solicitudes-material.html"]');
            if (!link) return;
            const current = link.querySelector('[data-request-badge]');
            if (current) current.remove();
            if (!window.SkilledDB || typeof window.SkilledDB.listMaterialRequests !== 'function' || typeof window.SkilledDB.listMaterialAdjustments !== 'function') return;
            const [requests, adjustments] = await Promise.all([
                window.SkilledDB.listMaterialRequests(),
                window.SkilledDB.listMaterialAdjustments()
            ]);
            const pendingRequests = (Array.isArray(requests) ? requests : []).filter(item => String(item.estado || '').toLowerCase() === 'pendiente').length;
            const pendingAdjustments = (Array.isArray(adjustments) ? adjustments : []).filter(item => String(item.estado || '').toLowerCase() === 'pendiente').length;
            const total = pendingRequests + pendingAdjustments;
            if (!total) return;
            const badge = document.createElement('span');
            badge.dataset.requestBadge = '1';
            badge.className = 'ml-auto min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center';
            badge.textContent = total > 99 ? '99+' : String(total);
            link.appendChild(badge);
        } catch (error) {
            const badge = document.querySelector('[data-request-badge]');
            if (badge) badge.remove();
            console.debug('No se pudo cargar el indicador de solicitudes:', error);
        }
    }

    function initialize() {
        renderSidebar();
        normalizeBreadcrumbHome();
        setTimeout(updateRequestBadge, 250);
        window.addEventListener('skilled:requests-updated', updateRequestBadge);
        window.addEventListener('focus', updateRequestBadge);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) updateRequestBadge();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
