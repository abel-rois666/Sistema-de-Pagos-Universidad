# Personal y ficha docente compartida

Preparado el 08/11/2026. SQL autorizado para preparación, **sin ejecutar en Supabase**, sin fusiones ni cambios de registros reales. No publicar como instalación comprobada: faltan el preflight del entorno y ensayos de las funciones con sesiones reales.

## Estructura y fuente de datos

- `personal_personas`: identidad y contacto compartidos, con revisión para concurrencia. Conserva el nombre completo histórico; nombres/apellidos desglosados se capturan explícitamente, nunca se infieren dividiendo palabras.
- `personal_vinculos_laborales`: varias funciones/contrataciones por persona, fechas conocidas o pendientes, jornada, horas contratadas y observaciones. Archivar conserva el antecedente.
- `personal_formacion`: varias formaciones, institución, situación, cédula y fecha cuando existen; máximo una formación principal no archivada. No cambia las abreviaturas institucionales de firmantes.
- `personal_expedientes`: estados documentales, requisitos revisados y enlace de carpeta. No sube, publica ni concede acceso a archivos de Drive.
- `personal_auditoria`: motivo, actor, sección y valores anteriores/posteriores de las operaciones nuevas, de acceso privado.
- `docentes.persona_id` y `empleados.persona_id`: enlaces opcionales y únicos por directorio. Una persona puede tener ambos perfiles, uno solo, varios vínculos y varias formaciones. No se obliga a crear un empleado administrativo para completar a un docente.

Los datos de cada sección se almacenan como objetos JSON validados por la RPC dentro de tablas separadas por dominio. No se aceptan escrituras directas de clientes en las cinco tablas nuevas. No se guardan contraseñas, evaluaciones NOM-035, firmas ni autorizaciones de firmante en ellas. Las tablas operativas, IDs, claves, usuarios y relaciones académicas se conservan.

## Flujo

1. Abrir la ficha no crea ni relaciona registros. Los directorios existentes ofrecen referencias, sin convertir fechas de captura en ingreso, contratos o titulaciones.
2. Revisar y guardar Datos generales inicia el perfil común. Los docentes nuevos se crean junto con su identidad mediante una sola RPC, conservando el UUID del intento; no se crean contratos vacíos.
3. Agregar vínculos y formaciones acreditados. Las fechas desconocidas quedan vacías; nunca se completa una fecha actual por omisión.
4. Definir los documentos requeridos para la función y contratación revisadas. No se inventa una política institucional de documentos: Administración selecciona los requisitos aplicables a cada expediente. Los estados son Sin registrar, Pendiente, Entregado, Revisado y No aplica. Este último exige motivo y se excluye del denominador. Sin requisitos definidos no se presenta un porcentaje ficticio de completitud.
5. Configurar disponibilidad y materias con el componente existente, su selector de ciclo local y su propio guardado. Las horas contratadas y jornada laboral no modifican límites del generador.

La edición se realiza por sección, con motivo y control de revisión. Cambiar de sección, cerrar o navegar con datos modificados requiere confirmación propia. Fallar el guardado conserva la captura; no se reintenta como escritura directa cuando la RPC falla. Guardar no cierra automáticamente la ficha, para poder completar otras secciones.

## Relacionar directorios existentes

Administración busca candidatos por nombre/RFC/CURP. La coincidencia solo es una ayuda: requiere seleccionar un registro, revisar identificadores, confirmar que es la misma persona y escribir un motivo. La revisión indica que los nombres e identificadores del directorio administrativo serán la referencia común; sus campos vacíos no borran datos conocidos. Se conservan ambos IDs y sus funciones. Dos expedientes comunes distintos no se fusionan desde este flujo: se bloquean para revisión individual. Tampoco se sustituye una relación con otro registro del mismo directorio.

