import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Edit2, Save, X, GraduationCap, CheckCircle, XCircle, Loader2, Users, Trash2, ChevronUp, ChevronDown, Filter, Search, Wallet } from 'lucide-react';
import { Alumno, CicloEscolar, PaymentPlan, Catalogos, PlantillaPlan, Usuario } from '../types';
import { MultiSelectFilter } from './MultiSelectFilter';
import { supabase, toDBPlan } from '../lib/supabase';
// Helper para generar folios con base en el ciclo y un consecutivo, ej: 261-1002
const generateFolio = (cicloNombre: string, counter: number) => {
  const nums = cicloNombre.replace(/[^0-9]/g, '');
  let prefix = 'PP';
  if (nums.length >= 5) {
     prefix = nums.substring(2, 4) + nums.substring(4, 5);
  } else if (nums.length === 4) {
     prefix = nums.substring(2, 4);
  } else if (cicloNombre.length > 0) {
     prefix = cicloNombre.replace(/[^0-9A-Za-z]/g, '').substring(0, 3).toUpperCase();
  }
  return `${prefix}-${counter.toString().padStart(3, '0')}`;
};

interface AlumnosConfigProps {
  currentUser: Usuario;
  alumnos: Alumno[];
  ciclos: CicloEscolar[];
  activeCicloId: string;
  activeCyclePlans: PaymentPlan[];
  globalMaxCounter: number;
  catalogos?: Catalogos;
  plantillas?: PlantillaPlan[];
  onBack: () => void;
  onSave: (alumnos: Alumno[]) => void;
  onCreatePlan: (plan: PaymentPlan) => void;
  onViewFicha?: (id: string) => void;
}

