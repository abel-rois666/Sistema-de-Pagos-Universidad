import { formatearCreditos, fuentesResultado, situacionHistorial } from '../../utils/presentacionHistorial';
export const notaHistorial=(valor:unknown)=>valor===null||valor===undefined?'—':Number(valor)===-555?'NP':String(valor);

export default function DetalleMateriaHistorial({item,minimo,especialidad}:{item:any;minimo:number;especialidad:boolean}) {
  const fuentes=fuentesResultado(item);
  return <>
    <p><strong>{situacionHistorial(item,minimo)}</strong> · {formatearCreditos(item.asignatura?.creditos)} créditos. Cada evaluación conserva su propio ciclo.</p>
    {fuentes.length>0&&<p>Resultado mostrado: {fuentes.map(f=>`${f.tipo.replaceAll('_',' ')} (${f.ciclo})`).join(' / ')}.</p>}
    <div className="historial-intentos">{(item.registros||[]).map((r:any,i:number)=><dl key={r.id||i} aria-label={`Intento ${i+1}`}>
      <div><dt>Evaluación</dt><dd>{(r.tipo_evaluacion||'ORDINARIO').replaceAll('_',' ')}</dd></div><div><dt>Ciclo</dt><dd>{r.ciclo?.nombre||r.ciclo_legado||'Sin ciclo'}</dd></div>
      <div><dt>{especialidad?'Evaluación final':'P1 / P2 / P3'}</dt><dd>{especialidad?notaHistorial(r.parcial_1):[r.parcial_1,r.parcial_2,r.parcial_3].map(notaHistorial).join(' / ')}</dd></div>
      <div><dt>Promedio calculado</dt><dd>{notaHistorial(r.promedio_calculado)}</dd></div><div><dt>Final registrada</dt><dd>{notaHistorial(r.calificacion_final)}</dd></div>
    </dl>)}</div>
  </>;
}
