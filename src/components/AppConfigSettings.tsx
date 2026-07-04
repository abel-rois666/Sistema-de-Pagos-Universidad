import React, { useState, useRef } from 'react';
import { AppConfig, DEFAULT_CONSTANCIA_PARAMS } from '../types';
import { updateAppConfig } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { Save, Image as ImageIcon, Type, ArrowLeft, Upload, Trash2, UserCheck } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export const AppConfigSettings: React.FC<Props> = ({ onBack }) => {
  const { appConfig, setAppConfig } = useAppStore();
  const config = appConfig || {
    title: 'Sistema de Control de Pagos',
    logoUrl: '',
    directorNombre: 'LIC. ARTURO RODRIGUEZ ISLAS',
    directorCargo: 'DIRECTOR DE CONTROL ESCOLAR',
    claveInstitucion: '',
  };
  
  const [title, setTitle]                   = useState(config.title);
  const [logoUrl, setLogoUrl]               = useState(config.logoUrl);
  const [directorNombre, setDirectorNombre] = useState(config.directorNombre);
  const [directorCargo, setDirectorCargo]   = useState(config.directorCargo);
  const [claveInstitucion, setClaveInstitucion] = useState(config.claveInstitucion || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (PNG, JPG, SVG, etc.)');
      return;
    }
    if (file.size > 500 * 1024) {
      setError('La imagen no debe superar los 500 KB. Usa una imagen más pequeña o comprimida.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => { setLogoUrl(reader.result as string); };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    const err = await updateAppConfig(title, logoUrl, directorNombre, directorCargo, claveInstitucion);
    if (err) {
      setError(err);
    } else {
      setAppConfig({ title, logoUrl, directorNombre, directorCargo, claveInstitucion, constanciaParams: appConfig?.constanciaParams ?? DEFAULT_CONSTANCIA_PARAMS });
      onBack();
    }
    setLoading(false);
  };

  const isBase64 = logoUrl.startsWith('data:');

  const INPUT = 'w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8 transition-colors duration-300">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 transition-colors duration-300">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Configuración de la Aplicación</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Personaliza el título, logotipo y datos institucionales del sistema.</p>
          </div>
        </div>

        {/* Error global */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900/60">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* ── Título ── */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <Type size={18} className="text-indigo-500" /> Título de la Aplicación
            </label>
            <input
              type="text"
              className={INPUT}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Sistema de Control de Pagos"
            />
          </div>

          {/* ── Logotipo ── */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <ImageIcon size={18} className="text-pink-500" /> Logotipo de la Institución
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="logo-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-pink-50 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 rounded-lg font-semibold hover:bg-pink-100 dark:hover:bg-pink-900/50 transition-colors text-sm"
              >
                <Upload size={16} /> {logoUrl ? 'Cambiar imagen' : 'Subir imagen'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 size={15} /> Eliminar
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Formatos aceptados: PNG, JPG, SVG, WebP. Tamaño máximo: 500 KB. Se recomienda fondo transparente.
            </p>
            {logoUrl && (
              <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 flex flex-col items-center transition-colors">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Vista Previa</span>
                <img
                  src={logoUrl}
                  alt="Logo Preview"
                  className="h-16 object-contain"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                {isBase64 && (
                  <span className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                    ✓ Almacenado localmente (Base64)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Firmante / Director ── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck size={18} className="text-indigo-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Datos del Firmante (Director de Control Escolar)</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
              Estos datos aparecerán en las constancias y documentos oficiales generados por el sistema.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <UserCheck size={18} className="text-indigo-500" /> Nombre del Director(a)
                </label>
                <input
                  type="text"
                  className={INPUT}
                  value={directorNombre}
                  onChange={e => setDirectorNombre(e.target.value)}
                  placeholder="Ej. LIC. MARÍA PÉREZ"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <UserCheck size={18} className="text-indigo-500" /> Cargo del Director(a)
                </label>
                <input
                  type="text"
                  className={INPUT}
                  value={directorCargo}
                  onChange={e => setDirectorCargo(e.target.value)}
                  placeholder="Ej. DIRECTORA GENERAL"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Type size={18} className="text-indigo-500" /> Clave de la Institución
                </label>
                <input
                  type="text"
                  className={INPUT}
                  value={claveInstitucion}
                  onChange={e => setClaveInstitucion(e.target.value)}
                  placeholder="Ej. 1234567890"
                />
              </div>
            </div>
          </div>

          {/* Guardar */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex justify-end">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Guardando...' : <><Save size={20} /> Guardar Configuración</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
