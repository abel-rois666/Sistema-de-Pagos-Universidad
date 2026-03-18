import React, { useState } from 'react';
import { ArrowLeft, Plus, Edit2, Save, X, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { CicloEscolar } from '../types';
import { supabase } from '../lib/supabase';

interface CiclosConfigProps {
  ciclos: CicloEscolar[];
  onBack: () => void;
  onSave: (ciclos: CicloEscolar[]) => void;
}

export default function CiclosConfig({ ciclos: initialCiclos, onBack, onSave }: CiclosConfigProps) {
  const [ciclos, setCiclos] = useState<CicloEscolar[]>(initialCiclos);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CicloEscolar>>({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  // Valida que el id sea un UUID v4 real (no un id de mock como 'c1', 'c2')
  const isValidUUID = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const handleEdit = (ciclo: CicloEscolar) => {
    setEditingId(ciclo.id);
    setEditForm(ciclo);
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
        activo: editForm.activo || false
      };
      updatedCiclos = [...ciclos, cicloToSave];
    } else {
      const existing = ciclos.find(c => c.id === editingId)!;
      // Si el ID existente no es UUID válido (datos mock), asignar uno nuevo
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
    onSave(updatedCiclos);
    setEditingId(null);
    setSaving(false);
  };

  const handleAddNew = () => {
    const now = new Date();
    setEditingId('new');
    setEditForm({ nombre: '', meses_abarca: '', anio: now.getFullYear(), activo: false });
  };

  const handleSetActivo = async (id: string) => {
    const updated = ciclos.map(c => ({ ...c, activo: c.id === id }));
    setSaving(true);
    try {
      // Solo enviar a Supabase los ciclos con UUID válido (filtrar IDs de mock)
      const validForDB = updated
        .filter(c => isValidUUID(c.id))
        .map(c => ({ id: c.id, nombre: c.nombre, meses_abarca: c.meses_abarca, anio: c.anio, activo: c.activo }));

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
    onSave(updated);
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-black font-bold transition-colors">
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
          <button onClick={handleAddNew} disabled={editingId !== null || saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Nuevo Ciclo
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
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h1 className="text-2xl font-bold text-gray-800">Configuración de Ciclos Escolares</h1>
            <p className="text-gray-500 text-sm mt-1">Administra los periodos escolares y define cuál es el ciclo activo.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                  <th className="py-3 px-6 font-semibold">Nombre del Ciclo</th>
                  <th className="py-3 px-6 font-semibold">Meses que Abarca</th>
                  <th className="py-3 px-6 font-semibold">Año</th>
                  <th className="py-3 px-6 font-semibold text-center">Estado</th>
                  <th className="py-3 px-6 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editingId === 'new' && (
                  <tr className="bg-blue-50/50">
                    <td className="py-3 px-6">
                      <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Ej. 2026-1"
                        title="Formato: AÑO-PERIODO (ej. 2026-1, 2026-2, 2026-3)"
                        value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
                    </td>
                    <td className="py-3 px-6">
                      <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Ej. Enero - Abril"
                        value={editForm.meses_abarca || ''} onChange={e => setEditForm({ ...editForm, meses_abarca: e.target.value })} />
                    </td>
                    <td className="py-3 px-6">
                      <input type="number" className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        value={editForm.anio || ''} onChange={e => setEditForm({ ...editForm, anio: Number(e.target.value) })} />
                    </td>
                    <td className="py-3 px-6 text-center text-sm text-gray-500">Nuevo</td>
                    <td className="py-3 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleSave} disabled={saving} className="text-green-600 hover:bg-green-100 p-1 rounded"><Save size={18} /></button>
                        <button onClick={() => setEditingId(null)} className="text-red-600 hover:bg-red-100 p-1 rounded"><X size={18} /></button>
                      </div>
                    </td>
                  </tr>
                )}
                {ciclos.map(ciclo => (
                  <tr key={ciclo.id} className="hover:bg-gray-50 transition-colors">
                    {editingId === ciclo.id ? (
                      <>
                        <td className="py-3 px-6">
                          <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            placeholder="Ej. 2026-1" title="Formato: AÑO-PERIODO (ej. 2026-1, 2026-2)"
                            value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
                        </td>
                        <td className="py-3 px-6">
                          <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            value={editForm.meses_abarca || ''} onChange={e => setEditForm({ ...editForm, meses_abarca: e.target.value })} />
                        </td>
                        <td className="py-3 px-6">
                          <input type="number" className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            value={editForm.anio || ''} onChange={e => setEditForm({ ...editForm, anio: Number(e.target.value) })} />
                        </td>
                        <td className="py-3 px-6 text-center">
                          {ciclo.activo ? <span className="text-green-600 font-bold text-xs">ACTIVO</span> : '-'}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={handleSave} disabled={saving} className="text-green-600 hover:bg-green-100 p-1 rounded"><Save size={18} /></button>
                            <button onClick={() => setEditingId(null)} className="text-red-600 hover:bg-red-100 p-1 rounded"><X size={18} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-4 px-6 font-bold text-gray-800">{ciclo.nombre}</td>
                        <td className="py-4 px-6 text-gray-600">{ciclo.meses_abarca}</td>
                        <td className="py-4 px-6 text-gray-600">{ciclo.anio}</td>
                        <td className="py-4 px-6 text-center">
                          {ciclo.activo ? (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">ACTIVO</span>
                          ) : (
                            <button onClick={() => handleSetActivo(ciclo.id)} disabled={saving}
                              className="text-xs text-blue-600 hover:underline disabled:opacity-40">
                              Hacer Activo
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button onClick={() => handleEdit(ciclo)} className="text-gray-500 hover:text-blue-600 p-1 rounded transition-colors">
                            <Edit2 size={18} />
                          </button>
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