No hay relación automática durante la migración ni al abrir una ficha. Las diferencias de nombres se resuelven con la revisión explícita. Los cambios comunes se reflejan en los campos legados compatibles mediante triggers solo para registros relacionados; no se propagan estatus docentes a situaciones administrativas. Un cliente antiguo que intente cambiar el nombre completo de una identidad con nombres estructurados recibe una indicación de usar la ficha compartida.

## Permisos conservados

| Operación | Administración | Coordinación Académica | Recursos Humanos |
| --- | --- | --- | --- |
| Datos generales de docente | Editar | Editar | Consultar |
| Datos generales de empleado | Editar | Sin acceso | Consultar |
| Formación docente | Editar | Editar | Consultar |
| Vínculos y expediente | Editar | Sin acceso | Consultar |
| Relacionar directorios | Sí | No | No |
| Habilitación, disponibilidad y materias | Sí | Sí | No |

No se amplía la edición de RH, que en el flujo anterior era de consulta. Su área añade el acceso a las fichas docentes mediante una RPC de lectura paginada. Caja, Control Escolar y el usuario DOCENTE no reciben acceso nuevo. Firmantes y NOM-035 conservan sus flujos y permisos actuales. Las políticas del resto del servidor no se consideran auditadas por esta migración.

## Compatibilidad y despliegue

1. Ejecutar únicamente `supabase/checks/preflight_personal_y_docentes_20261108.sql` y revisar tablas, columnas y triggers. Los faltantes deben estar vacíos; las tablas nuevas no deben existir antes de una instalación inicial. Una instalación previa/parcial requiere revisar su estado antes de volver a ejecutar SQL.
2. Revisar y respaldar el entorno antes de aplicar `supabase/migrations/20261108120000_personal_y_docentes.sql`. Es una transacción aditiva, sin backfill, borrados ni fusiones. **No fue ejecutada por este agente.**
3. Ejecutar `supabase/checks/verificar_personal_y_docentes_20261108.sql`: cinco tablas con RLS y sin acceso directo de anon/authenticated; cinco RPC públicas ejecutables por authenticated y nunca anon; cinco helpers privados no ejecutables por clientes; enlaces y triggers presentes.
4. Ensayar alta docente, guardado por sección, concurrencia, roles y una relación revisada. Comprobar que firma, NOM-035, asignaciones, calificaciones y horario publicado conservan datos. No hacerlo por primera vez con una relación real de identidad que aún no fue revisada.
5. Publicar el cliente después de validar el servidor. Si falta la RPC por ausencia de actualización, el cliente conserva la consulta y edición de contacto docente y el acceso a horarios; el alta y el cambio de nombres requieren las dos migraciones de Personal para persistir el desglose; Empleados utiliza su ficha anterior. Un 403, un fallo de red o un error de validación **no** se interpretan como migración ausente.

Los empleados todavía sin perfil común conservan su ficha anterior completa; Administración puede abrir voluntariamente la ficha ampliada para revisarla e iniciarla. En empleados relacionados, el editor anterior abre directamente configuración institucional/firmantes y conserva la edición del cargo y área de referencia utilizados por firmantes y NOM-035; la identidad, vínculos, formación y documentos se editan en la ficha compartida. Las referencias laborales y de estudios legadas siguen disponibles. El guardado administrativo comprueba el enlace actual para impedir que una ventana antigua sobrescriba datos comunes después de una vinculación.

Los enlaces de Drive requieren su configuración y permisos externos habituales. No se verificaron OAuth, políticas instaladas ni operaciones SQL reales. El 911 conserva su diagnóstico de posibles duplicados y sus expedientes/versiones: esta entrega no reescribe ni recalcula cifras cerradas.


## Nombres y apellidos como captura única (08/11/2026)

La ficha compartida muestra Primer apellido, Segundo apellido (opcional) y Nombre(s). No hay un campo editable de nombre completo ni un segundo flujo desplegable. El nombre de consulta se deriva en el orden existente de los directorios: apellidos y nombres. No se alteró la captura de Alumnos ni la captura administrativa de Empleados, que ya separaban estos campos.

