import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../src/index.css';
const qs = new URLSearchParams(location.search); document.documentElement.classList.toggle('dark', qs.has('oscuro'));
const alumnos = Array.from({ length: 27 }, (_, i) => ({ id: `a${i}`, nombre_completo: `ALUMNO FICTICIO ${String(i).padStart(2, '0')} NOMBRE LARGO PARA REVISIÓN`, matricula: `000${i}`, estatus: i < 26 ? 'ACTIVO' : 'EGRESADO', licenciatura: 'DERECHO', grado_actual: '5', turno: 'MATUTINO' }));
const planes = alumnos.map(a => ({ id: `p${a.id}`, alumno_id: a.id, ciclo_id: 'c', ciclo_escolar: '2027-1', tipo_plan: 'Titulación', no_plan_pagos: 'PLAN FICTICIO', concepto_1: 'TITULACIÓN', cantidad_1: 100, estatus_1: 'R-1; R-2 (Abono $40.00, Resta $30.00)' }));
const recibos = alumnos.flatMap(a => [1, 2, 3].map(n => ({ id: `r${a.id}-${n}`, folio: n, alumno_id: a.id, ciclo_id: 'historico', fecha_pago: '2026-11-12', total: 150, forma_pago: n === 1 ? 'EFECTIVO' : 'TRANSFERENCIA', estatus: 'ACTIVO', folio_fiscal: n === 1 ? '12306' : null })));
const detalles = recibos.map(r => ({ id: `d${r.id}`, recibo_id: r.id, concepto: r.folio === 3 ? 'CERTIFICADO TOTAL (PAGO PARCIAL)' : 'TITULACIÓN', cantidad: 1, costo_unitario: 40, subtotal: 40 }));
const vinculos = alumnos.flatMap(a => [1, 2].map(n => ({ id: `v${a.id}-${n}`, plan_id: `p${a.id}`, recibo_detalle_id: `dr${a.id}-${n}`, indice_concepto: 1, importe: n === 1 ? 30 : 40, anulado_en: null })));
const fichas = alumnos.flatMap(a => [{ id: `f${a.id}`, alumno_id: a.id, alumno_programa_id: `ap${a.id}`, programa: 'DERECHO · PLAN 2017', pago_certificado: 'COMPLETADO', tramite_completado: false, sin_ficha: false }, ...(a.id === 'a0' ? [{ id: 'segunda', alumno_id: a.id, alumno_programa_id: 'ap2', programa: 'DOCENCIA UNIVERSITARIA · PLAN 2009', pago_certificado: 'EN_CURSO', tramite_completado: true, sin_ficha: false }] : [])]);
const datos: Record<string, any[]> = { vista_planes_pago: planes, recibos, recibos_detalles: detalles, planes_pago_vinculos_recibo: vinculos };
Object.assign(window, { ensayoLlamadas: [], ensayoFallar: false, ensayoBlobs: [] });
const crearURL = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { (window as any).ensayoBlobs.push(blob); return crearURL(blob); };
HTMLAnchorElement.prototype.click = function () {};
window.fetch = async (input, init) => {
  const u = new URL(String(input)), tabla = u.pathname.split('/').at(-1)!;
  (window as any).ensayoLlamadas.push({ tabla, metodo: init?.method || 'GET' });
  if ((window as any).ensayoFallar && tabla === 'recibos') return new Response(JSON.stringify({ message: 'Error ficticio', code: '42501' }), { status: 403 });
  let filas = datos[tabla] || [];
  if (tabla === 'certificacion_resumen_v1') {
    const cuerpo = JSON.parse(String(init?.body || '{}')); filas = fichas.filter(f => cuerpo.p_alumnos.includes(f.alumno_id)).slice(cuerpo.p_desde, cuerpo.p_desde + cuerpo.p_cantidad);
  } else {
    for (const campo of ['alumno_id', 'recibo_id', 'plan_id']) { const filtro = u.searchParams.get(campo); if (filtro?.startsWith('in.(')) { const ids = filtro.slice(4, -1).split(',').map(v => v.replaceAll('"', '')); filas = filas.filter(f => ids.includes(f[campo])); } }
    const desde = Number(u.searchParams.get('offset') || 0); filas = filas.slice(desde, desde + 2); // Tope instalado menor que 500.
  }
  return new Response(JSON.stringify(filas), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const { useAppStore } = await import('../src/store/useAppStore');
useAppStore.setState({ currentUser: { id: 'ficticio', auth_id: 'ficticio', rol: qs.get('rol') || 'ADMINISTRADOR', username: 'Ensayo' } as any, alumnos: alumnos as any, plans: planes as any, ciclos: [{ id: 'c', nombre: '2027-1', tipo_periodo: 'Cuatrimestral' }] as any, catalogos: { licenciaturas: ['DERECHO'], turnos: ['MATUTINO'] } as any });
const { ReporteListadoGeneral } = await import('../src/components/reportes/ReporteListadoGeneral');
createRoot(document.getElementById('root')!).render(<MemoryRouter><main className="min-h-screen bg-gray-50 p-3 text-gray-900 dark:bg-[#080e18] dark:text-gray-100"><ReporteListadoGeneral onBack={() => {}}/></main></MemoryRouter>);
