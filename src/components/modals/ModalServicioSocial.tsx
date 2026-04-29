import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Plus, Search, Briefcase } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ServicioSocial } from '../../types';

interface ModalServicioSocialProps {
  alumnoId: string;
  registro?: ServicioSocial | null;
  empresasCatalogo: string[];
  onClose: () => void;
  onSaved: (registro: ServicioSocial) => void;
  onEmpresaAgregada?: (empresa: string) => void;
}

const INPUT_CLASS =
  'w-full border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] rounded-[8px] px-3 py-2 text-sm bg-white dark:bg-[#181e25] text-[#222222] dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-[#3b82f6] transition-shadow placeholder:text-gray-400';

const LABEL_CLASS = 'block text-xs font-semibold text-[#45515e] dark:text-[#8e8e93] mb-1 uppercase tracking-wider';

const today = () => new Date().toISOString().split('T')[0];

export default function ModalServicioSocial({
  alumnoId,
  registro,
  empresasCatalogo,
  onClose,
  onSaved,
  onEmpresaAgregada,
}: ModalServicioSocialProps) {
  const isEdit = !!registro;

  // ── Formulario ─────────────────────────────────────────────────────────
  const [empresa, setEmpresa] = useState(registro?.nombre_empresa ?? '');
  const [tipoEmpresa, setTipoEmpresa] = useState<'PRIVADA' | 'PUBLICA'>(registro?.tipo_empresa ?? 'PRIVADA');
  const [fechaRegistro, setFechaRegistro] = useState(registro?.fecha_registro ?? today());
  const [fechaInicio, setFechaInicio] = useState(registro?.fecha_inicio ?? '');
  const [fechaTermino, setFechaTermino] = useState(registro?.fecha_termino ?? '');
  const [horas, setHoras] = useState(registro?.horas_cubrir?.toString() ?? '');
  const [programa, setPrograma] = useState(registro?.nombre_programa ?? '');

  // ── Búsqueda empresa (combobox) ────────────────────────────────────────
  const [busqueda, setBusqueda] = useState(registro?.nombre_empresa ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addingNewEmpresa, setAddingNewEmpresa] = useState(false);
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const sugerencias = empresasCatalogo.filter(e =>
    e.toLowerCase().includes(busqueda.toLowerCase()) && busqueda.length > 0
  );

  const handleSelectEmpresa = (val: string) => {
    setEmpresa(val);
    setBusqueda(val);
    setShowSuggestions(false);
    setAddingNewEmpresa(false);
  };

  const handleAgregarEmpresaCatalogo = async () => {
    const val = busqueda.trim().toUpperCase();
    if (!val || empresasCatalogo.includes(val)) return;
    setSavingEmpresa(true);
    const maxOrden = empresasCatalogo.length + 1;
    const { data, error } = await supabase
      .from('catalogos')
      .insert({ tipo: 'empresa_ss', valor: val, orden: maxOrden, activo: true })
      .select()
      .single();
    setSavingEmpresa(false);
    if (!error && data) {
      setEmpresa(val);
      setBusqueda(val);
      setShowSuggestions(false);
      setAddingNewEmpresa(false);
      onEmpresaAgregada?.(val);
    } else {
      // Si falla Supabase, igual lo usamos localmente
      setEmpresa(val);
      setBusqueda(val);
      setShowSuggestions(false);
      setAddingNewEmpresa(false);
    }
  };

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Guardado ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!empresa.trim()) e.empresa = 'Requerido';
    if (!fechaRegistro) e.fechaRegistro = 'Requerido';
    if (!fechaInicio) e.fechaInicio = 'Requerido';
    if (!fechaTermino) e.fechaTermino = 'Requerido';
    if (fechaInicio && fechaTermino && fechaTermino < fechaInicio)
      e.fechaTermino = 'Debe ser posterior a inicio';
    const h = parseInt(horas, 10);
    if (!horas || isNaN(h) || h < 1) e.horas = 'Debe ser un entero positivo';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);

    const payload = {
      alumno_id: alumnoId,
      nombre_empresa: empresa.trim().toUpperCase(),
      tipo_empresa: tipoEmpresa,
      fecha_registro: fechaRegistro,
      fecha_inicio: fechaInicio,
      fecha_termino: fechaTermino,
      horas_cubrir: parseInt(horas, 10),
      nombre_programa: programa.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let result: ServicioSocial | null = null;
    let error = null;

    if (isEdit && registro) {
      const { data, error: err } = await supabase
        .from('servicio_social')
        .update(payload)
        .eq('id', registro.id)
        .select()
        .single();
      result = data;
      error = err;
    } else {
      const { data, error: err } = await supabase
        .from('servicio_social')
        .insert(payload)
        .select()
        .single();
      result = data;
      error = err;
    }

    setSaving(false);
    if (error) {
      alert('Error al guardar: ' + error.message);
      return;
    }
    if (result) onSaved(result);
  };

  const esNuevaEmpresa = busqueda.trim() !== '' &&
    !empresasCatalogo.some(e => e.toLowerCase() === busqueda.trim().toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1c2228] rounded-[24px] w-full max-w-lg shadow-2xl border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#f8f9ff] dark:bg-[#181e25] border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-[8px] text-purple-600 dark:text-purple-400">
              <Briefcase size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-[#222222] dark:text-white text-base">
                {isEdit ? 'Editar Servicio Social' : 'Nuevo Registro de Servicio Social'}
              </h2>
              <p className="text-xs text-[#8e8e93] dark:text-[#8e8e93]">Todos los campos marcados * son obligatorios</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.08)] rounded-[8px] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">

          {/* Empresa (combobox) */}
          <div ref={searchRef} className="relative">
            <label className={LABEL_CLASS}>Nombre de Institución / Empresa *</label>
            <div className={`flex items-center gap-2 border ${errors.empresa ? 'border-red-400' : 'border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)]'} rounded-[8px] px-3 py-2 bg-white dark:bg-[#181e25] focus-within:ring-2 focus-within:ring-[#3b82f6] transition-shadow`}>
              <Search size={15} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                className="flex-1 bg-transparent outline-none text-sm text-[#222222] dark:text-gray-100 placeholder:text-gray-400"
                placeholder="Buscar o escribir institución/empresa..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setEmpresa(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                autoComplete="off"
              />
            </div>
            {errors.empresa && <p className="text-xs text-red-500 mt-1">{errors.empresa}</p>}

            {/* Sugerencias */}
            {showSuggestions && (busqueda.trim().length > 0) && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] rounded-[13px] shadow-xl max-h-48 overflow-y-auto">
                {sugerencias.map(s => (
                  <div
                    key={s}
                    onMouseDown={() => handleSelectEmpresa(s)}
                    className="px-4 py-2.5 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] last:border-0 font-medium text-[#222222] dark:text-gray-200"
                  >
                    {s}
                  </div>
                ))}
                {esNuevaEmpresa && (
                  <div
                    onMouseDown={handleAgregarEmpresaCatalogo}
                    className="px-4 py-2.5 text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer font-semibold border-t border-purple-100 dark:border-purple-900/30"
                  >
                    {savingEmpresa ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Agregar "{busqueda.trim().toUpperCase()}" al catálogo
                  </div>
                )}
                {sugerencias.length === 0 && !esNuevaEmpresa && (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">Sin coincidencias</div>
                )}
              </div>
            )}
          </div>

          {/* Tipo empresa */}
          <div>
            <label className={LABEL_CLASS}>Tipo de Empresa *</label>
            <div className="flex gap-3">
              {(['PRIVADA', 'PUBLICA'] as const).map(tipo => (
                <button
                  type="button"
                  key={tipo}
                  onClick={() => setTipoEmpresa(tipo)}
                  className={`flex-1 py-2 rounded-[8px] text-sm font-semibold border transition-all ${
                    tipoEmpresa === tipo
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                      : 'bg-white dark:bg-[#181e25] text-[#45515e] dark:text-gray-300 border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] hover:border-purple-400'
                  }`}
                >
                  {tipo === 'PRIVADA' ? 'Privada' : 'Pública'}
                </button>
              ))}
            </div>
          </div>

          {/* Fechas — grid 3 cols */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLASS}>Fecha de Registro *</label>
              <input type="date" className={`${INPUT_CLASS} ${errors.fechaRegistro ? 'border-red-400' : ''}`}
                value={fechaRegistro} onChange={e => setFechaRegistro(e.target.value)} />
              {errors.fechaRegistro && <p className="text-xs text-red-500 mt-1">{errors.fechaRegistro}</p>}
            </div>
            <div>
              <label className={LABEL_CLASS}>Fecha de Inicio *</label>
              <input type="date" className={`${INPUT_CLASS} ${errors.fechaInicio ? 'border-red-400' : ''}`}
                value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
              {errors.fechaInicio && <p className="text-xs text-red-500 mt-1">{errors.fechaInicio}</p>}
            </div>
            <div>
              <label className={LABEL_CLASS}>Fecha de Término *</label>
              <input type="date" className={`${INPUT_CLASS} ${errors.fechaTermino ? 'border-red-400' : ''}`}
                value={fechaTermino} onChange={e => setFechaTermino(e.target.value)} min={fechaInicio || undefined} />
              {errors.fechaTermino && <p className="text-xs text-red-500 mt-1">{errors.fechaTermino}</p>}
            </div>
          </div>

          {/* Horas */}
          <div>
            <label className={LABEL_CLASS}>Horas a Cubrir *</label>
            <input
              type="number"
              min="1"
              step="1"
              className={`${INPUT_CLASS} ${errors.horas ? 'border-red-400' : ''}`}
              placeholder="Ej. 480"
              value={horas}
              onChange={e => setHoras(e.target.value.replace(/[^0-9]/g, ''))}
            />
            {errors.horas && <p className="text-xs text-red-500 mt-1">{errors.horas}</p>}
          </div>

          {/* Programa (opcional) */}
          <div>
            <label className={LABEL_CLASS}>Nombre del Programa <span className="font-normal normal-case text-gray-400">(opcional)</span></label>
            <input
              type="text"
              className={INPUT_CLASS}
              placeholder="Ej. Programa Nacional de Servicio Social en Salud"
              value={programa}
              onChange={e => setPrograma(e.target.value)}
            />
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-[#45515e] dark:text-gray-400 hover:bg-[#f0f0f0] dark:hover:bg-[rgba(255,255,255,0.08)] rounded-[8px] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-[8px] shadow-md transition-colors disabled:opacity-60 active:scale-95"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isEdit ? 'Guardar Cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
