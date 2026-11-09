// Galería de los componentes y hojas reales; sin servicios ni datos personales.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import '../src/components/ui/temaModulosEscolares.css';
import '../src/components/inscripciones/inscripciones.css';
import '../src/components/estadistica911/estadistica911.css';
import { CampoConAyuda } from '../src/components/ui/AyudaContextual';
import { AYUDAS_INSCRIPCIONES } from '../src/inscripciones/ayudas';
import SelectorPeriodoFinanciero from '../src/components/planesPago/SelectorPeriodoFinanciero';

function EnsayoAyudas() {
  const [oscuro,setOscuro]=useState(false);
  return <main className="min-h-screen space-y-4 bg-gray-100 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
    <header className="mx-auto flex max-w-4xl flex-wrap items-center gap-4"><h1>Ensayo de ayudas · Sin conexiones externas</h1><button className="rounded-lg border border-gray-400 p-2" onClick={()=>{setOscuro(!oscuro);document.documentElement.classList.toggle('dark',!oscuro);}}>Cambiar tema</button></header>
    <section className="mx-auto max-w-4xl space-y-3 rounded-xl border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-[#1c2228]"><h2>Finanzas</h2><SelectorPeriodoFinanciero value="2028-1" periodos={['2028-1','2027-1']} onChange={()=>{}} /></section>
    <section className="ic mx-auto max-w-4xl"><div className="ic-card"><h2>Inscripciones · muestra de estilo</h2><div className="ic-contexto ic-contexto-principal"><CampoConAyuda etiqueta="Ciclo de inscripción" ayuda={AYUDAS_INSCRIPCIONES.ciclo}><select defaultValue="2027-1"><option>2027-1 · Semestral</option></select></CampoConAyuda><CampoConAyuda etiqueta="Ver quién estaba inscrito el" ayuda={AYUDAS_INSCRIPCIONES.consulta}><input type="date" defaultValue="2026-11-07" /></CampoConAyuda></div></div></section>
    <section className="s911 mx-auto max-w-4xl"><div className="s911-card"><h2>Estadística 911 · muestra de estilo</h2><div className="s911-grid"><CampoConAyuda etiqueta="Fecha de corte" ayuda="Día de referencia para determinar la matrícula y la edad de los alumnos. Cambiarlo requiere revisar las fuentes y recalcular el expediente; no modifica las fechas de inscripción guardadas."><input type="date" defaultValue="2026-09-30" /></CampoConAyuda></div></div></section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<EnsayoAyudas />);
