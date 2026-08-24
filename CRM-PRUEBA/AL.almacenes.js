(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const text = value => String(value ?? '').trim();
    const lower = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const esc = value => text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    let warehouses = [];
    let locations = [];
    let inventory = [];
    let selectedWarehouse = 0;
    let view = 'visual';
    let editingWarehouse = '';
    let editingLocation = 0;
    let draggedCode = '';
    let assigningCode = '';
    let selectedRack = 0;
    let selectedZone = 0;
    const selectedQrPositions = new Map();
    const MAX_MATERIALS_PER_POSITION = 8;

    function currentWarehouse() {
        return warehouses.find(item => Number(item.id) === Number(selectedWarehouse)) || null;
    }

    function currentLocations() {
        return locations
            .filter(item => Number(item.almacenId) === Number(selectedWarehouse))
            .sort((a, b) => locationSortValue(a).localeCompare(locationSortValue(b), 'es', { numeric: true }));
    }

    function locationSortValue(location) {
        return text(location.codigo || location.nombre).toUpperCase();
    }

    function locationKey(location) {
        return text(location.codigo || location.nombre).toUpperCase();
    }

    function parseBaseCode(value) {
        const raw = text(value).toUpperCase().replace(/\s+/g, '');
        const match = raw.match(/^(\d{2})-([1-9]\d*)-([A-Z])$/);
        if (!match) return null;
        const rack = Number(match[1]);
        const zone = Number(match[2]);
        if (rack < 1 || rack > 20 || zone < 1) return null;
        return {
            codigo: `${String(rack).padStart(2, '0')}-${zone}-${match[3]}`,
            rack,
            zona: zone,
            piso: match[3]
        };
    }

    function parseFinalCode(value) {
        const raw = text(value).toUpperCase().replace(/\s+/g, '');
        const match = raw.match(/^(\d{2})-([1-9]\d*)-([A-Z])([1-9]\d*)$/);
        if (!match) return null;
        const rack = Number(match[1]);
        const zone = Number(match[2]);
        const sequence = Number(match[4]);
        if (rack < 1 || rack > 20 || zone < 1 || sequence < 1) return null;
        return {
            codigo: `${String(rack).padStart(2, '0')}-${zone}-${match[3]}${sequence}`,
            base: `${String(rack).padStart(2, '0')}-${zone}-${match[3]}`,
            rack,
            zona: zone,
            piso: match[3],
            consecutivo: sequence
        };
    }

    function isStructuredLocation(location) {
        return Boolean(parseBaseCode(locationKey(location)));
    }

    function slotValue(location, sequence) {
        const base = parseBaseCode(locationKey(location));
        return base ? `${base.codigo}${Math.max(1, Number(sequence) || 1)}` : `${locationKey(location)}-${Math.max(1, Number(sequence) || 1)}`;
    }

    function locationMatch(value, location) {
        const final = parseFinalCode(value);
        const base = parseBaseCode(locationKey(location));
        if (final && base) return final.base === base.codigo;
        return lower(value) === lower(locationKey(location));
    }

    function findLocation(value) {
        return currentLocations().find(location => locationMatch(value, location)) || null;
    }

    function capacity(location) {
        return Math.max(1, Math.trunc(Number(location?.columnas) || 20));
    }

    function materialLocationState(item) {
        const location = findLocation(item.ubicacion);
        if (!location) return { location: null, consecutive: 0 };
        const parsed = parseFinalCode(item.ubicacion);
        return {
            location,
            consecutive: Math.min(Math.max(parsed?.consecutivo || 1, 1), capacity(location))
        };
    }

    function materialsInPosition(locationId, sequence, excludeCode = '') {
        return inventory.filter(item => {
            if (item.codigo === excludeCode) return false;
            const state = materialLocationState(item);
            return Number(state.location?.id) === Number(locationId) && Number(state.consecutive) === Number(sequence);
        });
    }

    function showToast(message, error = false) {
        const toast = $('toast');
        toast.textContent = message;
        toast.className = `toast ${error ? 'error' : ''}`;
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => toast.classList.add('hidden'), 3800);
    }

    function openModal(id) {
        $(id).classList.remove('hidden');
        $(id).classList.add('flex');
    }

    function closeModal(id) {
        $(id).classList.add('hidden');
        $(id).classList.remove('flex');
    }

    async function loadAll() {
        try {
            const previous = selectedWarehouse;
            [warehouses, locations] = await Promise.all([
                SkilledDB.listWarehouses(),
                SkilledDB.listWarehouseLocations()
            ]);
            selectedWarehouse = warehouses.some(item => Number(item.id) === Number(previous))
                ? previous
                : Number(warehouses[0]?.id || 0);
            await loadInventory();
            renderAll();
        } catch (error) {
            showToast(error.message, true);
        }
    }

    async function loadInventory() {
        inventory = selectedWarehouse
            ? await SkilledDB.listWarehouseInventory({ warehouseId: selectedWarehouse })
            : [];
    }

    function renderAll() {
        renderWarehouses();
        renderWorkspace();
    }

    function renderWarehouses() {
        const list = $('warehouse-list');
        $('warehouse-count').textContent = `${warehouses.length} almacén${warehouses.length === 1 ? '' : 'es'}`;
        if (!warehouses.length) {
            list.innerHTML = '<div class="panel p-8 text-center text-xs text-gray-500">No hay almacenes registrados.</div>';
            return;
        }
        list.innerHTML = warehouses.map(item => {
            const active = Number(item.id) === Number(selectedWarehouse);
            const count = locations.filter(location => Number(location.almacenId) === Number(item.id)).length;
            return `<article class="warehouse-card panel p-4 cursor-pointer ${active ? '!border-blue-500 bg-blue-950/10' : ''}" data-warehouse="${item.id}">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h3 class="text-sm font-bold text-white truncate">${esc(item.nombre)}</h3>
                        <p class="mt-1 text-[11px] text-gray-500">${esc(item.ubicacion || 'Sin ubicación general')}</p>
                        <div class="mt-3 flex gap-2">
                            <span class="rounded border border-blue-500/20 px-2 py-1 text-[9px] text-blue-300">${count} zonas / pisos</span>
                            <span class="rounded border border-[#243257] px-2 py-1 text-[9px] text-gray-400">${esc(item.estado || 'Activo')}</span>
                        </div>
                    </div>
                    <div class="flex gap-1">
                        <button class="crm-icon-button !w-8 !h-8" data-edit-warehouse="${item.id}" title="Editar">✎</button>
                        <button class="crm-icon-button !w-8 !h-8 text-rose-400" data-delete-warehouse="${item.id}" title="Eliminar">×</button>
                    </div>
                </div>
            </article>`;
        }).join('');
    }

    function materialCard(item, compact = false) {
        return `<article class="material-chip ${compact ? '!p-2' : ''}" draggable="true" data-material-code="${esc(item.codigo)}">
            <div class="flex items-start gap-2">
                <div class="min-w-0 flex-1">
                    <p class="material-code text-[9px] text-blue-300 truncate">${esc(item.codigo)}</p>
                    <p class="mt-1 text-[10px] font-semibold text-white leading-4 ${compact ? 'line-clamp-1' : 'line-clamp-2'}">${esc(item.descripcion || item.codigo)}</p>
                    <p class="mt-1 text-[8px] text-gray-500">${Number(item.stock || 0).toLocaleString('es-MX')} ${esc(item.unidad || '')}${item.ubicacion ? ` · ${esc(item.ubicacion)}` : ''}</p>
                </div>
                <button data-assign-code="${esc(item.codigo)}" class="text-[9px] text-gray-500 hover:text-blue-300" title="Asignar ubicación">Asignar</button>
            </div>
        </article>`;
    }

    function renderWorkspace() {
        const warehouse = currentWarehouse();
        $('new-location').disabled = !warehouse;
        $('generate-structure').disabled = !warehouse;
        $('warehouse-empty').classList.toggle('hidden', Boolean(warehouse));
        $('table-view').classList.toggle('hidden', !warehouse || view !== 'table');
        $('visual-view').classList.toggle('hidden', !warehouse || view !== 'visual');
        $('table-tab').className = `px-3 py-2 text-xs font-semibold ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-[#10172a] text-gray-400'}`;
        $('visual-tab').className = `px-3 py-2 text-xs font-semibold ${view === 'visual' ? 'bg-blue-600 text-white' : 'bg-[#10172a] text-gray-400'}`;
        if (!warehouse) {
            $('location-title').textContent = 'Ubicaciones';
            $('location-subtitle').textContent = 'Selecciona un almacén.';
            return;
        }
        $('location-title').textContent = `Ubicaciones en ${warehouse.nombre}`;
        $('location-subtitle').textContent = 'Arrastra materiales a cada posición física. Cada cajón admite hasta 8 tipos de material.';
        renderTable();
        renderVisual();
    }

    function countMaterials(location) {
        return inventory.filter(item => materialLocationState(item).location?.id === location.id).length;
    }

    function renderTable() {
        const rows = currentLocations();
        $('location-table').innerHTML = rows.length
            ? rows.map(location => `<tr>
                <td class="px-4 py-3 font-semibold text-white">${esc(location.nombre)}</td>
                <td class="px-4 py-3 material-code text-blue-300">${esc(location.codigo || '—')}</td>
                <td class="px-4 py-3 text-gray-400">${esc(location.tipo || 'Ubicación')}</td>
                <td class="px-4 py-3 text-center text-gray-400">1–${capacity(location)}</td>
                <td class="px-4 py-3 text-center"><span class="rounded-full border border-blue-500/25 px-2 py-1 text-[9px] text-blue-300">${countMaterials(location)}</span></td>
                <td class="px-4 py-3 max-w-xs truncate text-gray-500">${esc(location.nota || '—')}</td>
                <td class="px-4 py-3"><div class="flex justify-end gap-2"><button data-edit-location="${location.id}" class="text-[10px] text-gray-400">Editar</button><button data-delete-location="${location.id}" class="text-[10px] text-rose-400">Eliminar</button></div></td>
            </tr>`).join('')
            : '<tr><td colspan="7" class="px-4 py-12 text-center text-gray-500">Este almacén todavía no tiene zonas y pisos configurados.</td></tr>';
    }

    function renderVisual() {
        const rows = currentLocations();
        const query = lower($('material-filter').value);
        const states = inventory.map(item => ({ item, state: materialLocationState(item) }));
        const unassigned = states.filter(row => !row.state.location && (!query || (window.SkilledSearch?.matches?window.SkilledSearch.matches([row.item.codigo,row.item.descripcion,row.item.categoria,row.item.marca,row.item.proveedor,...(row.item.modismos||[])],query):lower(`${row.item.codigo} ${row.item.descripcion} ${row.item.categoria}`).includes(query))));
        const located = states.filter(row => row.state.location).length;
        const slotMap = new Map();
        states.forEach(entry => {
            if (!entry.state.location || !entry.state.consecutive) return;
            const key = `${entry.state.location.id}:${entry.state.consecutive}`;
            if (!slotMap.has(key)) slotMap.set(key, []);
            slotMap.get(key).push(entry.item);
        });

        $('metric-materials').textContent = inventory.length.toLocaleString('es-MX');
        $('metric-located').textContent = located.toLocaleString('es-MX');
        $('metric-unassigned').textContent = (inventory.length - located).toLocaleString('es-MX');
        $('metric-locations').textContent = rows.length.toLocaleString('es-MX');
        $('unassigned-count').textContent = unassigned.length;
        $('unassigned-zone').innerHTML = unassigned.length
            ? unassigned.map(row => materialCard(row.item)).join('')
            : '<div class="py-12 text-center text-[10px] text-gray-500">No hay materiales sin ubicación con este filtro.</div>';

        const rackGroups = new Map();
        rows.forEach(location => {
            const base = parseBaseCode(location.codigo);
            if (!base) return;
            if (!rackGroups.has(base.rack)) rackGroups.set(base.rack, { locations: [], materialCount: 0, zones: new Set() });
            const group = rackGroups.get(base.rack);
            group.locations.push(location);
            group.zones.add(base.zona);
        });
        states.forEach(entry => {
            const base = parseBaseCode(entry.state.location?.codigo || '');
            if (base && rackGroups.has(base.rack)) rackGroups.get(base.rack).materialCount += 1;
        });

        const racks = [...rackGroups.entries()].sort((a, b) => a[0] - b[0]);
        const rackNumbers = racks.map(([rack]) => rack);
        if (!rackNumbers.includes(selectedRack)) selectedRack = rackNumbers[0] || 0;
        const selectedGroup = rackGroups.get(selectedRack) || null;
        const zones = selectedGroup ? [...selectedGroup.zones].sort((a, b) => a - b) : [];
        if (!zones.includes(selectedZone)) selectedZone = zones[0] || 0;

        if (!racks.length) {
            $('rack-manager').innerHTML = rows.length
                ? '<section class="panel p-5 text-center"><p class="text-sm font-bold text-white">Todavía no hay racks con la nomenclatura nueva</p><p class="mt-2 text-[10px] text-gray-500">Las ubicaciones existentes siguen disponibles en la vista Tabla. Usa “Generar racks” para crear la estructura RR-Z-P.</p></section>'
                : '';
            $('location-boards').innerHTML = '<section class="panel py-16 text-center"><p class="text-sm font-bold text-white">No hay estructura física</p><p class="mt-2 text-[10px] text-gray-500">Genera los racks, zonas y pisos o crea una estructura manualmente.</p><button id="first-location" class="mt-3 text-xs font-semibold text-blue-400">Crear la primera ubicación</button></section>';
            bindDragAndDrop();
            return;
        }

        const rackIndex = rackNumbers.indexOf(selectedRack);
        const rackCode = String(selectedRack).padStart(2, '0');
        const totalSlots = selectedGroup.locations.reduce((sum, location) => sum + capacity(location), 0);
        const occupiedPositions = new Set(states.filter(entry => parseBaseCode(entry.state.location?.codigo || '')?.rack === selectedRack && entry.state.consecutive).map(entry => `${entry.state.location.id}:${entry.state.consecutive}`)).size;
        const occupancy = totalSlots ? Math.round((occupiedPositions / totalSlots) * 100) : 0;
        const prevRack = rackNumbers[rackIndex - 1] || '';
        const nextRack = rackNumbers[rackIndex + 1] || '';

        $('rack-manager').innerHTML = `<section class="panel rack-explorer">
            <div class="rack-explorer-head">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap"><p class="text-xs font-bold text-white">Explorador de racks</p><span class="rack-count-badge">${racks.length} configurado${racks.length === 1 ? '' : 's'}</span></div>
                    <p class="mt-1 text-[9px] text-gray-500">Selecciona un rack y después una zona. Solo se muestra esa sección para evitar que toda la estructura se amontone.</p>
                </div>
                <div class="rack-nav-actions">
                    <button type="button" data-rack-step="${prevRack}" class="rack-arrow" ${prevRack ? '' : 'disabled'} title="Rack anterior">‹</button>
                    <button type="button" data-rack-step="${nextRack}" class="rack-arrow" ${nextRack ? '' : 'disabled'} title="Rack siguiente">›</button>
                </div>
            </div>
            <div class="rack-strip" role="tablist" aria-label="Racks del almacén">
                ${racks.map(([rack, group]) => {
                    const active = rack === selectedRack;
                    return `<button type="button" data-select-rack="${rack}" class="rack-selector ${active ? 'is-active' : ''}" role="tab" aria-selected="${active}">
                        <span class="rack-selector-code">${String(rack).padStart(2, '0')}</span>
                        <span class="rack-selector-meta">${group.materialCount} mat. · ${group.zones.size} zona${group.zones.size === 1 ? '' : 's'}</span>
                    </button>`;
                }).join('')}
            </div>
            <div class="rack-selected-summary">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap"><h3 class="text-base font-bold text-white">Rack ${rackCode}</h3><span class="text-[9px] text-emerald-400">${selectedGroup.materialCount} material${selectedGroup.materialCount === 1 ? '' : 'es'}</span></div>
                    <p class="mt-1 text-[9px] text-gray-500">${zones.length} zona${zones.length === 1 ? '' : 's'} · ${selectedGroup.locations.length} niveles · ${occupiedPositions}/${totalSlots.toLocaleString('es-MX')} posiciones ocupadas</p>
                </div>
                <div class="rack-occupancy"><span>${occupancy}% ocupado</span><div><i style="width:${Math.min(100, occupancy)}%"></i></div></div>
                <button type="button" data-delete-rack="${selectedRack}" class="rack-delete">Eliminar rack</button>
            </div>
            <div class="rack-zone-row">
                <span class="rack-zone-label">Zona</span>
                <div class="rack-zone-tabs">
                    ${zones.map(zone => `<button type="button" data-select-zone="${zone}" class="rack-zone-tab ${zone === selectedZone ? 'is-active' : ''}">Zona ${zone}</button>`).join('')}
                </div>
            </div>
        </section>`;

        const visibleLocations = selectedGroup.locations
            .filter(location => parseBaseCode(location.codigo)?.zona === selectedZone)
            .sort((a, b) => {
                const aa = parseBaseCode(a.codigo)?.piso || 'Z';
                const bb = parseBaseCode(b.codigo)?.piso || 'Z';
                return aa.localeCompare(bb);
            });

        $('location-boards').innerHTML = visibleLocations.length
            ? `<section class="rack-physical-view">
                <div class="rack-physical-header">
                    <div><p class="text-sm font-bold text-white">Rack ${rackCode} · Zona ${selectedZone}</p><p class="mt-1 text-[9px] text-gray-500">Cada posición representa un cajón. Puede contener hasta 8 tipos de material y tiene su propia etiqueta QR de 18.5 × 5 cm.</p></div>
                    <div class="qr-batch-tools"><span class="rack-floor-count">${visibleLocations.length} piso${visibleLocations.length === 1 ? '' : 's'}</span><button type="button" data-select-visible-qr class="qr-batch-btn">Seleccionar visibles</button><button type="button" data-clear-qr class="qr-batch-btn">Limpiar</button><button type="button" data-print-selected-qr class="qr-batch-btn primary" ${selectedQrPositions.size?'':'disabled'}>Imprimir seleccionados (${selectedQrPositions.size})</button></div>
                </div>
                <div class="rack-frame">
                    ${visibleLocations.map((location, floorIndex) => {
                        const max = capacity(location);
                        const base = parseBaseCode(location.codigo);
                        let occupied = 0;
                        let materialTotal = 0;
                        let cells = '';
                        for (let sequence = 1; sequence <= max; sequence += 1) {
                            const inCell = slotMap.get(`${location.id}:${sequence}`) || [];
                            const finalCode = slotValue(location, sequence);
                            if (inCell.length) occupied += 1;
                            materialTotal += inCell.length;
                            cells += `<div class="location-cell ${inCell.length ? 'is-occupied' : ''}" data-location-id="${location.id}" data-sequence="${sequence}">
                                <div class="location-cell-head"><div class="flex items-start gap-2"><input type="checkbox" class="qr-select-box" data-select-qr-position="${location.id}" data-select-qr-sequence="${sequence}" ${selectedQrPositions.has(`${location.id}:${sequence}`)?'checked':''}><div><div class="location-cell-title">${esc(finalCode)}</div><div class="mt-1 text-[8px] text-gray-600">Posición ${sequence} · ${inCell.length}/${MAX_MATERIALS_PER_POSITION}</div></div></div><button type="button" data-qr-position="${location.id}" data-qr-sequence="${sequence}" class="position-qr-button" title="Etiqueta QR de esta posición">QR</button></div>
                                <div class="slot-materials">${inCell.length ? inCell.map(item => materialCard(item, true)).join('') : '<p class="location-free">Libre</p>'}</div>
                            </div>`;
                        }
                        return `<article class="rack-floor-card">
                            <div class="rack-floor-side">
                                <span class="rack-floor-order">${floorIndex === 0 && base?.piso === 'A' ? 'SUPERIOR' : `NIVEL ${floorIndex + 1}`}</span>
                                <strong>Piso ${esc(base?.piso || '?')}</strong>
                                <span class="material-code">${esc(location.codigo || '')}</span>
                                <small>${occupied}/${max} posiciones · ${materialTotal} materiales</small>
                                <div class="rack-floor-tools"><button data-edit-location="${location.id}" class="rack-floor-tool" title="Editar piso">✎</button></div>
                            </div>
                            <div class="rack-slot-scroll">${cells}</div>
                        </article>`;
                    }).join('')}
                </div>
            </section>`
            : '<section class="panel py-12 text-center"><p class="text-sm font-bold text-white">Esta zona no tiene pisos configurados.</p><button id="first-location" class="mt-3 text-xs font-semibold text-blue-400">Añadir piso</button></section>';

        requestAnimationFrame(() => {
            const activeRack = document.querySelector('.rack-selector.is-active');
            const strip = activeRack?.parentElement;
            if (activeRack && strip) {
                const left = Math.max(0, activeRack.offsetLeft - (strip.clientWidth - activeRack.offsetWidth) / 2);
                strip.scrollTo({ left, behavior: 'smooth' });
            }
        });
        bindDragAndDrop();
    }

    function bindDragAndDrop() {
        document.querySelectorAll('[draggable][data-material-code]').forEach(card => {
            card.addEventListener('dragstart', event => {
                draggedCode = card.dataset.materialCode;
                card.classList.add('dragging');
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', draggedCode);
            });
            card.addEventListener('dragend', () => {
                draggedCode = '';
                card.classList.remove('dragging');
                document.querySelectorAll('.drag-over').forEach(node => node.classList.remove('drag-over'));
            });
        });

        document.querySelectorAll('.location-cell').forEach(cell => {
            cell.addEventListener('dragover', event => {
                event.preventDefault();
                cell.classList.add('drag-over');
            });
            cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
            cell.addEventListener('drop', async event => {
                event.preventDefault();
                cell.classList.remove('drag-over');
                const code = event.dataTransfer.getData('text/plain') || draggedCode;
                const location = locations.find(item => Number(item.id) === Number(cell.dataset.locationId));
                if (code && location) await assignLocation(code, location, Number(cell.dataset.sequence));
            });
        });

        $('unassigned-zone').ondragover = event => {
            event.preventDefault();
            $('unassigned-zone').classList.add('drag-over');
        };
        $('unassigned-zone').ondragleave = () => $('unassigned-zone').classList.remove('drag-over');
        $('unassigned-zone').ondrop = async event => {
            event.preventDefault();
            $('unassigned-zone').classList.remove('drag-over');
            const code = event.dataTransfer.getData('text/plain') || draggedCode;
            if (code) await clearLocation(code);
        };
    }

    async function assignLocation(code, location, sequence) {
        const item = inventory.find(row => row.codigo === code);
        if (!item || !location) return;
        const occupants = materialsInPosition(location.id, sequence, code);
        if (occupants.length >= MAX_MATERIALS_PER_POSITION) {
            showToast(`${slotValue(location, sequence)} ya contiene ${MAX_MATERIALS_PER_POSITION} tipos de material.`, true);
            return;
        }
        const value = slotValue(location, sequence);
        const previous = item.ubicacion;
        item.ubicacion = value;
        renderVisual();
        try {
            await SkilledDB.assignWarehouseMaterialLocation({ codigo: code, almacenId: selectedWarehouse, ubicacion: value });
            showToast(`${code} fue asignado a ${value}.`);
        } catch (error) {
            item.ubicacion = previous;
            renderVisual();
            showToast(error.message, true);
        }
    }

    async function clearLocation(code) {
        const item = inventory.find(row => row.codigo === code);
        if (!item) return;
        const previous = item.ubicacion;
        item.ubicacion = '';
        renderVisual();
        try {
            await SkilledDB.assignWarehouseMaterialLocation({ codigo: code, almacenId: selectedWarehouse, ubicacion: '' });
            showToast(`${code} quedó sin ubicación específica.`);
        } catch (error) {
            item.ubicacion = previous;
            renderVisual();
            showToast(error.message, true);
        }
    }

    function openAssign(code) {
        assigningCode = code;
        const item = inventory.find(row => row.codigo === code);
        $('assign-material').textContent = item ? `${item.codigo} — ${item.descripcion}` : code;
        const rows = currentLocations();
        $('assign-location').innerHTML = '<option value="">Selecciona rack, zona y piso...</option>' + rows.map(location => `<option value="${location.id}">${esc(location.nombre)}${location.codigo ? ` — ${esc(location.codigo)}` : ''}</option>`).join('');
        const state = item ? materialLocationState(item) : {};
        if (state.location) $('assign-location').value = state.location.id;
        fillAssignSequences(state.consecutive || 1);
        openModal('assign-modal');
    }

    function fillAssignSequences(selectedSequence = 1) {
        const location = currentLocations().find(item => Number(item.id) === Number($('assign-location').value));
        const max = capacity(location);
        const options = [];
        for (let sequence = 1; sequence <= max; sequence += 1) {
            const occupants = location ? materialsInPosition(location.id, sequence, assigningCode) : [];
            const full = occupants.length >= MAX_MATERIALS_PER_POSITION;
            options.push(`<option value="${sequence}" ${full ? 'disabled' : ''}>Posición ${sequence} — ${occupants.length}/${MAX_MATERIALS_PER_POSITION} materiales</option>`);
        }
        $('assign-consecutive').innerHTML = options.join('');
        const available = options.length ? Math.min(Math.max(Number(selectedSequence) || 1, 1), max) : 1;
        $('assign-consecutive').value = String(available);
        if ($('assign-consecutive').selectedOptions[0]?.disabled) {
            const firstEnabled = [...$('assign-consecutive').options].find(option => !option.disabled);
            if (firstEnabled) $('assign-consecutive').value = firstEnabled.value;
        }
    }

    function openWarehouse(id = 0) {
        const item = warehouses.find(row => Number(row.id) === Number(id));
        editingWarehouse = item?.nombre || '';
        $('warehouse-modal-title').textContent = item ? 'Editar almacén' : 'Nuevo almacén';
        $('wa-name').value = item?.nombre || '';
        $('wa-name').disabled = Boolean(item);
        $('wa-type').value = item?.tipo || '';
        $('wa-status').value = item?.estado || 'Activo';
        $('wa-address').value = item?.ubicacion || '';
        $('wa-manager').value = item?.encargado || '';
        $('wa-notes').value = item?.notas || '';
        openModal('warehouse-modal');
    }

    async function saveWarehouse() {
        const payload = {
            nombre: text($('wa-name').value),
            tipo: text($('wa-type').value),
            estado: $('wa-status').value,
            ubicacion: text($('wa-address').value),
            encargado: text($('wa-manager').value),
            notas: text($('wa-notes').value)
        };
        if (!payload.nombre) return showToast('Escribe el nombre del almacén.', true);
        try {
            await SkilledDB.saveWarehouse(payload, editingWarehouse);
            closeModal('warehouse-modal');
            await loadAll();
            showToast('Almacén guardado correctamente.');
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function openLocation(id = 0) {
        const warehouse = currentWarehouse();
        if (!warehouse) return showToast('Selecciona un almacén.', true);
        const item = locations.find(row => Number(row.id) === Number(id));
        editingLocation = Number(item?.id || 0);
        $('location-modal-title').textContent = item ? 'Editar zona y piso' : 'Nueva zona y piso';
        $('location-help').textContent = `Almacén: ${warehouse.nombre}`;
        $('loc-name').value = item?.nombre || '';
        $('loc-code').value = item?.codigo || '';
        $('loc-type').value = item?.tipo || 'Rack';
        $('loc-status').value = item?.estado || 'Activo';
        $('loc-capacity').value = capacity(item);
        $('loc-note').value = item?.nota || '';
        openModal('location-modal');
    }

    async function saveLocation() {
        const parsed = parseBaseCode($('loc-code').value);
        const payload = {
            almacenId: selectedWarehouse,
            nombre: text($('loc-name').value),
            codigo: parsed?.codigo || '',
            tipo: $('loc-type').value,
            estado: $('loc-status').value,
            filas: 1,
            columnas: $('loc-capacity').value,
            nota: text($('loc-note').value)
        };
        if (!payload.nombre) return showToast('Escribe el nombre de la ubicación.', true);
        if (!parsed) return showToast('Usa el código base RR-Z-P, por ejemplo 01-1-A. El rack debe estar entre 01 y 20.', true);
        if (!Number.isInteger(Number(payload.columnas)) || Number(payload.columnas) < 1) return showToast('La cantidad de posiciones debe ser un número entero mayor que cero.', true);
        try {
            await SkilledDB.saveWarehouseLocation(payload, editingLocation);
            closeModal('location-modal');
            await loadAll();
            showToast('Zona y piso guardados correctamente.');
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function populateFloorOptions() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const options = letters.map(letter => `<option value="${letter}">${letter}</option>`).join('');
        $('structure-floor-start').innerHTML = options;
        $('structure-floor-end').innerHTML = options;
        $('structure-floor-start').value = 'A';
        $('structure-floor-end').value = 'F';
    }

    function structureValues() {
        const rackStart = Math.max(1, Math.min(20, Number($('structure-rack-start').value) || 1));
        const rackEnd = Math.max(rackStart, Math.min(20, Number($('structure-rack-end').value) || rackStart));
        const zoneStart = Math.max(1, Math.trunc(Number($('structure-zone-start').value) || 1));
        const zoneEnd = Math.max(zoneStart, Math.trunc(Number($('structure-zone-end').value) || zoneStart));
        const floorStart = $('structure-floor-start').value || 'A';
        const floorEnd = $('structure-floor-end').value || floorStart;
        const floorA = floorStart.charCodeAt(0);
        const floorB = Math.max(floorA, floorEnd.charCodeAt(0));
        const capacityValue = Math.max(1, Math.trunc(Number($('structure-capacity').value) || 20));
        return { rackStart, rackEnd, zoneStart, zoneEnd, floorStart, floorA, floorB, capacityValue };
    }

    function updateStructurePreview() {
        const values = structureValues();
        const count = (values.rackEnd - values.rackStart + 1) * (values.zoneEnd - values.zoneStart + 1) * (values.floorB - values.floorA + 1);
        const first = `${String(values.rackStart).padStart(2, '0')}-${values.zoneStart}-${values.floorStart}`;
        const last = `${String(values.rackEnd).padStart(2, '0')}-${values.zoneEnd}-${String.fromCharCode(values.floorB)}`;
        $('structure-preview').innerHTML = `Se crearán o actualizarán <strong class="text-white">${count}</strong> combinaciones de rack, zona y piso: desde <strong class="font-mono text-blue-300">${first}</strong> hasta <strong class="font-mono text-blue-300">${last}</strong>. Cada piso tendrá posiciones físicas del <strong class="text-white">1 al ${values.capacityValue}</strong>. Cada posición admite hasta ${MAX_MATERIALS_PER_POSITION} tipos de material. El piso A es el nivel superior.`;
    }

    function openStructure() {
        const warehouse = currentWarehouse();
        if (!warehouse) return showToast('Selecciona un almacén.', true);
        $('structure-help').textContent = `Almacén: ${warehouse.nombre}`;
        populateFloorOptions();
        updateStructurePreview();
        openModal('structure-modal');
    }

    async function saveStructure() {
        const values = structureValues();
        const prefix = text($('structure-name-prefix').value) || 'Rack';
        const structureCount = (values.rackEnd - values.rackStart + 1) * (values.zoneEnd - values.zoneStart + 1) * (values.floorB - values.floorA + 1);
        if (structureCount > 5000) return showToast('La generación está limitada a 5,000 combinaciones por operación. Divide el proceso en varios bloques.', true);
        const rows = [];
        for (let rack = values.rackStart; rack <= values.rackEnd; rack += 1) {
            for (let zone = values.zoneStart; zone <= values.zoneEnd; zone += 1) {
                for (let floor = values.floorA; floor <= values.floorB; floor += 1) {
                    const rackCode = String(rack).padStart(2, '0');
                    const letter = String.fromCharCode(floor);
                    rows.push({
                        almacenId: selectedWarehouse,
                        nombre: `${prefix} ${rackCode} · Zona ${zone} · Piso ${letter}`,
                        codigo: `${rackCode}-${zone}-${letter}`,
                        tipo: 'Rack',
                        estado: 'Activo',
                        filas: 1,
                        columnas: values.capacityValue,
                        nota: `Piso ${letter} contado de arriba hacia abajo. Posiciones 1-${values.capacityValue}. Hasta ${MAX_MATERIALS_PER_POSITION} tipos de material por posición.`
                    });
                }
            }
        }
        if (rows.length > 1000) return showToast('La generación supera 1,000 combinaciones. Divide el proceso en varios rangos.', true);
        const button = $('save-structure');
        const previous = button.textContent;
        button.disabled = true;
        button.textContent = `Generando ${rows.length}...`;
        try {
            const result = await SkilledDB.saveWarehouseLocationsBulk(rows, {
                onProgress(progress) {
                    const percent = progress.total ? Math.round((progress.processed / progress.total) * 100) : 0;
                    button.textContent = progress.stage === 'loading'
                        ? 'Revisando estructura...'
                        : `Generando ${progress.processed}/${progress.total} · ${percent}%`;
                }
            });
            closeModal('structure-modal');
            await loadAll();
            const parts = [];
            if (result.inserted) parts.push(`${result.inserted} nuevas`);
            if (result.updated) parts.push(`${result.updated} actualizadas`);
            if (result.unchanged) parts.push(`${result.unchanged} sin cambios`);
            showToast(`Estructura lista: ${parts.join(', ') || `${rows.length} ubicaciones revisadas`}.`);
        } catch (error) {
            showToast(error.message, true);
        } finally {
            button.disabled = false;
            button.textContent = previous;
        }
    }

    async function removeRack(rackNumber) {
        const rack = Math.trunc(Number(rackNumber));
        const warehouse = currentWarehouse();
        if (!warehouse || rack < 1 || rack > 20) return;
        const rackCode = String(rack).padStart(2, '0');
        const rackLocations = currentLocations().filter(location => parseBaseCode(location.codigo)?.rack === rack);
        const assigned = inventory.filter(item => {
            const parsed = parseFinalCode(item.ubicacion);
            return parsed?.rack === rack;
        });
        const message = assigned.length
            ? `¿Eliminar el RACK ${rackCode} completo? Se eliminarán ${rackLocations.length} combinaciones de zona/piso y ${assigned.length} material(es) quedarán sin ubicación específica.`
            : `¿Eliminar el RACK ${rackCode} completo? Se eliminarán ${rackLocations.length} combinaciones de zona/piso.`;
        if (!confirm(message)) return;
        try {
            const result = await SkilledDB.deleteWarehouseRack(selectedWarehouse, rack);
            if (selectedRack === rack) { selectedRack = 0; selectedZone = 0; }
            await loadAll();
            showToast(`Rack ${rackCode} eliminado. ${result.materialsCleared ? `${result.materialsCleared} material(es) quedaron pendientes de reubicación.` : ''}`);
        } catch (error) {
            showToast(error.message, true);
        }
    }

    async function removeWarehouse(id) {
        const item = warehouses.find(row => Number(row.id) === Number(id));
        if (!item || !confirm(`¿Eliminar ${item.nombre}?`)) return;
        try {
            await SkilledDB.deleteWarehouse(item.nombre);
            await loadAll();
            showToast('Almacén eliminado.');
        } catch (error) {
            showToast(error.message, true);
        }
    }

    async function removeLocation(id) {
        const item = locations.find(row => Number(row.id) === Number(id));
        if (!item || !confirm(`¿Eliminar ${item.nombre}? Los materiales conservarán el texto hasta que los reubiques.`)) return;
        try {
            await SkilledDB.deleteWarehouseLocation(id);
            await loadAll();
            showToast('Ubicación eliminada.');
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function getQrPositionData(locationId, sequence) {
        const location = locations.find(row => Number(row.id) === Number(locationId));
        const warehouse = currentWarehouse();
        if (!location || !warehouse) return null;
        const position = slotValue(location, Number(sequence));
        const materials = materialsInPosition(location.id, Number(sequence)).slice(0, MAX_MATERIALS_PER_POSITION);
        return { warehouse, location, sequence:Number(sequence), position, materials, value:`SKILLED|UBICACION|${position}` };
    }

    function printQrPosition(locationId, sequence) {
        const data = getQrPositionData(locationId, sequence);
        if (!data) return;
        const base = parseBaseCode(data.location.codigo) || {};
        $('qr-title').textContent = data.position;
        $('qr-subtitle').textContent = `${data.warehouse.nombre} · Rack ${String(base.rack || '').padStart(2, '0')} · Zona ${base.zona || ''} · Piso ${base.piso || ''}`;
        $('qr-code').textContent = 'Posición física de almacén';
        $('qr-material-count').textContent = `${data.materials.length}/${MAX_MATERIALS_PER_POSITION} materiales`;
        $('qr-materials').innerHTML = data.materials.length
            ? data.materials.map(item => `<div><strong>${esc(item.codigo)}</strong><span>${esc(item.descripcion || item.codigo)}</span></div>`).join('')
            : '<div class="qr-empty">Posición libre</div>';
        $('qr-container').innerHTML = '';
        new QRCode($('qr-container'), { text: data.value, width: 170, height: 170, colorDark:'#00416B', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.M });
        const printButton = $('print-single-qr');
        if (printButton) printButton.onclick = () => printQrBatch([data]);
        openModal('qr-modal');
    }

    function updateQrSelectionButton(){
        const btn=document.querySelector('[data-print-selected-qr]');
        if(btn){btn.disabled=!selectedQrPositions.size;btn.textContent=`Imprimir seleccionados (${selectedQrPositions.size})`;}
    }

    function selectVisibleQr(){
        document.querySelectorAll('[data-select-qr-position]').forEach(input=>{
            input.checked=true;
            selectedQrPositions.set(`${input.dataset.selectQrPosition}:${input.dataset.selectQrSequence}`,{locationId:input.dataset.selectQrPosition,sequence:Number(input.dataset.selectQrSequence)});
        });
        updateQrSelectionButton();
    }

    function clearQrSelection(){selectedQrPositions.clear();document.querySelectorAll('[data-select-qr-position]').forEach(input=>input.checked=false);updateQrSelectionButton();}

    function buildRackPrintLabel(data,index){
        const base = parseBaseCode(data.location.codigo) || {};
        const wrap = document.createElement('section');
        wrap.className = 'rack-print-label';
        wrap.dataset.index = String(index);
        wrap.innerHTML = `<div class="rack-print-left"><img src="logo-reporte.png" class="rack-print-logo" alt="Skilled"><span class="rack-print-kicker">UBICACIÓN DE ALMACÉN</span><div class="rack-print-position">${esc(data.position)}</div><div class="rack-print-mini">Posición física</div><div class="rack-print-qr"></div></div><div class="rack-print-right"><div class="rack-print-meta">${esc(data.warehouse.nombre)} · Rack ${esc(String(base.rack||'').padStart(2,'0'))} · Zona ${esc(base.zona||'')} · Piso ${esc(base.piso||'')}</div><div class="rack-print-count">${data.materials.length}/${MAX_MATERIALS_PER_POSITION} materiales</div><div class="rack-print-materials">${data.materials.length ? data.materials.map(item=>`<div class="rack-print-material"><b>${esc(item.codigo)}</b><span>${esc(item.descripcion||item.codigo)}</span></div>`).join('') : '<div class="rack-print-empty">Posición libre</div>'}</div></div>`;
        return wrap;
    }

    function qrDataUrl(value){
        return new Promise((resolve,reject)=>{
            const host=document.createElement('div');
            host.style.cssText='position:fixed;left:-9999px;top:-9999px;width:320px;height:320px;background:#fff';
            document.body.appendChild(host);
            try{
                new QRCode(host,{text:value,width:300,height:300,colorDark:'#00416B',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
                setTimeout(()=>{
                    try{
                        const canvas=host.querySelector('canvas');
                        const image=host.querySelector('img');
                        const url=canvas?.toDataURL('image/png')||image?.src||'';
                        host.remove();
                        if(!url) reject(new Error('No se pudo generar el QR de la ubicación.'));
                        else resolve(url);
                    }catch(error){host.remove();reject(error)}
                },80);
            }catch(error){host.remove();reject(error)}
        });
    }

    function rackPrintLabelHtml(data,qr,slot){
        const base=parseBaseCode(data.location.codigo)||{};
        const materials=data.materials.length
            ? data.materials.slice(0,MAX_MATERIALS_PER_POSITION).map(item=>`<div class="material"><b>${esc(item.codigo)}</b><span>${esc(item.descripcion||item.codigo)}</span></div>`).join('')
            : '<div class="empty">Posición libre</div>';
        return `<article class="label" style="--slot:${slot}"><aside class="side"><img src="${new URL('logo-reporte.png',location.href).href}" alt="Skilled" class="logo"><strong class="kicker">UBICACIÓN DE ALMACÉN</strong><h1>${esc(data.position)}</h1><p class="side-note">Posición física</p><div class="qr"><img src="${qr}" alt="QR ${esc(data.position)}"></div></aside><section class="info"><div class="meta-row"><p class="meta">${esc(data.warehouse.nombre)} · Rack ${esc(String(base.rack||'').padStart(2,'0'))} · Zona ${esc(base.zona||'')} · Piso ${esc(base.piso||'')}</p><strong class="count">${data.materials.length}/${MAX_MATERIALS_PER_POSITION} materiales</strong></div><div class="materials">${materials}</div></section></article>`;
    }

    async function printQrBatch(items){
        const valid=(items||[]).filter(Boolean);
        if(!valid.length)return showToast('Selecciona al menos una posición para imprimir.',true);
        const prepared=[];
        for(const data of valid) prepared.push({data,qr:await qrDataUrl(data.value)});
        const sheets=[];
        for(let i=0;i<prepared.length;i+=5){
            const labels=prepared.slice(i,i+5).map((item,slot)=>rackPrintLabelHtml(item.data,item.qr,slot)).join('');
            sheets.push(`<section class="sheet">${labels}</section>`);
        }
        const frame=document.createElement('iframe');
        frame.setAttribute('aria-hidden','true');
        frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
        document.body.appendChild(frame);
        const doc=frame.contentDocument;
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas de ubicaciones</title><style>
            *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#102a43;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            @page{size:Letter portrait;margin:0}
            .sheet{position:relative;width:215.9mm;height:279.4mm;overflow:hidden;break-after:page;page-break-after:always;background:#fff}
            .sheet:last-child{break-after:auto;page-break-after:auto}
            .label{position:absolute;left:15.45mm;top:calc(9.7mm + (var(--slot) * 52mm));width:185mm;height:50mm;overflow:hidden;border:.45mm solid #00416b;background:#fff;padding:2.8mm 3.4mm;display:grid;grid-template-columns:42mm minmax(0,1fr);gap:2.6mm;break-inside:avoid;page-break-inside:avoid}
            .side{display:flex;flex-direction:column;gap:1.1mm;padding-right:2.6mm;border-right:.45mm solid #00416b;min-width:0}.logo{width:31mm;max-height:7.5mm;object-fit:contain}.kicker{font-size:5.8pt;color:#00416b;letter-spacing:.14em;line-height:1.1}.side h1{font-size:16pt;line-height:1;margin:.4mm 0 0;font-weight:900}.side-note{font-size:6.7pt;color:#5f7389;margin:0}.qr{margin-top:auto;display:flex;align-items:center;justify-content:center}.qr img{width:29mm;height:29mm;display:block}
            .info{min-width:0;display:flex;flex-direction:column}.meta-row{display:flex;align-items:flex-start;justify-content:space-between;gap:2mm;border-bottom:.45mm solid #00416b;padding-bottom:1.1mm}.meta{font-size:7pt;line-height:1.25;color:#32506a;margin:0;font-weight:700}.count{font-size:6.5pt;color:#00416b;white-space:nowrap}.materials{display:flex;flex-direction:column;gap:.15mm;margin-top:1.2mm}.material{display:grid;grid-template-columns:31mm minmax(0,1fr);gap:1mm;align-items:start;font-size:7.2pt;line-height:1.15;padding:.45mm 0;border-bottom:.15mm solid #dbe3ec;min-width:0}.material b{font-family:monospace;color:#00416b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.material span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.empty{font-size:7pt;color:#6b7280;margin-top:2mm}
            @media screen{body{background:#eef2f7}.sheet{margin:8px auto;box-shadow:0 1px 9px rgba(0,0,0,.18)}}
        </style></head><body>${sheets.join('')}</body></html>`);
        doc.close();
        await new Promise(resolve=>setTimeout(resolve,250));
        const cleanup=()=>setTimeout(()=>frame.remove(),800);
        frame.contentWindow.addEventListener('afterprint',cleanup,{once:true});
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setTimeout(()=>{if(document.body.contains(frame))frame.remove()},120000);
    }

    function printSelectedQr(){
        const data=[...selectedQrPositions.values()].map(item=>getQrPositionData(item.locationId,item.sequence)).filter(Boolean);
        printQrBatch(data);
    }

    document.addEventListener('click', async event => {
        const warehouseCard = event.target.closest('[data-warehouse]');
        if (warehouseCard && !event.target.closest('button')) {
            selectedWarehouse = Number(warehouseCard.dataset.warehouse);
            selectedRack = 0;
            selectedZone = 0;
            await loadInventory();
            renderAll();
        }
        const editWarehouse = event.target.closest('[data-edit-warehouse]');
        if (editWarehouse) openWarehouse(editWarehouse.dataset.editWarehouse);
        const deleteWarehouse = event.target.closest('[data-delete-warehouse]');
        if (deleteWarehouse) removeWarehouse(deleteWarehouse.dataset.deleteWarehouse);
        const editLocation = event.target.closest('[data-edit-location]');
        if (editLocation) openLocation(editLocation.dataset.editLocation);
        const deleteLocation = event.target.closest('[data-delete-location]');
        if (deleteLocation) removeLocation(deleteLocation.dataset.deleteLocation);
        const selectRack = event.target.closest('[data-select-rack]');
        if (selectRack) {
            selectedRack = Number(selectRack.dataset.selectRack);
            selectedZone = 0;
            renderVisual();
        }
        const rackStep = event.target.closest('[data-rack-step]');
        if (rackStep && rackStep.dataset.rackStep) {
            selectedRack = Number(rackStep.dataset.rackStep);
            selectedZone = 0;
            renderVisual();
        }
        const selectZone = event.target.closest('[data-select-zone]');
        if (selectZone) {
            selectedZone = Number(selectZone.dataset.selectZone);
            renderVisual();
        }
        const deleteRack = event.target.closest('[data-delete-rack]');
        if (deleteRack) removeRack(deleteRack.dataset.deleteRack);
        const selectQr = event.target.closest('[data-select-qr-position]');
        if (selectQr) { const key=`${selectQr.dataset.selectQrPosition}:${selectQr.dataset.selectQrSequence}`; if(selectQr.checked) selectedQrPositions.set(key,{locationId:selectQr.dataset.selectQrPosition,sequence:Number(selectQr.dataset.selectQrSequence)}); else selectedQrPositions.delete(key); updateQrSelectionButton(); }
        if (event.target.closest('[data-select-visible-qr]')) selectVisibleQr();
        if (event.target.closest('[data-clear-qr]')) clearQrSelection();
        if (event.target.closest('[data-print-selected-qr]')) printSelectedQr();
        const qr = event.target.closest('[data-qr-position]');
        if (qr) printQrPosition(qr.dataset.qrPosition, Number(qr.dataset.qrSequence));
        const assign = event.target.closest('[data-assign-code]');
        if (assign) {
            event.preventDefault();
            event.stopPropagation();
            openAssign(assign.dataset.assignCode);
        }
        if (event.target.id === 'first-location') openLocation();
        const close = event.target.closest('[data-close]');
        if (close) closeModal(close.dataset.close);
    });

    $('new-warehouse').addEventListener('click', () => openWarehouse());
    $('new-location').addEventListener('click', () => openLocation());
    $('generate-structure').addEventListener('click', openStructure);
    $('save-warehouse').addEventListener('click', saveWarehouse);
    $('save-location').addEventListener('click', saveLocation);
    $('save-structure').addEventListener('click', saveStructure);
    ['structure-rack-start', 'structure-rack-end', 'structure-zone-start', 'structure-zone-end', 'structure-floor-start', 'structure-floor-end', 'structure-capacity'].forEach(id => $(id).addEventListener('input', updateStructurePreview));
    $('refresh').addEventListener('click', loadAll);
    $('table-tab').addEventListener('click', () => { view = 'table'; renderWorkspace(); });
    $('visual-tab').addEventListener('click', () => { view = 'visual'; renderWorkspace(); });
    $('material-filter').addEventListener('input', renderVisual);
    $('assign-location').addEventListener('change', () => fillAssignSequences());
    $('confirm-assignment').addEventListener('click', async () => {
        const location = currentLocations().find(item => Number(item.id) === Number($('assign-location').value));
        if (!location) return showToast('Selecciona una ubicación.', true);
        const sequence = Number($('assign-consecutive').value);
        if (!sequence) return showToast('Selecciona una posición disponible.', true);
        await assignLocation(assigningCode, location, sequence);
        closeModal('assign-modal');
    });
    $('clear-assignment').addEventListener('click', async () => {
        await clearLocation(assigningCode);
        closeModal('assign-modal');
    });

    loadAll();
}());
