# Guía del repositorio — Sistema de Control de Pagos

Sistema universitario de alumnos, pagos, control escolar y recursos humanos. Consulta la [memoria funcional](docs/MEMORIA_FUNCIONAL.md) antes de modificar flujos.

## Stack y estructura

React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Zustand y Supabase. `src/components/` contiene pantallas y modales; `src/hooks/`, lógica de interacción; `src/services/`, consultas; `src/store/`, estado. `src/lib/supabase.ts` reúne operaciones compartidas. `public/` guarda plantillas; `supabase/functions/`, funciones Deno. `db_schema.sql` documenta el esquema; `sql_archive/` guarda scripts históricos.

## Comandos y verificación

Ejecuta `npm ci` para instalar, `npm run dev` para servir en el puerto 3000, `npm run lint` para verificar tipos y `npm run build` para generar `dist/`. Usa `node --import tsx --test tests/asignaturasImport.test.ts tests/planCoverageUtils.test.ts tests/horariosMotor.test.ts tests/nuevoGrupoUtils.test.ts` para probar importación, cobertura, horarios y grupos. Al terminar, ejecuta lint, build y pruebas; revisa móvil, tableta, escritorio y ambos temas.

## Convenciones y reglas de dominio

Respeta el estilo cercano; usa PascalCase para componentes y `useCamelCase` para hooks. Escribe comentarios y textos de interfaz en español. No hay ESLint ni formateador: `lint` ejecuta `tsc --noEmit`. Extrae servicios, hooks y componentes antes de ampliar pantallas extensas. Usa toast para errores, validaciones y avisos breves; si una acción descarta datos capturados, usa la confirmación propia de la aplicación (`src/components/ui/ModalConfirmacion.tsx`), nunca `window.alert` ni `window.confirm`. Conserva las reglas de pagos, estatus institucional y calificaciones descritas en la memoria. La visibilidad del menú no garantiza autorización en la base de datos.

En ciclos, conserva fechas y valida inicio ≤ término. El formulario adaptable de alta y edición va fuera del desplazamiento horizontal de la tabla, con «Guardar ciclo» visible. La tabla inicia por nombre descendente; conserva el orden elegido tras altas y ediciones. En tablas paginadas, ordena antes de paginar, limita «seleccionar todo» a la página visible y conserva las selecciones entre páginas. Distingue la marca institucional `activo` del ciclo de trabajo elegido por cada usuario.

Reportes: filtra antes de contar o exportar; permite multiselección, orden y paginación. El PDF abarca todas las filas filtradas. Conserva enlaces y filtros. En cobertura, usa detalles normalizados si existen; si no, campos numerados. Ignora filas vacías y `0` aislados; `$0` vale en filas usadas. Incluye `ACTIVO`, `EGRESADO` y titulados solo con plan del ciclo; excluye `BAJA`. Referencias: `src/utils/planCoverageUtils.ts`, `src/components/reportes/CoberturaPlanesPago.tsx`.

En cobertura, «Integral» requiere plan semestral o cuatrimestral con al menos una observación; quitar todas revoca esa clasificación, sin alterar completo/incompleto. Cuenta planes y alumnos distintos, filtra observaciones con coincidencia de cualquiera y refleja las columnas visibles en el PDF.

Horarios: usa `ciclo_id` exacto; cada hora dura 60 minutos y no hay receso obligatorio. Matutino L–V 07:00–13:00, vespertino L–V 16:00–21:00 y Mixto sábado 07:00–15:00; el botón 20:00 representa 20:00–21:00. En preferencias docentes, muestra licenciatura y plan por materia; busca sin alterar los marcados. Al cambiar de ciclo, cerrar o copiar sobre cambios sin guardar, confirma con el modal propio; copiar no guarda hasta pulsar «Guardar configuración». Cada grupo requiere materias; el usuario define horas presenciales y asíncronas de cada materia Mixta sin conversión automática. Permite varias sesiones de una materia el sábado, cada una de 1–4 horas. Conserva al docente asignado hasta publicar; máximo tres materias distintas del mismo grupo. Evita choques de grupo, docente y aula asignada. El hueco diario máximo de una hora es preferencia editable; prioriza al grupo. Referencias: `src/horarios/motor.ts`, `src/components/horarios/`, `supabase/migrations/20261006121000_publicar_horario_academico.sql`. La primera migración tiene 21 verificaciones `OK` comunicadas por el usuario; la de publicación sigue pendiente. Consulta `docs/APLICACION_SEGURA_HORARIOS.md` antes de continuar.

Retícula: la importación CSV/XLSX se limita al plan abierto, previsualiza y valida filas antes de guardar. Exige clave, nombre, créditos ≥ 0, clasificación y periodo entero positivo; acepta opcionalmente etapa y clave de certificación. Omite duplicados sin sobrescribir. Conserva la unicidad `(plan_id, clave_legado)` y el comportamiento de alta individual. Referencias: `src/utils/asignaturasImport.ts`, `src/components/modals/ImportarAsignaturas.tsx`.

Grupos: el alta es un borrador de tres pasos; el grado se elige entre periodos del plan y determina la preselección de materias. Turno va en el primer paso. Confirmar dentro de la aplicación antes de descartar el borrador o selecciones al cambiar plan/turno; al cambiar grado, avisar solo en la primera sustitución de materias del borrador. Guardar usa la función `crear_grupo_completo` para insertar grupo, materias y alumnos en una operación; el UUID del borrador se conserva al reintentar. La lista filtra por `ciclo_id` exacto con selector local. El usuario comunicó un preflight conforme para la migración de esta función; aún no confirmó haberla aplicado. Consulta `docs/MEMORIA_FUNCIONAL.md` antes de cambiar el flujo.

## Forma de trabajar y límites

Planifica primero los cambios que afecten pagos, permisos, datos o esquema. Haz cambios pequeños y modulares; actualiza la sección correspondiente de la memoria **en el mismo cambio** que altere comportamiento. Puedes realizar sin preguntar tareas de código necesarias y reversibles. Pregunta antes de añadir dependencias, cambiar contratos o formatos de datos, o preparar migraciones. Trata datos y esquemas de cualquier entorno como de solo lectura hasta recibir autorización. Nunca expongas secretos, alteres datos reales ni desactives controles de acceso. Al terminar, explica qué cambió, qué verificaste y qué quedó sin comprobar.

## Commits y solicitudes de cambio

Usa prefijos observados como `feat:`, `fix:` y `refactor:`; se admite ámbito, por ejemplo `fix(planes-pago):`. Describe el comportamiento y la verificación en cada PR; adjunta capturas cuando cambie la interfaz.
