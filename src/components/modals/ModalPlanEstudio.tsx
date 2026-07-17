import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PlanEstudio, Carrera } from '../../types';

const TIPO_PERIODO_MAP: Record<string, number> = {
  'SEMESTRAL': 91,
  'BIMESTRAL': 92,
  'CUATRIMESTRAL': 93,
  'TETRAMESTRAL': 94,
  'TRIMESTRAL': 260,
  'MODULAR': 261,
  'ANUAL': 262
};

interface ModalPlanEstudioProps {
  plan?: PlanEstudio | null;
  carreraIdActiva?: string;
  carreras: Carrera[];
  onClose: () => void;
  onSaved: (plan: PlanEstudio) => void;
}

export default function ModalPlanEstudio({ plan, carreraIdActiva, carreras, onClose, onSaved }: ModalPlanEstudioProps) {
  const [form, setForm] = useState<Partial<PlanEstudio>>({
    nombre: '',
    clave_legado: '',
    rvoe: '',
    fecha_rvoe: '',
    carrera_id: carreraIdActiva || (carreras[0]?.id ?? ''),
    licenciatura_id: carreraIdActiva || (carreras[0]?.id ?? ''),
    tipo_periodo: 'SEMESTRAL',
    modelo: 'RIGIDO',
    estatus: 'ACTIVO',
    id_plan_certificacion: undefined,
    id_autorizacion_reconocimiento: undefined,
    autorizacion_reconocimiento: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (plan) {
      setForm({
        nombre: plan.nombre || '',
        clave_legado: plan.clave_legado || '',
        rvoe: plan.rvoe || '',
        fecha_rvoe: plan.fecha_rvoe || '',
        carrera_id: plan.carrera_id || plan.licenciatura_id || '',
        licenciatura_id: plan.licenciatura_id || plan.carrera_id || '',
        tipo_periodo: plan.tipo_periodo?.toUpperCase() || 'SEMESTRAL',
        modelo: plan.modelo || 'RIGIDO',
        creditos_obligatorios: plan.creditos_obligatorios !== undefined && plan.creditos_obligatorios !== null ? plan.creditos_obligatorios : 0,
        estatus: plan.estatus || 'ACTIVO',
        id_plan_certificacion: plan.id_plan_certificacion || undefined,
        id_autorizacion_reconocimiento: (plan as any).id_autorizacion_reconocimiento || undefined,
        autorizacion_reconocimiento: (plan as any).autorizacion_reconocimiento || '',
      });
    } else {
      // Reset form if no plan (creating new)
      setForm({
        nombre: '',
        clave_legado: '',
        rvoe: '',
        fecha_rvoe: '',
        carrera_id: carreraIdActiva || (carreras[0]?.id ?? ''),
        licenciatura_id: carreraIdActiva || (carreras[0]?.id ?? ''),
        tipo_periodo: 'SEMESTRAL',
        modelo: 'RIGIDO',
        creditos_obligatorios: 0,
        estatus: 'ACTIVO',
        id_plan_certificacion: undefined,
        id_autorizacion_reconocimiento: undefined,
        autorizacion_reconocimiento: '',
      });
    }
  }, [plan]);

  // Sync carrera_id and licenciatura_id
  const handleCarreraChange = (id: string) => {
    setForm(prev => ({
      ...prev,
      carrera_id: id,
      licenciatura_id: id // Por retrocompatibilidad con la rama principal
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.nombre?.trim()) {
      setError('El nombre del plan de estudio es obligatorio.');
      return;
    }
    
    if (!form.carrera_id) {
      setError('Debes seleccionar una carrera a la cual pertenece este plan.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        nombre: form.nombre.trim(),
        clave_legado: form.clave_legado?.trim(),
        rvoe: form.rvoe?.trim() || null,
        fecha_rvoe: form.fecha_rvoe || null,
        tipo_periodo: form.tipo_periodo,
        id_tipo_periodo: TIPO_PERIODO_MAP[form.tipo_periodo?.toUpperCase() || ''] || null,
        modelo: form.modelo,
        creditos_obligatorios: form.creditos_obligatorios,
        carrera_id: form.carrera_id,
        licenciatura_id: form.licenciatura_id, // Mismo ID por retrocompatibilidad
        estatus: form.estatus,
        id_plan_certificacion: form.id_plan_certificacion || null,
        id_autorizacion_reconocimiento: form.id_autorizacion_reconocimiento || null,
        autorizacion_reconocimiento: form.autorizacion_reconocimiento || null,
      };

      if (plan?.id) {
        // Actualizar
        const { data, error: err } = await supabase
          .from('planes_estudio')
          .update(payload)
          .eq('id', plan.id)
          .select()
          .single();

        if (err) throw err;
        onSaved(data as PlanEstudio);
      } else {
        // Crear nuevo
        const { data, error: err } = await supabase
          .from('planes_estudio')
          .insert([payload])
          .select()
          .single();

        if (err) throw err;
        onSaved(data as PlanEstudio);
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al guardar el plan de estudios.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50">
          <h2 className="text-lg font-bold text-[#222222] dark:text-gray-100">
            {plan ? 'Editar Plan de Estudios' : 'Nuevo Plan de Estudios'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full text-[#8e8e93] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-[10px] text-sm font-medium flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">
              Carrera <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100"
              value={form.carrera_id}
              onChange={(e) => handleCarreraChange(e.target.value)}
              disabled={!!plan && !!form.carrera_id} // Normalmente no se cambia la carrera de un plan ya creado
            >
              <option value="">-- Seleccionar Carrera --</option>
              {carreras.filter(c => c.activo).map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Nombre del Plan <span className="text-red-500">*</span></label>
              <input
                type="text"
                autoFocus
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100 uppercase"
                placeholder="Ej. PLAN 2024"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Clave (Opcional)</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100 uppercase"
                placeholder="Ej. PL24"
                value={form.clave_legado}
                onChange={(e) => setForm({ ...form, clave_legado: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">RVOE</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100 uppercase"
                placeholder="20231234"
                value={form.rvoe}
                onChange={(e) => setForm({ ...form, rvoe: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Fecha RVOE</label>
              <input
                type="date"
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100 uppercase"
                value={form.fecha_rvoe ? (form.fecha_rvoe.includes('/') ? form.fecha_rvoe.split('/').reverse().join('-') : form.fecha_rvoe.split('T')[0]) : ''}
                onChange={(e) => setForm({ ...form, fecha_rvoe: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Autorización / Reconocimiento DGAIR</label>
              <select
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100"
                value={form.id_autorizacion_reconocimiento || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const label = val ? e.target.options[e.target.selectedIndex].text.replace(/^\d+\s-\s/, '') : '';
                  setForm({ ...form, id_autorizacion_reconocimiento: val ? parseInt(val) : undefined, autorizacion_reconocimiento: label });
                }}
              >
                <option value="">(SIN SELECCIONAR)</option>
                <option value="1">1 - RVOE FEDERAL</option>
                <option value="2">2 - RVOE ESTATAL</option>
                <option value="3">3 - AUTORIZACIÓN FEDERAL</option>
                <option value="4">4 - AUTORIZACIÓN ESTATAL</option>
                <option value="5">5 - ACTA DE SESIÓN</option>
                <option value="6">6 - ACUERDO DE INCORPORACIÓN</option>
                <option value="7">7 - ACUERDO SECRETARIAL SEP</option>
                <option value="8">8 - DECRETO DE CREACIÓN</option>
                <option value="9">9 - OTRO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Tipo de Periodo</label>
              <select
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100"
                value={form.tipo_periodo}
                onChange={(e) => setForm({ ...form, tipo_periodo: e.target.value })}
              >
                <option value="SEMESTRAL">Semestral</option>
                <option value="BIMESTRAL">Bimestral</option>
                <option value="CUATRIMESTRAL">Cuatrimestral</option>
                <option value="TETRAMESTRAL">Tetramestral</option>
                <option value="TRIMESTRAL">Trimestral</option>
                <option value="MODULAR">Modular</option>
                <option value="ANUAL">Anual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Modelo</label>
              <select
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100"
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
              >
                <option value="RIGIDO">RIGIDO</option>
                <option value="FLEXIBLE">FLEXIBLE</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">ID de Carrera</label>
              <select
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100"
                value={form.id_plan_certificacion || ''}
                onChange={(e) => setForm({ ...form, id_plan_certificacion: e.target.value ? parseInt(e.target.value) : undefined })}
              >
                <option value="">-- Ninguno --</option>
                {Array.from({ length: 50 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Estatus</label>
              <select
                className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100"
                value={form.estatus}
                onChange={(e) => setForm({ ...form, estatus: e.target.value })}
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1">Créditos Totales (Opcional)</label>
            <input
              type="number"
              step="0.01"
              className="w-full border border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded-[10px] px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#1456f0] bg-white dark:bg-[#181e25] text-gray-900 dark:text-gray-100"
              placeholder="Ej. 56.00 o 350"
              value={form.creditos_obligatorios !== undefined && form.creditos_obligatorios !== 0 ? form.creditos_obligatorios : ''}
              onChange={(e) => setForm({ ...form, creditos_obligatorios: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.estatus === 'ACTIVO'}
                onChange={(e) => setForm({ ...form, estatus: e.target.checked ? 'ACTIVO' : 'INACTIVO' })}
                className="w-4 h-4 text-[#1456f0] border-gray-300 dark:border-[rgba(255,255,255,0.12)] rounded focus:ring-[#1456f0] dark:bg-[#181e25]"
              />
              <span className="text-sm font-semibold text-[#45515e] dark:text-[#8e8e93]">Plan Activo (Visible)</span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-gray-50/50 dark:bg-[#1c2228]/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1456f0] hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Save size={16} />
            )}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
