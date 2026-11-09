/** Fechas civiles del expediente: no convertir una fecha de nacimiento a UTC. */
export function fechaPersonal(valor?: string | null): string {
  if (!valor) return 'Sin registrar';
  const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);
  return Number.isNaN(fecha.getTime()) ? 'Fecha no válida' : fecha.toLocaleDateString('es-MX');
}

export function edadPersonal(valor?: string | null, hoy = new Date()): number | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia, 12);
  const corte=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate(),12);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia || fecha > corte) return null;
  const cumplio = hoy.getMonth() > mes - 1 || (hoy.getMonth() === mes - 1 && hoy.getDate() >= dia);
  return hoy.getFullYear() - anio - (cumplio ? 0 : 1);
}

export function antiguedadPersonal(valor?: string | null, hoy = new Date()): string | null {
  if (!valor || edadPersonal(valor, hoy) === null) return null;
  const [anio, mes, dia] = valor.split('-').map(Number);
  let meses = (hoy.getFullYear() - anio) * 12 + hoy.getMonth() - (mes - 1);
  if (hoy.getDate() < dia) meses--;
  if (meses < 1) return 'Menos de un mes';
  const anios = Math.floor(meses / 12), resto = meses % 12;
  return [anios ? `${anios} año${anios === 1 ? '' : 's'}` : '', resto ? `${resto} mes${resto === 1 ? '' : 'es'}` : ''].filter(Boolean).join(' ');
}
