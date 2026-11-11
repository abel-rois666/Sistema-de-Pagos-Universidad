# Asociaciones académicas y vistas privadas del listado

Preparado el 09/11/2026. SQL **no ejecutado**; no se retiraron asociaciones ni se guardaron preferencias en Supabase. No requiere desplegar una Edge Function ni añadir dependencias.

## Alcance y operación

### Retirar una asociación añadida por error

En **Ficha del alumno → Trayectoria e inscripciones → Programas del alumno**, Administración dispone de **Revisar asociación errónea**. La acción retira la relación alumno–programa; no borra el plan del catálogo ni modifica pagos, recibos, materias o programas de otros alumnos.

1. El servidor revisa el ID exacto de alumno y asociación.
2. Muestra antecedentes y bloqueos. Ser el programa principal, no tener un único principal, conservar un logro concluido, materias/calificaciones, grupos o referencias a la asociación impide retirarla. Se incluyen certificados archivados, inscripciones, preparaciones, ingreso acreditado, bitácoras y referencias adicionales declaradas como FK. Trámites anteriores de certificación/titulación sin programa identificado requieren revisión individual.
3. Solo si la revisión lo permite aparecen motivo y confirmación explícita. Se exige un motivo de 10–1000 caracteres.
4. El servidor vuelve a revisar, compara la huella, bloquea cambios concurrentes y guarda la auditoría en la misma transacción que elimina la asociación. Un cambio posterior a la revisión obliga a actualizarla. Un bloqueo de otra operación termina tras tres segundos sin retirar nada.
5. La ficha actualiza sus programas después de una respuesta confirmada. Un error no se interpreta como eliminación realizada.

Si la asociación incorrecta es principal, primero se debe establecer como principal el programa correcto mediante la operación existente. El retiro no elige otro principal ni reasigna antecedentes. Archivar un certificado **no elimina su historial ni habilita el retiro**. Esta herramienta no corrige ni fusiona programas con antecedentes.

Ampliación opcional posterior: [Retirar asociaciones de prueba](RETIRAR_ASOCIACIONES_DE_PRUEBA.md), con migración independiente `20261109220000`, permite revisar materias vacías y declarar certificaciones sin evidencia como prueba, conservando respaldo y fichas archivadas. No relaja los bloqueos del retiro normal ni se activa automáticamente.

El trigger nuevo protege también el DELETE directo de asociaciones. Conserva la cascada existente cuando se elimina al alumno desde el flujo autorizado previo; no reemplaza la revisión de dependencias de ese flujo. No añade una vía para borrar alumnos ni recibos. Los antecedentes sin relación inequívoca al programa no se reasignan por nombre o fecha. La revisión no es una auditoría financiera del alumno.

### Vistas guardadas

En **Reportes → Listado General de Alumnos**, **Guardar como nueva** conserva columnas opcionales, filtros principales y de columnas, orden y referencia de edad. Puede actualizarse una vista, aplicarse otra, restablecer la consulta o eliminar únicamente la configuración guardada.

- Son privadas por cuenta de Supabase Auth, disponibles para Administración y Coordinación de Control Escolar, igual que el reporte. El servidor obtiene al propietario de la sesión; no acepta otro propietario desde el cliente.
- Hasta 20 vistas por cuenta, nombre de 2–80 caracteres, nombres únicos por cuenta y una sola predeterminada opcional.
- La predeterminada se aplica al entrar si el usuario todavía no cambió la consulta. Una respuesta tardía no sustituye filtros ya ajustados. Actualizar la lista no reaplica la predeterminada.
- Edad permite usar la fecha del día al aplicar la vista o una fecha fija válida, no futura. Ocultar una columna continúa limpiando su filtro conforme al comportamiento del reporte.
- Ciclos se conservan por UUID. Una opción que dejó de existir no se elimina silenciosamente ampliando la población; los ciclos ausentes se señalan. Configuraciones incompatibles muestran un error en lugar de aplicarse parcialmente.
- Revisiones impiden sobrescribir cambios de otra sesión. Ante conflicto, cancelar la captura, actualizar vistas y volver a revisar. El diálogo conserva la captura mientras permanece abierto.
- No se guardan filas, nombres de alumnos, resultados exportados ni instantáneas del padrón. Al aplicar una vista se consultan los datos actuales; no reconstruye una matrícula histórica.
- Eliminar una vista o restablecer la consulta conserva alumnos, documentos y otras vistas. Eliminar la predeterminada deja la cuenta sin predeterminada.

