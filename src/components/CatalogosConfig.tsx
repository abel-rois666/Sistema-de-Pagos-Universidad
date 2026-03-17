import React, { useState } from 'react';
import {
    ArrowLeft, Plus, Edit2, Save, X, Trash2,
    Tag, GraduationCap, Award, Percent, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CatalogoItem, CatalogoTipo, Catalogos } from '../types';

interface CatalogosConfigProps {
    catalogos: Catalogos;
    rawItems: CatalogoItem[];
    onBack: () => void;
    onUpdate: (items: CatalogoItem[]) => void;
}

type TabKey = 'concepto' | 'licenciatura' | 'beca_tipo' | 'beca_porcentaje';

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }[] = [
    { key: 'concepto', label: 'Conceptos de Pago', icon: <Tag size={16} />, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { key: 'licenciatura', label: 'Licenciaturas', icon: <GraduationCap size={16} />, color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
    { key: 'beca_tipo', label: 'Tipos de Beca', icon: <Award size={16} />, color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    { key: 'beca_porcentaje', label: 'Porcentajes Beca', icon: <Percent size={16} />, color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
];

export default function CatalogosConfig({ catalogos: _catalogos, rawItems, onBack, onUpdate }: CatalogosConfigProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('concepto');
    const [items, setItems] = useState<CatalogoItem[]>(rawItems);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [newValue, setNewValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const showNotification = (type: 'success' | 'error', msg: string) => {
        setNotification({ type, msg });
        setTimeout(() => setNotification(null), 3000);
    };

    const filteredItems = items
        .filter(i => i.tipo === activeTab)
        .sort((a, b) => a.orden - b.orden);

    const activeConfig = TAB_CONFIG.find(t => t.key === activeTab)!;

    // ──────────────── CRUD ────────────────
    const handleAdd = async () => {
        const val = newValue.trim().toUpperCase();
        if (!val) return;
        if (filteredItems.some(i => i.valor === val)) {
            showNotification('error', 'Ya existe ese valor en el catálogo.');
            return;
        }

        setSaving(true);
        const maxOrden = filteredItems.reduce((m, i) => Math.max(m, i.orden), 0);
        const tempId = `temp_${Date.now()}`;
        const newItem: CatalogoItem = {
            id: tempId,
            tipo: activeTab as CatalogoTipo,
            valor: val,
            orden: maxOrden + 1,
            activo: true,
        };

        try {
            const { data, error } = await supabase
                .from('catalogos')
                .insert({ tipo: activeTab, valor: val, orden: maxOrden + 1, activo: true })
                .select()
                .single();

            const saved = error ? newItem : { ...newItem, id: data.id };
            if (error) console.warn('Supabase insert error, using local:', error.message);

            const updated = [...items, saved];
            setItems(updated);
            onUpdate(updated);
            setNewValue('');
            showNotification('success', `"${val}" agregado correctamente.`);
        } catch {
            const updated = [...items, newItem];
            setItems(updated);
            onUpdate(updated);
            setNewValue('');
            showNotification('success', `"${val}" agregado (modo local).`);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (item: CatalogoItem) => {
        setEditingId(item.id);
        setEditValue(item.valor);
    };

    const handleSaveEdit = async (item: CatalogoItem) => {
        const val = editValue.trim().toUpperCase();
        if (!val) return;
        setSaving(true);

        try {
            const { error } = await supabase
                .from('catalogos')
                .update({ valor: val })
                .eq('id', item.id);
            if (error) console.warn('Supabase update error:', error.message);
        } catch { /* local fallback */ }

        const updated = items.map(i => i.id === item.id ? { ...i, valor: val } : i);
        setItems(updated);
        onUpdate(updated);
        setEditingId(null);
        setSaving(false);
        showNotification('success', 'Cambio guardado.');
    };

    const handleToggleActivo = async (item: CatalogoItem) => {
        const newActivo = !item.activo;
        try {
            const { error } = await supabase
                .from('catalogos')
                .update({ activo: newActivo })
                .eq('id', item.id);
            if (error) console.warn('Supabase toggle error:', error.message);
        } catch { /* local fallback */ }

        const updated = items.map(i => i.id === item.id ? { ...i, activo: newActivo } : i);
        setItems(updated);
        onUpdate(updated);
    };

    const handleDelete = async (item: CatalogoItem) => {
        if (!confirm(`¿Eliminar "${item.valor}" del catálogo? Esta acción no se puede deshacer.`)) return;
        setSaving(true);

        try {
            const { error } = await supabase
                .from('catalogos')
                .delete()
                .eq('id', item.id);
            if (error) console.warn('Supabase delete error:', error.message);
        } catch { /* local fallback */ }

        const updated = items.filter(i => i.id !== item.id);
        setItems(updated);
        onUpdate(updated);
        setSaving(false);
        showNotification('success', `"${item.valor}" eliminado.`);
    };

    // ──────────────── RENDER ────────────────
    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-600 hover:text-black font-bold transition-colors"
                    >
                        <ArrowLeft size={20} /> Volver al Inicio
                    </button>
                    <div className="text-right">
                        <h1 className="text-2xl font-extrabold text-gray-800">Catálogos de Configuración</h1>
                        <p className="text-sm text-gray-500">Gestiona las opciones predefinidas del sistema</p>
                    </div>
                </div>

                {/* Notification toast */}
                {notification && (
                    <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-sm
            ${notification.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'}`}
                    >
                        {notification.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        {notification.msg}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {TAB_CONFIG.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setEditingId(null); setNewValue(''); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm border transition-all
                ${activeTab === tab.key
                                    ? `${tab.bgColor} ${tab.color} ${tab.borderColor} shadow-sm`
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                        >
                            {tab.icon}
                            {tab.label}
                            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold
                ${activeTab === tab.key ? 'bg-white/60' : 'bg-gray-100'}`}>
                                {items.filter(i => i.tipo === tab.key && i.activo).length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                    {/* Card header */}
                    <div className={`px-6 py-4 border-b flex items-center gap-3 ${activeConfig.bgColor} ${activeConfig.borderColor} border-b`}>
                        <span className={activeConfig.color}>{activeConfig.icon}</span>
                        <div>
                            <h2 className={`font-bold text-base ${activeConfig.color}`}>{activeConfig.label}</h2>
                            <p className="text-xs text-gray-500">
                                {filteredItems.filter(i => i.activo).length} activos · {filteredItems.filter(i => !i.activo).length} inactivos
                            </p>
                        </div>
                    </div>

                    {/* Add new row */}
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex gap-3 items-center">
                        <input
                            type="text"
                            value={newValue}
                            onChange={e => setNewValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder={`Nuevo valor para ${activeConfig.label.toLowerCase()}...`}
                            className="flex-grow border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase placeholder:normal-case"
                        />
                        <button
                            onClick={handleAdd}
                            disabled={!newValue.trim() || saving}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50
                ${activeConfig.bgColor} ${activeConfig.color} border ${activeConfig.borderColor} hover:shadow-sm`}
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            Agregar
                        </button>
                    </div>

                    {/* Items list */}
                    <div className="divide-y divide-gray-100">
                        {filteredItems.length === 0 && (
                            <div className="px-6 py-12 text-center text-gray-400 text-sm">
                                No hay ítems. Agrega el primero arriba.
                            </div>
                        )}
                        {filteredItems.map((item, idx) => (
                            <div
                                key={item.id}
                                className={`flex items-center gap-3 px-6 py-3 group transition-colors
                  ${item.activo ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-60'}`}
                            >
                                {/* Order badge */}
                                <span className="text-xs font-bold text-gray-300 w-6 text-center">{idx + 1}</span>

                                {/* Value */}
                                {editingId === item.id ? (
                                    <input
                                        autoFocus
                                        type="text"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(item); if (e.key === 'Escape') setEditingId(null); }}
                                        className="flex-grow border border-blue-300 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                                    />
                                ) : (
                                    <span className={`flex-grow text-sm font-semibold ${item.activo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                                        {item.valor}
                                    </span>
                                )}

                                {/* Status badge */}
                                <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full font-bold border
                  ${item.activo
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                        : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                                    {item.activo ? 'Activo' : 'Inactivo'}
                                </span>

                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {editingId === item.id ? (
                                        <>
                                            <button
                                                onClick={() => handleSaveEdit(item)}
                                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                title="Guardar"
                                            >
                                                <Save size={15} />
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                                                title="Cancelar"
                                            >
                                                <X size={15} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                            <button
                                                onClick={() => handleToggleActivo(item)}
                                                className={`p-1.5 rounded-lg transition-colors
                          ${item.activo
                                                        ? 'text-amber-500 hover:bg-amber-50'
                                                        : 'text-emerald-500 hover:bg-emerald-50'}`}
                                                title={item.activo ? 'Desactivar' : 'Activar'}
                                            >
                                                {item.activo ? <XCircle size={15} /> : <CheckCircle size={15} />}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item)}
                                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer tip */}
                <p className="text-xs text-gray-400 text-center mt-4">
                    💡 Los ítems <strong>inactivos</strong> no aparecerán en los formularios, pero se conservan en la BD.
                    Puedes reactivarlos cuando los necesites.
                </p>
            </div>
        </div>
    );
}