export default function AlumnosConfig({ currentUser, alumnos: initialAlumnos, ciclos, activeCicloId, activeCyclePlans, globalMaxCounter, catalogos, plantillas, onBack, onSave, onCreatePlan, onViewFicha }: AlumnosConfigProps) {
  const [alumnos, setAlumnos] = useState<Alumno[]>(initialAlumnos);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Guardamos el contador mutable en un ref o variable local para iteraciones
  const localCounter = React.useRef(globalMaxCounter);
  
  const isCoordinador = currentUser.rol === 'COORDINADOR';
  const [editForm, setEditForm] = useState<Partial<Alumno> & { assignPlanType?: 'none' | 'blank' | 'template'; templateId?: string }>({});
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('alumnos_searchTerm') || '');
  const [filterLicenciaturas, setFilterLicenciaturas] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('alumnos_fLicenciaturas') || '[]'); } catch { return []; }
  });
  const [filterGrados, setFilterGrados] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('alumnos_fGrados') || '[]'); } catch { return []; }
  });
  const [filterTurnos, setFilterTurnos] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('alumnos_fTurnos') || '[]'); } catch { return []; }
  });
  const [filterEstatusList, setFilterEstatusList] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('alumnos_fEstatusList') || '[]'); } catch { return []; }
  });

  React.useEffect(() => {
    sessionStorage.setItem('alumnos_searchTerm', searchTerm);
    sessionStorage.setItem('alumnos_fLicenciaturas', JSON.stringify(filterLicenciaturas));
    sessionStorage.setItem('alumnos_fGrados', JSON.stringify(filterGrados));
    sessionStorage.setItem('alumnos_fTurnos', JSON.stringify(filterTurnos));
    sessionStorage.setItem('alumnos_fEstatusList', JSON.stringify(filterEstatusList));
  }, [searchTerm, filterLicenciaturas, filterGrados, filterTurnos, filterEstatusList]);
  const hasActiveFilters = filterLicenciaturas.length > 0 || filterGrados.length > 0 || filterTurnos.length > 0 || filterEstatusList.length > 0;
  const [showFilters, setShowFilters] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean; type: 'alert' | 'confirm'; title: string; message: string; onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  // ── Estado Bulk Promotion ──
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkCopyConcepts, setBulkCopyConcepts] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3500);
  };

  const showAlert = (title: string, message: string) => setModalState({ isOpen: true, type: 'alert', title, message });
  const showConfirm = (title: string, message: string, onConfirm: () => void) =>
    setModalState({ isOpen: true, type: 'confirm', title, message, onConfirm });

  const handleEdit = (alumno: Alumno) => { setEditingId(alumno.id); setEditForm(alumno); };

  const handleSave = async () => {
    if (!editForm.nombre_completo || !editForm.licenciatura || !editForm.grado_actual) return;
    setSaving(true);

    let updatedAlumnos: Alumno[];
    let alumnoToSave: Alumno;

    if (editingId === 'new') {
      alumnoToSave = {
        id: crypto.randomUUID(),
        nombre_completo: editForm.nombre_completo,
        licenciatura: editForm.licenciatura,
        grado_actual: editForm.grado_actual,
        turno: editForm.turno || 'MIXTO',
        estatus: editForm.estatus || 'ACTIVO',
        beca_porcentaje: editForm.beca_porcentaje || '0%',
        beca_tipo: editForm.beca_tipo || 'NINGUNA',
        observaciones_pago_titulacion: editForm.observaciones_pago_titulacion || null,
        ciclo_ultima_asignacion_grado: activeCicloId
      };
      updatedAlumnos = [...alumnos, alumnoToSave];

      // Insert alumno en Supabase
      const { error: alumnoErr } = await supabase.from('alumnos').insert({
        id: alumnoToSave.id,
        nombre_completo: alumnoToSave.nombre_completo,
        licenciatura: alumnoToSave.licenciatura,
        grado_actual: alumnoToSave.grado_actual,
        turno: alumnoToSave.turno,
        estatus: alumnoToSave.estatus,
        beca_porcentaje: alumnoToSave.beca_porcentaje,
        beca_tipo: alumnoToSave.beca_tipo,
        observaciones_pago_titulacion: alumnoToSave.observaciones_pago_titulacion || null,
        ciclo_ultima_asignacion_grado: alumnoToSave.ciclo_ultima_asignacion_grado
      });
      if (alumnoErr) console.warn('[AlumnosConfig] insert alumno:', alumnoErr.message);

      // Auto-generar plan de pagos para el ciclo activo
      if (editForm.assignPlanType === 'blank' || editForm.assignPlanType === 'template') {
        const activeCiclo = ciclos.find(c => c.id === activeCicloId);
        if (activeCiclo) {
          const isTemplate = editForm.assignPlanType === 'template' && editForm.templateId;
          const template = isTemplate && plantillas ? plantillas.find(p => p.id === editForm.templateId) : null;
          
          localCounter.current++;
          const newPlan: PaymentPlan = {
            id: crypto.randomUUID(),
            alumno_id: alumnoToSave.id,
            ciclo_id: activeCiclo.id,
            nombre_alumno: alumnoToSave.nombre_completo,
            no_plan_pagos: generateFolio(activeCiclo.nombre, localCounter.current),
            fecha_plan: new Date().toLocaleDateString('es-MX'),
            beca_porcentaje: alumnoToSave.beca_porcentaje || '0%',
            beca_tipo: alumnoToSave.beca_tipo || 'NINGUNA',
            ciclo_escolar: activeCiclo.nombre,
            tipo_plan: template ? template.tipo_plan : 'Cuatrimestral',
            licenciatura: alumnoToSave.licenciatura,
            grado_turno: `${alumnoToSave.grado_actual} / ${alumnoToSave.turno}`,
            grado: alumnoToSave.grado_actual,
            turno: alumnoToSave.turno,
          };
          
          if (template) {
             for (let i = 1; i <= 9; i++) {
                const cKey = `concepto_${i}` as keyof PaymentPlan;
                const fKey = `fecha_${i}` as keyof PaymentPlan;
                const aKey = `cantidad_${i}` as keyof PaymentPlan;
                const sKey = `estatus_${i}` as keyof PaymentPlan;
                if (template[cKey as keyof PlantillaPlan]) {
                   (newPlan as any)[cKey] = template[cKey as keyof PlantillaPlan];
                   (newPlan as any)[fKey] = template[fKey as keyof PlantillaPlan];
                   (newPlan as any)[aKey] = template[aKey as keyof PlantillaPlan];
                   (newPlan as any)[sKey] = '';
                }
             }
          }
          
          onCreatePlan(newPlan); // App.tsx escribe el plan a Supabase vía handleSavePlan
        }
      }
      showNotification('success', `Alumno "${alumnoToSave.nombre_completo}" creado.`);
    } else {
      const originalAlumno = alumnos.find(a => a.id === editingId);
      const isGradeChanged = originalAlumno && originalAlumno.grado_actual !== editForm.grado_actual;
      
      alumnoToSave = { 
         ...originalAlumno!, 
         ...editForm,
         ...(isGradeChanged ? { ciclo_ultima_asignacion_grado: activeCicloId } : {})
      } as Alumno;
      
      updatedAlumnos = alumnos.map(a => a.id === editingId ? alumnoToSave : a);

      const { error: updateErr } = await supabase.from('alumnos').update({
        nombre_completo: alumnoToSave.nombre_completo,
        licenciatura: alumnoToSave.licenciatura,
        grado_actual: alumnoToSave.grado_actual,
        turno: alumnoToSave.turno,
        estatus: alumnoToSave.estatus,
        beca_porcentaje: alumnoToSave.beca_porcentaje,
        beca_tipo: alumnoToSave.beca_tipo,
        observaciones_pago_titulacion: alumnoToSave.observaciones_pago_titulacion || null,
        ciclo_ultima_asignacion_grado: alumnoToSave.ciclo_ultima_asignacion_grado
      }).eq('id', alumnoToSave.id);
      if (updateErr) console.warn('[AlumnosConfig] update alumno:', updateErr.message);
      showNotification('success', 'Alumno actualizado.');
    }

    setAlumnos(updatedAlumnos);
    onSave(updatedAlumnos);
    setEditingId(null);
    setSaving(false);
  };

  const handleAddNew = () => {
    setEditingId('new');
    setEditForm({ 
      nombre_completo: '', licenciatura: '', grado_actual: '1ER', turno: 'MIXTO',
      estatus: 'ACTIVO', beca_porcentaje: '0%', beca_tipo: 'NINGUNA',
      assignPlanType: 'none', templateId: ''
    });
  };

  const handlePromote = (alumno: Alumno) => {
    if (alumno.estatus?.includes('EGRESADO') || alumno.grado_actual?.includes('EGRESADO')) {
      showAlert("Error", "Los alumnos egresados no pueden ser promovidos.");
      return;
    }

    if (alumno.estatus === 'BAJA') {
      showAlert("Error", "Los alumnos dados de baja no pueden ser promovidos. Cambia su estatus a ACTIVO primero.");
      return;
    }

    if (alumno.ciclo_ultima_asignacion_grado === activeCicloId) {
      showAlert("Error", "El grado de este alumno ya fue promovido o editado en el ciclo actual. Si es un error, edita su grado manualmente.");
      return;
    }

    const nextGrade = getNextGrade(alumno.grado_actual, alumno.licenciatura);

    if (nextGrade && nextGrade !== alumno.grado_actual) {
      showConfirm(
        "Confirmar Promoción",
        `¿Promover a ${alumno.nombre_completo} de ${alumno.grado_actual} a ${nextGrade}? Esto simulará su inscripción al nuevo ciclo.`,
        async () => {
          setSaving(true);
          const updated = alumnos.map(a => a.id === alumno.id ? { ...a, grado_actual: nextGrade!, ciclo_ultima_asignacion_grado: activeCicloId } : a);

          const { error } = await supabase.from('alumnos').update({ grado_actual: nextGrade, ciclo_ultima_asignacion_grado: activeCicloId }).eq('id', alumno.id);
          if (error) console.warn('[AlumnosConfig] promote:', error.message);

          const activeCiclo = ciclos.find(c => c.id === activeCicloId);
          if (activeCiclo) {
            localCounter.current++;
            const newPlan: PaymentPlan = {
              id: crypto.randomUUID(),
              alumno_id: alumno.id,
              ciclo_id: activeCiclo.id,
              nombre_alumno: alumno.nombre_completo,
              no_plan_pagos: generateFolio(activeCiclo.nombre, localCounter.current),
              fecha_plan: new Date().toLocaleDateString('es-MX'),
              beca_porcentaje: '0%', beca_tipo: 'NINGUNA',
              ciclo_escolar: activeCiclo.nombre,
              tipo_plan: 'Cuatrimestral',
              licenciatura: alumno.licenciatura,
              grado_turno: `${nextGrade} / ${alumno.turno}`
            };
            onCreatePlan(newPlan);
          }

          setAlumnos(updated);
          onSave(updated);
          setSaving(false);
          showNotification('success', `Alumno promovido a ${nextGrade}.`);
        }
      );
    } else {
      showAlert("Error", "No se pudo determinar el siguiente grado. Edítalo manualmente.");
    }
  };

  const handleDelete = (alumno: Alumno) => {
    showConfirm(
      "Eliminar Alumno",
      `¿Estás seguro de que deseas eliminar permanentemente a ${alumno.nombre_completo}? Esta acción no se puede deshacer y **eliminará todos sus planes de pago** si existen.`,
      async () => {
        setSaving(true);
        // Supabase has ON DELETE CASCADE configured, so it will delete associated plans.
        const { error } = await supabase.from('alumnos').delete().eq('id', alumno.id);
        
        if (error) {
          console.error('[AlumnosConfig] delete error:', error);
          showNotification('error', `Error al eliminar el alumno: ${error.message}`);
          setSaving(false);
          return;
        }

        const updated = alumnos.filter(a => a.id !== alumno.id);
        setAlumnos(updated);
        onSave(updated);
        setSaving(false);
        showNotification('success', `Alumno eliminado exitosamente.`);
      }
    );
  };

  // ── Selección Múltiple Principal y Ordenamiento ──
  const [mainTableSelected, setMainTableSelected] = useState<Set<string>>(new Set());
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState('ACTIVO');
  
  const [sortField, setSortField] = useState<'nombre_completo' | 'licenciatura' | 'grado_actual' | 'turno' | 'estatus'>('nombre_completo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'nombre_completo' | 'licenciatura' | 'grado_actual' | 'turno' | 'estatus') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortField, sortDirection, itemsPerPage, filterLicenciaturas, filterGrados, filterTurnos, filterEstatusList]);

  const licenciaturas = React.useMemo(() => Array.from(new Set(alumnos.map(a => a.licenciatura).filter(Boolean))).sort(), [alumnos]);
  const grados = React.useMemo(() => Array.from(new Set(alumnos.map(a => a.grado_actual).filter(Boolean))).sort(), [alumnos]);
  const turnos = React.useMemo(() => Array.from(new Set(alumnos.map(a => a.turno).filter(Boolean))).sort(), [alumnos]);
  const estatusList = React.useMemo(() => Array.from(new Set(alumnos.map(a => a.estatus).filter(Boolean))).sort(), [alumnos]);

  const filteredAlumnos = alumnos
    .filter(a => {
      const matchSearch = a.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.licenciatura.toLowerCase().includes(searchTerm.toLowerCase());
      const matchLic = filterLicenciaturas.length === 0 || filterLicenciaturas.includes(a.licenciatura);
      const matchGrado = filterGrados.length === 0 || filterGrados.includes(a.grado_actual);
      const matchTurno = filterTurnos.length === 0 || filterTurnos.includes(a.turno);
      const matchEstatus = filterEstatusList.length === 0 || filterEstatusList.includes(a.estatus);
      return matchSearch && matchLic && matchGrado && matchTurno && matchEstatus;
    })
    .sort((a, b) => {
      const aVal = (a[sortField] || '').toString().toLowerCase();
      const bVal = (b[sortField] || '').toString().toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredAlumnos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredAlumnos.length);
  const paginatedAlumnos = filteredAlumnos.slice(startIndex, endIndex);

  const toggleMainTableSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(mainTableSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setMainTableSelected(next);
  };

  const toggleAllMainTable = () => {
    if (mainTableSelected.size === filteredAlumnos.length && filteredAlumnos.length > 0) {
      setMainTableSelected(new Set());
    } else {
      setMainTableSelected(new Set(filteredAlumnos.map(a => a.id)));
    }
  };

  const handleBulkDelete = () => {
    showConfirm(
      "Eliminar Alumnos Seleccionados",
      `¿Estás seguro de que deseas eliminar permanentemente a ${mainTableSelected.size} alumno(s)? Esta acción no se puede deshacer y **eliminará todos sus planes de pago**.`,
      async () => {
        setSaving(true);
        const idsToDelete = Array.from(mainTableSelected);
        const { error } = await supabase.from('alumnos').delete().in('id', idsToDelete);
        
        if (error) {
          showNotification('error', `Error al eliminar: ${error.message}`);
        } else {
          const updated = alumnos.filter(a => !mainTableSelected.has(a.id));
          setAlumnos(updated);
          onSave(updated);
          setMainTableSelected(new Set());
          showNotification('success', `${idsToDelete.length} alumno(s) eliminado(s) exitosamente.`);
        }
        setSaving(false);
      }
    );
  };

  const executeBulkStatusChange = async () => {
    setSaving(true);
    const idsToUpdate = Array.from(mainTableSelected);
    const { error } = await supabase.from('alumnos').update({ estatus: bulkStatusTarget }).in('id', idsToUpdate);
    
    if (error) {
      showNotification('error', `Error al actualizar: ${error.message}`);
    } else {
      const updated = alumnos.map(a => mainTableSelected.has(a.id) ? { ...a, estatus: bulkStatusTarget } : a);
      setAlumnos(updated);
      onSave(updated);
      setMainTableSelected(new Set());
      showNotification('success', `Estatus actualizado a ${bulkStatusTarget} para ${idsToUpdate.length} alumno(s).`);
    }
    setShowBulkStatusModal(false);
    setSaving(false);
  };

  const promotableAlumnos = filteredAlumnos.filter(a => 
    !activeCyclePlans.some(p => p.alumno_id === a.id || p.nombre_alumno === a.nombre_completo) &&
    a.estatus !== 'BAJA' &&
    !a.estatus?.includes('EGRESADO') &&
    !(a.grado_actual?.toUpperCase() || '').includes('EGRESADO') &&
    a.ciclo_ultima_asignacion_grado !== activeCicloId
  );

  // ── Lógica de Promoción Masiva ──
  const toggleBulkSelect = (id: string) => {
    const next = new Set(bulkSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setBulkSelected(next);
  };
  const toggleAllBulk = () => {
    if (bulkSelected.size === promotableAlumnos.length && promotableAlumnos.length > 0) setBulkSelected(new Set());
    else setBulkSelected(new Set(promotableAlumnos.map(a => a.id)));
  };

  const is8voMaxLic = (licenciatura: string) => {
    if (!licenciatura) return false;
    const lic = licenciatura.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return lic.includes('PSICOLOGIA') || lic.includes('PEDAGOGIA') || lic.includes('MERCADOTECNIA');
  };

  const getNextGrade = (currentGrade: string, licenciatura: string) => {
    if (currentGrade?.includes('EGRESADO')) return currentGrade;
    const is8vo = is8voMaxLic(licenciatura);

    const gradeMap: Record<string, string> = {
      '1ER': '2DO', '2DO': '3ER', '3ER': '4TO', '4TO': '5TO',
      '5TO': '6TO', '6TO': '7MO', '7MO': '8VO', 
      '8VO': is8vo ? 'EGRESADO' : '9NO',
      '9NO': '10MO', 
      '10MO': 'EGRESADO'
    };
    
    // Fallback if not standard
    if (!gradeMap[currentGrade]) {
      const currentGradeNum = currentGrade.replace(/[^0-9]/g, '');
      if (currentGradeNum) {
        if (is8vo && Number(currentGradeNum) >= 8) return 'EGRESADO';
        if (!is8vo && Number(currentGradeNum) >= 10) return 'EGRESADO';
        return `${Number(currentGradeNum) + 1}VO`;
      }
    }
    
    return gradeMap[currentGrade] || currentGrade;
  };

  const executeBulkPromotion = async () => {
    if (bulkSelected.size === 0) return;
    setBulkProcessing(true);

    const activeCiclo = ciclos.find(c => c.id === activeCicloId);
    if (!activeCiclo) {
      showNotification('error', 'No hay ciclo activo definido.');
      setBulkProcessing(false);
      return;
    }

    const selectedAlumnos = alumnos.filter(a => bulkSelected.has(a.id));
    const nextGrades = selectedAlumnos.map(a => ({ ...a, nextGrade: getNextGrade(a.grado_actual, a.licenciatura), ciclo_ultima_asignacion_grado: activeCicloId }));

    // Actualizar alumnos en DB
    const updatePromises = nextGrades.map(a => 
      supabase.from('alumnos').update({ grado_actual: a.nextGrade, ciclo_ultima_asignacion_grado: a.ciclo_ultima_asignacion_grado }).eq('id', a.id)
    );
    await Promise.all(updatePromises);

    // Actualizar estado local
    const updatedAlumnos = alumnos.map(a => {
      if (bulkSelected.has(a.id)) return { ...a, grado_actual: getNextGrade(a.grado_actual, a.licenciatura), ciclo_ultima_asignacion_grado: activeCicloId };
      return a;
    });

    // Fetchear planes previos si hay que copiar conceptos
    let previousPlansMap = new Map<string, PaymentPlan>();
    if (bulkCopyConcepts) {
      const { data } = await supabase.from('vista_planes_pago')
        .select('*')
        .in('alumno_id', Array.from(bulkSelected))
        .order('fecha_plan', { ascending: false });
      if (data) {
        // Guardar solo el plan más reciente por alumno
        data.forEach(p => {
          if (!previousPlansMap.has(p.alumno_id)) previousPlansMap.set(p.alumno_id, p as PaymentPlan);
        });
      }
    }

    // Crear nuevos planes
    let currentBatchCounter = localCounter.current;
    const newPlans: PaymentPlan[] = nextGrades.map(a => {
      currentBatchCounter++;
      const prevPlan = previousPlansMap.get(a.id);
      return {
        id: crypto.randomUUID(),
        alumno_id: a.id,
        ciclo_id: activeCiclo.id,
        nombre_alumno: a.nombre_completo,
        no_plan_pagos: generateFolio(activeCiclo.nombre, currentBatchCounter),
        fecha_plan: new Date().toLocaleDateString('es-MX'),
        beca_porcentaje: prevPlan?.beca_porcentaje || '0%',
        beca_tipo: prevPlan?.beca_tipo || 'NINGUNA',
        ciclo_escolar: activeCiclo.nombre,
        tipo_plan: prevPlan?.tipo_plan || 'Cuatrimestral',
        licenciatura: a.licenciatura,
        grado_turno: `${a.nextGrade} / ${a.turno}`,
        grado: a.nextGrade,
        turno: a.turno,
        // Copiar conceptos
        concepto_1: bulkCopyConcepts ? prevPlan?.concepto_1 : undefined, cantidad_1: bulkCopyConcepts ? prevPlan?.cantidad_1 : undefined,
        concepto_2: bulkCopyConcepts ? prevPlan?.concepto_2 : undefined, cantidad_2: bulkCopyConcepts ? prevPlan?.cantidad_2 : undefined,
        concepto_3: bulkCopyConcepts ? prevPlan?.concepto_3 : undefined, cantidad_3: bulkCopyConcepts ? prevPlan?.cantidad_3 : undefined,
        concepto_4: bulkCopyConcepts ? prevPlan?.concepto_4 : undefined, cantidad_4: bulkCopyConcepts ? prevPlan?.cantidad_4 : undefined,
        concepto_5: bulkCopyConcepts ? prevPlan?.concepto_5 : undefined, cantidad_5: bulkCopyConcepts ? prevPlan?.cantidad_5 : undefined,
        concepto_6: bulkCopyConcepts ? prevPlan?.concepto_6 : undefined, cantidad_6: bulkCopyConcepts ? prevPlan?.cantidad_6 : undefined,
        concepto_7: bulkCopyConcepts ? prevPlan?.concepto_7 : undefined, cantidad_7: bulkCopyConcepts ? prevPlan?.cantidad_7 : undefined,
        concepto_8: bulkCopyConcepts ? prevPlan?.concepto_8 : undefined, cantidad_8: bulkCopyConcepts ? prevPlan?.cantidad_8 : undefined,
        concepto_9: bulkCopyConcepts ? prevPlan?.concepto_9 : undefined, cantidad_9: bulkCopyConcepts ? prevPlan?.cantidad_9 : undefined,
        // No copiamos fechas ni estatus
      };
    });

    const dbPlans = newPlans.map(toDBPlan);
    const { error: plansErr } = await supabase.from('planes_pago').insert(dbPlans);
    
    if (plansErr) {
       showNotification('error', `Error al crear planes: ${plansErr.message}`);
    } else {
       newPlans.forEach(p => onCreatePlan(p)); // update local cache
       showNotification('success', `${bulkSelected.size} alumnos promovidos exitosamente.`);
    }

    setAlumnos(updatedAlumnos);
    onSave(updatedAlumnos);
    setBulkSelected(new Set());
    setShowBulkModal(false);
    setBulkProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-black font-bold transition-colors">
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
          
          <div className="flex-1"></div>

          <button onClick={() => setShowBulkModal(true)} disabled={alumnos.length === 0}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50">
            <Users size={18} /> Promoción Masiva
          </button>

          <button onClick={handleAddNew} disabled={editingId !== null || saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Nuevo Alumno
          </button>
        </div>

        {notification && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-sm
            ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {notification.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {notification.msg}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Gestión de Alumnos</h1>
              <p className="text-gray-500 text-sm mt-1">Administra el padrón de alumnos y promuévelos de grado.</p>
            </div>
            {mainTableSelected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl">
                 <span className="text-sm font-bold text-indigo-800">{mainTableSelected.size} seleccionados</span>
                 <button onClick={() => setShowBulkStatusModal(true)} className="text-sm font-semibold bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-100 transition-colors">Cambiar Estatus</button>
                 {!isCoordinador && (
                   <button onClick={handleBulkDelete} className="text-sm font-semibold bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-50 transition-colors">Eliminar</button>
                 )}
                 <button onClick={() => setMainTableSelected(new Set())} className="text-sm text-gray-500 hover:text-gray-700 font-medium px-2" title="Cancelar selección"><X size={16}/></button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={18} className="text-gray-400" />
                    </div>
                    <input type="text" className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                      placeholder="Buscar alumno o licenciatura..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors w-full sm:w-auto ${showFilters || hasActiveFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  <Filter size={16} />
                  Filtros {hasActiveFilters && <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>}
                </button>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showFilters && !mainTableSelected.size && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-visible border-b border-gray-100 bg-gray-50/50 relative z-10"
              >
                <div className="p-4 px-6 flex flex-wrap gap-4 items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">Filtrar por:</span>
                  
                  <MultiSelectFilter
                    label="Licenciatura"
                    options={licenciaturas}
                    selected={filterLicenciaturas}
                    onChange={setFilterLicenciaturas}
                  />
                  <MultiSelectFilter
                    label="Grado"
                    options={grados}
                    selected={filterGrados}
                    onChange={setFilterGrados}
                  />
                  <MultiSelectFilter
                    label="Turno"
                    options={turnos}
                    selected={filterTurnos}
                    onChange={setFilterTurnos}
                  />
                  <MultiSelectFilter
                    label="Estatus"
                    options={estatusList}
                    selected={filterEstatusList}
                    onChange={setFilterEstatusList}
                  />

                  {hasActiveFilters && (
                    <button
                      onClick={() => { setFilterLicenciaturas([]); setFilterGrados([]); setFilterTurnos([]); setFilterEstatusList([]); }}
                      className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1 ml-auto"
                    >
                      <X size={16} /> Limpiar
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">
                    <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={filteredAlumnos.length > 0 && mainTableSelected.size === filteredAlumnos.length} onChange={toggleAllMainTable} title="Seleccionar todos los filtrados" />
                  </th>
                  <th className="py-3 px-6 font-semibold cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('nombre_completo')}>
                    <div className="flex items-center gap-1">
                      Nombre Completo
                      {sortField === 'nombre_completo' && (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />)}
                    </div>
                  </th>
                  <th className="py-3 px-6 font-semibold cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('licenciatura')}>
                    <div className="flex items-center gap-1">
                      Licenciatura
                      {sortField === 'licenciatura' && (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />)}
                    </div>
                  </th>
                  <th className="py-3 px-6 font-semibold cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('grado_actual')}>
                    <div className="flex items-center gap-1">
                      Grado
                      {sortField === 'grado_actual' && (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />)}
                    </div>
                  </th>
                  <th className="py-3 px-6 font-semibold cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('turno')}>
                    <div className="flex items-center gap-1">
                      Turno
                      {sortField === 'turno' && (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />)}
                    </div>
                  </th>
                  <th className="py-3 px-6 font-semibold cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('estatus')}>
                    <div className="flex items-center gap-1">
                      Estatus
                      {sortField === 'estatus' && (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-indigo-600" />)}
                    </div>
                  </th>
                  <th className="py-3 px-4 font-semibold text-center text-emerald-700">
                    <div className="flex items-center justify-center gap-1">
                      <Wallet size={13} /> Monedero
                    </div>
                  </th>
                  <th className="py-3 px-6 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editingId === 'new' && (
                  <tr className="bg-indigo-50/50">
                    <td colSpan={8} className="p-4 border-b border-indigo-100">
                      <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-5">
                         <h4 className="font-bold text-indigo-800 border-b border-indigo-50 pb-2 mb-4">Datos del Alumno</h4>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                           <div className="col-span-2">
                             <label className="block text-xs text-gray-500 mb-1">Nombre Completo</label>
                             <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.nombre_completo || ''} onChange={e => setEditForm({...editForm, nombre_completo: e.target.value})} />
                           </div>
                           <div>
                             <label className="block text-xs text-gray-500 mb-1">Licenciatura</label>
                             {catalogos?.licenciaturas?.length ? (
                               <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.licenciatura || ''} onChange={e => setEditForm({...editForm, licenciatura: e.target.value})}>
                                 <option value="">-- Seleccionar --</option>
                                 {catalogos.licenciaturas.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                             ) : (
                               <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.licenciatura || ''} onChange={e => setEditForm({...editForm, licenciatura: e.target.value})} />
                             )}
                           </div>
                           <div>
                             <label className="block text-xs text-gray-500 mb-1">Grado</label>
                             {catalogos?.grados?.length ? (
                               <select disabled={editForm.estatus === 'BAJA'} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-100" value={editForm.grado_actual || ''} onChange={e => setEditForm({...editForm, grado_actual: e.target.value})}>
                                 <option value="">-- Seleccionar --</option>
                                 {catalogos.grados.filter(g => {
                                    if (editForm.licenciatura && is8voMaxLic(editForm.licenciatura)) {
                                       return g !== '9NO' && g !== '10MO';
                                    }
                                    return true;
                                 }).map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                             ) : (
                               <input disabled={editForm.estatus === 'BAJA'} type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-100" value={editForm.grado_actual || ''} onChange={e => setEditForm({...editForm, grado_actual: e.target.value})} />
                             )}
                             {editForm.estatus === 'BAJA' && <p className="text-[10px] text-red-500 mt-1 leading-tight">Cambia el estatus a ACTIVO para editar</p>}
                           </div>
                           <div>
                             <label className="block text-xs text-gray-500 mb-1">Turno</label>
                             {catalogos?.turnos?.length ? (
                               <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.turno || ''} onChange={e => setEditForm({...editForm, turno: e.target.value})}>
                                 <option value="">-- Seleccionar --</option>
                                 {catalogos.turnos.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                             ) : (
                               <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.turno || ''} onChange={e => setEditForm({...editForm, turno: e.target.value})} />
                             )}
                           </div>
                           <div>
                             <label className="block text-xs text-gray-500 mb-1">Estatus</label>
                             {catalogos?.estatus_alumnos?.length ? (
                               <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.estatus || ''} onChange={e => setEditForm({...editForm, estatus: e.target.value})}>
                                 <option value="">-- Seleccionar --</option>
                                 {catalogos.estatus_alumnos.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                             ) : (
                               <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.estatus || ''} onChange={e => setEditForm({...editForm, estatus: e.target.value})} />
                             )}
                           </div>
                           <div>
                             <label className="block text-xs text-gray-500 mb-1">Tipo de Beca</label>
                             {catalogos?.beca_tipos?.length ? (
                               <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.beca_tipo || ''} onChange={e => setEditForm({...editForm, beca_tipo: e.target.value})}>
                                 <option value="">-- Seleccionar --</option>
                                 {catalogos.beca_tipos.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                             ) : (
                               <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.beca_tipo || ''} onChange={e => setEditForm({...editForm, beca_tipo: e.target.value})} />
                             )}
                           </div>
                           <div>
                             <label className="block text-xs text-gray-500 mb-1">% de Beca</label>
                             {catalogos?.beca_porcentajes?.length ? (
                               <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.beca_porcentaje || ''} onChange={e => setEditForm({...editForm, beca_porcentaje: e.target.value})}>
                                 <option value="">-- Seleccionar --</option>
                                 {catalogos.beca_porcentajes.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                             ) : (
                               <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.beca_porcentaje || ''} onChange={e => setEditForm({...editForm, beca_porcentaje: e.target.value})} />
                             )}
                           </div>
                         </div>
                         
                         <div className="mb-6">
                            <label className="block text-xs text-gray-500 mb-1">Observaciones de Pago / Titulación</label>
                            <textarea
                              rows={2}
                              placeholder="Ej: Descuento de titulación acordado el 15/01/2026, reducción del 30% en cuotas restantes..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500"
                              value={editForm.observaciones_pago_titulacion || ''}
                              onChange={e => setEditForm({...editForm, observaciones_pago_titulacion: e.target.value})}
                            />
                         </div>
                         
                         <h4 className="font-bold text-indigo-800 border-b border-indigo-50 pb-2 mb-4 mt-6">Plan de Pagos a Asignar (Ciclo Activo)</h4>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                           <div className="col-span-2 md:col-span-1">
                             <label className="block text-xs font-semibold text-gray-600 mb-1">Asignar Plan</label>
                             <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.assignPlanType || 'none'} onChange={e => setEditForm({...editForm, assignPlanType: e.target.value as 'none'|'blank'|'template'})}>
                               <option value="none">(Ninguno) Asignar después</option>
                               <option value="blank">Formato Vacío</option>
                               <option value="template">Desde Plantilla</option>
                             </select>
                           </div>
                           {editForm.assignPlanType === 'template' && (
                           <div className="col-span-2 md:col-span-3">
                             <label className="block text-xs font-semibold text-gray-600 mb-1">Seleccionar Plantilla</label>
                             <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" value={editForm.templateId || ''} onChange={e => setEditForm({...editForm, templateId: e.target.value})}>
                               <option value="">-- Elegir Plantilla --</option>
                               {plantillas?.filter(p => p.activo && (!p.ciclo_id || p.ciclo_id === activeCicloId)).map(p => (
                                 <option key={p.id} value={p.id}>{p.nombre}</option>
                               ))}
                             </select>
                           </div>
                           )}
                         </div>

                         <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                           <button onClick={() => setEditingId(null)} className="px-5 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-100 font-medium">Cancelar</button>
                           <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-2 font-bold">
                             {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                             Guardar Alumno
                           </button>
                         </div>
                      </div>
                    </td>
                  </tr>
                )}
                {paginatedAlumnos.map(alumno => (
                  <React.Fragment key={alumno.id}>
                    {editingId === alumno.id ? (
                      <tr className="bg-blue-50/40">
                        <td colSpan={8} className="p-4 border-b border-blue-100">
                          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-5">
                             <h4 className="font-bold text-blue-800 border-b border-blue-50 pb-2 mb-4">Editar Alumno</h4>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                               <div className="col-span-2">
                                 <label className="block text-xs text-gray-500 mb-1">Nombre Completo</label>
                                 <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editForm.nombre_completo || ''} onChange={e => setEditForm({...editForm, nombre_completo: e.target.value})} />
                               </div>
                               <div>
                                 <label className="block text-xs text-gray-500 mb-1">Licenciatura</label>
                                 {catalogos?.licenciaturas?.length ? (
                                   <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={editForm.licenciatura || ''} onChange={e => setEditForm({...editForm, licenciatura: e.target.value})}>
                                     <option value="">-- Seleccionar --</option>
                                     {catalogos.licenciaturas.map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                                 ) : (
                                   <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={editForm.licenciatura || ''} onChange={e => setEditForm({...editForm, licenciatura: e.target.value})} />
                                 )}
                               </div>
                               <div>
                                 <label className="block text-xs text-gray-500 mb-1">Grado</label>
                                 {catalogos?.grados?.length ? (
                                   <select disabled={editForm.estatus === 'BAJA'} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100" value={editForm.grado_actual || ''} onChange={e => setEditForm({...editForm, grado_actual: e.target.value})}>
                                     <option value="">-- Seleccionar --</option>
                                     {catalogos.grados.filter(g => {
                                        if (editForm.licenciatura && is8voMaxLic(editForm.licenciatura)) {
                                           return g !== '9NO' && g !== '10MO';
                                        }
                                        return true;
                                     }).map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                                 ) : (
                                   <input disabled={editForm.estatus === 'BAJA'} type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:opacity-50 disabled:bg-gray-100" value={editForm.grado_actual || ''} onChange={e => setEditForm({...editForm, grado_actual: e.target.value})} />
                                 )}
                                 {editForm.estatus === 'BAJA' && <p className="text-[10px] text-red-500 mt-1 leading-tight">Cambia el estatus a ACTIVO para editar</p>}
                               </div>
                               <div>
                                 <label className="block text-xs text-gray-500 mb-1">Turno</label>
                                 {catalogos?.turnos?.length ? (
                                   <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={editForm.turno || ''} onChange={e => setEditForm({...editForm, turno: e.target.value})}>
                                     <option value="">-- Seleccionar --</option>
                                     {catalogos.turnos.map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                                 ) : (
                                   <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={editForm.turno || ''} onChange={e => setEditForm({...editForm, turno: e.target.value})} />
                                 )}
                               </div>
                               <div>
                                 <label className="block text-xs text-gray-500 mb-1">Estatus</label>
                                 {catalogos?.estatus_alumnos?.length ? (
                                   <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={editForm.estatus || ''} onChange={e => setEditForm({...editForm, estatus: e.target.value})}>
                                     <option value="">-- Seleccionar --</option>
                                     {catalogos.estatus_alumnos.map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                                 ) : (
                                   <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={editForm.estatus || ''} onChange={e => setEditForm({...editForm, estatus: e.target.value})} />
                                 )}
                               </div>
                               <div>
                                 <label className="block text-xs text-gray-500 mb-1">Tipo de Beca</label>
                                 {catalogos?.beca_tipos?.length ? (
                                   <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={editForm.beca_tipo || ''} onChange={e => setEditForm({...editForm, beca_tipo: e.target.value})}>
                                     <option value="">-- Seleccionar --</option>
                                     {catalogos.beca_tipos.map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                                 ) : (
                                   <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={editForm.beca_tipo || ''} onChange={e => setEditForm({...editForm, beca_tipo: e.target.value})} />
                                 )}
                               </div>
                               <div>
                                 <label className="block text-xs text-gray-500 mb-1">% de Beca</label>
                                 {catalogos?.beca_porcentajes?.length ? (
                                   <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={editForm.beca_porcentaje || ''} onChange={e => setEditForm({...editForm, beca_porcentaje: e.target.value})}>
                                     <option value="">-- Seleccionar --</option>
                                     {catalogos.beca_porcentajes.map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                                 ) : (
                                   <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={editForm.beca_porcentaje || ''} onChange={e => setEditForm({...editForm, beca_porcentaje: e.target.value})} />
                                 )}
                               </div>
                             </div>
                             <div className="mt-3">
                                <label className="block text-xs text-gray-500 mb-1">Observaciones de Pago / Titulación</label>
                                <textarea
                                  rows={2}
                                  placeholder="Ej: Descuento de titulación acordado el 15/01/2026, reducción del 30% en cuotas restantes..."
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  value={editForm.observaciones_pago_titulacion || ''}
                                  onChange={e => setEditForm({...editForm, observaciones_pago_titulacion: e.target.value})}
                                />
                              </div>
                             <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-50">
                               <button onClick={() => setEditingId(null)} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200 font-medium">Cancelar</button>
                               <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-2 font-bold">
                                 {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                 Actualizar
                               </button>
                             </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr className={`hover:bg-gray-50 transition-colors ${mainTableSelected.has(alumno.id) ? 'bg-indigo-50/20' : ''}`}>
                        <td className="py-4 px-4 text-center">
                          <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={mainTableSelected.has(alumno.id)} onChange={(e) => toggleMainTableSelect(alumno.id, e)} />
                        </td>
                        <td className="py-4 px-6 font-bold text-gray-800">
                          {alumno.nombre_completo}
                          <div className="text-xs text-gray-400 font-normal mt-0.5 whitespace-nowrap">
                             {alumno.beca_porcentaje && alumno.beca_porcentaje !== '0%' 
                               ? <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">{'Beca: ' + alumno.beca_porcentaje + ' (' + alumno.beca_tipo + ')'}</span> 
                               : 'Sin beca'}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-gray-600">{alumno.licenciatura}</td>
                        <td className="py-4 px-6 font-semibold text-indigo-600">{alumno.grado_actual}</td>
                        <td className="py-4 px-6 text-gray-600">{alumno.turno}</td>
                        <td className="py-4 px-6">
                           <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm border ${alumno.estatus === 'BAJA' ? 'bg-red-50 text-red-600 border-red-100' : alumno.estatus?.includes('EGRESADO') ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{alumno.estatus || 'ACTIVO'}</span>
                        </td>
                        {/* — Columna Monedero — */}
                        <td className="py-4 px-4 text-center">
                          {(alumno.saldo_a_favor ?? 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-2 py-1 rounded-lg shadow-sm whitespace-nowrap">
                              <Wallet size={11} />
                              ${Number(alumno.saldo_a_favor).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2 items-center">
                            {onViewFicha && (
                              <button onClick={() => onViewFicha(alumno.id)} className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 text-xs font-bold bg-blue-50 px-3 py-1.5 rounded transition-colors border border-blue-100">
                                Ver Ficha
                              </button>
                            )}
                            {activeCyclePlans.some(p => p.alumno_id === alumno.id || p.nombre_alumno === alumno.nombre_completo) ? (
                              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1.5 rounded border border-emerald-100 shadow-sm">
                                <CheckCircle size={14} /> Inscrito
                              </span>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => {
                                    const activeCiclo = ciclos.find(c => c.id === activeCicloId);
                                    if (activeCiclo) {
                                      showConfirm("Confirmar Inscripción",
                                        `¿Inscribir a ${alumno.nombre_completo} en el ciclo ${activeCiclo.nombre}?`,
                                        () => {
                                          localCounter.current++;
                                          const newPlan: PaymentPlan = {
                                            id: crypto.randomUUID(),
                                            alumno_id: alumno.id, ciclo_id: activeCiclo.id,
                                            nombre_alumno: alumno.nombre_completo,
                                            no_plan_pagos: generateFolio(activeCiclo.nombre, localCounter.current),
                                            fecha_plan: new Date().toLocaleDateString('es-MX'),
                                            beca_porcentaje: '0%', beca_tipo: 'NINGUNA',
                                            ciclo_escolar: activeCiclo.nombre,
                                            tipo_plan: 'Cuatrimestral',
                                            licenciatura: alumno.licenciatura,
                                            grado_turno: `${alumno.grado_actual} / ${alumno.turno}`
                                          };
                                          onCreatePlan(newPlan);
                                          showNotification('success', `Alumno inscrito en ciclo ${activeCiclo.nombre}.`);
                                        }
                                      );
                                    }
                                  }}
                                  className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-1.5 rounded transition-colors border border-emerald-100 shadow-sm"
                                  title="Inscribir con Plan Vacío"
                                >
                                  <CheckCircle size={14} />
                                </button>
                                {!isCoordinador && (
                                  <button onClick={() => handlePromote(alumno)} disabled={saving}
                                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded transition-colors border border-indigo-100 shadow-sm">
                                    <GraduationCap size={14} /> Promover
                                  </button>
                                )}
                              </div>
                            )}
                            <button onClick={() => handleEdit(alumno)} className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors ml-1" title="Editar Alumno">
                              <Edit2 size={18} />
                            </button>
                            {!isCoordinador && (
                              <button onClick={() => handleDelete(alumno)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors ml-1" title="Eliminar Alumno">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAlumnos.length > 0 && (
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 font-medium">Mostrar</span>
                <select 
                  className="border border-gray-300 rounded-md text-sm p-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-500 font-medium">alumnos</span>
              </div>
              <div className="text-sm text-gray-500 font-medium bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                Mostrando <span className="text-gray-900 font-bold">{startIndex + 1}</span> a <span className="text-gray-900 font-bold">{endIndex}</span> de <span className="text-gray-900 font-bold">{filteredAlumnos.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white text-gray-700 font-bold transition-all shadow-sm hover:shadow active:scale-95"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 font-medium">Página</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages || 1}
                    value={currentPage || ''}
                    title="Ir a página"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setCurrentPage(val as any);
                        return;
                      }
                      let p = parseInt(val, 10);
                      if (isNaN(p)) return;
                      if (p > totalPages) p = totalPages;
                      if (p < 1) p = 1;
                      setCurrentPage(p);
                    }}
                    onBlur={() => {
                        if (!currentPage || currentPage < 1) setCurrentPage(1);
                    }}
                    className="w-16 border border-gray-300 rounded-md p-1.5 text-center text-sm font-bold bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <span className="text-sm text-gray-700 font-medium">de {totalPages || 1}</span>
                </div>
                <button 
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white text-gray-700 font-bold transition-all shadow-sm hover:shadow active:scale-95"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Promote Modal */}
      <AnimatePresence>
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 font-sans">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col h-[85vh] overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Users size={24} className="text-amber-500" /> Promoción Masiva de Alumnos</h3>
                <p className="text-sm text-gray-500 mt-1">Sube de grado a múltiples alumnos y créales un nuevo plan de pagos para el ciclo activo ({ciclos.find(c => c.id === activeCicloId)?.nombre}).</p>
              </div>
              <button disabled={bulkProcessing} onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-700 p-2 rounded-full hover:bg-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-100 bg-white">
               <div className="flex items-center gap-3 bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100 mb-0">
                  <input type="checkbox" id="copyConcepts" className="w-5 h-5 text-blue-600 rounded border-gray-300"
                         checked={bulkCopyConcepts} onChange={e => setBulkCopyConcepts(e.target.checked)} />
                  <label htmlFor="copyConcepts" className="text-sm font-medium cursor-pointer">
                    Copiar conceptos y montos del último plan de pagos de cada alumno (las fechas se omitirán).
                  </label>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0">
               <table className="w-full text-left text-sm border-collapse">
                 <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                   <tr>
                     <th className="py-3 px-4 w-12 text-center">
                        <input type="checkbox" className="w-4 h-4" checked={promotableAlumnos.length > 0 && bulkSelected.size === promotableAlumnos.length} onChange={toggleAllBulk} />
                     </th>
                     <th className="py-3 px-4 font-semibold text-gray-700">Alumno</th>
                     <th className="py-3 px-4 font-semibold text-gray-700 text-center">Cambio de Grado</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {promotableAlumnos.map(a => (
                     <tr key={a.id} className={`hover:bg-gray-50 cursor-pointer ${bulkSelected.has(a.id) ? 'bg-amber-50/30' : ''}`} onClick={() => toggleBulkSelect(a.id)}>
                       <td className="py-3 px-4 text-center">
                          <input type="checkbox" className="w-4 h-4 pointer-events-none" checked={bulkSelected.has(a.id)} readOnly />
                       </td>
                       <td className="py-3 px-4 font-medium text-gray-800">
                          {a.nombre_completo}
                          <div className="text-xs text-gray-500 font-normal">{a.licenciatura} · {a.turno}</div>
                       </td>
                       <td className="py-3 px-4 text-center">
                          <span className="text-gray-500 line-through mr-2">{a.grado_actual}</span>
                          <span className="font-bold text-indigo-600 text-base">{getNextGrade(a.grado_actual, a.licenciatura)}</span>
                       </td>
                     </tr>
                   ))}
                   {promotableAlumnos.length === 0 && (
                      <tr><td colSpan={3} className="text-center py-8 text-gray-500">
                        {filteredAlumnos.length > 0 ? "Todos los alumnos filtrados ya están inscritos en el ciclo actual." : "No hay alumnos para mostrar."}
                      </td></tr>
                   )}
                 </tbody>
               </table>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">{bulkSelected.size} agrupados seleccionados</span>
              <div className="flex gap-3">
                <button disabled={bulkProcessing} onClick={() => setShowBulkModal(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-xl font-medium transition-colors border border-gray-300">Cancelar</button>
                <button disabled={bulkProcessing || bulkSelected.size === 0} onClick={executeBulkPromotion} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100">
                  {bulkProcessing && <Loader2 size={18} className="animate-spin" />}
                  Promover y Generar Planes
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulkStatusModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 text-white">
                <h3 className="font-bold text-lg">Cambiar Estatus Masivo</h3>
                <p className="text-indigo-100 text-sm">{mainTableSelected.size} alumnos seleccionados</p>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Nuevo Estatus</label>
                <select className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 mb-6" value={bulkStatusTarget} onChange={e => setBulkStatusTarget(e.target.value)}>
                  {catalogos?.estatus_alumnos?.length ? catalogos.estatus_alumnos.map(c => <option key={c} value={c}>{c}</option>) : (
                    <>
                      <option value="ACTIVO">ACTIVO</option>
                      <option value="BAJA">BAJA</option>
                      <option value="EGRESADO">EGRESADO</option>
                      <option value="TITULADO">TITULADO</option>
                    </>
                  )}
                </select>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowBulkStatusModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium">Cancelar</button>
                  <button onClick={executeBulkStatusChange} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-2 font-bold disabled:opacity-50">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                    Aplicar Cambios
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Genérico */}
      <AnimatePresence>
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{modalState.title}</h3>
              <p className="text-gray-600">{modalState.message}</p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              {modalState.type === 'confirm' && (
                <button onClick={() => setModalState({ ...modalState, isOpen: false })}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">
                  Cancelar
                </button>
              )}
              <button
                onClick={() => {
                  if (modalState.type === 'confirm' && modalState.onConfirm) modalState.onConfirm();
                  setModalState({ ...modalState, isOpen: false });
                }}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
                {modalState.type === 'confirm' ? 'Confirmar' : 'Aceptar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}
