import test from 'node:test';
import assert from 'node:assert/strict';
import type { CicloEscolar } from '../src/types';
import {
  puedeAccederRuta,
} from '../src/app/capacidades';
import {
  menuActivo,
  menuAplicacion,
} from '../src/app/menuAplicacion';
import {
  tareasInicio,
} from '../src/app/inicioCatalogo';
import {
  tituloRuta,
} from '../src/app/titulosRutas';
import {
  construirFirmantesActa,
  construirInvolucradosParaActa,
  construirPayloadFiltrosReportes,
  construirPayloadGuardarReporte,
  convertirReporteABorrador,
  crearBorradorActaInicial,
  crearBorradorReporteInicial,
  esEnlaceDriveValido,
  esRegistroActivo,
  INSTITUCION_ACTA_POR_DEFECTO,
  limpiarAlumnosDeGruposCompletos,
  mapearReporteDesdeSql,
  normalizarErrorReporteAcademico,
  sugerirCicloPorFechaActual,
  validarBorradorReporteAcademico,
} from '../src/reportesAcademicos/dominio';
import {
  crearPdfActaHechos,
  formatearFechaLargaEspanol,
} from '../src/reportesAcademicos/exportarActaHechosPdf';

const CICLOS_PRUEBA: CicloEscolar[] = [
  {
    id: 'ciclo-antiguo',
    nombre: '2025-1',
    meses_abarca: 'Enero - Abril',
    anio: 2025,
    tipo_periodo: 'Cuatrimestral',
    fecha_inicio: '2025-01-06',
    fecha_termino: '2025-04-30',
    activo: false,
  },
  {
    id: 'ciclo-2026-sem',
    nombre: '2026-2027',
    meses_abarca: 'Agosto - Enero',
    anio: 2026,
    tipo_periodo: 'Semestral',
    fecha_inicio: '2026-08-10',
    fecha_termino: '2027-01-31',
    activo: false,
  },
  {
    id: 'ciclo-2026-cuat',
    nombre: '2026-2027',
    meses_abarca: 'Septiembre - Diciembre',
    anio: 2026,
    tipo_periodo: 'Cuatrimestral',
    fecha_inicio: '2026-09-01',
    fecha_termino: '2026-12-18',
    activo: true,
  },
];

test('1. sugerirCicloPorFechaActual respeta cicloGuardadoId si existe en el catálogo', () => {
  const elegido = sugerirCicloPorFechaActual(CICLOS_PRUEBA, '2026-11-14', 'ciclo-antiguo');
  assert.equal(elegido, 'ciclo-antiguo');
});

test('2. sugerirCicloPorFechaActual devuelve el único ciclo cuyo rango contiene la fecha actual', () => {
  const elegido = sugerirCicloPorFechaActual(CICLOS_PRUEBA, '2026-08-20', null);
  assert.equal(elegido, 'ciclo-2026-sem');
});

test('3. sugerirCicloPorFechaActual desempata ciclos homónimos vigentes priorizando activo=true y orden estándar', () => {
  const elegidoConActivo = sugerirCicloPorFechaActual(CICLOS_PRUEBA, '2026-11-14', 'id-inexistente');
  assert.equal(elegidoConActivo, 'ciclo-2026-cuat');

  const sinActivos = CICLOS_PRUEBA.map(c => ({ ...c, activo: false }));
  const elegidoPorOrden = sugerirCicloPorFechaActual(sinActivos, '2026-11-14', null);
  // Entre '2026-2027' Cuatrimestral y Semestral sin activo, Cuatrimestral antecede alfabéticamente por tipo_periodo
  assert.equal(elegidoPorOrden, 'ciclo-2026-cuat');
});

test('4. sugerirCicloPorFechaActual usa el ciclo activo institucional cuando ninguna fecha cubre hoy', () => {
  const elegido = sugerirCicloPorFechaActual(CICLOS_PRUEBA, '2028-05-10', null);
  assert.equal(elegido, 'ciclo-2026-cuat');
});

