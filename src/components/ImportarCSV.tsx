import React, { useState, useRef, useCallback } from 'react';
import {
    X, Upload, Download, CheckCircle, AlertTriangle, FileText,
    ChevronRight, ChevronLeft, Loader2, AlertCircle, Eye
} from 'lucide-react';
import { PaymentPlan, Alumno } from '../types';

// ─── Tipos internos ──────────────────────────────────────────────────────────
interface ParsedRow {
    rowIndex: number;
    nombre_alumno: string;
    no_plan_pagos: string;
    licenciatura: string;
    grado_turno: string;
    ciclo_escolar: string;
    fecha_plan: string;
    tipo_plan: 'Cuatrimestral' | 'Semestral';
    beca_tipo: string;
    beca_porcentaje: string;
    pagos: { concepto: string; fecha: string; cantidad: number; estatus: string }[];
    errors: string[];
}

interface ImportarCSVProps {
    activeCicloId: string;
    activeCicloNombre: string;
    existingAlumnos: Alumno[];
    existingPlans: PaymentPlan[];
    onImport: (newAlumnos: Alumno[], newPlans: PaymentPlan[]) => void;
    onClose: () => void;
}

// ─── Columnas del CSV ─────────────────────────────────────────────────────────
const CSV_HEADERS = [
    'NOMBRE_ALUMNO', 'NO_PLAN_PAGOS', 'LICENCIATURA', 'GRADO_TURNO',
    'CICLO_ESCOLAR', 'FECHA_PLAN', 'TIPO_PLAN', 'BECA_TIPO', 'BECA_PORCENTAJE',
    // 9 grupos de pago
    ...Array.from({ length: 9 }, (_, i) => [
        `CONCEPTO_${i + 1}`, `FECHA_${i + 1}`, `CANTIDAD_${i + 1}`, `ESTATUS_${i + 1}`
    ]).flat()
];

// ─── Datos de muestra ─────────────────────────────────────────────────────────
const SAMPLE_ROWS = [
    [
        'CHAVEZ CORDERO SAMARA YAMIL', '00207', 'DERECHO', '5TO MIXTO',
        '26/1', '15/01/2026', 'Cuatrimestral', 'NINGUNA', '0%',
        'INSCRIPCIÓN', '15/01/2026', '1200', 'PAGADO',
        '1ER PAGO', '15/02/2026', '1500', 'PAGADO',
        '2DO PAGO', '15/03/2026', '1500', 'PENDIENTE',
        '3ER PAGO', '15/04/2026', '1500', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', ''
    ],
    [
        'GARCIA MENDOZA PEDRO IVAN', '00208', 'ADMINISTRACIÓN', '3ER MATUTINO',
        '26/1', '15/01/2026', 'Cuatrimestral', 'BECA INSTITUCIONAL', '25%',
        'REINSCRIPCIÓN', '15/01/2026', '900', 'PAGADO',
        '1ER PAGO', '15/02/2026', '1125', 'PENDIENTE',
        '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', ''
    ]
];

