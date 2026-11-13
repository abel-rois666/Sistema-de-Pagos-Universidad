import { useEffect, useState } from 'react';
import { fechaFinancieraHoy } from '../finanzas/vencimientos';

/** Reevalúa al volver a la pantalla y tras el cambio de día, sin consultar ni modificar datos. */
export function useFechaFinanciera() {
  const [fecha, setFecha] = useState(fechaFinancieraHoy);
  useEffect(() => {
    const actualizar = () => setFecha(fechaFinancieraHoy());
    const intervalo = window.setInterval(actualizar, 60_000);
    window.addEventListener('focus', actualizar); document.addEventListener('visibilitychange', actualizar);
    return () => { window.clearInterval(intervalo); window.removeEventListener('focus', actualizar); document.removeEventListener('visibilitychange', actualizar); };
  }, []);
  return fecha;
}
