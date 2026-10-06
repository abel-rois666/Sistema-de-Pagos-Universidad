# Propuesta — Generador de Horarios Académicos

**Estado:** diseño pendiente de implementación. Este documento registra decisiones de producto y una propuesta técnica; no describe funciones disponibles actualmente. Referencias actuales: `src/components/ControlAcademico.tsx`, `src/components/modals/ModalDocente.tsx`, `src/components/modals/ModalGestionarMateriasGrupo.tsx`, `src/components/GruposConfig.tsx` y `db_schema.sql`. El esquema compartido por el usuario el 6 de octubre de 2026 confirma las columnas principales, pero no enumera todas las claves foráneas, restricciones e índices.

## Datos de entrada

- Cada asignatura del plan tendrá **horas semanales totales**. Al agregarla a un grupo Mixto, el usuario elegirá cuántas son **presenciales** y cuántas **asíncronas**; su suma deberá igualar el total. Por ejemplo, una materia de cinco horas podría tener tres presenciales y dos asíncronas. El reparto pertenece a la relación grupo–asignatura para no alterar la misma materia en otros grupos. Se propone mostrar ambas en la carga docente, pero solo las presenciales ocupan celdas horarias.
- La ficha del docente guardará, **por ciclo**, intervalos semanales disponibles de lunes a sábado entre 07:00 y 21:00, planes en los que puede impartir clase, asignaturas preferidas y grupos restringidos. La licenciatura se deriva del plan elegido. Copiar datos del ciclo anterior será una acción explícita y editable.
- El generador elegirá grupos por `ciclo_id` exacto. Las asignaciones ya registradas en `docentes_grupos_asignaturas` se conservarán por defecto; no se sustituirá a un docente silenciosamente.
- La cantidad de docentes y alumnos por grupo varía; el diseño no supondrá un número fijo. Aula y sede serán datos opcionales aunque existan en la institución. Si el usuario asigna un aula, se propone comprobar que no se reserve simultáneamente para dos grupos; si no la asigna, el horario podrá generarse sin ella.

## Ventanas y restricciones

| Turno | Días | Ventana | Capacidad presencial por grupo |
| --- | --- | --- | --- |
| Matutino | Lunes a viernes | 07:00–13:00 | 30 horas semanales |
| Vespertino | Lunes a viernes | 16:00–21:00 | 25 horas semanales |
| Mixto | Sábado | 07:00–15:00 | 8 horas semanales |

Cada bloque dura **60 minutos** y no hay receso obligatorio. Son restricciones estrictas: completar las horas presenciales declaradas, respetar turno y disponibilidad, evitar choques de grupo y docente, excluir grupos restringidos y no asignar más de **tres asignaturas distintas del mismo grupo** a un docente. Deben comprobarse además los horarios publicados de ciclos con fechas superpuestas. Los huecos entre primera y última clase se intentarán limitar a **una hora diaria** por grupo y docente; es una **preferencia configurable**, por lo que una solución viable puede superarla con aviso. Si no pueden satisfacerse ambas preferencias, se prioriza reducir el hueco del grupo y se muestra el excedente del docente. Las horas presenciales se podrán dividir de forma flexible en sesiones continuas de **una a cuatro horas**, incluidas varias sesiones de la misma materia el sábado para Mixto.

Antes de generar, la pantalla mostrará para cada grupo Mixto la suma de horas presenciales frente al máximo de ocho. Si lo supera, solicitará al usuario ajustar el reparto de las materias; el sistema no convertirá horas a trabajo asíncrono por su cuenta. Un hueco se medirá solo entre la primera y la última clase del día, sin contar el tiempo previo o posterior al turno.

## Docente ya asignado

La revisión previa mostrará docente actual, elegibilidad, disponibilidad y carga. Si es compatible, quedará **fijo por defecto**. Si hay conflicto, mostrará la causa y docentes alternativos disponibles, ordenados por preferencias y carga. El usuario podrá conservarlo ajustando datos reales, elegir una alternativa o dejar la materia pendiente. El cambio propuesto permanecerá en el borrador; la publicación confirmada actualizará la asignación y el horario en una sola operación transaccional. Si no existe solución, el sistema mostrará materias sin ubicar y razones, sin publicar un horario inválido.

## Estructura técnica propuesta

1. Añadir `horas_semanales` a `asignaturas`; guardar la división presencial/asíncrona por relación grupo–asignatura, asociada a `docentes_grupos_asignaturas`.
2. Crear relaciones normalizadas de disponibilidad docente por ciclo, planes habilitados, asignaturas preferidas y grupos restringidos.
3. Guardar **versiones** de horario por ciclo (`borrador`, `publicado`) y sesiones con grupo, asignatura, docente, día, inicio y fin. Mantener las decisiones y restricciones usadas en cada generación para poder reproducir y auditar el resultado.
4. Separar un motor de generación y validación de la interfaz. La revisión previa comprobará datos faltantes, capacidad del turno, conflictos y duplicados de grupo–asignatura antes de ejecutar el motor. Los cambios manuales volverán a pasar por el mismo validador.
5. Exportar desde la misma versión publicada horarios de todos los grupos, de un grupo, de todos los docentes o de uno, en PDF y Word. Las horas asíncronas irán en un apartado separado, sin día ni hora ficticios.

## Decisiones pendientes

- Confirmar que el máximo de una hora de hueco se evalúa por día, y no como acumulado semanal.
- Antes de preparar SQL, revisar el DDL real de claves foráneas, índices, restricciones, triggers y políticas de las tablas académicas. El extracto aportado incluye políticas `ALL` amplias en `grupos`, `docentes` y `docentes_grupos_asignaturas`; la publicación necesita autorización y validación del lado del servidor.
- La exportación PDF puede usar dependencias actuales. Para `.docx` habrá que elegir una implementación y consultar antes de añadir una dependencia nueva.
