import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarDatosEgresados, mensajeErrorReporteEgresados, type FuenteReporteEgresados, type InscripcionResumenEgresado } from '../src/reportes/consultaEgresados';

const ciclos = [{ id: 'anterior', nombre: '2026-2' }, { id: 'actual', nombre: '2027-1' }];
const control = () => new AbortController();
const esperarTurno = () => new Promise<void>(r => setImmediate(r));

test('egresados: limita concurrencia, pagina sin truncar y conserva el criterio histórico', async () => {
  const ids = Array.from({ length: 61 }, (_, i) => `alumno${i}`);
  const historial: InscripcionResumenEgresado[] = Array.from({ length: 501 }, () => ({ alumno_id: ids[0], ciclo_id: 'anterior', ciclo_legado: null }));
  historial.push({ alumno_id: ids[0], ciclo_id: 'actual', ciclo_legado: null });
  historial.push({ alumno_id: ids[1], ciclo_id: 'actual', ciclo_legado: '2025-3' });
  historial.push({ alumno_id: ids[2], ciclo_id: null, ciclo_legado: null });
  let activas = 0, maximas = 0;
  const paginas: number[] = [], progresos: number[] = [];
  async function leer<T>(filas: T[]): Promise<T[]> { activas++; maximas = Math.max(maximas, activas); await esperarTurno(); activas--; return filas; }
  const fuente: FuenteReporteEgresados = {
    inscripciones: ({ ids: lote, desde, cantidad }) => { paginas.push(desde); return leer(historial.filter(i => lote.includes(i.alumno_id)).slice(desde, desde + cantidad)); },
    certificaciones: ({ ids: lote, desde, cantidad }) => leer([{ alumno_id: ids[0], tramite_completado: true }, { alumno_id: ids[1], tramite_completado: false }].filter(i => lote.includes(i.alumno_id)).slice(desde, desde + cantidad))
  };
  const resultado = await consultarDatosEgresados(fuente, ids, ciclos, { signal: control().signal, progreso: n => progresos.push(n) });
  assert.equal(maximas, 2);
  assert.ok(paginas.includes(500));
  assert.equal(resultado.ciclosEgresoMap[ids[0]], '2027-1');
  assert.equal(resultado.ciclosEgresoMap[ids[1]], '2025-3'); // El texto importado conserva su prioridad.
  assert.equal(resultado.tieneKardexMap[ids[2]], true);
  assert.equal(resultado.ciclosEgresoMap[ids[2]], undefined);
  assert.equal(resultado.tieneKardexMap[ids[3]], false);
  assert.equal(resultado.certificacionMap[ids[0]], 'Completado');
  assert.equal(resultado.certificacionMap[ids[1]], 'En curso');
  assert.equal(resultado.certificacionMap[ids[2]], 'Sin iniciar');
  assert.equal(progresos.at(-1), 100);
  assert.ok(progresos.slice(0, -1).every(n => n < 100));
  assert.ok(progresos.every((n, i) => i === 0 || n >= progresos[i - 1]));
});

test('egresados: un timeout reduce lotes dentro del mismo límite y no duplica el resultado', async () => {
  let activas = 0, maximas = 0, reducciones = 0;
  const ids = Array.from({ length: 23 }, (_, i) => `a${i}`);
  const fuente: FuenteReporteEgresados = {
    certificaciones: async () => [],
    inscripciones: async ({ ids: lote, desde, cantidad }) => {
      activas++; maximas = Math.max(maximas, activas); await esperarTurno(); activas--;
      if (lote.length > 3) { reducciones++; throw { code: '57014' }; }
      return lote.map(alumno_id => ({ alumno_id, ciclo_id: 'actual', ciclo_legado: null })).slice(desde, desde + cantidad);
    }
  };
  const resultado = await consultarDatosEgresados(fuente, ids, ciclos, { signal: control().signal });
  assert.ok(reducciones > 0); assert.ok(maximas <= 2);
  assert.equal(Object.keys(resultado.ciclosEgresoMap).length, 23);
  assert.ok(Object.values(resultado.ciclosEgresoMap).every(c => c === '2027-1'));
});

