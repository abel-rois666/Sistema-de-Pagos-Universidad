# Consulta de pagos desde el Listado General

Acceso: Reportes Escolares → Listado General → **Consultar pagos y recibos**. La consulta es de lectura para Administración, Control Escolar y Coordinación Financiera, dentro de los accesos que ya tengan al módulo. La base conserva sus políticas: la interfaz no concede permisos.

## Alcance y navegación

- Sin selección, consulta todos los alumnos filtrados/ordenados, no solo la página visible.
- «Elegir alumnos para consultar» habilita casillas propias. Marcar todo abarca solo la página visible; los elegidos permanecen entre páginas/filtros y pueden revisarse o quitarse antes de consultar. No se confunden con la selección administrativa de actualización masiva del certificado (máximo 50).
- Solo se muestra un tipo de casillas a la vez; cambiar entre consulta y actualización conserva ambas selecciones, con sus acciones identificadas por separado.
- «Consultar pagos» junto al nombre consulta a una persona.
- El diálogo conserva una copia del alcance al abrir. Volver mantiene listado, página, filtros y selección. Cerrar cancela las lecturas. Diez alumnos por página en el detalle; exportar incluye todo su alcance.
- El contenido puede ser Certificados, Titulación o ambos. El filtro de ciclo del padrón selecciona personas; los recibos se buscan por alumno en **todos los ciclos**, porque su ciclo contable puede diferir del del plan.

## Fuentes y límites

Certificados: estados actuales de pago y trámite mediante `certificacion_resumen_v1`, por asociación académica y sin fichas archivadas. Los recibos no están vinculados directamente con la ficha: se muestran una vez por detalle del alumno, sin multiplicarlos por programa. Si hay vínculo explícito a un concepto financiero de certificado, se muestra su importe; sin vínculo se identifican conceptos que contienen Certificado/Certificación y se indica que la identificación es textual y requiere revisión. Un reparto explícito a otros conceptos impide atribuirle el subtotal por semejanza de texto. No se afirma que esos recibos pertenezcan a una ficha concreta. Conceptos con otra nomenclatura no se identifican automáticamente.

Titulación: planes financieros exactos del alumno y todos sus ciclos, detalles normalizados prioritarios o campos numerados como alternativa. Se distinguen:

1. Importe del plan: suma de sus conceptos usados.
2. Pagado según estatus: liquidaciones reconocidas o abonos con restante cuantificable. Un texto ambiguo no se transforma en cero o pago completo. Es una lectura del estado registrado, no validación contable.
3. Importe identificado en vínculos: suma de `planes_pago_vinculos_recibo.importe` activos, con recibo ACTIVO del mismo alumno. No suma recibos completos ni vuelve a acreditar monedero/excedentes. Estos importes no se suman a los del punto anterior.

Referencias históricas R-n/F-n localizan un recibo activo único del mismo alumno por folio o folio_fiscal. Sin vínculo monetario se muestran como referencia, con importe aplicado vacío. La factura y el recibo no crean dos movimientos. Referencias faltantes/ambiguas se explicitan. No se atribuye un plan de pagos de titulación a una carrera.

Se muestran folio, factura cuando exista, fecha, forma de pago registrada, concepto, importe del vínculo/subtotal identificado, total del recibo y uso de monedero. El total del recibo puede contener otros conceptos y repetirse en filas distintas: no debe sumarse por fila. «Sin respaldo identificado» no equivale a «No pagado». No hay cambios de datos, saldos, folios o estados.

## Exportación

ZIP con CSV UTF-8/BOM y protección de fórmulas: `certificados_estados.csv`, `titulacion_planes.csv` según contenido y `recibos_detalle.csv`. Resúmenes y movimientos se separan para evitar multiplicar los importes del plan/ficha por recibo. Los IDs finales conservan identidad de registros con folios iguales; no se intenta normalizar dividiendo etiquetas concatenadas. LEEME explica alcance y fuentes distintas. La descarga usa los mismos datos ya consultados; no ejecuta otra lectura para exportar.

Los alumnos sin plan de titulación tienen una fila explícita «Sin plan», sin importes inventados. Los estados de certificación sin ficha se identifican como «Sin registro». La consulta móvil presenta tarjetas de recibo; la tabla de escritorio/tableta desplaza sus columnas dentro de su contenedor.

## Instalación y comprobación

No necesita dependencia ni migración nueva. Usa las fuentes financieras y la función de certificación ya existentes; si no están instaladas o faltan permisos, muestra error y bloquea la exportación completa. Las consultas avanzan por filas recibidas hasta página vacía, incluso si el servidor limita la respuesta a menos de 500. Se consultan recibos y detalles por separado para no truncar relaciones anidadas. Se rechazan duplicados, datos fuera de alcance y vínculos cuyo respaldo no es visible.

No proporciona una instantánea transaccional del servidor: son lecturas consecutivas y los cambios concurrentes pueden exigir reintento. La consulta no sustituye una conciliación ni permite crear asociaciones de certificados. La cobertura real de conceptos históricos y permisos RLS debe comprobarse en el entorno instalado.
