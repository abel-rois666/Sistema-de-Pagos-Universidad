import React, { forwardRef } from 'react';
import type { Recibo, ReciboDetalle, Alumno } from '../types';

interface Props {
  recibo: Recibo;
  detalles: ReciboDetalle[];
  alumno: Alumno | undefined;
  logoUrl?: string;
  licenciaturasMetadata?: Record<string, { tipo_academico?: string; tipo_periodo?: string }>;
}

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [y, m, d] = dateString.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateString;
};

const HeaderRow = ({ label, value, label2, value2 }: any) => (
  <div className="flex border-b border-black">
    <div className="w-1/6 p-1 bg-gray-200 font-bold flex items-center justify-center text-[10px] text-center border-r border-black">{label}</div>
    <div className="w-2/6 p-1 flex items-center justify-center font-bold text-[10px] text-center border-r border-black">{value}</div>
    <div className="w-1/6 p-1 bg-gray-200 font-bold flex items-center justify-center text-[10px] text-center border-r border-black">{label2}</div>
    <div className="w-2/6 p-1 flex items-center justify-center font-bold text-[10px] text-center">{value2}</div>
  </div>
);

const SingleReceipt = ({ recibo, detalles, alumno, copyName, logoUrl, licenciaturasMetadata }: Props & { copyName: string }) => {
  const blankRows = Math.max(0, 5 - detalles.length);

  // Determinar tipo académico y periodo desde metadata del catálogo
  const lic = alumno?.licenciatura || '';
  const meta = licenciaturasMetadata?.[lic];
  const tipoAcademico = meta?.tipo_academico || 'LICENCIATURA';
  const tipoPeriodo = meta?.tipo_periodo || 'CUATRIMESTRAL';

  const labelAcademico = tipoAcademico === 'ESPECIALIDAD' ? 'DE LA ESPECIALIDAD EN' : 'DE LA LICENCIATURA EN';
  const sufijoPeriodo = tipoPeriodo === 'SEMESTRAL' ? 'SEMESTRE' : 'CUATRIMESTRE';
  const gradoDisplay = alumno?.grado_actual ? `${alumno.grado_actual} ${sufijoPeriodo}` : '';

  return (
    <div className="w-full mb-1 border-t-2 border-dashed border-gray-400 pt-1 first:border-0 first:pt-0">
      <div className="border border-black bg-white">
        {/* ROW 1: Header */}
        <div className="flex border-b border-black">
          <div className="w-1/6 p-2 flex items-center justify-center border-r border-black">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-12 h-12 object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-12 h-12 bg-blue-100 flex items-center justify-center text-xs font-bold text-gray-400">LOGO</div>
            )}
          </div>
          <div className="w-4/6 p-2 flex items-center justify-center border-r border-black">
            <h2 className="text-sm font-black text-center tracking-wide uppercase mt-2">
              CENTRO UNIVERSITARIO ORIENTE DE MÉXICO
            </h2>
          </div>
          <div className="w-1/6 flex flex-col">
            <div className="flex border-b border-black h-1/2">
              <div className="w-1/2 bg-gray-200 font-bold flex items-center justify-center text-[10px] border-r border-black">N Folio</div>
              <div className="w-1/2 flex items-center justify-center font-bold text-red-600 text-[11px]">{recibo.folio || '---'}</div>
            </div>
            <div className="flex h-1/2">
              <div className="w-1/2 bg-gray-200 font-bold flex items-center justify-center text-[10px] border-r border-black">Fecha:</div>
              <div className="w-1/2 flex items-center justify-center font-bold text-[10px]">{formatDate(recibo.fecha_recibo)}</div>
            </div>
          </div>
        </div>

        {/* ROW 2..4: Student Info */}
        <HeaderRow 
          label="RECIBIMOS DE" value={alumno?.nombre_completo || ''} 
          label2="FECHA DE PAGO" value2={formatDate(recibo.fecha_pago)} 
        />
        <HeaderRow 
          label="ALUMNO (A) DEL" value={gradoDisplay} 
          label2={labelAcademico} value2={alumno?.licenciatura || ''} 
        />
        <div className="flex border-b border-black">
          <div className="w-1/6 p-1 bg-gray-200 font-bold flex items-center justify-center text-[10px] border-r border-black">TURNO</div>
          <div className="w-5/6 p-1 flex items-center justify-center font-bold text-[10px] uppercase">{alumno?.turno || ''}</div>
        </div>

        {/* ROW 5: Detail Headers */}
        <div className="flex border-b border-black bg-gray-200 font-bold text-[9px] text-center">
          <div className="w-[10%] p-1 border-r border-black flex items-center justify-center">CANTIDAD</div>
          <div className="w-[34%] p-1 border-r border-black flex items-center justify-center">CONCEPTO</div>
          <div className="w-[14%] p-1 border-r border-black flex items-center justify-center">COSTO UNITARIO</div>
          <div className="w-[14%] p-1 border-r border-black flex items-center justify-center">TOTAL</div>
          <div className="w-[16%] p-1 border-r border-black flex items-center justify-center">FORMA DE PAGO</div>
          <div className="w-[12%] p-1 flex items-center justify-center">BANCO</div>
        </div>

        {/* Details Rows */}
        {detalles.map((d, i) => (
          <div key={i} className="flex border-b border-black text-[9px]">
            <div className="w-[10%] py-[2px] border-r border-black flex items-center justify-center">{d.cantidad}</div>
            <div className="w-[34%] py-[2px] px-1 border-r border-black flex flex-col justify-center overflow-hidden uppercase">
              <span className="truncate">{d.concepto}</span>
              {d.observaciones && (
                <span className="text-[8px] font-bold italic text-orange-600 normal-case leading-tight">
                  ⚠ {d.observaciones}
                </span>
              )}
            </div>
            <div className="w-[14%] py-[2px] border-r border-black flex items-center justify-center">${Number(d.costo_unitario).toFixed(2)}</div>
            <div className="w-[14%] py-[2px] border-r border-black flex items-center justify-center font-bold">${Number(d.subtotal).toFixed(2)}</div>
            <div className="w-[16%] py-[2px] border-r border-black flex items-center justify-center text-center leading-tight">{i === 0 ? recibo.forma_pago : ''}</div>
            <div className="w-[12%] py-[2px] flex items-center justify-center uppercase truncate">{i === 0 ? recibo.banco : ''}</div>
          </div>
        ))}
        {Array.from({ length: blankRows }).map((_, i) => (
          <div key={`blank-${i}`} className="flex border-b border-black text-[9px] h-[19px]">
             <div className="w-[10%] border-r border-black"></div>
             <div className="w-[34%] border-r border-black"></div>
             <div className="w-[14%] border-r border-black"></div>
             <div className="w-[14%] border-r border-black"></div>
             <div className="w-[16%] border-r border-black"></div>
             <div className="w-[12%]"></div>
          </div>
        ))}

        {/* ROW LAST: Total */}
        <div className="flex">
          <div className={`w-[50%] p-1 border-r border-black font-bold text-[9px] flex items-end justify-center pb-1 ${Number(recibo.uso_saldo_a_favor) > 0 ? 'flex-col relative' : ''}`}>
             {Number(recibo.uso_saldo_a_favor) > 0 && <div className="absolute top-1 left-0 w-full text-center text-[8px] italic opacity-80 leading-tight px-2">Total de servicio: ${Number(recibo.total).toFixed(2)}. Diferencia cubierta usando ${Number(recibo.uso_saldo_a_favor).toFixed(2)} de <strong>Saldo a Favor</strong>.</div>}
             <span>FIRMA CAJERO</span>
          </div>
          <div className="w-[15%] bg-gray-200 border-r border-black font-bold flex items-center justify-center text-[9px] text-center uppercase px-1 leading-tight">
             {Number(recibo.uso_saldo_a_favor) > 0 ? 'TOTAL REAL CAJA' : 'TOTAL'}
          </div>
          <div className="w-[15%] font-bold flex items-center justify-center text-[11px] border-r border-black bg-gray-50">
             ${(Number(recibo.total) - Number(recibo.uso_saldo_a_favor || 0)).toFixed(2)}
          </div>
          <div className="w-[20%]"></div>
        </div>
      </div>
      <div className="flex justify-between text-[8px] font-bold mt-[2px] px-2 uppercase">
        <span>
          {recibo.folio_fiscal 
            ? `COMPROBANTE VINCULADO A FACTURA FISCAL (UUID/FOLIO: ${recibo.folio_fiscal})`
            : 'RECIBO SIN VALOR FISCAL ÚNICAMENTE PARA CONTROL ESCOLAR'}
        </span>
        <span className="text-[9px]">{copyName}</span>
      </div>
    </div>
  );
};

export const ReciboPlantillaPDF = forwardRef<HTMLDivElement, Props>((props, ref) => {
  return (
    <div 
       ref={ref} 
       className="bg-white text-black p-4 shrink-0 mx-auto font-sans"
       style={{ width: '816px', height: '1056px' }} // Standard Letter size 8.5 x 11 inches at 96 DPI
    >
      <SingleReceipt {...props} copyName="ALUMNO" />
      <SingleReceipt {...props} copyName="CONTROL ESCOLAR" />
      <SingleReceipt {...props} copyName="CONTROL DE PAGOS" />
    </div>
  );
});

export default ReciboPlantillaPDF;
