# Ejecuta solo el paquete oficial 911 indicado por su manifiesto.
# -SoloRevisar valida archivos y psql sin conectarse a ninguna base.
[CmdletBinding()]
param(
    [string]$Servidor = '',
    [string]$UsuarioDb = '',
    [ValidateRange(1, 65535)][int]$Puerto = 5432,
    [string]$RutaPsql = '',
    [string]$CertificadoRaiz = '',
    [switch]$SoloRevisar
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$raiz911 = Split-Path -Parent $PSScriptRoot
$base911 = Join-Path $raiz911 'supabase/cargas/911_2026_2027_sql_editor'
$puntero911 = Get-Content -LiteralPath (Join-Path $base911 'paquete_actual.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($puntero911.carpeta -notmatch '^[a-f0-9]{12}$') { throw 'Carpeta de paquete no valida.' }
$carpeta911 = Join-Path $base911 $puntero911.carpeta
$manifiesto911 = Get-Content -LiteralPath (Join-Path $carpeta911 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifiesto911.lote -cne $puntero911.lote -or $manifiesto911.sha256_catalogo -cne $puntero911.sha256_catalogo -or $manifiesto911.sha256_reglas -cne $puntero911.sha256_reglas) {
    throw 'El puntero y el manifiesto no corresponden al mismo paquete.'
}

function Get-HuellaTexto911([string]$Texto911) {
    $motor911 = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($motor911.ComputeHash([Text.Encoding]::UTF8.GetBytes($Texto911)))).Replace('-', '').ToLowerInvariant()
    } finally { $motor911.Dispose() }
}

# Confirma que se cargara el catalogo actual del repositorio, no un paquete anterior.
$original911 = Get-Content -LiteralPath (Join-Path $raiz911 'supabase/migrations/20261026110000_catalogo_oficial_911.sql') -Raw -Encoding UTF8
$fuentes911 = [regex]::Match($original911, '\$cat911\$([\s\S]*?)\$cat911\$')
$reglas911 = [regex]::Match($original911, '\$reg911\$([\s\S]*?)\$reg911\$')
if (-not $fuentes911.Success -or -not $reglas911.Success) { throw 'SQL original sin las fuentes esperadas.' }
if ((Get-HuellaTexto911 $fuentes911.Groups[1].Value) -cne $manifiesto911.sha256_catalogo -or (Get-HuellaTexto911 $reglas911.Groups[1].Value) -cne $manifiesto911.sha256_reglas) {
    throw 'El paquete esta desactualizado. Regenera con scripts/prepararCatalogo911SqlEditor.py.'
}

