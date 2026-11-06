# Correcciones estructurales, visuales y funcionales — entrega inicial

Fecha: 05/11/2026. Trabajo local, sin despliegue ni ejecución de SQL. No representa el cierre de las ocho etapas del plan.

## Reglas preservadas y decisión confirmada

- Complementarias: captura numérica de 0 a 10, conservando NP; excluidas del promedio. Inglés mantiene su exclusión histórica. No se modifican calificaciones almacenadas.
- Se conservan ciclos exactos por ID, contextos locales, promoción, estatus institucional, monedero, abonos, excedentes y ciclos contables de recibos históricos.
- Limpiar todas las notas conservará la inscripción académica y el respaldo de auditoría, en vez de eliminar el registro del kardex. No se corrigen ni limpian registros existentes al instalar las funciones.
- Horarios: generación, restricciones, Worker y publicación no se rediseñan. El borrado de grupos propuesto rechaza grupos usados por cargas o sesiones, incluso si las FK permitirían SET NULL.

## Código implementado

| Área | Resultado | Límite |
|---|---|---|
| Selección | Docentes opera sobre la página visible; Grupos sobre las filas filtradas. Conserva otras selecciones, muestra cuántas quedan fuera de la vista y permite limpiarlas. | No se añade selección implícita de todos los resultados. |
| Planes | Borrado comprueba error y filas confirmadas; solo entonces retira el plan del store. Confirmación común, bloqueo mientras procesa y error dentro del diálogo. | No cambia la política institucional de borrado/cancelación. |
| Captura | Protección común de navegación interna, Atrás/Adelante, cierre explícito de sesión y cambios de contexto en Calificaciones, Registrar Pago y formularios de Planes. | No es un respaldo persistente ante cierre del navegador ni cubre todavía todos los formularios de la aplicación. |
| Calificaciones | Pantalla de composición, captura por grupo, captura individual, celda tipada, cálculo puro y servicio de lote separados. Conserva promedio de parciales, redondeo, NP y final manual justificada. | Las operaciones nuevas requieren migraciones. |
| Consultas académicas | Cancelación de consultas anteriores, error persistente, reintento y bloqueo de guardado si la consulta falla. Cambiar preferencias del usuario no reinicia la captura. | No equivale a resolver todos los conflictos concurrentes de todos los módulos. |
| Promedios | Regla compartida en historial, PDF/Word de boletas y datos para comunicados. Consultas incluyen clasificación. | No reescribe datos históricos ni elimina materias de las boletas. |
| Estados financieros | NO PAGADO/CANCELADO no liquidan ni reducen adeudos; Resta tiene prioridad sobre texto Pagado parcial. Reporte de titulación distingue texto ambiguo como revisión. | Las observaciones legadas de otros reportes conservan sus reglas; no se normalizan automáticamente. |
| Errores | Pagos libres, Egresados, Grupos y Docentes distinguen fallo de consulta de población vacía. Egresados no habilita exportación con datos incompletos. | Sin auditoría de red en producción. |
| Sesión | Un 403 no cierra una sesión válida. Un 401 obliga a comprobar Auth antes de cerrarla. Restauración conserva docente_id y verifica cuenta activa. | Autorización definitiva sigue en Supabase. |
| Fechas de recibo | Nueva captura usa fecha civil local para fecha de pago y emisión, coherente con la fecha visible. | No modifica recibos anteriores ni sus ciclos. |
| Diálogos | IDs únicos, foco inicial/de retorno, Tab contenido, Escape, fondo inerte, mensajes extensos con scroll y estado ocupado. | Las confirmaciones especializadas aún deben migrarse gradualmente. |
| Avisos | Sustituidos los tres alert nativos y unificado el toast de App. Prueba AST impide reintroducir alert/confirm/prompt directos. | Los paneles persistentes de otros módulos no se convierten en toast. |
| Navegación | Hubs con tareas reales; inicio según área; catálogo de capacidades compartido por rutas, menú y botón Cobrar; títulos por ruta; URL para registrar/consultar recibos y vista de reporte. Alias del reporte de egresados y página desconocida. | El catálogo del cliente no sustituye permisos SQL; la aceptación completa por rol sigue pendiente. |
| Carga | Pantallas cargadas por ruta con Suspense y límites de error. | No se mide aún rendimiento con volumen real ni se pagina todo en servidor. |
| Integraciones | Búsquedas DGAIR ignoran respuestas anteriores. Drive permite recuperación ante scripts/OAuth fallidos, sin cambiar scopes. | OAuth y servicios externos no se probaron con cuentas reales. |
| Código legado | Retirada la reparación masiva no invocada de ConsultarRegistros. | No se reasigna ningún recibo. |