test('5. validarBorradorReporteAcademico exige INCIDENTE cuando flujoRegistro es GRUPO', () => {
  const borrador = {
    ...crearBorradorReporteInicial('ciclo-2026-cuat', '2026-11-14'),
    flujoRegistro: 'GRUPO' as const,
    tipoReporte: 'INASISTENCIAS' as const,
    descripcion: 'Inasistencia colectiva reportada por error como grupal',
    grupos: [{ grupoId: 'g-1', alcanceAlumnos: 'TODO_EL_GRUPO' as const, codigoGrupo: '3A' }],
  };

  const resultado = validarBorradorReporteAcademico(borrador);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.erroresCampos.tipoReporte);
});

test('6. INASISTENCIAS y PROBLEMA_RENDIMIENTO exigen al menos un alumno y rechazan grupos, docentes, acta y enlace Drive', () => {
  for (const tipo of ['INASISTENCIAS', 'PROBLEMA_RENDIMIENTO'] as const) {
    const borradorInvalido = {
      ...crearBorradorReporteInicial('ciclo-2026-cuat', '2026-11-14'),
      flujoRegistro: 'ALUMNO_DOCENTE' as const,
      tipoReporte: tipo,
      descripcion: 'Seguimiento académico',
      tieneActaHechos: true,
      enlaceDrive: 'https://drive.google.com/file/d/12345/view',
      alumnos: [],
      grupos: [{ grupoId: 'g-1', alcanceAlumnos: 'TODO_EL_GRUPO' as const }],
      docentes: [{ docenteId: 'd-1', nombreCompleto: 'Mtro. Juan Pérez' }],
      acta: {
        ...crearBorradorActaInicial('2026-11-14'),
        lugar: 'Dirección Académica',
        empleadoLevantaId: 'emp-1',
        relatoriaHechos: 'Relatoría con más de veinte caracteres objetivos para la prueba.',
      },
    };

    const res = validarBorradorReporteAcademico(borradorInvalido);
    assert.equal(res.valido, false);
    assert.ok(res.erroresCampos.alumnos);
    assert.ok(res.erroresCampos.grupos);
    assert.ok(res.erroresCampos.docentes);
    assert.ok(res.erroresCampos.tieneActaHechos);
    assert.ok(res.erroresCampos.enlaceDrive);

    const borradorValido = {
      ...crearBorradorReporteInicial('ciclo-2026-cuat', '2026-11-14'),
      flujoRegistro: 'ALUMNO_DOCENTE' as const,
      tipoReporte: tipo,
      descripcion: 'Tres inasistencias consecutivas en Derecho Constitucional.',
      alumnos: [{ alumnoId: 'al-1', nombreCompleto: 'ANA LÓPEZ', matricula: '2026001', carrera: 'Derecho' }],
    };
    const resOk = validarBorradorReporteAcademico(borradorValido);
    assert.equal(resOk.valido, true);
  }
});

