// Ensayo aislado del cliente: respuestas ficticias; no llama a Supabase ni ejecuta SQL.
import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import '../src/index.css';
const qs = new URLSearchParams(location.search), original = window.fetch.bind(window);
document.documentElement.classList.toggle('dark', qs.has('oscuro'));
const ensayo = { modo: qs.has('fiscal') ? 'fiscal' : 'corregido', solicitudes: [] as unknown[], refrescos: 0 };
(window as unknown as { ensayoNombres: typeof ensayo }).ensayoNombres = ensayo;
const filas = [1, 2].map(n => ({ docente_id: `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`, clave: `PF700${n}`, nombre_historico: `DOCENTE FICTICIO ${n}`, revision: 0,
  original: { nombre_completo: `DOCENTE FICTICIO ${n}`, rfc: 'RFC HISTÓRICO', curp: 'CURP ANTERIOR', email: 'CORREO ANTERIOR', clave_legado: `PF700${n}`, estatus: 'activo' }, datos: { nombre_completo: `DOCENTE FICTICIO ${n}`, rfc: 'RFC HISTÓRICO', curp: 'CURP ANTERIOR', email: 'CORREO ANTERIOR' } }));
let pendientes = [...filas];
window.fetch = async (input, init) => {
  const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
  if (u.origin === location.origin) return original(input, init);
  const responder = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), { status, headers: { 'content-type': 'application/json' } });
  const body = JSON.parse(String(init?.body || '{}'));
  if (u.pathname.endsWith('/personal_nombres_pendientes_v1')) return responder({ filas: pendientes.slice(body.p_offset, body.p_offset + 15), total: pendientes.length });
  if (u.pathname.endsWith('/personal_nombres_revisar_lote_v1')) {
    ensayo.solicitudes.push(body);
    if (ensayo.modo === 'fiscal') return responder({ code: 'P0001', message: 'Revisa el formato del RFC' }, 400);
    if (ensayo.modo === 'conflicto') return responder({ code: '40001', message: 'Expediente cambió' }, 409);
    pendientes = pendientes.filter(f => !body.p_filas.some((p: { docente_id: string }) => p.docente_id === f.docente_id));
    return responder({ revisados: body.p_filas.length });
  }
  return responder({ code: '42501', message: 'Petición externa no prevista y bloqueada en ensayo' }, 403);
};
const { default: RevisionNombresDocentes } = await import('../src/components/personal/RevisionNombresDocentes');
function App() {
  const [abierto, setAbierto] = useState(false);
  return <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-slate-950 dark:text-gray-100"><p>ENSAYO LOCAL · DATOS FICTICIOS · SIN SQL</p><button onClick={() => setAbierto(true)}>Abrir revisión</button>{abierto && <RevisionNombresDocentes onClose={() => setAbierto(false)} onSaved={() => { ensayo.refrescos++; }}/>}<Toaster/></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
