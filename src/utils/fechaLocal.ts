/** Fecha civil del equipo, igual que la fecha mostrada en la captura; no convierte a UTC. */
export function fechaLocalISO(fecha = new Date()): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}