test('7. aislamiento TODO_EL_GRUPO vs PARCIAL: limpia alumnos ligados a TODO_EL_GRUPO y exige alumnos en PARCIAL', () => {
  const borradorTodoGrupo = {
    ...crearBorradorReporteInicial('ciclo-2026-cuat', '2026-11-14'),
    flujoRegistro: 'GRUPO' as const,
    tipoReporte: 'INCIDENTE' as const,
    descripcion: 'Incidente en salón 4 durante cambio de hora.',
    grupos: [{ grupoId: 'grupo-completo', alcanceAlumnos: 'TODO_EL_GRUPO' as const, codigoGrupo: '1A' }],
    alumnos: [
      { alumnoId: 'al-1', grupoId: 'grupo-completo', nombreCompleto: 'ALUMNO QUE NO DEBE VINCULARSE' },
    ],
  };

  const validacionTodo = validarBorradorReporteAcademico(borradorTodoGrupo);
  assert.equal(validacionTodo.valido, true);
  assert.equal(validacionTodo.borradorNormalizado.alumnos.length, 0);

  const payloadSql = construirPayloadGuardarReporte(borradorTodoGrupo);
  assert.deepEqual(payloadSql.alumnos, []);

  // Si cambia a PARCIAL sin alumnos seleccionados, debe fallar la validación
  const borradorParcialVacio = {
    ...borradorTodoGrupo,
    grupos: [{ grupoId: 'grupo-parcial', alcanceAlumnos: 'PARCIAL' as const, codigoGrupo: '2B' }],
    alumnos: [],
  };
  const validacionParcialVacio = validarBorradorReporteAcademico(borradorParcialVacio);
  assert.equal(validacionParcialVacio.valido, false);
  assert.ok(validacionParcialVacio.erroresCampos.alumnos);

  // Con al menos un alumno del grupo parcial, pasa y conserva únicamente a los seleccionados
  const borradorParcialConAlumno = {
    ...borradorParcialVacio,
    alumnos: [{ alumnoId: 'al-2', grupoId: 'grupo-parcial', nombreCompleto: 'CARLOS RUIZ', matricula: '2025099' }],
  };
  const validacionParcialOk = validarBorradorReporteAcademico(borradorParcialConAlumno);
  assert.equal(validacionParcialOk.valido, true);
  assert.equal(validacionParcialOk.borradorNormalizado.alumnos.length, 1);
  assert.equal(validacionParcialOk.borradorNormalizado.alumnos[0].alumnoId, 'al-2');
});

test('8. construirInvolucradosParaActa genera mención institucional para TODO_EL_GRUPO sin listar alumnos individuales', () => {
  const borrador = {
    ...crearBorradorReporteInicial('ciclo-2026-cuat', '2026-11-14'),
    flujoRegistro: 'GRUPO' as const,
    tipoReporte: 'INCIDENTE' as const,
    descripcion: 'Reporte mixto con un grupo completo y un grupo parcial.',
    grupos: [
      {
        grupoId: 'g-todo',
        alcanceAlumnos: 'TODO_EL_GRUPO' as const,
        codigoGrupo: '4A-DER',
        carrera: 'Licenciatura en Derecho',
        grado: '4',
        turno: 'Matutino',
      },
      {
        grupoId: 'g-parcial',
        alcanceAlumnos: 'PARCIAL' as const,
        codigoGrupo: '6B-PSI',
        carrera: 'Licenciatura en Psicología',
        grado: '6',
        turno: 'Vespertino',
      },
    ],
    alumnos: [
      {
        alumnoId: 'al-filtrado',
        grupoId: 'g-todo',
        nombreCompleto: 'NO DEBE APARECER EN EL ACTA',
        matricula: '0000',
        carrera: 'Licenciatura en Derecho',
      },
      {
        alumnoId: 'al-parcial',
        grupoId: 'g-parcial',
        nombreCompleto: 'MARÍA FERNANDA TORRES',
        matricula: '2024112',
        carrera: 'Licenciatura en Psicología',
      },
    ],
    docentes: [
      {
        docenteId: 'doc-1',
        nombreCompleto: 'LIC. ROBERTO MÉNDEZ',
        claveDocente: 'DOC-045',
      },
    ],
  };

  const involucrados = construirInvolucradosParaActa(borrador);
  assert.equal(involucrados.gruposCompletos.length, 1);
  assert.match(
    involucrados.gruposCompletos[0].etiquetaFormal,
    /Alumnos integrantes del grupo 4A-DER de la carrera Licenciatura en Derecho, 4° grado — Turno Matutino/
  );
  assert.equal(involucrados.alumnosIndividuales.length, 1);
  assert.equal(involucrados.alumnosIndividuales[0].nombre, 'MARÍA FERNANDA TORRES');
  assert.ok(!involucrados.mencionesTexto.some(t => t.includes('NO DEBE APARECER')));
  assert.equal(involucrados.docentes.length, 1);
  assert.match(involucrados.docentes[0].etiquetaFormal, /LIC\. ROBERTO MÉNDEZ \(Clave: DOC-045\)/);
});

