import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../src/index.css';
const qs = new URLSearchParams(location.search), originalFetch = window.fetch.bind(window);
const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
let fallo = qs.has('fallo'), adaptar = qs.has('adaptar'), rechazos = 0, llamadas = 0, canceladas = 0, activas = 0, maximas = 0;
const alumnos = Array.from({ length: 63 }, (_, i) => ({ id: uuid(i+1), nombre_completo: `ALUMNO DE PRUEBA ${String(i+1).padStart(2,'0')}`, matricula: `FICTICIA-${i+1}`, licenciatura: i%2 ? 'Derecho' : 'Administración', estatus: i%3 ? 'EGRESADO' : 'TITULADO', email: 'prueba@example.test', telefono: '', celular: '' }));
const ciclos = [{ id: uuid(100), nombre: '2026-3', tipo_periodo: 'Cuatrimestral' }, { id: uuid(101), nombre: '2027-1', tipo_periodo: 'Cuatrimestral' }];
const datosHistorial = alumnos.slice(0,62).flatMap(a => [{ alumno_id: a.id, ciclo_id: ciclos[0].id, ciclo_legado: null }, { alumno_id: a.id, ciclo_id: ciclos[1].id, ciclo_legado: null }]);
const certificaciones = alumnos.slice(0,50).map((a,i) => ({ alumno_id: a.id, tramite_completado: i%2 === 0 }));
const planes = qs.has('pagos') ? [
  ['R-83 (Efectivo)', qs.has('facturas') ? 'F-12306' : 'R-32474'],
  ['R-83 (Efectivo)', 'R-32474 (Abono $100.00, Resta $214.00)'],
  ['R-83 (Efectivo)', 'R-32474 (Por revisar en caja)'],
  ['R-83 (Efectivo)', qs.has('facturas') ? 'F-12306 CANCELADO' : 'R-32474 CANCELADO']
].map((estados,i) => ({ id: uuid(200+i), alumno_id: alumnos[i].id, tipo_plan: 'Titulación', detalles: estados.map((estatus,n) => ({ indice_concepto:n+1,concepto:`Concepto ficticio ${n+1}`,cantidad:314,estatus })) })) : [];
const respuesta = (data: unknown, status=200) => new Response(JSON.stringify(data), { status, headers: { 'content-type':'application/json' } });
const actualizar = () => { const el = document.getElementById('metricas'); if(el) el.textContent = JSON.stringify({ llamadas, canceladas, activas, maximas, rechazos }); };
window.fetch = async (input: any, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input), location.href);
  if (url.origin === location.origin) return originalFetch(input,init);
  if ((init?.method || 'GET') !== 'GET') return respuesta({ message:'Ensayo de solo lectura' },403);
  const tabla = url.pathname.split('/').pop(), ids = (url.searchParams.get('alumno_id') || '').replace(/^in\.\(/,'').replace(/\)$/,'').split(',');
  llamadas++; activas++; maximas = Math.max(maximas, activas); actualizar();
  try {
    await new Promise<void>((resolver,rechazar) => {
      const abortar = () => { clearTimeout(tiempo); canceladas++; actualizar(); rechazar(new DOMException('Cancelada','AbortError')); };
      const tiempo = setTimeout(() => { init?.signal?.removeEventListener('abort',abortar); resolver(); }, qs.has('lento') ? 4000 : 120);
      init?.signal?.addEventListener('abort',abortar,{once:true});
      if (init?.signal?.aborted) abortar();
    });
    if (tabla === 'inscripciones_academicas' && (fallo || adaptar && ids.length > 3)) { rechazos++; return respuesta({ code:'57014', message:'canceling statement due to statement timeout (ficticio)' },500); }
    const datos = tabla === 'inscripciones_academicas' ? datosHistorial : tabla === 'ficha_certificacion' ? certificaciones : [];
    const desde = Number(url.searchParams.get('offset') || 0), cantidad = Number(url.searchParams.get('limit') || 1000);
    return respuesta(datos.filter(d => ids.includes(d.alumno_id)).slice(desde,desde+cantidad));
  } finally { activas--; actualizar(); }
};
const { supabase } = await import('../src/lib/supabase');
supabase.channel = () => ({ on(){return this;}, subscribe(){return this;} }) as any;
supabase.removeChannel = async () => 'ok' as any;
const { useAppStore } = await import('../src/store/useAppStore');
useAppStore.setState({ alumnos: alumnos as any, ciclos: ciclos as any, catalogos: { licenciaturas: ['Administración','Derecho'] } as any, plans: planes as any, refreshAlumnos: async () => { useAppStore.setState({alumnos:[...alumnos] as any}); } });
const { ReporteEgresados } = await import('../src/components/reportes/ReporteEgresados');
function App() {
  const [visible,setVisible] = useState(true), [oscuro,setOscuro] = useState(qs.has('oscuro'));
  React.useEffect(()=>{document.documentElement.classList.toggle('dark',oscuro);},[oscuro]);
  return <MemoryRouter><main style={{padding:16,minHeight:'100vh',background:oscuro?'#101620':'#f6f8fc',color:oscuro?'#fff':'#172033'}}><div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,marginBottom:14}}><span>ENSAYO · SOLO DATOS FICTICIOS</span><button onClick={()=>setVisible(v=>!v)}>Mostrar u ocultar reporte</button><button onClick={()=>setOscuro(v=>!v)}>Cambiar tema</button><button onClick={()=>{fallo=false;adaptar=false;}}>Restablecer conexión ficticia</button></div><pre id="metricas" style={{fontSize:11,marginBottom:12,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}/>{visible && <ReporteEgresados onBack={()=>setVisible(false)}/>}</main></MemoryRouter>;
}
const raiz = createRoot(document.getElementById('root')!);raiz.render(<StrictMode><App/></StrictMode>);import.meta.hot?.dispose(()=>raiz.unmount());
