import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Upload, Download, CheckCircle, AlertTriangle, FileText, ChevronRight, ChevronLeft, Loader2, AlertCircle, Eye } from 'lucide-react';
import { Alumno, CicloEscolar } from '../types';
import { CSV_HEADERS_RECIBOS, generateCSV, downloadCSV } from '../utils';
import { supabase, saveReciboCompleto } from '../lib/supabase';

interface ParsedRowRecibo {
    rowIndex: number;
    nombre_alumno: string;
    no_recibo: string;
    fecha_emision: string;
    fecha_pago: string;
    total_final: number;
    estatus: string;
    detalles: { cantidad: number; concepto: string; costo_unitario: number; costo_total: number }[];
    forma_pago: string;
    banco: string;
    errors: string[];
}

interface ImportarRegistrosCSVProps {
    alumnos: Alumno[];
    activeCiclo?: CicloEscolar;
    ciclos: CicloEscolar[];
    onImport: () => void;
    onClose: () => void;
}

const SAMPLE_ROWS_RECIBOS = [
    [
        'CHAVEZ CORDERO SAMARA YAMIL', '001', '15/01/2026', '1500', '15/01/2026', 'ACTIVO',
        '1', 'INSCRIPCION', '1000', '1000', 'TRANSFERENCIA', 'BBVA',
        '1', 'CREDENCIAL', '500', '500', 'TRANSFERENCIA', 'BBVA',
        '', '', '', '', '', '',
        '', '', '', '', '', '',
        '', '', '', '', '', ''
    ]
];

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function parseRows(csvText: string): ParsedRowRecibo[] {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    
    const headers = parseCSVLine(lines[0]).map(h => h.toUpperCase().trim());
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => headerMap[h] = i);

    const dataLines = lines.slice(1);
    return dataLines.map((line, idx) => {
        const cols = parseCSVLine(line);
        const getCol = (name: string) => {
            const index = headerMap[name];
            return index !== undefined && cols[index] ? cols[index].trim() : '';
        };

        const errors: string[] = [];

        const nombre_alumno = getCol('NOMBRE DEL ALUMNO').toUpperCase();
        const no_recibo = getCol('Nº RECIBO');
        const fecha_emision = getCol('FECHA EMISIÓN DE RECIBO') || getCol('FECHA EMISION DE RECIBO');
        const fecha_pago = getCol('FECHA DE PAGO');
        
        const totalRaw = getCol('TOTAL FINAL').replace(/[^0-9.]/g, '');
        const total_final = parseFloat(totalRaw) || 0;
        
        const estatus = getCol('ESTATUS').toUpperCase() || 'ACTIVO';

        if (!nombre_alumno) errors.push('Falta NOMBRE DEL ALUMNO');
        if (!fecha_emision) errors.push('Falta FECHA EMISIÓN DE RECIBO');
        if (!fecha_pago) errors.push('Falta FECHA DE PAGO');

        const detalles: { cantidad: number; concepto: string; costo_unitario: number; costo_total: number }[] = [];
        let globalFormaPago = '';
        let globalBanco = '';

        for (let g = 1; g <= 5; g++) {
            const concepto = getCol(`CONCEPTO ${g}`).toUpperCase();
            if (!concepto) continue;
            
            const cantidadRaw = getCol(`CANTIDAD ${g}`).replace(/[^0-9.]/g, '');
            const cantidad = parseFloat(cantidadRaw) || 1;
            
            const costoUnitarioRaw = getCol(`COSTO UNITARIO ${g}`) || getCol(`COSTO UNITARIO${g}`);
            const costo_unitario = parseFloat(costoUnitarioRaw.replace(/[^0-9.]/g, '')) || 0;
            
            const costoTotalRaw = getCol(`COSTO TOTAL ${g}`) || getCol(`COSTO TOTAL${g}`);
            const costo_total = parseFloat(costoTotalRaw.replace(/[^0-9.]/g, '')) || (cantidad * costo_unitario);
            
            const formaPago = getCol(`FORMA DE PAGO ${g}`) || getCol(`FORMA DE PAGO${g}`);
            const banco = getCol(`BANCO ${g}`) || getCol(`BANCO${g}`);

            if (formaPago && !globalFormaPago) globalFormaPago = formaPago;
            if (banco && !globalBanco) globalBanco = banco;

            detalles.push({ cantidad, concepto, costo_unitario, costo_total });
        }

        if (detalles.length === 0) errors.push('El recibo no tiene conceptos válidos en las columnas 1 a 5');

        return {
            rowIndex: idx + 2,
            nombre_alumno,
            no_recibo,
            fecha_emision,
            fecha_pago,
            total_final,
            estatus,
            detalles,
            forma_pago: globalFormaPago || 'EFECTIVO',
            banco: globalBanco || 'N/A',
            errors
        };
    }).filter(r => r.nombre_alumno);
}

