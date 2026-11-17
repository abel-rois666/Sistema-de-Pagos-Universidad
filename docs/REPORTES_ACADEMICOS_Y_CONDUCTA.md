# Reportes Académicos y Conducta (Alumnos, Grupos y Docentes)

**Clasificación documental:** Registro de diseño y desarrollo (ISO 9001:2015 Cláusulas 8.3.5 y 7.5)  
**Fecha:** 14 de noviembre de 2026  
**Estado de base de datos:** SQL preparado localmente (`supabase/checks/preflight_reportes_academicos_20261114.sql` y `supabase/migrations/20261114100000_reportes_academicos.sql`) — **pendiente de ejecución manual; no aplicado en Supabase**.

---

## 1. Propósito y Alcance Operativo

El módulo **Reportes Académicos** centraliza el registro, consulta, seguimiento y documentación formal de situaciones académicas y disciplinarias vinculadas con alumnos, grupos y docentes dentro del ciclo escolar correspondiente:

1. **Inasistencias** (`INASISTENCIAS`): registro exclusivo para alumnos individuales (todos los estatus, orden alfabético A–Z).
2. **Problema de rendimiento** (`PROBLEMA_RENDIMIENTO`): registro exclusivo para alumnos individuales.
3. **Incidente** (`INCIDENTE`): admite dos flujos:
   - **Por Alumno / Docente (`ALUMNO_DOCENTE`):** uno o varios alumnos (de cualquier estatus) y/o uno o varios docentes activos (incluyendo múltiples docentes pares en un mismo evento).
   - **Por Grupo (`GRUPO`):** uno o varios grupos del ciclo escolar seleccionado, con selector por grupo de alcance:
     - **`TODO_EL_GRUPO`:** el incidente se vincula únicamente al grupo y se refleja en `/reportes-academicos` y en **Control Escolar → Grupos → Reportes del grupo**; en el Acta de Hechos se refiere institucionalmente al grupo completo y **no** se vincula a fichas individuales de alumnos.
     - **`PARCIAL`:** requiere seleccionar alumnos inscritos en ese grupo; además de mostrarse en `/reportes-academicos` y en **Reportes del grupo**, los reportes sí se vinculan y visualizan en **Ficha del alumno → Reportes** de los alumnos seleccionados y se listan como firmantes en el Acta de Hechos.
4. **Acta de Hechos opcional (`tiene_acta_hechos`):** disponible exclusivamente para reportes de tipo **`INCIDENTE`** y **desmarcada por omisión**. Permite editar el nombre institucional, título del documento, lugar, fecha y horarios, personal administrativo activo que instrumenta y levanta el acta, relatoría de hechos, pruebas/anexos y testigos mixtos (`PERSONAL` desde empleados/docentes activos o `EXTERNO`), además de vista previa de impresión directa y exportación a PDF (`descargarPdfActaHechos`) con saltos de página seguros para firmas.
5. **Evidencia documental en Google Drive (`DrivePicker`):** selector opcional de carpeta o archivo de Google Drive (`src/components/DrivePicker.tsx`, almacenado en `enlace_drive` con validación HTTPS `drive.google.com` / `docs.google.com`) para reportes de tipo `INCIDENTE`, mostrado como acceso directo en listados e impresión del reporte.

---

## 2. Arquitectura e Integración Transversal

