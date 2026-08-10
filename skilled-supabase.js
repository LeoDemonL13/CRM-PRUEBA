
(function () {
    'use strict';

    const SUPABASE_URL = 'https://cuxnzqbszzrfnrinxbdp.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_eAnp6imD2nOqrtL_A-xrSA_p-bmoLQF';

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('No se pudo cargar la librería de Supabase.');
    }

    const client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    window.skilledSupabase = client;

    function text(value) {
        return String(value ?? '').trim();
    }

    function number(value) {
        if (typeof value === 'string') {
            value = value.replace(/[$,\s]/g, '');
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function lower(value) {
        return text(value).toLocaleLowerCase('es-MX');
    }

    function normalizeStockLevels(minimumValue, mediumValue, maximumValue) {
        const minimum = Math.max(0, number(minimumValue));
        let maximum = Math.max(0, number(maximumValue));
        if (maximum <= 0) maximum = minimum > 0 ? minimum * 2 : 1;
        if (maximum < minimum) maximum = minimum;
        let medium = Math.max(0, number(mediumValue));
        if (medium <= 0) medium = (minimum + maximum) / 2;
        medium = Math.min(maximum, Math.max(minimum, medium));
        return { minimum, medium, maximum };
    }

    function boolean(value) {
        if (typeof value === 'boolean') return value;
        return ['true', '1', 'si', 'sí', 'yes'].includes(lower(value));
    }

    function parseWarehouseLocationCode(value) {
        const raw = text(value).toUpperCase().replace(/\s+/g, '');
        const match = raw.match(/^(\d{2})-([1-9]\d*)-([A-Z])([1-9]\d*)$/);
        if (!match) return null;
        const rack = Number(match[1]);
        const zone = Number(match[2]);
        const floor = match[3];
        const sequence = Number(match[4]);
        if (rack < 1 || rack > 20 || zone < 1 || sequence < 1) return null;
        const rackCode = String(rack).padStart(2, '0');
        return {
            codigo: `${rackCode}-${zone}-${floor}${sequence}`,
            base: `${rackCode}-${zone}-${floor}`,
            rack,
            zona: zone,
            piso: floor,
            consecutivo: sequence
        };
    }

    function normalizeWarehouseLocationCode(value) {
        const parsed = parseWarehouseLocationCode(value);
        return parsed ? parsed.codigo : '';
    }

    function validateWarehouseLocationAgainstStructure(value, warehouseId, locations = []) {
        const raw = text(value);
        if (!raw) return { ok: true, codigo: '', parsed: null, location: null };
        const parsed = parseWarehouseLocationCode(raw);
        if (!parsed) {
            return {
                ok: false,
                error: 'La ubicación debe usar el formato RR-Z-PISO+CONSECUTIVO, por ejemplo 01-1-A1.'
            };
        }
        const location = (Array.isArray(locations) ? locations : []).find(item =>
            Number(item.almacen_id ?? item.almacenId) === Number(warehouseId) &&
            lower(item.codigo) === lower(parsed.base)
        );
        if (!location) {
            return {
                ok: false,
                error: `No existe la estructura ${parsed.base} en el almacén seleccionado.`
            };
        }
        const capacity = Math.max(1, number(location.columnas ?? location.capacidadConsecutivos) || 1);
        if (parsed.consecutivo > capacity) {
            return {
                ok: false,
                error: `${parsed.base} admite consecutivos del 1 al ${capacity}.`
            };
        }
        return { ok: true, codigo: parsed.codigo, parsed, location };
    }

    function errorMessage(error) {
        if (!error) return 'Error desconocido en Supabase.';
        return error.message || error.details || error.hint || String(error);
    }

    function assertNoError(error, fallback) {
        if (error) throw new Error(errorMessage(error) || fallback);
    }

    async function collectRows(builderFactory, pageSize = 1000) {
        const rows = [];
        let from = 0;

        while (true) {
            const { data, error } = await builderFactory().range(from, from + pageSize - 1);
            assertNoError(error);
            const page = Array.isArray(data) ? data : [];
            rows.push(...page);
            if (page.length < pageSize) break;
            from += pageSize;
        }

        return rows;
    }

    function warehouseFromDb(row) {
        return {
            id: Number(row.id),
            nombre: text(row.nombre),
            tipo: text(row.tipo),
            ubicacion: text(row.ubicacion),
            encargado: text(row.encargado),
            estado: text(row.estado) || 'Activo',
            notas: text(row.notas)
        };
    }

    async function listWarehouses(options = {}) {
        const activeOnly = options.activeOnly === true;
        const rows = await collectRows(() => {
            let query = client.from('almacenes').select('*').order('nombre', { ascending: true });
            if (activeOnly) query = query.eq('estado', 'Activo');
            return query;
        });
        return rows.map(warehouseFromDb);
    }

    async function saveWarehouse(warehouse, originalName = '') {
        const row = {
            nombre: text(warehouse.nombre),
            tipo: text(warehouse.tipo) || null,
            ubicacion: text(warehouse.ubicacion) || null,
            encargado: text(warehouse.encargado) || null,
            estado: text(warehouse.estado) || 'Activo',
            notas: text(warehouse.notas) || null,
            updated_at: new Date().toISOString()
        };
        if (!row.nombre) throw new Error('El nombre del almacén es obligatorio.');

        const original = text(originalName);
        if (original) {
            const { error } = await client.from('almacenes').update(row).eq('nombre', original);
            assertNoError(error, 'No se pudo actualizar el almacén.');
        } else {
            const { error } = await client.from('almacenes').insert(row);
            assertNoError(error, 'No se pudo crear el almacén.');
        }
        return { ok: true, nombre: row.nombre };
    }

    async function deleteWarehouse(name) {
        const nombre = text(name);
        if (!nombre) throw new Error('Falta el nombre del almacén.');

        const { data: warehouse, error: warehouseError } = await client
            .from('almacenes')
            .select('id,nombre')
            .eq('nombre', nombre)
            .maybeSingle();
        assertNoError(warehouseError);
        if (!warehouse) return { ok: true, nombre };

        const { count, error: countError } = await client
            .from('existencias_almacen')
            .select('id', { count: 'exact', head: true })
            .eq('almacen_id', warehouse.id);
        assertNoError(countError);
        if ((count || 0) > 0) {
            throw new Error('Este almacén tiene materiales asignados. Cámbialo a Inactivo en lugar de eliminarlo.');
        }

        const { error } = await client.from('almacenes').delete().eq('id', warehouse.id);
        assertNoError(error, 'No se pudo eliminar el almacén.');
        return { ok: true, nombre };
    }

    function warehouseLocationFromDb(row, warehouseById = new Map()) {
        const warehouse = warehouseById.get(Number(row.almacen_id)) || {};
        return {
            id: Number(row.id),
            almacenId: Number(row.almacen_id),
            almacenNombre: text(warehouse.nombre),
            nombre: text(row.nombre),
            codigo: text(row.codigo),
            tipo: text(row.tipo) || 'Estante',
            nota: text(row.nota),
            filas: Math.max(1, number(row.filas) || 1),
            columnas: Math.max(1, number(row.columnas) || 1),
            estado: text(row.estado) || 'Activo',
            etiqueta: [text(row.codigo), text(row.nombre)].filter(Boolean).join(' — ') || text(row.nombre)
        };
    }

    async function listWarehouseLocations(options = {}) {
        const warehouseId = Number(options.almacenId ?? options.warehouseId ?? 0);
        const activeOnly = options.activeOnly === true;
        let query = client
            .from('ubicaciones_almacen')
            .select('*')
            .order('nombre', { ascending: true });
        if (warehouseId) query = query.eq('almacen_id', warehouseId);
        if (activeOnly) query = query.eq('estado', 'Activo');
        const { data, error } = await query;
        assertNoError(error, 'No se pudieron consultar las ubicaciones del almacén.');
        const warehouses = await listWarehouses();
        const warehouseById = new Map(warehouses.map(row => [Number(row.id), row]));
        return (Array.isArray(data) ? data : []).map(row => warehouseLocationFromDb(row, warehouseById));
    }

    async function saveWarehouseLocation(location, originalId = 0) {
        const row = {
            almacen_id: Number(location.almacenId ?? location.warehouseId ?? 0),
            nombre: text(location.nombre),
            codigo: text(location.codigo) || null,
            tipo: text(location.tipo) || 'Estante',
            nota: text(location.nota) || null,
            filas: 1,
            columnas: Math.max(1, Math.trunc(number(location.columnas ?? location.capacidadConsecutivos) || 20)),
            estado: text(location.estado) || 'Activo',
            updated_at: new Date().toISOString()
        };
        if (!row.almacen_id) throw new Error('Selecciona el almacén de la ubicación.');
        if (!row.nombre) throw new Error('El nombre de la ubicación es obligatorio.');
        if (['rack', 'piso', 'zona'].includes(lower(row.tipo))) {
            const baseMatch = text(row.codigo).toUpperCase().match(/^(\d{2})-([1-9]\d*)-([A-Z])$/);
            if (!baseMatch || Number(baseMatch[1]) < 1 || Number(baseMatch[1]) > 20) {
                throw new Error('El código base debe usar RR-Z-P, por ejemplo 01-1-A, con rack del 01 al 20.');
            }
            row.codigo = `${baseMatch[1]}-${Number(baseMatch[2])}-${baseMatch[3]}`;
        }

        let data;
        let error;
        const id = Number(originalId || location.id || 0);
        if (id) {
            ({ data, error } = await client
                .from('ubicaciones_almacen')
                .update(row)
                .eq('id', id)
                .select('*')
                .single());
        } else {
            ({ data, error } = await client
                .from('ubicaciones_almacen')
                .insert(row)
                .select('*')
                .single());
        }
        if (error && error.code === '23505') {
            throw new Error('Ya existe una ubicación con ese nombre o código dentro del almacén.');
        }
        assertNoError(error, 'No se pudo guardar la ubicación del almacén.');
        const warehouse = (await listWarehouses()).find(item => Number(item.id) === row.almacen_id);
        return warehouseLocationFromDb(data, new Map(warehouse ? [[Number(warehouse.id), warehouse]] : []));
    }

    async function saveWarehouseLocationsBulk(items = [], options = {}) {
        const input = Array.isArray(items) ? items : [];
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
        if (!input.length) return { inserted: 0, updated: 0, unchanged: 0, total: 0 };
        const rows = input.map(item => ({
            almacen_id: Number(item.almacenId ?? item.warehouseId ?? 0),
            nombre: text(item.nombre),
            codigo: text(item.codigo).toUpperCase() || null,
            tipo: text(item.tipo) || 'Rack',
            nota: text(item.nota) || null,
            filas: 1,
            columnas: Math.max(1, Math.trunc(number(item.columnas ?? item.capacidadConsecutivos) || 20)),
            estado: text(item.estado) || 'Activo',
            updated_at: new Date().toISOString()
        }));
        rows.forEach(row => {
            if (!row.almacen_id) throw new Error('Falta el almacén en una ubicación.');
            if (!row.nombre || !row.codigo) throw new Error('Nombre y código son obligatorios para generar la estructura.');
            const baseMatch = row.codigo.match(/^(\d{2})-([1-9]\d*)-([A-Z])$/);
            if (!baseMatch || Number(baseMatch[1]) < 1 || Number(baseMatch[1]) > 20) {
                throw new Error(`El código base ${row.codigo} no cumple el formato RR-Z-P, por ejemplo 01-1-A.`);
            }
        });

        const byWarehouse = new Map();
        rows.forEach(row => {
            if (!byWarehouse.has(row.almacen_id)) byWarehouse.set(row.almacen_id, []);
            byWarehouse.get(row.almacen_id).push(row);
        });

        let inserted = 0;
        let updated = 0;
        let unchanged = 0;
        let processed = 0;
        const total = rows.length;
        const same = (existing, row) =>
            text(existing.nombre) === text(row.nombre) &&
            lower(existing.codigo) === lower(row.codigo) &&
            lower(existing.tipo) === lower(row.tipo) &&
            text(existing.nota) === text(row.nota) &&
            Math.max(1, Math.trunc(number(existing.columnas) || 1)) === row.columnas &&
            lower(existing.estado) === lower(row.estado);

        onProgress({ stage: 'loading', processed, total, inserted, updated, unchanged });

        for (const [warehouseId, warehouseRows] of byWarehouse.entries()) {
            const current = await listWarehouseLocations({ warehouseId });
            const existingByCode = new Map(current.map(item => [lower(item.codigo), item]));
            const toInsert = [];
            const toUpdate = [];
            let warehouseUnchanged = 0;

            warehouseRows.forEach(row => {
                const existing = existingByCode.get(lower(row.codigo));
                if (!existing) toInsert.push(row);
                else if (same(existing, row)) {
                    unchanged += 1;
                    warehouseUnchanged += 1;
                } else toUpdate.push({ id: existing.id, row });
            });

            processed += warehouseUnchanged;
            onProgress({ stage: 'saving', processed, total, inserted, updated, unchanged });

            const insertChunkSize = 250;
            for (let index = 0; index < toInsert.length; index += insertChunkSize) {
                const chunk = toInsert.slice(index, index + insertChunkSize);
                const { error } = await client.from('ubicaciones_almacen').insert(chunk);
                if (error?.code === '23505') {
                    for (const row of chunk) {
                        const { error: oneError } = await client.from('ubicaciones_almacen').insert(row);
                        if (oneError?.code === '23505') {
                            const { error: updateError } = await client
                                .from('ubicaciones_almacen')
                                .update(row)
                                .eq('almacen_id', row.almacen_id)
                                .eq('codigo', row.codigo);
                            assertNoError(updateError, `No se pudo actualizar ${row.codigo}.`);
                            updated += 1;
                        } else {
                            assertNoError(oneError, `No se pudo guardar ${row.codigo}.`);
                            inserted += 1;
                        }
                        processed += 1;
                        onProgress({ stage: 'saving', processed, total, inserted, updated, unchanged });
                    }
                } else {
                    assertNoError(error, 'No se pudo guardar el bloque de ubicaciones.');
                    inserted += chunk.length;
                    processed += chunk.length;
                    onProgress({ stage: 'saving', processed, total, inserted, updated, unchanged });
                }
            }

            const updateConcurrency = 12;
            for (let index = 0; index < toUpdate.length; index += updateConcurrency) {
                const chunk = toUpdate.slice(index, index + updateConcurrency);
                await Promise.all(chunk.map(async item => {
                    const { error } = await client
                        .from('ubicaciones_almacen')
                        .update(item.row)
                        .eq('id', item.id);
                    assertNoError(error, `No se pudo actualizar ${item.row.codigo}.`);
                }));
                updated += chunk.length;
                processed += chunk.length;
                onProgress({ stage: 'saving', processed, total, inserted, updated, unchanged });
            }
        }

        onProgress({ stage: 'done', processed: total, total, inserted, updated, unchanged });
        return { inserted, updated, unchanged, total };
    }

    async function deleteWarehouseRack(warehouseId, rackNumber) {
        const id = Number(warehouseId);
        const rack = Math.trunc(number(rackNumber));
        if (!id) throw new Error('Almacén no válido.');
        if (rack < 1 || rack > 20) throw new Error('El rack debe estar entre 01 y 20.');
        const rackCode = String(rack).padStart(2, '0');
        const pattern = `${rackCode}-%`;

        const { data: cleared, error: clearError } = await client
            .from('existencias_almacen')
            .update({ ubicacion: null })
            .eq('almacen_id', id)
            .like('ubicacion', pattern)
            .select('material_codigo');
        assertNoError(clearError, `No se pudieron liberar los materiales del rack ${rackCode}.`);

        const { data: removed, error: deleteError } = await client
            .from('ubicaciones_almacen')
            .delete()
            .eq('almacen_id', id)
            .like('codigo', pattern)
            .select('id');
        assertNoError(deleteError, `No se pudo eliminar el rack ${rackCode}.`);

        return {
            ok: true,
            rack: rackCode,
            materialsCleared: Array.isArray(cleared) ? cleared.length : 0,
            locationsDeleted: Array.isArray(removed) ? removed.length : 0
        };
    }

    async function deleteWarehouseLocation(id) {
        const locationId = Number(id);
        if (!locationId) throw new Error('Ubicación no válida.');
        const { error } = await client.from('ubicaciones_almacen').delete().eq('id', locationId);
        assertNoError(error, 'No se pudo eliminar la ubicación del almacén.');
        return { ok: true, id: locationId };
    }

    function materialFromDb(row, inventories = [], warehouseById = new Map()) {
        const imagen = text(row.imagen_url);
        const descripcion = text(row.descripcion);
        const warehouses = inventories.map(inv => {
            const warehouse = warehouseById.get(Number(inv.almacen_id)) || {};
            const levels = normalizeStockLevels(inv.stock_minimo, inv.stock_medio, inv.stock_maximo);
            return {
                id: Number(inv.almacen_id),
                nombre: text(warehouse.nombre),
                tipo: text(warehouse.tipo),
                estado: text(warehouse.estado),
                ubicacionAlmacen: text(warehouse.ubicacion),
                stock: number(inv.stock),
                stockMinimo: levels.minimum,
                stock_minimo: levels.minimum,
                stockMedio: levels.medium,
                stock_medio: levels.medium,
                stockMaximo: levels.maximum,
                stock_maximo: levels.maximum,
                ubicacion: text(inv.ubicacion)
            };
        }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        const totalStock = warehouses.length
            ? warehouses.reduce((sum, item) => sum + number(item.stock), 0)
            : number(row.stock);
        const fallbackLevels = normalizeStockLevels(row.stock_minimo, row.stock_medio, row.stock_maximo);
        const totalMinimum = warehouses.length
            ? warehouses.reduce((sum, item) => sum + number(item.stockMinimo), 0)
            : fallbackLevels.minimum;
        const totalMedium = warehouses.length
            ? warehouses.reduce((sum, item) => sum + number(item.stockMedio), 0)
            : fallbackLevels.medium;
        const totalMaximum = warehouses.length
            ? warehouses.reduce((sum, item) => sum + number(item.stockMaximo), 0)
            : fallbackLevels.maximum;
        const firstWarehouse = warehouses[0] || null;

        return {
            codigo: text(row.codigo),
            descripcion,
            desc: descripcion,
            categoria: text(row.categoria),
            tipoCable: text(row.tipo_cable),
            tipo_cable: text(row.tipo_cable),
            tamano: text(row.tamano_mm2),
            tamano_mm2: text(row.tamano_mm2),
            unidad: text(row.unidad),
            stock: totalStock,
            stockMinimo: totalMinimum,
            stock_minimo: totalMinimum,
            stockMedio: totalMedium,
            stock_medio: totalMedium,
            stockMaximo: totalMaximum,
            stock_maximo: totalMaximum,
            precio: number(row.precio),
            marca: text(row.marca),
            proveedor: text(row.proveedor),
            contactoProveedor: text(row.contacto_proveedor),
            contacto_proveedor: text(row.contacto_proveedor),
            modismos: Array.isArray(row.modismos) ? row.modismos.map(text).filter(Boolean) : text(row.modismos).split(/[,;\n]+/).map(text).filter(Boolean),
            imagen,
            urlImagen: imagen,
            imagen_url: imagen,
            almacenes: warehouses,
            almacenId: firstWarehouse ? firstWarehouse.id : null,
            almacenNombre: firstWarehouse ? firstWarehouse.nombre : '',
            almacen: firstWarehouse ? firstWarehouse.nombre : '',
            esIncompleto: boolean(row.es_incompleto),
            es_incompleto: boolean(row.es_incompleto),
            origenAlta: text(row.origen_alta),
            origen_alta: text(row.origen_alta),
            camposPendientes: Array.isArray(row.campos_pendientes) ? row.campos_pendientes : [],
            campos_pendientes: Array.isArray(row.campos_pendientes) ? row.campos_pendientes : [],
            activo: row.activo !== false
        };
    }

    function materialToDb(material) {
        const categoria = text(material.categoria);
        const unidad = text(material.unidad);
        const precio = number(material.precio);
        const imagen = text(material.imagen ?? material.urlImagen ?? material.imagen_url);
        const pendientes = [];
        if (!categoria) pendientes.push('categoria');
        if (!unidad) pendientes.push('unidad');
        if (precio <= 0) pendientes.push('precio');
        if (!imagen) pendientes.push('imagen');
        return {
            codigo: text(material.codigo),
            descripcion: text(material.descripcion ?? material.desc),
            categoria: categoria || null,
            tipo_cable: text(material.tipoCable ?? material.tipo_cable) || null,
            tamano_mm2: text(material.tamano ?? material.tamano_mm2) || null,
            unidad: unidad || null,
            precio,
            marca: text(material.marca) || null,
            proveedor: text(material.proveedor) || null,
            contacto_proveedor: text(material.contactoProveedor ?? material.contacto_proveedor) || null,
            modismos: Array.isArray(material.modismos)
                ? material.modismos.map(text).filter(Boolean)
                : text(material.modismos ?? material.modismosTexto).split(/[,;\n]+/).map(text).filter(Boolean),
            imagen_url: imagen || null,
            es_incompleto: pendientes.length > 0,
            origen_alta: text(material.origenAlta ?? material.origen_alta) || null,
            campos_pendientes: pendientes,
            activo: material.activo !== false,
            updated_at: new Date().toISOString()
        };
    }

    function matchesMaterial(material, query) {
        const values = [
            material?.codigo,
            material?.descripcion,
            material?.desc,
            material?.categoria,
            material?.unidad,
            material?.tipoCable,
            material?.tipo_cable,
            material?.tamano,
            material?.tamano_mm2,
            material?.marca,
            material?.proveedor,
            material?.contactoProveedor,
            material?.contacto_proveedor,
            ...(Array.isArray(material?.modismos) ? material.modismos : [])
        ];
        if (window.SkilledSearch?.matches) return window.SkilledSearch.matches(values, query);
        const value = lower(query);
        if (!value) return true;
        return values.some(item => lower(item).includes(value));
    }

    async function loadInventoryContext() {
        const [warehouses, inventories] = await Promise.all([
            collectRows(() => client.from('almacenes').select('*').order('nombre', { ascending: true })),
            collectRows(() => client.from('existencias_almacen').select('*').order('id', { ascending: true }))
        ]);
        const warehouseById = new Map(warehouses.map(row => [Number(row.id), warehouseFromDb(row)]));
        const inventoriesByMaterial = new Map();
        inventories.forEach(row => {
            const key = text(row.material_codigo);
            if (!inventoriesByMaterial.has(key)) inventoriesByMaterial.set(key, []);
            inventoriesByMaterial.get(key).push(row);
        });
        return { warehouseById, inventoriesByMaterial, inventories };
    }

    async function listMaterials(options = {}) {
        const warehouseId = Number(options.warehouseId || options.almacenId || 0);
        const [rows, context] = await Promise.all([
            collectRows(() => client.from('materiales').select('*').order('codigo', { ascending: true })),
            loadInventoryContext()
        ]);

        let materials = rows.map(row => materialFromDb(
            row,
            context.inventoriesByMaterial.get(text(row.codigo)) || [],
            context.warehouseById
        ));

        if (options.includeInactive !== true) {
            materials = materials.filter(material => material.activo !== false);
        }
        if (!warehouseId) return materials;
        return materials.filter(material => material.almacenes.some(item => item.id === warehouseId));
    }

    async function listWarehouseInventory(options = {}) {
        const warehouseId = Number(options.warehouseId ?? options.almacenId ?? 0);
        if (!warehouseId) throw new Error('Selecciona un almacén válido.');
        const materials = await listMaterials({ warehouseId, includeInactive: options.includeInactive === true });
        return materials.map(material => {
            const inventory = (material.almacenes || []).find(item => Number(item.id) === warehouseId) || {};
            return {
                codigo: text(material.codigo),
                descripcion: text(material.descripcion ?? material.desc),
                categoria: text(material.categoria),
                unidad: text(material.unidad),
                marca: text(material.marca),
                imagen: text(material.imagen ?? material.imagen_url),
                almacenId: warehouseId,
                almacenNombre: text(inventory.nombre),
                stock: number(inventory.stock),
                stockMinimo: number(inventory.stockMinimo ?? inventory.stock_minimo),
                stockMedio: number(inventory.stockMedio ?? inventory.stock_medio),
                stockMaximo: number(inventory.stockMaximo ?? inventory.stock_maximo),
                ubicacion: text(inventory.ubicacion),
                material
            };
        }).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
    }

    async function assignWarehouseMaterialLocation(payload = {}) {
        const code = text(payload.codigo ?? payload.materialCodigo ?? payload.material_codigo);
        const warehouseId = Number(payload.almacenId ?? payload.warehouseId ?? payload.almacen_id ?? 0);
        let location = text(payload.ubicacion ?? payload.location);
        if (!code) throw new Error('Falta el código del material.');
        if (!warehouseId) throw new Error('Selecciona un almacén válido.');

        if (location) {
            const structures = await listWarehouseLocations({ warehouseId, activeOnly: true });
            const check = validateWarehouseLocationAgainstStructure(location, warehouseId, structures);
            if (!check.ok) throw new Error(check.error);
            location = check.codigo;

            const { data: occupied, error: occupiedError } = await client
                .from('existencias_almacen')
                .select('material_codigo')
                .eq('almacen_id', warehouseId)
                .eq('ubicacion', location)
                .neq('material_codigo', code)
                .limit(1);
            assertNoError(occupiedError, 'No se pudo verificar la disponibilidad de la ubicación.');
            if (occupied?.length) {
                throw new Error(`${location} ya está asignada al material ${text(occupied[0].material_codigo)}.`);
            }
        }

        const { data, error } = await client
            .from('existencias_almacen')
            .update({ ubicacion: location || null, updated_at: new Date().toISOString() })
            .eq('material_codigo', code)
            .eq('almacen_id', warehouseId)
            .select('material_codigo,almacen_id,stock,stock_minimo,stock_medio,stock_maximo,ubicacion')
            .maybeSingle();
        assertNoError(error, 'No se pudo asignar la ubicación del material.');
        if (!data) throw new Error('El material no tiene existencias registradas en este almacén.');
        return {
            codigo: text(data.material_codigo),
            almacenId: Number(data.almacen_id),
            stock: number(data.stock),
            stockMinimo: number(data.stock_minimo),
            stockMedio: number(data.stock_medio),
            stockMaximo: number(data.stock_maximo),
            ubicacion: text(data.ubicacion)
        };
    }

    async function assignWarehouseMaterialsLocation(payload = {}) {
        const codes = Array.isArray(payload.codigos) ? payload.codigos.map(text).filter(Boolean) : [];
        const warehouseId = Number(payload.almacenId ?? payload.warehouseId ?? payload.almacen_id ?? 0);
        const location = text(payload.ubicacion ?? payload.location);
        if (!codes.length) throw new Error('Selecciona al menos un material.');
        if (!warehouseId) throw new Error('Selecciona un almacén válido.');
        if (location && codes.length > 1) {
            throw new Error('Cada material debe recibir un consecutivo de ubicación diferente.');
        }
        if (codes.length === 1) {
            return [await assignWarehouseMaterialLocation({ codigo: codes[0], almacenId: warehouseId, ubicacion: location })];
        }
        const { data, error } = await client
            .from('existencias_almacen')
            .update({ ubicacion: null, updated_at: new Date().toISOString() })
            .in('material_codigo', codes)
            .eq('almacen_id', warehouseId)
            .select('material_codigo,almacen_id,stock,stock_minimo,stock_medio,stock_maximo,ubicacion');
        assertNoError(error, 'No se pudieron limpiar las ubicaciones de los materiales.');
        return (data || []).map(row => ({
            codigo: text(row.material_codigo),
            almacenId: Number(row.almacen_id),
            stock: number(row.stock),
            stockMinimo: number(row.stock_minimo),
            stockMedio: number(row.stock_medio),
            stockMaximo: number(row.stock_maximo),
            ubicacion: text(row.ubicacion)
        }));
    }

    async function resolveWarehouseId(material) {
        const direct = Number(material.almacenId ?? material.almacen_id ?? 0);
        if (direct) return direct;
        const name = text(material.almacenNombre ?? material.almacen);
        if (!name) return 0;
        const { data, error } = await client
            .from('almacenes')
            .select('id')
            .ilike('nombre', name)
            .limit(1)
            .maybeSingle();
        assertNoError(error);
        return data ? Number(data.id) : 0;
    }

    async function ensureCategoryExists(categoryName) {
        const name = text(categoryName);
        if (!name) return;
        const { error } = await client.from('categorias_materiales').upsert({
            nombre: name,
            activo: true,
            updated_at: new Date().toISOString()
        }, { onConflict: 'nombre' });
        assertNoError(error, 'No se pudo registrar la categoría del material.');
    }

    async function saveMaterial(material, originalCode = '') {
        const row = materialToDb(material);
        if (!row.codigo || !row.descripcion || !row.categoria || !row.unidad) {
            throw new Error('Código, descripción, categoría y unidad son obligatorios.');
        }

        const original = text(originalCode);
        const warehouseId = await resolveWarehouseId(material);
        await ensureCategoryExists(row.categoria);

        if (original) {
            const { error } = await client.from('materiales').update(row).eq('codigo', original);
            assertNoError(error, 'No se pudo actualizar el material.');
        } else {
            const { error } = await client.from('materiales').upsert({
                ...row,
                activo: true,
                stock: 0,
                stock_minimo: 0
            }, { onConflict: 'codigo' });
            assertNoError(error, 'No se pudo crear o reactivar el material.');
        }

        if (warehouseId) {
            const levels = normalizeStockLevels(
                material.stockMinimoAlmacen ?? material.stockMinimo ?? material.stock_minimo,
                material.stockMedioAlmacen ?? material.stockMedio ?? material.stock_medio,
                material.stockMaximoAlmacen ?? material.stockMaximo ?? material.stock_maximo
            );
            const inventoryRow = {
                material_codigo: row.codigo,
                almacen_id: warehouseId,
                stock: number(material.stockAlmacen ?? material.stock),
                stock_minimo: levels.minimum,
                stock_medio: levels.medium,
                stock_maximo: levels.maximum,
                ubicacion: text(material.ubicacionAlmacen) || null,
                updated_at: new Date().toISOString()
            };
            const { error } = await client
                .from('existencias_almacen')
                .upsert(inventoryRow, { onConflict: 'material_codigo,almacen_id' });
            assertNoError(error, 'El material se guardó, pero no se pudo asignar al almacén.');
        }

        const all = await listMaterials();
        return all.find(item => item.codigo === row.codigo) || materialFromDb(row);
    }

    async function deleteMaterial(code) {
        const codigo = text(code);
        if (!codigo) throw new Error('Falta el código del material.');
        const { error } = await client
            .from('materiales')
            .update({ activo: false, updated_at: new Date().toISOString() })
            .eq('codigo', codigo);
        assertNoError(error, 'No se pudo retirar el material del catálogo.');
        return { ok: true, codigo, eliminadoLogicamente: true };
    }

    async function importMaterials(products, onProgress, options = {}) {
        const input = Array.isArray(products) ? products : [];
        const progress = typeof onProgress === 'function' ? onProgress : function () {};
        const defaultWarehouseId = Number(options.almacenId ?? options.warehouseId ?? 0);
        progress(5, 'Consultando catálogo, almacenes, ubicaciones y existencias...');

        const [current, warehouses, inventories, locations] = await Promise.all([
            collectRows(() => client.from('materiales').select('*').order('codigo', { ascending: true })),
            collectRows(() => client.from('almacenes').select('*').order('nombre', { ascending: true })),
            collectRows(() => client.from('existencias_almacen').select('*').order('id', { ascending: true })),
            collectRows(() => client.from('ubicaciones_almacen').select('*').order('codigo', { ascending: true }))
        ]);

        const warehouseByName = new Map(warehouses.map(row => [lower(row.nombre), Number(row.id)]));
        const warehouseIds = new Set(warehouses.map(row => Number(row.id)));
        if (!warehouses.length) throw new Error('Primero registra al menos un almacén.');

        const currentByCode = new Map(current.map(row => [lower(row.codigo), row]));
        const inventoryByKey = new Map(inventories.map(row => [`${lower(row.material_codigo)}\u0000${Number(row.almacen_id)}`, row]));
        const inventoryByLocation = new Map(inventories.filter(row => text(row.ubicacion)).map(row => [`${Number(row.almacen_id)}\u0000${lower(row.ubicacion)}`, row]));
        const materialInputByCode = new Map();
        const inventoryInputByKey = new Map();
        const locationInputByKey = new Map();
        const errors = [];
        let omitted = 0;

        input.forEach((product, index) => {
            const code = text(product.codigo);
            const description = text(product.descripcion ?? product.desc);
            const fileRow = Number(product.filaArchivo) || index + 1;
            if (!code || !description) {
                omitted += 1;
                errors.push({ fila: fileRow, codigo: code, error: 'Código y descripción son obligatorios.' });
                return;
            }

            const warehouseId = Number(product.almacenId ?? product.almacen_id ?? 0) ||
                warehouseByName.get(lower(product.almacen ?? product.almacenNombre)) ||
                defaultWarehouseId;
            if (!warehouseId || !warehouseIds.has(warehouseId)) {
                omitted += 1;
                errors.push({ fila: fileRow, codigo: code, error: 'Selecciona un almacén válido para esta fila.' });
                return;
            }

            const locationCheck = validateWarehouseLocationAgainstStructure(
                product.ubicacionAlmacen ?? product.ubicacion,
                warehouseId,
                locations
            );
            if (!locationCheck.ok) {
                omitted += 1;
                errors.push({ fila: fileRow, codigo: code, error: locationCheck.error });
                return;
            }

            if (locationCheck.codigo) {
                const locationKey = `${warehouseId}\u0000${lower(locationCheck.codigo)}`;
                const occupied = inventoryByLocation.get(locationKey);
                if (occupied && lower(occupied.material_codigo) !== lower(code)) {
                    omitted += 1;
                    errors.push({ fila: fileRow, codigo: code, error: `${locationCheck.codigo} ya está ocupada por ${text(occupied.material_codigo)}.` });
                    return;
                }
                const inputOccupant = locationInputByKey.get(locationKey);
                if (inputOccupant && lower(inputOccupant) !== lower(code)) {
                    omitted += 1;
                    errors.push({ fila: fileRow, codigo: code, error: `${locationCheck.codigo} está repetida en el archivo para otro material.` });
                    return;
                }
                locationInputByKey.set(locationKey, code);
            }

            const inventoryKey = `${lower(code)}\u0000${warehouseId}`;
            if (inventoryInputByKey.has(inventoryKey)) {
                omitted += 1;
                errors.push({ fila: fileRow, codigo: code, error: 'El mismo SKU está repetido para el mismo almacén.' });
                return;
            }

            const codeKey = lower(code);
            if (!materialInputByCode.has(codeKey)) materialInputByCode.set(codeKey, product);
            inventoryInputByKey.set(inventoryKey, {
                product,
                code,
                warehouseId,
                location: locationCheck.codigo,
                fileRow
            });
        });

        const materialRows = [];
        let created = 0;
        let updated = 0;
        materialInputByCode.forEach((product, key) => {
            const existing = currentByCode.get(key);
            const row = materialToDb(product);
            if (existing) {
                row.codigo = existing.codigo;
                row.stock = number(existing.stock);
                row.stock_minimo = number(existing.stock_minimo);
                updated += 1;
            } else {
                row.stock = 0;
                row.stock_minimo = 0;
                created += 1;
            }
            materialRows.push(row);
        });

        const canonicalCodeByLower = new Map(materialRows.map(row => [lower(row.codigo), row.codigo]));
        const inventoryRows = [];
        inventoryInputByKey.forEach(entry => {
            const canonicalCode = canonicalCodeByLower.get(lower(entry.code)) || entry.code;
            const existingInventory = inventoryByKey.get(`${lower(canonicalCode)}\u0000${entry.warehouseId}`);
            const levels = normalizeStockLevels(
                text(entry.product.stockMinimo ?? entry.product.stock_minimo) === '' ? existingInventory?.stock_minimo : (entry.product.stockMinimo ?? entry.product.stock_minimo),
                text(entry.product.stockMedio ?? entry.product.stock_medio) === '' ? existingInventory?.stock_medio : (entry.product.stockMedio ?? entry.product.stock_medio),
                text(entry.product.stockMaximo ?? entry.product.stock_maximo) === '' ? existingInventory?.stock_maximo : (entry.product.stockMaximo ?? entry.product.stock_maximo)
            );
            inventoryRows.push({
                material_codigo: canonicalCode,
                almacen_id: entry.warehouseId,
                stock: existingInventory
                    ? number(existingInventory.stock)
                    : number(entry.product.stockInicial ?? entry.product.stock ?? entry.product.stock_inicial),
                stock_minimo: levels.minimum,
                stock_medio: levels.medium,
                stock_maximo: levels.maximum,
                ubicacion: entry.location || null,
                updated_at: new Date().toISOString()
            });
        });

        const chunkSize = 200;
        for (let startIndex = 0; startIndex < materialRows.length; startIndex += chunkSize) {
            const chunk = materialRows.slice(startIndex, startIndex + chunkSize);
            const { error } = await client.from('materiales').upsert(chunk, { onConflict: 'codigo' });
            assertNoError(error, 'No se pudo importar el catálogo.');
            const completed = Math.min(materialRows.length, startIndex + chunk.length);
            progress(15 + Math.round((completed / Math.max(1, materialRows.length)) * 45), `Guardando materiales (${completed}/${materialRows.length})...`);
        }

        for (let startIndex = 0; startIndex < inventoryRows.length; startIndex += chunkSize) {
            const chunk = inventoryRows.slice(startIndex, startIndex + chunkSize);
            const { error } = await client
                .from('existencias_almacen')
                .upsert(chunk, { onConflict: 'material_codigo,almacen_id' });
            assertNoError(error, 'Los materiales se guardaron, pero falló su asignación al almacén o ubicación.');
            const completed = Math.min(inventoryRows.length, startIndex + chunk.length);
            progress(65 + Math.round((completed / Math.max(1, inventoryRows.length)) * 30), `Asignando almacenes y ubicaciones (${completed}/${inventoryRows.length})...`);
        }

        const { error: recalcError } = await client.rpc('recalcular_todos_los_stocks');
        assertNoError(recalcError, 'No se pudieron recalcular las existencias totales.');

        progress(100, 'Importación terminada.');
        return {
            ok: true,
            estado: 'completado',
            total: input.length,
            creados: created,
            actualizados: updated,
            omitidos: omitted,
            errores: errors
        };
    }

    function movementFromDb(row) {
        const esNoListado = boolean(row.es_no_listado);
        const codigo = text(row.material_codigo || row.codigo_manual);
        return {
            id: row.id,
            requestId: text(row.request_id),
            request_id: text(row.request_id),
            fecha: row.fecha || row.created_at || '',
            tipo: lower(row.tipo),
            tipo_movimiento: lower(row.tipo),
            ajusteAccion: text(row.ajuste_accion),
            ajuste_accion: text(row.ajuste_accion),
            codigo,
            material_codigo: text(row.material_codigo),
            codigoManual: text(row.codigo_manual),
            codigo_manual: text(row.codigo_manual),
            descripcion: text(row.descripcion),
            desc: text(row.descripcion),
            cantidad: number(row.cantidad),
            unidad: text(row.unidad),
            categoria: text(row.categoria_manual),
            esNoListado,
            es_no_listado: esNoListado,
            proyecto: text(row.proyecto),
            proyectoDestino: text(row.proyecto_destino),
            proyecto_destino: text(row.proyecto_destino),
            traspasoModo: text(row.traspaso_modo),
            traspaso_modo: text(row.traspaso_modo),
            ubicacionPendiente: boolean(row.ubicacion_pendiente),
            ubicacion_pendiente: boolean(row.ubicacion_pendiente),
            ubicacion: text(row.ubicacion),
            ordenCompra: text(row.orden_compra),
            orden_compra: text(row.orden_compra),
            fechaOrdenCompra: text(row.fecha_orden_compra),
            fecha_orden_compra: text(row.fecha_orden_compra),
            referencia: text(row.referencia),
            bodegaOrigen: text(row.bodega_origen),
            bodega_origen: text(row.bodega_origen),
            bodegaDestino: text(row.bodega_destino),
            bodega_destino: text(row.bodega_destino),
            motivo: text(row.motivo),
            precio: number(row.precio_unitario),
            precio_unitario: number(row.precio_unitario),
            recibeNombre: text(row.recibe_nombre),
            recibe_nombre: text(row.recibe_nombre),
            recibeTipo: text(row.recibe_tipo),
            recibe_tipo: text(row.recibe_tipo),
            folioEntrega: text(row.folio_entrega),
            folio_entrega: text(row.folio_entrega),
            alcance: text(row.alcance) || 'sin_plan',
            stockFuente: text(row.stock_fuente) || 'general',
            stock_fuente: text(row.stock_fuente) || 'general',
            cantidadStockProyecto: number(row.cantidad_stock_proyecto),
            cantidad_stock_proyecto: number(row.cantidad_stock_proyecto),
            cantidadStockGeneral: number(row.cantidad_stock_general),
            cantidad_stock_general: number(row.cantidad_stock_general),
            cantidadDentroPlan: number(row.cantidad_dentro_plan),
            cantidad_dentro_plan: number(row.cantidad_dentro_plan),
            cantidadFueraPlan: number(row.cantidad_fuera_plan),
            cantidad_fuera_plan: number(row.cantidad_fuera_plan),
            origenEntrada: text(row.origen_entrada),
            origen_entrada: text(row.origen_entrada),
            tomarDelAlmacen: boolean(row.tomar_del_almacen),
            tomar_del_almacen: boolean(row.tomar_del_almacen)
        };
    }

    async function listMovements(options = {}) {
        const project = text(options.project ?? options.proyecto);
        const rows = await collectRows(() => {
            let query = client
                .from('movimientos')
                .select('*')
                .order('fecha', { ascending: true });
            if (project) query = query.eq('proyecto', project);
            return query;
        });
        const mapped = rows.map(movementFromDb);
        if (project) {
            try {
                const plan = await listProjectPlanV12(project);
                const planCodes = new Set(plan.map(line => lower(line.codigo)));
                mapped.forEach(item => {
                    item.dentroPlan = planCodes.has(lower(item.codigo));
                    item.dentro_plan = item.dentroPlan;
                });
            } catch (error) {
                mapped.forEach(item => {
                    item.dentroPlan = null;
                    item.dentro_plan = null;
                });
            }
        }
        return mapped;
    }

    async function listMovementGroups(options = {}) {
        const rows = await listMovements(options);
        const groups = new Map();

        rows.forEach(row => {
            const key = row.requestId || `mov-${row.id}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    requestId: key,
                    tipo_movimiento: row.tipo,
                    tipo: row.tipo,
                    motivo: row.motivo,
                    fecha: row.fecha,
                    proyecto: row.proyecto || '',
                    proyectoDestino: row.proyectoDestino || '',
                    proyecto_destino: row.proyectoDestino || '',
                    traspasoModo: row.traspasoModo || '',
                    traspaso_modo: row.traspasoModo || '',
                    referencia: row.referencia || '',
                    ordenCompra: row.ordenCompra || '',
                    orden_compra: row.ordenCompra || '',
                    fechaOrdenCompra: row.fechaOrdenCompra || '',
                    fecha_orden_compra: row.fechaOrdenCompra || '',
                    bodegaOrigen: row.bodegaOrigen || '',
                    bodega_origen: row.bodegaOrigen || '',
                    bodegaDestino: row.bodegaDestino || '',
                    bodega_destino: row.bodegaDestino || '',
                    ubicacion: row.ubicacion || '',
                    ubicacionPendiente: Boolean(row.ubicacionPendiente),
                    ubicacion_pendiente: Boolean(row.ubicacionPendiente),
                    recibeNombre: row.recibeNombre || '',
                    recibeTipo: row.recibeTipo || '',
                    folioEntrega: row.folioEntrega || row.referencia || row.requestId || '',
                    productos: []
                });
            }

            const group = groups.get(key);
            if (row.tipo === 'traspaso' || row.tipo === 'prestamo') {
                group.tipo_movimiento = row.tipo;
                group.tipo = row.tipo;
                group.proyecto = row.proyecto || group.proyecto;
                group.proyectoDestino = row.proyectoDestino || group.proyectoDestino;
                group.proyecto_destino = row.proyectoDestino || group.proyecto_destino;
                group.traspasoModo = row.traspasoModo || group.traspasoModo;
                group.traspaso_modo = row.traspasoModo || group.traspaso_modo;
                group.bodegaOrigen = row.bodegaOrigen || group.bodegaOrigen;
                group.bodega_origen = row.bodegaOrigen || group.bodega_origen;
                group.bodegaDestino = row.bodegaDestino || group.bodegaDestino;
                group.bodega_destino = row.bodegaDestino || group.bodega_destino;
            }
            if (!group.proyecto && row.proyecto) group.proyecto = row.proyecto;
            if (!group.proyectoDestino && row.proyectoDestino) {
                group.proyectoDestino = row.proyectoDestino;
                group.proyecto_destino = row.proyectoDestino;
            }
            if (!group.bodegaOrigen && row.bodegaOrigen) {
                group.bodegaOrigen = row.bodegaOrigen;
                group.bodega_origen = row.bodegaOrigen;
            }
            if (!group.bodegaDestino && row.bodegaDestino) {
                group.bodegaDestino = row.bodegaDestino;
                group.bodega_destino = row.bodegaDestino;
            }
            if (!group.referencia && row.referencia) group.referencia = row.referencia;
            if (!group.ordenCompra && row.ordenCompra) {
                group.ordenCompra = row.ordenCompra;
                group.orden_compra = row.ordenCompra;
            }

            group.productos.push({
                tipo: row.tipo,
                ajusteAccion: row.ajusteAccion || null,
                ajuste_accion: row.ajusteAccion || null,
                producto: {
                    codigo: row.codigo,
                    desc: row.descripcion,
                    descripcion: row.descripcion,
                    unidad: row.unidad,
                    categoria: row.categoria,
                    esNoListado: row.esNoListado,
                    es_no_listado: row.esNoListado
                },
                codigo: row.codigo,
                descripcion: row.descripcion,
                cantidad: row.cantidad,
                proyecto: row.proyecto,
                proyectoDestino: row.proyectoDestino,
                proyecto_destino: row.proyectoDestino,
                traspasoModo: row.traspasoModo,
                traspaso_modo: row.traspasoModo,
                ubicacion: row.ubicacion,
                ubicacionPendiente: row.ubicacionPendiente,
                ubicacion_pendiente: row.ubicacionPendiente,
                ordenCompra: row.ordenCompra,
                orden_compra: row.ordenCompra,
                fechaOrdenCompra: row.fechaOrdenCompra,
                fecha_orden_compra: row.fechaOrdenCompra,
                referencia: row.referencia,
                bodegaOrigen: row.bodegaOrigen,
                bodega_origen: row.bodegaOrigen,
                bodegaDestino: row.bodegaDestino,
                bodega_destino: row.bodegaDestino,
                esNoListado: row.esNoListado,
                es_no_listado: row.esNoListado,
                unidad: row.unidad,
                alcance: row.alcance,
                stockFuente: row.stockFuente,
                stock_fuente: row.stockFuente,
                cantidadStockProyecto: row.cantidadStockProyecto,
                cantidad_stock_proyecto: row.cantidadStockProyecto,
                cantidadStockGeneral: row.cantidadStockGeneral,
                cantidad_stock_general: row.cantidadStockGeneral,
                cantidadDentroPlan: row.cantidadDentroPlan,
                cantidad_dentro_plan: row.cantidadDentroPlan,
                cantidadFueraPlan: row.cantidadFueraPlan,
                cantidad_fuera_plan: row.cantidadFueraPlan,
                origenEntrada: row.origenEntrada,
                origen_entrada: row.origenEntrada
            });
        });

        return Array.from(groups.values()).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
    }

    async function registerMovement(payload) {
        const products = Array.isArray(payload.productos) ? payload.productos : [];
        if (!products.length) throw new Error('Agrega al menos un material.');

        const requestId = text(payload.requestId) ||
            (window.crypto && typeof window.crypto.randomUUID === 'function'
                ? window.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

        const type = lower(payload.tipo_movimiento ?? payload.tipo);
        const dateValue = payload.fecha ? new Date(payload.fecha) : new Date();
        const isoDate = Number.isNaN(dateValue.getTime())
            ? new Date().toISOString()
            : dateValue.toISOString();

        const normalizedProducts = products.map(item => {
            const product = item.producto || {};
            const esNoListado = boolean(
                item.esNoListado ?? item.es_no_listado ?? product.esNoListado ?? product.es_no_listado
            );
            const codigo = text(item.codigo ?? product.codigo);
            const descripcion = text(item.descripcion ?? item.desc ?? product.descripcion ?? product.desc);
            const unidad = text(item.unidad ?? product.unidad);
            const categoria = text(item.categoria ?? product.categoria);
            const precio = number(item.precio ?? item.precio_unitario ?? product.precio);

            return {
                ...item,
                cantidad: number(item.cantidad),
                precio,
                precio_unitario: precio,
                esNoListado,
                es_no_listado: esNoListado,
                descripcion,
                unidad,
                categoria,
                producto: {
                    ...product,
                    codigo,
                    desc: descripcion,
                    descripcion,
                    unidad,
                    categoria,
                    precio,
                    esNoListado,
                    es_no_listado: esNoListado
                },
                codigo,
                fechaOrdenCompra: text(item.fechaOrdenCompra ?? item.fecha_orden_compra ?? payload.fechaOrdenCompra ?? payload.fecha_orden_compra),
                fecha_orden_compra: text(item.fechaOrdenCompra ?? item.fecha_orden_compra ?? payload.fechaOrdenCompra ?? payload.fecha_orden_compra),
                referencia: text(item.referencia ?? payload.referencia),
                bodegaOrigen: text(item.bodegaOrigen ?? item.bodega_origen),
                bodegaDestino: text(item.bodegaDestino ?? item.bodega_destino)
            };
        });

        const purchaseTotals = new Map();
        normalizedProducts.forEach(item => {
            const id = Number(item.solicitudCompraId ?? item.solicitud_compra_id ?? 0);
            if (!id) return;
            purchaseTotals.set(id, number(purchaseTotals.get(id)) + number(item.cantidad));
        });
        let purchaseById = new Map();
        if (type === 'entrada' && purchaseTotals.size) {
            const requests = await listPurchaseRequests({});
            purchaseById = new Map(requests.map(request => [Number(request.id), request]));
            purchaseTotals.forEach((quantity, id) => {
                const request = purchaseById.get(id);
                if (!request) throw new Error(`La solicitud de compra ${id} ya no existe o no está disponible.`);
                const pending = Math.max(0, number(request.cantidadSolicitada) - number(request.cantidadRecibida));
                if (quantity > pending + 0.000001) {
                    throw new Error(`La recepción de ${request.materialCodigo} excede lo pendiente de la orden. Pendiente: ${pending} ${request.unidad || ''}.`);
                }
                const itemOrder = normalizedProducts.find(item => Number(item.solicitudCompraId ?? item.solicitud_compra_id ?? 0) === id)?.ordenCompra;
                if (text(itemOrder) && text(request.ordenCompra) && lower(itemOrder) !== lower(request.ordenCompra)) {
                    throw new Error(`El material ${request.materialCodigo} pertenece a la orden ${request.ordenCompra}, no a ${itemOrder}.`);
                }
            });
        }

        let { data, error } = await client.rpc('crm_registrar_movimientos_v12141', {
            p_request_id: requestId,
            p_tipo: type,
            p_motivo: text(payload.motivo),
            p_fecha: isoDate,
            p_productos: normalizedProducts
        });
        if (error && ['PGRST202', '42883'].includes(String(error.code || ''))) {
            ({ data, error } = await client.rpc('registrar_movimientos', {
                p_request_id: requestId,
                p_tipo: type,
                p_motivo: text(payload.motivo),
                p_fecha: isoDate,
                p_productos: normalizedProducts
            }));
        }
        assertNoError(error, 'No se pudo registrar el movimiento.');

        const commonPurchaseDate = text(payload.fechaOrdenCompra ?? payload.fecha_orden_compra ?? normalizedProducts.find(item => item.fechaOrdenCompra)?.fechaOrdenCompra);
        const commonReference = text(payload.referencia ?? normalizedProducts.find(item => item.referencia)?.referencia);
        if (commonPurchaseDate || commonReference) {
            const metadata = {};
            if (commonPurchaseDate) metadata.fecha_orden_compra = commonPurchaseDate;
            if (commonReference) metadata.referencia = commonReference;
            const { error: metadataError } = await client
                .from('movimientos')
                .update(metadata)
                .eq('request_id', requestId);
            assertNoError(metadataError, 'El movimiento se guardó, pero no se pudieron guardar la fecha de la orden o la referencia.');
        }

        if (type === 'entrada' && purchaseTotals.size) {
            for (const [purchaseRequestId, receivedNow] of purchaseTotals.entries()) {
                const request = purchaseById.get(purchaseRequestId);
                if (!request) continue;
                const received = number(request.cantidadRecibida) + number(receivedNow);
                const requested = number(request.cantidadSolicitada);
                await updatePurchaseRequest(purchaseRequestId, {
                    cantidadRecibida: Math.min(requested, received),
                    estado: received >= requested ? 'recibida' : 'parcial'
                });
            }
        }

        return data && typeof data === 'object'
            ? data
            : { ok: true, registrados: normalizedProducts.length, requestId };
    }

    async function getProjectsRaw() {
        return collectRows(() =>
            client.from('proyectos').select('*').order('numero_proyecto', { ascending: true })
        );
    }

    async function getProjectMaterialsRaw() {
        return collectRows(() =>
            client.from('proyecto_materiales').select('*').order('id', { ascending: true })
        );
    }


    async function getProjectManualMaterialsRaw() {
        return collectRows(() =>
            client.from('proyecto_materiales_no_listados').select('*').order('id', { ascending: true })
        );
    }

    function consumedAmount(row) {
        const type = lower(row.tipo);
        if (type === 'salida') return number(row.cantidad);
        if (type === 'reingreso') return -number(row.cantidad);
        if (type === 'ajuste' && lower(row.ajuste_accion) === 'disminuir') {
            return number(row.cantidad);
        }
        return 0;
    }

    async function listProjects() {
        const [projects, listedLines, manualLines, movements, materials] = await Promise.all([
            getProjectsRaw(),
            getProjectMaterialsRaw(),
            getProjectManualMaterialsRaw(),
            collectRows(() => client.from('movimientos').select('*').order('fecha', { ascending: true })),
            collectRows(() => client.from('materiales').select('codigo,precio').order('codigo', { ascending: true }))
        ]);

        const priceByCode = new Map(materials.map(row => [text(row.codigo), number(row.precio)]));
        const linesByProject = new Map();
        const movesByProject = new Map();
        const allLines = [
            ...listedLines.map(row => ({ ...row, es_no_listado: false })),
            ...manualLines.map(row => ({ ...row, es_no_listado: true }))
        ];

        allLines.forEach(row => {
            const key = text(row.proyecto_numero);
            if (!linesByProject.has(key)) linesByProject.set(key, []);
            linesByProject.get(key).push(row);
        });

        movements.forEach(row => {
            const key = text(row.proyecto);
            if (!key) return;
            if (!movesByProject.has(key)) movesByProject.set(key, []);
            movesByProject.get(key).push(row);
        });

        return projects.map(project => {
            const projectNumber = text(project.numero_proyecto);
            const projectLines = linesByProject.get(projectNumber) || [];
            const projectMoves = movesByProject.get(projectNumber) || [];
            const planCodes = new Set();
            const planPriceByCode = new Map();

            const planned = projectLines.reduce((sum, row) => {
                const code = text(row.es_no_listado ? row.codigo_manual : row.material_codigo);
                if (code) planCodes.add(lower(code));
                const linePrice = number(row.precio_unitario) || priceByCode.get(code) || 0;
                if (code && linePrice > 0) planPriceByCode.set(lower(code), linePrice);
                return sum + number(row.cantidad_planeada);
            }, 0);

            const plannedCost = projectLines.reduce((sum, row) => {
                const code = text(row.es_no_listado ? row.codigo_manual : row.material_codigo);
                const price = number(row.precio_unitario) || priceByCode.get(code) || 0;
                return sum + number(row.cantidad_planeada) * price;
            }, 0);

            /*
             * Costo real del proyecto:
             * - Entradas vinculadas al proyecto representan material comprado/ingresado para él.
             * - Salidas y ajustes de disminución representan material efectivamente entregado.
             * - Reingresos descuentan lo devuelto.
             * - Para no duplicar una compra que después también se entrega, por cada material se
             *   toma la mayor cantidad entre lo ingresado y lo entregado neto.
             */
            const costByCode = new Map();

            projectMoves.forEach(row => {
                const code = text(row.material_codigo || row.codigo_manual);
                if (!code) return;

                const key = lower(code);
                if (!costByCode.has(key)) {
                    costByCode.set(key, {
                        code,
                        entrada: 0,
                        entregadoNeto: 0,
                        precio: 0,
                        movimientos: 0
                    });
                }

                const item = costByCode.get(key);
                const type = lower(row.tipo);
                const qty = number(row.cantidad);

                if (type === 'entrada') {
                    item.entrada += qty;
                }

                item.entregadoNeto += consumedAmount(row);
                item.movimientos += 1;

                const movementPrice = number(row.precio_unitario);
                const planPrice = planPriceByCode.get(key) || 0;
                const catalogPrice = priceByCode.get(code) || priceByCode.get(item.code) || 0;
                item.precio = movementPrice || item.precio || planPrice || catalogPrice || 0;
            });

            let consumed = 0;
            let consumedCost = 0;
            let enteredCost = 0;
            let realProjectCost = 0;
            let outsidePlanCost = 0;
            let outsidePlanMoves = 0;
            let usesEntriesAsCost = false;

            costByCode.forEach(item => {
                const delivered = Math.max(0, number(item.entregadoNeto));
                const entered = Math.max(0, number(item.entrada));
                const price = number(item.precio);
                const realQty = Math.max(entered, delivered);

                consumed += delivered;
                consumedCost += delivered * price;
                enteredCost += entered * price;
                realProjectCost += realQty * price;

                if (entered > delivered) usesEntriesAsCost = true;

                if (!planCodes.has(lower(item.code))) {
                    outsidePlanCost += realQty * price;
                    outsidePlanMoves += item.movimientos;
                }
            });

            const dates = projectMoves
                .map(row => row.fecha || row.created_at)
                .filter(Boolean)
                .sort();

            return {
                proyecto: projectNumber,
                idProyecto: projectNumber,
                nombreProyecto: text(project.nombre_proyecto),
                cliente: text(project.cliente),
                ordenCompra: text(project.orden_compra),
                planta: text(project.planta),
                nave: text(project.nave),
                responsableSkilled: text(project.responsable_skilled),
                fechaAsignacion: project.fecha_asignacion || '',
                fechaEntrega: project.fecha_entrega || '',
                estado: text(project.estado),
                tipoControl: text(project.tipo_control) === 'presupuesto' ? 'presupuesto' : 'materiales',
                tipo_control: text(project.tipo_control) === 'presupuesto' ? 'presupuesto' : 'materiales',
                presupuestoPlaneado: Math.max(0, number(project.presupuesto_planeado)),
                presupuesto_planeado: Math.max(0, number(project.presupuesto_planeado)),
                lineas: projectLines.length,
                planeado: planned,
                consumido: consumed,
                costoPlaneado: text(project.tipo_control) === 'presupuesto' ? Math.max(0, number(project.presupuesto_planeado)) : plannedCost,

                // La interfaz conserva la propiedad costoConsumido por compatibilidad,
                // pero ahora representa el costo real del proyecto sin duplicar entrada + salida.
                costoConsumido: realProjectCost,
                costoRealProyecto: realProjectCost,
                costoIngresado: enteredCost,
                costoEntregado: consumedCost,
                costoFueraPlan: outsidePlanCost,
                movimientosFueraPlan: outsidePlanMoves,
                usaCostoEntradas: usesEntriesAsCost,

                avance: text(project.tipo_control) === 'presupuesto'
                    ? (number(project.presupuesto_planeado) > 0 ? realProjectCost / number(project.presupuesto_planeado) * 100 : 0)
                    : (planned > 0 ? consumed / planned * 100 : 0),
                movimientos: projectMoves.length,
                cantidadMovimientos: projectMoves.length,
                costoMovimientos: realProjectCost,
                ultimoMovimiento: dates.length ? dates[dates.length - 1] : ''
            };
        });
    }

    async function listProjectLines() {
        const [projects, listedLines, manualLines, movements, materials] = await Promise.all([
            getProjectsRaw(),
            getProjectMaterialsRaw(),
            getProjectManualMaterialsRaw(),
            collectRows(() => client.from('movimientos').select('*').order('fecha', { ascending: true })),
            collectRows(() => client.from('materiales').select('codigo,precio').order('codigo', { ascending: true }))
        ]);

        const lines = [
            ...listedLines.map(row => ({ ...row, es_no_listado: false })),
            ...manualLines.map(row => ({ ...row, es_no_listado: true }))
        ];
        const priceByCode = new Map(materials.map(row => [text(row.codigo), number(row.precio)]));
        const consumedByLine = new Map();

        movements.forEach(row => {
            const amount = consumedAmount(row);
            if (!amount) return;
            const code = text(row.material_codigo || row.codigo_manual);
            const key = `${text(row.proyecto)}\u0000${code}`;
            consumedByLine.set(key, (consumedByLine.get(key) || 0) + amount);
        });

        if (!lines.length) {
            return projects.map(project => ({
                proyecto: text(project.numero_proyecto),
                linea: '',
                codigo: '',
                planeado: 0,
                consumido: 0,
                costoPlaneado: 0,
                costoConsumido: 0
            }));
        }

        return lines.map((row, index) => {
            const project = text(row.proyecto_numero);
            const code = text(row.es_no_listado ? row.codigo_manual : row.material_codigo);
            const planned = number(row.cantidad_planeada);
            const consumed = Math.max(0, consumedByLine.get(`${project}\u0000${code}`) || 0);
            const price = number(row.precio_unitario) || priceByCode.get(code) || 0;
            return {
                proyecto: project,
                linea: row.id || index + 1,
                codigo: code,
                descripcion: text(row.descripcion),
                esNoListado: boolean(row.es_no_listado),
                planeado: planned,
                consumido: consumed,
                costoPlaneado: planned * price,
                costoConsumido: consumed * price
            };
        });
    }

    async function listProjectPlan(projectNumber) {
        const project = text(projectNumber);
        if (!project) throw new Error('Falta el número del proyecto.');

        const [lineResult, manualResult, materials] = await Promise.all([
            client
                .from('proyecto_materiales')
                .select('*')
                .eq('proyecto_numero', project)
                .order('id', { ascending: true }),
            client
                .from('proyecto_materiales_no_listados')
                .select('*')
                .eq('proyecto_numero', project)
                .order('id', { ascending: true }),
            listMaterials()
        ]);

        assertNoError(lineResult.error, 'No se pudo consultar el plan del proyecto.');
        assertNoError(manualResult.error, 'No se pudieron consultar los materiales no enlistados.');
        const materialByCode = new Map(materials.map(item => [text(item.codigo), item]));

        const listed = (lineResult.data || []).map(row => {
            const material = materialByCode.get(text(row.material_codigo)) || {
                codigo: text(row.material_codigo),
                descripcion: text(row.material_codigo),
                desc: text(row.material_codigo),
                unidad: text(row.unidad),
                precio: number(row.precio_unitario),
                stock: 0,
                imagen: ''
            };

            return {
                id: row.id,
                proyecto: text(row.proyecto_numero),
                codigo: text(row.material_codigo),
                cantidadPlaneada: number(row.cantidad_planeada),
                cantidadEntregada: number(row.cantidad_entregada),
                cantidadSobrante: number(row.cantidad_sobrante),
                unidad: text(row.unidad) || text(material.unidad),
                precioUnitario: number(row.precio_unitario) || number(material.precio),
                observaciones: text(row.observaciones),
                esNoListado: false,
                material
            };
        });

        const manual = (manualResult.data || []).map(row => {
            const material = {
                codigo: text(row.codigo_manual),
                descripcion: text(row.descripcion),
                desc: text(row.descripcion),
                categoria: text(row.categoria),
                unidad: text(row.unidad),
                precio: number(row.precio_unitario),
                stock: 0,
                imagen: '',
                esNoListado: true
            };
            return {
                id: row.id,
                proyecto: text(row.proyecto_numero),
                codigo: text(row.codigo_manual),
                cantidadPlaneada: number(row.cantidad_planeada),
                cantidadEntregada: number(row.cantidad_entregada),
                cantidadSobrante: number(row.cantidad_sobrante),
                unidad: text(row.unidad),
                precioUnitario: number(row.precio_unitario),
                observaciones: text(row.observaciones),
                esNoListado: true,
                material
            };
        });

        return [...listed, ...manual];
    }

    async function listProjectDeliveryPlan(projectNumber) {
        const project = text(projectNumber);
        if (!project) throw new Error('Falta el número del proyecto.');

        const [plan, movements] = await Promise.all([
            listProjectPlan(project),
            listMovements({ project })
        ]);

        const deliveredByCode = new Map();
        movements
            .filter(row => lower(row.tipo) === 'salida')
            .forEach(row => {
                const code = text(row.codigo);
                const key = lower(code);
                deliveredByCode.set(key, (deliveredByCode.get(key) || 0) + number(row.cantidad));
            });

        return plan.map(line => {
            const planned = number(line.cantidadPlaneada);
            const delivered = deliveredByCode.get(lower(line.codigo)) || 0;
            return {
                ...line,
                planeado: planned,
                entregado: delivered,
                pendiente: Math.max(0, planned - delivered),
                descripcion: text(line.material?.descripcion ?? line.material?.desc ?? line.codigo),
                categoria: text(line.material?.categoria),
                unidad: text(line.unidad ?? line.material?.unidad)
            };
        });
    }

    async function saveProjectPlan(projectNumber, lines) {
        const project = text(projectNumber);
        if (!project) throw new Error('Falta el número del proyecto.');

        const input = Array.isArray(lines) ? lines : [];
        const listed = new Map();
        const manual = new Map();
        const catalogMaterials = await listMaterials();
        const catalogCodes = new Set(catalogMaterials.map(item => lower(item.codigo)));

        input.forEach(line => {
            const material = line.material || {};
            const code = text(line.codigo ?? material.codigo);
            const markedManual = boolean(
                line.esNoListado ?? line.es_no_listado ?? material.esNoListado ?? material.es_no_listado
            );
            // Todo código que no exista realmente en public.materiales se trata como manual.
            // Así nunca se viola la FK proyecto_materiales_material_codigo_fkey.
            const esNoListado = markedManual || !catalogCodes.has(lower(code));
            if (!code) throw new Error('Uno de los materiales no tiene código o referencia.');

            const planned = number(line.cantidadPlaneada ?? line.cantidad_planeada);
            if (planned <= 0) {
                throw new Error(`La cantidad planeada de ${code} debe ser mayor a cero.`);
            }

            if (esNoListado) {
                const descripcion = text(line.descripcion ?? material.descripcion ?? material.desc);
                if (!descripcion) throw new Error(`Escribe la descripción del material no enlistado ${code}.`);
                manual.set(lower(code), {
                    proyecto_numero: project,
                    codigo_manual: code,
                    descripcion,
                    categoria: text(line.categoria ?? material.categoria) || null,
                    cantidad_planeada: planned,
                    cantidad_entregada: number(line.cantidadEntregada ?? line.cantidad_entregada),
                    cantidad_sobrante: number(line.cantidadSobrante ?? line.cantidad_sobrante),
                    unidad: text(line.unidad ?? material.unidad) || null,
                    precio_unitario: number(line.precioUnitario ?? line.precio_unitario ?? material.precio),
                    observaciones: text(line.observaciones ?? line.notas) || null,
                    updated_at: new Date().toISOString()
                });
            } else {
                listed.set(lower(code), {
                    proyecto_numero: project,
                    material_codigo: code,
                    cantidad_planeada: planned,
                    cantidad_entregada: number(line.cantidadEntregada ?? line.cantidad_entregada),
                    cantidad_sobrante: number(line.cantidadSobrante ?? line.cantidad_sobrante),
                    unidad: text(line.unidad ?? material.unidad) || null,
                    precio_unitario: number(line.precioUnitario ?? line.precio_unitario ?? material.precio),
                    observaciones: text(line.observaciones ?? line.notas) || null,
                    updated_at: new Date().toISOString()
                });
            }
        });

        const [listedExistingResult, manualExistingResult] = await Promise.all([
            client.from('proyecto_materiales').select('material_codigo').eq('proyecto_numero', project),
            client.from('proyecto_materiales_no_listados').select('codigo_manual').eq('proyecto_numero', project)
        ]);
        assertNoError(listedExistingResult.error, 'No se pudo consultar el plan actual.');
        assertNoError(manualExistingResult.error, 'No se pudo consultar el plan manual actual.');

        const listedRows = Array.from(listed.values());
        const manualRows = Array.from(manual.values());
        if (listedRows.length) {
            const { error } = await client
                .from('proyecto_materiales')
                .upsert(listedRows, { onConflict: 'proyecto_numero,material_codigo' });
            assertNoError(error, 'No se pudo guardar el plan del proyecto.');
        }
        if (manualRows.length) {
            const { error } = await client
                .from('proyecto_materiales_no_listados')
                .upsert(manualRows, { onConflict: 'proyecto_numero,codigo_manual' });
            assertNoError(error, 'No se pudieron guardar los materiales no enlistados.');
        }

        const keepListed = new Set(listedRows.map(row => lower(row.material_codigo)));
        for (const row of (listedExistingResult.data || [])) {
            if (!keepListed.has(lower(row.material_codigo))) {
                const { error } = await client
                    .from('proyecto_materiales')
                    .delete()
                    .eq('proyecto_numero', project)
                    .eq('material_codigo', row.material_codigo);
                assertNoError(error, `No se pudo quitar ${row.material_codigo} del plan.`);
            }
        }

        const keepManual = new Set(manualRows.map(row => lower(row.codigo_manual)));
        for (const row of (manualExistingResult.data || [])) {
            if (!keepManual.has(lower(row.codigo_manual))) {
                const { error } = await client
                    .from('proyecto_materiales_no_listados')
                    .delete()
                    .eq('proyecto_numero', project)
                    .eq('codigo_manual', row.codigo_manual);
                assertNoError(error, `No se pudo quitar ${row.codigo_manual} del plan.`);
            }
        }

        return listProjectPlan(project);
    }

    function missingProjectSchemaColumn(error) {
        const message = errorMessage(error);
        const patterns = [
            /Could not find the ['"]([^'"]+)['"] column of ['"]proyectos['"] in the schema cache/i,
            /column ['"]?([^'"\s]+)['"]? of relation ['"]?proyectos['"]? does not exist/i,
            /column ['"]?([^'"\s]+)['"]? does not exist/i
        ];
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match?.[1]) return match[1];
        }
        return '';
    }

    async function persistProjectWithSchemaCompatibility(row, original = '') {
        const working = { ...row };
        const removable = new Set(['tipo_control', 'presupuesto_planeado', 'presupuesto_materiales', 'presupuesto_sueldos', 'updated_at']);
        const omitted = [];

        for (let attempt = 0; attempt < 7; attempt += 1) {
            const result = original
                ? await client.from('proyectos').update(working).eq('numero_proyecto', original)
                : await client.from('proyectos').insert(working);

            if (!result.error) return { omitted };

            const column = missingProjectSchemaColumn(result.error);
            if (!column || !removable.has(column) || !Object.prototype.hasOwnProperty.call(working, column)) {
                assertNoError(result.error, original ? 'No se pudo actualizar el proyecto.' : 'No se pudo crear el proyecto.');
            }

            if ((column === 'tipo_control' || column === 'presupuesto_planeado') && row.tipo_control === 'presupuesto') {
                throw new Error(`La base todavía no tiene la columna ${column}. Ejecuta SQL_MAESTRO_CRM V30 antes de crear proyectos por presupuesto.`);
            }

            delete working[column];
            omitted.push(column);
        }

        throw new Error('No se pudo adaptar la creación del proyecto al esquema actual de Supabase. Ejecuta SQL_MAESTRO_CRM V30.');
    }

    async function saveProject(project, originalNumber = '') {
        const original = text(originalNumber);
        const row = {
            numero_proyecto: text(project.proyecto ?? project.numero_proyecto),
            nombre_proyecto: text(project.nombreProyecto ?? project.nombre_proyecto),
            cliente: text(project.cliente),
            orden_compra: text(project.ordenCompra ?? project.orden_compra) || null,
            planta: text(project.planta),
            nave: text(project.nave) || null,
            responsable_skilled: text(project.responsableSkilled ?? project.responsable_skilled),
            fecha_asignacion: project.fechaAsignacion ?? project.fecha_asignacion ?? null,
            fecha_entrega: project.fechaEntrega ?? project.fecha_entrega ?? null,
            tipo_control: text(project.tipoControl ?? project.tipo_control) === 'presupuesto' ? 'presupuesto' : 'materiales',
            updated_at: new Date().toISOString()
        };
        if (row.tipo_control === 'presupuesto') {
            row.presupuesto_planeado = Math.max(0, number(project.presupuestoPlaneado ?? project.presupuesto_planeado));
        }

        if (!row.numero_proyecto || !row.nombre_proyecto || !row.cliente || !row.planta ||
            !row.responsable_skilled || !row.fecha_asignacion || !row.fecha_entrega) {
            throw new Error('Completa todos los campos obligatorios del proyecto.');
        }
        if (row.fecha_entrega < row.fecha_asignacion) {
            throw new Error('La fecha de entrega no puede ser anterior a la fecha de asignación.');
        }

        const compatibility = await persistProjectWithSchemaCompatibility(row, original);

        if (original && original !== row.numero_proyecto) {
            const { error: movementError } = await client
                .from('movimientos')
                .update({ proyecto: row.numero_proyecto })
                .eq('proyecto', original);
            assertNoError(movementError, 'El proyecto se actualizó, pero no sus movimientos relacionados.');
        }

        return { ok: true, proyecto: row.numero_proyecto, columnasOmitidas: compatibility.omitted };
    }

    async function deleteProject(projectNumber) {
        const project = text(projectNumber);
        if (!project) throw new Error('Falta el número del proyecto.');
        const { error } = await client
            .from('proyectos')
            .delete()
            .eq('numero_proyecto', project);
        assertNoError(error, 'No se pudo eliminar el proyecto.');
        return { ok: true, proyecto: project };
    }


    function categoryFromDb(row) {
        return {
            nombre: text(row.nombre),
            imagen: text(row.imagen_url),
            imagen_url: text(row.imagen_url),
            descripcion: text(row.descripcion),
            activo: row.activo !== false
        };
    }

    async function listCategories(options = {}) {
        const rows = await collectRows(() =>
            client.from('categorias_materiales').select('*').order('nombre', { ascending: true })
        );
        const categories = rows.map(categoryFromDb);
        return options.includeInactive === true ? categories : categories.filter(item => item.activo !== false);
    }

    async function saveCategory(category, originalName = '') {
        const row = {
            nombre: text(category.nombre),
            imagen_url: text(category.imagen ?? category.imagen_url) || null,
            descripcion: text(category.descripcion) || null,
            activo: category.activo !== false,
            updated_at: new Date().toISOString()
        };
        if (!row.nombre) throw new Error('El nombre de la categoría es obligatorio.');

        const original = text(originalName);
        if (original && lower(original) !== lower(row.nombre)) {
            const { error: insertError } = await client.from('categorias_materiales').insert(row);
            assertNoError(insertError, 'No se pudo renombrar la categoría.');
            const { error: materialError } = await client
                .from('materiales')
                .update({ categoria: row.nombre, updated_at: new Date().toISOString() })
                .eq('categoria', original);
            assertNoError(materialError, 'La categoría se creó, pero no se actualizaron sus materiales.');
            const { error: deleteError } = await client.from('categorias_materiales').delete().eq('nombre', original);
            assertNoError(deleteError, 'La categoría se renombró, pero no se pudo retirar el nombre anterior.');
        } else {
            const { error } = await client
                .from('categorias_materiales')
                .upsert(row, { onConflict: 'nombre' });
            assertNoError(error, 'No se pudo guardar la categoría.');
        }
        return categoryFromDb(row);
    }

    async function deleteCategory(name, options = {}) {
        const nombre = text(name);
        if (!nombre) throw new Error('Falta el nombre de la categoría.');
        const withMaterials = options.withMaterials === true || options.eliminarMateriales === true;

        const { count, error: countError } = await client
            .from('materiales')
            .select('codigo', { count: 'exact', head: true })
            .eq('categoria', nombre)
            .neq('activo', false);
        assertNoError(countError);

        if ((count || 0) > 0 && !withMaterials) {
            throw new Error('La categoría contiene materiales. Confirma que deseas retirarla junto con sus materiales.');
        }

        if (withMaterials && (count || 0) > 0) {
            const { error: materialsError } = await client
                .from('materiales')
                .update({ activo: false, updated_at: new Date().toISOString() })
                .eq('categoria', nombre);
            assertNoError(materialsError, 'No se pudieron retirar los materiales de la categoría.');
        }

        const { error } = await client
            .from('categorias_materiales')
            .update({ activo: false, updated_at: new Date().toISOString() })
            .eq('nombre', nombre);
        assertNoError(error, 'No se pudo retirar la categoría.');
        return { ok: true, nombre, materialesRetirados: withMaterials ? Number(count || 0) : 0 };
    }

    async function deletePurchaseRequests(ids = []) {
        const requestIds = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
        if (!requestIds.length) throw new Error('Selecciona al menos una solicitud de compra.');
        const { error } = await client.from('solicitudes_compra').delete().in('id', requestIds);
        if (error?.code === '23503') throw new Error('La orden tiene recepciones o referencias relacionadas y no puede borrarse. Cancélala para conservar la trazabilidad.');
        assertNoError(error, 'No se pudo eliminar la orden de compra.');
        return { ok: true, ids: requestIds };
    }

    async function runTestCleanupRpc(functionName, args = {}, errorMessage = 'No se pudo eliminar el registro de prueba.') {
        const { data, error } = await client.rpc(functionName, args);
        if (error && ['PGRST202', '42883'].includes(error.code)) {
            throw new Error('La limpieza segura todavía no está instalada. Ejecuta la versión más reciente de SQL_MAESTRO_CRM.sql y vuelve a intentarlo.');
        }
        if (error?.code === '42501') throw new Error(error.message || 'Tu perfil no tiene permiso para eliminar registros de prueba.');
        if (error && /DELETE requires a WHERE clause/i.test(String(error.message || ''))) {
            throw new Error('La base de datos todavía tiene la versión anterior de la limpieza. Ejecuta SQL_MAESTRO_CRM.sql V27 y vuelve a intentarlo.');
        }
        assertNoError(error, errorMessage);
        return data && typeof data === 'object' ? data : { ok: true };
    }

    async function removeStoragePaths(bucket, paths = []) {
        const cleanPaths = [...new Set((Array.isArray(paths) ? paths : [paths]).map(text).filter(Boolean))];
        if (!cleanPaths.length) return { ok: true, eliminados: 0, errores: [] };
        const errors = [];
        let deleted = 0;
        for (let i = 0; i < cleanPaths.length; i += 100) {
            const batch = cleanPaths.slice(i, i + 100);
            const { data, error } = await client.storage.from(bucket).remove(batch);
            if (error) {
                errors.push(error.message || String(error));
                continue;
            }
            deleted += Array.isArray(data) ? data.length : batch.length;
        }
        return { ok: errors.length === 0, eliminados: deleted, errores: errors };
    }

    async function deletePurchaseRequestsTest(ids = []) {
        const requestIds = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
        if (!requestIds.length) throw new Error('Selecciona al menos una orden de compra.');
        const result = await runTestCleanupRpc('crm_eliminar_orden_compra_prueba', { p_ids: requestIds }, 'No se pudo eliminar la orden de compra de prueba.');
        const storage = await removeStoragePaths('ordenes-compra', result?.pdf_paths || result?.pdfPaths || []);
        return { ...result, pdf_eliminados: storage.eliminados, advertencia_storage: storage.errores.join(' | ') || null };
    }

    async function deleteAllPurchaseOrdersTest(password) {
        const result = await runTestCleanupRpc('crm_borrar_ordenes_compra_prueba', { p_clave: text(password) }, 'No se pudieron borrar las órdenes de compra de prueba.');
        const storage = await removeStoragePaths('ordenes-compra', result?.pdf_paths || result?.pdfPaths || []);
        return { ...result, pdf_eliminados: storage.eliminados, advertencia_storage: storage.errores.join(' | ') || null };
    }

    async function deleteMovementTest(payload = {}) {
        const requestId = text(payload.requestId ?? payload.request_id);
        const movementId = Number(payload.id ?? payload.movimientoId ?? payload.movimiento_id ?? 0) || null;
        if (!requestId && !movementId) throw new Error('Falta identificar el movimiento.');
        return runTestCleanupRpc('crm_eliminar_movimiento_prueba', { p_request_id: requestId || null, p_movimiento_id: movementId }, 'No se pudo eliminar el movimiento de prueba.');
    }


    async function deleteMovementHistoryTest(password) {
        return runTestCleanupRpc('crm_borrar_historial_movimientos', { p_clave: text(password) }, 'No se pudo borrar el historial de movimientos.');
    }

    async function deleteToolUnitsTest(password) {
        return runTestCleanupRpc('crm_borrar_unidades_herramientas', { p_clave: text(password) }, 'No se pudieron borrar las unidades de herramientas.');
    }

    async function deleteMaterialRequestTest(id) {
        const requestId = Number(id);
        if (!requestId) throw new Error('Solicitud de material no válida.');
        return runTestCleanupRpc('crm_eliminar_solicitud_material_prueba', { p_id: requestId }, 'No se pudo eliminar la solicitud de material de prueba.');
    }

    async function deleteMaterialAdjustmentTest(id) {
        const adjustmentId = Number(id);
        if (!adjustmentId) throw new Error('Reajuste no válido.');
        return runTestCleanupRpc('crm_eliminar_reajuste_material_prueba', { p_id: adjustmentId }, 'No se pudo eliminar el reajuste de prueba.');
    }

    async function deleteToolHistoryTest(id) {
        const historyId = Number(id);
        if (!historyId) throw new Error('Evento de historial no válido.');
        return runTestCleanupRpc('crm_eliminar_historial_herramienta_prueba', { p_id: historyId }, 'No se pudo eliminar el evento de historial de prueba.');
    }

    async function deleteToolTest(id) {
        const toolId = Number(id);
        if (!toolId) throw new Error('Herramienta no válida.');
        return runTestCleanupRpc('crm_eliminar_herramienta_prueba', { p_id: toolId }, 'No se pudo eliminar la herramienta de prueba.');
    }

    async function deleteToolUnitTest(id) {
        const unitId = Number(id);
        if (!unitId) throw new Error('Unidad de herramienta no válida.');
        return runTestCleanupRpc('crm_eliminar_unidad_herramienta_prueba', { p_id: unitId }, 'No se pudo eliminar la unidad de herramienta de prueba.');
    }

    async function deleteToolAssignmentTest(id) {
        const assignmentId = Number(id);
        if (!assignmentId) throw new Error('Asignación de herramienta no válida.');
        return runTestCleanupRpc('crm_eliminar_asignacion_herramienta_prueba', { p_id: assignmentId }, 'No se pudo eliminar la asignación de herramienta de prueba.');
    }

    async function deleteProjectTest(projectNumber) {
        const project = text(projectNumber);
        if (!project) throw new Error('Falta el número del proyecto.');
        return runTestCleanupRpc('crm_eliminar_proyecto_prueba', { p_proyecto: project }, 'No se pudo eliminar el proyecto de prueba.');
    }

    async function deleteVehicleTest(id) {
        const vehicleId = Number(id);
        if (!vehicleId) throw new Error('Vehículo no válido.');
        return runTestCleanupRpc('crm_eliminar_vehiculo_prueba', { p_id: vehicleId }, 'No se pudo eliminar el vehículo de prueba.');
    }

    async function updateWarehouseInventoryLevels(payloads = []) {
        const source = Array.isArray(payloads) ? payloads : [payloads];
        const rows = source.map(payload => {
            const code = text(payload.codigo ?? payload.materialCodigo ?? payload.material_codigo);
            const warehouseId = Number(payload.almacenId ?? payload.warehouseId ?? payload.almacen_id ?? 0);
            if (!code || !warehouseId) return null;
            const levels = normalizeStockLevels(payload.stockMinimo, payload.stockMedio, payload.stockMaximo);
            return {
                codigo: code,
                almacen_id: warehouseId,
                stock_minimo: levels.minimum,
                stock_medio: levels.medium,
                stock_maximo: levels.maximum
            };
        }).filter(Boolean);
        if (!rows.length) return { actualizados: 0, omitidos: source.length };

        const { data, error } = await client.rpc('crm_actualizar_niveles_stock_lote', { p_items: rows });
        if (!error) return { actualizados: Number(data) || 0, omitidos: Math.max(0, source.length - rows.length) };

        const message = errorMessage(error);
        if (!/crm_actualizar_niveles_stock_lote|function|schema cache|PGRST202/i.test(message)) {
            throw new Error(`No se pudieron actualizar los niveles de stock. ${message}`);
        }

        let updated = 0;
        for (const row of rows) {
            const { data: item, error: itemError } = await client
                .from('existencias_almacen')
                .update({
                    stock_minimo: row.stock_minimo,
                    stock_medio: row.stock_medio,
                    stock_maximo: row.stock_maximo,
                    updated_at: new Date().toISOString()
                })
                .eq('material_codigo', row.codigo)
                .eq('almacen_id', row.almacen_id)
                .select('material_codigo')
                .maybeSingle();
            assertNoError(itemError, 'No se pudieron actualizar los niveles de stock.');
            if (item) updated += 1;
        }
        return { actualizados: updated, omitidos: Math.max(0, source.length - rows.length) };
    }

    async function listLowStock(options = {}) {
        const warehouseId = Number(options.warehouseId ?? options.almacenId ?? 0);
        const category = lower(options.categoria);
        const search = lower(options.buscar ?? options.search);
        const materials = await listMaterials();
        const rows = [];

        materials.forEach(material => {
            const inventories = Array.isArray(material.almacenes) ? material.almacenes : [];
            if (!inventories.length) {
                const minimum = number(material.stockMinimo);
                const maximum = number(material.stockMaximo);
                if (minimum <= 0) return;
                rows.push({
                    ...material,
                    almacenId: null,
                    almacenNombre: 'Sin almacén asignado',
                    stockAlmacen: 0,
                    stockMinimoAlmacen: minimum,
                    stockMedioAlmacen: number(material.stockMedio),
                    stockMaximoAlmacen: maximum,
                    cantidadReposicionSugerida: Math.max(1, maximum || minimum),
                    estadoStock: 'agotado'
                });
                return;
            }
            inventories.forEach(inventory => {
                const stock = number(inventory.stock);
                const levels = normalizeStockLevels(inventory.stockMinimo, inventory.stockMedio, inventory.stockMaximo);
                const minimum = levels.minimum;
                if (warehouseId && Number(inventory.id) !== warehouseId) return;
                if (minimum <= 0 || stock >= minimum) return;
                rows.push({
                    ...material,
                    almacenId: Number(inventory.id),
                    almacenNombre: text(inventory.nombre),
                    ubicacionAlmacen: text(inventory.ubicacion),
                    stockAlmacen: stock,
                    stockMinimoAlmacen: minimum,
                    stockMedioAlmacen: levels.medium,
                    stockMaximoAlmacen: levels.maximum,
                    cantidadReposicionSugerida: Math.max(0, levels.maximum - stock),
                    estadoStock: stock <= 0 ? 'agotado' : 'bajo'
                });
            });
        });

        return rows.filter(row => {
            if (category && lower(row.categoria) !== category) return false;
            if (search) {
                const values = [row.codigo, row.descripcion, row.categoria, row.almacenNombre, row.marca, row.proveedor, row.contactoProveedor, ...(Array.isArray(row.modismos) ? row.modismos : [])];
                const hay = window.SkilledSearch?.matches ? window.SkilledSearch.matches(values, search) : values.some(value => lower(value).includes(search));
                if (!hay) return false;
            }
            return true;
        }).sort((a, b) => {
            if (a.estadoStock !== b.estadoStock) return a.estadoStock === 'agotado' ? -1 : 1;
            return text(a.descripcion).localeCompare(text(b.descripcion), 'es');
        });
    }

    async function listProjectOptions() {
        const rows = await getProjectsRaw();
        return rows.map(row => ({
            proyecto: text(row.numero_proyecto),
            numeroProyecto: text(row.numero_proyecto),
            nombreProyecto: text(row.nombre_proyecto),
            cliente: text(row.cliente),
            planta: text(row.planta),
            nave: text(row.nave),
            ordenCompra: text(row.orden_compra),
            responsableSkilled: text(row.responsable_skilled)
        }));
    }


    function purchaseRequestFromDb(row, warehouseById = new Map()) {
        const warehouse = warehouseById.get(Number(row.almacen_id)) || {};
        return {
            id: Number(row.id),
            folio: text(row.folio),
            materialCodigo: text(row.material_codigo),
            codigo: text(row.material_codigo),
            descripcion: text(row.descripcion),
            categoria: text(row.categoria),
            unidad: text(row.unidad),
            almacenId: row.almacen_id == null ? null : Number(row.almacen_id),
            almacenNombre: text(warehouse.nombre) || text(row.almacen_nombre),
            existenciaActual: number(row.existencia_actual),
            stockMinimo: number(row.stock_minimo),
            stockMedio: number(row.stock_medio),
            stockMaximo: number(row.stock_maximo),
            cantidadSolicitada: number(row.cantidad_solicitada),
            cantidadRecibida: number(row.cantidad_recibida),
            prioridad: text(row.prioridad) || 'normal',
            estado: text(row.estado) || 'pendiente',
            proveedor: text(row.proveedor),
            contactoProveedor: text(row.contacto_proveedor),
            contacto_proveedor: text(row.contacto_proveedor),
            grupoOrden: text(row.grupo_orden),
            grupo_orden: text(row.grupo_orden),
            pdfUrl: text(row.pdf_url),
            pdf_url: text(row.pdf_url),
            pdfPath: text(row.pdf_path),
            pdf_path: text(row.pdf_path),
            pdfNombre: text(row.pdf_nombre),
            pdf_nombre: text(row.pdf_nombre),
            ordenCompra: text(row.orden_compra),
            fechaOrdenCompra: text(row.fecha_orden_compra),
            referencia: text(row.referencia),
            motivo: text(row.motivo),
            solicitadoPor: text(row.solicitado_por),
            fechaRequerida: text(row.fecha_requerida),
            estadoCompras: text(row.estado_compras) || 'no_revisada',
            estado_compras: text(row.estado_compras) || 'no_revisada',
            cotizacionId: text(row.cotizacion_id),
            cotizacion_id: text(row.cotizacion_id),
            cotizacionItemId: Number(row.cotizacion_item_id || 0) || null,
            cotizacion_item_id: Number(row.cotizacion_item_id || 0) || null,
            proveedorId: Number(row.proveedor_id || 0) || null,
            proveedor_id: Number(row.proveedor_id || 0) || null,
            precioCotizado: number(row.precio_cotizado),
            precio_cotizado: number(row.precio_cotizado),
            moneda: text(row.moneda) || 'MXN',
            plazoEntregaDias: number(row.plazo_entrega_dias),
            plazo_entrega_dias: number(row.plazo_entrega_dias),
            motivoNoViable: text(row.motivo_no_viable),
            motivo_no_viable: text(row.motivo_no_viable),
            fechaCompra: text(row.fecha_compra),
            fecha_compra: text(row.fecha_compra),
            revisadaPor: text(row.revisada_por),
            revisadaAt: text(row.revisada_at),
            direccionEntregaId: row.direccion_entrega_id == null ? null : Number(row.direccion_entrega_id),
            direccion_entrega_id: row.direccion_entrega_id == null ? null : Number(row.direccion_entrega_id),
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    function generatePurchaseRequestFolio() {
        const now = new Date();
        const pad = value => String(value).padStart(2, '0');
        const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `SC-${date}-${time}-${random}`;
    }

    async function listPurchaseRequests(options = {}) {
        let query = client
            .from('solicitudes_compra')
            .select('*')
            .order('created_at', { ascending: false });

        const status = text(options.estado ?? options.status);
        const warehouseId = Number(options.almacenId ?? options.warehouseId ?? 0);
        const activeOnly = Boolean(options.activeOnly);
        const quotationId = text(options.cotizacionId ?? options.quotationId);
        if (status) query = query.eq('estado', status);
        if (warehouseId) query = query.eq('almacen_id', warehouseId);
        if (quotationId) query = query.eq('cotizacion_id', quotationId);
        if (activeOnly) query = query.in('estado', ['pendiente', 'autorizada', 'ordenada', 'parcial']);

        const { data, error } = await query;
        assertNoError(error, 'No se pudieron consultar las solicitudes de compra.');
        const warehouses = await listWarehouses();
        const warehouseById = new Map(warehouses.map(row => [Number(row.id), row]));
        return (Array.isArray(data) ? data : []).map(row => purchaseRequestFromDb(row, warehouseById));
    }

    async function listPurchaseOrderItems(orderNumber) {
        const order = text(orderNumber);
        if (!order) throw new Error('Escribe la orden de compra de los materiales.');
        const { data, error } = await client
            .from('solicitudes_compra')
            .select('*')
            .ilike('orden_compra', order)
            .neq('estado', 'cancelada')
            .order('created_at', { ascending: true });
        assertNoError(error, 'No se pudo consultar la orden de compra.');
        const rows = Array.isArray(data) ? data : [];
        if (!rows.length) return [];
        const [materials, warehouses] = await Promise.all([listMaterials(), listWarehouses()]);
        const byCode = new Map(materials.map(item => [lower(item.codigo), item]));
        const warehouseById = new Map(warehouses.map(item => [Number(item.id), item]));
        return rows.map(row => {
            const material = byCode.get(lower(row.material_codigo)) || {
                codigo: text(row.material_codigo),
                descripcion: text(row.descripcion),
                desc: text(row.descripcion),
                categoria: text(row.categoria),
                unidad: text(row.unidad),
                precio: 0,
                stock: 0,
                imagen: ''
            };
            const requested = number(row.cantidad_solicitada);
            const received = number(row.cantidad_recibida);
            const warehouse = warehouseById.get(Number(row.almacen_id)) || {};
            return {
                id: Number(row.id),
                folio: text(row.folio),
                ordenCompra: text(row.orden_compra),
                fechaOrdenCompra: text(row.fecha_orden_compra),
                referencia: text(row.referencia),
                proveedor: text(row.proveedor),
                contactoProveedor: text(row.contacto_proveedor),
                solicitadoPor: text(row.solicitado_por),
                prioridad: text(row.prioridad) || 'normal',
                motivo: text(row.motivo),
                estado: text(row.estado),
                cantidadSolicitada: requested,
                cantidadRecibida: received,
                pendiente: Math.max(0, requested - received),
                stockMinimo: number(row.stock_minimo),
                stockMedio: number(row.stock_medio),
                stockMaximo: number(row.stock_maximo),
                almacenId: row.almacen_id == null ? null : Number(row.almacen_id),
                almacenNombre: text(warehouse.nombre) || text(row.almacen_nombre),
                categoria: text(row.categoria) || text(material.categoria),
                unidad: text(row.unidad) || text(material.unidad),
                descripcion: text(row.descripcion) || text(material.descripcion ?? material.desc),
                material
            };
        });
    }

    async function createPurchaseRequest(payload) {
        const materialCode = text(payload.materialCodigo ?? payload.codigo);
        const warehouseId = Number(payload.almacenId ?? payload.warehouseId ?? 0) || null;
        const description = text(payload.descripcion ?? payload.desc);
        const quantity = number(payload.cantidadSolicitada ?? payload.cantidad);
        if (!materialCode || !description) throw new Error('Falta el material para crear la solicitud.');
        if (quantity <= 0) throw new Error('La cantidad solicitada debe ser mayor a cero.');

        let existingQuery = client
            .from('solicitudes_compra')
            .select('id,folio,estado')
            .eq('material_codigo', materialCode)
            .in('estado', ['pendiente', 'autorizada', 'ordenada', 'parcial'])
            .limit(1);
        existingQuery = warehouseId
            ? existingQuery.eq('almacen_id', warehouseId)
            : existingQuery.is('almacen_id', null);
        const { data: existing, error: existingError } = await existingQuery.maybeSingle();
        assertNoError(existingError);
        if (existing) {
            throw new Error(`Ya existe una solicitud activa para este material (${existing.folio}).`);
        }

        const row = {
            folio: generatePurchaseRequestFolio(),
            material_codigo: materialCode,
            descripcion: description,
            categoria: text(payload.categoria) || null,
            unidad: text(payload.unidad) || null,
            almacen_id: warehouseId,
            almacen_nombre: text(payload.almacenNombre) || null,
            existencia_actual: number(payload.existenciaActual ?? payload.stockActual),
            stock_minimo: number(payload.stockMinimo),
            stock_medio: number(payload.stockMedio),
            stock_maximo: number(payload.stockMaximo),
            cantidad_solicitada: quantity,
            cantidad_recibida: 0,
            prioridad: ['normal', 'urgente'].includes(lower(payload.prioridad)) ? lower(payload.prioridad) : 'normal',
            estado: 'pendiente',
            proveedor: text(payload.proveedor) || null,
            contacto_proveedor: text(payload.contactoProveedor ?? payload.contacto_proveedor) || null,
            orden_compra: text(payload.ordenCompra ?? payload.orden_compra) || null,
            grupo_orden: text(payload.grupoOrden ?? payload.grupo_orden) || null,
            pdf_url: text(payload.pdfUrl ?? payload.pdf_url) || null,
            pdf_path: text(payload.pdfPath ?? payload.pdf_path) || null,
            pdf_nombre: text(payload.pdfNombre ?? payload.pdf_nombre) || null,
            motivo: text(payload.motivo) || null,
            solicitado_por: text(payload.solicitadoPor) || null,
            fecha_requerida: text(payload.fechaRequerida) || null,
            fecha_orden_compra: text(payload.fechaOrdenCompra ?? payload.fecha_orden_compra) || null,
            referencia: text(payload.referencia) || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const { data, error } = await client
            .from('solicitudes_compra')
            .insert(row)
            .select('*')
            .single();
        if (error && error.code === '23505') {
            throw new Error('Ya existe una solicitud activa para este material y almacén.');
        }
        assertNoError(error, 'No se pudo crear la solicitud de compra.');
        const warehouses = await listWarehouses();
        return purchaseRequestFromDb(data, new Map(warehouses.map(item => [Number(item.id), item])));
    }

    async function createPurchaseRequests(payloads = []) {
        const input = Array.isArray(payloads) ? payloads : [];
        if (!input.length) throw new Error('Selecciona al menos un material.');
        const normalized = input.map(payload => {
            const materialCode = text(payload.materialCodigo ?? payload.codigo);
            const description = text(payload.descripcion ?? payload.desc);
            const quantity = number(payload.cantidadSolicitada ?? payload.cantidad);
            const warehouseId = Number(payload.almacenId ?? payload.warehouseId ?? 0) || null;
            if (!materialCode || !description) throw new Error('Existe un material sin código o descripción.');
            if (quantity <= 0) throw new Error(`La cantidad de ${materialCode} debe ser mayor a cero.`);
            return { payload, materialCode, description, quantity, warehouseId };
        });
        const codes = [...new Set(normalized.map(item => item.materialCode))];
        const { data: existingRows, error: existingError } = await client
            .from('solicitudes_compra')
            .select('id,folio,material_codigo,almacen_id,estado')
            .in('material_codigo', codes)
            .in('estado', ['pendiente', 'autorizada', 'ordenada', 'parcial']);
        assertNoError(existingError, 'No se pudieron validar las solicitudes activas.');
        const conflict = normalized.find(item => (existingRows || []).some(row => lower(row.material_codigo) === lower(item.materialCode) && Number(row.almacen_id || 0) === Number(item.warehouseId || 0)));
        if (conflict) {
            const request = (existingRows || []).find(row => lower(row.material_codigo) === lower(conflict.materialCode) && Number(row.almacen_id || 0) === Number(conflict.warehouseId || 0));
            throw new Error(`Ya existe una solicitud activa para ${conflict.materialCode}${request?.folio ? ` (${request.folio})` : ''}.`);
        }
        const now = new Date().toISOString();
        const rows = normalized.map(({ payload, materialCode, description, quantity, warehouseId }) => ({
            folio: generatePurchaseRequestFolio(),
            material_codigo: materialCode,
            descripcion: description,
            categoria: text(payload.categoria) || null,
            unidad: text(payload.unidad) || null,
            almacen_id: warehouseId,
            almacen_nombre: text(payload.almacenNombre) || null,
            existencia_actual: number(payload.existenciaActual ?? payload.stockActual),
            stock_minimo: number(payload.stockMinimo),
            stock_medio: number(payload.stockMedio),
            stock_maximo: number(payload.stockMaximo),
            cantidad_solicitada: quantity,
            cantidad_recibida: number(payload.cantidadRecibida),
            prioridad: lower(payload.prioridad) === 'urgente' ? 'urgente' : 'normal',
            estado: text(payload.estado) || 'pendiente',
            proveedor: text(payload.proveedor) || null,
            contacto_proveedor: text(payload.contactoProveedor ?? payload.contacto_proveedor) || null,
            orden_compra: text(payload.ordenCompra ?? payload.orden_compra) || null,
            grupo_orden: text(payload.grupoOrden ?? payload.grupo_orden) || null,
            pdf_url: text(payload.pdfUrl ?? payload.pdf_url) || null,
            pdf_path: text(payload.pdfPath ?? payload.pdf_path) || null,
            pdf_nombre: text(payload.pdfNombre ?? payload.pdf_nombre) || null,
            motivo: text(payload.motivo) || null,
            solicitado_por: text(payload.solicitadoPor) || null,
            fecha_requerida: text(payload.fechaRequerida) || null,
            fecha_orden_compra: text(payload.fechaOrdenCompra ?? payload.fecha_orden_compra) || null,
            referencia: text(payload.referencia) || null,
            created_at: now,
            updated_at: now
        }));
        const { data, error } = await client.from('solicitudes_compra').insert(rows).select('*');
        assertNoError(error, 'No se pudieron crear las solicitudes de la orden de compra.');
        const warehouses = await listWarehouses();
        const warehouseById = new Map(warehouses.map(item => [Number(item.id), item]));
        return (data || []).map(row => purchaseRequestFromDb(row, warehouseById));
    }

    async function uploadPurchaseOrderPdf(orderNumber, file, requestIds = []) {
        const order = text(orderNumber) || `OC-${Date.now()}`;
        if (!(file instanceof Blob)) throw new Error('El archivo PDF no es válido.');
        if (file.size > 10 * 1024 * 1024) throw new Error('El PDF no puede superar 10 MB.');
        const normalized = order.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'ORDEN';
        const now = new Date();
        const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${normalized}_${Date.now()}.pdf`;
        const { error } = await client.storage.from('ordenes-compra').upload(path, file, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: false
        });
        assertNoError(error, 'No se pudo guardar el PDF de la orden de compra.');
        const { data } = client.storage.from('ordenes-compra').getPublicUrl(path);
        const url = text(data?.publicUrl);
        if (!url) throw new Error('No se pudo obtener la dirección del PDF.');
        const ids = (Array.isArray(requestIds) ? requestIds : [requestIds]).map(Number).filter(Boolean);
        if (ids.length) {
            const { error: updateError } = await client.from('solicitudes_compra').update({
                pdf_url: url,
                pdf_path: path,
                pdf_nombre: `${normalized}.pdf`,
                updated_at: new Date().toISOString()
            }).in('id', ids);
            assertNoError(updateError, 'El PDF se guardó, pero no se pudo asociar a las solicitudes.');
        }
        return { url, path, nombre: `${normalized}.pdf` };
    }

    async function getPurchaseOrderPdfUrl(request = {}) {
        const direct = text(request.pdfUrl ?? request.pdf_url);
        if (direct) return direct;
        const path = text(request.pdfPath ?? request.pdf_path);
        if (!path) return '';
        const { data } = client.storage.from('ordenes-compra').getPublicUrl(path);
        return text(data?.publicUrl);
    }

    async function updatePurchaseRequest(id, changes = {}) {
        const requestId = Number(id);
        if (!requestId) throw new Error('Solicitud de compra no válida.');
        const row = { updated_at: new Date().toISOString() };
        if ('cantidadSolicitada' in changes) row.cantidad_solicitada = number(changes.cantidadSolicitada);
        if ('cantidadRecibida' in changes) row.cantidad_recibida = number(changes.cantidadRecibida);
        if ('prioridad' in changes) row.prioridad = lower(changes.prioridad) === 'urgente' ? 'urgente' : 'normal';
        if ('estado' in changes) row.estado = lower(changes.estado);
        if ('proveedor' in changes) row.proveedor = text(changes.proveedor) || null;
        if ('contactoProveedor' in changes || 'contacto_proveedor' in changes) row.contacto_proveedor = text(changes.contactoProveedor ?? changes.contacto_proveedor) || null;
        if ('grupoOrden' in changes || 'grupo_orden' in changes) row.grupo_orden = text(changes.grupoOrden ?? changes.grupo_orden) || null;
        if ('pdfUrl' in changes || 'pdf_url' in changes) row.pdf_url = text(changes.pdfUrl ?? changes.pdf_url) || null;
        if ('pdfPath' in changes || 'pdf_path' in changes) row.pdf_path = text(changes.pdfPath ?? changes.pdf_path) || null;
        if ('pdfNombre' in changes || 'pdf_nombre' in changes) row.pdf_nombre = text(changes.pdfNombre ?? changes.pdf_nombre) || null;
        if ('ordenCompra' in changes) row.orden_compra = text(changes.ordenCompra) || null;
        if ('fechaOrdenCompra' in changes || 'fecha_orden_compra' in changes) row.fecha_orden_compra = text(changes.fechaOrdenCompra ?? changes.fecha_orden_compra) || null;
        if ('referencia' in changes) row.referencia = text(changes.referencia) || null;
        if ('motivo' in changes) row.motivo = text(changes.motivo) || null;
        if ('solicitadoPor' in changes) row.solicitado_por = text(changes.solicitadoPor) || null;
        if ('fechaRequerida' in changes) row.fecha_requerida = text(changes.fechaRequerida) || null;
        if ('estadoCompras' in changes || 'estado_compras' in changes) {
            row.estado_compras = lower(changes.estadoCompras ?? changes.estado_compras) || 'no_revisada';
            row.revisada_at = new Date().toISOString();
        }
        if ('motivoNoViable' in changes || 'motivo_no_viable' in changes) row.motivo_no_viable = text(changes.motivoNoViable ?? changes.motivo_no_viable) || null;
        if ('fechaCompra' in changes || 'fecha_compra' in changes) row.fecha_compra = text(changes.fechaCompra ?? changes.fecha_compra) || null;
        if ('direccionEntregaId' in changes || 'direccion_entrega_id' in changes) row.direccion_entrega_id = Number(changes.direccionEntregaId ?? changes.direccion_entrega_id) || null;

        if (row.cantidad_solicitada != null && row.cantidad_solicitada <= 0) {
            throw new Error('La cantidad solicitada debe ser mayor a cero.');
        }
        const validStatus = ['pendiente', 'autorizada', 'ordenada', 'parcial', 'recibida', 'cancelada'];
        if (row.estado && !validStatus.includes(row.estado)) throw new Error('Estado de solicitud no válido.');
        const validPurchaseStatus = ['no_revisada','en_revision','compra_realizada','no_viable'];
        if (row.estado_compras && !validPurchaseStatus.includes(row.estado_compras)) throw new Error('Estado de Compras no válido.');
        if (row.estado_compras === 'no_viable' && !row.motivo_no_viable) throw new Error('Captura el motivo por el que no se podrá realizar la compra.');

        const { data, error } = await client
            .from('solicitudes_compra')
            .update(row)
            .eq('id', requestId)
            .select('*')
            .single();
        assertNoError(error, 'No se pudo actualizar la solicitud de compra.');
        const warehouses = await listWarehouses();
        return purchaseRequestFromDb(data, new Map(warehouses.map(item => [Number(item.id), item])));
    }


    async function updatePurchaseRequests(ids = [], changes = {}) {
        const requestIds = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
        if (!requestIds.length) throw new Error('No hay solicitudes para actualizar.');
        const row = { updated_at: new Date().toISOString() };
        if ('prioridad' in changes) row.prioridad = lower(changes.prioridad) === 'urgente' ? 'urgente' : 'normal';
        if ('estado' in changes) row.estado = lower(changes.estado);
        if ('proveedor' in changes) row.proveedor = text(changes.proveedor) || null;
        if ('contactoProveedor' in changes || 'contacto_proveedor' in changes) row.contacto_proveedor = text(changes.contactoProveedor ?? changes.contacto_proveedor) || null;
        if ('ordenCompra' in changes || 'orden_compra' in changes) row.orden_compra = text(changes.ordenCompra ?? changes.orden_compra) || null;
        if ('fechaOrdenCompra' in changes || 'fecha_orden_compra' in changes) row.fecha_orden_compra = text(changes.fechaOrdenCompra ?? changes.fecha_orden_compra) || null;
        if ('referencia' in changes) row.referencia = text(changes.referencia) || null;
        if ('motivo' in changes) row.motivo = text(changes.motivo) || null;
        if ('solicitadoPor' in changes) row.solicitado_por = text(changes.solicitadoPor) || null;
        if ('fechaRequerida' in changes) row.fecha_requerida = text(changes.fechaRequerida) || null;
        if ('estadoCompras' in changes || 'estado_compras' in changes) {
            row.estado_compras = lower(changes.estadoCompras ?? changes.estado_compras) || 'no_revisada';
            row.revisada_at = new Date().toISOString();
        }
        if ('motivoNoViable' in changes || 'motivo_no_viable' in changes) row.motivo_no_viable = text(changes.motivoNoViable ?? changes.motivo_no_viable) || null;
        if ('fechaCompra' in changes || 'fecha_compra' in changes) row.fecha_compra = text(changes.fechaCompra ?? changes.fecha_compra) || null;
        if ('direccionEntregaId' in changes || 'direccion_entrega_id' in changes) row.direccion_entrega_id = Number(changes.direccionEntregaId ?? changes.direccion_entrega_id) || null;
        const validStatus = ['pendiente', 'autorizada', 'ordenada', 'parcial', 'recibida', 'cancelada'];
        if (row.estado && !validStatus.includes(row.estado)) throw new Error('Estado de solicitud no válido.');
        const validPurchaseStatus = ['no_revisada','en_revision','compra_realizada','no_viable'];
        if (row.estado_compras && !validPurchaseStatus.includes(row.estado_compras)) throw new Error('Estado de Compras no válido.');
        if (row.estado_compras === 'no_viable' && !row.motivo_no_viable) throw new Error('Captura el motivo por el que no se podrá realizar la compra.');
        const { data, error } = await client.from('solicitudes_compra').update(row).in('id', requestIds).select('*');
        assertNoError(error, 'No se pudo actualizar la orden de compra.');
        const warehouses = await listWarehouses();
        const warehouseById = new Map(warehouses.map(item => [Number(item.id), item]));
        return (data || []).map(item => purchaseRequestFromDb(item, warehouseById));
    }

    async function transferProjectMaterials(payload = {}) {
        const sourceProject = text(payload.proyectoOrigen ?? payload.sourceProject);
        const mode = lower(payload.modo ?? payload.mode);
        const destinationProject = text(payload.proyectoDestino ?? payload.destinationProject);
        const destinationWarehouse = text(payload.almacenDestino ?? payload.destinationWarehouse);
        let destinationWarehouseId = Number(payload.almacenDestinoId ?? payload.destinationWarehouseId ?? 0) || null;
        if (!sourceProject) throw new Error('Selecciona el proyecto de origen.');
        if (!['almacen', 'proyecto'].includes(mode)) throw new Error('Selecciona el tipo de traspaso.');
        if (mode === 'proyecto' && !destinationProject) throw new Error('Selecciona el proyecto de destino.');
        if (mode === 'almacen' && !destinationWarehouseId) {
            const warehouses = await listWarehouses({ activeOnly: true });
            const warehouse = warehouses.find(item => lower(item.nombre) === lower(destinationWarehouse));
            destinationWarehouseId = Number(warehouse?.id || 0) || null;
        }
        if (mode === 'almacen' && !destinationWarehouseId) throw new Error('Selecciona el almacén de destino.');
        const products = (Array.isArray(payload.productos) ? payload.productos : []).map(item => ({
            codigo: text(item.codigo ?? item.producto?.codigo),
            descripcion: text(item.descripcion ?? item.producto?.descripcion ?? item.producto?.desc),
            unidad: text(item.unidad ?? item.producto?.unidad),
            cantidad: number(item.cantidad),
            cantidadDentroPlan: number(item.cantidadDentroPlan ?? item.cantidad_dentro_plan),
            cantidadFueraPlan: number(item.cantidadFueraPlan ?? item.cantidad_fuera_plan),
            alcance: text(item.alcance)
        })).filter(item => item.codigo && item.cantidad > 0);
        if (!products.length) throw new Error('Agrega al menos un material.');
        const requestId = text(payload.requestId) || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const { data, error } = await client.rpc('crm_transferir_material_proyecto', {
            p_request_id: requestId,
            p_proyecto_origen: sourceProject,
            p_modo: mode,
            p_proyecto_destino: mode === 'proyecto' ? destinationProject : null,
            p_almacen_destino_id: mode === 'almacen' ? destinationWarehouseId : null,
            p_motivo: text(payload.motivo),
            p_productos: products
        });
        assertNoError(error, 'No se pudo registrar el traspaso de sobrantes del proyecto.');
        return data || { ok: true, requestId, registrados: products.length, modo: mode };
    }

    async function loanProjectMaterials(payload = {}) {
        const sourceProject = text(payload.proyectoOrigen ?? payload.sourceProject);
        const destinationType = lower(payload.destinoTipo ?? payload.destinationType) || 'proyecto';
        const destinationProject = text(payload.proyectoDestino ?? payload.destinationProject);
        const destinationWarehouseName = text(payload.almacenDestino ?? payload.destinationWarehouse);
        let destinationWarehouseId = Number(payload.almacenDestinoId ?? payload.destinationWarehouseId ?? 0) || null;
        if (!sourceProject) throw new Error('Selecciona el proyecto que prestará el material.');
        if (!['proyecto', 'almacen'].includes(destinationType)) throw new Error('Selecciona si el préstamo irá a otro proyecto o al almacén general.');
        if (destinationType === 'proyecto' && !destinationProject) throw new Error('Selecciona el proyecto que recibirá el préstamo.');
        if (destinationType === 'proyecto' && lower(sourceProject) === lower(destinationProject)) throw new Error('El proyecto de destino debe ser diferente al proyecto de origen.');
        if (destinationType === 'almacen' && !destinationWarehouseId) {
            const warehouses = await listWarehouses({ activeOnly: true });
            const warehouse = warehouses.find(item => lower(item.nombre) === lower(destinationWarehouseName));
            destinationWarehouseId = Number(warehouse?.id || 0) || null;
        }
        if (destinationType === 'almacen' && !destinationWarehouseId) throw new Error('Selecciona el almacén que recibirá el préstamo.');
        const products = (Array.isArray(payload.productos) ? payload.productos : []).map(item => ({
            codigo: text(item.codigo ?? item.producto?.codigo),
            descripcion: text(item.descripcion ?? item.producto?.descripcion ?? item.producto?.desc),
            unidad: text(item.unidad ?? item.producto?.unidad),
            cantidad: number(item.cantidad)
        })).filter(item => item.codigo && item.cantidad > 0);
        if (!products.length) throw new Error('Agrega al menos un material reservado al préstamo.');
        const requestId = text(payload.requestId) || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const { data, error } = await client.rpc('crm_prestar_material_proyecto_v12141', {
            p_request_id: requestId,
            p_proyecto_origen: sourceProject,
            p_destino_tipo: destinationType,
            p_proyecto_destino: destinationType === 'proyecto' ? destinationProject : null,
            p_almacen_destino_id: destinationType === 'almacen' ? destinationWarehouseId : null,
            p_motivo: text(payload.motivo),
            p_productos: products
        });
        assertNoError(error, 'No se pudo registrar el préstamo de material reservado.');
        return data || {
            ok: true,
            requestId,
            registrados: products.length,
            destinoTipo: destinationType,
            proyectoOrigen: sourceProject,
            proyectoDestino: destinationType === 'proyecto' ? destinationProject : '',
            almacenDestino: destinationType === 'almacen' ? destinationWarehouseName : ''
        };
    }

    function toolPendingFields(source = {}) {
        const explicit = Array.isArray(source.campos_pendientes)
            ? source.campos_pendientes.map(text).filter(Boolean)
            : Array.isArray(source.camposPendientes)
                ? source.camposPendientes.map(text).filter(Boolean)
                : [];
        if (explicit.length) return [...new Set(explicit)];
        const pending = [];
        if (!text(source.clasificacion)) pending.push('clasificacion');
        if (!text(source.marca)) pending.push('marca');
        if (!text(source.modelo)) pending.push('modelo');
        if (!text(source.uso)) pending.push('uso');
        if (!text(source.imagen_url ?? source.imagen ?? source.imagenUrl)) pending.push('imagen');
        return pending;
    }

    function toolFromDb(row, units = []) {
        const activeUnits = units.filter(unit => unit.activo !== false && lower(unit.estado) !== 'baja');
        const counts = activeUnits.reduce((result, unit) => {
            const state = lower(unit.estado) || 'disponible';
            result.total += number(unit.cantidad) || 1;
            if (state === 'disponible') result.disponibles += number(unit.cantidad) || 1;
            else if (state === 'asignada') result.asignadas += number(unit.cantidad) || 1;
            else result.otros += number(unit.cantidad) || 1;
            return result;
        }, { total: 0, disponibles: 0, asignadas: 0, otros: 0 });
        const pending = toolPendingFields(row);
        const incomplete = boolean(row.es_incompleta) || pending.length > 0 && lower(row.origen_alta) === 'herramienta_no_listada';
        return {
            id: Number(row.id),
            sku: text(row.sku),
            descripcion: text(row.descripcion),
            desc: text(row.descripcion),
            clasificacion: text(row.clasificacion),
            marca: text(row.marca),
            modelo: text(row.modelo),
            uso: text(row.uso) || 'OTRO',
            unidad: text(row.unidad) || 'pieza',
            piezasPorUnidad: number(row.piezas_por_unidad) || 1,
            piezas_por_unidad: number(row.piezas_por_unidad) || 1,
            serializada: row.serializada !== false,
            imagen: text(row.imagen_url),
            imagenUrl: text(row.imagen_url),
            imagen_url: text(row.imagen_url),
            esIncompleta: incomplete,
            es_incompleta: incomplete,
            origenAlta: text(row.origen_alta),
            origen_alta: text(row.origen_alta),
            camposPendientes: pending,
            campos_pendientes: pending,
            activo: row.activo !== false,
            unidades: activeUnits,
            ...counts,
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    async function listTools(options = {}) {
        const [tools, units] = await Promise.all([
            collectRows(() => client.from('herramientas_catalogo').select('*').order('descripcion', { ascending: true })),
            collectRows(() => client.from('herramientas_unidades').select('*').order('id', { ascending: true }))
        ]);
        const unitsByTool = new Map();
        units.forEach(unit => {
            const id = Number(unit.herramienta_id);
            if (!unitsByTool.has(id)) unitsByTool.set(id, []);
            unitsByTool.get(id).push(unit);
        });
        let rows = tools.map(tool => toolFromDb(tool, unitsByTool.get(Number(tool.id)) || []));
        if (options.includeInactive !== true) rows = rows.filter(tool => tool.activo !== false);
        return rows;
    }

    async function saveTool(tool = {}, originalId = 0) {
        const incompleteMode = boolean(tool.esIncompleta ?? tool.es_incompleta ?? tool.incomplete);
        const draft = {
            clasificacion: text(tool.clasificacion),
            marca: text(tool.marca),
            modelo: text(tool.modelo),
            uso: text(tool.uso),
            imagen_url: text(tool.imagen ?? tool.imagenUrl ?? tool.imagen_url)
        };
        const pending = incompleteMode ? toolPendingFields(draft) : [];
        const row = {
            sku: text(tool.sku),
            descripcion: text(tool.descripcion ?? tool.desc),
            clasificacion: draft.clasificacion || null,
            marca: draft.marca || null,
            modelo: draft.modelo || null,
            uso: draft.uso || 'OTRO',
            unidad: text(tool.unidad) || 'pieza',
            piezas_por_unidad: Math.max(.0001, number(tool.piezasPorUnidad ?? tool.piezas_por_unidad) || 1),
            serializada: tool.serializada !== false,
            imagen_url: draft.imagen_url || null,
            es_incompleta: incompleteMode && pending.length > 0,
            origen_alta: incompleteMode ? (text(tool.origenAlta ?? tool.origen_alta) || 'herramienta_no_listada') : null,
            campos_pendientes: incompleteMode ? pending : [],
            activo: tool.activo !== false,
            updated_at: new Date().toISOString()
        };
        if (!row.sku || !row.descripcion) throw new Error('SKU y descripción son obligatorios.');
        if (!incompleteMode && !row.clasificacion) throw new Error('La clasificación es obligatoria.');
        const id = Number(originalId || tool.id || 0);
        let result;
        if (id) result = await client.from('herramientas_catalogo').update(row).eq('id', id).select('*').single();
        else result = await client.from('herramientas_catalogo').insert({ ...row, created_at: new Date().toISOString() }).select('*').single();
        if (result.error?.code === '23505') throw new Error('Ya existe una herramienta con ese SKU.');
        assertNoError(result.error, 'No se pudo guardar la herramienta.');
        return toolFromDb(result.data, []);
    }

    async function createIncompleteTool(payload = {}) {
        return saveTool({
            sku: payload.sku,
            descripcion: payload.descripcion ?? payload.desc,
            clasificacion: payload.clasificacion,
            marca: payload.marca,
            modelo: payload.modelo,
            uso: payload.uso,
            unidad: payload.unidad || 'pieza',
            piezasPorUnidad: payload.piezasPorUnidad || 1,
            serializada: payload.serializada !== false,
            imagen: payload.imagen,
            esIncompleta: true,
            origenAlta: text(payload.origenAlta ?? payload.origen_alta) || 'herramienta_no_listada'
        });
    }

    async function setToolActive(id, active) {
        const toolId = Number(id);
        if (!toolId) throw new Error('Herramienta no válida.');
        const { data, error } = await client.from('herramientas_catalogo').update({ activo: Boolean(active), updated_at: new Date().toISOString() }).eq('id', toolId).select('*').single();
        assertNoError(error, 'No se pudo actualizar la herramienta.');
        return toolFromDb(data, []);
    }

    async function deleteTool(id) {
        const toolId = Number(id);
        if (!toolId) throw new Error('Herramienta no válida.');
        const { count, error: countError } = await client.from('herramientas_unidades').select('id', { count: 'exact', head: true }).eq('herramienta_id', toolId);
        assertNoError(countError, 'No se pudo validar la herramienta.');
        if ((count || 0) > 0) throw new Error('Esta herramienta ya tiene unidades físicas. Elimina primero sus unidades o desactiva la herramienta.');
        const { error } = await client.from('herramientas_catalogo').delete().eq('id', toolId);
        assertNoError(error, 'No se pudo eliminar la herramienta.');
        return { ok: true, id: toolId };
    }

    async function importTools(rows = []) {
        const input = Array.isArray(rows) ? rows : [];
        if (!input.length) throw new Error('El archivo no contiene herramientas.');
        const normalized = input.map(item => {
            const clasificacion = text(item.clasificacion ?? item.Clasificación ?? item.Clasificacion);
            const marca = text(item.marca ?? item.Marca);
            const modelo = text(item.modelo ?? item.Modelo);
            const uso = text(item.uso ?? item.Uso) || 'OTRO';
            const imagen = text(item.imagen ?? item['URL de imagen'] ?? item.imagen_url);
            const markedIncomplete = boolean(item.esIncompleta ?? item.es_incompleta ?? item['Información incompleta']);
            const pending = markedIncomplete ? toolPendingFields({ clasificacion, marca, modelo, uso, imagen_url: imagen }) : [];
            return {
                sku: text(item.sku ?? item.SKU),
                descripcion: text(item.descripcion ?? item.Descripción ?? item.Descripcion),
                clasificacion: clasificacion || null,
                marca: marca || null,
                modelo: modelo || null,
                uso,
                unidad: text(item.unidad ?? item.Unidad) || 'pieza',
                piezas_por_unidad: Math.max(.0001, number(item.piezasPorUnidad ?? item['Piezas por unidad'] ?? item.piezas_por_unidad) || 1),
                serializada: boolean(item.serializada ?? item.Serializada ?? true),
                imagen_url: imagen || null,
                es_incompleta: markedIncomplete && pending.length > 0,
                origen_alta: markedIncomplete ? 'importacion_incompleta' : null,
                campos_pendientes: markedIncomplete ? pending : [],
                activo: true,
                updated_at: new Date().toISOString()
            };
        });
        const invalid = normalized.find(item => !item.sku || !item.descripcion || (!item.clasificacion && !item.es_incompleta));
        if (invalid) throw new Error('Todas las filas normales deben incluir SKU, descripción y clasificación. Las filas incompletas deben marcarse como “Sí”.');
        const { data, error } = await client.from('herramientas_catalogo').upsert(normalized, { onConflict: 'sku' }).select('*');
        assertNoError(error, 'No se pudieron importar las herramientas.');
        return (data || []).map(item => toolFromDb(item, []));
    }

    function toolUnitFromDb(row, toolById = new Map(), warehouseById = new Map(), locationById = new Map()) {
        const tool = toolById.get(Number(row.herramienta_id)) || {};
        const warehouse = warehouseById.get(Number(row.almacen_id)) || {};
        const location = locationById.get(Number(row.ubicacion_id)) || {};
        return {
            id: Number(row.id),
            herramientaId: Number(row.herramienta_id),
            herramienta_id: Number(row.herramienta_id),
            codigoInterno: text(row.codigo_interno),
            codigo_interno: text(row.codigo_interno),
            numeroSerie: text(row.numero_serie),
            numero_serie: text(row.numero_serie),
            cantidad: number(row.cantidad) || 1,
            almacenId: row.almacen_id == null ? null : Number(row.almacen_id),
            almacenNombre: text(warehouse.nombre),
            ubicacionId: row.ubicacion_id == null ? null : Number(row.ubicacion_id),
            ubicacionNombre: text(location.nombre),
            ubicacionCodigo: text(location.codigo),
            fechaAdquisicion: text(row.fecha_adquisicion),
            costoAdquisicion: number(row.costo_adquisicion),
            vidaUtilMeses: row.vida_util_meses == null ? null : Number(row.vida_util_meses),
            complementos: text(row.complementos),
            observaciones: text(row.observaciones),
            estado: text(row.estado) || 'disponible',
            asignadoA: text(row.asignado_a),
            proyecto: text(row.proyecto),
            activo: row.activo !== false,
            herramienta: {
                id: Number(tool.id),
                sku: text(tool.sku),
                descripcion: text(tool.descripcion),
                clasificacion: text(tool.clasificacion),
                marca: text(tool.marca),
                modelo: text(tool.modelo),
                uso: text(tool.uso) || 'OTRO',
                unidad: text(tool.unidad) || 'pieza',
                serializada: tool.serializada !== false,
                imagen: text(tool.imagen_url),
                esIncompleta: boolean(tool.es_incompleta),
                es_incompleta: boolean(tool.es_incompleta),
                origenAlta: text(tool.origen_alta),
                camposPendientes: toolPendingFields(tool)
            },
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    async function listToolUnits(options = {}) {
        const [units, tools, warehouses, locations] = await Promise.all([
            collectRows(() => client.from('herramientas_unidades').select('*').order('id', { ascending: true })),
            collectRows(() => client.from('herramientas_catalogo').select('*').order('descripcion', { ascending: true })),
            listWarehouses(),
            listWarehouseLocations()
        ]);
        const toolById = new Map(tools.map(item => [Number(item.id), item]));
        const warehouseById = new Map(warehouses.map(item => [Number(item.id), item]));
        const locationById = new Map(locations.map(item => [Number(item.id), item]));
        let rows = units.map(item => toolUnitFromDb(item, toolById, warehouseById, locationById));
        if (options.includeInactive !== true) rows = rows.filter(item => item.activo !== false && item.estado !== 'baja');
        const toolId = Number(options.herramientaId ?? options.toolId ?? 0);
        if (toolId) rows = rows.filter(item => item.herramientaId === toolId);
        return rows;
    }

    async function nextToolUnitCode(toolId) {
        const id = Number(toolId);
        if (!id) return `HTA-${Date.now()}`;
        const [{ data: tool, error: toolError }, { data: units, error: unitsError }] = await Promise.all([
            client.from('herramientas_catalogo').select('sku').eq('id', id).single(),
            client.from('herramientas_unidades').select('codigo_interno').eq('herramienta_id', id)
        ]);
        assertNoError(toolError, 'No se encontró la herramienta.');
        assertNoError(unitsError, 'No se pudo generar el código de la unidad.');
        const prefix = text(tool.sku);
        const maximum = (units || []).reduce((current, row) => {
            const match = text(row.codigo_interno).match(/-(\d+)$/);
            return match ? Math.max(current, Number(match[1]) || 0) : current;
        }, 0);
        return `${prefix}-${String(maximum + 1).padStart(6, '0')}`;
    }

    async function saveToolUnit(unit = {}, originalId = 0) {
        const toolId = Number(unit.herramientaId ?? unit.herramienta_id ?? 0);
        if (!toolId) throw new Error('Selecciona una herramienta.');
        const { data: toolDefinition, error: toolDefinitionError } = await client
            .from('herramientas_catalogo')
            .select('serializada')
            .eq('id', toolId)
            .single();
        assertNoError(toolDefinitionError, 'No se encontró la herramienta seleccionada.');
        const serialized = toolDefinition?.serializada !== false;
        const serial = text(unit.numeroSerie ?? unit.numero_serie);
        if (serialized && !serial) throw new Error('El número de serie es obligatorio para esta herramienta.');
        const id = Number(originalId || unit.id || 0);
        const code = text(unit.codigoInterno ?? unit.codigo_interno) || await nextToolUnitCode(toolId);
        const row = {
            herramienta_id: toolId,
            codigo_interno: code,
            numero_serie: serial || null,
            cantidad: serialized ? 1 : Math.max(.0001, number(unit.cantidad) || 1),
            almacen_id: Number(unit.almacenId ?? unit.almacen_id ?? 0) || null,
            ubicacion_id: Number(unit.ubicacionId ?? unit.ubicacion_id ?? 0) || null,
            fecha_adquisicion: text(unit.fechaAdquisicion ?? unit.fecha_adquisicion) || null,
            costo_adquisicion: Math.max(0, number(unit.costoAdquisicion ?? unit.costo_adquisicion)),
            vida_util_meses: text(unit.vidaUtilMeses ?? unit.vida_util_meses) === '' ? null : Math.max(0, Math.trunc(number(unit.vidaUtilMeses ?? unit.vida_util_meses))),
            complementos: text(unit.complementos) || null,
            observaciones: text(unit.observaciones) || null,
            estado: ['disponible', 'asignada', 'mantenimiento', 'baja'].includes(lower(unit.estado)) ? lower(unit.estado) : 'disponible',
            asignado_a: text(unit.asignadoA ?? unit.asignado_a) || null,
            proyecto: text(unit.proyecto) || null,
            activo: unit.activo !== false,
            updated_at: new Date().toISOString()
        };
        let result;
        if (id) result = await client.from('herramientas_unidades').update(row).eq('id', id).select('*').single();
        else result = await client.from('herramientas_unidades').insert({ ...row, created_at: new Date().toISOString() }).select('*').single();
        if (result.error?.code === '23505') throw new Error('El código interno o número de serie ya está registrado.');
        assertNoError(result.error, 'No se pudo guardar la unidad de herramienta.');
        const [tools, warehouses, locations] = await Promise.all([listTools({ includeInactive: true }), listWarehouses(), listWarehouseLocations()]);
        return toolUnitFromDb(result.data, new Map(tools.map(item => [item.id, item])), new Map(warehouses.map(item => [item.id, item])), new Map(locations.map(item => [item.id, item])));
    }

    async function setToolUnitStatus(id, status, detail = '') {
        const unitId = Number(id);
        const state = lower(status);
        if (!unitId || !['disponible', 'asignada', 'mantenimiento', 'baja'].includes(state)) throw new Error('Unidad o estado no válido.');
        const { data, error } = await client.rpc('crm_cambiar_estado_herramienta', {
            p_unidad_id: unitId,
            p_estado: state,
            p_detalle: text(detail) || null
        });
        assertNoError(error, 'No se pudo actualizar la unidad.');
        return data;
    }

    async function deleteToolUnit(id) {
        const unitId = Number(id);
        if (!unitId) throw new Error('Unidad no válida.');
        const { count, error: assignmentError } = await client.from('herramientas_asignaciones').select('id', { count: 'exact', head: true }).eq('unidad_id', unitId);
        assertNoError(assignmentError, 'No se pudo validar el historial de la unidad.');
        if ((count || 0) > 0) throw new Error('Esta unidad tiene historial de asignaciones. Cámbiala a Baja para conservar la trazabilidad.');
        const { error } = await client.from('herramientas_unidades').delete().eq('id', unitId);
        assertNoError(error, 'No se pudo eliminar la unidad.');
        return { ok: true, id: unitId };
    }

    async function listPendingLocations(options = {}) {
        let query = client.from('ubicaciones_pendientes').select('*,almacenes(nombre)').order('created_at', { ascending: false });
        const status = text(options.estado ?? options.status) || 'pendiente';
        if (status) query = query.eq('estado', status);
        const { data, error } = await query;
        assertNoError(error, 'No se pudieron consultar las ubicaciones pendientes.');
        return (data || []).map(item => ({
            id: Number(item.id), requestId: text(item.request_id), codigo: text(item.material_codigo), almacenId: Number(item.almacen_id || 0), almacenNombre: text(item.almacenes?.nombre), proyectoOrigen: text(item.proyecto_origen), cantidad: number(item.cantidad), estado: text(item.estado), createdAt: text(item.created_at)
        }));
    }


    async function createIncompleteMaterial(payload = {}) {
        const code = text(payload.codigo);
        const description = text(payload.descripcion ?? payload.desc);
        const category = text(payload.categoria);
        const unit = text(payload.unidad);
        if (!code || !description || !category || !unit) {
            throw new Error('Código, descripción, categoría y unidad son obligatorios.');
        }
        await ensureCategoryExists(category);
        const existingMaterials = await listMaterials();
        const existing = existingMaterials.find(item => lower(item.codigo) === lower(code));
        if (existing) return existing;
        const { data, error } = await client.rpc('crear_material_incompleto', {
            p_codigo: code,
            p_descripcion: description,
            p_categoria: category,
            p_unidad: unit,
            p_precio: number(payload.precio),
            p_origen: text(payload.origen ?? payload.origenAlta) || 'alta_manual'
        });
        assertNoError(error, 'No se pudo crear el material incompleto.');
        const finalCode = text(data || code);
        const materials = await listMaterials();
        const material = materials.find(item => lower(item.codigo) === lower(finalCode));
        if (!material) throw new Error('El material se creó, pero no pudo recuperarse del catálogo.');
        return material;
    }

    async function listProjectPlanV12(projectNumber) {
        const project = text(projectNumber);
        if (!project) throw new Error('Falta el número del proyecto.');
        const [lineResult, materials] = await Promise.all([
            client.from('proyecto_materiales').select('*').eq('proyecto_numero', project).order('id', { ascending: true }),
            listMaterials()
        ]);
        assertNoError(lineResult.error, 'No se pudo consultar el plan del proyecto.');
        const materialByCode = new Map(materials.map(item => [lower(item.codigo), item]));
        return (lineResult.data || []).map(row => {
            const material = materialByCode.get(lower(row.material_codigo)) || {
                codigo: text(row.material_codigo),
                descripcion: text(row.material_codigo),
                desc: text(row.material_codigo),
                unidad: text(row.unidad),
                precio: number(row.precio_unitario),
                stock: 0,
                imagen: ''
            };
            return {
                id: row.id,
                proyecto: text(row.proyecto_numero),
                codigo: text(row.material_codigo),
                cantidadPlaneada: number(row.cantidad_planeada),
                cantidadEntregada: number(row.cantidad_entregada),
                cantidadSobrante: number(row.cantidad_sobrante),
                unidad: text(row.unidad) || text(material.unidad),
                precioUnitario: number(row.precio_unitario) || number(material.precio),
                observaciones: text(row.observaciones),
                esNoListado: false,
                esIncompleto: boolean(material.esIncompleto ?? material.es_incompleto),
                estadoSolicitud: text(row.estado_solicitud) || 'pendiente',
                estado_solicitud: text(row.estado_solicitud) || 'pendiente',
                aprobadaPor: text(row.aprobada_por),
                aprobadaAt: row.aprobada_at || null,
                rechazoMotivo: text(row.rechazo_motivo),
                material
            };
        });
    }

    async function listProjectMovementPlan(projectNumber, options = {}) {
        const project = text(projectNumber);
        if (!project) throw new Error('Falta el número del proyecto.');
        const [plan, movements, materials] = await Promise.all([
            listProjectPlanV12(project),
            listMovements({ project }),
            listMaterials()
        ]);
        const materialByCode = new Map(materials.map(item => [lower(item.codigo), item]));
        const sums = new Map();
        movements.forEach(movement => {
            const key = lower(movement.codigo);
            if (!key) return;
            if (!sums.has(key)) sums.set(key, { entradas: 0, salidas: 0, reingresos: 0, ajustesMas: 0, ajustesMenos: 0, movimientos: [] });
            const bucket = sums.get(key);
            const type = lower(movement.tipo);
            if (type === 'entrada') bucket.entradas += number(movement.cantidad);
            if (type === 'salida') bucket.salidas += number(movement.cantidad);
            if (type === 'reingreso') bucket.reingresos += number(movement.cantidad);
            if (type === 'ajuste' && lower(movement.ajusteAccion) === 'aumentar') bucket.ajustesMas += number(movement.cantidad);
            if (type === 'ajuste' && lower(movement.ajusteAccion) === 'disminuir') bucket.ajustesMenos += number(movement.cantidad);
            bucket.movimientos.push(movement);
        });
        const planCodes = new Set(plan.map(line => lower(line.codigo)));
        const rows = plan.map(line => {
            const bucket = sums.get(lower(line.codigo)) || { entradas: 0, salidas: 0, reingresos: 0, ajustesMas: 0, ajustesMenos: 0 };
            const requested = number(line.cantidadPlaneada);
            const delivered = Math.max(0, bucket.salidas + bucket.ajustesMenos - bucket.reingresos);
            return {
                ...line,
                requerido: requested,
                planeado: requested,
                ingresado: bucket.entradas + bucket.ajustesMas,
                entregado: delivered,
                reingresado: bucket.reingresos,
                pendiente: Math.max(0, requested - delivered),
                descripcion: text(line.material?.descripcion ?? line.material?.desc ?? line.codigo),
                categoria: text(line.material?.categoria),
                unidad: text(line.unidad ?? line.material?.unidad),
                solicitudAprobada: lower(line.estadoSolicitud) === 'aprobada',
                fueraPlan: false,
                fuera_plan: false
            };
        });
        if (options.includeOutsidePlan) {
            sums.forEach((bucket, key) => {
                if (planCodes.has(key)) return;
                const first = bucket.movimientos?.[0] || {};
                const code = text(first.codigo || first.material_codigo || first.codigo_manual);
                if (!code) return;
                const material = materialByCode.get(key) || {
                    codigo: code,
                    descripcion: text(first.descripcion) || code,
                    desc: text(first.descripcion) || code,
                    categoria: text(first.categoria),
                    unidad: text(first.unidad),
                    precio: number(first.precio),
                    stock: 0,
                    almacenes: []
                };
                const delivered = Math.max(0, bucket.salidas + bucket.ajustesMenos - bucket.reingresos);
                rows.push({
                    id: `fuera-${code}`,
                    proyecto: project,
                    codigo: code,
                    cantidadPlaneada: 0,
                    cantidadEntregada: delivered,
                    cantidadSobrante: 0,
                    unidad: text(material.unidad || first.unidad),
                    precioUnitario: number(first.precio) || number(material.precio),
                    observaciones: 'Material fuera del plan original',
                    esNoListado: boolean(material.esNoListado ?? material.es_no_listado),
                    esIncompleto: boolean(material.esIncompleto ?? material.es_incompleto),
                    estadoSolicitud: 'aprobada',
                    estado_solicitud: 'aprobada',
                    material,
                    requerido: 0,
                    planeado: 0,
                    ingresado: bucket.entradas + bucket.ajustesMas,
                    entregado: delivered,
                    reingresado: bucket.reingresos,
                    pendiente: 0,
                    descripcion: text(material.descripcion ?? material.desc ?? code),
                    categoria: text(material.categoria),
                    solicitudAprobada: true,
                    fueraPlan: true,
                    fuera_plan: true
                });
            });
        }
        return rows;
    }

    async function saveProjectPlanV12(projectNumber, lines) {
        const project = text(projectNumber);
        if (!project) throw new Error('Falta el número del proyecto.');
        const input = Array.isArray(lines) ? lines : [];
        const currentResult = await client
            .from('proyecto_materiales')
            .select('material_codigo,estado_solicitud,aprobada_por,aprobada_at,rechazo_motivo')
            .eq('proyecto_numero', project);
        assertNoError(currentResult.error, 'No se pudo consultar el plan actual.');
        const currentByCode = new Map((currentResult.data || []).map(row => [lower(row.material_codigo), row]));
        const catalog = await listMaterials();
        const catalogByCode = new Map(catalog.map(item => [lower(item.codigo), item]));
        const rows = [];

        for (const line of input) {
            const sourceMaterial = line.material || {};
            let code = text(line.codigo ?? sourceMaterial.codigo);
            let material = sourceMaterial;
            if (!code) throw new Error('Uno de los materiales no tiene código o referencia.');
            const exists = catalogByCode.get(lower(code));
            if (!exists) {
                material = await createIncompleteMaterial({
                    codigo: code,
                    descripcion: text(line.descripcion ?? sourceMaterial.descripcion ?? sourceMaterial.desc),
                    categoria: text(line.categoria ?? sourceMaterial.categoria),
                    unidad: text(line.unidad ?? sourceMaterial.unidad),
                    precio: number(line.precioUnitario ?? sourceMaterial.precio),
                    origen: 'plan_proyecto'
                });
                code = material.codigo;
            } else {
                material = exists;
            }
            const planned = number(line.cantidadPlaneada ?? line.cantidad_planeada);
            if (planned <= 0) throw new Error(`La cantidad requerida de ${code} debe ser mayor a cero.`);
            const current = currentByCode.get(lower(code));
            rows.push({
                proyecto_numero: project,
                material_codigo: code,
                cantidad_planeada: planned,
                cantidad_entregada: number(line.cantidadEntregada ?? line.cantidad_entregada),
                cantidad_sobrante: number(line.cantidadSobrante ?? line.cantidad_sobrante),
                unidad: text(line.unidad ?? material.unidad) || null,
                precio_unitario: number(line.precioUnitario ?? line.precio_unitario ?? material.precio),
                observaciones: text(line.observaciones ?? line.notas) || null,
                estado_solicitud: current ? (text(current.estado_solicitud) || 'pendiente') : 'pendiente',
                aprobada_por: current?.aprobada_por || null,
                aprobada_at: current?.aprobada_at || null,
                rechazo_motivo: current?.rechazo_motivo || null,
                updated_at: new Date().toISOString()
            });
        }

        if (rows.length) {
            const { error } = await client.from('proyecto_materiales').upsert(rows, { onConflict: 'proyecto_numero,material_codigo' });
            assertNoError(error, 'No se pudo guardar el plan del proyecto.');
        }
        const keep = new Set(rows.map(row => lower(row.material_codigo)));
        for (const existing of (currentResult.data || [])) {
            if (!keep.has(lower(existing.material_codigo))) {
                const { error } = await client.from('proyecto_materiales')
                    .delete().eq('proyecto_numero', project).eq('material_codigo', existing.material_codigo);
                assertNoError(error, `No se pudo quitar ${existing.material_codigo} del plan.`);
            }
        }
        return listProjectPlanV12(project);
    }

    async function listMaterialRequests(options = {}) {
        const project = text(options.project ?? options.proyecto);
        const status = lower(options.status ?? options.estado);
        const [projects, materials, lines] = await Promise.all([
            getProjectsRaw(),
            listMaterials(),
            collectRows(() => {
                let query = client.from('proyecto_materiales').select('*').order('updated_at', { ascending: false });
                if (project) query = query.eq('proyecto_numero', project);
                if (status) query = query.eq('estado_solicitud', status);
                return query;
            })
        ]);
        const projectByNumber = new Map(projects.map(row => [text(row.numero_proyecto), row]));
        const materialByCode = new Map(materials.map(row => [lower(row.codigo), row]));
        return lines.map(row => ({
            id: row.id,
            proyecto: text(row.proyecto_numero),
            proyectoNombre: text(projectByNumber.get(text(row.proyecto_numero))?.nombre_proyecto),
            codigo: text(row.material_codigo),
            material: materialByCode.get(lower(row.material_codigo)) || { codigo: text(row.material_codigo), desc: text(row.material_codigo) },
            cantidad: number(row.cantidad_planeada),
            unidad: text(row.unidad),
            estado: text(row.estado_solicitud) || 'pendiente',
            aprobadaPor: text(row.aprobada_por),
            aprobadaAt: row.aprobada_at || null,
            rechazoMotivo: text(row.rechazo_motivo),
            updatedAt: row.updated_at || row.created_at
        }));
    }

    async function setMaterialRequestStatus(projectNumber, materialCode, status, options = {}) {
        const project = text(projectNumber);
        const code = text(materialCode);
        const state = lower(status);
        if (!['pendiente','aprobada','rechazada','reajuste_pendiente'].includes(state)) {
            throw new Error('Estado de solicitud no válido.');
        }
        const row = {
            estado_solicitud: state,
            aprobada_por: state === 'aprobada' ? (text(options.usuario) || 'Almacén') : null,
            aprobada_at: state === 'aprobada' ? new Date().toISOString() : null,
            rechazo_motivo: state === 'rechazada' ? (text(options.motivo) || 'Solicitud rechazada') : null,
            updated_at: new Date().toISOString()
        };
        const { error } = await client.from('proyecto_materiales').update(row)
            .eq('proyecto_numero', project).eq('material_codigo', code);
        assertNoError(error, 'No se pudo actualizar la solicitud de material.');
        return { ok: true, proyecto: project, codigo: code, estado: state };
    }

    async function createMaterialAdjustment(payload = {}) {
        const project = text(payload.proyecto ?? payload.project);
        const code = text(payload.codigo ?? payload.materialCodigo);
        const previous = number(payload.cantidadAnterior);
        const proposed = number(payload.cantidadPropuesta);
        const reason = text(payload.motivo);
        if (!project || !code) throw new Error('Falta el proyecto o el material.');
        if (proposed <= 0) throw new Error('La nueva cantidad debe ser mayor a cero.');
        if (!reason) throw new Error('Explica el motivo del reajuste.');
        const { data: line, error: lineError } = await client.from('proyecto_materiales')
            .select('estado_solicitud,cantidad_planeada')
            .eq('proyecto_numero', project).eq('material_codigo', code).single();
        assertNoError(lineError, 'No se encontró la solicitud a reajustar.');
        const { data, error } = await client.from('reajustes_solicitud_material').insert({
            proyecto_numero: project,
            material_codigo: code,
            cantidad_anterior: previous || number(line.cantidad_planeada),
            cantidad_propuesta: proposed,
            motivo: reason,
            estado_anterior: text(line.estado_solicitud) || 'pendiente',
            solicitado_por: text(payload.solicitadoPor) || 'Almacén'
        }).select('*').single();
        assertNoError(error, 'No se pudo registrar el reajuste.');
        await setMaterialRequestStatus(project, code, 'reajuste_pendiente');
        await client.from('notificaciones_sistema').insert({
            tipo: 'reajuste_solicitud_material',
            titulo: `Reajuste solicitado · ${project}`,
            mensaje: `${code}: ${previous || number(line.cantidad_planeada)} → ${proposed}. ${reason}`,
            proyecto_numero: project,
            material_codigo: code,
            entidad_id: data.id
        });
        return data;
    }

    async function listMaterialAdjustments(options = {}) {
        const status = lower(options.status ?? options.estado);
        const project = text(options.project ?? options.proyecto);
        const rows = await collectRows(() => {
            let query = client.from('reajustes_solicitud_material').select('*').order('created_at', { ascending: false });
            if (status) query = query.eq('estado', status);
            if (project) query = query.eq('proyecto_numero', project);
            return query;
        });
        return rows.map(row => ({
            id: row.id,
            proyecto: text(row.proyecto_numero),
            codigo: text(row.material_codigo),
            cantidadAnterior: number(row.cantidad_anterior),
            cantidadPropuesta: number(row.cantidad_propuesta),
            motivo: text(row.motivo),
            estadoAnterior: text(row.estado_anterior),
            estado: text(row.estado),
            solicitadoPor: text(row.solicitado_por),
            createdAt: row.created_at
        }));
    }

    async function resolveMaterialAdjustment(id, approve, options = {}) {
        const adjustmentId = Number(id);
        const { data: adjustment, error: getError } = await client.from('reajustes_solicitud_material')
            .select('*').eq('id', adjustmentId).single();
        assertNoError(getError, 'No se encontró el reajuste.');
        if (text(adjustment.estado) !== 'pendiente') throw new Error('Este reajuste ya fue resuelto.');
        if (approve) {
            const { error: lineError } = await client.from('proyecto_materiales').update({
                cantidad_planeada: number(adjustment.cantidad_propuesta),
                estado_solicitud: 'aprobada',
                aprobada_por: text(options.usuario) || 'Almacén',
                aprobada_at: new Date().toISOString(),
                rechazo_motivo: null,
                updated_at: new Date().toISOString()
            }).eq('proyecto_numero', adjustment.proyecto_numero).eq('material_codigo', adjustment.material_codigo);
            assertNoError(lineError, 'No se pudo aplicar el reajuste.');
        } else {
            await setMaterialRequestStatus(adjustment.proyecto_numero, adjustment.material_codigo, adjustment.estado_anterior || 'pendiente');
        }
        const { error } = await client.from('reajustes_solicitud_material').update({
            estado: approve ? 'aprobada' : 'rechazada',
            resuelto_por: text(options.usuario) || 'Almacén',
            resuelto_at: new Date().toISOString()
        }).eq('id', adjustmentId);
        assertNoError(error, 'No se pudo resolver el reajuste.');
        await client.from('notificaciones_sistema').update({ leida: true }).eq('entidad_id', adjustmentId).eq('tipo', 'reajuste_solicitud_material');
        return { ok: true, id: adjustmentId, aprobado: Boolean(approve) };
    }

    async function listUnreadNotifications() {
        const { data, error } = await client.from('notificaciones_sistema').select('*')
            .eq('leida', false).order('created_at', { ascending: false });
        assertNoError(error, 'No se pudieron consultar las notificaciones.');
        return data || [];
    }


    function vehicleFromDb(row, warehouseById = new Map()) {
        const warehouse = warehouseById.get(Number(row.almacen_base_id)) || {};
        return {
            id: Number(row.id),
            numeroEconomico: text(row.numero_economico),
            numero_economico: text(row.numero_economico),
            nombreVehiculo: text(row.numero_economico),
            nombre_vehiculo: text(row.numero_economico),
            placas: text(row.placas),
            vin: text(row.vin),
            marca: text(row.marca),
            modelo: text(row.modelo),
            anio: row.anio == null ? null : Number(row.anio),
            tipo: text(row.tipo) || 'pickup',
            color: text(row.color),
            combustible: text(row.combustible),
            transmision: text(row.transmision),
            capacidadCarga: number(row.capacidad_carga),
            capacidad_carga: number(row.capacidad_carga),
            capacidadPersonas: Math.max(0, Math.trunc(number(row.capacidad_personas))),
            capacidad_personas: Math.max(0, Math.trunc(number(row.capacidad_personas))),
            distribucionAsientos: Array.isArray(row.distribucion_asientos?.filas)
                ? row.distribucion_asientos.filas.map(item => Math.max(1, Math.trunc(number(item))))
                : Array.isArray(row.distribucion_asientos)
                    ? row.distribucion_asientos.map(item => Math.max(1, Math.trunc(number(item))))
                    : [],
            distribucion_asientos: row.distribucion_asientos || {},
            kilometraje: number(row.kilometraje),
            propiedad: text(row.propiedad) || 'empresa',
            estado: text(row.estado) || 'disponible',
            almacenBaseId: row.almacen_base_id == null ? null : Number(row.almacen_base_id),
            almacenBaseNombre: text(warehouse.nombre),
            proyecto: text(row.proyecto),
            asignadoA: text(row.asignado_a),
            asignado_a: text(row.asignado_a),
            responsable: text(row.responsable),
            aseguradora: text(row.aseguradora),
            polizaSeguro: text(row.poliza_seguro),
            poliza_seguro: text(row.poliza_seguro),
            vigenciaSeguro: text(row.vigencia_seguro),
            vigencia_seguro: text(row.vigencia_seguro),
            tarjetaCirculacion: text(row.tarjeta_circulacion),
            tarjeta_circulacion: text(row.tarjeta_circulacion),
            vigenciaTarjeta: text(row.vigencia_tarjeta),
            vigencia_tarjeta: text(row.vigencia_tarjeta),
            proximaVerificacion: text(row.proxima_verificacion),
            proxima_verificacion: text(row.proxima_verificacion),
            fechaAdquisicion: text(row.fecha_adquisicion),
            fecha_adquisicion: text(row.fecha_adquisicion),
            costoAdquisicion: number(row.costo_adquisicion),
            costo_adquisicion: number(row.costo_adquisicion),
            imagen: text(row.imagen_url),
            imagenUrl: text(row.imagen_url),
            imagen_url: text(row.imagen_url),
            notas: text(row.notas),
            activo: row.activo !== false,
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    async function listVehicles(options = {}) {
        const [rows, warehouses] = await Promise.all([
            collectRows(() => client.from('vehiculos').select('*').order('numero_economico', { ascending: true })),
            listWarehouses()
        ]);
        const warehouseById = new Map(warehouses.map(item => [Number(item.id), item]));
        let vehicles = rows.map(row => vehicleFromDb(row, warehouseById));
        if (options.includeInactive !== true) vehicles = vehicles.filter(item => item.activo !== false);
        const status = lower(options.estado ?? options.status);
        const project = text(options.proyecto ?? options.project);
        if (status) vehicles = vehicles.filter(item => lower(item.estado) === status);
        if (project) vehicles = vehicles.filter(item => lower(item.proyecto) === lower(project));
        return vehicles;
    }

    function normalizeDbDate(value, label = 'fecha') {
        const raw = text(value);
        if (!raw) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
        if (!match) throw new Error(`La ${label} no tiene un formato válido.`);
        const day = String(match[1]).padStart(2, '0');
        const month = String(match[2]).padStart(2, '0');
        const iso = `${match[3]}-${month}-${day}`;
        const parsed = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== Number(day) || parsed.getUTCMonth() + 1 !== Number(month)) {
            throw new Error(`La ${label} no es válida.`);
        }
        return iso;
    }

    async function saveVehicle(vehicle = {}, originalId = 0) {
        const currentYear = new Date().getFullYear() + 1;
        const year = text(vehicle.anio) === '' ? null : Math.trunc(number(vehicle.anio));
        if (!text(vehicle.numeroEconomico ?? vehicle.numero_economico)) throw new Error('El nombre del vehículo es obligatorio.');
        if (!text(vehicle.marca) || !text(vehicle.modelo)) throw new Error('Marca y modelo son obligatorios.');
        if (year != null && (year < 1950 || year > currentYear)) throw new Error('El año del vehículo no es válido.');
        const status = lower(vehicle.estado) || 'disponible';
        const allowedStatuses = new Set(['disponible', 'asignado', 'taller', 'fuera_servicio']);
        if (!allowedStatuses.has(status)) throw new Error('Selecciona un estado válido para el vehículo.');
        const plates = text(vehicle.placas).toUpperCase();
        const vin = text(vehicle.vin).toUpperCase();
        if (vin && vin.length < 6) throw new Error('El VIN o número de serie debe contener al menos 6 caracteres.');
        if (status === 'asignado' && !text(vehicle.proyecto) && !text(vehicle.asignadoA ?? vehicle.asignado_a)) {
            throw new Error('Indica el proyecto o la persona a la que está asignado el vehículo.');
        }
        const peopleCapacity = Math.max(0, Math.trunc(number(vehicle.capacidadPersonas ?? vehicle.capacidad_personas)));
        const rawLayout = Array.isArray(vehicle.distribucionAsientos ?? vehicle.distribucion_asientos)
            ? (vehicle.distribucionAsientos ?? vehicle.distribucion_asientos)
            : Array.isArray((vehicle.distribucionAsientos ?? vehicle.distribucion_asientos)?.filas)
                ? (vehicle.distribucionAsientos ?? vehicle.distribucion_asientos).filas
                : [];
        const seatRows = rawLayout.map(item => Math.trunc(number(item))).filter(item => item > 0 && item <= 10);
        if (seatRows.length && seatRows.reduce((sum, item) => sum + item, 0) !== peopleCapacity) {
            throw new Error('La distribución de asientos debe sumar la capacidad total de personas.');
        }
        const row = {
            numero_economico: text(vehicle.numeroEconomico ?? vehicle.numero_economico),
            placas: plates || null,
            vin: vin || null,
            marca: text(vehicle.marca),
            modelo: text(vehicle.modelo),
            anio: year,
            tipo: lower(vehicle.tipo) || 'pickup',
            color: text(vehicle.color) || null,
            combustible: lower(vehicle.combustible) || null,
            transmision: lower(vehicle.transmision) || null,
            capacidad_carga: Math.max(0, number(vehicle.capacidadCarga ?? vehicle.capacidad_carga)),
            capacidad_personas: peopleCapacity,
            distribucion_asientos: { version: 1, filas: seatRows },
            kilometraje: Math.max(0, number(vehicle.kilometraje)),
            propiedad: lower(vehicle.propiedad) || 'empresa',
            estado: status,
            almacen_base_id: Number(vehicle.almacenBaseId ?? vehicle.almacen_base_id ?? 0) || null,
            proyecto: text(vehicle.proyecto) || null,
            asignado_a: text(vehicle.asignadoA ?? vehicle.asignado_a) || null,
            responsable: text(vehicle.responsable) || null,
            aseguradora: text(vehicle.aseguradora) || null,
            poliza_seguro: text(vehicle.polizaSeguro ?? vehicle.poliza_seguro) || null,
            vigencia_seguro: normalizeDbDate(vehicle.vigenciaSeguro ?? vehicle.vigencia_seguro, 'vigencia del seguro'),
            tarjeta_circulacion: text(vehicle.tarjetaCirculacion ?? vehicle.tarjeta_circulacion) || null,
            vigencia_tarjeta: normalizeDbDate(vehicle.vigenciaTarjeta ?? vehicle.vigencia_tarjeta, 'vigencia de la tarjeta de circulación'),
            proxima_verificacion: normalizeDbDate(vehicle.proximaVerificacion ?? vehicle.proxima_verificacion, 'fecha de verificación'),
            fecha_adquisicion: normalizeDbDate(vehicle.fechaAdquisicion ?? vehicle.fecha_adquisicion, 'fecha de adquisición'),
            costo_adquisicion: Math.max(0, number(vehicle.costoAdquisicion ?? vehicle.costo_adquisicion)),
            imagen_url: text(vehicle.imagen ?? vehicle.imagenUrl ?? vehicle.imagen_url) || null,
            notas: text(vehicle.notas) || null,
            activo: vehicle.activo !== false,
            updated_at: new Date().toISOString()
        };
        if (row.estado === 'disponible') {
            row.proyecto = null;
            row.asignado_a = null;
        }
        const id = Number(originalId || vehicle.id || 0);
        let result = await client.rpc('crm_guardar_vehiculo', { p_id: id || null, p_datos: row });
        if (result.error) {
            const rpcError = result.error;
            const direct = id
                ? await client.from('vehiculos').update(row).eq('id', id).select('*').maybeSingle()
                : await client.from('vehiculos').insert({ ...row, created_at: new Date().toISOString() }).select('*').maybeSingle();
            if (!direct.error && direct.data) result = direct;
            else if (['PGRST202', '42883'].includes(rpcError.code)) result = direct;
        }
        if (result.error?.code === '23505') throw new Error('El nombre del vehículo, las placas o el VIN ya están registrados.');
        if (result.error?.code === '42P01') throw new Error('La tabla de vehículos no está instalada. Ejecuta SQL_MAESTRO_CRM.sql.');
        if (result.error?.code === '42501') throw new Error('Tu perfil no tiene permiso para guardar o editar vehículos.');
        if (result.error?.code === '22P02') throw new Error('Uno de los campos numéricos o de fecha contiene un valor inválido.');
        if (result.error?.code === 'PGRST116') throw new Error('No se pudo editar el vehículo. Ejecuta SQL_MAESTRO_CRM.sql para actualizar permisos y vuelve a intentarlo.');
        assertNoError(result.error, 'No se pudo guardar el vehículo.');
        if (!result.data) throw new Error(id ? 'El vehículo no pudo actualizarse. Verifica permisos y ejecuta la versión más reciente de SQL_MAESTRO_CRM.sql.' : 'El vehículo no pudo registrarse.');
        const warehouses = await listWarehouses();
        const resultRow = Array.isArray(result.data) ? result.data[0] : result.data;
        return vehicleFromDb(resultRow, new Map(warehouses.map(item => [Number(item.id), item])));
    }

    async function setVehicleActive(id, active) {
        const vehicleId = Number(id);
        if (!vehicleId) throw new Error('Vehículo no válido.');
        const { data, error } = await client.from('vehiculos').update({ activo: Boolean(active), updated_at: new Date().toISOString() }).eq('id', vehicleId).select('*').single();
        assertNoError(error, 'No se pudo actualizar el vehículo.');
        return vehicleFromDb(data);
    }

    async function deleteVehicle(id) {
        const vehicleId = Number(id);
        if (!vehicleId) throw new Error('Vehículo no válido.');
        const { count, error: tripError } = await client.from('vehiculos_viajes').select('id', { count: 'exact', head: true }).eq('vehiculo_id', vehicleId);
        if (tripError && tripError.code !== '42P01') assertNoError(tripError);
        if ((count || 0) > 0) throw new Error('El vehículo tiene viajes registrados. Desactívalo para conservar su historial.');
        const { error } = await client.from('vehiculos').delete().eq('id', vehicleId);
        assertNoError(error, 'No se pudo eliminar el vehículo.');
        return { ok: true, id: vehicleId };
    }

    function vehicleTripFromDb(row) {
        const vehicle = row.vehiculos || row.vehiculo || {};
        const passengers = Array.isArray(row.vehiculos_viaje_pasajeros) ? row.vehiculos_viaje_pasajeros : [];
        return {
            id: Number(row.id),
            vehiculoId: Number(row.vehiculo_id),
            vehiculo: {
                id: Number(vehicle.id || row.vehiculo_id || 0),
                numeroEconomico: text(vehicle.numero_economico),
                placas: text(vehicle.placas),
                marca: text(vehicle.marca),
                modelo: text(vehicle.modelo),
                capacidadPersonas: Math.max(0, Math.trunc(number(vehicle.capacidad_personas))),
                distribucionAsientos: Array.isArray(vehicle.distribucion_asientos?.filas) ? vehicle.distribucion_asientos.filas : []
            },
            fechaSalida: text(row.fecha_salida),
            fechaRegresoEstimada: text(row.fecha_regreso_estimada),
            fechaRegresoReal: text(row.fecha_regreso_real),
            conductor: text(row.conductor),
            proyecto: text(row.proyecto),
            destino: text(row.destino),
            motivo: text(row.motivo),
            kilometrajeSalida: number(row.kilometraje_salida),
            kilometrajeRegreso: row.kilometraje_regreso == null ? null : number(row.kilometraje_regreso),
            estado: text(row.estado) || 'en_curso',
            observaciones: text(row.observaciones),
            pasajeros: passengers.map(item => ({
                id: Number(item.id),
                nombre: text(item.nombre),
                puesto: text(item.puesto),
                contacto: text(item.contacto),
                asiento: text(item.asiento)
            })),
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    async function listVehicleTrips(options = {}) {
        let query = client.from('vehiculos_viajes').select('*,vehiculos(id,numero_economico,placas,marca,modelo,capacidad_personas,distribucion_asientos),vehiculos_viaje_pasajeros(*)').order('fecha_salida', { ascending: false });
        const vehicleId = Number(options.vehiculoId ?? options.vehicleId ?? 0);
        const status = lower(options.estado ?? options.status);
        const project = text(options.proyecto ?? options.project);
        if (vehicleId) query = query.eq('vehiculo_id', vehicleId);
        if (status) query = query.eq('estado', status);
        if (project) query = query.eq('proyecto', project);
        const { data, error } = await query;
        if (error?.code === '42P01') throw new Error('El control diario de vehículos todavía no está instalado. Ejecuta SQL_MAESTRO_CRM.sql.');
        assertNoError(error, 'No se pudieron consultar los viajes.');
        return (data || []).map(vehicleTripFromDb);
    }

    function normalizePassengerList(value) {
        if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? { nombre: text(item) } : item).filter(item => text(item?.nombre));
        return text(value).split(/[\n,;]+/).map(nombre => ({ nombre: text(nombre) })).filter(item => item.nombre);
    }

    async function saveVehicleTrip(payload = {}, originalId = 0) {
        const vehicleId = Number(payload.vehiculoId ?? payload.vehicleId ?? 0);
        if (!vehicleId) throw new Error('Selecciona el vehículo de la salida.');
        const driver = text(payload.conductor ?? payload.driver);
        const destination = text(payload.destino ?? payload.destination);
        if (!driver || !destination) throw new Error('Conductor y destino son obligatorios.');
        const id = Number(originalId || payload.id || 0);
        if (!id) {
            const { count, error: activeError } = await client.from('vehiculos_viajes').select('id', { count: 'exact', head: true }).eq('vehiculo_id', vehicleId).eq('estado', 'en_curso');
            if (activeError?.code !== '42P01') assertNoError(activeError);
            if ((count || 0) > 0) throw new Error('Este vehículo ya tiene una salida activa. Registra primero su regreso.');
        }
        const row = {
            vehiculo_id: vehicleId,
            fecha_salida: text(payload.fechaSalida ?? payload.departureAt) || new Date().toISOString(),
            fecha_regreso_estimada: text(payload.fechaRegresoEstimada ?? payload.expectedReturnAt) || null,
            conductor: driver,
            proyecto: text(payload.proyecto ?? payload.project) || null,
            destino: destination,
            motivo: text(payload.motivo ?? payload.purpose) || null,
            kilometraje_salida: Math.max(0, number(payload.kilometrajeSalida ?? payload.startMileage)),
            observaciones: text(payload.observaciones ?? payload.notes) || null,
            estado: 'en_curso',
            updated_at: new Date().toISOString()
        };
        let result;
        if (id) result = await client.from('vehiculos_viajes').update(row).eq('id', id).select('*').single();
        else result = await client.from('vehiculos_viajes').insert({ ...row, created_at: new Date().toISOString() }).select('*').single();
        if (result.error?.code === '42P01') throw new Error('El control diario de vehículos todavía no está instalado. Ejecuta SQL_MAESTRO_CRM.sql.');
        assertNoError(result.error, 'No se pudo registrar la salida del vehículo.');
        const tripId = Number(result.data.id);
        const passengers = normalizePassengerList(payload.pasajeros ?? payload.passengers);
        const { error: clearError } = await client.from('vehiculos_viaje_pasajeros').delete().eq('viaje_id', tripId);
        assertNoError(clearError, 'No se pudo actualizar la lista de pasajeros.');
        if (passengers.length) {
            const { error: passengersError } = await client.from('vehiculos_viaje_pasajeros').insert(passengers.map(item => ({
                viaje_id: tripId,
                nombre: text(item.nombre),
                puesto: text(item.puesto) || null,
                contacto: text(item.contacto) || null,
                asiento: text(item.asiento) || null
            })));
            assertNoError(passengersError, 'La salida se creó, pero no se pudieron guardar los pasajeros.');
        }
        await client.from('vehiculos').update({
            estado: 'asignado',
            proyecto: row.proyecto,
            asignado_a: driver,
            responsable: driver,
            kilometraje: Math.max(0, row.kilometraje_salida),
            updated_at: new Date().toISOString()
        }).eq('id', vehicleId);
        return (await listVehicleTrips({ vehicleId })).find(item => item.id === tripId) || vehicleTripFromDb(result.data);
    }

    function vehicleExpenseFromDb(row) {
        const vehicle = row.vehiculos || row.vehiculo || {};
        return {
            id: Number(row.id),
            vehiculoId: Number(row.vehiculo_id),
            viajeId: row.viaje_id == null ? null : Number(row.viaje_id),
            fecha: text(row.fecha),
            tipo: text(row.tipo) || 'gasolina',
            litros: number(row.litros),
            importe: number(row.importe),
            odometro: number(row.odometro),
            proveedor: text(row.proveedor),
            comprobante: text(row.comprobante),
            notas: text(row.notas),
            vehiculo: { id: Number(vehicle.id || row.vehiculo_id || 0), numeroEconomico: text(vehicle.numero_economico), placas: text(vehicle.placas), marca: text(vehicle.marca), modelo: text(vehicle.modelo) },
            createdAt: text(row.created_at)
        };
    }

    async function listVehicleExpenses(options = {}) {
        let query = client.from('vehiculos_gastos').select('*,vehiculos(id,numero_economico,placas,marca,modelo)').order('fecha', { ascending: false }).order('id', { ascending: false });
        const vehicleId = Number(options.vehiculoId ?? options.vehicleId ?? 0);
        const tripId = Number(options.viajeId ?? options.tripId ?? 0);
        const type = lower(options.tipo ?? options.type);
        if (vehicleId) query = query.eq('vehiculo_id', vehicleId);
        if (tripId) query = query.eq('viaje_id', tripId);
        if (type) query = query.eq('tipo', type);
        const { data, error } = await query;
        if (error?.code === '42P01') throw new Error('El control de gastos vehiculares todavía no está instalado. Ejecuta SQL_MAESTRO_CRM.sql.');
        assertNoError(error, 'No se pudieron consultar los gastos vehiculares.');
        return (data || []).map(vehicleExpenseFromDb);
    }

    async function saveVehicleExpense(payload = {}, originalId = 0) {
        const vehicleId = Number(payload.vehiculoId ?? payload.vehicleId ?? 0);
        if (!vehicleId) throw new Error('Selecciona un vehículo.');
        const amount = Math.max(0, number(payload.importe ?? payload.amount));
        if (amount <= 0) throw new Error('El importe debe ser mayor a cero.');
        const row = {
            vehiculo_id: vehicleId,
            viaje_id: Number(payload.viajeId ?? payload.tripId ?? 0) || null,
            fecha: normalizeDbDate((payload.fecha ?? payload.date) || new Date().toISOString().slice(0, 10), 'fecha del gasto'),
            tipo: lower(payload.tipo ?? payload.type) || 'gasolina',
            litros: Math.max(0, number(payload.litros ?? payload.liters)) || null,
            importe: amount,
            odometro: Math.max(0, number(payload.odometro ?? payload.mileage)) || null,
            proveedor: text(payload.proveedor ?? payload.vendor) || null,
            comprobante: text(payload.comprobante ?? payload.receipt) || null,
            notas: text(payload.notas ?? payload.notes) || null,
            updated_at: new Date().toISOString()
        };
        const id = Number(originalId || payload.id || 0);
        let result;
        if (id) result = await client.from('vehiculos_gastos').update(row).eq('id', id).select('*').single();
        else result = await client.from('vehiculos_gastos').insert({ ...row, created_at: new Date().toISOString() }).select('*').single();
        assertNoError(result.error, 'No se pudo guardar el gasto vehicular.');
        if (row.odometro) await client.from('vehiculos').update({ kilometraje: row.odometro, updated_at: new Date().toISOString() }).eq('id', vehicleId).lt('kilometraje', row.odometro);
        return vehicleExpenseFromDb(result.data);
    }

    async function closeVehicleTrip(id, payload = {}) {
        const tripId = Number(id);
        if (!tripId) throw new Error('Viaje no válido.');
        const { data: trip, error: tripError } = await client.from('vehiculos_viajes').select('*').eq('id', tripId).single();
        assertNoError(tripError, 'No se encontró la salida.');
        const endMileage = Math.max(number(trip.kilometraje_salida), number(payload.kilometrajeRegreso ?? payload.endMileage));
        const update = {
            fecha_regreso_real: text(payload.fechaRegresoReal ?? payload.returnAt) || new Date().toISOString(),
            kilometraje_regreso: endMileage,
            estado: 'finalizado',
            observaciones: [text(trip.observaciones), text(payload.observaciones ?? payload.notes)].filter(Boolean).join(' | ') || null,
            updated_at: new Date().toISOString()
        };
        const { error } = await client.from('vehiculos_viajes').update(update).eq('id', tripId);
        assertNoError(error, 'No se pudo registrar el regreso del vehículo.');
        await client.from('vehiculos').update({ estado: 'disponible', proyecto: null, asignado_a: null, responsable: null, kilometraje: endMileage, updated_at: new Date().toISOString() }).eq('id', Number(trip.vehiculo_id));
        const fuelAmount = number(payload.gastoGasolina ?? payload.fuelAmount);
        if (fuelAmount > 0) await saveVehicleExpense({ vehiculoId: trip.vehiculo_id, viajeId: tripId, fecha: new Date().toISOString().slice(0, 10), tipo: 'gasolina', litros: payload.litrosGasolina ?? payload.fuelLiters, importe: fuelAmount, odometro: endMileage, proveedor: payload.proveedorGasolina ?? payload.fuelVendor, comprobante: payload.comprobante ?? payload.receipt, notas: 'Registrado al finalizar la salida.' });
        const tolls = number(payload.casetas ?? payload.tolls);
        if (tolls > 0) await saveVehicleExpense({ vehiculoId: trip.vehiculo_id, viajeId: tripId, fecha: new Date().toISOString().slice(0, 10), tipo: 'casetas', importe: tolls, odometro: endMileage, comprobante: payload.comprobante ?? payload.receipt, notas: 'Casetas registradas al finalizar la salida.' });
        return (await listVehicleTrips({ vehicleId: trip.vehiculo_id })).find(item => item.id === tripId);
    }

    async function deleteVehicleTrip(id) {
        const tripId = Number(id);
        if (!tripId) throw new Error('Viaje no válido.');
        const { data: trip } = await client.from('vehiculos_viajes').select('vehiculo_id,estado').eq('id', tripId).maybeSingle();
        const { error } = await client.from('vehiculos_viajes').delete().eq('id', tripId);
        assertNoError(error, 'No se pudo eliminar el viaje.');
        if (trip?.estado === 'en_curso') await client.from('vehiculos').update({ estado: 'disponible', proyecto: null, asignado_a: null, responsable: null, updated_at: new Date().toISOString() }).eq('id', Number(trip.vehiculo_id));
        return { ok: true, id: tripId };
    }

    async function deleteVehicleExpense(id) {
        const expenseId = Number(id);
        if (!expenseId) throw new Error('Gasto no válido.');
        const { error } = await client.from('vehiculos_gastos').delete().eq('id', expenseId);
        assertNoError(error, 'No se pudo eliminar el gasto.');
        return { ok: true, id: expenseId };
    }

    async function listProjectToolPlan(projectNumber) {
        const project = text(projectNumber);
        if (!project) return [];
        const { data, error } = await client.from('proyecto_herramientas').select('*,herramientas_catalogo(*)').eq('proyecto_numero', project).order('id', { ascending: true });
        assertNoError(error, 'No se pudo consultar el plan de herramientas del proyecto.');
        return (data || []).map(row => ({
            id: Number(row.id),
            proyecto: text(row.proyecto_numero),
            herramientaId: Number(row.herramienta_id),
            cantidadRequerida: number(row.cantidad_requerida) || 1,
            prioridad: text(row.prioridad) || 'normal',
            observaciones: text(row.observaciones),
            herramienta: toolFromDb(row.herramientas_catalogo || {}, [])
        }));
    }

    async function saveProjectToolPlan(projectNumber, lines = []) {
        const project = text(projectNumber);
        if (!project) throw new Error('Falta el número del proyecto.');
        const normalized = (Array.isArray(lines) ? lines : []).map(line => ({
            proyecto_numero: project,
            herramienta_id: Number(line.herramientaId ?? line.herramienta_id ?? line.herramienta?.id),
            cantidad_requerida: Math.max(.0001, number(line.cantidadRequerida ?? line.cantidad_requerida) || 1),
            prioridad: lower(line.prioridad) || 'normal',
            observaciones: text(line.observaciones) || null,
            updated_at: new Date().toISOString()
        })).filter(line => line.herramienta_id);
        const ids = new Set(normalized.map(line => line.herramienta_id));
        const { data: current, error: currentError } = await client.from('proyecto_herramientas').select('id,herramienta_id').eq('proyecto_numero', project);
        assertNoError(currentError, 'No se pudo consultar la selección actual de herramientas.');
        for (const row of current || []) {
            if (!ids.has(Number(row.herramienta_id))) {
                const { error } = await client.from('proyecto_herramientas').delete().eq('id', row.id);
                assertNoError(error, 'No se pudo quitar una herramienta del proyecto.');
            }
        }
        if (normalized.length) {
            const { error } = await client.from('proyecto_herramientas').upsert(normalized, { onConflict: 'proyecto_numero,herramienta_id' });
            assertNoError(error, 'No se pudo guardar la selección de herramientas del proyecto.');
        }
        return listProjectToolPlan(project);
    }

    function toolAssignmentFromDb(row) {
        const unit = row.herramientas_unidades || row.unidad || {};
        const tool = unit.herramientas_catalogo || unit.herramienta || {};
        const due = text(row.fecha_devolucion_estimada);
        const active = text(row.estado) === 'activa';
        const overdue = active && due && due < new Date().toISOString().slice(0, 10);
        return {
            id: Number(row.id),
            grupoId: text(row.grupo_id),
            unidadId: Number(row.unidad_id),
            destinoTipo: text(row.destino_tipo),
            proyecto: text(row.proyecto_numero),
            personaNombre: text(row.persona_nombre),
            personaContacto: text(row.persona_contacto),
            responsableEntrega: text(row.responsable_entrega),
            fechaAsignacion: text(row.fecha_asignacion),
            fechaDevolucionEstimada: due,
            fechaDevolucionReal: text(row.fecha_devolucion_real),
            estado: overdue ? 'vencida' : (text(row.estado) || 'activa'),
            estadoDb: text(row.estado) || 'activa',
            condicionSalida: text(row.condicion_salida),
            condicionEntrada: text(row.condicion_entrada),
            accesoriosSalida: text(row.accesorios_salida),
            observaciones: text(row.observaciones),
            observacionesDevolucion: text(row.observaciones_devolucion),
            unidad: {
                id: Number(unit.id),
                codigoInterno: text(unit.codigo_interno),
                numeroSerie: text(unit.numero_serie),
                estado: text(unit.estado),
                almacenId: unit.almacen_id == null ? null : Number(unit.almacen_id),
                ubicacionId: unit.ubicacion_id == null ? null : Number(unit.ubicacion_id),
                herramienta: {
                    id: Number(tool.id),
                    sku: text(tool.sku),
                    descripcion: text(tool.descripcion),
                    marca: text(tool.marca),
                    modelo: text(tool.modelo),
                    clasificacion: text(tool.clasificacion),
                    esIncompleta: boolean(tool.es_incompleta),
                    camposPendientes: toolPendingFields(tool)
                }
            },
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    async function listToolAssignments(options = {}) {
        let query = client.from('herramientas_asignaciones').select('*,herramientas_unidades(*,herramientas_catalogo(*))').order('created_at', { ascending: false });
        const project = text(options.proyecto ?? options.project);
        const status = lower(options.estado ?? options.status);
        const destinationType = lower(options.destinoTipo ?? options.destinationType);
        const groupId = text(options.grupoId ?? options.groupId);
        if (project) query = query.eq('proyecto_numero', project);
        if (status && status !== 'vencida') query = query.eq('estado', status);
        if (destinationType) query = query.eq('destino_tipo', destinationType);
        if (groupId) query = query.eq('grupo_id', groupId);
        const { data, error } = await query;
        assertNoError(error, 'No se pudieron consultar las asignaciones de herramientas.');
        let rows = (data || []).map(toolAssignmentFromDb);
        if (status === 'vencida') rows = rows.filter(item => item.estado === 'vencida');
        return rows;
    }

    async function assignToolUnits(payload = {}) {
        const unitIds = (Array.isArray(payload.unidadIds ?? payload.unitIds) ? (payload.unidadIds ?? payload.unitIds) : []).map(Number).filter(Boolean);
        const groupId = text(payload.grupoId) || (window.crypto?.randomUUID ? window.crypto.randomUUID() : null);
        const { data, error } = await client.rpc('crm_asignar_herramientas', {
            p_grupo_id: groupId,
            p_destino_tipo: lower(payload.destinoTipo ?? payload.destinationType),
            p_proyecto_numero: text(payload.proyecto ?? payload.project) || null,
            p_persona_nombre: text(payload.personaNombre ?? payload.personName) || null,
            p_persona_contacto: text(payload.personaContacto ?? payload.personContact) || null,
            p_responsable_entrega: text(payload.responsableEntrega ?? payload.deliveredBy) || null,
            p_fecha_asignacion: text(payload.fechaAsignacion ?? payload.assignmentDate) || new Date().toISOString().slice(0, 10),
            p_fecha_devolucion_estimada: text(payload.fechaDevolucionEstimada ?? payload.expectedReturnDate) || null,
            p_condicion_salida: text(payload.condicionSalida ?? payload.outCondition) || null,
            p_accesorios_salida: text(payload.accesoriosSalida ?? payload.accessories) || null,
            p_observaciones: text(payload.observaciones ?? payload.notes) || null,
            p_unidades: unitIds
        });
        assertNoError(error, 'No se pudo registrar la asignación de herramientas.');
        return data;
    }

    async function returnToolAssignment(id, payload = {}) {
        const assignmentId = Number(id);
        if (!assignmentId) throw new Error('Asignación no válida.');
        const { data, error } = await client.rpc('crm_devolver_herramienta', {
            p_asignacion_id: assignmentId,
            p_condicion_entrada: text(payload.condicionEntrada ?? payload.condition) || null,
            p_observaciones: text(payload.observaciones ?? payload.notes) || null
        });
        assertNoError(error, 'No se pudo registrar la devolución.');
        return data;
    }

    async function cancelToolAssignment(id, reason = '') {
        const assignmentId = Number(id);
        if (!assignmentId) throw new Error('Asignación no válida.');
        const { data, error } = await client.rpc('crm_cancelar_asignacion_herramienta', {
            p_asignacion_id: assignmentId,
            p_motivo: text(reason) || null
        });
        assertNoError(error, 'No se pudo cancelar la asignación.');
        return data;
    }


    function toolHistoryFromDb(row) {
        const unit = row.herramientas_unidades || row.unidad || {};
        const tool = unit.herramientas_catalogo || row.herramientas_catalogo || row.herramienta || {};
        return {
            id: Number(row.id),
            unidadId: row.unidad_id == null ? null : Number(row.unidad_id),
            herramientaId: row.herramienta_id == null ? Number(tool.id || 0) || null : Number(row.herramienta_id),
            asignacionId: row.asignacion_id == null ? null : Number(row.asignacion_id),
            grupoId: text(row.grupo_id),
            tipoEvento: text(row.tipo_evento),
            estadoAnterior: text(row.estado_anterior),
            estadoNuevo: text(row.estado_nuevo),
            destinoTipo: text(row.destino_tipo),
            proyecto: text(row.proyecto_numero),
            personaNombre: text(row.persona_nombre),
            responsable: text(row.responsable),
            detalle: text(row.detalle),
            fecha: row.fecha || row.created_at || '',
            unidad: {
                id: Number(unit.id || row.unidad_id || 0),
                codigoInterno: text(unit.codigo_interno),
                numeroSerie: text(unit.numero_serie),
                estado: text(unit.estado),
                almacenId: unit.almacen_id == null ? null : Number(unit.almacen_id),
                ubicacionId: unit.ubicacion_id == null ? null : Number(unit.ubicacion_id),
                herramienta: {
                    id: Number(tool.id || row.herramienta_id || 0),
                    sku: text(tool.sku),
                    descripcion: text(tool.descripcion),
                    marca: text(tool.marca),
                    modelo: text(tool.modelo),
                    clasificacion: text(tool.clasificacion),
                    esIncompleta: boolean(tool.es_incompleta),
                    camposPendientes: toolPendingFields(tool)
                }
            },
            createdAt: text(row.created_at)
        };
    }

    async function listToolHistory(options = {}) {
        let query = client
            .from('herramientas_historial')
            .select('*,herramientas_unidades(*,herramientas_catalogo(*))')
            .order('fecha', { ascending: false });
        const unitId = Number(options.unidadId ?? options.unitId ?? 0);
        const toolId = Number(options.herramientaId ?? options.toolId ?? 0);
        const eventType = lower(options.tipoEvento ?? options.eventType);
        const groupId = text(options.grupoId ?? options.groupId);
        if (unitId) query = query.eq('unidad_id', unitId);
        if (toolId) query = query.eq('herramienta_id', toolId);
        if (eventType) query = query.eq('tipo_evento', eventType);
        if (groupId) query = query.eq('grupo_id', groupId);
        const { data, error } = await query;
        assertNoError(error, 'No se pudo consultar el historial de herramientas.');
        return (data || []).map(toolHistoryFromDb);
    }

    async function getToolAssignmentGroup(groupId) {
        const id = text(groupId);
        if (!id) return [];
        return listToolAssignments({ grupoId: id });
    }

    async function getMyProfile() {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        assertNoError(sessionError, 'No se pudo consultar la sesión.');
        const user = sessionData?.session?.user;
        if (!user) throw new Error('La sesión no está activa.');
        const { data: profile, error } = await client.from('perfiles_usuario').select('*').eq('id', user.id).maybeSingle();
        assertNoError(error, 'No se pudo consultar el perfil.');
        return {
            id: user.id,
            email: text(user.email),
            nombre: text(profile?.nombre) || text(user.user_metadata?.nombre) || text(user.email).split('@')[0],
            rol: text(profile?.rol) || 'consulta',
            activo: profile?.activo !== false,
            telefono: text(profile?.telefono),
            puesto: text(profile?.puesto),
            departamento: text(profile?.departamento),
            fotoUrl: text(profile?.foto_url),
            creadoAt: text(user.created_at),
            ultimoAcceso: text(user.last_sign_in_at),
            emailConfirmado: text(user.email_confirmed_at)
        };
    }

    async function saveMyProfile(profile = {}) {
        const { data, error } = await client.rpc('crm_guardar_mi_perfil', {
            p_nombre: text(profile.nombre),
            p_telefono: text(profile.telefono) || null,
            p_puesto: text(profile.puesto) || null,
            p_departamento: text(profile.departamento) || null,
            p_foto_url: text(profile.fotoUrl ?? profile.foto_url) || null
        });
        assertNoError(error, 'No se pudo guardar el perfil.');
        return data;
    }


    function deliveryInfoFromDb(row) {
        return {
            id: Number(row.id),
            nombre: text(row.nombre),
            empresa: text(row.empresa),
            direccion: text(row.direccion),
            referencias: text(row.referencias),
            diasRecepcion: Array.isArray(row.dias_recepcion) ? row.dias_recepcion.map(text).filter(Boolean) : [],
            horarioRecepcion: text(row.horario_recepcion),
            responsablePrincipal: text(row.responsable_principal),
            receptoresAutorizados: Array.isArray(row.receptores_autorizados) ? row.receptores_autorizados.map(text).filter(Boolean) : [],
            telefono: text(row.telefono),
            email: text(row.email),
            instrucciones: text(row.instrucciones),
            activo: row.activo !== false,
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    async function listDeliveryInfos(options = {}) {
        let query = client.from('co_direcciones_entrega').select('*').order('nombre', { ascending: true });
        if (options.activeOnly) query = query.eq('activo', true);
        const { data, error } = await query;
        assertNoError(error, 'No se pudo consultar la información de entrega.');
        return (data || []).map(deliveryInfoFromDb);
    }

    async function saveDeliveryInfo(payload = {}) {
        const row = {
            nombre: text(payload.nombre),
            empresa: text(payload.empresa) || null,
            direccion: text(payload.direccion),
            referencias: text(payload.referencias) || null,
            dias_recepcion: Array.isArray(payload.diasRecepcion) ? payload.diasRecepcion.map(text).filter(Boolean) : [],
            horario_recepcion: text(payload.horarioRecepcion) || null,
            responsable_principal: text(payload.responsablePrincipal) || null,
            receptores_autorizados: Array.isArray(payload.receptoresAutorizados) ? payload.receptoresAutorizados.map(text).filter(Boolean) : text(payload.receptoresAutorizados).split(/[,;\n]+/).map(text).filter(Boolean),
            telefono: text(payload.telefono) || null,
            email: text(payload.email) || null,
            instrucciones: text(payload.instrucciones) || null,
            activo: payload.activo !== false,
            updated_at: new Date().toISOString()
        };
        if (!row.nombre || !row.direccion) throw new Error('El nombre y la dirección de entrega son obligatorios.');
        const id = Number(payload.id || 0);
        const query = id
            ? client.from('co_direcciones_entrega').update(row).eq('id', id)
            : client.from('co_direcciones_entrega').insert(row);
        const { data, error } = await query.select('*').single();
        assertNoError(error, 'No se pudo guardar la información de entrega.');
        return deliveryInfoFromDb(data);
    }

    async function deleteDeliveryInfo(id) {
        const value = Number(id);
        if (!value) throw new Error('Registro de entrega no válido.');
        const { error } = await client.from('co_direcciones_entrega').delete().eq('id', value);
        assertNoError(error, 'No se pudo eliminar la información de entrega.');
        return { ok: true, id: value };
    }

    function supplierRequestFromDb(row) {
        return {
            id: text(row.id),
            numero: text(row.numero),
            ordenCompra: text(row.orden_compra),
            proveedorId: row.proveedor_id == null ? null : Number(row.proveedor_id),
            proveedorNombre: text(row.proveedor_nombre),
            proveedorContacto: text(row.proveedor_contacto),
            proveedorEmail: text(row.proveedor_email),
            direccionEntregaId: row.direccion_entrega_id == null ? null : Number(row.direccion_entrega_id),
            asunto: text(row.asunto),
            mensaje: text(row.mensaje),
            estado: text(row.estado),
            fechaEnvio: text(row.fecha_envio),
            errorEnvio: text(row.error_envio),
            cotizacionId: text(row.cotizacion_id),
            tipo: text(row.tipo) || 'suministro',
            items: Array.isArray(row.co_solicitud_proveedor_items) ? row.co_solicitud_proveedor_items.map(item => ({
                id: Number(item.id),
                solicitudCompraId: item.solicitud_compra_id == null ? null : Number(item.solicitud_compra_id),
                materialCodigo: text(item.material_codigo),
                descripcion: text(item.descripcion),
                marca: text(item.marca),
                unidad: text(item.unidad),
                cantidad: number(item.cantidad),
                costoUnitario: number(item.costo_unitario),
                subtotal: number(item.subtotal)
            })) : [],
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    async function listSupplierRequests(options = {}) {
        let query = client.from('co_solicitudes_proveedor').select('*,co_solicitud_proveedor_items(*)').order('created_at', { ascending: false });
        if (text(options.orderNumber)) query = query.eq('orden_compra', text(options.orderNumber));
        if (text(options.status)) query = query.eq('estado', text(options.status));
        const { data, error } = await query;
        assertNoError(error, 'No se pudieron consultar las solicitudes a proveedores.');
        return (data || []).map(supplierRequestFromDb);
    }

    function nextSupplierRequestNumber() {
        const now = new Date();
        const pad = v => String(v).padStart(2, '0');
        return `SP-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
    }

    async function createSupplierRequest(payload = {}) {
        const orderNumber = text(payload.ordenCompra);
        const providerName = text(payload.proveedorNombre);
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (!orderNumber || !providerName || !items.length) throw new Error('La orden, el proveedor y los materiales son obligatorios.');
        const header = {
            numero: text(payload.numero) || nextSupplierRequestNumber(),
            orden_compra: orderNumber,
            proveedor_id: Number(payload.proveedorId || 0) || null,
            proveedor_nombre: providerName,
            proveedor_contacto: text(payload.proveedorContacto) || null,
            proveedor_email: text(payload.proveedorEmail) || null,
            direccion_entrega_id: Number(payload.direccionEntregaId || 0) || null,
            asunto: text(payload.asunto) || `Solicitud de cotización y suministro · ${orderNumber}`,
            mensaje: text(payload.mensaje) || null,
            estado: text(payload.estado) || 'borrador',
            cotizacion_id: text(payload.cotizacionId) || null,
            tipo: ['suministro','cotizacion'].includes(text(payload.tipo)) ? text(payload.tipo) : 'suministro',
            updated_at: new Date().toISOString()
        };
        const { data, error } = await client.from('co_solicitudes_proveedor').insert(header).select('*').single();
        assertNoError(error, 'No se pudo crear la solicitud para el proveedor.');
        const rows = items.map(item => ({
            solicitud_id: data.id,
            solicitud_compra_id: Number(item.solicitudCompraId || item.id || 0) || null,
            material_codigo: text(item.materialCodigo ?? item.codigo) || null,
            descripcion: text(item.descripcion),
            marca: text(item.marca) || null,
            unidad: text(item.unidad) || null,
            cantidad: number(item.cantidad),
            costo_unitario: number(item.costoUnitario ?? item.precio)
        }));
        const { error: itemError } = await client.from('co_solicitud_proveedor_items').insert(rows);
        if (itemError) {
            await client.from('co_solicitudes_proveedor').delete().eq('id', data.id);
            throw new Error(errorMessage(itemError));
        }
        const { data: created, error: createdError } = await client.from('co_solicitudes_proveedor').select('*,co_solicitud_proveedor_items(*)').eq('id', data.id).single();
        assertNoError(createdError, 'La solicitud se creó, pero no pudo recuperarse.');
        return supplierRequestFromDb(created);
    }

    async function updateSupplierRequest(id, changes = {}) {
        const requestId = text(id);
        if (!requestId) throw new Error('Solicitud a proveedor no válida.');
        const row = { updated_at: new Date().toISOString() };
        if ('estado' in changes) row.estado = text(changes.estado);
        if ('fechaEnvio' in changes) row.fecha_envio = text(changes.fechaEnvio) || null;
        if ('errorEnvio' in changes) row.error_envio = text(changes.errorEnvio) || null;
        if ('asunto' in changes) row.asunto = text(changes.asunto);
        if ('mensaje' in changes) row.mensaje = text(changes.mensaje) || null;
        const { data, error } = await client.from('co_solicitudes_proveedor').update(row).eq('id', requestId).select('*,co_solicitud_proveedor_items(*)').single();
        assertNoError(error, 'No se pudo actualizar la solicitud al proveedor.');
        return supplierRequestFromDb(data);
    }

    async function sendSupplierRequest(id) {
        const requestId = text(id);
        if (!requestId) throw new Error('Solicitud a proveedor no válida.');
        const { data, error } = await client.functions.invoke('enviar-solicitud-proveedor', { body: { solicitudId: requestId } });
        if (error) throw new Error(error.message || 'No se pudo enviar la solicitud al proveedor.');
        return data;
    }

    async function edgeFunctionErrorDetail(error, fallback = 'Servicio no disponible.') {
        let message = text(error?.message) || fallback;
        const response = error?.context;
        if (response && typeof response.clone === 'function') {
            try {
                const clone = response.clone();
                const payload = await clone.json();
                message = text(payload?.error ?? payload?.message) || message;
            } catch (_) {
                try {
                    const raw = await response.clone().text();
                    if (text(raw)) message = text(raw).slice(0, 700);
                } catch (_) {}
            }
            if (response.status === 404 && !/no existe|not found/i.test(message)) message = 'La función sky-transcribir todavía no está desplegada en Supabase.';
            if (response.status === 401 && !/sesión|jwt|token/i.test(message)) message = 'La sesión no pudo autorizar el servicio de voz avanzada.';
        }
        return message;
    }

    function skyVoiceStatusCode(message = '', available = false, configured = false) {
        const value = text(message).toLowerCase();
        if (available && configured) return 'ready';
        if (/openai_api_key|falta configurar.*clave|api key/.test(value)) return 'missing_key';
        if (/no está desplegada|not found|404|function.*not.*found|failed to send a request/.test(value)) return 'missing_function';
        if (/sesión|jwt|token|unauthorized|401/.test(value)) return 'auth';
        return available ? 'not_configured' : 'unavailable';
    }

    async function skyTranscriptionStatus() {
        try {
            const { data, error } = await client.functions.invoke('sky-transcribir', { body: { ping: true } });
            if (error) {
                const mensaje = await edgeFunctionErrorDetail(error, 'Servicio de voz no disponible.');
                return { disponible: false, configurado: false, codigo: skyVoiceStatusCode(mensaje, false, false), mensaje };
            }
            const disponible = data?.ok === true;
            const configurado = data?.configured === true;
            const mensaje = text(data?.message);
            return {
                disponible,
                configurado,
                codigo: skyVoiceStatusCode(mensaje, disponible, configurado),
                mensaje,
                version: text(data?.version),
                modelo: text(data?.model)
            };
        } catch (error) {
            const mensaje = errorMessage(error);
            return { disponible: false, configurado: false, codigo: skyVoiceStatusCode(mensaje, false, false), mensaje };
        }
    }

    async function transcribeSkyAudio(blob, options = {}) {
        if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('No se recibió audio para transcribir.');
        const form = new FormData();
        const ext = /ogg/i.test(blob.type) ? 'ogg' : /mp4|m4a/i.test(blob.type) ? 'm4a' : 'webm';
        form.append('audio', blob, `sky-${Date.now()}.${ext}`);
        form.append('profile', text(options.profile) || 'consulta');
        form.append('context', text(options.context).slice(0, 1800));
        const { data, error } = await client.functions.invoke('sky-transcribir', { body: form });
        if (error) throw new Error(await edgeFunctionErrorDetail(error, 'No se pudo transcribir el audio.'));
        const transcript = text(data?.text ?? data?.transcript);
        if (!transcript) throw new Error(text(data?.error) || 'No se reconoció una frase en el audio.');
        return { texto: transcript, duracionMs: Number(data?.durationMs) || 0, modelo: text(data?.model) };
    }

    function quotationRequestFromDb(row) {
        return {
            id: text(row.id),
            folio: text(row.folio),
            origen: text(row.origen) || 'bajo_minimo',
            estado: text(row.estado) || 'solicitada',
            prioridad: text(row.prioridad) || 'normal',
            fechaRequerida: text(row.fecha_requerida),
            solicitadoPor: text(row.solicitado_por),
            referencia: text(row.referencia),
            notas: text(row.notas),
            revisadaPor: text(row.revisada_por),
            revisadaAt: text(row.revisada_at),
            aprobadaAt: text(row.aprobada_at),
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at),
            items: Array.isArray(row.co_cotizacion_items) ? row.co_cotizacion_items.map(quotationItemFromDb) : []
        };
    }

    function quotationOfferFromDb(row) {
        const provider = row.co_proveedores || row.proveedor || null;
        return {
            id: Number(row.id),
            itemId: Number(row.cotizacion_item_id),
            proveedorId: row.proveedor_id == null ? null : Number(row.proveedor_id),
            proveedorNombre: text(provider?.nombre_comercial || provider?.razon_social || row.proveedor_temporal_nombre),
            proveedorContacto: text(provider?.contacto || row.proveedor_temporal_contacto),
            proveedorEmail: text(provider?.email || row.proveedor_temporal_email),
            proveedorTelefono: text(provider?.telefono || row.proveedor_temporal_telefono),
            proveedorTemporalNombre: text(row.proveedor_temporal_nombre),
            proveedorTemporalContacto: text(row.proveedor_temporal_contacto),
            proveedorTemporalEmail: text(row.proveedor_temporal_email),
            proveedorTemporalTelefono: text(row.proveedor_temporal_telefono),
            precioUnitario: number(row.precio_unitario),
            moneda: text(row.moneda) || 'MXN',
            plazoEntregaDias: number(row.plazo_entrega_dias),
            vigenciaHasta: text(row.vigencia_hasta),
            cantidadMinima: number(row.cantidad_minima) || 1,
            observaciones: text(row.observaciones),
            origen: text(row.origen) || 'cotizacion',
            estado: text(row.estado) || 'pendiente',
            fechaSolicitud: text(row.fecha_solicitud),
            fechaRespuesta: text(row.fecha_respuesta),
            solicitudProveedorId: text(row.solicitud_proveedor_id),
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    function quotationItemFromDb(row) {
        return {
            id: Number(row.id),
            cotizacionId: text(row.cotizacion_id),
            materialCodigo: text(row.material_codigo),
            descripcion: text(row.descripcion),
            marca: text(row.marca),
            unidad: text(row.unidad),
            cantidad: number(row.cantidad),
            almacenId: row.almacen_id == null ? null : Number(row.almacen_id),
            almacenNombre: text(row.almacen_nombre),
            existenciaActual: number(row.existencia_actual),
            stockMinimo: number(row.stock_minimo),
            stockMedio: number(row.stock_medio),
            stockMaximo: number(row.stock_maximo),
            estado: text(row.estado) || 'pendiente',
            proveedorSeleccionadoId: row.proveedor_seleccionado_id == null ? null : Number(row.proveedor_seleccionado_id),
            ofertaSeleccionadaId: row.oferta_seleccionada_id == null ? null : Number(row.oferta_seleccionada_id),
            ofertas: Array.isArray(row.co_cotizacion_ofertas) ? row.co_cotizacion_ofertas.map(quotationOfferFromDb) : [],
            createdAt: text(row.created_at),
            updatedAt: text(row.updated_at)
        };
    }

    function nextQuotationFolio() {
        const now = new Date();
        const pad = v => String(v).padStart(2, '0');
        return `COT-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
    }

    async function listQuotationRequests(options = {}) {
        let query = client.from('co_cotizaciones').select('*,co_cotizacion_items(*)').order('created_at', { ascending: false });
        if (text(options.estado ?? options.status)) query = query.eq('estado', text(options.estado ?? options.status));
        if (text(options.origen)) query = query.eq('origen', text(options.origen));
        const { data, error } = await query;
        assertNoError(error, 'No se pudieron consultar las cotizaciones. Ejecuta SQL_MAESTRO_CRM.sql si el módulo todavía no está instalado.');
        return (data || []).map(quotationRequestFromDb);
    }

    async function getQuotationRequest(id) {
        const requestId = text(id);
        if (!requestId) throw new Error('Cotización no válida.');
        const { data, error } = await client
            .from('co_cotizaciones')
            .select('*,co_cotizacion_items(*,co_cotizacion_ofertas(*,co_proveedores(*)))')
            .eq('id', requestId)
            .single();
        assertNoError(error, 'No se pudo consultar el detalle de la cotización.');
        return quotationRequestFromDb(data);
    }

    async function createQuotationRequest(payload = {}) {
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (!items.length) throw new Error('Selecciona al menos un material para cotizar.');
        const allowedPriorities = ['critica','urgente','alta','normal','baja','programada'];
        const priority = allowedPriorities.includes(lower(payload.prioridad)) ? lower(payload.prioridad) : 'normal';
        const rows = items.map(item => ({
            material_codigo: text(item.materialCodigo ?? item.codigo),
            descripcion: text(item.descripcion ?? item.desc),
            marca: text(item.marca) || null,
            unidad: text(item.unidad) || null,
            cantidad: number(item.cantidad),
            almacen_id: Number(item.almacenId ?? item.warehouseId ?? 0) || null,
            almacen_nombre: text(item.almacenNombre) || null,
            existencia_actual: number(item.existenciaActual ?? item.stockAlmacen ?? item.stock),
            stock_minimo: number(item.stockMinimo ?? item.stockMinimoAlmacen),
            stock_medio: number(item.stockMedio ?? item.stockMedioAlmacen),
            stock_maximo: number(item.stockMaximo ?? item.stockMaximoAlmacen)
        }));
        if (rows.some(row => !row.material_codigo || !row.descripcion || row.cantidad <= 0)) {
            throw new Error('Hay materiales incompletos o con cantidad inválida.');
        }

        const rpcPayload = {
            p_origen: text(payload.origen) || 'bajo_minimo',
            p_prioridad: priority,
            p_fecha_requerida: text(payload.fechaRequerida) || null,
            p_solicitado_por: text(payload.solicitadoPor) || null,
            p_referencia: text(payload.referencia) || null,
            p_notas: text(payload.notas) || null,
            p_items: rows
        };
        const { data: rpcData, error: rpcError } = await client.rpc('crm_crear_cotizacion', rpcPayload);
        if (!rpcError && rpcData?.id) {
            return {
                id: text(rpcData.id),
                folio: text(rpcData.folio),
                estado: text(rpcData.estado) || 'solicitada',
                prioridad: text(rpcData.prioridad) || priority,
                items: rows.map((row, index) => ({
                    id: index + 1,
                    materialCodigo: row.material_codigo,
                    descripcion: row.descripcion,
                    marca: row.marca,
                    unidad: row.unidad,
                    cantidad: row.cantidad,
                    almacenId: row.almacen_id,
                    almacenNombre: row.almacen_nombre,
                    existenciaActual: row.existencia_actual,
                    stockMinimo: row.stock_minimo,
                    stockMedio: row.stock_medio,
                    stockMaximo: row.stock_maximo,
                    estado: 'pendiente'
                }))
            };
        }

        const rpcMessage = errorMessage(rpcError);
        if (rpcError && !/crm_crear_cotizacion|function|schema cache|PGRST202/i.test(rpcMessage)) {
            throw new Error(`No se pudo crear la solicitud de cotización. ${rpcMessage}`);
        }

        const header = {
            folio: text(payload.folio) || nextQuotationFolio(),
            origen: text(payload.origen) || 'bajo_minimo',
            estado: 'solicitada',
            prioridad: priority,
            fecha_requerida: text(payload.fechaRequerida) || null,
            solicitado_por: text(payload.solicitadoPor) || null,
            referencia: text(payload.referencia) || null,
            notas: text(payload.notas) || null,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await client.from('co_cotizaciones').insert(header).select('*').single();
        assertNoError(error, 'No se pudo crear la solicitud de cotización.');

        const dbRows = rows.map(row => ({ cotizacion_id: data.id, ...row, estado: 'pendiente', updated_at: new Date().toISOString() }));
        const chunkSize = 200;
        try {
            for (let offset = 0; offset < dbRows.length; offset += chunkSize) {
                const { error: itemError } = await client.from('co_cotizacion_items').insert(dbRows.slice(offset, offset + chunkSize));
                assertNoError(itemError, 'No se pudieron guardar los materiales de la cotización.');
            }
        } catch (cause) {
            await client.from('co_cotizaciones').delete().eq('id', data.id);
            throw cause;
        }
        return {
            ...quotationRequestFromDb(data),
            items: rows.map((row, index) => ({
                id: index + 1,
                materialCodigo: row.material_codigo,
                descripcion: row.descripcion,
                marca: row.marca,
                unidad: row.unidad,
                cantidad: row.cantidad,
                almacenId: row.almacen_id,
                almacenNombre: row.almacen_nombre,
                existenciaActual: row.existencia_actual,
                stockMinimo: row.stock_minimo,
                stockMedio: row.stock_medio,
                stockMaximo: row.stock_maximo,
                estado: 'pendiente'
            }))
        };
    }

    async function updateQuotationRequest(id, changes = {}) {
        const row = { updated_at: new Date().toISOString() };
        if ('estado' in changes) row.estado = text(changes.estado);
        if ('prioridad' in changes) row.prioridad = text(changes.prioridad);
        if ('fechaRequerida' in changes) row.fecha_requerida = text(changes.fechaRequerida) || null;
        if ('solicitadoPor' in changes) row.solicitado_por = text(changes.solicitadoPor) || null;
        if ('referencia' in changes) row.referencia = text(changes.referencia) || null;
        if ('notas' in changes) row.notas = text(changes.notas) || null;
        if ('revisadaAt' in changes) row.revisada_at = text(changes.revisadaAt) || null;
        const { data, error } = await client.from('co_cotizaciones').update(row).eq('id', text(id)).select('*').single();
        assertNoError(error, 'No se pudo actualizar la cotización.');
        return quotationRequestFromDb(data);
    }

    function providerMaterialFromDb(row) {
        const provider = row.co_proveedores || {};
        const material = row.materiales || {};
        return {
            id: Number(row.id),
            proveedorId: Number(row.proveedor_id),
            proveedorNombre: text(provider.nombre_comercial || provider.razon_social),
            proveedorContacto: text(provider.contacto),
            proveedorEmail: text(provider.email),
            materialCodigo: text(row.material_codigo),
            descripcion: text(row.descripcion || material.descripcion),
            marca: text(row.marca || material.marca),
            categoria: text(material.categoria),
            unidad: text(material.unidad),
            precioUnitario: number(row.precio_unitario),
            moneda: text(row.moneda) || 'MXN',
            plazoEntregaDias: number(row.plazo_entrega_dias),
            cantidadMinima: number(row.cantidad_minima) || 1,
            vigenciaHasta: text(row.vigencia_hasta),
            ultimaCotizacion: text(row.ultima_cotizacion),
            fuente: text(row.fuente),
            activo: row.activo !== false,
            notas: text(row.notas),
            updatedAt: text(row.updated_at)
        };
    }

    async function listProviderMaterials(options = {}) {
        let query = client.from('co_proveedor_materiales').select('*,co_proveedores(*),materiales(codigo,descripcion,marca,categoria,unidad)').order('updated_at', { ascending: false });
        const providerId = Number(options.proveedorId || 0);
        const materialCode = text(options.materialCodigo);
        if (providerId) query = query.eq('proveedor_id', providerId);
        if (materialCode) query = query.eq('material_codigo', materialCode);
        if (options.activeOnly !== false) query = query.eq('activo', true);
        const { data, error } = await query;
        assertNoError(error, 'No se pudo consultar el catálogo de precios por proveedor.');
        return (data || []).map(providerMaterialFromDb);
    }

    async function saveProviderMaterial(payload = {}) {
        const providerId = Number(payload.proveedorId || 0);
        const materialCode = text(payload.materialCodigo ?? payload.codigo);
        if (!providerId || !materialCode) throw new Error('Selecciona proveedor y material.');
        const row = {
            proveedor_id: providerId,
            material_codigo: materialCode,
            descripcion: text(payload.descripcion) || null,
            marca: text(payload.marca) || null,
            precio_unitario: Math.max(0, number(payload.precioUnitario ?? payload.precio)),
            moneda: ['MXN','USD','EUR'].includes(text(payload.moneda).toUpperCase()) ? text(payload.moneda).toUpperCase() : 'MXN',
            plazo_entrega_dias: Math.max(0, Math.round(number(payload.plazoEntregaDias ?? payload.plazo))),
            cantidad_minima: Math.max(0.0001, number(payload.cantidadMinima) || 1),
            vigencia_hasta: text(payload.vigenciaHasta) || null,
            ultima_cotizacion: text(payload.ultimaCotizacion) || null,
            fuente: ['manual','catalogo','cotizacion_aceptada','importacion'].includes(text(payload.fuente)) ? text(payload.fuente) : 'manual',
            activo: payload.activo !== false,
            notas: text(payload.notas) || null,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await client.from('co_proveedor_materiales').upsert(row, { onConflict: 'proveedor_id,material_codigo' }).select('*,co_proveedores(*),materiales(codigo,descripcion,marca,categoria,unidad)').single();
        assertNoError(error, 'No se pudo guardar el material del proveedor.');
        return providerMaterialFromDb(data);
    }

    async function saveProviderMaterialsBulk(payloads = []) {
        const list = Array.isArray(payloads) ? payloads : [];
        if (!list.length) return { ok: true, count: 0 };
        const rows = list.map(payload => {
            const providerId = Number(payload.proveedorId || 0);
            const materialCode = text(payload.materialCodigo ?? payload.codigo);
            if (!providerId || !materialCode) throw new Error('Hay filas sin proveedor o material.');
            return {
                proveedor_id: providerId,
                material_codigo: materialCode,
                descripcion: text(payload.descripcion) || null,
                marca: text(payload.marca) || null,
                precio_unitario: Math.max(0, number(payload.precioUnitario ?? payload.precio)),
                moneda: ['MXN','USD','EUR'].includes(text(payload.moneda).toUpperCase()) ? text(payload.moneda).toUpperCase() : 'MXN',
                plazo_entrega_dias: Math.max(0, Math.round(number(payload.plazoEntregaDias ?? payload.plazo))),
                cantidad_minima: Math.max(0.0001, number(payload.cantidadMinima) || 1),
                vigencia_hasta: text(payload.vigenciaHasta) || null,
                ultima_cotizacion: text(payload.ultimaCotizacion) || null,
                fuente: ['manual','catalogo','cotizacion_aceptada','importacion'].includes(text(payload.fuente)) ? text(payload.fuente) : 'importacion',
                activo: payload.activo !== false,
                notas: text(payload.notas) || null,
                updated_at: new Date().toISOString()
            };
        });
        let count = 0;
        for (let i = 0; i < rows.length; i += 250) {
            const chunk = rows.slice(i, i + 250);
            const { error } = await client.from('co_proveedor_materiales').upsert(chunk, { onConflict: 'proveedor_id,material_codigo' });
            assertNoError(error, `No se pudo importar el bloque ${Math.floor(i / 250) + 1} del catálogo del proveedor.`);
            count += chunk.length;
        }
        return { ok: true, count };
    }

    async function deleteProviderMaterial(id) {
        const { error } = await client.from('co_proveedor_materiales').delete().eq('id', Number(id));
        assertNoError(error, 'No se pudo eliminar la relación proveedor-material.');
        return true;
    }

    async function ensureQuotationCatalogOffers(quotationId) {
        const quote = await getQuotationRequest(quotationId);
        const allRelations = await listProviderMaterials({ activeOnly: true });
        const relationByMaterial = new Map();
        allRelations.forEach(row => {
            const key = lower(row.materialCodigo);
            if (!relationByMaterial.has(key)) relationByMaterial.set(key, []);
            relationByMaterial.get(key).push(row);
        });
        for (const item of quote.items) {
            const existingProviders = new Set(item.ofertas.filter(o => o.proveedorId).map(o => Number(o.proveedorId)));
            const candidates = relationByMaterial.get(lower(item.materialCodigo)) || [];
            const inserts = candidates.filter(row => !existingProviders.has(Number(row.proveedorId))).map(row => ({
                cotizacion_item_id: item.id,
                proveedor_id: row.proveedorId,
                precio_unitario: row.precioUnitario,
                moneda: row.moneda,
                plazo_entrega_dias: row.plazoEntregaDias,
                vigencia_hasta: row.vigenciaHasta || null,
                cantidad_minima: row.cantidadMinima || 1,
                observaciones: row.notas || null,
                origen: 'catalogo',
                estado: row.precioUnitario > 0 ? 'recibida' : 'pendiente',
                fecha_respuesta: row.precioUnitario > 0 ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            }));
            if (inserts.length) {
                const { error } = await client.from('co_cotizacion_ofertas').insert(inserts);
                assertNoError(error, `No se pudieron cargar las opciones del material ${item.materialCodigo}.`);
            }
        }
        return getQuotationRequest(quotationId);
    }

    async function saveQuotationOffer(payload = {}) {
        const id = Number(payload.id || 0);
        const row = {
            cotizacion_item_id: Number(payload.itemId || payload.cotizacionItemId),
            proveedor_id: Number(payload.proveedorId || 0) || null,
            proveedor_temporal_nombre: text(payload.proveedorTemporalNombre) || null,
            proveedor_temporal_contacto: text(payload.proveedorTemporalContacto) || null,
            proveedor_temporal_email: text(payload.proveedorTemporalEmail) || null,
            proveedor_temporal_telefono: text(payload.proveedorTemporalTelefono) || null,
            precio_unitario: Math.max(0, number(payload.precioUnitario)),
            moneda: ['MXN','USD','EUR'].includes(text(payload.moneda).toUpperCase()) ? text(payload.moneda).toUpperCase() : 'MXN',
            plazo_entrega_dias: Math.max(0, Math.round(number(payload.plazoEntregaDias))),
            vigencia_hasta: text(payload.vigenciaHasta) || null,
            cantidad_minima: Math.max(0.0001, number(payload.cantidadMinima) || 1),
            observaciones: text(payload.observaciones) || null,
            origen: ['catalogo','cotizacion','manual'].includes(text(payload.origen)) ? text(payload.origen) : 'cotizacion',
            estado: text(payload.estado) || ((number(payload.precioUnitario) > 0 || number(payload.plazoEntregaDias) > 0) ? 'recibida' : 'pendiente'),
            fecha_solicitud: text(payload.fechaSolicitud) || null,
            fecha_respuesta: text(payload.fechaRespuesta) || ((number(payload.precioUnitario) > 0 || number(payload.plazoEntregaDias) > 0) ? new Date().toISOString() : null),
            updated_at: new Date().toISOString()
        };
        if (!row.cotizacion_item_id) throw new Error('Material de cotización no válido.');
        const query = id ? client.from('co_cotizacion_ofertas').update(row).eq('id', id) : client.from('co_cotizacion_ofertas').insert(row);
        const { data, error } = await query.select('*,co_proveedores(*)').single();
        assertNoError(error, 'No se pudo guardar la oferta del proveedor.');
        return quotationOfferFromDb(data);
    }

    async function linkQuotationOfferRequest(offerId, requestId) {
        const { error } = await client.from('co_cotizacion_ofertas').update({ solicitud_proveedor_id: text(requestId) || null, fecha_solicitud: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', Number(offerId));
        assertNoError(error, 'La solicitud se creó, pero no pudo vincularse con la oferta.');
        return true;
    }

    async function selectQuotationOffer(itemId, offerId) {
        const { data, error } = await client.from('co_cotizacion_items').update({ oferta_seleccionada_id: Number(offerId) || null, estado: offerId ? 'seleccionado' : 'con_opciones', updated_at: new Date().toISOString() }).eq('id', Number(itemId)).select('*').single();
        assertNoError(error, 'No se pudo seleccionar la propuesta.');
        return quotationItemFromDb(data);
    }

    async function listEmailTemplates() {
        const { data, error } = await client.from('co_plantillas_correo').select('*').eq('activa', true).order('predeterminada', { ascending: false }).order('nombre', { ascending: true });
        assertNoError(error, 'No se pudieron consultar las plantillas de correo.');
        return (data || []).map(row => ({ id:Number(row.id), nombre:text(row.nombre), asunto:text(row.asunto), mensaje:text(row.mensaje), predeterminada:row.predeterminada===true, activa:row.activa!==false }));
    }

    async function saveEmailTemplate(payload = {}) {
        const id = Number(payload.id || 0);
        const row = { nombre:text(payload.nombre), asunto:text(payload.asunto), mensaje:text(payload.mensaje), predeterminada:payload.predeterminada===true, activa:payload.activa!==false, updated_at:new Date().toISOString() };
        if (!row.nombre || !row.asunto || !row.mensaje) throw new Error('Nombre, asunto y mensaje son obligatorios.');
        if (row.predeterminada) await client.from('co_plantillas_correo').update({ predeterminada:false, updated_at:new Date().toISOString() }).neq('id', id || -1);
        const query = id ? client.from('co_plantillas_correo').update(row).eq('id', id) : client.from('co_plantillas_correo').insert(row);
        const { data, error } = await query.select('*').single();
        assertNoError(error, 'No se pudo guardar la plantilla.');
        return { id:Number(data.id), nombre:text(data.nombre), asunto:text(data.asunto), mensaje:text(data.mensaje), predeterminada:data.predeterminada===true, activa:data.activa!==false };
    }

    async function deleteEmailTemplate(id) {
        const { error } = await client.from('co_plantillas_correo').update({ activa:false, predeterminada:false, updated_at:new Date().toISOString() }).eq('id', Number(id));
        assertNoError(error, 'No se pudo retirar la plantilla.');
        return true;
    }

    async function approveQuotation(id) {
        const { data, error } = await client.rpc('co_aprobar_cotizacion', { p_cotizacion_id: text(id) });
        assertNoError(error, 'No se pudo aprobar la cotización.');
        return data;
    }

    function storeRequestFromDb(row) {
        return {
            id: Number(row.id), folio: text(row.folio), negocio: text(row.negocio), producto: text(row.producto),
            marcaEspecifica: text(row.marca_especifica), presentacion: text(row.presentacion), cantidad: number(row.cantidad),
            unidad: text(row.unidad), costoEstimado: number(row.costo_estimado), moneda: text(row.moneda),
            fechaRequerida: text(row.fecha_requerida), prioridad: text(row.prioridad), estado: text(row.estado),
            solicitadoPor: text(row.solicitado_por), responsableCompra: text(row.responsable_compra),
            motivoNoViable: text(row.motivo_no_viable), comprobanteUrl: text(row.comprobante_url),
            notas: text(row.notas), createdAt: text(row.created_at), updatedAt: text(row.updated_at)
        };
    }

    async function listStoreRequests() {
        const { data, error } = await client.from('co_tienda_solicitudes').select('*').order('created_at', { ascending: false });
        assertNoError(error, 'No se pudieron consultar las solicitudes de tienda.');
        return (data || []).map(storeRequestFromDb);
    }

    function nextStoreFolio() {
        const now = new Date();
        return `ST-${now.toISOString().slice(0,10).replaceAll('-','')}-${String(now.getTime()).slice(-6)}`;
    }

    async function saveStoreRequest(payload = {}) {
        const row = {
            folio: text(payload.folio) || nextStoreFolio(),
            negocio: text(payload.negocio), producto: text(payload.producto),
            marca_especifica: text(payload.marcaEspecifica) || null, presentacion: text(payload.presentacion) || null,
            cantidad: number(payload.cantidad) || 1, unidad: text(payload.unidad) || 'pieza',
            costo_estimado: number(payload.costoEstimado), moneda: text(payload.moneda) || 'MXN',
            fecha_requerida: text(payload.fechaRequerida) || null, prioridad: text(payload.prioridad) || 'normal',
            estado: text(payload.estado) || 'no_revisada', solicitado_por: text(payload.solicitadoPor) || null,
            responsable_compra: text(payload.responsableCompra) || null, motivo_no_viable: text(payload.motivoNoViable) || null,
            comprobante_url: text(payload.comprobanteUrl) || null, notas: text(payload.notas) || null,
            updated_at: new Date().toISOString()
        };
        if (!row.negocio || !row.producto) throw new Error('El negocio y el producto son obligatorios.');
        if (row.estado === 'no_viable' && !row.motivo_no_viable) throw new Error('Captura el motivo por el que no se puede realizar la compra.');
        const id = Number(payload.id || 0);
        const query = id ? client.from('co_tienda_solicitudes').update(row).eq('id', id) : client.from('co_tienda_solicitudes').insert(row);
        const { data, error } = await query.select('*').single();
        assertNoError(error, 'No se pudo guardar la solicitud de tienda.');
        return storeRequestFromDb(data);
    }

    async function deleteStoreRequest(id) {
        const { error } = await client.from('co_tienda_solicitudes').delete().eq('id', Number(id));
        assertNoError(error, 'No se pudo eliminar la solicitud de tienda.');
        return { ok: true };
    }

    function serviceFromDb(row) {
        return {
            id: Number(row.id), codigo: text(row.codigo), nombre: text(row.nombre), tipo: text(row.tipo),
            proveedor: text(row.proveedor), cuentaContrato: text(row.cuenta_contrato), ubicacion: text(row.ubicacion),
            periodicidad: text(row.periodicidad), proximaFechaPago: text(row.proxima_fecha_pago),
            anticipacionDias: number(row.anticipacion_dias), montoEstimado: number(row.monto_estimado),
            moneda: text(row.moneda), referenciaPago: text(row.referencia_pago), responsable: text(row.responsable),
            estado: text(row.estado), notas: text(row.notas), createdAt: text(row.created_at), updatedAt: text(row.updated_at)
        };
    }

    async function listServices(options = {}) {
        let query = client.from('co_servicios').select('*').order('proxima_fecha_pago', { ascending: true });
        if (options.activeOnly) query = query.eq('estado', 'activo');
        const { data, error } = await query;
        assertNoError(error, 'No se pudieron consultar los servicios.');
        return (data || []).map(serviceFromDb);
    }

    async function saveService(payload = {}) {
        const row = {
            codigo: text(payload.codigo) || null, nombre: text(payload.nombre), tipo: text(payload.tipo),
            proveedor: text(payload.proveedor) || null, cuenta_contrato: text(payload.cuentaContrato) || null,
            ubicacion: text(payload.ubicacion) || null, periodicidad: text(payload.periodicidad) || 'mensual',
            proxima_fecha_pago: text(payload.proximaFechaPago), anticipacion_dias: Math.max(0, Math.trunc(number(payload.anticipacionDias) || 0)),
            monto_estimado: number(payload.montoEstimado), moneda: text(payload.moneda) || 'MXN',
            referencia_pago: text(payload.referenciaPago) || null, responsable: text(payload.responsable) || null,
            estado: text(payload.estado) || 'activo', notas: text(payload.notas) || null, updated_at: new Date().toISOString()
        };
        if (!row.nombre || !row.tipo || !row.proxima_fecha_pago) throw new Error('Nombre, tipo y próxima fecha de pago son obligatorios.');
        const id = Number(payload.id || 0);
        const query = id ? client.from('co_servicios').update(row).eq('id', id) : client.from('co_servicios').insert(row);
        const { data, error } = await query.select('*').single();
        assertNoError(error, 'No se pudo guardar el servicio.');
        return serviceFromDb(data);
    }

    async function deleteService(id) {
        const { error } = await client.from('co_servicios').delete().eq('id', Number(id));
        assertNoError(error, 'No se pudo eliminar el servicio.');
        return { ok: true };
    }

    async function generateServiceAlerts() {
        const { data, error } = await client.rpc('co_generar_alertas_servicios');
        assertNoError(error, 'No se pudieron generar las alertas de servicios.');
        return number(data);
    }

    function servicePaymentFromDb(row) {
        return {
            id: Number(row.id), servicioId: Number(row.servicio_id), periodo: text(row.periodo),
            fechaVencimiento: text(row.fecha_vencimiento), fechaPago: text(row.fecha_pago),
            importe: number(row.importe), estado: text(row.estado), comprobanteUrl: text(row.comprobante_url),
            referencia: text(row.referencia), notas: text(row.notas), createdAt: text(row.created_at)
        };
    }

    async function listServicePayments(serviceId = 0) {
        let query = client.from('co_servicio_pagos').select('*').order('fecha_vencimiento', { ascending: false });
        if (Number(serviceId)) query = query.eq('servicio_id', Number(serviceId));
        const { data, error } = await query;
        assertNoError(error, 'No se pudieron consultar los pagos de servicios.');
        return (data || []).map(servicePaymentFromDb);
    }

    async function saveServicePayment(payload = {}) {
        const row = {
            servicio_id: Number(payload.servicioId), periodo: text(payload.periodo) || null,
            fecha_vencimiento: text(payload.fechaVencimiento), fecha_pago: text(payload.fechaPago) || null,
            importe: number(payload.importe), estado: text(payload.estado) || 'pendiente',
            comprobante_url: text(payload.comprobanteUrl) || null, referencia: text(payload.referencia) || null,
            notas: text(payload.notas) || null, updated_at: new Date().toISOString()
        };
        if (!row.servicio_id || !row.fecha_vencimiento) throw new Error('Servicio y fecha de vencimiento son obligatorios.');
        const id = Number(payload.id || 0);
        const query = id ? client.from('co_servicio_pagos').update(row).eq('id', id) : client.from('co_servicio_pagos').insert(row);
        const { data, error } = await query.select('*').single();
        assertNoError(error, 'No se pudo guardar el pago del servicio.');
        if (row.estado === 'pagado') {
            try {
                await client.from('notificaciones_sistema').update({ leida: true })
                    .eq('tipo', 'servicio_proximo_pago').eq('entidad_id', row.servicio_id);
            } catch (_) {}
        }
        return servicePaymentFromDb(data);
    }


    function parseLocationForSort(value) {
        const match = text(value).toUpperCase().match(/^(\d{2})-([1-9]\d*)-([A-Z])(\d+)$/);
        if (!match) return { rack: 999, zone: 999, floor: 'Z', consecutive: 999999, raw: text(value) };
        return { rack: Number(match[1]), zone: Number(match[2]), floor: match[3], consecutive: Number(match[4]), raw: text(value) };
    }

    function compareWarehouseLocations(a, b) {
        const x = parseLocationForSort(a?.ubicacion ?? a?.location);
        const y = parseLocationForSort(b?.ubicacion ?? b?.location);
        return x.rack - y.rack || x.zone - y.zone || x.floor.localeCompare(y.floor, 'es') || x.consecutive - y.consecutive || x.raw.localeCompare(y.raw, 'es');
    }

    async function suggestWarehouseMaterialLocation(payload = {}) {
        const code = text(payload.codigo ?? payload.materialCodigo ?? payload.material_codigo);
        const warehouseId = Number(payload.almacenId ?? payload.warehouseId ?? payload.almacen_id ?? 0);
        if (!code) throw new Error('Selecciona el material que deseas acomodar.');
        if (!warehouseId) throw new Error('Selecciona el almacén donde deseas acomodarlo.');

        const [materials, structures, inventory] = await Promise.all([
            listMaterials(),
            listWarehouseLocations({ warehouseId, activeOnly: true }),
            listWarehouseInventory({ warehouseId, includeInactive: true })
        ]);
        const material = materials.find(item => lower(item.codigo) === lower(code));
        if (!material) throw new Error(`No se encontró el material ${code}.`);
        const category = lower(material.categoria);
        const activeStructures = structures.filter(item => /^(\d{2})-([1-9]\d*)-([A-Z])$/.test(text(item.codigo).toUpperCase()));
        if (!activeStructures.length) throw new Error('El almacén todavía no tiene racks, zonas y pisos configurados.');

        const occupiedByBase = new Map();
        const categoryByBase = new Map();
        inventory.forEach(item => {
            const location = text(item.ubicacion).toUpperCase();
            const match = location.match(/^(\d{2}-[1-9]\d*-[A-Z])(\d+)$/);
            if (!match) return;
            const base = match[1];
            if (!occupiedByBase.has(base)) occupiedByBase.set(base, new Set());
            occupiedByBase.get(base).add(Number(match[2]));
            if (category && lower(item.categoria) === category) categoryByBase.set(base, (categoryByBase.get(base) || 0) + 1);
        });

        const candidates = [];
        activeStructures.forEach(structure => {
            const base = text(structure.codigo).toUpperCase();
            const capacity = Math.max(1, Math.trunc(number(structure.columnas ?? structure.capacidadConsecutivos) || 20));
            const occupied = occupiedByBase.get(base) || new Set();
            let consecutive = 0;
            for (let index = 1; index <= capacity; index += 1) {
                if (!occupied.has(index)) { consecutive = index; break; }
            }
            if (!consecutive) return;
            const sameCategory = categoryByBase.get(base) || 0;
            const occupancy = occupied.size / capacity;
            candidates.push({
                structure,
                base,
                capacity,
                occupied: occupied.size,
                free: Math.max(0, capacity - occupied.size),
                consecutive,
                codigo: `${base}${consecutive}`,
                sameCategory,
                score: sameCategory * 100 - occupancy * 10
            });
        });
        if (!candidates.length) throw new Error('No quedan consecutivos libres en la estructura física configurada para este almacén.');
        candidates.sort((a, b) => b.score - a.score || compareWarehouseLocations({ ubicacion: `${a.base}1` }, { ubicacion: `${b.base}1` }));
        const best = candidates[0];
        return {
            materialCodigo: material.codigo,
            materialDescripcion: text(material.descripcion ?? material.desc),
            categoria: text(material.categoria),
            almacenId: warehouseId,
            almacenNombre: text(best.structure.almacenNombre),
            ubicacion: best.codigo,
            base: best.base,
            rack: Number(best.base.slice(0, 2)),
            zona: Number(best.base.split('-')[1]),
            piso: best.base.split('-')[2],
            consecutivo: best.consecutive,
            capacidad: best.capacity,
            ocupados: best.occupied,
            libres: best.free,
            materialesMismaCategoria: best.sameCategory,
            razon: best.sameCategory > 0
                ? `Se priorizó una zona que ya contiene ${best.sameCategory} material${best.sameCategory === 1 ? '' : 'es'} de la misma categoría.`
                : 'Se seleccionó el primer espacio libre con mejor disponibilidad dentro de la estructura configurada.'
        };
    }

    async function buildProjectPickingRoute(projectNumber, options = {}) {
        const project = text(projectNumber);
        const warehouseId = Number(options.almacenId ?? options.warehouseId ?? 0);
        if (!project) throw new Error('Selecciona un proyecto.');
        const [plan, materials, warehouses] = await Promise.all([
            listProjectMovementPlan(project),
            listMaterials(),
            listWarehouses({ activeOnly: true })
        ]);
        const warehouseById = new Map(warehouses.map(item => [Number(item.id), item]));
        const materialByCode = new Map(materials.map(item => [lower(item.codigo), item]));
        const picks = [];
        const shortages = [];
        const withoutLocation = [];

        plan.filter(line => number(line.pendiente) > 0).forEach(line => {
            const pending = number(line.pendiente);
            const material = materialByCode.get(lower(line.codigo)) || line.material || {};
            let remaining = pending;
            const sources = (Array.isArray(material.almacenes) ? material.almacenes : [])
                .filter(item => number(item.stock) > 0 && (!warehouseId || Number(item.id) === warehouseId))
                .sort((a, b) => {
                    const aLocated = text(a.ubicacion) ? 0 : 1;
                    const bLocated = text(b.ubicacion) ? 0 : 1;
                    return aLocated - bLocated || compareWarehouseLocations({ ubicacion: a.ubicacion }, { ubicacion: b.ubicacion }) || text(a.nombre).localeCompare(text(b.nombre), 'es');
                });
            sources.forEach(source => {
                if (remaining <= 0) return;
                const take = Math.min(remaining, number(source.stock));
                if (take <= 0) return;
                const row = {
                    proyecto: project,
                    codigo: text(line.codigo),
                    descripcion: text(line.descripcion ?? material.descripcion ?? material.desc ?? line.codigo),
                    categoria: text(line.categoria ?? material.categoria),
                    unidad: text(line.unidad ?? material.unidad),
                    cantidad: take,
                    pendienteProyecto: pending,
                    almacenId: Number(source.id),
                    almacenNombre: text(source.nombre || warehouseById.get(Number(source.id))?.nombre),
                    ubicacion: text(source.ubicacion),
                    disponible: number(source.stock)
                };
                if (row.ubicacion) picks.push(row); else withoutLocation.push(row);
                remaining -= take;
            });
            if (remaining > 0) shortages.push({
                proyecto: project,
                codigo: text(line.codigo),
                descripcion: text(line.descripcion ?? material.descripcion ?? material.desc ?? line.codigo),
                unidad: text(line.unidad ?? material.unidad),
                requerido: pending,
                faltante: remaining
            });
        });

        picks.sort((a, b) => text(a.almacenNombre).localeCompare(text(b.almacenNombre), 'es') || compareWarehouseLocations(a, b) || text(a.descripcion).localeCompare(text(b.descripcion), 'es'));
        withoutLocation.sort((a, b) => text(a.almacenNombre).localeCompare(text(b.almacenNombre), 'es') || text(a.descripcion).localeCompare(text(b.descripcion), 'es'));
        return {
            proyecto: project,
            almacenId: warehouseId || null,
            rutas: picks,
            sinUbicacion: withoutLocation,
            faltantes: shortages,
            totalParadas: picks.length,
            totalMateriales: new Set(picks.map(item => lower(item.codigo))).size,
            totalUnidades: picks.reduce((sum, item) => sum + number(item.cantidad), 0)
        };
    }

    async function listOperationalAlerts() {
        const [low, purchaseRequests, pendingLocations, toolAssignments, vehicles] = await Promise.all([
            listLowStock(),
            listPurchaseRequests({ activeOnly: true }),
            listPendingLocations(),
            listToolAssignments({ status: 'activa' }),
            listVehicles({ includeInactive: false })
        ]);
        const today = new Date();
        const limit = new Date(today.getTime() + 30 * 86400000);
        const expiringVehicles = vehicles.filter(vehicle => [vehicle.vigenciaSeguro, vehicle.vigenciaTarjeta, vehicle.proximaVerificacion].some(value => {
            if (!value) return false;
            const date = new Date(`${value}T12:00:00`);
            return !Number.isNaN(date.getTime()) && date <= limit;
        }));
        const overdueTools = toolAssignments.filter(item => item.estado === 'vencida');
        const purchasePending = purchaseRequests.filter(item => !['recibida', 'cerrada', 'cancelada', 'rechazada'].includes(lower(item.estado)));
        return {
            lowStock: low,
            purchasePending,
            pendingLocations,
            overdueTools,
            expiringVehicles,
            summary: {
                bajoMinimo: low.length,
                comprasPendientes: purchasePending.length,
                ubicacionesPendientes: pendingLocations.length,
                herramientasVencidas: overdueTools.length,
                documentosVehiculo: expiringVehicles.length
            }
        };
    }

    async function getExecutiveProjectSummary() {
        const { data, error } = await client.rpc('crm_resumen_ejecutivo_proyectos');
        assertNoError(error, 'No se pudo consultar el resumen ejecutivo de proyectos. Ejecuta SQL_MAESTRO_CRM.sql V22.');
        return (Array.isArray(data) ? data : []).map(row => ({
            proyecto: text(row.proyecto), nombre: text(row.nombre), cliente: text(row.cliente), responsable: text(row.responsable),
            estado: text(row.estado), fechaInicio: text(row.fecha_inicio), fechaEntrega: text(row.fecha_entrega),
            material_planeado: number(row.material_planeado), material_real: number(row.material_real),
            nomina_planeada: number(row.nomina_planeada), nomina_real: number(row.nomina_real),
            total_planeado: number(row.total_planeado), total_real: number(row.total_real), desviacion_total: number(row.desviacion_total)
        }));
    }

    async function getExecutiveProjectDetail(projectNumber) {
        const project = text(projectNumber);
        if (!project) throw new Error('Selecciona un proyecto.');
        const { data, error } = await client.rpc('crm_detalle_ejecutivo_proyecto', { p_proyecto: project });
        assertNoError(error, 'No se pudo consultar el detalle financiero del proyecto.');
        if (!data || typeof data !== 'object') throw new Error('El proyecto no devolvió información financiera.');
        return data;
    }

    async function listQuotationPurchaseOrders(quotationId = '') {
        let query = client.from('solicitudes_compra').select('*').order('created_at', { ascending: true });
        if (text(quotationId)) query = query.eq('cotizacion_id', text(quotationId));
        const { data, error } = await query;
        assertNoError(error, 'No se pudieron consultar las órdenes vinculadas a la cotización.');
        const warehouses = await listWarehouses();
        const warehouseById = new Map(warehouses.map(item => [Number(item.id), item]));
        return (data || []).map(row => ({
            ...purchaseRequestFromDb(row, warehouseById),
            cotizacionId: text(row.cotizacion_id), cotizacionItemId: Number(row.cotizacion_item_id || 0) || null,
            proveedorId: Number(row.proveedor_id || 0) || null, precioCotizado: number(row.precio_cotizado),
            moneda: text(row.moneda) || 'MXN', plazoEntregaDias: number(row.plazo_entrega_dias)
        }));
    }

    async function healthCheck() {
        const { error } = await client.from('materiales').select('codigo').limit(1);
        assertNoError(error, 'No se pudo conectar con Supabase.');
        return true;
    }

    window.SkilledDB = Object.freeze({
        client,
        healthCheck,
        listWarehouses,
        listWarehouseInventory,
        suggestWarehouseMaterialLocation,
        buildProjectPickingRoute,
        listOperationalAlerts,
        getExecutiveProjectSummary,
        getExecutiveProjectDetail,
        assignWarehouseMaterialLocation,
        assignWarehouseMaterialsLocation,
        updateWarehouseInventoryLevels,
        saveWarehouse,
        deleteWarehouse,
        listWarehouseLocations,
        saveWarehouseLocation,
        saveWarehouseLocationsBulk,
        deleteWarehouseRack,
        deleteWarehouseLocation,
        listCategories,
        saveCategory,
        deleteCategory,
        listMaterials,
        listLowStock,
        listPurchaseRequests,
        listPurchaseOrderItems,
        createPurchaseRequest,
        createPurchaseRequests,
        uploadPurchaseOrderPdf,
        getPurchaseOrderPdfUrl,
        updatePurchaseRequest,
        updatePurchaseRequests,
        deletePurchaseRequests,
        deletePurchaseRequestsTest,
        deleteAllPurchaseOrdersTest,
        deleteMovementTest,
        deleteMovementHistoryTest,
        deleteToolUnitsTest,
        deleteMaterialRequestTest,
        deleteMaterialAdjustmentTest,
        deleteToolHistoryTest,
        deleteToolTest,
        deleteToolUnitTest,
        deleteToolAssignmentTest,
        deleteProjectTest,
        deleteVehicleTest,
        saveMaterial,
        matchesMaterial,
        deleteMaterial,
        importMaterials,
        parseWarehouseLocationCode,
        normalizeWarehouseLocationCode,
        validateWarehouseLocationAgainstStructure,
        listMovements,
        listMovementGroups,
        registerMovement,
        transferProjectMaterials,
        loanProjectMaterials,
        listVehicles,
        saveVehicle,
        setVehicleActive,
        deleteVehicle,
        listVehicleTrips,
        saveVehicleTrip,
        closeVehicleTrip,
        deleteVehicleTrip,
        listVehicleExpenses,
        saveVehicleExpense,
        deleteVehicleExpense,
        listProjectToolPlan,
        saveProjectToolPlan,
        listToolAssignments,
        assignToolUnits,
        returnToolAssignment,
        cancelToolAssignment,
        listToolHistory,
        getToolAssignmentGroup,
        getMyProfile,
        saveMyProfile,
        listTools,
        saveTool,
        createIncompleteTool,
        setToolActive,
        deleteTool,
        importTools,
        listToolUnits,
        nextToolUnitCode,
        saveToolUnit,
        setToolUnitStatus,
        deleteToolUnit,
        listPendingLocations,
        listProjectOptions,
        listProjects,
        listProjectLines,
        listProjectPlan: listProjectPlanV12,
        listProjectDeliveryPlan: listProjectMovementPlan,
        listProjectMovementPlan,
        saveProjectPlan: saveProjectPlanV12,
        createIncompleteMaterial,
        listMaterialRequests,
        setMaterialRequestStatus,
        createMaterialAdjustment,
        listMaterialAdjustments,
        resolveMaterialAdjustment,
        listUnreadNotifications,
        listDeliveryInfos,
        saveDeliveryInfo,
        deleteDeliveryInfo,
        listSupplierRequests,
        createSupplierRequest,
        updateSupplierRequest,
        sendSupplierRequest,
        skyTranscriptionStatus,
        transcribeSkyAudio,
        listQuotationRequests,
        getQuotationRequest,
        createQuotationRequest,
        updateQuotationRequest,
        listProviderMaterials,
        saveProviderMaterial,
        saveProviderMaterialsBulk,
        deleteProviderMaterial,
        ensureQuotationCatalogOffers,
        saveQuotationOffer,
        linkQuotationOfferRequest,
        selectQuotationOffer,
        listEmailTemplates,
        saveEmailTemplate,
        deleteEmailTemplate,
        approveQuotation,
        listQuotationPurchaseOrders,
        listStoreRequests,
        saveStoreRequest,
        deleteStoreRequest,
        listServices,
        saveService,
        deleteService,
        generateServiceAlerts,
        listServicePayments,
        saveServicePayment,
        saveProject,
        deleteProject
    });
})();
