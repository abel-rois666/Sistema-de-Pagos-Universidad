import assert from 'node:assert/strict';
import test from 'node:test';
import { documentosCoincidenConCiclos, esPrimerGradoPersonal, mensajeTelegramComunicado,
  componerMensajeConIngles, esNuevoIngresoSinBoleta, renderizarAvisoIngles,
  renderizarPlantillaMensaje, tieneHistorialAnterior, validarPlantillaIngles, validarPlantillaMensaje,
  seleccionarCalendario, seleccionarGruposConHorario, seleccionarPlanDePagos } from '../src/comunicados/preparacion';
import { esAsignaturaIngles } from '../src/utils/asignaturaIngles';
import { pagosProgramados } from '../src/comunicados/calendarioPagos';
import type { CalendarioAcademico } from '../src/calendario/service';
import type { PaymentPlan } from '../src/types';
import { cicloVisiblePlanPago, esPlanPagoTitulacion, validarCicloPlanPago } from '../src/utils/cicloPlanPago';

const calendario = (id: string, planIds: string[], turno: 'MATUTINO' | 'VESPERTINO'): CalendarioAcademico => ({
  id, ciclo_id: 'ciclo-1', nombre: id, tipo_periodo: 'CUATRIMESTRAL', modalidad: 'ESCOLARIZADA',
  fecha_inicio: '2027-01-01', fecha_fin: '2027-04-30', turnos: [turno], plan_ids: planIds,
});

test('el calendario exige coincidencia de ciclo, plan, modalidad y turno', () => {
  const programa = { planId: 'plan-1', tipoPeriodo: 'cuatrimestral', modalidad: 'Escolarizada', turno: 'matutino' };
  const resultado = seleccionarCalendario([
    calendario('otro-plan', ['plan-2'], 'MATUTINO'), calendario('otro-turno', ['plan-1'], 'VESPERTINO'),
    calendario('correcto', ['plan-1'], 'MATUTINO'),
  ], 'ciclo-1', programa);
  assert.equal(resultado.estado, 'LISTO');
  if (resultado.estado === 'LISTO') assert.equal(resultado.valor.id, 'correcto');
  assert.equal(seleccionarCalendario([
    calendario('a', ['plan-1'], 'MATUTINO'), calendario('b', ['plan-1'], 'MATUTINO'),
  ], 'ciclo-1', programa).estado, 'AMBIGUO');
});

test('el horario solo incluye grupos del alumno presentes en la versión publicada', () => {
  const grupos = [
    { id: 'g1', cicloId: 'ciclo-1', planId: 'plan-1', codigo: 'A' },
    { id: 'g2', cicloId: 'ciclo-1', planId: 'plan-2', codigo: 'B' },
    { id: 'g3', cicloId: 'ciclo-2', planId: 'plan-1', codigo: 'C' },
  ];
  const resultado = seleccionarGruposConHorario(grupos,
    { cicloId: 'ciclo-1', grupoIds: ['g1', 'g2', 'g3'] }, 'ciclo-1', 'plan-1');
  assert.equal(resultado.estado, 'LISTO');
  if (resultado.estado === 'LISTO') assert.deepEqual(resultado.valor.map(grupo => grupo.id), ['g1']);
  assert.equal(seleccionarGruposConHorario([
    grupos[0], { id: 'g4', cicloId: 'ciclo-1', planId: 'plan-1', codigo: 'D' },
  ], { cicloId: 'ciclo-1', grupoIds: ['g1'] }, 'ciclo-1', 'plan-1').estado, 'FALTANTE');
});

