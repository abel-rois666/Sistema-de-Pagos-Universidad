import { useState, useEffect } from 'react';
import { Lock, Unlock, Hourglass, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  val?: number | string | null;
  onChange: (valor: string) => void;
  isDocente: boolean;
  isAdmin: boolean;
  bloqueo?: boolean;
  solicitud?: boolean;
  toggleSolicitud: (solicitar: boolean) => void;
  toggleBloqueo: (bloquear: boolean) => void;
  isFinal?: boolean;
  isModificada?: boolean;
  onRestore?: () => void;
  etiqueta?: string;
}

export default function GradeCell({ val, onChange, isDocente, isAdmin, bloqueo, solicitud, toggleSolicitud, toggleBloqueo, isFinal, isModificada, onRestore, etiqueta }: Props) {
  const isLocked = isDocente && bloqueo && !solicitud;
  const isPending = solicitud;
  const canEdit = isAdmin || (!isLocked && !isPending);
  
  const hasValue = val !== null && val !== undefined && val !== '';

  const [localVal, setLocalVal] = useState(val === -555 ? 'NP' : (val ?? ''));

  useEffect(() => {
    setLocalVal(val === -555 ? 'NP' : (val ?? ''));
  }, [val]);

  const handleChange = (e: any) => {
    const raw = e.target.value.toUpperCase();
    
    // Bloquea cualquier caracter que no sea número, punto, N o P
    if (raw !== '' && !/^[0-9.NP]+$/.test(raw)) return;
    
    // Reglas de escritura estricta en tiempo real
    if (raw.includes('N') || raw.includes('P')) {
       // Si hay letras, solo permitimos que sea la letra N solita, o la palabra NP
       if (raw !== 'N' && raw !== 'NP') return;
    } else if (raw !== '') {
       // Si son números, máximo 1 punto decimal
       if ((raw.match(/\./g) || []).length > 1) return;
       // Validar que no escriban números exagerados (ej. 100) en tiempo real
       const num = parseFloat(raw);
       if (!isNaN(num) && num > 10) return;
    }

    setLocalVal(raw);
    
    if (raw === 'NP') {
      onChange('-555');
    } else if (raw === '') {
      onChange('');
    } else {
      const num = parseFloat(raw);
      if (!isNaN(num) && num >= 0 && num <= 10) {
        onChange(raw);
      }
    }
  };

  const handleBlur = () => {
    if (localVal !== 'NP' && localVal !== '') {
      const num = parseFloat(localVal);
      if (isNaN(num) || num < 0 || num > 10) {
        setLocalVal(val === -555 ? 'NP' : (val ?? ''));
        toast.error("Formato inválido. Ingrese 0-10 o NP");
      }
    }
  };

  const renderAdminButton = () => {
    if (!hasValue) return null; // No hay nada que bloquear si está vacío
    
    if (isPending) {
      return (
        <button
          onClick={() => { toggleSolicitud(false); toggleBloqueo(false); }}
          title="Aprobar solicitud y desbloquear"
          className="absolute -top-2 -right-2 p-1 rounded-full text-white shadow-md transition-transform hover:scale-110 bg-orange-500 z-10 animate-pulse"
        >
          <Hourglass size={12} />
        </button>
      );
    }
    
    if (bloqueo) {
      return (
        <button
          onClick={() => toggleBloqueo(false)}
          title="Desbloquear calificación"
          className="absolute -top-2 -right-2 p-1 rounded-full text-white shadow-md transition-transform hover:scale-110 bg-red-500 z-10"
        >
          <Lock size={10} />
        </button>
      );
    }
    
    return (
      <button
        onClick={() => toggleBloqueo(true)}
        title="Bloquear calificación"
        className="absolute -top-2 -right-2 p-1 rounded-full text-gray-500 bg-gray-200 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 shadow-sm transition-transform hover:scale-110 z-10 opacity-70 hover:opacity-100"
      >
        <Unlock size={10} />
      </button>
    );
  };

  const renderDocenteButton = () => {
    if (!bloqueo || !hasValue) return null;
    
    return (
      <button
        onClick={() => toggleSolicitud(!isPending)}
        title={isPending ? "Cancelar solicitud" : "Solicitar corrección"}
        className={`absolute -top-2 -right-2 p-1 rounded-full text-white shadow-md transition-transform hover:scale-110 ${isPending ? 'bg-orange-500' : 'bg-red-500'} z-10`}
      >
        {isPending ? <Hourglass size={10} /> : <Lock size={10} />}
      </button>
    );
  };

  return (
    <div className="relative inline-block w-16">
      <input
        aria-label={etiqueta || (isFinal ? "Calificación final" : "Calificación parcial")}
        type="text"
        maxLength={4}
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={!canEdit}
        className={`w-full p-1.5 text-center text-sm font-semibold rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all 
          ${isFinal ? 'font-bold' : ''}
          ${isModificada && isFinal ? 'border-yellow-400 dark:border-yellow-500/50 text-yellow-700 dark:text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)] bg-white dark:bg-[#181e25]' : 'bg-gray-50 dark:bg-[#181e25] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}
          ${(isLocked || isPending) && !isAdmin ? 'opacity-70 bg-gray-100 dark:bg-gray-800' : 'bg-white dark:bg-[#222b36]'}
          ${isAdmin && isPending ? 'border-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]' : 'border'}
        `}
      />
      {isFinal && isModificada && !isLocked && !isPending && (
        <button 
          onClick={onRestore}
          title="Restaurar cálculo original"
          className="absolute -top-2 -left-2 p-1 rounded-full text-white shadow-md transition-transform hover:scale-110 bg-yellow-500 hover:bg-yellow-600 z-10"
        >
          <RefreshCw size={10} className="hover:animate-spin" />
        </button>
      )}
      {isAdmin ? renderAdminButton() : renderDocenteButton()}
    </div>
  );
}

