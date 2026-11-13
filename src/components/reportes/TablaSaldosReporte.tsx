import { CheckCircle, XCircle } from 'lucide-react';
import { toTitleCase } from '../../utils';
import { formatGrado } from '../../utils/formatUtils';
import type { RegistroReporteFinanciero } from '../../utils/consultaAlumnos';

export default function TablaSaldosReporte({ registros }: { registros: readonly RegistroReporteFinanciero[] }) {
  return <>{!registros.length&&<p className="cf-sin-resultados">No hay datos para mostrar.</p>}<div className="cf-tabla-desplazable" tabIndex={0} role="region" aria-label="Saldos por alumno, tabla desplazable">
    <table className="cf-tabla cf-tabla-saldos">
      <thead><tr>{['Alumno','Licenciatura','Grado','Estatus','Plan','Pagado','Vencido por pagar','Por pagar, aún en plazo','Pendiente de revisar fecha','Total por pagar'].map((t,i)=><th key={t} scope="col" className={i>=5?'cf-numero':i===4?'cf-centrado':''}>{t}</th>)}</tr></thead>
      <tbody>{registros.map(r=><tr key={r.id}>
        <td className="cf-alumno">{toTitleCase(r.nombre)}</td>
        <td>{toTitleCase(r.licenciatura)}</td><td>{formatGrado(r.grado)}</td>
        <td><span className="cf-estado" data-estado={r.estatus}>{r.estatus}</span></td>
        <td className="cf-centrado">{r.tienePlan?<CheckCircle size={16} className="cf-pagado" aria-label="Con plan"/>:<XCircle size={16} className="cf-secundario" aria-label="Sin plan"/>}</td>
        <td className={`cf-numero ${r.pagado>0?'cf-pagado':'cf-secundario'}`}>{moneda(r.pagado)}</td><td className={`cf-numero ${r.vencido>0?'cf-vencido':'cf-secundario'}`}>{moneda(r.vencido)}</td>
        <td className="cf-numero">{moneda(r.enPlazo)}</td><td className={`cf-numero ${r.revisarFecha>0?'cf-revisar':'cf-secundario'}`}>{moneda(r.revisarFecha)}</td>
        <td className={`cf-numero ${r.adeuda>0?'cf-total':'cf-secundario'}`}>{moneda(r.adeuda)}</td>
      </tr>)}{!registros.length&&<tr><td colSpan={10} className="cf-vacio"><span className="sr-only">Sin filas</span></td></tr>}</tbody>
    </table>
  </div></>;
}
const moneda=(n:number)=>`$${n.toLocaleString('es-MX',{minimumFractionDigits:2})}`;
