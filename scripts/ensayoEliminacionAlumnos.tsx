import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import '../src/index.css';

// Ensayo exclusivamente local: todas las peticiones quedan interceptadas antes de importar Supabase.
const qs = new URLSearchParams(location.search);
const original = window.fetch.bind(window);
const id = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
let alumnos = Array.from({ length: 3 }, (_, i) => ({ id: id(i + 1), nombre_completo: `PRUEBA FICTICIA ${i + 1}`, matricula: `DEMO-${i + 1}`, licenciatura: 'Administración', grado_actual: '1ER', estatus: 'ACTIVO', turno: 'MIXTO' }));
let recibos = [0, 1].map(i => ({ id: id(10 + i), alumno_id: id(1), folio: 41069 + i, estatus: i ? 'CANCELADO' : 'ACTIVO', ciclo_id: id(50), total: 157, fecha_recibo: '2026-11-01', fecha_pago: '2026-11-01', forma_pago: 'EFECTIVO', banco: 'NO APLICA', requiere_factura: false, estatus_factura: 'NO APLICA' }));
let deletes = 0;
let borradosRecibo = 0;
const responder = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
  if (url.origin === location.origin) return original(input, init);
  const tabla = url.pathname.split('/').at(-1);
  const metodo = init?.method || (input instanceof Request ? input.method : 'GET');
  if (metodo === 'POST' && tabla === 'borrar_recibo_prueba_v2') {
    if (qs.has('sin-migracion')) return responder({ code: 'PGRST202', message: 'Función no instalada (ficticio)' }, 404);
    if (qs.has('coordinador')) return responder({ code: '42501', message: 'Sin permiso (ficticio)' }, 403);
    if (qs.has('recibo-vinculado')) return responder({ code: '23503', message: 'Dependencia ficticia' }, 409);
    const cuerpo = JSON.parse(String(init?.body || '{}'));
    recibos = recibos.filter(r => r.id !== cuerpo.p_recibo_id);
    borradosRecibo++; document.getElementById('borrados-recibo')!.textContent = `Recibos ficticios borrados: ${borradosRecibo}`;
    return responder(null);
  }
  if (metodo === 'DELETE' && tabla === 'alumnos') {
    deletes++; document.getElementById('metricas')!.textContent = `DELETE ficticios: ${deletes}`;
    const seleccion = url.searchParams.get('id') || '';
    if (qs.has('sin-permiso')) return responder([]);
    if (recibos.some(r => seleccion.includes(r.alumno_id))) return responder({ code: '23503', message: 'foreign key constraint "recibos_alumno_id_fkey"' }, 409);
    const eliminados = alumnos.filter(a => seleccion.includes(a.id));
    alumnos = alumnos.filter(a => !seleccion.includes(a.id));
    return responder(eliminados.map(a => ({ id: a.id })));
  }
  if (metodo !== 'GET') return responder({ message: 'Escritura externa bloqueada por el ensayo' }, 403);
  if (tabla === 'recibos') {
    if (qs.has('fallo-consulta') && url.searchParams.has('alumno_id')) return responder({ message: 'Error ficticio de permisos', code: '42501' }, 403);
    const seleccion = url.searchParams.get('alumno_id');
    return responder(recibos.filter(r => !seleccion || seleccion.includes(r.alumno_id)));
  }
  return responder([]);
};
const { useAppStore } = await import('../src/store/useAppStore');
useAppStore.setState({ currentUser: { id: id(90), rol: qs.has('coordinador') ? 'COORDINADOR CONTROL ESCOLAR' : 'ADMINISTRADOR', username: 'ensayo' } as any,
  alumnos: alumnos as any, plans: [], plantillas: [], ciclos: [{ id: id(50), nombre: '2026-3', tipo_periodo: 'Cuatrimestral' }, { id: id(51), nombre: '2027-1', tipo_periodo: 'Semestral' }] as any,
  activeCicloId: id(51), catalogos: { licenciaturas: ['Administración'], turnos: ['MIXTO'], conceptos: [], bancos: [], formasPago: [] } as any });
const { default: AlumnosConfig } = await import('../src/components/AlumnosConfig');
const { default: ConsultarRegistros } = await import('../src/components/ConsultarRegistros');
function App() {
  const ubicacion = useLocation(), navigate = useNavigate();
  return <div className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100" style={{ minHeight: '100vh', padding: 16 }}>
    <header className="mb-4 flex flex-wrap items-center gap-4 text-sm">
      <strong>Ensayo ficticio · sin conexión externa</strong><span id="metricas">DELETE ficticios: 0</span><span id="borrados-recibo">Recibos ficticios borrados: 0</span>
      <button onClick={() => { recibos = []; document.getElementById('limpieza')!.textContent = 'Recibos ficticios retirados'; }} className="rounded border px-3 py-2" id="limpieza">Simular depuración previa de recibos</button>
      <button onClick={() => document.documentElement.classList.toggle('dark')} className="rounded border px-3 py-2">Cambiar tema</button>
      <button onClick={() => navigate('/control-ingresos/consultar', {state:{searchTerm:'41069'}})} className="rounded border px-3 py-2">Consultar recibo ficticio</button>
    </header>
    {ubicacion.pathname.startsWith('/control-ingresos') ? <><button onClick={() => navigate(-1)} className="mb-3 rounded border px-3 py-2">Volver al padrón</button><ConsultarRegistros initialSearchTerm={ubicacion.state?.searchTerm} /></>
      : <AlumnosConfig onBack={() => {}} />}
    <Toaster />
  </div>;
}
document.documentElement.classList.toggle('dark', qs.has('oscuro'));
createRoot(document.getElementById('root')!).render(<MemoryRouter><App /></MemoryRouter>);
