import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { edad911, avance911, avanceOficial911, calcular911, deduplicar911, diagnosticoCierre911, validarCampo911 } from '../src/estadistica911/calculo';
import { evaluar911, aplicarReglas911 } from '../src/estadistica911/reglas';
import { generarTxt911, resumenRespaldo911, filasRespaldo911, codigoLayout911, exportarCuestionarios911, xlsxRespaldo911, pdfRespaldo911, pdfCuestionario911 } from '../src/estadistica911/exportar';
import { CORTE_EDICION911, cortePendiente911, erroresCorte911, invalidarCorte911, notasCorte911 } from '../src/estadistica911/corte';
import { consolidar911 } from '../src/estadistica911/consolidacion';
import { CONFIG_INICIAL911, type Expediente911, type Instancia911, type Persona911, type Fuente911 } from '../src/estadistica911/types';
import { CUESTIONARIOS } from '../src/estadistica911/types';
const fuente = (q: string): Fuente911 => JSON.parse(readFileSync(`public/911/2026-2027/${q}.json`, 'utf8'));
const instancia = (): Instancia911 => ({
  id: 'carrera-1',
  cuestionario: 'carrera',
  identidad: {
    ...fuente('carrera').layout!.identidades[0],
    CV_DURACION: '5'
  },
  respuestas: {},
  correspondencia: {
    planes: ['plan'],
    confirmada: true,
    periodosPorAnio: 3,
    nivel: 'LICENCIATURA'
  },
  bloques: {}
});
const persona = (c: Partial<Persona911> = {}): Persona911 => ({
  id: 'inscripcion',
  alumno_id: 'alumno',
  programa_id: 'programa',
  plan_id: 'plan',
  ciclo_id: 'actual',
  matricula: 'FICTICIA-001',
  nombre: 'Persona de prueba',
  programa: 'Plan de prueba',
  modalidad: 'ESCOLARIZADA',
  tipo_ingreso: 'REINGRESO',
  grado: '7MO',
  sexo: 'M',
  nacimiento: '2003-10-01',
  desde: '2026-08-01',
  hasta: null,
  situacion: 'ACTIVO',
  confirmado: true,
  evidencia: 'Documento de prueba',
  discapacidad: false,
  indigena: false,
  pais_nacimiento: 'MX',
  ...c
});
function expediente(): Expediente911 {
  return {
    id: 'exp',
    nombre: 'Prueba',
    estado: 'BORRADOR',
    revision: 2,
    version: 1,
    catalogoHash: 'prueba',
    config: {
      ...CONFIG_INICIAL911,
      actualInicio: '2026-08-01',
      edadReferencia: '2026-09-30',
      anteriorInicio: '2025-08-01',
      anteriorFin: '2026-07-31',
      ciclosMatricula: ['actual'],
      ciclosAnteriores: ['anterior'],
      coberturas: Object.fromEntries(['matricula', 'primerIngreso', 'primerIngresoAnterior', 'egresados', 'titulados'].map(k => ['carrera-1:' + k, 'Lista acreditada']))
    },
    instancias: [instancia()],
    incidencias: [],
    revisiones: {}
  };
}
test('edad al corte, ordinales y avance usan grado personal, sin inferir reingreso', () => {
  assert.equal(edad911('2003-10-01', '2026-09-30'), 22);
  assert.equal(edad911('2003-10-01', '2026-10-01'), 23);
  assert.equal(edad911('2026-02-30', '2026-09-30'), null);
  assert.equal(avance911('7MO', 3), 3);
  assert.equal(avance911('1ER', 2), 1);
  assert.equal(avance911('EGRESADO', 3), null);
});

test('el corte original sigue siendo compatible con expedientes anteriores sin metadatos nuevos', () => {
  const e = expediente();
  assert.equal(e.config.corte, CORTE_EDICION911);
  assert.equal(cortePendiente911(e), false);
  assert.deepEqual(erroresCorte911(e), []);
  assert.deepEqual(notasCorte911(e), []);
});

