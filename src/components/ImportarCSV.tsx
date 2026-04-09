import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Upload, Download, CheckCircle, AlertTriangle, FileText, ChevronRight, ChevronLeft, Loader2, AlertCircle, Eye } from 'lucide-react';
import { PaymentPlan, Alumno, CicloEscolar } from '../types';
import { CSV_HEADERS, generateCSV, downloadCSV, getCyclePrefix } from '../utils';

// ─── Tipos internos ──────────────────────────────────────────────────────────
interface ParsedRow {
    rowIndex: number;
    nombre_alumno: string;
    no_plan_pagos: string;
    licenciatura: string;
    grado: string;           
    turno: string;           
    estatus: string;         
    ciclo_escolar: string;
    fecha_plan: string;
    tipo_plan: 'Cuatrimestral' | 'Semestral';
    beca_tipo: string;
    beca_porcentaje: string;
    saldo_a_favor?: number;
    observaciones_pago_titulacion: string;
    hasPlanData: boolean;    // true si alguna columna de plan tiene valor
    pagos: { concepto: string; fecha: string; cantidad: number; estatus: string }[];
    errors: string[];
}

interface ImportarCSVProps {
    activeCicloId: string;
    activeCicloNombre: string;
    ciclos: CicloEscolar[];
    globalMaxCounter: number;
    existingAlumnos: Alumno[];
    existingPlans: PaymentPlan[];
    onImport: (newAlumnos: Alumno[], newPlans: PaymentPlan[]) => void;
    onClose: () => void;
}

// ─── Datos de muestra ─────────────────────────────────────────────────────────
// GRADO y TURNO van en columnas separadas
// Formato ciclo: AAAA-P (ej. 2026-1, 2026-2, 2026-3)
// Tipos de plan: Cuatrimestral / Semestral
// Estatus de pago: PAGADO / PENDIENTE / (vacío = sin registrar)
const SAMPLE_ROWS = [
    [
        'CHAVEZ CORDERO SAMARA YAMIL', '00207', 'DERECHO', '5TO', 'MIXTO', 'ACTIVO',
        '2026-1', '15/01/2026', 'Cuatrimestral', 'NINGUNA', '0%', '', '',
        'INSCRIPCION', '15/01/2026', '1200', 'PAGADO',
        '1ER PAGO', '15/02/2026', '1500', 'PAGADO',
        '2DO PAGO', '15/03/2026', '1500', 'PENDIENTE',
        '3ER PAGO', '15/04/2026', '1500', '',
        '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', ''
    ],
    [
        'GARCIA MENDOZA PEDRO IVAN', '00208', 'ADMINISTRACION', '3ER', 'MATUTINO', 'ACTIVO',
        '2026-1', '15/01/2026', 'Cuatrimestral', 'BECA INSTITUCIONAL', '25%', '', '',
        'INSCRIPCION', '15/01/2026', '900', 'PAGADO',
        '1ER PAGO', '15/02/2026', '1125', 'PENDIENTE',
        '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', ''
    ]
];

// ─── Utilidades ───────────────────────────────────────────────────────────────
function detectSeparator(headerLine: string): string {
    const list = [',', ';', '\t', '|'];
    let maxCount = 0;
    let sep = ',';
    for (const char of list) {
        const count = (headerLine.split(char)).length - 1;
        if (count > maxCount) {
            maxCount = count;
            sep = char;
        }
    }
    return sep;
}

// Retorna un array de filas (cada fila es un array de columnas)
function parseCSVFull(text: string, separator: string = ','): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const nextCh = text[i + 1];

        if (ch === '"') {
            if (inQuotes && nextCh === '"') {
                currentCell += '"';
                i++; // saltar comilla escapada
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === separator && !inQuotes) {
            currentRow.push(currentCell);
            currentCell = '';
        } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
            // Fin de línea real
            if (ch === '\r' && nextCh === '\n') i++; // Consumir \r\n completo
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += ch;
        }
    }
    
    // Empujar la última celda/fila si queda algo
    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }
    
    // Limpiar celdas (trim)
    return rows.map(r => r.map(c => c.trim())).filter(r => r.join('').trim() !== '');
}

