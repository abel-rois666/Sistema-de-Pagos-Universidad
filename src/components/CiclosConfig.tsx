import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Edit2, Save, X, CheckCircle, XCircle, Loader2, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { CicloEscolar } from '../types';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import ModalConfirmacion, { ModalConfirmacionProps } from './ui/ModalConfirmacion';

interface CiclosConfigProps {
  onBack: () => void;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const cicloNameCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
const formatCycleDate = (value?: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
  : 'Sin definir';

export default function CiclosConfig({ onBack }: CiclosConfigProps) {
  const { ciclos, setCiclos } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editorRef = useRef<HTMLFormElement>(null);
  const [editForm, setEditForm] = useState<Partial<CicloEscolar>>({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [sortField, setSortField] = useState<'nombre' | 'meses_abarca' | 'tipo_periodo' | 'anio' | 'fecha_inicio' | 'fecha_termino' | 'activo'>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ModalConfirmacionProps>({ isOpen: false, title: '', message: '', onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });

  useEffect(() => {
    if (editingId) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingId]);

  const handleSort = (field: typeof sortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown size={13} className="opacity-30 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp size={13} className="text-blue-500 ml-1 inline" />
      : <ArrowDown size={13} className="text-blue-500 ml-1 inline" />;
  };

  const sortedCiclos = useMemo(() => {
    return [...ciclos].sort((a, b) => {
      let valA: any;
      let valB: any;
      switch (sortField) {
        case 'nombre':       valA = a.nombre || ''; valB = b.nombre || ''; break;
        case 'meses_abarca': valA = a.meses_abarca || ''; valB = b.meses_abarca || ''; break;
        case 'tipo_periodo': valA = a.tipo_periodo || ''; valB = b.tipo_periodo || ''; break;
        case 'anio':         valA = a.anio || 0;   valB = b.anio || 0;   break;
        case 'fecha_inicio': valA = a.fecha_inicio || ''; valB = b.fecha_inicio || ''; break;
        case 'fecha_termino': valA = a.fecha_termino || ''; valB = b.fecha_termino || ''; break;
        case 'activo':       valA = a.activo ? 1 : 0; valB = b.activo ? 1 : 0; break;
        default:             valA = 0; valB = 0;
      }
      const comparison = sortField === 'nombre'
        ? cicloNameCollator.compare(valA, valB)
        : typeof valA === 'string' ? valA.localeCompare(valB) : valA - valB;
      if (comparison !== 0) return sortDir === 'asc' ? comparison : -comparison;

      const byName = cicloNameCollator.compare(a.nombre || '', b.nombre || '');
      if (byName !== 0) return -byName;
      const byType = (a.tipo_periodo || '').localeCompare(b.tipo_periodo || '');
      return byType || a.id.localeCompare(b.id);
    });
  }, [ciclos, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedCiclos.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const pageStart = (visiblePage - 1) * pageSize;
  const visibleCiclos = sortedCiclos.slice(pageStart, pageStart + pageSize);
  const allVisibleSelected = visibleCiclos.length > 0 && visibleCiclos.every(ciclo => selectedIds.includes(ciclo.id));

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const visibleIds = new Set(visibleCiclos.map(ciclo => ciclo.id));
    setSelectedIds(prev => e.target.checked
      ? [...new Set([...prev, ...visibleIds])]
      : prev.filter(id => !visibleIds.has(id)));
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  };

  const handleBulkDelete = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Ciclos',
      message: `¿Estás seguro de eliminar ${selectedIds.length} ciclos seleccionados? Esta acción es irreversible.`,
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setBulkSaving(true);
        try {
          const { error } = await supabase.from('ciclos_escolares').delete().in('id', selectedIds);
          if (error) throw error;
          setCiclos(ciclos.filter(c => !selectedIds.includes(c.id)));
          setSelectedIds([]);
          showNotification('success', `${selectedIds.length} ciclos eliminados exitosamente.`);
        } catch (err: any) {
          showNotification('error', `Error al eliminar: ${err.message}`);
        } finally {
          setBulkSaving(false);
        }
      }
    });
  };

  const handleBulkTypeChange = async (newType: string) => {
    if (!newType) return;
    setConfirmModal({
      isOpen: true,
      title: 'Cambiar Tipo de Periodo',
      message: `¿Cambiar el tipo a "${newType}" para los ${selectedIds.length} ciclos seleccionados?`,
      type: 'warning',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setBulkSaving(true);
        try {
          const { error } = await supabase.from('ciclos_escolares').update({ tipo_periodo: newType }).in('id', selectedIds);
          if (error) throw error;
          setCiclos(ciclos.map(c => selectedIds.includes(c.id) ? { ...c, tipo_periodo: newType } : c));
          setSelectedIds([]);
          showNotification('success', `Tipo actualizado en ${selectedIds.length} ciclos.`);
        } catch (err: any) {
          showNotification('error', `Error al actualizar: ${err.message}`);
        } finally {
          setBulkSaving(false);
        }
      }
    });
  };

