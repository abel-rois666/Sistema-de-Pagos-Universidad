import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import '../src/index.css';
const qs = new URLSearchParams(location.search), originalFetch = window.fetch.bind(window);
const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const nombres = ['Álvarez Peña Alejandra', 'Ávila Ruiz Bruno', 'Báez López Carla', 'Campos Pérez David', 'Cruz Soto Elena', 'Díaz Ruiz Fernando', 'Flores Ortiz Gabriela', 'García Ramos Hugo', 'Herrera Torres Isabel', 'Jiménez Ríos Jorge', 'López Silva Karina', 'Méndez Vargas Luis', 'Núñez León María', 'Ortiz Salas Nicolás', 'Pérez Castro Olivia', 'Ramírez Solís Pablo'];
let docentes = nombres.map((nombre, i) => ({ id: uuid(i + 1), persona_id: i < 2 ? uuid(50 + i) : null, clave_legado: `PF${String(i+1).padStart(4, '0')}`, nombre_completo: nombre, email: i === 2 ? 'correo.largo.de.prueba@example.test / otro@example.test' : i % 3 === 0 ? '' : `docente${i}@example.test`, rfc: '', curp: '', estatus: i > 13 ? 'inactivo' : 'activo', usuarios: i % 4 === 0 ? [] : [{ id: uuid(100 + i), activo: i % 3 !== 0, auth_id: i % 4 === 2 ? null : uuid(200 + i) }] }));
let empleados = nombres.slice(0, 12).map((nombre, i) => ({ id: uuid(500 + i), persona_id: i < 2 ? uuid(50 + i) : null, nombres: nombre.split(' ').slice(2).join(' '), apellido_paterno: nombre.split(' ')[0], apellido_materno: nombre.split(' ')[1], estatus: i % 4 === 0 ? 'inactivo' : 'activo', puesto: i % 2 === 0 ? 'Coordinador Académico' : 'Auxiliar Administrativo', departamento: i % 3 === 0 ? 'Servicios Escolares' : 'Finanzas', telefono: '', fecha_ingreso: i % 2 ? '2020-01-15' : null }));
const evaluaciones = [{ id: uuid(700), empleado_id: empleados[0].id, empleados: empleados[0], tipo_guia: 'GUIA_II', created_at: '2026-11-01T12:00:00Z', nivel_riesgo: 'Bajo', calificacion_final: 30, calificacion_desglose: { categorias: [] } }];
const planes = [{ id: uuid(800), titulo: 'Seguimiento del entorno laboral', descripcion: 'Plan ficticio para comprobar el flujo de consulta.', nivel_intervencion: 'Primer nivel', estatus: 'Pendiente', created_at: '2026-11-01' }];
const peticiones: string[] = [];
let errorConsulta = qs.has('error');
const respuesta = (d: any, status=200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
window.fetch = async (input: any, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input), location.href);
  if (url.origin === location.origin) return originalFetch(input, init);
  const tabla = url.pathname.split('/').pop()!;
  const metodo = init?.method || 'GET';
  peticiones.push(`${metodo} ${tabla}`); document.getElementById('peticiones')!.textContent = JSON.stringify(peticiones);
  if (metodo !== 'GET' && !url.pathname.includes('/rpc/')) return respuesta({ message: 'Ensayo de solo lectura: escritura bloqueada.' }, 403);
  if (errorConsulta && ['docentes','empleados'].includes(tabla)) return respuesta({ message: 'Fallo ficticio de consulta' }, 503);
  if (tabla === 'personal_consultar_v3') {
    const b = JSON.parse(String(init?.body || '{}')), esDocente = b.p_tipo === 'DOCENTE';
    const f: any = (esDocente ? docentes : empleados).find(f => f.id === b.p_id);
    return respuesta({ disponible: true, nombres_disponibles: true, funciones_disponibles: true, persona_id: f?.persona_id, revision: 1, original: f, datos: { ...f, nombre_completo: f?.nombre_completo || [f?.apellido_paterno, f?.apellido_materno, f?.nombres].filter(Boolean).join(' ') }, docente_id: esDocente ? f.id : null, empleado_id: !esDocente ? f.id : null, referencia_docente: esDocente ? f : null, referencia_institucional: !esDocente ? f : null, referencia_laboral: !esDocente ? f : null, laborales: [], academicos: [], expediente: null, permisos: { generales: true, academicos: true, docencia: true, laborales: true, expediente: true, editar_laborales: true, editar_expediente: true, vincular: true } });
  }
  if (tabla === 'personal_buscar_personas_v1') return respuesta({ filas: [], total: 0 });
  if (tabla === 'personal_nombres_pendientes_v1') return respuesta({ filas: [], total: 0 });
  const datos: any[] = tabla === 'docentes' ? docentes : tabla === 'empleados' ? empleados : tabla === 'nom035_evaluaciones' ? evaluaciones : tabla === 'nom035_planes_accion' ? planes : [];
  const filtradas = url.searchParams.has('persona_id') ? datos.filter(d => d.persona_id) : datos;
  return respuesta(filtradas.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 1000)));
};
const { supabase } = await import('../src/lib/supabase');
supabase.channel = () => ({ on() { return this; }, subscribe() { return this; } }) as any;
supabase.removeChannel = async () => 'ok' as any;
const { useAppStore } = await import('../src/store/useAppStore');
useAppStore.setState({ currentUser: { id: 'ficticio', rol: 'ADMINISTRADOR', username: 'ENSAYO' } as any });
const { default: DocentesConfig } = await import('../src/components/DocentesConfig');
const { default: RecursosHumanosConfig } = await import('../src/components/RecursosHumanosConfig');
function App() {
  const [rh, setRh] = useState(qs.has('rh')), [oscuro, setOscuro] = useState(qs.has('oscuro')), [rol, setRol] = useState('ADMINISTRADOR');
  React.useEffect(() => { document.documentElement.classList.toggle('dark', oscuro); }, [oscuro]);
  return <MemoryRouter><div style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 12, color: oscuro ? '#fff' : '#172033', background: oscuro ? '#111827' : '#f6f8fc', fontSize: 12 }}><span>ENSAYO · DATOS FICTICIOS</span><button onClick={() => setRh(!rh)}>Cambiar módulo</button><button onClick={() => setOscuro(!oscuro)}>Cambiar tema</button><button onClick={() => { errorConsulta = false; }}>Restablecer conexión ficticia</button><label>Rol<select value={rol} onChange={e => { setRol(e.target.value); useAppStore.setState({ currentUser: { id: 'ficticio', rol: e.target.value, username: 'ENSAYO' } as any }); }}><option>ADMINISTRADOR</option><option>COORDINADOR ACADEMICO</option><option>COORDINADOR RECURSOS HUMANOS</option></select></label></div><pre hidden id="peticiones"/><div style={{ minHeight: '100vh', background: oscuro ? '#111720' : '#f6f8fc' }}>{rh ? <RecursosHumanosConfig onBack={() => {}} onNavigateToEvaluacion={() => {}}/> : <DocentesConfig key={rol}/>}</div><Toaster/></MemoryRouter>;
}
const raiz = createRoot(document.getElementById('root')!); raiz.render(<App/>); import.meta.hot?.dispose(() => raiz.unmount());
