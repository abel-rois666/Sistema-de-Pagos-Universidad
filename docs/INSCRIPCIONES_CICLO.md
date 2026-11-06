# Inscripciones por ciclo

Implementación local preparada el 27/10/2026. No se ejecutó SQL en Supabase ni se modificaron datos reales.

## Fuente de matrícula

Control Escolar → **Inscripciones por ciclo** (`/inscripciones`) administra una inscripción única por `alumno_programa_id` y `ciclo_id` exactos. Es independiente del grupo, de materias, planes de pago y del estatus institucional actual. Una inscripción puede confirmarse antes de asignar grupo. No se usa la fecha de creación del programa como fecha histórica acreditada.

La consulta distingue inscripción pendiente, inscrito con/sin grupo, fuera de fecha, baja y cancelación. «Consultar situación al» solo filtra, no cambia fechas. `desde` es la primera fecha efectiva; `hasta` incluye el último día inscrito. Una baja conserva su vigencia anterior hasta ese día. Cancelar significa anular un registro erróneo; siempre queda bitácora y no se eliminan filas. La corrección requiere motivo y evidencia. El grado se guarda por ciclo; un grupo multigrado no define el grado personal. Primer grado no equivale a primer ingreso.

La lista propone programas vigentes cursables de la misma periodicidad e incluye las inscripciones ya existentes, aunque el programa cambie después. «Incluir programas históricos» permite recuperar antecedentes con confirmación explícita y justificación de al menos 20 caracteres. Los cambios de periodicidad detectados se muestran para revisión y bloquean el guardado; no se buscan ciclos homónimos para sustituir IDs.

## Uso

**Nuevos ingresos del ciclo seleccionado:** si el alumno inicia en 2027-1, elegir arriba de la lista `2027-1` con su periodicidad y abrir la inscripción. El formulario muestra ese destino. Seleccionar **Primer ingreso a este programa**, revisar grado personal y registrar las fechas reales de inscripción y de ingreso. No necesita ciclo anterior: el selector de origen se oculta y se guarda vacío. El ciclo actual no aparece en «Ciclo anterior de origen» porque ese selector se reserva para antecedentes; no es el selector del ciclo en que se inscribe. No se requiere otra migración para esta aclaración.

Verificación de la aclaración de nuevo ingreso: 208 pruebas, tipado y compilación correctos. En el ensayo ficticio se confirmó un primer ingreso de 2027-1 sin origen, grado 1ER y fechas capturadas; se revisó el formulario en móvil, tableta y escritorio, con ambos temas. No se cambió SQL ni se modificaron alumnos reales.

1. Elegir el ciclo y la fecha de consulta. Buscar por alumno/programa y filtrar situación.
2. Preparar una fila o seleccionar varias páginas. El checkbox del encabezado afecta solo la página visible; filtros y paginación conservan las selecciones de otras páginas.
3. Registrar vigencia real, grado personal, tipo de ingreso, evidencia y motivo. Revisar la tabla completa antes de confirmar. En lote, los campos comunes vacíos conservan el dato de cada fila; si falta, debe acreditarse. Las fuentes nuevas usan grado actual únicamente como sugerencia revisable.
4. Guardar hasta 500 fuentes en una operación. Una revisión obsoleta rechaza y revierte el lote completo. Las fechas, periodicidad, duración, permisos y evidencia se comprueban también en SQL.
5. Consultar la bitácora para identificar valores anteriores/posteriores y motivos. Las notificaciones y el foco de ventana refrescan la lista. Un formulario abierto conserva su preparación y avisa de cambios; el servidor impide sobrescribir revisiones nuevas.

## Integración gradual

**Promoción/reinscripción:** apagada inicialmente. Administración puede activarla tras verificar la función de promoción instalada. El cliente actualizado utiliza `ic_promover_alumno`, que conserva la llamada anterior con sus permisos mediante `SECURITY INVOKER`. Si el nuevo endpoint no está instalado (`PGRST202`), usa el anterior; cualquier error del endpoint integrado se muestra sin reintentar una operación incompleta.

Al activar, un AVANCE confirma la inscripción en la misma transacción, con fecha del día administrativo de México, evidencia del acto y el grado resultante. Continuar a grado mayor a uno propone Reingreso; al llegar al primero queda tipo pendiente de acreditar. No se inventa fecha de primer ingreso. Una inscripción confirmada ya existente se conserva si coincide con el grado; baja/cancelación o discrepancia revierte el avance y sus cambios financieros. EGRESO no crea inscripción nueva. Para acreditar una fecha histórica distinta se revisa en la pantalla con evidencia. Los clientes anteriores seguirán usando el endpoint previo y no registrarán inscripciones centrales: actualizar todos los clientes antes de depender de esta integración.