  // Valida que el id sea un UUID v4 real (no un id de mock como 'c1', 'c2')
  const isValidUUID = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncGES = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('http://localhost:3001/api/legacy/ciclos');
      if (!response.ok) throw new Error('Error al conectar con GES 4');
      const dataGES = await response.json();

      if (!dataGES || dataGES.length === 0) {
        showNotification('error', 'No se encontraron ciclos en GES 4.');
        setIsSyncing(false);
        return;
      }

      // Construir mapa de pares únicos (nombre + tipo_periodo) para evitar duplicados
      // al procesar el mismo ciclo GES que puede venir 2 veces con distintos tipos
      const gesMap = new Map<string, any>();

      dataGES.forEach((row: any) => {
        const descRaw = (row.descripcion || '').toUpperCase();
        
        // La descripción tiene la verdad absoluta (ej: "2020-1 SEMESTRE 1 2020" o "2020-3 CUATRIMESTRE 3")
        let formattedName = row.nombre_formateado;
        if (descRaw) {
          formattedName = descRaw.split(' ')[0];
        }
        if (!formattedName) return;

        let tipo = 'Semestral';
        if (descRaw) {
          if (descRaw.includes('CUATRIMEST')) tipo = 'Cuatrimestral';
          else if (descRaw.includes('SEMEST')) tipo = 'Semestral';
        } else {
          // Fallback a denom_periodo si por alguna razón no hay descripción
          const denomStr = (row.denom_periodo || '').toLowerCase();
          if (denomStr.includes('cuatrimest')) tipo = 'Cuatrimestral';
        }

        const mesesStr = (() => {
          let s = '', e = '';
          if (row.fecha_inicial) { const d = new Date(row.fecha_inicial); if (!isNaN(d.getTime())) s = MONTHS[d.getMonth()]; }
          if (row.fecha_final)   { const d = new Date(row.fecha_final);   if (!isNaN(d.getTime())) e = MONTHS[d.getMonth()]; }
          return s && e ? `${s} - ${e}` : 'Enero - Abril';
        })();

        const anioInicio = Number(row.inicial) || new Date().getFullYear();
        const anioFin: number | null = (row.final && Number(row.final) !== anioInicio) ? Number(row.final) : null;

        // Clave única: nombre + tipo_periodo (garantiza que "2020-1 Semestral" y "2020-1 Cuatrimestral" sean registros DISTINTOS)
        const key = `${formattedName}||${tipo}`;
        if (!gesMap.has(key)) {
          gesMap.set(key, { formattedName, tipo, mesesStr, anioInicio, anioFin });
        }
      });

      // Construir el array de upsert, buscando si ya existe en Supabase
      const upsertData: any[] = [];
      const newCiclosList = [...ciclos];

