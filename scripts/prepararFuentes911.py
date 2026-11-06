"""Importación reproducible, sin ejecutar reglas oficiales. Requiere openpyxl/pdfplumber.
Uso: python scripts/prepararFuentes911.py <directorio de descargas oficiales>
Conserva encabezados literales, huellas y diagnósticos; nunca importa ceros como respuestas.
"""
import sys, json, hashlib, re, shutil
from pathlib import Path
import openpyxl, pdfplumber
from reglas911Ast import compilar
from prepararCatalogo911SqlEditor import generar as generar_paquete_sql_editor

source = Path(sys.argv[1])
dest = Path(__file__).resolve().parents[1] / 'public' / '911' / '2026-2027'
dest.mkdir(parents=True, exist_ok=True)
def save(name, data):
    (dest / name).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
def sha(data): return hashlib.sha256(data).hexdigest()
def canon(v):
    if isinstance(v,float) and v.is_integer(): return int(v)
    if isinstance(v,list):return [canon(x) for x in v]
    if isinstance(v,dict):return {k:canon(x) for k,x in v.items()}
    return v
books = openpyxl.load_workbook(source / 'CAT_DICCIONARIO_FINAL_SUPERIOR_DIVIDIDO.xlsx', read_only=True, data_only=True)
repetibles={}
for key,sheet in [('edificios','EDIFICIOS'),('movilidad-entidad-enviados','MOVILIDAD ENTIDAD ENVIADOS'),('movilidad-entidad-recibidos','MOVILIDAD ENTIDAD RECIBIDOS'),('movilidad-pais-enviados','MOVILIDAD PAIS ENVIADOS'),('movilidad-pais-recibidos','MOBILIDAD PAIS RRECIBIDOS')]:
    repetibles[key]=[{'codigo':str(r[1]).strip(),'descripcion':str(r[2] or '').strip(),'tipo':str(r[5] or 'VARCHAR(2000)'),'fase':str(r[3] or ''),'orden':r[4]} for r in list(books[sheet].values)[1:] if r[1]]
