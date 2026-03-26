import React, { useState } from 'react';
import { AppConfig } from '../types';
import { updateAppConfig } from '../lib/supabase';
import { Save, Image as ImageIcon, Type, ArrowLeft } from 'lucide-react';

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
            <ImageIcon size={18} className="text-pink-500" /> URL del Logotipo
          </label>
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none transition-all"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="Ej. https://midominio.com/logo.png"
          />
          <p className="text-xs text-gray-500 mt-2">
            Pega el enlace web de la imagen. Recomendado: imagen con fondo transparente en formato PNG o SVG.
          </p>
          
          {logoUrl && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col items-center">
              <span className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Vista Previa</span>
              <img src={logoUrl} alt="Logo Preview" className="h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
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
