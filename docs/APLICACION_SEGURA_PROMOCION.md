# Aplicación de la promoción de alumnos

La función SQL de promoción está en `supabase/migrations/20261006123000_promover_alumno_ciclo.sql`. El usuario informó que `promover_alumno_ciclo` ya existe en Supabase; su versión instalada aún debe comprobarse. Aplicar el archivo crea o actualiza únicamente la función y su permiso de ejecución: no modifica alumnos ni planes. Las escrituras ocurren después, cuando un usuario autorizado confirma una promoción o un egreso en la aplicación.

## Antes de instalar

Ejecuta `supabase/checks/preflight_promocion_alumnos.sql` en el editor SQL de Supabase. Revisa que todas las columnas indiquen `OK`, que `get_my_rol()` esté presente y que la función indique `OK: libre` u `OK: versión reemplazable`. Examina los disparadores de `alumno_programas`: deben existir `trg_blindar_motivo_alumno_programa` y `trg_recalcular_estatus_institucional_alumno`. Si aparece `FALTA` o `REVISAR`, detén la instalación y compara ese resultado con el esquema real. La migración también bloquea el reemplazo si encuentra una definición distinta.

## Instalación y verificación

Ejecuta el contenido **actualizado y completo** de la migración. `CREATE OR REPLACE FUNCTION` sustituye la versión anterior con la misma firma; volver a ejecutar este archivo es válido. Luego ejecuta `supabase/checks/verificar_promocion_alumnos.sql`: la función, el permiso de `authenticated`, la aceptación de `ACTIVO`/`CURSANDO` y «Conserva plan existente al promover» deben indicar `OK`; los dos disparadores institucionales deben aparecer. No ejecutes la función directamente para probarla con datos reales: eso sí promueve al alumno.

La función valida el rol (`ADMINISTRADOR` o `COORDINADOR CONTROL ESCOLAR`), el ciclo por ID y el programa vigente. Acepta el estatus curricular `CURSANDO` o `ACTIVO` cuando el alumno está institucionalmente `ACTIVO`. Un avance actualiza el grado y crea un plan solo cuando se solicita; un egreso conserva el grado y actualiza `alumno_programas.estatus`, dejando que el disparador actualice el estatus institucional. Un error revierte todas las escrituras de ese alumno. La opción «Manual» de reinscripción avanza sin crear plan financiero.

En Promoción Masiva, «Incluir alumnos que ya tienen plan» permite seleccionarlos y conservar el plan del ciclo. En la tabla individual, el botón «Promover» junto a «Inscrito» pide confirmar el mismo comportamiento. La interfaz envía el ID del plan a la función con `p_crear_plan = false`; la función comprueba que pertenece al alumno y al ciclo. La opción de copiar conceptos solo afecta a quienes todavía necesitan un plan nuevo. Si otro proceso cambia el plan antes de guardar, la función rechaza esa promoción y deja sus datos sin modificar.

## Límites conocidos

El folio se calcula bajo un bloqueo que serializa las promociones hechas por esta función. Los otros formularios que crean planes no usan ese bloqueo y el esquema no exige folios únicos; por eso no se afirma unicidad global. El lote guarda cada alumno por separado: algunos pueden completarse aunque otros fallen. La interfaz muestra esos resultados y permite revisar antes de reintentar.