save('bloques.json',repetibles)
names = {'carrera':'CARRERA','posgrado':'POSGRADO','escuela':'ESCUELA','institucion':'INSTITUCION','infraestructura':'INFRAESTRUCTURA','tecnologia':'ANEXO TECNOLOGIAS'}
manifest = {'edicion':'2026-2027','plantel':'09PSU0509Q','institucion':'09MSU0509T','cuestionarios':[], 'advertencias':[]}
for key, sheet in names.items():
    rows = list(books[sheet].values)
    fields = [{'codigo':str(r[1]).strip(),'descripcion':str(r[2] or '').strip(),'fase':str(r[3] or ''),'orden':r[4], 'tipo':str(r[5] or 'VARCHAR(2000)')} for r in rows[1:] if r[1]]
    # Homologación comprobada en la página 11 de Carrera y 12 de Posgrado (edición 2026-2027).
    if key in ('carrera','posgrado'):
        inicio=750 if key=='carrera' else 352
        for n,sexo in enumerate(['HOMBRES','MUJERES','TOTAL']):
            fields.append({'codigo':'V'+str(inicio+n),'descripcion':'ALUMNOS QUE UTILIZAN LENGUA DE SEÑAS MEXICANA COMO PRINCIPAL MEDIO DE COMUNICACIÓN ('+sexo+')','fase':'INICIO','orden':10000+n,'tipo':'SMALLINT','fuente':'PDF 911.9A p11 / 911.9B p12, homologación 26-10-2026'})
    txt = source / ('C911.' + sheet + '.txt')
    layout = None
    if txt.exists():
        raw=txt.read_bytes(); lines=raw.decode('utf-8-sig').splitlines()
        header=lines[0].split('|'); assert header[-1]==''
        layout={'encabezado':header[:-1], 'identidades':[], 'sha256':sha(raw), 'archivo':txt.name}
        for line in lines[1:]:
            vals=line.split('|')
            assert len(vals)==len(header)
            layout['identidades'].append({k:v for k,v in zip(header,vals) if k.startswith('CV_') or k.startswith('DEPENDENCIA') or k=='DURACION'})
    pdf = next(p for p in source.glob('*.pdf') if (p.name.upper().startswith(key[:5].upper()) if key!='tecnologia' else p.name.startswith('ANEXO')))
    raw=pdf.read_bytes(); shutil.copyfile(pdf, dest / (key+'.pdf'))
    (dest/'plantillas').mkdir(exist_ok=True)
    shutil.copyfile(pdf,dest/'plantillas'/(sha(raw)+'.pdf'))
    positions=[]; unmapped=[]; identification=[]
    with pdfplumber.open(pdf) as doc:
        for page_no,page in enumerate(doc.pages):
            words=page.extract_words()
            for w in words:
                if not re.fullmatch(r'[VE]\d+',w['text']): continue
                rects=[r for r in page.rects if r['x0']<=w['x0'] and r['x1']>=w['x1'] and r['top']<=w['top'] and r['bottom']>=w['bottom'] and r['height']<80]
                if not rects: unmapped.append(w['text']); continue
                box=min(rects,key=lambda r:r['width']*r['height'])
                # Reserva únicamente espacio blanco a la izquierda del código impreso.
                x=box['x0']+1.5; width=w['x0']-x-1.5; top=w['top']; height=w['bottom']-top
                occupied=any(v!=w and v['x0']<x+width and v['x1']>x and v['top']<top+height and v['bottom']>top for v in words)
                if width<9 or occupied: unmapped.append(w['text']); continue
                positions.append({'codigo':w['text'],'pagina':page_no,'x':round(x,2),'y':round(page.height-w['bottom']+1,2),'ancho':round(width,2),'alto':round(height,2),'tamano':6.5})
        page=doc.pages[0];words=page.extract_words();lines={}
        for w in words: lines.setdefault(round(w['top']),[]).append(w)
        for top,ws in lines.items():
            ws=sorted(ws,key=lambda w:w['x0']);text=' '.join(w['text'] for w in ws).lower()
            for phrase,code in [('clave de la institución:','INST'),('clave de la institución:','INST'),('clave de la escuela:','CT'),('clave de escuela, facultad o unidad académica:','CT'),('clave de la escuela, facultad o unidad académica:','CT'),('clave de la carrera:','OFERTA'),('clave del programa:','OFERTA')]:
                if phrase not in text:continue
                # Ubica el final de la etiqueta (puede haber dos claves en el mismo renglón).
                nwords=len(phrase.split());start=next((n for n in range(len(ws)) if ' '.join(w['text'] for w in ws[n:n+nwords]).lower()==phrase),None)
                if start is None:continue
                end=ws[start+nwords-1]['x1']
                boxes=sorted([r for r in page.rects if 5<r['width']<25 and 6<r['height']<25 and r['x0']>end and abs(r['top']-top)<8],key=lambda r:r['x0'])[:10]
                if len(boxes)!=10:
                    outer=sorted([r for r in page.rects if 140<r['width']<220 and 6<r['height']<25 and r['x0']>end and abs(r['top']-top)<8],key=lambda r:r['x0'])
                    if outer:
                        b=outer[0];boxes=[{'x0':b['x0']+n*b['width']/10,'bottom':b['bottom'],'width':b['width']/10} for n in range(10)]
                if len(boxes)==10:
                    for n,b in enumerate(boxes):identification.append({'codigo':code,'pagina':0,'x':round(b['x0']+2,2),'y':round(page.height-b['bottom']+3,2),'ancho':round(b['width']-3,2),'alto':10,'tamano':8,'caracter':n})
            for phrase,code in [('nombre de la institución a la que pertenece:','NOMBRE_INS'),('nombre de la institución:','NOMBRE_INS'),('nombre de la escuela, facultad o unidad académica:','NOMBRE_CT'),('nombre de la carrera:','NOMBRE_OFERTA'),('nombre del programa:','NOMBRE_OFERTA'),('vialidad principal:','C_NOM_VIALIDAD'),('número exterior:','N_EXTNUM'),('localidad:','C_NOM_LOC'),('municipio o alcaldía:','C_NOM_MUN')]:
                if text.startswith(phrase):
                    end=ws[len(phrase.split())-1]['x1']+5
                    limit=ws[len(phrase.split())]['x0']-5 if len(ws)>len(phrase.split()) else 740
                    identification.append({'codigo':code,'pagina':0,'x':round(end,2),'y':round(page.height-max(w['bottom'] for w in ws)+5,2),'ancho':round(limit-end,2),'alto':10,'tamano':9})
        if key in ('carrera','posgrado'):
            squares=sorted([r for r in page.rects if 12<r['width']<22 and 12<r['height']<22 and 290<r['top']<380],key=lambda r:r['x0'])
            if len(squares)==6:
                for name,b in zip(['ESCOLARIZADA','MIXTA','DUAL','ABIERTA','EN_LINEA','DISTANCIA'],squares):identification.append({'codigo':'CHECK_'+name,'pagina':0,'x':round(b['x0']+4,2),'y':round(page.height-b['bottom']+4,2),'ancho':12,'alto':10,'tamano':10})
        for pn in sorted(set([len(doc.pages)-1]+([0] if key in ('infraestructura','tecnologia') else []))):
            sig=doc.pages[pn];sw=sig.extract_words()
            # Algunos originales separan los glifos "M es" y "D ía" aun sin separación visual.
            for wi in range(len(sw)-1):
                a,b=sw[wi],sw[wi+1]
                if (a['text'],b['text']) in [('M','es'),('D','ía')] and abs(a['top']-b['top'])<1 and abs(a['x1']-b['x0'])<2:
                    a['text']+=b['text'];a['x1']=b['x1'];b['text']=''
            for w in sw:
                if w['text'].lower()=='nombre':
                    row=sorted([a for a in sw if abs(a['top']-w['top'])<3 and a['x0']>=w['x0']],key=lambda a:a['x0'])
                    label=' '.join(a['text'] for a in row).lower()
                    if 'firma' in label and 'responsable' in label:
                        lines=[l for l in sig.lines if l['x0']<=w['x0']<=l['x1'] and 0<w['top']-l['top']<20 and l['width']>100]
                        if lines:
                            l=max(lines,key=lambda a:a['top']);identification.append({'codigo':'RESPONSABLE','pagina':pn,'x':round(l['x0']+3,2),'y':round(sig.height-l['top']+4,2),'ancho':round(l['width']-6,2),'alto':10,'tamano':9})
                if w['text'] in ('Año','Mes','Día'):
                    boxes=[r for r in sig.rects if 12<r['width']<85 and 8<r['height']<25 and w['bottom']<=r['top']<=w['bottom']+25 and r['x0']-8<=(w['x0']+w['x1'])/2<=r['x1']+8]
                    if boxes:
                        b=min(boxes,key=lambda a:a['top']);count=4 if w['text']=='Año' else 2
                        for n in range(count):identification.append({'codigo':{'Año':'FECHA_ANIO','Mes':'FECHA_MES','Día':'FECHA_DIA'}[w['text']],'pagina':pn,'x':round(b['x0']+n*b['width']/count+2,2),'y':round(sig.height-b['bottom']+3,2),'ancho':round(b['width']/count-3,2),'alto':10,'tamano':8,'caracter':n})
        pages=len(doc.pages)
    # Dedupe repeated label recognition without changing original pages.
    identification=list({json.dumps(p,sort_keys=True):p for p in identification}.values())
    save(key+'.json', {'campos':fields,'layout':layout,'mapa':{'sha256':sha(raw),'paginas':pages,'ancho':792,'alto':612,'metodo':'Espacio blanco a la izquierda de la clave; desbordes en continuación','posiciones':positions,'identificacion':identification,'sinPosicion':sorted(set(unmapped))}})
    manifest['cuestionarios'].append({'id':key,'titulo':sheet.title(),'campos':len(fields),'instancias':len(layout['identidades']) if layout else 1,'txt':layout is not None,'sha256':sha(raw),'pdf':key+'.pdf','posiciones':len(positions)})
