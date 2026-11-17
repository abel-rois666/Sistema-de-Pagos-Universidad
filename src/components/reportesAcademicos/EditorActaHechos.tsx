import { useId, useMemo, useState } from 'react';
import { Eye, FileText, Plus, ShieldCheck, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppConfig } from '../../types';
import {
  construirFirmantesActa,
  construirInvolucradosParaActa,
  crearBorradorActaInicial,
  INSTITUCION_ACTA_POR_DEFECTO,
  MIN_CARACTERES_RELATORIA_ACTA,
  TITULO_ACTA_POR_DEFECTO,
} from '../../reportesAcademicos/dominio';
import type {
  BorradorActaHechos,
  BorradorReporteAcademico,
  OpcionPersonalReporte,
  TestigoActaHechos,
} from '../../reportesAcademicos/types';
import AyudaContextual, { CampoConAyuda } from '../ui/AyudaContextual';
import DatoInformativo from '../ui/DatoInformativo';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import SelectorBusqueda from '../ui/SelectorBusqueda';
import ImpresionActaHechos from './ImpresionActaHechos';

export interface EditorActaHechosProps {
  borrador: BorradorReporteAcademico;
  folio?: string | null;
  cicloNombre?: string | null;
  appConfig?: AppConfig | null;
  administrativosActivos: readonly OpcionPersonalReporte[];
  personalTestigosActivo: readonly OpcionPersonalReporte[];
  erroresCampos?: Record<string, string>;
  disabled?: boolean;
  onActualizarBorrador: (
    actualizador:
      | Partial<BorradorReporteAcademico>
      | ((prev: BorradorReporteAcademico) => BorradorReporteAcademico)
  ) => void;
}