**Grupos y comunicados:** muestran un resumen de matrícula confirmada y un enlace al mismo ciclo en Inscripciones. El panel no aparece si el endpoint todavía no existe. No sustituye en esta entrega las reglas de asignación de grupos ni los requisitos documentales de comunicados: el paquete con horario sigue requiriendo grupo y horario publicados. La lista anterior de alumnos institucionalmente activos sin grupo se identifica como candidatos, no como matrícula confirmada. La adopción obligatoria del nuevo registro en estos flujos requiere una fase posterior con cobertura conciliada, evitando excluir alumnos existentes durante el despliegue.

**911:** puente opcional `ic_acreditar_911`. El usuario selecciona inscripciones y confirma su acreditación documental. Copia vigencia, grado, ingreso y evidencia a fuentes 911 nuevas; registra ID y revisión de origen. Las fuentes 911 existentes se conservan íntegramente y se informa su número; cualquier discrepancia se revisa en el 911. Las bajas se representan mediante su intervalo histórico de inscripción; las canceladas se rechazan. No cambia respuestas, coberturas ni expedientes cerrados: hay que recalcular y revisar el borrador correspondiente. Ningún snapshot estadístico se sustituye por consultas vivas al exportar.

## Instalación

1. Ejecutar `supabase/checks/preflight_inscripciones_ciclo.sql`, solo lectura. No continuar con columnas faltantes o una tabla preexistente sin homologar.
2. Aplicar únicamente `supabase/migrations/20261027130000_inscripciones_ciclo.sql`. Crea cuatro tablas con RLS, RPC de consulta/guardado y bitácora, sin cargar antecedentes. No modifica la función de promoción anterior ni sus privilegios. La integración sigue apagada.
3. Si existe la base 911, aplicar opcionalmente `supabase/migrations/20261027133000_fuentes_911_desde_inscripciones.sql`. No depende del catálogo ni de nuevas migraciones financieras.
4. Ejecutar `supabase/checks/verificar_inscripciones_ciclo.sql` y probar con sesiones reales de distintos roles. Solo Administración/Control Escolar leen y escriben este registro. Las escrituras directas y el borrado están revocados; todas las correcciones pasan por RPC y quedan auditadas.
5. Desplegar el cliente actualizado. Conciliar un ciclo piloto sin grupos antes de activar promoción; verificar también pagos conservados, avance, egreso y rollback.

No ejecutar todas las migraciones pendientes del repositorio para instalar este módulo. Las fuentes históricas se confirmarán tras revisión; no hay relleno automático de matrícula a partir de pagos o grupos.

## Reconciliación del historial (29-10-2026)

La acción **Revisar historial seleccionado** consulta, sin escribir, las calificaciones del mismo alumno y plan, las fechas de los ciclos y las inscripciones operativas existentes. Admite hasta 500 programas; pagina diez propuestas, ordena antes de paginar y conserva la selección entre páginas. Cada propuesta permite abrir las materias y ciclos que la sustentan. Un valor cero en una calificación registrada cuenta como antecedente; una materia sin calificaciones no se utiliza. Varios registros de la misma materia en el mismo ciclo se presentan una sola vez con su cantidad de registros.

Se propone como ingreso la fecha inicial del ciclo con calificaciones más antiguo disponible, siempre que las fechas permitan ordenarlo y no haya empates, periodicidades contradictorias ni un inicio posterior al destino. Es una aproximación revisable: no demuestra la fecha real de admisión ni que el historial esté completo. El último antecedente anterior puede corresponder a un recursamiento o examen y tampoco demuestra por sí solo el último ciclo regular cursado.

El grado acreditado del destino prevalece. Si no existe, un plan RÍGIDO con materias del destino de un único periodo curricular permite orientar la revisión del grado; periodos mezclados y planes FLEXIBLES requieren revisión individual. Para un destino sin calificaciones, una inscripción anterior CONFIRMADA puede sugerir continuar un grado, sin superar la duración del plan. La propuesta no verifica aprobación de materias, ni autoriza promoción o egreso. No se usa el máximo periodo de una materia como regla de avance.

**Aplicar al formulario** requiere seleccionar propuestas y confirmar que se revisaron sus limitaciones. Conserva fechas y grados ya acreditados y prepara únicamente los datos faltantes. La fecha efectiva, evidencia y motivo todavía deben completarse antes del guardado transaccional habitual. No cambia el grado general, las calificaciones, los grupos ni los pagos. El formulario conserva la propuesta al editar y confirma antes de descartarla.

