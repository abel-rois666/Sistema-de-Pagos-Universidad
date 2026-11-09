# Consulta de periodos, observaciones y vinculación financiera

Implementación local del 06/11/2026. No se ejecutó SQL en Supabase, no se modificaron datos reales ni se publicó el cliente.

## Comportamiento implementado

**Ajuste visual del 07/11/2026:** cuando el periodo completo no tiene planes, se ocultan el buscador y sus resultados. Si solo falta el plan del alumno consultado pero hay otros planes en el periodo, la búsqueda permanece disponible. Este ajuste sustituye la indicación inicial de conservar siempre el buscador en el estado vacío. Las ayudas compartidas pasan a un icono simple y panel compacto según `PATRONES_INTERFAZ.md`.

- Planes de Pago incorpora «Periodo de consulta», local por usuario, descendente y con «Todos los periodos». Agrupa ciclos homónimos en la consulta sin cambiar IDs. Búsqueda, flechas, contador, selector inferior y pestañas respetan ese alcance. Los enlaces con plan exacto abren su periodo. Un periodo sin plan del alumno conserva búsqueda, selector, alta e historial; no salta a otra persona.
- Alta/edición de la estructura conserva el selector exacto y las validaciones previas. El filtro de consulta no reasocia planes ni toma el ciclo global como autorización de escritura.
- Editar una observación usa una RPC puntual, con el valor original como control de concurrencia. El servidor sincroniza legado/detalle y audita en una transacción; no cambia importes, ciclo o monedero. Una respuesta confirmada actualiza solo ese concepto en el store. No usa onSavePlan ni las dos recargas completas anteriores.
- Realtime y retorno de foco consultan planes individuales, agrupando eventos. Una consulta antigua no sustituye una respuesta puntual más nueva. Este cambio no equivale a una revisión completa del rendimiento de todos los módulos financieros.
- El mismo diálogo sirve desde el plan o desde el recibo. Los recibos se consultan por alumno, en páginas de 20 con total del servidor, filtro de periodo y búsqueda exacta de folio. Incluye todos los periodos; los cancelados se identifican y no se seleccionan. No pagina en cliente una descarga truncada.
- Desde recibo se consultan los planes del alumno con periodo, periodicidad del ciclo, tipo financiero, folio y conceptos/importes. El historial visible no autoriza aplicaciones entre periodos distintos: el servidor mantiene las restricciones vigentes.
- Los vínculos existentes muestran destino e importe. «Ver este plan» conserva el ID exacto en la navegación. El índice legado se presenta como referencia de concepto, no como número de plan.
- La operación diferencia «Registrar vínculo histórico, sin mover monedero» y «Aplicar importe disponible y excedente nuevo al monedero». Administración/Finanzas pueden conciliar históricos; Caja conserva aplicación de importes disponibles. No se decide el tratamiento económico solo por nombre, índice o ciclo.
- Hay revisión previa del servidor, resumen de origen/destino/importes y confirmación explícita. Una huella de la revisión detecta cambios antes de aplicar. El servidor comprueba sesión activa, rol, alumno, periodo, estado del recibo, saldo, vínculos y antecedentes de monedero.
- La aplicación conserva abonos sucesivos, distribución entre conceptos y crédito único del excedente mediante v3 y su bitácora existente. La conciliación histórica conserva dinero, fechas, datos fiscales y ciclo del recibo; registra vínculo y, cuando falta, su índice legado. No acredita automáticamente un remanente histórico.
- NO PAGADO vuelve a ser pendiente en cliente y SQL. La resta tiene prioridad sobre pagos anteriores. Un saldo ambiguo, BAJA o CANCELADO sin otra información suficiente requiere revisión; no se habilita automáticamente un cobro. Los detalles normalizados son la fuente completa, sin rellenar huecos con columnas residuales.
- Los vínculos permiten presentar el formato tradicional R-folio/Abono/Resta cuando el texto guardado es PENDIENTE o NO PAGADO. Las observaciones manuales distintas se conservan. Texto, enlace de navegación y aplicación contable siguen siendo cosas distintas.
- Diálogos con error persistente, captura conservada, bloqueo de doble clic, confirmación de descarte, foco contenido y retorno. El diálogo amplio mantiene sus acciones visibles con desplazamiento del contenido; etiquetas/ayudas y contraste se revisan en ambos temas.