test('los pagos se seleccionan por ID y se detienen si hay varios planes completos', () => {
  const plan = (id: string, alumnoId: string, completo: boolean): PaymentPlan => ({
    id, alumno_id: alumnoId, ciclo_id: 'ciclo-1', nombre_alumno: 'Alumno', no_plan_pagos: id,
    fecha_plan: '', beca_porcentaje: '', beca_tipo: '', ciclo_escolar: '',
    concepto_1: 'Colegiatura', fecha_1: completo ? '2027-02-01' : '', cantidad_1: 100,
  } as PaymentPlan);
  assert.equal(seleccionarPlanDePagos([plan('ajeno', 'alumno-2', true),
    plan('incompleto', 'alumno-1', false)], 'alumno-1', 'ciclo-1').estado, 'FALTANTE');
  assert.equal(seleccionarPlanDePagos([plan('a', 'alumno-1', true),
    plan('b', 'alumno-1', true)], 'alumno-1', 'ciclo-1').estado, 'AMBIGUO');
  const ciclos = [
    { id: 'ciclo-1', nombre: '2027-1', tipo_periodo: 'Cuatrimestral', meses_abarca: '', anio: 2027, activo: true },
    { id: 'semestre', nombre: '2027-1', tipo_periodo: 'Semestral', meses_abarca: '', anio: 2027, activo: false },
  ];
  const otroCiclo = seleccionarPlanDePagos([], 'alumno-1', 'ciclo-1', ciclos,
    [{ id: 'plan-cuatrimestre', alumno_id: 'alumno-1', ciclo_id: 'semestre', tipo_plan: 'Cuatrimestral' }]);
  assert.equal(otroCiclo.estado, 'FALTANTE');
  if (otroCiclo.estado === 'FALTANTE') assert.match(otroCiclo.motivo, /otro ID de ciclo \(Semestral\)/);
  const otroTipo = seleccionarPlanDePagos([], 'alumno-1', 'ciclo-1', ciclos, [
    { id: 'plan-semestre', alumno_id: 'alumno-1', ciclo_id: 'semestre', tipo_plan: 'Semestral' },
    { id: 'plan-titulo', alumno_id: 'alumno-1', ciclo_id: 'semestre', tipo_plan: 'Titulación' },
  ]);
  assert.equal(otroTipo.estado, 'FALTANTE');
  if (otroTipo.estado === 'FALTANTE') {
    assert.match(otroTipo.motivo, /Comprueba la periodicidad del plan académico y su grupo/);
    assert.doesNotMatch(otroTipo.motivo, /Revisa su asociación/);
  }
  const tiposMezclados = seleccionarPlanDePagos([], 'alumno-1', 'ciclo-1', ciclos, [
    { id: 'plan-semestre', alumno_id: 'alumno-1', ciclo_id: 'semestre', tipo_plan: 'Semestral' },
    { id: 'plan-cuatrimestre', alumno_id: 'alumno-1', ciclo_id: 'semestre', tipo_plan: 'Cuatrimestral' },
  ]);
  assert.equal(tiposMezclados.estado, 'FALTANTE');
  if (tiposMezclados.estado === 'FALTANTE') assert.match(tiposMezclados.motivo, /Revisa su asociación/);
  const soloTitulacion = seleccionarPlanDePagos([
    { ...plan('titulo-del-ciclo', 'alumno-1', true), tipo_plan: 'Titulación' },
  ], 'alumno-1', 'ciclo-1', ciclos, [
    { id: 'titulo-homonimo', alumno_id: 'alumno-1', ciclo_id: 'semestre', tipo_plan: 'Titulación' },
  ]);
  assert.equal(soloTitulacion.estado, 'FALTANTE');
  if (soloTitulacion.estado === 'FALTANTE')
    assert.equal(soloTitulacion.motivo, 'El alumno no tiene plan de pagos en este ciclo.');
  assert.equal(esPlanPagoTitulacion(' TITULACIÓN '), true);
  assert.equal(esPlanPagoTitulacion('Semestral'), false);
  assert.equal(validarCicloPlanPago(ciclos[0], 'Cuatrimestral'), null);
  assert.match(validarCicloPlanPago(ciclos[1], 'Cuatrimestral') || '', /no corresponde/);
  assert.equal(cicloVisiblePlanPago(ciclos, 'Cuatrimestral', 'ciclo-1', 'semestre')?.id, 'ciclo-1');
  assert.equal(cicloVisiblePlanPago(ciclos, 'Semestral', 'ciclo-1', 'semestre')?.id, 'semestre');
});

test('el calendario de pagos incluye conceptos normalizados y rechaza un plan incompleto', () => {
  const base = {
    id: 'plan-1', alumno_id: 'alumno-1', ciclo_id: 'ciclo-1', nombre_alumno: 'Alumno',
    no_plan_pagos: '1', fecha_plan: '', beca_porcentaje: '', beca_tipo: '', ciclo_escolar: '',
  } as PaymentPlan;
  const completo = { ...base, concepto_1: 'Histórico', fecha_1: '2020-01-01', cantidad_1: 1,
    detalles: [{ id: 'd1', plan_id: 'plan-1', indice_concepto: 1, concepto: 'Inscripción',
      fecha_vencimiento: '2027-01-15', cantidad: 0, estatus: 'PENDIENTE' }] };
  assert.deepEqual(pagosProgramados(completo), [
    { numero: 1, concepto: 'Inscripción', fecha: '2027-01-15', cantidad: 0 },
  ]);
  assert.throws(() => pagosProgramados({ ...base, concepto_1: 'Colegiatura', cantidad_1: 10 }),
    /incompleto/);
});

test('un borrador antiguo o con boleta de otro ciclo no habilita enlace', () => {
  const documentos = [
    { tipo: 'BOLETA', ciclo_id: '2026-3' },
    { tipo: 'CALENDARIO', ciclo_id: '2027-1' },
    { tipo: 'HORARIO', ciclo_id: '2027-1' },
  ];
  assert.equal(documentosCoincidenConCiclos({ ciclo_boleta_id: '2026-3',
    comunicados_documentos: documentos }, '2027-1', '2026-3'), true);
  assert.equal(documentosCoincidenConCiclos({ ciclo_boleta_id: null,
    comunicados_documentos: documentos }, '2027-1', '2026-3'), false);
  assert.equal(documentosCoincidenConCiclos({ ciclo_boleta_id: '2026-3',
    comunicados_documentos: [{ tipo: 'BOLETA', ciclo_id: null }, ...documentos.slice(1)]
  }, '2027-1', '2026-3'), false);
  assert.equal(documentosCoincidenConCiclos({ ciclo_boleta_id: '2026-3',
    comunicados_documentos: documentos }, '2027-1', '2026-2'), false);
  assert.match(mensajeTelegramComunicado('Ana', '2027-1', 'https://drive.example', '2026-3'),
    /boleta corresponde al ciclo 2026-3/);
});