La ampliación autorizada del 29/10/2026 añade procedencia estructurada y preparaciones persistentes mediante la migración indicada abajo. Sin esa actualización, la consulta anterior sigue disponible de forma informativa, pero no se aplican propuestas que carezcan de huella verificable del servidor. El ingreso inferido aquí es distinto de la inferencia propia del 911, que conserva sus metadatos y versiones.

Verificación de esta ampliación: tipado y compilación correctos; 206 pruebas pasan. Ensayo en navegador con red externa bloqueada: revisión de materias, aplicación al formulario, guardado de inscripción ficticia con evidencia y fecha, y descarte confirmado sin crear inscripción. Vistas revisadas en móvil, tableta y escritorio, temas claro y oscuro. No se consultó ni modificó Supabase real desde el ensayo. La cobertura efectiva y los permisos de lectura del historial deben probarse con las sesiones institucionales antes del despliegue.

## Preparaciones y procedencia persistentes (29-10-2026)

SQL y código preparados con autorización del usuario, **sin ejecución en Supabase ni despliegue del cliente**. Se añaden tres tablas: preparaciones, su bitácora y contextos de revisión ligados a la inscripción y su revisión exacta. Todas tienen RLS y lectura restringida a Administración/Control Escolar; no admiten escritura directa ni lectura anónima.

### Flujo al comenzar un ciclo

1. Elegir el **ciclo de destino** exacto, con su periodicidad. Para conciliar historia, revisar primero las propuestas del historial y sus materias. Para continuar una matrícula, acreditar la inscripción de origen si todavía falta.
2. Abrir uno o varios alumnos y revisar **ciclo de origen**, **grado personal de destino**, **fecha efectiva**, ingreso, evidencia y motivo. El origen debe ser anterior y de la misma periodicidad; puede omitirse al acreditar primer ingreso o una inscripción histórica sin antecedente comprobado. El grado puede mantenerse al repetir. La fecha no se sustituye por el día de captura.
3. **Guardar preparación pendiente** conserva esos datos sin acreditar matrícula, avanzar grado, crear grupos ni modificar pagos. Se requieren los campos revisados completos; es un borrador del acto de inscripción, no una captura parcial de campos vacíos. Las preparaciones se consultan aunque se salga de la pantalla, pueden editarse con motivo y pueden cancelarse conservando bitácora.
4. Desde **Preparaciones guardadas**, seleccionar pendientes y revisar su confirmación. Por defecto, se confirma **solo la inscripción**: el grado general no cambia. Esto sirve para matrícula ya promovida, conciliación histórica y permanencia en el mismo grado.
5. Activar **Avanzar también el grado actual general** únicamente cuando corresponda. Exige integración habilitada, origen confirmado con revisión vigente, destino exactamente un grado mayor, grado actual igual al origen y fecha efectiva que ya llegó. Usa `promover_alumno_ciclo` mediante un orquestador SECURITY INVOKER, conservando sus permisos y reglas. No crea ni copia planes de pago; si existe uno, conserva su ID. Si hay varios, requiere revisión. No declara egreso: ese acto conserva el flujo existente.
6. Confirmar el lote conserva fecha, grado, origen y procedencia en una misma transacción. Un conflicto posterior revierte también cualquier avance ya realizado dentro del lote. Reintentar una confirmación ya completada no duplica ni modifica la inscripción. Después se organizan grupos y cargas mediante sus módulos existentes.

Las promociones anteriores de Gestión de Alumnos y la ficha conservan su funcionamiento y la fecha administrativa del día cuando la integración previa está activa. La fecha efectiva elegida y el origen comprobado se aplican en el nuevo flujo de preparaciones. Quien ya fue promovido debe usar **solo inscripción**, evitando promoverlo nuevamente. Esta entrega no sustituye silenciosamente las reglas de los clientes anteriores ni exige matrícula central en grupos/comunicados.

### Procedencia y concurrencia

`ic_trayectorias` produce en el servidor el resumen por alumno/plan, sus ciclos y materias y una huella para detectar cambios. El guardado vuelve a comprobar la propuesta de ingreso y la orientación del grado; almacena un snapshot del resumen revisado. Cambiar manualmente la fecha o el grado deja de atribuir ese valor a la inferencia. Si el historial cambió, hay que revisarlo otra vez o elegir explícitamente revisión manual con evidencia.

