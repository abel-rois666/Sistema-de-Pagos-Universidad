import { useMemo,useState } from 'react';
import type { ContextoDocencia,PublicacionDocente } from '../../docencia/types';
import { calcularPagoDocente } from '../../docencia/calculoPago';
import { seccionesCuadriculaHorario } from '../../horarios/cuadricula';
import CuadriculaHorario from '../horarios/CuadriculaHorario';
import ConfigurarTarifaDocente from './ConfigurarTarifaDocente';
interface Props {key?:string;contexto:ContextoDocencia;publicado:PublicacionDocente;docenteId:string;onActividad:(c:boolean,b:boolean)=>void;onGuardado:(c:ContextoDocencia)=>void}
const dinero=(centavos:number|null)=>centavos===null?'Pendiente':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(centavos/100);
const numero=(n:number|null)=>n===null?'Pendiente':new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(n);
const fecha=(s:string)=>s.split('-').reverse().join('/');
export default function MateriasAsignadasDocente({contexto,publicado,docenteId,onActividad,onGuardado}:Props){
 const [asincronas,setAsincronas]=useState(true);
 const estimacion=useMemo(()=>calcularPagoDocente(contexto,publicado),[contexto,publicado]);
 const secciones=useMemo(()=>seccionesCuadriculaHorario(publicado.entrada,publicado.sesiones,contexto.ciclo.nombre,{tipo:'docentes',ids:[docenteId]}),[contexto,publicado,docenteId]);
 return <><p className="personal-nota">Horario publicado · versión {contexto.publicacion?.version}. Las materias y grupos se consultan sin modificar sus asignaciones.</p><dl className="docencia-metricas"><div><dt>Presenciales por semana</dt><dd>{numero(estimacion.presencialesSemana)} h</dd></div><div><dt>Síncronas en línea pagables</dt><dd>{numero(estimacion.enLineaSemana)} h/sem.</dd></div><div><dt>Asíncronas (sin pago)</dt><dd>{numero(estimacion.asincronasSemana)} h/sem.</dd></div></dl>
 <label className="docencia-opcion"><input type="checkbox" checked={asincronas} onChange={e=>setAsincronas(e.target.checked)}/>Mostrar distribución de horas asíncronas</label><p className="personal-nota">Ocultarlas solo cambia la vista. Se pagan las presenciales y las síncronas en línea de planes de modalidad mixta; las asíncronas no entran al importe.</p>
 <div className="docencia-cuadricula"><CuadriculaHorario secciones={secciones} tipo="docentes" opciones={{mostrarAsincronas:asincronas,mostrarHorasGrupo:true}}/></div>
 <section className="personal-tarjeta"><h3>Horas efectivas del ciclo{contexto.financiero?' y estimación de pago':''}</h3><p className="personal-nota">Se excluyen del calendario festivos, vacaciones y demás fechas sin clase una sola vez. El neto se distribuye en {estimacion.quincenas||'7 u 8'} cuotas; las horas de cada corte son informativas.</p><dl className="docencia-metricas"><div><dt>Horas netas del ciclo</dt><dd>{numero(estimacion.horasCiclo)}{estimacion.horasCiclo!==null?' h':''}</dd></div><div><dt>Horas excluidas por calendario</dt><dd>{numero(estimacion.horasNoLectivas)}</dd></div><div><dt>Promedio por semana de referencia</dt><dd>{numero(estimacion.horasPromedioSemana)}{estimacion.semanas?` h / ${estimacion.semanas} sem.`:''}</dd></div>{contexto.financiero&&<><div><dt>Tarifa {contexto.financiero.excepcion.monto!==null?'individual':'general'}</dt><dd>{dinero(estimacion.tarifaCentavos)}</dd></div><div><dt>Importe neto estimado del ciclo</dt><dd>{dinero(estimacion.totalCentavos)}</dd></div></>}</dl>
 {estimacion.avisos.length>0&&<div className="personal-aviso"><h4>Para completar la estimación</h4><ul>{estimacion.avisos.map(a=><li key={a}>{a}</li>)}</ul><p>El horario y el expediente pueden seguir consultándose.</p></div>}
 {estimacion.cuotas.length>0&&<div className="docencia-tabla"><table><caption>Distribución del neto entre {estimacion.quincenas} quincenas</caption><thead><tr><th>Corte</th><th>Periodo</th><th>Horas del calendario</th><th>Importe estimado</th></tr></thead><tbody>{estimacion.cuotas.map((c,i)=><tr key={i}><td>{i+1}</td><td>{fecha(c.corte.inicio)} – {fecha(c.corte.fin)}</td><td>{numero(c.horasCalendario)} h</td><td>{dinero(c.importeCentavos)}</td></tr>)}</tbody></table></div>}
 <p className="personal-nota">Estimación con los horarios y calendarios actualmente registrados. Las incidencias de asistencia y sus descuentos aún no están implementados. No se genera nómina ni se registran pagos.</p></section>
 {contexto.financiero?.puede_editar&&<ConfigurarTarifaDocente contexto={contexto} docenteId={docenteId} onActividad={onActividad} onGuardado={onGuardado}/>}
 </>;
}
