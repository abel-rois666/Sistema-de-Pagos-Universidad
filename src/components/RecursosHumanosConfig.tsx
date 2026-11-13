import {normalizarEmpleado,validarEmpleadoBasico} from '../personal/validacionEmpleado';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, FileBarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { Empleado, Nom035PlanAccion } from '../types';
import { toTitleCase } from '../utils';
import AltaPersonal from './personal/AltaPersonal';
import FichaPersonal from './personal/FichaPersonal';
import type { OrigenPersonal } from '../personal/types';
import DirectorioDocentePersonal from './personal/DirectorioDocentePersonal';
import DirectorioPersonal from './personal/DirectorioPersonal';
import MenuDirectorio from './personal/MenuDirectorio';
import ResultadosNom035 from './personal/ResultadosNom035';
import PlanesAccionNom035 from './personal/PlanesAccionNom035';
import useConsultasRH, { type SeccionRH } from '../hooks/useConsultasRH';
import { consultarPersonasVinculadas } from '../services/directorioPersonalService';
import { edadPersonal, antiguedadPersonal } from '../personal/presentacion';
import { estadoCuentaPersonal, type FilaDirectorioPersonal } from '../personal/directorio';
import { useCuentasAdministrativos } from '../hooks/useCuentasAdministrativos';
import GestionAdministrativo from './personal/GestionAdministrativo';
import ModalEmpleado from './modals/ModalEmpleado';
import FichaEmpleado from './modals/FichaEmpleado';
import ModalPlanAccion from './modals/ModalPlanAccion';
import ModalConfirmacion from './ui/ModalConfirmacion';
import EstadoError from './ui/EstadoError';

interface RecursosHumanosConfigProps { onBack: () => void; onNavigateToEvaluacion: () => void; seccion?:SeccionRH; onSeccionChange?:(seccion:SeccionRH)=>void }

