import type { ColumnaCSVAlumno } from './detallesListadoCSV';

export type ColumnaEgresadosCSV = 'nombre' | 'licenciatura' | 'estatus' | 'ciclo' | 'telefonos' | 'email' | 'pagoTitulacion' | 'pagoCertificado' | 'certificacion';
interface ContextoEgresadosCSV {
  ciclosEgresoMap: Readonly<Record<string, string>>; tieneKardexMap: Readonly<Record<string, boolean>>;
  pagoTitulacionMap: Readonly<Record<string, string>>; pagoCertificadoMap: Readonly<Record<string, string>>; certificacionMap: Readonly<Record<string, string>>;
}
export function tituloEgresadosCSV(str: string) {
  if (!str) return '';
  const minusculas = ['de', 'la', 'del', 'las', 'los', 'y', 'en', 'el', 'a', 'por', 'para', 'con'];
  return str.split(' ').map((palabra, i) => i && minusculas.includes(palabra.toLowerCase()) ? palabra.toLowerCase() : palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()).join(' ');
}
/** El ciclo sigue siendo el dato derivado del alumno, nunca un egreso inferido por cada carrera. */
export function columnasEgresadosCSV(visibles: Readonly<Record<ColumnaEgresadosCSV, boolean>>, contexto: ContextoEgresadosCSV): ColumnaCSVAlumno[] {
  const columnas: (ColumnaCSVAlumno & { id: ColumnaEgresadosCSV })[] = [
    { id: 'nombre', nombre: 'Nombre completo', valor: a => tituloEgresadosCSV(a.nombre_completo) },
    { id: 'licenciatura', nombre: 'Licenciatura', valor: a => tituloEgresadosCSV(a.licenciatura) },
    { id: 'estatus', nombre: 'Estatus', valor: a => tituloEgresadosCSV(a.estatus || '') },
    { id: 'ciclo', nombre: 'Ciclo de egreso', nombreDetalle: 'Último ciclo del historial del alumno (referencia)', valor: a => contexto.ciclosEgresoMap[a.id] || (contexto.tieneKardexMap[a.id] ? 'Ciclo Desconocido' : 'Sin Kardex') },
    { id: 'telefonos', nombre: 'Teléfonos', valor: a => [a.telefono, a.celular].filter(Boolean).join(' / ') },
    { id: 'email', nombre: 'Correo electrónico', valor: a => (a.email || '').toLowerCase() },
    { id: 'pagoTitulacion', nombre: 'Pago de titulación', valor: a => contexto.pagoTitulacionMap[a.id] || 'Sin plan' },
    { id: 'pagoCertificado', nombre: 'Pago del certificado', valor: a => contexto.pagoCertificadoMap[a.id] || 'Sin registro' },
    { id: 'certificacion', nombre: 'Trámite de certificación', valor: a => contexto.certificacionMap[a.id] || 'Sin registro' }
  ];
  return columnas.filter(c => visibles[c.id]);
}