Un docente histórico sin desglose conserva su nombre registrado como referencia. Puede corregirse el contacto dejando vacíos los tres campos; el servidor conserva el nombre anterior aunque el cliente envíe otra cadena completa. Si se empieza a capturar el desglose, se requieren primer apellido, nombres y confirmación de revisión. No se separan automáticamente partículas, apellidos compuestos ni nombres; tampoco se infieren desde CURP. Un nombre ya estructurado no puede vaciarse para volver al flujo antiguo.

Guardar el desglose conserva el nombre anterior, fecha, actor y fuente en `personal_personas` y un evento de auditoría con antes/después. La relación explícita con Empleados conserva también el nombre docente previo y registra la fuente RELACION_REVISADA; no busca ni vincula por nombre de forma automática. Los IDs, claves, cuentas, contratos, asignaciones y horarios mantienen sus referencias.

### Regularización por lotes

En Gestión de Docentes, Administración y Coordinación Académica disponen de Revisar nombres. Lista solo pendientes, ordenados alfabéticamente y paginados de 15 en 15. Cada fila conserva su nombre y clave, permite escribir las tres partes y debe marcarse Revisado. Cambiar una parte revoca esa marca. La captura se conserva entre páginas y búsquedas; se confirman como máximo 50 docentes por lote, con motivo y confirmación propios.

Exportar página XLSX entrega únicamente ID, clave, nombre registrado, revisión y las tres partes. Importar propuestas XLSX admite la plantilla de la página consultada, hasta 50 filas y 2 MB; rechaza fórmulas, IDs repetidos, nombres/revisiones cambiados y desgloses incompletos. Primero presenta vista previa. Cargar la propuesta no marca Revisado ni escribe en Supabase; el responsable revisa cada fila antes de guardar. No se exportan contactos, RFC, CURP ni datos laborales.

El servidor verifica permisos, revisión, originales y duplicados por ID. Un conflicto o una fila inválida revierte todo el lote y conserva la captura en pantalla. No se guardan filas no revisadas ni se fusionan identidades.

### Orden de instalación de esta ampliación

1. Si todavía falta la base de Personal, aplicar primero su preflight, `20261108120000_personal_y_docentes.sql` y su verificación, descritos arriba. No repetir una migración instalada.
2. Revisar `supabase/checks/preflight_nombres_personal_20261108.sql`. Deben existir las tablas y las RPC base; las cuatro columnas de nombres y las funciones de esta ampliación deben estar ausentes antes de la instalación inicial.
3. Aplicar `supabase/migrations/20261108150000_nombres_estructurados_personal.sql` y después `supabase/checks/verificar_nombres_personal_20261108.sql`. Los dos helpers base deben ser privados, ninguna RPC ejecutable por anon y las públicas ejecutables por authenticated (con autorización interna).
4. Validar roles y casos de prueba antes de publicar el cliente. Sin la ampliación instalada los nombres se consultan y el contacto se conserva, pero no se ofrece una captura ficticia que pierda el desglose al recargar.

No se aplicaron estas migraciones en Supabase. Las pruebas SQL autorizadas utilizan únicamente PostgreSQL local desechable y registros ficticios; no equivalen a verificar triggers y permisos del proyecto instalado.


## Ficha única y funciones administrativa/docente (08/11/2026)

El marco de consulta es único cuando está instalada la base de Personal, incluso para empleados que todavía no iniciaron su identidad compartida. Se retira la elección «ficha anterior / ficha ampliada». Las referencias administrativas anteriores permanecen en Datos laborales y Datos académicos; las entregas documentales se conservan sin convertir automáticamente todo el catálogo en requisito. Solo la ausencia de toda la base RPC mantiene la ficha anterior como compatibilidad, sin ofrecer una segunda ficha elegible.

La navegación incluye Datos generales, Datos laborales, Datos académicos y Expediente. Añade Configuración institucional si hay registro administrativo y permiso de consulta privada; Docencia si hay registro docente; y Funciones de la persona para Administración. Compartir identidad no abre la información privada a Coordinación Académica.

