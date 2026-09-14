
(function () {
    'use strict';

    let soloIncompletos = false;
    const originalFiltered = window.materialesFiltrados;
    const originalRenderMaterials = window.renderMateriales;
    const originalOpenProduct = window.abrirProducto;
    const originalWarehouseChange = window.cambiarAlmacenProducto;
    let cableRolls = [];
    let editingCableRollId = null;

    const normalizeCategory = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
    const isCableCategory = value => ['cable','cables'].includes(normalizeCategory(value));
    const n = value => Number(value) || 0;
    const fmt = value => n(value).toLocaleString('es-MX',{maximumFractionDigits:3});

    function installCableStyles() {
        if (document.getElementById('catalog-cable-v44-style')) return;
        const style=document.createElement('style');
        style.id='catalog-cable-v44-style';
        style.textContent=`.cable-roll-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:12px}.cable-roll-stat{border:1px solid #243257;border-radius:11px;background:#09111f;padding:11px}.cable-roll-stat span{display:block;color:#71819b;font-size:8px;text-transform:uppercase;font-weight:800;letter-spacing:.07em}.cable-roll-stat b{display:block;margin-top:6px;color:#f8fafc;font-size:15px}.cable-roll-list{display:grid;gap:8px;margin-top:12px}.cable-roll-row{display:grid;grid-template-columns:minmax(0,1.4fr) .8fr .8fr .8fr auto;gap:8px;align-items:center;border:1px solid #1d2d4a;border-radius:11px;background:#080f1d;padding:10px}.cable-roll-row strong{color:#eef5ff;font-size:10px}.cable-roll-row span{display:block;margin-top:2px;color:#72839e;font-size:8px}.cable-roll-meter{height:5px;border-radius:999px;background:#18243a;overflow:hidden;margin-top:6px}.cable-roll-meter i{display:block;height:100%;background:#3b82f6}.cable-roll-actions{display:flex;gap:6px}.cable-roll-actions button{border:1px solid #2b4166;border-radius:8px;background:#101a2e;color:#9fb4d3;padding:7px 9px;font-size:8px;font-weight:800}.cable-roll-actions button.danger{color:#fda4af;border-color:rgba(244,63,94,.3)}.cable-roll-legacy{color:#fbbf24!important}.cable-roll-empty{border:1px dashed #2a3d5f;border-radius:11px;padding:18px;text-align:center;color:#71819b;font-size:9px}.cable-modal{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.78);display:none;align-items:center;justify-content:center;padding:16px}.cable-modal.open{display:flex}.cable-dialog{width:min(620px,100%);max-height:90vh;overflow:auto;border:1px solid #2b4166;border-radius:16px;background:#10172a;box-shadow:0 30px 100px rgba(0,0,0,.55)}.cable-dialog-head{padding:16px 18px;border-bottom:1px solid #243257;display:flex;justify-content:space-between;gap:12px}.cable-dialog-body{padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.cable-dialog-foot{padding:14px 18px;border-top:1px solid #243257;display:flex;justify-content:flex-end;gap:8px}.cable-note{border:1px solid rgba(59,130,246,.22);background:rgba(37,99,235,.06);border-radius:10px;padding:10px 12px;color:#8da4c6;font-size:9px;line-height:1.55}.tema-claro .cable-roll-stat,.tema-claro .cable-roll-row{background:#fff;border-color:#dbe3ef}.tema-claro .cable-roll-stat b,.tema-claro .cable-roll-row strong{color:#0f172a}@media(max-width:760px){.cable-roll-summary{grid-template-columns:1fr 1fr}.cable-roll-row{grid-template-columns:1fr 1fr}.cable-roll-actions{grid-column:1/-1}.cable-dialog-body{grid-template-columns:1fr}}`;
        document.head.appendChild(style);
    }

    function installCablePanel() {
        installCableStyles();
        const typeInput=document.getElementById('p-tipo'),sizeInput=document.getElementById('p-tamano');
        if (typeInput?.parentElement) typeInput.parentElement.dataset.cableOnly='1';
        if (sizeInput?.parentElement) sizeInput.parentElement.dataset.cableOnly='1';
        const sections=[...document.querySelectorAll('#modal-producto .form-section')];
        const inventorySection=sections.find(section=>/Existencia y ubicación/i.test(section.textContent||''));
        if (inventorySection && !document.getElementById('seccion-rollos-cable')) {
            const panel=document.createElement('section');
            panel.id='seccion-rollos-cable';
            panel.className='form-section hidden';
            panel.innerHTML=`<div class="flex items-start justify-between gap-3"><div><div class="form-section-title">Control por rollos</div><p class="mt-1 text-[10px] text-gray-500">El inventario del cable se controla en metros, pero cada rollo conserva su metraje inicial y lo que todavía queda disponible.</p></div><button id="btn-nuevo-rollo-cable" type="button" class="px-3 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-bold">+ Agregar rollo</button></div><div class="cable-roll-summary"><div class="cable-roll-stat"><span>Rollos con saldo</span><b id="cable-roll-count">0</b></div><div class="cable-roll-stat"><span>Metros disponibles</span><b id="cable-roll-meters">0 m</b></div><div class="cable-roll-stat"><span>Rollos abiertos</span><b id="cable-roll-open">0</b></div><div class="cable-roll-stat"><span>Por terminar</span><b id="cable-roll-low">0</b></div><div class="cable-roll-stat"><span>Por identificar</span><b id="cable-roll-auto">0</b></div></div><div id="cable-roll-list" class="cable-roll-list"><div class="cable-roll-empty">Guarda el material y registra sus rollos.</div></div><div class="cable-note mt-3">Para cables, el campo Stock en almacén se calcula automáticamente sumando los metros disponibles de los rollos. Las salidas consumen primero los rollos ya abiertos. Si una entrada aumenta el metraje sin identificar el rollo físico, aparecerá como “Por identificar” para que después captures su código real.</div>`;
            inventorySection.insertAdjacentElement('afterend',panel);
            panel.querySelector('#btn-nuevo-rollo-cable')?.addEventListener('click',()=>openCableRollModal());
        }
        if (!document.getElementById('cable-roll-modal')) {
            const modal=document.createElement('div');
            modal.id='cable-roll-modal'; modal.className='cable-modal';
            modal.innerHTML=`<div class="cable-dialog"><div class="cable-dialog-head"><div><div id="cable-roll-modal-title" class="font-bold text-white">Nuevo rollo</div><div class="mt-1 text-[9px] text-gray-500">Identifica el rollo y registra el metraje que realmente queda.</div></div><button id="cable-roll-close" type="button" class="text-gray-400 text-xl">×</button></div><div class="cable-dialog-body"><div><label class="text-xs font-semibold">Código / identificador *</label><input id="cable-roll-code" class="product-input" placeholder="Ej. CBL-THW12-001"></div><div><label class="text-xs font-semibold">Almacén *</label><select id="cable-roll-warehouse" class="product-input"></select></div><div><label class="text-xs font-semibold">Metros iniciales *</label><input id="cable-roll-initial" type="number" min="0.001" step="0.001" class="product-input" placeholder="100"></div><div><label class="text-xs font-semibold">Metros disponibles *</label><input id="cable-roll-available" type="number" min="0" step="0.001" class="product-input" placeholder="100"></div><div><label class="text-xs font-semibold">Ubicación</label><input id="cable-roll-location" class="product-input" placeholder="01-1-A1"></div><div><label class="text-xs font-semibold">Estado</label><input id="cable-roll-state" class="product-input" readonly value="Se calcula automáticamente"></div><div style="grid-column:1/-1"><label class="text-xs font-semibold">Notas</label><textarea id="cable-roll-notes" rows="2" class="product-input" placeholder="Lote, observaciones, carrete, etc."></textarea></div></div><div class="cable-dialog-foot"><button id="cable-roll-cancel" type="button" class="px-4 py-2 rounded-lg bg-[#1b253c] text-sm">Cancelar</button><button id="cable-roll-save" type="button" class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">Guardar rollo</button></div></div>`;
            document.body.appendChild(modal);
            modal.addEventListener('click',event=>{if(event.target===modal)closeCableRollModal()});
            modal.querySelector('#cable-roll-close').addEventListener('click',closeCableRollModal);
            modal.querySelector('#cable-roll-cancel').addEventListener('click',closeCableRollModal);
            modal.querySelector('#cable-roll-save').addEventListener('click',saveCableRollFromModal);
            modal.querySelector('#cable-roll-initial').addEventListener('input',syncCableRollAvailable);
        }
        const category=document.getElementById('p-categoria');
        category?.addEventListener('input',updateCableVisibility);
        category?.addEventListener('change',updateCableVisibility);
    }

    function syncCableRollAvailable(){
        const initial=document.getElementById('cable-roll-initial'),available=document.getElementById('cable-roll-available');
        if (!editingCableRollId && available && (!available.value || n(available.value)===0)) available.value=initial?.value||'';
    }

    function updateCableVisibility() {
        const cable=isCableCategory(document.getElementById('p-categoria')?.value);
        document.querySelectorAll('[data-cable-only="1"]').forEach(node=>node.classList.toggle('hidden',!cable));
        document.getElementById('seccion-rollos-cable')?.classList.toggle('hidden',!cable);
        const unit=document.getElementById('p-unidad'),stock=document.getElementById('p-stock');
        const unitLabel=unit?.parentElement?.querySelector('label'),stockLabel=stock?.parentElement?.querySelector('label');
        const price=document.getElementById('p-precio'),priceLabel=price?.parentElement?.querySelector('label');
        if (cable) {
            if (unit) { unit.value='METRO'; unit.readOnly=true; }
            if (stock) { stock.readOnly=true; stock.title='Se calcula con los metros disponibles de los rollos.'; }
            if (unitLabel) unitLabel.textContent='Unidad de salida *';
            if (stockLabel) stockLabel.textContent='Metros disponibles (calculado)';
            if (priceLabel) priceLabel.textContent='Precio por metro';
            loadCableRollsForCurrent();
        } else {
            if (unit) unit.readOnly=false;
            if (stock) { stock.readOnly=false; stock.title=''; }
            if (unitLabel) unitLabel.textContent='Unidad *';
            if (stockLabel) stockLabel.textContent='Stock en almacén';
            if (priceLabel) priceLabel.textContent='Precio unitario';
            const type=document.getElementById('p-tipo'),size=document.getElementById('p-tamano');
            if (type) type.value=''; if (size) size.value='';
        }
    }

    async function loadCableRollsForCurrent() {
        const panel=document.getElementById('seccion-rollos-cable');
        if (!panel || panel.classList.contains('hidden')) return;
        const code=String(document.getElementById('p-codigo')?.value||'').trim();
        const warehouseId=Number(document.getElementById('p-almacen')?.value||0);
        const list=document.getElementById('cable-roll-list');
        if (!code || !editandoProducto) { cableRolls=[]; renderCableRolls(); return; }
        if (list) list.innerHTML='<div class="cable-roll-empty">Consultando rollos…</div>';
        try { cableRolls=await SkilledDB.listCableRolls(code,warehouseId); renderCableRolls(); }
        catch(error){ if(list)list.innerHTML=`<div class="cable-roll-empty" style="color:#fda4af">${String(error.message||error)}</div>`; }
    }

    function renderCableRolls() {
        const active=cableRolls.filter(r=>r.activo!==false),withBalance=active.filter(r=>n(r.metrosDisponibles)>0),meters=withBalance.reduce((sum,r)=>sum+n(r.metrosDisponibles),0),opened=withBalance.filter(r=>n(r.metrosDisponibles)<n(r.metrosIniciales)),low=withBalance.filter(r=>n(r.metrosIniciales)>0&&(n(r.metrosDisponibles)<=10||n(r.metrosDisponibles)/n(r.metrosIniciales)<=.2)),unidentified=active.filter(r=>['migracion_stock','stock_sin_identificar'].includes(String(r.origen||'')));
        const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
        set('cable-roll-count',String(withBalance.length)); set('cable-roll-meters',`${fmt(meters)} m`); set('cable-roll-open',String(opened.length)); set('cable-roll-low',String(low.length)); set('cable-roll-auto',String(unidentified.length));
        const stock=document.getElementById('p-stock'); if(stock&&isCableCategory(document.getElementById('p-categoria')?.value))stock.value=String(meters);
        const list=document.getElementById('cable-roll-list'); if(!list)return;
        if (!active.length) { list.innerHTML='<div class="cable-roll-empty">No hay rollos registrados en este almacén. Agrega el primer rollo para controlar su metraje.</div>'; return; }
        list.innerHTML=active.map(r=>{const initial=Math.max(.001,n(r.metrosIniciales)),available=n(r.metrosDisponibles),pct=Math.max(0,Math.min(100,available/initial*100)),pending=['migracion_stock','stock_sin_identificar'].includes(String(r.origen||'')),pendingText=r.origen==='migracion_stock'?'Stock heredado: verifica metraje e identificador':r.origen==='stock_sin_identificar'?'Entrada detectada: asigna el código físico del rollo':'';return `<div class="cable-roll-row"><div><strong class="${pending?'cable-roll-legacy':''}">${String(r.codigoRollo||'Rollo')}</strong><span>${pending?pendingText:'Ubicación: '+(r.ubicacion||'sin ubicación')}</span><div class="cable-roll-meter"><i style="width:${pct}%"></i></div></div><div><strong>${fmt(initial)} m</strong><span>Inicial</span></div><div><strong>${fmt(available)} m</strong><span>Disponible</span></div><div><strong>${r.estado||'—'}</strong><span>${Math.round(pct)}% restante</span></div><div class="cable-roll-actions"><button type="button" data-edit-roll="${r.id}">Editar</button><button type="button" class="danger" data-delete-roll="${r.id}">Retirar</button></div></div>`}).join('');
        list.querySelectorAll('[data-edit-roll]').forEach(btn=>btn.addEventListener('click',()=>openCableRollModal(cableRolls.find(r=>r.id===Number(btn.dataset.editRoll)))));
        list.querySelectorAll('[data-delete-roll]').forEach(btn=>btn.addEventListener('click',()=>removeCableRoll(Number(btn.dataset.deleteRoll))));
    }

    function openCableRollModal(roll=null) {
        const code=String(document.getElementById('p-codigo')?.value||'').trim();
        if (!editandoProducto || !code) return alert('Guarda primero el material de cable. Después podrás registrar sus rollos.');
        editingCableRollId=roll?.id||null;
        const modal=document.getElementById('cable-roll-modal');
        document.getElementById('cable-roll-modal-title').textContent=roll?'Editar rollo':'Nuevo rollo';
        const wh=document.getElementById('cable-roll-warehouse');
        wh.innerHTML=(Array.isArray(almacenes)?almacenes:[]).map(a=>`<option value="${a.id}">${String(a.nombre||'Almacén')}</option>`).join('');
        wh.value=String(roll?.almacenId||Number(document.getElementById('p-almacen')?.value||0)||'');
        document.getElementById('cable-roll-code').value=roll?.codigoRollo||'';
        document.getElementById('cable-roll-initial').value=roll?.metrosIniciales||'';
        document.getElementById('cable-roll-available').value=roll?.metrosDisponibles??'';
        document.getElementById('cable-roll-location').value=roll?.ubicacion||'';
        document.getElementById('cable-roll-notes').value=roll?.notas||'';
        modal?.classList.add('open');
    }
    function closeCableRollModal(){document.getElementById('cable-roll-modal')?.classList.remove('open');editingCableRollId=null}
    async function saveCableRollFromModal(){
        const button=document.getElementById('cable-roll-save'); const original=button.textContent; button.disabled=true; button.textContent='Guardando…';
        try {
            await SkilledDB.saveCableRoll({id:editingCableRollId,materialCodigo:document.getElementById('p-codigo').value,almacenId:Number(document.getElementById('cable-roll-warehouse').value),codigoRollo:document.getElementById('cable-roll-code').value,metrosIniciales:document.getElementById('cable-roll-initial').value,metrosDisponibles:document.getElementById('cable-roll-available').value,ubicacion:document.getElementById('cable-roll-location').value,notas:document.getElementById('cable-roll-notes').value});
            closeCableRollModal();
            materiales=await SkilledDB.listMaterials();
            await loadCableRollsForCurrent();
            renderMateriales();
        } catch(error){alert(error.message||String(error))} finally{button.disabled=false;button.textContent=original}
    }
    async function removeCableRoll(id){
        const roll=cableRolls.find(r=>r.id===id); if(!roll)return;
        if(!confirm(`¿Retirar el rollo ${roll.codigoRollo}? El historial del material no se elimina.`))return;
        try{await SkilledDB.deleteCableRoll(id);materiales=await SkilledDB.listMaterials();await loadCableRollsForCurrent();renderMateriales()}catch(error){alert(error.message||String(error))}
    }

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
        if (!String(material?.codigoMarca || material?.codigo_marca || '').trim()) pending.push('codigo_marca');
        if (isCableCategory(material?.categoria) && !String(material?.tipoCable || material?.tipo_cable || '').trim()) pending.push('tipo_cable');
        if (isCableCategory(material?.categoria) && !String(material?.tamano || material?.tamano_mm2 || '').trim()) pending.push('tamano_mm2');
        if (!(Number(material?.precio) > 0)) pending.push('precio');
        return pending;
    }

    function nombresCamposPendientes(material) {
        const labels = {
            categoria: 'categoría',
            unidad: 'unidad',
            codigo_marca: 'código de marca / modelo',
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

    const productModalGrid = document.querySelector('#modal-producto .p-5.space-y-5');
    if (productModalGrid && !document.getElementById('aviso-producto-incompleto')) {
        const warning = document.createElement('div');
        warning.id = 'aviso-producto-incompleto';
        warning.className = 'hidden sm:col-span-2 rounded-lg border border-amber-500/30 bg-amber-950/10 px-4 py-3 text-xs text-amber-300';
        warning.innerHTML = '<strong>Información incompleta:</strong> <span id="detalle-pendientes-producto">completa los campos pendientes para retirar esta marca.</span>';
        productModalGrid.prepend(warning);
    }

    window.materialesFiltrados = function () {
        const list = originalFiltered();
        if (!soloIncompletos) return list;
        return list.filter(item => item.esIncompleto || item.es_incompleto).sort((a,b) => {
            const ao = String(a.origenAlta || a.origen_alta || '');
            const bo = String(b.origenAlta || b.origen_alta || '');
            const amanual = /no_listado|incompleto|plan_proyecto|entrega_directa|movimiento/i.test(ao) ? 1 : 0;
            const bmanual = /no_listado|incompleto|plan_proyecto|entrega_directa|movimiento/i.test(bo) ? 1 : 0;
            if (amanual !== bmanual) return bmanual - amanual;
            const at = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime() || 0;
            const bt = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime() || 0;
            return bt - at;
        });
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
        installCablePanel();
        updateCableVisibility();
        const currency = String(material?.monedaCosto || material?.moneda_costo || 'MXN').toUpperCase();
        const currencySelect = document.getElementById('p-moneda-costo');
        if (currencySelect) currencySelect.value = ['MXN','USD','EUR'].includes(currency) ? currency : 'MXN';
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
            unidad: isCableCategory(document.getElementById('p-categoria').value) ? 'METRO' : document.getElementById('p-unidad').value.trim(),
            tipoCable: isCableCategory(document.getElementById('p-categoria').value) ? document.getElementById('p-tipo').value.trim() : '',
            tamano: isCableCategory(document.getElementById('p-categoria').value) ? document.getElementById('p-tamano').value.trim() : '',
            marca: document.getElementById('p-marca')?.value.trim() || '',
            codigoMarca: document.getElementById('p-codigo-marca')?.value.trim() || '',
            proveedor: document.getElementById('p-proveedor')?.value.trim() || '',
            contactoProveedor: document.getElementById('p-contacto-proveedor')?.value.trim() || '',
            precio: Number(document.getElementById('p-precio').value) || 0,
            monedaCosto: document.getElementById('p-moneda-costo')?.value || 'MXN',
            moneda_costo: document.getElementById('p-moneda-costo')?.value || 'MXN',
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
        if (isCableCategory(product.categoria) && (!product.tipoCable || !product.tamano)) return alert('Para Cable/Cables, Tipo de cable y Tamaño mm²/AWG son obligatorios.');
        if (editandoProducto && editandoProducto !== product.codigo) {
            const continuar = confirm(`Cambiarás el código ${editandoProducto} por ${product.codigo}. Las relaciones históricas se conservarán. ¿Continuar?`);
            if (!continuar) return;
        }
        try {
            const saved = await SkilledDB.saveMaterial(product, editandoProducto);
            editandoProducto = saved.codigo || product.codigo;
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

    installCablePanel();
    updateCableVisibility();
    window.cambiarAlmacenProducto = function () {
        if (typeof originalWarehouseChange === 'function') originalWarehouseChange();
        updateCableVisibility();
        if (isCableCategory(document.getElementById('p-categoria')?.value)) loadCableRollsForCurrent();
    };

    const wait = setInterval(() => {
        if (Array.isArray(materiales) && materiales.length) {
            clearInterval(wait);
            updateIncompleteCounter();
            if (!document.getElementById('vista-materiales').classList.contains('hidden')) decorateIncomplete();
        }
    }, 250);
})();
