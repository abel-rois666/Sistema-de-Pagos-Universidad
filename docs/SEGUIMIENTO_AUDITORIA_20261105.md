# Seguimiento de los hallazgos de la auditoría

Estado local al 05/11/2026. Responsable de preparación: desarrollo. La aceptación operativa corresponde a los responsables institucionales; no se atribuye a personas sin designación.

| ID | Hallazgo | Estado y aceptación pendiente |
|---|---|---|
| H01 | Autorización en rutas/servidor | Preflight recibido; blindaje de cinco tablas y perfiles preparado. Requiere ensayo por rol y revisión de las demás tablas/rutas. No se considera cerrado. |
| H02 | Borrado de plan muestra éxito pese a error | Cliente corregido; rechazo simulado conserva plan y presenta error. Eliminación real no ejecutada. |
| H03 | Borrado parcial de grupos | Cliente usa una RPC y no borra hijos por separado. SQL preparado con auditoría y rechazo si hay horarios. Pendiente instalación/ensayo transaccional. |
| H04 | Activación parcial del programa principal | Servicio delega en RPC preparada; conserva logros/simultaneidad/ingreso. Pendiente ensayo SQL con triggers instalados. |
| H05 | Selección masiva incluye filas ocultas | Corregido en Docentes y Grupos; prueba de página/selección conservada, estado parcial y limpieza. |
| H06 | Pérdida de captura al cambiar contexto | Protección en Calificaciones, Registrar Pago y formularios de Planes. Verificadas navegación interna, Atrás/Adelante, cierre explícito de sesión y confirmaciones. Faltan otros formularios y respaldo persistente ante cierre del navegador. |
| H07 | Borrado de notas seguido de upsert separado | Sustituido por servicio de lote; SQL conserva inscripción, comprueba originales y registra auditoría. Pendiente ensayo de concurrencia/rollback. |
| H08 | Complementarias cuentan distinto en promedio | Regla confirmada por usuario, compartida en historial/boletas/comunicados y probada. Evaluación numérica conservada. |
| H09 | PENDIENTE/NO PAGADO acreditan pago | Corregido reporte de titulación y negaciones en cálculos/captura; abonos y estados ambiguos probados. No se normalizan observaciones históricas. |
| H10 | Consulta fallida parece población vacía | Corregido en estadísticas, egresados, docentes, grupos y capturas modificadas. Datos incompletos no se exportan ni se presentan como caja consolidada. Faltan otros listados. |
| H11 | 403 cierra sesiones válidas | Corregido en cliente; 401 comprueba Auth y falla sin destruir captura. Faltan ensayos con sesiones reales/expiración. |
| H12 | Tres alert nativos | Sustituidos; prueba AST de todo src impide reintroducir llamadas nativas directas. |
| H13 | Confirmación sin foco/teclado/ocupado | Base corregida y ensayada en ambos temas y tres tamaños. Diálogos especializados siguen pendientes de adopción. |
| H14 | Rutas vacías y navegación interna opaca | Hubs funcionales, URLs de recibos/reportes, alias legado, 404 y catálogo compartido de capacidades implementados. Rutas/menú/Cobrar utilizan el mismo catálogo. Faltan aceptación completa por rol y preservación de todos los filtros. |
| H15 | Búsqueda DGAIR con respuesta antigua | Secuencia invalidada al cambiar texto/cerrar; no adopta resultados anteriores. Sin ensayo con servicio real. |
| H16 | Drive queda cargando si falla script/OAuth | Carga compartida con límite, errores, cancelación y reintento. No se probó OAuth con cuenta real. |
| H17 | Egreso inferido frente a oficial | Pendiente decisión y modelado del evento oficial. No se cambian datos ni se presenta la inferencia como acto oficial nuevo. |
| H18 | Invalidación/caché entre módulos | Preservados refrescos existentes; consultas modificadas tienen protección ante respuestas antiguas. Consolidación global pendiente. |
| H19 | Componentes monolíticos | Calificaciones separada en composición, capturas, celda, dominio y servicio. Planes, Recibos, Alumnos, Datos Generales y otros aún necesitan extracción por casos de uso. |
| H20 | Reparación histórica peligrosa no invocada | Eliminada rutina y progreso huérfano; ninguna reasociación o corrección histórica ejecutada. |

Las etapas E4–E8 no quedan cerradas por estas bases. Consultar `IMPLEMENTACION_CORRECCIONES_20261105.md` para dependencias de despliegue y alcance de pruebas.