Configuración institucional integra cargo/clave, área, situación administrativa, autorizaciones de certificados/títulos/boletas, abreviatura y firma. Conserva los códigos de puestos, los cupos (un firmante de certificados, dos de títulos) y los cargos permitidos. La formación no sobrescribe la abreviatura. La firma nueva admite PNG/JPEG/WebP hasta 500 KB, se conserva en la captura hasta guardar y bloquea salida/guardado mientras se lee. El cargo y área siguen en empleados, usados por NOM-035 y documentos. Los contratos y antecedentes laborales no se convierten ni se borran.

Docencia integra la clave de lectura, habilitación y acceso al configurador de disponibilidad/materias existente. Funciona al abrir desde cualquiera de los directorios. La habilitación no modifica el estatus administrativo; editar el estatus administrativo tampoco habilita docencia. Añadir una función no concede una cuenta ni cambia las autorizaciones de usuarios.

### Alta sin duplicar identidad

Administración utiliza búsqueda previa desde Registrar Empleado y Nuevo Docente. Busca al menos tres caracteres por nombre o clave, muestra funciones existentes y pagina diez coincidencias. Cada coincidencia abre su misma ficha. «Es otra persona» solo permite continuar al alta independiente después de consultar la búsqueda actual. No se une por coincidencia de nombres, y los registros inactivos también se consideran para evitar nuevas altas innecesarias. Coordinación Académica conserva su alta docente independiente y no obtiene acceso al directorio administrativo.

En Funciones de la persona, Administración puede añadir la función faltante con revisión explícita y motivo. Docencia exige clave única y habilitación elegida; la función administrativa exige nombres estructurados, se inicia con la situación elegida y sin contratos, fechas, firmas ni autorizaciones inventadas. La operación reutiliza o inicia la identidad de la fuente, conserva sus IDs y añade únicamente el registro operativo faltante. El UUID del intento se conserva al reintentar tras pérdida de respuesta. La operación verifica revisión y original, es transaccional y audita la función. Una función ya existente no se duplica.

Si ambas entradas ya existen, abrir el docente y usar «Relacionar con un registro administrativo existente» en Datos generales. Esa operación mantiene su revisión y bloqueo de dos identidades compartidas distintas: no se fusionan expedientes iniciados por separado desde el alta de funciones.

### Instalación de la ficha única

Preparación autorizada, sin ejecutar en Supabase ni modificar información real. Requiere, en orden, las migraciones 20261108120000 y 20261108150000 ya descritas. Si están instaladas, no repetirlas.

1. Revisar `supabase/checks/preflight_ficha_unica_personal_20261108.sql`: columnas y funciones base completas; las RPC nuevas deben estar ausentes antes de la primera instalación. Revisar cupos de firmantes existentes antes de cambios; el SQL no corrige datos previos automáticamente.
2. Aplicar `supabase/migrations/20261108180000_ficha_unica_y_funciones_personal.sql`.
3. Revisar `supabase/checks/verificar_ficha_unica_personal_20261108.sql`: cinco RPC nuevas, SECURITY DEFINER con search_path fijo, ninguna ejecutable por anon; helpers privados sin ejecución de authenticated. Las RPC verifican el rol y la revisión internamente.
4. Ensayar con datos ficticios los casos de añadir función en ambas direcciones, reintento de UUID, duplicado, conflicto de revisión, cupos de firmantes, permisos, cuenta sin crear y conservación de referencias operativas. Esta nueva migración no se ejecutó ni se probó contra el motor SQL en esta entrega; las pruebas de interfaz usan respuestas simuladas.
5. Desplegar el cliente después de validar el servidor. Sin esta ampliación, la ficha conserva la lectura y los flujos base; el alta con búsqueda y las operaciones integradas de funciones/configuración requieren instalarla. No interpretar errores de permiso o red como ausencia del servidor.
