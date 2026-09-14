(function () {
    'use strict';
    const text = value => String(value ?? '').trim();
    const number = value => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
    const currency = value => ['MXN','USD','EUR'].includes(text(value).toUpperCase()) ? text(value).toUpperCase() : 'MXN';
    const escape = value => text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const code = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;

    async function loadCategories() {
        let datalist = document.getElementById('categorias-materiales-v126');
        if (!datalist) { datalist = document.createElement('datalist'); datalist.id = 'categorias-materiales-v126'; document.body.appendChild(datalist); }
        try {
            const [categories, materials] = await Promise.all([
                typeof SkilledDB.listCategories === 'function' ? SkilledDB.listCategories() : [],
                typeof SkilledDB.listMaterials === 'function' ? SkilledDB.listMaterials() : []
            ]);
            const names = new Set();
            categories.forEach(item => { if (text(item.nombre)) names.add(text(item.nombre)); });
            materials.forEach(item => { if (text(item.categoria)) names.add(text(item.categoria)); });
            datalist.innerHTML = [...names].sort((a,b)=>a.localeCompare(b,'es')).map(name => `<option value="${escape(name)}"></option>`).join('');
        } catch (_) {}
    }

    function decorate(prefix) {
        const category = document.getElementById(`${prefix}-categoria`);
        if (category) category.setAttribute('list', 'categorias-materiales-v126');
    }

    if (document.getElementById('plan-nl-descripcion')) {
        decorate('plan-nl');
        window.agregarMaterialNoListadoPlan = async function () {
            const codigo = text(document.getElementById('plan-nl-codigo')?.value) || code('NL');
            const descripcion = text(document.getElementById('plan-nl-descripcion')?.value);
            const categoria = text(document.getElementById('plan-nl-categoria')?.value);
            const unidad = text(document.getElementById('plan-nl-unidad')?.value);
            const codigoMarca = text(document.getElementById('plan-nl-codigo-marca')?.value);
            const precio = Math.max(0, number(document.getElementById('plan-nl-precio')?.value));
            const cantidad = Math.max(0, number(document.getElementById('plan-nl-cantidad')?.value));
            const monedaCosto = currency(document.getElementById('plan-nl-moneda')?.value);
            if (!descripcion || !unidad) return alert('Descripción y unidad son obligatorias.');
            if (!(cantidad > 0)) return alert('La cantidad requerida debe ser mayor a cero.');
            if (planBorrador.some(item => text(item.codigo).toLowerCase() === codigo.toLowerCase())) return alert('Ya existe un material con ese código dentro del plan.');
            try {
                const material = await SkilledDB.createIncompleteMaterial({ codigo, descripcion, categoria, unidad, precio, monedaCosto, codigoMarca, origen: 'plan_proyecto' });
                if (Array.isArray(catalogoMateriales) && !catalogoMateriales.some(item => text(item.codigo).toLowerCase() === text(material.codigo).toLowerCase())) catalogoMateriales.push(material);
                planBorrador.push({ id:null, codigo:material.codigo, cantidadPlaneada:cantidad, cantidadEntregada:0, cantidadSobrante:0, unidad:material.unidad || unidad, precioUnitario:Number(material.precio || precio), monedaCosto:material.monedaCosto || material.moneda_costo || monedaCosto, moneda_costo:material.monedaCosto || material.moneda_costo || monedaCosto, observaciones:'', esNoListado:true, es_no_listado:true, material:{...material,esNoListado:true,es_no_listado:true,esIncompleto:true} });
                cerrarMaterialNoListadoPlan(); renderEditorPlan(); loadCategories();
            } catch (error) { alert(error.message); }
        };
    }

    if (document.getElementById('ed-nl-descripcion')) {
        decorate('ed-nl');
        window.agregarMaterialNoListadoEntrega = async function () {
            const codigo = text(document.getElementById('ed-nl-codigo')?.value) || code('NL');
            const descripcion = text(document.getElementById('ed-nl-descripcion')?.value);
            const categoria = text(document.getElementById('ed-nl-categoria')?.value);
            const unidad = text(document.getElementById('ed-nl-unidad')?.value);
            const codigoMarca = text(document.getElementById('ed-nl-codigo-marca')?.value);
            const precio = Math.max(0, number(document.getElementById('ed-nl-precio')?.value));
            const cantidad = Math.max(0, number(document.getElementById('ed-nl-cantidad')?.value));
            const monedaCosto = currency(document.getElementById('ed-nl-moneda')?.value);
            if (!descripcion || !unidad) return alert('Descripción y unidad son obligatorias.');
            if (!(cantidad > 0)) return alert('La cantidad debe ser mayor a cero.');
            try {
                const material = await SkilledDB.createIncompleteMaterial({ codigo, descripcion, categoria, unidad, precio, monedaCosto, codigoMarca, origen:'entrega_directa' });
                catalogoProductos = await SkilledDB.listMaterials({ refresh:true });
                const existing = entregaMateriales.find(item => text(item.producto?.codigo).toLowerCase() === text(material.codigo).toLowerCase());
                if (existing) existing.cantidad += cantidad;
                else entregaMateriales.push({ producto:{...material,desc:material.desc||material.descripcion,esNoListado:true,es_no_listado:true,esIncompleto:true}, cantidad, stockDisponible:null, esNoListado:true });
                cerrarMaterialNoListadoEntrega(); renderMateriales(); renderListaMaterialModal?.(); loadCategories();
            } catch (error) { alert(error.message); }
        };
    }

    loadCategories();
})();
