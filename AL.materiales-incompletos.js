/* Alta controlada de materiales incompletos */
(function () {
    'use strict';

    const text = value => String(value ?? '').trim();
    const number = value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const escape = value => text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    async function loadCategories() {
        let datalist = document.getElementById('categorias-materiales-v125');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'categorias-materiales-v125';
            document.body.appendChild(datalist);
        }
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
        const code = document.getElementById(`${prefix}-codigo`);
        const category = document.getElementById(`${prefix}-categoria`);
        const unit = document.getElementById(`${prefix}-unidad`);
        [code, category, unit].forEach(input => input?.setAttribute('required', 'required'));
        if (code) code.placeholder = 'Código obligatorio';
        if (category) {
            category.placeholder = 'Selecciona o escribe una categoría';
            category.setAttribute('list', 'categorias-materiales-v125');
        }
        const labelOf = input => input?.parentElement?.querySelector('label');
        [code, category, unit].forEach(input => {
            const label = labelOf(input);
            if (label && !label.textContent.includes('*')) label.textContent = `${label.textContent.trim()} *`;
        });
    }

    if (document.getElementById('plan-nl-codigo')) {
        decorate('plan-nl');
        window.agregarMaterialNoListadoPlan = async function () {
            const codigo = text(document.getElementById('plan-nl-codigo')?.value);
            const descripcion = text(document.getElementById('plan-nl-descripcion')?.value);
            const categoria = text(document.getElementById('plan-nl-categoria')?.value);
            const unidad = text(document.getElementById('plan-nl-unidad')?.value);
            const codigoMarca = text(document.getElementById('plan-nl-codigo-marca')?.value);
            const precio = Math.max(0, number(document.getElementById('plan-nl-precio')?.value));
            if (!codigo || !descripcion || !categoria || !unidad) {
                return alert('Código, descripción, categoría y unidad son obligatorios.');
            }
            if (planBorrador.some(item => String(item.codigo).toLowerCase() === codigo.toLowerCase())) {
                return alert('Ya existe un material con ese código dentro del plan.');
            }
            try {
                const material = await SkilledDB.createIncompleteMaterial({ codigo, descripcion, categoria, unidad, precio, codigoMarca, origen: 'plan_proyecto' });
                if (Array.isArray(catalogoMateriales) && !catalogoMateriales.some(item => String(item.codigo).toLowerCase() === codigo.toLowerCase())) {
                    catalogoMateriales.push(material);
                }
                planBorrador.push({
                    id: null,
                    codigo: material.codigo,
                    cantidadPlaneada: 1,
                    cantidadEntregada: 0,
                    cantidadSobrante: 0,
                    unidad: material.unidad,
                    precioUnitario: Number(material.precio || 0),
                    observaciones: '',
                    esNoListado: false,
                    material: { ...material, esIncompleto: true }
                });
                cerrarMaterialNoListadoPlan();
                renderEditorPlan();
                loadCategories();
                alert('El material se agregó al catálogo como “Información incompleta” y al plan del proyecto.');
            } catch (error) {
                alert(error.message);
            }
        };
    }

    if (document.getElementById('ed-nl-codigo')) {
        decorate('ed-nl');
        window.agregarMaterialNoListadoEntrega = async function () {
            const codigo = text(document.getElementById('ed-nl-codigo')?.value);
            const descripcion = text(document.getElementById('ed-nl-descripcion')?.value);
            const categoria = text(document.getElementById('ed-nl-categoria')?.value);
            const unidad = text(document.getElementById('ed-nl-unidad')?.value);
            const codigoMarca = text(document.getElementById('ed-nl-codigo-marca')?.value);
            const precio = Math.max(0, number(document.getElementById('ed-nl-precio')?.value));
            if (!codigo || !descripcion || !categoria || !unidad) {
                return alert('Código, descripción, categoría y unidad son obligatorios.');
            }
            try {
                const material = await SkilledDB.createIncompleteMaterial({ codigo, descripcion, categoria, unidad, precio, codigoMarca, origen: 'entrega_directa' });
                const existing = entregaMateriales.find(item => String(item.producto?.codigo).toLowerCase() === material.codigo.toLowerCase());
                if (existing) existing.cantidad += 1;
                else entregaMateriales.push({
                    producto: { ...material, desc: material.desc || material.descripcion, esNoListado: true, es_no_listado: true, esIncompleto: true },
                    cantidad: 1,
                    stockDisponible: null,
                    esNoListado: true
                });
                cerrarMaterialNoListadoEntrega();
                renderMateriales();
                loadCategories();
                alert('El material se dio de alta en el catálogo como “Información incompleta” y se añadió a la entrega.');
            } catch (error) {
                alert(error.message);
            }
        };
    }

    loadCategories();
})();
