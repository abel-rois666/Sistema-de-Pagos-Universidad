import React, { useMemo, useRef, useState, useId, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Printer, Download, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { Alumno, PaymentPlan } from '../../types';
import { generateCSV, downloadCSV, extractMonth } from '../../utils';
import CabeceraConsultaFinanciera from '../reportes/CabeceraConsultaFinanciera';
import TablaSaldosReporte from '../reportes/TablaSaldosReporte';
import '../../app/paletaDashboard.css';
import '../reportes/consultasFinancieras.css';
import { construirReporteFinanciero, ordenarReporteFinanciero, ordenarMesesReporte, type OrdenReporteFinanciero } from '../../utils/consultaAlumnos';
import { printElement } from '../../lib/printUtils';
import { useFechaFinanciera } from '../../hooks/useFechaFinanciera';
import ResumenSaldosReporte from '../reportes/ResumenSaldosReporte';
import ImpresionSaldosReporte from '../reportes/ImpresionSaldosReporte';
import { tablaSaldosCSV } from '../../reportes/exportacionSaldos';

interface ModalReporteAlumnosProps {
  key?: string;
  alumnos: Alumno[];
  activeCyclePlans: PaymentPlan[];
  cicloNombre: string;
  onClose: () => void;
  integrado?: boolean;
  padronCompleto?: Alumno[];
  controlesPadron?: React.ReactNode;
}

export default function ModalReporteAlumnos({ alumnos, activeCyclePlans, cicloNombre, onClose, integrado=false, padronCompleto=alumnos, controlesPadron }: ModalReporteAlumnosProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const tipoId=useId(),mesId=useId();
  const [pagina,setPagina]=useState(1),[tamano,setTamano]=useState(20);
  const [orden,setOrden]=useState<OrdenReporteFinanciero>('nombre'),[sentido,setSentido]=useState<'asc'|'desc'>('asc');
  const [omitirSinPlan, setOmitirSinPlan] = useState(false);
  const fechaReferencia = useFechaFinanciera();
  const [mesFiltro, setMesFiltro] = useState<string>('Todos');
  const [tipoPlanFiltro, setTipoPlanFiltro] = useState<string>('Todos');

  const mesesDisponibles = useMemo(() => {
    const meses = new Set<string>();
    activeCyclePlans.forEach(plan => {
      for (let i = 1; i <= 18; i++) {
        const fecha = plan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (fecha) {
          const m = extractMonth(fecha);
          if (m && m !== 'DESCONOCIDO' && m !== 'OTROS') {
            meses.add(m);
          }
        }
      }
    });
    // Conserva las etiquetas históricas y ordena los periodos del más reciente al más antiguo.
    return ordenarMesesReporte(Array.from(meses));
  }, [activeCyclePlans]);

  const {registros,pendientes} = useMemo(()=>construirReporteFinanciero(padronCompleto,alumnos,activeCyclePlans,{tipo:tipoPlanFiltro,mes:mesFiltro,omitirSinPlan,fechaReferencia}),[padronCompleto,alumnos,activeCyclePlans,tipoPlanFiltro,mesFiltro,omitirSinPlan,fechaReferencia]);

  const reportData=useMemo(()=>ordenarReporteFinanciero(registros,orden,sentido),[registros,orden,sentido]);
  const paginas=Math.max(1,Math.ceil(reportData.length/tamano));
  useEffect(()=>setPagina(1),[alumnos,activeCyclePlans,tipoPlanFiltro,mesFiltro,omitirSinPlan,orden,sentido,tamano]);
  useEffect(()=>setPagina(p=>Math.min(p,paginas)),[paginas]);
  const visibles=reportData.slice((pagina-1)*tamano,pagina*tamano);

  const resumenSaldos = reportData.reduce((t,r)=>({pagado:t.pagado+r.pagado,adeuda:t.adeuda+r.adeuda,vencido:t.vencido+r.vencido,enPlazo:t.enPlazo+r.enPlazo,revisarFecha:t.revisarFecha+r.revisarFecha}),{pagado:0,adeuda:0,vencido:0,enPlazo:0,revisarFecha:0});

  const handleExportCSV = () => {
    const {headers,rows} = tablaSaldosCSV(reportData);
    const csvContent = generateCSV(headers, rows);
    downloadCSV(csvContent, `reporte_financiero_alumnos_${cicloNombre.replace(/\s+/g, '_')}.csv`);
  };

  return (
    <div className={`consulta-financiera paleta-dashboard ${integrado?'reporte-financiero-contenido':'cf-modal-fondo'}`}>
      <motion.div initial={{opacity:0,scale:.95,y:20}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.95,y:20}}
        className={`cf-panel ${integrado?'reporte-financiero-panel':'cf-modal-panel'}`}>
        <CabeceraConsultaFinanciera titulo="Pagos y adeudos por alumno" descripcion="Consulta los saldos del plan y su fecha de vencimiento." icono={<FileText size={23}/>}
          acciones={<>
            <button type="button" onClick={handleExportCSV} className="cf-boton"><Download size={16}/>Exportar CSV</button>
            <button type="button" onClick={()=>{if(printRef.current)printElement(printRef.current,{landscape:true});}} className="cf-boton cf-primario"><Printer size={16}/>Imprimir PDF</button>
            {!integrado&&<button type="button" onClick={onClose} className="cf-boton cf-cerrar" aria-label="Cerrar reporte"><X size={20}/></button>}
          </>}>
          {controlesPadron}
          <div className="cf-parametros">
            {!controlesPadron&&<div className="cf-contexto"><span>Ciclo consultado</span><strong>{cicloNombre}</strong></div>}
            <label className="cf-campo" htmlFor={tipoId}>Tipo de plan<select id={tipoId} value={tipoPlanFiltro} onChange={e=>setTipoPlanFiltro(e.target.value)}>
              <option value="Todos">Todos</option><option value="Ordinario">Ordinario (Lic/Esp)</option><option value="Titulación">Titulación</option>
            </select></label>
            <label className="cf-campo" htmlFor={mesId}>Mes del concepto<select id={mesId} value={mesFiltro} onChange={e=>setMesFiltro(e.target.value)}>
              <option value="Todos">Todos</option>{mesesDisponibles.map(m=><option key={m} value={m}>{m}</option>)}
            </select></label>
            <label className="cf-checkbox"><input type="checkbox" checked={omitirSinPlan} onChange={e=>setOmitirSinPlan(e.target.checked)}/>Omitir alumnos sin plan asignado</label>
          </div>
        </CabeceraConsultaFinanciera>
        <div className="cf-cuerpo">
          <p className="cf-nota">Importes calculados a partir de los planes de pago, con las reglas existentes de abonos y estatus. No es un reporte de ingresos contables.</p>
          {pendientes.length>0&&<div role="status" className="cf-aviso"><p className="font-semibold">{pendientes.length} {pendientes.length===1?'plan requiere':'planes requieren'} identificar al alumno</p><p>Sus importes no se atribuyen por coincidencia de nombre y no están incluidos en los totales ni en el CSV de alumnos. La relación se conserva en el PDF.</p><details><summary>Ver planes pendientes de asociación</summary><ul>{pendientes.map(p=><li key={p.id}>{p.no_plan_pagos||'Sin folio'} · {p.nombre_alumno||'Sin nombre registrado'} · {p.tipo_plan} · {p.alumno_id?'El ID no se encuentra en el padrón cargado':'Sin ID de alumno'}</li>)}</ul></details></div>}
          <ResumenSaldosReporte total={resumenSaldos} alumnos={reportData.length}/>
          <div className="cf-nota cf-fecha"><strong>Consulta al {fechaReferencia.split('-').reverse().join('/')}</strong><span>Ciudad de México · Lo que vence hoy sigue en plazo.</span><details><summary>Cómo se calculan los saldos</summary><p>Total por pagar = vencido + aún en plazo + pendiente de revisar fecha. El filtro Mes utiliza la fecha del concepto del plan, no la del recibo.</p></details></div>
          <section className="cf-tabla-panel" aria-label="Detalle por alumno">
            <div className="cf-tabla-barra"><div><h3>Detalle por alumno</h3><p>{reportData.length.toLocaleString('es-MX')} alumnos en la consulta</p></div>
              <div className="cf-orden"><label className="cf-campo">Ordenar por<select value={orden} onChange={e=>setOrden(e.target.value as typeof orden)}><option value="nombre">Alumno</option><option value="grado">Grado</option><option value="pagado">Pagado</option><option value="vencido">Vencido por pagar</option><option value="enPlazo">Por pagar, aún en plazo</option><option value="revisarFecha">Pendiente de revisar fecha</option><option value="adeuda">Total por pagar</option></select></label>
                <button type="button" className="cf-boton" onClick={()=>setSentido(v=>v==='asc'?'desc':'asc')}>{sentido==='asc'?<ArrowUp size={15}/>:<ArrowDown size={15}/>} {sentido==='asc'?'Ascendente':'Descendente'}</button>
              </div>
            </div>
            <p className="cf-ayuda-tabla">Desplaza la tabla para consultar todas las columnas. El alumno permanece visible.</p>
            <TablaSaldosReporte registros={visibles}/>
            <div className="cf-paginacion">
              <label>Filas por página <select value={tamano} onChange={e=>setTamano(Number(e.target.value))}>{[20,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
              <span>{reportData.length?`${(pagina-1)*tamano+1}–${Math.min(pagina*tamano,reportData.length)} de ${reportData.length}`:'0 resultados'}</span>
              <div><button type="button" className="cf-boton" disabled={pagina===1} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>{pagina} / {paginas}</span><button type="button" className="cf-boton" disabled={pagina===paginas} onClick={()=>setPagina(p=>p+1)}>Siguiente</button></div>
            </div>
          </section>
          <p className="cf-nota cf-nota-exportacion">El CSV conserva «ADEUDA» como total por pagar. Las tres columnas nuevas lo desglosan.</p>
        </div>
      </motion.div>
      <div ref={printRef} aria-hidden="true" style={{position:'fixed',top:'-10000px',left:'-10000px',width:'1020px',background:'white',color:'black',fontFamily:'sans-serif',padding:'10px'}}>
        <ImpresionSaldosReporte registros={reportData} pendientes={pendientes} total={resumenSaldos} ciclo={cicloNombre} tipo={tipoPlanFiltro} mes={mesFiltro} fecha={fechaReferencia}/>
      </div>
    </div>
  );
}
