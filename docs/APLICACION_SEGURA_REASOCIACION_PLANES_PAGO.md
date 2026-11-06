# Validación y revisión de asociaciones de planes de pago

Esta entrega prepara código y SQL. No ejecuta la migración ni modifica datos de Supabase.

## Estado comprobado

El usuario mostró que los 14 planes identificados de 2027-1 ya apuntan al ciclo Cuatrimestral. En los seis planes con recibos, la consulta de etapa enumera también recibos históricos del mismo alumno porque une por `alumno_id`; solo los folios 41117, 41171, 40446, 41143, 41179 y 41170 aparecen en el ciclo destino. El folio 41168 también aparece allí, con dos detalles aún sin índice de concepto. Esa conciliación sigue siendo una tarea financiera separada.

## Instalación

1. Conservar un respaldo reciente de `planes_pago`, `recibos`, `recibos_detalles` y `alumno_programas`.
2. Ejecutar [el preflight](../supabase/checks/preflight_validar_reasociar_planes_pago.sql) en Supabase SQL Editor. Los campos de disponibilidad deben ser `true`; el segundo resultado enumera asociaciones históricas aún discordantes y no altera datos.
3. Ejecutar completa [la migración](../supabase/migrations/20261018120000_validar_y_reasociar_planes_pago.sql). No ejecutar fragmentos aislados.
4. Ejecutar [la comprobación posterior](../supabase/checks/verificar_validar_reasociar_planes_pago.sql): los primeros cinco campos deben ser `true` y `ejecucion_anon_debe_ser_false` debe ser `false`.
5. Publicar la versión del frontend que contiene este cambio. No se requiere volver a desplegar `comunicados-drive`: la nueva revisión usa una función SQL mediante Supabase RPC.

## Uso

En **Comunicados**, Administración puede abrir el plan homónimo desde el aviso. En **Planes de Pago**, selecciona el ciclo correcto y usa **Revisar asociación** en el plan que aparece con otro ID. La vista previa verifica grupo, programa vigente, duplicados y recibos. Solo Administración y Coordinación Financiera pueden ejecutar la función; la comprobación de rol se repite en el servidor.

El botón de corrección se habilita únicamente cuando la relación es inequívoca y todos los recibos del ciclo de origen, si existen, son activos, no fiscales y contienen conceptos vinculados al plan. La función vuelve a revisar esas condiciones al confirmar y registra plan, ciclos, recibos y usuario en una tabla de auditoría. Los folios cancelados, facturados, independientes o sin índice quedan para revisión individual; no se cambia el estado de un pago ni se atribuyen abonos. Los planes de Titulación y Especialidad se revisan por separado.

El disparador de la migración impide **nuevas** altas ordinarias si el tipo de plan de pagos no coincide con el ciclo y el programa académico vigente. No modifica registros previos ni sustituye el diagnóstico de los ocho casos con excepciones.

## Recibos desvinculados que deben permanecer en origen

«Desvincular» borra `indice_concepto_plan`, pero el recibo continúa asociado a su `ciclo_id`. Por eso la revisión inicial aún lo bloquea: esa ruta solo puede mover juntos el plan y todos los recibos del origen cuando cada concepto está comprobado. **No desvincules ni borres recibos solo para superar esa revisión.**

La migración adicional [reasociar solo el plan](../supabase/migrations/20261018133000_reasociar_solo_plan_pago.sql) permite una segunda revisión explícita. Primero instala la migración anterior; después instala esta y ejecuta [su verificación](../supabase/checks/verificar_reasociar_solo_plan_pago.sql). En la interfaz, «Revisar opción de mover solo el plan» aparece tras una revisión financiera bloqueada. La función exige grupo y programa únicos en el ciclo destino, ningún detalle de recibo vinculado y todos los estados del plan pendientes. Al confirmar, cambia únicamente el ID y tipo del plan; deja cada recibo en el ciclo de origen y registra sus IDs en auditoría. Los pagos de esos recibos **no se atribuyen** al plan corregido; deben conciliarse aparte. Si algún estado o vínculo persiste, bloquea el cambio.

Para el caso de los folios 41069 y 41140, ejecuta antes [el diagnóstico de solo lectura](../supabase/checks/diagnostico_reasociacion_altamira_2027_1.sql). Debe mostrar `detalles_vinculados = 0` y ambos conteos de estados cobrados en cero antes de usar la opción. El diagnóstico permite distinguir un vínculo pendiente de un recibo que simplemente permanece en el otro ciclo.

