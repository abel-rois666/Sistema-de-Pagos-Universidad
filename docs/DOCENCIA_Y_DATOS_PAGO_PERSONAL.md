# Datos privados de Personal y seguimiento docente

Plan acordado el 11/11/2026. Preparación de SQL y código autorizada; no ejecutar SQL ni modificar datos reales.

## Reglas acordadas

- NSS opcional, exactamente once dígitos. CLABE, cuenta y tarjeta opcionales e independientes, solo dígitos y máximos de 18, 11 y 16 respectivamente. Se guardan como texto para conservar ceros iniciales; sin validación bancaria o de titularidad adicional no solicitada.
- NSS y banco pertenecen a la identidad compartida del personal, separados de los datos generales y protegidos en servidor. Administración edita y Administración/RH consultan, siguiendo el alcance privado existente. Coordinación Académica no recibe esos valores ni tarifas/importes.
- Expediente académico por docente y ciclo exacto; lista de materias del horario publicado, agrupada por ID de asignatura con sus grupos. Planeación, criterios, políticas y exámenes configurables (hasta tres parciales y extraordinario). Las entregas se conservan por asignatura aunque cambie la versión de publicación. Una carpeta Drive por expediente de ciclo; vincular el enlace no modifica permisos en Drive.
- Materias y cuadrícula proceden únicamente de la publicación vigente, sin generar, publicar, reasignar ni modificar horarios. Los avisos por falta de horario o calendario no impiden las demás operaciones.
- Pago: horas efectivas del ciclo según calendarios aplicables por plan/modalidad/turno, excluyendo festivos, vacaciones y demás fechas no lectivas de las reglas existentes. Presenciales de todos los turnos y síncronas en línea de planes de modalidad MIXTA. Las asíncronas nunca entran al pago, independientemente de su visibilidad.
- El importe neto del ciclo se distribuye entre siete quincenas (Cuatrimestral, 14 semanas de referencia) u ocho (Semestral, 16). No se vuelven a descontar los días inhábiles por corte. Las fechas de corte son editables y los centavos se concilian al final para conservar el importe total. Las incidencias de asistencia y sus descuentos quedan pendientes.
- Tarifa por hora en MXN: general del ciclo y excepción por docente. El valor de $61 fue un ejemplo, no una tarifa predeterminada. Los importes son estimaciones; no se generan nóminas, recibos ni movimientos financieros.

## Implementación modular

1. Validadores y campos privados de NSS/banco; consulta/guardado independiente con revisión, permisos y auditoría enmascarada.
2. Fuente docente de publicación vigente y adaptación a la cuadrícula compartida; lectura de calendarios y eventos sin cargar borradores ni configuraciones de generación.
3. Checklist por materia con requisitos de examen configurables, acciones sobre los documentos visibles, cambios sin guardar protegidos y control de versión/revisión al guardar.
4. Consulta de horas, cálculo civil por fechas, tarifas y cortes con acceso privado a los importes. Mostrar estimación pendiente ante calendarios faltantes/ambiguos, sin convertir ausencia de información en cero.
5. Tres accesos ordenados dentro de Docencia: disponibilidad existente, expediente de asignatura y materias asignadas. Vistas internas con regreso, selector local de ciclo ordenado y diseño adaptable. Reutilizar cuadrícula, tooltips discretos, modales y toast.
6. Preparar migración aditiva, preflight/verificación y ensayos ficticios, sin ejecutarlos. Tipado, compilación, pruebas y revisión de móvil/tableta/escritorio, ambos temas. Documentar límites reales.

La consulta del esquema instalado, sus triggers/RLS y la ejecución SQL siguen pendientes. No se dará por verificada una función de servidor únicamente por comprobar el cliente.


## Preparación e instalación

No se ejecutó SQL en ningún entorno. No hay backfill ni valores de tarifa predeterminados.

1. Ejecutar solo lectura: `supabase/checks/preflight_docencia_datos_pago_20261111.sql`. Revisar que no falten columnas, la autorización real de `_personal_rol_v1()` y las políticas instaladas. Las funciones previas de identidad compartida de Personal deben estar instaladas. No sustituir controles del servidor por visibilidad del menú.
2. Tras revisar el resultado, instalar en orden `20261111100000_datos_pago_personal.sql` y `20261111110000_expedientes_y_tarifas_docencia.sql`. Ambas son transaccionales y aditivas. No ejecutarlas de nuevo si ya están registradas: las tablas nuevas no usan IF NOT EXISTS para no ocultar diferencias de esquema.
3. Ejecutar solo lectura: `supabase/checks/verificar_docencia_datos_pago_20261111.sql`. Debe haber seis tablas con RLS, sin acceso directo de authenticated/anon, y cinco RPC security definer con search_path fijo, sin ejecución anónima.
4. Validar en entorno de prueba con cuentas de Administración, RH y Coordinación Académica. Administración puede editar todo lo nuevo; RH consulta datos privados e importes y las asignaciones publicadas del docente; Académica edita entregas pero no recibe NSS, banco, tarifas ni importes. Los demás roles no tienen estos accesos. No se habilita un portal de autogestión docente en esta entrega.
5. Desplegar el frontend por el procedimiento habitual una vez revisada la instalación. No hay Edge Function nueva ni dependencia adicional.

