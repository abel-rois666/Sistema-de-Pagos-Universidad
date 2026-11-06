# Trayectoria e inscripciones — 30/10/2026

Implementación local. SQL preparado con autorización; no ejecutado en Supabase ni publicado.

## Uso

En la ficha, Administración y Control Escolar disponen de «Trayectoria e inscripciones». Elegir el programa muestra su ingreso acreditado, inscripciones por ciclo, preparaciones pendientes y bitácoras. Cada inscripción muestra grado personal y vigencia. La ausencia de inscripción no se interpreta como ausencia de trayectoria académica.

«Acreditar ingreso» permite guardar solo un ciclo conocido, sin inventar día. La calidad se registra como Documentado, Aproximado o Pendiente. Respaldo, motivo y confirmación son obligatorios; las correcciones conservan antes/después y revisión optimista. Las fechas legadas y las fechas por ciclo se muestran como antecedentes, sin copiarlas automáticamente al ingreso único.

Para registrar matrícula se elige un destino compatible y se abre el mismo módulo central, filtrado por `alumno_programa_id` exacto. Se reutilizan las preparaciones, validaciones y funciones transaccionales; no hay otra escritura de matrícula desde la ficha. Se puede retirar el filtro para trabajar masivamente.

El ingreso acreditado se carga como referencia inicial en el formulario central. El servidor impide registrar una fecha de primer ingreso diferente o una inscripción efectiva anterior al ingreso acreditado. Las discrepancias históricas requieren revisión explícita; esta migración no las corrige. Cancelar una inscripción errónea sigue disponible.

## Fechas e historia

La propuesta del ciclo más antiguo con calificaciones completa `fecha_primer_ingreso`, conservando `desde` (fecha efectiva del destino). El origen se propone desde el último ciclo anterior con calificaciones. Ambas propuestas siguen siendo revisables, no confirman matrícula ni avanzan el grado. El helper mantiene huella e identidad verificables.

Una preparación antigua que atribuye `desde` al método `HISTORIAL_MAS_ANTIGUO` requiere revisar/corregir la fecha efectiva y confirmar su captura manual antes de guardar. No se migra ni cambia por anticipado. Las inscripciones antiguas y sus bitácoras permanecen consultables.

La consulta del historial académico deja de crear programas con la fecha actual. Si falta la relación alumno–programa, el usuario recibe una indicación para revisarla en Datos Generales. Se seleccionan `id` y `es_vigente` en el historial.

La acción anterior se llama «Preparar avance, pagos y carga» y explica sus efectos; el destino se limita a la periodicidad del plan y se ordena descendente. La inscripción integrada depende de la función instalada y de su configuración; no se activa automáticamente.

## Contexto de ciclos

Se conserva la selección por usuario/módulo y los IDs exactos; no se restablece un selector global controlador. Sin preferencia válida, un ciclo institucional activo único sirve de sugerencia. Si hay varios activos o el periodo más reciente es homónimo, se solicita elección explícita. `activeCicloId` legado no desempata ni reasocia registros.

Planes de pago conserva la consulta de todos los planes y ciclo explícito en alta/edición. Recibos desde un plan heredan el suyo; recibos independientes requieren la selección y confirmación local existentes. Comunicados conserva entrega/boleta separadas; 911 mantiene expediente anual, corte y fuentes explícitas. No se cambia contabilidad, vínculos históricos, monedero ni versiones cerradas 911.

## Instalación segura

1. Revisar las migraciones previas mediante la guía `INSCRIPCIONES_CICLO.md`; se requieren las del 27/10 y 29/10 hasta `20261029160000_fecha_historica_origen_inscripciones.sql`. No repetir migraciones ya instaladas.
2. Ejecutar `supabase/checks/preflight_ingreso_programa_trayectoria.sql`: requisitos presentes e ingreso aún ausente.
3. Aplicar únicamente `supabase/migrations/20261030100000_ingreso_programa_trayectoria.sql`.
4. Ejecutar `supabase/checks/verificar_ingreso_programa_trayectoria.sql`: dos tablas con RLS, sin escritura directa ni lectura anónima, RPC presente y separación histórica verdadera.
5. Publicar el frontend mediante el procedimiento habitual, después de verificar la versión preparada. Probar roles reales, alta/corrección y revisión de una preparación antigua. El formulario de ingreso se deshabilita si falta la tabla nueva; no degrada a escrituras directas.

La migración crea ingreso por programa y bitácora, RPC con permiso servidor y revisión, validación de coherencia y publicación Realtime cuando existe. No carga datos, no sobrescribe fechas ni altera los flujos financieros. El seguimiento desde la ficha actualiza al guardar, con eventos y al recuperar foco; no reemplaza una captura abierta. El servidor rechaza revisiones concurrentes.

## Verificación

Ensayo SQL en copia exclusivamente local y ficticia de las pruebas previas: instalación sin rellenado, ciclo sin fecha, auditoría, revisiones concurrentes, periodicidad, permisos/RLS, helper privado y rechazo de inferencia histórica como vigencia del destino y de discrepancias con el ingreso acreditado. Script `scripts/tests/ingresoPrograma.local.sql`.

Ensayo de interfaz sin red externa: `scripts/ensayoTrayectoriaAlumno.html`. Pendiente aceptación institucional y ejecución SQL en Supabase por el responsable.

Verificación final local: tipado y compilación; 223 pruebas TypeScript aprobadas. SQL de ingreso en copia ficticia verificado, incluido primer ingreso con ciclo acreditado y día desconocido; este caso conserva fecha efectiva obligatoria y exige ID exacto. Interfaz ensayada con guardado/revisión, navegación por alumno/ciclo, aplicación de propuesta sin cambiar vigencia y tamaños 390/768/1280 en ambos temas sin desbordamiento de página. Sin errores de consola observados. Sesiones y registros reales de Supabase no comprobados.

El verificador informa cuántas inscripciones/preparaciones heredadas usaron fecha histórica como vigencia para revisarlas de forma individual. El ingreso único no obliga a inventar un día: si el ciclo de destino está acreditado como primer ingreso, puede mantenerse `fecha_primer_ingreso` vacía. Su ausencia seguirá siendo un faltante en cualquier estadística que exija fecha precisa; no se completa automáticamente para el 911.


## Consulta desde Datos Generales

«Ingreso y registro del programa» distingue captura (`created_at`), referencia anterior (`fecha_inscripcion`) e ingreso acreditado. El selector no cambia el programa vigente: únicamente consulta la asociación elegida. Su enlace abre Trayectoria con ese ID. No se propaga la fecha reciente de captura al historial ni se transfieren fechas entre programas. La fecha anterior conserva su edición existente, con una explicación explícita de su alcance. Cuando se necesite acreditar continuidad entre versiones de un plan se debe revisar el caso; no se genera una continuidad por nombre de carrera. Esta integración y la navegación adaptable son de frontend y no requieren SQL nuevo.
