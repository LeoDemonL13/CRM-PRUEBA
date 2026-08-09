
(function () {
    'use strict';

    let soloIncompletos = false;
    const originalFiltered = window.materialesFiltrados;
    const originalRenderMaterials = window.renderMateriales;
    const originalOpenProduct = window.abrirProducto;

    function camposPendientes(material) {
        const explicit = Array.isArray(material?.camposPendientes)
            ? material.camposPendientes
            : Array.isArray(material?.campos_pendientes)
                ? material.campos_pendientes
                : [];
        if (explicit.length) return explicit;
        const pending = [];
        if (!String(material?.categoria || '').trim()) pending.push('categoria');
        if (!String(material?.unidad || '').trim()) pending.push('unidad');
        if (!(Number(material?.precio) > 0)) pending.push('precio');
        return pending;
    }

    function nombresCamposPendientes(material) {
        const labels = {
            categoria: 'categoría',
            unidad: 'unidad',
            precio: 'precio',
            imagen: 'imagen',
            tipo_cable: 'tipo de cable',
            tamano_mm2: 'tamaño'
        };
        return camposPendientes(material).map(value => labels[value] || String(value).replaceAll('_', ' '));
    }

    function textoPendientes(material) {
        const fields = nombresCamposPendientes(material);
        return fields.length ? `Falta completar: ${fields.join(', ')}.` : 'Revisa y completa la información pendiente.';
    }

    const actionBar = document.querySelector('main section.flex.flex-col.sm\\:flex-row .flex.flex-wrap.gap-2');
    if (actionBar && !document.getElementById('btn-incompletos')) {
        const button = document.createElement('button');
        button.id = 'btn-incompletos';
        button.type = 'button';
        button.className = 'px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-950/10 text-amber-300 text-xs font-semibold hover:text-white';
        button.innerHTML = '<span id="contador-incompletos">0</span> información incompleta';
        button.addEventListener('click', () => {
            soloIncompletos = !soloIncompletos;
            button.classList.toggle('bg-amber-600', soloIncompletos);
            button.classList.toggle('text-white', soloIncompletos);
            if (soloIncompletos) abrirMateriales('');
            renderMateriales();
        });
        actionBar.insertBefore(button, actionBar.firstChild);
    }

    const productModalGrid = document.querySelector('#modal-producto .p-5.grid');
    if (productModalGrid && !document.getElementById('aviso-producto-incompleto')) {
        const warning = document.createElement('div');
        warning.id = 'aviso-producto-incompleto';
        warning.className = 'hidden sm:col-span-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-4 py-3 text-xs text-amber-300';
        warning.innerHTML = '<strong>Información incompleta:</strong> <span id="detalle-pendientes-producto">completa los campos pendientes para retirar esta marca.</span>';
        productModalGrid.prepend(warning);
    }

    window.materialesFiltrados = function () {
        const list = originalFiltered();
        return soloIncompletos ? list.filter(item => item.esIncompleto || item.es_incompleto) : list;
    };

    function updateIncompleteCounter() {
        const count = materiales.filter(item => item.esIncompleto || item.es_incompleto).length;
        const counter = document.getElementById('contador-incompletos');
        if (counter) counter.textContent = count;
    }

    function decorateIncomplete() {
        updateIncompleteCounter();
        const cards = document.querySelectorAll('#grid-materiales article');
        cards.forEach((card, index) => {
            const material = materialesVista[index];
            if (!material || !(material.esIncompleto || material.es_incompleto)) return;
            const image = card.querySelector('.h-48');
            if (image && !image.querySelector('.badge-incompleto')) {
                image.insertAdjacentHTML('beforeend', `<div class="badge-incompleto absolute left-2 top-2 max-w-[85%] rounded-lg border border-amber-400/40 bg-amber-500 px-2 py-1 text-[9px] font-bold text-black shadow"><div>INFORMACIÓN INCOMPLETA</div><div class="mt-0.5 text-[8px] font-semibold normal-case">${textoPendientes(material)}</div></div>`);
            }
        });
        const rows = document.querySelectorAll('#tbody-materiales tr');
        rows.forEach((row, index) => {
            const material = materialesVista[index];
            if (!material || !(material.esIncompleto || material.es_incompleto)) return;
            const cell = row.querySelector('td:nth-child(3)');
            if (cell && !cell.querySelector('.badge-incompleto')) {
                cell.insertAdjacentHTML('beforeend', `<div class="badge-incompleto mt-1 text-[9px] font-semibold text-amber-400">⚠ Información incompleta · ${textoPendientes(material)}</div>`);
            }
        });
    }

    window.renderMateriales = function () {
        originalRenderMaterials();
        decorateIncomplete();
    };

    window.abrirProducto = function (material = null) {
        originalOpenProduct(material);
        const incomplete = Boolean(material?.esIncompleto || material?.es_incompleto);
        document.getElementById('aviso-producto-incompleto')?.classList.toggle('hidden', !incomplete);
        const detail = document.getElementById('detalle-pendientes-producto');
        if (detail) detail.textContent = incomplete ? textoPendientes(material) : '';
    };

    window.guardarProducto = async function () {
        const warehouseId = Number(document.getElementById('p-almacen').value || 0);
        const current = materiales.find(item => item.codigo === editandoProducto);
        const product = {
            codigo: document.getElementById('p-codigo').value.trim(),
            descripcion: document.getElementById('p-descripcion').value.trim(),
            modismos: document.getElementById('p-modismos')?.value || '',
            categoria: document.getElementById('p-categoria').value,
            unidad: document.getElementById('p-unidad').value.trim(),
            tipoCable: document.getElementById('p-tipo').value.trim(),
            tamano: document.getElementById('p-tamano').value.trim(),
            marca: document.getElementById('p-marca')?.value.trim() || '',
            proveedor: document.getElementById('p-proveedor')?.value.trim() || '',
            contactoProveedor: document.getElementById('p-contacto-proveedor')?.value.trim() || '',
            precio: Number(document.getElementById('p-precio').value) || 0,
            stock: Number(document.getElementById('p-stock').value) || 0,
            stockMinimo: Number(document.getElementById('p-minimo').value) || 0,
            stockMedio: Number(document.getElementById('p-medio')?.value) || 0,
            stockMaximo: Number(document.getElementById('p-maximo')?.value) || 0,
            almacenId: warehouseId,
            almacenNombre: almacenes.find(item => item.id === warehouseId)?.nombre || '',
            imagen: document.getElementById('p-imagen').value.trim(),
            esIncompleto: Boolean(current?.esIncompleto || current?.es_incompleto),
            origenAlta: current?.origenAlta || current?.origen_alta || null
        };
        if (!product.codigo || !product.descripcion || !product.categoria || !product.unidad) return alert('Código, descripción, categoría y unidad son obligatorios.');
        if (editandoProducto && editandoProducto !== product.codigo) {
            const continuar = confirm(`Cambiarás el código ${editandoProducto} por ${product.codigo}. Las relaciones históricas se conservarán. ¿Continuar?`);
            if (!continuar) return;
        }
        try {
            const saved = await SkilledDB.saveMaterial(product, editandoProducto);
            cerrarProducto();
            materiales = await SkilledDB.listMaterials();
            renderMateriales();
            renderCategorias();
            if ((current?.esIncompleto || current?.es_incompleto) && !(saved.esIncompleto || saved.es_incompleto)) {
                alert('La información quedó completa y se retiró la marca del material.');
            }
        } catch (error) {
            alert(`No se pudo guardar el material: ${error.message}`);
        }
    };

    const wait = setInterval(() => {
        if (Array.isArray(materiales) && materiales.length) {
            clearInterval(wait);
            updateIncompleteCounter();
            if (!document.getElementById('vista-materiales').classList.contains('hidden')) decorateIncomplete();
        }
    }, 250);
})();