## Planes de promociones que se muestran vacíos

La interfaz lee los detalles normalizados cuando existen y, si no, los campos numerados. Un plan que se ve vacío puede no haber recibido copia, puede tener una fuente anterior vacía o puede estar asociado a otro ID de ciclo. No se deben copiar importes de manera masiva antes de identificar el plan y la fuente exactos.

Ejecuta [la consulta de filas de solo lectura](../supabase/checks/filas_planes_vacios_2027_1.sql), que devuelve un único resultado, y revisa primero las clasificadas como candidatas. No incluye nombres, matrículas ni importes. Para cada candidato habrá que comprobar conceptos, montos y estatus de la fuente antes de preparar una recuperación que inserte **solo en planes realmente vacíos** y no toque los existentes.

La migración [copia validada en promoción](../supabase/migrations/20261018140000_promocion_copia_conceptos_validada.sql) evita nuevos planes silenciosamente vacíos cuando se eligió copiar: exige un plan anterior con conceptos, de la misma periodicidad y de un ciclo anterior; valida además el ciclo contra el programa vigente. Conserva la firma de `promover_alumno_ciclo`. Ejecuta [la verificación](../supabase/checks/verificar_promocion_copia_conceptos.sql) tras instalarla. No recupera ni modifica planes ya creados.

### Recuperación preparada para 2027-1 Cuatrimestral

El resultado compartido de `filas_planes_vacios_2027_1.sql` contenía 128 filas: 125 destinos 2027-1 Cuatrimestral sin detalles ni conceptos legados, cada uno con un plan fuente identificado de 2026-3 Cuatrimestral. Esas fuentes suman 669 detalles. Los otros tres registros quedan excluidos: uno tiene recibos y ciclo incorrecto, y dos no tienen una fuente anterior comprobable (uno Cuatrimestral y otro de Titulación). Estos conteos describen el resultado compartido, no el estado actual de Supabase.

1. Ejecutar **solo lectura** [el preflight de recuperación](../supabase/checks/preflight_recuperar_planes_vacios_2027_1.sql). Revisar sus 125 filas, conceptos e importes. Para avanzar, debe mostrar 125 aptos, cero bloqueados y 669 detalles esperados; cualquier discrepancia obliga a revisar el caso antes de ejecutar cambios.
2. Tras revisar y respaldar `planes_pago` y `planes_pago_detalles`, ejecutar **completo y una sola vez** [el SQL transaccional preparado](../supabase/correcciones/20261018_recuperar_planes_vacios_promocion_2027_1.sql). Incluye una lista cerrada de pares destino/fuente, bloquea escrituras concurrentes durante la copia, vuelve a validar ciclo, alumno, unicidad, plan realmente vacío, ausencia de recibos y filas fuente. Si un solo plan cambió, revierte todo el lote. Inserta conceptos e importes como `PENDIENTE`, sin fechas de vencimiento: esas fechas se deben definir para 2027-1. No mueve ni modifica recibos, planes fuente o planes que ya tengan contenido.
3. Ejecutar [la verificación posterior](../supabase/checks/verificar_recuperacion_planes_vacios_2027_1.sql). Debe mostrar 125 planes recuperados, 669 detalles y cero diferencias respecto de las fuentes. Si el SQL se ejecuta de nuevo, su validación detectará destinos no vacíos y abortará sin duplicar conceptos.

**Estado:** los archivos están preparados; este agente no ejecutó consultas ni cambios en Supabase. La migración preventiva de promoción todavía necesita instalación y verificación: el usuario informó `promocion_instalada = true`, `copia_validada_instalada = false`.

## Conciliación de planes y recibos con facturación pendiente

La migración [de conciliación](../supabase/migrations/20261018160000_conciliacion_planes_recibos.sql) agrega vínculos explícitos entre detalle de recibo, ID de plan e índice de concepto. Un recibo puede distribuirse entre varios conceptos. No reconstruye vínculos históricos por inferencia ni cambia planes o recibos al instalarse. También prepara una revisión que puede mover **solo el plan** conservando los recibos, sus folios, su ciclo original, su estado fiscal y los estados de pago del plan. El resultado informa cuántos detalles con índice legado requieren conciliación posterior. La revisión vuelve a validar programa vigente, grupo, unicidad y ciclo antes de aplicar y registra el cambio en auditoría.

