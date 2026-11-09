# Gestión de administrativos y cuentas de acceso

Preparación autorizada del 09/11/2026. No se ejecutó SQL ni se crearon o eliminaron registros reales.

## Operación

En Recursos Humanos → Personal, Administración dispone de **Más → Gestionar cuenta de acceso** y **Más → Eliminar administrativo**. La situación laboral, la habilitación docente y el estado de la cuenta son independientes.

- **Crear cuenta nueva:** usuario, contraseña inicial, correo opcional, rol explícito, respaldo de identidad y confirmación. El cargo no concede permisos. Sin correo se utiliza la dirección técnica interna del mecanismo actual. La cuenta se crea en Auth desde `manage-users` y solo se confirma después de vincular el perfil administrativo.
- **Vincular cuenta existente:** buscar por usuario, revisar identidad, elegir la cuenta y confirmar con motivo. El rol y el estado activo/inactivo se conservan. Solo se aceptan cuentas con Auth y sin un vínculo administrativo o docente contradictorio. No se vincula por coincidencia de nombre.
- Si la persona ya tiene cuenta por su función docente y una identidad compartida explícita, se muestra esa cuenta y se ofrece vincularla al administrativo. No se crea otra. Si se añade la función docente después de la cuenta administrativa, esta misma operación permite completar el vínculo docente sin cambiar el rol. El alta docente anterior detecta ese acceso y orienta a Personal; el trigger serializa las nuevas vinculaciones docentes para impedir duplicados concurrentes. No se corrigen ni fusionan duplicados históricos al instalar. Varios accesos contradictorios requieren revisión antes de continuar.
- Las contraseñas, los roles y la reactivación/desactivación de cuentas existentes siguen en **Configuración → Usuarios**. Vincular una cuenta desactivada no la reactiva. El modelo de un rol por cuenta se conserva; no se añaden permisos por acumular funciones laborales.
- **Eliminar administrativo:** consulta previa de dependencias, motivo y confirmación. El servidor bloquea referencias entrantes —incluidas relaciones CASCADE y SET NULL—, cuentas, evaluaciones, firmas, documentación y expediente compartido. Referencias compuestas o distintas de una FK simple por ID requieren revisión. Cuando existe historial debe usarse la situación administrativa de la ficha para registrar la baja.

La eliminación autorizada borra solo la fila de `empleados`, registra una auditoría y conserva la identidad compartida y el docente. No se borran evaluaciones, documentos, archivos, cuentas o personas. El servidor vuelve a comprobar las dependencias dentro de la transacción y compara el registro revisado con el actual. No hay eliminación masiva nueva.

## Instalación pendiente

1. Confirmar las migraciones de Personal `20261108120000`, `20261108150000` y `20261108180000`; no repetir las que estén instaladas. Ejecutar únicamente el preflight de lectura `supabase/checks/preflight_gestion_administrativos_20261109.sql` y revisar columnas, funciones, FKs, triggers y roles del esquema real. La columna nueva y las RPC deben estar ausentes antes de la primera aplicación.
2. Revisar y aplicar `supabase/migrations/20261109160000_gestion_administrativos_y_cuentas.sql` completa en una transacción. Añade `usuarios.empleado_id` con FK restrictiva e índice único parcial; deja todas las asociaciones nuevas vacías. No hace backfill ni modifica los roles existentes. Su auditoría tiene RLS y carece de permisos directos del cliente. Los cambios de vínculo y los borrados administrativos se realizan mediante las RPC, con permiso de administrador activo autenticado.
3. Ejecutar `supabase/checks/verificar_gestion_administrativos_20261109.sql`: cinco RPC públicas con autorización interna y `search_path` fijo; ninguna ejecutable por `anon`; helpers privados sin ejecución de `authenticated`; auditoría sin escritura directa ni lectura anónima; borrado directo de empleados revocado. Revisar también las políticas efectivas instaladas y las referencias del esquema real.
4. Desplegar la Edge Function **manage-users completa**, conservando `index.ts`, `cuentaAdministrativa.ts`, `cuentaDocenteExistente.ts` y `../_shared/cuentaAdministrativa.ts`. Copiar únicamente `index.ts` al editor no incluye sus importaciones. Con CLI, desde el repositorio: `supabase functions deploy manage-users --project-ref <PROJECT_REF>`. Conservar la configuración de autenticación existente y sus secretos; no trasladar la clave de servicio al cliente.
5. Publicar el frontend una vez verificado el servidor. Antes de la migración, el directorio mantiene su consulta y las operaciones nuevas muestran que falta instalar la actualización. Antes de desplegar la función nueva, las cuentas nuevas no pueden completarse mediante la acción `CREATE_ADMINISTRATIVO`.
6. Validar con cuentas y registros de prueba los roles, conflictos de revisión, dependencias, rechazo de escritura directa, función doble, creación, vínculo y compensaciones de Auth. La separación Auth/PostgreSQL no constituye una transacción distribuida: si el vínculo falla, la función comprueba si llegó a confirmarse y solo intenta revertir la cuenta recién creada sin vínculo. Una respuesta incierta o una compensación fallida exige revisar Usuarios antes de repetir el alta. No se borra una cuenta preexistente para resolver un error.

### Despliegue manual desde el editor del Dashboard

Si el editor informa `Module not found .../source/cuentaAdministrativa.ts`, recibió la fuente modular sin los archivos que importa. La cabecera antigua que invitaba a pegar `index.ts` sola estaba desactualizada.

1. Abrir **`supabase/dashboard/manage-users.ts`** en este repositorio. Es el archivo único generado, con los tres módulos locales incluidos.
2. En la función existente **manage-users → Code**, sustituir todo el contenido de `index.ts` por todo el contenido de ese archivo y desplegar. No pegar el generador ni las fuentes modulares por separado. Conservar los secretos y la configuración de autenticación actuales.
3. Si cambia cualquier fuente de la función, ejecutar `npm run preparar:manage-users-dashboard` y volver a copiar el archivo generado. `node scripts/generarManageUsersDashboard.mjs --check` comprueba que coincide con las fuentes; no despliega ni conecta a Supabase. El generador reutiliza esbuild, ya instalado con Vite, sin añadir dependencias.

El archivo único mantiene la importación HTTPS original de Supabase y elimina las importaciones a archivos locales que faltaban en el editor. La fuente modular continúa siendo la utilizada por la CLI. Ninguna modalidad aplica migraciones SQL automáticamente.

## Alcance de comprobación

Pruebas locales con servicios simulados: validación de campos/roles, identidad explícita, cuenta existente, no llamar Auth ante revisión fallida o duplicados, éxito solo tras vínculo confirmado, respuesta perdida y compensación limitada al alta nueva. El ensayo de interfaz intercepta toda la red externa y utiliza exclusivamente personas y cuentas ficticias. No prueba la instalación SQL, RLS, triggers, concurrencia ni credenciales del servidor real. No se ejecutó esta migración en ningún entorno.
