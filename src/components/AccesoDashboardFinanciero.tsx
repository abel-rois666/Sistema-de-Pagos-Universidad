import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/** Acceso completo por tarjeta; la indicación «Acceder» no crea un segundo botón. */
export default function AccesoDashboardFinanciero({ titulo, descripcion, icono, onClick, horizontal = false, insignia }: {
  titulo: string;
  descripcion: string;
  icono: ReactNode;
  onClick: () => void;
  horizontal?: boolean;
  insignia?: ReactNode;
}) {
  return <button type="button" onClick={onClick}
    className={`tablero-tarjeta${horizontal ? ' tablero-tarjeta-operacion' : ''}`}>
    <span className="tablero-icono" aria-hidden="true">{icono}</span>
    <div className="tablero-tarjeta-texto">
      <h2 style={{ fontFamily: 'var(--font-display)' }}>{titulo}</h2>
      <p>{descripcion}</p>
    </div>
    {insignia && <span className="tablero-insignia">{insignia}</span>}
    {horizontal && <span className="tablero-acceder" aria-hidden="true">Acceder<ChevronRight size={15}/></span>}
  </button>;
}
