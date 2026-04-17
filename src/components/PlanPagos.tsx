import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowLeft, Inbox, Edit, DollarSign, Save, Printer, Search, Loader2, Plus, Link2, FileText, User, ChevronLeft, ChevronRight, AlertCircle, Trash2 } from 'lucide-react';
import { PaymentPlan, Alumno, CicloEscolar, Catalogos, PlantillaPlan, Usuario, Recibo } from '../types';
import { isPaid, getMaxFolioCounter, getCyclePrefix , toTitleCase} from '../utils';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

const generateFolioForPlan = (alumnoId: string, tipoPlan: string, cicloNombre: string, allPlans: PaymentPlan[]) => {
  const prefix = getCyclePrefix(cicloNombre);
  let folioNum = '';
  
  const studentPlans = allPlans.filter(p => p.alumno_id === alumnoId && p.no_plan_pagos);
  if (studentPlans.length > 0) {
     for (const p of studentPlans) {
        const parts = p.no_plan_pagos!.split('-');
        if (parts.length > 1) {
           if (parts[0] === 'PP') {
              if (/^\d+$/.test(parts[1])) folioNum = parts[1];
           } else {
              folioNum = parts[1];
           }
           if (folioNum && /^\d+$/.test(folioNum)) break;
        }
     }
  }

  if (!folioNum || !/^\d+$/.test(folioNum)) {
     folioNum = (getMaxFolioCounter(allPlans) + 1).toString().padStart(3, '0');
  }

  const tipo = tipoPlan || 'Cuatrimestral';
  let suffix = '';
  if (tipo.toLowerCase().includes('titulaci')) {
     suffix = '-TIT';
  } else if (tipo.toLowerCase().includes('especialidad')) {
     suffix = '-ESP';
  }

  return `${prefix}-${folioNum}${suffix}`;
};

export const DEFAULT_ESPECIALIDAD_DESGLOSE = [
  { cantidad: 3, concepto: 'INSCRIPCIONES', costo_unitario: 1900 },
  { cantidad: 3, concepto: 'GASTOS ADMINISTRATIVOS', costo_unitario: 1200 },
  { cantidad: 9, concepto: 'MÓDULOS QUE CONSTA LA ESPECIALIDAD', costo_unitario: 2444 },
  { cantidad: 1, concepto: 'CERTIFICADO TOTAL DE LICENCIATURA', costo_unitario: 2572 },
  { cantidad: 1, concepto: 'CERTIFICADO TOTAL DE ESPECIALIDAD', costo_unitario: 2282 },
  { cantidad: 1, concepto: 'TÍTULO', costo_unitario: 3763 },
  { cantidad: 1, concepto: 'DIPLOMA DE ESPECIALIDAD', costo_unitario: 3763 },
  { cantidad: 1, concepto: 'CEREMONIA DE GRADO', costo_unitario: 4826 },
].map(item => ({...item, costo_total: item.cantidad * item.costo_unitario }));

