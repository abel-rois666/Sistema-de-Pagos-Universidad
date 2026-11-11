# Asociación administrativa de certificaciones — ampliación v2

Preparada el 10/11/2026. No se ejecutó SQL ni se modificaron datos reales.

Acceso: Control Escolar → Herramientas administrativas → Asociar certificaciones. Solo Administración activa. El acceso anterior en Reportes redirige a la nueva ruta; ya no tiene tarjeta de reporte. Desde Certificación se puede abrir filtrado por ID exacto de alumno.

Las vistas Todas / Programa único / Varios programas filtran en servidor antes de contar y paginar. Se conserva el máximo de 50 seleccionadas y páginas de 25. Un único programa conserva su propuesta; varios programas requieren elección explícita sin priorizar el principal. Los destinos incluyen históricos, clave, periodicidad y estatus; los ocupados (incluso por archivadas) se explican y no son elegibles. Solo se selecciona una ficha activa sin programa, con destino disponible. Cambiar destino desmarca la revisión. Marcar una casilla declara la revisión y selección; la marca de página revisa y selecciona las disponibles visibles.

El resumen conserva nombres/destinos seleccionados entre páginas, búsquedas y vistas, y permite quitar cada fila. Motivo de 10–1000 caracteres, revisión del resumen y confirmación preceden al guardado. Abrir la ficha individual no desmonta la captura. Un refresco retira del lote las revisiones visibles cuya huella haya cambiado. Los demás cambios los rechaza el servidor. Las propuestas y selecciones no persisten al cerrar la sesión/página. Los errores conservan captura. La salida utiliza una sola confirmación compartida de la aplicación.

## Instalación

Requiere certificación por programa y la migración previa `20261110010000_asociar_certificaciones_lote.sql`. Después aplicar la nueva `20261110020000_certificaciones_lote_varios_programas.sql`; no sustituye ni edita contratos v1 instalados. Instalar SQL y verificar permisos antes de publicar cliente v2. Sin RPC v2 se bloquea, sin fallback a v1 ni escrituras directas. No requiere Edge Functions.

La RPC vuelve a autorizar Administración activa, valida pertenencia exacta, disponibilidad, huella, unicidad y límite. Bloquea padres/programas/fichas en orden y confirma todo o revierte todo. Solo actualiza asociación, revisión y fecha de actualización; audita cada ficha con antes/después y motivo. No llama al guardado general, no cierra programas ni modifica pagos, recibos, monedero o calificaciones. Una desconexión puede dejar resultado incierto: consultar antes de repetir.

Verificación de instalación: `supabase/checks/verificar_certificacion_lote_v2.sql` (solo metadatos). Antes de producción ensayar con datos ficticios roles, concurrencia, doble envío, destino ocupado, rollback y conservación de campos; la revisión local de TypeScript y pruebas de contrato no acredita esos controles contra el esquema instalado.

## Verificación local de la ampliación

Tipado correcto y 400 pruebas aprobadas (incluidas selección explícita, destino histórico, ocupado/desconocido y conservación de estados). Se actualizó el ensayo ficticio al contrato v2; esta ampliación no se comprobó visualmente en navegador en los tres tamaños/temas. Tampoco se ejecutó PostgreSQL: permisos, bloqueos, rollback y triggers instalados siguen pendientes. La compilación conserva el aviso previo de paquetes grandes. No se publicó código ni se realizaron operaciones sobre datos reales.

## Historial de la primera entrega

## Versión v1 (referencia histórica)

Preparada el 10/11/2026, sin ejecutar SQL ni modificar datos reales.

Acceso: **Reportes Escolares → Asociar certificaciones pendientes**, exclusivo de Administración activa. Se proponen fichas activas sin programa. La revisión considera todos los programas asociados, incluidos históricos, y exige uno solo. Cero/varios programas, varias fichas pendientes o cualquier otra ficha del destino (incluso archivada) quedan para revisión individual. La existencia de un único programa es una propuesta: Administración debe verificar que corresponde al certificado.

Buscar aplica antes de contar y paginar. La selección de página solo marca elegibles de esa página; se conserva entre páginas/búsquedas, con contador explícito y limpieza. Máximo 50 por lote; revisar el resumen de nombres, matrículas y destinos antes de confirmar. Registrar respaldo institucional de 10–1000 caracteres. Cerrar con captura solicita descarte; los errores mantienen selección y motivo.

El servidor comprueba permiso, ficha, revisión completa, único programa y destino libre. Bloquea padres, programas y fichas en orden; inserciones concurrentes requieren completar esos bloqueos. Si cualquier caso cambió se rechaza todo el lote, sin asociaciones parciales. Actualizar la consulta y limpiar/reseleccionar las filas afectadas antes de reintentar. Una desconexión puede dejar resultado incierto: actualizar para comprobar las fichas pendientes antes de reintentar.

La misma ficha conserva documentos, pagos, fechas, tipo y trámite. Solo cambia alumno_programa_id, revisión y updated_at, con auditoría ASOCIAR_LEGADO_LOTE. No llama al guardado general: no cierra programas, recalcula estatus ni modifica recibos/monedero. No crea fichas y no reasigna las ya asociadas. Los triggers instalados deben contrastarse antes de instalar.

## Instalación pendiente

Requiere la migración de certificación por programa 20261109120000 ya instalada y verificada. Revisar las definiciones de tablas, unicidad, políticas y triggers con `supabase/checks/preflight_certificacion_por_programa_20261109.sql`. No repetir migraciones aplicadas.

Preparada: `supabase/migrations/20261110010000_asociar_certificaciones_lote.sql`. Solo crea funciones; no realiza asignaciones al instalar. Ensayar primero con datos ficticios: dos programas históricos, ficha archivada, destino ocupado, conflicto entre revisión/confirmación, permisos y rollback. Aplicarla completa y verificar `supabase/checks/verificar_certificacion_lote.sql` antes del cliente. No requiere desplegar Edge Functions. Sin las RPC nuevas la herramienta muestra que falta la actualización y no escribe mediante un contrato anterior.

Las pruebas de fuente `tests/certificacionLote.test.ts` comprueban contratos, límites y ausencia de escrituras académicas/financieras. No ejecutan PostgreSQL ni sustituyen pruebas de permisos, concurrencia y transacciones contra el esquema instalado.

Verificación local: compilación y 395 pruebas aprobadas; permanece el aviso previo de paquetes grandes. Ensayo `scripts/ensayoCertificacionLote.html` con 56 casos ficticios y red externa interceptada: selección de 40 elegibles entre páginas, confirmación, éxito simulado, ajuste de paginación y conflicto que conserva la captura (`?conflicto`). Listado comprobado en móvil claro (390) y tableta/escritorio oscuros (820/1280), con desplazamiento propio de la tabla. No se ensayó la ficha individual desde este fixture ni se ejecutó SQL o publicó código. Permisos y transacciones del servidor siguen pendientes de ensayo.
