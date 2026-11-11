# Certificación por programa y seguimiento en reportes

Preparación autorizada el 09/11/2026. No se ejecutó SQL ni se modificaron registros reales.

## Datos y estados

`ficha_certificacion.alumno_programa_id` identifica la asociación académica exacta, no la carrera por nombre ni el programa marcado Principal. Solo hay una ficha activa por programa. Las fichas existentes permanecen sin asociación: no se copian, descartan ni asignan automáticamente. Administración debe elegir el programa y describir el respaldo; si el destino ya tiene ficha activa, se rechaza el traslado. Una ficha asociada no puede cambiarse a otro programa.

Al guardar una asociación, la consulta permanece en el programa confirmado. Si se vuelve a abrir un acceso anterior y ya no existe ficha sin asociar, se presenta la ficha del programa seleccionado (o se solicita elegir un programa), sin mostrar un falso conflicto con la propia ficha. Solo otra certificación en el destino bloquea la asociación de una ficha anterior. La corrección de esta visualización no requiere una nueva migración ni reasociar el registro.

## Consulta e identificación de fichas pendientes

Ampliación preparada el 10/11/2026: [asociación masiva de fichas pendientes](ASOCIACION_MASIVA_CERTIFICACIONES.md), con programa único propuesto, selección y auditoría. Requiere la migración independiente `20261110010000`; no asocia al instalar ni utiliza el guardado general para cerrar programas.

La sección principal muestra exclusivamente la certificación del programa elegido. Si no existe, indica «Este programa aún no tiene un registro de certificación». Un aviso independiente identifica la certificación anterior pendiente, sin atribuir sus estados al programa consultado. Iniciar registro solo aparece cuando no existe ficha del programa ni una ficha anterior pendiente, conservando el bloqueo existente del servidor.

«Revisar y asignar programa» abre un diálogo separado con los datos anteriores en lectura y la marca «Programa pendiente de identificar». Se elige el destino exacto, se registra respaldo y se confirma la revisión. «Asignar a este programa» utiliza la misma RPC de guardado: preserva ID, revisión, documentos, pago, fechas y expediente, cambiando únicamente la asociación. El servidor vuelve a validar permiso, alumno, revisión, requisitos y destino ocupado. No se añade SQL ni se amplían permisos. Al concluir se abre el programa confirmado y el foco pasa a Editar certificación. Un fallo conserva el destino y el respaldo dentro del panel.

Cerrar una revisión con captura requiere confirmar su descarte; consultar o cerrar sin cambios no escribe. La consulta muestra valores; los controles aparecen al pulsar Editar certificación. Archivo queda en Más opciones, identificado como ficha anterior sin programa o certificación del programa consultado, y conserva motivo y confirmación propios. Control Escolar dispone de consulta del panel sin campos de asignación ni acciones de mantenimiento.

Pago del certificado conserva SIN_INICIAR / EN_CURSO / COMPLETADO como declaración manual, independiente de recibos y del pago de titulación. Trámite distingue Sin registro, En preparación (ficha sin fecha de inicio), En trámite (fecha de inicio registrada) y Completado (conclusión explícita). La captura sin guardar se indica y no afecta el reporte.

Reabrir conserva pago, revisión documental, tipo, fechas y enlace digital; solo revoca conclusión y fecha de completado. Al guardar se validan cronología, requisitos y pertenencia del programa en una sola transacción, con control de revisión y auditoría. Un certificado PARCIAL conserva el estatus académico; un TOTAL completado cierra únicamente el programa elegido si está CURSANDO o ACTIVO. No degrada programas titulados, ni modifica otros programas, planes, recibos o monedero. El trigger institucional instalado calcula el estado general; se debe verificar su definición antes de instalar.

Archivar reemplaza el antiguo borrado total: exige motivo, conserva ficha y auditoría y la retira del seguimiento activo. No revierte un egreso. La auditoría conserva instantáneas sin una FK restrictiva hacia la ficha para no bloquear el flujo previo de eliminación de alumnos; la nueva relación académica usa NO ACTION para permitir que la eliminación del alumno complete ambas cascadas en la misma sentencia. El SQL no borra ni reasocia registros durante su instalación. Los cambios históricos de estatus realizados por versiones anteriores no se revierten automáticamente.