test('egresados: el primer fallo cancela peticiones en vuelo y no inicia la cola pendiente', async () => {
  const fallo = { code: '42501', message: 'Sin permiso' };
  let iniciadas = 0, canceladas = 0;
  const fuente: FuenteReporteEgresados = {
    certificaciones: ({ signal }) => { iniciadas++; return new Promise((_, rechazar) => signal.addEventListener('abort', () => { canceladas++; rechazar(new DOMException('Cancelada', 'AbortError')); }, { once: true })); },
    inscripciones: async () => { iniciadas++; throw fallo; }
  };
  await assert.rejects(consultarDatosEgresados(fuente, Array.from({ length: 100 }, (_, i) => `${i}`), ciclos, { signal: control().signal }), e => e === fallo);
  assert.equal(iniciadas, 2); assert.equal(canceladas, 1);
});

test('egresados: limpiar el efecto antes del inicio no abre consultas (StrictMode)', async () => {
  const ctrl = control(); let llamadas = 0;
  const leer = async () => { llamadas++; return []; };
  const consulta = consultarDatosEgresados({ certificaciones: leer, inscripciones: leer }, ['a'], ciclos, { signal: ctrl.signal });
  ctrl.abort();
  await assert.rejects(consulta, { name: 'AbortError' });
  assert.equal(llamadas, 0);
});

test('egresados: cancelar durante la carga aborta las dos consultas y no informa éxito', async () => {
  const ctrl = control(); let llamadas = 0, canceladas = 0;
  const progresos: number[] = [];
  const leer = ({ signal }: { signal: AbortSignal }) => new Promise<never>((_, rechazar) => {
    llamadas++; signal.addEventListener('abort', () => { canceladas++; rechazar(new DOMException('Cancelada', 'AbortError')); }, { once: true });
  });
  const consulta = consultarDatosEgresados({ certificaciones: leer, inscripciones: leer }, ['a'], ciclos, { signal: ctrl.signal, progreso: n => progresos.push(n) });
  await esperarTurno(); ctrl.abort();
  await assert.rejects(consulta, { name: 'AbortError' });
  assert.equal(llamadas, 2); assert.equal(canceladas, 2); assert.ok(!progresos.includes(100));
});

test('egresados: una conexión colgada tiene plazo finito y no genera reintentos en cascada', async () => {
  let llamadas = 0;
  const leer = async () => { llamadas++; return new Promise<never>(() => {}); };
  await assert.rejects(consultarDatosEgresados({ certificaciones: leer, inscripciones: leer }, ['a', 'b'], ciclos, { signal: control().signal, limiteMs: 20 }), e => (e as { code: string }).code === 'CLIENT_TIMEOUT');
  assert.equal(llamadas, 2);
});

test('egresados: si un alumno sigue excediendo el tiempo se rechaza todo el reporte', async () => {
  let avances = 0;
  const fuente: FuenteReporteEgresados = { certificaciones: async () => [], inscripciones: async () => { throw { code: '57014' }; } };
  await assert.rejects(consultarDatosEgresados(fuente, ['a'], ciclos, { signal: control().signal, progreso: n => { if (n === 100) avances++; } }), e => (e as { code: string }).code === '57014');
  assert.equal(avances, 0);
  assert.match(mensajeErrorReporteEgresados({ code: '57014' }), /reducir los lotes/);
});

test('egresados: una población vacía finaliza sin consultas ni alumnos inventados', async () => {
  const leer = async () => { throw new Error('No debe consultar'); };
  const resultado = await consultarDatosEgresados({ certificaciones: leer, inscripciones: leer }, [], ciclos, { signal: control().signal });
  assert.deepEqual(resultado, { ciclosEgresoMap: {}, tieneKardexMap: {}, certificacionMap: {} });
});

test('egresados: un límite de respuesta del servidor menor a la página no pierde historial', async () => {
  const historial = Array.from({ length: 12 }, (_, i) => ({ alumno_id: 'a', ciclo_id: i === 11 ? 'actual' : 'anterior', ciclo_legado: null }));
  const offsets: number[] = [];
  const resultado = await consultarDatosEgresados({ certificaciones: async () => [], inscripciones: async ({ desde }) => { offsets.push(desde); return historial.slice(desde, desde + 5); } }, ['a'], ciclos, { signal: control().signal });
  assert.equal(resultado.ciclosEgresoMap.a, '2027-1');
  assert.deepEqual(offsets, [0, 5, 10, 12]);
});
