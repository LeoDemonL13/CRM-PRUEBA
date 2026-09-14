let serviciosProyecto = [];
let activosServiciosProyecto = [];
let servicioProyectoEditando = null;
let serviciosProyectoNumeroCargado = '';
let activosServiciosProyectoListos = false;

const etiquetasTipoActivoServicio = {
    equipo_oficina: 'Equipo de oficina',
    vehiculo: 'Vehículo',
    herramienta: 'Herramienta'
};

const etiquetasTipoServicio = {
    mantenimiento_preventivo: 'Mantenimiento preventivo',
    mantenimiento_correctivo: 'Mantenimiento correctivo',
    reparacion: 'Reparación',
    inspeccion: 'Inspección',
    calibracion: 'Calibración',
    limpieza: 'Limpieza',
    diagnostico: 'Diagnóstico',
    otro: 'Otro'
};

const etiquetasEstadoServicio = {
    programado: 'Programado',
    pendiente: 'Pendiente',
    en_proceso: 'En proceso',
    completado: 'Completado',
    cancelado: 'Cancelado'
};

function clienteServiciosProyecto() {
    if (!window.SkilledDB || !window.SkilledDB.client) throw new Error('No está disponible la conexión con Supabase.');
    return window.SkilledDB.client;
}

function numeroProyectoServicios() {
    if (typeof proyectoActual === 'undefined' || !proyectoActual) return '';
    return String(proyectoActual.proyecto || '').trim();
}

function textoServicioSeguro(valor) {
    return String(valor ?? '').trim();
}

