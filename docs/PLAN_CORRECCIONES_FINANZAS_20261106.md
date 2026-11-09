# Plan de corrección de consulta y vinculación financiera

Fecha: 06/11/2026. Alcance: Coordinación Financiera, Planes de Pago y Consulta de Recibos.

Este documento conserva la especificación original. Su implementación local del 06/11/2026, SQL preparado y verificaciones se describen en [APLICACION_CORRECCIONES_FINANCIERAS_20261106.md](APLICACION_CORRECCIONES_FINANCIERAS_20261106.md). No se modificaron datos reales ni se publicó. Las referencias SQL describen archivos versionados; su definición instalada debe comprobarse antes de modificarlos. Publicar código no instala funciones SQL.

## Resultado esperado

Consultar un periodo, localizar al alumno y distinguir sus planes; editar la observación de un concepto sin descargar todo el historial; buscar recibos del alumno y vincularlos a un destino inequívoco. Las dos entradas, desde plan o desde recibo, compartirán reglas, validación y presentación del resultado.

## Reglas que se conservan

1. Alumno, plan, ciclo, detalle de recibo y concepto se identifican mediante sus IDs. Nombre, folio visible, texto del concepto e índice legado son ayudas de consulta; no sustituyen la identidad del vínculo.
2. Un periodo de consulta como 2027-1 puede agrupar ciclos homónimos Semestral y Cuatrimestral. Cada plan conserva su ciclo_id exacto y su tipo. Cambiar un filtro nunca reasocia registros.
3. Crear/editar la estructura del plan exige elegir y validar el ciclo exacto. La consulta agrupada no selecciona silenciosamente un ID para el alta.
4. Los abonos parciales se conservan. Pueden existir varios recibos en un concepto y, donde la operación vigente lo permita, distribución de un detalle entre varios conceptos. Se presenta el importe aplicado y el restante.
5. Ningún detalle puede aplicar más de su importe disponible; ningún concepto recibe más de su saldo pendiente. Comparaciones monetarias en centavos o numeric con la tolerancia institucional existente, sin aritmética binaria para decidir movimientos.
6. Un excedente nuevo de una operación de aplicación se abona al monedero una sola vez y dentro de la misma transacción. Se conserva la bitácora existente de excedentes y el bloqueo de doble aplicación.
7. Registrar o reparar un vínculo histórico no vuelve a cobrar, no acredita monedero, no mueve el ciclo contable del recibo y no cambia factura, folio, fecha o importes. Un remanente sin procedencia comprobada no se convierte automáticamente en saldo nuevo.
8. La categoría de operación no se infiere solamente por coincidir ciclo, texto o índice. Un recibo histórico puede estar en el mismo ciclo y ya haber generado monedero. Antes de aplicar, el servidor comprueba vínculos, aplicaciones y movimientos previos; un caso indeterminado se deriva a revisión financiera.
9. La vinculación manual no exige igualdad literal de conceptos. Texto parecido puede ayudar a buscar, pero no autoriza un movimiento ni bloquea uno por sí solo. El usuario identifica el destino y el servidor comprueba alumno, disponibilidad, permisos e integridad.
10. La observación editable y la aplicación financiera son operaciones distintas. Escribir R-40200 conserva el enlace de navegación, pero no crea un cobro o vínculo contable. Borrar el texto no elimina un vínculo comprobado ni revierte monedero.
11. Si existen detalles normalizados, son la fuente de conceptos; no se completan huecos con columnas legadas residuales. Solo un plan sin detalles usa sus columnas numeradas, incluyendo los 18 índices admitidos por el dominio.
12. PENDIENTE, NO PAGADO, ABONO y RESTA no significan liquidación. Un texto desconocido se muestra para revisión; no se interpreta como pago completo por contener una palabra o folio.
13. No se modifican las reglas de emisión, cancelación, borrado fiscal, promoción, clasificación Integral o cobertura. Los problemas de esos recorridos quedan identificados fuera de esta entrega.

