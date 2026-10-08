# Revisión previa de horarios en Supabase Free

**Estado:** el agente no se ha conectado ni ha ejecutado SQL contra la base real. El usuario informó que ya ejecutó `supabase/migrations/20261006120000_horarios_academicos.sql`; el usuario también informó que ejecutó la migración de continuidad de publicación; falta verificar la definición instalada. Una prueba con `ROLLBACK` detecta errores de instalación, pero no sustituye las pruebas funcionales con una copia de la base.

**Preflight informado por el usuario (6 de octubre de 2026, antes de instalar):** resultado 1: las 19 columnas base y sus tipos coinciden; resultado 2: los cinco campos nuevos aún no existían; resultado 3: las cuatro tablas y dos funciones nuevas tenían nombres libres, y `get_my_rol()` existía; resultado 4: los seis nombres de restricciones y disparadores estaban libres; resultado 5: no había disparadores propios en `asignaturas`, `docentes_grupos_asignaturas` ni `grupos`. Estos resultados reducían el riesgo de colisiones, pero no prueban la instalación ni el funcionamiento posterior.

**Estado actual comunicado por el usuario:** ya ejecutó `20261006120000_horarios_academicos.sql` y compartió los 21 resultados `OK` de `supabase/checks/verificar_base_horarios.sql`. Quiere omitir el ensayo con `ROLLBACK` y probar las funciones nuevas directamente. El usuario informó posteriormente que ejecutó la migración de continuidad de publicación. Antes de cualquier otra migración, confirma la función instalada con `supabase/checks/verificar_publicacion_materias_continuas.sql`; no repitas migraciones ya aplicadas. El ensayo de ambas migraciones ya no sirve para este estado porque la primera crea políticas que no se pueden crear por segunda vez.

## 1. Revisar el esquema sin escribir (antes de la primera migración)

En el SQL Editor del proyecto correcto, ejecuta **solo** `supabase/checks/preflight_horarios.sql`. Sus consultas leen metadatos y definiciones de disparadores; no leen filas de alumnos ni pagos. Conserva los cinco resultados para compararlos después. Detén el proceso si aparece `FALTA`, `TIPO_INCOMPATIBLE`, `ALTO` o cualquier nombre nuevo como `REVISAR`: hay que contrastarlo antes de instalar. El archivo `db_schema.sql` es una referencia local, no prueba el estado actual de Supabase.

## 2. Crear un respaldo lógico privado

En una terminal PowerShell con [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) instalada, usa una carpeta **fuera del repositorio**. Sustituye la referencia del proyecto; la contraseña se introduce cuando la CLI la solicite, nunca en el comando ni en este chat.

```powershell
New-Item -ItemType Directory -Path 'C:\RespaldosPrivados' -Force | Out-Null
supabase login
supabase init
supabase link --project-ref TU_REFERENCIA
supabase db dump --linked --role-only -f 'C:\RespaldosPrivados\roles_antes_horarios.sql'
supabase db dump --linked -f 'C:\RespaldosPrivados\schema_antes_horarios.sql'
supabase db dump --linked --data-only --use-copy -f 'C:\RespaldosPrivados\datos_antes_horarios.sql'
Get-Item 'C:\RespaldosPrivados\*_antes_horarios.sql' | Select-Object Name,Length
```

