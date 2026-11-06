import { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import { useState } from 'react';
import { nombreOferta911 } from '../../estadistica911/guia';
import type { Expediente911 } from '../../estadistica911/types';
import { excepcionAcreditada911 } from '../../estadistica911/reglas';
export default function Reglas911Panel({
  exp,
  incidencias,
  editable,
  onChange
}: {
  exp: Expediente911;
  incidencias: {
    clave: string;
    instancia: string;
    mensaje: string;
  }[];
  editable: boolean;
  onChange: (e: Expediente911) => void;
}) {
  const [instancia, setInstancia] = useState(exp.instancias[0].id),
    [pagina, setPagina] = useState(0);
  const filas = incidencias.filter(r => r.instancia === instancia);
  const set = (clave: string, campo: 'justificacion' | 'evidencia', valor: string) => onChange({
    ...exp,
    excepciones: {
      ...exp.excepciones,
      [clave]: {
        justificacion: '',
        evidencia: '',
        ...exp.excepciones?.[clave],
        [campo]: valor
      }
    }
  });
  return <section className="s911-card"><h2>Reglas oficiales y excepciones documentadas</h2><p>Corrige los componentes que incumplan una regla. Si la descarga contiene una regla incompleta o no aplicable, documenta la excepción y su evidencia para revisión institucional; no modifica las cifras ni crea alumnos.</p><label>Cuestionario u oferta a revisar<select value={instancia} onChange={e => {
        setInstancia(e.target.value);
        setPagina(0);
      }}>{exp.instancias.map(i => <option key={i.id} value={i.id}>{nombreOferta911(i)}{i.identidad.CV_PLAN_ESTUDIOS?` · Plan ${i.identidad.CV_PLAN_ESTUDIOS}`:""}{i.identidad.CV_MODALIDAD?` · Modalidad ${i.identidad.CV_MODALIDAD}`:""}</option>)}</select></label><p>{filas.length} reglas con incumplimiento, referencia pendiente o homologación por revisar.</p>{filas.slice(pagina * 10, pagina * 10 + 10).map(r => <div className="s911-rule" key={r.clave}><strong>{r.clave} {excepcionAcreditada911(exp.excepciones?.[r.clave]) ? '· Excepción documentada' : '· Pendiente'}</strong><p>{r.mensaje}</p><div className="s911-grid"><CampoConAyuda etiqueta="Por qué se solicita la excepción (mínimo 20 caracteres)" ayuda={ayuda.excepcion}><textarea disabled={!editable} value={exp.excepciones?.[r.clave]?.justificacion || ''} onChange={e => set(r.clave, 'justificacion', e.target.value)} /></CampoConAyuda><CampoConAyuda etiqueta="Documento de respaldo (mínimo 5 caracteres)" ayuda={ayuda.evidencia}><textarea disabled={!editable} value={exp.excepciones?.[r.clave]?.evidencia || ''} onChange={e => set(r.clave, 'evidencia', e.target.value)} /></CampoConAyuda></div></div>)}{!filas.length && <p>No hay reglas pendientes en este formulario.</p>}<div className="s911-pagination"><button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>{pagina + 1} / {Math.max(1, Math.ceil(filas.length / 10))}</span><button disabled={(pagina + 1) * 10 >= filas.length} onClick={() => setPagina(p => p + 1)}>Siguiente</button></div></section>;
}
