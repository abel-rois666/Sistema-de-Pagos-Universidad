import React, { useState, useEffect } from 'react';
import { RefreshCw, BookOpen, Layers, AlertCircle, FileText, Trash2, X, CheckSquare, Square, Edit2, Save, ChevronUp, ChevronDown, ArrowUp, ArrowDown, Plus, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { PlanEstudio, Asignatura, Carrera } from '../types';
import ModalCarrera from './modals/ModalCarrera';
import ModalPlanEstudio from './modals/ModalPlanEstudio';

const normalizeText = (text: string) => {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/LICENCIATURA EN /g, '')
    .replace(/INGENIERIA EN /g, '')
    .replace(/ESPECIALIDAD EN /g, '')
    .replace(/MAESTRIA EN /g, '')
    .replace(/DOCTORADO EN /g, '')
    .replace(/LIC\./g, '')
    .replace(/ING\./g, '')
    .trim();
};

const getClasificacionColor = (clave: string | undefined | null) => {
  switch (clave) {
    case '263': // Obligatoria
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-transparent dark:border-blue-800/50';
    case '264': // Optativa
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-transparent dark:border-emerald-800/50';
    case '266': // Complementaria
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-transparent dark:border-purple-800/50';
    default: // Sin clasificación
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border border-transparent dark:border-gray-700/50';
  }
};