## Etapa 0 — Comprobar la base y fijar el estado inicial

Preparar un diagnóstico de solo lectura, sin nombres, matrículas o claves, que contraste:

- Funciones instaladas de aplicación, conciliación, desvinculación y emisión; triggers de sincronización entre planes y detalles; permisos por rol.
- Vínculos activos duplicados, importes aplicados y excedentes ya registrados. No completar automáticamente vínculos ausentes a partir de texto.
- Planes con detalles y legados, y coincidencia de estatus entre ambas representaciones. Separar una inconsistencia real de una representación visual calculada.
- Distribución de recibos sin ciclo, en otros periodos, cancelados y con vínculos existentes. Un total de consulta no equivale a importe disponible para aplicar.
- Tiempos del guardado actual: escritura, consultas de validación, recargas y eventos Realtime, sin registrar datos personales en logs.

Salida: lista de funciones comprobadas y línea base de solicitudes/tiempos. El error de consulta nunca se presenta como ausencia de planes o recibos.

## Etapa 1 — Consulta por periodo y navegación estable

- Selector local «Periodo de consulta», descendente, con «Todos los periodos» como opción explícita. Propuesta: agrupar por nombre de periodo y filtrar internamente por el conjunto de IDs correspondientes, sin modificar sus registros.
- Al entrar desde una ficha o recibo con plan exacto, abrir ese periodo y ese plan. Sin contexto directo, restaurar la preferencia local del usuario o pedir elección cuando sea ambigua.
- Aplicar el alcance elegido a búsqueda, alumnos, flechas, contador y pestañas. No filtrar solamente la presentación de pestañas dejando las flechas globales.
- Pestañas del alumno limitadas al periodo: tipo de plan, periodicidad del ciclo y folio; orden estable. No confundir el tipo financiero con la periodicidad del ciclo registrado.
- Conservar al alumno al cambiar periodo si tiene planes; si no, mostrar estado vacío y una acción explícita para consultar su historial. No saltar automáticamente a otro alumno.
- «Sin planes en este periodo» conserva selector, búsqueda y alta. Proteger formularios abiertos antes de cambiar contexto.
- Selector de consulta de ancho contextual y alta/edición con selector exacto independiente. Etiquetas y tooltips alineados, accesibles y legibles en ambos temas.

Aceptación: 2027-1 homónimo muestra los planes esperados, sin mezclar 2026-3; Todos permite historial completo; enlaces directos, ciclos vacíos y cambios de contexto conservan identidad y captura.

## Etapa 2 — Guardado puntual de la observación

- Separar del guardado de la estructura del plan. Un cambio de estatus no envía el objeto completo ni modifica importes, fechas, tipo o ciclo.
- Proponer una operación transaccional para el concepto identificado, con valor/revisión original, permisos y auditoría. Mantener columnas legadas y detalle normalizado coherentes en una sola operación, coordinada con los triggers existentes; no desactivarlos para acelerar.
- Respuesta con estado confirmado del concepto o plan, suficiente para actualizar únicamente el registro afectado en el store. Una consulta puntual final puede sustituir la respuesta completa si se mantiene la consistencia.
- Quitar las dos recargas completas consecutivas. Deduplicar invalidaciones de Realtime por plan y no iniciar descargas globales por cada evento. Los cambios remotos actualizan lo confirmado sin sobrescribir un formulario abierto.
- Bloquear clics repetidos con estado y protección inmediata; mostrar Guardando y error persistente, conservando el texto. Cerrar solo tras confirmación del servidor.
- Un conflicto de otra sesión muestra el valor actual y permite revisar; no sobrescribe silenciosamente. Una respuesta perdida obliga a comprobar el resultado antes de reintentar.
- No permitir PENDIENTE si contradice un vínculo activo; la revisión de un vínculo histórico no se resuelve borrando su observación. El guardado manual no cambia dinero.

