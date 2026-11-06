import { useEffect, useMemo, useState } from 'react';
import type { Campo911, Expediente911, Fuente911, Instancia911, Regla911, Respaldo911, Respuesta911 } from '../../estadistica911/types';
import { valorRespuesta } from '../../estadistica911/types';
import { camposInicio911 } from '../../estadistica911/calculo';
import { aplicarReglas911 } from '../../estadistica911/reglas';
import Respuesta911Editor from './Respuesta911Editor';
import Modal911 from './Modal911';
import Bloques911Panel from './Bloques911Panel';
import AyudaContextual, { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda, POBLACIONES_911 } from './ayudas911';
import { BASE911 } from '../../estadistica911/fuentes';
import { instanciaAplica911,nombreOferta911,motivoNoPertinente911,conflictoPertinencia911,type GuiaCaptura911 } from '../../estadistica911/guia';
export default function Cuestionario911Panel({
  exp,
  fuentes,
  reglas,
  planes,
  respaldos,
  editable,
  onChange,
  puedeVerAlumnos,
  configurable,
  inicialInstancia,
  inicialVariable
}: {
  exp: Expediente911;
  fuentes: Record<string, Fuente911>;
  reglas: Regla911[];
  planes: any[];
  respaldos: Respaldo911[];
  editable: (q: string) => boolean;
  onChange: (e: Expediente911) => void;
  puedeVerAlumnos: boolean;
  configurable: boolean;
  inicialInstancia?:string;
  inicialVariable?:string;
}) {
  const [id, setId] = useState(inicialInstancia||exp.instancias.find(instanciaAplica911)?.id||exp.instancias[0].id),
    [busqueda, setBusqueda] = useState(inicialVariable||''),
    [filtro, setFiltro] = useState('todos'),
    [pagina, setPagina] = useState(0),
    [campo, setCampo] = useState<Campo911 | null>(null),
    [respaldo, setRespaldo] = useState<Respaldo911 | null>(null),
    [bloque, setBloque] = useState('edificios'),
    [json, setJson] = useState('[{}]');
  const [guia,setGuia]=useState<GuiaCaptura911|null>(null),[paginaFormato,setPaginaFormato]=useState('');
  useEffect(()=>{if(inicialInstancia)setId(inicialInstancia);setBusqueda(inicialVariable||'');setPagina(0);setPaginaFormato('');},[inicialInstancia,inicialVariable,exp.id,exp.version]);
  useEffect(()=>{let activo=true;void fetch(BASE911+'guia-captura-v1.json').then(r=>r.ok?r.json():null).then(g=>{if(activo)setGuia(g);}).catch(()=>{});return()=>{activo=false;};},[]);
  const i = exp.instancias.find(x => x.id === id && instanciaAplica911(x)) || exp.instancias.find(instanciaAplica911) || exp.instancias[0],
    f = fuentes[i.cuestionario];
  const campos = useMemo(() => {
    const base = camposInicio911(f).filter(c => filtro === 'identificacion' ? ['C_NOM_MUN', 'C_NOM_LOC', 'C_NOM_VIALIDAD', 'N_EXTNUM', 'FECHA_ENTREGA', 'C_OBSERVACION'].includes(c.codigo) : /^[VE]\d+$/.test(c.codigo));
    for (const k of f.layout?.encabezado || []) if (/^[VE]\d+$/.test(k) && !base.some(c => c.codigo === k || c.codigo === k.replace(/^V/, 'E'))) base.push({
      codigo: k,
      descripcion: 'Campo del layout oficial; definición pendiente de homologación',
      tipo: 'VARCHAR(2000)',
      fase: 'INICIO',
      orden: 9999
    });
    return base.filter(c => {
      const fuera=motivoNoPertinente911(exp,i,c.codigo),conflicto=conflictoPertinencia911(exp,i,c.codigo);
      return (!fuera||conflicto||filtro==='nopertinentes') && (!paginaFormato||String(guia?.campos[i.cuestionario]?.[c.codigo]?.pagina||'')===paginaFormato)
        && `${c.codigo} ${c.descripcion}`.toLowerCase().includes(busqueda.toLowerCase()) && (['identificacion','todos','nopertinentes'].includes(filtro) || filtro==='pendientes'&&valorRespuesta(i.respuestas[c.codigo])===null || filtro==='ajustes'&&i.respuestas[c.codigo]?.declarado!==undefined || filtro==='sinrevision'&&!i.respuestas[c.codigo]?.revisada);
    }).sort((a,b)=>a.orden-b.orden);
  }, [f, i, busqueda, filtro,exp.config,exp.instancias,guia,paginaFormato]);
  const derivados = new Set(reglas.filter(r => r.cuestionario === i.cuestionario && r.tipo === 'OPERACION').map(r => r.expresion.match(/^\s*([VE]\d+)\s*=/)?.[1]).filter(Boolean));
  function actualizar(nueva: Instancia911) {
    const res = aplicarReglas911(nueva, reglas);
    onChange({
      ...exp,
      instancias: exp.instancias.map(x => x.id === i.id ? res.instancia : x),
      incidencias: [...exp.incidencias.filter(s => !s.startsWith(i.id + ': ')), ...res.incidencias.map(s => i.id + ': ' + s)],
      revisiones: {
        ...exp.revisiones,
        [i.cuestionario]: ''
      }
    });
  }
  function respuestaGuardar(r: Respuesta911,seleccionGrupo?:string) {
    const pareja=guia?.campos[i.cuestionario]?.[campo!.codigo]?.opcion?.pareja;
    const v=valorRespuesta(r);
    const complementaria=pareja && r.declarado!==undefined && (v===0||v===1) ? {[pareja]:{...i.respuestas[pareja],...r,calculado:i.respuestas[pareja]?.calculado??null,declarado:1-Number(v),revisada:true}} : {};
    const grupo=guia?.campos[i.cuestionario]?.[campo!.codigo]?.opcion?.grupo;
    const otras=grupo&&seleccionGrupo?Object.fromEntries(grupo.filter(g=>g.codigo!==campo!.codigo).map(g=>[g.codigo,{...r,calculado:i.respuestas[g.codigo]?.calculado??null,declarado:g.codigo===seleccionGrupo?1:0,revisada:true}])):{};
    actualizar({
      ...i,
      respuestas: {
        ...i.respuestas,
        ...complementaria,
        ...otras,
        [campo!.codigo]: r
      }
    });
    setCampo(null);
  }
  return <div className="s911-stack"><section className="s911-card"><div className="s911-grid"><label className="s911-span">Cuestionario / oferta oficial<select value={i.id} onChange={e => {
            setId(e.target.value);
            setPagina(0);
            setPaginaFormato('');setBusqueda('');
          }}>{exp.instancias.filter(instanciaAplica911).map(x => <option key={x.id} value={x.id}>{nombreOferta911(x)} · Plan {x.identidad.CV_PLAN_ESTUDIOS || '—'}</option>)}</select></label></div>
 <p className="s911-notice">Las equivalencias se preparan en «Oferta educativa». Revisa aquí las preguntas por página del formato y confirma las cifras calculadas o captura las faltantes.</p>
 <details><summary>Claves oficiales y configuración avanzada</summary><div className="s911-grid"><div><dl>{Object.entries(i.identidad).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>{['carrera', 'posgrado'].includes(i.cuestionario) && !exp.config.guiaVersion && <fieldset disabled={!configurable} className="s911-stack"><label>Nombre para identificar esta oferta<input value={i.correspondencia.nombre || ''} onChange={e => actualizar({
                ...i,
                correspondencia: {
                  ...i.correspondencia,
                  nombre: e.target.value,
                  confirmada: false
                }
              })} /></label><label>Planes internos que corresponden<select multiple size={6} value={i.correspondencia.planes} onChange={e => actualizar({
                ...i,
                correspondencia: {
                  ...i.correspondencia,
                  planes: Array.from(e.target.selectedOptions as HTMLCollectionOf<HTMLOptionElement>, o => o.value),
                  confirmada: false
                }
              })}>{planes.map(p => <option key={p.id} value={p.id}>{p.clave_legado} · {p.nombre} · {p.tipo_periodo} · {p.modalidad}</option>)}</select></label><label>Nivel oficial de esta oferta<select value={i.correspondencia.nivel || ''} onChange={e => actualizar({
                ...i,
                correspondencia: {
                  ...i.correspondencia,
                  nivel: e.target.value,
                  confirmada: false
                }
              })}><option value="">Confirma nivel</option>{['TSU', 'LICENCIATURA', 'ESPECIALIDAD', 'MAESTRIA', 'DOCTORADO'].map(n => <option key={n}>{n}</option>)}</select></label><label>Periodos por año de avance (tabla oficial)<input type="number" min={1} value={i.correspondencia.periodosPorAnio || ''} onChange={e => actualizar({
                ...i,
                correspondencia: {
                  ...i.correspondencia,
                  periodosPorAnio: Number(e.target.value),
                  confirmada: false
                }
              })} /></label><label className="s911-check"><input type="checkbox" checked={i.correspondencia.confirmada} onChange={e => actualizar({
                ...i,
                correspondencia: {
                  ...i.correspondencia,
                  confirmada: e.target.checked
                }
              })} />Confirmo la equivalencia de la oferta oficial, modalidad y planes internos</label></fieldset>}</div></details>
 <div className="s911-toolbar"><label>Buscar variable<input placeholder="V177, matrícula, egresados…" value={busqueda} onChange={e => {
            setBusqueda(e.target.value);
            setPagina(0);
          }} /></label><label>Mostrar<select value={filtro} onChange={e => {
            setFiltro(e.target.value);
            setPagina(0);
          }}><option value="todos">Preguntas pertinentes</option><option value="identificacion">Identificación y observaciones complementarias</option><option value="pendientes">Pendientes</option><option value="ajustes">Con ajuste declarado</option><option value="sinrevision">Sin revisar</option><option value="nopertinentes">Ver también desgloses no pertinentes</option></select></label><label>Página del cuestionario<select value={paginaFormato} onChange={e=>{setPaginaFormato(e.target.value);setPagina(0);}}><option value="">Todas las páginas</option>{[...new Set(Object.values<import('../../estadistica911/guia').GuiaCampo911>(guia?.campos[i.cuestionario]||{}).map(c=>c.pagina).filter((n):n is number=>n!==null))].sort((a,b)=>a-b).map(n=><option key={n} value={n}>Página {n}</option>)}</select></label><span>{campos.length} preguntas</span></div>
 <p className="s911-note">Cada clave V o E identifica una pregunta oficial. «Calculado» muestra lo obtenido de las fuentes; «Declarado» muestra un ajuste documentado. El guion indica que no hay ajuste.</p>
 <div className="s911-scroll"><table><thead><tr><th>Clave y definición</th><th>Calculado <AyudaContextual etiqueta="Cifra calculada" texto={ayuda.calculado}/></th><th>Declarado <AyudaContextual etiqueta="Respuesta declarada" texto={ayuda.declarado}/></th><th>Revisión / respaldo <AyudaContextual etiqueta="Revisión y respaldo" texto={ayuda.revision+' '+ayuda.respaldo}/></th></tr></thead><tbody>{campos.slice(pagina * 30, pagina * 30 + 30).map(c => {
              const r = i.respuestas[c.codigo],
                p = respaldos.find(x => x.instancia === i.id && x.variable === c.codigo);
              return <tr key={c.codigo}><td><span>{c.descripcion}</span><small>{c.codigo} · Página {guia?.campos[i.cuestionario]?.[c.codigo]?.pagina||'por consultar'} · {r?.origen || 'Captura complementaria'}</small>{conflictoPertinencia911(exp,i,c.codigo)&&<p className="s911-warning">La declaración previa contradice el perfil. Revisa o retira el ajuste.</p>}</td><td>{r?.calculado ?? <em>Pendiente</em>}</td><td>{r?.declarado !== undefined ? String(r.declarado ?? 'Pendiente') : '—'}</td><td><div className="s911-row-actions"><button disabled={!editable(i.cuestionario)} onClick={() => setCampo(c)}>{r?.revisada ? 'Revisada ✓' : r?.calculado==null?'Capturar respuesta':'Confirmar / corregir'}</button>{p && puedeVerAlumnos && <button onClick={() => setRespaldo(p)}>Ver alumnos ({p.incluidos.length})</button>}</div></td></tr>;
            })}</tbody></table></div>
 {!campos.length && <p className="s911-empty">No hay variables con este filtro.</p>}<div className="s911-pagination"><button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>{pagina + 1} / {Math.max(1, Math.ceil(campos.length / 30))}</span><button disabled={(pagina + 1) * 30 >= campos.length} onClick={() => setPagina(p => p + 1)}>Siguiente</button></div>
 </section>
 <section className="s911-card"><h2>Confirmar que la población está completa</h2><p>Después de revisar alumnos incluidos y excluidos, registra qué documento acredita cada población de este cuestionario. Esto permite distinguir un cero comprobado de información faltante.</p><div className="s911-grid">{['matricula', 'primerIngreso', 'primerIngresoAnterior', 'egresados', 'titulados'].map(p => <CampoConAyuda key={p} etiqueta={POBLACIONES_911[p].nombre} ayuda={POBLACIONES_911[p].ayuda+' '+ayuda.cobertura}><input disabled={!editable(i.cuestionario) || !puedeVerAlumnos} placeholder="Documento que acredita la revisión completa" value={exp.config.coberturas?.[`${i.id}:${p}`] || ''} onChange={e => onChange({
            ...exp,
            config: {
              ...exp.config,
              coberturas: {
                ...exp.config.coberturas,
                [`${i.id}:${p}`]: e.target.value
              }
            },
            revisiones: {}
          })} /></CampoConAyuda>)}</div><p className="s911-note">Después, ve a «Calcular y revisar» para actualizar las cifras con este respaldo. La cobertura se documenta por cuestionario y población.</p></section>
 <div key={`${exp.id}:${exp.version}:${i.id}`}><Bloques911Panel instancia={i} editable={editable(i.cuestionario)} onChange={actualizar} /></div>
 {campo && <Respuesta911Editor campo={campo} respuestasGrupo={i.respuestas} guia={guia?.campos[i.cuestionario]?.[campo.codigo]} respuesta={i.respuestas[campo.codigo]} derivada={derivados.has(campo.codigo)} onClose={() => setCampo(null)} onGuardar={respuestaGuardar} />}
 {respaldo && <Modal911 titulo={`Alumnos considerados · ${respaldo.variable}`} onClose={() => setRespaldo(null)}><div className="s911-body"><p>{POBLACIONES_911[respaldo.poblacion]?.nombre||respaldo.poblacion} · {respaldo.completa ? 'Población completa acreditada' : 'Falta acreditar que la población está completa'}</p><p className="s911-note">Respuesta final: {valorRespuesta(i.respuestas[respaldo.variable]) ?? 'Pendiente'} · Registros identificados: {respaldo.incluidos.length}. Las diferencias justificadas son ajustes agregados.</p>{respaldo.incidencias.map(x => <p key={x} className="s911-warning">{x}</p>)}<div className="s911-scroll"><table><thead><tr><th>Matrícula / nombre</th><th>Programa</th><th>Referencia</th><th>Grado / avance</th><th>Edad / sexo</th><th>Inclusión</th></tr></thead><tbody>{respaldo.incluidos.map(p => <tr key={p.id}><td>{p.matricula}<small>{p.nombre}</small></td><td>{p.programa}</td><td>{p.fecha_evento || p.desde}</td><td>{p.grado} / {p.avance ?? 'Pendiente'}</td><td>{p.edad ?? 'Pendiente'} / {p.sexo}</td><td>{p.motivo}</td></tr>)}</tbody></table></div><details><summary>Alumnos excluidos y motivos ({respaldo.excluidos.length})</summary>{respaldo.excluidos.slice(0, 100).map((x, n) => <p key={n}>{x.id}: {x.motivo}</p>)}</details></div></Modal911>}
 </div>;
}