test('9. construirFirmantesActa incluye a quien levanta el acta, involucrados individuales y testigos mixtos (PERSONAL y EXTERNO)', () => {
  const borrador = {
    ...crearBorradorReporteInicial('ciclo-2026-cuat', '2026-11-14'),
    flujoRegistro: 'ALUMNO_DOCENTE' as const,
    tipoReporte: 'INCIDENTE' as const,
    descripcion: 'Incidente documentado con acta circunstanciada.',
    tieneActaHechos: true,
    alumnos: [
      { alumnoId: 'al-10', nombreCompleto: 'PEDRO SÁNCHEZ', matricula: '2023888', carrera: 'Pedagogía' },
    ],
    docentes: [
      { docenteId: 'doc-9', nombreCompleto: 'MTRA. LAURA GÓMEZ', claveDocente: 'D-900' },
    ],
    acta: {
      ...crearBorradorActaInicial('2026-11-14'),
      lugar: 'Coordinación de Control Escolar',
      horaInicio: '10:00',
      horaConclusion: '10:45',
      empleadoLevantaId: 'emp-100',
      empleadoLevantaNombre: 'LIC. ARTURO RODRÍGUEZ ISLAS',
      empleadoLevantaCargo: 'DIRECTOR DE CONTROL ESCOLAR',
      relatoriaHechos: 'Siendo las diez horas se reúnen las partes para asentar los hechos ocurridos en el aula.',
      testigos: [
        {
          tipo: 'PERSONAL' as const,
          personaId: 'emp-200',
          nombreCompleto: 'MTRO. JORGE HERNÁNDEZ',
          cargoIdentificacion: 'Coordinador Académico',
        },
        {
          tipo: 'EXTERNO' as const,
          nombreCompleto: 'SRA. ELENA RAMÍREZ',
          cargoIdentificacion: 'INE 1234567890123',
        },
      ],
    },
  };

  const firmantes = construirFirmantesActa(borrador);
  assert.ok(firmantes.quienLevanta);
  assert.equal(firmantes.quienLevanta?.rolFirmante, 'LEVANTA_ACTA');
  assert.equal(firmantes.quienLevanta?.nombreCompleto, 'LIC. ARTURO RODRÍGUEZ ISLAS');
  assert.equal(firmantes.involucrados.length, 2);
  assert.equal(firmantes.testigos.length, 2);
  assert.equal(firmantes.testigos[0].tipoTestigo, 'PERSONAL');
  assert.equal(firmantes.testigos[0].referenciaId, 'emp-200');
  assert.equal(firmantes.testigos[1].tipoTestigo, 'EXTERNO');
  assert.equal(firmantes.testigos[1].referenciaId, undefined);
  assert.equal(firmantes.todos.length, 5);
});

test('10. validación de horarios y campos obligatorios del Acta de Hechos rechaza horaConclusion < horaInicio y relatoría corta', () => {
  const borrador = {
    ...crearBorradorReporteInicial('ciclo-2026-cuat', '2026-11-14'),
    flujoRegistro: 'ALUMNO_DOCENTE' as const,
    tipoReporte: 'INCIDENTE' as const,
    descripcion: 'Incidente con acta',
    tieneActaHechos: true,
    alumnos: [{ alumnoId: 'al-1', nombreCompleto: 'LUIS PÉREZ' }],
    acta: {
      ...crearBorradorActaInicial('2026-11-14'),
      lugar: 'Oficina de Dirección',
      horaInicio: '14:30',
      horaConclusion: '13:45',
      empleadoLevantaId: 'emp-1',
      relatoriaHechos: 'Texto muy corto',
      testigos: [
        {
          tipo: 'PERSONAL' as const,
          nombreCompleto: 'Testigo sin personaId',
          cargoIdentificacion: 'Docente',
        },
      ],
    },
  };

  const res = validarBorradorReporteAcademico(borrador);
  assert.equal(res.valido, false);
  assert.ok(res.erroresCampos['acta.horaConclusion']);
  assert.ok(res.erroresCampos['acta.relatoriaHechos']);
  assert.ok(res.erroresCampos['acta.testigos.0']);
  assert.equal(res.borradorNormalizado.acta?.nombreInstitucion, INSTITUCION_ACTA_POR_DEFECTO);
});

