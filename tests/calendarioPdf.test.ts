import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { actividadesCalendario } from '../src/calendario/actividades';
import { crearPdfCalendario } from '../src/calendario/exportarPdf';
import type { CalendarioAcademico, EventoAcademico } from '../src/calendario/service';

const calendario: CalendarioAcademico = {
  id: 'cal-1', ciclo_id: 'ciclo-1', nombre: '2027-1 Calendario cuatrimestral matutino y vespertino',
  tipo_periodo: 'CUATRIMESTRAL', modalidad: 'ESCOLARIZADA', fecha_inicio: '2026-10-21',
  fecha_fin: '2027-01-29', turnos: ['MATUTINO', 'VESPERTINO'], plan_ids: ['plan-1', 'plan-2'],
};
const evento = (id: string, nombre: string, tipo: string, inicio: string, fin = inicio,
  color = '#2563eb'): EventoAcademico => ({ id, calendario_id: calendario.id, nombre, tipo,
    fecha_inicio: inicio, fecha_fin: fin, color, suspende_clases: ['VACACIONES', 'FESTIVO', 'RECUPERACION', 'EXTRAORDINARIOS'].includes(tipo) });
const eventos = [
  evento('1', 'Suspensión de actividades', 'FESTIVO', '2026-11-16', undefined, '#b91c1c'),
  evento('2', 'Primer examen parcial', 'EXAMENES', '2026-11-17', '2026-11-23'),
  evento('3', 'Periodo vacacional', 'VACACIONES', '2026-12-23', '2027-01-02', '#b91c1c'),
  evento('4', 'Segundo examen parcial', 'EXAMENES', '2026-12-16', '2026-12-22'),
  evento('5', 'Tercer examen parcial', 'EXAMENES', '2027-01-25', '2027-01-29'),
  evento('6', 'Captura y entrega de calificaciones finales', 'CAPTURA', '2027-01-30', '2027-02-06'),
  evento('7', 'Registro de exámenes de recuperación', 'RECUPERACION', '2027-01-30', '2027-02-03'),
  evento('8', 'Aplicación de exámenes de recuperación', 'RECUPERACION', '2027-02-04', '2027-02-06'),
  evento('9', 'Registro de exámenes extraordinarios', 'EXTRAORDINARIOS', '2027-02-08', '2027-02-09'),
  evento('10', 'Aplicación de exámenes extraordinarios', 'EXTRAORDINARIOS', '2027-02-10', '2027-02-12'),
  evento('11', 'Reinscripciones ciclo siguiente', 'OTRO', '2027-02-13', '2027-02-17'),
];
const datos = { calendario, cicloNombre: '2027-1', eventos, planes: [
  { id: 'plan-1', nombre: 'Administración', clave_legado: '2017-LA', carreras: { nombre: 'Administración' } },
  { id: 'plan-2', nombre: 'Derecho', clave_legado: '2017-LD', carreras: { nombre: 'Derecho' } },
] };

test('el inicio y término de clases aparecen junto con los eventos sin duplicarse', () => {
  const actividades = actividadesCalendario(calendario.fecha_inicio, calendario.fecha_fin, eventos);
  assert.equal(actividades[0].nombre, 'Inicio de clases');
  assert.equal(actividades.find(item => item.nombre === 'Término de clases')?.fecha_inicio, '2027-01-29');
  const conInicioRegistrado = actividadesCalendario(calendario.fecha_inicio, calendario.fecha_fin,
    [...eventos, evento('12', 'Apertura del ciclo', 'INICIO', calendario.fecha_inicio)]);
  assert.equal(conInicioRegistrado.filter(item => item.tipo === 'INICIO').length, 1);
});

test('las dos variantes de PDF incluyen el calendario guardado y sus actividades', () => {
  const completo = crearPdfCalendario(datos, 'completo');
  const soloActividades = crearPdfCalendario(datos, 'actividades');
  assert.ok(completo.output().startsWith('%PDF-'));
  assert.ok(soloActividades.output().startsWith('%PDF-'));
  assert.ok(completo.getNumberOfPages() >= 1);
  assert.ok(soloActividades.getNumberOfPages() >= 1);
  if (process.env.CALENDARIO_PDF_PREVIEW) {
    mkdirSync('tmp/pdfs', { recursive: true });
    writeFileSync('tmp/pdfs/calendario-completo-prueba.pdf', Buffer.from(completo.output('arraybuffer')));
    writeFileSync('tmp/pdfs/calendario-actividades-prueba.pdf', Buffer.from(soloActividades.output('arraybuffer')));
  }
});

test('la exportación completa pagina los calendarios y actividades extensos', () => {
  const largo: CalendarioAcademico = { ...calendario, fecha_inicio: '2026-01-01', fecha_fin: '2027-12-31' };
  const actividadesLargas = Array.from({ length: 35 }, (_, indice) => {
    const fecha = new Date(Date.UTC(2026, 0, 2 + indice * 19)).toISOString().slice(0, 10);
    return evento(`e-${indice}`, `Actividad académica número ${indice + 1}`, 'OTRO', fecha);
  });
  const pdf = crearPdfCalendario({ ...datos, calendario: largo, eventos: actividadesLargas }, 'completo');
  assert.ok(pdf.getNumberOfPages() >= 3);
});
