# Actualización masiva del pago del certificado

Preparada el 10/11/2026. No se ejecutó SQL ni se modificaron datos reales.

## Uso

Listado General → Pago del certificado → Seleccionar alumnos para actualizar. Se activa su columna y se muestran casillas exclusivas de Administración. La casilla superior selecciona solo la página visible; se conservan otras páginas/filtros, con resumen completo y Quitar. Máximo 50 alumnos. Ocultar las casillas conserva la selección; Limpiar la retira.

Actualizar pago abre una consulta nueva y autorizada con las fichas de los alumnos exactos, no una inferencia por carrera, ciclo o programa principal. Cada ficha se marca expresamente, o se usan Seleccionar todas / Deseleccionar todas sobre las disponibles de esta revisión. El alcance incluye filas fuera del área visible; si son más de 50, se bloquea seleccionar todas y se pide marcar individualmente, sin elegir un subconjunto arbitrario. Un alumno con varios programas permite elegir una o varias fichas, hasta 50 por operación. Sin registro, archivadas o sin programa no se habilitan ni se crean automáticamente. Estas situaciones deben resolverse desde la ficha individual y las herramientas de asociación existentes.

Elegir Sin iniciar / En curso / Completado, registrar motivo de 10–1000 caracteres y revisar resumen de alumnos, programas y estado anterior/nuevo. Un estado no completado para un trámite concluido requiere revisión expresa, también validada por el servidor y registrada en auditoría. No reabre el trámite.

Solo Confirmar cambios escribe. La RPC actualiza exclusivamente pago_certificado, revisión y fecha de actualización, y audita antes/después. No llama al guardado general, no genera recibos, modifica monedero o saldos ni cierra programas. Es un estado administrativo declarado, no evidencia automática de un cobro. El lote se valida bajo bloqueos; cualquier conflicto aborta todo. No se implementan escrituras parciales. Ante un error se conservan captura y selección. Ante una desconexión con resultado incierto, consultar antes de repetir.

El éxito recarga el seguimiento sin restablecer filtros, columnas, orden o página. Si un filtro de estado deja de coincidir, las filas salen del resultado y la paginación se ajusta con el comportamiento existente. CSV/PDF siguen exportando resultados filtrados y columnas elegidas, sin casillas.

## Instalación y verificación pendientes

1. Ejecutar `supabase/checks/preflight_pago_certificado_lote.sql` (solo lectura), contrastando columnas, auditoría, permisos y triggers. La garantía de no cambiar otros datos requiere verificar también los triggers instalados.
2. Ensayar primero la migración `20261110130000_pago_certificado_lote.sql`, que requiere certificación por programa 20261109120000. Solo añade funciones; no actualiza fichas al instalar. No requiere Edge Functions.
3. Verificar `supabase/checks/verificar_pago_certificado_lote.sql`: dos funciones, acceso anónimo false y autenticado true; las funciones vuelven a exigir Administración activa.
4. Publicar el cliente coordinadamente. Sin RPC se muestra actualización pendiente y no hay fallback al guardado general ni a escrituras directas. La consulta del listado permanece disponible.

Antes de producción comprobar permisos por rol, rollback, cambios concurrentes, fichas archivadas o sin programa, múltiples programas, doble clic, desconexión y reporte/exportación tras guardar. Las pruebas de TypeScript y de contrato SQL no ejecutan PostgreSQL ni acreditan la instalación. Revisión visual en navegador pendiente.

Verificación local: tipado y compilación correctos, 424 pruebas aprobadas. Las seis nuevas cubren elegibilidad, programas múltiples, límites, confirmación de concluidos y contrato SQL. Continúa el aviso previo de paquetes grandes. No se ejecutó SQL ni se publicaron cambios.

Selección completa: tipado y compilación correctos; 426 pruebas aprobadas, incluidas exclusión de bloqueadas y rechazo del exceso de 50 sin selección parcial. Revisión visual en navegador pendiente.

## Corrección del error «column reference x is ambiguous»

La captura del usuario mostró un error técnico en la comprobación de duplicados: la variable PL/pgSQL `x` coincidía con el alias SQL de `jsonb_array_elements`. No es un conflicto de pagos ni una ficha inválida. La migración base preparada se corrigió para instalaciones nuevas.

Si ya instalaste la base, NO la repitas: revisar e instalar `20261110140000_validacion_previa_pago_certificado.sql`. La corrección contrasta la función instalada con la preparación conocida (original o con el alias corregido), sin sobreescribir una versión distinta inadvertidamente. Si se detiene por diferencia, obtener la definición con `supabase/checks/verificar_validacion_previa_pago_certificado.sql` y revisarla. Instalar esta corrección no cambia fichas y conserva la firma de guardado para clientes anteriores.

El cliente actualizado consulta `certificacion_pago_lote_validar_v1` antes de mostrar el resumen final. Se comprueban permisos, parámetros y cada ficha; las incidencias señalan los registros afectados. Se pueden quitar del lote o actualizar los datos con confirmación de que deberán marcarse otra vez. Actualizar conserva motivo y nuevo estado. Un fallo de validación no habilita el resumen.

El guardado vuelve a comprobar el lote con el mismo validador bajo bloqueos antes de la primera escritura. La validación previa no reserva ni modifica registros: otra sesión puede generar un conflicto después. No es posible garantizar que todos los problemas de red, triggers o concurrencia se detecten antes del guardado. Deben ensayarse en PostgreSQL los permisos, las ramas de validación, el rollback y los triggers instalados; las pruebas locales de contrato no lo sustituyen.

Verificar la instalación con `supabase/checks/verificar_validacion_previa_pago_certificado.sql`: validador privado sin acceso de authenticated/anon; dos RPC públicas con anon false y authenticated true, y autorización de Administración dentro de las funciones. No requiere Edge Functions. Coordinar SQL y cliente: sin el nuevo validador el cliente bloquea el avance al resumen.

Verificación de la corrección: tipado y compilación correctos, 430 pruebas aprobadas. Cuatro nuevas verifican respuestas incompletas, incidencias identificables, validador sin escrituras y revalidación bajo bloqueos antes de actualizar. No se ejecutó SQL ni se verificó el flujo en navegador.
