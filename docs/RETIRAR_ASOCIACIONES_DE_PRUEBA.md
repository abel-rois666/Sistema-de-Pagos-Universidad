# Retirar asociaciones académicas de prueba

Preparado el 09/11/2026. **No se ejecutó SQL ni se modificaron datos reales.**

## Uso desde la ficha

En **Trayectoria e inscripciones → Programas del alumno → Revisar asociación errónea**, Administración puede activar **Revisar materias vacías y certificaciones creadas como prueba**. La revisión normal continúa bloqueando cualquier antecedente; la ampliación es explícita y sirve para cualquier alumno y plan, identificados por UUID.

La pantalla muestra las materias vacías y el número de certificaciones asociadas. Se revisa el programa concreto; el usuario debe comprobar el alcance, escribir un motivo de 10–1000 caracteres, marcar la confirmación y escribir **RETIRAR PRUEBA**. Cambiar de modalidad o actualizar la revisión exige confirmar nuevamente. Cerrar con captura solicita descartar. Un error conserva el motivo y requiere revisión actualizada.

### Materias

Solo se permite depurar registros sin parciales, promedio, final u observación de certificación; sin observaciones manuales ni ciclo legado; sin edición manual, bloqueos o solicitudes; de evaluación ordinaria y estado vacío, Cursando o Sin evaluar (`SIN_EVALUAR`), admitiendo en `observaciones` únicamente vacío o las etiquetas automáticas de generación/sincronización sin notas (`Carga inicial`, `Carga de reinscripción`, `Importado de GES 4`). **0 y NP son calificaciones y bloquean.** Una columna desconocida bloquea hasta revisar su significado. Se guardan las filas completas antes de retirarlas de la tabla operativa. No se borran asignaturas del catálogo ni se trasladan notas a otro plan.

También se revisan las instantáneas anteriores y posteriores de `operaciones_academicas_auditoria`, si está instalada, y de `certificacion_auditoria`. Una nota o evidencia protegida eliminada de la captura actual sigue bloqueando si aparece en esas auditorías. Esto no reconstruye cambios antiguos que nunca fueron auditados; la declaración explícita de Administración sigue siendo necesaria.

### Certificaciones

Solo se permite declarar de prueba fichas sin fechas de trámite, cierre, enlace documental, notas de documentos ni campos desconocidos. El pago y los estados documentales son declaraciones manuales y se muestran en la ficha de certificación; su existencia no prueba por sí sola una emisión oficial. Administración debe revisarlos antes de declararlos de prueba. Si hay evidencia real, no utilizar esta operación.

Las fichas se conservan **archivadas y sin asociación operativa**, con instantáneas antes/después y motivo en las auditorías. No se trasladan ni sobrescriben fichas del programa correcto. Solo una ficha descartada por esta operación y todavía idéntica a su instantánea deja de bloquear futuras revisiones como antecedente sin identificar; archivar una ficha por el flujo normal sigue sin liberar una asociación.

### Antecedentes que siguen bloqueando

Principal, logro concluido, falta de un único principal, grupos, inscripciones por ciclo, ingreso acreditado, preparaciones, 911, titulaciones y otras referencias permanecen protegidos. También bloquea cualquier dependencia de las filas de materias o certificaciones que se depurarían, incluso con CASCADE o SET NULL. Las relaciones compuestas requieren revisión individual. No hay reasignación ni depuración masiva automática.

Pagos, recibos, monedero, catálogo de planes, programa principal y antecedentes de otros programas no se actualizan. El trigger institucional existente sigue activo. No convierte en datos de prueba los registros solo por pertenecer a un plan anterior.

## Servidor y auditoría

La migración `20261109220000_retirar_asociaciones_de_prueba.sql` añade dos RPC, clasificadores privados y una tabla privada con RLS. La auditoría no añade FK hacia alumno/programa que cambien su eliminación preexistente. Exige una sesión con un único perfil activo de Administración.

Al confirmar se bloquean alumno, asociaciones, materias y fichas, se comprueba la huella con los registros completos y las referencias, se guarda el respaldo, se archivan/desasocian las fichas y se retiran únicamente las materias vacías. El retiro final utiliza la RPC y el trigger de protección existentes. Todo ocurre en una transacción: una FK, trigger, cambio concurrente o rechazo final revierte también la depuración y sus auditorías. Los bloqueos tienen espera máxima de tres segundos; no se amplían tiempos de consulta.