test('el corte personalizado exige opción, motivo y un cálculo aplicado para esa fecha', () => {
  const e = expediente();
  e.config.corte = '2026-10-31';
  assert.equal(erroresCorte911(e).length, 3);
  e.config.cortePersonalizado = true;
  e.config.motivoCorte = 'Matrícula institucional acreditada al cierre de octubre.';
  assert.equal(erroresCorte911(e).length, 1);
  e.corteCalculado = e.config.corte;
  assert.deepEqual(erroresCorte911(e), []);
  assert.ok(notasCorte911(e).join(' ').includes(CORTE_EDICION911));
  e.config.motivoCorte = 'x'.repeat(2001);
  assert.ok(erroresCorte911(e).some(x => x.includes('2000')));
});

test('cambiar el corte retira cálculo y acreditaciones actuales, preservando ajustes y fuentes históricas', () => {
  const e = expediente();
  e.config.coberturas!.personal = 'Expediente de personal';
  e.revisiones.carrera = 'Revisado antes';
  e.instancias[0].respuestas.V177 = { calculado: 10, declarado: 12, justificacion: 'Ajuste acreditado', evidencia: 'Acta', origen: 'Matrícula', revisada: true };
  const n = invalidarCorte911({ ...e, config: { ...e.config, corte: '2026-10-31' } });
  assert.equal(n.instancias[0].respuestas.V177.calculado, null);
  assert.equal(n.instancias[0].respuestas.V177.declarado, 12);
  assert.equal(n.instancias[0].respuestas.V177.justificacion, 'Ajuste acreditado');
  assert.equal(n.instancias[0].respuestas.V177.revisada, false);
  assert.equal(n.config.coberturas!['carrera-1:matricula'], undefined);
  assert.equal(n.config.coberturas!.personal, undefined);
  assert.equal(n.config.coberturas!['carrera-1:egresados'], 'Lista acreditada');
  assert.deepEqual(n.revisiones, {});
  assert.equal(e.instancias[0].respuestas.V177.calculado, 10);
  assert.equal(cortePendiente911(n), true);
  const regreso = invalidarCorte911({ ...n, config: { ...n.config, corte: CORTE_EDICION911 } });
  assert.equal(cortePendiente911(regreso), true, 'Volver al corte original también exige recalcular');
});

test('la matrícula utiliza el corte elegido y mantiene independiente la referencia de edad', () => {
  const e = expediente();
  const alumnos = [persona(), persona({ id: 'octubre', alumno_id: 'nuevo', programa_id: 'nuevo-programa', desde: '2026-10-05' })];
  const anterior = calcular911(e, alumnos);
  assert.equal(anterior.instancias[0].respuestas.V177.calculado, 1);
  e.config.corte = '2026-10-31';
  const actual = calcular911(e, alumnos);
  assert.equal(actual.instancias[0].respuestas.V177.calculado, 2);
  assert.equal(e.config.edadReferencia, '2026-09-30');
});

