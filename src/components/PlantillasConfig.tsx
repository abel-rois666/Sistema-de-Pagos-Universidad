import React, { useState } from 'react';
import { ArrowLeft, Search, Plus, Save, X, Trash2, Copy, Loader2, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';
import { supabase, savePlantilla, deletePlantilla } from '../lib/supabase';
import { PlantillaPlan, CicloEscolar, Catalogos } from '../types';
import { toInputDate } from '../utils';

interface PlantillasConfigProps {
  plantillas: PlantillaPlan[];
  ciclos: CicloEscolar[];
  catalogos: Catalogos;
  onSave: (plantillas: PlantillaPlan[]) => void;
  onBack: () => void;
}

export default function PlantillasConfig({ plantillas, ciclos, catalogos, onSave, onBack }: PlantillasConfigProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlantillaPlan>>({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredPlantillas = plantillas.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.descripcion && p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getCicloName = (id: string | null) => ciclos.find(c => c.id === id)?.nombre || 'Sin ciclo';

  const handleAddNew = () => {
    setEditingId('new');
    setEditForm({
      nombre: '',
      ciclo_id: ciclos.find(c => c.activo)?.id || ciclos[0]?.id || null,
      tipo_plan: 'Cuatrimestral',
      activo: true,
      descripcion: ''
    });
  };

  const handleEdit = (plantilla: PlantillaPlan) => {
    setEditingId(plantilla.id);
    setEditForm(plantilla);
  };

  const handleDuplicate = async (plantilla: PlantillaPlan) => {
    setSaving(true);
    const newPlantilla: PlantillaPlan = {
      ...plantilla,
      id: crypto.randomUUID(),
      nombre: `${plantilla.nombre} (Copia)`
    };
    
    const error = await savePlantilla(newPlantilla);
    if (error) {
      showNotification('error', `Error al duplicar: ${error}`);
    } else {
      showNotification('success', 'Plantilla duplicada.');
      onSave([...plantillas, newPlantilla]);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;
    setSaving(true);
    const error = await deletePlantilla(id);
    if (error) {
      showNotification('error', `Error al eliminar: ${error}`);
    } else {
      showNotification('success', 'Plantilla eliminada.');
      onSave(plantillas.filter(p => p.id !== id));
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!editForm.nombre) {
      showNotification('error', 'El nombre es obligatorio');
      return;
    }

    setSaving(true);
    let plantillaToSave: PlantillaPlan;
    let updatedPlantillas: PlantillaPlan[];

    if (editingId === 'new') {
      plantillaToSave = {
        ...editForm,
        id: crypto.randomUUID(),
        nombre: editForm.nombre!,
        ciclo_id: editForm.ciclo_id || null,
        tipo_plan: editForm.tipo_plan || 'Cuatrimestral',
        activo: editForm.activo !== undefined ? editForm.activo : true,
      } as PlantillaPlan;
      updatedPlantillas = [...plantillas, plantillaToSave];
    } else {
      plantillaToSave = { ...plantillas.find(p => p.id === editingId)!, ...editForm } as PlantillaPlan;
      updatedPlantillas = plantillas.map(p => p.id === editingId ? plantillaToSave : p);
    }

    const err = await savePlantilla(plantillaToSave);
    if (err) {
      showNotification('error', `Error al guardar: ${err}`);
      setSaving(false);
      return;
    }

    onSave(updatedPlantillas);
    setEditingId(null);
    setSaving(false);
    showNotification('success', 'Plantilla guardada correctamente');
  };

  const renderSlotHeader = (num: number) => (
    <div key={`header_${num}`} className="grid grid-cols-4 gap-2 mb-2 italic text-[#8e8e93] text-xs">
      <div className="col-span-2">Concepto {num}</div>
      <div>Fecha {num}</div>
      <div>Monto {num}</div>
    </div>
  );

  const renderSlotInput = (num: number) => {
    const conceptoKey = `concepto_${num}` as keyof PlantillaPlan;
    const fechaKey = `fecha_${num}` as keyof PlantillaPlan;
    const cantidadKey = `cantidad_${num}` as keyof PlantillaPlan;

    return (
      <div key={`input_${num}`} className="grid grid-cols-4 gap-2 mb-2">
        <select
          className="col-span-2 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#3b82f6] bg-white"
          value={editForm[conceptoKey] as string || ''}
          onChange={e => setEditForm({ ...editForm, [conceptoKey]: e.target.value })}
        >
          <option value="">-- Seleccionar --</option>
          {catalogos.conceptos.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input type="date" className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#3b82f6]"
          value={toInputDate(editForm[fechaKey] as string)} onChange={e => setEditForm({ ...editForm, [fechaKey]: e.target.value })} />
        <input type="number" placeholder="Ej. 1500" className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#3b82f6]"
          value={editForm[cantidadKey] as number || ''} onChange={e => setEditForm({ ...editForm, [cantidadKey]: Number(e.target.value) })} />
      </div>
    );
  };

  const renderForm = () => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#e5e7eb] dark:border-gray-800 mb-8 transition-colors">
      <h3 className="text-lg font-bold text-[#222222] dark:text-gray-100 mb-4">{editingId === 'new' ? 'Nueva Plantilla' : 'Editar Plantilla'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Nombre de la Plantilla *</label>
          <input type="text" className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-[#3b82f6] outline-none"
            value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Ciclo Asociado</label>
          <select className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-[#3b82f6] outline-none"
            value={editForm.ciclo_id || ''} onChange={e => setEditForm({ ...editForm, ciclo_id: e.target.value || null })}>
            <option value="">(Ninguno)</option>
            {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Tipo de Plan</label>
          <select className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-[#3b82f6] outline-none"
            value={editForm.tipo_plan || 'Cuatrimestral'} onChange={e => setEditForm({ ...editForm, tipo_plan: e.target.value as any })}>
            <option value="Cuatrimestral">Cuatrimestral</option>
            <option value="Semestral">Semestral</option>
            <option value="Titulación">Titulación</option>
            <option value="Especialidad Completa">Especialidad Completa</option>
            <option value="Especialidad Cuatrimestral">Especialidad Cuatrimestral</option>
          </select>
        </div>
        <div className="col-span-full">
          <label className="block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Descripción (Opcional)</label>
          <input type="text" className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-[#3b82f6] outline-none"
            value={editForm.descripcion || ''} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
        </div>
        <div className="col-span-full flex items-center gap-2">
          <input type="checkbox" id="activo" checked={editForm.activo !== false} onChange={e => setEditForm({ ...editForm, activo: e.target.checked })} />
          <label htmlFor="activo" className="text-sm text-[#45515e] dark:text-gray-300">Plantilla Activa (visible al crear planes)</label>
        </div>
      </div>

      <div className="border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[13px] overflow-hidden mb-6">
        <div className="bg-[#f2f3f5] dark:bg-[#1c2228] px-4 py-2 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]"><span className="font-semibold text-[#45515e] dark:text-gray-300 text-sm">Configuración de Pagos</span></div>
        <div className="p-4 bg-white dark:bg-gray-900 grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-2">
          <div>
            {renderSlotHeader(1)}
            {[1, 2, 3, 4, 5].map(n => renderSlotInput(n))}
          </div>
          <div>
            {renderSlotHeader(6)}
            {[6, 7, 8, 9, 10].map(n => renderSlotInput(n))}
          </div>
          <div>
            {renderSlotHeader(11)}
            {[11, 12, 13, 14, 15].map(n => renderSlotInput(n))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-[#f2f3f5] dark:border-gray-800">
        <button onClick={() => setEditingId(null)} disabled={saving} className="px-4 py-2 text-sm text-[#45515e] dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1c2228] rounded-[8px] font-medium transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[8px] text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar Plantilla
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f2f3f5] dark:bg-gray-950 p-8 font-sans transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <button onClick={onBack} className="flex flex-shrink-0 items-center gap-2 text-[#45515e] dark:text-[#8e8e93] hover:text-black dark:hover:text-white font-bold transition-colors">
            <ArrowLeft size={20} /> Volver al Inicio
          </button>

          <div className="flex-1 w-full max-w-lg relative">
            <input type="text" placeholder="Buscar plantillas..." className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[13px] shadow-[var(--shadow-subtle)] bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-[#3b82f6] outline-none"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search className="absolute left-3 top-2.5 text-[#8e8e93]" size={18} />
          </div>

          <button onClick={handleAddNew} disabled={editingId !== null || saving}
            className="flex flex-shrink-0 items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-[13px] text-sm font-medium shadow-[var(--shadow-subtle)] active:scale-95 transition-all disabled:opacity-50">
            <Plus size={18} /> Nueva Plantilla
          </button>
        </div>

        {notification && (
          <div className={`mb-6 flex items-center gap-2 px-4 py-3 rounded-[13px] border font-medium text-sm shadow-[var(--shadow-subtle)]
            ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {notification.msg}
          </div>
        )}

        {editingId && renderForm()}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlantillas.map(plantilla => (
            <div key={plantilla.id} className="bg-white dark:bg-gray-900 rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#e5e7eb] dark:border-gray-800 p-5 flex flex-col transition-shadow hover:shadow-md">
              <div className="flex justify-between items-start mb-3 border-b border-[#f2f3f5] dark:border-gray-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-[13px] ${plantilla.activo ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-[#8e8e93]'}`}>
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#222222] dark:text-gray-100 leading-tight">{plantilla.nombre}</h3>
                    <p className="text-xs text-[#8e8e93] dark:text-[#8e8e93] mt-0.5">{getCicloName(plantilla.ciclo_id)} · {plantilla.tipo_plan}</p>
                  </div>
                </div>
                {!plantilla.activo && <span className="bg-gray-100 text-[#45515e] text-[10px] uppercase font-bold px-2 py-0.5 rounded">Inactiva</span>}
              </div>

              {plantilla.descripcion && <p className="text-sm text-[#45515e] flex-1 mb-4 italic">{plantilla.descripcion}</p>}
              {!plantilla.descripcion && <div className="flex-1"></div>}

              <div className="flex flex-wrap gap-2 text-xs text-[#8e8e93] font-medium mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter(i => plantilla[`concepto_${i}` as keyof PlantillaPlan]).length > 0
                  ? <span className="bg-[#f2f3f5] border border-[#e5e7eb] px-2 py-1 rounded">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter(i => plantilla[`concepto_${i}` as keyof PlantillaPlan]).length} conceptos configurados
                    </span>
                  : <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded">Sin conceptos</span>
                }
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-[#f2f3f5] dark:border-gray-800">
                <button onClick={() => handleEdit(plantilla)} className="flex-1 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] text-[#45515e] dark:text-gray-300 hover:bg-[#f2f3f5] dark:hover:bg-[#1c2228] py-1.5 rounded-[8px] text-sm font-medium transition-colors">
                  Editar
                </button>
                <button onClick={() => handleDuplicate(plantilla)} title="Duplicar" className="p-1.5 text-[#8e8e93] hover:text-blue-600 hover:bg-[rgba(0,0,0,0.03)] rounded-[8px] transition-colors">
                  <Copy size={18} />
                </button>
                <button onClick={() => handleDelete(plantilla.id)} title="Eliminar" className="p-1.5 text-[#8e8e93] hover:text-red-600 hover:bg-red-50 rounded-[8px] transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {filteredPlantillas.length === 0 && (
             <div className="col-span-full py-20 text-center bg-white dark:bg-gray-900 rounded-[20px] border border-dashed border-gray-300 dark:border-[rgba(255,255,255,0.08)] transition-colors">
              <BookOpen size={48} className="mx-auto text-gray-300 dark:text-[#45515e] mb-4" />
              <p className="text-[#8e8e93] dark:text-[#8e8e93] font-medium">No se encontraron plantillas de planes.</p>
              <p className="text-sm text-[#8e8e93] dark:text-[#45515e] mt-1">Crea una nueva plantilla para usarla al generar cobros rápidos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
