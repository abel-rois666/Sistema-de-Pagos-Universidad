# Exportación del Listado General

El botón CSV abre la elección de contenido. La pantalla, los filtros guardados, el PDF y la impresión conservan su funcionamiento. No requiere nuevas migraciones ni modifica datos.

## Reporte de Egresados y Titulados

El mismo diálogo se utiliza desde **Reporte de Egresados → CSV**, identificado con su propio título y nombres de archivo. Conserva la población base del reporte y sus filtros de ciclo de egreso, licenciatura y segmento; exporta todos los alumnos filtrados en el orden elegido, incluido el agrupamiento por ciclo, y no solo la página visible. No incorpora alumnos que el reporte excluyó ni cambia el cálculo existente.

El formato por alumno mantiene sus columnas visibles y presentación anterior. El detalle académico incorpora los programas de esos alumnos con su propio estatus, incluso si alguno todavía está cursando. No convierte automáticamente todos los programas en egresados. El ciclo calculado actualmente a partir del último periodo del historial del alumno se rotula **Último ciclo del historial del alumno (referencia)** dentro del detalle. No se presenta como fecha/ciclo de egreso acreditado de cada carrera. Las fichas anteriores sin programa se mantienen separadas.

Los planes de pagos de titulación conservan su archivo independiente y sus ciclos financieros. No se asignan a un plan de estudios por coincidir con el ciclo del reporte. Los detalles pueden incluir IDs y combinarse en ZIP con `programas_academicos.csv` y `planes_pagos_titulacion.csv`. PDF e impresión conservan el formato por alumno; no se añadió un PDF por programa.

La consulta compartida avanza por la cantidad efectivamente recibida hasta una página vacía para evitar truncar datos cuando el servidor impone un límite menor a 500. Mantiene lotes acotados, cancelación y rechazo de errores, sin descargar detalles académicos parciales.

## Opciones

- **Listado por alumno:** formato anterior, una fila por persona con columnas visibles y estados resumidos como texto.
- **Detalle por programa académico:** una fila por asociación `alumno_programas.id`. Carrera, clave y nombre del plan, periodicidad, modalidad, estado curricular y marca principal tienen columnas propias. Pago y trámite del certificado pertenecen a la misma ficha activa del programa. Se exportan ambos estados aunque solo uno esté visible en pantalla; el resumen financiero de titulación se excluye.
- **Planes de pagos de titulación:** una fila por `planes_pago.id`, con matrícula, nombre, número de plan, ciclo, periodicidad del ciclo, categoría y resumen del pago. No se infiere una relación con programas académicos. Planes distintos con igual número se conservan.
- **Ambos detalles en ZIP:** dos CSV independientes con el mismo conjunto de alumnos. Si no hay planes financieros, su CSV contiene únicamente las cabeceras.

Los detalles pueden incluir IDs mediante una opción explícita. No son nuevas claves de base de datos. Los CSV llevan BOM UTF-8, escape de comillas y protección de valores que puedan interpretarse como fórmulas. CSV no define tipos: al importar en Excel, seleccionar texto para matrículas/IDs para conservar ceros iniciales.

## Alcance y estados ausentes

Se parte de todos los alumnos filtrados y ordenados, no únicamente la página ni la selección de la herramienta de pago masivo. Los filtros son de alumnos: el detalle incluye todos sus programas y todos sus planes de pagos de titulación, incluso de otros ciclos. No se aplica un filtro de estado como si seleccionara una única asociación académica. El ciclo de referencia del padrón no reconstruye estados históricos.

`ALUMNO_PROGRAMA` identifica una asociación real. `FICHA_SIN_PROGRAMA` conserva una ficha anterior activa en una fila independiente con programa vacío; nunca se copia a las carreras del alumno. `ALUMNO_SIN_PROGRAMA` conserva a una persona sin asociaciones ni fichas, sin inventarlas. «Sin registro» indica ausencia de ficha, mientras «Sin iniciar» pertenece a una ficha existente. Las fichas archivadas no aportan estados al resumen activo.

La consulta usa tablas/relaciones ya existentes para datos estructurados de programas y la RPC autorizada `certificacion_resumen_v1` para certificaciones, sin modificarla ni dividir descripciones concatenadas. La RPC debe estar instalada; si no está, se bloquea únicamente el nuevo detalle académico. No se implementa compatibilidad que atribuya fichas legadas. Ante lectura fallida, desalineación entre consultas o asociaciones duplicadas se pide actualizar y no se descarga un detalle parcial. Son lecturas independientes, sin garantía de una instantánea transaccional del servidor.

El diálogo conserva la consulta seleccionada al abrirse, admite cerrar/cancelar la lectura, y permite actualizarla ante fallos. La descarga es local; no se guarda ni comparte una copia en servidor. Se mantienen RLS y permisos existentes; la visibilidad del botón no sustituye autorización del servidor.

Ensayo de Egresados: `scripts/ensayoExportacionEgresados.html` prepara 54 alumnos elegibles (50 por página), uno excluido, múltiples programas, una ficha anterior y dos planes de pagos del mismo alumno. Consultas externas interceptadas. Se verificaron en navegador el conjunto completo y el filtrado por ciclo/segmento, orden descendente, estados separados, CSV anterior, ZIP, respuesta fallida del detalle sin archivo parcial, Escape y retorno del foco. Tamaños 390/820/1440 px y temas claro/oscuro; también se comprobó que el diálogo del Listado General mantiene su formato. Se inspeccionaron los Blob generados; el guardado final en disco del navegador y los permisos/datos instalados de Supabase siguen pendientes. No se ejecutó SQL ni se publicó código.

## Verificación

Pruebas ficticias en `tests/detallesListadoCSV.test.ts`: varios programas con estados diferentes, ausencia frente a pago no iniciado, ficha sin asociación, alumno sin programa, conflictos de lectura, IDs y folios repetidos, abonos/facturas, escape CSV, lotes/paginación, cancelación y fallos sin resultados parciales. La ejecución contra Supabase y la comprobación de permisos instalados requieren verificación independiente.

Ensayo aislado reproducible en `scripts/ensayoExportacionListado.html`: respuestas ficticias, sin escrituras externas. Revisado en 390/820/1440 px, claro y oscuro, sin desbordamiento general; Escape y retorno del foco al botón de apertura. Se comprobaron los contenidos de los Blob de CSV académico, financiero y listado anterior, y los dos CSV dentro del ZIP; ante fallo académico se bloquea ese detalle y permanecen accesibles las otras modalidades. El navegador del entorno bloqueó el guardado en disco: se verificó la generación mediante captura de Blob, no el guardado final en el equipo del usuario. No se consultó Supabase.