1. Respalda `planes_pago`, `planes_pago_detalles`, `recibos`, `recibos_detalles`, `alumnos` y `planes_pago_reasociaciones`.
2. Ejecuta [el preflight de solo lectura](../supabase/checks/preflight_conciliacion_planes_recibos.sql). Los siete indicadores de disponibilidad deben ser `true`. Instala primero las migraciones `20261018120000` y `20261018133000` si faltan.
3. Ejecuta completa la migración `20261018160000_conciliacion_planes_recibos.sql` en Supabase SQL Editor. No ejecutes fragmentos.
4. Ejecuta [la verificación de solo lectura](../supabase/checks/verificar_conciliacion_planes_recibos.sql). Los ocho indicadores del primer resultado deben ser `true`; los vínculos pueden iniciar en cero porque no se rellenan históricos automáticamente.
5. Despliega el frontend correspondiente inmediatamente después de la migración. El alta de recibos y las vinculaciones manuales usan las nuevas funciones transaccionales; si se publica ese frontend antes de la migración, esos cobros recibirán un error de función inexistente. Después de instalar la migración, un cliente antiguo tampoco podrá registrar un detalle con índice de plan sin su vínculo explícito.

En **Planes de Pago**, «Editar estructura» muestra el ciclo registrado y permite proponer manualmente el destino. «Revisar asociación» ofrece la ruta que conserva recibos y pagos cuando la ruta conjunta o la de solo plan pendiente no aplican. En **Consultar Registros**, abre el recibo del ciclo anterior y usa «Vincular» en cada detalle que de verdad corresponda al plan ya corregido. Los planes de un ciclo homónimo se muestran con su periodicidad. Para un recibo histórico de otro ID se concilia **un concepto por vez**: la función comprueba alumno, nombre del periodo, programa vigente, índice, límites de importe y vínculos previos. El usuario financiero decide si el detalle corresponde al concepto, aunque los textos difieran; puede capturar un abono parcial. Si el recibo mezcla trámites independientes, vincula únicamente los detalles del plan. Una vinculación histórica registra la relación sin reescribir factura, recibo ni estatus del plan.

«Desvincular» anula el vínculo explícito y borra el índice legado del detalle en una sola transacción; conserva el estado fiscal y el estatus histórico del plan. Se requiere revisión financiera si ese estado debe ajustarse. Los nuevos cobros registran el plan por ID en la misma transacción que crea el recibo; se rechaza un plan de otro ciclo exacto. La tabla nueva conserva quién creó o anuló cada vínculo, con RLS de lectura financiera y escrituras solo mediante funciones autorizadas.

La función heredada `registrar_pago_transaccional` sigue disponible para cobros sin concepto de plan. El disparador diferido rechaza sus cobros **con** índice de plan si no registran el vínculo explícito en la misma transacción; por eso la migración y el frontend deben publicarse en una misma ventana operativa. Tampoco se deben atribuir automáticamente a un plan los detalles históricos que solo tengan `indice_concepto_plan`: ese número no identifica un plan único.

## Programa vigente sin grupo y recibos tras la corrección

La revisión anterior exigía un grupo en el ciclo de destino. Un alumno puede tener un único programa vigente de la periodicidad correcta y todavía no estar asignado a un grupo. En ese caso la [migración adicional](../supabase/migrations/20261018170000_reasociacion_con_programa_sin_grupo.sql) permite corregir el plan; sigue bloqueando programas ausentes o múltiples, grupos que contradicen el programa, un grupo en el ciclo de origen y otro plan financiero en los ciclos involucrados. La vista previa indica si la prueba se basó en programa y grupo o únicamente en el programa. No asigna grupos ni cambia recibos.

