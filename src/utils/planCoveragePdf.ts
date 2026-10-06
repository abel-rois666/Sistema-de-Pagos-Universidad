import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { PlanCoverageColumn, PlanCoverageCycle, PlanCoverageEntry } from './planCoverageUtils';
import { countPlanObservations, PLAN_COVERAGE_COLUMNS, summarizeCoverage } from './planCoverageUtils';

const countStudents = (cycle: PlanCoverageCycle) => new Set(cycle.entries.map(entry => entry.alumnoId)).size;
const finalY = (doc: jsPDF, fallback: number) => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
const columnWidths: Record<PlanCoverageColumn, number> = {
  alumnoNombre: 38, licenciatura: 30, tipo: 29, integral: 16, observaciones: 52,
  estado: 18, conceptos: 14, monto: 22, faltantes: 50,
};
const pdfCell = (entry: PlanCoverageEntry, column: PlanCoverageColumn) => {
  switch (column) {
    case 'alumnoNombre': return `${entry.alumnoNombre}${entry.matricula ? ` (${entry.matricula})` : ''}`;
    case 'licenciatura': return entry.licenciatura;
    case 'tipo': return `${entry.tipo}${entry.estado === 'SIN_PLAN' ? '' : ` / ${entry.folio}`}`;
    case 'integral': return entry.estado === 'SIN_PLAN' ? '—' : entry.integral ? 'Sí' : 'No';
    case 'observaciones': return entry.observaciones.join('; ') || '—';
    case 'estado': return entry.estado === 'SIN_PLAN' ? 'Sin plan' : entry.estado === 'COMPLETO' ? 'Completo' : 'Incompleto';
    case 'conceptos': return String(entry.conceptos);
    case 'monto': return entry.estado === 'SIN_PLAN' ? '—' : money(entry.monto);
    case 'faltantes': return entry.faltantes.join('; ') || '—';
  }
};

export function createPlanCoveragePdf(
  cycles: PlanCoverageCycle[],
  filters: { ciclo: string; licenciatura: string; tipo?: string; observaciones?: string; integral?: string; busqueda: string; estado?: string },
  visibleColumns: PlanCoverageColumn[] = PLAN_COVERAGE_COLUMNS.map(column => column.key),
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const width = doc.internal.pageSize.getWidth();
  const summary = summarizeCoverage(cycles);
  doc.setFillColor(20, 86, 240);
  doc.rect(0, 0, width, 8, 'F');
  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Cobertura de planes de pago', 14, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const filterLines = doc.splitTextToSize(`Generado: ${new Date().toLocaleDateString('es-MX')}  |  Ciclo: ${filters.ciclo}  |  Licenciatura: ${filters.licenciatura}  |  Tipo: ${filters.tipo || 'Todos'}  |  Integral: ${filters.integral || 'Todos'}  |  Observaciones: ${filters.observaciones || 'Todas'}  |  Situación: ${filters.estado || 'Todos'}${filters.busqueda ? `  |  Búsqueda: ${filters.busqueda}` : ''}`, width - 28);
  doc.text(filterLines, 14, 27);
  let y = 27 + filterLines.length * 5;
  doc.text('Completo = cada fila usada tiene concepto, fecha y monto; $0 es válido y se omiten espacios sin usar.', 14, y);
  y += 5;
  doc.text(`Alumnos por ciclo: ${summary.alumnos}   Con plan completo: ${summary.alumnosConCompleto}   Sin plan completo: ${summary.alumnosSinCompleto}`, 14, y);
  y += 5;
  doc.text(`Planes completos: ${summary.planesCompletos}   Incompletos: ${summary.planesIncompletos}   Alumnos sin plan: ${summary.alumnosSinPlan}`, 14, y);
  y += 5;
  doc.text(`Planes integrales: ${summary.planesIntegrales}   Alumnos con plan integral: ${summary.alumnosConIntegral}`, 14, y);
  y += 5;
  doc.text('Sin plan = última asignación de grado en el ciclo sin plan registrado.', 14, y);
  y += 5;
  doc.text('Población: activos y egresados; titulados solo en ciclos con plan. Bajas excluidas.', 14, y);
  y += 7;

  for (const cycle of cycles) {
    if (y > 175) { doc.addPage(); y = 17; }
    const plans = cycle.entries.filter(entry => entry.estado !== 'SIN_PLAN');
    const complete = plans.filter(entry => entry.estado === 'COMPLETO').length;
    const types = new Map<string, { total: number; completos: number }>();
    for (const entry of plans) {
      const item = types.get(entry.tipo) || { total: 0, completos: 0 };
      item.total++;
      if (entry.estado === 'COMPLETO') item.completos++;
      types.set(entry.tipo, item);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(cycle.cicloNombre, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Alumnos: ${countStudents(cycle)}  |  Planes: ${plans.length}  |  Integrales: ${plans.filter(entry => entry.integral).length}  |  Completos: ${complete}  |  Incompletos: ${plans.length - complete}  |  Sin plan: ${cycle.entries.filter(entry => entry.estado === 'SIN_PLAN').length}`, 14, y + 6);
    y += 9;
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14 },
      head: [['Tipo de plan', 'Cantidad', 'Completos']],
      body: types.size ? Array.from(types, ([name, item]) => [name, String(item.total), String(item.completos)]) : [['Sin planes registrados', '0', '0']],
      theme: 'grid', styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [30, 58, 95] },
    });
    y = finalY(doc, y) + 4;
    const observationCounts = countPlanObservations(plans);
    if (observationCounts.length > 0) {
      autoTable(doc, {
        startY: y, margin: { left: 14, right: 14 },
        head: [['Observación en planes integrales', 'Planes']],
        body: observationCounts.map(item => [item.nombre, String(item.planes)]),
        theme: 'grid', styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [30, 58, 95] },
      });
      y = finalY(doc, y) + 4;
    }
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14 },
      tableWidth: visibleColumns.reduce((total, key) => total + columnWidths[key], 0),
      head: [visibleColumns.map(key => PLAN_COVERAGE_COLUMNS.find(column => column.key === key)?.label || key)],
      body: cycle.entries.length
        ? cycle.entries.map(entry => visibleColumns.map(key => pdfCell(entry, key)))
        : [visibleColumns.map((_, index) => index === 0 ? 'Sin alumnos vinculados al ciclo' : '—')],
      theme: 'striped', styles: { fontSize: 6, cellPadding: 1, overflow: 'linebreak' }, headStyles: { fillColor: [20, 86, 240] },
      columnStyles: Object.fromEntries(visibleColumns.map((key, index) => [index, { cellWidth: columnWidths[key] }])),
    });
    y = finalY(doc, y) + 12;
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Página ${page} de ${doc.getNumberOfPages()}`, width - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }
  return doc;
}
