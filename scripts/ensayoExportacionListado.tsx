// Ensayo aislado: toda petición externa se responde con datos ficticios. Sin escrituras.
import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import '../src/index.css';
import type { Alumno, PaymentPlan } from '../src/types';
import { columnasListado } from '../src/reportes/listadoGeneral';
const qs = new URLSearchParams(location.search), original = window.fetch.bind(window);
document.documentElement.classList.toggle('dark', qs.has('oscuro'));
const id = (n: number) => `55555555-5555-4555-8555-${String(n).padStart(12, '0')}`;
const programas = [1, 2].map(n => ({ id: id(n + 100), alumno_id: id(1), plan_id: id(n + 200), estatus: n === 1 ? 'EGRESADO' : 'CURSANDO', es_vigente: n === 1, planes_estudio: { nombre: 'PLAN · CON SEPARADOR', clave_legado: n === 1 ? '2017_LD' : '2001_LD', tipo_periodo: 'CUATRIMESTRAL', modalidad: 'ESCOLARIZADA', carreras: { nombre: 'DERECHO' } } }));
const certificaciones = [
  { alumno_id: id(1), alumno_programa_id: id(101), id: id(301), pago_certificado: 'COMPLETADO', tramite_completado: true },
  { alumno_id: id(1), alumno_programa_id: id(102), id: null, sin_ficha: true, tramite_completado: null },
  { alumno_id: id(2), alumno_programa_id: null, id: id(302), pago_certificado: 'EN_CURSO', tramite_completado: false }
];
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
  if (url.origin === location.origin) return original(input, init);
  const respuesta = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  if (url.pathname.endsWith('/alumno_programas')) { const desde = Number(url.searchParams.get('offset') || 0); return respuesta(programas.slice(desde, desde + 500)); }
  if (url.pathname.endsWith('/certificacion_resumen_v1')) { const desde = Number(JSON.parse(String(init?.body || '{}')).p_desde || 0); return qs.has('fallo') ? respuesta({ message: 'Fallo ficticio', code: '42501' }, 403) : respuesta(certificaciones.slice(desde, desde + 500)); }
  return respuesta({ message: 'Petición no prevista en ensayo ficticio' }, 403);
};
const { default: ExportarListadoCSV } = await import('../src/components/reportes/ExportarListadoCSV');
const alumnos = [1, 2, 3].map(n => ({ id: id(n), matricula: `00${n}`, nombre_completo: `PERSONA FICTICIA ${n}`, estatus: 'ACTIVO', email: 'ficticio@example.invalid' })) as Alumno[];
const planes = [1, 2].map(n => ({ id: id(400 + n), alumno_id: id(1), ciclo_id: id(500 + n), ciclo_escolar: n === 1 ? '2027-1' : '2026-2', no_plan_pagos: 'FOLIO REPETIDO', tipo_plan: 'Titulación', concepto_1: 'Primer pago', estatus_1: n === 1 ? 'F-12306' : 'Abono $500', cantidad_1: 1000 })) as PaymentPlan[];
function App() {
  const [abierto, setAbierto] = useState(false);
  return <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-slate-950 dark:text-gray-100"><p>ENSAYO LOCAL · DATOS FICTICIOS · RED EXTERNA INTERCEPTADA</p><button onClick={() => setAbierto(true)}>Abrir exportación</button>{abierto && <ExportarListadoCSV alumnos={alumnos} planes={planes} ciclos={[{ id: id(501), nombre: '2027-1', tipo_periodo: 'Cuatrimestral' }, { id: id(502), nombre: '2026-2', tipo_periodo: 'Semestral' }]} columnas={columnasListado(['email', 'pagoCertificado', 'certificacion'])} fecha="2026-11-10" periodo="2027-1 · Cuatrimestral" onCerrar={() => setAbierto(false)}/>}<Toaster/></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