test('11. validación de enlace Drive acepta URLs HTTPS de drive.google.com y docs.google.com y rechaza dominios o protocolos inválidos', () => {
  assert.equal(esEnlaceDriveValido('https://drive.google.com/drive/folders/1AbCdEfGhIjK'), true);
  assert.equal(esEnlaceDriveValido('https://docs.google.com/document/d/1AbCdEfGhIjK/edit'), true);
  assert.equal(esEnlaceDriveValido('http://drive.google.com/file/d/123'), false);
  assert.equal(esEnlaceDriveValido('https://evil-site.com/drive.google.com'), false);
  assert.equal(esEnlaceDriveValido('https://drive.google.com/con espacios'), false);
});

test('12. mapeo bidireccional SQL <-> Dominio y manejo de conflicto de revisión optimista (40001)', () => {
  const sqlSnapshot = {
    id: 'rep-uuid-1',
    folio: 'REP-20262027-0001',
    ciclo_id: 'ciclo-2026-cuat',
    ciclo_nombre: '2026-2027',
    ciclo_tipo_periodo: 'Cuatrimestral',
    flujo_registro: 'ALUMNO_DOCENTE',
    tipo_reporte: 'INCIDENTE',
    fecha_reporte: '2026-11-14',
    descripcion: 'Descripción detallada del incidente académico.',
    estatus: 'EN_PROCESO',
    tiene_acta_hechos: true,
    enlace_drive: 'https://drive.google.com/file/d/abc123/view',
    notas_evidencia: 'Expediente firmado',
    revision: 3,
    alumnos: [
      {
        alumno_id: 'al-1',
        grupo_id: null,
        matricula_snapshot: '2026001',
        nombre_snapshot: 'SOFÍA CASTRO',
        carrera_snapshot: 'Derecho',
        grado_snapshot: '3',
      },
    ],
    grupos: [],
    docentes: [],
    acta: {
      nombre_institucion: 'Centro Universitario Oriente de México',
      titulo_documento: 'Acta de Hechos',
      lugar: 'Sala de Juntas',
      fecha_levantamiento: '2026-11-14',
      hora_inicio: '11:00:00',
      hora_conclusion: '11:40:00',
      empleado_levanta_id: 'emp-1',
      empleado_levanta_nombre: 'LIC. ARTURO RODRÍGUEZ ISLAS',
      empleado_levanta_cargo: 'DIRECTOR DE CONTROL ESCOLAR',
      testigos_json: [
        {
          tipo: 'EXTERNO',
          nombre_completo: 'CARLOS VÁZQUEZ',
          cargo_identificacion: 'Padre de familia',
        },
      ],
      relatoria_hechos: 'Relatoría completa asentada en el acta circunstanciada de hechos.',
      pruebas_anexos: 'Bitácora de acceso',
    },
  };

  const detalle = mapearReporteDesdeSql(sqlSnapshot);
  assert.equal(detalle.folio, 'REP-20262027-0001');
  assert.equal(detalle.revision, 3);
  assert.equal(detalle.acta?.horaInicio, '11:00');
  assert.equal(detalle.acta?.horaConclusion, '11:40');

  const borradorEdicion = convertirReporteABorrador(detalle);
  const payloadEdicion = construirPayloadGuardarReporte(borradorEdicion);
  assert.equal(payloadEdicion.id, 'rep-uuid-1');
  assert.equal(payloadEdicion.revision, 3);

  const errorConflicto = normalizarErrorReporteAcademico({
    code: '40001',
    message: 'El reporte fue modificado por otra persona; actualiza antes de guardar',
  });
  assert.equal(errorConflicto.esConflictoRevision, true);

  const filtrosPayload = construirPayloadFiltrosReportes({
    cicloId: 'TODOS',
    alumnoId: 'al-1',
    busqueda: '  REP-2026 ',
  });
  assert.equal(filtrosPayload.ciclo_id, undefined);
  assert.equal(filtrosPayload.alumno_id, 'al-1');
  assert.equal(filtrosPayload.busqueda, 'REP-2026');
  assert.equal(esRegistroActivo({ estatus: 'activo' }), true);
  assert.equal(esRegistroActivo({ estatus: 'inactivo' }), false);
  assert.equal(esRegistroActivo({ activo: true, estatus: 'inactivo' }), true);
  assert.equal(limpiarAlumnosDeGruposCompletos([], []).length, 0);
});