export default function ControlAcademico() {
  const { catalogoItems, carreras } = useAppStore();
  
  // Carrera States
  const [selectedCarrera, setSelectedCarrera] = useState<Carrera | null>(null);
  const [showModalCarrera, setShowModalCarrera] = useState(false);
  const [carreraToEdit, setCarreraToEdit] = useState<Carrera | null>(null);

  // Plan States
  const [showModalPlan, setShowModalPlan] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<PlanEstudio | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [planesLocal, setPlanesLocal] = useState<PlanEstudio[]>([]);
  const [asignaturasLocal, setAsignaturasLocal] = useState<Asignatura[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para Vista Detallada de Retícula
  const [selectedPlan, setSelectedPlan] = useState<PlanEstudio | null>(null);
  const [asignaturasPlan, setAsignaturasPlan] = useState<Asignatura[]>([]);
  const [isLoadingReticula, setIsLoadingReticula] = useState(false);
  const [selectedMaterias, setSelectedMaterias] = useState<string[]>([]);
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Record<string, boolean>>({});
  const [ordenCategorias, setOrdenCategorias] = useState<string[]>(['Obligatoria', 'Optativa', 'Complementaria', 'Sin Clasificación']);

  const [isEditingCreditos, setIsEditingCreditos] = useState(false);
  const [tempCreditosOb, setTempCreditosOb] = useState<number>(0);

  // Estado para Diálogo de Confirmación Personalizado
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const closeConfirmDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  // (Removido: Estados de Crear Plan manuales, ahora usa ModalPlanEstudio)

  // Estado para Crear Asignatura
  const [isCreatingAsignatura, setIsCreatingAsignatura] = useState<{isOpen: boolean, periodo: number}>({ isOpen: false, periodo: 1 });
  const [newAsigForm, setNewAsigForm] = useState({
    nombre: '',
    clave_legado: '',
    creditos: 0,
    clasificacion_clave: '263',
  });

  // Estado para Diálogo de Edición
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    type: 'plan' | 'asignatura';
    id: string;
    nombre: string;
    creditos?: number;
    tipo_periodo?: string;
    modelo?: string;
    numero_periodo?: number;
  }>({
    isOpen: false,
    type: 'plan',
    id: '',
    nombre: '',
    creditos: 0,
    tipo_periodo: 'Semestral',
    modelo: 'RIGIDO',
    numero_periodo: 1
  });

  const handleEditPlan = (e: React.MouseEvent, plan: PlanEstudio) => {
    e.stopPropagation();
    setPlanToEdit(plan);
    setShowModalPlan(true);
  };

  const handleEditAsignatura = (e: React.MouseEvent, asig: Asignatura) => {
    e.stopPropagation();
    setEditModal({ isOpen: true, type: 'asignatura', id: asig.id, nombre: asig.nombre, creditos: asig.creditos, numero_periodo: asig.numero_periodo || 1 });
  };

  const saveEdit = async () => {
    try {
      if (editModal.type === 'plan') {
        // Obsoleto: Edit de plan se maneja por ModalPlanEstudio
      } else {
        const { error } = await supabase.from('asignaturas').update({ nombre: editModal.nombre, creditos: editModal.creditos, numero_periodo: editModal.numero_periodo }).eq('id', editModal.id);
        if (error) throw error;
        setAsignaturasPlan(prev => prev.map(a => a.id === editModal.id ? { ...a, nombre: editModal.nombre, creditos: Number(editModal.creditos), numero_periodo: Number(editModal.numero_periodo) } : a));
        setAsignaturasLocal(prev => prev.map(a => a.id === editModal.id ? { ...a, nombre: editModal.nombre, creditos: Number(editModal.creditos), numero_periodo: Number(editModal.numero_periodo) } : a));
        toast.success('Asignatura actualizada');
      }
      setEditModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar cambios');
    }
  };

  // (Removido: saveNewPlan, manejado en ModalPlanEstudio)

  const saveNewAsignatura = async () => {
    if (!selectedPlan) return;
    if (!newAsigForm.nombre || !newAsigForm.clave_legado) return toast.error("Llena nombre y clave.");
    try {
      const nuevaAsig = {
        plan_id: selectedPlan.id,
        clave_legado: newAsigForm.clave_legado,
        nombre: newAsigForm.nombre,
        creditos: newAsigForm.creditos,
        numero_periodo: isCreatingAsignatura.periodo,
        etapa_clave: String(isCreatingAsignatura.periodo), // fallback retrocompatibilidad
        etapa_nombre: `Bloque ${isCreatingAsignatura.periodo}`, // fallback retrocompatibilidad
        clasificacion_clave: newAsigForm.clasificacion_clave,
        clasificacion_nombre: newAsigForm.clasificacion_clave === '263' ? 'Obligatoria' : (newAsigForm.clasificacion_clave === '264' ? 'Optativa' : 'Complementaria'),
        activo: true
      };
      
      const { data, error } = await supabase.from('asignaturas').insert(nuevaAsig).select().single();
      if (error) throw error;
      
      setAsignaturasPlan(prev => [...prev, data]);
      setAsignaturasLocal(prev => [...prev, data]);
      setIsCreatingAsignatura({ isOpen: false, periodo: 1 });
      setNewAsigForm({ nombre: '', clave_legado: '', creditos: 0, clasificacion_clave: '263' });
      toast.success('Asignatura añadida');
    } catch (err) {
      console.error(err);
      toast.error('Error al crear asignatura');
    }
  };

  const startEditingCreditos = () => {
    setTempCreditosOb(Number(selectedPlan?.creditos_obligatorios) || 0);
    setIsEditingCreditos(true);
  };

  const saveCreditosObligatorios = async () => {
    if (!selectedPlan) return;
    try {
      const { error } = await supabase.from('planes_estudio').update({ creditos_obligatorios: tempCreditosOb }).eq('id', selectedPlan.id);
      if (error) throw error;
      
      setPlanesLocal(prev => prev.map(p => p.id === selectedPlan.id ? { ...p, creditos_obligatorios: tempCreditosOb } : p));
      setSelectedPlan(prev => prev ? { ...prev, creditos_obligatorios: tempCreditosOb } : null);
      
      setIsEditingCreditos(false);
      toast.success('Créditos obligatorios actualizados');
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar créditos obligatorios');
    }
  };

  // Cargar datos locales al montar
  useEffect(() => {
    fetchDatosLocales();
    fetchPreferencias();
  }, []);

  const fetchPreferencias = async () => {
    try {
      const { data, error } = await supabase
        .from('ui_preferencias')
        .select('preferencias')
        .eq('modulo', 'control_academico')
        .single();
      
      if (!error && data?.preferencias?.ordenCategorias) {
        setOrdenCategorias(data.preferencias.ordenCategorias);
      }
    } catch (e) {
      console.error('Error fetching prefs', e);
    }
  };

  const moverCategoria = async (index: number, direccion: 'up' | 'down') => {
    if ((direccion === 'up' && index === 0) || (direccion === 'down' && index === ordenCategorias.length - 1)) return;
    const newOrden = [...ordenCategorias];
    const targetIndex = direccion === 'up' ? index - 1 : index + 1;
    [newOrden[index], newOrden[targetIndex]] = [newOrden[targetIndex], newOrden[index]];
    
    setOrdenCategorias(newOrden);
    
    try {
      await supabase.from('ui_preferencias').upsert({
        usuario_id: 'default_user',
        modulo: 'control_academico',
        preferencias: { ordenCategorias: newOrden }
      }, { onConflict: 'usuario_id, modulo' });
    } catch (err) {
      console.error('Error saving prefs', err);
    }
  };

  const toggleCategoria = (clasif: string) => {
    setCategoriasAbiertas(prev => ({ ...prev, [clasif]: prev[clasif] === undefined ? false : !prev[clasif] }));
  };

  const fetchDatosLocales = async () => {
    setIsLoading(true);
    try {
      const { data: planes, error: errP } = await supabase
        .from('planes_estudio')
        .select('*')
        .order('nombre', { ascending: true });
      
      if (errP) throw errP;

      const { data: asignaturas, error: errA } = await supabase
        .from('asignaturas')
        .select('*');

      if (errA) throw errA;

      setPlanesLocal(planes || []);
      setAsignaturasLocal(asignaturas || []);
    } catch (error: any) {
      console.error('Error cargando datos locales:', error);
      toast.error('No se pudo cargar el catálogo académico local.');
    } finally {
      setIsLoading(false);
    }
  };

  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunked: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunked.push(arr.slice(i, i + size));
    }
    return chunked;
  };

  const handleSyncGES = async () => {
    setIsSyncing(true);
    const loadingToast = toast.loading('Conectando con GES 4...');
    
    try {
      let response;
      try {
        response = await fetch('http://localhost:3001/api/legacy/academico/planes');
      } catch (networkErr) {
        throw new Error('No se pudo conectar al GES 4. Verifica que el microservicio local esté encendido.');
      }

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      const dataGES = await response.json();

      if (!Array.isArray(dataGES)) {
        throw new Error('El formato de respuesta del legado no es un arreglo válido.');
      }

      toast.loading(`Mapeando ${dataGES.length} planes...`, { id: loadingToast });

      // Normalización del Catálogo Local
      const carrerasActivas = carreras.filter(c => c.activo);
      const catMap = new Map<string, string>();
      carrerasActivas.forEach(c => {
        catMap.set(normalizeText(c.nombre), c.id);
      });

      let planesIgnorados = 0;
      const planesParaUpsert = [];
      const asignaturasParaUpsert: Omit<Asignatura, 'id' | 'created_at'>[] = [];

      // 1. Mapear y preparar datos
      for (const item of dataGES) {
        // Mapeo Defensivo
        const gesName = item.nivel_descripcion || item.NOMBRE_CARRERA || item.nombre_carrera || item.Carrera || '';
        const normalizedGesName = normalizeText(gesName);
        const idCatalogo = catMap.get(normalizedGesName);

        if (!idCatalogo) {
          console.warn(`Se ignoró la carrera: "${gesName}" (Normalizado: "${normalizedGesName}"). No hay coincidencia en la tabla de carreras.`);
          planesIgnorados++;
          continue;
        }

        // Iterar sobre los planes del item
        const planes = item.planes || item.PLANES || [];
        
        // Fallback por si la respuesta viene plana (item = plan)
        const planesParaIterar = planes.length > 0 ? planes : [item];

        for (const plan of planesParaIterar) {
          const nombrePlan = plan.nombre_plan || plan.NOMBRE_PLAN || plan.Nombre_Plan || 'PLAN SIN NOMBRE';
          const clavePlan = plan.id_plan || plan.ID_PLAN || plan.Clave_Plan || nombrePlan;
          const estatusPlan = plan.estatus || plan.ESTATUS || plan.Estatus || 'ACTIVO';

          // Si usamos el fallback plano y no tiene clavePlan real, podríamos estar ignorándolo, 
          // pero asumimos que sí tiene si llega aquí
          if (!plan.id_plan && !plan.ID_PLAN && !plan.Clave_Plan && planes.length === 0 && !plan.nombre_plan && !plan.NOMBRE_PLAN && !plan.Nombre_Plan) {
             continue; // No es un plan válido
          }

          planesParaUpsert.push({
            carrera_id: idCatalogo,
            licenciatura_id: idCatalogo, // Doble inserción para retrocompatibilidad
            clave_legado: String(clavePlan),
            nombre: String(nombrePlan),
            estatus: String(estatusPlan).toUpperCase()
          });

          const etapas = plan.etapas || plan.ETAPAS || [];
          for (const etapa of etapas) {
            const materias = etapa.asignaturas || etapa.ASIGNATURAS || [];
            for (const mat of materias) {
              const nombreMateria = mat.nombre || mat.NOMBREASIGNATURA || mat.nombre_materia || 'MATERIA DESCONOCIDA';
              if (nombreMateria.toUpperCase().includes('PROMEDIO') || nombreMateria.toUpperCase().includes('GLOBAL')) {
                continue;
              }
              const claveMateria = mat.clave || mat.CLAVEASIGNATURA || mat.clave_materia || `${clavePlan}-${nombreMateria}`;
              const creditos = mat.creditos || mat.CREDITOS || 0;
              const etapaClave = etapa.id_etapa || etapa.ID_ETAPA || '1';
              const etapaNombre = etapa.descripcion || etapa.DESCRIPCION || '1ER CUATRIMESTRE';
              const numPeriodo = parseInt(String(etapaClave).replace(/\D/g, ''), 10) || 1;

              asignaturasParaUpsert.push({
                plan_id: '', // Se actualizará después
                clave_legado: String(claveMateria),
                nombre: String(nombreMateria),
                creditos: Number(creditos) || 0,
                etapa_clave: String(etapaClave),
                etapa_nombre: String(etapaNombre),
                numero_periodo: numPeriodo,
                // Para el mapeo temporal
                ...({ plan_clave_legado: String(clavePlan) } as any)
              });
            }
          }
        }
      }

      if (planesParaUpsert.length === 0) {
        throw new Error('No se encontraron planes válidos para sincronizar (revisa si las carreras coinciden).');
      }

      toast.loading(`Guardando ${planesParaUpsert.length} planes en Supabase...`, { id: loadingToast });

      // 2. Upsert de Planes
      const { data: planesInsertados, error: planesError } = await supabase
        .from('planes_estudio')
        .upsert(planesParaUpsert, { onConflict: 'clave_legado', ignoreDuplicates: false })
        .select('id, clave_legado');

      if (planesError) throw planesError;

      // Mapa rápido de clave_legado a UUID generado
      const mapPlanId: Record<string, string> = {};
      planesInsertados?.forEach(p => {
        mapPlanId[p.clave_legado] = p.id;
      });

      // 3. Asociar IDs a asignaturas y limpiar campos temporales
      const finalAsignaturas = asignaturasParaUpsert.map((asig: any) => {
        const idPlan = mapPlanId[asig.plan_clave_legado];
        const { plan_clave_legado, ...cleanAsig } = asig;
        return {
          ...cleanAsig,
          plan_id: idPlan
        };
      }).filter(a => a.plan_id); // Asegurar que todas tengan plan asignado

      // 4. Upsert de Asignaturas en bloques
      toast.loading(`Sincronizando ${finalAsignaturas.length} asignaturas...`, { id: loadingToast });
      
      const chunks = chunkArray(finalAsignaturas, 500);
      let asignaturasErrores = 0;

      for (const chunk of chunks) {
        const { error: asigErr } = await supabase
          .from('asignaturas')
          .upsert(chunk, { onConflict: 'plan_id,clave_legado' });
        
        if (asigErr) {
          console.error('Error insertando chunk de asignaturas:', asigErr);
          asignaturasErrores++;
        }
      }

      await fetchDatosLocales(); // Recargar cuadrícula

      let msj = `¡Sincronización exitosa! Se actualizaron ${planesParaUpsert.length} planes y ${finalAsignaturas.length} asignaturas.`;
      if (planesIgnorados > 0) msj += ` (${planesIgnorados} ignorados por Carrera inexistente).`;
      if (asignaturasErrores > 0) msj += ` Hubo errores en algunos bloques de materias.`;

      toast.success(msj, { id: loadingToast, duration: 5000 });

    } catch (error: any) {
      console.error('Error en sincronización GES:', error);
      toast.error(`Error: ${error.message || 'Fallo de conexión al legado'}`, { id: loadingToast });
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper para mostrar cuántas materias tiene cada plan
  const countMaterias = (planId: string) => asignaturasLocal.filter(a => a.plan_id === planId).length;

  const handleViewPlan = async (plan: PlanEstudio) => {
    setSelectedPlan(plan);
    setIsLoadingReticula(true);
    setAsignaturasPlan([]);
    setSelectedMaterias([]);
    try {
      const { data, error } = await supabase
        .from('asignaturas')
        .select('*')
        .eq('plan_id', plan.id)
        .order('etapa_clave', { ascending: true }); // Orden básico
      
      if (error) throw error;
      setAsignaturasPlan(data || []);
    } catch (err: any) {
      toast.error('Error al cargar la retícula del plan');
      console.error(err);
    } finally {
      setIsLoadingReticula(false);
    }
  };

  const handleDeletePlan = async (e: React.MouseEvent, plan: PlanEstudio) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Plan de Estudio',
      message: `¿Estás seguro de eliminar el plan "${plan.nombre}"? Esto eliminará sus materias en cascada.`,
      onConfirm: async () => {
        closeConfirmDialog();
        try {
          const { error } = await supabase.from('planes_estudio').delete().eq('id', plan.id);
          if (error) throw error;
          setPlanesLocal(prev => prev.filter(p => p.id !== plan.id));
          toast.success('Plan eliminado correctamente');
        } catch (err: any) {
          toast.error('Error al eliminar plan');
          console.error(err);
        }
      }
    });
  };

  const handleDeleteAsignatura = async (asignaturaId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Asignatura',
      message: '¿Estás seguro de eliminar esta asignatura?',
      onConfirm: async () => {
        closeConfirmDialog();
        try {
          const { error } = await supabase.from('asignaturas').delete().eq('id', asignaturaId);
          if (error) throw error;
          setAsignaturasPlan(prev => prev.filter(a => a.id !== asignaturaId));
          setAsignaturasLocal(prev => prev.filter(a => a.id !== asignaturaId)); // Para contador general
          toast.success('Asignatura eliminada');
        } catch (err: any) {
          toast.error('Error al eliminar asignatura');
          console.error(err);
        }
      }
    });
  };

  const handleChangeClasificacion = async (asignaturaId: string, claveClasificacion: string) => {
    let nombreClasificacion = '';
    if (claveClasificacion === '263') nombreClasificacion = 'Obligatoria';
    else if (claveClasificacion === '264') nombreClasificacion = 'Optativa';
    else if (claveClasificacion === '266') nombreClasificacion = 'Complementaria';
    else claveClasificacion = ''; // Limpiar si es "Ninguna"

    try {
      const payload = {
        clasificacion_clave: claveClasificacion || null,
        clasificacion_nombre: nombreClasificacion || null
      };

      const { error } = await supabase.from('asignaturas').update(payload).eq('id', asignaturaId);
      if (error) throw error;

      setAsignaturasPlan(prev => prev.map(a => 
        a.id === asignaturaId ? { ...a, ...payload } : a
      ));
      toast.success('Clasificación actualizada');
    } catch (err: any) {
      toast.error('Error al actualizar clasificación');
      console.error(err);
    }
  };

  const toggleMateria = (id: string) => {
    setSelectedMaterias(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const toggleEtapa = (ids: string[]) => {
    const allSelected = ids.every(id => selectedMaterias.includes(id));
    if (allSelected) {
      setSelectedMaterias(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedMaterias(prev => {
        const set = new Set([...prev, ...ids]);
        return Array.from(set);
      });
    }
  };

  const handleBulkDelete = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Asignaturas',
      message: `¿Estás seguro de eliminar ${selectedMaterias.length} asignaturas?`,
      onConfirm: async () => {
        closeConfirmDialog();
        try {
          const { error } = await supabase.from('asignaturas').delete().in('id', selectedMaterias);
          if (error) throw error;
          setAsignaturasPlan(prev => prev.filter(a => !selectedMaterias.includes(a.id)));
          setAsignaturasLocal(prev => prev.filter(a => !selectedMaterias.includes(a.id)));
          setSelectedMaterias([]);
          toast.success('Asignaturas eliminadas');
        } catch (err: any) {
          toast.error('Error al eliminar asignaturas');
          console.error(err);
        }
      }
    });
  };

  const handleBulkClassify = async (claveClasificacion: string) => {
    if (!claveClasificacion) return;
    
    let nombreClasificacion = '';
    if (claveClasificacion === '263') nombreClasificacion = 'Obligatoria';
    else if (claveClasificacion === '264') nombreClasificacion = 'Optativa';
    else if (claveClasificacion === '266') nombreClasificacion = 'Complementaria';

    try {
      const payload = {
        clasificacion_clave: claveClasificacion,
        clasificacion_nombre: nombreClasificacion
      };

      const { error } = await supabase.from('asignaturas').update(payload).in('id', selectedMaterias);
      if (error) throw error;

      setAsignaturasPlan(prev => prev.map(a => 
        selectedMaterias.includes(a.id) ? { ...a, ...payload } : a
      ));
      setSelectedMaterias([]);
      toast.success('Clasificaciones actualizadas');
    } catch (err: any) {
      toast.error('Error al actualizar clasificaciones');
      console.error(err);
    }
  };

  const handleBulkMovePeriodo = async (nuevoPeriodo: number) => {
    if (!nuevoPeriodo || nuevoPeriodo < 1) return;

    try {
      const { error } = await supabase
        .from('asignaturas')
        .update({ numero_periodo: nuevoPeriodo })
        .in('id', selectedMaterias);
        
      if (error) throw error;

      // Actualizar estado local
      setAsignaturasPlan(prev => prev.map(a => 
        selectedMaterias.includes(a.id) ? { ...a, numero_periodo: nuevoPeriodo } : a
      ));
      setAsignaturasLocal(prev => prev.map(a => 
        selectedMaterias.includes(a.id) ? { ...a, numero_periodo: nuevoPeriodo } : a
      ));
      
      setSelectedMaterias([]);
      toast.success(`Asignaturas movidas al bloque ${nuevoPeriodo}`);
    } catch (err: any) {
      toast.error('Error al mover asignaturas');
      console.error(err);
    }
  };

  // Agrupar asignaturas por etapa para la vista de retícula
  const asignaturasAgrupadas = asignaturasPlan.reduce((acc, asig) => {
    const etapa = asig.numero_periodo || parseInt(String(asig.etapa_clave).replace(/\D/g, ''), 10) || 1;
    if (!acc[etapa]) acc[etapa] = [];
    acc[etapa].push(asig);
    return acc;
  }, {} as Record<number, Asignatura[]>);

  // Ordenar las etapas lógicamente
  const etapasOrdenadas = Object.keys(asignaturasAgrupadas).map(Number).sort((a, b) => a - b);

  const obtenerNombreBloque = (numero: number, modelo?: string, tipoPeriodo?: string) => {
    // Intercepción del bloque especial
    if (numero === 99) return 'ASIGNATURAS COMPLEMENTARIAS';

    // Si es un modelo Flexible, la estructura base solo se llama "Bloque"
    if (modelo === 'FLEXIBLE') {
      return `Bloque ${numero}`;
    }

    // Si es un modelo Rígido, la estructura ya define el semestre/cuatrimestre real
    const ordinales = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo', 'Undécimo', 'Duodécimo'];
    const ordinal = ordinales[numero - 1] || `${numero}°`;
    const tipoLower = tipoPeriodo?.toLowerCase() || '';
    
    if (tipoLower.includes('cuatrimestral')) return `${ordinal} Cuatrimestre`;
    if (tipoLower.includes('semestral')) return `${ordinal} Semestre`;
    
    return `Bloque ${numero}`; // Fallback por defecto
  };

  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase());
  };

  const getCarreraFullName = (c?: Carrera | null) => {
    if (!c) return 'Desconocida';
    const nivel = toTitleCase((c.nivel_educativo || 'Licenciatura').trim());
    const nombre = toTitleCase(c.nombre.trim());
    // Si el nombre ya empieza o contiene el nivel, evitar repetirlo
    if (nombre.toUpperCase().includes(nivel.toUpperCase())) {
      return nombre;
    }
    return `${nivel} en ${nombre}`;
  };

  const planesFiltrados = selectedCarrera ? planesLocal.filter(p => p.carrera_id === selectedCarrera.id || p.licenciatura_id === selectedCarrera.id) : [];

  // Orden para los niveles educativos (puedes cambiarlo aquí)
  const ordenNiveles = ['Especialidad', 'Licenciatura', 'Maestría', 'Doctorado'];

  const carrerasAgrupadas = carreras.reduce((acc, c) => {
    const nivel = toTitleCase((c.nivel_educativo || 'Licenciatura').trim());
    if (!acc[nivel]) acc[nivel] = [];
    acc[nivel].push(c);
    return acc;
  }, {} as Record<string, Carrera[]>);

  const nivelesOrdenados = Object.keys(carrerasAgrupadas).sort((a, b) => {
    const idxA = ordenNiveles.indexOf(a);
    const idxB = ordenNiveles.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const getPlural = (str: string) => {
    if (str.endsWith('d')) return str + 'es';
    if (str.endsWith('s')) return str;
    return str + 's';
  };

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-6 h-[calc(100vh-120px)]">
      {/* SIDEBAR: Carreras (oculto si hay un plan seleccionado en móvil) */}
      <div className={`w-full md:w-80 flex-shrink-0 flex-col bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-800 rounded-[20px] shadow-sm overflow-hidden flex ${selectedPlan ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1c2228]/50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 dark:text-gray-200">Carreras</h2>
          <button onClick={() => { setCarreraToEdit(null); setShowModalCarrera(true); }} className="p-2 bg-[#1456f0]/10 text-[#1456f0] dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-[#1456f0]/20 transition-colors" title="Nueva Carrera">
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar">
          {nivelesOrdenados.map(nivel => (
            <div key={nivel} className="space-y-1">
              <div className="flex items-center gap-3 px-2 mb-3">
                <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest select-none">
                  {getPlural(nivel)}
                </h3>
                <div className="h-px bg-blue-100 dark:bg-blue-900/30 flex-1"></div>
              </div>
              {carrerasAgrupadas[nivel].map(c => (
                <div key={c.id} onClick={() => { setSelectedCarrera(c); setSelectedPlan(null); }} className={`p-3 rounded-[12px] cursor-pointer transition-all flex items-center justify-between group border ${selectedCarrera?.id === c.id ? 'bg-[#1456f0] text-white border-[#1456f0] shadow-md' : 'bg-transparent border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                  <div className="pr-2 flex-1">
                    <div className="font-semibold text-sm tracking-tight leading-snug">{getCarreraFullName(c)}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setCarreraToEdit(c); setShowModalCarrera(true); }} className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${selectedCarrera?.id === c.id ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400'}`} title="Ver / Editar">
                    <Eye size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))}
          {carreras.length === 0 && (
            <div className="text-center p-6 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-xl m-2 border border-dashed border-gray-200 dark:border-gray-800">
              No hay carreras registradas.<br/>Comienza creando una.
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedPlan ? 'flex' : 'hidden md:flex'}`}>
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            {selectedPlan ? (
              <>
                <button onClick={() => setSelectedPlan(null)} className="flex items-center gap-1.5 text-gray-500 hover:text-[#1456f0] dark:text-gray-400 dark:hover:text-blue-400 font-medium mb-3 transition-colors text-sm">
                  <RefreshCw size={14} className="rotate-180" /> Volver a planes
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#222222] dark:text-gray-100 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  Retícula Académica
                </h1>
                <p className="text-[#45515e] dark:text-gray-400 mt-1">Plan: {getCarreraFullName(carreras.find(c => c.id === selectedPlan.carrera_id))}</p>
              </>
            ) : selectedCarrera ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#222222] dark:text-gray-100 tracking-tight flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
                  Planes de Estudio
                  {selectedCarrera.clave && (
                    <span className="text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-lg font-semibold border border-indigo-200 dark:border-indigo-800/50 mt-1">
                      {selectedCarrera.clave}
                    </span>
                  )}
                </h1>
                <p className="text-[#45515e] dark:text-gray-400 mt-1">{getCarreraFullName(selectedCarrera)}</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#222222] dark:text-gray-100 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  Control Académico
                </h1>
                <p className="text-[#45515e] dark:text-gray-400 mt-1">Gestión de oferta educativa.</p>
              </>
            )}
          </div>
          
          {/* Botones Globales */}
          {!selectedPlan && (
            <div className="flex flex-wrap items-center gap-3">
              {selectedCarrera && (
                <button onClick={() => { setPlanToEdit(null); setShowModalPlan(true); }} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold rounded-xl shadow-sm transition-all text-sm">
                  <FileText size={16} /> Nuevo Plan
                </button>
              )}
              <button onClick={handleSyncGES} disabled={isSyncing} className="flex items-center gap-2 px-4 py-2 bg-[#1456f0] hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} /> Sincronizar GES 4
              </button>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto pb-10 pr-2 custom-scrollbar">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <RefreshCw size={32} className="animate-spin mb-4 text-[#1456f0]" />
          <p>Cargando información curricular...</p>
        </div>
      ) : selectedPlan ? (
        // VISTA DE DETALLE (RETÍCULA)
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white dark:bg-[#1c2228] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{getCarreraFullName(carreras.find(c => c.id === selectedPlan.carrera_id))}</h2>
            <div className="flex flex-wrap gap-3 text-sm font-medium mt-4">
              <span className="bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center border border-gray-200 dark:border-gray-700/50">
                <span className="opacity-70 mr-1.5 font-normal">Clave:</span> {selectedPlan.clave_legado}
              </span>
              <span className="bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center border border-gray-200 dark:border-gray-700/50">
                <span className="opacity-70 mr-1.5 font-normal">Plan:</span> {selectedPlan.nombre}
              </span>
              {selectedPlan.rvoe && (
                <span className="bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center border border-gray-200 dark:border-gray-700/50">
                  <span className="opacity-70 mr-1.5 font-normal">RVOE:</span> {selectedPlan.rvoe}
                  {selectedPlan.fecha_rvoe && <span className="opacity-60 ml-1 text-xs">({selectedPlan.fecha_rvoe})</span>}
                </span>
              )}
              
              <span className="bg-blue-50 dark:bg-blue-900/20 text-[#1456f0] dark:text-blue-400 px-3 py-1.5 rounded-lg flex items-center border border-blue-100 dark:border-blue-900/30">
                <span className="opacity-80 mr-1.5">Créditos Plan:</span> {Number(asignaturasPlan.reduce((sum, a) => sum + (Number(a.creditos) || 0), 0)).toFixed(2)}
              </span>
              <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-3 py-1.5 rounded-lg flex items-center border border-purple-100 dark:border-purple-900/30">
                {selectedPlan.modelo || 'RIGIDO'} • {selectedPlan.tipo_periodo || 'Semestral'}
              </span>
              <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-emerald-100 dark:border-emerald-900/30">
                {isEditingCreditos ? (
                  <>
                    <span className="opacity-80 mr-1">Créd. Obligatorios:</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={tempCreditosOb}
                      onChange={(e) => setTempCreditosOb(Number(e.target.value))}
                      className="w-20 px-1.5 py-0.5 text-sm bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded text-gray-800 dark:text-gray-200 focus:outline-none"
                    />
                    <button onClick={saveCreditosObligatorios} className="p-1 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors bg-emerald-100 dark:bg-emerald-900 rounded" title="Guardar"><CheckSquare size={14} /></button>
                    <button onClick={() => setIsEditingCreditos(false)} className="p-1 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors bg-emerald-100 dark:bg-emerald-900 rounded" title="Cancelar"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="opacity-80 mr-1">Créd. Obligatorios:</span> {Number(selectedPlan.creditos_obligatorios || 0).toFixed(2)}
                    <button onClick={startEditingCreditos} className="p-1 text-emerald-600/70 hover:text-emerald-800 dark:text-emerald-400/70 dark:hover:text-emerald-300 transition-colors" title="Editar Créditos Obligatorios"><Edit2 size={14} /></button>
                  </>
                )}
              </span>
            </div>
          </div>

          {isLoadingReticula ? (
            <div className="flex justify-center py-12">
              <RefreshCw size={28} className="animate-spin text-blue-500" />
            </div>
          ) : asignaturasPlan.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
              <BookOpen size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              No hay asignaturas registradas para este plan.
              <div className="mt-4">
                <button 
                  onClick={() => setIsCreatingAsignatura({ isOpen: true, periodo: 1 })}
                  className="px-4 py-2 bg-[#1456f0] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  + Añadir Primera Asignatura
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              {etapasOrdenadas.map(etapa => {
                const asigsEtapa = asignaturasAgrupadas[etapa];
                const etapaIds = asigsEtapa.map(a => a.id);
                const allSelected = etapaIds.length > 0 && etapaIds.every(id => selectedMaterias.includes(id));
                const someSelected = etapaIds.some(id => selectedMaterias.includes(id));

                // Agrupar por clasificación dentro de la etapa
                const byClasificacion = asigsEtapa.reduce((acc, asig) => {
                  const clasif = asig.clasificacion_nombre || 'Sin Clasificación';
                  if (!acc[clasif]) acc[clasif] = [];
                  acc[clasif].push(asig);
                  return acc;
                }, {} as Record<string, Asignatura[]>);

                // Ordenar cada grupo por clave_legado
                Object.keys(byClasificacion).forEach(c => {
                  byClasificacion[c].sort((a, b) => a.clave_legado.localeCompare(b.clave_legado, undefined, { numeric: true }));
                });

                return (
                  <div key={etapa} className="bg-white dark:bg-[#1c2228] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                      <button 
                        onClick={() => toggleEtapa(etapaIds)}
                        className={`p-1 rounded transition-colors ${someSelected ? 'text-[#1456f0]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                      >
                        {allSelected ? <CheckSquare size={20} /> : <Square size={20} className={someSelected ? "fill-[#1456f0]/20 text-[#1456f0]" : ""} />}
                      </button>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-[#1456f0] rounded-full"></div>
                        {obtenerNombreBloque(etapa, selectedPlan.modelo, selectedPlan.tipo_periodo)}
                      </h3>
                      <div className="ml-auto flex items-center gap-3">
                        <button 
                          onClick={() => setIsCreatingAsignatura({ isOpen: true, periodo: etapa })}
                          className="text-sm px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          + Añadir Asignatura
                        </button>
                        <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full font-medium">
                          {asigsEtapa.length} materias
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {ordenCategorias.filter(c => byClasificacion[c]).concat(Object.keys(byClasificacion).filter(c => !ordenCategorias.includes(c))).map((clasif) => {
                        const materiasClasif = byClasificacion[clasif];
                        const isAbierta = categoriasAbiertas[clasif] !== false; // true by default
                        const globalIndex = ordenCategorias.indexOf(clasif);

                        return (
                        <div key={clasif} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-[#181e25]">
                          <div 
                            className="px-4 py-3 bg-gray-100/50 dark:bg-gray-800/50 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => toggleCategoria(clasif)}
                          >
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                              {clasif} <span className="text-xs font-normal bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-500 dark:text-gray-400">({materiasClasif.length})</span>
                            </h4>
                            <div className="flex items-center gap-2">
                              {globalIndex !== -1 && (
                                <div className="flex items-center gap-1 mr-2" onClick={e => e.stopPropagation()}>
                                  <button 
                                    onClick={() => moverCategoria(globalIndex, 'up')}
                                    disabled={globalIndex === 0}
                                    className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-30 disabled:hover:text-gray-400"
                                    title="Mover arriba"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button 
                                    onClick={() => moverCategoria(globalIndex, 'down')}
                                    disabled={globalIndex === ordenCategorias.length - 1}
                                    className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-30 disabled:hover:text-gray-400"
                                    title="Mover abajo"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                </div>
                              )}
                              {isAbierta ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                            </div>
                          </div>
                          
                          {isAbierta && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {materiasClasif.map(asig => {
                              const isSelected = selectedMaterias.includes(asig.id);
                              
                              return (
                                <div 
                                  key={asig.id} 
                                  onClick={() => toggleMateria(asig.id)}
                                  className={`p-4 rounded-xl shadow-sm flex flex-col justify-between group/asig transition-all cursor-pointer border ${
                                    isSelected 
                                      ? 'bg-blue-50/50 dark:bg-blue-900/10 border-[#1456f0] dark:border-blue-500' 
                                      : 'bg-white dark:bg-[#1c2228] border-gray-200 dark:border-[rgba(255,255,255,0.08)] hover:border-blue-200 dark:hover:border-blue-900/50'
                                  }`}
                                >
                                  <div>
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                          isSelected ? 'bg-[#1456f0] border-[#1456f0] text-white' : 'border-gray-300 dark:border-gray-600 bg-transparent'
                                        }`}>
                                          {isSelected && <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                        </div>
                                        <span className="text-[11px] font-mono font-semibold text-gray-800 dark:text-[#f3f4f6] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded inline-block">
                                          {asig.clave_legado}
                                        </span>
                                      </div>
                                      <div className="flex items-center">
                                        <button 
                                          onClick={(e) => handleEditAsignatura(e, asig)}
                                          className="text-gray-400 hover:text-blue-500 opacity-0 group-hover/asig:opacity-100 transition-opacity mr-2"
                                          title="Editar materia"
                                        >
                                          <Edit2 size={15} />
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleDeleteAsignatura(asig.id); }}
                                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover/asig:opacity-100 transition-opacity"
                                          title="Eliminar materia"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </div>
                                    </div>
                                    <h4 className="font-medium text-gray-800 dark:text-[#f3f4f6] text-sm leading-snug pl-6">
                                      {asig.nombre}
                                    </h4>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-800 flex flex-col gap-2 pl-6">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Créditos: <b>{Number(asig.creditos).toFixed(2)}</b></span>
                                      <select 
                                        value={asig.clasificacion_clave || ''}
                                        onClick={e => e.stopPropagation()}
                                        onChange={(e) => handleChangeClasificacion(asig.id, e.target.value)}
                                        className={`text-[11px] font-semibold tracking-wide rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors ${getClasificacionColor(asig.clasificacion_clave)}`}
                                      >
                                        <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Sin Clasificación</option>
                                        <option value="263" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Obligatoria</option>
                                        <option value="264" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Optativa</option>
                                        <option value="266" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Complementaria</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          )}
                        </div>
                      )})}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : !selectedCarrera ? (
        <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-[#1c2228] border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-12 text-center shadow-sm">
          <BookOpen size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Selecciona una Carrera</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Elige una carrera en el panel lateral para administrar sus planes de estudio y retícula de asignaturas.
          </p>
        </div>
      ) : planesFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-[#1c2228] border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-12 text-center shadow-sm">
          <Layers size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">No hay planes de estudio</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
            La carrera seleccionada aún no cuenta con un mapa curricular.
          </p>
          <button onClick={() => { setPlanToEdit(null); setShowModalPlan(true); }} className="px-5 py-2.5 bg-[#1456f0] text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
            Crear Primer Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {planesFiltrados.map(plan => {
            const materiasCount = countMaterias(plan.id);
            const totalCreditos = asignaturasLocal.filter(a => a.plan_id === plan.id).reduce((sum, a) => sum + (Number(a.creditos) || 0), 0);

            return (
              <div 
                key={plan.id} 
                onClick={() => handleViewPlan(plan)}
                className="bg-white dark:bg-[#1c2228] p-5 rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] hover:-translate-y-1 transition-transform duration-300 flex flex-col group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-blue-50 dark:bg-blue-900/30 text-[#1456f0] dark:text-blue-400 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                    <FileText size={22} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${plan.estatus === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {plan.estatus}
                    </span>
                    <button 
                      onClick={(e) => handleEditPlan(e, plan)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Editar Plan"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => handleDeletePlan(e, plan)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar Plan"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 leading-tight mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {getCarreraFullName(selectedCarrera)}
                </h3>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex-1">
                  {plan.nombre}
                </p>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-medium text-xs">
                    <FileText size={13} /> {plan.rvoe ? `RVOE: ${plan.rvoe}` : 'Sin RVOE'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md" title="Créditos Obligatorios">
                      {Number(plan.creditos_obligatorios || 0).toFixed(2)} cr.
                    </span>
                    <span className="flex items-center gap-1.5 text-[#1456f0] dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                      <BookOpen size={14} /> {materiasCount}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
      </div>

      {/* TOOLBAR FLOTANTE PARA ACCIONES MASIVAS */}
      {selectedMaterias.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-white dark:bg-[#1c2228] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] rounded-full px-6 py-3 flex items-center gap-6 border border-gray-200 dark:border-gray-700/50 backdrop-blur-md">
            <div className="flex items-center gap-3 border-r border-gray-200 dark:border-gray-700 pr-6">
              <span className="flex items-center justify-center bg-[#1456f0] text-white w-6 h-6 rounded-full text-xs font-bold">
                {selectedMaterias.length}
              </span>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                seleccionadas
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select 
                onChange={(e) => handleBulkClassify(e.target.value)}
                className="text-sm bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1456f0] text-gray-700 dark:text-gray-200 cursor-pointer font-medium"
                defaultValue=""
              >
                <option value="" disabled className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Cambiar a...</option>
                <option value="263" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Volver Obligatoria</option>
                <option value="264" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Volver Optativa</option>
                <option value="266" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Volver Complementaria</option>
              </select>

              <div className="flex items-center gap-2 border-x border-gray-200 dark:border-gray-700 px-3 mx-1">
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">Mover al bloque:</span>
                <input 
                  type="number" 
                  min="1"
                  placeholder="#"
                  className="w-14 text-sm bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1456f0] text-gray-700 dark:text-gray-200 font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleBulkMovePeriodo(Number(e.currentTarget.value));
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button 
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    handleBulkMovePeriodo(Number(input.value));
                    input.value = '';
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-[#1456f0] dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                >
                  Mover
                </button>
              </div>

              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
              >
                <Trash2 size={16} /> Eliminar
              </button>
              
              <button 
                onClick={() => setSelectedMaterias([])}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-2"
                title="Limpiar selección"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DIALOG */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1c2228] w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-full">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{confirmDialog.title}</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-8 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeConfirmDialog}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm shadow-red-600/20 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* EDIT MODAL */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1c2228] w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Edit2 size={18} className="text-[#1456f0]" />
                Editar {editModal.type === 'plan' ? 'Plan de Estudio' : 'Asignatura'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                  <input 
                    type="text" 
                    value={editModal.nombre}
                    onChange={(e) => setEditModal(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1456f0] focus:border-transparent dark:text-white"
                  />
                </div>
                
                {editModal.type === 'asignatura' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Créditos</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editModal.creditos || 0}
                        onChange={(e) => setEditModal(prev => ({ ...prev, creditos: Number(e.target.value) }))}
                        className="w-full bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1456f0] focus:border-transparent dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bloque / Periodo (Número)</label>
                      <input 
                        type="number" 
                        min="1"
                        step="1"
                        value={editModal.numero_periodo || 1}
                        onChange={(e) => setEditModal(prev => ({ ...prev, numero_periodo: Number(e.target.value) }))}
                        className="w-full bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1456f0] focus:border-transparent dark:text-white"
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEdit}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#1456f0] hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PLAN MODAL REMOVIDO, AHORA USA COMPONENTE EXTERNO */}

      {/* CREATE ASIGNATURA MODAL */}
      {isCreatingAsignatura.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1c2228] w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <BookOpen size={18} className="text-emerald-500" />
                Añadir Asignatura ({obtenerNombreBloque(isCreatingAsignatura.periodo, selectedPlan?.tipo_periodo)})
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Introducción al Derecho"
                    value={newAsigForm.nombre}
                    onChange={(e) => setNewAsigForm(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1456f0] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clave</label>
                  <input 
                    type="text" 
                    placeholder="Ej. DER101"
                    value={newAsigForm.clave_legado}
                    onChange={(e) => setNewAsigForm(prev => ({ ...prev, clave_legado: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1456f0] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Créditos</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={newAsigForm.creditos}
                    onChange={(e) => setNewAsigForm(prev => ({ ...prev, creditos: Number(e.target.value) }))}
                    className="w-full bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1456f0] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clasificación</label>
                  <select 
                    value={newAsigForm.clasificacion_clave}
                    onChange={(e) => setNewAsigForm(prev => ({ ...prev, clasificacion_clave: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1456f0] dark:text-white"
                  >
                    <option value="263">Obligatoria</option>
                    <option value="264">Optativa</option>
                    <option value="266">Complementaria</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bloque / Periodo (Número)</label>
                  <input 
                    type="number" 
                    min="1"
                    step="1"
                    value={isCreatingAsignatura.periodo}
                    onChange={(e) => setIsCreatingAsignatura(prev => ({ ...prev, periodo: Number(e.target.value) }))}
                    className="w-full bg-gray-50 dark:bg-[#181e25] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#1456f0] dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => setIsCreatingAsignatura({ isOpen: false, periodo: 1 })}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveNewAsignatura}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#1456f0] hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  Guardar Asignatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALES EXTERNOS DE ENTIDADES */}
      {showModalCarrera && (
        <ModalCarrera 
          onClose={() => setShowModalCarrera(false)}
          carrera={carreraToEdit}
          onSaved={(carrera) => {
            setShowModalCarrera(false);
            // El store se actualiza via Supabase Realtime si está configurado, o podemos forzar recarga.
            // Por simplicidad, useAppStore.getState().fetchCarreras() actualiza las carreras.
            useAppStore.getState().fetchCarreras(); 
            if (carreraToEdit) {
              if (selectedCarrera?.id === carrera.id) setSelectedCarrera(carrera);
            } else {
              setSelectedCarrera(carrera);
            }
          }}
        />
      )}

      {showModalPlan && (
        <ModalPlanEstudio
          carreras={carreras}
          carreraIdActiva={selectedCarrera?.id}
          onClose={() => setShowModalPlan(false)}
          plan={planToEdit}
          onSaved={(plan) => {
            setShowModalPlan(false);
            if (planToEdit) {
              setPlanesLocal(prev => prev.map(p => p.id === plan.id ? plan : p));
              if (selectedPlan?.id === plan.id) setSelectedPlan(plan);
            } else {
              setPlanesLocal(prev => [...prev, plan]);
            }
          }}
        />
      )}
    </div>
  );
}