// ─── Utilidades ───────────────────────────────────────────────────────────────
function generateCSV(headers: string[], rows: string[][]): string {
    const escape = (v: string) => v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    return [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
}

function downloadCSV(content: string, filename: string) {
    const BOM = '\uFEFF'; // BOM para apertura correcta en Excel con acentos
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

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

function parseRows(csvText: string, activeCicloId: string): ParsedRow[] {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    // Saltar encabezado
    const dataLines = lines.slice(1);
    return dataLines.map((line, idx) => {
        const cols = parseCSVLine(line);
        const get = (i: number) => (cols[i] || '').trim();
        const errors: string[] = [];

        const nombre_alumno = get(0).toUpperCase();
        const no_plan_pagos = get(1);
        const licenciatura = get(2).toUpperCase();
        const grado_turno = get(3).toUpperCase();
        const ciclo_escolar = get(4);
        const fecha_plan = get(5);
        const tipo_plan_raw = get(6);
        const beca_tipo = get(7).toUpperCase() || 'NINGUNA';
        const beca_porcentaje = get(8) || '0%';

        if (!nombre_alumno) errors.push('Falta NOMBRE_ALUMNO');
        if (!no_plan_pagos) errors.push('Falta NO_PLAN_PAGOS');
        if (!ciclo_escolar) errors.push('Falta CICLO_ESCOLAR');
        if (!fecha_plan) errors.push('Falta FECHA_PLAN');

        const tipo_plan: 'Cuatrimestral' | 'Semestral' =
            tipo_plan_raw.toLowerCase().includes('semestral') ? 'Semestral' : 'Cuatrimestral';

        // Parsear pagos (4 cols por grupo, desde índice 9)
        const pagos: { concepto: string; fecha: string; cantidad: number; estatus: string }[] = [];
        for (let g = 0; g < 9; g++) {
            const base = 9 + g * 4;
            const concepto = get(base).toUpperCase();
            if (!concepto) continue;
            const fecha = get(base + 1);
            const cantidadRaw = get(base + 2).replace(/[^0-9.]/g, '');
            const cantidad = parseFloat(cantidadRaw) || 0;
            const estatus = get(base + 3).toUpperCase() || 'PENDIENTE';
            pagos.push({ concepto, fecha, cantidad, estatus });
        }

        return {
            rowIndex: idx + 2,
            nombre_alumno, no_plan_pagos, licenciatura, grado_turno,
            ciclo_escolar, fecha_plan, tipo_plan, beca_tipo, beca_porcentaje,
            pagos, errors
        };
    }).filter(r => r.nombre_alumno); // Ignorar filas completamente vacías
}

function buildAlumnoAndPlan(
    row: ParsedRow,
    activeCicloId: string,
    existingAlumnos: Alumno[],
    existingPlans: PaymentPlan[]
): { alumno: Alumno | null; plan: PaymentPlan | null; warning?: string } {
    const timestamp = Date.now() + row.rowIndex;

    // Alumno: reutilizar si ya existe por nombre
    let alumno: Alumno | null = existingAlumnos.find(
        a => a.nombre_completo === row.nombre_alumno
    ) || null;

    if (!alumno) {
        alumno = {
            id: `imp_a_${timestamp}`,
            nombre_completo: row.nombre_alumno,
            licenciatura: row.licenciatura,
            grado_actual: row.grado_turno.split(' ')[0] || row.grado_turno,
            turno: row.grado_turno.split(' ').slice(1).join(' ') || 'MIXTO',
        };
    }

    // Plan: omitir si ya existe para el mismo ciclo
    const planDuplicate = existingPlans.find(
        p => (p.nombre_alumno === row.nombre_alumno) &&
            (p.ciclo_escolar === row.ciclo_escolar || p.ciclo_id === activeCicloId)
    );

    if (planDuplicate) {
        return { alumno, plan: null, warning: `${row.nombre_alumno}: ya tiene plan en ciclo ${row.ciclo_escolar}` };
    }

    const plan: PaymentPlan = {
        id: `imp_p_${timestamp}`,
        alumno_id: alumno.id,
        ciclo_id: activeCicloId,
        nombre_alumno: row.nombre_alumno,
        no_plan_pagos: row.no_plan_pagos,
        fecha_plan: row.fecha_plan,
        beca_porcentaje: row.beca_porcentaje,
        beca_tipo: row.beca_tipo,
        ciclo_escolar: row.ciclo_escolar,
        licenciatura: row.licenciatura,
        grado_turno: row.grado_turno,
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

    return { alumno, plan };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ImportarCSV({
    activeCicloId, activeCicloNombre, existingAlumnos, existingPlans, onImport, onClose
}: ImportarCSVProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ added: number; skipped: number; errors: number } | null>(null);
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
            const rows = parseRows(text, activeCicloId);
            setParsedRows(rows);
            setStep(2);
        };
        reader.readAsText(file, 'UTF-8');
    }, [activeCicloId]);

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

        const validRows = parsedRows.filter(r => r.errors.length === 0);
        const newAlumnos: Alumno[] = [];
        const newPlans: PaymentPlan[] = [];
        let skipped = 0;

        const allAlumnos = [...existingAlumnos];
        const allPlans = [...existingPlans];

        for (const row of validRows) {
            const { alumno, plan, warning } = buildAlumnoAndPlan(row, activeCicloId, allAlumnos, allPlans);
            if (warning) { skipped++; continue; }
            if (alumno && !allAlumnos.find(a => a.id === alumno.id)) {
                newAlumnos.push(alumno);
                allAlumnos.push(alumno);
            }
            if (plan) {
                newPlans.push(plan);
                allPlans.push(plan);
            }
        }

        setImportResult({
            added: newPlans.length,
            skipped,
            errors: parsedRows.filter(r => r.errors.length > 0).length
        });
        setStep(3);
        setImporting(false);
        onImport(newAlumnos, newPlans);
    };

    const validCount = parsedRows.filter(r => r.errors.length === 0).length;
    const errorCount = parsedRows.filter(r => r.errors.length > 0).length;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-lg">
                            <Upload size={20} className="text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Importar desde CSV</h2>
                            <p className="text-sm text-gray-500">Ciclo activo: <span className="font-semibold text-blue-600">{activeCicloNombre}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Steps indicator */}
                <div className="flex items-center gap-2 px-6 py-4 bg-gray-50 border-b border-gray-100">
                    {[
                        { n: 1, label: 'Subir archivo' },
                        { n: 2, label: 'Previsualizar' },
                        { n: 3, label: 'Resultado' },
                    ].map((s, i) => (
                        <React.Fragment key={s.n}>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${step === s.n ? 'bg-blue-600 text-white' : step > s.n ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                                {step > s.n ? <CheckCircle size={14} /> : <span className="w-4 h-4 flex items-center justify-center text-xs">{s.n}</span>}
                                {s.label}
                            </div>
                            {i < 2 && <ChevronRight size={14} className="text-gray-400" />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* ── Paso 1: Subir ── */}
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Plantilla */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-4">
                                <FileText size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="font-semibold text-blue-900 mb-1">¿Primera vez? Descarga la plantilla</p>
                                    <p className="text-sm text-blue-700 mb-3">
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

                            {/* Zona de drop */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
                            >
                                <Upload size={40} className={`mx-auto mb-4 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                                <p className="text-gray-700 font-semibold text-lg mb-1">Arrastra el CSV aquí</p>
                                <p className="text-gray-500 text-sm">o haz clic para seleccionar el archivo</p>
                                <p className="text-xs text-gray-400 mt-2">Solo archivos .csv (codificación UTF-8)</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            {/* Descripción de columnas */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Eye size={16} />Columnas del CSV</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
                                    <div className="bg-white rounded-lg p-2 border border-gray-200"><span className="font-mono font-bold">NOMBRE_ALUMNO</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white rounded-lg p-2 border border-gray-200"><span className="font-mono font-bold">NO_PLAN_PAGOS</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white rounded-lg p-2 border border-gray-200"><span className="font-mono font-bold">LICENCIATURA</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white rounded-lg p-2 border border-gray-200"><span className="font-mono font-bold">GRADO_TURNO</span></div>
                                    <div className="bg-white rounded-lg p-2 border border-gray-200"><span className="font-mono font-bold">CICLO_ESCOLAR</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white rounded-lg p-2 border border-gray-200"><span className="font-mono font-bold">FECHA_PLAN</span> <span className="text-red-500">*</span></div>
                                    <div className="bg-white rounded-lg p-2 border border-gray-200"><span className="font-mono font-bold">TIPO_PLAN</span></div>
                                    <div className="bg-white rounded-lg p-2 border border-gray-200"><span className="font-mono font-bold">BECA_TIPO</span></div>
                                    <div className="bg-white rounded-lg p-2 border border-gray-200"><span className="font-mono font-bold">BECA_PORCENTAJE</span></div>
                                    <div className="bg-white rounded-lg p-2 border border-gray-200 col-span-2 md:col-span-3">
                                        <span className="font-mono font-bold">CONCEPTO_1, FECHA_1, CANTIDAD_1, ESTATUS_1</span> … hasta <span className="font-mono font-bold">_9</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-2"><span className="text-red-500">*</span> Requerido</p>
                            </div>
                        </div>
                    )}

                    {/* ── Paso 2: Previsualizar ── */}
                    {step === 2 && (
                        <div className="space-y-4">
                            {/* Resumen */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-extrabold text-blue-700">{parsedRows.length}</p>
                                    <p className="text-sm text-blue-600 font-medium">Registros encontrados</p>
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
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2">
                                <FileText size={14} />
                                <span className="font-mono">{fileName}</span>
                                <button
                                    onClick={() => { setStep(1); setParsedRows([]); setFileName(''); }}
                                    className="ml-auto text-blue-600 hover:underline text-xs"
                                >
                                    Cambiar archivo
                                </button>
                            </div>

                            {/* Tabla preview */}
                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fila</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Alumno</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Plan</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Ciclo</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Pagos</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {parsedRows.map(row => (
                                            <tr key={row.rowIndex} className={row.errors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.rowIndex}</td>
                                                <td className="px-4 py-3 font-semibold text-gray-800">{row.nombre_alumno || <span className="text-gray-400 italic">—</span>}</td>
                                                <td className="px-4 py-3 text-gray-600">{row.no_plan_pagos}</td>
                                                <td className="px-4 py-3 text-gray-600">{row.ciclo_escolar}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
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
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {validCount === 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                                    <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
                                    <p className="text-amber-800 text-sm">No hay registros válidos para importar. Corrige los errores en el CSV y vuelve a subirlo.</p>
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
                                <h3 className="text-2xl font-extrabold text-gray-900 mb-1">¡Importación completada!</h3>
                                <p className="text-gray-500">Los datos ya están disponibles en Plan de Pagos y Alumnos.</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <p className="text-3xl font-extrabold text-emerald-700">{importResult.added}</p>
                                    <p className="text-xs text-emerald-600 font-medium">Planes creados</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-3xl font-extrabold text-amber-700">{importResult.skipped}</p>
                                    <p className="text-xs text-amber-600 font-medium">Omitidos (ya existían)</p>
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
                <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button
                        onClick={step === 1 ? onClose : () => setStep(prev => (prev - 1) as 1 | 2)}
                        disabled={step === 3}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-40"
                    >
                        <ChevronLeft size={16} />
                        {step === 1 ? 'Cancelar' : 'Volver'}
                    </button>

                    {step === 1 && (
                        <p className="text-xs text-gray-400">Sube un archivo CSV para continuar</p>
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
            </div>
        </div>
    );
}