Al editar evidencia sin cambiar los valores acreditados, se conserva su procedencia y la referencia al contexto anterior. Si un cliente anterior modifica una inscripción por el contrato previo, la revisión nueva no hereda una inferencia obsoleta; los contextos anteriores permanecen consultables. La bitácora presenta los valores antes/después y la procedencia correspondiente. No se recalculan fuentes o expedientes 911 automáticamente.

Las preparaciones guardan ID/revisión esperados de las inscripciones de origen y destino y el plan académico revisado. Una modificación concurrente exige abrir y revisar de nuevo la preparación. La pantalla conserva las revisiones que se mostraron en la confirmación, sin adoptar automáticamente actualizaciones que lleguen durante ella. Realtime y el foco de ventana refrescan las listas, conservando los formularios abiertos.

### Aplicación de esta actualización

1. Con la base de Inscripciones ya instalada, ejecutar **solo lectura** `supabase/checks/preflight_preparaciones_inscripciones.sql`. Las columnas faltantes deben estar vacías y los helpers base presentes; si las tablas nuevas ya existen, verificar su versión antes de repetir.
2. Aplicar **únicamente** `supabase/migrations/20261029100000_preparaciones_historial_inscripciones.sql`. No requiere las migraciones 911 ni otras migraciones financieras pendientes. No carga antecedentes, no reasocia planes y conserva el valor actual de la bandera de integración.
3. Ejecutar `supabase/checks/verificar_preparaciones_inscripciones.sql`: funciones presentes; tres tablas con RLS; escritura, cambio, borrado y lectura anónima en false; orquestación invoker en true; helpers privados sin acceso directo; revisiones incoherentes en cero.
4. Publicar el cliente actualizado y probar un ciclo piloto con sesiones institucionales. Antes de habilitar avance, verificar la definición **real** de promoción mediante `docs/APLICACION_SEGURA_PROMOCION.md` y sus checks. No hace falta desplegar una Edge Function para esta actualización.

Ensayo PostgreSQL local desechable: 52 comprobaciones con tablas y alumnos ficticios, incluyendo las 26 de la base. Comprueba huellas inventadas/obsoletas, procedencia por revisión y conservación al editar, matrícula independiente del grado general, plan de pago existente, fecha futura, cancelación, idempotencia, roles/RLS y rollback completo después de un avance cuando falla otro alumno. La función anterior de promoción se simula en este ensayo; no prueba su definición instalada en Supabase.

Verificación final de esta actualización: tipado y compilación correctos, 207 pruebas de TypeScript y 52 comprobaciones SQL locales. En el ensayo de navegador con red externa bloqueada se revisaron propuesta → preparación → reapertura → descarte de edición → confirmación solo de inscripción, y una cancelación con motivo que conserva el alumno sin matrícula confirmada. El ciclo Semestral vacío conserva la pantalla y no muestra preparaciones del Cuatrimestral homónimo. Formulario revisado en escritorio/tableta/móvil y ambos temas, sin errores de consola. El PostgreSQL desechable y el servidor del ensayo se detuvieron al terminar. Supabase real, Realtime real y los permisos de las sesiones institucionales siguen pendientes de comprobar.


## Verificación local de esta entrega

Tipado y compilación correctos; 200 pruebas de TypeScript pasan. El ensayo `scripts/tests/inscripcionesCiclo.local.sql` pasó 26 comprobaciones en PostgreSQL 18 local con tablas y alumnos ficticios (no contra Supabase). Incluye RLS/roles, periodicidad, revisión optimista, rollback completo del lote, conservación de plan en reintento, rollback de promoción y puente 911 sin sobrescritura.

La página de desarrollo `scripts/ensayoInscripcionesCiclo.html` bloquea solicitudes externas y canales WebSocket hacia Supabase. Se comprobó selección entre páginas (32 filas), preparación/confirmación de dos alumnos sin grupo, persistencia al recargar y ciclo vacío sin pantalla en blanco. Revisados escritorio, móvil y tableta en ambos temas. La conexión y cobertura reales, los roles de Supabase y la versión instalada de promoción requieren comprobación institucional; la integración se entrega apagada.


## Ayudas de uso y claridad de la captura (29/10/2026)

