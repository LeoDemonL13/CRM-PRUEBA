/* SKILLED CRM v12 — alta incompleta desde Entrega directa */
(function () {
    'use strict';
    const originalGenerateCode = window.generarCodigoNoListadoEntrega;
    const modal = document.getElementById('modal-no-listado-entrega');
    if (modal) {
        const subtitle = modal.querySelector('h3 + p');
        if (subtitle) subtitle.textContent = 'Se dará de alta en el catálogo como material incompleto conservando su código de marca / modelo. Para despacharlo debe existir stock en la bodega de origen.';
        const saveButton = modal.querySelector('button[onclick="agregarMaterialNoListadoEntrega()"]');
        if (saveButton) saveButton.textContent = 'Dar de alta en catálogo';
    }

    window.agregarMaterialNoListadoEntrega = async function () {
        const description = document.getElementById('ed-nl-descripcion').value.trim();
        const unit = document.getElementById('ed-nl-unidad').value.trim();
        const code = document.getElementById('ed-nl-codigo').value.trim() || (originalGenerateCode ? originalGenerateCode() : `INC-${Date.now()}`);
        const category = document.getElementById('ed-nl-categoria').value.trim();
        const brandCode = document.getElementById('ed-nl-codigo-marca')?.value.trim() || '';
        const price = Math.max(0, Number(document.getElementById('ed-nl-precio').value) || 0);
        if (!description) return alert('Escribe la descripción del material.');
        try {
            await SkilledDB.createIncompleteMaterial({ codigo: code, descripcion: description, categoria: category, unidad: unit, precio: price, codigoMarca: brandCode, origen: 'entrega_directa' });
            catalogoProductos = await SkilledDB.listMaterials();
            cerrarMaterialNoListadoEntrega();
            renderMateriales();
            alert('El material se añadió al catálogo como “Información incompleta”. Registra una entrada antes de intentar despacharlo.');
        } catch (error) {
            alert(error.message);
        }
    };
})();