for key, file in [('carreras','C911.CAT_CARRERA_S.txt'),('posgrados','C911.CAT_CARRERA_S_POSGRADO.txt'),('paises','C911_PAIS.txt'),('entidades','Reporte_07_Descargas.txt')]:
    lines=(source/file).read_bytes().decode('cp1252').splitlines()
    save('catalogo-'+key+'.json',[dict(zip(lines[0].split('|')[:-1],l.split('|')[:-1])) for l in lines[1:] if l.strip()])
s=openpyxl.load_workbook(source/'S.xlsx',read_only=True,data_only=True)
save('layouts-complementarios.json',{ws.title:[[v for v in r] for r in ws.values if any(v is not None for v in r)] for ws in s})
rules=[]; rejected=[]; ids={'24':'institucion','25':'escuela','26':'carrera','27':'posgrado','29':'tecnologia','30':'infraestructura'}
raw=(source/'Reglas_Validación_Operación.txt').read_bytes()
for n,line in enumerate(raw.decode('cp1252',errors='replace').splitlines()[1:],2):
    cells=line.split('|')
    if cells[0] not in ids: continue
    if len(cells)<9 or cells[7].strip() not in ('OPERACION','VALIDACION','OPERACIÓN','VALIDACIÓN','OPERACIÓN DENTRO DEL SISTEMA'):
        rejected.append({'linea':n,'motivo':'Estructura o tipo no reconocido','texto':line[:300]}); continue
    rules.append({'cuestionario':ids[cells[0]],'seccion':cells[2],'pregunta':cells[3],'variable':cells[4],'expresion':cells[5],'mensaje':cells[6],'tipo':'OPERACION' if cells[7].strip().startswith(('OPERAC','OPERÁC')) else 'VALIDACION','linea':n})