- El ciclo local determina dónde consultar o inscribir. «Ver quién estaba inscrito el» cambia únicamente la situación consultada y los conteos. No captura fechas ni inscribe alumnos.
- La guía presenta elegir ciclo, completar datos y confirmar ahora o guardar una preparación. Revisar el historial es opcional. Primer ingreso, fecha efectiva y grado personal tienen explicaciones propias.
- El editor conserva etiquetas asociadas a cada control, muestra el destino de forma explícita y permite consultar ayuda en origen, tipo, vigencia, grado, evidencia y motivo. Confirma o descarta con los mismos modales y validaciones anteriores.
- «Registro automático al promover alumnos» se presenta en una sección aparte. Solo Administración ve su configuración; Control Escolar recibe una explicación sin controles de activación. La verificación previa de la función de promoción sigue siendo obligatoria antes de activar.
- Las preparaciones explican que no acreditan matrícula; el avance general sigue siendo una opción independiente, documentada y desactivada por defecto en la confirmación.
- Los iconos de interrogación se abren con cursor, Tab y Enter o toque; Escape, un segundo clic o tocar fuera cierran la ayuda. Se pueden leer incluso en campos deshabilitados y no cambian su valor. Los paneles se colocan sobre el formulario y se ajustan a la ventana.

Este ajuste no añade SQL, dependencias ni contratos y no modifica datos reales. El ensayo de desarrollo incorpora un cambio de rol ficticio para revisar la separación entre Administración y Control Escolar; no forma parte del producto compilado.


Verificación del ajuste de ayudas: tipado y compilación correctos; 208 pruebas existentes aprobadas. Revisión local de ambos módulos a 390, 768 y 1280 px en temas claro y oscuro, ayudas por clic/Enter/Escape, límites de ventana y etiquetas de captura. Guardado de una inscripción ficticia comprobado; ayudas disponibles en campos de solo lectura y configuración administrativa oculta a Control Escolar. Ensayos con datos ficticios y red externa interceptada: no comprueban la instalación, permisos ni cobertura reales de Supabase. No se ejecutó SQL ni se publicó a producción.


## Coherencia visual con la aplicación (29/10/2026)

Las superficies y bordes neutros, el azul de marca y las fuentes UI/Display se comparten entre Inscripciones y 911 mediante `src/components/ui/temaModulosEscolares.css`. Se retiraron el verde/dorado de las cabeceras y la tipografía serif; las ayudas usan también la paleta neutral en ambos temas. Los colores de estados y advertencias conservan su significado.

Los controles de las barras de consulta tienen un ancho máximo acorde con el contenido: ciclo de inscripción de 20 rem y fecha de consulta de 16 rem en escritorio; expediente anual 911 de hasta 28 rem. Las fechas y cifras cortas del 911 se limitan a 20 rem, y los selectores largos de cuestionarios a 38 rem. Los campos de textos/documentos y las listas conservan espacio de lectura. En móvil los controles se apilan y utilizan el ancho disponible; las tablas mantienen su desplazamiento interno.

Verificado en ensayo aislado a 390, 768 y 1440 px, en ambos temas: sin desbordamiento de página, ayudas dentro de ventana y formularios/descargas consultables. Tipado, compilación y 208 pruebas existentes aprobadas. Solo presentación: sin SQL, datos reales ni despliegue.


**Alineación de ayudas (29/10/2026):** ciclo de inscripción, fecha de consulta y ciclo anterior de origen sitúan el icono junto a la etiqueta superior. Comparten fuente de 13 px, peso 650 y controles de 42 px de alto. El ancho compacto y el apilado móvil se conservan. Verificación en ambos temas a 390, 768 y 1440 px, con medición coincidente de etiquetas, iconos y bordes en escritorio/tableta. El selector compartido conserva su renderizado anterior donde no se solicita ayuda; 208 pruebas aprobadas, incluido el renderizado del contexto de recibos.


## Destino informativo y separación de antecedente/fecha (29/10/2026)

El ciclo de inscripción del editor es el destino elegido en la lista. Se muestra como información rotulada con calendario, ayuda y explicación de dónde cambiarlo; no usa input ni simula edición. `DatoInformativo` conserva un grupo accesible y su texto puede copiarse. No cambia el `cicloId` utilizado al guardar.

El ciclo anterior de origen identifica el antecedente del mismo tipo. Es opcional para registrar solo la inscripción; el avance general desde una preparación requiere un origen confirmado conforme a sus validaciones existentes. «Inscrito desde» es la fecha acreditada de esta inscripción en el destino, independiente del origen, la fecha de captura y el primer ingreso al programa. El selector no rellena fechas. En primer ingreso no hay origen anterior. En lote, el origen vacío conserva cada fila; el botón explícito sigue registrando ausencia de origen.

El selector de origen y su acción se disponen juntos, con ancho acotado. Estados/tipos comparten hasta 24 rem y fechas/grado hasta 20 rem; las evidencias conservan espacio de texto. Etiquetas/ayudas tienen alineación y tipografía comunes y los controles miden 42 px. En móvil se apilan y la confirmación principal dispone de su propia fila. Los colores siguen el tema compartido.

