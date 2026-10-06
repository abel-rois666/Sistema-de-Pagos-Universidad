# Guía del repositorio — Sistema de Control de Pagos

Sistema universitario de alumnos, pagos, control escolar y recursos humanos. Consulta la [memoria funcional](docs/MEMORIA_FUNCIONAL.md) antes de modificar flujos.

## Stack y estructura

React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Zustand y Supabase. `src/components/` contiene pantallas y modales; `src/hooks/`, lógica de interacción; `src/services/`, consultas; `src/store/`, estado. `src/lib/supabase.ts` reúne operaciones compartidas. `public/` guarda plantillas; `supabase/functions/`, funciones Deno. `db_schema.sql` documenta el esquema; `sql_archive/` guarda scripts históricos.

## Comandos y verificación

Ejecuta `npm ci` para instalar, `npm run dev` para servir en el puerto 3000, `npm run lint` para verificar tipos y `npm run build` para generar `dist/`. Usa `node --import tsx --test tests/asignaturasImport.test.ts tests/planCoverageUtils.test.ts` para probar importación y cobertura. Al terminar, ejecuta lint, build y pruebas; revisa móvil, tableta, escritorio y ambos temas.

## Convenciones y reglas de dominio

Respeta el estilo cercano; usa PascalCase para componentes y `useCamelCase` para hooks. Escribe comentarios y textos de interfaz en español. No hay ESLint ni formateador: `lint` ejecuta `tsc --noEmit`. Extrae servicios, hooks y componentes antes de ampliar pantallas extensas. Conserva las reglas de pagos, estatus institucional y calificaciones descritas en la memoria. La visibilidad del menú no garantiza autorización en la base de datos.

En ciclos, conserva fechas y valida inicio ≤ término. El formulario adaptable de alta y edición va fuera del desplazamiento horizontal de la tabla, con «Guardar ciclo» visible. La tabla inicia por nombre descendente; conserva el orden elegido tras altas y ediciones. En tablas paginadas, ordena antes de paginar, limita «seleccionar todo» a la página visible y conserva las selecciones entre páginas. Distingue la marca institucional `activo` del ciclo de trabajo elegido por cada usuario.

Reportes: filtra antes de contar o exportar; permite multiselección, orden y paginación. El PDF abarca todas las filas filtradas. Conserva enlaces y filtros. En cobertura, usa detalles normalizados si existen; si no, campos numerados. Ignora filas vacías y `0` aislados; `$0` vale en filas usadas. Incluye `ACTIVO`, `EGRESADO` y titulados solo con plan del ciclo; excluye `BAJA`. Referencias: `src/utils/planCoverageUtils.ts`, `src/components/reportes/CoberturaPlanesPago.tsx`.

En cobertura, «Integral» requiere plan semestral o cuatrimestral con al menos una observación; quitar todas revoca esa clasificación, sin alterar completo/incompleto. Cuenta planes y alumnos distintos, filtra observaciones con coincidencia de cualquiera y refleja las columnas visibles en el PDF.

Retícula: la importación CSV/XLSX se limita al plan abierto, previsualiza y valida filas antes de guardar. Exige clave, nombre, créditos ≥ 0, clasificación y periodo entero positivo; acepta opcionalmente etapa y clave de certificación. Omite duplicados sin sobrescribir. Conserva la unicidad `(plan_id, clave_legado)` y el comportamiento de alta individual. Referencias: `src/utils/asignaturasImport.ts`, `src/components/modals/ImportarAsignaturas.tsx`.

## Forma de trabajar y límites

Planifica primero los cambios que afecten pagos, permisos, datos o esquema. Haz cambios pequeños y modulares; actualiza la sección correspondiente de la memoria **en el mismo cambio** que altere comportamiento. Puedes realizar sin preguntar tareas de código necesarias y reversibles. Pregunta antes de añadir dependencias, cambiar contratos o formatos de datos, o preparar migraciones. Trata datos y esquemas de cualquier entorno como de solo lectura hasta recibir autorización. Nunca expongas secretos, alteres datos reales ni desactives controles de acceso. Al terminar, explica qué cambió, qué verificaste y qué quedó sin comprobar.

## Commits y solicitudes de cambio

Usa prefijos observados como `feat:`, `fix:` y `refactor:`; se admite ámbito, por ejemplo `fix(planes-pago):`. Describe el comportamiento y la verificación en cada PR; adjunta capturas cuando cambie la interfaz.