## Esquema y permisos comunicados por el usuario

El segundo resultado confirmó las nueve tablas necesarias, cero claves alumno–ciclo–asignatura duplicadas y PostgreSQL 17.6. El error inicial de tabla ausente no se reproduce en ese resultado; no se atribuye una causa sin evidencia.

Las políticas comunicadas incluyen condiciones `true` y acceso de rol PUBLIC en varias tablas. La presencia de RLS no asegura aislamiento. Además, usuarios permite actualizar el perfil propio sin limitar columnas y contiene un campo legado password. El código actual de Login usa Auth y una RPC de búsqueda de correo, no SELECT anónimo de usuarios.

Se preparan límites de lectura/escritura para cinco tablas académicas y protección de perfiles. No se afirma que todas las tablas de producción estén aseguradas. Los grants y las políticas restantes necesitan la auditoría completa.

## Instalación propuesta — todavía pendiente de ensayo

1. Contrastar el preflight con el **mismo proyecto** que usa el cliente y revisar una copia aislada con sus triggers y funciones instaladas.
2. Ensayar `supabase/migrations/20261105120000_operaciones_academicas_atomicas.sql`.
3. Ensayar `supabase/migrations/20261105123000_calificaciones_lote_atomico.sql`.
4. Probar cliente anterior y cliente nuevo por rol, con éxito, rechazo, concurrencia y respuesta perdida.
5. Ensayar **por separado** `supabase/migrations/20261105130000_blindaje_academico_perfiles.sql`. Esta modifica autorizaciones; no aplicarla junto a otros cambios sin revisar los escenarios siguientes.
6. Ejecutar las verificaciones de operaciones y blindaje. Repetir Login por usuario/correo, tema, ciclo, cobro manual y desde plan, certificados, titulación y captura docente.
7. `manage-users` actualizado debe quedar ensayado y desplegado junto con el blindaje: valida tanto Auth como perfil administrador activo antes de usar service_role. Es compatible con el esquema anterior; no necesita esperar a la migración. No se ha desplegado desde este trabajo.
8. Publicar el cliente únicamente después de verificar el servidor. No actualizar main con todo el árbol local por accidente.

No existe fallback a borrados/guardados académicos parciales si faltan las RPC nuevas. El cliente explica la migración requerida y conserva la captura. **No publicar el cliente sin instalar y verificar su servidor.** La emisión de recibos sigue utilizando su RPC previa; no se cambia su contrato en esta entrega.

### Matriz del blindaje preparado

| Acción | Administración | Control Escolar | Académico | Finanzas/Caja/RH | Docente |
|---|---|---|---|---|---|
| Leer tablas académicas del alcance | Sí | Sí | Sí | Conserva lectura autenticada activa | Solo su carga y alumnos/programas correspondientes |
| Escribir grupos y relaciones | Sí | Sí | Sí | No | No |
| Escribir programas | Sí | Sí | No | No | No |
| Capturar calificaciones | Sí | Sí | Sí | No | Su carga, con bloqueos y solicitudes |
| Eliminar inscripción académica | Sí, reglas anteriores | Sí | Sí | No | No |
| Cambiar preferencias propias | Sí | Sí | Sí | Sí | Sí |
| Cambiar rol/identidad/acceso | Administración/Edge validado | No | No | No | No |

