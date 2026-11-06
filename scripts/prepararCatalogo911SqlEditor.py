"""Empaqueta el catálogo existente en consultas pequeñas, sin cambiar su contenido.

Uso: python scripts/prepararCatalogo911SqlEditor.py
No conecta a Supabase. La carga intermedia usa una edición CARGA_ que la app no acepta.
"""
import hashlib
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
MAX_FRAGMENTO = 40_000
MAX_ARCHIVO = 48_000
FORMATO = '911-SQL-EDITOR-v1'

def huella(texto):
    return hashlib.sha256(texto.encode('utf-8')).hexdigest()

def fragmentar(texto, limite=MAX_FRAGMENTO):
    partes, actual, size = [], [], 0
    for caracter in texto:
        n = len(caracter.encode('utf-8'))
        if size + n > limite and actual:
            partes.append(''.join(actual))
            actual, size = [], 0
        actual.append(caracter)
        size += n
    if actual:
        partes.append(''.join(actual))
    return partes

def literal(texto, etiqueta):
    delimitador = '$' + etiqueta + '$'
    if delimitador in texto:
        raise ValueError('El contenido coincide con el delimitador SQL reservado')
    return delimitador + texto + delimitador

def generar(entrada=None, destino=None):
    entrada = Path(entrada or RAIZ/'supabase/migrations/20261026110000_catalogo_oficial_911.sql')
    sql = entrada.read_text(encoding='utf-8')
    cabecera = re.search(r"values \('([^']+)','([a-f0-9]{64})',\$cat911\$", sql)
    if not cabecera or sql.count('$cat911$') != 2 or sql.count('$reg911$') != 2:
        raise ValueError('El SQL fuente no tiene el formato del catálogo generado')
    edicion, sha_catalogo = cabecera.groups()
    fuentes_txt = sql.split('$cat911$')[1]
    reglas_txt = sql.split('$reg911$')[1]
    if huella(fuentes_txt) != sha_catalogo:
        raise ValueError('La huella del catálogo original no coincide')
    fuentes, reglas = json.loads(fuentes_txt), json.loads(reglas_txt)
    if not isinstance(fuentes, dict) or not isinstance(reglas, list) or len(fuentes) != 6:
        raise ValueError('Se esperan seis cuestionarios y una lista de reglas')
    campos = [(q,c['codigo']) for q,f in fuentes.items() for c in f['campos']]
    if len(set(campos)) != len(campos):
        raise ValueError('Hay claves de campo duplicadas en el catálogo original')
    lote = huella(FORMATO + str(MAX_FRAGMENTO) + fuentes_txt + '\n' + reglas_txt)
    sha_carga = 'CARGA911:' + lote
    edicion_carga = 'CARGA_' + edicion
    fragmentos = {}
    for tipo, texto in [('fuentes', fuentes_txt), ('reglas', reglas_txt)]:
        for n, parte in enumerate(fragmentar(texto), 1):
            fragmentos[f'{tipo}_{n:04d}'] = parte
    meta = {'formato':FORMATO,'lote':lote,'edicion':edicion,'sha256_catalogo':sha_catalogo,
            'sha256_reglas':huella(reglas_txt),'cuestionarios':len(fuentes),'campos':len(campos),
            'reglas':len(reglas),'partes':{k:{'sha256':huella(v),'bytes':len(v.encode('utf8'))} for k,v in fragmentos.items()}}
    meta_literal = literal(json.dumps(meta,ensure_ascii=False,separators=(',',':')), 'meta911')
    carpeta_base = Path(destino or RAIZ/'supabase/cargas/911_2026_2027_sql_editor')
    carpeta = carpeta_base/lote[:12]
    carpeta.mkdir(parents=True,exist_ok=True)
    # Las huellas de archivo deben sobrevivir a checkouts con core.autocrlf en Windows.
    (carpeta_base/'.gitattributes').write_bytes(b'*.sql text eol=lf\n')
    escritos=[]
    def guardar(nombre, cuerpo):
        contenido='-- Carga oficial 911 por partes. Ejecutar ESTE archivo completo, individualmente.\n-- Lote '+lote+'\nbegin;\n'+cuerpo+'\ncommit;\n'
        if len(contenido.encode('utf8')) >= MAX_ARCHIVO:
            raise ValueError(f'{nombre} supera el tamaño permitido del paquete')
        # Bytes explícitos: Windows no debe convertir LF a CRLF después de calcular la huella.
        (carpeta/nombre).write_bytes(contenido.encode('utf8'))
        escritos.append({'archivo':nombre,'bytes':len(contenido.encode('utf8')),'sha256':huella(contenido)})
    guardar('000_iniciar.sql',f"""do $inicio911$
declare v_meta jsonb={meta_literal}::jsonb;v_existente jsonb;
begin
 if to_regclass('public.s911_catalogos') is null or to_regclass('public.s911_campos') is null then
  raise exception 'Instala primero 20261026100000_expedientes_911.sql';
 end if;
 insert into public.s911_catalogos(edicion,sha256,fuentes,reglas)
 values('{edicion_carga}','{sha_carga}',jsonb_build_object('metadatos',v_meta,'fragmentos','{{}}'::jsonb),'[]')
 on conflict(sha256) do nothing;
 select fuentes into v_existente from public.s911_catalogos where sha256='{sha_carga}' and edicion='{edicion_carga}' for update;
 if not found or v_existente->'metadatos' is distinct from v_meta then
  raise exception 'La carga existente no corresponde a este paquete';
 end if;
end $inicio911$;
select 'CARGA_PREPARADA' estado,{len(fragmentos)} partes_a_ejecutar;
""")
    for n,(clave,parte) in enumerate(fragmentos.items(),1):
        tag='fragmento911_'+huella(parte)[:12]
        cuerpo=f"""do $parte911$
declare v_fragmento text={literal(parte,tag)};v_datos jsonb;v_esperada text;
begin
 select fuentes into v_datos from public.s911_catalogos where sha256='{sha_carga}' and edicion='{edicion_carga}' for update;
 if not found then raise exception 'Falta iniciar la carga o ya se publicó. Revisa 000_iniciar.sql';end if;
 v_esperada=v_datos#>>'{{metadatos,partes,{clave},sha256}}';
 if v_datos#>>'{{metadatos,lote}}' is distinct from '{lote}' or v_esperada is distinct from '{huella(parte)}'
 or encode(sha256(convert_to(v_fragmento,'UTF8')),'hex') is distinct from v_esperada then
  raise exception 'Fragmento {clave} incorrecto; no se guardó';
 end if;
 update public.s911_catalogos set fuentes=jsonb_set(fuentes,'{{fragmentos,{clave}}}',to_jsonb(v_fragmento),true)
 where sha256='{sha_carga}' and edicion='{edicion_carga}';
end $parte911$;
select 'PARTE_{n:03d}_OK' estado,
 (select count(*) from jsonb_object_keys(fuentes->'fragmentos')) partes_recibidas,
 {len(fragmentos)} partes_esperadas
from public.s911_catalogos where sha256='{sha_carga}' and edicion='{edicion_carga}';
"""
        if '$parte911$' in parte:
            raise ValueError('Un fragmento contiene el delimitador exterior de su bloque')
        guardar(f'{n:03d}_parte_{n:03d}.sql',cuerpo)
    guardar('999_publicar.sql',f"""do $publicar911$
declare v_meta jsonb={meta_literal}::jsonb;v_datos jsonb;v_item record;
 v_fuentes_texto text;v_reglas_texto text;v_fuentes jsonb;v_reglas jsonb;v_existente record;v_campos integer;
begin
 select fuentes into v_datos from public.s911_catalogos where sha256='{sha_carga}' and edicion='{edicion_carga}' for update;
 if not found then
  if exists(select 1 from public.s911_catalogos c where c.edicion='{edicion}' and c.sha256='{sha_catalogo}'
    and jsonb_array_length(c.reglas)={len(reglas)}
    and (select count(*) from public.s911_campos f where f.catalogo_sha256=c.sha256)={len(campos)}) then
   raise notice 'El catálogo ya está publicado';return;
  end if;
  raise exception 'Falta la carga. Ejecuta 000 y sus partes antes de publicar';
 end if;
 if v_datos->'metadatos' is distinct from v_meta then raise exception 'Paquete de otra versión';end if;
 if (select count(*) from jsonb_object_keys(v_datos->'fragmentos'))<>{len(fragmentos)} then
  raise exception 'Faltan partes: ejecuta los archivos numerados antes de publicar';
 end if;
 for v_item in select key,value from jsonb_each(v_meta->'partes') loop
  if encode(sha256(convert_to(v_datos#>>array['fragmentos',v_item.key],'UTF8')),'hex') is distinct from v_item.value->>'sha256' then
   raise exception 'Parte ausente o incorrecta: %',v_item.key;
  end if;
 end loop;
 select string_agg(value#>>'{{}}','' order by key) into v_fuentes_texto from jsonb_each(v_datos->'fragmentos') where key like 'fuentes_%';
 select string_agg(value#>>'{{}}','' order by key) into v_reglas_texto from jsonb_each(v_datos->'fragmentos') where key like 'reglas_%';
 if encode(sha256(convert_to(v_fuentes_texto,'UTF8')),'hex')<>'{sha_catalogo}'
 or encode(sha256(convert_to(v_reglas_texto,'UTF8')),'hex')<>'{huella(reglas_txt)}' then
  raise exception 'La reconstrucción no coincide con el catálogo original';
 end if;
 v_fuentes=v_fuentes_texto::jsonb;v_reglas=v_reglas_texto::jsonb;
 select * into v_existente from public.s911_catalogos where sha256='{sha_catalogo}' for update;
 if found then
  if v_existente.edicion is distinct from '{edicion}' or v_existente.fuentes is distinct from v_fuentes or v_existente.reglas is distinct from v_reglas then
   raise exception 'Ya existe un catálogo diferente con esta huella. No se sustituirá';
  end if;
 else
  insert into public.s911_catalogos(edicion,sha256,fuentes,reglas) values('{edicion}','{sha_catalogo}',v_fuentes,v_reglas);
 end if;
 if exists(
  select 1 from public.s911_campos c
  left join (select q.key cuestionario,f->>'codigo' codigo,f definicion from jsonb_each(v_fuentes) q cross join lateral jsonb_array_elements(q.value->'campos') f) e
   on e.cuestionario=c.cuestionario and e.codigo=c.codigo
  where c.catalogo_sha256='{sha_catalogo}' and (e.codigo is null or e.definicion is distinct from c.definicion)
 ) then raise exception 'Los campos existentes difieren. No se sobrescribieron';end if;
 insert into public.s911_campos(catalogo_sha256,cuestionario,codigo,definicion)
 select '{sha_catalogo}',q.key,f->>'codigo',f from jsonb_each(v_fuentes) q cross join lateral jsonb_array_elements(q.value->'campos') f
 on conflict(catalogo_sha256,cuestionario,codigo) do nothing;
 select count(*) into v_campos from public.s911_campos where catalogo_sha256='{sha_catalogo}';
 if v_campos<>{len(campos)} then raise exception 'Catálogo de campos incompleto: %',v_campos;end if;
 -- Limpieza exclusiva del contenedor intermedio de este lote, no de expedientes ni versiones.
 delete from public.s911_catalogos where sha256='{sha_carga}' and edicion='{edicion_carga}';
end $publicar911$;
select 'CATALOGO_COMPLETO' estado,c.edicion,c.sha256,
 (select count(*) from jsonb_object_keys(c.fuentes)) cuestionarios,
 jsonb_array_length(c.reglas) reglas,
 (select count(*) from public.s911_campos f where f.catalogo_sha256=c.sha256) campos
from public.s911_catalogos c where c.edicion='{edicion}' and c.sha256='{sha_catalogo}';
""")
    manifiesto={**meta,'archivos':escritos}
    (carpeta/'manifest.json').write_text(json.dumps(manifiesto,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    readme=f"""# Carga del catálogo 911 desde SQL Editor

Este paquete sustituye **solamente la ejecución** del archivo grande `20261026110000_catalogo_oficial_911.sql`. Conserva sus fuentes, reglas, campos y huella. No conecta por sí mismo a Supabase.

## Opción rápida: una sola ejecución con PowerShell

Con la migración base ya instalada, desde la raíz del repositorio:

```powershell
.\\scripts\\cargarCatalogo911.ps1
```

El lanzador valida el paquete actual y solicita el servidor y usuario de **Supabase → Connect → Session pooler**, puerto 5432. `psql` pide la contraseña de la base en la consola; no se guarda ni debe enviarse por chat. Usa los valores exactos de Connect, no el correo de acceso a Supabase. PostgreSQL 18 está instalado en este equipo y se detecta automáticamente.

Ejecuta inicio, todas las partes, publicación y `verificar_estadistica911.sql` en una sola conexión; se detiene ante errores. Puedes repetirlo si ya cargaste partes del mismo lote. No ejecuta la migración base ni otras migraciones. La validación local sin conexión se ejecuta con `-SoloRevisar`. Para verificar además el certificado del servidor, descarga el certificado raíz desde Connect y proporciona `-CertificadoRaiz 'C:\\ruta\\certificado.crt'`; si el entorno ya exige `verify-ca` o `verify-full`, conserva esa exigencia.

La contraseña es la de la base de datos, no la clave de tu cuenta ni una API key. No es necesario ejecutar además el archivo grande ni las partes manualmente cuando el lanzador termina correctamente.

## Alternativa manual desde SQL Editor

1. Si `20261026100000_expedientes_911.sql` ya terminó correctamente, **no lo repitas**.
2. En la carpeta `{lote[:12]}/`, abre `000_iniciar.sql`, copia todo su contenido al SQL Editor y ejecútalo.
3. Ejecuta **uno por uno y en orden** los archivos `001_parte_001.sql` hasta `{len(fragmentos):03d}_parte_{len(fragmentos):03d}.sql`. Sustituye el texto del editor en cada ejecución; no pegues todos los archivos juntos. Cada uno debe devolver `PARTE_NNN_OK`.
4. Ejecuta `999_publicar.sql`. Debe devolver **CATALOGO_COMPLETO**, **6 cuestionarios**, **{len(reglas)} reglas** y **{len(campos)} campos**.
5. Continúa con `supabase/checks/verificar_estadistica911.sql`.

## Si alguna parte falla

- Detente y conserva el mensaje. Puedes repetir una parte sin duplicar datos. Repetir `000` conserva las partes recibidas del mismo lote.
- La aplicación no utiliza la carga intermedia. Solo `999_publicar.sql` instala el catálogo y sus campos en una transacción, tras verificar todas las huellas.
- No se reemplaza un catálogo existente que difiera del original. No se modifican expedientes, alumnos, recibos, planes ni permisos.
- Cada archivo SQL tiene menos de {MAX_ARCHIVO:,} bytes. El archivo grande se conserva para instalación por conexión directa; no hace falta ejecutarlo además de este paquete.

Huella del catálogo: `{sha_catalogo}`.

## Archivos en orden

"""+'\n'.join(f"- [{f['archivo']}]({lote[:12]}/{f['archivo']}) · {f['bytes']:,} bytes" for f in escritos)+'\n'
    (carpeta_base/'LEEME.md').write_text(readme,encoding='utf8')
    (carpeta_base/'paquete_actual.json').write_text(json.dumps({
        'carpeta':lote[:12], 'lote':lote, 'sha256_catalogo':sha_catalogo,
        'sha256_reglas':huella(reglas_txt)
    },indent=2)+'\n',encoding='utf8')
    return {'carpeta':str(carpeta),'sql_archivos':len(escritos),'fragmentos':len(fragmentos),
            'max_bytes':max(f['bytes'] for f in escritos),'campos':len(campos),'reglas':len(reglas),
            'sha256_catalogo':sha_catalogo}

if __name__=='__main__':
    print(json.dumps(generar(),ensure_ascii=False,indent=2))
