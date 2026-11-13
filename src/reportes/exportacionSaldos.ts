import { toTitleCase } from '../utils';
import { formatGrado } from '../utils/formatUtils';
import type { RegistroReporteFinanciero } from '../utils/consultaAlumnos';

/** Conserva posición/nombres de las siete columnas anteriores y añade el desglose al final. */
export function tablaSaldosCSV(registros: readonly RegistroReporteFinanciero[]) {
  return {
    headers: ['ALUMNO', 'LICENCIATURA', 'GRADO', 'ESTATUS', 'TIENE_PLAN', 'HA_PAGADO', 'ADEUDA', 'VENCIDO_POR_PAGAR', 'POR_PAGAR_AUN_EN_PLAZO', 'PENDIENTE_DE_REVISAR_FECHA'],
    rows: registros.map(r => [toTitleCase(r.nombre), toTitleCase(r.licenciatura), formatGrado(r.grado), r.estatus, r.tienePlan ? 'SÍ' : 'NO', r.pagado.toString(), r.adeuda.toString(), r.vencido.toString(), r.enPlazo.toString(), r.revisarFecha.toString()]),
  };
}
