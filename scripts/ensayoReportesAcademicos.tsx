import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import '../src/index.css';

const CICLO_CUAT_ID = '11111111-1111-4111-8111-000000000001';
const CICLO_SEM_ID = '11111111-1111-4111-8111-000000000002';
const CICLO_HIST_ID = '11111111-1111-4111-8111-000000000003';

const ALUMNO_1_ID = '22222222-2222-4222-8222-000000000001';
const ALUMNO_2_ID = '22222222-2222-4222-8222-000000000002';
const ALUMNO_3_ID = '22222222-2222-4222-8222-000000000003';

const GRUPO_1_ID = '33333333-3333-4333-8333-000000000001';
const GRUPO_2_ID = '33333333-3333-4333-8333-000000000002';

const DOCENTE_1_ID = '44444444-4444-4444-8444-000000000001';
const DOCENTE_2_ID = '44444444-4444-4444-8444-000000000002';

const EMPLEADO_1_ID = '55555555-5555-4555-8555-000000000001';
const EMPLEADO_2_ID = '55555555-5555-4555-8555-000000000002';

const qs = new URLSearchParams(location.search);
const originalFetch = window.fetch.bind(window);

const ciclosMock = [
  {
    id: CICLO_CUAT_ID,
    nombre: '2026-2027',
    meses_abarca: 'Septiembre - Diciembre',
    anio: 2026,
    tipo_periodo: 'Cuatrimestral',
    fecha_inicio: '2026-09-01',
    fecha_termino: '2026-12-18',
    activo: true,
  },
  {
    id: CICLO_SEM_ID,
    nombre: '2026-2027',
    meses_abarca: 'Agosto - Enero',
    anio: 2026,
    tipo_periodo: 'Semestral',
    fecha_inicio: '2026-08-10',
    fecha_termino: '2027-01-31',
    activo: false,
  },
  {
    id: CICLO_HIST_ID,
    nombre: '2025-1',
    meses_abarca: 'Enero - Abril',
    anio: 2025,
    tipo_periodo: 'Cuatrimestral',
    fecha_inicio: '2025-01-06',
    fecha_termino: '2025-04-30',
    activo: false,
  },
];

const alumnosMock = [
  {
    id: ALUMNO_1_ID,
    matricula: '20260001',
    nombre_completo: 'GARCÍA MENDOZA SOFÍA',
    licenciatura: 'Licenciatura en Derecho',
    grado_actual: '4',
    turno: 'MATUTINO',
    estatus: 'activo',
    activo: true,
    email: 'sofia.garcia@example.test',
    telefono: '5500000001',
  },
  {
    id: ALUMNO_2_ID,
    matricula: '20260002',
    nombre_completo: 'LÓPEZ HERNÁNDEZ CARLOS',
    licenciatura: 'Licenciatura en Derecho',
    grado_actual: '4',
    turno: 'MATUTINO',
    estatus: 'activo',
    activo: true,
    email: 'carlos.lopez@example.test',
    telefono: '5500000002',
  },
  {
    id: ALUMNO_3_ID,
    matricula: '20260003',
    nombre_completo: 'MARTÍNEZ ROJAS VALERIA',
    licenciatura: 'Licenciatura en Administración',
    grado_actual: '2',
    turno: 'VESPERTINO',
    estatus: 'activo',
    activo: true,
    email: 'valeria.martinez@example.test',
    telefono: '5500000003',
  },
];

const docentesMock = [
  {
    id: DOCENTE_1_ID,
    persona_id: '77777777-7777-4777-8777-000000000001',
    clave_legado: 'DOC-101',
    nombre_completo: 'HERRERA CAMPOS FERNANDO',
    email: 'f.herrera@example.test',
    estatus: 'activo',
    activo: true,
  },
  {
    id: DOCENTE_2_ID,
    persona_id: '77777777-7777-4777-8777-000000000002',
    clave_legado: 'DOC-102',
    nombre_completo: 'VÁZQUEZ PINEDA LUCÍA',
    email: 'l.vazquez@example.test',
    estatus: 'activo',
    activo: true,
  },
];