| Capa | Archivo(s) | Responsabilidad |
| --- | --- | --- |
| **SQL Preflight** *(no ejecutado)* | `supabase/checks/preflight_reportes_academicos_20261114.sql` | Verificación de solo lectura de tablas prerequisito, función `get_my_rol()` y ausencia previa de tablas/RPCs del módulo. |
| **SQL Migración Aditiva** *(no ejecutado)* | `supabase/migrations/20261114100000_reportes_academicos.sql` | Tablas `reportes_academicos`, `reportes_academicos_alumnos`, `reportes_academicos_grupos`, `reportes_academicos_docentes`, `reportes_actas_hechos`, bitácora privada `reportes_academicos_bitacora`, RLS de lectura y RPCs `guardar_reporte_academico_v1` / `consultar_reportes_academicos_v1` con folio `REP-{CICLO}-{CONSECUTIVO}` y control optimista de `revision`. |
| **Dominio y Tipos** | `src/reportesAcademicos/types.ts`, `src/reportesAcademicos/dominio.ts`, `src/reportesAcademicos/exportarActaHechosPdf.ts` | Ciclo sugerido por fecha civil actual en Ciudad de México (`sugerirCicloPorFechaActual`), validaciones estrictas de negocio, limpieza de alumnos en grupos `TODO_EL_GRUPO`, construcción de firmantes y generación PDF con `jsPDF`. |
| **Servicio y Hook** | `src/services/reportesAcademicosService.ts`, `src/hooks/useReportesAcademicos.ts` | Invocación de RPCs, normalización de errores (`40001` conflicto de revisión), consulta ordenada de catálogos y estado compartido de formulario. |
| **Módulo Principal** | `src/components/reportesAcademicos/ReportesAcademicosModule.tsx`, `FormularioReporteAcademico.tsx`, `EditorActaHechos.tsx`, `ImpresionActaHechos.tsx`, `reportesAcademicos.css` | Vistas de consulta general y registro/edición en `/reportes-academicos`, protección de captura sin guardar (`ProteccionCaptura`), ayudas contextuales (`AyudaContextual`) y estilos adaptativos claro/oscuro (`390 px`, `820 px`, `1440 px`). |
| **Navegación y Rutas** | `src/app/capacidades.ts`, `src/app/menuAplicacion.ts`, `src/app/navegacion.ts`, `src/app/inicioCatalogo.ts`, `src/app/titulosRutas.ts`, `src/App.tsx` | Submenú **Reportes Académicos** bajo **Control Académico**, acceso en área **Académico** de Inicio y habilitación de `/reportes-academicos` para `ADMINISTRADOR`, `COORDINADOR ACADEMICO` y `COORDINADOR CONTROL ESCOLAR`. |
| **Ficha del Alumno** | `src/components/tabs/TabReportesAlumno.tsx`, `src/components/FichaAlumno.tsx`, `src/hooks/useFichaAlumnoLogic.ts` | Apartado **Reportes** en el marco estable (`≥ 1120 px` barra lateral / móvil desplegable) visible y editable para Administración, Coordinación Académica y Control Escolar; filtra estrictamente por `r.alumnos` excluyendo reportes `TODO_EL_GRUPO`. |
| **Grupos (Control Escolar)** | `src/components/GruposConfig.tsx`, `src/components/reportesAcademicos/PanelReportesGrupo.tsx` | Botón **Reportes del grupo** por fila y panel de consulta/registro con ciclo y grupo preseleccionados, distinguiendo `Todo el grupo` y `Selección parcial (N alumnos)`. |
| **Ficha del Docente** | `src/components/personal/FichaPersonal.tsx`, `src/components/reportesAcademicos/ReportesDocentePorCiclo.tsx` | Acceso **Reportes e incidentes** dentro de **Docencia**, editable para `ADMINISTRADOR` y `COORDINADOR ACADEMICO`, mostrando incidentes individuales, compartidos con pares docentes o con grupos/alumnos. |

---

## 3. Matriz de Permisos por Rol

| Perfil | `/reportes-academicos` | Ficha del Alumno (`Reportes`) | Grupos (`Reportes del grupo`) | Ficha del Docente (`Docencia → Reportes e incidentes`) |
| --- | --- | --- | --- | --- |
| `ADMINISTRADOR` | Consultar, crear, editar, imprimir/PDF, cambiar estatus | Visible y editable | Visible y editable | Visible y editable |
| `COORDINADOR ACADEMICO` | Consultar, crear, editar, imprimir/PDF, cambiar estatus | Visible y editable | Visible y editable | Visible y editable |
| `COORDINADOR CONTROL ESCOLAR` | Acceso habilitado (alta/edición alumnos y grupos) | Visible y editable | Visible y editable | No visible (gestión académica restringida) |
| `CAJERO`, `DOCENTE`, `COORDINADOR FINANCIERO`, `COORDINADOR RECURSOS HUMANOS` | Denegado | Oculto | Oculto | Oculto |

---

## 4. Directrices de Implementación en Base de Datos (Aplicar Manualmente)

> [!IMPORTANT]
> **La migración SQL no ha sido ejecutada.** Antes de liberar el módulo en el entorno productivo:

1. Abrir el **SQL Editor** de Supabase y ejecutar primero la verificación de solo lectura:
   - [`supabase/checks/preflight_reportes_academicos_20261114.sql`](../supabase/checks/preflight_reportes_academicos_20261114.sql)
2. Confirmar que todas las tablas base y `public.get_my_rol()` existen y que no hay colisiones de nombres.
3. Ejecutar la migración aditiva:
   - [`supabase/migrations/20261114100000_reportes_academicos.sql`](../supabase/migrations/20261114100000_reportes_academicos.sql)
4. Reflejar el esquema actualizado en `db_schema.sql` una vez confirmada la aplicación en la instancia destino si corresponde al flujo operativo del repositorio.

---

## 5. Verificación y Evidencia de Calidad

- **Pruebas unitarias automatizadas:** `tests/reportesAcademicos.test.ts` (reglas de sugerencia automática de ciclo, validaciones por flujo y tipo, aislamiento `TODO_EL_GRUPO` vs `PARCIAL`, generación de firmantes/involucrados, exportación PDF multipágina e integración de consulta/menú/rutas) y `tests/capacidades.test.ts` (matriz de acceso a `/reportes-academicos` y catálogo de Inicio).
- **Ensayo aislado sin red:** `scripts/ensayoReportesAcademicos.html` y `scripts/ensayoReportesAcademicos.tsx` con intercepción integral de `window.fetch` sobre datos sintéticos y verificación en Playwright Chromium (`390 px`, `820 px` y `1440 px`, temas claro y oscuro).