export default function RecursosHumanosConfig({ onBack, onNavigateToEvaluacion,seccion,onSeccionChange }: RecursosHumanosConfigProps) {
  const isAdmin = useAppStore(s => s.currentUser?.rol === 'ADMINISTRADOR');
  const [tabLocal,setTabLocal]=useState<SeccionRH>('directorio');
  const activeTab=seccion||tabLocal;
  const setActiveTab=(v:SeccionRH)=>onSeccionChange?onSeccionChange(v):setTabLocal(v);
  const [ultimaNom, setUltimaNom] = useState<'resultados' | 'planes'>('resultados');
  useEffect(()=>{if(activeTab!=='directorio')setUltimaNom(activeTab);},[activeTab]);
  const { datos, errores, cargando, cargar } = useConsultasRH(activeTab);
  const empleados = datos.directorio;
  const cuentasAdministrativas = useCuentasAdministrativos(empleados, isAdmin);
  const [gestionAdministrativo, setGestionAdministrativo] = useState<{ id: string; modo: 'cuenta' | 'eliminar' } | null>(null);
  const [personasDocentes, setPersonasDocentes] = useState<Set<string> | null>(null);
  const [directorioDocente, setDirectorioDocente] = useState(false);
  const [showModalEmpleado, setShowModalEmpleado] = useState(false);
  const [altaPersonal, setAltaPersonal] = useState(false), [personaExistente, setPersonaExistente] = useState<OrigenPersonal | null>(null), [editarFicha, setEditarFicha] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null), [viewingEmpleado, setViewingEmpleado] = useState<Empleado | null>(null);
  const [showModalPlan, setShowModalPlan] = useState(false), [editingPlan, setEditingPlan] = useState<Nom035PlanAccion | null>(null);
  const [evaluacionToDelete, setEvaluacionToDelete] = useState<string | null>(null);
  const fetchData = () => cargar(activeTab);
  useEffect(() => { setViewingEmpleado(prev => prev ? empleados.find(e => e.id === prev.id) || prev : null); }, [empleados]);
  useEffect(() => {
    if (!empleados.length) return;
    let vigente = true;
    void consultarPersonasVinculadas('docentes').then(v => { if (vigente) setPersonasDocentes(v); });
    return () => { vigente = false; };
  }, [empleados]);
  // ── Empleados Handlers ──
  const handleSaveEmpleado = async (emp: Empleado) => {
    const errores=validarEmpleadoBasico(emp);if(errores.length)throw new Error(errores.map(e=>e.mensaje).join(' '));
    emp=normalizarEmpleado(emp) as Empleado;
    try {
      if (emp.id) {
        const {data:actual,error:consultaError}=await supabase.from('empleados').select('*').eq('id',emp.id).single();
        if(consultaError)throw consultaError;
        if(actual?.persona_id&&!emp.persona_id)throw new Error('El registro ya se relacionó con un perfil compartido. Vuelve a abrir su ficha antes de editarlo.');
        const datos=actual?.persona_id?{puesto:emp.puesto,clave_puesto:emp.clave_puesto,departamento:emp.departamento,firmante_certificados:emp.firmante_certificados,firmante_titulos:emp.firmante_titulos,firmante_boletas:emp.firmante_boletas,titulo_academico:emp.titulo_academico,firma_url:emp.firma_url}:emp;
        const { error } = await supabase.from('empleados').update(datos).eq('id', emp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('empleados').insert(emp);
        if (error) throw error;
      }
      setShowModalEmpleado(false);
      setEditingEmpleado(null);
      await fetchData();
    } catch (error: any) {
      throw error;
    }
  };

  // ── Planes Handlers ──
  const handleSavePlan = async (plan: Nom035PlanAccion) => {
    try {
      if (plan.id) {
        const { error } = await supabase.from('nom035_planes_accion').update(plan).eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('nom035_planes_accion').insert(plan);
        if (error) throw error;
      }
      setShowModalPlan(false);
      setEditingPlan(null);
      await fetchData();
    } catch (error: any) {
      toast.error(`Error al guardar plan: ${error.message}`);
      throw error;
    }
  };

  const confirmDeleteEvaluacion = async () => {
    if (!evaluacionToDelete) return;
    try {
      const { error } = await supabase.from('nom035_evaluaciones').delete().eq('id', evaluacionToDelete);
      if (error) throw error;
      await fetchData();
      setEvaluacionToDelete(null);
    } catch (error: any) {
      toast.error(`Error al eliminar evaluación: ${error.message}`);
      throw error;
    }
  };

  const handleDeleteEvaluacion = (id: string) => {
    if (!isAdmin) return;
    setEvaluacionToDelete(id);
  };


  const abrirEmpleado = (id: string, editar = false) => {
    const empleado = empleados.find(e => e.id === id);
    if (empleado) { setEditarFicha(editar); setViewingEmpleado(empleado); }
  };
  const filas: FilaDirectorioPersonal[] = empleados.map(e => {
    const nombre = `${e.apellido_paterno} ${e.apellido_materno || ''} ${e.nombres}`.replace(/\s+/g, ' ').trim();
    const edad = edadPersonal(e.fecha_nacimiento);
    return { id: e.id, nombre: toTitleCase(nombre), contacto: e.telefono, puesto: e.puesto, area: e.departamento, estatus: e.estatus,
      funcionVinculada: personasDocentes === null ? undefined : Boolean(e.persona_id && personasDocentes.has(e.persona_id)),
      cuenta: isAdmin ? cuentasAdministrativas.cuentas?.has(e.id) ? estadoCuentaPersonal(cuentasAdministrativas.cuentas.get(e.id)) : { texto: 'Cuenta por verificar', tono: 'aviso' } : undefined,
      busqueda: [nombre, e.nombres, e.rfc, e.curp, e.telefono, e.puesto, e.departamento].join(' '),
      detalles: [{ etiqueta: 'RFC', valor: e.rfc }, { etiqueta: 'CURP', valor: e.curp }, { etiqueta: 'Edad', valor: edad === null ? null : `${edad} años` }, { etiqueta: 'Estudios', valor: [e.nivel_estudios, e.nivel_estudios_estado].filter(Boolean).join(' · ') }, { etiqueta: 'Antigüedad', valor: antiguedadPersonal(e.fecha_ingreso) || 'Fecha de ingreso sin registrar' }]
    };
  });
  const cambiarNom = (seccion: 'resultados' | 'planes') => { setActiveTab(seccion); setUltimaNom(seccion); };
  return <div className="personal-pagina min-h-screen p-4 sm:p-6 lg:p-8"><div className="personal-directorios-marco">
    <button type="button" className="directorio-retorno" onClick={onBack}><ArrowLeft size={16}/>Volver al inicio</button>
    <header className="directorio-encabezado"><div><h1>Recursos Humanos</h1><p>{activeTab === 'directorio' ? 'Consulta el personal administrativo y sus funciones registradas.' : 'Consulta evaluaciones y da seguimiento a las acciones de NOM-035.'}</p></div>
      {activeTab === 'directorio' && isAdmin && <div className="directorio-cabecera-acciones"><button type="button" onClick={() => setAltaPersonal(true)}><Plus size={17}/>Registrar administrativo</button></div>}
    </header>
    <nav className="directorio-navegacion" aria-label="Secciones de Recursos Humanos"><button type="button" aria-current={activeTab === 'directorio' ? 'page' : undefined} onClick={() => setActiveTab('directorio')}>Personal</button><button type="button" aria-current={activeTab !== 'directorio' ? 'page' : undefined} onClick={() => setActiveTab(ultimaNom)}>NOM-035</button></nav>
    <div hidden={activeTab !== 'directorio'}>
      {isAdmin && cuentasAdministrativas.error && <div role="status" className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-100"><p>{cuentasAdministrativas.error}</p><button type="button" className="mt-2 underline" onClick={cuentasAdministrativas.recargar}>Reintentar consulta de cuentas</button></div>}
      <DirectorioPersonal tipo="administrativos" filas={filas} cargando={cargando.directorio} error={errores.directorio} reintentar={() => void cargar('directorio')} abrir={abrirEmpleado}
        acciones={id => isAdmin ? <MenuDirectorio nombre={filas.find(f => f.id === id)?.nombre || 'Administrativo'} acciones={[
          { texto: 'Editar administrativo', ejecutar: () => abrirEmpleado(id, true) },
          { texto: 'Gestionar cuenta de acceso', ejecutar: () => setGestionAdministrativo({ id, modo: 'cuenta' }) },
          { texto: 'Eliminar administrativo', peligro: true, ejecutar: () => setGestionAdministrativo({ id, modo: 'eliminar' }) }
        ]}/> : null}/>
      <details className="mt-6 border border-gray-200 dark:border-gray-700 rounded-xl p-4" onToggle={e => setDirectorioDocente(e.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold">Consultar personal docente</summary>{directorioDocente && <DirectorioDocentePersonal/>}</details>
    </div>
    {activeTab !== 'directorio' && <section aria-label="NOM-035">
      <nav className="directorio-subnavegacion" aria-label="Opciones NOM-035"><button type="button" aria-current={activeTab === 'resultados' ? 'page' : undefined} onClick={() => cambiarNom('resultados')}>Evaluaciones y resultados</button><button type="button" aria-current={activeTab === 'planes' ? 'page' : undefined} onClick={() => cambiarNom('planes')}>Planes de acción</button><button type="button" className="directorio-portal" onClick={onNavigateToEvaluacion}><FileBarChart2 size={16}/>Portal de evaluación</button></nav>
      <div className="bg-white dark:bg-[#1c2228] rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {errores[activeTab] ? <div className="p-5"><EstadoError mensaje={errores[activeTab]} onReintentar={() => void cargar(activeTab)}/></div> : cargando[activeTab] ? <p role="status" className="p-8 text-sm text-slate-600 dark:text-slate-300">Consultando información…</p> : activeTab === 'resultados' ? <ResultadosNom035 evaluaciones={datos.resultados} isAdmin={isAdmin} handleDeleteEvaluacion={handleDeleteEvaluacion}/> : <PlanesAccionNom035 planes={datos.planes} onEditar={p => { setEditingPlan(p); setShowModalPlan(true); }}/>}
      </div>
    </section>}
  </div>
  {altaPersonal && <AltaPersonal destino="EMPLEADO" onClose={() => setAltaPersonal(false)} onCrear={() => { setAltaPersonal(false); setEditingEmpleado(null); setShowModalEmpleado(true); }} onAbrir={o => { setAltaPersonal(false); setPersonaExistente(o); }}/>}
  {personaExistente && <FichaPersonal origen={personaExistente} seccionInicial="funciones" onClose={() => setPersonaExistente(null)} onSaved={fetchData}/>}
  {viewingEmpleado && <FichaEmpleado empleado={viewingEmpleado} editarInicial={editarFicha} isAdmin={isAdmin} onActualizado={fetchData} onClose={() => setViewingEmpleado(null)} onEdit={() => { setEditingEmpleado(viewingEmpleado); setViewingEmpleado(null); setShowModalEmpleado(true); }}/>}
  {showModalEmpleado && <ModalEmpleado empleado={editingEmpleado} onClose={() => setShowModalEmpleado(false)} onSaved={handleSaveEmpleado}/>}
  {showModalPlan && <ModalPlanAccion plan={editingPlan} onClose={() => setShowModalPlan(false)} onSaved={handleSavePlan}/>}
  {isAdmin && gestionAdministrativo && <GestionAdministrativo {...gestionAdministrativo} onClose={() => setGestionAdministrativo(null)} onSaved={async () => { await cargar('directorio'); cuentasAdministrativas.recargar(); }} onFicha={() => { const id = gestionAdministrativo.id; setGestionAdministrativo(null); abrirEmpleado(id, true); }}/>}
  <ModalConfirmacion isOpen={!!evaluacionToDelete} title="Eliminar evaluación" message="¿Eliminar esta evaluación? Esta acción no se puede deshacer y sus resultados se perderán permanentemente." onConfirm={confirmDeleteEvaluacion} onCancel={() => setEvaluacionToDelete(null)} type="danger" confirmText="Eliminar"/>
  </div>;
}