      gesMap.forEach(({ formattedName, tipo, mesesStr, anioInicio, anioFin }) => {
        const existingIdx = newCiclosList.findIndex(c => c.nombre === formattedName && c.tipo_periodo === tipo);
        let targetId: string = crypto.randomUUID();
        let isActive = false;
        let fechaInicio: string | null = null;
        let fechaTermino: string | null = null;

        if (existingIdx >= 0) {
          const existing = newCiclosList[existingIdx];
          targetId = isValidUUID(existing.id) ? existing.id : crypto.randomUUID();
          isActive = existing.activo;
          fechaInicio = existing.fecha_inicio || null;
          fechaTermino = existing.fecha_termino || null;
          newCiclosList[existingIdx] = { ...existing, id: targetId, meses_abarca: mesesStr, anio: anioInicio, anio_fin: anioFin };
        } else {
          newCiclosList.push({ id: targetId, nombre: formattedName, meses_abarca: mesesStr, anio: anioInicio, anio_fin: anioFin, tipo_periodo: tipo, activo: false });
        }

        upsertData.push({ id: targetId, nombre: formattedName, meses_abarca: mesesStr, anio: anioInicio, anio_fin: anioFin, tipo_periodo: tipo, activo: isActive, fecha_inicio: fechaInicio, fecha_termino: fechaTermino });
      });

      if (upsertData.length > 0) {
        // onConflict: 'nombre,tipo_periodo' requiere el unique constraint en Supabase.
        // Si no tienes el constraint, usa solo .upsert(upsertData) (sin onConflict).
        const { error } = await supabase.from('ciclos_escolares').upsert(upsertData, {
          onConflict: 'nombre,tipo_periodo',
          ignoreDuplicates: false
        });
        if (error) throw error;
      }