## Reportes y navegación

Egresados y Listado General ofrecen Pago de titulación, Pago del certificado y Trámite de certificación como columnas independientes, también en CSV/PDF. Varias certificaciones se rotulan por programa; la anterior sin asociación se rotula como tal. Con varios planes de Titulación se muestran sus ciclos y folios sin elegir el primero del almacén; su asociación a un programa no se inventa porque el plan financiero no dispone de ese vínculo. El filtro de ciclo del padrón conserva su significado previo y no convierte el trámite actual en una reconstrucción histórica.

Nombre abre Datos Generales, pago de titulación abre una consulta del plan exacto, y las dos columnas de certificado abren Certificación en el programa correspondiente. Volver conserva filtros, orden y página; guardar/archivar actualizan el seguimiento; volver de una consulta no fuerza otra descarga. Listado General carga certificaciones solo al elegir esas columnas, en lotes acotados y cancelables. Carga o error bloquean la exportación de esos valores: una consulta fallida nunca representa Sin registro.

Administración conserva edición de Certificación. Control Escolar puede consultar desde los reportes, sin edición; los demás roles no reciben acceso. Las funciones SQL verifican usuario activo y rol; las escrituras directas de esta tabla se sustituyen por funciones transaccionales. Esto no audita políticas de otras tablas o módulos.

Titulación consulta la certificación de su `alumno_programa_id`, sin heredar la de otro programa ni la ficha anterior sin asociar. Su evaluación financiera utiliza el mismo intérprete de folios y abonos del reporte; no acredita abonos parciales como liquidación.

## Instalación separada

1. Resguardar el esquema y los datos según el procedimiento institucional. Ejecutar `supabase/checks/preflight_certificacion_por_programa_20261109.sql`, solo lectura, en el proyecto correcto.
2. Revisar columnas, índices únicos, políticas, triggers de certificación y de estatus institucional. Si difieren del esquema documentado, detener la instalación y contrastar antes de continuar. Las fichas históricas inconsistentes se revisan individualmente: la migración no las reescribe.
3. Aplicar `supabase/migrations/20261109120000_certificacion_por_programa.sql` como una transacción. Requiere las tablas existentes y el trigger institucional de programas. No se aplica automáticamente con el despliegue de Hostinger.
4. Ejecutar `supabase/checks/verificar_certificacion_por_programa_20261109.sql`: escritura directa y lectura anónima false; funciones públicas solo authenticated; auxiliares sin ejecución directa; cero asociaciones de otro alumno y cero duplicados activos por programa. Antes de asignar fichas, el total sin asociar debe coincidir con las fichas previas.
5. Publicar el cliente junto con el contrato nuevo. Sin estas funciones conserva consulta de fichas anteriores y reportes, pero no habilita escrituras ni interpreta un error de permisos/red como ausencia de migración. Los clientes antiguos no pueden seguir escribiendo directamente tras instalarla: coordinar actualización/recarga.
6. Verificar con sesiones autorizadas Administración y Control Escolar. No crear ni archivar fichas reales como prueba sin autorización. Los ensayos del repositorio interceptan la red y no validan las políticas instaladas.

No basta con revertir el cliente para revertir el SQL. Las fichas por programa son un cambio deliberado del contrato: conservar las definiciones previas y revisar la recuperación antes de instalar.

## Verificación local

Tipado, compilación y 327 pruebas aprobados; se conserva el aviso previo de paquetes grandes. La revisión visual de ambos reportes y Certificación cubrió 390/768/1440 px, claro y oscuro. El ensayo de red interceptada comprobó aperturas contextuales, conservación de página, guardado ficticio, reapertura sin borrar requisitos, conflicto con captura conservada, confirmación de salida/recarga, bloqueo de asociación a un programa ocupado, lectura compatible sin RPC y consulta sin edición por Control Escolar. No acredita la instalación SQL ni sus permisos reales. El PDF del Listado se comprobó con 32 alumnos ficticios y las nuevas columnas, incluyendo divisiones de página sin separar filas. Las comprobaciones SQL están preparadas, sin ejecutar.
