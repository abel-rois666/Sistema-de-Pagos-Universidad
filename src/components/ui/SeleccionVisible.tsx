import React, { useEffect, useRef } from 'react';
import { estadoSeleccionVisible } from '../../utils/seleccionVisible';

interface Props {
  seleccion: readonly string[];
  visibles: readonly string[];
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  etiqueta?: string;
  className?: string;
}

export default function SeleccionVisible({ seleccion, visibles, onChange, etiqueta = 'Seleccionar filas visibles', className }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const estado = estadoSeleccionVisible(seleccion, visibles);
  useEffect(() => { if (input.current) input.current.indeterminate = estado.parcial; }, [estado.parcial]);
  return <input ref={input} type="checkbox" checked={estado.completa} disabled={!visibles.length} onChange={onChange} aria-label={etiqueta} title={etiqueta} className={className} />;
}