// Convert DD/MM/YYYY to YYYY-MM-DD (robust: handles DD/MM/YY, YYYY-MM-DD, etc.)
function parseDateForDB(dateStr: string): string {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const s = dateStr.trim();
    // Already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Split by separator: / - or .
    const parts = s.split(/[\/\-\.]/);
    if (parts.length === 3) {
        let [a, b, c] = parts.map(p => p.trim());
        // Detect if first part is the year (YYYY-MM-DD or YY-MM-DD style with separator)
        if (a.length === 4) {
            // already YYYY/MM/DD
            return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
        }
        // DD/MM/YYYY or DD/MM/YY
        const year = c.length === 2 ? `20${c}` : c;
        // Validate parts are numeric and in range
        const dd = parseInt(a, 10);
        const mm = parseInt(b, 10);
        const yyyy = parseInt(year, 10);
        if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy) && dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 2000) {
            return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
        }
    }
    // Last resort: try native Date parse (may fail in some locales)
    const attempt = new Date(s);
    if (!isNaN(attempt.getTime())) return attempt.toISOString().split('T')[0];
    // Return today so the DB doesn't get garbage
    return new Date().toISOString().split('T')[0];
}

export default function ImportarRegistrosCSV({ alumnos, activeCiclo: activeCicloProp, ciclos, onImport, onClose }: ImportarRegistrosCSVProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [parsedRows, setParsedRows] = useState<ParsedRowRecibo[]>([]);
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ added: number; errors: number; log: string[]; warnings: string[] } | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeCiclo = activeCicloProp || ciclos.find(c => c.activo) || ciclos[0];

    const handleDownloadTemplate = () => {
        const rows = SAMPLE_ROWS_RECIBOS.map(r => {
            const padded = [...r];
            while (padded.length < CSV_HEADERS_RECIBOS.length) padded.push('');
            return padded;
        });
        downloadCSV(generateCSV(CSV_HEADERS_RECIBOS, rows), 'plantilla_importacion_pagos.csv');
    };

    const processFile = useCallback((file: File) => {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = parseRows(text);
            
            // Validate existence of Alumnos
            const validatedRows = rows.map(r => {
                const asocAlumno = alumnos.find(a => a.nombre_completo.toUpperCase() === r.nombre_alumno);
                if (!asocAlumno) {
                    r.errors.push(`Alumno no encontrado: ${r.nombre_alumno}`);
                }
                return r;
            });
            
            setParsedRows(validatedRows);
            setStep(2);
        };
        reader.readAsText(file, 'UTF-8');
    }, [alumnos]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.name.endsWith('.csv')) processFile(file);
    };

    const handleConfirm = async () => {
        setImporting(true);
        await new Promise(r => setTimeout(r, 600)); 

        const validRows = parsedRows.filter(r => r.errors.length === 0);
        let added = 0;
        let errorsCount = 0;
        const log: string[] = [];
        const warnings: string[] = [];

        for (const row of validRows) {
            const asocAlumno = alumnos.find(a => a.nombre_completo.toUpperCase() === row.nombre_alumno);
            if (!asocAlumno) {
                errorsCount++;
                log.push(`Fila ${row.rowIndex}: Alumno no encontrado`);
                continue;
            }

            const folioParseado = parseInt(row.no_recibo, 10);
            const reciboPayload: any = {
                fecha_recibo: parseDateForDB(row.fecha_emision),
                fecha_pago: parseDateForDB(row.fecha_pago),
                alumno_id: asocAlumno.id,
                ciclo_id: activeCiclo.id,
                total: row.total_final,
                forma_pago: row.forma_pago,
                banco: row.banco,
                estatus: row.estatus === 'CANCELADO' ? 'CANCELADO' : 'ACTIVO'
            };

            if (!isNaN(folioParseado)) {
                reciboPayload.folio = folioParseado;
            }

            const detallesPayload: any[] = row.detalles.map(d => ({
                cantidad: d.cantidad,
                concepto: d.concepto,
                costo_unitario: d.costo_unitario,
                subtotal: d.costo_total
            }));

            let planUpdates: any = undefined;
            let excedenteGlobalRecibo = 0;

            // Vinculación Automática Inteligente (todas las fechas/ciclos históricos)
            if (reciboPayload.estatus === 'ACTIVO') {
                const { data: planes } = await supabase
                    .from('planes_pago')
                    .select('*')
                    .eq('alumno_id', asocAlumno.id);

                if (planes && planes.length > 0) {
                    const planesMutables: any[] = JSON.parse(JSON.stringify(planes));
                    const updatesPorPlan: Record<string, any> = {};
                    let bestCicloId: string | null = null;
                    
                    const parseDateToMs = (dStr: string) => {
                        if (!dStr) return 0;
                        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return new Date(dStr).getTime() || 0;
                        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
                            const [d, m, y] = dStr.split('/');
                            return new Date(Number(y), Number(m)-1, Number(d)).getTime() || 0;
                        }
                        return new Date(dStr).getTime() || 0;
                    };

                    detallesPayload.forEach(d => {
                        let bestMatch: { planId: string; index: number; diff: number } | null = null;
                        const fechaReciboMs = new Date(reciboPayload.fecha_pago).getTime();

                        planesMutables.forEach(plan => {
                            for(let i=1; i<=9; i++) {
                                const conc = plan[`concepto_${i}`];
                                const estatus = plan[`estatus_${i}`];
                                const fechaPlan = plan[`fecha_${i}`];
                                
                                // FIX: Permitir vincular a conceptos con abonos, verificando que no estén 'PAGADO'
                                if (conc && !(estatus || '').toUpperCase().includes('PAGADO') && conc.toUpperCase() === d.concepto.toUpperCase()) {
                                    const fpMs = parseDateToMs(fechaPlan);
                                    const diff = fpMs === 0 ? 9999999999999 : Math.abs(fechaReciboMs - fpMs);
                                    
                                    if (!bestMatch || diff < bestMatch.diff) {
                                        bestMatch = { planId: plan.id, index: i, diff };
                                    }
                                }
                            }
                        });

                        if (bestMatch) {
                            d.indice_concepto_plan = bestMatch.index;
                            
                            if (!updatesPorPlan[bestMatch.planId]) updatesPorPlan[bestMatch.planId] = {};
                            
                            const planOriginal = planesMutables.find(p => p.id === bestMatch!.planId);
                            const estatusPrevio = (planOriginal[`estatus_${bestMatch.index}`] || 'PENDIENTE') as string;
                            const montoPlaneado = (planOriginal[`cantidad_${bestMatch.index}`] || 0) as number;
                            const abonoActual = d.subtotal;

                            // -- Mismo algoritmo de Abonos que RegistrarPago.tsx --
                            const getRestanteDe = (estatusText: string, totalOriginal: number): number => {
                                if (!estatusText || estatusText === 'PENDIENTE') return totalOriginal;
                                const m = estatusText.match(/Resta\s*\$([0-9,]+(?:\.\d{2})?)/);
                                if (m) return parseFloat(m[1].replace(',', ''));
                                if (estatusText.toUpperCase().includes('PAGADO')) return 0;
                                return totalOriginal;
                            };

                            const restanteAnterior = getRestanteDe(estatusPrevio, montoPlaneado);
                            const resta = restanteAnterior - abonoActual;
                            
                            // Total acumulado = pagado previamente + este abono
                            const totalPagadoNuevo = (montoPlaneado - restanteAnterior) + abonoActual;

                            // Extraer folios previos
                            const folios = (estatusPrevio.match(/R-\d+/g) || []);
                            const folioTextoPrevio = folios.length > 0 ? folios.join('; ') + '; ' : '';

                            let nuevoEstatus = '';
                            if (resta <= 0.005) {
                                // Mostrar el total pagado históricamente para este concepto, topado al monto planeado
                                const topePagado = Math.min(totalPagadoNuevo, montoPlaneado);
                                nuevoEstatus = `${folioTextoPrevio}R-{{FOLIO}} (Pagado $${topePagado.toFixed(2)})`;
                            } else {
                                nuevoEstatus = `${folioTextoPrevio}R-{{FOLIO}} (Abono $${totalPagadoNuevo.toFixed(2)}, Resta $${resta.toFixed(2)})`;
                            }

                            // --- NUEVO: ASIGNAR OBSERVACIONES AL RECIBO (ABONOS Y EXCEDENTES) ---
                            if (resta < -0.005) {
                                const excedenteAqui = Math.abs(resta);
                                excedenteGlobalRecibo += excedenteAqui;
                                d.observaciones = `Concepto liquidado ✓ (Excedente de $${excedenteAqui.toFixed(2)} depositado en Monedero)`;
                            } else if (resta > 0.005) {
                                d.observaciones = `Abono $${abonoActual.toFixed(2)} — Restante: $${resta.toFixed(2)}`;
                            } else if (totalPagadoNuevo < montoPlaneado - 0.005 || estatusPrevio.includes('Abono')) {
                                d.observaciones = `Abono final — Concepto liquidado ✓ (Total pagado: $${totalPagadoNuevo.toFixed(2)})`;
                            }

                            updatesPorPlan[bestMatch.planId][`estatus_${bestMatch.index}`] = nuevoEstatus;
                            
                            if (planOriginal) {
                                // Evitar que el mismo concepto sea "pescado" por otro detalle en el mismo recibo o importación repetida
                                planOriginal[`estatus_${bestMatch.index}`] = nuevoEstatus.replace('{{FOLIO}}', row.no_recibo); 
                                if (!bestCicloId) bestCicloId = planOriginal.ciclo_id;
                            }
                        }
                    });

                    const planIdsToUpdate = Object.keys(updatesPorPlan);
                    if (planIdsToUpdate.length > 0) {
                        // Backend solo soporta actulizar 1 plan por transacción en saveReciboCompleto
                        const primaryPlanId = planIdsToUpdate[0];
                        planUpdates = { planId: primaryPlanId, updates: updatesPorPlan[primaryPlanId] };
                        
                        // Reasignar el recibo al ciclo correcto en lugar del activo
                        if (bestCicloId) {
                            reciboPayload.ciclo_id = bestCicloId;
                        }
                    }
                } else {
                    // El alumno existe pero no tiene plan de pagos en ningún ciclo
                    warnings.push(`${row.nombre_alumno} — sin plan de pagos (el recibo se guardó suelto)`);
                }
            }

            const saldoAfavorUpdate = excedenteGlobalRecibo > 0 ? { alumnoId: asocAlumno.id, delta: excedenteGlobalRecibo } : undefined;

            const result = await saveReciboCompleto(reciboPayload, detallesPayload as any, planUpdates, saldoAfavorUpdate);
            if (result.error) {
                // Detect duplicate folio: treat as a skip/warning, not a hard error
                const isDuplicateFolio = result.error.includes('recibos_folio_key') || result.error.includes('duplicate key');
                if (isDuplicateFolio) {
                    warnings.push(`Fila ${row.rowIndex} (${row.nombre_alumno}): El folio ${row.no_recibo} ya existe en la BD — omitido (ya estaba registrado).`);
                } else {
                    errorsCount++;
                    log.push(`Fila ${row.rowIndex}: ${result.error}`);
                }
            } else {
                added++;
            }
        }

        try {
            await supabase.rpc('sync_secuencia_folios');
        } catch (e) {
            console.warn("La sincronización automática de secuencias falló o no existe el script SQL", e);
        }

        setImportResult({ added, errors: errorsCount, log, warnings });
        setStep(3);
        setImporting(false);
        onImport();
    };

    const validCount = parsedRows.filter(r => r.errors.length === 0).length;
    const errorCount = parsedRows.filter(r => r.errors.length > 0).length;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800">

                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-lg">
                            <Upload size={20} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Importar Registros de Pago</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Ciclo activo: <span className="font-semibold text-blue-600 dark:text-blue-400">{activeCiclo?.nombre || 'Ninguno'}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <div className="flex items-center gap-2 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    {[
                        { n: 1, label: 'Subir CSV' },
                        { n: 2, label: 'Previsualizar' },
                        { n: 3, label: 'Resultado' },
                    ].map((s, i) => (
                        <React.Fragment key={s.n}>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${step === s.n ? 'bg-blue-600 text-white' : step > s.n ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                {step > s.n ? <CheckCircle size={14} /> : <span className="w-4 h-4 flex items-center justify-center text-xs">{s.n}</span>}
                                {s.label}
                            </div>
                            {i < 2 && <ChevronRight size={14} className="text-gray-400 dark:text-gray-600" />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto w-full">
                    {step === 1 && (
                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-4">
                                <FileText size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Descarga la plantilla oficial</p>
                                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                                        Esta plantilla incluye las 36 columnas (hasta 5 conceptos en columnas horizontales).
                                    </p>
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                                    >
                                        <Download size={16} />
                                        Descargar Plantilla
                                    </button>
                                </div>
                            </div>

                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                            >
                                <Upload size={40} className={`mx-auto mb-4 ${dragOver ? 'text-blue-500' : 'text-gray-400 dark:text-gray-600'}`} />
                                <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg mb-1">Arrastra el CSV de Pagos aquí</p>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">o haz clic para seleccionar el archivo</p>
                                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-extrabold text-blue-700">{parsedRows.length}</p>
                                    <p className="text-sm text-blue-600 font-medium">Recibos encontrados</p>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-extrabold text-emerald-700">{validCount}</p>
                                    <p className="text-sm text-emerald-600 font-medium">Válidos para importar</p>
                                </div>
                                <div className={`border rounded-xl p-4 text-center ${errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <p className={`text-3xl font-extrabold ${errorCount > 0 ? 'text-red-700' : 'text-gray-400'}`}>{errorCount}</p>
                                    <p className={`text-sm font-medium ${errorCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>Con errores</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Fila</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Alumno</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Cobro Total</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Conceptos</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {parsedRows.map(row => (
                                            <tr key={row.rowIndex} className={row.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}>
                                                <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{row.rowIndex}</td>
                                                <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100">{row.nombre_alumno || '—'}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">${row.total_final.toFixed(2)}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-bold">
                                                        {row.detalles.length} detalle(s)
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {row.errors.length === 0 ? (
                                                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle size={13} />OK</span>
                                                    ) : (
                                                        <div>
                                                            {row.errors.map((e, i) => (
                                                                <span key={i} className="flex items-center gap-1 text-red-600 text-xs"><AlertCircle size={12} />{e}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {step === 3 && importResult && (
                        <div className="text-center py-8 space-y-6">
                            <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle size={40} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mb-1">¡Importación completada!</h3>
                                <p className="text-gray-500 dark:text-gray-400">Los recibos han sido registrados en la base de datos.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <p className="text-3xl font-extrabold text-emerald-700">{importResult.added}</p>
                                    <p className="text-xs text-emerald-600 font-medium">Agregados</p>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                    <p className="text-3xl font-extrabold text-red-700">{importResult.errors}</p>
                                    <p className="text-xs text-red-600 font-medium">Errores</p>
                                </div>
                            </div>
                            {importResult.log.length > 0 && (
                                <div className="text-left bg-gray-50 p-4 max-w-lg mx-auto rounded-lg overflow-y-auto max-h-40 border border-gray-200 text-sm text-red-600">
                                    {importResult.log.map((lg, i) => <div key={i}>{lg}</div>)}
                                </div>
                            )}
                            {importResult.warnings.length > 0 && (
                                <div className="text-left max-w-lg mx-auto">
                                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-t-lg px-4 py-2">
                                        <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                                        <span className="text-amber-800 text-xs font-bold uppercase tracking-wide">Recibos sin vincular — alumno sin plan</span>
                                    </div>
                                    <div className="bg-amber-50 border-x border-b border-amber-200 rounded-b-lg p-3 overflow-y-auto max-h-36 text-sm text-amber-800 space-y-1">
                                        {importResult.warnings.map((w, i) => <div key={i} className="flex items-start gap-2"><span className="mt-0.5 text-amber-500">⚠</span>{w}</div>)}
                                    </div>
                                    <p className="text-xs text-amber-600 mt-1 text-center">Puedes vincularlos manualmente desde Consultar Registros → + Vincular</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                    <button
                        onClick={step === 1 ? onClose : () => setStep(prev => (prev - 1) as 1 | 2)}
                        disabled={step === 3}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors disabled:opacity-40"
                    >
                        <ChevronLeft size={16} />
                        {step === 1 ? 'Cancelar' : 'Volver'}
                    </button>

                    {step === 2 && (
                        <button
                            onClick={handleConfirm}
                            disabled={validCount === 0 || importing}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            {importing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {importing ? 'Importando...' : `Importar ${validCount} recibo(s)`}
                        </button>
                    )}

                    {step === 3 && (
                        <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                            Finalizar
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