export default function EditorActaHechos({
  borrador,
  folio,
  cicloNombre,
  appConfig,
  administrativosActivos,
  personalTestigosActivo,
  erroresCampos = {},
  disabled = false,
  onActualizarBorrador,
}: EditorActaHechosProps) {
  const checkActaId = useId();
  const selectorLevantaId = useId();
  const selectorTestigoPersonalId = useId();

  const [testigoSeleccionId, setTestigoSeleccionId] = useState('');
  const [mostrarConfirmarOcultar, setMostrarConfirmarOcultar] = useState(false);
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false);

  const logoUrl = (appConfig?.constanciaParams?.customLogoUrl || appConfig?.logoUrl || '').trim();
  const acta = borrador.acta ?? crearBorradorActaInicial(borrador.fechaReporte);

  const involucrados = useMemo(() => construirInvolucradosParaActa(borrador), [borrador]);
  const firmantes = useMemo(
    () =>
      construirFirmantesActa({
        ...borrador,
        acta,
      }),
    [borrador, acta]
  );

  const opcionesAdministrativos = useMemo(
    () =>
      [...administrativosActivos]
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX'))
        .map(p => ({
          value: p.id,
          label: `${p.nombreCompleto} — ${p.cargoIdentificacion}`,
        })),
    [administrativosActivos]
  );

  const opcionesPersonalTestigos = useMemo(
    () =>
      [...personalTestigosActivo]
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX'))
        .map(p => ({
          value: `${p.origen}:${p.id}`,
          label: `${p.nombreCompleto} — ${p.cargoIdentificacion} (${p.origen === 'EMPLEADO' ? 'Administrativo' : 'Docente'})`,
        })),
    [personalTestigosActivo]
  );

  // Solo disponible cuando el tipo es INCIDENTE
  if (borrador.tipoReporte !== 'INCIDENTE') {
    return null;
  }

  const actualizarActa = (parcial: Partial<BorradorActaHechos>) => {
    onActualizarBorrador(prev => {
      const base = prev.acta ?? crearBorradorActaInicial(prev.fechaReporte);
      return {
        ...prev,
        tieneActaHechos: true,
        acta: {
          ...base,
          ...parcial,
        },
      };
    });
  };

  const hayContenidoEnActa = (datosActa: BorradorActaHechos | null | undefined): boolean => {
    if (!datosActa) return false;
    return Boolean(
      datosActa.lugar.trim() ||
        datosActa.relatoriaHechos.trim() ||
        (datosActa.pruebasAnexos || '').trim() ||
        datosActa.empleadoLevantaId.trim() ||
        datosActa.testigos.length > 0
    );
  };

  const manejarToggleActa = (marcar: boolean) => {
    if (marcar) {
      onActualizarBorrador(prev => ({
        ...prev,
        tieneActaHechos: true,
        acta:
          prev.acta ??
          {
            ...crearBorradorActaInicial(prev.fechaReporte),
            nombreInstitucion:
              appConfig?.constanciaParams?.headerInstName?.trim() || INSTITUCION_ACTA_POR_DEFECTO,
            tituloDocumento: TITULO_ACTA_POR_DEFECTO,
          },
      }));
      return;
    }

    if (hayContenidoEnActa(borrador.acta)) {
      setMostrarConfirmarOcultar(true);
      return;
    }

    onActualizarBorrador(prev => ({
      ...prev,
      tieneActaHechos: false,
      acta: null,
    }));
  };

  const seleccionarQuienLevanta = (empleadoId: string) => {
    const encontrado = administrativosActivos.find(a => a.id === empleadoId);
    if (!encontrado) {
      actualizarActa({
        empleadoLevantaId: '',
        empleadoLevantaNombre: '',
        empleadoLevantaCargo: '',
      });
      return;
    }
    actualizarActa({
      empleadoLevantaId: encontrado.id,
      empleadoLevantaNombre: encontrado.nombreCompleto,
      empleadoLevantaCargo: encontrado.cargoIdentificacion,
    });
  };

  const agregarTestigoPersonal = () => {
    if (!testigoSeleccionId) {
      toast.error('Selecciona a un integrante del personal o docente antes de añadirlo como testigo.');
      return;
    }
    const [origen, id] = testigoSeleccionId.split(':');
    const encontrado = personalTestigosActivo.find(p => p.id === id && p.origen === origen);
    if (!encontrado) return;

    const yaExiste = acta.testigos.some(
      t => t.tipo === 'PERSONAL' && t.personaId === encontrado.id && t.nombreCompleto === encontrado.nombreCompleto
    );
    if (yaExiste) {
      toast('Esa persona ya está agregada como testigo en esta acta.');
      return;
    }

    const nuevo: TestigoActaHechos = {
      tipo: 'PERSONAL',
      personaId: encontrado.id,
      nombreCompleto: encontrado.nombreCompleto,
      cargoIdentificacion: encontrado.cargoIdentificacion,
    };
    actualizarActa({ testigos: [...acta.testigos, nuevo] });
    setTestigoSeleccionId('');
  };

  const agregarTestigoExterno = () => {
    const nuevo: TestigoActaHechos = {
      tipo: 'EXTERNO',
      nombreCompleto: '',
      cargoIdentificacion: '',
    };
    actualizarActa({ testigos: [...acta.testigos, nuevo] });
  };

  const actualizarTestigo = (indice: number, parcial: Partial<TestigoActaHechos>) => {
    const lista = acta.testigos.map((t, idx) => (idx === indice ? { ...t, ...parcial } : t));
    actualizarActa({ testigos: lista });
  };

  const quitarTestigo = (indice: number) => {
    actualizarActa({ testigos: acta.testigos.filter((_, idx) => idx !== indice) });
  };

  return (
    <section className="ra-panel-suave mt-4" aria-labelledby={checkActaId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            id={checkActaId}
            type="checkbox"
            className="h-5 w-5 accent-[#1456f0] cursor-pointer"
            checked={borrador.tieneActaHechos}
            disabled={disabled}
            onChange={e => manejarToggleActa(e.target.checked)}
          />
          <label htmlFor={checkActaId} className="text-sm font-bold cursor-pointer select-none">
            Elaborar Acta de Hechos
          </label>
          <AyudaContextual
            etiqueta="Elaborar Acta de Hechos"
            texto="Activa esta casilla únicamente si el incidente requiere documentar hechos formales con horario, relatoría objetiva, testigos y firmas autógrafas."
          />
        </div>

        {borrador.tieneActaHechos && (
          <button
            type="button"
            className="ra-btn ra-btn-compacto"
            onClick={() => setMostrarVistaPrevia(true)}
            disabled={disabled}
          >
            <Eye size={15} aria-hidden="true" />
            Vista previa / Imprimir Acta
          </button>
        )}
      </div>

      {!borrador.tieneActaHechos && (
        <p className="ra-ayuda-nota mt-2 mb-0">
          Opcional para incidentes. Mantén la casilla desmarcada si solo registrarás el incidente y evidencia general.
        </p>
      )}

      {borrador.tieneActaHechos && (
        <div className="mt-5 space-y-6 border-t border-[var(--ra-borde)] pt-5">
          {/* 1. Encabezado del Acta */}
          <div>
            <h3 className="m-0 mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--ra-acento-texto)]">
              <FileText size={16} aria-hidden="true" />
              1. Encabezado del documento
            </h3>
            <div className="ra-form-grid">
              <CampoConAyuda
                etiqueta="Nombre de la universidad"
                ayuda="Nombre institucional que aparecerá en el encabezado y cierre del Acta de Hechos."
              >
                <input
                  type="text"
                  className={`ra-control ${erroresCampos['acta.nombreInstitucion'] ? 'con-error' : ''}`}
                  value={acta.nombreInstitucion}
                  disabled={disabled}
                  onChange={e => actualizarActa({ nombreInstitucion: e.target.value })}
                  placeholder={INSTITUCION_ACTA_POR_DEFECTO}
                />
                {erroresCampos['acta.nombreInstitucion'] && (
                  <p className="ra-error-campo" role="alert">
                    {erroresCampos['acta.nombreInstitucion']}
                  </p>
                )}
              </CampoConAyuda>

              <DatoInformativo
                etiqueta="Título oficial del documento"
                ayuda="Título formal estandarizado para el documento e impresión."
                valor={
                  <span className="font-bold text-sm">
                    {acta.tituloDocumento || TITULO_ACTA_POR_DEFECTO}
                  </span>
                }
              />

              <DatoInformativo
                etiqueta="Logotipo institucional (Configuración)"
                ayuda="Se toma automáticamente desde la configuración del sistema y se incluye al imprimir o generar PDF."
                valor={
                  logoUrl ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={logoUrl}
                        alt="Previsualización del logotipo institucional"
                        className="h-10 w-10 rounded border border-[var(--ra-borde)] bg-white object-contain p-0.5"
                      />
                      <span className="text-xs font-medium text-[var(--ra-secundario)]">
                        Logo institucional listo
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--ra-secundario)]">
                      Sin logotipo configurado en Ajustes
                    </span>
                  )
                }
              />
            </div>
          </div>

          {/* 2. Lugar, fecha y hora */}
          <div>
            <h3 className="m-0 mb-3 text-sm font-bold uppercase tracking-wide text-[var(--ra-acento-texto)]">
              2. Lugar, fecha y horario
            </h3>
            <div className="ra-form-grid">
              <CampoConAyuda
                etiqueta="Lugar donde se levanta"
                ayuda="Especifica la oficina, coordinación, aula o área física exacta donde se redacta el acta."
              >
                <input
                  type="text"
                  className={`ra-control ${erroresCampos['acta.lugar'] ? 'con-error' : ''}`}
                  value={acta.lugar}
                  disabled={disabled}
                  onChange={e => actualizarActa({ lugar: e.target.value })}
                  placeholder="Ej. Dirección Académica / Coordinación de Control Escolar"
                />
                {erroresCampos['acta.lugar'] && (
                  <p className="ra-error-campo" role="alert">
                    {erroresCampos['acta.lugar']}
                  </p>
                )}
              </CampoConAyuda>

              <CampoConAyuda
                etiqueta="Fecha de levantamiento"
                ayuda="Fecha exacta en que se instrumenta el acta (YYYY-MM-DD)."
              >
                <input
                  type="date"
                  className={`ra-control ${erroresCampos['acta.fechaLevantamiento'] ? 'con-error' : ''}`}
                  value={acta.fechaLevantamiento}
                  disabled={disabled}
                  onChange={e => actualizarActa({ fechaLevantamiento: e.target.value })}
                />
                {erroresCampos['acta.fechaLevantamiento'] && (
                  <p className="ra-error-campo" role="alert">
                    {erroresCampos['acta.fechaLevantamiento']}
                  </p>
                )}
              </CampoConAyuda>

              <div className="grid grid-cols-2 gap-3">
                <CampoConAyuda
                  etiqueta="Hora de inicio"
                  ayuda="Hora en que inicia el levantamiento del acta (formato 24 h)."
                >
                  <input
                    type="time"
                    className={`ra-control ${erroresCampos['acta.horaInicio'] ? 'con-error' : ''}`}
                    value={acta.horaInicio}
                    disabled={disabled}
                    onChange={e => actualizarActa({ horaInicio: e.target.value })}
                  />
                  {erroresCampos['acta.horaInicio'] && (
                    <p className="ra-error-campo" role="alert">
                      {erroresCampos['acta.horaInicio']}
                    </p>
                  )}
                </CampoConAyuda>

                <CampoConAyuda
                  etiqueta="Hora de conclusión"
                  ayuda="Debe ser igual o posterior a la hora de inicio."
                >
                  <input
                    type="time"
                    className={`ra-control ${erroresCampos['acta.horaConclusion'] ? 'con-error' : ''}`}
                    value={acta.horaConclusion}
                    disabled={disabled}
                    onChange={e => actualizarActa({ horaConclusion: e.target.value })}
                  />
                  {erroresCampos['acta.horaConclusion'] && (
                    <p className="ra-error-campo" role="alert">
                      {erroresCampos['acta.horaConclusion']}
                    </p>
                  )}
                </CampoConAyuda>
              </div>
            </div>
          </div>

          {/* 3. Datos de los participantes */}
          <div>
            <h3 className="m-0 mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--ra-acento-texto)]">
              <Users size={16} aria-hidden="true" />
              3. Participantes y testigos de asistencia
            </h3>

            <div className="ra-form-grid-2">
              <CampoConAyuda
                etiqueta="Quien levanta el acta (Personal administrativo activo)"
                ayuda="Selecciona al empleado administrativo activo que instrumenta el acta. Puedes precisar su cargo en el campo contiguo."
              >
                <SelectorBusqueda
                  id={selectorLevantaId}
                  value={acta.empleadoLevantaId}
                  opciones={[
                    { value: '', label: 'Selecciona personal administrativo…' },
                    ...opcionesAdministrativos,
                  ]}
                  onChange={seleccionarQuienLevanta}
                  etiqueta="Quien levanta el acta"
                  placeholder="Selecciona personal administrativo…"
                  disabled={disabled}
                />
                {erroresCampos['acta.empleadoLevantaId'] && (
                  <p className="ra-error-campo" role="alert">
                    {erroresCampos['acta.empleadoLevantaId']}
                  </p>
                )}
              </CampoConAyuda>

              <CampoConAyuda
                etiqueta="Cargo de quien levanta el acta"
                ayuda="Cargo institucional mostrado en el cuerpo y pie de firma del acta."
              >
                <input
                  type="text"
                  className="ra-control"
                  value={acta.empleadoLevantaCargo}
                  disabled={disabled}
                  onChange={e => actualizarActa({ empleadoLevantaCargo: e.target.value })}
                  placeholder="Ej. Coordinador de Control Escolar"
                />
              </CampoConAyuda>
            </div>

            <div className="mt-4 rounded-lg border border-[var(--ra-borde)] bg-[var(--ra-superficie)] p-3.5">
              <DatoInformativo
                etiqueta="Involucrados derivados automáticamente del reporte"
                ayuda="Los grupos marcados como «Todo el grupo» se citan de forma institucional sin listar alumnos individuales; los grupos parciales y selecciones individuales listan a cada alumno y docente."
                valor={
                  involucrados.todos.length === 0 ? (
                    <span className="text-xs text-[var(--ra-ambar-texto)] font-semibold">
                      Aún no hay involucrados seleccionados en el reporte superior.
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--ra-secundario)]">
                      {involucrados.todos.length} participante(s) listo(s) para el acta
                    </span>
                  )
                }
              >
                {involucrados.todos.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--ra-texto)]">
                    {involucrados.todos.map(item => (
                      <li key={`${item.categoria}-${item.referenciaId}`}>{item.etiquetaFormal}</li>
                    ))}
                  </ul>
                )}
              </DatoInformativo>
            </div>

            {/* Testigos de asistencia (Mixto) */}
            <div className="mt-4 rounded-lg border border-[var(--ra-borde)] bg-[var(--ra-superficie)] p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <CampoConAyuda
                    etiqueta="Añadir testigo desde catálogo de personal o docentes activos"
                    ayuda="Busca personal administrativo o docente activo para autocompletar su nombre y cargo como testigo de asistencia."
                  >
                    <SelectorBusqueda
                      id={selectorTestigoPersonalId}
                      value={testigoSeleccionId}
                      opciones={[
                        { value: '', label: 'Buscar empleado o docente activo…' },
                        ...opcionesPersonalTestigos,
                      ]}
                      onChange={setTestigoSeleccionId}
                      etiqueta="Catálogo de personal para testigo"
                      placeholder="Buscar empleado o docente activo…"
                      disabled={disabled}
                    />
                  </CampoConAyuda>
                </div>

                <button
                  type="button"
                  className="ra-btn"
                  onClick={agregarTestigoPersonal}
                  disabled={disabled || !testigoSeleccionId}
                >
                  <UserCheck size={16} aria-hidden="true" />
                  Añadir testigo seleccionado
                </button>

                <button
                  type="button"
                  className="ra-btn"
                  onClick={agregarTestigoExterno}
                  disabled={disabled}
                >
                  <UserPlus size={16} aria-hidden="true" />
                  + Añadir testigo manual / externo
                </button>
              </div>

              {acta.testigos.length === 0 ? (
                <p className="ra-ayuda-nota mt-3 mb-0">
                  No has agregado testigos de asistencia. Puedes añadir testigos del personal activo o externos (madre/padre de familia, tutor o personal externo).
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {acta.testigos.map((testigo, idx) => {
                    const errorTestigo = erroresCampos[`acta.testigos.${idx}`];
                    const esPersonal = testigo.tipo === 'PERSONAL';
                    return (
                      <div
                        key={`testigo-${idx}`}
                        className="rounded-lg border border-[var(--ra-borde)] bg-[var(--ra-superficie-suave)] p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="ra-badge ra-badge-rol-alumno">
                            {esPersonal ? 'Testigo de personal / docente' : 'Testigo externo / manual'} #{idx + 1}
                          </span>
                          <button
                            type="button"
                            className="ra-btn ra-btn-compacto ra-btn-peligro"
                            onClick={() => quitarTestigo(idx)}
                            disabled={disabled}
                            aria-label={`Quitar testigo #${idx + 1}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Quitar
                          </button>
                        </div>

                        <div className="ra-form-grid-2">
                          <div>
                            <label className="ra-etiqueta-campo" htmlFor={`testigo-nombre-${idx}`}>
                              Nombre completo
                            </label>
                            <input
                              id={`testigo-nombre-${idx}`}
                              type="text"
                              className="ra-control"
                              value={testigo.nombreCompleto}
                              readOnly={esPersonal}
                              disabled={disabled}
                              onChange={e =>
                                actualizarTestigo(idx, { nombreCompleto: e.target.value })
                              }
                              placeholder="Nombre completo del testigo"
                            />
                          </div>

                          <div>
                            <label className="ra-etiqueta-campo" htmlFor={`testigo-cargo-${idx}`}>
                              Cargo o identificación
                            </label>
                            <input
                              id={`testigo-cargo-${idx}`}
                              type="text"
                              className="ra-control"
                              value={testigo.cargoIdentificacion}
                              disabled={disabled}
                              onChange={e =>
                                actualizarTestigo(idx, { cargoIdentificacion: e.target.value })
                              }
                              placeholder={
                                esPersonal
                                  ? 'Puesto institucional'
                                  : 'Ej. Padre de familia · INE 1234567890'
                              }
                            />
                          </div>
                        </div>

                        {errorTestigo && (
                          <p className="ra-error-campo" role="alert">
                            {errorTestigo}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 4. Relatoría de hechos */}
          <div>
            <CampoConAyuda
              etiqueta="4. Relatoría de hechos (Modo, tiempo y lugar)"
              ayuda="Redacta de forma clara, objetiva y cronológica lo acontecido (cuándo, dónde, quiénes intervinieron y qué hechos constataron), evitando suposiciones o juicios personales."
            >
              <textarea
                className={`ra-textarea min-h-[140px] ${
                  erroresCampos['acta.relatoriaHechos'] ? 'con-error' : ''
                }`}
                value={acta.relatoriaHechos}
                disabled={disabled}
                onChange={e => actualizarActa({ relatoriaHechos: e.target.value })}
                placeholder="Describe de manera objetiva y cronológica los hechos ocurridos, indicando modo, tiempo y lugar..."
              />
            </CampoConAyuda>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              {erroresCampos['acta.relatoriaHechos'] ? (
                <p className="ra-error-campo m-0" role="alert">
                  {erroresCampos['acta.relatoriaHechos']}
                </p>
              ) : (
                <span className="ra-ayuda-nota m-0">
                  Mínimo {MIN_CARACTERES_RELATORIA_ACTA} caracteres objetivos.
                </span>
              )}
              <span className="text-xs font-semibold text-[var(--ra-secundario)]">
                {acta.relatoriaHechos.trim().length} caracteres
              </span>
            </div>
          </div>

          {/* 5. Pruebas o anexos */}
          <div>
            <CampoConAyuda
              etiqueta="5. Pruebas o anexos documentales (Opcional)"
              ayuda="Menciona fotografías, capturas, objetos resguardados, oficios o reportes previos vinculados con este hecho."
            >
              <textarea
                className="ra-textarea min-h-[76px]"
                value={acta.pruebasAnexos ?? ''}
                disabled={disabled}
                onChange={e => actualizarActa({ pruebasAnexos: e.target.value })}
                placeholder="Ej. Anexo 1: Fotografía del mobiliario; Anexo 2: Reporte previo de fecha..."
              />
            </CampoConAyuda>
          </div>

          {/* 6. Cierre y vista previa de firmas */}
          <div className="rounded-lg border border-[var(--ra-borde)] bg-[var(--ra-superficie)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[var(--ra-acento-texto)]" aria-hidden="true" />
                <h4 className="m-0 text-sm font-bold">
                  6. Cierre y bloques de firmas autógrafas ({firmantes.todos.length})
                </h4>
              </div>
              <button
                type="button"
                className="ra-btn ra-btn-compacto"
                onClick={() => setMostrarVistaPrevia(true)}
                disabled={disabled}
              >
                <Plus size={14} aria-hidden="true" />
                Abrir formato completo para impresión / PDF
              </button>
            </div>
            <p className="ra-ayuda-nota mt-1">
              El cierre asentará la hora de conclusión ({acta.horaConclusion || '--:--'} h). Quienes firman aparecerán en la cuadrícula inferior del documento:
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {firmantes.todos.map((f, i) => (
                <div
                  key={`${f.rolFirmante}-${f.referenciaId ?? i}`}
                  className="rounded-md border border-[var(--ra-borde)] bg-[var(--ra-superficie-suave)] p-2.5 text-xs"
                >
                  <div className="font-bold text-[var(--ra-acento-texto)]">
                    {f.rolFirmante === 'LEVANTA_ACTA'
                      ? 'Levanta el acta'
                      : f.rolFirmante === 'ALUMNO_INVOLUCRADO'
                        ? 'Alumno(a)'
                        : f.rolFirmante === 'DOCENTE_INVOLUCRADO'
                          ? 'Docente'
                          : f.tipoTestigo === 'EXTERNO'
                            ? 'Testigo externo'
                            : 'Testigo personal'}
                  </div>
                  <div className="mt-0.5 font-semibold text-[var(--ra-texto)]">{f.nombreCompleto}</div>
                  <div className="text-[var(--ra-secundario)]">{f.cargoIdentificacion}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ModalConfirmacion
        isOpen={mostrarConfirmarOcultar}
        title="¿Descartar datos del Acta de Hechos?"
        message="Ya capturaste información en el Acta de Hechos. Si desactivas esta casilla, los campos y testigos del acta se descartarán al guardar."
        type="warning"
        confirmText="Descartar acta"
        cancelText="Conservar acta"
        onCancel={() => setMostrarConfirmarOcultar(false)}
        onConfirm={() => {
          setMostrarConfirmarOcultar(false);
          onActualizarBorrador(prev => ({
            ...prev,
            tieneActaHechos: false,
            acta: null,
          }));
        }}
      />

      {mostrarVistaPrevia && borrador.tieneActaHechos && (
        <ImpresionActaHechos
          borrador={{ ...borrador, acta }}
          folio={folio}
          cicloNombre={cicloNombre}
          appConfig={appConfig}
          onCerrar={() => setMostrarVistaPrevia(false)}
        />
      )}
    </section>
  );
}
