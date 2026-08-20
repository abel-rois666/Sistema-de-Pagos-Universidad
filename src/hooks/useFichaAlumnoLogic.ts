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

  const [certEstatus, setCertEstatus] = useState<'SIN_INICIAR'|'EN_CURSO'|'COMPLETADO'>('SIN_INICIAR');

  const [isEditingEstatus, setIsEditingEstatus] = useState(false);
  const [tempEstatus, setTempEstatus] = useState('');
  const [guardandoEstatus, setGuardandoEstatus] = useState(false);
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
  useEffect(() => { setActiveTab('pagos'); }, [selectedAlumnoId]);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const filteredAlumnos = alumnos.filter(a =>
    a.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const selectedAlumno = alumnos.find(a => a.id === selectedAlumnoId);
  const activePlan = selectedAlumno
    ? plans.find(p => p.alumno_id === selectedAlumno.id || p.nombre_alumno === selectedAlumno.nombre_completo)
    : null;

  const isAdmin = currentUser?.rol === 'ADMINISTRADOR';
  const isRestrictedRole = currentUser?.rol === 'CAJERO'
    || currentUser?.rol === 'COORDINADOR CONTROL ESCOLAR'
    || currentUser?.rol === 'COORDINADOR FINANCIERO'
    || currentUser?.rol === 'COORDINADOR RECURSOS HUMANOS'
    || currentUser?.rol === 'COORDINADOR ACADEMICO';

  // Tabs visibles según el rol del usuario
  const visibleTabs = allTabs.filter(t => !t.adminOnly || isAdmin);

  // Detectar si el alumno es de Especialidad (para TabTitulacion)
  const esEspecialidad = selectedAlumno
    ? (carreras.find(c => c.nombre === selectedAlumno.licenciatura)?.nivel_educativo === 'Especialidad')
    : false;

  // Todos los planes del alumno seleccionado (para auto-detectar pago titulación)
  const planesDelAlumno = plans.filter(p => p.alumno_id === selectedAlumno?.id || p.nombre_alumno === selectedAlumno?.nombre_completo);

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
    const res = await alumnosService.updateAlumno(selectedAlumno.id, { estatus: tempEstatus });
    setGuardandoEstatus(false);
    if (!res.success) { toast.error('Error al actualizar estatus: ' + res.error?.message); }
    else { onRefreshAlumnos?.(); setIsEditingEstatus(false); toast.success('Estatus actualizado'); }
  };

  // ── Monedero ──────────────────────────────────────────────────────────────
  const handleUpdateMonederoClick = () => {
    const v = parseFloat(tempMonedero);
    if (isNaN(v) || v < 0) { toast.error('Introduce una cantidad válida y mayor o igual a cero.'); return; }
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
