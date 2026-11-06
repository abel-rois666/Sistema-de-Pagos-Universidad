import React, { useState, useRef, useEffect } from 'react';
import { cargarScriptExterno } from '../lib/cargarScriptExterno';
import { Cloud, ExternalLink, FolderOpen, Loader2, AlertCircle } from 'lucide-react';

interface DrivePickerProps {
  label: string;
  value: string | null;
  onSelect: (url: string) => void;
  disabled: boolean;
  isEditing: boolean;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

export default function DrivePicker({ label, value, onSelect, disabled, isEditing }: DrivePickerProps) {
  const [loading, setLoading] = useState(false);
  const [errorDrive, setErrorDrive] = useState('');
  const vigente = useRef(true);
  const pickerActivo = useRef<{ setVisible: (visible: boolean) => void } | null>(null);
  useEffect(() => { vigente.current = true; return () => { vigente.current = false; pickerActivo.current?.setVisible(false); }; }, []);
  const fallar = () => { if (vigente.current) { setLoading(false); setErrorDrive('No se pudo abrir Google Drive. Revisa la conexión, permite la ventana de autorización y vuelve a intentar.'); } };

  const handleOpenPicker = async () => {
    if (disabled || !isEditing || loading) return;
    if (!CLIENT_ID || !API_KEY) { setErrorDrive('Falta configurar la integración de Google Drive. Consulta a Administración.'); return; }
    setLoading(true);
    setErrorDrive('');
    try {
      await cargarScriptExterno('https://accounts.google.com/gsi/client');
      if (!vigente.current) return;
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        error_callback: fallar,
        callback: async (response: any) => {
          if (response.error !== undefined) {
            fallar();
            return;
          }
          void createPicker(response.access_token);
        },
      });
      tokenClient.requestAccessToken();
    } catch { fallar(); }
  };

  const createPicker = async (accessToken: string) => {
    try {
      await cargarScriptExterno('https://apis.google.com/js/api.js');
      if (!vigente.current) return;
      window.gapi.load('picker', {
        onerror: fallar, timeout: 15000, ontimeout: fallar,
        callback: () => {
          if (!vigente.current) return;
          try {
          const view = new window.google.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(true);
          const picker = new window.google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(accessToken)
            .setDeveloperKey(API_KEY)
            .setCallback((data: any) => {
              if (!vigente.current) return;
              if (data.action === window.google.picker.Action.PICKED) {
                const doc = data.docs[0];
                onSelect(doc.url);
              }
              if (data.action === window.google.picker.Action.CANCEL || data.action === window.google.picker.Action.PICKED) {
                setLoading(false);
              }
            })
            .build();
          pickerActivo.current = picker;
          picker.setVisible(true);
          } catch { fallar(); }
        }
      });
    } catch { fallar(); }
  };

  return (
    <div className="bg-white dark:bg-[#1c2228] rounded-[15px] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] overflow-hidden mt-6">
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] bg-[#f8f9ff] dark:bg-[#1e252b]">
        <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <FolderOpen size={18} />
          <span className="text-sm font-semibold uppercase tracking-wider">{label}</span>
        </div>
        {disabled && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md">
            <AlertCircle size={12} /> Se habilita al completar el trámite
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {errorDrive && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{errorDrive}</p>}
        {value ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-[10px] bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/30 gap-3">
            <div className="flex items-center gap-3 overflow-hidden w-full">
              <div className="p-2 bg-white dark:bg-[#1c2228] rounded-lg text-sky-500 shadow-sm shrink-0"><Cloud size={20} /></div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#45515e] dark:text-gray-300">Carpeta Vinculada</p>
                <p className="text-[10px] text-sky-600 dark:text-sky-400 truncate max-w-full">{value}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={value} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-sky-100 dark:hover:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-md transition-colors flex items-center gap-1.5 text-xs font-semibold">
                <ExternalLink size={14} /> Abrir
              </a>
              {isEditing && !disabled && (
                <button type="button" onClick={handleOpenPicker} className="text-[10px] font-bold text-sky-600 underline hover:text-sky-700 px-2">Cambiar</button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleOpenPicker}
            disabled={disabled || !isEditing}
            className={`w-full py-4 rounded-[12px] border-2 border-dashed flex flex-col items-center gap-2 transition-all
              ${disabled || !isEditing
                ? 'border-gray-200 dark:border-gray-800 text-gray-400 cursor-not-allowed'
                : 'border-sky-200 dark:border-sky-900/40 text-sky-600 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/10'}`}
          >
            {loading ? <Loader2 size={24} className="animate-spin" /> : <Cloud size={24} />}
            <span className="text-xs font-semibold">{loading ? 'Abriendo Google Drive...' : 'Vincular Expediente de Google Drive'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}