Comprueba que los tres archivos existen y no están vacíos. Contienen información sensible: no los subas a Git ni los compartas. El respaldo lógico no incluye los archivos de Storage y no garantiza una restauración exitosa sin ensayarla. Supabase [recomienda exportaciones manuales en el plan gratuito](https://supabase.com/docs/guides/platform/backups) y [documenta estos tres tipos de volcado](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## 3. Ensayar la instalación con reversión

Si ninguna migración se ha instalado, desde la raíz del repositorio ejecuta `node scripts/generarEnsayoHorarios.mjs`. El comando imprime la ruta de un `.sql` temporal: ábrelo, comprueba que el primer comando es `BEGIN` y el último `ROLLBACK`, y ejecuta **todo el archivo como una sola consulta** en el SQL Editor. Incluye `lock_timeout = 3s` y `statement_timeout = 30s` por instrucción; aun así puede bloquear escrituras mientras dure la transacción. Hazlo en un momento de poca actividad.

Si finaliza correctamente, confirma que la última operación fue `ROLLBACK` y vuelve a ejecutar el chequeo del paso 1: los resultados deben seguir iguales. Si aparece un error o no se confirma la reversión, **no ejecutes `COMMIT` ni avances**; cierra la sesión o ejecuta `ROLLBACK` en la misma conexión y revisa el mensaje. No ejecutes por separado fragmentos del archivo temporal.

**Si la primera migración ya se instaló:** conserva el respaldo y ejecuta `node scripts/generarEnsayoHorarios.mjs --solo-publicacion`. Este archivo temporal incluye únicamente la segunda migración, también entre `BEGIN` y `ROLLBACK`. Si el ensayo termina bien, la instalación real de la segunda migración crea la función y sus permisos; no ejecuta la función ni cambia asignaciones. La primera publicación de un horario es una acción posterior y sí modifica asignaciones docentes.

## 4. Instalación posterior

El ensayo no instala nada. Antes de aplicar realmente las migraciones, resuelve los hallazgos del chequeo y obtén autorización explícita para escribir en la base. Después de instalarlas, verifica alta y edición de asignaturas, grupos y docentes con los roles habituales; configura un ciclo de ejemplo y prueba generación, publicación, sustitución y exportación. Publicar un horario sí puede actualizar docentes y horas en asignaciones existentes. Conserva el respaldo hasta completar esta revisión.

## 5. Máximo semanal por docente

La migración adicional `supabase/migrations/20261007170000_max_horas_semanales_docente.sql` requiere que ya existan las tablas creadas por la primera migración y la función de publicación de la segunda. Antes de aplicarla, ejecuta `supabase/checks/preflight_max_horas_docente.sql` y revisa sus tres resultados: tablas presentes, columna libre o `integer`, y nombres de función/disparador libres. Después ejecuta el archivo de migración completo en SQL Editor y confirma los cuatro `OK` de `supabase/checks/verificar_max_horas_docente.sql`. El agente no ha ejecutado ninguno de estos archivos contra Supabase.

Esta migración añade una columna anulable y un disparador para futuras inserciones o modificaciones de cargas publicadas. No borra ni cambia filas actuales. Un máximo configurado que sea menor que una carga ya publicada requiere ajustar y volver a publicar ese horario antes de poder añadir horas al docente. La interfaz sigue permitiendo editar la disponibilidad si esta migración aún no se aplicó; el nuevo campo aparece deshabilitado.

## 6. Omitir materias complementarias del horario oficial

`supabase/migrations/20261007190000_publicar_horario_omitir_complementarias.sql` reemplaza la función de publicación **con la misma firma**, después de la migración de publicación original. Exige todos los grupos activos y sus asignaturas no complementarias; permite omitir solo asignaturas con clave `266` o, si la clave está vacía, nombre «Complementaria». La clave prevalece si ambos campos discrepan. No borra ni modifica datos al instalarse. Al publicar, conserva sin cambios las asignaciones omitidas y crea el snapshot solo con las incluidas. La interfaz depende de esta actualización para publicar con complementarias desmarcadas; si no está instalada, el servidor rechazará ese borrador. Este agente solo preparó el archivo y no lo ejecutó en Supabase.

## 7. Continuidad de materias al publicar

`supabase/migrations/20261007200000_publicar_horario_materias_continuas.sql` vuelve a definir la función `publicar_horario_academico` con **la misma firma, permisos y validaciones** de la versión que permite omitir complementarias. Aplícala después de `20261007190000_publicar_horario_omitir_complementarias.sql`. Antes de sustituir un horario publicado o insertar filas, rechaza las sesiones de una misma asignación y día cuando dejan un intervalo entre sí; acepta sesiones adyacentes y sesiones en días distintos. El mensaje identifica materia, grupo y número de día (1 = lunes). Instalar el archivo no publica horarios, no modifica tablas ni borra datos. El agente no lo ejecutó; el usuario informó que ya lo aplicó en Supabase.

Después de aplicarla, ejecuta `supabase/checks/verificar_publicacion_materias_continuas.sql`: debe devolver `OK: VALIDACIÓN INSTALADA`. Este chequeo solo lee la definición de la función; una prueba funcional real sigue pendiente hasta que se use en el entorno de destino. La regla se exige a **nuevas publicaciones**; no modifica ni revisa automáticamente versiones históricas.

## 8. Guardar y retomar borradores

Antes, ejecuta `supabase/checks/preflight_horarios_borradores.sql`: debe devolver `LIBRE` para la tabla y `PRESENTE` para la tabla de ciclos y la función de rol. Si el nombre ya existe, revisa su estructura antes de aplicar el archivo.

`supabase/migrations/20261007210000_horarios_borradores.sql` crea únicamente la tabla `horarios_borradores`, su índice y políticas RLS para Administración y Coordinación Académica. No altera asignaciones, horarios publicados ni datos existentes. Requiere `ciclos_escolares` y `get_my_rol()`. Ejecútala una sola vez desde SQL Editor en el proyecto correcto; no la mezcles con las migraciones de publicación. Después comprueba que la tabla aparece y que un usuario autorizado puede guardar, abrir y eliminar un borrador desde la pantalla de horarios. Un usuario sin esos roles no debe poder consultarlos ni escribirlos.

La interfaz puede desplegarse antes de esta migración, pero la sección de borradores mostrará un error de consulta hasta que se aplique. Abrir un borrador nunca escribe asignaciones docentes ni crea una versión oficial; publicar sigue siendo un paso separado con sus propias validaciones. El agente preparó el SQL pero no lo ejecutó en la base real.