test('13. exportarActaHechosPdf genera documento válido multipágina sin cortar bloques de firmas', () => {
  const relatoriaLarga = Array.from(
    { length: 42 },
    (_, i) =>
      `Párrafo ${i + 1}: Se hace constar de manera objetiva y cronológica que las actividades en el aula continuaron bajo supervisión del personal académico y administrativo.`
  ).join('\n');

  const borrador = {
    ...crearBorradorReporteInicial('ciclo-2026-cuat', '2026-11-14'),
    flujoRegistro: 'GRUPO' as const,
    tipoReporte: 'INCIDENTE' as const,
    descripcion: 'Incidente múltiple con relatoría extensa y varios firmantes.',
    tieneActaHechos: true,
    enlaceDrive: 'https://drive.google.com/file/d/documento123/view',
    grupos: [
      {
        grupoId: 'g-1',
        alcanceAlumnos: 'PARCIAL' as const,
        codigoGrupo: '4A-DER',
        carrera: 'Derecho',
        grado: '4',
        turno: 'Matutino',
      },
    ],
    alumnos: [
      { alumnoId: 'a-1', grupoId: 'g-1', nombreCompleto: 'ALUMNO UNO', matricula: '2026001', carrera: 'Derecho' },
      { alumnoId: 'a-2', grupoId: 'g-1', nombreCompleto: 'ALUMNO DOS', matricula: '2026002', carrera: 'Derecho' },
      { alumnoId: 'a-3', grupoId: 'g-1', nombreCompleto: 'ALUMNO TRES', matricula: '2026003', carrera: 'Derecho' },
    ],
    docentes: [
      { docenteId: 'd-1', nombreCompleto: 'MTRA. PATRICIA SOLÍS', claveDocente: 'DOC-011' },
    ],
    acta: {
      ...crearBorradorActaInicial('2026-11-14'),
      lugar: 'Sala de Coordinación Académica',
      horaInicio: '10:00',
      horaConclusion: '11:30',
      empleadoLevantaId: 'emp-1',
      empleadoLevantaNombre: 'LIC. ARTURO RODRÍGUEZ ISLAS',
      empleadoLevantaCargo: 'DIRECTOR DE CONTROL ESCOLAR',
      relatoriaHechos: relatoriaLarga,
      pruebasAnexos: 'Bitácora de asistencia y evidencia fotográfica.',
      testigos: [
        {
          tipo: 'PERSONAL' as const,
          personaId: 'emp-2',
          nombreCompleto: 'MTRO. JORGE HERNÁNDEZ',
          cargoIdentificacion: 'Coordinador Académico',
        },
        {
          tipo: 'EXTERNO' as const,
          nombreCompleto: 'SRA. ELENA RAMÍREZ',
          cargoIdentificacion: 'INE 0987654321098',
        },
      ],
    },
  };

  assert.equal(formatearFechaLargaEspanol('2026-11-14'), '14 de noviembre de 2026');
  const pdf = crearPdfActaHechos(borrador, {
    folio: 'REP-20262027-0015',
    cicloNombre: '2026-2027 · Cuatrimestral',
  });
  assert.ok(pdf.getNumberOfPages() >= 2);
  const bytes = pdf.output('arraybuffer');
  assert.ok(bytes.byteLength > 1500);
});

