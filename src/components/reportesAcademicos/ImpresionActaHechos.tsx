import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { printElement } from '../../lib/printUtils';
import type { AppConfig } from '../../types';
import {
  construirFirmantesActa,
  construirInvolucradosParaActa,
  INSTITUCION_ACTA_POR_DEFECTO,
  TITULO_ACTA_POR_DEFECTO,
} from '../../reportesAcademicos/dominio';
import {
  descargarPdfActaHechos,
  formatearFechaLargaEspanol,
  formatearHoraDocumento,
} from '../../reportesAcademicos/exportarActaHechosPdf';
import type { BorradorReporteAcademico, FirmanteActaHechos } from '../../reportesAcademicos/types';

export interface ImpresionActaHechosProps {
  borrador: BorradorReporteAcademico;
  folio?: string | null;
  cicloNombre?: string | null;
  appConfig?: AppConfig | null;
  onCerrar?: () => void;
  enModal?: boolean;
}

function etiquetaRolFirmaHtml(
  rol: FirmanteActaHechos['rolFirmante'],
  tipoTestigo?: FirmanteActaHechos['tipoTestigo']
): string {
  switch (rol) {
    case 'LEVANTA_ACTA':
      return 'Quien instrumenta y levanta el acta';
    case 'ALUMNO_INVOLUCRADO':
      return 'Alumno(a) involucrado(a)';
    case 'DOCENTE_INVOLUCRADO':
      return 'Docente involucrado(a)';
    case 'TESTIGO_ASISTENCIA':
      return tipoTestigo === 'EXTERNO' ? 'Testigo de asistencia (Externo)' : 'Testigo de asistencia';
  }
}