## Instalación del servidor

1. Ejecutar solo el diagnóstico `supabase/checks/preflight_correcciones_financieras_20261106.sql` en el mismo proyecto que utiliza el cliente. Confirmar tablas y revisar las definiciones instaladas de v2, v3, conciliación y triggers. Este trabajo no ha contrastado esas definiciones con producción.
2. Con respaldo y ventana coordinada, instalar individualmente `supabase/migrations/20261106120000_consulta_y_operaciones_financieras.sql`, completo. Requiere conciliación `20261018160000`, equivalencias/bitácora `20261018180000` y sus dependencias existentes; no reejecutarlas indiscriminadamente.
3. Ejecutar `supabase/checks/verificar_correcciones_financieras_20261106.sql`: dos RPC instaladas, ejecución anónima false, autenticada true; auditoría con RLS true y sin escritura directa; `v2_saldo_corregido=true`.
4. Publicar el cliente solo después de verificar su servidor. Si falta la RPC, el cliente conserva la captura y explica la migración requerida; no tiene fallback a las escrituras separadas anteriores.
5. Verificar sesiones reales por rol, observación, consulta y vínculo en operaciones autorizadas. No emitir/cancelar/borrar recibos ficticios en producción como prueba.

La migración crea `finanzas_operaciones_auditoria`, las funciones de saldo/observación/vinculación y actualiza la definición de v2 manteniendo su firma y la protección de v3. No modifica registros al instalarse ni altera la función de emisión. No desactiva triggers o RLS. Sustituye la comparación amplia PAGADO por saldo controlado; el cálculo económico se mantiene transaccional. Conservar las definiciones previas para recuperación; volver al frontend anterior no revierte SQL.

## Verificación realizada y límites

- Ensayo PostgreSQL 18.3 local desechable, con tablas ficticias, funciones previas de conciliación y trigger de sincronización: 41 comprobaciones aprobadas. Incluyen abonos 400+300+500 sobre 1,000, excedente único 200, distribución múltiple, histórico de ciclo homónimo sin mover saldo, rechazo de otro periodo, permisos, estados BAJA/CANCELADO por revisar, índice legado 18/estado vacío, observación concurrente, revisión caducada y rollback completo ante fallo de auditoría posterior a la aplicación. El servidor local se detuvo al finalizar. Esto no equivale a ensayar los triggers adicionales de producción ni PostgreSQL 17.6 instalado.
- Ensayo `scripts/ensayoFinanzas.html`: datos ficticios, conexiones externas interceptadas. Comprobados periodo vacío/histórico/homónimo, guardado de observación con una sola llamada RPC, error conservando texto, cancelación de descarte, 25 recibos en dos páginas, búsqueda de folio, cancelado no seleccionable, revisión/confirmación desde ambas entradas, presentación de abono 400/restante 600 y destino exacto desde el recibo.
- Revisión a 390/820/1280 px, temas claro/oscuro, sin desbordamiento de la página en las vistas comprobadas; errores/warnings de consola no observados en la ejecución final del ensayo.
- Tipado, compilación y 252 pruebas aprobados. La compilación conserva avisos de chunks grandes de exportación. No se ejecutaron operaciones con datos reales, pruebas de carga con volumen real ni pruebas de concurrencia con varias sesiones de producción. No se atribuye un tiempo en segundos al guardado real sin medirlo.

## Alcance conservado

**Ampliación posterior preparada el mismo día:** la [conciliación entre periodos](CONCILIACION_RECIBOS_ENTRE_PERIODOS.md) añade motivo/respaldo y una operación exclusiva Administración/Finanzas. Requiere instalar también `20261106150000_conciliacion_recibos_entre_periodos.sql` antes del cliente ampliado. El párrafo siguiente describe el alcance inicial, previo a esa ampliación.

No se amplió la conciliación entre nombres de periodo diferentes. No se rediseñaron cancelación, emisión, borrado fiscal, promoción, cobertura o clasificación Integral. Los módulos financieros anteriores y su SQL pendiente no se consideran cerrados por esta entrega. La especificación de referencia es `PLAN_CORRECCIONES_FINANZAS_20261106.md`.
