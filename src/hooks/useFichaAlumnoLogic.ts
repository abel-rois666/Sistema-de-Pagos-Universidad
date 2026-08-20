import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { alumnosService } from '../services/alumnosService';
import { academicosService } from '../services/academicosService';
import { useAppStore } from '../store/useAppStore';
import type { Alumno, ServicioSocial } from '../types';

export type TabId = 'pagos' | 'datos_generales' | 'academico' | 'servicio_social' | 'certificacion' | 'titulacion';

export interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

export function useFichaAlumnoLogic(initialAlumnoId?: string | null, allTabs: TabDef[] = []) {
  const {
    currentUser,
    plans: allPlans,
    alumnos,
    catalogos,
    catalogoItems,
    appConfig,
    activeCicloId,
    refreshAfterPayment,
    carreras,
    ciclos,
  } = useAppStore();

  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const plans = allPlans.filter(p => p.ciclo_id === activeCicloId || p.ciclo_escolar === activeCiclo?.nombre);
  const onRefreshAlumnos = refreshAfterPayment;

  // Búsqueda
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(initialAlumnoId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Tab activo
  const [activeTab, setActiveTab] = useState<TabId>('pagos');

  // Plan activo (cuando hay múltiples)
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

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

  // Certificación — Estatus (Titulacion usa esto)
  const [certEstatus, setCertEstatus] = useState<'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO'>('SIN_INICIAR');
  const [isEditingEstatus, setIsEditingEstatus] = useState(false);
  const [tempEstatus, setTempEstatus] = useState('');
  const [guardandoEstatus, setGuardandoEstatus] = useState(false);

  const selectedAlumno = alumnos.find(a => a.id === selectedAlumnoId);

  useEffect(() => {
    if (selectedAlumno) {
      setTempEstatus(selectedAlumno.estatus || 'ACTIVO');
    }
  }, [selectedAlumno?.estatus, isEditingEstatus]);

  useEffect(() => {
    if (!selectedAlumnoId) {
      setCertEstatus('SIN_INICIAR');
      return;
    }
    academicosService.getCertificacionEstatusByAlumno(selectedAlumnoId)
      .then(res => {
        if (res.success && res.data) {
          setCertEstatus(res.data.tramite_completado ? 'COMPLETADO' : 'EN_CURSO');
        } else {
          setCertEstatus('SIN_INICIAR');
        }
      });
  }, [selectedAlumnoId]);

  // Resetear tab al cambiar de alumno
  useEffect(() => { 
    setActiveTab('pagos'); 
    setActivePlanId(null);
  }, [selectedAlumnoId]);

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
    if (t.adminOnly && !isAdmin) return false;
    if (currentUser?.rol === 'COORDINADOR FINANCIERO' && t.id === 'academico') return false;
    return true;
  });

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
    certEstatus, setCertEstatus,
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
