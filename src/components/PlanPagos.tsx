import React, { useState, useRef } from 'react';
import { X, ArrowLeft, Inbox, Edit, DollarSign, Save, Printer, Search, Loader2, Plus } from 'lucide-react';
import { PaymentPlan, Alumno, CicloEscolar } from '../types';
import { isPaid } from '../utils';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

interface PlanPagosProps {
  plans: PaymentPlan[];
  alumnos?: Alumno[];
  activeCiclo?: CicloEscolar;
  onBack: () => void;
  onSavePlan: (plan: PaymentPlan) => void;
}

export default function PlanPagos({ plans, alumnos = [], activeCiclo, onBack, onSavePlan }: PlanPagosProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState<string>(plans[0]?.nombre_alumno || '');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState<number>(1);
  const [paymentInput, setPaymentInput] = useState('');
  
  // Edit Plan State
  const [editForm, setEditForm] = useState<Partial<PaymentPlan>>({});
  const [newPlanForm, setNewPlanForm] = useState<Partial<PaymentPlan>>({
    tipo_plan: 'Cuatrimestral',
    beca_porcentaje: '0%',
    beca_tipo: 'NINGUNA',
    fecha_plan: new Date().toLocaleDateString('es-MX')
  });

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

  const CONCEPTOS_CATALOGO = [
    'INSCRIPCIÓN',
    'REINSCRIPCIÓN',
    '1ER PAGO',
    '2DO PAGO',
    '3ER PAGO',
    '4TO PAGO',
    '5TO PAGO',
    '6TO PAGO',
    '7MO PAGO',
    '8VO PAGO',
    'CONSTANCIAS RENOVACIÓN DE BECA',
    'SEGURO ESTUDIANTIL',
    'CREDENCIAL',
    'OTROS'
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
    try {
      const dataUrl = await toPng(printRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (node) => {
          if (node instanceof HTMLElement) {
            return node.getAttribute('data-html2canvas-ignore') !== 'true';
          }
          return true;
        }
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (printRef.current.offsetHeight * pdfWidth) / printRef.current.offsetWidth;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Plan_Pagos_${selectedPlan.nombre_alumno.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (plans.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <div className="bg-blue-50 text-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Inbox size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Sin Planes de Pago</h2>
          <p className="text-gray-500 mb-8">No hay planes de pago registrados para este ciclo escolar. Por favor, selecciona otro ciclo o inscribe alumnos.</p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => setIsNewPlanModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 mx-auto w-full justify-center"
            >
              <Plus size={20} /> Crear Nuevo Plan
            </button>
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col text-left">
              <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">
                  Crear Nuevo Plan de Pagos
                </h3>
                <button onClick={() => setIsNewPlanModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-grow space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alumno</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={newPlanForm.alumno_id || ''}
                    onChange={(e) => {
                      const alumno = alumnos.find(a => a.id === e.target.value);
                      if (alumno) {
                        setNewPlanForm({
                          ...newPlanForm, 
                          alumno_id: alumno.id,
                          nombre_alumno: alumno.nombre_completo,
                          licenciatura: alumno.licenciatura,
                          grado_turno: `${alumno.grado_actual} / ${alumno.turno}`
                        });
                      } else {
                        setNewPlanForm({...newPlanForm, alumno_id: ''});
                      }
                    }}
                  >
                    <option value="">-- Seleccionar Alumno --</option>
                    {alumnos
                      .filter(a => !plans.some(p => p.alumno_id === a.id))
                      .map(a => (
                        <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                      ))
                    }
                  </select>
                  {alumnos.filter(a => !plans.some(p => p.alumno_id === a.id)).length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Todos los alumnos registrados ya tienen un plan en este ciclo.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Plan</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={newPlanForm.tipo_plan || 'Cuatrimestral'}
                    onChange={(e) => setNewPlanForm({...newPlanForm, tipo_plan: e.target.value as 'Cuatrimestral' | 'Semestral'})}
                  >
                    <option value="Cuatrimestral">Cuatrimestral (Hasta 7 pagos)</option>
                    <option value="Semestral">Semestral (Hasta 9 pagos)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Beca</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                      value={newPlanForm.beca_porcentaje || ''}
                      onChange={(e) => setNewPlanForm({...newPlanForm, beca_porcentaje: e.target.value})}
                      placeholder="Ej. 0%"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Beca</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                      value={newPlanForm.beca_tipo || ''}
                      onChange={(e) => setNewPlanForm({...newPlanForm, beca_tipo: e.target.value})}
                      placeholder="Ej. NINGUNA"
                    />
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
                      id: `p_${Date.now()}`,
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
                      grado_turno: newPlanForm.grado_turno || ''
                    };
                    onSavePlan(newPlan);
                    setSelectedPlanId(newPlan.id);
                    setIsNewPlanModalOpen(false);
                    setNewPlanForm({
                      tipo_plan: 'Cuatrimestral',
                      beca_porcentaje: '0%',
                      beca_tipo: 'NINGUNA',
                      fecha_plan: new Date().toLocaleDateString('es-MX')
                    });
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

  const filteredPlans = plans.filter(p => 
    p.nombre_alumno.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (plan: PaymentPlan) => {
    setSelectedPlanId(plan.id);
    setSearchTerm(plan.nombre_alumno);
    setShowSuggestions(false);
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedPlanId(newId);
    const plan = plans.find(p => p.id === newId);
    if (plan) setSearchTerm(plan.nombre_alumno);
  };

  const openPaymentModal = (index: number) => {
    setSelectedPaymentIndex(index);
    setPaymentInput(selectedPlan[`estatus_${index}` as keyof PaymentPlan] as string || '');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = () => {
    const updatedPlan = {
      ...selectedPlan,
      [`estatus_${selectedPaymentIndex}`]: paymentInput
    };
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
              <span className="text-green-700 font-bold print:text-black">{estatus}</span>
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
            <button 
              onClick={() => openPaymentModal(index)} 
              className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 mx-auto transition-colors print:hidden"
              data-html2canvas-ignore="true"
            >
              <DollarSign size={14} /> Registrar Pago
            </button>
          )}
        </Td>
      </tr>
    );
  };

  const planType = selectedPlan.tipo_plan || 'Cuatrimestral';
  const maxPayments = planType === 'Semestral' ? 9 : 7;
  const paymentIndices = Array.from({ length: maxPayments }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex justify-center items-start font-sans print:p-0 print:bg-white">
      <div 
        ref={printRef}
        className="bg-[#d4d4d4] border-2 border-gray-400 shadow-2xl w-full max-w-5xl p-6 relative print:shadow-none print:border-none print:bg-white print:p-0"
      >
        
        {/* Top Action Bar - Hidden in Print */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 print:hidden" data-html2canvas-ignore="true">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-700 hover:text-black font-bold transition-colors"
          >
            <ArrowLeft size={20} /> Volver
          </button>

          {/* Search Bar & Actions */}
          <div className="flex items-center gap-4 w-full max-w-xl z-20">
            <div className="relative flex-grow">
              <div className="bg-white border border-gray-400 p-2 rounded-lg flex items-center shadow-sm">
                <Search size={18} className="text-gray-400 mr-2" />
                <input 
                  type="text"
                  className="w-full bg-transparent outline-none text-sm font-bold"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Buscar alumno por nombre..."
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
                <div className="absolute z-50 w-full bg-white border border-gray-400 mt-1 max-h-60 overflow-y-auto shadow-xl rounded-b-lg">
                  {filteredPlans.length > 0 ? (
                    filteredPlans.map(p => (
                      <div 
                        key={p.id} 
                        className="p-3 text-sm hover:bg-blue-500 hover:text-white cursor-pointer border-b border-gray-100 last:border-0"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSuggestionClick(p);
                        }}
                      >
                        {p.nombre_alumno}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-sm text-gray-500 text-center">No hay coincidencias</div>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={() => setIsNewPlanModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm"
              title="Crear plan para un alumno sin plan"
            >
              <Plus size={18} /> Nuevo Plan
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {isGeneratingPDF ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} 
              {isGeneratingPDF ? 'Generando...' : 'PDF / Imprimir'}
            </button>
            <button 
              onClick={openEditPlanModal}
              className="bg-white hover:bg-gray-50 text-gray-800 font-bold py-2 px-4 rounded shadow-sm border border-gray-300 transition-all flex items-center gap-2 text-sm"
            >
              <Edit size={16} /> Editar Plan
            </button>
          </div>
        </div>

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
                  <Th className="w-1/4">ESTATUS DEL PAGO<br/>(NO. DE RECIBO)</Th>
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
                    <td className="border border-black p-2 text-sm text-center">{selectedPlan.licenciatura}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 text-sm font-bold bg-gray-300 text-center">GRADO Y TURNO:</td>
                    <td className="border border-black p-2 text-sm text-center">{selectedPlan.grado_turno}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 text-sm font-bold bg-gray-300 text-center">NOMBRE COMPLETO Y<br/>FIRMA:</td>
                    <td className="border border-black p-2 text-sm text-center">
                      <select 
                        className="w-full bg-transparent outline-none text-center text-blue-600 font-semibold appearance-none cursor-pointer print:text-black"
                        value={selectedPlanId}
                        onChange={handleStudentChange}
                      >
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.nombre_alumno}</option>
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

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                Registrar Pago - {selectedPlan[`concepto_${selectedPaymentIndex}` as keyof PaymentPlan] as string}
              </h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Recibo / Estatus
              </label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. RECIBO 12345"
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Deja este campo en blanco para marcar el pago como pendiente.
              </p>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSavePayment}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save size={18} /> Guardar Pago
              </button>
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
                    onChange={(e) => setEditForm({...editForm, tipo_plan: e.target.value as 'Cuatrimestral' | 'Semestral'})}
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
                    onChange={(e) => setEditForm({...editForm, fecha_plan: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Beca</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                    value={editForm.beca_porcentaje || ''}
                    onChange={(e) => setEditForm({...editForm, beca_porcentaje: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Beca</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                    value={editForm.beca_tipo || ''}
                    onChange={(e) => setEditForm({...editForm, beca_tipo: e.target.value})}
                  />
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
                          onChange={(e) => setEditForm({...editForm, [`concepto_${i}`]: e.target.value})}
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
                          onChange={(e) => setEditForm({...editForm, [`fecha_${i}`]: e.target.value})}
                        />
                      </div>
                      <div className="w-1/4">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad ($)</label>
                        <input 
                          type="number" 
                          className="w-full border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm[`cantidad_${i}` as keyof PaymentPlan] as number || ''}
                          onChange={(e) => setEditForm({...editForm, [`cantidad_${i}`]: Number(e.target.value)})}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alumno</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={newPlanForm.alumno_id || ''}
                  onChange={(e) => {
                    const alumno = alumnos.find(a => a.id === e.target.value);
                    if (alumno) {
                      setNewPlanForm({
                        ...newPlanForm, 
                        alumno_id: alumno.id,
                        nombre_alumno: alumno.nombre_completo,
                        licenciatura: alumno.licenciatura,
                        grado_turno: `${alumno.grado_actual} / ${alumno.turno}`
                      });
                    } else {
                      setNewPlanForm({...newPlanForm, alumno_id: ''});
                    }
                  }}
                >
                  <option value="">-- Seleccionar Alumno --</option>
                  {alumnos
                    .filter(a => !plans.some(p => p.alumno_id === a.id))
                    .map(a => (
                      <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                    ))
                  }
                </select>
                {alumnos.filter(a => !plans.some(p => p.alumno_id === a.id)).length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Todos los alumnos registrados ya tienen un plan en este ciclo.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Plan</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={newPlanForm.tipo_plan || 'Cuatrimestral'}
                  onChange={(e) => setNewPlanForm({...newPlanForm, tipo_plan: e.target.value as 'Cuatrimestral' | 'Semestral'})}
                >
                  <option value="Cuatrimestral">Cuatrimestral (Hasta 7 pagos)</option>
                  <option value="Semestral">Semestral (Hasta 9 pagos)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje de Beca</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                    value={newPlanForm.beca_porcentaje || ''}
                    onChange={(e) => setNewPlanForm({...newPlanForm, beca_porcentaje: e.target.value})}
                    placeholder="Ej. 0%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Beca</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                    value={newPlanForm.beca_tipo || ''}
                    onChange={(e) => setNewPlanForm({...newPlanForm, beca_tipo: e.target.value})}
                    placeholder="Ej. NINGUNA"
                  />
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
                    id: `p_${Date.now()}`,
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
                    grado_turno: newPlanForm.grado_turno || ''
                  };
                  onSavePlan(newPlan);
                  setSelectedPlanId(newPlan.id);
                  setIsNewPlanModalOpen(false);
                  setNewPlanForm({
                    tipo_plan: 'Cuatrimestral',
                    beca_porcentaje: '0%',
                    beca_tipo: 'NINGUNA',
                    fecha_plan: new Date().toLocaleDateString('es-MX')
                  });
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
