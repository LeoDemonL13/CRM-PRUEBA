(function(){
'use strict';
const groups=[
{id:'fundamentos',label:'Base del sistema',description:'Acceso, seguridad y experiencia general.',icon:'shield',features:[
{id:'usuarios_acceso',label:'Usuarios, inicio de sesión y recuperación de acceso',help:'Cuentas individuales y control de sesiones.'},
{id:'perfiles_permisos',label:'Perfiles y permisos por puesto',help:'Cada perfil ve únicamente sus funciones autorizadas.'},
{id:'paneles_indicadores',label:'Paneles e indicadores',help:'Resumen operativo con métricas, alertas y accesos rápidos.'},
{id:'busqueda_inteligente',label:'Buscador inteligente',help:'Búsqueda por nombres, códigos, sinónimos y coincidencias parciales.'},
{id:'diseno_responsivo',label:'Diseño para computadora, tableta y celular',help:'Interfaz optimizada para diferentes tamaños de pantalla.'},
{id:'temas_personalizacion',label:'Colores, logo y temas personalizados',help:'Identidad visual y preferencias por usuario.'},
{id:'bitacora_auditoria',label:'Bitácora y trazabilidad',help:'Registro de movimientos, responsables, fechas y cambios.'}
]},
{id:'almacen',label:'Inventario y almacenes',description:'Control de materiales, existencias y ubicaciones.',icon:'box',features:[
{id:'catalogo_materiales',label:'Catálogo completo de materiales',help:'Códigos, marcas, unidades, precios, imágenes y proveedores.'},
{id:'existencias_almacenes',label:'Existencias por almacén',help:'Disponibilidad general y por ubicación.'},
{id:'ubicaciones_racks',label:'Racks, niveles, zonas y ubicaciones',help:'Organización física configurable.'},
{id:'movimientos_inventario',label:'Entradas, salidas, ajustes y traspasos',help:'Movimientos múltiples con comprobante.'},
{id:'stock_minimo',label:'Alertas de stock mínimo',help:'Detección y seguimiento de materiales por reabastecer.'},
{id:'scanner_qr',label:'Escáner de QR y códigos',help:'Consulta y captura desde cámara o lector.'},
{id:'etiquetas_qr',label:'Etiquetas y códigos QR',help:'Diseños para materiales, cajones, racks y tickets.'},
{id:'entregas_directas',label:'Entregas directas',help:'Entrega de materiales sin ingreso previo al almacén general.'},
{id:'tomas_fisicas',label:'Tomas físicas e inventarios',help:'Conteo, diferencias y conciliación.'},
{id:'paquetes_materiales',label:'Paquetes o kits predeterminados',help:'Listas reutilizables de materiales por actividad.'}
]},
{id:'compras',label:'Compras y proveedores',description:'Cotizaciones, autorizaciones y órdenes de compra.',icon:'cart',features:[
{id:'proveedores',label:'Catálogo de proveedores y contactos',help:'RFC, correo, WhatsApp, materiales y condiciones.'},
{id:'solicitudes_compra',label:'Solicitudes y requisiciones de compra',help:'Flujo desde áreas operativas hasta Compras.'},
{id:'cotizaciones_proveedor',label:'Cotizaciones de proveedores',help:'Registro de ofertas, tiempos y condiciones.'},
{id:'lectura_cotizaciones',label:'Lectura de documentos de cotización',help:'Captura asistida desde PDF, imágenes u hojas de cálculo.'},
{id:'comparador_ofertas',label:'Comparador y recomendación de ofertas',help:'Análisis por precio, entrega y condiciones.'},
{id:'ordenes_compra',label:'Órdenes de compra',help:'Generación, seguimiento y control por proyecto.'},
{id:'firmas_autorizacion',label:'Firmas y autorizaciones',help:'Flujos de revisión, aprobación y bloqueo de cambios.'},
{id:'envio_proveedor',label:'Envío por correo o WhatsApp al proveedor',help:'PDF autorizado y registro de envío.'},
{id:'recepciones_compra',label:'Recepción parcial o total de compras',help:'Actualización de existencias y pendientes.'}
]},
{id:'rh',label:'Recursos Humanos',description:'Personal, asistencia, nómina y desarrollo.',icon:'users',features:[
{id:'expedientes_personal',label:'Expedientes de personal',help:'Datos laborales, contacto y documentación.'},
{id:'importacion_personal',label:'Alta e importación masiva de personal',help:'Carga inicial y actualización por archivo.'},
{id:'checador_asistencia',label:'Checador de entrada y salida',help:'Huella, código o captura autorizada.'},
{id:'offline_checador',label:'Checador sin internet y sincronización',help:'Conserva registros hasta recuperar conexión.'},
{id:'incidencias_asistencia',label:'Asistencias, retardos e incidencias',help:'Enfermedad, transporte, luto y otras causas.'},
{id:'nomina',label:'Cálculo y control de nómina',help:'Esquemas por hora, semana o confianza.'},
{id:'envio_nomina',label:'Envío de informativas de nómina',help:'Documentos por WhatsApp o correo.'},
{id:'documentos_personal',label:'Documentos y vencimientos',help:'Expedientes, alertas y consulta.'},
{id:'capacitacion',label:'Capacitaciones y constancias',help:'Cursos, participantes y evidencias.'},
{id:'equipos_resguardos',label:'Equipos y resguardos de personal',help:'Asignación, devolución y trazabilidad de activos.'}
]},
{id:'proyectos',label:'Proyectos y operación',description:'Planeación, costos, materiales y responsables.',icon:'folder',features:[
{id:'catalogo_proyectos',label:'Catálogo y seguimiento de proyectos',help:'Datos generales, responsables, fechas y estado.'},
{id:'plan_materiales',label:'Plan de materiales por proyecto',help:'Planeado, reservado, entregado y sobrante.'},
{id:'fuera_plan',label:'Materiales dentro y fuera del plan',help:'Control de desviaciones y autorizaciones.'},
{id:'personal_proyecto',label:'Asignación de personal',help:'Funciones, fechas, dedicación y disponibilidad.'},
{id:'costos_proyecto',label:'Costos reales y planeados',help:'Materiales, sueldos, herramientas, viáticos y compras.'},
{id:'avance_proyecto',label:'Avance, alcances y entregables',help:'Seguimiento operativo y reportes ejecutivos.'},
{id:'reportes_proyecto',label:'Reportes de proyecto en PDF',help:'Filtros, vista previa y formato corporativo.'},
{id:'solicitudes_proyecto',label:'Solicitudes entre áreas',help:'Material, EPP, personal, servicios y autorizaciones.'}
]},
{id:'herramientas',label:'Herramientas y activos',description:'Catálogo, unidades, kits, resguardos y costos.',icon:'tool',features:[
{id:'catalogo_herramientas',label:'Catálogo de herramientas',help:'Tipos, marcas, modelos, costo y características.'},
{id:'unidades_herramientas',label:'Unidades, series y códigos',help:'Control individual o por cantidad.'},
{id:'kits_herramientas',label:'Kits y componentes',help:'Taladros, baterías, cargadores y conjuntos.'},
{id:'asignacion_herramientas',label:'Asignación a persona o proyecto',help:'Resguardo, firma, devolución y ubicación.'},
{id:'estado_herramientas',label:'Estados y disponibilidad',help:'Disponible, asignada, mantenimiento o baja.'},
{id:'mantenimiento_herramientas',label:'Mantenimiento de herramientas',help:'Proveedores, fechas, gastos y evidencias.'},
{id:'costo_uso_herramientas',label:'Costo de uso o renta interna',help:'Cálculo por tiempo y proyecto.'}
]},
{id:'vehiculos',label:'Vehículos y flotilla',description:'Control visual, documental y operativo.',icon:'vehicle',features:[
{id:'catalogo_vehiculos',label:'Catálogo de vehículos',help:'Tipo, marca, modelo, placas, capacidades y fotografías.'},
{id:'inspecciones_vehiculos',label:'Inspecciones y checklist visual',help:'Daños, evidencias, niveles y estado por tipo de vehículo.'},
{id:'salidas_vehiculos',label:'Salidas, destinos y responsables',help:'Proyectos, pasajeros, firmas y comprobantes.'},
{id:'gastos_combustible',label:'Combustible y gastos',help:'Consumo, tickets y costos por unidad.'},
{id:'mantenimiento_vehiculos',label:'Mantenimiento y vencimientos',help:'Servicios, kilometraje, documentos y alertas.'},
{id:'ubicacion_gps',label:'Ubicación o rastreo GPS',help:'Integración opcional con dispositivos o proveedores.'},
{id:'reportes_vehiculos',label:'Reportes vehiculares',help:'Historial, formatos de salida e inspección.'}
]},
{id:'finanzas',label:'Finanzas',description:'Presupuestos, gastos y análisis económico.',icon:'chart',features:[
{id:'presupuestos',label:'Presupuestos',help:'Planeación, versiones, autorizaciones y comparativos.'},
{id:'gastos',label:'Registro y clasificación de gastos',help:'Proyecto, área, comprobante y categoría.'},
{id:'cuentas_pagar',label:'Cuentas por pagar',help:'Vencimientos, responsables y estados.'},
{id:'activos_rentas',label:'Inversión, activos y rentas',help:'Costos de propiedad, uso y recuperación.'},
{id:'tablero_financiero',label:'Tablero financiero',help:'Indicadores, filtros y tendencias.'},
{id:'reportes_financieros',label:'Reportes financieros',help:'Exportación y documentos ejecutivos.'}
]},
{id:'recepcion',label:'Recepción y suministros',description:'Consumos internos, visitas y entregas.',icon:'store',features:[
{id:'catalogo_suministros',label:'Catálogo de suministros',help:'Existencias, ubicación, precios y categorías.'},
{id:'bodeguita',label:'Bodeguita y ubicaciones',help:'Racks manuales, cajones y etiquetas.'},
{id:'listas_tienda',label:'Listas de compras generales',help:'Varios artículos, negocios, recepción y firma.'},
{id:'entrega_suministros',label:'Entrega de suministros',help:'Solicitud pública, firma y actualización de existencias.'},
{id:'visitas_mensajeria',label:'Visitas, paquetería y mensajería interna',help:'Registro y aviso a las áreas correspondientes.'}
]},
{id:'operacion',label:'Planeación, coordinación y logística',description:'Flujos transversales entre áreas.',icon:'flow',features:[
{id:'planeacion_operativa',label:'Planeación operativa',help:'Proyectos, solicitudes, materiales y prioridades.'},
{id:'coordinacion_areas',label:'Coordinación entre áreas',help:'Responsables, tareas, avisos y seguimiento.'},
{id:'logistica_entregas',label:'Logística y entregas',help:'Rutas, responsables, vehículos y fechas.'},
{id:'notificaciones',label:'Notificaciones y recordatorios',help:'Alertas dentro del sistema por eventos o vencimientos.'},
{id:'automatizaciones',label:'Automatizaciones de procesos',help:'Reglas, colas de trabajo y acciones programadas.'}
]},
{id:'ia',label:'Inteligencia artificial',description:'Asistentes y análisis integrados al programa.',icon:'spark',features:[
{id:'ia_chat',label:'Asistente de IA por chat',help:'Consultas y ayuda dentro de los permisos del perfil.'},
{id:'ia_voz',label:'Asistente por voz',help:'Micrófono, respuestas habladas y comandos.'},
{id:'ia_datos_programa',label:'IA conectada a los datos del programa',help:'Consulta contextual con permisos por área.'},
{id:'ia_documentos',label:'Lectura y extracción de documentos',help:'PDF, imágenes, hojas de cálculo y archivos.'},
{id:'ia_reuniones',label:'Modo reunión y transcripción',help:'Grabación, participantes, minuta y acuerdos.'},
{id:'ia_imagen',label:'Análisis de imágenes o cámara',help:'Evidencias, inspecciones o reconocimiento.'},
{id:'ia_local',label:'IA local o privada',help:'Procesamiento dentro de infraestructura propia cuando sea viable.'},
{id:'ia_personalizada',label:'IA entrenada para procesos específicos',help:'Vocabulario, reglas, respuestas y acciones del negocio.'}
]},
{id:'web',label:'Página para anunciar el negocio',description:'Presencia digital conectada con clientes.',icon:'web',features:[
{id:'web_landing',label:'Página de presentación',help:'Inicio, servicios, empresa y llamadas a la acción.'},
{id:'web_multipagina',label:'Sitio con varias secciones o páginas',help:'Servicios, proyectos, equipo, vacantes y contacto.'},
{id:'web_catalogo',label:'Catálogo de productos o servicios',help:'Categorías, fichas, imágenes y solicitudes.'},
{id:'web_formularios',label:'Formularios de contacto o cotización',help:'Captura de prospectos y necesidades.'},
{id:'web_whatsapp',label:'WhatsApp y redes sociales',help:'Botones, enlaces y mensajes prellenados.'},
{id:'web_administrable',label:'Contenido administrable',help:'Edición de textos, imágenes, servicios y publicaciones.'},
{id:'web_seo',label:'SEO, analítica y rendimiento',help:'Buscadores, medición y optimización técnica.'},
{id:'web_dominio',label:'Dominio, publicación y configuración',help:'Preparación para poner el sitio en línea.'}
]},
{id:'integraciones',label:'Integraciones y funciones adicionales',description:'Conexiones, documentos, movilidad y dispositivos.',icon:'plug',features:[
{id:'integracion_whatsapp',label:'WhatsApp Business',help:'Avisos, documentos y mensajes desde procesos autorizados.'},
{id:'integracion_correo',label:'Correo electrónico',help:'Envíos, plantillas y registro de comunicaciones.'},
{id:'integracion_excel',label:'Excel e importaciones masivas',help:'Carga, descarga y plantillas de información.'},
{id:'integracion_pdf',label:'PDF, impresión y vista previa',help:'Documentos con identidad y formatos específicos.'},
{id:'integracion_firma',label:'Firmas electrónicas',help:'Autorización, resguardo y trazabilidad.'},
{id:'integracion_api',label:'API o conexión con otros sistemas',help:'Intercambio controlado de información.'},
{id:'integracion_pagos',label:'Pagos, facturación o tienda en línea',help:'Conexión con servicios externos.'},
{id:'integracion_mapas',label:'Mapas, rutas y geolocalización',help:'Direcciones, distancias y ubicaciones.'},
{id:'integracion_hardware',label:'Hardware, sensores, ESP32 o Raspberry',help:'Lectores, checadores, timbres y dispositivos.'},
{id:'pwa_offline',label:'Aplicación instalable y trabajo sin internet',help:'Operación local y sincronización posterior.'},
{id:'migracion_datos',label:'Migración de información existente',help:'Excel, sistemas anteriores o bases de datos.'},
{id:'capacitacion_soporte',label:'Capacitación y soporte inicial',help:'Puesta en marcha, acompañamiento y ajustes.'}
]}
];
const all=groups.flatMap(group=>group.features.map(feature=>({...feature,groupId:group.id,groupLabel:group.label})));
window.SkilledProgramQuoteCatalog=Object.freeze({version:150,groups:Object.freeze(groups),all:Object.freeze(all),byId:Object.freeze(Object.fromEntries(all.map(item=>[item.id,item]))) });
})();