$archivos911 = @($manifiesto911.archivos)
$partes911 = @($manifiesto911.partes.PSObject.Properties).Count
if ($archivos911.Count -ne ($partes911 + 2)) { throw 'Cantidad de archivos incorrecta.' }
$rutas911 = @()
for ($indice911 = 0; $indice911 -lt $archivos911.Count; $indice911++) {
    $nombreEsperado911 = if ($indice911 -eq 0) { '000_iniciar.sql' }
        elseif ($indice911 -eq ($archivos911.Count - 1)) { '999_publicar.sql' }
        else { '{0:D3}_parte_{0:D3}.sql' -f $indice911 }
    $entrada911 = $archivos911[$indice911]
    if ($entrada911.archivo -cne $nombreEsperado911) { throw 'Orden de archivos incorrecto.' }
    $ruta911 = Join-Path $carpeta911 $nombreEsperado911
    $archivo911 = Get-Item -LiteralPath $ruta911
    $huellaArchivo911 = (Get-FileHash -LiteralPath $ruta911 -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($archivo911.Length -ne $entrada911.bytes -or $huellaArchivo911 -cne $entrada911.sha256) {
        throw "Archivo modificado o incompleto: $nombreEsperado911"
    }
    $rutas911 += $archivo911.FullName
}

if (-not $RutaPsql) {
    $comando911 = Get-Command psql -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($comando911) { $RutaPsql = $comando911.Source }
    else {
        $pg911 = Join-Path $env:ProgramFiles 'PostgreSQL'
        if (Test-Path -LiteralPath $pg911) {
            $versiones911 = Get-ChildItem -LiteralPath $pg911 -Directory |
                Where-Object { $_.Name -match '^\d+(\.\d+)?$' } |
                Sort-Object { [version]($_.Name + '.0') } -Descending
            foreach ($version911 in $versiones911) {
                $posible911 = Join-Path $version911.FullName 'bin/psql.exe'
                if (Test-Path -LiteralPath $posible911 -PathType Leaf) { $RutaPsql = $posible911; break }
            }
        }
    }
}
if (-not $RutaPsql -or -not (Test-Path -LiteralPath $RutaPsql -PathType Leaf)) {
    throw 'No se encontro psql. Indica -RutaPsql con la ruta al cliente PostgreSQL instalado.'
}
& $RutaPsql --version
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el cliente psql.' }
Write-Host "Paquete verificado: $($archivos911.Count) archivos, $($manifiesto911.campos) campos y $($manifiesto911.reglas) reglas."
Write-Host "Huella: $($manifiesto911.sha256_catalogo)"
if ($SoloRevisar) {
    Write-Host 'REVISION_OK: no se abrio conexion ni se ejecuto SQL.'
    return
}

if (-not $Servidor) { $Servidor = Read-Host 'Servidor de Supabase Connect > Session pooler (solo host)' }
if (-not $UsuarioDb) { $UsuarioDb = Read-Host 'Usuario de esa conexion (por ejemplo postgres.PROJECT_REF)' }
$Servidor = $Servidor.Trim()
$UsuarioDb = $UsuarioDb.Trim()
if ($Servidor -notmatch '^(?:db\.[a-z0-9-]+\.supabase\.co|[a-z0-9.-]+\.pooler\.supabase\.com)$') {
    throw 'Copia solo el host de Connect; no pegues una URL con contrasena.'
}
if ($UsuarioDb -notmatch '^[a-zA-Z0-9_.-]+$') { throw 'Usuario de conexion no valido.' }

$conexion911 = 'dbname=postgres client_encoding=UTF8 sslmode=require connect_timeout=15'
if ($env:PGSSLMODE -in @('verify-ca', 'verify-full')) {
    $conexion911 = "dbname=postgres client_encoding=UTF8 sslmode=$($env:PGSSLMODE) connect_timeout=15"
}
if ($CertificadoRaiz) {
    $cert911 = (Get-Item -LiteralPath $CertificadoRaiz).FullName.Replace('\', '\\').Replace("'", "\'")
    $conexion911 = "dbname=postgres client_encoding=UTF8 sslmode=verify-full sslrootcert='$cert911' connect_timeout=15"
}
$argumentos911 = @('-X', '-W', '--host', $Servidor, '--port', [string]$Puerto,
    '--username', $UsuarioDb, '--dbname', $conexion911, '--set', 'ON_ERROR_STOP=1')
foreach ($ruta911 in $rutas911) { $argumentos911 += @('--file', $ruta911) }
$argumentos911 += @('--file', (Join-Path $raiz911 'supabase/checks/verificar_estadistica911.sql'))
Write-Host "Destino: ${Servidor}:$Puerto / postgres / $UsuarioDb"
Write-Host 'psql solicitara la contrasena de la base. Se ejecutara solo la carga 911 y su verificacion.'
& $RutaPsql @argumentos911
if ($LASTEXITCODE -ne 0) {
    throw 'Carga detenida por un error. Conserva el mensaje; puedes repetir el lanzador sin duplicar las partes.'
}
Write-Host 'Carga terminada. Revisa CATALOGO_COMPLETO y los resultados de verificacion anteriores.'