      setCiclos(newCiclosList);
      showNotification('success', `Se sincronizaron ${upsertData.length} ciclos exitosamente desde GES 4.`);


    } catch (error: any) {
      console.warn('[handleSyncGES]', error.message);
      showNotification('error', `Error en sincronización: ${error.message}`);
    }
    setIsSyncing(false);
  };

  const handleEdit = (ciclo: CicloEscolar) => {
    setEditingId(ciclo.id);
    setEditForm(ciclo);
  };

  const handleDelete = async (ciclo: CicloEscolar) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Ciclo',
      message: `¿Estás seguro de que deseas eliminar el ciclo ${ciclo.nombre}? Esta acción no se puede deshacer.`,
      type: 'danger',
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setSaving(true);
        
        try {
          if (isValidUUID(ciclo.id)) {
            const { error } = await supabase.from('ciclos_escolares').delete().eq('id', ciclo.id);
            if (error) throw error;
          }
          
          const updated = ciclos.filter(c => c.id !== ciclo.id);
          setCiclos(updated);
          showNotification('success', 'Ciclo eliminado correctamente.');
        } catch (error: any) {
          console.warn('[CiclosConfig] delete error:', error.message);
          showNotification('error', `Error al eliminar: ${error.message}`);
        }
        
        setSaving(false);
      }
    });
  };

  const handleSave = async () => {
    if (!editForm.nombre || !editForm.meses_abarca || !editForm.anio) {
      showNotification('error', 'Completa el nombre, los meses y el año del ciclo.');
      return;
    }
    const fechaInicio = editForm.fecha_inicio?.trim() || null;
    const fechaTermino = editForm.fecha_termino?.trim() || null;
    if (fechaInicio && fechaTermino && fechaTermino < fechaInicio) {
      showNotification('error', 'La fecha de término no puede ser anterior a la fecha de inicio.');
      return;
    }
    setSaving(true);

    let updatedCiclos: CicloEscolar[];
    let cicloToSave: CicloEscolar;

    if (editingId === 'new') {
      cicloToSave = {
        id: crypto.randomUUID(),
        nombre: editForm.nombre,
        meses_abarca: editForm.meses_abarca,
        anio: Number(editForm.anio),
        anio_fin: editForm.anio_fin ? Number(editForm.anio_fin) : null,
        tipo_periodo: editForm.tipo_periodo || 'Semestral',
        activo: editForm.activo || false,
        fecha_inicio: fechaInicio || undefined,
        fecha_termino: fechaTermino || undefined,
      };
      updatedCiclos = [...ciclos, cicloToSave];
    } else {
      const existing = ciclos.find(c => c.id === editingId)!;
      const safeId = isValidUUID(existing.id) ? existing.id : crypto.randomUUID();
      cicloToSave = { ...existing, ...editForm, id: safeId, fecha_inicio: fechaInicio || undefined, fecha_termino: fechaTermino || undefined } as CicloEscolar;
      updatedCiclos = ciclos.map(c => c.id === editingId ? cicloToSave : c);
    }

    try {
      const { error } = await supabase.from('ciclos_escolares').upsert({
        id: cicloToSave.id,
        nombre: cicloToSave.nombre,
        meses_abarca: cicloToSave.meses_abarca,
        anio: cicloToSave.anio,
        anio_fin: cicloToSave.anio_fin ?? null,
        tipo_periodo: cicloToSave.tipo_periodo ?? null,
        activo: cicloToSave.activo,
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino,
      });
      if (error) throw error;
      setCiclos(updatedCiclos);
      setEditingId(null);
      showNotification('success', 'Ciclo guardado correctamente.');
    } catch (error: any) {
      console.warn('[CiclosConfig] upsert error:', error);
      showNotification('error', `No se pudo guardar el ciclo: ${error.message || 'error de conexión'}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = () => {
    const now = new Date();
    setEditingId('new');
    setEditForm({ nombre: '', meses_abarca: 'Enero - Abril', anio: now.getFullYear(), anio_fin: null, tipo_periodo: 'Semestral', activo: false, fecha_inicio: '', fecha_termino: '' });
  };

  const handleSetActivo = async (id: string) => {
    const updated = ciclos.map(c => ({ ...c, activo: c.id === id }));
    setSaving(true);
    try {
      const validForDB = updated
        .filter(c => isValidUUID(c.id))
        .map(c => ({ id: c.id, nombre: c.nombre, meses_abarca: c.meses_abarca, anio: c.anio, anio_fin: c.anio_fin ?? null, tipo_periodo: c.tipo_periodo ?? null, activo: c.activo, fecha_inicio: c.fecha_inicio || null, fecha_termino: c.fecha_termino || null }));

      if (validForDB.length > 0) {
        const { error } = await supabase.from('ciclos_escolares').upsert(validForDB);
        if (error) {
          showNotification('error', `Error al actualizar ciclo activo: ${error.message}`);
        } else {
          showNotification('success', 'Ciclo activo actualizado.');
        }
      } else {
        showNotification('success', 'Ciclo activo actualizado (local).');
      }
    } catch {
      showNotification('error', 'No se pudo conectar con la base de datos.');
    }
    setCiclos(updated);
    setSaving(false);
  };

  const renderMonthSelectors = () => {
    const parts = (editForm.meses_abarca || 'Enero - Abril').split(' - ');
    const start = parts[0] || 'Enero';
    const end = parts[1] || 'Abril';
    return (
      <div className="flex items-center gap-2">
        <select aria-label="Mes inicial" className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-[#222222] dark:text-gray-100 outline-none focus:border-blue-500"
          value={start} 
          onChange={e => setEditForm({ ...editForm, meses_abarca: `${e.target.value} - ${end}` })}>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-[#8e8e93] font-bold">-</span>
        <select aria-label="Mes final" className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-[#222222] dark:text-gray-100 outline-none focus:border-blue-500"
          value={end} 
          onChange={e => setEditForm({ ...editForm, meses_abarca: `${start} - ${e.target.value}` })}>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    );
  };
  const renderYearFields = () => (
    <div className="flex items-center gap-1">
      <input
        type="number"
        className="w-20 border border-blue-300 dark:border-blue-700 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6]"
        placeholder="Inicio"
        aria-label="Año de inicio"
        value={editForm.anio || ''}
        onChange={e => setEditForm({ ...editForm, anio: Number(e.target.value) })}
        title="Año de inicio"
      />
      <span className="text-[#8e8e93] text-xs font-bold">–</span>
      <input
        type="number"
        className="w-20 border border-blue-300 dark:border-blue-700 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6]"
        placeholder="Fin"
        aria-label="Año de fin"
        value={editForm.anio_fin || ''}
        onChange={e => setEditForm({ ...editForm, anio_fin: e.target.value ? Number(e.target.value) : null })}
        title="Año de fin (opcional si el ciclo cruza de año)"
      />
      
    </div>
  );

  const renderDateInput = (field: 'fecha_inicio' | 'fecha_termino', label: string) => (
    <input
      type="date"
      aria-label={label}
      title={`${label} (opcional)`}
      value={editForm[field] || ''}
      onChange={e => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
      className="w-full min-w-0 max-w-full rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-[#222222] dark:text-gray-100 dark:[color-scheme:dark] outline-none focus:ring-2 focus:ring-[#3b82f6]"
    />
  );

  return (
    <div className="min-h-screen bg-[#f2f3f5] dark:bg-gray-950 p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-[#45515e] dark:text-[#8e8e93] hover:text-black dark:hover:text-white font-bold transition-colors">
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleSyncGES} disabled={isSyncing || saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-[8px] font-medium disabled:opacity-50 shadow-sm">
              {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Sincronizar GES 4
            </button>
            <button onClick={handleAddNew} disabled={editingId !== null || saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-[8px] font-medium disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Nuevo Ciclo
            </button>
          </div>
        </div>

        {notification && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-[13px] text-sm font-semibold shadow-[var(--shadow-subtle)]
            ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {notification.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {notification.msg}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#e5e7eb] dark:border-gray-800 overflow-hidden transition-colors">
          <div className="p-6 border-b border-[#f2f3f5] dark:border-gray-800 bg-[#f2f3f5] dark:bg-gray-800/50">
            <h1 className="text-2xl font-bold text-[#222222] dark:text-gray-100">Configuración de Ciclos Escolares</h1>
            <p className="text-[#8e8e93] dark:text-[#8e8e93] text-sm mt-1">Administra los periodos escolares y define cuál es el ciclo activo.</p>
          </div>

          {editingId && (
            <form ref={editorRef} onSubmit={e => { e.preventDefault(); if (!saving) void handleSave(); }} className="scroll-mt-24 border-b border-blue-200 bg-blue-50/70 px-4 py-5 dark:border-blue-900/50 dark:bg-blue-950/30 sm:px-6">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100">
                    {editingId === 'new' ? 'Nuevo ciclo escolar' : `Editar ciclo ${ciclos.find(c => c.id === editingId)?.nombre || ''}`}
                  </h2>
                  <p className="mt-1 text-sm text-[#45515e] dark:text-gray-400">Completa los datos y guarda los cambios del ciclo.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-900">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar ciclo
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#45515e] hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                    <X size={16} /> Cancelar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className="min-w-0 space-y-1.5 text-sm font-semibold text-[#45515e] dark:text-gray-300">
                  <span>Nombre del ciclo</span>
                  <input type="text" required className="w-full min-w-0 rounded-lg border border-blue-300 bg-white px-3 py-2 font-normal text-[#222222] uppercase outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100" placeholder="Ej. 2028-1"
                    value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value.toUpperCase() })} />
                </label>
                <div className="min-w-0 space-y-1.5 text-sm font-semibold text-[#45515e] dark:text-gray-300">
                  <span>Meses que abarca</span>
                  {renderMonthSelectors()}
                </div>
                <label className="min-w-0 space-y-1.5 text-sm font-semibold text-[#45515e] dark:text-gray-300">
                  <span>Tipo de periodo</span>
                  <select className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-[#222222] outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    value={editForm.tipo_periodo || 'Semestral'} onChange={e => setEditForm({ ...editForm, tipo_periodo: e.target.value })}>
                    <option value="Semestral">Semestral</option>
                    <option value="Cuatrimestral">Cuatrimestral</option>
                    <option value="Modular">Modular</option>
                    <option value="Otro">Otro</option>
                  </select>
                </label>
                <div className="min-w-0 space-y-1.5 text-sm font-semibold text-[#45515e] dark:text-gray-300">
                  <span>Año(s)</span>
                  {renderYearFields()}
                </div>
                <label className="min-w-0 space-y-1.5 text-sm font-semibold text-[#45515e] dark:text-gray-300">
                  <span>Fecha de inicio</span>
                  {renderDateInput('fecha_inicio', 'Fecha de inicio')}
                </label>
                <label className="min-w-0 space-y-1.5 text-sm font-semibold text-[#45515e] dark:text-gray-300">
                  <span>Fecha de término</span>
                  {renderDateInput('fecha_termino', 'Fecha de término')}
                </label>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-blue-200 pt-4 dark:border-blue-900/50 lg:hidden">
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar ciclo
                </button>
                <button type="button" onClick={() => setEditingId(null)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#45515e] hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <X size={16} /> Cancelar
                </button>
              </div>
            </form>
          )}

          {selectedIds.length > 0 && (
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between transition-all">
              <span className="text-blue-800 font-semibold text-sm">{selectedIds.length} ciclos seleccionados</span>
              <div className="flex items-center gap-3">
                <select 
                  className="border border-blue-200 rounded px-3 py-1.5 text-sm text-blue-800 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={e => { handleBulkTypeChange(e.target.value); e.target.value = ''; }}
                  defaultValue=""
                  disabled={bulkSaving || editingId !== null}
                >
                  <option value="" disabled>Cambiar Tipo a...</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Cuatrimestral">Cuatrimestral</option>
                  <option value="Modular">Modular</option>
                </select>
                <button onClick={handleBulkDelete} disabled={bulkSaving || editingId !== null} className="flex items-center gap-1.5 text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-[8px] text-sm font-semibold transition-colors disabled:opacity-50">
                  {bulkSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Eliminar
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1180px]">
              <thead>
                <tr className="bg-gray-100 dark:bg-[#1c2228] text-[#45515e] dark:text-[#8e8e93] text-sm uppercase tracking-wider">
                  <th className="py-3 px-6 w-12 text-center border-r border-gray-200 dark:border-gray-700">
                    <input type="checkbox" aria-label="Seleccionar ciclos de esta página" onChange={handleSelectAll} checked={allVisibleSelected} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  </th>
                  <th className="py-3 px-6 font-semibold cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleSort('nombre')}>
                    Nombre del Ciclo <SortIcon field="nombre" />
                  </th>
                  <th className="py-3 px-6 font-semibold min-w-[220px] cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleSort('meses_abarca')}>
                    Meses que Abarca <SortIcon field="meses_abarca" />
                  </th>
                  <th className="py-3 px-6 font-semibold cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleSort('tipo_periodo')}>
                    Tipo <SortIcon field="tipo_periodo" />
                  </th>
                  <th className="py-3 px-6 font-semibold min-w-[140px] cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleSort('anio')}>
                    Año(s) <SortIcon field="anio" />
                  </th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleSort('fecha_inicio')}>
                    Fecha de inicio <SortIcon field="fecha_inicio" />
                  </th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleSort('fecha_termino')}>
                    Fecha de término <SortIcon field="fecha_termino" />
                  </th>
                  <th className="py-3 px-6 font-semibold text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleSort('activo')}>
                    Estado <SortIcon field="activo" />
                  </th>
                  <th className="py-3 px-6 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visibleCiclos.map(ciclo => (
                  <tr key={ciclo.id} className={`${editingId === ciclo.id ? 'bg-blue-50/70 dark:bg-blue-900/20' : selectedIds.includes(ciclo.id) ? 'bg-blue-50/40 dark:bg-blue-900/10' : 'hover:bg-[#f2f3f5] dark:hover:bg-gray-800/50'} transition-colors`}>
                        <td className="py-4 px-6 text-center border-r border-gray-100 dark:border-gray-800">
                          <input type="checkbox" checked={selectedIds.includes(ciclo.id)} onChange={e => handleSelect(ciclo.id, e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                        </td>
                        <td className="py-4 px-6 font-bold text-[#222222] dark:text-gray-100">{ciclo.nombre}</td>
                        <td className="py-4 px-6 text-[#45515e] dark:text-[#8e8e93] font-medium">
                          <span className="bg-gray-100 dark:bg-[#1c2228] px-3 py-1 rounded-full text-xs text-[#45515e] dark:text-gray-300 inline-block shadow-[var(--shadow-subtle)]">
                            {ciclo.meses_abarca}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-[#45515e] dark:text-[#8e8e93] font-semibold text-sm">
                          {ciclo.tipo_periodo || 'No definido'}
                        </td>
                        <td className="py-4 px-6 text-[#45515e] dark:text-[#8e8e93] font-semibold">
                          {ciclo.anio_fin && ciclo.anio_fin !== ciclo.anio
                            ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{ciclo.anio} – {ciclo.anio_fin}</span>
                            : ciclo.anio
                          }
                        </td>
                        <td className="py-4 px-4 text-sm tabular-nums whitespace-nowrap text-[#45515e] dark:text-gray-300">{formatCycleDate(ciclo.fecha_inicio)}</td>
                        <td className="py-4 px-4 text-sm tabular-nums whitespace-nowrap text-[#45515e] dark:text-gray-300">{formatCycleDate(ciclo.fecha_termino)}</td>
                        <td className="py-4 px-6 text-center">
                          {ciclo.activo ? (
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold shadow-[var(--shadow-subtle)]">ACTIVO</span>
                          ) : (
                            <button onClick={() => handleSetActivo(ciclo.id)} disabled={saving || editingId !== null}
                              className="text-xs text-blue-600 hover:bg-[rgba(0,0,0,0.03)] px-3 py-1 rounded-full font-bold transition-colors disabled:opacity-40 border border-transparent hover:border-blue-200">
                              Hacer Activo
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleEdit(ciclo)} disabled={editingId !== null || saving} className="text-blue-500 hover:bg-[rgba(0,0,0,0.03)] p-1.5 rounded-[8px] transition-colors border border-transparent hover:border-blue-100 disabled:opacity-40" title="Editar">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(ciclo)} disabled={saving || editingId !== null} className="text-red-500 hover:bg-red-50 p-1.5 rounded-[8px] transition-colors border border-transparent hover:border-red-100 disabled:opacity-40" title="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 text-sm text-[#45515e] dark:border-gray-800 dark:text-gray-300 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <span>Mostrando {sortedCiclos.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + pageSize, sortedCiclos.length)} de {sortedCiclos.length} ciclos</span>
              <label className="flex items-center gap-2">
                Filas por página
                <select
                  aria-label="Filas por página"
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[#222222] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>
            <nav aria-label="Paginación de ciclos escolares" className="flex items-center gap-2">
              <button type="button" onClick={() => setCurrentPage(visiblePage - 1)} disabled={visiblePage === 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-[#45515e] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                Anterior
              </button>
              <span className="whitespace-nowrap px-1">Página {visiblePage} de {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage(visiblePage + 1)} disabled={visiblePage === totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-[#45515e] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                Siguiente
              </button>
            </nav>
          </div>
        </div>
        <ModalConfirmacion {...confirmModal} />
      </div>
    </div>
  );
}