const EspecialidadDesgloseTable = ({ form, setForm, isEditing = true }: { form: Partial<PaymentPlan>, setForm: (val: Partial<PaymentPlan>) => void, isEditing?: boolean }) => {
  const desglose = Array.isArray(form.desglose_conceptos) && form.desglose_conceptos.length > 0 
      ? form.desglose_conceptos 
      : DEFAULT_ESPECIALIDAD_DESGLOSE;
      
  const dtb = form.desglose_total_bruto ?? desglose.reduce((acc: number, item: any) => acc + item.costo_total, 0);
  const dp = form.desglose_descuento_porcentaje ?? 0;
  const dm = form.desglose_descuento_monto ?? (dtb * (dp / 100));
  const dtn = form.desglose_total_neto ?? (dtb - dm);

  // Initialize if empty or update if beca_porcentaje changes
  React.useEffect(() => {
    const defaultDesglose = (!form.desglose_conceptos || form.desglose_conceptos.length === 0) ? DEFAULT_ESPECIALIDAD_DESGLOSE : desglose;
    const match = form.beca_porcentaje?.match(/(\d+(\.\d+)?)/);
    const becaPct = match ? parseFloat(match[0]) : dp;
    
    // Only update if there are changes we need to propagate
    if ((!form.desglose_conceptos || form.desglose_conceptos.length === 0) || (becaPct !== dp)) {
      const b = form.desglose_total_bruto ?? defaultDesglose.reduce((acc: number, item: any) => acc + item.costo_total, 0);
      const m = b * (becaPct / 100);
      const n = b - m;
      setForm({ ...form, desglose_conceptos: defaultDesglose, desglose_total_bruto: b, desglose_descuento_porcentaje: becaPct, desglose_descuento_monto: m, desglose_total_neto: n });
    }
  }, [form.beca_porcentaje]);

  const updateItem = (index: number, field: string, value: number | string) => {
    const newDesglose = [...desglose];
    newDesglose[index] = { ...newDesglose[index], [field]: value };
    if (field === 'cantidad' || field === 'costo_unitario') {
       newDesglose[index].costo_total = Number(newDesglose[index].cantidad) * Number(newDesglose[index].costo_unitario);
    }
    recalculate(newDesglose, form.desglose_descuento_porcentaje || 0);
  };
  
  const removeItem = (index: number) => {
    const newDesglose = desglose.filter((_: any, i: number) => i !== index);
    recalculate(newDesglose, form.desglose_descuento_porcentaje || 0);
  };
  
  const addItem = () => {
    const newDesglose = [...desglose, { cantidad: 1, concepto: '', costo_unitario: 0, costo_total: 0 }];
    recalculate(newDesglose, form.desglose_descuento_porcentaje || 0);
  };

  const updateDescuento = (pct: number) => {
    recalculate(desglose, pct);
  };

  const recalculate = (currentDesglose: any[], pct: number) => {
    const bruto = currentDesglose.reduce((acc: number, item: any) => acc + Number(item.costo_total), 0);
    const monto = bruto * (pct / 100);
    const neto = bruto - monto;
    setForm({ 
      ...form, 
      beca_porcentaje: pct > 0 ? `${pct}%` : '0%', // Sync with external 
      desglose_conceptos: currentDesglose,
      desglose_total_bruto: bruto,
      desglose_descuento_porcentaje: pct,
      desglose_descuento_monto: monto,
      desglose_total_neto: neto
    });
  };

  const [pagosADividir, setPagosADividir] = React.useState(15);
  const [isDistributed, setIsDistributed] = React.useState(false);

  const distribuir = () => {
    if (pagosADividir < 1 || pagosADividir > 15) return;
    const montoPorPago = Number((dtn / pagosADividir).toFixed(2));
    
    const updates: any = {};
    for (let i = 1; i <= 15; i++) {
       if (i <= pagosADividir) {
          updates[`concepto_${i}`] = i === 1 ? '1ER PAGO' : i === 2 ? '2DO PAGO' : i === 3 ? '3ER PAGO' : i === 4 ? '4TO PAGO' : i === 5 ? '5TO PAGO' : i === 6 ? '6TO PAGO' : i === 7 ? '7MO PAGO' : i === 8 ? '8VO PAGO' : i === 9 ? '9NO PAGO' : i === 10 ? '10MO PAGO' : i === 11 ? '11VO PAGO' : i === 12 ? '12VO PAGO' : i === 13 ? '13VO PAGO' : i === 14 ? '14VO PAGO' : i === 15 ? '15VO PAGO' : `${i}VO PAGO`;
          updates[`cantidad_${i}`] = montoPorPago;
          const estatusKey = `estatus_${i}` as keyof typeof form;
          updates[`estatus_${i}`] = form[estatusKey] || 'PENDIENTE';
       } else {
          updates[`concepto_${i}`] = '';
          updates[`cantidad_${i}`] = null;
          updates[`estatus_${i}`] = '';
          updates[`fecha_${i}`] = '';
       }
    }
    setForm({ ...form, ...updates });
    setIsDistributed(true);
    setTimeout(() => setIsDistributed(false), 2500);
  };

  return (
    <div className="mt-6 mb-6 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 dark:from-indigo-900/10 dark:to-blue-900/10 rounded-[20px] border border-indigo-100 dark:border-indigo-800/30 overflow-hidden shadow-inner">
      <div className="p-4 bg-[#bfdbfe]/50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center">
        <h3 className="font-bold text-[#1456f0] dark:text-indigo-300">Desglose de Servicios (Especialidad)</h3>
        <button onClick={addItem} type="button" className="text-xs bg-[#1456f0] hover:bg-[#1d4ed8] text-white px-3 py-1.5 rounded-[8px] flex items-center gap-1 font-semibold transition-colors">
          <Plus size={14} /> Añadir Concepto
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-indigo-900/60 dark:text-indigo-200/60 border-b border-indigo-100 dark:border-indigo-800/30 uppercase text-[10px] tracking-wider">
              <th className="pb-2">Cant.</th>
              <th className="pb-2">Concepto</th>
              <th className="pb-2 text-right">Costo Unitario</th>
              <th className="pb-2 text-right">Costo Total</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
            {desglose.map((item: any, idx: number) => (
              <tr key={idx} className="hover:bg-white/40 dark:hover:bg-black/10 transition-colors">
                <td className="py-2 pr-2">
                  <input type="number" min="1" className="w-16 p-1.5 border border-indigo-200 rounded text-center bg-white dark:bg-[#1c2228] outline-none focus:border-[#3b82f6]" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', Number(e.target.value))} />
                </td>
                <td className="py-2 pr-2">
                  <input type="text" className="w-full p-1.5 border border-indigo-200 rounded px-2 bg-white dark:bg-[#1c2228] outline-none focus:border-[#3b82f6]" value={item.concepto} onChange={e => updateItem(idx, 'concepto', e.target.value)} />
                </td>
                <td className="py-2 pr-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1.5 text-[#8e8e93]">$</span>
                    <input type="number" step="0.01" className="w-28 p-1.5 pl-6 border border-indigo-200 rounded text-right bg-white dark:bg-[#1c2228] outline-none focus:border-[#3b82f6]" value={item.costo_unitario} onChange={e => updateItem(idx, 'costo_unitario', Number(e.target.value))} />
                  </div>
                </td>
                <td className="py-2 text-right font-bold text-[#45515e] dark:text-gray-300">
                  ${Number(item.costo_total).toLocaleString('en-US', {minimumFractionDigits: 2})}
                </td>
                <td className="py-2 pl-2 text-right">
                  <button onClick={() => removeItem(idx)} type="button" className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-[8px] transition-colors"><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white/60 dark:bg-gray-900/40 p-4 border-t border-indigo-100 dark:border-indigo-800/30 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-[#8e8e93] uppercase font-semibold mb-1">Total Bruto</p>
          <p className="text-lg font-bold text-[#222222] dark:text-gray-200">${Number(dtb).toLocaleString('en-US', {minimumFractionDigits:2})}</p>
        </div>
        <div>
          <p className="text-xs text-[#8e8e93] uppercase font-semibold mb-1">Descuento (%)</p>
          <div className="flex items-center gap-2">
             <input type="number" step="0.1" className="w-20 p-1.5 border border-indigo-200 rounded bg-white dark:bg-[#1c2228] outline-none focus:ring-2 focus:ring-[#3b82f6]" value={dp} onChange={e => updateDescuento(Number(e.target.value))} />
             <span className="text-[#8e8e93] font-bold">%</span>
          </div>
        </div>
        <div>
           <p className="text-xs text-[#8e8e93] uppercase font-semibold mb-1">Descuento ($)</p>
           <p className="text-lg font-bold text-orange-600 dark:text-orange-400">-${Number(dm).toLocaleString('en-US', {minimumFractionDigits:2})}</p>
        </div>
        <div>
           <p className="text-xs text-[#1456f0] uppercase font-semibold mb-1">Total Neto (A Diferir)</p>
           <p className="text-2xl font-black text-[#1456f0] dark:text-indigo-400">${Number(dtn).toLocaleString('en-US', {minimumFractionDigits:2})}</p>
        </div>
      </div>
      {isEditing && (
        <div className="bg-indigo-50 dark:bg-indigo-900/40 p-4 flex flex-wrap gap-4 items-center justify-between border-t border-indigo-100 dark:border-indigo-800/30">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Dividir Neto en:</label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="15" className="w-16 p-1.5 border border-indigo-300 rounded-[8px] text-center bg-white dark:bg-[#1c2228] outline-none focus:ring-2 focus:ring-[#3b82f6] font-bold text-[#1456f0]" value={pagosADividir} onChange={e => setPagosADividir(Number(e.target.value))}/>
              <span className="text-sm font-medium text-[#1456f0]/60 dark:text-indigo-200/60">pagos</span>
            </div>
          </div>
          <button onClick={distribuir} type="button" className={`px-5 py-2 rounded-[8px] font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 ${isDistributed ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-[#1456f0] hover:bg-[#1d4ed8] text-white'}`}>
            {isDistributed ? '¡Pagos Distribuidos!' : 'Calculadora Mágica (Auto-Rellenar)'}
          </button>
        </div>
      )}
    </div>
  );
};

interface PlanPagosProps {
  currentUser: Usuario;
  plans: PaymentPlan[];
  alumnos?: Alumno[];
  activeCiclo?: CicloEscolar;
  catalogos?: Catalogos;
  plantillas?: PlantillaPlan[];
  initialAlumnoId?: string | null;
  onBack: () => void;
  onSavePlan: (plan: PaymentPlan) => void;
  onGoToPagos?: (alumnoId: string, conceptoIdx: number, planId?: string) => void;
  onViewReceipt?: (folio: string, alumnoId: string) => void;
  onBackToFicha?: (alumnoId: string) => void;
  onBackToReceipt?: () => void;
  onDeletePlan?: (planId: string) => void;
}

export default function PlanPagos({ currentUser, plans, alumnos = [], activeCiclo, catalogos, plantillas = [], initialAlumnoId, onBack, onSavePlan, onDeletePlan, onGoToPagos, onViewReceipt, onBackToFicha, onBackToReceipt }: PlanPagosProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    if (initialAlumnoId) {
      const match = plans.find(p => p.alumno_id === initialAlumnoId);
      if (match) return match.id;
    }
    const savedId = localStorage.getItem('lastSelectedPlanId');
    if (savedId && plans.find(p => p.id === savedId)) return savedId;
    return plans[0]?.id || '';
  });

  const [searchTerm, setSearchTerm] = useState<string>(() => {
    if (initialAlumnoId) {
      const match = plans.find(p => p.alumno_id === initialAlumnoId);
      if (match) return match.nombre_alumno || '';
    }
    const savedId = localStorage.getItem('lastSelectedPlanId');
    const savedPlan = savedId ? plans.find(p => p.id === savedId) : null;
    if (savedPlan) return savedPlan.nombre_alumno || '';
    return plans[0]?.nombre_alumno || '';
  });

  useEffect(() => {
    if (selectedPlanId) {
      localStorage.setItem('lastSelectedPlanId', selectedPlanId);
    }
  }, [selectedPlanId]);
  
  const isCoordinador = currentUser.rol === 'COORDINADOR';
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  const [deleteConfirmPlanId, setDeleteConfirmPlanId] = useState<string | null>(null);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState<number>(1);
  const [paymentInput, setPaymentInput] = useState('');
  // Vincular recibo state
  const [paymentModalTab, setPaymentModalTab] = useState<'manual' | 'vincular'>('manual');
  const [candidateDetalles, setCandidateDetalles] = useState<any[]>([]);
  const [loadingRecibos, setLoadingRecibos] = useState(false);
  const [selectedDetalleId, setSelectedDetalleId] = useState<string>('');

  const [editForm, setEditForm] = useState<Partial<PaymentPlan>>({});
  const [newPlanForm, setNewPlanForm] = useState<Partial<PaymentPlan>>({
    tipo_plan: 'Cuatrimestral',
    beca_porcentaje: '0%',
    beca_tipo: 'NINGUNA',
    fecha_plan: new Date().toLocaleDateString('es-MX')
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  // Search state for New Plan Modal
  const [newPlanSearchTerm, setNewPlanSearchTerm] = useState('');
  const [showNewAlumnoSuggestions, setShowNewAlumnoSuggestions] = useState(false);
  const newPlanAlumnoRef = useRef<HTMLDivElement>(null);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newPlanAlumnoRef.current && !newPlanAlumnoRef.current.contains(event.target as Node)) {
        setShowNewAlumnoSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Removed filter to allow multiple plans per student
  const availableAlumnos = alumnos;

  const filteredNewAlumnoSuggestions = availableAlumnos.filter(a =>
    a.nombre_completo.toLowerCase().includes(newPlanSearchTerm.toLowerCase())
  );


  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = plantillas.find(p => p.id === templateId);
    if (template) {
      setNewPlanForm(prev => ({
        ...prev,
        tipo_plan: template.tipo_plan,
        concepto_1: template.concepto_1, fecha_1: template.fecha_1, cantidad_1: template.cantidad_1,
        concepto_2: template.concepto_2, fecha_2: template.fecha_2, cantidad_2: template.cantidad_2,
        concepto_3: template.concepto_3, fecha_3: template.fecha_3, cantidad_3: template.cantidad_3,
        concepto_4: template.concepto_4, fecha_4: template.fecha_4, cantidad_4: template.cantidad_4,
        concepto_5: template.concepto_5, fecha_5: template.fecha_5, cantidad_5: template.cantidad_5,
        concepto_6: template.concepto_6, fecha_6: template.fecha_6, cantidad_6: template.cantidad_6,
        concepto_7: template.concepto_7, fecha_7: template.fecha_7, cantidad_7: template.cantidad_7,
        concepto_8: template.concepto_8, fecha_8: template.fecha_8, cantidad_8: template.cantidad_8,
        concepto_9: template.concepto_9, fecha_9: template.fecha_9, cantidad_9: template.cantidad_9,
        concepto_10: template.concepto_10, fecha_10: template.fecha_10, cantidad_10: template.cantidad_10,
        concepto_11: template.concepto_11, fecha_11: template.fecha_11, cantidad_11: template.cantidad_11,
        concepto_12: template.concepto_12, fecha_12: template.fecha_12, cantidad_12: template.cantidad_12,
        concepto_13: template.concepto_13, fecha_13: template.fecha_13, cantidad_13: template.cantidad_13,
        concepto_14: template.concepto_14, fecha_14: template.fecha_14, cantidad_14: template.cantidad_14,
        concepto_15: template.concepto_15, fecha_15: template.fecha_15, cantidad_15: template.cantidad_15,
      }));
    }
  };

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showAlert = (title: string, message: string) => {
    setModalState({ isOpen: true, title, message });
  };

  // Usa los conceptos del catálogo configurable; fallback al listado estático si no hay catálogo
  const CONCEPTOS_CATALOGO = catalogos?.conceptos?.length
    ? catalogos.conceptos
    : [
      'INSCRIPCIÓN', 'REINSCRIPCIÓN', '1ER PAGO', '2DO PAGO', '3ER PAGO', '4TO PAGO',
      '5TO PAGO', '6TO PAGO', '7MO PAGO', '8VO PAGO', 'CONSTANCIAS RENOVACIÓN DE BECA',
      'SEGURO ESTUDIANTIL', 'CREDENCIAL', 'OTROS'
    ];

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [y, m, d] = dateString.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateString;
  };

  const toInputDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      const [d, m, y] = dateString.split('/');
      return `${y}-${m}-${d}`;
    }
    return ''; // Return empty for invalid formats like "13 DE OCTUBRE" to avoid console warnings
  };

  // PDF Generation State
  const printRef = useRef<HTMLDivElement>(null);
  const cotizacionRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Post-Create Modal State
  const [postCreatePrompt, setPostCreatePrompt] = useState<PaymentPlan | null>(null);

  const handleGeneratePDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPDF(true);
    
    // Guardar estilos originales
    const originalWidth = printRef.current.style.width;
    const originalMinWidth = printRef.current.style.minWidth;
    const originalMaxWidth = printRef.current.style.maxWidth;
    const originalPadding = printRef.current.style.padding;
    const originalOverflow = printRef.current.style.overflow;

    try {
      // Forzar dimensiones de escritorio (Letter/A4) para el PDF
      printRef.current.style.width = '816px';
      printRef.current.style.minWidth = '816px';
      printRef.current.style.maxWidth = '816px';
      printRef.current.style.padding = '32px';
      printRef.current.style.overflow = 'visible';
      
      // Dar un pequeño respiro para que el navagador re-renderice el DOM con los nuevos tamaños
      await new Promise(r => setTimeout(r, 150));

      const dataUrl = await toPng(printRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 816,
        height: printRef.current.scrollHeight,
        style: { transform: 'scale(1)', margin: '0' },
        filter: (node) => {
          if (node instanceof HTMLElement) {
            return node.getAttribute('data-html2canvas-ignore') !== 'true';
          }
          return true;
        }
      });

      const pdf = new jsPDF('p', 'mm', 'letter');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfMaxHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const printWidth = pdfWidth - (margin * 2);
      const calculatedPdfHeight = (printRef.current.scrollHeight * printWidth) / 816;

      let finalWidth = printWidth;
      let finalHeight = calculatedPdfHeight;
      let xOffset = margin;

      // Si la tabla es muy larga (ej. 15 filas) escalamos todo para que quepa en 1 sola hoja
      if (calculatedPdfHeight > (pdfMaxHeight - margin * 2)) {
         const ratio = (pdfMaxHeight - margin * 2) / calculatedPdfHeight;
         finalHeight = calculatedPdfHeight * ratio;
         finalWidth = printWidth * ratio;
         xOffset = margin + (printWidth - finalWidth) / 2; // centrar horizontalmente
      }

      pdf.addImage(dataUrl, 'PNG', xOffset, margin, finalWidth, finalHeight);

      // --- SEGUNDA PÁGINA: COTIZACIÓN DE ESPECIALIDAD ---
      if (selectedPlan.tipo_plan === 'Especialidad Completa' && cotizacionRef.current) {
        cotizacionRef.current.style.width = '816px';
        const cDataUrl = await toPng(cotizacionRef.current, {
           quality: 1.0,
           pixelRatio: 2,
           backgroundColor: '#ffffff',
           width: 816,
           height: cotizacionRef.current.scrollHeight,
           style: { transform: 'scale(1)', margin: '0' }
        });

        pdf.addPage();
        const cPdfHeight = (cotizacionRef.current.scrollHeight * printWidth) / 816;
        let cH = cPdfHeight;
        let cW = printWidth;
        let cx = margin;
        
        if (cPdfHeight > (pdfMaxHeight - margin * 2)) {
           const ratio = (pdfMaxHeight - margin * 2) / cPdfHeight;
           cH = cPdfHeight * ratio;
           cW = printWidth * ratio;
           cx = margin + (printWidth - cW) / 2;
        }

        pdf.addImage(cDataUrl, 'PNG', cx, margin, cW, cH);
      }
      // ----------------------------------------------------

      pdf.save(`Plan_Pagos_${selectedPlan.nombre_alumno.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
    } finally {
      // Restaurar estilos responsivos
      if (printRef.current) {
        printRef.current.style.width = originalWidth;
        printRef.current.style.minWidth = originalMinWidth;
        printRef.current.style.maxWidth = originalMaxWidth;
        printRef.current.style.padding = originalPadding;
        printRef.current.style.overflow = originalOverflow;
      }
      setIsGeneratingPDF(false);
    }
  };

  if (plans.length === 0) {
    return (
      <div className="w-full p-8 font-sans flex flex-col items-center justify-center">
        <div className="bg-white dark:bg-[#1c2228] p-10 rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] text-center max-w-md w-full">
          <div className="bg-blue-50 dark:bg-blue-900/40 text-blue-500 dark:text-blue-400 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Inbox size={40} />
          </div>
          <h2 className="text-2xl font-bold text-[#222222] dark:text-gray-100 mb-3">Sin Planes de Pago</h2>
          <p className="text-[#8e8e93] dark:text-[#8e8e93] mb-8">No hay planes de pago registrados para este ciclo escolar. Por favor, selecciona otro ciclo o inscribe alumnos.</p>
          <div className="flex flex-col gap-3">
            {!isCoordinador && (
              <button
                onClick={() => setIsNewPlanModalOpen(true)}
                className="bg-[#1456f0] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-[13px] font-semibold transition-colors flex items-center gap-2 mx-auto w-full justify-center"
              >
                <Plus size={20} /> Crear Nuevo Plan
              </button>
            )}
            <button
              onClick={onBack}
              className="bg-gray-100 hover:bg-gray-200 text-[#45515e] px-6 py-3 rounded-[13px] font-semibold transition-colors flex items-center gap-2 mx-auto w-full justify-center"
            >
              <ArrowLeft size={20} /> Volver al Inicio
            </button>
          </div>
        </div>

        {/* New Plan Modal (Empty State) */}
        {isNewPlanModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1c2228] rounded-[13px] shadow-xl w-full max-w-lg overflow-hidden flex flex-col text-left">
              <div className="flex justify-between items-center p-6 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)]">
                <h3 className="text-lg font-bold text-[#222222] dark:text-gray-100">
                  Crear Nuevo Plan de Pagos
                </h3>
                <button onClick={() => setIsNewPlanModalOpen(false)} className="text-[#8e8e93] hover:text-[#45515e]">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-grow space-y-4">
                <div className="relative" ref={newPlanAlumnoRef}>
                  <label className="block text-sm font-medium text-[#45515e] mb-1">Alumno</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93]" size={16} />
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-[8px] pl-10 pr-10 py-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white text-sm font-semibold"
                      placeholder="Buscar alumno para nuevo plan..."
                      value={newPlanSearchTerm}
                      onChange={(e) => {
                        setNewPlanSearchTerm(e.target.value);
                        setShowNewAlumnoSuggestions(true);
                        setNewPlanForm(prev => ({ ...prev, alumno_id: '' }));
                      }}
                      onFocus={() => setShowNewAlumnoSuggestions(true)}
                    />
                    {newPlanSearchTerm && (
                      <button
                        onClick={() => { setNewPlanSearchTerm(''); setShowNewAlumnoSuggestions(true); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-[#45515e]"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {showNewAlumnoSuggestions && newPlanSearchTerm && (
                    <div className="absolute top-full left-0 w-full bg-white border border-[#e5e7eb] rounded-[8px] shadow-xl mt-1 z-[60] max-h-60 overflow-y-auto">
                      {filteredNewAlumnoSuggestions.length > 0 ? (
                        filteredNewAlumnoSuggestions.map(alumno => (
                          <button
                            key={alumno.id}
                            className="w-full text-left px-4 py-3 hover:bg-[rgba(0,0,0,0.03)] border-b border-gray-50 last:border-none transition-colors"
                            onClick={() => {
                              setNewPlanForm({
                                ...newPlanForm,
                                alumno_id: alumno.id,
                                nombre_alumno: alumno.nombre_completo,
                                licenciatura: alumno.licenciatura,
                                grado_turno: `${alumno.grado_actual} / ${alumno.turno}`
                              });
                              setNewPlanSearchTerm(alumno.nombre_completo);
                              setShowNewAlumnoSuggestions(false);
                            }}
                          >
                            <p className="font-bold text-[#222222] text-sm">{toTitleCase(alumno.nombre_completo)}</p>
                            <p className="text-xs text-[#8e8e93]">{toTitleCase(alumno.licenciatura)} · {alumno.grado_actual}º {alumno.turno}</p>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-[#8e8e93]">
                          No se encontraron alumnos disponibles
                        </div>
                      )}
                    </div>
                  )}
                  {availableAlumnos.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Todos los alumnos registrados ya tienen un plan en este ciclo.</p>
                  )}
                </div>

                {plantillas.filter(p => p.activo).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-[#45515e] mb-1">Usar Plantilla de Plan</label>
                    <select
                      className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                      value={selectedTemplateId}
                      onChange={(e) => applyTemplate(e.target.value)}
                    >
                      <option value="">-- Sin Plantilla (Manual) --</option>
                      {plantillas.filter(p => p.activo && (!p.ciclo_id || p.ciclo_id === activeCiclo?.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-[#45515e] mb-1">Tipo de Plan</label>
                    <select
                      className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                      value={newPlanForm.tipo_plan || 'Cuatrimestral'}
                      onChange={(e) => setNewPlanForm({ ...newPlanForm, tipo_plan: e.target.value as any })}
                    >
                      <option value="Cuatrimestral">Cuatrimestral (Hasta 7 pagos)</option>
                      <option value="Semestral">Semestral (Hasta 9 pagos)</option>
                      <option value="Titulación">Titulación (Hasta 15 pagos)</option>
                      <option value="Especialidad Completa">Especialidad Completa (Hasta 15 pagos)</option>
                      <option value="Especialidad Cuatrimestral">Especialidad Cuatrimestral (Hasta 15 pagos)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#45515e] mb-1">Programa / Licenciatura</label>
                    {catalogos?.licenciaturas?.length ? (
                      <select
                        className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                        value={newPlanForm.licenciatura || ''}
                        onChange={(e) => setNewPlanForm({ ...newPlanForm, licenciatura: e.target.value })}
                      >
                        <option value="">-- Seleccione --</option>
                        {catalogos.licenciaturas.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                        value={newPlanForm.licenciatura || ''}
                        placeholder="Ej. Especialidad en Derecho..."
                        onChange={(e) => setNewPlanForm({ ...newPlanForm, licenciatura: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="col-span-2 md:col-span-2">
                    <label className="block text-sm font-medium text-[#45515e] mb-1">Grado y Turno (Opcional)</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                      value={newPlanForm.grado_turno || ''}
                      placeholder="Ej. 1er Cuatrimestre / Sabatino"
                      onChange={(e) => setNewPlanForm({ ...newPlanForm, grado_turno: e.target.value })}
                    />
                    <p className="text-[10px] text-[#8e8e93] leading-tight mt-1">Si lo dejas en blanco, el plan siempre mostrará el grado/turno actual del alumno en tiempo real. Si escribes algo, el plan quedará sellado con este texto permanentemente.</p>
                  </div>
                </div>
                {newPlanForm.tipo_plan !== 'Titulación' && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-[#45515e] mb-1">Porcentaje de Beca</label>
                      {catalogos?.beca_porcentajes?.length ? (
                        <select
                          className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                          value={newPlanForm.beca_porcentaje || '0%'}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_porcentaje: e.target.value })}
                        >
                          {catalogos.beca_porcentajes.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <input type="text" className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6]"
                          value={newPlanForm.beca_porcentaje || ''} placeholder="Ej. 0%"
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_porcentaje: e.target.value })} />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#45515e] mb-1">Tipo de Beca</label>
                      {catalogos?.beca_tipos?.length ? (
                        <select
                          className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                          value={newPlanForm.beca_tipo || 'NINGUNA'}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_tipo: e.target.value })}
                        >
                          {catalogos.beca_tipos.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <input type="text" className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6]"
                          value={newPlanForm.beca_tipo || ''} placeholder="Ej. NINGUNA"
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_tipo: e.target.value })} />
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-[#f2f3f5] border-t border-[#f2f3f5] flex justify-end gap-3">
                <button
                  onClick={() => { setIsNewPlanModalOpen(false); setNewPlanSearchTerm(''); }}
                  className="px-4 py-2 text-[#45515e] hover:bg-gray-200 rounded-[8px] font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!newPlanForm.alumno_id) {
                      showAlert('Error', 'Por favor selecciona un alumno');
                      return;
                    }
                    const newPlan: PaymentPlan = {
                      id: crypto.randomUUID(),
                      alumno_id: newPlanForm.alumno_id,
                      ciclo_id: activeCiclo?.id,
                      nombre_alumno: newPlanForm.nombre_alumno || '',
                      no_plan_pagos: generateFolioForPlan(newPlanForm.alumno_id, newPlanForm.tipo_plan || 'Cuatrimestral', activeCiclo?.nombre || '', plans),
                      fecha_plan: new Date().toLocaleDateString('es-MX'),
                      beca_porcentaje: newPlanForm.beca_porcentaje || '0%',
                      beca_tipo: newPlanForm.beca_tipo || 'NINGUNA',
                      ciclo_escolar: activeCiclo?.nombre || '',
                      tipo_plan: newPlanForm.tipo_plan || 'Cuatrimestral',
                      licenciatura: newPlanForm.licenciatura || '',
                      grado_turno: newPlanForm.grado_turno || '',
                      concepto_1: newPlanForm.concepto_1, fecha_1: newPlanForm.fecha_1, cantidad_1: newPlanForm.cantidad_1,
                      concepto_2: newPlanForm.concepto_2, fecha_2: newPlanForm.fecha_2, cantidad_2: newPlanForm.cantidad_2,
                      concepto_3: newPlanForm.concepto_3, fecha_3: newPlanForm.fecha_3, cantidad_3: newPlanForm.cantidad_3,
                      concepto_4: newPlanForm.concepto_4, fecha_4: newPlanForm.fecha_4, cantidad_4: newPlanForm.cantidad_4,
                      concepto_5: newPlanForm.concepto_5, fecha_5: newPlanForm.fecha_5, cantidad_5: newPlanForm.cantidad_5,
                      concepto_6: newPlanForm.concepto_6, fecha_6: newPlanForm.fecha_6, cantidad_6: newPlanForm.cantidad_6,
                      concepto_7: newPlanForm.concepto_7, fecha_7: newPlanForm.fecha_7, cantidad_7: newPlanForm.cantidad_7,
                      concepto_8: newPlanForm.concepto_8, fecha_8: newPlanForm.fecha_8, cantidad_8: newPlanForm.cantidad_8,
                      concepto_9: newPlanForm.concepto_9, fecha_9: newPlanForm.fecha_9, cantidad_9: newPlanForm.cantidad_9,
                      concepto_10: newPlanForm.concepto_10, fecha_10: newPlanForm.fecha_10, cantidad_10: newPlanForm.cantidad_10,
                      concepto_11: newPlanForm.concepto_11, fecha_11: newPlanForm.fecha_11, cantidad_11: newPlanForm.cantidad_11,
                      concepto_12: newPlanForm.concepto_12, fecha_12: newPlanForm.fecha_12, cantidad_12: newPlanForm.cantidad_12,
                      concepto_13: newPlanForm.concepto_13, fecha_13: newPlanForm.fecha_13, cantidad_13: newPlanForm.cantidad_13,
                      concepto_14: newPlanForm.concepto_14, fecha_14: newPlanForm.fecha_14, cantidad_14: newPlanForm.cantidad_14,
                      concepto_15: newPlanForm.concepto_15, fecha_15: newPlanForm.fecha_15, cantidad_15: newPlanForm.cantidad_15,
                    };
                    onSavePlan(newPlan);
                    setSelectedPlanId(newPlan.id);
                    setIsNewPlanModalOpen(false);
                    setNewPlanSearchTerm('');
                    setNewPlanForm({
                      tipo_plan: 'Cuatrimestral',
                      beca_porcentaje: '0%',
                      beca_tipo: 'NINGUNA',
                      fecha_plan: new Date().toLocaleDateString('es-MX')
                    });
                    setSelectedTemplateId('');
                  }}
                  disabled={!newPlanForm.alumno_id}
                  className="px-6 py-2 bg-[#1456f0] hover:bg-[#1d4ed8] text-white rounded-[8px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={18} /> Crear Plan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];

  const getAlumnoName = (p: PaymentPlan) => {
    const baseName = p.nombre_alumno || alumnos.find(al => al.id === p.alumno_id)?.nombre_completo || '';
    return `${baseName} (${p.tipo_plan || 'Cuatrimestral'})`;
  };

  const getAlumnoData = (p: PaymentPlan) => {
    const a = alumnos.find(al => al.id === p.alumno_id);
    return {
      licenciatura: p.licenciatura || (a ? a.licenciatura : ''),
      grado_turno: p.grado_turno || (a ? `${a.grado_actual} / ${a.turno}` : '')
    };
  };

  // ── Navegación Alfabética ──
  const sortedActivePlans = React.useMemo(() => {
    return [...plans].sort((a, b) => {
      const nameA = getAlumnoName(a).toLowerCase();
      const nameB = getAlumnoName(b).toLowerCase();
      return nameA.localeCompare(nameB, 'es');
    });
  }, [plans, alumnos]);

  const currentPlanIndex = sortedActivePlans.findIndex(p => p.id === selectedPlanId);
  const safeCurrentIndex = currentPlanIndex >= 0 ? currentPlanIndex : 0;
  
  const prevPlan = safeCurrentIndex > 0 ? sortedActivePlans[safeCurrentIndex - 1] : null;
  const nextPlan = safeCurrentIndex < sortedActivePlans.length - 1 ? sortedActivePlans[safeCurrentIndex + 1] : null;

  const jumpToPlan = (plan: PaymentPlan) => {
    setSelectedPlanId(plan.id);
    setSearchTerm(getAlumnoName(plan));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredPlans = plans.filter(p =>
    getAlumnoName(p).toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (plan: PaymentPlan) => {
    setSelectedPlanId(plan.id);
    setSearchTerm(getAlumnoName(plan));
    setShowSuggestions(false);
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedPlanId(newId);
    const plan = plans.find(p => p.id === newId);
    if (plan) setSearchTerm(getAlumnoName(plan));
  };

  const openPaymentModal = (index: number) => {
    setSelectedPaymentIndex(index);
    setPaymentInput(selectedPlan[`estatus_${index}` as keyof PaymentPlan] as string || '');
    setPaymentModalTab('manual');
    setCandidateDetalles([]);
    setSelectedDetalleId('');
    setIsPaymentModalOpen(true);
  };

  const loadCandidateRecibos = async () => {
    setLoadingRecibos(true);
    try {
      const alumnoId = selectedPlan.alumno_id || alumnos.find(a => a.nombre_completo === selectedPlan.nombre_alumno)?.id;
      if (!alumnoId) { setLoadingRecibos(false); return; }
      const { data } = await supabase
        .from('recibos')
        .select('*, recibos_detalles(*)')
        .eq('alumno_id', alumnoId)
        .neq('estatus', 'CANCELADO')
        .order('folio', { ascending: false });
      
      const detallesLibres: any[] = [];
      (data || []).forEach((r: any) => {
        (r.recibos_detalles || []).forEach((d: any) => {
           if (d.indice_concepto_plan == null) {
              detallesLibres.push({ ...d, _recibo: r });
           }
        });
      });
      setCandidateDetalles(detallesLibres);
    } catch { /* silenciar */ }
    setLoadingRecibos(false);
  };

  const handleSavePayment = async () => {
    let statusToWrite = paymentInput.trim() === '' ? 'PENDIENTE' : paymentInput;

    if (paymentModalTab === 'vincular' && selectedDetalleId) {
      const detalle = candidateDetalles.find(d => d.id === selectedDetalleId);
      if (detalle) {
        // Build a status string like the rest of the system: R-XXX (Abono...) or Pagado
        const existing = (selectedPlan[`estatus_${selectedPaymentIndex}` as keyof PaymentPlan] as string) || '';
        const montoPlaneado = (selectedPlan[`cantidad_${selectedPaymentIndex}` as keyof PaymentPlan] as number) || 0;
        
        const prevFolios = (existing.match(/(?:R-\d+|F-[A-Z0-9\-]+)/gi) || []);
        const folioPart = prevFolios.length > 0 ? prevFolios.join('; ') + '; ' : '';

        // Extract previous remaining balance
        const getRestanteDe = (estatusText: string, totalOriginal: number): number => {
            if (!estatusText || estatusText === 'PENDIENTE') return totalOriginal;
            const m = estatusText.match(/Resta\s*\$([0-9,]+(?:\.\d{2})?)/);
            if (m) return parseFloat(m[1].replace(',', ''));
            if (estatusText.toUpperCase().includes('PAGADO')) return 0;
            return totalOriginal;
        };

        const restanteAnterior = getRestanteDe(existing, montoPlaneado);

        const abonoActual = Number(detalle.subtotal) || 0;
        const resta = restanteAnterior - abonoActual;
        const totalPagadoNuevo = (montoPlaneado - restanteAnterior) + abonoActual;

        const prefixFolio = detalle._recibo.folio_fiscal ? `F-${detalle._recibo.folio_fiscal}` : `R-${detalle._recibo.folio}`;

        if (resta <= 0.005) {
            statusToWrite = `${folioPart}${prefixFolio} (Pagado $${totalPagadoNuevo.toFixed(2)})`;
        } else {
            statusToWrite = `${folioPart}${prefixFolio} (Abono $${totalPagadoNuevo.toFixed(2)}, Resta $${resta.toFixed(2)})`;
        }

        try {
          let observacionDB = '';
          if (resta > 0.005) {
              observacionDB = `Abono $${abonoActual.toFixed(2)} — Restante: $${resta.toFixed(2)}`;
          } else if (totalPagadoNuevo < montoPlaneado - 0.005 || existing.includes('Abono')) {
              observacionDB = `Abono final liquidado`;
          }

          await supabase
            .from('recibos_detalles')
            .update({ 
               indice_concepto_plan: selectedPaymentIndex,
               observaciones: observacionDB || null
            })
            .eq('id', detalle.id);
        } catch { /* si falla la vinculación de detalle, el estatus ya quedó escrito */ }
      }
    } else if (statusToWrite === 'PENDIENTE') {
      // Liberar todos los detalles asociados si se reinicia a PENDIENTE
      try {
        const alumnoId = selectedPlan.alumno_id || alumnos.find(a => a.nombre_completo === selectedPlan.nombre_alumno)?.id;
        if (alumnoId) {
          const { data: recibosAlumno } = await supabase.from('recibos').select('id').eq('alumno_id', alumnoId);
          if (recibosAlumno && recibosAlumno.length > 0) {
             const reciboIds = recibosAlumno.map(r => r.id);
             await supabase.from('recibos_detalles')
                .update({ indice_concepto_plan: null, observaciones: null })
                .eq('indice_concepto_plan', selectedPaymentIndex)
                .in('recibo_id', reciboIds);
          }
        }
      } catch { /* ignorar fallos de limpieza en red */ }
    }

    const updatedPlan = { ...selectedPlan, [`estatus_${selectedPaymentIndex}`]: statusToWrite };
    onSavePlan(updatedPlan);
    setCandidateDetalles([]); // Purgar la caché para que re-consulte si se vuelve a abrir la pestaña
    setIsPaymentModalOpen(false);
  };

  const openEditPlanModal = () => {
    setEditForm({ ...selectedPlan });
    setIsEditPlanModalOpen(true);
  };

  const handleSavePlanStructure = async () => {
    const indicesToFree: number[] = [];
    for (let i = 1; i <= 15; i++) {
        const estatusKey = `estatus_${i}` as keyof PaymentPlan;
        const oldStatus = selectedPlan[estatusKey] as string || '';
        const newStatus = editForm[estatusKey] as string || 'PENDIENTE';
        
        if (oldStatus !== 'PENDIENTE' && (newStatus.trim() === '' || newStatus === 'PENDIENTE')) {
             indicesToFree.push(i);
        }
    }

    if (indicesToFree.length > 0) {
      try {
        const alumnoId = selectedPlan.alumno_id || alumnos.find(a => a.nombre_completo === selectedPlan.nombre_alumno)?.id;
        if (alumnoId) {
          const { data: recibosAlumno } = await supabase.from('recibos').select('id').eq('alumno_id', alumnoId);
          if (recibosAlumno && recibosAlumno.length > 0) {
             const reciboIds = recibosAlumno.map(r => r.id);
             for (const idx of indicesToFree) {
                 await supabase.from('recibos_detalles')
                    .update({ indice_concepto_plan: null, observaciones: null })
                    .eq('indice_concepto_plan', idx)
                    .in('recibo_id', reciboIds);
             }
          }
        }
      } catch { /* ignorar fallos de limpieza en red */ }
    }

    const formToSave = { ...editForm };
    for (let i = 1; i <= 15; i++) {
       const key = `estatus_${i}` as keyof PaymentPlan;
       if (typeof formToSave[key] === 'string' && (formToSave[key] as string).trim() === '') {
           (formToSave as any)[key] = 'PENDIENTE';
       }
    }

    onSavePlan(formToSave as PaymentPlan);
    setIsEditPlanModalOpen(false);
  };

  const Td = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
    <td className={`border border-black p-2 text-center text-sm ${className}`}>
      {children}
    </td>
  );

  const Th = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
    <th className={`border border-black p-2 text-center text-sm font-bold bg-gray-300 ${className}`}>
      {children}
    </th>
  );

  const renderPaymentRow = (index: number) => {
    const concepto = selectedPlan[`concepto_${index}` as keyof PaymentPlan] as string | undefined;
    const fecha = selectedPlan[`fecha_${index}` as keyof PaymentPlan] as string | undefined;
    const cantidad = selectedPlan[`cantidad_${index}` as keyof PaymentPlan] as number | undefined;
    const estatus = selectedPlan[`estatus_${index}` as keyof PaymentPlan] as string | undefined;
    const paid = isPaid(estatus);

    if (!concepto) return null;

    return (
      <tr key={index}>
        <Td className="bg-[#e6f2e6] font-semibold">{concepto}</Td>
        <Td>{formatDate(fecha)}</Td>
        <Td>${cantidad?.toLocaleString()}</Td>
        <Td>
          {paid ? (
            <div className="flex items-center justify-center gap-2 group">
              <span className="text-green-700 font-bold print:text-black">
                {estatus?.split(/(R-\d+)/).map((part, i) => {
                  if (part.match(/^R-\d+$/)) {
                    const folioStr = part.replace('R-', '');
                    return (
                      <button 
                        key={i} 
                        onClick={() => onViewReceipt?.(folioStr, selectedPlan.alumno_id!)}
                        className="text-blue-700 underline hover:text-blue-900 mx-1 print:no-underline print:text-black"
                        title="Ver Recibo"
                      >
                        {part}
                      </button>
                    );
                  }
                  return <span key={i}>{part}</span>;
                })}
              </span>
              <button
                onClick={() => openPaymentModal(index)}
                className="text-[#8e8e93] hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                title="Editar recibo"
                data-html2canvas-ignore="true"
              >
                <Edit size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {/* Mostrar estatus parcial si existe (abono con resta pendiente) */}
              {estatus && (
                <span className="text-amber-700 font-semibold text-xs text-center">
                  {estatus.split(/(R-\d+)/).map((part, i) => {
                    if (part.match(/^R-\d+$/)) {
                      const folioStr = part.replace('R-', '');
                      return (
                        <button
                          key={i}
                          onClick={() => onViewReceipt?.(folioStr, selectedPlan.alumno_id!)}
                          className="text-blue-700 underline hover:text-blue-900 mx-0.5 print:no-underline print:text-black"
                          title="Ver Recibo"
                        >
                          {part}
                        </button>
                      );
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </span>
              )}
              {/* Botones de acción */}
              <div className="flex items-center justify-center gap-2 print:hidden" data-html2canvas-ignore="true">
                <button
                  onClick={() => onGoToPagos?.(selectedPlan.alumno_id!, index, selectedPlan.id)}
                  className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Generar recibo de ingresos"
                >
                  <DollarSign size={14} /> Cobrar
                </button>
                <button
                  onClick={() => openPaymentModal(index)}
                  className="bg-[#eef2ff] text-[#8e8e93] hover:bg-gray-100 border border-[#e5e7eb] px-2 py-1 rounded transition-colors"
                  title="Edición manual de estatus"
                >
                  <Edit size={14} />
                </button>
              </div>
            </div>
          )}
        </Td>
      </tr>
    );
  };

  const studentData = getAlumnoData(selectedPlan);
  const planType = selectedPlan.tipo_plan || 'Cuatrimestral';
  // Modificado: Calcular los máximos pagos requeridos
  const isExtendedPlan = planType === 'Titulación' || planType.includes('Especialidad');
  const maxPayments = isExtendedPlan ? 15 : planType === 'Semestral' ? 9 : 7;
  const paymentIndices = Array.from({ length: maxPayments }, (_, i) => i + 1);

  // Pestañas dinámicas para estudiantes con múltiples planes
  const studentAllPlans = React.useMemo(() => {
    const p = plans.filter(p => p.alumno_id === selectedPlan.alumno_id);
    return p.sort((a, b) => {
      const getWeight = (tipo: string) => {
        if (!tipo) return 0;
        const low = tipo.toLowerCase();
        if (low.includes('titulaci')) return 2;
        if (low.includes('especialidad')) return 1;
        return 0;
      };
      return getWeight(a.tipo_plan || '') - getWeight(b.tipo_plan || '');
    });
  }, [plans, selectedPlan.alumno_id]);

  return (
    <div className="w-full p-2 md:p-6 flex flex-col items-center justify-start font-sans print:p-0">
      
      {/* Top Action Bar - Hidden in Print (Movido estilo Stack para responsividad y claridad) */}
      <div className="flex flex-col gap-4 mb-6 w-full max-w-[816px] mx-auto print:hidden relative z-50">
        
        {/* Row 1: Back Buttons & Mobile Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[#45515e] dark:text-gray-200 hover:text-black dark:hover:text-white font-bold transition-colors shrink-0"
            >
              <ArrowLeft size={18} /> <span className="text-sm">Volver al Inicio</span>
            </button>
            
            {onBackToFicha && (
              <>
                <div className="hidden sm:block w-px h-5 bg-gray-300"></div>
                <button
                  onClick={() => onBackToFicha(selectedPlan.alumno_id!)}
                  className="flex items-center gap-2 text-[#1456f0] hover:text-indigo-900 font-bold transition-colors shrink-0"
                >
                  <User size={16} /> <span className="text-sm">Regresar a Ficha</span>
                </button>
              </>
            )}

            {onBackToReceipt && (
              <>
                <div className="hidden sm:block w-px h-5 bg-gray-300"></div>
                <button
                  onClick={onBackToReceipt}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[8px] bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 transition-colors shrink-0"
                >
                  <ArrowLeft size={13} /> Volver al Recibo
                </button>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {!isCoordinador && (
              <button 
                onClick={() => setIsNewPlanModalOpen(true)} 
                className="flex items-center justify-center p-2 xl:px-4 xl:py-2 bg-[#1456f0] hover:bg-[#1d4ed8] text-white rounded-[8px] shadow-[var(--shadow-subtle)] gap-2 transition-colors font-medium"
              >
                <Plus size={18} /> <span className="hidden xl:inline">Nuevo Plan</span>
              </button>
            )}
            <button 
              onClick={openEditPlanModal} 
              className="flex items-center justify-center p-2 xl:px-4 xl:py-2 bg-white hover:bg-[#f2f3f5] text-[#222222] border border-gray-300 rounded-[8px] shadow-[var(--shadow-subtle)] gap-2 transition-all font-bold text-sm"
            >
              <Edit size={18} /> <span className="hidden xl:inline">Editar</span>
            </button>
            <button 
              onClick={handleGeneratePDF} 
              disabled={isGeneratingPDF} 
              className="flex items-center justify-center p-2 xl:px-4 xl:py-2 bg-red-600 hover:bg-red-700 text-white rounded-[8px] shadow-[var(--shadow-subtle)] disabled:opacity-50 gap-2 transition-all font-bold text-sm"
            >
              {isGeneratingPDF ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
              <span className="hidden xl:inline">{isGeneratingPDF ? 'Generando...' : 'PDF / Imprimir'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Navegación Móvil y Búsqueda */}
        <div className="relative z-20 w-full xl:max-w-md mx-auto xl:mx-0 flex flex-col gap-3">
          
          {/* Navegación Móvil/Tablet */}
          <div className="flex xl:hidden justify-between items-center gap-2 w-full mt-2">
            <button
              onClick={() => prevPlan && jumpToPlan(prevPlan)}
              disabled={!prevPlan}
              className="flex items-center justify-center py-2 px-3 bg-white dark:bg-[#1c2228] hover:bg-[#eef2ff] text-[#45515e] dark:text-gray-300 border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] shadow-[var(--shadow-subtle)] disabled:opacity-40 transition-colors w-full gap-1 active:scale-95"
            >
              <ChevronLeft size={16} /> <span className="text-sm font-semibold truncate max-w-[90px]">{prevPlan ? getAlumnoName(prevPlan).split(' ')[0] : 'Inicio'}</span>
            </button>
            <span className="text-xs font-bold text-[#8e8e93] min-w-fit px-2 whitespace-nowrap">
               {safeCurrentIndex + 1} de {sortedActivePlans.length}
            </span>
            <button
              onClick={() => nextPlan && jumpToPlan(nextPlan)}
              disabled={!nextPlan}
              className="flex items-center justify-center py-2 px-3 bg-white dark:bg-[#1c2228] hover:bg-[#eef2ff] text-[#45515e] dark:text-gray-300 border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] shadow-[var(--shadow-subtle)] disabled:opacity-40 transition-colors w-full gap-1 active:scale-95"
            >
              <span className="text-sm font-semibold truncate max-w-[90px]">{nextPlan ? getAlumnoName(nextPlan).split(' ')[0] : 'Fin'}</span> <ChevronRight size={16} />
            </button>
          </div>

          <div className="bg-white border border-gray-400 p-2.5 rounded-[8px] flex items-center shadow-[var(--shadow-subtle)] w-full transition-shadow focus-within:ring-2 focus-within:ring-indigo-500/50">
            <Search size={18} className="text-[#8e8e93] mr-2 shrink-0" />
            <input
              type="text"
              className="w-full bg-transparent outline-none text-sm font-bold min-w-0"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Buscar plan mediante nombre del alumno..."
            />
            {searchTerm && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearchTerm('');
                  setShowSuggestions(true);
                }}
                className="text-[#8e8e93] hover:text-[#222222] ml-2"
                title="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {showSuggestions && (
            <div className="absolute top-[105%] left-0 w-full bg-white border border-gray-400 rounded-[8px] max-h-60 overflow-y-auto shadow-[var(--shadow-brand)] z-50">
              {filteredPlans.length > 0 ? (
                filteredPlans.slice(0, 10).map(p => (
                  <div
                    key={p.id}
                    className="p-3 hover:bg-indigo-50 cursor-pointer text-sm border-b border-[#f2f3f5] last:border-none font-medium text-[#45515e] transition-colors"
                    onClick={() => handleSuggestionClick(p)}
                  >
                    {getAlumnoName(p)}
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-[#8e8e93] text-center">No hay coincidencias</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Navegación Flotante Desktop --- */}
      <div className="hidden xl:block fixed top-1/2 left-4 w-16 h-16 xl:left-8 -translate-y-1/2 z-40 print:hidden">
        <button
          onClick={() => prevPlan && jumpToPlan(prevPlan)}
          disabled={!prevPlan}
          title={prevPlan ? `Anterior: ${getAlumnoName(prevPlan)}` : 'Primer plan'}
          className="w-full h-full flex items-center justify-center rounded-full bg-white/50 dark:bg-gray-800/80 shadow-[var(--shadow-brand)] shadow-black/10 border-2 border-transparent hover:border-indigo-100 text-[#45515e] dark:text-gray-300 hover:bg-white dark:hover:bg-indigo-900/40 hover:text-[#1456f0] dark:hover:text-indigo-400 disabled:opacity-0 disabled:pointer-events-none transition-all duration-300 backdrop-blur-md group"
        >
          <ChevronLeft size={36} className="group-hover:-translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="hidden xl:block fixed top-1/2 right-4 w-16 h-16 xl:right-8 -translate-y-1/2 z-40 print:hidden">
        <button
          onClick={() => nextPlan && jumpToPlan(nextPlan)}
          disabled={!nextPlan}
          title={nextPlan ? `Siguiente: ${getAlumnoName(nextPlan)}` : 'Último plan'}
          className="w-full h-full flex items-center justify-center rounded-full bg-white/50 dark:bg-gray-800/80 shadow-[var(--shadow-brand)] shadow-black/10 border-2 border-transparent hover:border-indigo-100 text-[#45515e] dark:text-gray-300 hover:bg-white dark:hover:bg-indigo-900/40 hover:text-[#1456f0] dark:hover:text-indigo-400 disabled:opacity-0 disabled:pointer-events-none transition-all duration-300 backdrop-blur-md group"
        >
          <ChevronRight size={36} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="w-full max-w-[816px] overflow-x-auto mx-auto pb-4 custom-scrollbar relative z-10">
        <div
          ref={printRef}
          className="bg-white text-black shadow-none sm:shadow-xl sm:rounded-[8px] w-full min-w-[650px] mx-auto p-4 md:p-8 relative print:shadow-none print:border-none print:p-0 print:min-w-0"
        >

        {studentAllPlans.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6 border-b border-[#e5e7eb] w-full overflow-x-auto print:hidden">
            {studentAllPlans.map(plan => (
              <button 
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${
                  plan.id === selectedPlan.id 
                    ? 'border-indigo-600 text-[#1456f0] bg-indigo-50/50' 
                    : 'border-transparent text-[#8e8e93] hover:text-[#45515e] hover:border-gray-300 hover:bg-[#f2f3f5]'
                }`}
              >
                Plan {plan.tipo_plan || 'Cuatrimestral'}
              </button>
            ))}
          </div>
        )}

        <h1 className="text-2xl font-bold text-center mb-6 tracking-wide">
          CALENDARIOS DE PAGOS CICLO {selectedPlan.ciclo_escolar}
        </h1>

        <div className="w-full md:w-1/2 mb-8">
          <table className="w-full border-collapse border border-black bg-white">
            <tbody>
              <tr>
                <td className="border border-black p-1 text-sm font-bold bg-gray-300 w-1/3 text-center">FECHA/NO.PLAN:</td>
                <td className="border border-black p-1 text-sm text-center w-1/3">{formatDate(selectedPlan.fecha_plan)}</td>
                <td className="border border-black p-1 text-sm text-center w-1/3">{selectedPlan.no_plan_pagos}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 text-sm font-bold bg-gray-300 text-center">BECA:</td>
                <td className="border border-black p-1 text-sm text-center">{selectedPlan.beca_porcentaje}</td>
                <td className="border border-black p-1 text-sm text-center">{selectedPlan.beca_tipo}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-lg font-bold text-center mb-2 uppercase">PLAN {planType}</h2>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-grow">
            <table className="w-full border-collapse border border-black bg-white">
              <thead>
                <tr>
                  <Th className="w-1/4">NUMERO DE PAGOS</Th>
                  <Th className="w-1/4">FECHA</Th>
                  <Th className="w-1/4">CANTIDAD</Th>
                  <Th className="w-1/4">ESTATUS DEL PAGO<br />(NO. DE RECIBO)</Th>
                </tr>
              </thead>
              <tbody>
                {paymentIndices.map(i => renderPaymentRow(i))}
                <tr key="filler-1">
                  <Td className="bg-gray-100"><div className="h-6 w-full bg-gray-200 rounded-full"></div></Td>
                  <Td></Td><Td></Td><Td></Td>
                </tr>
                <tr key="filler-2">
                  <Td className="bg-gray-100"><div className="h-6 w-full bg-gray-200 rounded-full"></div></Td>
                  <Td></Td><Td></Td><Td></Td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 border border-black bg-white p-2 text-[10px] leading-tight text-justify">
              ESTE PLAN CUENTA CON 5 DÍAS NATURALES POSTERIORES A LA FECHA DE VENCIMIENTO DE CADA PAGO PARA REALIZAR ESTE, DE LO CONTRARIO, A PARTIR DEL DÍA 6 AUMENTARÁ UN 10% POR MORA (EN CASO DE CONTAR CON BECA, EL RECARGO SE APLICA SOBRE EL MONTO SIN ELLA). EN CASO DE ESTAR BECADO TAMBIÉN SE PERDERÁ EL PORCENTAJE DE BECA ASIGNADO, POR FALTA AL REGLAMENTO INTERNO INSTITUCIONAL, DONDE INDICA QUE UNO DE LOS REQUISITOS PARA CONSERVAR UNA BECA ES ESTAR AL CORRIENTE EN PAGOS.
            </div>

            <div className="mt-6">
              <table className="w-full border-collapse border border-black bg-white">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 text-sm font-bold bg-gray-300 w-1/3 text-center">PLAN SELECCIONADO</td>
                    <td className="border border-black p-2 text-sm text-center w-2/3 uppercase">PLAN {planType}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 text-sm font-bold bg-gray-300 text-center">LICENCIATURA:</td>
                    <td className="border border-black p-2 text-sm text-center">{toTitleCase(studentData.licenciatura)}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 text-sm font-bold bg-gray-300 text-center">GRADO Y TURNO:</td>
                    <td className="border border-black p-2 text-sm text-center">{studentData.grado_turno}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 text-sm font-bold bg-gray-300 text-center">NOMBRE COMPLETO Y<br />FIRMA:</td>
                    <td className="border border-black p-2 text-sm text-center">
                      <select
                        className="w-full bg-transparent outline-none text-center text-blue-600 font-semibold appearance-none cursor-pointer print:text-black"
                        value={selectedPlanId}
                        onChange={handleStudentChange}
                      >
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{getAlumnoName(p)}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[13px] shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[#f2f3f5]">
              <div>
                <h3 className="text-base font-bold text-[#222222]">
                  Estatus de Pago
                </h3>
                <p className="text-xs text-[#8e8e93] mt-0.5">
                  {selectedPlan[`concepto_${selectedPaymentIndex}` as keyof PaymentPlan] as string} · {toTitleCase(selectedPlan.nombre_alumno)}
                </p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-[#8e8e93] hover:text-[#45515e]">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#e5e7eb]">
              <button
                onClick={() => setPaymentModalTab('manual')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  paymentModalTab === 'manual'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-[#8e8e93] hover:text-[#45515e]'
                }`}
              >
                <Edit size={15} /> Manual
              </button>
              <button
                onClick={() => { setPaymentModalTab('vincular'); if (candidateDetalles.length === 0) loadCandidateRecibos(); }}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  paymentModalTab === 'vincular'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-[#8e8e93] hover:text-[#45515e]'
                }`}
              >
                <Link2 size={15} /> Vincular Recibo
              </button>
            </div>

            {/* Tab: Manual */}
            {paymentModalTab === 'manual' && (
              <div className="p-6">
                <label className="block text-sm font-medium text-[#45515e] mb-2">
                  Número de Recibo / Estatus
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-[8px] p-3 outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-blue-500"
                  placeholder="Ej. R-123 (Pagado)"
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-[#8e8e93] mt-2">
                  Deja en blanco para marcar como pendiente. Puedes escribir cualquier texto libre.
                </p>
              </div>
            )}

            {/* Tab: Vincular */}
            {paymentModalTab === 'vincular' && (
              <div className="p-4">
                {loadingRecibos ? (
                  <div className="flex items-center justify-center py-8 text-[#8e8e93] gap-2">
                    <Loader2 size={20} className="animate-spin" /> Buscando recibos...
                  </div>
                ) : candidateDetalles.length === 0 ? (
                  <div className="text-center py-8 text-[#8e8e93]">
                    <FileText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No hay detalles de recibos sueltos para este alumno.</p>
                    <p className="text-xs mt-1 text-[#8e8e93]">Sólo aparecen conceptos que no se hayan vinculado previamente.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {candidateDetalles.map(d => (
                      <label
                        key={d.id}
                        className={`flex items-center gap-3 p-3 rounded-[8px] border cursor-pointer transition-all ${
                          selectedDetalleId === d.id
                            ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400'
                            : 'border-[#e5e7eb] hover:border-gray-300 hover:bg-[#f2f3f5]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="recibo-vincular"
                          className="accent-emerald-600 w-4 h-4 shrink-0"
                          checked={selectedDetalleId === d.id}
                          onChange={() => setSelectedDetalleId(d.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-emerald-700">R-{d._recibo?.folio ?? '—'}: {d.concepto}</span>
                            <span className="text-xs text-[#8e8e93]">{d._recibo?.fecha_pago}</span>
                            <span className="text-xs font-semibold text-[#45515e] ml-auto">${Number(d.subtotal || 0).toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-[#8e8e93] truncate">{d._recibo?.forma_pago} · {d._recibo?.banco}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {selectedDetalleId && (
                  <p className="text-xs text-emerald-600 mt-3 font-semibold">
                    ✓ Se vinculará el abono de ${Number(candidateDetalles.find(d => d.id === selectedDetalleId)?.subtotal || 0).toFixed(2)} a este concepto.
                  </p>
                )}
              </div>
            )}

            <div className="p-5 bg-[#f2f3f5] border-t border-[#f2f3f5] flex justify-between items-center gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 text-[#45515e] hover:bg-gray-200 rounded-[8px] font-medium transition-colors"
              >
                Cancelar
              </button>
              <div className="flex items-center gap-2">
                {!paymentInput && paymentModalTab === 'manual' && (
                  <span className="text-xs text-amber-600">Se guardará como PENDIENTE</span>
                )}
                <button
                  onClick={handleSavePayment}
                  disabled={paymentModalTab === 'vincular' && !selectedDetalleId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[8px] font-medium transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save size={16} /> Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {isEditPlanModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[13px] shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-[#f2f3f5]">
              <h3 className="text-lg font-bold text-[#222222]">
                Editar Estructura del Plan - {toTitleCase(selectedPlan.nombre_alumno)}
              </h3>
              <button onClick={() => setIsEditPlanModalOpen(false)} className="text-[#8e8e93] hover:text-[#45515e]">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-[#45515e] mb-1">Tipo de Plan</label>
                  <select
                    className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                    value={editForm.tipo_plan || 'Cuatrimestral'}
                    onChange={(e) => setEditForm({ ...editForm, tipo_plan: e.target.value as any })}
                  >
                    <option value="Cuatrimestral">Cuatrimestral (Hasta 7 pagos)</option>
                    <option value="Semestral">Semestral (Hasta 9 pagos)</option>
                    <option value="Titulación">Titulación (Hasta 15 pagos)</option>
                    <option value="Especialidad Completa">Especialidad Completa (Hasta 15 pagos)</option>
                    <option value="Especialidad Cuatrimestral">Especialidad Cuatrimestral (Hasta 15 pagos)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#45515e] mb-1">Programa / Licenciatura</label>
                  {catalogos?.licenciaturas?.length ? (
                    <select
                      className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                      value={editForm.licenciatura || ''}
                      onChange={(e) => setEditForm({ ...editForm, licenciatura: e.target.value })}
                    >
                      <option value="">-- Seleccione --</option>
                      {catalogos.licenciaturas.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                      value={editForm.licenciatura || ''}
                      placeholder="Ej. Especialidad en Cirugía..."
                      onChange={(e) => setEditForm({ ...editForm, licenciatura: e.target.value })}
                    />
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#45515e] mb-1">Grado y Turno</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                    value={editForm.grado_turno || ''}
                    placeholder="Ej. 6to Cuatrimestre / Sabatino"
                    onChange={(e) => setEditForm({ ...editForm, grado_turno: e.target.value })}
                  />
                  <p className="text-[10px] text-[#8e8e93] leading-tight mt-1">Si lo borras/dejas en blanco, el plan se sincronizará automáticamente para mostrar el grado y turno que tenga el alumno actualmente en su perfil principal.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#45515e] mb-1">Fecha del Plan</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6]"
                    value={toInputDate(editForm.fecha_plan)}
                    onChange={(e) => setEditForm({ ...editForm, fecha_plan: e.target.value })}
                  />
                </div>
                {editForm.tipo_plan !== 'Titulación' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#45515e] mb-1">Porcentaje de Beca</label>
                      {catalogos?.beca_porcentajes?.length ? (
                        <select
                          className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                          value={editForm.beca_porcentaje || ''}
                          onChange={(e) => setEditForm({ ...editForm, beca_porcentaje: e.target.value })}
                        >
                          {catalogos.beca_porcentajes.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <input type="text" className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6]"
                          value={editForm.beca_porcentaje || ''}
                          onChange={(e) => setEditForm({ ...editForm, beca_porcentaje: e.target.value })} />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#45515e] mb-1">Tipo de Beca</label>
                      {catalogos?.beca_tipos?.length ? (
                        <select
                          className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                          value={editForm.beca_tipo || ''}
                          onChange={(e) => setEditForm({ ...editForm, beca_tipo: e.target.value })}
                        >
                          {catalogos.beca_tipos.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <input type="text" className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6]"
                          value={editForm.beca_tipo || ''}
                          onChange={(e) => setEditForm({ ...editForm, beca_tipo: e.target.value })} />
                      )}
                    </div>
                  </>
                )}
              </div>

              {editForm.tipo_plan === 'Especialidad Completa' && (
                <EspecialidadDesgloseTable form={editForm} setForm={setEditForm as any} />
              )}

              <h4 className="font-bold text-[#222222] mb-4 border-b pb-2">Pagos Programados</h4>

              <div className="space-y-4">
                {Array.from({ length: editForm.tipo_plan === 'Titulación' || editForm.tipo_plan?.includes('Especialidad') ? 15 : editForm.tipo_plan === 'Semestral' ? 9 : 7 }, (_, i) => i + 1).map(i => {
                  return (
                    <div key={i} className="flex gap-4 items-end bg-[#f2f3f5] p-4 rounded-[8px] border border-[#f2f3f5]">
                      <div className="w-12 text-center font-bold text-[#8e8e93] pt-2">#{i}</div>
                      <div className="flex-grow">
                        <label className="block text-xs font-medium text-[#8e8e93] mb-1">Concepto</label>
                        <select
                          className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                          value={editForm[`concepto_${i}` as keyof PaymentPlan] as string || ''}
                          onChange={(e) => setEditForm({ ...editForm, [`concepto_${i}`]: e.target.value })}
                        >
                          <option value="">-- Seleccionar Concepto --</option>
                          {CONCEPTOS_CATALOGO.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-1/4">
                        <label className="block text-xs font-medium text-[#8e8e93] mb-1">Fecha Límite</label>
                        <input
                          type="date"
                          className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-[#3b82f6]"
                          value={toInputDate(editForm[`fecha_${i}` as keyof PaymentPlan] as string)}
                          onChange={(e) => setEditForm({ ...editForm, [`fecha_${i}`]: e.target.value })}
                        />
                      </div>
                      <div className="w-1/4">
                        <label className="block text-xs font-medium text-[#8e8e93] mb-1">Cantidad ($)</label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-[#3b82f6]"
                          value={editForm[`cantidad_${i}` as keyof PaymentPlan] as number || ''}
                          onChange={(e) => setEditForm({ ...editForm, [`cantidad_${i}`]: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 bg-[#f2f3f5] border-t border-[#f2f3f5] flex justify-between items-center gap-3">
              {currentUser?.rol === 'ADMINISTRADOR' ? (
                <button
                  onClick={() => setDeleteConfirmPlanId(editForm.id!)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-[8px] font-semibold transition-colors border border-transparent hover:border-red-200 text-sm"
                >
                  Eliminar Plan
                </button>
              ) : (
                <div></div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditPlanModalOpen(false)}
                  className="px-4 py-2 text-[#45515e] hover:bg-gray-200 rounded-[8px] font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePlanStructure}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[8px] font-medium transition-colors flex items-center gap-2"
                >
                  <Save size={18} /> Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Plan Confirmation Modal */}
      {deleteConfirmPlanId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[20px] shadow-[var(--shadow-brand)] w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Eliminar Plan de Pagos</h3>
              <p className="text-sm text-[#45515e] mb-6 font-medium">
                ¿Estás seguro de que deseas eliminar permanentemente este plan de pagos? Toda la información y recibos vinculados perderán la referencia principal. <span className="font-bold text-[#222222]">Esta acción no se puede deshacer.</span>
              </p>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeleteConfirmPlanId(null)}
                  className="flex-1 px-4 py-2.5 text-[#45515e] bg-gray-100 hover:bg-gray-200 hover:text-gray-900 rounded-[13px] font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    try {
                      await supabase.from('planes_pago').delete().eq('id', deleteConfirmPlanId);
                      if (onDeletePlan) {
                        onDeletePlan(deleteConfirmPlanId);
                      }
                      
                      // Seleccionar el otro plan del alumno o el primer plan general
                      const otherPlan = plans.find(p => p.alumno_id === editForm.alumno_id && p.id !== deleteConfirmPlanId);
                      if (otherPlan) {
                        setSelectedPlanId(otherPlan.id);
                      } else {
                        const fallbackPlan = plans.find(p => p.id !== deleteConfirmPlanId);
                        setSelectedPlanId(fallbackPlan ? fallbackPlan.id : '');
                      }
                      
                      setIsEditPlanModalOpen(false);
                      setDeleteConfirmPlanId(null);
                      showAlert('¡Eliminado!', 'El plan de pagos ha sido eliminado exitosamente del sistema.');
                    } catch (error) {
                      console.error('Error al eliminar:', error);
                      setDeleteConfirmPlanId(null);
                      showAlert('Error', 'Hubo un error al intentar eliminar el plan. Por favor, intenta de nuevo.');
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-[13px] font-semibold shadow-lg shadow-red-500/30 transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  Sí, eliminar plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Plan Modal */}
      {isNewPlanModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[13px] shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-[#f2f3f5]">
              <h3 className="text-lg font-bold text-[#222222]">
                Crear Nuevo Plan de Pagos
              </h3>
              <button onClick={() => setIsNewPlanModalOpen(false)} className="text-[#8e8e93] hover:text-[#45515e]">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow space-y-4">
              <div className="relative" ref={newPlanAlumnoRef}>
                <label className="block text-sm font-medium text-[#45515e] mb-1">Alumno</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93]" size={16} />
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-[8px] pl-10 pr-10 py-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white text-sm font-semibold"
                    placeholder="Buscar alumno para nuevo plan..."
                    value={newPlanSearchTerm}
                    onChange={(e) => {
                      setNewPlanSearchTerm(e.target.value);
                      setShowNewAlumnoSuggestions(true);
                      setNewPlanForm(prev => ({ ...prev, alumno_id: '' }));
                    }}
                    onFocus={() => setShowNewAlumnoSuggestions(true)}
                  />
                  {newPlanSearchTerm && (
                    <button
                      onClick={() => { setNewPlanSearchTerm(''); setShowNewAlumnoSuggestions(true); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-[#45515e]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {showNewAlumnoSuggestions && newPlanSearchTerm && (
                  <div className="absolute top-full left-0 w-full bg-white border border-[#e5e7eb] rounded-[8px] shadow-xl mt-1 z-[60] max-h-60 overflow-y-auto">
                    {filteredNewAlumnoSuggestions.length > 0 ? (
                      filteredNewAlumnoSuggestions.map(alumno => (
                        <button
                          key={alumno.id}
                          className="w-full text-left px-4 py-3 hover:bg-[rgba(0,0,0,0.03)] border-b border-gray-50 last:border-none transition-colors"
                          onClick={() => {
                            setNewPlanForm({
                              ...newPlanForm,
                              alumno_id: alumno.id,
                              nombre_alumno: alumno.nombre_completo,
                              licenciatura: alumno.licenciatura,
                              grado_turno: `${alumno.grado_actual} / ${alumno.turno}`
                            });
                            setNewPlanSearchTerm(alumno.nombre_completo);
                            setShowNewAlumnoSuggestions(false);
                          }}
                        >
                          <p className="font-bold text-[#222222] text-sm">{toTitleCase(alumno.nombre_completo)}</p>
                          <p className="text-xs text-[#8e8e93]">{toTitleCase(alumno.licenciatura)} · {alumno.grado_actual}º {alumno.turno}</p>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-[#8e8e93]">
                        No se encontraron alumnos disponibles
                      </div>
                    )}
                  </div>
                )}
                {availableAlumnos.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Todos los alumnos registrados ya tienen un plan en este ciclo.</p>
                )}
              </div>

              {plantillas.filter(p => p.activo).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[#45515e] mb-1">Usar Plantilla de Plan</label>
                  <select
                    className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                    value={selectedTemplateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">-- Sin Plantilla (Manual) --</option>
                    {plantillas.filter(p => p.activo && (!p.ciclo_id || p.ciclo_id === activeCiclo?.id)).map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-[#45515e] mb-1">Tipo de Plan</label>
                  <select
                    className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                    value={newPlanForm.tipo_plan || 'Cuatrimestral'}
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, tipo_plan: e.target.value as any })}
                  >
                    <option value="Cuatrimestral">Cuatrimestral (Hasta 7 pagos)</option>
                    <option value="Semestral">Semestral (Hasta 9 pagos)</option>
                    <option value="Titulación">Titulación (Hasta 15 pagos)</option>
                    <option value="Especialidad Completa">Especialidad Completa (Hasta 15 pagos)</option>
                    <option value="Especialidad Cuatrimestral">Especialidad Cuatrimestral (Hasta 15 pagos)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#45515e] mb-1">Programa / Licenciatura</label>
                  {catalogos?.licenciaturas?.length ? (
                    <select
                      className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                      value={newPlanForm.licenciatura || ''}
                      onChange={(e) => setNewPlanForm({ ...newPlanForm, licenciatura: e.target.value })}
                    >
                      <option value="">-- Seleccione --</option>
                      {catalogos.licenciaturas.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                      value={newPlanForm.licenciatura || ''}
                      placeholder="Ej. Especialidad en Cirugía..."
                      onChange={(e) => setNewPlanForm({ ...newPlanForm, licenciatura: e.target.value })}
                    />
                  )}
                </div>
              </div>

                {newPlanForm.tipo_plan !== 'Titulación' && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-[#45515e] mb-1">Porcentaje de Beca</label>
                      {catalogos?.beca_porcentajes?.length ? (
                        <select
                          className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                          value={newPlanForm.beca_porcentaje || '0%'}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_porcentaje: e.target.value })}
                        >
                          {catalogos.beca_porcentajes.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <input type="text" className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6]"
                          value={newPlanForm.beca_porcentaje || ''} placeholder="Ej. 0%"
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_porcentaje: e.target.value })} />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#45515e] mb-1">Tipo de Beca</label>
                      {catalogos?.beca_tipos?.length ? (
                        <select
                          className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6] bg-white"
                          value={newPlanForm.beca_tipo || 'NINGUNA'}
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_tipo: e.target.value })}
                        >
                          {catalogos.beca_tipos.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <input type="text" className="w-full border border-gray-300 rounded-[8px] p-2 outline-none focus:ring-2 focus:ring-[#3b82f6]"
                          value={newPlanForm.beca_tipo || ''} placeholder="Ej. NINGUNA"
                          onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_tipo: e.target.value })} />
                      )}
                    </div>
                  </div>
                )}
                
                {newPlanForm.tipo_plan === 'Especialidad Completa' && (
                  <EspecialidadDesgloseTable form={newPlanForm} setForm={setNewPlanForm as any} isEditing={false} />
                )}
            </div>

            <div className="p-6 bg-[#f2f3f5] border-t border-[#f2f3f5] flex justify-end gap-3">
              <button
                onClick={() => setIsNewPlanModalOpen(false)}
                className="px-4 py-2 text-[#45515e] hover:bg-gray-200 rounded-[8px] font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!newPlanForm.alumno_id) {
                    showAlert('Error', 'Por favor selecciona un alumno');
                    return;
                  }
                  const newPlan: PaymentPlan = {
                    id: crypto.randomUUID(),
                    alumno_id: newPlanForm.alumno_id,
                    ciclo_id: activeCiclo?.id,
                    nombre_alumno: newPlanForm.nombre_alumno || '',
                    no_plan_pagos: generateFolioForPlan(newPlanForm.alumno_id, newPlanForm.tipo_plan || 'Cuatrimestral', activeCiclo?.nombre || '', plans),
                    fecha_plan: new Date().toLocaleDateString('es-MX'),
                    beca_porcentaje: newPlanForm.beca_porcentaje || '0%',
                    beca_tipo: newPlanForm.beca_tipo || 'NINGUNA',
                    ciclo_escolar: activeCiclo?.nombre || '',
                    tipo_plan: newPlanForm.tipo_plan || 'Cuatrimestral',
                    licenciatura: newPlanForm.licenciatura || '',
                    grado_turno: newPlanForm.grado_turno || '',
                    concepto_1: newPlanForm.concepto_1, fecha_1: newPlanForm.fecha_1, cantidad_1: newPlanForm.cantidad_1,
                    concepto_2: newPlanForm.concepto_2, fecha_2: newPlanForm.fecha_2, cantidad_2: newPlanForm.cantidad_2,
                    concepto_3: newPlanForm.concepto_3, fecha_3: newPlanForm.fecha_3, cantidad_3: newPlanForm.cantidad_3,
                    concepto_4: newPlanForm.concepto_4, fecha_4: newPlanForm.fecha_4, cantidad_4: newPlanForm.cantidad_4,
                    concepto_5: newPlanForm.concepto_5, fecha_5: newPlanForm.fecha_5, cantidad_5: newPlanForm.cantidad_5,
                    concepto_6: newPlanForm.concepto_6, fecha_6: newPlanForm.fecha_6, cantidad_6: newPlanForm.cantidad_6,
                    concepto_7: newPlanForm.concepto_7, fecha_7: newPlanForm.fecha_7, cantidad_7: newPlanForm.cantidad_7,
                    concepto_8: newPlanForm.concepto_8, fecha_8: newPlanForm.fecha_8, cantidad_8: newPlanForm.cantidad_8,
                    concepto_9: newPlanForm.concepto_9, fecha_9: newPlanForm.fecha_9, cantidad_9: newPlanForm.cantidad_9,
                    concepto_10: newPlanForm.concepto_10, fecha_10: newPlanForm.fecha_10, cantidad_10: newPlanForm.cantidad_10,
                    concepto_11: newPlanForm.concepto_11, fecha_11: newPlanForm.fecha_11, cantidad_11: newPlanForm.cantidad_11,
                    concepto_12: newPlanForm.concepto_12, fecha_12: newPlanForm.fecha_12, cantidad_12: newPlanForm.cantidad_12,
                    concepto_13: newPlanForm.concepto_13, fecha_13: newPlanForm.fecha_13, cantidad_13: newPlanForm.cantidad_13,
                    concepto_14: newPlanForm.concepto_14, fecha_14: newPlanForm.fecha_14, cantidad_14: newPlanForm.cantidad_14,
                    concepto_15: newPlanForm.concepto_15, fecha_15: newPlanForm.fecha_15, cantidad_15: newPlanForm.cantidad_15,
                  };
                  onSavePlan(newPlan);
                  setPostCreatePrompt(newPlan);
                  setIsNewPlanModalOpen(false);
                  setNewPlanSearchTerm('');
                  setNewPlanForm({
                    tipo_plan: 'Cuatrimestral',
                    beca_porcentaje: '0%',
                    beca_tipo: 'NINGUNA',
                    fecha_plan: new Date().toLocaleDateString('es-MX')
                  });
                  setSelectedTemplateId('');
                }}
                disabled={!newPlanForm.alumno_id}
                className="px-6 py-2 bg-[#1456f0] hover:bg-[#1d4ed8] text-white rounded-[8px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} /> Crear Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[13px] shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6">
              <h3 className="text-lg font-bold text-[#222222] mb-2">{modalState.title}</h3>
              <p className="text-[#45515e]">{modalState.message}</p>
            </div>
            <div className="p-4 bg-[#f2f3f5] border-t border-[#f2f3f5] flex justify-end">
              <button
                onClick={() => setModalState({ ...modalState, isOpen: false })}
                className="px-6 py-2 bg-[#1456f0] hover:bg-[#1d4ed8] text-white rounded-[8px] font-medium transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Create Prompt Modal */}
      {postCreatePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[13px] shadow-[var(--shadow-brand)] w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <Save className="text-emerald-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#222222] mb-2">¡Plan Creado Exitosamente!</h3>
              <p className="text-[#45515e] mb-4">
                La carátula del plan ha sido guardada. Sin embargo, antes de imprimirlo o cobrarlo, es <b>altamente recomendable configurar las fechas de vencimiento y montos</b> de los pagos programados.
              </p>
            </div>
            <div className="p-4 bg-[#f2f3f5] border-t border-[#f2f3f5] flex gap-3 justify-end">
              <button
                onClick={() => {
                  setSelectedPlanId(postCreatePrompt.id);
                  setPostCreatePrompt(null);
                }}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-[#45515e] rounded-[8px] font-medium transition-colors"
              >
                Hacerlo Más Tarde
              </button>
              <button
                onClick={() => {
                  setSelectedPlanId(postCreatePrompt.id);
                  setEditForm({ ...postCreatePrompt });
                  setIsEditPlanModalOpen(true);
                  setPostCreatePrompt(null);
                }}
                className="px-4 py-2 bg-[#1456f0] hover:bg-[#1d4ed8] text-white rounded-[8px] font-medium transition-colors border border-transparent shadow-[var(--shadow-subtle)]"
              >
                Editar Plan Ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- HIDDEN COTIZACIÓN PARA IMPRESIÓN PDF --- */}
      <div className="fixed top-[-10000px] left-[-10000px]">
        <div ref={cotizacionRef} className="bg-white text-black w-[816px] min-h-[1056px] p-12 relative flex flex-col">
          <div className="text-center mb-10 border-b-2 border-indigo-900 pb-6">
            <h1 className="text-3xl font-black tracking-widest text-indigo-900 mb-2">COTIZACIÓN DE SERVICIOS</h1>
            <h2 className="text-xl font-semibold text-[#45515e]">{selectedPlan?.licenciatura || selectedPlan?.tipo_plan}</h2>
            <p className="text-[#8e8e93] mt-2 uppercase">Alumno: <span className="font-bold text-[#222222]">{toTitleCase(selectedPlan?.nombre_alumno)}</span></p>
          </div>

          <table className="w-full text-left border-collapse mb-10">
            <thead>
              <tr className="bg-indigo-900 text-white text-sm uppercase tracking-wider">
                <th className="p-3 border border-indigo-900">Cant.</th>
                <th className="p-3 border border-indigo-900">Concepto</th>
                <th className="p-3 border border-indigo-900 text-right">Unitario</th>
                <th className="p-3 border border-indigo-900 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="text-[#222222] bg-white">
              {(Array.isArray(selectedPlan?.desglose_conceptos) ? selectedPlan.desglose_conceptos : 
                 (typeof selectedPlan?.desglose_conceptos === 'string' && selectedPlan.desglose_conceptos.trim().startsWith('[') 
                 ? JSON.parse(selectedPlan.desglose_conceptos) : [])
              ).map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-[#e5e7eb]">
                  <td className="p-3 font-medium text-center">{item?.cantidad || 0}</td>
                  <td className="p-3">{item?.concepto || ''}</td>
                  <td className="p-3 text-right">${Number(item?.costo_unitario || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                  <td className="p-3 text-right font-bold">${Number(item?.costo_total || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end flex-grow">
            <div className="w-1/2 bg-[#f2f3f5] p-6 rounded-[8px] border border-[#e5e7eb] h-fit">
              <div className="flex justify-between mb-3 border-b border-[#e5e7eb] pb-2">
                <span className="font-semibold text-[#45515e]">Subtotal Bruto:</span>
                <span className="font-bold">${Number(selectedPlan?.desglose_total_bruto || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between mb-3 border-b border-[#e5e7eb] pb-2 text-[#1456f0]">
                <span className="font-semibold">Descuento ({selectedPlan?.desglose_descuento_porcentaje || 0}%):</span>
                <span className="font-bold">-${Number(selectedPlan?.desglose_descuento_monto || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between text-xl text-indigo-900">
                <span className="font-black">TOTAL NETO:</span>
                <span className="font-black">${Number(selectedPlan?.desglose_total_neto || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center text-[#8e8e93] text-xs border-t border-[#f2f3f5] pt-4 pb-4 w-full">
             Documento anexo generado automáticamente mediante el Sistema de Pagos Universitario - {new Date().toLocaleDateString('es-MX')}
          </div>
        </div>
      </div>

    </div>
  );
}