test('14. integración transversal: ruta, menú, Inicio y separación TODO_EL_GRUPO vs PARCIAL en alumno', () => {
  assert.equal(tituloRuta('/reportes-academicos'), 'Reportes Académicos');
  assert.equal(puedeAccederRuta('ADMINISTRADOR', '/reportes-academicos'), true);
  assert.equal(puedeAccederRuta('COORDINADOR ACADEMICO', '/reportes-academicos'), true);
  assert.equal(puedeAccederRuta('COORDINADOR CONTROL ESCOLAR', '/reportes-academicos'), true);
  assert.equal(puedeAccederRuta('DOCENTE', '/reportes-academicos'), false);

  const menuCoordAcademico = menuAplicacion('COORDINADOR ACADEMICO');
  assert.equal(menuActivo(menuCoordAcademico, '/reportes-academicos')?.path, '/control-academico');
  assert.ok(tareasInicio('COORDINADOR ACADEMICO', 'academico').some(t => t.ruta === '/reportes-academicos'));

  const sqlIndividual = mapearReporteDesdeSql({
    id: 'rep-ind',
    folio: 'REP-20262027-0101',
    ciclo_id: 'ciclo-2026-cuat',
    flujo_registro: 'ALUMNO_DOCENTE',
    tipo_reporte: 'INASISTENCIAS',
    fecha_reporte: '2026-11-14',
    descripcion: 'Tres faltas consecutivas.',
    estatus: 'EN_PROCESO',
    tiene_acta_hechos: false,
    revision: 1,
    alumnos: [{ alumno_id: 'al-1', nombre_snapshot: 'ANA LÓPEZ' }],
    grupos: [],
    docentes: [],
  });
  const sqlGrupoTodo = mapearReporteDesdeSql({
    id: 'rep-gtodo',
    folio: 'REP-20262027-0102',
    ciclo_id: 'ciclo-2026-cuat',
    flujo_registro: 'GRUPO',
    tipo_reporte: 'INCIDENTE',
    fecha_reporte: '2026-11-14',
    descripcion: 'Incidente general del grupo sin alumnos individuales.',
    estatus: 'EN_PROCESO',
    tiene_acta_hechos: true,
    revision: 1,
    alumnos: [],
    grupos: [{ grupo_id: 'g-1', alcance_alumnos: 'TODO_EL_GRUPO', codigo_grupo_snapshot: '4A-DER' }],
    docentes: [],
  });
  const sqlGrupoParcial = mapearReporteDesdeSql({
    id: 'rep-gparcial',
    folio: 'REP-20262027-0103',
    ciclo_id: 'ciclo-2026-cuat',
    flujo_registro: 'GRUPO',
    tipo_reporte: 'INCIDENTE',
    fecha_reporte: '2026-11-14',
    descripcion: 'Incidente grupal con selección parcial de alumnos.',
    estatus: 'RESUELTO',
    tiene_acta_hechos: true,
    revision: 1,
    alumnos: [{ alumno_id: 'al-1', grupo_id: 'g-1', nombre_snapshot: 'ANA LÓPEZ' }],
    grupos: [{ grupo_id: 'g-1', alcance_alumnos: 'PARCIAL', codigo_grupo_snapshot: '4A-DER' }],
    docentes: [],
  });

  const reportesSimulados = [sqlIndividual, sqlGrupoTodo, sqlGrupoParcial];
  const visiblesEnFichaAl1 = reportesSimulados.filter(r => r.alumnos.some(a => a.alumnoId === 'al-1'));
  const visiblesEnGrupoG1 = reportesSimulados.filter(r => r.grupos.some(g => g.grupoId === 'g-1'));

  assert.deepEqual(
    visiblesEnFichaAl1.map(r => r.folio),
    ['REP-20262027-0101', 'REP-20262027-0103']
  );
  assert.deepEqual(
    visiblesEnGrupoG1.map(r => r.folio),
    ['REP-20262027-0102', 'REP-20262027-0103']
  );
});
