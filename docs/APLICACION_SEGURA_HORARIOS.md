# Revisión previa de horarios en Supabase Free

**Estado:** el agente no se ha conectado ni ha ejecutado SQL contra la base real. El usuario informó que ya ejecutó `supabase/migrations/20261006120000_horarios_academicos.sql`; la segunda migración sigue pendiente. Una prueba con `ROLLBACK` detecta errores de instalación, pero no sustituye las pruebas funcionales con una copia de la base.

**Preflight informado por el usuario (6 de octubre de 2026, antes de instalar):** resultado 1: las 19 columnas base y sus tipos coinciden; resultado 2: los cinco campos nuevos aún no existían; resultado 3: las cuatro tablas y dos funciones nuevas tenían nombres libres, y `get_my_rol()` existía; resultado 4: los seis nombres de restricciones y disparadores estaban libres; resultado 5: no había disparadores propios en `asignaturas`, `docentes_grupos_asignaturas` ni `grupos`. Estos resultados reducían el riesgo de colisiones, pero no prueban la instalación ni el funcionamiento posterior.

**Estado actual comunicado por el usuario:** ya ejecutó `20261006120000_horarios_academicos.sql` y compartió los 21 resultados `OK` de `supabase/checks/verificar_base_horarios.sql`. Quiere omitir el ensayo con `ROLLBACK` y probar las funciones nuevas directamente. La migración de publicación sigue pendiente. El ensayo de ambas migraciones ya no sirve para este estado porque la primera crea políticas que no se pueden crear por segunda vez.

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
