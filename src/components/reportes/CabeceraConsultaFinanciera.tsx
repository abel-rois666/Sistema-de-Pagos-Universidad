import type { ReactNode } from 'react';

export default function CabeceraConsultaFinanciera({ titulo, descripcion, icono, acciones, children }: {
  titulo: string; descripcion: string; icono: ReactNode; acciones?: ReactNode; children?: ReactNode;
}) {
  return <header className="cf-cabecera">
    <div className="cf-cabecera-fila">
      <div className="cf-identidad"><span className="cf-icono" aria-hidden="true">{icono}</span>
        <div><h2>{titulo}</h2><p>{descripcion}</p></div>
      </div>
      {acciones && <div className="cf-acciones">{acciones}</div>}
    </div>
    {children}
  </header>;
}