Se comprobó el modal masivo a 390, 768 y 1280 px en ambos temas, el destino sin controles de entrada/caret, y el guardado local de dos inscripciones ficticias tras elegir un antecedente y capturar la fecha por separado. Pasan 208 pruebas existentes. No cambia contratos, SQL, permisos, datos reales ni reglas de promoción.


## Proponer «Inscrito desde» con el historial del destino (29/10/2026)

> Criterio inicial sustituido por la corrección de fecha histórica y origen descrita al final de esta guía. La migración 29140000 se conserva como base y compatibilidad de propuestas anteriores.

SQL y código autorizados/preparados; la migración no se ha aplicado en Supabase ni se ha publicado el cliente. El ensayo SQL se ejecuta solo en un clúster local desechable con datos ficticios.

En el editor individual o masivo, «Revisar fechas desde las calificaciones» consulta las trayectorias verificables y muestra una propuesta por alumno. Usa exclusivamente el inicio del ciclo de destino exacto, con la misma periodicidad, alumno, programa y plan, y al menos una materia con calificaciones de ese destino. No reutiliza el ciclo más antiguo de toda la carrera: ese antecedente sigue orientando el primer ingreso. Una nota cero también es actividad; tener grupo sin calificaciones no basta. Los antecedentes incompletos o contradictorios, las fechas cambiadas, un primer ingreso posterior al inicio, un término anterior o una cancelación requieren revisión manual.

Las fechas ya guardadas, capturadas o de preparaciones no se sobrescriben. El usuario selecciona propuestas (solo la página visible al marcar todas), declara que revisó su carácter aproximado y pulsa «Usar fechas revisadas». Se aplican solo al formulario, sin acreditar matrícula, cambiar grado, crear grupos o modificar pagos. Evidencia y motivo siguen siendo obligatorios; cada alumno del lote debe cumplir los requisitos de guardado. Los casos sin propuesta se revisan individualmente o en otro lote. En un lote, el campo común puede permanecer vacío: las fechas individuales se muestran en la revisión previa.

La propuesta queda identificada como **aproximada**: las calificaciones prueban actividad en el periodo, no el día exacto de inscripción. El campo se llama «Inscrito desde», sin presentarla como una fecha exacta. Se puede corregir manualmente con respaldo. Una fecha editada deja de atribuirse a la propuesta; las versiones anteriores y sus contextos se conservan.

La referencia opcional añade `aplicar_desde`, `ciclo_desde_id` y `fecha_desde_propuesta`. El servidor reconstruye la trayectoria, comprueba huella, actividad, destino y fecha, y produce `contexto.desde` con método `INICIO_CICLO_DESTINO_CON_CALIFICACIONES`, ciclo, fecha y marca `aproximado`. No acepta reclasificar una fecha acreditada como inferida. Al editar sin cambiarla conserva la procedencia; al modificarla queda manual. Volver a revisar el historial de una preparación mantiene la referencia de la fecha intacta con la nueva huella y nueva validación del servidor. Un conflicto revierte todo el lote. Los contratos de las RPC y sus permisos se conservan; solo se amplía el JSON opcional y la capacidad anunciada por configuración.

### Aplicación controlada

1. Requiere la base de Inscripciones y `20261029100000_preparaciones_historial_inscripciones.sql` ya instaladas. No volver a ejecutar esas bases a ciegas ni aplicar migraciones financieras pendientes.
2. Ejecutar solo lectura: `supabase/checks/preflight_fecha_inscripcion_propuesta.sql`. Las funciones deben existir, las tablas conservar RLS y la definición del helper corresponder a la versión esperada; revisar personalizaciones antes de sustituirlo.
3. Aplicar únicamente `supabase/migrations/20261029140000_fecha_inscripcion_propuesta.sql`. No crea tablas, no carga datos y no cambia fechas existentes. Actualiza la validación y anuncia `propuesta_fecha_inscripcion=true` en configuración.
4. Ejecutar solo lectura: `supabase/checks/verificar_fecha_inscripcion_propuesta.sql`. Se esperan tres capacidades verdaderas, helper privado sin ejecución directa de authenticated/anon y cero fechas incoherentes. Comprobar después sesiones institucionales de Administración/Control Escolar.
5. Publicar el cliente actualizado y probar un ciclo piloto. No requiere desplegar una Edge Function. Antes de la migración, el cliente mantiene la propuesta deshabilitada y la captura manual disponible; además vuelve a comprobar la capacidad antes de guardar/confirmar una propuesta nueva.