export default function ImpresionActaHechos({
  borrador,
  folio,
  cicloNombre,
  appConfig,
  onCerrar,
  enModal = true,
}: ImpresionActaHechosProps) {
  const hojaRef = useRef<HTMLDivElement>(null);
  const cerrarBtnRef = useRef<HTMLButtonElement>(null);
  const tituloModalId = useId();
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const acta = borrador.acta;
  const nombreInstitucion = (acta?.nombreInstitucion || INSTITUCION_ACTA_POR_DEFECTO).trim();
  const tituloDocumento = (acta?.tituloDocumento || TITULO_ACTA_POR_DEFECTO).trim();
  const folioTexto = (folio || 'BORRADOR SIN FOLIO').trim();
  const cicloTexto = (cicloNombre || 'Ciclo escolar vigente').trim();
  const lugar = (acta?.lugar || 'Instalaciones de la institución').trim();
  const fechaTexto = formatearFechaLargaEspanol(acta?.fechaLevantamiento || borrador.fechaReporte);
  const horaInicio = formatearHoraDocumento(acta?.horaInicio);
  const horaConclusion = formatearHoraDocumento(acta?.horaConclusion);
  const levantaNombre = (acta?.empleadoLevantaNombre || 'Personal administrativo designado').trim();
  const levantaCargo = (acta?.empleadoLevantaCargo || 'Administración Escolar').trim();
  const relatoria = (acta?.relatoriaHechos || borrador.descripcion || 'Sin relatoría asentada.').trim();
  const pruebas = (acta?.pruebasAnexos || '').trim();
  const enlaceDrive = (borrador.enlaceDrive || '').trim();
  const notasEvidencia = (borrador.notasEvidencia || '').trim();

  const logoUrl = (appConfig?.constanciaParams?.customLogoUrl || appConfig?.logoUrl || '').trim() || null;
  const direccionInst = (appConfig?.constanciaParams?.headerAddress || '').trim() || null;
  const rfcCctInst = (appConfig?.constanciaParams?.headerRfc || '').trim() || null;
  const telefonosInst = (appConfig?.constanciaParams?.headerPhones || '').trim() || null;

  const involucrados = construirInvolucradosParaActa(borrador);
  const firmantes = construirFirmantesActa(borrador);
  const tieneAnexos = Boolean(pruebas || enlaceDrive || notasEvidencia);

  useEffect(() => {
    if (!enModal || !onCerrar) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cerrarBtnRef.current?.focus();
    const manejarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCerrar();
      }
    };
    document.addEventListener('keydown', manejarTecla, true);
    return () => {
      document.removeEventListener('keydown', manejarTecla, true);
      if (anterior?.isConnected) anterior.focus({ preventScroll: true });
    };
  }, [enModal, onCerrar]);

  const manejarImprimir = () => {
    if (!hojaRef.current) return;
    printElement(hojaRef.current, { landscape: false });
  };

  const manejarDescargarPdf = async () => {
    setDescargandoPdf(true);
    try {
      await descargarPdfActaHechos(borrador, {
        folio: folioTexto,
        cicloNombre: cicloTexto,
        logoUrl,
        direccionInstitucional: direccionInst,
        rfcCctInstitucional: rfcCctInst,
        telefonosInstitucional: telefonosInst,
      });
      toast.success('PDF del Acta de Hechos descargado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el PDF del Acta de Hechos.');
    } finally {
      setDescargandoPdf(false);
    }
  };

  const hojaImprimible = (
    <div
      ref={hojaRef}
      className="ra-acta-hoja"
      style={{
        backgroundColor: '#ffffff',
        color: '#111827',
        fontFamily: 'DM Sans, Helvetica Neue, Helvetica, Arial, sans-serif',
        fontSize: '12.5px',
        lineHeight: 1.6,
        padding: '44px 52px',
        maxWidth: '816px',
        margin: '0 auto',
      }}
    >
      {/* Encabezado institucional */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          borderBottom: '2px solid #182235',
          paddingBottom: '12px',
          marginBottom: '14px',
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo institucional"
            style={{ width: '68px', height: '68px', objectFit: 'contain', flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, textAlign: logoUrl ? 'left' : 'center' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              color: '#0f172a',
            }}
          >
            {nombreInstitucion}
          </h1>
          {direccionInst && (
            <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#475569' }}>{direccionInst}</p>
          )}
          {rfcCctInst && (
            <p style={{ margin: '1px 0 0', fontSize: '10px', color: '#475569' }}>{rfcCctInst}</p>
          )}
          {telefonosInst && (
            <p style={{ margin: '1px 0 0', fontSize: '10px', color: '#475569' }}>{telefonosInst}</p>
          )}
        </div>
      </header>

      {/* Banda de título y metadatos */}
      <div
        style={{
          backgroundColor: '#182235',
          color: '#ffffff',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '15px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '8px 12px',
          borderRadius: '4px',
          marginBottom: '10px',
        }}
      >
        {tituloDocumento}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          backgroundColor: '#f1f5f9',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          padding: '7px 12px',
          fontSize: '11.5px',
          marginBottom: '18px',
        }}
      >
        <span>
          <strong>Folio:</strong> {folioTexto}
        </span>
        <span>
          <strong>Ciclo escolar:</strong> {cicloTexto}
        </span>
      </div>

      {/* I. Lugar, fecha y hora */}
      <section style={{ marginBottom: '16px' }}>
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            backgroundColor: '#f1f5f9',
            borderLeft: '3px solid #1456f0',
            padding: '5px 10px',
            color: '#0f172a',
          }}
        >
          I. Lugar, fecha y hora de levantamiento
        </h2>
        <p style={{ margin: 0, textAlign: 'justify' }}>
          En <strong>{lugar}</strong>, siendo las <strong>{horaInicio}</strong> horas del día{' '}
          <strong>{fechaTexto}</strong>, ante la presencia de <strong>{levantaNombre}</strong>, en su carácter de{' '}
          <strong>{levantaCargo}</strong> de {nombreInstitucion}, se instrumenta la presente {tituloDocumento}{' '}
          correspondiente al reporte con folio <strong>{folioTexto}</strong>, con fundamento en la normativa escolar
          vigente.
        </p>
      </section>

      {/* II. Participantes y testigos */}
      <section style={{ marginBottom: '16px' }}>
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            backgroundColor: '#f1f5f9',
            borderLeft: '3px solid #1456f0',
            padding: '5px 10px',
            color: '#0f172a',
          }}
        >
          II. Participantes y testigos de asistencia
        </h2>
        <p style={{ margin: '0 0 6px' }}>
          <strong>Quien levanta el acta:</strong> {levantaNombre} ({levantaCargo}).
        </p>
        <div style={{ marginBottom: '6px' }}>
          <strong>Personas o grupos involucrados:</strong>
          {involucrados.mencionesTexto.length > 0 ? (
            <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
              {involucrados.mencionesTexto.map((texto, idx) => (
                <li key={idx} style={{ marginBottom: '3px' }}>
                  {texto}
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ marginLeft: '6px' }}>Sin participantes especificados.</span>
          )}
        </div>
        <div>
          <strong>Testigos de asistencia:</strong>
          {acta?.testigos && acta.testigos.length > 0 ? (
            <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
              {acta.testigos.map((t, idx) => (
                <li key={idx} style={{ marginBottom: '3px' }}>
                  {t.nombreCompleto} — {t.cargoIdentificacion}{' '}
                  <em>({t.tipo === 'EXTERNO' ? 'Externo' : 'Personal institucional'})</em>
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ marginLeft: '6px' }}>No se registraron testigos adicionales.</span>
          )}
        </div>
      </section>

      {/* III. Relatoría de hechos */}
      <section style={{ marginBottom: '16px' }}>
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            backgroundColor: '#f1f5f9',
            borderLeft: '3px solid #1456f0',
            padding: '5px 10px',
            color: '#0f172a',
          }}
        >
          III. Relatoría de hechos (modo, tiempo y lugar)
        </h2>
        <div style={{ textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{relatoria}</div>
      </section>

      {/* IV. Pruebas o anexos */}
      {tieneAnexos && (
        <section style={{ marginBottom: '16px' }}>
          <h2
            style={{
              margin: '0 0 8px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              backgroundColor: '#f1f5f9',
              borderLeft: '3px solid #1456f0',
              padding: '5px 10px',
              color: '#0f172a',
            }}
          >
            IV. Pruebas y anexos documentales
          </h2>
          {pruebas && (
            <p style={{ margin: '0 0 6px', textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
              <strong>Elementos probatorios y anexos:</strong> {pruebas}
            </p>
          )}
          {enlaceDrive && (
            <p style={{ margin: '0 0 4px', wordBreak: 'break-all', fontSize: '11.5px' }}>
              <strong>Respaldo digital (Google Drive):</strong> {enlaceDrive}
            </p>
          )}
          {notasEvidencia && (
            <p style={{ margin: 0, textAlign: 'justify' }}>
              <strong>Notas de evidencia:</strong> {notasEvidencia}
            </p>
          )}
        </section>
      )}

      {/* V. Cierre y firmas autógrafas */}
      <section>
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            backgroundColor: '#f1f5f9',
            borderLeft: '3px solid #1456f0',
            padding: '5px 10px',
            color: '#0f172a',
          }}
        >
          {tieneAnexos ? 'V.' : 'IV.'} Cierre del acta y firmas autógrafas
        </h2>
        <p style={{ margin: '0 0 12px', textAlign: 'justify' }}>
          Leída que fue la presente {tituloDocumento} y enterados los comparecientes de su contenido y alcance, no
          habiendo más hechos que asentar, se da por concluida a las <strong>{horaConclusion}</strong> horas del día{' '}
          <strong>{fechaTexto}</strong>, firmando de conformidad al calce quienes en ella intervinieron.
        </p>

        <div
          className="ra-acta-firmas-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '26px 32px',
            marginTop: '20px',
          }}
        >
          {firmantes.todos.map((firmante, idx) => {
            const esUltimoImpar = idx === firmantes.todos.length - 1 && firmantes.todos.length % 2 === 1;
            return (
              <div
                key={`${firmante.rolFirmante}-${firmante.referenciaId ?? idx}`}
                className="ra-acta-firma-celda"
                style={{
                  gridColumn: esUltimoImpar ? '1 / -1' : undefined,
                  maxWidth: esUltimoImpar ? '340px' : undefined,
                  width: '100%',
                  margin: esUltimoImpar ? '0 auto' : undefined,
                  textAlign: 'center',
                  paddingTop: '24px',
                  breakInside: 'avoid',
                  pageBreakInside: 'avoid',
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#475569',
                    marginBottom: '26px',
                  }}
                >
                  {etiquetaRolFirmaHtml(firmante.rolFirmante, firmante.tipoTestigo)}
                </div>
                <div
                  className="ra-acta-firma-linea"
                  style={{
                    borderTop: '1px solid #1e293b',
                    paddingTop: '5px',
                    fontWeight: 700,
                    fontSize: '11.5px',
                    color: '#0f172a',
                  }}
                >
                  {firmante.nombreCompleto || 'Nombre sin especificar'}
                </div>
                <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '2px' }}>
                  {firmante.cargoIdentificacion}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const barraAcciones = (
    <div className="ra-acta-modal-barra">
      <div>
        <h2 id={tituloModalId} className="m-0 text-base font-bold">
          Vista previa oficial — {tituloDocumento}
        </h2>
        <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
          Folio: {folioTexto} · {cicloTexto}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="ra-btn" onClick={manejarImprimir}>
          <Printer size={16} aria-hidden="true" />
          Imprimir directamente
        </button>
        <button
          type="button"
          className="ra-btn ra-btn-primario"
          onClick={() => void manejarDescargarPdf()}
          disabled={descargandoPdf}
        >
          <Download size={16} aria-hidden="true" />
          {descargandoPdf ? 'Generando PDF…' : 'Descargar PDF'}
        </button>
        {onCerrar && (
          <button
            ref={cerrarBtnRef}
            type="button"
            className="ra-btn"
            onClick={onCerrar}
            aria-label="Cerrar vista previa"
          >
            <X size={16} aria-hidden="true" />
            Cerrar
          </button>
        )}
      </div>
    </div>
  );

  if (!enModal) {
    return (
      <div className="ra-acta-modal">
        {barraAcciones}
        <div className="ra-acta-modal-cuerpo">{hojaImprimible}</div>
      </div>
    );
  }

  return createPortal(
    <div
      className="ra-acta-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloModalId}
    >
      <div className="ra-acta-modal">
        {barraAcciones}
        <div className="ra-acta-modal-cuerpo">{hojaImprimible}</div>
      </div>
    </div>,
    document.body
  );
}

