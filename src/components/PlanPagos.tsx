import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowLeft, Inbox, Edit, DollarSign, Save, Printer, Search, Loader2, Plus, Link2, FileText } from 'lucide-react';
import { PaymentPlan, Alumno, CicloEscolar, Catalogos, PlantillaPlan, Usuario, Recibo } from '../types';
import { isPaid } from '../utils';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

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
  onGoToPagos?: (alumnoId: string, conceptoIdx: number) => void;
  onViewReceipt?: (folio: string) => void;
}

export default function PlanPagos({ currentUser, plans, alumnos = [], activeCiclo, catalogos, plantillas = [], initialAlumnoId, onBack, onSavePlan, onGoToPagos, onViewReceipt }: PlanPagosProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    (initialAlumnoId && plans.find(p => p.alumno_id === initialAlumnoId)?.id) || plans[0]?.id || ''
  );
  const [searchTerm, setSearchTerm] = useState<string>(
    (initialAlumnoId && plans.find(p => p.alumno_id === initialAlumnoId)?.nombre_alumno) || plans[0]?.nombre_alumno || ''
  );
  
  const isCoordinador = currentUser.rol === 'COORDINADOR';
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState<number>(1);
  const [paymentInput, setPaymentInput] = useState('');
  // Vincular recibo state
  const [paymentModalTab, setPaymentModalTab] = useState<'manual' | 'vincular'>('manual');
  const [candidateRecibos, setCandidateRecibos] = useState<Recibo[]>([]);
  const [loadingRecibos, setLoadingRecibos] = useState(false);
  const [selectedReciboId, setSelectedReciboId] = useState<string>('');

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

  const availableAlumnos = alumnos.filter(a => 
    !plans.some(p => p.alumno_id === a.id || p.nombre_alumno === a.nombre_completo)
  );

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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
      const margin = 10;
      const printWidth = pdfWidth - (margin * 2);
      const pdfHeight = (printRef.current.scrollHeight * printWidth) / 816;

      pdf.addImage(dataUrl, 'PNG', margin, margin, printWidth, pdfHeight);
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
        <div className="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-center max-w-md w-full">
          <div className="bg-blue-50 dark:bg-blue-900/40 text-blue-500 dark:text-blue-400 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Inbox size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">Sin Planes de Pago</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">No hay planes de pago registrados para este ciclo escolar. Por favor, selecciona otro ciclo o inscribe alumnos.</p>
          <div className="flex flex-col gap-3">
            {!isCoordinador && (
              <button
                onClick={() => setIsNewPlanModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 mx-auto w-full justify-center"
              >
                <Plus size={20} /> Crear Nuevo Plan
              </button>
            )}
            <button
              onClick={onBack}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 mx-auto w-full justify-center"
            >
              <ArrowLeft size={20} /> Volver al Inicio
            </button>
          </div>
        </div>

        {/* New Plan Modal (Empty State) */}
        {isNewPlanModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col text-left">
              <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  Crear Nuevo Plan de Pagos
                </h3>
                <button onClick={() => setIsNewPlanModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-grow space-y-4">
                <div className="relative" ref={newPlanAlumnoRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alumno</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-semibold"
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {showNewAlumnoSuggestions && newPlanSearchTerm && (
                    <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 z-[60] max-h-60 overflow-y-auto">
                      {filteredNewAlumnoSuggestions.length > 0 ? (
                        filteredNewAlumnoSuggestions.map(alumno => (
                          <button
                            key={alumno.id}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-none transition-colors"
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
                            <p className="font-bold text-gray-800 text-sm">{alumno.nombre_completo}</p>
                            <p className="text-xs text-gray-500">{alumno.licenciatura} · {alumno.grado_actual}º {alumno.turno}</p>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-gray-500">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usar Plantilla de Plan</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Plan</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={newPlanForm.tipo_plan || 'Cuatrimestral'}
                    onChange={(e) => setNewPlanForm({ ...newPlanForm, tipo_plan: e.target.value as 'Cuatrimestral' | 'Semestral' })}
                  >
                    <option value="Cuatrimestral">Cuatrimestral (Hasta 7 pagos)</option>
                    <option value="Semestral">Semestral (Hasta 9 pagos)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Beca</label>
                    {catalogos?.beca_porcentajes?.length ? (
                      <select
                        className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={newPlanForm.beca_porcentaje || '0%'}
                        onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_porcentaje: e.target.value })}
                      >
                        {catalogos.beca_porcentajes.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : (
                      <input type="text" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                        value={newPlanForm.beca_porcentaje || ''} placeholder="Ej. 0%"
                        onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_porcentaje: e.target.value })} />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Beca</label>
                    {catalogos?.beca_tipos?.length ? (
                      <select
                        className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={newPlanForm.beca_tipo || 'NINGUNA'}
                        onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_tipo: e.target.value })}
                      >
                        {catalogos.beca_tipos.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <input type="text" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                        value={newPlanForm.beca_tipo || ''} placeholder="Ej. NINGUNA"
                        onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_tipo: e.target.value })} />
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => { setIsNewPlanModalOpen(false); setNewPlanSearchTerm(''); }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
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
                      no_plan_pagos: `PP-${newPlanForm.alumno_id.slice(-4)}`,
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
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
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
    if (p.nombre_alumno) return p.nombre_alumno;
    const a = alumnos.find(al => al.id === p.alumno_id);
    return a ? a.nombre_completo : '';
  };

  const getAlumnoData = (p: PaymentPlan) => {
    const a = alumnos.find(al => al.id === p.alumno_id);
    return {
      licenciatura: p.licenciatura || (a ? a.licenciatura : ''),
      grado_turno: p.grado_turno || (a ? `${a.grado_actual} / ${a.turno}` : '')
    };
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
    setCandidateRecibos([]);
    setSelectedReciboId('');
    setIsPaymentModalOpen(true);
  };

  const loadCandidateRecibos = async () => {
    setLoadingRecibos(true);
    try {
      const alumnoId = selectedPlan.alumno_id || alumnos.find(a => a.nombre_completo === selectedPlan.nombre_alumno)?.id;
      if (!alumnoId) { setLoadingRecibos(false); return; }
      const { data } = await supabase
        .from('recibos')
        .select('*')
        .eq('alumno_id', alumnoId)
        .neq('estatus', 'CANCELADO')
        .order('folio', { ascending: false });
      setCandidateRecibos((data || []) as Recibo[]);
    } catch { /* silenciar */ }
    setLoadingRecibos(false);
  };

  const handleSavePayment = async () => {
    let statusToWrite = paymentInput;

    if (paymentModalTab === 'vincular' && selectedReciboId) {
      const recibo = candidateRecibos.find(r => r.id === selectedReciboId);
      if (recibo) {
        // Build a status string like the rest of the system: R-XXX (Pagado)
        const existing = (selectedPlan[`estatus_${selectedPaymentIndex}` as keyof PaymentPlan] as string) || '';
        const prevFolios = (existing.match(/R-\d+/g) || []);
        const folioPart = prevFolios.length > 0 ? prevFolios.join('; ') + '; ' : '';
        statusToWrite = `${folioPart}R-${recibo.folio} (Pagado $${recibo.total.toFixed(2)})`;

        // Also try to link in recibos_detalles for bidirectional traceability
        try {
          const { data: detalles } = await supabase
            .from('recibos_detalles')
            .select('id, indice_concepto_plan')
            .eq('recibo_id', recibo.id)
            .is('indice_concepto_plan', null)
            .limit(1);
          if (detalles && detalles.length > 0) {
            await supabase
              .from('recibos_detalles')
              .update({ indice_concepto_plan: selectedPaymentIndex })
              .eq('id', detalles[0].id);
          }
        } catch { /* si falla la vinculación de detalle, el estatus ya quedó escrito */ }
      }
    }

    const updatedPlan = { ...selectedPlan, [`estatus_${selectedPaymentIndex}`]: statusToWrite };
    onSavePlan(updatedPlan);
    setIsPaymentModalOpen(false);
  };

  const openEditPlanModal = () => {
    setEditForm({ ...selectedPlan });
    setIsEditPlanModalOpen(true);
  };

  const handleSavePlanStructure = () => {
    onSavePlan(editForm as PaymentPlan);
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
                        onClick={() => onViewReceipt?.(folioStr)}
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
                className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
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
                          onClick={() => onViewReceipt?.(folioStr)}
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
                  onClick={() => onGoToPagos?.(selectedPlan.alumno_id!, index)}
                  className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Generar recibo de ingresos"
                >
                  <DollarSign size={14} /> Cobrar
                </button>
                <button
                  onClick={() => openPaymentModal(index)}
                  className="bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 px-2 py-1 rounded transition-colors"
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
  const maxPayments = planType === 'Semestral' ? 9 : 7;
  const paymentIndices = Array.from({ length: maxPayments }, (_, i) => i + 1);

  return (
    <div className="w-full p-2 md:p-6 flex flex-col items-center justify-start font-sans print:p-0">
      
      {/* Top Action Bar - Hidden in Print (Movido afuera para responsividad) */}
      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 mb-6 w-full max-w-[816px] mx-auto print:hidden z-10">
        <div className="flex items-center justify-between w-full xl:w-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-700 hover:text-black font-bold transition-colors shrink-0"
          >
            <ArrowLeft size={20} /> <span className="hidden sm:inline">Volver</span>
          </button>
          
          <div className="flex xl:hidden items-center gap-2">
            {!isCoordinador && (
              <button onClick={() => setIsNewPlanModalOpen(true)} className="flex items-center justify-center p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
                <Plus size={20} />
              </button>
            )}
            <button onClick={openEditPlanModal} className="flex items-center justify-center p-2 bg-white text-gray-800 border border-gray-300 rounded-lg shadow-sm">
              <Edit size={20} />
            </button>
            <button onClick={handleGeneratePDF} disabled={isGeneratingPDF} className="flex items-center justify-center p-2 bg-red-600 text-white rounded-lg shadow-sm disabled:opacity-50">
              {isGeneratingPDF ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 w-full xl:max-w-md relative z-20">
          <div className="bg-white border border-gray-400 p-2.5 rounded-lg flex items-center shadow-sm w-full">
            <Search size={18} className="text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              className="w-full bg-transparent outline-none text-sm font-bold min-w-0"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Buscar alumno..."
            />
            {searchTerm && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearchTerm('');
                  setShowSuggestions(true);
                }}
                className="text-gray-500 hover:text-gray-800 ml-2"
                title="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {showSuggestions && (
            <div className="absolute top-[105%] left-0 w-full bg-white border border-gray-400 rounded-lg max-h-60 overflow-y-auto shadow-2xl z-50">
              {filteredPlans.length > 0 ? (
                filteredPlans.slice(0, 10).map(p => (
                  <div
                    key={p.id}
                    className="p-3 hover:bg-indigo-50 cursor-pointer text-sm border-b border-gray-100 last:border-none font-medium text-gray-700 transition-colors"
                    onClick={() => handleSuggestionClick(p)}
                  >
                    {getAlumnoName(p)}
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-gray-500 text-center">No hay coincidencias</div>
              )}
            </div>
          )}
        </div>

        <div className="hidden xl:flex items-center gap-3 shrink-0">
          {!isCoordinador && (
            <button
              onClick={() => setIsNewPlanModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              <Plus size={18} /> Nuevo Plan
            </button>
          )}
          <button
            onClick={openEditPlanModal}
            className="bg-white hover:bg-gray-50 text-gray-800 font-bold py-2 px-4 rounded shadow-sm border border-gray-300 transition-all flex items-center gap-2 text-sm"
          >
            <Edit size={16} /> Editar
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-all flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {isGeneratingPDF ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            {isGeneratingPDF ? 'Generando...' : 'PDF / Imprimir'}
          </button>
        </div>
      </div>

      <div className="w-full max-w-[816px] overflow-x-auto mx-auto pb-4 custom-scrollbar">
        <div
          ref={printRef}
          className="bg-white text-black shadow-none sm:shadow-xl sm:rounded-lg w-full min-w-[650px] mx-auto p-4 md:p-8 relative print:shadow-none print:border-none print:p-0 print:min-w-0"
        >

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
                <tr>
                  <Td className="bg-gray-100"><div className="h-6 w-full bg-gray-200 rounded-full"></div></Td>
                  <Td></Td><Td></Td><Td></Td>
                </tr>
                <tr>
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
                    <td className="border border-black p-2 text-sm text-center">{studentData.licenciatura}</td>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  Estatus de Pago
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedPlan[`concepto_${selectedPaymentIndex}` as keyof PaymentPlan] as string} · {selectedPlan.nombre_alumno}
                </p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setPaymentModalTab('manual')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  paymentModalTab === 'manual'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Edit size={15} /> Manual
              </button>
              <button
                onClick={() => { setPaymentModalTab('vincular'); if (candidateRecibos.length === 0) loadCandidateRecibos(); }}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  paymentModalTab === 'vincular'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Link2 size={15} /> Vincular Recibo
              </button>
            </div>

            {/* Tab: Manual */}
            {paymentModalTab === 'manual' && (
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Recibo / Estatus
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej. R-123 (Pagado)"
                  value={paymentInput}
                  onChange={(e) => setPaymentInput(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-2">
                  Deja en blanco para marcar como pendiente. Puedes escribir cualquier texto libre.
                </p>
              </div>
            )}

            {/* Tab: Vincular */}
            {paymentModalTab === 'vincular' && (
              <div className="p-4">
                {loadingRecibos ? (
                  <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                    <Loader2 size={20} className="animate-spin" /> Buscando recibos...
                  </div>
                ) : candidateRecibos.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No hay recibos registrados para este alumno.</p>
                    <p className="text-xs mt-1 text-gray-400">Genera un cobro primero desde el botón <strong>Cobrar</strong>.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {candidateRecibos.map(r => (
                      <label
                        key={r.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedReciboId === r.id
                            ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="recibo-vincular"
                          className="accent-emerald-600 w-4 h-4"
                          checked={selectedReciboId === r.id}
                          onChange={() => setSelectedReciboId(r.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-emerald-700">R-{r.folio ?? '—'}</span>
                            <span className="text-xs text-gray-500">{r.fecha_pago}</span>
                            <span className="text-xs font-semibold text-gray-700 ml-auto">${r.total.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">{r.forma_pago} · {r.banco}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {selectedReciboId && (
                  <p className="text-xs text-emerald-600 mt-3 font-semibold">
                    ✓ Se vinculará R-{candidateRecibos.find(r => r.id === selectedReciboId)?.folio} a este concepto.
                  </p>
                )}
              </div>
            )}

            <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <div className="flex items-center gap-2">
                {!paymentInput && paymentModalTab === 'manual' && (
                  <span className="text-xs text-amber-600">Se guardará como PENDIENTE</span>
                )}
                <button
                  onClick={handleSavePayment}
                  disabled={paymentModalTab === 'vincular' && !selectedReciboId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                Editar Estructura del Plan - {selectedPlan.nombre_alumno}
              </h3>
              <button onClick={() => setIsEditPlanModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow">
              <div className="grid grid-cols-4 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Plan</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={editForm.tipo_plan || 'Cuatrimestral'}
                    onChange={(e) => setEditForm({ ...editForm, tipo_plan: e.target.value as 'Cuatrimestral' | 'Semestral' })}
                  >
                    <option value="Cuatrimestral">Cuatrimestral (Hasta 7 pagos)</option>
                    <option value="Semestral">Semestral (Hasta 9 pagos)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del Plan</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                    value={toInputDate(editForm.fecha_plan)}
                    onChange={(e) => setEditForm({ ...editForm, fecha_plan: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Beca</label>
                  {catalogos?.beca_porcentajes?.length ? (
                    <select
                      className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={editForm.beca_porcentaje || ''}
                      onChange={(e) => setEditForm({ ...editForm, beca_porcentaje: e.target.value })}
                    >
                      {catalogos.beca_porcentajes.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                      value={editForm.beca_porcentaje || ''}
                      onChange={(e) => setEditForm({ ...editForm, beca_porcentaje: e.target.value })} />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Beca</label>
                  {catalogos?.beca_tipos?.length ? (
                    <select
                      className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={editForm.beca_tipo || ''}
                      onChange={(e) => setEditForm({ ...editForm, beca_tipo: e.target.value })}
                    >
                      {catalogos.beca_tipos.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                      value={editForm.beca_tipo || ''}
                      onChange={(e) => setEditForm({ ...editForm, beca_tipo: e.target.value })} />
                  )}
                </div>
              </div>

              <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Pagos Programados</h4>

              <div className="space-y-4">
                {Array.from({ length: editForm.tipo_plan === 'Semestral' ? 9 : 7 }, (_, i) => i + 1).map(i => {
                  return (
                    <div key={i} className="flex gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="w-12 text-center font-bold text-gray-400 pt-2">#{i}</div>
                      <div className="flex-grow">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Concepto</label>
                        <select
                          className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                        <label className="block text-xs font-medium text-gray-500 mb-1">Fecha Límite</label>
                        <input
                          type="date"
                          className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          value={toInputDate(editForm[`fecha_${i}` as keyof PaymentPlan] as string)}
                          onChange={(e) => setEditForm({ ...editForm, [`fecha_${i}`]: e.target.value })}
                        />
                      </div>
                      <div className="w-1/4">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad ($)</label>
                        <input
                          type="number"
                          className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm[`cantidad_${i}` as keyof PaymentPlan] as number || ''}
                          onChange={(e) => setEditForm({ ...editForm, [`cantidad_${i}`]: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setIsEditPlanModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePlanStructure}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save size={18} /> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Plan Modal */}
      {isNewPlanModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                Crear Nuevo Plan de Pagos
              </h3>
              <button onClick={() => setIsNewPlanModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow space-y-4">
              <div className="relative" ref={newPlanAlumnoRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alumno</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-semibold"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {showNewAlumnoSuggestions && newPlanSearchTerm && (
                  <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 z-[60] max-h-60 overflow-y-auto">
                    {filteredNewAlumnoSuggestions.length > 0 ? (
                      filteredNewAlumnoSuggestions.map(alumno => (
                        <button
                          key={alumno.id}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-none transition-colors"
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
                          <p className="font-bold text-gray-800 text-sm">{alumno.nombre_completo}</p>
                          <p className="text-xs text-gray-500">{alumno.licenciatura} · {alumno.grado_actual}º {alumno.turno}</p>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usar Plantilla de Plan</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Plan</label>
                <select
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={newPlanForm.tipo_plan || 'Cuatrimestral'}
                  onChange={(e) => setNewPlanForm({ ...newPlanForm, tipo_plan: e.target.value as 'Cuatrimestral' | 'Semestral' })}
                >
                  <option value="Cuatrimestral">Cuatrimestral (Hasta 7 pagos)</option>
                  <option value="Semestral">Semestral (Hasta 9 pagos)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Beca</label>
                  {catalogos?.beca_porcentajes?.length ? (
                    <select
                      className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={newPlanForm.beca_porcentaje || '0%'}
                      onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_porcentaje: e.target.value })}
                    >
                      {catalogos.beca_porcentajes.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                      value={newPlanForm.beca_porcentaje || ''} placeholder="Ej. 0%"
                      onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_porcentaje: e.target.value })} />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Beca</label>
                  {catalogos?.beca_tipos?.length ? (
                    <select
                      className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={newPlanForm.beca_tipo || 'NINGUNA'}
                      onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_tipo: e.target.value })}
                    >
                      {catalogos.beca_tipos.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                      value={newPlanForm.beca_tipo || ''} placeholder="Ej. NINGUNA"
                      onChange={(e) => setNewPlanForm({ ...newPlanForm, beca_tipo: e.target.value })} />
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setIsNewPlanModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
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
                    no_plan_pagos: `PP-${newPlanForm.alumno_id.slice(-4)}`,
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
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{modalState.title}</h3>
              <p className="text-gray-600">{modalState.message}</p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setModalState({ ...modalState, isOpen: false })}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
