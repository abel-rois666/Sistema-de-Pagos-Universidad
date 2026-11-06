# Revisión de ficha e inscripciones — 29/10/2026

Revisión del código local, no de definiciones instaladas en Supabase ni de registros reales. No se cambiaron contratos, SQL o datos por esta revisión.

## Estado

Los selectores de respaldo/motivo están implementados. Referencia del respaldo opcional: sin ella se aplica solo el tipo elegido, con ella se incorpora al texto. El detalle del motivo conserva su validación. Confirmación antes de sustituir texto y aviso antes de descartar borradores; captura libre e individual/masiva conservadas. Tipado, build y 221 pruebas existentes aprobados. Ensayo aislado: aplicar «Ficha de inscripción» con referencia vacía funciona, etiqueta opcional y tamaños 390/768/1280 en ambos temas. No publicado por esta tarea.

La migración `20261029160000_fecha_historica_origen_inscripciones.sql` se preparó y probó localmente. No hay confirmación en esta conversación de su instalación final. Verificar con su preflight/verificador; no repetir indiscriminadamente migraciones ya instaladas. Los selectores y la referencia opcional no requieren SQL nuevo.

## Relación de los datos

- `alumnos`: identidad y datos generales.
- `alumno_programas`: relación del alumno con cada plan; no equivale a inscripción de cada ciclo.
- `inscripciones_ciclo`: registro único programa–ciclo, situación, grado personal, fechas, tipo de ingreso, evidencia y motivo; FK a `alumno_programas`, que tiene FK a `alumnos`.
- `inscripciones_ciclo_contextos` e historiales: origen y procedencia por revisión.
- `inscripciones_ciclo_preparaciones`: propuestas pendientes; no acreditan matrícula hasta confirmar.
- `s911_inscripciones`: fuente estadística separada. El puente copia solo lo seleccionado/confirmado, conserva fuentes 911 existentes y exige recalcular/revisar el expediente.

Guardar en tablas relacionadas es adecuado. Mostrar/editar desde la ficha no obliga a copiar las reinscripciones a `alumnos`; esa copia perdería programa, ciclos e historia. Un alumno puede tener ingreso diferente por carrera o posgrado.

## Pendientes de coherencia e integración

1. **Ficha sin consulta del registro operativo:** `FichaAlumno`, su hook y las pestañas revisadas no consultan `inscripciones_ciclo`. Agregar una sección por programa con primer ingreso, ciclo actual e historial descendente de inscripciones/preparaciones, evidencia, procedencia y bitácora. Reutilizar servicios/RPC/roles; evitar un segundo formulario con escrituras independientes.
2. **Fechas ambiguas:** Datos Generales rotula «Inscrito» usando `alumno_programas.fecha_inscripcion`, distinta de `inscripciones_ciclo.desde` y `fecha_primer_ingreso`. Distinguir ingreso al programa, inicio efectivo del ciclo y fecha de registro. La primera fecha de calificaciones es una aproximación; no acredita necesariamente el ingreso real o la reinscripción vigente. Guardar un inicio histórico como `desde` del destino afecta consultas anteriores de vigencia; debe revisarse antes de replicarlo como dato oficial en la ficha.
3. **Alta al consultar:** `TabHistorialAcademico.fetchProgramas` puede crear `alumno_programas` con fecha del día a partir de la primera materia si no hay programa. No tratar esa fecha generada como ingreso real. Conviene reemplazar esa reparación automática por una propuesta revisable, conservando registros existentes.
4. **Programa vigente:** la consulta de programas de Historial Académico no selecciona `id` ni `es_vigente`, aunque luego intenta priorizar `es_vigente`. La integración debe consultar ambos y usar `alumno_programa_id`, evitando elegir el programa por nombre o fecha solamente.
5. **Reinscripción y promoción:** «Reinscribir a Nuevo Ciclo» abre `ModalReinscripcion`, que promueve mediante el servicio transaccional, puede copiar pagos y luego abrir carga. El servicio intenta `ic_promover_alumno`; la inscripción integrada depende de configuración/función instalada. Distinguir claramente confirmar matrícula, avanzar grado y preparar pagos/carga; consultar la bandera antes de presentar el resultado como inscripción acreditada.
6. **Primer ingreso por programa:** actualmente `fecha_primer_ingreso` se guarda en registros por ciclo y `ciclo_ingreso_id` aparece en la procedencia de propuestas. Falta definir una fuente única acreditada por programa si se quiere editar ese dato desde la ficha. No sobrescribir automáticamente fechas distintas entre ciclos ni snapshots estadísticos. Una ampliación de contrato para hacerlo requiere autorización y migración específica; no se preparó en esta revisión.

Recomendación: integrar primero una vista del historial operativo en la ficha con los permisos existentes; después añadir acciones que reutilicen la captura transaccional, aclarar la acción antigua de promoción y resolver la fuente de primer ingreso por programa. Mantener separados los snapshots de 911 y las preparaciones de matrícula.


## Implementación posterior del 30/10

La integración, retiro del alta al consultar, corrección de fecha histórica y aclaración de promoción se implementaron localmente; la fuente de ingreso por programa cuenta con SQL autorizado/preparado. Esta revisión describe la situación anterior. Estado y guía actuales en `TRAYECTORIA_E_INSCRIPCIONES.md`. Instalación/roles/datos reales siguen pendientes de aceptación.
