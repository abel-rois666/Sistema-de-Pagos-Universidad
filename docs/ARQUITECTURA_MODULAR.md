# Organización gradual del cliente

No mover todo el repositorio ni crear carpetas vacías. La ubicación existente de módulos ya separados, como horarios, se conserva.

- `src/app`: composición, navegación, protección de captura y límites de error. `capacidades.ts` comparte accesos entre rutas, menú y acciones; `titulosRutas.ts` conserva los títulos contextuales. No contiene fórmulas de negocio ni escrituras SQL. Las capacidades del cliente no sustituyen la autorización del servidor.
- `src/components/ui`: controles sin reglas de pagos, promoción o calificaciones.
- Pantallas raíz: componen controles y coordinan el contexto. Antes de ampliarlas, extraer el caso de uso o la sección pertinente.
- `src/components/calificaciones`: presentación de cada captura y celda, separadas de la fórmula y el guardado.
- `src/calificaciones`: reglas puras de captura numérica. No importa React, store ni Supabase.
- `src/services`: consultas y operaciones por caso de uso; devuelven datos/errores y no deciden navegación ni muestran toast.
- `src/utils/promedioAcademico.ts`: regla de participación en promedios compartida por historial y exportación. No duplicarla en documentos.
- `src/reportes`: modelos y exportadores reciben la población filtrada; conservan sus reglas de inclusión.

No trasladar un componente gigante a un hook gigante. Los formularios conservan su borrador local; el store guarda datos confirmados y preferencias. Una actualización del servidor no autoriza a reemplazar una captura pendiente. La invalidación de datos después de guardar debe pertenecer al caso de uso correspondiente.

La aplicación conserva URLs con hash. `createHashRouter` permite proteger navegación interna sin reemplazar ni reinterpretar IDs de ciclos. El proveedor de captura es único; no crear bloqueadores independientes que compitan entre sí.