Aceptación: una operación de guardado por clic, ninguna recarga del conjunto global, actualización visible sin recargar página, rollback completo ante error y protección ante doble clic/concurrencia. Comparar con la línea base; no prometer segundos antes de medir la red real.

## Etapa 3 — Dominio compartido de saldos y conceptos

- Extraer la enumeración de conceptos normalizados/legados y la interpretación financiera a funciones puras compartidas; consumirlas desde ambos modales.
- Conservar la observación histórica y distinguirla de aplicaciones verificadas. Al calcular un saldo, no sumar dos veces un abono que aparece tanto en la observación como en la tabla de vínculos.
- Priorizar fuentes estructuradas comprobadas; si la información legada no permite determinar el saldo, señalar revisión en lugar de asignar cero o el total.
- Corregir includes/LIKE amplio de PAGADO en cliente y funciones SQL involucradas. Alinear las decisiones de elegibilidad; un cambio solo visual no basta.
- Mostrar importe del concepto, aplicado, pendiente y recibos vinculados. Un concepto liquidado sigue visible, con motivo de no aplicación; no desaparece sin explicación.

Aceptación: NO PAGADO, pendiente, liquidado, abono, resta, beca, importe cero, texto desconocido y vínculo con observación legada no producen liquidaciones ni cargos ficticios.

## Etapa 4 — Vinculación común desde plan y desde recibo

Crear un mismo flujo de presentación y servicio, con contexto inicial distinto:

- Desde plan: alumno/plan/concepto fijados; recibos del alumno con filtro de periodo, búsqueda por folio, opción de historial y paginación real.
- Desde recibo: alumno/detalle fijados; slector de periodo, luego plan y conceptos. Cada plan muestra periodo, periodicidad registrada, tipo financiero, folio, preograma/grado cuando exista y saldos disponibles.
- Toda opción incluye estado: disponible, ya aplicado, parcialmente aplicado, cancelado o requiere revisión. Los vínculos explícitos muestran el destino real; un índice legado aislado no oculta todos los planes ni autoriza uno.
- Consultar no equivale a permitir aplicar: recibos cancelados y de otro alumno nunca son candidatos de cobro; los de otro periodo pueden consultarse aunque la operación todavía no esté habilitada.
- Definir y aprobar antes de ampliar SQL la conciliación de periodos diferentes: propuesta de permiso exclusivo Administración/Finanzas, selección explícita, motivo y evidencia, vista previa y sin mover el ciclo del recibo ni acreditar monedero. Hasta aprobarla, mostrar el motivo de restricción.
- Confirmación previa con origen, destino e importe. La pantalla distingue «Aplicar abono disponible» de «Registrar vínculo histórico». No deducir el tratamiento del monedero por el simple cambio de ciclo.
- En aplicación, distribuir en orden visible antes de llevar un sobrante nuevo al monedero; presentar el resultado. Conservar los permisos de Caja donde ya están admitidos y la conciliación histórica reservada a Administración/Finanzas.
- Registrar vínculo histórico conserva el texto original y presenta el vínculo y los importes; no sustituye evidencia por un mensaje genérico. Tras confirmar, ambas pantallas muestran los mismos folios y contexto.
- Enlaces «Ver plan» y «Ver recibo» transmiten IDs exactos y conservan origen/filtros, en vez de abrir el último plan encontrado por nombre o alumno.
- Consultas paginadas con orden estable, cancelación/respuesta obsoleta protegida, error/reintento y estado vacío auténtico. No usar el conteo de una página como total del historial.

Aceptación: el mismo detalle y destino producen el mismo resultado desde ambas entradas; un recibo oculto por otro periodo se localiza; cada aplicación identifica exactamente el plan y concepto; reintentar no duplica aplicación ni monedero.

## Etapa 5 — Regresión e instalación

