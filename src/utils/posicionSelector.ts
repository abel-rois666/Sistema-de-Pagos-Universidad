export interface PosicionSelector {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
}

/** Coordenadas del viewport: al abrir arriba, anclar el borde inferior al control. */
export function posicionarSelector(
  ancla: { left: number; top: number; bottom: number; width: number },
  ventana: { width: number; height: number },
  alturaContenido: number,
): PosicionSelector {
  const margen = 12, separacion = 6;
  const width = Math.min(Math.max(ancla.width, 260), Math.max(0, ventana.width - margen * 2));
  const debajo = Math.max(0, ventana.height - ancla.bottom - margen - separacion);
  const encima = Math.max(0, ancla.top - margen - separacion);
  const alturaNecesaria = Math.min(340, Math.max(0, alturaContenido));
  const abajo = debajo >= alturaNecesaria || debajo >= encima;
  return {
    width,
    left: Math.max(margen, Math.min(ancla.left, ventana.width - width - margen)),
    maxHeight: Math.min(340, abajo ? debajo : encima),
    top: abajo ? ancla.bottom + separacion : undefined,
    bottom: abajo ? undefined : ventana.height - ancla.top + separacion,
  };
}
