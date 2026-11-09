import React, { useState, useEffect, useRef } from 'react';
import DirectorioPersonal from './personal/DirectorioPersonal';
import MenuDirectorio from './personal/MenuDirectorio';
import { consultarDocentesDirectorio, consultarPersonasVinculadas, type DocenteDirectorio } from '../services/directorioPersonalService';
import { estadoCuentaPersonal, type FilaDirectorioPersonal } from '../personal/directorio';
import { useDialogoPersonal } from '../hooks/useDialogoPersonal';
import { supabase } from '../lib/supabase';
import { Docente } from '../types';
import ModalDocente from './modals/ModalDocente';
import AltaPersonal from './personal/AltaPersonal';
import FichaPersonal from './personal/FichaPersonal';
import type { OrigenPersonal } from '../personal/types';
import RevisionNombresDocentes from './personal/RevisionNombresDocentes';
import { useAppStore } from '../store/useAppStore';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ModalConfirmacion, { ModalConfirmacionProps } from './ui/ModalConfirmacion';
import { motion, AnimatePresence } from 'framer-motion';
import { toTitleCase } from '../utils';

export default function DocentesConfig() {
  const rol=useAppStore(s=>s.currentUser?.rol);
  const [revisarNombres,setRevisarNombres]=useState(false);
  const [altaPersonal,setAltaPersonal]=useState(false),[personaExistente,setPersonaExistente]=useState<OrigenPersonal|null>(null);
  const [docentes, setDocentes] = useState<DocenteDirectorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorConsulta, setErrorConsulta] = useState('');
  const [selectedDocente, setSelectedDocente] = useState<Docente | null>(null);
  const [isModalDocenteOpen, setIsModalDocenteOpen] = useState(false);
  const [personasAdministrativas, setPersonasAdministrativas] = useState<Set<string> | null>(null);
  const secuenciaConsulta = useRef(0);
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<ModalConfirmacionProps>({ isOpen: false, title: '', message: '', onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });
  
  // Modal para crear acceso
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessDocente, setAccessDocente] = useState<Docente | null>(null);
  const [accessPassword, setAccessPassword] = useState('');
  const [accessEmail, setAccessEmail] = useState('');
  const [isCreatingAccess, setIsCreatingAccess] = useState(false);

  useEffect(() => { void fetchDocentes(); return () => { secuenciaConsulta.current++; }; }, [rol]);

  const fetchDocentes = async () => {
    const turno = ++secuenciaConsulta.current;
    setErrorConsulta(''); setLoading(true);
    try {
      const [filas, vinculadas] = await Promise.all([
        consultarDocentesDirectorio(rol === 'ADMINISTRADOR'),
        rol === 'ADMINISTRADOR' ? consultarPersonasVinculadas('empleados') : Promise.resolve(null)
      ]);
      if (turno !== secuenciaConsulta.current) return;
      setDocentes(filas); setPersonasAdministrativas(vinculadas);
      setSelectedIds(ids => ids.filter(id => filas.some(f => f.id === id)));
    } catch (error: any) {
      if (turno !== secuenciaConsulta.current) return;
      setErrorConsulta('No se pudo consultar el directorio docente. Reintenta para ver los datos actualizados.');
      toast.error('Error al cargar los docentes: ' + error.message);
    } finally { if (turno === secuenciaConsulta.current) setLoading(false); }
  };

  const handleBulkEstatus = async (nuevoEstatus: 'activo' | 'inactivo') => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('docentes')
        .update({ estatus: nuevoEstatus })
        .in('id', selectedIds);
      if (error) throw error;
      toast.success(`Estatus actualizado para ${selectedIds.length} docentes`);
      setSelectedIds([]);
      await fetchDocentes();
    } catch (error: any) {
      toast.error('Error al actualizar estatus: ' + error.message);
      setLoading(false);
      throw error;
    }
  };

  const handleBulkDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Docentes Múltiples',
      message: `¿Estás seguro de que deseas eliminar a ${selectedIds.length} docentes? Esta acción fallará si alguno de ellos ya tiene grupos asignados.`,
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        try {
          setLoading(true);
          const { error } = await supabase.from('docentes').delete().in('id', selectedIds);
          if (error) throw error;
          toast.success(`${selectedIds.length} docentes eliminados correctamente`);
          setSelectedIds([]);
          await fetchDocentes();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          toast.error('Error al eliminar docentes: ' + error.message);
          setLoading(false);
          throw error;
        }
      }
    });
  };

  const handleDeleteDocente = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Docente',
      message: '¿Estás seguro de que deseas eliminar a este docente? Esta acción no se puede deshacer.',
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('docentes').delete().eq('id', id);
          if (error) throw error;
          toast.success('Docente eliminado correctamente');
          await fetchDocentes();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error: any) {
          toast.error('Error al eliminar docente: ' + error.message);
          throw error;
        }
      }
    });
  };

  const handleCrearAccesoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessDocente) return;
    if (accessPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!accessDocente.clave_legado || !accessDocente.clave_legado.trim()) {
      toast.error('El docente no tiene una Clave asignada, requerida para el usuario');
      return;
    }

    setIsCreatingAccess(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/manage-users`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey
        },
        body: JSON.stringify({
          action: 'CREATE',
          username: accessDocente.clave_legado,
          password: accessPassword,
          rol: 'DOCENTE',
          docente_id: accessDocente.id,
          email: accessEmail
        })
      });

      if (!response.ok) {
        let errMessage = `Error HTTP: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) errMessage = errorData.error;
        } catch (e) {}
        throw new Error(errMessage);
      }

      toast.success('Acceso creado exitosamente');
      setIsAccessModalOpen(false);
      setAccessPassword('');
      fetchDocentes();
    } catch (error: any) {
      toast.error('Error al crear acceso: ' + error.message);
    } finally {
      setIsCreatingAccess(false);
    }
  };

  const abrirDocente = (id: string, editar = false) => {
    const docente = docentes.find(d => d.id === id);
    if (!docente) return;
    setSelectedDocente(docente); setReadOnlyMode(!editar); setIsModalDocenteOpen(true);
  };
  const filas: FilaDirectorioPersonal[] = docentes.map(d => ({
    id: d.id, nombre: toTitleCase(d.nombre_completo), clave: d.clave_legado, contacto: d.email, estatus: d.estatus,
    funcionVinculada: personasAdministrativas === null ? undefined : Boolean(d.persona_id && personasAdministrativas.has(d.persona_id)),
    cuenta: rol === 'ADMINISTRADOR' ? estadoCuentaPersonal(d.usuarios) : undefined,
    detalles: [{ etiqueta: 'RFC', valor: d.rfc }, { etiqueta: 'CURP', valor: d.curp }],
    busqueda: [d.nombre_completo,d.clave_legado,d.email,d.rfc,d.curp].join(' ')
  }));
  const confirmarEstatus = (estatus: 'activo' | 'inactivo') => setConfirmModal({
    isOpen: true, title: estatus === 'activo' ? 'Activar docentes' : 'Inactivar docentes',
    message: `Se cambiará la habilitación docente de ${selectedIds.length} registros seleccionados, incluidos los de otras páginas. La situación administrativa y las cuentas de usuario se conservan.`,
    onCancel: () => setConfirmModal(p => ({ ...p, isOpen: false })),
    onConfirm: async () => { await handleBulkEstatus(estatus); setConfirmModal(p => ({ ...p, isOpen: false })); }
  });
  const cerrarAcceso = () => {
    if (isCreatingAccess) return;
    if (accessPassword || accessEmail !== (accessDocente?.email || '')) {
      setConfirmModal({ isOpen: true, title: 'Descartar datos de la cuenta', message: 'La cuenta todavía no se ha creado. Se descartarán el correo y la contraseña capturados.', confirmText: 'Descartar datos', onCancel: () => setConfirmModal(p => ({ ...p, isOpen: false })), onConfirm: () => { setConfirmModal(p => ({ ...p, isOpen: false })); setIsAccessModalOpen(false); setAccessPassword(''); setAccessEmail(''); } });
    } else setIsAccessModalOpen(false);
  };
  const dialogoAcceso = useDialogoPersonal(isAccessModalOpen, cerrarAcceso);
  return (
    <div className="personal-pagina p-4 sm:p-6 lg:p-8">
      <div className="personal-directorios-marco">
        <header className="directorio-encabezado">
          <div><h1>Gestión de Docentes</h1><p>Consulta sus fichas, habilitación y configuración académica.</p></div>
          <div className="directorio-cabecera-acciones">
            <MenuDirectorio nombre="Directorio docente" etiqueta="Herramientas" acciones={['ADMINISTRADOR','COORDINADOR ACADEMICO'].includes(rol || '') ? [{ texto: 'Revisar nombres', ejecutar: () => setRevisarNombres(true) }] : []}/>
            <button type="button" onClick={() => { if (rol === 'ADMINISTRADOR') setAltaPersonal(true); else { setSelectedDocente(null); setReadOnlyMode(false); setIsModalDocenteOpen(true); } }}><Plus size={17}/>Registrar docente</button>
          </div>
        </header>
        <DirectorioPersonal tipo="docentes" filas={filas} cargando={loading} error={errorConsulta} reintentar={() => void fetchDocentes()} abrir={abrirDocente}
          seleccion={selectedIds} cambiarSeleccion={setSelectedIds}
          accionesSeleccion={<><button type="button" disabled={loading} onClick={() => confirmarEstatus('activo')}>Activar</button><button type="button" disabled={loading} onClick={() => confirmarEstatus('inactivo')}>Inactivar</button><button type="button" disabled={loading} onClick={handleBulkDelete}><Trash2 size={14}/>Eliminar</button></>}
          acciones={id => {
            const d = docentes.find(d => d.id === id)!;
            return <MenuDirectorio nombre={toTitleCase(d.nombre_completo)} acciones={[
              { texto: 'Editar docente', ejecutar: () => abrirDocente(id, true) },
              ...(rol === 'ADMINISTRADOR' && !d.usuarios?.length ? [{ texto: 'Crear cuenta de usuario', ejecutar: () => { setAccessDocente(d); setAccessPassword(''); setAccessEmail(d.email || ''); setIsAccessModalOpen(true); } }] : []),
              { texto: 'Eliminar docente', peligro: true, ejecutar: () => void handleDeleteDocente(id) }
            ]}/>;
          }}/>
      </div>

      {altaPersonal&&<AltaPersonal destino="DOCENTE" onClose={()=>setAltaPersonal(false)} onCrear={()=>{setAltaPersonal(false);setSelectedDocente(null);setReadOnlyMode(false);setIsModalDocenteOpen(true);}} onAbrir={o=>{setAltaPersonal(false);setPersonaExistente(o);}}/>}
      {personaExistente&&<FichaPersonal origen={personaExistente} seccionInicial="funciones" onClose={()=>setPersonaExistente(null)} onSaved={fetchDocentes}/>}
      {revisarNombres&&<RevisionNombresDocentes onClose={()=>setRevisarNombres(false)} onSaved={fetchDocentes}/>}
      <ModalDocente
        isOpen={isModalDocenteOpen}
        onClose={() => {
          setIsModalDocenteOpen(false);
          setSelectedDocente(null);
        }}
        docente={selectedDocente}
        onDocenteSaved={fetchDocentes}
        readOnly={readOnlyMode}
      />
      <ModalConfirmacion {...confirmModal} />

      {/* Modal Crear Acceso Docente */}
      <AnimatePresence>
        {isAccessModalOpen && accessDocente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cerrarAcceso}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              ref={dialogoAcceso.dialogo}
              onKeyDown={dialogoAcceso.teclado}
              role="dialog" aria-modal="true" aria-labelledby="titulo-cuenta-docente"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1c2228] rounded-[24px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h2 id="titulo-cuenta-docente" className="text-xl font-bold text-gray-900 dark:text-white font-display">Crear cuenta de usuario</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Para el docente: <span className="font-semibold text-gray-700 dark:text-gray-300">{accessDocente.nombre_completo}</span></p>
                </div>
                <button
                  onClick={cerrarAcceso}
                  disabled={isCreatingAccess}
                  aria-label="Cerrar creación de cuenta"
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2c333b] rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCrearAccesoSubmit} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de Usuario (Login)</label>
                    <input
                      type="text"
                      value={accessDocente.clave_legado}
                      disabled
                      className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">El usuario es la misma Clave del docente.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo Electrónico (Opcional)</label>
                    <input
                      type="email"
                      aria-label="Correo de la cuenta" disabled={isCreatingAccess}
                      value={accessEmail}
                      onChange={(e) => setAccessEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full px-4 py-2 bg-white dark:bg-[#222b36] border border-gray-300 dark:border-gray-700 focus:border-[#1456f0] dark:focus:border-blue-500 focus:ring-4 focus:ring-[#1456f0]/10 text-gray-900 dark:text-white rounded-xl outline-none transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">Si se deja vacío, se generará uno automático interno.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña Inicial</label>
                    <input
                      type="text"
                      aria-label="Contraseña inicial" disabled={isCreatingAccess}
                      value={accessPassword}
                      onChange={(e) => setAccessPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                      className="w-full px-4 py-2 bg-white dark:bg-[#222b36] border border-gray-300 dark:border-gray-700 focus:border-[#1456f0] dark:focus:border-blue-500 focus:ring-4 focus:ring-[#1456f0]/10 text-gray-900 dark:text-white rounded-xl outline-none transition-all"
                    />
                    <button
                      type="button"
                      disabled={isCreatingAccess}
                      onClick={() => setAccessPassword(Math.random().toString(36).slice(-8))}
                      className="mt-2 text-xs text-[#1456f0] hover:underline"
                    >
                      Generar contraseña aleatoria
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={cerrarAcceso}
                    disabled={isCreatingAccess}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingAccess || accessPassword.length < 8}
                    className="flex-1 px-4 py-2 text-white bg-[#1456f0] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium shadow-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {isCreatingAccess ? 'Creando...' : 'Crear Acceso'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