1. Si el plan `271-106` continúa bloqueado, ejecuta [su diagnóstico de solo lectura](../supabase/checks/diagnostico_plan_271_106_reasociacion.sql). Confirma que haya exactamente un programa vigente Cuatrimestral, ningún grupo contradictorio ni otro plan. Si el diagnóstico no muestra ese patrón, la asociación exige revisar primero la ficha académica; no fuerces el ID financiero.
2. Tras instalar y verificar `20261018160000`, ejecuta completa `20261018170000_reasociacion_con_programa_sin_grupo.sql` y luego [su verificación de solo lectura](../supabase/checks/verificar_reasociacion_con_programa_sin_grupo.sql). Los tres indicadores deben ser `true`.
3. Publica el frontend de esta corrección. La revisión propone automáticamente la ruta de conservar recibos cuando la conjunta se bloquea. En el pago de cada concepto, «Vincular Recibo» muestra vínculos explícitos confirmados y recibos del alumno de ambos IDs del mismo periodo. Un índice legado que apunta a otro concepto exige revisión; los textos distintos se señalan, pero pueden vincularse manualmente después de revisar detalle e importe. El plan y los estados fiscales no se alteran al consultar candidatos. Nunca interpretes la coincidencia de nombre o índice legado como pago confirmado.

Este agente preparó los archivos; no ejecutó SQL ni verificó el caso con datos reales.

## Conciliación manual sin comparación de nombres

La migración [20261018180000_conceptos_recibos_equivalentes.sql](../supabase/migrations/20261018180000_conceptos_recibos_equivalentes.sql) preparada **antes de su instalación** elimina la comparación textual en la conciliación histórica. Se instala después de `20261018160000`; conserva la firma de la función y no modifica ningún dato existente al instalarse. La [verificación](../supabase/checks/verificar_conceptos_recibos_equivalentes.sql) debe devolver nueve valores `true`. El frontend muestra todos los detalles activos del alumno en el periodo nominal, incluso con textos distintos; solo Administración y Coordinación Financiera pueden elegirlos y confirmar manualmente concepto y abono. El servidor sigue comprobando alumno, periodo nominal, programa vigente, índice, importe disponible en el recibo y el plan, estado del recibo y ausencia de vínculo duplicado. Admite abonos parciales. Un índice legado que apunta a otro concepto continúa bloqueado para revisión individual.

La vinculación manual ordinaria de recibo y plan con el **mismo ID exacto** sigue permitiendo elegir el concepto aunque su texto varíe; valida alumno, ciclo, saldo, estado y permisos, aplica abonos y acredita al monedero el sobrante que devuelve la función de cobro. La nueva función `vincular_recibo_detalle_planes_v3` registra ese crédito por detalle y es la única ejecutable desde la aplicación; si el detalle ya generó un excedente registrado o conserva la observación histórica de excedente, bloquea otra vinculación que pudiera acreditarlo dos veces. Desvincular un detalle con ese antecedente exige revisión financiera del saldo. El cobro iniciado desde el plan conserva el concepto seleccionado.

La conciliación de **un recibo histórico ya cobrado** registra solamente el vínculo con el plan corregido. Informa el remanente del detalle, pero no mueve el monedero: el cobro original pudo haberlo acreditado y volver a sumarlo duplicaría dinero. Revisa ese remanente en el historial financiero antes de cualquier ajuste de saldo. El importe aplicado tampoco cambia automáticamente el estado de pago histórico del plan.

Cambiar `recibos.ciclo_id` es una corrección documental diferente de vincular un cobro a un plan. Un vínculo histórico explícito puede unir recibo y plan de IDs distintos cuando comparten periodo nominal; no es necesario mover el recibo para registrar esa relación.

## Cambios visibles y persistentes en planes

Después de la migración anterior, instala [20261018190000_sincronizar_plan_pago_detalles.sql](../supabase/migrations/20261018190000_sincronizar_plan_pago_detalles.sql) y ejecuta [su verificación de solo lectura](../supabase/checks/verificar_sincronizar_plan_pago_detalles.sql). El primer resultado debe mostrar cuatro valores `true`; el segundo no debe devolver índices duplicados. El disparador actualiza, en la misma transacción, los detalles normalizados existentes cuando cambian sus campos legados de concepto, fecha, importe o estatus. No rellena planes históricos al instalarse ni toca planes que solo usan campos legados. Rechaza borrar conceptos con pagos o reducir importes por debajo de vínculos confirmados. Tras un guardado correcto, la aplicación recarga la versión de la base y conserva el plan seleccionado. En otra sesión, la vista se actualiza por eventos de Supabase Realtime si esas tablas están publicadas; al volver a la pestaña también consulta la base. Publica este frontend después de instalar las migraciones para evitar que una recarga muestre detalles antiguos.
