# Titulación por programa — preparada, no instalada

No se ejecutó SQL ni se modificaron datos reales. Requiere certificación por programa instalada.

1. Ejecutar `supabase/checks/preflight_titulacion_por_programa.sql` (solo lectura). Resolver duplicados e inconsistencias antes de instalar; verificar que el trigger de alumno_programas mantiene el estatus institucional agregado. No eliminar antecedentes para superar un bloqueo.
2. Respaldar y ensayar la migración `20261110100000_titulacion_por_programa.sql` con registros ficticios. No hace backfill, no asocia fichas al instalar. La nueva política retira escrituras directas: clientes anteriores dejan de guardar. Coordinar instalación y publicación del cliente; no permitir clientes antiguos durante la transición.
3. Verificar `supabase/checks/verificar_titulacion_por_programa.sql`. Comprobar roles, errores, rollback y conflictos antes de habilitar escrituras.

La revisión del cliente mantiene sus validaciones de modalidad y cronología; el servidor repite requisitos de cierre, identidad y certificado. La ficha selecciona el programa por ID exacto, conserva los campos existentes y separa la consulta de cada programa. Solo un programa se preselecciona si es el único; no se elige automáticamente el principal cuando hay varios. Las fichas sin programa se conservan y se revisan mediante Herramientas administrativas → Asociar titulaciones pendientes (una o varias opciones por alumno; máximo 50, motivo, huella, auditoría, atomicidad). La asociación conserva acta y fechas y nunca modifica el estado académico. Destinos con otra ficha, incluso archivada, siguen bloqueados.

Guardar/finalizar/reabrir/archivar usan RPC con permiso de Administración activa y revisión concurrente. La finalización valida requisitos y certificado del mismo programa; actualiza exclusivamente ese programa. El estatus institucional lo mantiene el trigger existente, sin escrituras separadas en alumnos. La reapertura conserva acta; el archivado no borra. La ampliación 20261110120000 permite archivarlas conservando íntegramente acta y estatus; requiere su endpoint específico. Un error conserva la captura. Control Escolar consulta. El selector de programa solicita confirmación de descarte al cambiar con edición abierta.

La exportación utiliza solo la ficha activa asociada al programa elegido y bloquea si falta; no toma el último trámite del alumno. Los pagos siguen siendo independientes: no se atribuyen planes financieros a una carrera por nombre o principal.

## Validación pendiente

Probar contra PostgreSQL roles, restricciones, catálogo de estados/modalidades, cronología, triggers, rollback y acceso de clientes anteriores. Revisar Inglés y servicio social por programa: la pantalla conserva los controles existentes y no debe darse por acreditada una equivalencia entre carreras. No hay ejecución SQL ni despliegue en esta entrega. Ensayar también dos programas de una misma carrera, principal/histórico, actas completadas, asociación por lotes, red lenta y cierre/cambio con captura. La herramienta comparte los componentes visuales de certificación; no equivale a verificar todos los tamaños y temas.

Verificación local: tipado y compilación correctos; 405 pruebas aprobadas, incluidas cinco comprobaciones de contratos de titulación. Estas pruebas no ejecutan PostgreSQL. No se verificaron visualmente los nuevos flujos en navegador ni se instalaron migraciones. No publicar hasta completar ensayo de base de datos y validación operativa de los catálogos.

## Uso de la ficha

Consultar no requiere un motivo. Iniciar registro abre la captura; al pulsar Guardar se solicita el motivo en una confirmación propia. Completar, Reabrir y Archivar presentan su explicación y motivo dentro del mismo diálogo. La validación de cinco caracteres y el guardado auditado se mantienen. Un error conserva la captura y el motivo; cancelar el diálogo no guarda. Sin ficha, no se presenta la tarjeta de modalidad vacía.

## Revisión individual y archivo (ampliación 20261110120000)

Instalar después de 20261110100000 la nueva migración `20261110120000_titulacion_revision_y_archivo.sql`, preparada y no ejecutada. Verificar `supabase/checks/verificar_titulacion_revision_archivo.sql` (tres RPC, permiso anónimo false). No repetir la migración base si ya está instalada. La ampliación añade funciones sin modificar fichas al instalar.

Titulación consulta sus propios programas/fichas, con Actualizar y Reintentar; no depende de descargar certificaciones para presentar la navegación. El aviso de ficha anterior abre un panel separado: datos guardados, destino, respaldo y confirmación explícita. No se preselecciona un principal cuando hay varios programas. Destinos con otra ficha, incluso archivada, se muestran ocupados. Guardar una asignación conserva la ficha y consulta el programa devuelto, sin completar el trámite ni cambiar estatus. La captura se protege al cerrar/cambiar contexto; errores conservan selección y respaldo.

Más opciones → Archivar está disponible para ficha anterior y ficha del programa. El nuevo endpoint de archivo requiere identidad, permiso, motivo y revisión, pero no exige programa, modalidad ni iniciar un trámite. Conserva actas, fechas, pago y relación académica almacenada, también en fichas concluidas; no revierte logros. Esto reemplaza en la interfaz el archivado limitado de la RPC general anterior. Archivar no borra físicamente la ficha ni elimina el programa del alumno: ese retiro académico sigue sujeto a antecedentes.

La herramienta administrativa utiliza el mismo panel individual desde Revisar ficha; permite asignar o archivar y refresca el listado retirando solo esa selección del lote. Conserva las demás selecciones y el motivo común. La asociación masiva conserva sus RPC y comprobaciones de concurrencia, sin archivado masivo ni cambios automáticos.

Pendiente contrastar y ensayar roles, atomicidad, conflictos y triggers en PostgreSQL; no se ejecutó SQL. Revisión visual en móvil/tableta/escritorio y ambos temas pendiente. Las pruebas del cliente y contratos SQL no acreditan esos ensayos.

Verificación de esta ampliación: tipado correcto y 413 pruebas aprobadas. Las cinco nuevas cubren archivo sin programa/modalidad, preservación de acta, destinos ajenos/ocupados y contratos SQL. No ejecutan PostgreSQL ni comprueban la instalación real.
