# Carga del catálogo 911 desde SQL Editor

Este paquete sustituye **solamente la ejecución** del archivo grande `20261026110000_catalogo_oficial_911.sql`. Conserva sus fuentes, reglas, campos y huella. No conecta por sí mismo a Supabase.

## Opción rápida: una sola ejecución con PowerShell

Con la migración base ya instalada, desde la raíz del repositorio:

```powershell
.\scripts\cargarCatalogo911.ps1
```

El lanzador valida el paquete actual y solicita el servidor y usuario de **Supabase → Connect → Session pooler**, puerto 5432. `psql` pide la contraseña de la base en la consola; no se guarda ni debe enviarse por chat. Usa los valores exactos de Connect, no el correo de acceso a Supabase. PostgreSQL 18 está instalado en este equipo y se detecta automáticamente.

Ejecuta inicio, todas las partes, publicación y `verificar_estadistica911.sql` en una sola conexión; se detiene ante errores. Puedes repetirlo si ya cargaste partes del mismo lote. No ejecuta la migración base ni otras migraciones. La validación local sin conexión se ejecuta con `-SoloRevisar`. Para verificar además el certificado del servidor, descarga el certificado raíz desde Connect y proporciona `-CertificadoRaiz 'C:\ruta\certificado.crt'`; si el entorno ya exige `verify-ca` o `verify-full`, conserva esa exigencia.

La contraseña es la de la base de datos, no la clave de tu cuenta ni una API key. No es necesario ejecutar además el archivo grande ni las partes manualmente cuando el lanzador termina correctamente.

## Alternativa manual desde SQL Editor

1. Si `20261026100000_expedientes_911.sql` ya terminó correctamente, **no lo repitas**.
2. En la carpeta `76a45a089445/`, abre `000_iniciar.sql`, copia todo su contenido al SQL Editor y ejecútalo.
3. Ejecuta **uno por uno y en orden** los archivos `001_parte_001.sql` hasta `033_parte_033.sql`. Sustituye el texto del editor en cada ejecución; no pegues todos los archivos juntos. Cada uno debe devolver `PARTE_NNN_OK`.
4. Ejecuta `999_publicar.sql`. Debe devolver **CATALOGO_COMPLETO**, **6 cuestionarios**, **1618 reglas** y **3209 campos**.
5. Continúa con `supabase/checks/verificar_estadistica911.sql`.

## Si alguna parte falla

- Detente y conserva el mensaje. Puedes repetir una parte sin duplicar datos. Repetir `000` conserva las partes recibidas del mismo lote.
- La aplicación no utiliza la carga intermedia. Solo `999_publicar.sql` instala el catálogo y sus campos en una transacción, tras verificar todas las huellas.
- No se reemplaza un catálogo existente que difiera del original. No se modifican expedientes, alumnos, recibos, planes ni permisos.
- Cada archivo SQL tiene menos de 48,000 bytes. El archivo grande se conserva para instalación por conexión directa; no hace falta ejecutarlo además de este paquete.

Huella del catálogo: `abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71`.

## Archivos en orden

- [000_iniciar.sql](76a45a089445/000_iniciar.sql) · 4,987 bytes
- [001_parte_001.sql](76a45a089445/001_parte_001.sql) · 41,580 bytes
- [002_parte_002.sql](76a45a089445/002_parte_002.sql) · 41,580 bytes
- [003_parte_003.sql](76a45a089445/003_parte_003.sql) · 41,580 bytes
- [004_parte_004.sql](76a45a089445/004_parte_004.sql) · 41,580 bytes
- [005_parte_005.sql](76a45a089445/005_parte_005.sql) · 41,580 bytes
- [006_parte_006.sql](76a45a089445/006_parte_006.sql) · 41,580 bytes
- [007_parte_007.sql](76a45a089445/007_parte_007.sql) · 41,580 bytes
- [008_parte_008.sql](76a45a089445/008_parte_008.sql) · 41,580 bytes
- [009_parte_009.sql](76a45a089445/009_parte_009.sql) · 41,580 bytes
- [010_parte_010.sql](76a45a089445/010_parte_010.sql) · 41,580 bytes
- [011_parte_011.sql](76a45a089445/011_parte_011.sql) · 41,580 bytes
- [012_parte_012.sql](76a45a089445/012_parte_012.sql) · 41,580 bytes
- [013_parte_013.sql](76a45a089445/013_parte_013.sql) · 41,580 bytes
- [014_parte_014.sql](76a45a089445/014_parte_014.sql) · 41,580 bytes
- [015_parte_015.sql](76a45a089445/015_parte_015.sql) · 41,580 bytes
- [016_parte_016.sql](76a45a089445/016_parte_016.sql) · 22,387 bytes
- [017_parte_017.sql](76a45a089445/017_parte_017.sql) · 41,577 bytes
- [018_parte_018.sql](76a45a089445/018_parte_018.sql) · 41,577 bytes
- [019_parte_019.sql](76a45a089445/019_parte_019.sql) · 41,577 bytes
- [020_parte_020.sql](76a45a089445/020_parte_020.sql) · 41,577 bytes
- [021_parte_021.sql](76a45a089445/021_parte_021.sql) · 41,577 bytes
- [022_parte_022.sql](76a45a089445/022_parte_022.sql) · 41,577 bytes
- [023_parte_023.sql](76a45a089445/023_parte_023.sql) · 41,577 bytes
- [024_parte_024.sql](76a45a089445/024_parte_024.sql) · 41,577 bytes
- [025_parte_025.sql](76a45a089445/025_parte_025.sql) · 41,577 bytes
- [026_parte_026.sql](76a45a089445/026_parte_026.sql) · 41,577 bytes
- [027_parte_027.sql](76a45a089445/027_parte_027.sql) · 41,577 bytes
- [028_parte_028.sql](76a45a089445/028_parte_028.sql) · 41,577 bytes
- [029_parte_029.sql](76a45a089445/029_parte_029.sql) · 41,577 bytes
- [030_parte_030.sql](76a45a089445/030_parte_030.sql) · 41,577 bytes
- [031_parte_031.sql](76a45a089445/031_parte_031.sql) · 41,577 bytes
- [032_parte_032.sql](76a45a089445/032_parte_032.sql) · 41,577 bytes
- [033_parte_033.sql](76a45a089445/033_parte_033.sql) · 36,547 bytes
- [999_publicar.sql](76a45a089445/999_publicar.sql) · 8,503 bytes
