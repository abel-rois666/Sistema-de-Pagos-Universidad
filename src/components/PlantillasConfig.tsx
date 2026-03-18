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
    <div key={`header_${num}`} className="grid grid-cols-4 gap-2 mb-2 italic text-gray-500 text-xs">
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
          className="col-span-2 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          value={editForm[conceptoKey] as string || ''}
          onChange={e => setEditForm({ ...editForm, [conceptoKey]: e.target.value })}
        >
          <option value="">-- Seleccionar --</option>
          {catalogos.conceptos.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input type="date" className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          value={toInputDate(editForm[fechaKey] as string)} onChange={e => setEditForm({ ...editForm, [fechaKey]: e.target.value })} />
        <input type="number" placeholder="Ej. 1500" className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          value={editForm[cantidadKey] as number || ''} onChange={e => setEditForm({ ...editForm, [cantidadKey]: Number(e.target.value) })} />
      </div>
    );
  };

  const renderForm = () => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
      <h3 className="text-lg font-bold text-gray-800 mb-4">{editingId === 'new' ? 'Nueva Plantilla' : 'Editar Plantilla'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre de la Plantilla *</label>
          <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={editForm.nombre || ''} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Ciclo Asociado</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={editForm.ciclo_id || ''} onChange={e => setEditForm({ ...editForm, ciclo_id: e.target.value || null })}>
            <option value="">(Ninguno)</option>
            {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Plan</label>
          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={editForm.tipo_plan || 'Cuatrimestral'} onChange={e => setEditForm({ ...editForm, tipo_plan: e.target.value as any })}>
            <option value="Cuatrimestral">Cuatrimestral</option>
            <option value="Semestral">Semestral</option>
          </select>
        </div>
        <div className="col-span-full">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción (Opcional)</label>
          <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={editForm.descripcion || ''} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} />
        </div>
        <div className="col-span-full flex items-center gap-2">
          <input type="checkbox" id="activo" checked={editForm.activo !== false} onChange={e => setEditForm({ ...editForm, activo: e.target.checked })} />
          <label htmlFor="activo" className="text-sm text-gray-700">Plantilla Activa (visible al crear planes)</label>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200"><span className="font-semibold text-gray-700 text-sm">Configuración de Pagos</span></div>
        <div className="p-4 bg-white grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2">
          <div>
            {renderSlotHeader(1)}
            {[1, 2, 3, 4, 5].map(n => renderSlotInput(n))}
          </div>
          <div>
            {renderSlotHeader(6)}
            {[6, 7, 8, 9].map(n => renderSlotInput(n))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button onClick={() => setEditingId(null)} disabled={saving} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar Plantilla
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <button onClick={onBack} className="flex flex-shrink-0 items-center gap-2 text-gray-600 hover:text-black font-bold transition-colors">
            <ArrowLeft size={20} /> Volver al Inicio
          </button>

          <div className="flex-1 w-full max-w-lg relative">
            <input type="text" placeholder="Buscar plantillas..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          </div>

          <button onClick={handleAddNew} disabled={editingId !== null || saving}
            className="flex flex-shrink-0 items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm active:scale-95 transition-all disabled:opacity-50">
            <Plus size={18} /> Nueva Plantilla
          </button>
        </div>

        {notification && (
          <div className={`mb-6 flex items-center gap-2 px-4 py-3 rounded-xl border font-medium text-sm shadow-sm
            ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {notification.msg}
          </div>
        )}

        {editingId && renderForm()}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlantillas.map(plantilla => (
            <div key={plantilla.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col transition-shadow hover:shadow-md">
              <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${plantilla.activo ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 leading-tight">{plantilla.nombre}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{getCicloName(plantilla.ciclo_id)} · {plantilla.tipo_plan}</p>
                  </div>
                </div>
                {!plantilla.activo && <span className="bg-gray-100 text-gray-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Inactiva</span>}
              </div>

              {plantilla.descripcion && <p className="text-sm text-gray-600 flex-1 mb-4 italic">{plantilla.descripcion}</p>}
              {!plantilla.descripcion && <div className="flex-1"></div>}

              <div className="flex flex-wrap gap-2 text-xs text-gray-500 font-medium mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].filter(i => plantilla[`concepto_${i}` as keyof PlantillaPlan]).length > 0
                  ? <span className="bg-gray-50 border border-gray-200 px-2 py-1 rounded">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].filter(i => plantilla[`concepto_${i}` as keyof PlantillaPlan]).length} conceptos configurados
                    </span>
                  : <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded">Sin conceptos</span>
                }
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => handleEdit(plantilla)} className="flex-1 border text-gray-700 hover:bg-gray-50 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  Editar
                </button>
                <button onClick={() => handleDuplicate(plantilla)} title="Duplicar" className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Copy size={18} />
                </button>
                <button onClick={() => handleDelete(plantilla.id)} title="Eliminar" className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {filteredPlantillas.length === 0 && (
             <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300">
              <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No se encontraron plantillas de planes.</p>
              <p className="text-sm text-gray-400 mt-1">Crea una nueva plantilla para usarla al generar cobros rápidos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
