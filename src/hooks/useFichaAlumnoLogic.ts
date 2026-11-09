import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { alumnosService } from '../services/alumnosService';
import { academicosService } from '../services/academicosService';
import { useAppStore } from '../store/useAppStore';
import { useCicloModulo } from './useCicloModulo';
import type { Alumno, ServicioSocial } from '../types';

export type TabId = 'inscripciones' | 'pagos' | 'datos_generales' | 'academico' | 'servicio_social' | 'certificacion' | 'titulacion';

export interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

export function useFichaAlumnoLogic(initialAlumnoId?: string | null, allTabs: TabDef[] = [], initialTab: TabId = 'pagos') {
  const {
    currentUser,
    plans: allPlans,
    alumnos,
    catalogos,
    catalogoItems,
    appConfig,
    activeCicloId: cicloGlobalId,
    refreshAfterPayment,
    carreras,
    ciclos,
  } = useAppStore();

  const [cicloFichaId, setCicloFichaId] = useCicloModulo('ficha-alumno', ciclos, cicloGlobalId, currentUser?.id);
  const activeCicloId = cicloFichaId;
  const plans = allPlans.filter(p => p.ciclo_id === activeCicloId);
  const onRefreshAlumnos = refreshAfterPayment;

  // Búsqueda
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(initialAlumnoId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Tab activo
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Plan activo (cuando hay múltiples)
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  const cambiarCicloFicha = (id: string) => {
    setCicloFichaId(id);
    setActivePlanId(null);
  };

  // Monedero (admin)
  const [editingMonedero, setEditingMonedero] = useState(false);
  const [tempMonedero, setTempMonedero] = useState('');
  const [guardandoMonedero, setGuardandoMonedero] = useState(false);
  const [showConfirmMonedero, setShowConfirmMonedero] = useState(false);

  // Empresas SS — sincronizadas con el catálogo global
  const [empresasLocales, setEmpresasLocales] = useState<string[]>(catalogos?.empresas_ss ?? []);
  useEffect(() => { setEmpresasLocales(catalogos?.empresas_ss ?? []); }, [catalogos?.empresas_ss]);

  // Servicio Social — para auto-detectar en ficha titulación
  const [ssRegistros, setSsRegistros] = useState<ServicioSocial[]>([]);
  useEffect(() => {
    if (!selectedAlumnoId) return;
    academicosService.getServicioSocialByAlumno(selectedAlumnoId)
      .then((res) => { if (res.success) setSsRegistros(res.data as ServicioSocial[]); });
  }, [selectedAlumnoId]);

  // Edición del estatus institucional (independiente de la certificación).
  const [isEditingEstatus, setIsEditingEstatus] = useState(false);
  const [tempEstatus, setTempEstatus] = useState('');
  const [guardandoEstatus, setGuardandoEstatus] = useState(false);

  const selectedAlumno = alumnos.find(a => a.id === selectedAlumnoId);

  useEffect(() => {
    if (selectedAlumno) {
      setTempEstatus(selectedAlumno.estatus || 'ACTIVO');
    }
  }, [selectedAlumno?.estatus, isEditingEstatus]);

  // Resetear tab al cambiar de alumno
  useEffect(() => { 
    setActiveTab(initialTab);
    setActivePlanId(null);
  }, [selectedAlumnoId, initialTab]);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const filteredAlumnos = alumnos.filter(a =>
    a.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Todos los planes del alumno seleccionado
  const planesDelAlumno = plans.filter(p => p.alumno_id === selectedAlumno?.id || p.nombre_alumno === selectedAlumno?.nombre_completo);
  
  const activePlan = activePlanId 
    ? planesDelAlumno.find(p => p.id === activePlanId) || planesDelAlumno[0] || null
    : planesDelAlumno[0] || null;

  const isAdmin = currentUser?.rol === 'ADMINISTRADOR';
  const isRestrictedRole = currentUser?.rol === 'CAJERO'
    || currentUser?.rol === 'COORDINADOR CONTROL ESCOLAR'
    || currentUser?.rol === 'COORDINADOR FINANCIERO'
    || currentUser?.rol === 'COORDINADOR RECURSOS HUMANOS'
    || currentUser?.rol === 'COORDINADOR ACADEMICO';

  // Tabs visibles según el rol del usuario
  const visibleTabs = allTabs.filter(t => {
    if (t.id === 'certificacion') return ['ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR'].includes(currentUser?.rol || '');
    if (t.id === 'inscripciones' && !['ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR'].includes(currentUser?.rol || '')) return false;
    if (t.adminOnly && !isAdmin) return false;
    if (currentUser?.rol === 'COORDINADOR FINANCIERO' && t.id === 'academico') return false;
    return true;
  });
  useEffect(()=>{
    if(allTabs.length&&!visibleTabs.some(t=>t.id===activeTab))setActiveTab(visibleTabs.find(t=>t.id==='pagos')?.id||visibleTabs[0]?.id||'pagos');
  },[activeTab,currentUser?.rol,allTabs]);

  // Detectar si el alumno es de Especialidad (para TabTitulacion)
  const esEspecialidad = selectedAlumno
    ? (carreras.find(c => c.nombre === selectedAlumno.licenciatura)?.nivel_educativo === 'Especialidad')
    : false;

  // ── Handlers búsqueda ─────────────────────────────────────────────────────
  const handleSuggestionClick = (alumno: Alumno) => {
    setSelectedAlumnoId(alumno.id);
    setSearchTerm('');
    setShowSuggestions(false);
  };
  const handleClear = () => {
    setSelectedAlumnoId(null);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  // ── Edición de Estatus ────────────────────────────────────────────────────
  const handleSaveEstatus = async () => {
    if (!selectedAlumno) return;
    if (tempEstatus === selectedAlumno.estatus) {
      setIsEditingEstatus(false);
      return;
    }
    setGuardandoEstatus(true);
    const res = await alumnosService.updateAlumno(selectedAlumno.id, { estatus: tempEstatus as any });
    setGuardandoEstatus(false);
    if (!res.success) {
      toast.error('Error al actualizar estatus: ' + res.error?.message);
    } else {
      toast.success('Estatus actualizado correctamente');
      onRefreshAlumnos?.();
      setIsEditingEstatus(false);
    }
  };

  // ── Monedero ──────────────────────────────────────────────────────────────
  const handleUpdateMonederoClick = () => {
    if (!selectedAlumno) return;
    if (parseFloat(tempMonedero) === parseFloat((selectedAlumno.saldo_a_favor || 0).toString())) {
      setEditingMonedero(false);
      return;
    }
    if (parseFloat(tempMonedero) < 0 || isNaN(parseFloat(tempMonedero))) {
      toast.error('Cantidad inválida');
      return;
    }
    setShowConfirmMonedero(true);
  };

  const executeUpdateMonedero = async () => {
    if (!selectedAlumno) return;
    setGuardandoMonedero(true);
    const res = await alumnosService.updateAlumno(selectedAlumno.id, { saldo_a_favor: parseFloat(tempMonedero) });
    setGuardandoMonedero(false);
    if (!res.success) { toast.error('Error al actualizar monedero: ' + res.error?.message); setShowConfirmMonedero(false); }
    else { onRefreshAlumnos?.(); setEditingMonedero(false); setShowConfirmMonedero(false); }
  };

  return {
    // State
    selectedAlumnoId, setSelectedAlumnoId,
    searchTerm, setSearchTerm,
    showSuggestions, setShowSuggestions,
    activeTab, setActiveTab,
    activePlanId, setActivePlanId,
    editingMonedero, setEditingMonedero,
    tempMonedero, setTempMonedero,
    guardandoMonedero, setGuardandoMonedero,
    showConfirmMonedero, setShowConfirmMonedero,
    empresasLocales, setEmpresasLocales,
    ssRegistros, setSsRegistros,
    isEditingEstatus, setIsEditingEstatus,
    tempEstatus, setTempEstatus,
    guardandoEstatus, setGuardandoEstatus,

    // Derivados
    filteredAlumnos,
    selectedAlumno,
    activePlan,
    isAdmin,
    isRestrictedRole,
    visibleTabs,
    esEspecialidad,
    planesDelAlumno,
    ciclos,
    cicloFichaId: activeCicloId,
    cambiarCicloFicha,
    catalogos,
    onRefreshAlumnos,
    appConfig,
    catalogoItems,
    carreras,
    alumnos,

    // Handlers
    handleSuggestionClick,
    handleClear,
    handleSaveEstatus,
    handleUpdateMonederoClick,
    executeUpdateMonedero,
  };
}
