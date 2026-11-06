import AyudaContextual, { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import { ordenarCiclos911 } from '../../estadistica911/guia';
import type { Expediente911 } from '../../estadistica911/types';
import type { CicloEscolar } from '../../types';
import Corte911Panel from './Corte911Panel';
export default function Configuracion911({
  exp,
  ciclos,
  editable,
  onChange
}: {
  exp: Expediente911;
  ciclos: CicloEscolar[];
  editable: boolean;
  onChange: (e: Expediente911) => void;
}) {
  const c = exp.config;
  const set = (k: string, v: unknown) => onChange({
    ...exp,
    config: {
      ...c,
      [k]: v
    },
    revisiones: {}
  });
  return <div className="s911-stack"><section className="s911-card"><h2>Fechas, ciclos y datos del expediente</h2><p>El reporte anual puede reunir varios ciclos Semestrales y Cuatrimestrales. Selecciona aquí los que correspondan; esto no cambia la selección de otros módulos.</p><p className="s911-note">La matrícula actual, los resultados del periodo anterior y las cifras financieras tienen referencias distintas. Revisa cada una antes de calcular.</p><fieldset disabled={!editable} className="s911-grid s911-configuracion">
 <CampoConAyuda etiqueta="Nombre del expediente" ayuda={ayuda.expediente}><input value={exp.nombre} onChange={e => onChange({
            ...exp,
            nombre: e.target.value
          })} /></CampoConAyuda><CampoConAyuda etiqueta="Edición del levantamiento" ayuda={ayuda.edicion}><input readOnly value={c.edicion} /></CampoConAyuda><CampoConAyuda etiqueta="Escuela (CCT)" ayuda={ayuda.cct}><input readOnly value={c.plantel} /></CampoConAyuda><CampoConAyuda etiqueta="Clave de la institución" ayuda={ayuda.institucion}><input readOnly value={c.institucion} /></CampoConAyuda>
 {([['actualInicio', 'Contar nuevos ingresos desde'], ['edadReferencia', 'Calcular edades a la fecha'], ['anteriorInicio', 'Periodo anterior de resultados: desde'], ['anteriorFin', 'Periodo anterior de resultados: hasta']] as const).map(([k, t]) => <CampoConAyuda key={k} etiqueta={t} ayuda={ayuda[k]}><input type="date" value={c[k]} onChange={e => set(k, e.target.value)} /></CampoConAyuda>)}<CampoConAyuda etiqueta="Año de las cifras financieras" ayuda={ayuda.fiscal}><input type="number" value={c.fiscal} onChange={e => set('fiscal', Number(e.target.value))} /></CampoConAyuda>
 <label>Nombre de la institución<input value={c.nombreInstitucion || ''} onChange={e => set('nombreInstitucion', e.target.value)} /></label><label>Nombre del plantel<input value={c.nombrePlantel || ''} onChange={e => set('nombrePlantel', e.target.value)} /></label><label>Fecha de llenado<input type="date" value={c.fechaLlenado || ''} onChange={e => set('fechaLlenado', e.target.value)} /></label><label>Responsable<input value={c.responsable} onChange={e => set('responsable', e.target.value)} /></label><label>Cargo<input value={c.cargo} onChange={e => set('cargo', e.target.value)} /></label><CampoConAyuda className="s911-span" etiqueta="Documento que acredita la revisión de todo el personal" ayuda={ayuda.personalCobertura}><input value={c.coberturas?.personal || ''} onChange={e => set('coberturas', {
            ...c.coberturas,
            personal: e.target.value
          })} /></CampoConAyuda>
 {(['ciclosMatricula', 'ciclosAnteriores'] as const).map(k => <div key={k}><div className="campo-con-ayuda-etiqueta"><h3>{k === 'ciclosMatricula' ? 'Ciclos de alumnos inscritos al corte' : 'Ciclos del periodo anterior de resultados'}</h3><AyudaContextual etiqueta={k==='ciclosMatricula'?'Elegir ciclos de matrícula':'Elegir ciclos de resultados anteriores'} texto={ayuda[k]}/></div><p className="s911-note">{k==='ciclosMatricula'?'Incluye los ciclos de los alumnos cuya inscripción estaba vigente al corte.':'Incluye todos los ciclos que aportan resultados del periodo anterior, con su periodicidad.'}</p><div className="s911-check-list">{ordenarCiclos911(ciclos).map(ciclo => <label key={ciclo.id}><input type="checkbox" checked={c[k].includes(ciclo.id)} onChange={e => set(k, e.target.checked ? [...c[k], ciclo.id] : c[k].filter(id => id !== ciclo.id))} /><span>{ciclo.nombre} · {ciclo.tipo_periodo}<small>{ciclo.fecha_inicio} — {ciclo.fecha_termino}</small></span></label>)}</div></div>)}
 <label className="s911-span s911-check"><input type="checkbox" checked={c.controlConfirmado} onChange={e => set('controlConfirmado', e.target.checked)} />Comparé las claves institucionales y los datos de identificación con las descargas oficiales. Las diferencias se revisarán en el portal.</label>
 </fieldset></section><Corte911Panel exp={exp} editable={editable} onChange={onChange} /><section className="s911-card"><h2>Cómo se protege la información</h2><p>El expediente conserva cálculos y ajustes por separado. Al cerrarlo se guarda una versión reproducible. Reabrir crea otra versión y exige un motivo; los datos operativos y los archivos anteriores se conservan.</p><p className="s911-note">Las firmas, los sellos y la oficialización se realizan mediante el procedimiento institucional. Los TXT se preparan con OFICIALIZADO=0.</p></section></div>;
}