const empleadosMock = [
  {
    id: EMPLEADO_1_ID,
    persona_id: '88888888-8888-4888-8888-000000000001',
    nombres: 'ROBERTO',
    apellido_paterno: 'MENDOZA',
    apellido_materno: 'SOLÍS',
    nombre_completo: 'MENDOZA SOLÍS ROBERTO',
    puesto: 'Coordinador de Control Escolar',
    estatus: 'activo',
    activo: true,
  },
  {
    id: EMPLEADO_2_ID,
    persona_id: '88888888-8888-4888-8888-000000000002',
    nombres: 'MARIANA',
    apellido_paterno: 'CASTILLO',
    apellido_materno: 'VEGA',
    nombre_completo: 'CASTILLO VEGA MARIANA',
    puesto: 'Auxiliar Académico',
    estatus: 'activo',
    activo: true,
  },
];

const gruposMock = [
  {
    id: GRUPO_1_ID,
    ciclo_id: CICLO_CUAT_ID,
    plan_id: '66666666-6666-4666-8666-000000000001',
    codigo_grupo: '4A-DER',
    grado: 4,
    es_multigrado: false,
    turno: 'MATUTINO',
    estatus: 'activo',
    ciclo: ciclosMock[0],
    plan: {
      id: '66666666-6666-4666-8666-000000000001',
      nombre: 'Plan Derecho 2024',
      carrera: { nombre: 'Licenciatura en Derecho' },
    },
  },
  {
    id: GRUPO_2_ID,
    ciclo_id: CICLO_CUAT_ID,
    plan_id: '66666666-6666-4666-8666-000000000002',
    codigo_grupo: '2B-ADM',
    grado: 2,
    es_multigrado: false,
    turno: 'VESPERTINO',
    estatus: 'activo',
    ciclo: ciclosMock[0],
    plan: {
      id: '66666666-6666-4666-8666-000000000002',
      nombre: 'Plan Administración 2024',
      carrera: { nombre: 'Licenciatura en Administración' },
    },
  },
];

const alumnosGruposMock = [
  { id: 'ag-1', grupo_id: GRUPO_1_ID, alumno_id: ALUMNO_1_ID, alumnos: alumnosMock[0] },
  { id: 'ag-2', grupo_id: GRUPO_1_ID, alumno_id: ALUMNO_2_ID, alumnos: alumnosMock[1] },
  { id: 'ag-3', grupo_id: GRUPO_2_ID, alumno_id: ALUMNO_3_ID, alumnos: alumnosMock[2] },
];