La adaptación de la revisión previa se limita a la consulta de certificaciones sin programa y exige reconocer esa consulta antes de sustituirla. Una instalación distinta aborta para revisión. No elimina la protección general ni sus permisos.

## Instalación pendiente

Si la modalidad está activa, las certificaciones protegidas muestran cero pero el retiro sigue bloqueado, revisar los demás antecedentes. `Materias vacías: 0` no prueba la existencia de notas: el clasificador también rechaza estados, referencias históricas, marcas y columnas desconocidas. La consulta de solo lectura `supabase/checks/diagnostico_materias_bloquean_retiro_prueba.sql` permite introducir localmente la matrícula y obtener cuatro filas con resultado de búsqueda, clasificador instalado, conteos y causas agrupadas por campo, sin nombres, valores de notas ni texto de observaciones. Consulta todos los programas de la matrícula, sin exigir la clave 2001_LD, e ignora diferencias de mayúsculas/espacios solo al buscar. No modifica identificadores. Un resultado vacío no equivale a ausencia de antecedentes: comprobar primero `0_resultado_busqueda`; si hay varias coincidencias no elegir automáticamente. No retirar esas protecciones ni vaciar campos sin revisar el resultado.

1. Revisar `supabase/checks/preflight_retiro_pruebas.sql` (solo lectura): esquema, columnas, funciones, FK y triggers. El SQL Editor puede mostrar solo el último resultado; ejecutar cada SELECT por separado y conservar todos. Si hay triggers adicionales, revisar sus reglas antes de instalar.
2. Requisitos previos: certificación por programa (`20261109120000`) y retiro seguro (`20261109210000`) instalados y verificados. No volver a instalar migraciones ya aplicadas. Las vistas privadas y la corrección de folios son independientes.
3. Ensayar la migración nueva en una copia de pruebas y comprobar permisos, concurrencia, rollback y los casos con un programa correcto y otro de prueba. La autorización de esta entrega es preparar; estas pruebas SQL no se ejecutaron.
4. Aplicar completa `supabase/migrations/20261109220000_retirar_asociaciones_de_prueba.sql`.
5. Ejecutar por separado las consultas de `supabase/checks/verificar_retiro_pruebas.sql`: dos RPC sin acceso anónimo, autenticadas y con search_path fijo; los ejemplos ficticios de clasificación deben devolver todos `criterio_correcto=true`. No eliminan registros. No sustituyen las pruebas transaccionales.
6. Publicar el cliente después de verificar el servidor. Sin la nueva RPC, solo falla la modalidad de prueba con un aviso de actualización; el retiro normal conserva su funcionamiento.

## Verificación del cliente

Ensayo ficticio: `scripts/ensayoDisenoHistorial.html?retiro&retiro-certificado`; todas las peticiones externas están interceptadas y no se abren canales reales. `oscuro` cambia el tema, `retiro-notas` bloquea por notas, `retiro-evidencia` protege la ficha, `retiro-desactualizado` simula conflicto y `sin-retiro` simula función ausente. El retiro del ensayo solo modifica un arreglo ficticio.

Las pruebas en `tests/retiroAsociacionesPrueba.test.ts` verifican contratos del SQL preparado: campos protegidos, evidencia, respaldo antes de depuración, revisión/confirmación, conservación de certificados y ausencia de escrituras financieras. Son comprobaciones de fuente; **no ejecutan PostgreSQL ni acreditan seguridad del servidor instalado**.

Resultado local: tipado y compilación aprobados, con aviso previo de paquetes grandes; 392 pruebas aprobadas. Ensayo del cliente con retiro normal bloqueado por certificado, modo de prueba con 53 filas vacías ficticias, confirmación obligatoria y actualización de la ficha conservando el principal. Notas y evidencia siguen bloqueando en el ensayo. Comprobados descarte de captura, diálogo oscuro de escritorio/tableta y móvil en ambos temas (390/820/1280 px, según escenario), sin desbordamiento general observado; sin errores de consola en el ensayo final. No se probó la transacción en PostgreSQL, no se modificaron datos reales ni se publicó código.
