import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { eliminarAlumnosConDiagnostico } from '../services/eliminacionAlumnosService';
import type { ResultadoEliminacionAlumnos } from '../utils/eliminacionAlumnos';

export interface AlumnoAEliminar { id: string; nombre_completo: string; }
export function useEliminacionAlumnos(onEliminados: (ids: string[]) => void, onOcupado: (valor: boolean) => void) {
  const [confirmacion, setConfirmacion] = useState<AlumnoAEliminar[]>([]);
  const [bloqueo, setBloqueo] = useState<(ResultadoEliminacionAlumnos & { alumnos: AlumnoAEliminar[] }) | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);
  const solicitar = (alumnos: AlumnoAEliminar[]) => { if (!enCurso.current && alumnos.length) setConfirmacion(alumnos.map(a => ({ id: a.id, nombre_completo: a.nombre_completo }))); };
  const confirmar = async () => {
    if (enCurso.current || !confirmacion.length) return;
    enCurso.current = true; setOcupado(true); onOcupado(true); setBloqueo(null);
    try {
      const resultado = await eliminarAlumnosConDiagnostico(confirmacion.map(a => a.id));
      if (resultado.eliminados.length) {
        onEliminados(resultado.eliminados);
        toast.success(`${resultado.eliminados.length} alumno(s) eliminado(s).`);
      }
      if (resultado.mensaje) {
        setBloqueo({ ...resultado, alumnos: confirmacion });
        toast.error('Revisa el resultado de la eliminación en el aviso del padrón.');
      }
      setConfirmacion([]);
    } finally { enCurso.current = false; setOcupado(false); onOcupado(false); }
  };
  return { confirmacion, bloqueo, ocupado, solicitar, confirmar,
    cancelar: () => { if (!enCurso.current) setConfirmacion([]); }, cerrarAviso: () => setBloqueo(null) };
}