Pruebas: `tests/fechaInscripcionPropuesta.test.ts`; ensayo PostgreSQL `scripts/tests/fechaInscripcionPropuesta.local.sql` exige base local vacía `ic_pruebas_local` y localhost. Pasan 71 comprobaciones SQL acumuladas (incluidas las anteriores), con roles, notas cero, destino homónimo, huella/fecha falsificadas, conservación de fechas, persistencia, revisión manual y rollback. La promoción sigue simulada en el ensayo base, sin validar su instalación real. En navegador se comprobó un lote mixto, fechas protegidas, aplicación de dos propuestas, preparación/reapertura/confirmación sin avance, y captura manual disponible sin capacidad nueva. Vistas a 390, 768 y 1280 px en ambos temas, con tabla desplazable internamente.

Verificación final: lint y build correctos; 219 pruebas de TypeScript aprobadas. Build conserva avisos de tamaño de paquetes e importaciones mixtas, sin errores de compilación.


## Corrección: fecha histórica y último ciclo anterior con calificaciones (29/10/2026)

El criterio inicial exigía calificaciones en el destino y por eso dejaba sin propuesta a alumnos con trayectoria anterior y un ciclo nuevo aún sin captura. Se corrige según la regla solicitada:

- **Inscrito desde propuesto:** inicio del ciclo más antiguo con materias calificadas del mismo alumno, programa y plan. Se identifica como fecha histórica **aproximada**. No exige calificaciones en el destino. No se deduce de tener grupo ni del nombre del ciclo.
- **Ciclo anterior de origen propuesto:** último ciclo con materias calificadas anterior al inicio del destino, de la misma periodicidad. Un ciclo confirmado más reciente sin notas no desplaza ese antecedente. Tampoco se toma el destino ni un ciclo futuro como origen.
- Ambas propuestas se revisan por separado en la misma tabla. El alumno puede seleccionarse si al menos un campo vacío admite propuesta. Una fecha protegida no impide completar solo el origen; elegir «sin ciclo de origen» conserva esa decisión. Primer ingreso no recibe origen anterior.
- Las fechas/orígenes guardados, capturados o preparados se conservan. Los empates, fechas incompletas y periodicidades contradictorias se explican, sin inventar valores. Al aplicar se mantiene el grado, primer ingreso, tipo de ingreso, evidencia y motivo; no hay promoción ni matrícula automática.

La fecha histórica no demuestra por sí sola la inscripción al destino. Confirmarla en un registro del destino puede hacer que figure vigente desde esa fecha al consultar fechas anteriores. Control Escolar debe revisar la evidencia de matrícula del destino y corregir manualmente «Inscrito desde» cuando el historial solo acredite ingreso al programa. La fecha de primer ingreso continúa siendo un campo separado y puede proponerse desde «Revisar historial seleccionado».

**Procedencia:** referencia opcional `metodo_desde=HISTORIAL_MAS_ANTIGUO`, `aplicar_origen`, `ciclo_origen_propuesto_id`. El helper reconstruye el primer/último antecedente y verifica huella, fechas, IDs y aceptación explícita. Guarda `INICIO_HISTORICO_CON_CALIFICACIONES` separando ciclo fuente y destino, y `ULTIMO_CICLO_ANTERIOR_CON_CALIFICACIONES` para el origen. Editar manualmente un campo revoca la atribución de ese campo. Los snapshots anteriores y la captura manual permanecen disponibles. Las propuestas del método antiguo siguen siendo válidas con sus propias verificaciones; no se reinterpretan ni se actualizan registros existentes.

### Instalación de esta corrección

No se ejecutó SQL en Supabase ni se publicaron cambios. Con la base de Inscripciones y las migraciones 29100000/29140000 ya instaladas:

1. Revisar `supabase/checks/preflight_fecha_historica_origen_inscripciones.sql` (solo lectura): dos verdaderos, definiciones esperadas y RLS activo.
2. Aplicar **solo** `supabase/migrations/20261029160000_fecha_historica_origen_inscripciones.sql`. No edites ni vuelvas a aplicar la anterior para obtener el nuevo comportamiento. No requiere tablas nuevas, dependencias o Edge Function.
3. Ejecutar `supabase/checks/verificar_fecha_historica_origen_inscripciones.sql` (solo lectura). Esperados: tres verdaderos; helper definidor con ejecución directa de authenticated/anon falsa; cero procedencias actuales incoherentes.
4. Publicar el cliente y recargar el módulo. Configuración anuncia `version=4` y `propuesta_fecha_historial=true`; hasta entonces el cliente deshabilita esta nueva propuesta y permite captura manual. El servicio vuelve a comprobar la capacidad antes de guardar propuestas históricas o confirmar sus preparaciones.