function parseRows(csvText: string, activeCicloId: string, activeCicloNombre: string): ParsedRow[] {
    // Tomar primera línea rápido para detectar separador
    const firstLineEnd = csvText.indexOf('\n') > -1 ? csvText.indexOf('\n') : csvText.length;
    const firstLine = csvText.substring(0, firstLineEnd);
    const separator = detectSeparator(firstLine);
    
    const rows = parseCSVFull(csvText, separator);
    if (rows.length < 2) return [];
    
    const headers = rows[0].map(h => h.toUpperCase());
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => headerMap[h] = i);

    const dataLines = rows.slice(1);
    return dataLines.map((cols, idx) => {
        const getCol = (name: string) => {
            const index = headerMap[name];
            return index !== undefined && cols[index] ? cols[index].trim() : '';
        };

        const errors: string[] = [];

        const nombre_alumno = getCol('NOMBRE_ALUMNO').toUpperCase();
        const no_plan_pagos = getCol('NO_PLAN_PAGOS');
        const licenciatura = getCol('LICENCIATURA').toUpperCase();
        
        let grado = getCol('GRADO').toUpperCase();
        let turno = getCol('TURNO').toUpperCase();
        
        // Fallback para quienes usaron GRADO_TURNO acorde a las instrucciones visuales
        const grado_turno_raw = getCol('GRADO_TURNO').toUpperCase();
        if (grado_turno_raw && (!grado || !turno)) {
            const parts = grado_turno_raw.split('/');
            if (!grado && parts.length > 0) grado = parts[0].trim();
            if (!turno && parts.length > 1) turno = parts[1].trim();
        }

        const estatus = getCol('ESTATUS_ALUMNO').toUpperCase();
        const ciclo_escolar = getCol('CICLO_ESCOLAR') || activeCicloNombre;

        
        let fecha_plan = getCol('FECHA_PLAN');
        if (!fecha_plan) {
            const today = new Date();
            fecha_plan = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
        }

        const tipo_plan_raw = getCol('TIPO_PLAN');
        const beca_tipo = getCol('BECA_TIPO').toUpperCase();
        const beca_porcentaje = getCol('BECA_PORCENTAJE');
        const saldo_a_favor_raw = getCol('SALDO_A_FAVOR');
        const saldo_a_favor = saldo_a_favor_raw ? parseFloat(saldo_a_favor_raw.replace(/[^0-9.]/g, '')) : undefined;
        const observaciones_pago_titulacion = getCol('OBSERVACIONES_PAGO_TITULACION');

        if (!nombre_alumno) errors.push('Falta NOMBRE_ALUMNO');

        // Detectar si hay datos de plan en esta fila
        const hasPlanData = !!(
            no_plan_pagos ||
            getCol('FECHA_PLAN') ||
            getCol('CONCEPTO_1') ||
            getCol('CONCEPTO_2') ||
            getCol('CONCEPTO_3') ||
            getCol('FECHA_1') ||
            getCol('CANTIDAD_1')
        );

        const tipo_plan: 'Cuatrimestral' | 'Semestral' =
            tipo_plan_raw.toLowerCase().includes('semestral') ? 'Semestral' : 'Cuatrimestral';

        // Parsear pagos buscando por nombre de header
        const pagos: { concepto: string; fecha: string; cantidad: number; estatus: string }[] = [];
        for (let g = 1; g <= 9; g++) {
            const concepto = getCol(`CONCEPTO_${g}`).toUpperCase();
            if (!concepto) continue;
            const fecha = getCol(`FECHA_${g}`);
            const cantidadRaw = getCol(`CANTIDAD_${g}`).replace(/[^0-9.]/g, '');
            const cantidad = parseFloat(cantidadRaw) || 0;
            const pagoEstatus = getCol(`ESTATUS_${g}`).toUpperCase() || 'PENDIENTE';
            pagos.push({ concepto, fecha, cantidad, estatus: pagoEstatus });
        }

        return {
            rowIndex: idx + 2,
            nombre_alumno, no_plan_pagos, licenciatura, grado, turno,
            estatus,
            ciclo_escolar, fecha_plan, tipo_plan, beca_tipo, beca_porcentaje,
            saldo_a_favor,
            observaciones_pago_titulacion,
            hasPlanData,
            pagos, errors
        };
    }).filter(r => r.nombre_alumno);
}

