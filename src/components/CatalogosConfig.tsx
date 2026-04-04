import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    ArrowLeft, Plus, Edit2, Save, X, Trash2,
    Tag, GraduationCap, Award, Percent, CheckCircle, XCircle, Loader2, Clock, Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CatalogoItem, CatalogoTipo, Catalogos } from '../types';

interface CatalogosConfigProps {
    catalogos: Catalogos;
    rawItems: CatalogoItem[];
    onBack: () => void;
    onUpdate: (items: CatalogoItem[]) => void;
}

type TabKey = 'concepto' | 'licenciatura' | 'beca_tipo' | 'beca_porcentaje' | 'grado' | 'turno' | 'estatus_alumno';

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }[] = [
    { key: 'concepto', label: 'Conceptos', icon: <Tag size={16} />, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { key: 'licenciatura', label: 'Licenciaturas', icon: <GraduationCap size={16} />, color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
    { key: 'grado', label: 'Grados', icon: <GraduationCap size={16} />, color: 'text-cyan-700', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
    { key: 'turno', label: 'Turnos', icon: <Clock size={16} />, color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    { key: 'estatus_alumno', label: 'Estatus Alumno', icon: <Activity size={16} />, color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
    { key: 'beca_tipo', label: 'Tipos Beca', icon: <Award size={16} />, color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    { key: 'beca_porcentaje', label: '% Beca', icon: <Percent size={16} />, color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
];

export default function CatalogosConfig({ catalogos: _catalogos, rawItems, onBack, onUpdate }: CatalogosConfigProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('concepto');
    const [items, setItems] = useState<CatalogoItem[]>(rawItems);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editMetaTipoAcademico, setEditMetaTipoAcademico] = useState<'LICENCIATURA' | 'ESPECIALIDAD'>('LICENCIATURA');
    const [editMetaTipoPeriodo, setEditMetaTipoPeriodo] = useState<'CUATRIMESTRAL' | 'SEMESTRAL'>('CUATRIMESTRAL');
    const [newValue, setNewValue] = useState('');
    const [newMetaTipoAcademico, setNewMetaTipoAcademico] = useState<'LICENCIATURA' | 'ESPECIALIDAD'>('LICENCIATURA');
    const [newMetaTipoPeriodo, setNewMetaTipoPeriodo] = useState<'CUATRIMESTRAL' | 'SEMESTRAL'>('CUATRIMESTRAL');
    const [saving, setSaving] = useState(false);
    const [importingInfo, setImportingInfo] = useState<{ total: number; skipped: number } | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const showNotification = (type: 'success' | 'error' | 'info', msg: string) => {
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

        // Construir metadata solo para licenciaturas
        const metadata = activeTab === 'licenciatura'
            ? { tipo_academico: newMetaTipoAcademico, tipo_periodo: newMetaTipoPeriodo }
            : null;

        const newItem: CatalogoItem = {
            id: tempId,
            tipo: activeTab as CatalogoTipo,
            valor: val,
            orden: maxOrden + 1,
            activo: true,
            metadata,
        };

        try {
            const { data, error } = await supabase
                .from('catalogos')
                .insert({ tipo: activeTab, valor: val, orden: maxOrden + 1, activo: true, metadata })
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

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSaving(true);
        setImportingInfo(null);
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                // Parse lines, strip quotes and whitespace
                let lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
                lines = lines.map(l => l.replace(/^["']|["']$/g, '').trim().toUpperCase()).filter(l => l);
                
                // Ignorar posible cabecera si coincide con el nombre del tab
                if (lines.length > 0 && (lines[0] === 'CONCEPTO' || lines[0] === 'VALOR' || lines[0] === activeTab.toUpperCase())) {
                    lines.shift();
                }

                // Deduplicate within the file itself
                const uniqueNewValues = Array.from(new Set(lines));
                
                // Compare with existing
                const existingValues = new Set(filteredItems.map(i => i.valor));
                const valuesToInsert = uniqueNewValues.filter(val => !existingValues.has(val));
                const skipped = uniqueNewValues.length - valuesToInsert.length;

                if (valuesToInsert.length === 0) {
                    showNotification('info', `No hubo elementos nuevos por importar. Se saltaron ${skipped} duplicados.`);
                    setSaving(false);
                    return;
                }

                const maxOrden = filteredItems.reduce((m, i) => Math.max(m, i.orden), 0);
                const toInsert = valuesToInsert.map((val, idx) => ({
                    tipo: activeTab as CatalogoTipo,
                    valor: val,
                    orden: maxOrden + 1 + idx,
                    activo: true
                }));

                const { data, error } = await supabase
                    .from('catalogos')
                    .insert(toInsert)
                    .select();

                if (error) {
                    throw new Error(error.message);
                }

                // Add to local state
                if (data && data.length > 0) {
                    const updated = [...items, ...data];
                    setItems(updated);
                    onUpdate(updated);
                    setImportingInfo({ total: data.length, skipped });
                    showNotification('success', `Se importaron ${data.length} elementos exitosamente.`);
                }

            } catch (err: any) {
                console.error("Error CSV:", err);
                showNotification('error', `Error al importar: ${err.message || 'Error desconocido'}`);
            } finally {
                setSaving(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleEdit = (item: CatalogoItem) => {
        setEditingId(item.id);
        setEditValue(item.valor);
        if (item.tipo === 'licenciatura' && item.metadata) {
            setEditMetaTipoAcademico(item.metadata.tipo_academico || 'LICENCIATURA');
            setEditMetaTipoPeriodo(item.metadata.tipo_periodo || 'CUATRIMESTRAL');
        } else {
            setEditMetaTipoAcademico('LICENCIATURA');
            setEditMetaTipoPeriodo('CUATRIMESTRAL');
        }
    };

    const handleSaveEdit = async (item: CatalogoItem) => {
        const val = editValue.trim().toUpperCase();
        if (!val) return;
        setSaving(true);

        const metadata = item.tipo === 'licenciatura'
            ? { tipo_academico: editMetaTipoAcademico, tipo_periodo: editMetaTipoPeriodo }
            : item.metadata;

        try {
            const { error } = await supabase
                .from('catalogos')
                .update({ valor: val, metadata })
                .eq('id', item.id);
            if (error) console.warn('Supabase update error:', error.message);
        } catch { /* local fallback */ }

        const updated = items.map(i => i.id === item.id ? { ...i, valor: val, metadata } : i);
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 font-sans transition-colors duration-300">
            <div className="max-w-4xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white font-bold transition-colors"
                    >
                        <ArrowLeft size={20} /> Volver al Inicio
                    </button>
                    <div className="text-right">
                        <h1 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100">Catálogos de Configuración</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Gestiona las opciones predefinidas del sistema</p>
                    </div>
                </div>

                {/* Notification toast */}
                {notification && (
                    <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-sm
            ${notification.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : notification.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
                    >
                        {notification.type === 'success' ? <CheckCircle size={16} /> : notification.type === 'info' ? <Loader2 size={16} /> : <XCircle size={16} />}
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
                                    : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                            {tab.icon}
                            {tab.label}
                            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold
                ${activeTab === tab.key ? 'bg-white/60 dark:bg-black/20' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}`}>
                                {items.filter(i => i.tipo === tab.key && i.activo).length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">

                    {/* Card header */}
                    <div className={`px-6 py-4 border-b flex items-center gap-3 ${activeConfig.bgColor} ${activeConfig.borderColor} border-b`}>
                        <span className={activeConfig.color}>{activeConfig.icon}</span>
                        <div>
                            <h2 className={`font-bold text-base ${activeConfig.color}`}>{activeConfig.label}</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {filteredItems.filter(i => i.activo).length} activos · {filteredItems.filter(i => !i.activo).length} inactivos
                            </p>
                        </div>
                    </div>

                    {/* Add new row */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-3">
                        <div className="flex gap-3 items-center flex-wrap">
                            <input
                                type="text"
                                value={newValue}
                                onChange={e => setNewValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                placeholder={`Nuevo valor para ${activeConfig.label.toLowerCase()}...`}
                                className="flex-grow min-w-[200px] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase placeholder:normal-case bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                            
                            <div className="w-px h-8 bg-gray-300 mx-2 hidden sm:block"></div>
                            
                            <input 
                                type="file" 
                                accept=".csv" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleImportCSV} 
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all shadow-sm hover:shadow"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                Importar CSV
                            </button>
                        </div>
                        {/* Selectores extra SOLO para Licenciaturas */}
                        {activeTab === 'licenciatura' && (
                            <div className="flex flex-wrap gap-3 items-center pt-1 border-t border-gray-200">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Atributos:</span>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-600 font-medium">Tipo académico:</label>
                                    <select
                                        value={newMetaTipoAcademico}
                                        onChange={e => setNewMetaTipoAcademico(e.target.value as 'LICENCIATURA' | 'ESPECIALIDAD')}
                                        className="border border-indigo-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50 text-indigo-700 font-semibold"
                                    >
                                        <option value="LICENCIATURA">Licenciatura</option>
                                        <option value="ESPECIALIDAD">Especialidad</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-600 font-medium">Tipo de periodo:</label>
                                    <select
                                        value={newMetaTipoPeriodo}
                                        onChange={e => setNewMetaTipoPeriodo(e.target.value as 'CUATRIMESTRAL' | 'SEMESTRAL')}
                                        className="border border-cyan-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-cyan-400 bg-cyan-50 text-cyan-700 font-semibold"
                                    >
                                        <option value="CUATRIMESTRAL">Cuatrimestral</option>
                                        <option value="SEMESTRAL">Semestral</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {importingInfo && (
                        <div className="px-6 py-2 bg-blue-50 text-blue-700 text-xs font-semibold border-b border-blue-100 flex items-center justify-between">
                            <span>✅ Importación exitosa.</span>
                            <span>{importingInfo.total} insertados · {importingInfo.skipped} ignorados por duplicidad.</span>
                        </div>
                    )}

                    {/* Items list */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {filteredItems.length === 0 && (
                            <div className="px-6 py-12 text-center text-gray-400 dark:text-gray-600 text-sm">
                                No hay ítems. Agrega el primero arriba.
                            </div>
                        )}
                        {filteredItems.map((item, idx) => (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                transition={{ delay: idx * 0.05, duration: 0.2 }}
                                key={item.id}
                                className={`flex items-center gap-3 px-6 py-3 group transition-colors
                  ${item.activo ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50' : 'bg-gray-50 dark:bg-gray-800/30 opacity-60'}`}
                            >
                                {/* Order badge */}
                                <span className="text-xs font-bold text-gray-300 w-6 text-center">{idx + 1}</span>

                                {/* Value */}
                                {editingId === item.id ? (
                                    <div className="flex-grow flex flex-col gap-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(item); if (e.key === 'Escape') setEditingId(null); }}
                                            className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                                        />
                                        {item.tipo === 'licenciatura' && (
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <select
                                                    value={editMetaTipoAcademico}
                                                    onChange={e => setEditMetaTipoAcademico(e.target.value as 'LICENCIATURA' | 'ESPECIALIDAD')}
                                                    className="border border-indigo-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50 text-indigo-700 font-semibold"
                                                >
                                                    <option value="LICENCIATURA">Licenciatura</option>
                                                    <option value="ESPECIALIDAD">Especialidad</option>
                                                </select>
                                                <select
                                                    value={editMetaTipoPeriodo}
                                                    onChange={e => setEditMetaTipoPeriodo(e.target.value as 'CUATRIMESTRAL' | 'SEMESTRAL')}
                                                    className="border border-cyan-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-cyan-400 bg-cyan-50 text-cyan-700 font-semibold"
                                                >
                                                    <option value="CUATRIMESTRAL">Cuatrimestral</option>
                                                    <option value="SEMESTRAL">Semestral</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-grow flex flex-col gap-0.5">
                                        <span className={`text-sm font-semibold ${item.activo ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600 line-through'}`}>
                                            {item.valor}
                                        </span>
                                        {item.tipo === 'licenciatura' && item.metadata && (
                                            <div className="flex gap-1.5">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-semibold">
                                                    {item.metadata.tipo_academico === 'ESPECIALIDAD' ? 'Especialidad' : 'Licenciatura'}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100 font-semibold">
                                                    {item.metadata.tipo_periodo === 'SEMESTRAL' ? 'Semestral' : 'Cuatrimestral'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Status badge */}
                                <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full font-bold border
                  ${item.activo
                                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700'}`}>
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
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Footer tip */}
                <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-4">
                    💡 Los ítems <strong>inactivos</strong> no aparecerán en los formularios, pero se conservan en la BD.
                    Puedes reactivarlos cuando los necesites.
                </p>
            </div>
        </div>
    );
}
