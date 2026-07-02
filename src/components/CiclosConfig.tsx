import React, { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Edit2, Save, X, CheckCircle, XCircle, Loader2, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { CicloEscolar } from '../types';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

interface CiclosConfigProps {
  onBack: () => void;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CiclosConfig({ onBack }: CiclosConfigProps) {
  const { ciclos, setCiclos } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CicloEscolar>>({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [sortField, setSortField] = useState<'nombre' | 'meses_abarca' | 'tipo_periodo' | 'anio' | 'activo'>('anio');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: typeof sortField) => {
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
        case 'activo':       valA = a.activo ? 1 : 0; valB = b.activo ? 1 : 0; break;
        default:             valA = 0; valB = 0;
      }
      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
  }, [ciclos, sortField, sortDir]);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
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
        const formattedName = row.nombre_formateado;
        if (!formattedName) return;

        const denomStr = (row.denom_periodo || '').toLowerCase();
        let tipo = 'Semestral';
        if (denomStr.includes('cuatrimest')) tipo = 'Cuatrimestral';
        else if (denomStr.includes('semest')) tipo = 'Semestral';

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

        if (existingIdx >= 0) {
          const existing = newCiclosList[existingIdx];
          targetId = isValidUUID(existing.id) ? existing.id : crypto.randomUUID();
          isActive = existing.activo;
          newCiclosList[existingIdx] = { ...existing, id: targetId, meses_abarca: mesesStr, anio: anioInicio, anio_fin: anioFin };
        } else {
          newCiclosList.push({ id: targetId, nombre: formattedName, meses_abarca: mesesStr, anio: anioInicio, anio_fin: anioFin, tipo_periodo: tipo, activo: false });
        }

        upsertData.push({ id: targetId, nombre: formattedName, meses_abarca: mesesStr, anio: anioInicio, anio_fin: anioFin, tipo_periodo: tipo, activo: isActive });
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
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el ciclo ${ciclo.nombre}? Esta acción no se puede deshacer.`)) return;
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
  };

  const handleSave = async () => {
    if (!editForm.nombre || !editForm.meses_abarca || !editForm.anio) return;
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
        activo: editForm.activo || false
      };
      updatedCiclos = [...ciclos, cicloToSave];
    } else {
      const existing = ciclos.find(c => c.id === editingId)!;
      const safeId = isValidUUID(existing.id) ? existing.id : crypto.randomUUID();
      cicloToSave = { ...existing, ...editForm, id: safeId } as CicloEscolar;
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
      });
      if (error) {
        console.warn('[CiclosConfig] upsert error:', error.message);
        showNotification('error', `Error al guardar en BD: ${error.message}`);
      } else {
        showNotification('success', 'Ciclo guardado correctamente.');
      }
    } catch {
      showNotification('error', 'No se pudo conectar con la base de datos.');
    }

    setCiclos(updatedCiclos);
    setEditingId(null);
    setSaving(false);
  };

  const handleAddNew = () => {
    const now = new Date();
    setEditingId('new');
    setEditForm({ nombre: '', meses_abarca: 'Enero - Abril', anio: now.getFullYear(), anio_fin: null, tipo_periodo: 'Semestral', activo: false });
  };

  const handleSetActivo = async (id: string) => {
    const updated = ciclos.map(c => ({ ...c, activo: c.id === id }));
    setSaving(true);
    try {
      const validForDB = updated
        .filter(c => isValidUUID(c.id))
        .map(c => ({ id: c.id, nombre: c.nombre, meses_abarca: c.meses_abarca, anio: c.anio, anio_fin: c.anio_fin ?? null, tipo_periodo: c.tipo_periodo ?? null, activo: c.activo }));

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
        <select className="flex-1 w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500" 
          value={start} 
          onChange={e => setEditForm({ ...editForm, meses_abarca: `${e.target.value} - ${end}` })}>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-[#8e8e93] font-bold">-</span>
        <select className="flex-1 w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500" 
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
        className="w-20 border border-blue-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#3b82f6]"
        placeholder="Inicio"
        value={editForm.anio || ''}
        onChange={e => setEditForm({ ...editForm, anio: Number(e.target.value) })}
        title="Año de inicio"
      />
      <span className="text-[#8e8e93] text-xs font-bold">–</span>
      <input
        type="number"
        className="w-20 border border-blue-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#3b82f6]"
        placeholder="Fin"
        value={editForm.anio_fin || ''}
        onChange={e => setEditForm({ ...editForm, anio_fin: e.target.value ? Number(e.target.value) : null })}
        title="Año de fin (opcional si el ciclo cruza de año)"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f2f3f5] dark:bg-gray-950 p-8 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-[#45515e] dark:text-[#8e8e93] hover:text-black dark:hover:text-white font-bold transition-colors">
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
          <div className="flex gap-3">
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

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-100 dark:bg-[#1c2228] text-[#45515e] dark:text-[#8e8e93] text-sm uppercase tracking-wider">
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
                  <th className="py-3 px-6 font-semibold text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleSort('activo')}>
                    Estado <SortIcon field="activo" />
                  </th>
                  <th className="py-3 px-6 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {editingId === 'new' && (
                  <tr className="bg-blue-50/50 dark:bg-blue-900/20">
                    <td className="py-3 px-6">
                      <input type="text" className="w-full border border-blue-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#3b82f6] uppercase" placeholder="Ej. 26/1"
                        title="Formato Libre"
                        value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value.toUpperCase() })} />
                    </td>
                    <td className="py-3 px-6">
                      {renderMonthSelectors()}
                    </td>
                    <td className="py-3 px-6">
                      <select 
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                        value={editForm.tipo_periodo || 'Semestral'}
                        onChange={e => setEditForm({ ...editForm, tipo_periodo: e.target.value })}
                      >
                        <option value="Semestral">Semestral</option>
                        <option value="Cuatrimestral">Cuatrimestral</option>
                        <option value="Modular">Modular</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </td>
                    <td className="py-3 px-6">
                      {renderYearFields()}
                    </td>
                    <td className="py-3 px-6 text-center text-sm text-[#8e8e93] font-medium">Nuevo</td>
                    <td className="py-3 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleSave} disabled={saving} className="text-green-600 hover:bg-green-100 p-1 rounded" title="Guardar"><Save size={18} /></button>
                        <button onClick={() => setEditingId(null)} className="text-red-600 hover:bg-red-100 p-1 rounded" title="Cancelar"><X size={18} /></button>
                      </div>
                    </td>
                  </tr>
                )}
                {sortedCiclos.map(ciclo => (
                  <tr key={ciclo.id} className="hover:bg-[#f2f3f5] dark:hover:bg-gray-800/50 transition-colors">
                    {editingId === ciclo.id ? (
                      <>
                        <td className="py-3 px-6">
                          <input type="text" className="w-full border border-blue-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#3b82f6] uppercase"
                            placeholder="Ej. 26/1"
                            value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value.toUpperCase() })} />
                        </td>
                        <td className="py-3 px-6">
                          {renderMonthSelectors()}
                        </td>
                        <td className="py-3 px-6">
                          <select 
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                            value={editForm.tipo_periodo || 'Semestral'}
                            onChange={e => setEditForm({ ...editForm, tipo_periodo: e.target.value })}
                          >
                            <option value="Semestral">Semestral</option>
                            <option value="Cuatrimestral">Cuatrimestral</option>
                            <option value="Modular">Modular</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </td>
                        <td className="py-3 px-6">
                          {renderYearFields()}
                        </td>
                        <td className="py-3 px-6 text-center">
                          {ciclo.activo ? <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">ACTIVO</span> : '-'}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={handleSave} disabled={saving} className="text-green-600 hover:bg-green-100 p-1.5 rounded" title="Guardar"><Save size={18} /></button>
                            <button onClick={() => setEditingId(null)} className="text-red-600 hover:bg-red-100 p-1.5 rounded" title="Cancelar"><X size={18} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
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
                        <td className="py-4 px-6 text-center">
                          {ciclo.activo ? (
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold shadow-[var(--shadow-subtle)]">ACTIVO</span>
                          ) : (
                            <button onClick={() => handleSetActivo(ciclo.id)} disabled={saving}
                              className="text-xs text-blue-600 hover:bg-[rgba(0,0,0,0.03)] px-3 py-1 rounded-full font-bold transition-colors disabled:opacity-40 border border-transparent hover:border-blue-200">
                              Hacer Activo
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleEdit(ciclo)} className="text-blue-500 hover:bg-[rgba(0,0,0,0.03)] p-1.5 rounded-[8px] transition-colors border border-transparent hover:border-blue-100" title="Editar">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(ciclo)} disabled={saving} className="text-red-500 hover:bg-red-50 p-1.5 rounded-[8px] transition-colors border border-transparent hover:border-red-100 disabled:opacity-40" title="Eliminar">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