function normalizarTxt(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

let consecutivoFolio = 4;
let reportesDb: any[] = [
  {
    id: '99999999-9999-4999-8999-000000000001',
    folio: 'REP-20262027-0001',
    ciclo_id: CICLO_CUAT_ID,
    ciclo_nombre: '2026-2027 (Septiembre - Diciembre)',
    ciclo_tipo_periodo: 'Cuatrimestral',
    flujo_registro: 'ALUMNO_DOCENTE',
    tipo_reporte: 'INASISTENCIAS',
    fecha_reporte: '2026-11-10',
    descripcion: 'Acumulación de cuatro inasistencias continuas en Derecho Civil II.',
    estatus: 'EN_PROCESO',
    tiene_acta_hechos: false,
    enlace_drive: null,
    notas_evidencia: null,
    revision: 1,
    created_at: '2026-11-10T10:00:00Z',
    updated_at: '2026-11-10T10:00:00Z',
    alumnos: [
      {
        alumno_id: ALUMNO_1_ID,
        grupo_id: null,
        matricula_snapshot: '20260001',
        nombre_snapshot: 'GARCÍA MENDOZA SOFÍA',
        carrera_snapshot: 'Licenciatura en Derecho',
        grado_snapshot: '4',
      },
    ],
    grupos: [],
    docentes: [],
    acta: null,
  },
  {
    id: '99999999-9999-4999-8999-000000000002',
    folio: 'REP-20262027-0002',
    ciclo_id: CICLO_CUAT_ID,
    ciclo_nombre: '2026-2027 (Septiembre - Diciembre)',
    ciclo_tipo_periodo: 'Cuatrimestral',
    flujo_registro: 'GRUPO',
    tipo_reporte: 'INCIDENTE',
    fecha_reporte: '2026-11-12',
    descripcion: 'Suspensión preventiva de práctica grupal por daño en equipo de aula.',
    estatus: 'EN_PROCESO',
    tiene_acta_hechos: true,
    enlace_drive: 'https://drive.google.com/file/d/ensayo-todo-grupo/view',
    notas_evidencia: 'Respaldo fotográfico del laboratorio.',
    revision: 1,
    created_at: '2026-11-12T12:00:00Z',
    updated_at: '2026-11-12T12:00:00Z',
    alumnos: [],
    grupos: [
      {
        grupo_id: GRUPO_1_ID,
        alcance_alumnos: 'TODO_EL_GRUPO',
        codigo_grupo_snapshot: '4A-DER',
        carrera_snapshot: 'Licenciatura en Derecho',
        grado_snapshot: '4',
        turno_snapshot: 'MATUTINO',
      },
    ],
    docentes: [
      {
        docente_id: DOCENTE_1_ID,
        nombre_docente_snapshot: 'HERRERA CAMPOS FERNANDO',
        clave_docente_snapshot: 'DOC-101',
      },
    ],
    acta: {
      nombre_institucion: 'INSTITUTO UNIVERSITARIO DE ENSAYO S.C.',
      titulo_documento: 'ACTA DE HECHOS ACADÉMICA',
      lugar: 'Aula Magna 4A, Edificio Poniente',
      fecha_levantamiento: '2026-11-12',
      hora_inicio: '11:00',
      hora_conclusion: '11:45',
      empleado_levanta_id: EMPLEADO_1_ID,
      empleado_levanta_nombre: 'MENDOZA SOLÍS ROBERTO',
      empleado_levanta_cargo: 'Coordinador de Control Escolar',
      testigos_json: [
        {
          tipo: 'PERSONAL',
          personaId: EMPLEADO_2_ID,
          nombreCompleto: 'CASTILLO VEGA MARIANA',
          cargoIdentificacion: 'Auxiliar Académico',
        },
        {
          tipo: 'EXTERNO',
          nombreCompleto: 'PÉREZ SALAZAR JORGE',
          cargoIdentificacion: 'INE 0123456789012',
        },
      ],
      relatoria_hechos:
        'Siendo las once horas se hizo constar la revisión del equipo de cómputo asignado al grupo 4A-DER, acordando seguimiento coordinado con el grupo completo sin señalar responsabilidad individual.',
      pruebas_anexos: 'Inventario de aula y fotografías adjuntas.',
    },
  },
  {
    id: '99999999-9999-4999-8999-000000000003',
    folio: 'REP-20262027-0003',
    ciclo_id: CICLO_CUAT_ID,
    ciclo_nombre: '2026-2027 (Septiembre - Diciembre)',
    ciclo_tipo_periodo: 'Cuatrimestral',
    flujo_registro: 'GRUPO',
    tipo_reporte: 'INCIDENTE',
    fecha_reporte: '2026-11-13',
    descripcion: 'Desacuerdo académico con selección parcial de estudiantes en seminario.',
    estatus: 'RESUELTO',
    tiene_acta_hechos: true,
    enlace_drive: 'https://docs.google.com/document/d/ensayo-parcial/edit',
    notas_evidencia: 'Minuta firmada.',
    revision: 1,
    created_at: '2026-11-13T15:00:00Z',
    updated_at: '2026-11-13T16:00:00Z',
    alumnos: [
      {
        alumno_id: ALUMNO_1_ID,
        grupo_id: GRUPO_1_ID,
        matricula_snapshot: '20260001',
        nombre_snapshot: 'GARCÍA MENDOZA SOFÍA',
        carrera_snapshot: 'Licenciatura en Derecho',
        grado_snapshot: '4',
      },
    ],
    grupos: [
      {
        grupo_id: GRUPO_1_ID,
        alcance_alumnos: 'PARCIAL',
        codigo_grupo_snapshot: '4A-DER',
        carrera_snapshot: 'Licenciatura en Derecho',
        grado_snapshot: '4',
        turno_snapshot: 'MATUTINO',
      },
    ],
    docentes: [
      {
        docente_id: DOCENTE_1_ID,
        nombre_docente_snapshot: 'HERRERA CAMPOS FERNANDO',
        clave_docente_snapshot: 'DOC-101',
      },
      {
        docente_id: DOCENTE_2_ID,
        nombre_docente_snapshot: 'VÁZQUEZ PINEDA LUCÍA',
        clave_docente_snapshot: 'DOC-102',
      },
    ],
    acta: {
      nombre_institucion: 'INSTITUTO UNIVERSITARIO DE ENSAYO S.C.',
      titulo_documento: 'ACTA DE HECHOS ACADÉMICA',
      lugar: 'Sala de Coordinación Académica',
      fecha_levantamiento: '2026-11-13',
      hora_inicio: '15:00',
      hora_conclusion: '15:40',
      empleado_levanta_id: EMPLEADO_1_ID,
      empleado_levanta_nombre: 'MENDOZA SOLÍS ROBERTO',
      empleado_levanta_cargo: 'Coordinador de Control Escolar',
      testigos_json: [
        {
          tipo: 'PERSONAL',
          personaId: DOCENTE_2_ID,
          nombreCompleto: 'VÁZQUEZ PINEDA LUCÍA',
          cargoIdentificacion: 'Docente (DOC-102)',
        },
        {
          tipo: 'EXTERNO',
          nombreCompleto: 'MENDOZA RUIZ LAURA',
          cargoIdentificacion: 'Tutor autorizado',
        },
      ],
      relatoria_hechos:
        'Se levantó constancia de acuerdos académicos con participación parcial de alumna del grupo 4A-DER y ambos docentes de la academia de Derecho.',
      pruebas_anexos: 'Calendario firmado de reposición de actividades.',
    },
  },
];

let rolActual = qs.get('rol') || 'ADMINISTRADOR';
const metricas = {
  llamadasExternasBloqueadas: 0,
  consultasReportes: 0,
  guardadosReportes: 0,
};
(window as any).__RA_ENSAYO__ = {
  metricas,
  obtenerReportes: () => reportesDb,
};

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

window.fetch = async (input: any, init?: any) => {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input), location.href);
  if (url.origin === location.origin) return originalFetch(input, init);

  const recurso = url.pathname.split('/').pop() || '';
  const body = init?.body ? JSON.parse(String(init.body)) : {};

  if (recurso === 'consultar_reportes_academicos_v1') {
    metricas.consultasReportes += 1;
    const f = body.p_filtros || {};
    const textoBuscado = f.busqueda ? normalizarTxt(String(f.busqueda)) : '';
    const tipos: string[] = Array.isArray(f.tipo_reporte)
      ? f.tipo_reporte
      : f.tipo_reporte
        ? [String(f.tipo_reporte)]
        : [];
    const estatusLista: string[] = Array.isArray(f.estatus)
      ? f.estatus
      : f.estatus
        ? [String(f.estatus)]
        : [];
    const carrerasLista: string[] = Array.isArray(f.carrera)
      ? f.carrera.map((c: string) => normalizarTxt(c))
      : f.carrera
        ? [normalizarTxt(String(f.carrera))]
        : [];

    const filtrados = reportesDb.filter(r => {
      if (f.ciclo_id && r.ciclo_id !== f.ciclo_id) return false;
      if (f.fecha_desde && r.fecha_reporte < f.fecha_desde) return false;
      if (f.fecha_hasta && r.fecha_reporte > f.fecha_hasta) return false;
      if (tipos.length > 0 && !tipos.includes(r.tipo_reporte)) return false;
      if (estatusLista.length > 0 && !estatusLista.includes(r.estatus)) return false;
      if (f.alumno_id && !r.alumnos.some((a: any) => a.alumno_id === f.alumno_id)) return false;
      if (f.grupo_id && !r.grupos.some((g: any) => g.grupo_id === f.grupo_id)) return false;
      if (f.docente_id && !r.docentes.some((d: any) => d.docente_id === f.docente_id)) return false;
      if (carrerasLista.length > 0) {
        const tieneCarrera =
          r.alumnos.some((a: any) => a.carrera_snapshot && carrerasLista.includes(normalizarTxt(a.carrera_snapshot))) ||
          r.grupos.some((g: any) => g.carrera_snapshot && carrerasLista.includes(normalizarTxt(g.carrera_snapshot)));
        if (!tieneCarrera) return false;
      }
      if (textoBuscado) {
        const bolsa = normalizarTxt(
          [
            r.folio,
            r.descripcion,
            ...r.alumnos.map((a: any) => `${a.nombre_snapshot} ${a.matricula_snapshot}`),
            ...r.docentes.map((d: any) => `${d.nombre_docente_snapshot} ${d.clave_docente_snapshot}`),
            ...r.grupos.map((g: any) => g.codigo_grupo_snapshot),
          ].join(' ')
        );
        if (!bolsa.includes(textoBuscado)) return false;
      }
      return true;
    });

    filtrados.sort((a, b) => b.fecha_reporte.localeCompare(a.fecha_reporte) || b.folio.localeCompare(a.folio));
    return jsonResp({ total: filtrados.length, reportes: filtrados });
  }

  if (recurso === 'guardar_reporte_academico_v1') {
    metricas.guardadosReportes += 1;
    const p = body.p_payload || {};
    const ciclo = ciclosMock.find(c => c.id === p.ciclo_id) || ciclosMock[0];
    const gruposSql = (Array.isArray(p.grupos) ? p.grupos : []).map((g: any) => {
      const cat = gruposMock.find(x => x.id === g.grupo_id);
      return {
        grupo_id: g.grupo_id,
        alcance_alumnos: g.alcance_alumnos === 'PARCIAL' ? 'PARCIAL' : 'TODO_EL_GRUPO',
        codigo_grupo_snapshot: cat?.codigo_grupo || g.grupo_id,
        carrera_snapshot: cat?.plan?.carrera?.nombre || null,
        grado_snapshot: cat?.grado != null ? String(cat.grado) : null,
        turno_snapshot: cat?.turno || null,
      };
    });
    const completosSet = new Set(
      gruposSql.filter((g: any) => g.alcance_alumnos === 'TODO_EL_GRUPO').map((g: any) => g.grupo_id)
    );
    const alumnosSql = (Array.isArray(p.alumnos) ? p.alumnos : [])
      .filter((a: any) => !a.grupo_id || !completosSet.has(a.grupo_id))
      .map((a: any) => {
        const cat = alumnosMock.find(x => x.id === a.alumno_id);
        return {
          alumno_id: a.alumno_id,
          grupo_id: a.grupo_id || null,
          matricula_snapshot: cat?.matricula || null,
          nombre_snapshot: cat?.nombre_completo || 'ALUMNO',
          carrera_snapshot: cat?.licenciatura || null,
          grado_snapshot: cat?.grado_actual || null,
        };
      });
    const docentesSql = (Array.isArray(p.docentes) ? p.docentes : []).map((d: any) => {
      const cat = docentesMock.find(x => x.id === d.docente_id);
      return {
        docente_id: d.docente_id,
        nombre_docente_snapshot: cat?.nombre_completo || 'DOCENTE',
        clave_docente_snapshot: cat?.clave_legado || null,
      };
    });

    const empLevanta = empleadosMock.find(e => e.id === p.acta?.empleado_levanta_id);
    const actaSql = p.tiene_acta_hechos && p.acta
      ? {
          nombre_institucion: p.acta.nombre_institucion || 'INSTITUTO UNIVERSITARIO DE ENSAYO S.C.',
          titulo_documento: p.acta.titulo_documento || 'ACTA DE HECHOS ACADÉMICA',
          lugar: p.acta.lugar,
          fecha_levantamiento: p.acta.fecha_levantamiento,
          hora_inicio: p.acta.hora_inicio,
          hora_conclusion: p.acta.hora_conclusion,
          empleado_levanta_id: p.acta.empleado_levanta_id,
          empleado_levanta_nombre: empLevanta?.nombre_completo || p.acta.empleado_levanta_nombre || 'ADMINISTRATIVO',
          empleado_levanta_cargo: p.acta.empleado_levanta_cargo || empLevanta?.puesto || null,
          testigos_json: Array.isArray(p.acta.testigos) ? p.acta.testigos : [],
          relatoria_hechos: p.acta.relatoria_hechos,
          pruebas_anexos: p.acta.pruebas_anexos || null,
        }
      : null;

    if (p.id) {
      const idx = reportesDb.findIndex(r => r.id === p.id);
      if (idx < 0) return jsonResp({ code: 'P0002', message: 'El reporte no existe.' }, 404);
      const actual = reportesDb[idx];
      if (Number(p.revision) !== Number(actual.revision)) {
        return jsonResp(
          { code: '40001', message: 'Otra sesión modificó este reporte. Recarga antes de guardar.' },
          409
        );
      }
      const actualizado = {
        ...actual,
        ciclo_id: p.ciclo_id,
        ciclo_nombre: `${ciclo.nombre} (${ciclo.meses_abarca})`,
        ciclo_tipo_periodo: ciclo.tipo_periodo,
        flujo_registro: p.flujo_registro,
        tipo_reporte: p.tipo_reporte,
        fecha_reporte: p.fecha_reporte,
        descripcion: p.descripcion,
        estatus: p.estatus || actual.estatus,
        tiene_acta_hechos: Boolean(p.tiene_acta_hechos),
        enlace_drive: p.enlace_drive || null,
        notas_evidencia: p.notas_evidencia || null,
        revision: actual.revision + 1,
        updated_at: new Date().toISOString(),
        alumnos: alumnosSql,
        grupos: gruposSql,
        docentes: docentesSql,
        acta: actaSql,
      };
      reportesDb = reportesDb.map(r => (r.id === p.id ? actualizado : r));
      return jsonResp({
        id: actualizado.id,
        folio: actualizado.folio,
        revision: actualizado.revision,
        accion: 'EDITAR',
        reporte: actualizado,
      });
    }

    const nuevoNum = consecutivoFolio++;
    const nuevoId = `99999999-9999-4999-8999-${String(nuevoNum).padStart(12, '0')}`;
    const folio = `REP-20262027-${String(nuevoNum).padStart(4, '0')}`;
    const nuevo = {
      id: nuevoId,
      folio,
      ciclo_id: p.ciclo_id,
      ciclo_nombre: `${ciclo.nombre} (${ciclo.meses_abarca})`,
      ciclo_tipo_periodo: ciclo.tipo_periodo,
      flujo_registro: p.flujo_registro,
      tipo_reporte: p.tipo_reporte,
      fecha_reporte: p.fecha_reporte,
      descripcion: p.descripcion,
      estatus: p.estatus || 'EN_PROCESO',
      tiene_acta_hechos: Boolean(p.tiene_acta_hechos),
      enlace_drive: p.enlace_drive || null,
      notas_evidencia: p.notas_evidencia || null,
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      alumnos: alumnosSql,
      grupos: gruposSql,
      docentes: docentesSql,
      acta: actaSql,
    };
    reportesDb = [nuevo, ...reportesDb];
    return jsonResp({
      id: nuevo.id,
      folio: nuevo.folio,
      revision: 1,
      accion: 'CREAR',
      reporte: nuevo,
    });
  }

  if (recurso === 'ic_resumen') {
    return jsonResp({ activos: 2, inscritos: 3, sin_grupo: 0 });
  }

  if (recurso === 'personal_consultar_v3') {
    return jsonResp({
      disponible: true,
      persona_id: docentesMock[0].persona_id,
      revision: 1,
      original: { ...docentesMock[0] },
      datos: {
        nombre_completo: docentesMock[0].nombre_completo,
        rfc: '',
        curp: '',
        email: docentesMock[0].email,
        fecha_nacimiento: '1984-05-12',
        sexo: 'Masculino',
        telefono: '5500000099',
        direccion: '',
        estado_civil: '',
        nombres: 'FERNANDO',
        apellido_paterno: 'HERRERA',
        apellido_materno: 'CAMPOS',
      },
      laborales: [],
      academicos: [],
      expediente: null,
      permisos: {
        generales: true,
        docencia: rolActual === 'ADMINISTRADOR' || rolActual === 'COORDINADOR ACADEMICO',
        academicos: true,
        laborales: rolActual === 'ADMINISTRADOR',
        expediente: rolActual === 'ADMINISTRADOR',
        editar_laborales: rolActual === 'ADMINISTRADOR',
        editar_expediente: rolActual === 'ADMINISTRADOR',
        vincular: rolActual === 'ADMINISTRADOR',
      },
      empleado_id: null,
      docente_id: DOCENTE_1_ID,
      referencia_docente: { clave_legado: 'DOC-101', estatus: 'activo' },
      referencia_laboral: null,
      referencia_academica: null,
    });
  }

  if (recurso === 'alumnos') return jsonResp(alumnosMock);
  if (recurso === 'docentes') return jsonResp(docentesMock);
  if (recurso === 'empleados') return jsonResp(empleadosMock);
  if (recurso === 'grupos') {
    const cicloFiltro = url.searchParams.get('ciclo_id')?.replace(/^eq\./, '');
    return jsonResp(cicloFiltro ? gruposMock.filter(g => g.ciclo_id === cicloFiltro) : gruposMock);
  }
  if (recurso === 'alumnos_grupos') {
    const inParam = url.searchParams.get('grupo_id');
    if (inParam?.startsWith('in.(')) {
      const ids = inParam.slice(4, -1).split(',');
      return jsonResp(alumnosGruposMock.filter(rel => ids.includes(rel.grupo_id)));
    }
    return jsonResp(alumnosGruposMock);
  }

  metricas.llamadasExternasBloqueadas += 1;
  return jsonResp([]);
};