function escaparServicioHTML(valor) {
    return String(valor ?? '').replace(/[&<>'"]/g, caracter => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[caracter]));
}

function normalizarServicioTexto(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function fechaServicioTexto(valor) {
    if (!valor) return '—';
    const fecha = new Date(`${valor}T12:00:00`);
    if (Number.isNaN(fecha.getTime())) return escaparServicioHTML(valor);
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monedaServicio(valor, moneda) {
    const codigo = ['MXN','USD','EUR'].includes(String(moneda || '').toUpperCase()) ? String(moneda).toUpperCase() : 'MXN';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: codigo, maximumFractionDigits: 2 }).format(Number(valor || 0)) + ` ${codigo}`;
}

function claseEstadoServicio(estado) {
    const clases = {
        programado: 'border-blue-500/30 bg-blue-950/20 text-blue-300',
        pendiente: 'border-amber-500/30 bg-amber-950/20 text-amber-300',
        en_proceso: 'border-violet-500/30 bg-violet-950/20 text-violet-300',
        completado: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300',
        cancelado: 'border-rose-500/30 bg-rose-950/20 text-rose-300'
    };
    return clases[estado] || 'border-[#34415f] bg-[#10172a] text-gray-300';
}

function claseTipoActivoServicio(tipo) {
    const clases = {
        equipo_oficina: 'border-cyan-500/25 bg-cyan-950/15 text-cyan-300',
        vehiculo: 'border-blue-500/25 bg-blue-950/15 text-blue-300',
        herramienta: 'border-amber-500/25 bg-amber-950/15 text-amber-300'
    };
    return clases[tipo] || 'border-[#34415f] bg-[#10172a] text-gray-300';
}

function mostrarAvisoServiciosProyecto(mensaje, tipo = 'aviso') {
    const caja = document.getElementById('servicios-aviso');
    if (!caja) return;
    if (!mensaje) {
        caja.classList.add('hidden');
        caja.textContent = '';
        return;
    }
    caja.textContent = mensaje;
    caja.classList.remove('hidden');
    caja.classList.toggle('border-rose-500/30', tipo === 'error');
    caja.classList.toggle('bg-rose-950/15', tipo === 'error');
    caja.classList.toggle('text-rose-300', tipo === 'error');
    caja.classList.toggle('border-amber-500/30', tipo !== 'error');
    caja.classList.toggle('bg-amber-950/15', tipo !== 'error');
    caja.classList.toggle('text-amber-300', tipo !== 'error');
}

function mostrarAvisoModalServicio(mensaje) {
    const caja = document.getElementById('servicio-modal-aviso');
    if (!caja) return;
    caja.textContent = mensaje || '';
    caja.classList.toggle('hidden', !mensaje);
}

async function cargarResumenServiciosProyecto() {
    const numero = numeroProyectoServicios();
    const badge = document.getElementById('badge-servicios-proyecto');
    if (!numero || !badge) return;
    try {
        const { count, error } = await clienteServiciosProyecto().from('proyecto_servicios').select('id', { count: 'exact', head: true }).eq('proyecto_numero', numero);
        if (error) throw error;
        badge.textContent = String(count || 0);
    } catch (error) {
        badge.textContent = '0';
    }
}

async function cargarServiciosProyecto(forzar = false) {
    const numero = numeroProyectoServicios();
    if (!numero) return;
    if (!forzar && serviciosProyectoNumeroCargado === numero) {
        renderServiciosProyecto();
        return;
    }
    const tbody = document.getElementById('tabla-servicios-proyecto');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="px-5 py-12 text-center text-xs text-gray-500">Consultando servicios...</td></tr>';
    mostrarAvisoServiciosProyecto('');
    try {
        const { data, error } = await clienteServiciosProyecto().from('proyecto_servicios').select('*').eq('proyecto_numero', numero).order('fecha_servicio', { ascending: false }).order('id', { ascending: false });
        if (error) throw error;
        serviciosProyecto = Array.isArray(data) ? data : [];
        serviciosProyectoNumeroCargado = numero;
        renderServiciosProyecto();
        const badge = document.getElementById('badge-servicios-proyecto');
        if (badge) badge.textContent = String(serviciosProyecto.length);
    } catch (error) {
        serviciosProyecto = [];
        serviciosProyectoNumeroCargado = '';
        renderServiciosProyecto();
        const mensaje = String(error?.message || error || 'No fue posible consultar los servicios.');
        if (/proyecto_servicios|schema cache|relation/i.test(mensaje)) mostrarAvisoServiciosProyecto('Falta instalar la tabla de Servicios para Proyectos. Ejecuta SQL_PROYECTO_SERVICIOS_SKILLED.sql en Supabase y vuelve a actualizar.', 'error');
        else mostrarAvisoServiciosProyecto(mensaje, 'error');
    }
}

function serviciosProyectoFiltrados() {
    const busqueda = normalizarServicioTexto(document.getElementById('servicios-filtro-busqueda')?.value);
    const tipo = document.getElementById('servicios-filtro-activo')?.value || '';
    const estado = document.getElementById('servicios-filtro-estado')?.value || '';
    return serviciosProyecto.filter(item => {
        if (tipo && item.activo_tipo !== tipo) return false;
        if (estado && item.estado !== estado) return false;
        if (!busqueda) return true;
        const contenido = normalizarServicioTexto([
            item.activo_codigo,
            item.activo_nombre,
            item.activo_detalle,
            etiquetasTipoActivoServicio[item.activo_tipo],
            etiquetasTipoServicio[item.tipo_servicio],
            item.descripcion,
            item.responsable,
            item.proveedor,
            item.referencia,
            item.notas
        ].join(' '));
        return contenido.includes(busqueda);
    });
}

function resumenCostosServicios() {
    const totales = new Map();
    serviciosProyecto.forEach(item => {
        const moneda = ['MXN','USD','EUR'].includes(String(item.moneda || '').toUpperCase()) ? String(item.moneda).toUpperCase() : 'MXN';
        totales.set(moneda, (totales.get(moneda) || 0) + Number(item.costo || 0));
    });
    if (!totales.size) return '$0.00 MXN';
    return [...totales.entries()].map(([moneda,total]) => monedaServicio(total, moneda)).join(' · ');
}

function renderServiciosProyecto() {
    const tbody = document.getElementById('tabla-servicios-proyecto');
    const vacio = document.getElementById('servicios-vacio');
    if (!tbody || !vacio) return;
    const pendientes = serviciosProyecto.filter(item => ['programado','pendiente','en_proceso'].includes(item.estado)).length;
    const completados = serviciosProyecto.filter(item => item.estado === 'completado').length;
    document.getElementById('servicios-kpi-total').textContent = String(serviciosProyecto.length);
    document.getElementById('servicios-kpi-pendientes').textContent = String(pendientes);
    document.getElementById('servicios-kpi-completados').textContent = String(completados);
    document.getElementById('servicios-kpi-costo').textContent = resumenCostosServicios();
    const filtrados = serviciosProyectoFiltrados();
    document.getElementById('servicios-contador').textContent = `${filtrados.length} registro${filtrados.length === 1 ? '' : 's'} de ${serviciosProyecto.length}`;
    if (!filtrados.length) {
        tbody.innerHTML = '';
        vacio.classList.remove('hidden');
        return;
    }
    vacio.classList.add('hidden');
    tbody.innerHTML = filtrados.map(item => {
        const siguiente = item.proximo_servicio ? `<div class="text-[9px] text-gray-600 mt-1">Próximo: ${fechaServicioTexto(item.proximo_servicio)}</div>` : '';
        const detalleActivo = item.activo_detalle ? `<div class="text-[9px] text-gray-600 mt-1 truncate max-w-[280px]">${escaparServicioHTML(item.activo_detalle)}</div>` : '';
        const codigo = item.activo_codigo ? `<span class="font-mono text-[9px] text-blue-300">${escaparServicioHTML(item.activo_codigo)}</span>` : '';
        const responsable = escaparServicioHTML(item.responsable || '—');
        const proveedor = item.proveedor ? `<div class="text-[9px] text-gray-600 mt-1">${escaparServicioHTML(item.proveedor)}</div>` : '';
        const referencia = item.referencia ? escaparServicioHTML(item.referencia) : '—';
        return `<tr class="border-t border-[#121a2d] hover:bg-[#0d1425] transition">
            <td class="px-4 py-3.5 align-top text-[10px] text-gray-300 whitespace-nowrap">${fechaServicioTexto(item.fecha_servicio)}${siguiente}</td>
            <td class="px-4 py-3.5 align-top"><div class="flex items-center gap-2 flex-wrap"><span class="inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${claseTipoActivoServicio(item.activo_tipo)}">${escaparServicioHTML(etiquetasTipoActivoServicio[item.activo_tipo] || item.activo_tipo)}</span>${codigo}</div><div class="text-xs font-semibold text-gray-200 mt-1.5">${escaparServicioHTML(item.activo_nombre || 'Activo')}</div>${detalleActivo}</td>
            <td class="px-4 py-3.5 align-top"><div class="text-[10px] font-semibold text-gray-200">${escaparServicioHTML(etiquetasTipoServicio[item.tipo_servicio] || item.tipo_servicio || 'Servicio')}</div><div class="text-[10px] text-gray-500 mt-1 max-w-[320px] whitespace-normal">${escaparServicioHTML(item.descripcion || '—')}</div>${item.notas ? `<div class="text-[9px] text-gray-600 mt-1">${escaparServicioHTML(item.notas)}</div>` : ''}</td>
            <td class="px-4 py-3.5 align-top"><span class="inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold ${claseEstadoServicio(item.estado)}">${escaparServicioHTML(etiquetasEstadoServicio[item.estado] || item.estado)}</span></td>
            <td class="px-4 py-3.5 align-top text-[10px] text-gray-300">${responsable}${proveedor}</td>
            <td class="px-4 py-3.5 align-top text-[10px] text-gray-400">${referencia}</td>
            <td class="px-4 py-3.5 align-top text-right text-[10px] font-semibold text-gray-200 whitespace-nowrap">${monedaServicio(item.costo, item.moneda)}</td>
            <td class="px-4 py-3.5 align-top"><div class="flex items-center justify-end gap-2"><button type="button" onclick="editarServicioProyecto(${Number(item.id)})" class="px-2.5 py-1.5 rounded-lg border border-[#243257] bg-[#10172a] text-[9px] font-semibold text-gray-300 hover:text-white">Editar</button><button type="button" onclick="eliminarServicioProyecto(${Number(item.id)})" class="px-2.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-950/10 text-[9px] font-semibold text-rose-400 hover:text-rose-300">Eliminar</button></div></td>
        </tr>`;
    }).join('');
}

function limpiarFiltrosServiciosProyecto() {
    const busqueda = document.getElementById('servicios-filtro-busqueda');
    const tipo = document.getElementById('servicios-filtro-activo');
    const estado = document.getElementById('servicios-filtro-estado');
    if (busqueda) busqueda.value = '';
    if (tipo) tipo.value = '';
    if (estado) estado.value = '';
    renderServiciosProyecto();
}

async function cargarActivosServiciosProyecto(forzar = false) {
    if (activosServiciosProyectoListos && !forzar) return activosServiciosProyecto;
    const { data, error } = await clienteServiciosProyecto().rpc('proyecto_servicios_listar_activos');
    if (error) throw error;
    activosServiciosProyecto = (Array.isArray(data) ? data : []).map(item => ({
        tipo: textoServicioSeguro(item.tipo_activo),
        id: Number(item.activo_id),
        codigo: textoServicioSeguro(item.codigo),
        nombre: textoServicioSeguro(item.nombre),
        detalle: textoServicioSeguro(item.detalle),
        estado: textoServicioSeguro(item.estado)
    })).sort((a,b) => `${a.tipo} ${a.nombre} ${a.codigo}`.localeCompare(`${b.tipo} ${b.nombre} ${b.codigo}`, 'es'));
    activosServiciosProyectoListos = true;
    return activosServiciosProyecto;
}

function actualizarActivosServicioProyecto(valorSeleccionado = '') {
    const tipo = document.getElementById('servicio-activo-tipo')?.value || 'equipo_oficina';
    const select = document.getElementById('servicio-activo-id');
    if (!select) return;
    const items = activosServiciosProyecto.filter(item => item.tipo === tipo);
    select.innerHTML = items.map(item => `<option value="${item.id}">${escaparServicioHTML(item.codigo ? `${item.codigo} — ${item.nombre}` : item.nombre)}${item.estado ? ` · ${escaparServicioHTML(item.estado)}` : ''}</option>`).join('') + '<option value="__manual__">No aparece en el catálogo · capturar referencia</option>';
    const existe = items.some(item => String(item.id) === String(valorSeleccionado));
    if (existe) select.value = String(valorSeleccionado);
    else if (!items.length || valorSeleccionado === '__manual__') select.value = '__manual__';
    alternarActivoManualServicioProyecto();
}

function alternarActivoManualServicioProyecto() {
    const manual = document.getElementById('servicio-activo-id')?.value === '__manual__';
    document.getElementById('servicio-activo-manual')?.classList.toggle('hidden', !manual);
}

function limpiarFormularioServicioProyecto() {
    const hoy = new Date().toISOString().slice(0,10);
    document.getElementById('servicio-activo-tipo').value = 'equipo_oficina';
    document.getElementById('servicio-activo-codigo').value = '';
    document.getElementById('servicio-activo-nombre').value = '';
    document.getElementById('servicio-tipo').value = 'mantenimiento_preventivo';
    document.getElementById('servicio-fecha').value = hoy;
    document.getElementById('servicio-estado').value = 'completado';
    document.getElementById('servicio-responsable').value = '';
    document.getElementById('servicio-proveedor').value = '';
    document.getElementById('servicio-referencia').value = '';
    document.getElementById('servicio-costo').value = '0';
    document.getElementById('servicio-moneda').value = 'MXN';
    document.getElementById('servicio-descripcion').value = '';
    document.getElementById('servicio-proximo').value = '';
    document.getElementById('servicio-notas').value = '';
    mostrarAvisoModalServicio('');
}

async function abrirModalServicioProyecto(id = null) {
    const numero = numeroProyectoServicios();
    if (!numero) return;
    servicioProyectoEditando = id ? serviciosProyecto.find(item => Number(item.id) === Number(id)) || null : null;
    limpiarFormularioServicioProyecto();
    document.getElementById('servicio-modal-titulo').textContent = servicioProyectoEditando ? 'Editar servicio' : 'Registrar servicio';
    document.getElementById('servicio-btn-guardar').textContent = servicioProyectoEditando ? 'Guardar cambios' : 'Guardar servicio';
    document.getElementById('servicio-modal-proyecto').textContent = `Proyecto ${numero}`;
    const modal = document.getElementById('modal-servicio-proyecto');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    try {
        await cargarActivosServiciosProyecto();
        if (servicioProyectoEditando) {
            const item = servicioProyectoEditando;
            document.getElementById('servicio-activo-tipo').value = item.activo_tipo || 'equipo_oficina';
            actualizarActivosServicioProyecto(item.activo_id ? String(item.activo_id) : '__manual__');
            const existe = activosServiciosProyecto.some(activo => activo.tipo === item.activo_tipo && Number(activo.id) === Number(item.activo_id));
            if (!existe) {
                document.getElementById('servicio-activo-id').value = '__manual__';
                alternarActivoManualServicioProyecto();
                document.getElementById('servicio-activo-codigo').value = item.activo_codigo || '';
                document.getElementById('servicio-activo-nombre').value = item.activo_nombre || '';
            }
            document.getElementById('servicio-tipo').value = item.tipo_servicio || 'otro';
            document.getElementById('servicio-fecha').value = item.fecha_servicio || '';
            document.getElementById('servicio-estado').value = item.estado || 'completado';
            document.getElementById('servicio-responsable').value = item.responsable || '';
            document.getElementById('servicio-proveedor').value = item.proveedor || '';
            document.getElementById('servicio-referencia').value = item.referencia || '';
            document.getElementById('servicio-costo').value = Number(item.costo || 0);
            document.getElementById('servicio-moneda').value = item.moneda || 'MXN';
            document.getElementById('servicio-descripcion').value = item.descripcion || '';
            document.getElementById('servicio-proximo').value = item.proximo_servicio || '';
            document.getElementById('servicio-notas').value = item.notas || '';
        } else {
            actualizarActivosServicioProyecto();
        }
    } catch (error) {
        activosServiciosProyecto = [];
        activosServiciosProyectoListos = false;
        actualizarActivosServicioProyecto('__manual__');
        mostrarAvisoModalServicio('No fue posible cargar los activos registrados. Puedes capturar la referencia manualmente o revisar que el SQL de Servicios esté instalado.');
    }
}

function cerrarModalServicioProyecto() {
    const modal = document.getElementById('modal-servicio-proyecto');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    servicioProyectoEditando = null;
    mostrarAvisoModalServicio('');
}

function editarServicioProyecto(id) {
    abrirModalServicioProyecto(id);
}

async function guardarServicioProyecto() {
    const numero = numeroProyectoServicios();
    if (!numero) return;
    const tipoActivo = document.getElementById('servicio-activo-tipo').value;
    const seleccion = document.getElementById('servicio-activo-id').value;
    let activoId = null;
    let activoCodigo = '';
    let activoNombre = '';
    let activoDetalle = '';
    if (seleccion === '__manual__') {
        activoCodigo = textoServicioSeguro(document.getElementById('servicio-activo-codigo').value);
        activoNombre = textoServicioSeguro(document.getElementById('servicio-activo-nombre').value);
    } else {
        const activo = activosServiciosProyecto.find(item => item.tipo === tipoActivo && String(item.id) === String(seleccion));
        if (activo) {
            activoId = activo.id;
            activoCodigo = activo.codigo;
            activoNombre = activo.nombre;
            activoDetalle = activo.detalle;
        }
    }
    const descripcion = textoServicioSeguro(document.getElementById('servicio-descripcion').value);
    const fecha = document.getElementById('servicio-fecha').value;
    if (!activoNombre) {
        mostrarAvisoModalServicio('Selecciona un activo o escribe el nombre del activo.');
        return;
    }
    if (!fecha) {
        mostrarAvisoModalServicio('Selecciona la fecha del servicio.');
        return;
    }
    if (!descripcion) {
        mostrarAvisoModalServicio('Describe el servicio realizado o su alcance.');
        return;
    }
    const costo = Math.max(0, Number(document.getElementById('servicio-costo').value) || 0);
    const payload = {
        proyecto_numero: numero,
        activo_tipo: tipoActivo,
        activo_id: activoId,
        activo_codigo: activoCodigo || null,
        activo_nombre: activoNombre,
        activo_detalle: activoDetalle || null,
        tipo_servicio: document.getElementById('servicio-tipo').value,
        fecha_servicio: fecha,
        estado: document.getElementById('servicio-estado').value,
        responsable: textoServicioSeguro(document.getElementById('servicio-responsable').value) || null,
        proveedor: textoServicioSeguro(document.getElementById('servicio-proveedor').value) || null,
        referencia: textoServicioSeguro(document.getElementById('servicio-referencia').value) || null,
        costo,
        moneda: document.getElementById('servicio-moneda').value,
        descripcion,
        proximo_servicio: document.getElementById('servicio-proximo').value || null,
        notas: textoServicioSeguro(document.getElementById('servicio-notas').value) || null
    };
    const boton = document.getElementById('servicio-btn-guardar');
    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Guardando...';
    mostrarAvisoModalServicio('');
    try {
        let respuesta;
        if (servicioProyectoEditando) respuesta = await clienteServiciosProyecto().from('proyecto_servicios').update(payload).eq('id', servicioProyectoEditando.id).select('id').single();
        else respuesta = await clienteServiciosProyecto().from('proyecto_servicios').insert(payload).select('id').single();
        if (respuesta.error) throw respuesta.error;
        cerrarModalServicioProyecto();
        serviciosProyectoNumeroCargado = '';
        await cargarServiciosProyecto(true);
        await cargarResumenServiciosProyecto();
    } catch (error) {
        mostrarAvisoModalServicio(String(error?.message || error || 'No fue posible guardar el servicio.'));
    } finally {
        boton.disabled = false;
        boton.textContent = texto;
    }
}

async function eliminarServicioProyecto(id) {
    const item = serviciosProyecto.find(servicio => Number(servicio.id) === Number(id));
    if (!item) return;
    const nombre = item.activo_nombre || 'este activo';
    if (!confirm(`¿Eliminar el servicio registrado para ${nombre}? Esta acción no se puede deshacer.`)) return;
    try {
        const { error } = await clienteServiciosProyecto().from('proyecto_servicios').delete().eq('id', id);
        if (error) throw error;
        serviciosProyectoNumeroCargado = '';
        await cargarServiciosProyecto(true);
        await cargarResumenServiciosProyecto();
    } catch (error) {
        mostrarAvisoServiciosProyecto(String(error?.message || error || 'No fue posible eliminar el servicio.'), 'error');
    }
}

window.cargarServiciosProyecto = cargarServiciosProyecto;
window.cargarResumenServiciosProyecto = cargarResumenServiciosProyecto;
window.renderServiciosProyecto = renderServiciosProyecto;
window.limpiarFiltrosServiciosProyecto = limpiarFiltrosServiciosProyecto;
window.abrirModalServicioProyecto = abrirModalServicioProyecto;
window.cerrarModalServicioProyecto = cerrarModalServicioProyecto;
window.actualizarActivosServicioProyecto = actualizarActivosServicioProyecto;
window.alternarActivoManualServicioProyecto = alternarActivoManualServicioProyecto;
window.guardarServicioProyecto = guardarServicioProyecto;
window.editarServicioProyecto = editarServicioProyecto;
window.eliminarServicioProyecto = eliminarServicioProyecto;

document.addEventListener('click', event => {
    if (event.target?.id === 'modal-servicio-proyecto') cerrarModalServicioProyecto();
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('modal-servicio-proyecto')?.classList.contains('hidden')) cerrarModalServicioProyecto();
});