for key,start in [('carrera',750),('posgrado',352)]:
    rules.append({'cuestionario':key,'seccion':'VII','pregunta':'1','variable':'V'+str(start+2),'expresion':f'V{start+2}=V{start}+V{start+1}','mensaje':'Total de alumnos que utilizan Lengua de Señas Mexicana','tipo':'OPERACION','linea':0})
for r in rejected:
    parts=r['texto'].split('|')
    rules.append({'cuestionario':ids[parts[0]],'seccion':'','pregunta':'','variable':'','expresion':'','mensaje':r['motivo'],'tipo':'CUARENTENA','linea':r['linea']})
for r in rules:
    try:r['ast']=compilar(r['expresion'])
    except (ValueError,RecursionError) as e:r['ast']=None;r['diagnostico']=str(e)
save('reglas.json',rules);save('reglas-cuarentena.json',rejected)
manifest['reglas']=len(rules);manifest['reglasEnCuarentena']=len(rejected)
manifest['advertencias']=['Las filas de respuesta cero de los TXT no se importan como datos.','CV_CONTROL=1 en la descarga oficial: confirmar antes de cerrar.','Los TXT de Tecnología e Infraestructura carecen de encabezados completos verificados.','Las correspondencias entre programas internos y claves oficiales requieren confirmación.']
save('manifest.json',manifest)
catalogo={k:json.loads((dest/(k+'.json')).read_text(encoding='utf-8')) for k in names}
catalogo_bytes=json.dumps(canon(catalogo),ensure_ascii=False,separators=(',', ':')).encode('utf-8')
sql="-- Catálogo oficial generado por scripts/prepararFuentes911.py. No contiene alumnos.\nbegin;\n"
sql+="insert into public.s911_catalogos(edicion,sha256,fuentes,reglas) values ('2026-2027','"+sha(catalogo_bytes)+"',$cat911$"+catalogo_bytes.decode('utf8')+"$cat911$::jsonb,$reg911$"+json.dumps(rules,ensure_ascii=False,separators=(',',':'))+"$reg911$::jsonb);\n"
sql+="insert into public.s911_campos(catalogo_sha256,cuestionario,codigo,definicion) select c.sha256,k.key,f->>'codigo',f from public.s911_catalogos c cross join lateral jsonb_each(c.fuentes) k cross join lateral jsonb_array_elements(k.value->'campos') f where c.edicion='2026-2027' and c.sha256='"+sha(catalogo_bytes)+"';\ncommit;\n"
(dest.parents[2]/'supabase'/'migrations'/'20261026110000_catalogo_oficial_911.sql').write_text(sql,encoding='utf-8')
generar_paquete_sql_editor(dest.parents[2]/'supabase'/'migrations'/'20261026110000_catalogo_oficial_911.sql')
print(json.dumps(manifest,ensure_ascii=True,indent=2))