| Caso | Resultado obligatorio |
|---|---|
| Concepto 1,000; recibo disponible 400 | Abono 400, resta 600; monedero sin cambio. |
| Segundo recibo disponible 300 | Aplicado acumulado 700, resta 300; conservar ambos folios. |
| Último recibo disponible 500 | Aplicar 300 y acreditar 200 de excedente nuevo exactamente una vez. |
| Dos conceptos pendientes y distribución seleccionada | Distribuir según orden confirmado; solo el remanente después de ambos puede ser excedente. |
| Historial con abono/monedero ya asentados | Solo vínculo y auditoría; ningún nuevo crédito ni cobro. |
| Recibo con excedente ya registrado que se intenta desvincular/reaplicar | Conservar protección y revisión financiera; nunca acreditar otra vez. |
| Dos operadores o respuesta perdida | Comprobación transaccional, sin sobreaplicar ni duplicar saldo; conflicto explicativo o resultado previo verificable. |
| Texto R-40200 cambiado manualmente | Texto/enlace editables; importe, vínculo, recibo y monedero intactos. |
| Parciales presentes solo en texto legado | No inventar aplicaciones; revisión cuando no pueda comprobarse saldo/disponibilidad. |
| Concepto NO PAGADO | Visible como pendiente, sujeto a las demás comprobaciones. |
| Detalles normalizados con índices ausentes | No reaparecen conceptos residuales de campos numerados. |
| Recibo cancelado o de otro alumno | No se permite aplicar. |
| Recibo fiscal/histórico | No cambian factura, fecha, folio, importe ni ciclo por la conciliación. |
| Periodo sin planes, móvil y temas | Selector y acciones disponibles; sin pantalla blanca ni selección incorrecta. |

Pruebas puras de saldos, selección e identidad; pruebas SQL de atomicidad, permisos, conflictos e idempotencia; ensayos de interfaz y red controlada; lint, build y batería existente. No emitir, cancelar o borrar recibos ficticios en producción como prueba.

Antes de preparar migraciones o contratos nuevos, consultar la autorización requerida por AGENTS.md. La instalación se organizará en cambios compatibles: servidor aditivo y verificación, cliente coordinado, comprobaciones de operación; sin reejecutar cargas o correcciones históricas. El frontend no se publica con llamadas obligatorias a funciones que todavía no existen. No se aplica SQL ni se publica main por crear este plan.

## División técnica propuesta

- `src/components/planesPago`: barra de consulta, pestañas del alumno y editor de observación, sin ampliar el componente raíz.
- `src/components/recibos`: diálogo de vinculación reutilizable y resumen de origen/destino.
- `src/hooks`: consulta contextual, consulta paginada y guardado puntual por casos de uso; evitar un hook monolítico.
- `src/services`: consultas acotadas, actualización de un plan y operaciones transaccionales autorizadas.
- Dominio financiero puro: enumeración de conceptos, estados, saldos y disponibilidad, consumido por ambas entradas. El servidor mantiene la última palabra sobre dinero y permisos.
- Store: mezcla de resultados confirmados por ID y eventos agrupados; no reemplazar el conjunto global ni capturas pendientes por cada cambio de un concepto.

## Decisiones a cerrar antes de ampliar reglas

1. Confirmar si la consulta inicial agrupa homónimos por periodo nominal (propuesta) o exige ciclo exacto. En ambos casos, escrituras por ID exacto.
2. Aprobar el alcance de conciliación entre nombres de periodo distintos, actualmente bloqueado en SQL. Mostrar todos los recibos no implica aprobar todas las aplicaciones.
3. Contrastar las funciones y triggers realmente instalados. Un archivo versionado y 249 pruebas del cliente no demuestran el comportamiento del backend de producción.

La optimización de escritura, el selector local y la identificación visible pueden implementarse sin aceptar automáticamente nuevas aplicaciones entre periodos. La ampliación de conciliación es una entrega separada de la corrección de consulta.
