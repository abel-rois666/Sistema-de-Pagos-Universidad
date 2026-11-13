import AyudaContextual from '../ui/AyudaContextual';
import '../ui/ayudaContextual.css';
import type { SaldoPorVencimiento } from '../../finanzas/vencimientos';

export default function ResumenSaldosReporte({ total, alumnos }: { total: SaldoPorVencimiento; alumnos: number }) {
  const tarjetas = [
    { nombre: 'Total de alumnos', valor: alumnos.toLocaleString('es-MX'), ayuda: 'Alumnos incluidos por los filtros actuales, con o sin plan según la opción elegida.', tono: 'neutro' },
    { nombre: 'Pagado según los planes', valor: moneda(total.pagado), ayuda: 'Importe cubierto según los estatus y abonos registrados en los planes. No es una suma de ingresos contables.', tono: 'pagado' },
    { nombre: 'Total por pagar', valor: moneda(total.adeuda), ayuda: 'Incluye lo vencido, lo que sigue en plazo y el saldo cuya fecha necesita revisión.', tono: 'total' },
    { nombre: 'Vencido por pagar', valor: moneda(total.vencido), ayuda: 'Saldo pendiente con fecha límite anterior a hoy. Los abonos ya están descontados.', tono: total.vencido>0?'vencido':'neutro' },
    { nombre: 'Por pagar, aún en plazo', valor: moneda(total.enPlazo), ayuda: 'Saldo pendiente que vence hoy o después. No se considera vencido.', tono: 'neutro' },
    { nombre: 'Pendiente de revisar fecha', valor: moneda(total.revisarFecha), ayuda: 'Saldo pendiente con fecha ausente o inválida. Se incluye en el total, sin clasificarlo como vencido ni en plazo.', tono: total.revisarFecha>0?'revisar':'neutro' },
  ];
  return <section aria-label="Resumen de pagos y vencimientos" className="cf-resumen">{tarjetas.map((t,i)=><div key={t.nombre} className={`cf-indicador${i>=3?' cf-indicador-secundario':''}`} data-tono={t.tono}>
    <div className="cf-indicador-etiqueta"><p>{t.nombre}</p><AyudaContextual etiqueta={t.nombre} texto={t.ayuda}/></div>
    <p className="cf-indicador-valor">{t.valor}</p>
  </div>)}</section>;
}
const moneda = (importe: number) => importe.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