## Instalación manual pendiente

1. Revisar y ejecutar **solo lectura**: `supabase/checks/preflight_asociaciones_y_vistas_20261109.sql`. Confirmar tablas/columnas, FK, triggers y roles del esquema realmente instalado. Si difieren de la referencia, detener la instalación y revisar el resultado.
2. Preparar un respaldo del esquema y el procedimiento de recuperación de la institución. Para validar SQL y permisos, utilizar primero una copia de ensayo. Esta entrega no acredita ejecución contra la base instalada.
3. Aplicar por separado y en este orden:
   - `supabase/migrations/20261109200000_vistas_privadas_listado_alumnos.sql`
   - `supabase/migrations/20261109210000_retirar_asociacion_academica_segura.sql`
4. Ejecutar la consulta de lectura `supabase/checks/verificar_asociaciones_y_vistas_20261109.sql`: cinco RPC públicas autenticadas sin acceso anónimo; dos tablas con RLS sin escritura directa; trigger de retiro habilitado y los dos índices únicos de vistas. Conservar los triggers anteriores de estatus institucional.
5. Ensayar desde sesiones reales autorizadas en una base de prueba: vistas de dos cuentas, acceso rechazado por rol, conflicto de revisión, principal bloqueado, calificaciones y certificado archivado bloqueados, asociación adicional vacía retirable y auditoría creada. Comprobar también que la eliminación preexistente de un alumno sin dependencias sigue su flujo. El SQL Editor sin sesión Auth no sirve para ensayar las RPC autenticadas.
6. Publicar el cliente solo después de verificar esas operaciones. Sin las RPC, el reporte sigue permitiendo consultas manuales y muestra que faltan las vistas; el retiro se bloquea y explica qué actualización falta. No hay fallback a DELETE directo ni persistencia privada en el navegador.

Estas migraciones son independientes de la migración pendiente de folios de recibos. No aplicar indiscriminadamente todos los archivos del directorio ni volver a ejecutar migraciones ya instaladas.

## Verificación reproducible local

- `scripts/ensayoVistasListado.html`: React StrictMode, cuentas y padrón ficticios, peticiones externas interceptadas. Opciones `oscuro`, `sin-migracion`, `conflicto`, `demora`. La persistencia del ensayo usa claves locales exclusivas de cuentas ficticias; la aplicación real utiliza las RPC privadas.
- `scripts/ensayoDisenoHistorial.html?retiro`: ficha completa ficticia, sin canales reales; opciones `retiro-certificado`, `retiro-notas`, `retiro-desactualizado`, `sin-retiro`, `oscuro`. La retirada solo altera el arreglo ficticio del ensayo.
- `tests/vistasListado.test.ts`: contrato de configuración, filtros/UUID, fechas, alcance y rechazo de configuraciones incompatibles.

La revisión de código y los ensayos del cliente no sustituyen las pruebas SQL de autorización, concurrencia, triggers y rollback contra el esquema instalado. Permanecen pendientes porque la autorización de esta entrega es preparar, sin ejecutar SQL.

Resultado local: `npm run lint` y `npm run build` aprobados; 386 pruebas aprobadas. La compilación conserva el aviso de paquetes grandes. Vistas: carga inicial en StrictMode, creación, actualización, predeterminada al volver, aplicación confirmada, eliminación sin cambiar el listado, separación entre dos cuentas, conflicto sin perder captura, respuesta lenta sin reemplazar el filtro y consulta/exportación manual sin RPC. Diseño del listado comprobado en 390/820/1440 px y ambos temas, sin desbordamiento general; diálogo de guardado móvil claro y descarte de captura. Retiro: ensayo integrado con principal bloqueado, notas y certificado archivado bloqueados, retiro de asociación adicional vacía con actualización de la ficha, conflicto con motivo conservado, confirmación de descarte y acción oculta a Control Escolar. Diálogos de retiro revisados en escritorio claro, tableta clara y móvil oscuro. Sin errores de consola observados en el ensayo final del listado. No se dan por verificados otros módulos ni la protección global de navegación desde estos fixtures.