La instalación por sí misma no crea expedientes, tarifas ni datos bancarios. Sin las RPC nuevas, la interfaz explica que falta la actualización; la disponibilidad docente y demás secciones conservan sus guardados existentes.

## Uso

- En la ficha de docente o administrativo, **Datos laborales → Seguridad social y banco → Editar datos privados**. Si aún no hay identidad compartida, guardar primero Datos generales. Todos los valores son opcionales y se consultan enmascarados. Los dígitos completos no se persisten en Zustand/localStorage ni se incluyen en la auditoría general. Sí quedan almacenados en la tabla privada protegida; no se incorporó cifrado adicional de columnas.
- En **Docencia → Expediente de asignatura**, elegir el ciclo exacto. Revisar exámenes requeridos por materia y marcar documentos recibidos. Los tres parciales se proponen al crear la captura; se puede dejar de uno a tres o usar extraordinario, o combinarlo con parciales. Seleccionar/desseleccionar documentos afecta únicamente las materias visibles tras buscar, sin cambiar los requisitos. Eliminar un examen ya entregado pide confirmación. Escribir motivo y guardar conserva la revisión anterior en auditoría.
- En **Docencia → Materias asignadas por ciclo escolar**, consultar la cuadrícula publicada y su distribución asíncrona. La búsqueda de calendario exige coincidencia única de ciclo, plan, modalidad y turno. Un calendario faltante o ambiguo impide el importe total, no la consulta del horario ni el checklist. Los ordinarios cuentan como clase; recuperación y extraordinarios se excluyen conforme a las reglas del calendario existente.
- Administración configura la tarifa **general de ese ciclo** y sus 7/8 cortes. Puede sugerir cierres naturales (15/fin de mes; el último se extiende hasta el fin del calendario) o editar cada cierre. La fecha inicial del siguiente corte se deriva del cierre anterior. Los cortes deben ser consecutivos y cubrir todos los calendarios del ciclo, sin huecos ni superposiciones; los días sin clases no aumentan el importe. Puede dejar cortes pendientes y definir primero la tarifa.
- La tarifa individual reemplaza la general solo para ese docente/ciclo; dejarla vacía restablece la general. Cero no equivale a vacío. No se heredan tarifas automáticamente a otro ciclo.
- Las cuotas reparten centavos enteros: primeras n−1 cuotas iguales redondeadas hacia abajo y ajuste residual en la última. La suma coincide con el total neto. Las horas reales dentro del corte se muestran como referencia y no cambian esta distribución pactada. Promedio semanal = horas netas del calendario / 14 o 16 semanas de referencia. No es un segundo cálculo de pago ni una reconstrucción de asistencia.

## Conservación y concurrencia

Las entregas se identifican por asignatura canónica y docente/ciclo, nunca por nombre ni UUID de carga que cambia al publicar. Una asignatura compartida entre grupos tiene una sola lista; otra con el mismo nombre conserva su ID propio. Las entregas retiradas de la publicación quedan consultables en “Entregas anteriores”. El guardado actual no elimina registros que no recibió.

Cada escritura valida permisos, revisión y motivo y registra auditoría. El checklist también verifica que la publicación consultada siga vigente y que las materias pertenezcan al docente. Las primeras altas se serializan; las tarifas/cortes se serializan por ciclo. Si otro usuario guardó antes, se rechaza el guardado completo y se conserva la captura del cliente para revisar. Cambiar de ciclo, actualizar o salir de una captura requiere confirmación.

Las estimaciones se recalculan con la publicación y calendario actualmente consultados; no son una nómina histórica congelada. Un módulo futuro de incidencias y liquidación deberá versionar esos datos y aplicar únicamente incidencias no descontadas; esta entrega no supone ni genera descuentos por faltas.

## Verificación reproducible

- Validadores: `tests/datosPagoPersonal.test.ts` y `tests/docencia.test.ts` (calendario, modalidad frente a turno, doble descuento, redondeo, tarifas, IDs y entregas).
- Ensayo sin red real ni SQL: compilar `scripts/ensayoDocencia.html` con Vite a un directorio temporal y ejecutar `scripts/comprobarEnsayoDocencia.mjs`. Requiere Playwright ya disponible; permite indicar `PLAYWRIGHT_MODULO` y `PLAYWRIGHT_CHROMIUM`, sin añadir paquetes al proyecto.
- La verificación estática del SQL no equivale a haber compilado o ejecutado sus funciones en PostgreSQL. El esquema instalado, permisos reales, publicación concurrente, integración OAuth/Drive y resultados con datos institucionales siguen pendientes.


Comprobaciones realizadas: tipado y compilación del cliente, pruebas automatizadas y ensayo aislado de la ficha completa con respuestas ficticias. Se revisó selección de entregas, tarifa individual, NSS inválido sin enviar al servidor, conflicto con captura conservada y consulta sin horario/calendario; se comprobó que Académica no consulta los datos bancarios ni recibe importes. Se recorrieron 390, 820 y 1440 px, ambos temas, sin desbordamiento de página ni errores de JavaScript en esos recorridos. El aviso previo de paquetes grandes de Vite sigue presente. No se verificaron PostgreSQL, permisos instalados, concurrencia real ni OAuth/Drive.

Resultado final de la comprobación del cliente: tipado y build aprobados, 464 pruebas sin fallos y ensayo de cortes personalizados aprobado. SQL pendiente de contrastar e instalar.
