"""Guía de captura separada del catálogo original. Solo lee fuentes oficiales locales."""
import json, re, hashlib, sys
from pathlib import Path
import pdfplumber

raiz = Path(__file__).resolve().parents[1]
base = raiz/'public/911/2026-2027'
normal = lambda s: s.upper().translate(str.maketrans('ÁÉÍÓÚÜ', 'AEIOUU'))
criterios, campos = {}, {}
for q in ['carrera','posgrado','escuela','institucion','infraestructura','tecnologia']:
    fuente = json.loads((base/(q+'.json')).read_text(encoding='utf8'))
    paginas, parejas = {}, {}
    with pdfplumber.open(base/(q+'.pdf')) as doc:
        for n, pagina in enumerate(doc.pages, 1):
            texto = pagina.extract_text() or ''
            for codigo in re.findall(r'\b[VE]\d+\b', texto): paginas.setdefault(codigo, n)
            for si, no in re.findall(r'Sí\s+(V\d+)\s+No\s+(V\d+)', texto):
                parejas[si] = {'pareja':no, 'etiqueta':'Sí'}
                parejas[no] = {'pareja':si, 'etiqueta':'No'}
    campos[q] = {}
    for f in fuente['campos']:
        codigo, t = f['codigo'], normal(f['descripcion'])
        d = {'pagina':paginas.get(codigo), 'fase':f['fase']}
        if codigo in parejas: d['opcion'] = parejas[codigo]
        # Solo desgloses explícitos de oferta/impartición. La formación del personal
        # por sí sola NO determina que una pregunta sea ajena a la oferta.
        nivel = None
        if q in ['escuela','institucion']:
            m = re.search(r'(?:QUE IMPARTE |(?:CARRERAS|ALUMNOS) (?:EN NIVEL |DE NIVEL |DE )|NUMERO DE ESCUELAS DE )(TECNICO SUPERIOR|LICENCIATURA|ESPECIALIDAD|MAESTRIA|DOCTORADO|POSGRADO)',t)
            if m:
                nivel = {'TECNICO SUPERIOR':['TSU'],'LICENCIATURA':['LICENCIATURA'],'ESPECIALIDAD':['ESPECIALIDAD'], 'MAESTRIA':['MAESTRIA'],'DOCTORADO':['DOCTORADO'],'POSGRADO':['ESPECIALIDAD','MAESTRIA','DOCTORADO']}[m[1]]
        if nivel and re.search(r'INT',f['tipo']) and codigo.startswith('V'):
            modalidad = 'NO_ESCOLAR' if re.search(r'MODALIDAD NO ESCOLAR',t) else 'ESCOLAR' if 'MODALIDAD ESCOLAR' in t else None
            criterios[q+':'+codigo] = {'niveles':nivel,'modalidad':modalidad}
        if re.search(r'PESOS|IMPORTE|INGRESOS.*MONET|GASTO.*MONET', t): d['unidad']='Pesos del ejercicio fiscal'
        elif 'PORCENTAJE' in t: d['unidad']='Porcentaje'
        elif any(x in t for x in ['ALUMNOS','ALUMNAS','PERSONAL','DOCENTES','EGRESADOS','TITULADOS']): d['unidad']='Personas'
        else: d['unidad']='Valor según la definición del formato'
        campos[q][codigo] = d

# Grupos de selección única cotejados en la página 2 de 911.9A/911.9B.
grupos = {
 'carrera': [ {'V1':'Técnico superior universitario / profesional asociado','V3':'Licenciatura universitaria y tecnológica','V4':'Licenciatura en Educación Normal'},
             {'V12':'Semestres','V13':'Cuatrimestres','V14':'Trimestres','V15':'Módulos','V458':'Asignaturas o créditos'} ],
 'posgrado': [ {'V1':'Licenciatura como antecedente','V2':'Maestría como antecedente','V3':'Especialidad médica como antecedente'},
              {'V11':'Años','V12':'Semestres','V13':'Cuatrimestres','V14':'Trimestres','V15':'Módulos','V272':'Asignaturas o créditos'},
              {'V17':'Bienal','V18':'Anual','V19':'Semestral','V20':'Otro periodo de admisión'} ]
}
for q, listas in grupos.items():
 for grupo in listas:
  for codigo, etiqueta in grupo.items():
   campos[q][codigo]['opcion']={'etiqueta':etiqueta,'grupo':[{'codigo':c,'etiqueta':e} for c,e in grupo.items()]}

datos = {'version':'guia-911-2026-2027-v1', 'criterios':criterios}
datos['sha256'] = hashlib.sha256(json.dumps(criterios,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf8')).hexdigest()
(raiz/'src/estadistica911/criterios911.json').write_text(json.dumps(datos,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(base/'guia-captura-v1.json').write_text(json.dumps({'version':datos['version'],'campos':campos},ensure_ascii=False,separators=(',',':')),encoding='utf8')
# Solo los nombres de las ofertas presentes en las descargas, no todo el catálogo nacional.
ofertas = {}
carpeta = Path(sys.argv[1]) if len(sys.argv)>1 else Path.home()/'Desktop/911'
for q, nombre in [('carrera','C911.CAT_CARRERA_S.txt'),('posgrado','C911.CAT_CARRERA_S_POSGRADO.txt')]:
    ids = {i['CV_CARRERA'] for i in json.loads((base/(q+'.json')).read_text(encoding='utf8'))['layout']['identidades']}
    raw=(carpeta/nombre).read_bytes()
    try: texto=raw.decode('utf-8-sig')
    except UnicodeDecodeError: texto=raw.decode('cp1252')
    for linea in texto.splitlines()[1:]:
        c,n,*_ = linea.split('|')
        if c in ids:
            nivel = 'ESPECIALIDAD' if normal(n).startswith('ESPECIALIDAD') else 'MAESTRIA' if normal(n).startswith('MAESTRIA') else 'DOCTORADO' if normal(n).startswith('DOCTORADO') else 'LICENCIATURA' if q=='carrera' else ''
            ofertas[c]={'nombre':n,'nivel':nivel}
(raiz/'src/estadistica911/ofertas911.json').write_text(json.dumps(ofertas,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'criterios':len(criterios),'campos':sum(map(len,campos.values())),'ofertas':len(ofertas),'parejas_si_no':sum(bool(c.get('opcion',{}).get('pareja')) for q in campos.values() for c in q.values())//2},ensure_ascii=False))
