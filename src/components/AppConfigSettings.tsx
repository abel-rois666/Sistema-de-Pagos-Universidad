import React, { useState, useRef } from 'react';
import { AppConfig } from '../types';
import { updateAppConfig } from '../lib/supabase';
import { Save, Image as ImageIcon, Type, ArrowLeft, Upload, Trash2 } from 'lucide-react';

interface Props {
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
  onBack: () => void;
}

export const AppConfigSettings: React.FC<Props> = ({ config, onSave, onBack }) => {
  const [title, setTitle] = useState(config.title);
  const [logoUrl, setLogoUrl] = useState(config.logoUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (PNG, JPG, SVG, etc.)');
      return;
    }
    // Validar tamaño (máximo 500KB para no saturar la BD)
    if (file.size > 500 * 1024) {
      setError('La imagen no debe superar los 500 KB. Usa una imagen más pequeña o comprimida.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result as string); // Data URL base64
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    const err = await updateAppConfig(title, logoUrl);
    if (err) {
      setError(err);
    } else {
      onSave({ title, logoUrl });
      onBack();
    }
    setLoading(false);
  };

  const isBase64 = logoUrl.startsWith('data:');

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-200 mt-8">
      <div className="flex items-center gap-4 mb-6 pb-4 border-b">
        <button onClick={onBack} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Configuración de la Aplicación</h2>
          <p className="text-sm text-gray-500">Personaliza el título y el logotipo del sistema.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Type size={18} className="text-indigo-500" /> Título de la Aplicación
          </label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Sistema de Control de Pagos"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <ImageIcon size={18} className="text-pink-500" /> Logotipo de la Institución
          </label>

          {/* Botón para subir archivo */}
          <div className="flex items-center gap-3">
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
              className="flex items-center gap-2 px-4 py-2.5 bg-pink-50 border border-pink-200 text-pink-700 rounded-lg font-semibold hover:bg-pink-100 transition-colors text-sm"
            >
              <Upload size={16} /> {logoUrl ? 'Cambiar imagen' : 'Subir imagen'}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="flex items-center gap-1.5 px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 size={15} /> Eliminar
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Formatos aceptados: PNG, JPG, SVG, WebP. Tamaño máximo: 500 KB. Se recomienda fondo transparente.
          </p>
          
          {/* Vista previa */}
          {logoUrl && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col items-center">
              <span className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Vista Previa</span>
              <img src={logoUrl} alt="Logo Preview" className="h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              {isBase64 && (
                <span className="mt-2 text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                  ✓ Almacenado localmente (Base64)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="pt-6 border-t flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Guardando...' : <><Save size={20} /> Guardar Configuración</>}
          </button>
        </div>
      </div>
    </div>
  );
};