test('no se exportan cifras de un corte pendiente; el TXT personalizado lleva control sin alterar el layout', async () => {
  const e = expediente();
  e.config.corte = '2026-10-31';
  e.config.cortePersonalizado = true;
  e.config.motivoCorte = 'Corte de matrícula autorizado al cierre de octubre.';
  const fs = { carrera: fuente('carrera') };
  await assert.rejects(() => exportarCuestionarios911(e, e.instancias, fs, 'TXT'), /Recalcula/);
  await assert.rejects(() => pdfCuestionario911(e, e.instancias[0], fs.carrera), /Recalcula/);
  await assert.rejects(() => pdfRespaldo911(e, e.instancias, []), /Recalcula/);
  await assert.rejects(() => xlsxRespaldo911(e, e.instancias, []), /Recalcula/);
  e.corteCalculado = e.config.corte;
  const a = await exportarCuestionarios911(e, e.instancias, fs, 'TXT');
  assert.ok(a.nombre.endsWith('.zip'));
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(a.bytes);
  const control = JSON.parse(await zip.file('control.json')!.async('string'));
  assert.equal(control.corte, '2026-10-31');
  assert.equal(control.corteEdicion, CORTE_EDICION911);
  assert.equal(control.motivoCorte, e.config.motivoCorte);
  assert.equal(await zip.file('C911.CARRERA.txt')!.async('string'), generarTxt911(e.instancias, fs.carrera));
  assert.ok((await zip.file('LEEME-CORTE.txt')!.async('string')).includes('OFICIALIZADO=0'));
});
test('matrícula deduplica materias/grupos y excluye inscripciones posteriores, bajas y otro plan', () => {
  const e = expediente();
  const p = persona();
  const r = calcular911(e, [p, {
    ...p,
    id: 'otra-materia'
  }, persona({
    id: 'futura',
    alumno_id: 'futuro',
    desde: '2026-10-01'
  }), persona({
    id: 'baja',
    alumno_id: 'baja',
    situacion: 'BAJA'
  }), persona({
    id: 'otro-plan',
    alumno_id: 'otro',
    plan_id: 'otro'
  })]);
  assert.equal(r.instancias[0].respuestas.V177.calculado, 1);
  assert.equal(r.instancias[0].respuestas.V153.calculado, 1);
  assert.equal(r.respaldos.find(r => r.variable === 'V177')!.incluidos.length, 1);
  assert.ok(r.respaldos.find(r => r.variable === 'V177')!.excluidos.some(x => x.id === 'futura'));
  assert.equal(e.instancias[0].respuestas.V177, undefined);
});
test('faltante no equivale a cero; solo cobertura acreditada permite cero', () => {
  const e = expediente();
  e.config.coberturas = {};
  assert.equal(calcular911(e, []).instancias[0].respuestas.V177.calculado, null);
  assert.equal(calcular911(expediente(), []).instancias[0].respuestas.V177.calculado, 0);
  assert.equal(calcular911(expediente(), [persona({
    confirmado: false
  })]).instancias[0].respuestas.V177.calculado, null);
});
test('primer año reingresado no se transforma en primer ingreso y resultados usan eventos fechados', () => {
  const e = expediente();
  const r = calcular911(e, [persona({
    grado: '1ER'
  }), persona({
    id: 'evento',
    evento: 'TITULACION',
    fecha_evento: '2026-01-20',
    desde: '2026-01-20'
  }), persona({
    id: 'futuro-egreso',
    evento: 'EGRESO',
    fecha_evento: '2026-11-01'
  })]);
  assert.equal(r.instancias[0].respuestas.V90.calculado, 0);
  assert.equal(r.instancias[0].respuestas.V28.calculado, 1);
  assert.equal(r.instancias[0].respuestas.V23.calculado, 0);
});
test('ajuste agregado conserva cálculo y no fabrica alumnos de respaldo', () => {
  const e = expediente();
  e.instancias[0].respuestas.V177 = {
    calculado: null,
    declarado: 5,
    justificacion: 'Archivo histórico',
    evidencia: 'Expediente A',
    origen: 'Población: matricula'
  };
  const r = calcular911(e, [persona()]);
  const s = resumenRespaldo911(r.instancias[0], r.respaldos).find(s => s.variable === 'V177')!;
  assert.equal(s.calculado, 1);
  assert.equal(s.declarado, 5);
  assert.equal(s.diferencia, 4);
  assert.equal(filasRespaldo911(e, r.respaldos.filter(r => r.variable === 'V177')).length, 1);
});
test('motor de reglas cerrado conserva desconocidos, calcula totales y rechaza código arbitrario', () => {
  assert.equal(evaluar911('V1+V2', {
    V1: 2,
    V2: null
  }), null);
  assert.equal(evaluar911('(V1=2 AND V2=3) OR V3=0', {
    V1: 2,
    V2: 3,
    V3: null
  }), true);
  assert.equal(evaluar911('LEN(E1)>0', {
    E1: 'Sí'
  }), true);
  for (const s of ['globalThis.process.exit()', 'constructor.constructor(1)', 'V1; DROP TABLE alumnos', 'fetch(1)', 'V1**2']) assert.throws(() => evaluar911(s, {
    V1: 2
  }));
  const i = instancia();
  i.respuestas = {
    V1: {
      calculado: 1,
      origen: 'Prueba'
    },
    V2: {
      calculado: 2,
      declarado: 4,
      justificacion: 'Acta',
      evidencia: 'Acta',
      origen: 'Prueba'
    }
  };
  const r = aplicarReglas911(i, [{
    cuestionario: 'carrera',
    variable: 'V3',
    expresion: 'V3=V1+V2',
    mensaje: '',
    tipo: 'OPERACION',
    linea: 1,
    seccion: '1',
    pregunta: '1'
  }]);
  assert.equal(r.instancia.respuestas.V3.calculado, 5);
  assert.equal(i.respuestas.V3, undefined);
});
test('TXT conserva encabezados, orden, ceros explícitos, identidades, CRLF y bandera no oficial', () => {
  for (const q of ['carrera', 'posgrado', 'escuela', 'institucion']) {
    const f = fuente(q),
      i = {
        ...instancia(),
        cuestionario: q as any,
        identidad: f.layout!.identidades[0]
      };
    i.respuestas.V1 = {
      calculado: 0,
      origen: 'Prueba'
    };
    const txt = generarTxt911([i], f);
    const lines = txt.split('\r\n');
    assert.equal(lines[0], f.layout!.encabezado.join('|') + '|');
    assert.equal(lines[1].split('|').length, f.layout!.encabezado.length + 1);
    const row = Object.fromEntries(f.layout!.encabezado.map((h, n) => [h, lines[1].split('|')[n]]));
    assert.equal(row.OFICIALIZADO, '0');
    assert.equal(row.CV_CCT, i.identidad.CV_CCT);
    if ('V1' in row) assert.equal(row.V1, '0');
    assert.equal(lines.at(-1), '');
  }
  assert.throws(() => generarTxt911([instancia()], fuente('tecnologia')), /bloqueado/);
  assert.equal(codigoLayout911('V734', fuente('carrera')), 'E734');
});
test('consolidación escolar e institucional usa instancias y conserva sus alumnos', () => {
  const i = instancia();
  i.respuestas.V177 = {
    calculado: 1,
    origen: 'Prueba'
  };
  const escuela = {
    ...i,
    id: 'escuela-1',
    cuestionario: 'escuela' as const,
    respuestas: {}
  };
  const r = consolidar911([i, escuela], [{
    instancia: i.id,
    variable: 'V177',
    poblacion: 'matricula',
    incluidos: [persona()],
    excluidos: [],
    completa: true,
    incidencias: []
  }]);
  assert.equal(r.instancias[1].respuestas.V218.calculado, 1);
  assert.equal(r.respaldos.find(r => r.instancia === 'escuela-1' && r.variable === 'V218')!.incluidos.length, 1);
});
test('cierre y tipos rechazan pendientes, ausencia de revisión y valores fuera del formato', () => {
  const e = expediente();
  assert.ok(diagnosticoCierre911(e, {
    carrera: fuente('carrera')
  }).length > 10);
  assert.ok(validarCampo911('a|b', 'VARCHAR(30)'));
  assert.ok(validarCampo911(-1, 'SMALLINT'));
  assert.equal(validarCampo911(0, 'SMALLINT'), null);
  assert.ok(validarCampo911(1.5, 'SMALLINT'));
});
test('no se colapsan programas distintos del mismo alumno', () => {
  assert.equal(deduplicar911([persona(), persona({
    programa_id: 'segundo-programa'
  })]).length, 2);
});
test('la huella creada por el navegador coincide con el catálogo SQL y las plantillas originales', () => {
  const fuentes = Object.fromEntries(CUESTIONARIOS.map(q => [q, fuente(q)]));
  const hash = createHash('sha256').update(JSON.stringify(fuentes)).digest('hex');
  const sql = readFileSync('supabase/migrations/20261026110000_catalogo_oficial_911.sql', 'utf8');
  assert.ok(sql.includes(`'2026-2027','${hash}'`));
  for (const q of CUESTIONARIOS) assert.equal(createHash('sha256').update(readFileSync(`public/911/2026-2027/${q}.pdf`)).digest('hex'), fuentes[q].mapa.sha256);
});
test('inscripción sin confirmar de otro ciclo no bloquea la matrícula actual acreditada', () => {
  const e = expediente();
  const r = calcular911(e, [persona(), persona({
    id: 'otro-ciclo',
    alumno_id: 'otro',
    ciclo_id: 'anterior',
    confirmado: false
  })]);
  assert.equal(r.instancias[0].respuestas.V177.calculado, 1);
});
test('créditos/flexible exige equivalencia acreditada y semestres no se dividen como cuatrimestres', () => {
  const i = instancia();
  i.identidad.CV_DURACION = '8';
  assert.equal(avanceOficial911(persona(), i), null);
  assert.equal(avanceOficial911(persona({
    avance: 4
  }), i), 4);
  i.identidad.CV_DURACION = '2';
  assert.equal(avanceOficial911(persona(), i), null);
  i.correspondencia.periodosPorAnio = 2;
  assert.equal(avanceOficial911(persona(), i), 4);
});
test('un plan interno no se cuenta en dos instancias oficiales', () => {
  const e = expediente();
  e.instancias.push({
    ...instancia(),
    id: 'carrera-2'
  });
  const r = calcular911(e, [persona()]);
  assert.equal(r.instancias[0].respuestas.V177.calculado, null);
  assert.ok(r.incidencias.some(i => i.includes('más de una instancia')));
});
test('características de resultados anteriores se leen al evento y no al corte actual', () => {
  const e = expediente();
  const p = persona({
    evento: 'TITULACION',
    fecha_evento: '2026-01-20',
    caracteristicas: [{
      desde: '2025-01-01',
      hasta: '2026-06-30',
      datos: {
        discapacidad: false,
        indigena: false,
        pais_nacimiento: 'MX'
      }
    }, {
      desde: '2026-07-01',
      hasta: null,
      datos: {
        discapacidad: true,
        indigena: true,
        pais_nacimiento: 'MX'
      }
    }]
  });
  const r = calcular911(e, [p]);
  assert.equal(r.instancias[0].respuestas.V29.calculado, 0);
  const back = r.respaldos.find(r => r.variable === 'V28')!;
  assert.equal(back.incluidos[0].edad, 22);
  assert.equal(back.incluidos[0].caracteristicas, undefined);
});
test('las cadenas con espacios se interpretan como datos; una operación autorreferente no se aplica', () => {
  assert.equal(evaluar911("E1='No aplica'", {
    E1: 'No aplica'
  }), true);
  const i = instancia();
  i.respuestas.V1 = {
    calculado: 1,
    origen: 'Prueba'
  };
  const r = aplicarReglas911(i, [{
    cuestionario: 'carrera',
    variable: 'V1',
    expresion: 'V1=V1+1',
    mensaje: '',
    tipo: 'OPERACION',
    linea: 7,
    seccion: '1',
    pregunta: '1'
  }]);
  assert.equal(r.instancia.respuestas.V1.calculado, 1);
  assert.ok(r.incidencias.some(x => x.includes('autorreferente')));
});