function buildAlumnoAndPlan(
    row: ParsedRow,
    activeCicloId: string,
    ciclos: CicloEscolar[],
    existingAlumnos: Alumno[],
    existingPlans: PaymentPlan[]
): { alumno: Alumno | null; plan: PaymentPlan | null; warning?: string; alumnoUpdated?: boolean } {
    // Resolver el ciclo_id correcto: buscar por nombre en la lista completa de ciclos
    const cicloResuelto = ciclos.find(
        c => c.nombre.trim().toUpperCase() === (row.ciclo_escolar || '').trim().toUpperCase()
    );
    const resolvedCicloId = cicloResuelto?.id || activeCicloId;
    // Alumno: reutilizar si ya existe por nombre
    let alumno: Alumno | null = existingAlumnos.find(
        a => a.nombre_completo === row.nombre_alumno
    ) || null;
    let alumnoUpdated = false;

    if (!alumno) {
        alumno = {
            id: crypto.randomUUID(),
            nombre_completo: row.nombre_alumno,
            licenciatura: row.licenciatura || 'POR DEFINIR',
            grado_actual: row.grado || 'POR DEFINIR',
            turno: row.turno || 'POR DEFINIR',
            estatus: row.estatus || 'POR DEFINIR',
            beca_porcentaje: row.beca_porcentaje || '0%',
            beca_tipo: row.beca_tipo || 'NINGUNA',
            saldo_a_favor: row.saldo_a_favor
        };
    } else {
        // If it exists, update it with CSV data. Only override if the new CSV value is not empty.
        alumno = {
            ...alumno,
            licenciatura:   row.licenciatura   || alumno.licenciatura,
            grado_actual:   row.grado          || alumno.grado_actual,
            turno:          row.turno          || alumno.turno,
            estatus:        row.estatus        || alumno.estatus,
            beca_porcentaje: row.beca_porcentaje || alumno.beca_porcentaje,
            beca_tipo:      row.beca_tipo      || alumno.beca_tipo,
            saldo_a_favor:  row.saldo_a_favor !== undefined ? row.saldo_a_favor : alumno.saldo_a_favor,
            observaciones_pago_titulacion: row.observaciones_pago_titulacion || alumno.observaciones_pago_titulacion || null,
        };
        alumnoUpdated = true; // Always send the upsert so DB sees the latest values
    }

    // Plan: Solo crear/actualizar si hay datos del plan en el CSV
    if (!row.hasPlanData) {
        return { alumno, plan: null, alumnoUpdated };
    }

    const planDuplicate = existingPlans.find(
        p => (p.nombre_alumno === row.nombre_alumno) &&
            (p.ciclo_escolar === row.ciclo_escolar || p.ciclo_id === resolvedCicloId)
    );

    const grado_turno = `${row.grado} ${row.turno}`.trim();

    const plan: PaymentPlan = {
        id: planDuplicate ? planDuplicate.id : crypto.randomUUID(),
        alumno_id: alumno.id,
        ciclo_id: resolvedCicloId,
        nombre_alumno: row.nombre_alumno,
        no_plan_pagos: row.no_plan_pagos || planDuplicate?.no_plan_pagos || 'SIN PLAN',
        fecha_plan: row.fecha_plan,
        beca_porcentaje: row.beca_porcentaje,
        beca_tipo: row.beca_tipo,
        ciclo_escolar: row.ciclo_escolar,
        licenciatura: row.licenciatura,
        grado_turno,
        grado: row.grado,
        turno: row.turno,
        tipo_plan: row.tipo_plan,
    };

    row.pagos.forEach((p, i) => {
        const n = i + 1;
        const planRecord = plan as unknown as Record<string, unknown>;
        planRecord[`concepto_${n}`] = p.concepto;
        planRecord[`fecha_${n}`] = p.fecha;
        planRecord[`cantidad_${n}`] = p.cantidad;
        planRecord[`estatus_${n}`] = p.estatus;
    });

    return { alumno, plan, alumnoUpdated };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ImportarCSV({
    activeCicloId, activeCicloNombre, ciclos, globalMaxCounter, existingAlumnos, existingPlans, onImport, onClose
}: ImportarCSVProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [selectedDuplicates, setSelectedDuplicates] = useState<Record<string, number>>({});
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ alumnosAdded: number; planesAdded: number; skipped: number; errors: number } | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Descargar plantilla
    const handleDownloadTemplate = () => {
        // Rellenar las filas al largo correcto de CSV_HEADERS
        const rows = SAMPLE_ROWS.map(r => {
            const padded = [...r];
            while (padded.length < CSV_HEADERS.length) padded.push('');
            return padded;
        });
        downloadCSV(generateCSV(CSV_HEADERS, rows), 'plantilla_importacion_pagos.csv');
    };

    // Procesar archivo
    const processFile = useCallback((file: File) => {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = parseRows(text, activeCicloId, activeCicloNombre);
            setParsedRows(rows);
            
            // Re-evaluar duplicados por defecto a la última fila
            const groups: Record<string, ParsedRow[]> = {};
            rows.forEach(r => {
                if (!groups[r.nombre_alumno]) groups[r.nombre_alumno] = [];
                groups[r.nombre_alumno].push(r);
            });
            const defaultSelections: Record<string, number> = {};
            Object.entries(groups).forEach(([name, dupRows]) => {
                if (dupRows.length > 1) {
                    defaultSelections[name] = dupRows[dupRows.length - 1].rowIndex;
                }
            });
            setSelectedDuplicates(defaultSelections);

            setStep(2);
        };
        reader.readAsText(file, 'UTF-8');
    }, [activeCicloId, activeCicloNombre]);

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

    // Confirmar importación
    const handleConfirm = async () => {
        setImporting(true);
        await new Promise(r => setTimeout(r, 600)); // Pequeño delay para UX

        const validRows = effectivelyFinalRows.filter(r => r.errors.length === 0);
        const newAlumnos: Alumno[] = [];
        const newPlans: PaymentPlan[] = [];
        let skipped = 0;

        const allAlumnos = [...existingAlumnos];
        const allPlans = [...existingPlans];

        for (const row of validRows) {
            const { alumno, plan, warning, alumnoUpdated } = buildAlumnoAndPlan(row, activeCicloId, ciclos, allAlumnos, allPlans);
            if (warning) { skipped++; continue; }
            if (alumno && (!allAlumnos.find(a => a.id === alumno.id) || alumnoUpdated)) {
                newAlumnos.push(alumno);
                if (!allAlumnos.find(a => a.id === alumno.id)) {
                    allAlumnos.push(alumno);
                } else {
                    // Update the local instance in allAlumnos
                    const index = allAlumnos.findIndex(a => a.id === alumno.id);
                    if (index >= 0) allAlumnos[index] = alumno;
                }
            }
            if (plan) {
                newPlans.push(plan);
                const existingPlanIndex = allPlans.findIndex(p => p.id === plan.id);
                if (existingPlanIndex >= 0) {
                    allPlans[existingPlanIndex] = plan;
                } else {
                    allPlans.push(plan);
                }
            }
        }

        setImportResult({
            alumnosAdded: newAlumnos.length,
            planesAdded: newPlans.length,
            skipped: parsedRows.length - effectivelyFinalRows.length,
            errors: parsedRows.filter(r => r.errors.length > 0).length
        });
        setStep(3);
        setImporting(false);
        onImport(newAlumnos, newPlans);
    };

    const duplicateGroups = useMemo(() => {
        const groups: Record<string, ParsedRow[]> = {};
        parsedRows.forEach(r => {
            if (!groups[r.nombre_alumno]) groups[r.nombre_alumno] = [];
            groups[r.nombre_alumno].push(r);
        });
        return Object.entries(groups).filter(([_, rows]) => rows.length > 1);
    }, [parsedRows]);

    const effectivelyFinalRows = useMemo(() => {
        return parsedRows.filter(r => {
             const isDuplicate = duplicateGroups.some(g => g[0] === r.nombre_alumno);
             if (!isDuplicate) return true;
             return selectedDuplicates[r.nombre_alumno] === r.rowIndex;
        });
    }, [parsedRows, duplicateGroups, selectedDuplicates]);

    const validCount = effectivelyFinalRows.filter(r => r.errors.length === 0).length;
    const errorCount = effectivelyFinalRows.filter(r => r.errors.length > 0).length;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800">

                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-lg">
                            <Upload size={20} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Importar desde CSV</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Ciclo activo: <span className="font-semibold text-blue-600 dark:text-blue-400">{activeCicloNombre}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <div className="flex items-center gap-2 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    {[
                        { n: 1, label: 'Subir archivo' },
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
                <div className="flex-1 overflow-y-auto p-6">

                    {/* ── Paso 1: Subir ── */}
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Plantilla */}
                            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-4">
                                <FileText size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">¿Primera vez? Descarga la plantilla</p>
                                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                                        El archivo incluye <strong>2 alumnos de ejemplo</strong> con todos los campos llenos. Edítalo en Excel y vuelve a subirlo.
                                    </p>
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                                    >
                                        <Download size={16} />
                                        Descargar Plantilla de Muestra
                                    </button>
                                </div>
                            </div>

                            {/* Sugerencia de Folio */}
                            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex items-start gap-4">
                                <AlertCircle size={20} className="text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">Sugerencia de Folio (Para <span className="font-mono text-xs font-bold">NO_PLAN_PAGOS</span>)</p>
                                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                                        Para mantener tu consecutivo global y evitar folios repetidos, te sugerimos que asignes tus folios del ciclo <strong>{activeCicloNombre}</strong> a partir del:
                                        <br/><span className="inline-block mt-2 font-mono text-base font-bold bg-white dark:bg-gray-800 text-indigo-800 dark:text-indigo-300 px-3 py-1 rounded shadow-sm border border-indigo-200 dark:border-indigo-700">
                                            {getCyclePrefix(activeCicloNombre)}-{(globalMaxCounter + 1).toString().padStart(3, '0')}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {/* Zona de drop */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                            >
                                <Upload size={40} className={`mx-auto mb-4 ${dragOver ? 'text-blue-500' : 'text-gray-400 dark:text-gray-600'}`} />
                                <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg mb-1">Arrastra el CSV aquí</p>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">o haz clic para seleccionar el archivo</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Solo archivos .csv (codificación UTF-8)</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            {/* Descripción de columnas */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2"><Eye size={16} />Columnas del CSV</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-300">
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">NOMBRE_ALUMNO</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">NO_PLAN_PAGOS</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">LICENCIATURA</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">GRADO</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">TURNO</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">ESTATUS_ALUMNO</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">CICLO_ESCOLAR</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">FECHA_PLAN</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">TIPO_PLAN</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">BECA_TIPO</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"><span className="font-mono font-bold">BECA_PORCENTAJE</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 col-span-2 md:col-span-3"><span className="font-mono font-bold">OBSERVACIONES_PAGO_TITULACION</span></div>
                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 col-span-2 md:col-span-3">
                                        <span className="font-mono font-bold">CONCEPTO_1, FECHA_1, CANTIDAD_1, ESTATUS_1</span> … hasta <span className="font-mono font-bold">_9</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2"><span className="text-red-500">*</span> Requerido</p>
                            </div>
                        </div>
                    )}

                    {/* ── Paso 2: Previsualizar ── */}
                    {step === 2 && (
                        <div className="space-y-4">
                            {/* Resumen */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-extrabold text-blue-700">{effectivelyFinalRows.length}</p>
                                    <p className="text-sm text-blue-600 font-medium">Registros a Procesar</p>
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

                            {/* Archivo cargado */}
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2">
                                <FileText size={14} />
                                <span className="font-mono">{fileName}</span>
                                <button
                                    onClick={() => { setStep(1); setParsedRows([]); setFileName(''); }}
                                    className="ml-auto text-blue-600 hover:underline text-xs"
                                >
                                    Cambiar archivo
                                </button>
                            </div>

                            {/* Selector de duplicados */}
                            {duplicateGroups.length > 0 && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-orange-800 font-bold mb-3">
                                        <AlertTriangle size={18} />
                                        <span>Conflictos de Filas ({duplicateGroups.length} alumnos repetidos)</span>
                                    </div>
                                    <p className="text-sm text-orange-700 mb-4 font-medium">
                                        Se encontraron múltiples filas para un mismo alumno. Selecciona qué fila deseas importar. Las demás serán omitidas:
                                    </p>
                                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                        {duplicateGroups.map(([nombre, rows]) => (
                                            <div key={nombre} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3 rounded-lg border border-orange-100 shadow-sm gap-2">
                                                <div className="font-semibold text-gray-800 text-sm truncate mr-2 flex-1">{nombre}</div>
                                                <div className="flex items-center justify-end gap-2 flex-wrap">
                                                    {rows.map(r => (
                                                        <label key={r.rowIndex} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs font-bold whitespace-nowrap ${selectedDuplicates[nombre] === r.rowIndex ? 'bg-orange-100 border-orange-400 text-orange-900 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                            <input 
                                                                type="radio" 
                                                                name={`dup-${nombre.replace(/\s+/g, '-')}`} 
                                                                className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500 border-gray-300"
                                                                checked={selectedDuplicates[nombre] === r.rowIndex}
                                                                onChange={() => setSelectedDuplicates(prev => ({ ...prev, [nombre]: r.rowIndex }))}
                                                            />
                                                            Fila {r.rowIndex}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tabla preview */}
                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Fila</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Alumno</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Plan</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Ciclo</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Pagos</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {parsedRows.map(row => {
                                            const isDuplicateGroup = duplicateGroups.some(g => g[0] === row.nombre_alumno);
                                            const isOmitted = isDuplicateGroup && selectedDuplicates[row.nombre_alumno] !== row.rowIndex;
                                            
                                            return (
                                              <tr key={row.rowIndex} className={isOmitted ? 'bg-gray-100 dark:bg-gray-800/60 opacity-60' : row.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}>
                                                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                                                      {row.rowIndex}
                                                      {isOmitted && <span className="ml-2 bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">Omitida</span>}
                                                  </td>
                                                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100">{row.nombre_alumno || <span className="text-gray-400 italic">—</span>}</td>
                                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.no_plan_pagos}</td>
                                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.ciclo_escolar}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-bold">
                                                        {row.pagos.length} pago{row.pagos.length !== 1 ? 's' : ''}
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
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {validCount === 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
                                    <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                                    <p className="text-amber-800 dark:text-amber-300 text-sm">No hay registros válidos para importar. Corrige los errores en el CSV y vuelve a subirlo.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Paso 3: Resultado ── */}
                    {step === 3 && importResult && (
                        <div className="text-center py-8 space-y-6">
                            <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle size={40} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mb-1">¡Importación completada!</h3>
                                <p className="text-gray-500 dark:text-gray-400">Los datos ya están disponibles en Plan de Pagos y Alumnos.</p>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <p className="text-3xl font-extrabold text-blue-700">{importResult.alumnosAdded}</p>
                                    <p className="text-xs text-blue-600 font-medium">Alumnos creados / actualizados</p>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <p className="text-3xl font-extrabold text-emerald-700">{importResult.planesAdded}</p>
                                    <p className="text-xs text-emerald-600 font-medium">Planes creados / actualizados</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-3xl font-extrabold text-amber-700">{importResult.skipped}</p>
                                    <p className="text-xs text-amber-600 font-medium">Omitidos (filas duplicadas)</p>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                    <p className="text-3xl font-extrabold text-red-700">{importResult.errors}</p>
                                    <p className="text-xs text-red-600 font-medium">Con errores</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Acciones */}
                <div className="flex items-center justify-between p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                    <button
                        onClick={step === 1 ? onClose : () => setStep(prev => (prev - 1) as 1 | 2)}
                        disabled={step === 3}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors disabled:opacity-40"
                    >
                        <ChevronLeft size={16} />
                        {step === 1 ? 'Cancelar' : 'Volver'}
                    </button>

                    {step === 1 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">Sube un archivo CSV para continuar</p>
                    )}

                    {step === 2 && (
                        <button
                            onClick={handleConfirm}
                            disabled={validCount === 0 || importing}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            {importing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {importing ? 'Importando...' : `Importar ${validCount} registro${validCount !== 1 ? 's' : ''}`}
                        </button>
                    )}

                    {step === 3 && (
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                            Finalizar
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
