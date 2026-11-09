import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { Alumno, AlumnoPrograma } from '../types';
import { supabase } from '../lib/supabase';
import { academicosService } from '../services/academicosService';
import { useAppStore } from '../store/useAppStore';
import type { ModalConfirmacionProps } from '../components/ui/ModalConfirmacion';

type ProgramaAlumno = AlumnoPrograma;
/** Controlador extraído del formulario general: conserva las operaciones académicas existentes. */
export function useGestionProgramasAlumno(alumno:Alumno,onActualizado?:()=>void|Promise<void>){
  const {carreras,currentUser}=useAppStore();
  const isAdmin=currentUser?.rol==='ADMINISTRADOR';
  const canManageProgramas=currentUser?.rol==='ADMINISTRADOR'||currentUser?.rol==='COORDINADOR CONTROL ESCOLAR';
  const actualizado=useRef(onActualizado);actualizado.current=onActualizado;
  const [carreraInscripcionId,setCarreraInscripcionId]=useState('');
  const [errorProgramas,setErrorProgramas]=useState('');
  const [systemConfirmModal,setSystemConfirmModal]=useState<ModalConfirmacionProps>({isOpen:false,title:'',message:'',onCancel:()=>setSystemConfirmModal(p=>({...p,isOpen:false}))});
  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase());
  };

  const getCarreraFullName = (c: any) => {
    if (!c) return 'Desconocida';
    const nivel = toTitleCase((c.nivel_educativo || 'Licenciatura').trim());
    const nombre = toTitleCase(c.nombre.trim());
    if (nombre.toUpperCase().includes(nivel.toUpperCase())) return nombre;
    return `${nivel} en ${nombre}`;
  };

  const formatPlanName = (prog: any) => {
    const plan = prog?.planes_estudio;
    if (!plan) return 'Desconocido';

    const carrera = carreras.find(c => c.id === plan.carrera_id);
    if (carrera) {
      return getCarreraFullName(carrera);
    }
    return plan.nombre;
  };

  const consultaProgramas=useRef(0);
  const [programas, setProgramas] = useState<ProgramaAlumno[]>([]);

  // Resolución matemática de UN ÚNICO Plan Rector Vigente
  const { vigentePlanId, progVigente } = useMemo(() => {
    if (!programas || programas.length === 0) {
      return { vigentePlanId: null, progVigente: null };
    }

    const vigentes = programas.filter(p => p.es_vigente);
    let elegido: ProgramaAlumno | undefined;

    if (vigentes.length === 1) {
      elegido = vigentes[0];
    } else if (vigentes.length > 1) {
      // Si por inconsistencia previa en BD hay más de un registro con es_vigente=true,
      // desempatar estrictamente por fecha de último cambio o fecha de inscripción más reciente
      elegido = [...vigentes].sort((a, b) => {
        const timeB = new Date(b.fecha_ultimo_cambio || b.fecha_inscripcion || 0).getTime();
        const timeA = new Date(a.fecha_ultimo_cambio || a.fecha_inscripcion || 0).getTime();
        return timeB - timeA;
      })[0];
    } else {
      const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO') || alumno.estatus === 'TITULADO';
      if (esAlumnoEgresado) {
        elegido = programas.find(p => ['EGRESADO', 'TITULADO'].includes(p.estatus))
          || programas.find(p => p.estatus === 'CURSANDO')
          || programas[0];
      } else {
        elegido = programas.find(p => p.estatus === 'CURSANDO')
          || programas.find(p => ['EGRESADO', 'TITULADO'].includes(p.estatus))
          || programas[0];
      }
    }

    return {
      vigentePlanId: elegido?.plan_id || null,
      progVigente: elegido || null
    };
  }, [programas, alumno.estatus]);
  const [loadingProgramas, setLoadingProgramas] = useState(true);
  const [showModalInscripcion, setShowModalInscripcion] = useState(false);
  const [modoModalProg, setModoModalProg] = useState<'existente' | 'nuevo'>('existente');
  const [submittingPrograma, setSubmittingPrograma] = useState(false);
  const [desbloquearTitulado, setDesbloquearTitulado] = useState(false);
  const [planesDisponibles, setPlanesDisponibles] = useState<any[]>([]);
  const [nuevoPrograma, setNuevoPrograma] = useState<{
    plan_id: string;
    estatus: string;
    fecha_inscripcion: string;
    es_vigente: boolean;
    motivo_estatus?: string;
    estatus_previo?: string | null;
  }>({
    plan_id: '',
    estatus: 'CURSANDO',
    fecha_inscripcion: new Date().toISOString().split('T')[0],
    es_vigente: true,
    motivo_estatus: 'REGULAR',
    estatus_previo: null
  });

  const fetchProgramas = useCallback(async () => {
    const solicitud=++consultaProgramas.current;
    if(!canManageProgramas){setLoadingProgramas(false);return;}
    setErrorProgramas('');
    setLoadingProgramas(true);
    try {
      const res = await academicosService.getProgramasAlumno(alumno.id);
      if(solicitud!==consultaProgramas.current)return;
      if (!res.success) throw res.error;
      setProgramas(res.data || []);

      const { data: planes } = await supabase
        .from('planes_estudio')
        .select('id, nombre, clave_legado, carrera_id, total_periodos')
        .order('nombre');
      if (planes&&solicitud===consultaProgramas.current) setPlanesDisponibles(planes);
    } catch (error) {
      console.error('Error fetching programas:', error);
      if(solicitud===consultaProgramas.current)setErrorProgramas('No se pudieron consultar los programas. Vuelve a intentar.');
    } finally {
      if(solicitud===consultaProgramas.current)setLoadingProgramas(false);
    }
  }, [alumno.id,canManageProgramas]);

  const handleOpenModalInscripcion = (consultadoId?:string) => {
    const activeProg = programas.find(p=>p.id===consultadoId) || progVigente || (programas.length > 0 ? programas[0] : null);
    const activeCarreraId = activeProg?.planes_estudio?.carrera_id
      || carreras.find(c => c.nombre.trim().toUpperCase() === (alumno.licenciatura || '').trim().toUpperCase())?.id
      || carreras[0]?.id
      || '';

    setCarreraInscripcionId(activeCarreraId);
    const planesDeCarrera = activeCarreraId ? planesDisponibles.filter(p => p.carrera_id === activeCarreraId) : [];

    const esAlumnoEgresado = alumno.estatus?.includes('EGRESADO');
    const hasCursando = programas.some(p => p.estatus === 'CURSANDO');
    const defaultEstatus = esAlumnoEgresado ? (alumno.estatus || 'EGRESADO') : 'CURSANDO';

    if (programas.length > 0) {
      setModoModalProg('existente');
      const target = activeProg || programas[0];
      const isTargetBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(target.estatus);
      const isTargetConcluido = ['EGRESADO', 'TITULADO'].includes(target.estatus);

      // Si el plan seleccionado estaba en baja y es el vigente, se promueve a CURSANDO con REINGRESO
      const estatusCalculado = (isTargetBaja && (target.es_vigente ?? true)) ? 'CURSANDO' : (target.estatus || defaultEstatus);
      const motivoCalculado = isTargetConcluido
        ? 'PLAN_CONCLUIDO'
        : (isTargetBaja && (target.es_vigente ?? true))
        ? 'REINGRESO'
        : (target.motivo_estatus || (target.es_vigente ? 'REGULAR' : 'CAMBIO_DE_CARRERA'));

      setNuevoPrograma({
        plan_id: target.plan_id,
        estatus: estatusCalculado,
        fecha_inscripcion: target.fecha_inscripcion || new Date().toISOString().split('T')[0],
        es_vigente: target.es_vigente ?? true,
        motivo_estatus: motivoCalculado,
        estatus_previo: isTargetBaja ? target.estatus : (target.estatus_previo || null)
      });
    } else {
      setModoModalProg('nuevo');
      setCarreraInscripcionId('');
      setNuevoPrograma({
        plan_id: '',
        estatus: defaultEstatus,
        fecha_inscripcion: new Date().toISOString().split('T')[0],
        es_vigente: true,
        motivo_estatus: (alumno.estatus?.includes('EGRESADO') || alumno.estatus?.includes('TITULADO')) ? 'SEGUNDA_CARRERA' : 'REGULAR',
        estatus_previo: null
      });
    }
    setShowModalInscripcion(true);
  };

  const handleGuardarPrograma = async () => {
    if(!canManageProgramas)return;
    if (modoModalProg === 'nuevo' && !carreraInscripcionId) return toast.error('Selecciona una carrera');
    if (!nuevoPrograma.plan_id) return toast.error('Selecciona un plan de estudios');

    // Regla de Oro Institucional: Si el alumno solo tiene 1 plan en su historial, SIEMPRE debe ser su Plan Rector
    const esVigenteFinal = programas.length <= 1 ? true : nuevoPrograma.es_vigente;

    // Validación preventiva: Si tiene múltiples planes y desmarca la vigencia de este, debe haber otro plan rector activo
    if (programas.length > 1 && !esVigenteFinal) {
      const otroVigente = programas.some(p => p.plan_id !== nuevoPrograma.plan_id && p.es_vigente);
      if (!otroVigente) {
        return toast.error('El expediente debe conservar un programa principal. Establece el otro programa como principal en su lugar.');
      }
    }

    // 1. Identificar si el plan ya existe en memoria
    const planExistente = programas.find(p => p.plan_id === nuevoPrograma.plan_id);

    // 2. Prevenir petición innecesaria si la información es exactamente idéntica
    if (
      planExistente &&
      planExistente.estatus === nuevoPrograma.estatus &&
      (planExistente.es_vigente ?? true) === esVigenteFinal &&
      (planExistente.motivo_estatus || 'REGULAR') === (nuevoPrograma.motivo_estatus || 'REGULAR') &&
      (planExistente.fecha_inscripcion || '') === (nuevoPrograma.fecha_inscripcion || '')
    ) {
      return toast('La información del plan no presenta cambios', { icon: 'ℹ️' });
    }

    setSubmittingPrograma(true);
    try {
      const result = await academicosService.inscribirAlumnoPrograma(
        alumno.id,
        nuevoPrograma.plan_id,
        nuevoPrograma.estatus,
        nuevoPrograma.fecha_inscripcion,
        esVigenteFinal,
        nuevoPrograma.motivo_estatus,
        nuevoPrograma.estatus_previo
      );

      if (!result.success) throw result.error;

      if (esVigenteFinal) {
        const targetEstatus = nuevoPrograma.estatus || 'CURSANDO';
        const nuevoEstatusInstitucional = targetEstatus === 'CURSANDO' ? 'ACTIVO' : (['BAJA', 'BAJA_POR_CAMBIO'].includes(targetEstatus) ? 'BAJA' : targetEstatus);
        useAppStore.getState().setAlumnos((prev: any[]) =>
          prev.map((a: any) =>
            a.id === alumno.id
              ? {
                  ...a,
                  estatus: nuevoEstatusInstitucional
                }
              : a
          )
        );
      }

      toast.success(
        esVigenteFinal
          ? 'Programa guardado y establecido como principal'
          : 'Estatus del plan actualizado correctamente'
      );

      setShowModalInscripcion(false);
      await fetchProgramas();
      await actualizado.current?.();
    } catch (error: any) {
      console.error('Error al procesar el programa:', error);
      toast.error(error?.message || 'Error al procesar el programa');
    } finally {
      setSubmittingPrograma(false);
    }
  };

  const ejecutarActivacionRapida = async (prog: AlumnoPrograma) => {
    if(!canManageProgramas)return;
    setSubmittingPrograma(true);
    try {
      const result = await academicosService.activarPlanVigente(
        alumno.id,
        prog.plan_id
      );

      if (!result.success) throw result.error;

      // Actualizar reactivamente el store global de Zustand
      const targetEstatus = prog.estatus || 'CURSANDO';
      const nuevoEstatusInstitucional = targetEstatus === 'CURSANDO' ? 'ACTIVO' : (['BAJA', 'BAJA_POR_CAMBIO'].includes(targetEstatus) ? 'BAJA' : targetEstatus);
      const nuevaCarrera = prog.planes_estudio?.carreras?.nombre || alumno.licenciatura;

      useAppStore.getState().setAlumnos((prev: any[]) =>
        prev.map((a: any) =>
          a.id === alumno.id
            ? {
                ...a,
                estatus: nuevoEstatusInstitucional,
                licenciatura: nuevaCarrera
              }
            : a
        )
      );

      toast.success(`Programa ${prog.planes_estudio?.clave_legado || prog.planes_estudio?.nombre} establecido como principal`);
      await fetchProgramas();
      await actualizado.current?.();
    } catch (error: any) {
      console.error('Error al activar programa:', error);
      toast.error(error?.message || 'Error al activar el programa');
    } finally {
      setSubmittingPrograma(false);
    }
  };

  const handleActivarProgramaRapido = (prog: AlumnoPrograma) => {
    if (!canManageProgramas || prog.es_vigente) return;

    const planNombre = prog.planes_estudio?.clave_legado
      ? `${prog.planes_estudio.clave_legado} - ${prog.planes_estudio.nombre}`
      : prog.planes_estudio?.nombre || 'este plan de estudios';

    const isConcluido = ['EGRESADO', 'TITULADO'].includes(prog.estatus);
    const isBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(prog.estatus);
    const hasSimultanea = programas.some(p => p.plan_id !== prog.plan_id && p.motivo_estatus === 'CARRERA_SIMULTANEA' && p.estatus === 'CURSANDO');

    setSystemConfirmModal({
      isOpen: true,
      title: '¿Establecer este programa como principal?',
      message: (
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>
            Estás a punto de establecer <strong>{planNombre}</strong> como el programa oficial <strong>PRINCIPAL</strong> para este alumno.
          </p>

          {isBaja ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
              ⚡ <strong>Reactivación Automática (Vía 1):</strong> Este plan se encuentra actualmente en estatus <em>{prog.estatus}</em>. Al activarlo como vigente, su estatus se actualizará automáticamente a <strong>CURSANDO</strong> con motivo <strong>REINGRESO</strong>, guardando su estatus previo para permitir reversión si fuese necesario.
            </div>
          ) : isConcluido ? (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-lg text-purple-800 dark:text-purple-300 text-xs">
              🎓 <strong>Plan Concluido:</strong> Conservará su logro oficial como <strong>{prog.estatus}</strong> con motivo <em>PLAN CONCLUIDO</em> (no se reiniciará a Cursando).
            </div>
          ) : (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-lg text-blue-800 dark:text-blue-300 text-xs">
              📌 <strong>Estatus Curricular:</strong> Continuará en <strong>{prog.estatus}</strong>.
            </div>
          )}

          {hasSimultanea && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-lg text-indigo-800 dark:text-indigo-300 text-xs">
              🛡️ <strong>Carrera Simultánea Protegida:</strong> Los otros planes marcados como <em>CARRERA SIMULTÁNEA</em> permanecerán intactos en estatus <strong>CURSANDO</strong>.
            </div>
          )}

          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/40 rounded-lg text-gray-700 dark:text-gray-300 text-xs">
            ℹ️ Los demás planes no concluidos y que no sean carreras simultáneas pasarán a registrarse como <em>CAMBIO DE CARRERA</em> sin alterar logros previos.
          </div>
        </div>
      ),
      confirmText: 'Establecer como principal',
      cancelText: 'Cancelar',
      type: 'warning',
      onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        await ejecutarActivacionRapida(prog);
        setSystemConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  useEffect(() => {
    setProgramas([]);
    setLoadingProgramas(true);
    fetchProgramas();
    return()=>{consultaProgramas.current++;};
  }, [fetchProgramas]);


  const [confirmarSalida,setConfirmarSalida]=useState(false);
  const capturaBase=useRef<string|null>(null);
  const captura=JSON.stringify({modoModalProg,carreraInscripcionId,nuevoPrograma});
  useEffect(()=>{if(showModalInscripcion){if(capturaBase.current===null)capturaBase.current=captura;}else{capturaBase.current=null;setConfirmarSalida(false);}},[showModalInscripcion,captura]);
  const solicitarCierre=()=>{if(submittingPrograma)return;if(capturaBase.current!==null&&capturaBase.current!==captura)setConfirmarSalida(true);else setShowModalInscripcion(false);};
  useEffect(()=>{
    if(!showModalInscripcion||capturaBase.current===captura)return;
    const avisar=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',avisar);
    return()=>window.removeEventListener('beforeunload',avisar);
  },[showModalInscripcion,captura]);
  const editorAbierto=useRef(false);editorAbierto.current=showModalInscripcion;
  useEffect(()=>{if(!canManageProgramas)return;const actualizar=()=>{if(!editorAbierto.current)void fetchProgramas();};
    const canal=supabase.channel(`programas-ficha:${alumno.id}`).on('postgres_changes',{event:'*',schema:'public',table:'alumno_programas',filter:`alumno_id=eq.${alumno.id}`},actualizar).subscribe();
    window.addEventListener('focus',actualizar);return()=>{window.removeEventListener('focus',actualizar);void supabase.removeChannel(canal);};
  },[alumno.id,canManageProgramas,fetchProgramas]);
  return {alumno,carreras,isAdmin,canManageProgramas,programas,loadingProgramas,errorProgramas,fetchProgramas,vigentePlanId,progVigente,
    showModalInscripcion,setShowModalInscripcion,modoModalProg,setModoModalProg,submittingPrograma,desbloquearTitulado,setDesbloquearTitulado,
    planesDisponibles,nuevoPrograma,setNuevoPrograma,carreraInscripcionId,setCarreraInscripcionId,systemConfirmModal,setSystemConfirmModal,
    handleOpenModalInscripcion,handleGuardarPrograma,handleActivarProgramaRapido,formatPlanName,getCarreraFullName,
    confirmarSalida,setConfirmarSalida,solicitarCierre};
}
export type GestionProgramasAlumno = ReturnType<typeof useGestionProgramasAlumno>;
