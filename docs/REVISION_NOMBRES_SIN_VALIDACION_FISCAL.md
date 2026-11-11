# Corrección de revisión nominal de docentes

Preparada el 10/11/2026. **SQL no ejecutado y cambios no publicados.**

## Causa y alcance

`personal_nombres_revisar_lote_v1` llamaba al guardado general, que validaba RFC, CURP, correo y fechas del perfil completo. Un RFC histórico con formato pendiente bloqueaba una revisión que solo capturaba nombres y apellidos. El ID docente siempre fue la identidad de la operación; el RFC no es una clave de búsqueda o asociación de este lote.

La migración correctiva mantiene firma, respuesta y roles. El lote escribe exclusivamente las cuatro propiedades nominales del JSON, metadatos de revisión y auditoría. Para un docente sin persona compartida inicia esa identidad con los datos originales y asocia su mismo registro docente; no crea ni fusiona empleados. Conserva nombre anterior, actor y fuente. Exige UUID único, original íntegro, revisión vigente, partes completas/revisadas, motivo de 5–1000 caracteres y hasta 50 filas. Los datos originales se usan como testigo de concurrencia; no se aceptan campos fiscales nuevos en la operación.

La proyección de Personal detecta cambios exclusivos de nombres y sincroniza solo nombres con Docentes y Empleados ya relacionados. Conserva literalmente valores fiscales y de contacto de cada origen, incluso vacíos o diferencias históricas. No convierte fechas históricas al corregir un nombre. Para cambios de otras propiedades conserva el bloque general anterior. El formulario general continúa exigiendo datos fiscales/de contacto válidos si se guardan desde ese flujo.

Un conflicto o error revierte todo el lote; los bloqueos no garantizan que nunca exista contención entre procesos, que también se traduce conservando la captura. No se modifican claves, habilitación docente, usuarios, cuentas, cursos, horarios, contratos, formación, documentos o alumnos. Solo Administración y Coordinación Académica conservan la revisión nominal; Recursos Humanos no obtiene nuevas escrituras.

## Interfaz

Los errores de guardado ya no ocultan las filas capturadas. Si permanece la función antigua, el mensaje explica por qué exige revisar RFC/CURP/contacto e indica instalar esta corrección, sin sugerir borrar esos campos. Actualizar consulta conserva nombres y motivo, desmarca las revisiones y renueva los originales de las filas pendientes devueltas. Las capturas de otras páginas se conservan; una fila que otro usuario ya completó deja de aparecer como pendiente y debe revisarse desde su ficha, sin incluirla de nuevo automáticamente en el lote. Cambios detectados al volver a una página revocan su marca de revisión.

No se afirma que un error de red signifique rollback: se pide comprobar el resultado antes de repetir. Si se guardaron los nombres pero falla el refresco del directorio, se informa el guardado confirmado y la consulta pendiente por separado.

## Instalación cuando se autorice ejecutar

1. Base y ampliación de nombres deben estar instaladas: `20261108120000_personal_y_docentes.sql` y `20261108150000_nombres_estructurados_personal.sql`. No repetirlas si ya están presentes.
2. Ejecutar únicamente la lectura `supabase/checks/preflight_revision_nombres_sin_fiscal.sql`. Revisar definiciones, huellas, triggers activos y permisos. No contiene valores personales.
3. Aplicar `supabase/migrations/20261110150000_revision_nombres_sin_validacion_fiscal.sql`. No cambia registros al instalar. La guarda acepta las versiones originales revisadas y esta corrección; ante una definición distinta se detiene para revisar el preflight, sin retirar la guarda ni sustituir una personalización desconocida.
4. Ejecutar `supabase/checks/verificar_revision_nombres_sin_fiscal.sql`: corrección presente en ambas funciones, `SECURITY DEFINER` y `search_path` fijado; anon sin ejecución; authenticated ejecuta solo la RPC, no el helper; trigger de proyección activo; validación RFC/CURP del guardado general todavía presente.
5. Publicar el cliente con los mensajes y conservación de captura. El contrato existente permite instalar la corrección SQL antes del cliente. Verificar roles y comportamiento antes de usar lotes reales.

## Verificación y límites

`tests/revisionNombresSinFiscal.test.ts` verifica validaciones del cliente, identidad por UUID, conservación de propuestas al actualizar y mensajes; también contrasta estáticamente las huellas de la migración, la proyección general conservada y la lista de escrituras. **Esto no sustituye ejecutar SQL ni acredita atomicidad o permisos instalados.**

Se preparó `scripts/tests/nombresSinFiscal.local.sql`, exclusivamente para una base local vacía, desechable y ficticia. Incluye identidad compartida, RFC mal formado/duplicado, CURP/correo/fecha históricos, vacíos exactos, auditoría, inyección de campos, rollback, revisión obsoleta y conservación de validación general. **No se ejecutó**, respetando la autorización de preparar SQL sin ejecutarlo. Los ensayos contra el esquema instalado siguen pendientes.

Verificación realizada: tipado y compilación correctos, 444 pruebas del repositorio aprobadas (seis nuevas). La compilación conserva el aviso previo de paquetes grandes. Ensayo del cliente en `scripts/ensayoNombresSinFiscal.html`, con respuestas ficticias y red externa interceptada: 390/820/1440 px y ambos temas; el error fiscal antiguo conserva filas visibles, textos, revisión y motivo; actualizar desmarca sin borrar propuestas; reintentar contra respuesta ficticia corregida confirma el lote y refresca. Se comprobó que el cliente envía solo partes nominales y metadatos, con el fiscal antiguo únicamente dentro del testigo original. Sin ejecución SQL ni llamadas reales a Supabase.
