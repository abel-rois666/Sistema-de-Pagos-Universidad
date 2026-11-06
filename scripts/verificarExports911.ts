/** Ensayo con personas ficticias. Uso: node --import tsx scripts/verificarExports911.ts <salida> */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { crearExpediente911 } from '../src/estadistica911/fuentes';
import { CUESTIONARIOS, type Fuente911 } from '../src/estadistica911/types';
import { pdfCuestionario911, pdfRespaldo911, xlsxRespaldo911, generarTxt911 } from '../src/estadistica911/exportar';
import { nombreOferta911,nivelSugerido911 } from '../src/estadistica911/guia';
import { calcular911 } from '../src/estadistica911/calculo';
const output = process.argv[2];
if (!output) throw new Error('Indica un directorio de salida para el ensayo ficticio');
mkdirSync(output, {
  recursive: true
});
const fuentes = Object.fromEntries(CUESTIONARIOS.map(q => [q, JSON.parse(readFileSync(`public/911/2026-2027/${q}.json`, 'utf8')) as Fuente911]));
globalThis.fetch = async input => new Response(readFileSync(String(input).endsWith('/distinta.pdf') ? 'public/911/2026-2027/carrera.pdf' : 'public' + String(input)), {
  status: 200
});
const exp = await crearExpediente911(fuentes);
if (process.argv.includes('--corte-personalizado')) {
  exp.config.corte = '2026-10-31';
  exp.config.cortePersonalizado = true;
  exp.config.motivoCorte = 'Corte de prueba autorizado para matrícula de octubre, con evidencia institucional. '.repeat(25).slice(0, 2000);
  exp.corteCalculado = exp.config.corte;
}
exp.id = 'expediente-ficticio';
exp.config.ofertaConfirmada=true;
for(const i of exp.instancias.filter(i=>['carrera','posgrado'].includes(i.cuestionario)))i.correspondencia={planes:['ficticio-'+i.id],confirmada:true,nivel:nivelSugerido911(i),nombre:nombreOferta911(i)};
exp.revision = 3;
exp.config.nombreInstitucion = 'Institución de prueba · Educación Superior';
exp.config.nombrePlantel = 'Escuela de prueba · San José';
exp.config.responsable = 'Responsable de prueba';
exp.config.cargo = 'Control Escolar';
exp.config.fechaLlenado = '2026-10-26';
exp.config.edadReferencia = '2026-09-30';
for (const i of exp.instancias) {
  i.correspondencia.nombre = 'Oferta de prueba · Información con acentos';
  for (const [n, c] of fuentes[i.cuestionario].campos.entries()) if (/^[VE]\d+$/.test(c.codigo) && c.fase !== 'FIN') i.respuestas[c.codigo] = {
    calculado: n % 7 === 0 ? null : /INT/.test(c.tipo) ? n % 3 === 0 ? 123456 : 0 : 'Texto de prueba con acentos: Educación, José, investigación y enseñanza. '.repeat(4),
    origen: 'Ensayo con datos ficticios'
  };
}
for (const q of CUESTIONARIOS) {
  const i = exp.instancias.find(x => x.cuestionario === q)!;
  const bytes = await pdfCuestionario911(exp, i, fuentes[q]);
  const pdf = await PDFDocument.load(bytes);
  if (pdf.getPageCount() <= fuentes[q].mapa.paginas) throw new Error('Falta portada o continuación');
  writeFileSync(join(output, q + '.pdf'), bytes);
  if (fuentes[q].layout) writeFileSync(join(output, q + '.txt'), generarTxt911([i], fuentes[q]));
  console.log(`${q}: ${pdf.getPageCount()} páginas, ${bytes.length} bytes`);
}
const backups = calcular911(exp, []).respaldos;
writeFileSync(join(output, 'respaldo.pdf'), await pdfRespaldo911(exp, exp.instancias, backups));
writeFileSync(join(output, 'respaldo.xlsx'), await xlsxRespaldo911(exp, exp.instancias, backups));
// Una plantilla ajena debe bloquearse antes de escribir ninguna respuesta.
try {
  await pdfCuestionario911(exp, exp.instancias[0], {
    ...fuentes.carrera,
    mapa: {
      ...fuentes.carrera.mapa,
      sha256: 'distinta'
    }
  });
  throw new Error('No se bloqueó la plantilla');
} catch (e) {
  if (!(e as Error).message.includes('homologación')) throw e;
}
console.log('Huella distinta bloqueada; PDF, TXT y XLSX de ensayo generados.');