async function iniciarEnsayo() {
  const { supabase } = await import('../src/lib/supabase');
  supabase.channel = () => ({ on() { return this; }, subscribe() { return this; } } as any);
  supabase.removeChannel = async () => 'ok' as any;

  const { useAppStore } = await import('../src/store/useAppStore');
  const { ProteccionCapturaProvider } = await import('../src/app/ProteccionCaptura');
  const { menuAplicacion } = await import('../src/app/menuAplicacion');
  const { tareasInicio } = await import('../src/app/inicioCatalogo');
  const { default: ReportesAcademicosModule } = await import('../src/components/reportesAcademicos/ReportesAcademicosModule');
  const { default: FichaAlumno } = await import('../src/components/FichaAlumno');
  const { default: GruposConfig } = await import('../src/components/GruposConfig');
  const { default: FichaPersonal } = await import('../src/components/personal/FichaPersonal');

  function sincronizarStoreRol(nuevoRol: string) {
    rolActual = nuevoRol;
    useAppStore.setState({
      currentUser: {
        id: 'usr-ensayo',
        username: 'ENSAYO_LOCAL',
        nombre_completo: 'Usuario de Ensayo',
        rol: nuevoRol as any,
        activo: true,
      } as any,
      ciclos: ciclosMock as any,
      activeCicloId: CICLO_CUAT_ID,
      alumnos: alumnosMock as any,
      carreras: [
        { id: 'c1', nombre: 'Licenciatura en Derecho' },
        { id: 'c2', nombre: 'Licenciatura en Administración' },
      ] as any,
      catalogos: {
        conceptos: [],
        licenciaturas: ['Licenciatura en Derecho', 'Licenciatura en Administración'],
        beca_tipos: [],
        beca_porcentajes: [],
        grados: ['2', '4'],
        turnos: ['MATUTINO', 'VESPERTINO'],
        estatus_alumnos: ['activo'],
        empresas_ss: [],
        modalidades_titulacion: [],
        observacion_plan: [],
        licenciaturasMetadata: {},
      },
      appConfig: {
        title: 'Universidad de Prueba (Sin Red)',
        logoUrl: '',
        directorNombre: 'DR. ROBERTO MENDOZA SOLÍS',
        directorCargo: 'Director Académico',
        nombreEntidadUniversidad: 'INSTITUTO UNIVERSITARIO DE ENSAYO S.C.',
        constanciaParams: {} as any,
      },
    });
  }

  sincronizarStoreRol(rolActual);

  type VistaEnsayo = 'modulo' | 'alumno' | 'grupos' | 'docente';

  function EnsayoApp() {
    const [vista, setVista] = useState<VistaEnsayo>((qs.get('vista') as VistaEnsayo) || 'modulo');
    const [rol, setRol] = useState<string>(rolActual);
    const [oscuro, setOscuro] = useState<boolean>(qs.has('oscuro'));

    useEffect(() => {
      document.documentElement.classList.toggle('dark', oscuro);
    }, [oscuro]);

    const menuRol = menuAplicacion(rol);
    const tareasAcademicas = tareasInicio(rol, 'academico');
    const tieneEnlaceMenu = menuRol.some(
      m => m.path === '/reportes-academicos' || m.children?.some(h => h.path === '/reportes-academicos')
    );
    const tieneTareaInicio = tareasAcademicas.some(t => t.ruta === '/reportes-academicos');

    return (
      <div className="min-h-screen bg-[#f5f7fb] text-[#172033] dark:bg-[#0f172a] dark:text-[#e5edf7]">
        <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#131a24]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                ENSAYO SIN RED · DATOS SINTÉTICOS
              </span>
              <span id="ra-ensayo-nav-info" className="text-slate-600 dark:text-slate-300">
                Menú: {tieneEnlaceMenu ? 'Reportes Académicos activo' : 'Oculto para rol'} · Inicio Académico:{' '}
                {tieneTareaInicio ? 'Visible' : 'N/A'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 font-semibold">
                <span>Rol:</span>
                <select
                  aria-label="Rol de ensayo"
                  value={rol}
                  onChange={e => {
                    const r = e.target.value;
                    sincronizarStoreRol(r);
                    setRol(r);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-[#1c232b]"
                >
                  <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                  <option value="COORDINADOR ACADEMICO">COORDINADOR ACADEMICO</option>
                  <option value="COORDINADOR CONTROL ESCOLAR">COORDINADOR CONTROL ESCOLAR</option>
                  <option value="CAJERO">CAJERO</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => setOscuro(o => !o)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1c232b] dark:hover:bg-slate-800"
              >
                {oscuro ? 'Tema claro' : 'Tema oscuro'}
              </button>
            </div>
          </div>

          <nav className="mx-auto mt-3 flex max-w-7xl flex-wrap gap-2" aria-label="Vistas del ensayo">
            {(
              [
                ['modulo', 'Módulo (/reportes-academicos)'],
                ['alumno', 'Ficha del alumno (Reportes)'],
                ['grupos', 'Control Escolar · Grupos'],
                ['docente', 'Ficha del docente (Docencia)'],
              ] as const
            ).map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                onClick={() => setVista(clave)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  vista === clave
                    ? 'bg-[#1456f0] text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1c232b] dark:text-slate-200'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-7xl p-3 sm:p-5">
          {vista === 'modulo' && <ReportesAcademicosModule key={`mod-${rol}`} />}
          {vista === 'alumno' && (
            <FichaAlumno
              key={`alu-${rol}`}
              initialAlumnoId={ALUMNO_1_ID}
              initialTab="reportes"
              onBack={() => setVista('modulo')}
            />
          )}
          {vista === 'grupos' && <GruposConfig key={`grp-${rol}`} />}
          {vista === 'docente' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-[#161e29]">
              <FichaPersonal
                key={`doc-${rol}`}
                origen={{ tipo: 'DOCENTE', id: DOCENTE_1_ID }}
                docente={docentesMock[0] as any}
                seccionInicial="docencia"
                onClose={() => setVista('modulo')}
              />
            </div>
          )}
        </main>
      </div>
    );
  }

  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <ProteccionCapturaProvider>
          <EnsayoApp />
          <Toaster />
        </ProteccionCapturaProvider>
      ),
    },
  ]);

  const raiz = createRoot(document.getElementById('root')!);
  raiz.render(<RouterProvider router={router} />);
  import.meta.hot?.dispose(() => raiz.unmount());
}

void iniciarEnsayo();