Verificación: tipado, compilación y 221 pruebas TypeScript aprobadas. Ensayo `scripts/tests/fechaHistoricaOrigen.local.sql` exclusivamente en base local ficticia vacía: 89 comprobaciones acumuladas, incluidas compatibilidad base, fecha/origen manipulados, nota cero, preservación de valores y separación entre preparación y confirmación. No sustituye verificar roles, definiciones instaladas y un caso piloto en Supabase. El build mantiene avisos de tamaño de paquetes e importaciones mixtas.

### Selectores de sugerencias para evidencia y motivo (implementados)

El editor individual y masivo incorpora `CampoSugeridoInscripcion` para los dos textos existentes. Cada selector empieza en «Selecciona una sugerencia (opcional)», presenta opciones alfabéticas y permite seguir escribiendo directamente en el área de texto.

- Respaldo: acta/lista oficial, autorización de Control Escolar, ficha de inscripción, ficha de reinscripción, historial de calificaciones revisado u otro documento.
- Motivo: anulación, corrección de captura/fecha/origen, nuevo ingreso, baja, regularización del historial o reinscripción.

Elegir una opción no modifica el texto ni acredita documentos. En respaldo, «Referencia concreta (opcional)» puede quedar vacía: la acción aplica solo el tipo de documento. Si se escribe una referencia, se incorpora al texto sin exigir una longitud mínima. En motivo se conserva el detalle de al menos cinco caracteres. Se muestra una vista previa y se pulsa la acción explícita. No se inventan folios, documentos ni ciclos. El texto resultante sigue siendo editable. Si ya existe texto, `ModalConfirmacion` compara actual/propuesta y permite conservarlo o sustituirlo sin cambiar los demás campos. Los borradores de selección/referencia también activan la confirmación de descarte al cerrar el editor.

En lotes se recuerda que la referencia común debe respaldar a todos los seleccionados. No cambia la conservación de campos comunes vacíos, ni las validaciones de inscripción y motivo. Guardar preparación o confirmar conserva los mismos campos `evidencia` y `motivo`; las opciones auxiliares no añaden columnas ni datos de contrato. Al reabrir se conserva la evidencia; el motivo vuelve a requerir revisión conforme al flujo anterior, y las sugerencias arrancan sin preselección para no reinterpretar textos históricos.

No requiere SQL, dependencias ni Edge Functions nuevas. La corrección de inferencia de fechas sigue requiriendo su propia migración anterior. Comprobación funcional con datos ficticios: aplicar respaldo con o sin referencia, aplicar texto, cancelar/aceptar sustitución, guardar preparación y reabrir con respaldo intacto. Controles de 42 px, etiquetas/ayudas alineadas, adaptación a 390/768/1280 px y ambos temas; sin errores de consola. Tipado, build y las 221 pruebas existentes aprobados; no se han publicado cambios ni modificado datos reales.

Ensayo visual de la corrección: alumno sin notas en el destino seleccionable, propuesta de 2025-1 y origen 2026-3 separados, aplicación sin guardado, preparación/reapertura conservadas, fecha existente protegida y ausencia de historia explicada. Modal sin desborde de página a 390, 768 y 1280 px en ambos temas, con desplazamiento interno de tabla. Sin errores ni avisos de consola en el ensayo ficticio.


## Actualización 30/10: ingreso y vigencia separados

La actualización en `docs/TRAYECTORIA_E_INSCRIPCIONES.md` sustituye el uso del primer ciclo histórico como fecha efectiva de una inscripción posterior. La propuesta ahora completa primer ingreso al programa. El origen anterior se conserva independiente y la fecha efectiva del destino se captura con evidencia. Las secciones del 29/10 describen versiones anteriores, no la conducta actual. La migración nueva debe aplicarse después de las anteriores.


## Historial de cambios

Acción secundaria junto a cada inscripción o preparación, disponible con los permisos existentes. El modal identifica alumno, programa y ciclo; presenta primero la operación más reciente, su fecha, responsable y motivo. «Ver cambios» compara únicamente los campos modificados; el primer evento ofrece «Ver datos del registro inicial». El respaldo se consulta en ese detalle. No hay edición ni borrado de eventos. Los nombres de responsables dependen del acceso al perfil: de no estar disponible, se indica expresamente. No se modifica ninguna tabla ni se requiere migración para esta mejora visual.