Los roles genéricos legados COORDINADOR no se equiparan silenciosamente a todos los coordinadores especializados. El preflight comunicado no reportó perfiles de ese rol. Si existen en otro entorno, decidir su equivalencia antes de aplicar el blindaje.

### Escenarios SQL pendientes

- Fallo en cualquier escritura revierte grupo, relaciones y auditoría; grupos usados por horarios se conservan.
- Programa concluido conserva su logro; simultáneo conserva su motivo; BAJA vuelve a CURSANDO con REINGRESO y estatus previo. Nunca cambia fechas de ingreso.
- Capturas concurrentes sobre misma inscripción rechazan originales desactualizados; alta concurrente no duplica alumno–materia–ciclo. Vaciar notas conserva inscripción y limpia solicitudes.
- Docente no puede modificar otro alumno, otra materia, IDs institucionales o notas bloqueadas por una petición directa.
- Caja/Finanzas mantienen consulta necesaria para cobro y no pueden modificar programas o notas.
- Login por usuario/correo no requiere leer usuarios anónimamente; ningún cliente consulta password. Preferencias propias funcionan, cambiar el rol propio se rechaza.
- Usuario inactivo no puede operar; administrador inactivo no administra cuentas mediante Edge.

## Etapas restantes

E0 conserva pendientes el commit realmente desplegado, comprobación SQL en entorno aislado y matriz de permisos de las demás tablas. E1/E2/E3 tienen implementación parcial verificable; la modularización completa de PlanPagos, ConsultarRegistros, AlumnosConfig y TabDatosGenerales todavía no está terminada.

E4: cerrar reintentos idempotentes del cobro sin acreditar monedero dos veces y modularizar el recorrido financiero completo. E5: completar separación de alumnos/oferta/historial y aceptación por rol. E6: revisar recorridos documentales, estados de Comunicados/Drive y exportaciones/versiones de 911. E7: extender el estándar a RH, NOM-035, configuración y coordinación de horarios/calendario sin cambiar motores. E8: notificaciones con responsables, mediciones de rendimiento y aceptación integral. No marcar estos paquetes como realizados por haber creado componentes base.

## Verificación de esta entrega

El ensayo `scripts/ensayoCorrecciones.html` usa datos ficticios, intercepta todas las conexiones externas y rechaza las escrituras simuladas. Las comprobaciones automáticas y visuales efectivamente realizadas se registran al finalizar; las migraciones no se ejecutan ni se consideran probadas por compilarlas en TypeScript.

- Tipado y compilación comprobados. La batería pasó 249 pruebas, incluidas selección, promedio/NP, estados financieros negados, fecha nocturna en México, capacidades y títulos de rutas.
- El archivo principal de JavaScript pasó de aproximadamente 4.38 MB a 0.70 MB mediante carga por ruta. Es tamaño del artefacto, no una medición de tiempo de carga ni de consultas con volumen real. Persisten avisos de chunks grandes de exportación.
- Ensayo visual de componentes cambiados en 390, 820 y 1280 píxeles, claro/oscuro. Comprobados foco, Escape, fondo inerte, descarte/cancelación, selección entre páginas, error de guardado conservando notas, alta sin planes, borrado rechazado conservando plan/grupo, captura manual y consulta fallida frente a cero ingresos.
- Ensayo adicional con el shell real y perfil ficticio de Caja: tareas financieras, título de recibos, navegación por URL, explicación de acceso denegado a Calificaciones y cancelación de cierre de sesión con captura pendiente. Todas las solicitudes externas permanecen interceptadas.
- Verificación sintáctica de `manage-users`; sin ejecución Deno, OAuth real, SQL ni prueba de permisos instalados por rol.
- No extrapolar estos ensayos a la aplicación completa. El [seguimiento de hallazgos](SEGUIMIENTO_AUDITORIA_20261105.md) diferencia resuelto, preparado y pendiente.