test('nuevo ingreso omite boleta solo con primer grado personal y sin historial del plan', () => {
  assert.equal(esNuevoIngresoSinBoleta('1', false), true);
  assert.equal(esNuevoIngresoSinBoleta('1ER', false), true);
  assert.equal(esNuevoIngresoSinBoleta('1°', false), true);
  assert.equal(esNuevoIngresoSinBoleta('1ER CUATRIMESTRE', false), true);
  assert.equal(esPrimerGradoPersonal('1-4'), false);
  assert.equal(esNuevoIngresoSinBoleta('1', true), false);
  assert.equal(esNuevoIngresoSinBoleta('2', false), false);
  assert.equal(esNuevoIngresoSinBoleta(null, false), false);
  const ciclosAnteriores = new Set(['2026-3', '2026-2']);
  assert.equal(tieneHistorialAnterior(['2027-1', null, '2027-2'], ciclosAnteriores), false);
  assert.equal(tieneHistorialAnterior(['2027-1', '2026-3'], ciclosAnteriores), true);
  const documentos = [
    { tipo: 'CALENDARIO', ciclo_id: '2027-1' }, { tipo: 'HORARIO', ciclo_id: '2027-1' },
  ];
  assert.equal(documentosCoincidenConCiclos({ ciclo_boleta_id: null, boleta_no_aplica: true,
    comunicados_documentos: documentos }, '2027-1', '2026-3'), true);
  assert.equal(documentosCoincidenConCiclos({ ciclo_boleta_id: null, boleta_no_aplica: false,
    comunicados_documentos: documentos }, '2027-1', '2026-3'), false);
  assert.equal(documentosCoincidenConCiclos({ ciclo_boleta_id: null, boleta_no_aplica: true,
    comunicados_documentos: [...documentos, { tipo: 'BOLETA', ciclo_id: '2026-3' }] },
  '2027-1', '2026-3'), false);
});

test('el aviso de Inglés depende de la materia y puede añadirse al mensaje individual', () => {
  assert.equal(esAsignaturaIngles('Inglés V'), true);
  assert.equal(esAsignaturaIngles('Ingles VIII'), true);
  assert.equal(esAsignaturaIngles('Redacción de Textos en Inglés'), false);
  assert.equal(validarPlantillaMensaje('Hola {nombre}. {enlace} {ciclo_boleta}', false),
    'El mensaje de nuevo ingreso no puede incluir {ciclo_boleta}.');
  assert.equal(validarPlantillaIngles('Cursas {materias_ingles}.'), null);
  assert.match(validarPlantillaIngles('Cursas {enlace}.') || '', /no disponible/);
  const datos = { nombre: 'ANA', matricula: '123', ciclo: '2027-1', ciclo_boleta: '', enlace: 'https://drive.example/a' };
  const base = renderizarPlantillaMensaje('Hola {nombre}.\n{enlace}', datos);
  const aviso = renderizarAvisoIngles('También cursas {materias_ingles}.', datos, ['Inglés V']);
  const resultado = componerMensajeConIngles(base, aviso, datos.enlace);
  assert.match(resultado, /También cursas Inglés V/);
  assert.equal(resultado.split(datos.enlace).length, 2);
  assert.equal(componerMensajeConIngles(base, '', datos.enlace), base);
});

test('la plantilla identifica al alumno y conserva un único enlace individual', () => {
  assert.equal(validarPlantillaMensaje('Hola {nombre} ({matricula}). Ciclo {ciclo}.\n{enlace}'), null);
  assert.match(validarPlantillaMensaje('Hola {nombre}. {enlace} {enlace}') || '', /exactamente una vez/);
  assert.match(validarPlantillaMensaje('Hola {nombre}. Documento {clave}. {enlace}') || '', /no está disponible/);
  const mensaje = renderizarPlantillaMensaje('Hola {nombre} · {matricula}. Ciclo {ciclo}; boleta {ciclo_boleta}.\n{enlace}', {
    nombre: 'ANA LÓPEZ', matricula: 'LD-123', ciclo: '2027-1', ciclo_boleta: '2026-3',
    enlace: 'https://drive.example/individual',
  });
  assert.match(mensaje, /ANA LÓPEZ · LD-123/);
  assert.match(mensaje, /Ciclo 2027-1; boleta 2026-3/);
  assert.equal(mensaje.split('https://drive.example/individual').length, 2);
});
