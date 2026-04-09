import React, { useState, useEffect, useRef } from 'react';
import { Search, Eye, XCircle, Receipt, RefreshCw, Printer, Loader2, Upload, Download, AlertCircle, Filter, CheckSquare, Trash2, Archive, Check, FileText, ArrowLeft } from 'lucide-react';
import { downloadElementAsPDF, generatePDFBlob } from '../lib/printUtils';
import JSZip from 'jszip';
import ReciboPlantillaPDF from './ReciboPlantillaPDF';
import LoadingSkeleton from './LoadingSkeleton';
import type { Alumno, CicloEscolar, Recibo, ReciboDetalle, Catalogos, PaymentPlan, AppConfig, Usuario } from '../types';
import { supabase, cancelarRecibo, vincularReciboDetalleAMultiplesPlan, fetchAllSupabase, updateReciboFactura } from '../lib/supabase';
import { CSV_HEADERS_RECIBOS, generateCSV, downloadCSV } from '../utils';
import ImportarRegistrosCSV from './ImportarRegistrosCSV';

interface Props {
  alumnos: Alumno[];
  activeCiclo?: CicloEscolar;
  ciclos: CicloEscolar[];
  catalogos: Catalogos;
  appConfig?: AppConfig;
  initialSearchTerm?: string;
  onDataRefresh?: () => void;
  currentUser?: Usuario;
  onNavigateToPlan?: (alumnoId: string, folioReciboOrigen?: string) => void;
}

export default function ConsultarRegistros({ alumnos, activeCiclo, ciclos, catalogos, appConfig, initialSearchTerm, onDataRefresh, currentUser, onNavigateToPlan }: Props) {
  const [recibos, setRecibos] = useState<(Recibo & { recibos_detalles: ReciboDetalle[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [reciboSeleccionado, setReciboSeleccionado] = useState<(Recibo & { recibos_detalles: ReciboDetalle[] }) | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const exportRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [importarVisible, setImportarVisible] = useState(false);
  const [repairProgress, setRepairProgress] = useState('');
  
  // -- Filtros Avanzados y Selección Masiva --
  const [showFilters, setShowFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMetodoPago, setFilterMetodoPago] = useState('');
  const [filterStartFolio, setFilterStartFolio] = useState('');
  const [filterEndFolio, setFilterEndFolio] = useState('');
  const [filterFactura, setFilterFactura] = useState(false);

  // Modal para capturar folio factura
  const [facturarRecibo, setFacturarRecibo] = useState<any>(null);
  const [folioFiscalInput, setFolioFiscalInput] = useState('');

  const [editingFormaPago, setEditingFormaPago] = useState<any>(null);
  const [formaPagoInput, setFormaPagoInput] = useState('');
  const [bancoInput, setBancoInput] = useState('');

  // -- Edición de Detalles del Recibo (Admin) --
  const [editingFechaPago, setEditingFechaPago] = useState<any>(null);
  const [fechaPagoInput, setFechaPagoInput] = useState('');
  const [editandoConceptoId, setEditandoConceptoId] = useState<string | null>(null);
  const [tempConceptoText, setTempConceptoText] = useState<string>('');
  const [guardandoConcepto, setGuardandoConcepto] = useState(false);
  const [editandoSubtotalId, setEditandoSubtotalId] = useState<string | null>(null);
  const [tempSubtotalMonto, setTempSubtotalMonto] = useState<number>(0);
  const [guardandoSubtotal, setGuardandoSubtotal] = useState(false);
  
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());
  const [massStatus, setMassStatus] = useState<{ msg: string, isOpen: boolean, results: any[] }>({ msg: '', isOpen: false, results: [] });
  const [isProcessingMass, setIsProcessingMass] = useState(false);

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedReceiptIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedReceiptIds(newSet);
  };

  const handleSelectAllFilters = (ids: string[]) => {
    if (selectedReceiptIds.size === ids.length && ids.length > 0) {
      setSelectedReceiptIds(new Set());
    } else {
      setSelectedReceiptIds(new Set(ids));
    }
  };

  const executeMassCancel = async () => {
    if (selectedReceiptIds.size === 0) return;
    if (!window.confirm(`¿Estás seguro de cancelar ${selectedReceiptIds.size} recibos seleccionados de forma permanente?`)) return;
    
    setIsProcessingMass(true);
    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const id of Array.from(selectedReceiptIds)) {
       const folio = String(recibos.find(r => r.id === id)?.folio || id);
       setMassStatus({ isOpen: true, msg: `Cancelando recibo #${folio}...`, results });
       const err = await cancelarRecibo(id as string);
       if (!err) {
         successCount++;
         results.push({ folio, status: 'Éxito', note: 'Cancelado correctamente' });
       } else {
         errorCount++;
         results.push({ folio, status: 'Error', note: err ? String(err) : 'Error desconocido' });
       }
    }

    cargarRecibos();
    setSelectedReceiptIds(new Set());
    setMassStatus({ 
       isOpen: true, 
       msg: `Proceso completado. Éxitos: ${successCount}, Errores: ${errorCount}.`, 
       results 
    });
    setIsProcessingMass(false);
  };

  const executeMassExportZIP = async () => {
    const listToExport = selectedReceiptIds.size > 0 
      ? recibosFiltrados.filter(r => selectedReceiptIds.has(r.id))
      : recibosFiltrados;
      
    if (listToExport.length === 0) return;
    if (listToExport.length > 100) {
      alert(`Actualmente solo se pueden exportar un máximo de 100 recibos por lote. Has intentado exportar ${listToExport.length}. Por favor, utiliza los filtros o selecciona manualmente una porción más pequeña.`);
      return;
    }

    setIsProcessingMass(true);
    const zip = new JSZip();
    let currentCount = 0;

    for (const r of listToExport) {
       currentCount++;
       setMassStatus({ isOpen: true, msg: `Generando PDF ${currentCount} de ${listToExport.length} (Recibo #${r.folio})...`, results: [] });
       
       const el = exportRefs.current[r.id];
       if (el) {
          try {
             const blob = await generatePDFBlob(el);
             const safeName = r.nombre_alumno.replace(/[^a-zA-Z0-9]/g, '_');
             zip.file(`Recibo_${r.folio}_${safeName}.pdf`, blob);
          } catch (err) {
             console.error(`Error generando PDF para #${r.folio}`, err);
          }
       } else {
         console.warn(`Referencia de PDF no encontrada para recibo ${r.folio}`);
       }
    }

    setMassStatus({ isOpen: true, msg: `Comprimiendo archivo ZIP...`, results: [] });
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Exportacion_Recibos_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch(e) {
      console.error(e);
      alert("Error al comprimir el archivo ZIP.");
    }

    setMassStatus({ isOpen: false, msg: '', results: [] });
    setIsProcessingMass(false);
  };
  
  // Vincular Modal State
  const [vincularDetalle, setVincularDetalle] = useState<ReciboDetalle | null>(null);
  const [planesAlumno, setPlanesAlumno] = useState<PaymentPlan[]>([]);
  const [linking, setLinking] = useState(false);
  const [vincularSeleccion, setVincularSeleccion] = useState<{ planId: string; idx: number }[]>([]);

  // -- Edición de Observaciones --
  const [editandoObsId, setEditandoObsId] = useState<string | null>(null);
  const [tempObsText, setTempObsText] = useState<string>('');
  const [guardandoObs, setGuardandoObs] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '' });

  const handleUpdateObs = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar Ajuste a Nota',
      message: '¿Estás seguro de que deseas sobrescribir la nota aclaratoria original de este concepto? Esta acción actualizará los registros permanentemente.',
      onConfirm: async () => {
         setGuardandoObs(true);
         const textToSave = tempObsText.trim();
         const { error } = await supabase.from('recibos_detalles').update({ observaciones: textToSave }).eq('id', id);
         if (!error) {
            setReciboSeleccionado(prev => {
              if(!prev) return prev;
              return {
                ...prev,
                recibos_detalles: prev.recibos_detalles.map(d => d.id === id ? { ...d, observaciones: textToSave } : d)
              };
            });
            if(onDataRefresh) onDataRefresh();
         } else {
            alert('Error guardando nota: ' + (error as any).message);
         }
         setGuardandoObs(false);
         setEditandoObsId(null);
         setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const handleUpdateConcepto = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar Cambio de Concepto',
      message: '¿Estás seguro de que deseas modificar el nombre del concepto? Esto actualizará los registros de forma permanente.',
      onConfirm: async () => {
         setGuardandoConcepto(true);
         const textToSave = tempConceptoText.trim();
         if (!textToSave) {
           alert('El concepto no puede estar vacío');
           setGuardandoConcepto(false);
           return;
         }
         const { error } = await supabase.from('recibos_detalles').update({ concepto: textToSave }).eq('id', id);
         if (!error) {
            setReciboSeleccionado(prev => {
              if(!prev) return prev;
              return {
                ...prev,
                recibos_detalles: prev.recibos_detalles.map(d => d.id === id ? { ...d, concepto: textToSave } : d)
              };
            });
            if(onDataRefresh) onDataRefresh();
         } else {
            alert('Error guardando concepto: ' + (error as any).message);
         }
         setGuardandoConcepto(false);
         setEditandoConceptoId(null);
         setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const handleUpdateSubtotal = (id: string, reciboId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar Cambio de Monto',
      message: '¿Estás seguro de que deseas modificar el monto de este concepto? El sistema recalculará automáticamente el total del recibo.',
      onConfirm: async () => {
         setGuardandoSubtotal(true);
         const newMonto = Number(tempSubtotalMonto);
         if (isNaN(newMonto) || newMonto < 0) {
           alert('El monto ingresado es inválido');
           setGuardandoSubtotal(false);
           return;
         }

         const detalleOriginal = reciboSeleccionado?.recibos_detalles.find(d => d.id === id);
         const cantidad = detalleOriginal?.cantidad || 1;
         const newCostoUnitario = newMonto / cantidad;

         const { error: errorUpdateDetalle } = await supabase
           .from('recibos_detalles')
           .update({ subtotal: newMonto, costo_unitario: newCostoUnitario })
           .eq('id', id);

         if (errorUpdateDetalle) {
            alert('Error guardando monto: ' + (errorUpdateDetalle as any).message);
            setGuardandoSubtotal(false);
            return;
         }

         // Recalcular el total del recibo principal basándose en todos los demás "detalles" cargados más el nuevo modificado
         const uneditedDetalles = reciboSeleccionado?.recibos_detalles.filter(d => d.id !== id) || [];
         const newTotal = uneditedDetalles.reduce((acc, d) => acc + d.subtotal, 0) + newMonto;

         const { error: errorUpdateRecibo } = await supabase
           .from('recibos')
           .update({ total: newTotal })
           .eq('id', reciboId);

         if (errorUpdateRecibo) {
            alert('Aviso: Se actualizó el concepto pero hubo un error recalculando el total del recibo en BD: ' + (errorUpdateRecibo as any).message);
         }

         // Actualizamos de forma reactiva local
         setReciboSeleccionado(prev => {
            if(!prev) return prev;
            return {
              ...prev,
              total: newTotal,
              recibos_detalles: prev.recibos_detalles.map(d => d.id === id ? { ...d, subtotal: newMonto, costo_unitario: newCostoUnitario } : d)
            };
         });
         
         // Refrescamos localmente en el listado de recibos consultado
         setRecibos(oldRecibos => oldRecibos.map(r => {
             if (r.id === reciboId) {
                return {
                    ...r,
                    total: newTotal,
                    recibos_detalles: r.recibos_detalles.map(d => d.id === id ? { ...d, subtotal: newMonto, costo_unitario: newCostoUnitario } : d)
                };
             } return r;
         }));

         setGuardandoSubtotal(false);
         setEditandoSubtotalId(null);
         setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const handleUnlinkDetail = async (detalleId: string, idx: number) => {
      if (!reciboSeleccionado) return;
      if (!window.confirm(`¿Estás seguro de desvincular este cobro del Plan #${idx}? Su estatus en el plan regresará a PENDIENTE.`)) return;

      const { error } = await supabase.from('recibos_detalles').update({ indice_concepto_plan: null, observaciones: null }).eq('id', detalleId);
      if (error) { alert('Error: ' + error.message); return; }

      const { data: planes } = await supabase.from('planes_pago').select('*')
          .eq('alumno_id', reciboSeleccionado.alumno_id)
          .eq('ciclo_id', reciboSeleccionado.ciclo_id);
          
      if (planes && planes.length > 0) {
          const currentEstatus = planes[0][`estatus_${idx}` as keyof PaymentPlan] as string || '';
          let newEstatus = 'PENDIENTE';
          const rx = new RegExp(`(.*?)((?:F-${reciboSeleccionado.folio_fiscal}|R-${reciboSeleccionado.folio}))\\b.*?(\\(.*?\\))?(;|$)`, 'i');
          if (rx.test(currentEstatus)) {
               const modified = currentEstatus.replace(rx, '').trim();
               newEstatus = modified.length > 0 && modified !== ';' ? modified : 'PENDIENTE';
          }
          await supabase.from('planes_pago').update({ [`estatus_${idx}`]: newEstatus }).eq('id', planes[0].id);
      }

      setReciboSeleccionado(prev => {
          if (!prev) return prev;
          return {
              ...prev,
              recibos_detalles: prev.recibos_detalles.map(dd => dd.id === detalleId ? { ...dd, indice_concepto_plan: null as any, observaciones: null as any } : dd)
          };
      });
      if (onDataRefresh) onDataRefresh();
  };

  useEffect(() => {
    if (vincularDetalle && reciboSeleccionado) {
       supabase.from('planes_pago').select('*')
         .eq('alumno_id', reciboSeleccionado.alumno_id)
         .eq('ciclo_id', reciboSeleccionado.ciclo_id)
         .then(({ data }) => setPlanesAlumno((data || []) as PaymentPlan[]));
    } else {
       setPlanesAlumno([]);
       setVincularSeleccion([]);
    }
  }, [vincularDetalle, reciboSeleccionado]);

  const toggleSeleccion = (planId: string, idx: number) => {
    setVincularSeleccion(prev => {
      const key = `${planId}-${idx}`;
      const exists = prev.some(s => `${s.planId}-${s.idx}` === key);
      return exists ? prev.filter(s => `${s.planId}-${s.idx}` !== key) : [...prev, { planId, idx }];
    });
  };

  const handleConfirmarVinculacion = async () => {
    if (!vincularDetalle || !reciboSeleccionado || vincularSeleccion.length === 0) return;
    setLinking(true);
    const err = await vincularReciboDetalleAMultiplesPlan(
      vincularDetalle.id,
      reciboSeleccionado.folio,
      vincularSeleccion
    );
    setLinking(false);
    if (err) {
      alert('Error vinculando: ' + err);
    } else {
      setVincularDetalle(null);
      setVincularSeleccion([]);
      cargarRecibos();
      onDataRefresh?.(); // Notificar globalmente la actualización de planes
      // Actualizar la vista local del recibo seleccionado
      const firstIdx = vincularSeleccion[0].idx;
      const updatedDetails = reciboSeleccionado.recibos_detalles.map(d =>
        d.id === vincularDetalle.id ? { ...d, indice_concepto_plan: firstIdx, observaciones: 'Abono vinculado manualmente al plan' } : d
      );
      setReciboSeleccionado({ ...reciboSeleccionado, recibos_detalles: updatedDetails });
    }
  };

  const handleExportCSV = () => {
    const rows: string[][] = recibosFiltrados.map(r => {
      const cols = [
        r.nombre_alumno || '',
        r.folio?.toString() || '',
        r.fecha_recibo || '',
        (r.total - (r.uso_saldo_a_favor || 0)).toString() || '0',
        r.fecha_pago || '',
        r.estatus || '',
        r.requiere_factura ? 'SÍ' : 'NO',
        r.estatus_factura || 'NO APLICA',
        r.folio_fiscal || ''
      ];
      const dets = r.recibos_detalles || [];
      for (let i = 0; i < 5; i++) {
        const d = dets[i];
        if (d) {
           cols.push(d.cantidad?.toString() || '');
           cols.push(d.concepto || '');
           cols.push(d.costo_unitario?.toString() || '');
           cols.push(d.subtotal?.toString() || '');
           cols.push(r.forma_pago || '');
           cols.push(r.banco || '');
        } else {
           cols.push('', '', '', '', '', '');
        }
      }
      return cols;
    });
    const csvContent = generateCSV(CSV_HEADERS_RECIBOS, rows);
    downloadCSV(csvContent, `recibos_historial.csv`);
  };

  const handleImprimir = async () => {
    if (!printRef.current || !reciboSeleccionado) return;
    setIsGeneratingPDF(true);
    try {
      const fileName = `Recibo_${reciboSeleccionado.folio}_${reciboSeleccionado.nombre_alumno.replace(/\s+/g, '_')}.pdf`;
      await downloadElementAsPDF(printRef.current, fileName);
    } catch (err) {
      console.error('Error generando PDF', err);
      alert('Error generando PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const cargarRecibos = async () => {
    setLoading(true);
    try {
      // Descargar recibos sin JOIN para evitar timeout por tablas grandes
      const { data: recData, error: recError } = await fetchAllSupabase(() => supabase
        .from('recibos')
        .select('*')
        .order('folio', { ascending: false }));

      if (recError) throw recError;

      // Descargar detalles por separado
      const { data: detData, error: detError } = await fetchAllSupabase(() => supabase
        .from('recibos_detalles')
        .select('*'));

      if (detError) throw detError;

      // Unir en memoria
      const detallesMap: Record<string, any[]> = {};
      (detData || []).forEach(d => {
        if (!detallesMap[d.recibo_id]) detallesMap[d.recibo_id] = [];
        detallesMap[d.recibo_id].push(d);
      });

      // Mapear nombre del alumno y ciclo
      const mapeados = (recData || []).map(r => {
        const al = alumnos.find(a => a.id === r.alumno_id);
        const ci = ciclos.find(c => c.id === r.ciclo_id);
        return {
          ...r,
          nombre_alumno: al ? al.nombre_completo : 'Desconocido',
          licenciatura: al ? al.licenciatura : '',
          ciclo_escolar: ci ? ci.nombre : '',
          recibos_detalles: detallesMap[r.id] || []
        };
      });

      setRecibos(mapeados);
    } catch (err) {
      console.error('Error al cargar recibos', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarRecibos();
  }, [alumnos]);

  const handleCancelar = async (id: string) => {
    if (!window.confirm('¿Estás seguro de cancelar este recibo? El estatus del Plan de Pagos NO se revertirá automáticamente.')) return;
    const err = await cancelarRecibo(id);
    if (!err) {
      cargarRecibos();
      if (reciboSeleccionado?.id === id) {
        setReciboSeleccionado(prev => prev ? { ...prev, estatus: 'CANCELADO' } : null);
      }
    } else {
      alert('Error cancelando recibo: ' + err);
    }
  };

  const handleToggleFactura = async (id: string, currentRequiereFactura: boolean, currentFacturaEstatus: string) => {
    const newStatus = !currentRequiereFactura;
    
    // Si se desea desactivar y ya tiene un folio, confirmar
    if (!newStatus && currentFacturaEstatus === 'FACTURADO') {
       if (!window.confirm("Este recibo ya tiene un folio fiscal asignado. Si quitas la opción de factura, perderás el folio fiscal registrado en este recibo. ¿Deseas continuar?")) {
         return;
       }
    }

    const newEstatusFactura = newStatus ? 'PENDIENTE' : 'NO APLICA';
    const updatePayload: any = {
        requiere_factura: newStatus,
        estatus_factura: newEstatusFactura,
    };
    if (!newStatus) {
        updatePayload.folio_fiscal = null;
    }

    const { error } = await supabase
      .from('recibos')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      alert('Error al actualizar opciones de factura: ' + error.message);
      return;
    }

    setReciboSeleccionado(prev => {
      if (!prev) return prev;
      return { ...prev, ...updatePayload };
    });

    setRecibos(oldRecibos => oldRecibos.map(r => {
      if (r.id === id) {
        return { ...r, ...updatePayload };
      }
      return r;
    }));
  };

  const handleRepararHistoricos = async () => {
    if (!window.confirm('¿Estás seguro de ejecutar la reparación masiva? Esto reasignará los recibos mal vinculados a sus ciclos históricos empleando cercanía de fechas.')) return;
    
    setLoading(true);
    setRepairProgress('Obteniendo planes de pago...');
    try {
      // Fetch planes_pago
      const { data: planes, error: planesErr } = await fetchAllSupabase(() => supabase.from('planes_pago').select('*'));
      if (planesErr) throw planesErr;
      const planesMutables = JSON.parse(JSON.stringify(planes || []));

      // Fetch recibos safely with pagination NO JOINS to avoid timeout
      setRepairProgress('Descargando recibos (fase 1/2)...');
      let allRecibos: any[] = [];
      let fetchMoreR = true;
      let fromR = 0;
      const stepR = 2000;
      
      while (fetchMoreR) {
         setRepairProgress(`Descargando recibos... (${allRecibos.length})`);
         const { data: chunk, error: err } = await supabase
            .from('recibos')
            .select('*')
            .range(fromR, fromR + stepR - 1);
            
         if (err) throw err;
         if (chunk && chunk.length > 0) {
            allRecibos = [...allRecibos, ...chunk];
            fromR += stepR;
         } else {
            fetchMoreR = false;
         }
      }

      setRepairProgress('Descargando detalles (fase 2/2)...');
      let allDetalles: any[] = [];
      let fetchMoreD = true;
      let fromD = 0;
      const stepD = 5000;
      
      while (fetchMoreD) {
         setRepairProgress(`Descargando detalles... (${allDetalles.length})`);
         const { data: chunk, error: err } = await supabase
            .from('recibos_detalles')
            .select('*')
            .range(fromD, fromD + stepD - 1);
            
         if (err) throw err;
         if (chunk && chunk.length > 0) {
            allDetalles = [...allDetalles, ...chunk];
            fromD += stepD;
         } else {
            fetchMoreD = false;
         }
      }

      setRepairProgress('Uniendo datos en memoria...');
      const detallesMap: Record<string, any[]> = {};
      allDetalles.forEach(d => {
         if (!detallesMap[d.recibo_id]) detallesMap[d.recibo_id] = [];
         detallesMap[d.recibo_id].push(d);
      });

      const joinedRecibos = allRecibos.map(r => ({
          ...r,
          recibos_detalles: detallesMap[r.id] || []
      }));

      setRepairProgress('Analizando mejores coincidencias temporales...');

      const parseDateToMs = (dStr: string) => {
        if (!dStr) return 0;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return new Date(dStr).getTime() || 0;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
            const [d, m, y] = dStr.split('/');
            return new Date(Number(y), Number(m)-1, Number(d)).getTime() || 0;
        }
        return new Date(dStr).getTime() || 0;
      };

      const planesToUpdate: Record<string, any> = {};
      const recibosToUpdate: any[] = [];
      const detallesToUpdate: any[] = [];

      for (const r of joinedRecibos) {
         if (r.estatus !== 'ACTIVO') continue;

         const studentPlanes = planesMutables.filter((p: any) => p.alumno_id === r.alumno_id);
         if (studentPlanes.length === 0) continue;

         let changedCiclo = false;
         let newCicloId = r.ciclo_id;

         r.recibos_detalles.forEach((d: any) => {
             let bestMatch: any = null;
             const fechaReciboMs = new Date(r.fecha_pago).getTime();

             studentPlanes.forEach((plan: any) => {
                 for(let j=1; j<=9; j++) {
                     const conc = plan[`concepto_${j}`];
                     if (conc && conc.toUpperCase() === d.concepto.toUpperCase()) {
                         const fpMs = parseDateToMs(plan[`fecha_${j}`]);
                         const diff = fpMs === 0 ? 9999999999999 : Math.abs(fechaReciboMs - fpMs);
                         if (!bestMatch || diff < bestMatch.diff) {
                             bestMatch = { planId: plan.id, index: j, diff };
                         }
                     }
                 }
             });

             if (bestMatch) {
                 const oldPlanId = planesMutables.find((p:any) => p.ciclo_id === r.ciclo_id)?.id;
                 const oldIndex = d.indice_concepto_plan;

                 if (oldPlanId !== bestMatch.planId || oldIndex !== bestMatch.index) {
                     if (oldPlanId && oldIndex) {
                         if (!planesToUpdate[oldPlanId]) planesToUpdate[oldPlanId] = {};
                         planesToUpdate[oldPlanId][`estatus_${oldIndex}`] = 'PENDIENTE';
                         const oldP = planesMutables.find((p:any) => p.id === oldPlanId);
                         if (oldP) oldP[`estatus_${oldIndex}`] = 'PENDIENTE';
                     }

                     if (!planesToUpdate[bestMatch.planId]) planesToUpdate[bestMatch.planId] = {};
                     planesToUpdate[bestMatch.planId][`estatus_${bestMatch.index}`] = 'PAGADO';
                     const newP = planesMutables.find((p:any) => p.id === bestMatch.planId);
                     if (newP) newP[`estatus_${bestMatch.index}`] = 'PAGADO';

                     detallesToUpdate.push({ id: d.id, indice_concepto_plan: bestMatch.index });
                     if (newP && newCicloId !== newP.ciclo_id) {
                         newCicloId = newP.ciclo_id;
                         changedCiclo = true;
                     }
                 }
             }
         });

         if (changedCiclo) recibosToUpdate.push({ id: r.id, ciclo_id: newCicloId });
      }

      setRepairProgress(`Procesando actualizaciones...`);
      
      const UPDATE_CHUNK = 20; // 20 concurrent updates max to prevent connection pool exhaustion
      const planIds = Object.keys(planesToUpdate);
      
      for (let k = 0; k < planIds.length; k += UPDATE_CHUNK) {
         setRepairProgress(`Actualizando planes... ${k}/${planIds.length}`);
         await Promise.all(planIds.slice(k, k + UPDATE_CHUNK).map(id => supabase.from('planes_pago').update(planesToUpdate[id]).eq('id', id)));
      }
      
      for (let k = 0; k < detallesToUpdate.length; k += UPDATE_CHUNK) {
         setRepairProgress(`Actualizando detalles... ${k}/${detallesToUpdate.length}`);
         await Promise.all(detallesToUpdate.slice(k, k + UPDATE_CHUNK).map(d => supabase.from('recibos_detalles').update({ indice_concepto_plan: d.indice_concepto_plan }).eq('id', d.id)));
      }
      
      for (let k = 0; k < recibosToUpdate.length; k += UPDATE_CHUNK) {
         setRepairProgress(`Actualizando recibos... ${k}/${recibosToUpdate.length}`);
         await Promise.all(recibosToUpdate.slice(k, k + UPDATE_CHUNK).map(r => supabase.from('recibos').update({ ciclo_id: r.ciclo_id }).eq('id', r.id)));
      }

      setRepairProgress('');
      alert('¡Reparación completada con éxito!');
      cargarRecibos();
    } catch (e: any) {
      console.error(e);
      alert('Error en reparación: ' + e.message);
      setRepairProgress('');
    } finally {
      setLoading(false);
    }
  };

  const parseDateToMs = (dStr: string) => {
    if (!dStr) return 0;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return new Date(dStr + "T00:00:00").getTime() || 0;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
        const [d, m, y] = dStr.split('/');
        return new Date(Number(y), Number(m)-1, Number(d)).getTime() || 0;
    }
    return new Date(dStr).getTime() || 0;
  };

  const recibosFiltrados = recibos.filter(r => {
    if (filterFactura && (!r.requiere_factura || r.estatus_factura === 'FACTURADO')) {
       return false;
    }

    const matchesSearch = 
      r.folio?.toString().includes(searchTerm) ||
      r.nombre_alumno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.fecha_recibo.includes(searchTerm);
      
    if (!matchesSearch) return false;

    if (filterStartDate || filterEndDate) {
       const rTime = parseDateToMs(r.fecha_recibo);
       if (filterStartDate && rTime < parseDateToMs(filterStartDate)) return false;
       if (filterEndDate && rTime > parseDateToMs(filterEndDate)) return false;
    }
    
    if (filterMetodoPago && r.forma_pago !== filterMetodoPago) return false;
    
    const fv = Number(r.folio);
    if (filterStartFolio && fv < Number(filterStartFolio)) return false;
    if (filterEndFolio && fv > Number(filterEndFolio)) return false;

    return true;
  });

  const exportTargetList = React.useMemo(() => {
     if (selectedReceiptIds.size > 0) {
        return recibosFiltrados.filter(r => selectedReceiptIds.has(r.id));
     }
     return recibosFiltrados.slice(0, 100);
  }, [selectedReceiptIds, recibosFiltrados]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const totalPages = Math.ceil(recibosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, recibosFiltrados.length);
  const paginatedRecibos = recibosFiltrados.slice(startIndex, endIndex);

  return (
    <div className="flex h-full min-h-[600px] relative overflow-hidden">
      
      {/* Lista lateral — en móvil ocupa el 100% y se oculta si hay recibo seleccionado */}
      <div className={`
        flex flex-col transition-all duration-300
        w-full md:w-1/3
        absolute md:relative inset-0
        ${reciboSeleccionado ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
        border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900
        z-10
      `}>
        <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-2">
          {/* Fila 1: título + botones de acción */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-gray-700 dark:text-gray-200 text-sm shrink-0">Historial</h2>
            <div className="flex gap-1 items-center shrink-0 flex-wrap justify-end">
              <button onClick={() => setShowFilters(!showFilters)} className={`px-2 py-1.5 rounded-lg transition-colors border text-xs font-bold flex items-center gap-1 ${showFilters ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`} title="Filtros Avanzados">
                <Filter size={13} className="shrink-0" />
                <span className="hidden sm:inline text-xs">Filtros</span>
              </button>
              <button
                onClick={() => setFilterFactura(!filterFactura)}
                className={`px-2 py-1.5 rounded-lg transition-colors border text-xs font-bold flex items-center gap-1 ${filterFactura ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                title="Mostrar solo Pendientes de Factura"
              >
                <FileText size={13} className="shrink-0" />
                <span className="hidden sm:inline text-xs">Facturas</span>
              </button>
              <button
                onClick={() => setImportarVisible(true)}
                className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1.5 rounded-lg transition-colors border border-blue-200 dark:border-blue-800 text-xs font-bold bg-white dark:bg-gray-800"
                title="Importar desde CSV"
              >
                <Upload size={13} className="shrink-0" />
                <span className="hidden sm:inline text-xs">Importar</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 px-2 py-1.5 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800 text-xs font-bold bg-white dark:bg-gray-800"
                title="Exportar a Excel"
              >
                <Download size={13} className="shrink-0" />
                <span className="hidden sm:inline text-xs">Exportar</span>
              </button>
              <button onClick={cargarRecibos} className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 rounded-lg transition-colors flex items-center gap-1" title="Actualizar">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          {repairProgress && (
             <div className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded border border-red-200 animate-pulse text-center">
               ⚙️ {repairProgress}
             </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={15} />
            <input
              type="text"
              placeholder="Buscar por folio, nombre o fecha..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {showFilters && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm flex flex-col gap-2">
              <div className="flex gap-2">
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-0.5">Fecha Inicio</label>
                   <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs focus:ring-1 focus:border-blue-400 outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
                 </div>
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-0.5">Fecha Fin</label>
                   <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs focus:ring-1 focus:border-blue-400 outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
                 </div>
              </div>
              <div className="flex gap-2">
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-0.5">Folio Inicio</label>
                   <input type="number" value={filterStartFolio} onChange={e => setFilterStartFolio(e.target.value)} className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs focus:ring-1 focus:border-blue-400 outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" min="1" />
                 </div>
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-0.5">Folio Fin</label>
                   <input type="number" value={filterEndFolio} onChange={e => setFilterEndFolio(e.target.value)} className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs focus:ring-1 focus:border-blue-400 outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" min="1" />
                 </div>
              </div>
              <div>
                 <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-0.5">Forma de Pago</label>
                 <select value={filterMetodoPago} onChange={e => setFilterMetodoPago(e.target.value)} className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs focus:ring-1 focus:border-blue-400 outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                   <option value="">Cualquiera</option>
                   <option value="Depósito Bancario">Depósito Bancario</option>
                   <option value="Transferencia bancaria">Transferencia bancaria</option>
                   <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                   <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                   <option value="Efectivo">Efectivo</option>
                 </select>
              </div>
              <div className="flex justify-end mt-1">
                 <button onClick={() => {
                   setFilterStartDate(''); setFilterEndDate(''); setFilterMetodoPago(''); setFilterStartFolio(''); setFilterEndFolio('');
                 }} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold underline">Limpiar Filtros</button>
              </div>
            </div>
          )}
        </div>
        
        {/* Acciones Masivas */}
        <div className="bg-white dark:bg-gray-900 px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs sticky top-0 z-10 shadow-sm">
           <div className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 rounded text-blue-600 cursor-pointer" 
                     checked={paginatedRecibos.length > 0 && selectedReceiptIds.size > 0 && paginatedRecibos.every(r => selectedReceiptIds.has(r.id))}
                     onChange={(e) => {
                       const visibleIds = paginatedRecibos.map(r => r.id);
                       if (e.target.checked) {
                          const newSet = new Set(selectedReceiptIds);
                          visibleIds.forEach(id => newSet.add(id));
                          setSelectedReceiptIds(newSet);
                       } else {
                          const newSet = new Set(selectedReceiptIds);
                          visibleIds.forEach(id => newSet.delete(id));
                          setSelectedReceiptIds(newSet);
                       }
                     }} />
              <div className="flex items-center gap-1 group relative">
                 <button onClick={() => handleSelectAllFilters(recibosFiltrados.map(r => r.id))} className="text-gray-500 dark:text-gray-400 font-bold hover:text-blue-600 text-xs flex items-center gap-1">
                    Sel. Todos ({recibosFiltrados.length})
                 </button>
              </div>
           </div>
           
           {selectedReceiptIds.size > 0 && (
             <div className="flex gap-1.5">
               {currentUser?.rol === 'ADMINISTRADOR' && (
                 <button onClick={executeMassCancel} className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-2 py-1 rounded border border-red-200 flex items-center gap-1 font-bold transition-colors" title="Cancelar Múltiples">
                    <Trash2 size={13} />
                 </button>
               )}
               <button onClick={executeMassExportZIP} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 flex items-center gap-1 font-bold transition-colors" title="Exportar ZIP Múltiple">
                  <Archive size={13} /> ({selectedReceiptIds.size})
               </button>
             </div>
           )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <LoadingSkeleton type="list" text="Cargando recibos..." />
          ) : recibosFiltrados.length === 0 ? (
            <div className="text-center p-4 text-gray-500 text-sm">No se encontraron recibos.</div>
          ) : (
            paginatedRecibos.map(r => (
              <div 
                key={r.id} 
          className={`p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors mb-1 ${reciboSeleccionado?.id === r.id ? 'bg-white dark:bg-gray-800 shadow-sm border-blue-200 dark:border-blue-700 ring-1 ring-blue-500' : ''}`}
                onClick={() => setReciboSeleccionado(r)}
              >
                <div className="flex gap-2">
                   <div className="flex items-start pt-1" onClick={e => e.stopPropagation()}>
                     <input type="checkbox" className="w-4 h-4 rounded text-blue-600 cursor-pointer border-gray-300" 
                            checked={selectedReceiptIds.has(r.id)} 
                            onChange={(e) => toggleSelection(r.id, e as any)} />
                   </div>
                   <div className="flex-1 overflow-hidden cursor-pointer">
                       <div className="flex flex-wrap justify-between items-start gap-1 mb-1">
                         <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">Folio: {r.folio}</span>
                         <div className="flex items-center gap-1 flex-wrap">
                           <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.estatus === 'ACTIVO' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'}`}>
                             {r.estatus}
                           </span>
                           {r.requiere_factura && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                                 r.estatus_factura === 'FACTURADO' 
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 hover:bg-blue-200' 
                                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 animate-pulse'
                              }`}
                              onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (r.estatus_factura === 'FACTURADO' && currentUser?.rol !== 'ADMINISTRADOR') return;
                                  setFacturarRecibo(r); 
                                  setFolioFiscalInput(r.folio_fiscal || ''); 
                              }}
                              title={r.estatus_factura === 'FACTURADO' ? (currentUser?.rol === 'ADMINISTRADOR' ? 'Modificar factura asentada' : `Facturado: ${r.folio_fiscal}`) : 'Clic para asentar folio de factura'}
                              >
                                {r.estatus_factura === 'FACTURADO' ? 'Facturado' : 'Pend. Factura'}
                              </span>
                           )}
                         </div>
                       </div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-1">{r.nombre_alumno}</div>
                      <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col items-end w-full">
                          {(r.uso_saldo_a_favor || 0) > 0 && (
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 mb-0.5">
                              Monedero: -${r.uso_saldo_a_favor!.toFixed(2)}
                            </span>
                          )}
                          <span className="font-bold text-gray-700 dark:text-gray-200">Caja: ${(r.total - (r.uso_saldo_a_favor || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>

        {recibosFiltrados.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{startIndex + 1}-{endIndex} de {recibosFiltrados.length}</span>
              <select 
                className="border border-gray-300 dark:border-gray-700 rounded p-1 outline-none focus:border-blue-500 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-pointer"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
              >
                <option value={10}>10/pág</option>
                <option value={20}>20/pág</option>
                <option value={50}>50/pág</option>
                <option value={100}>100/pág</option>
              </select>
            </div>
            <div className="flex justify-between items-center gap-1">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="flex-1 py-1.5 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors shadow-sm active:scale-95"
              >
                Anterior
              </button>
              <button 
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
                className="flex-1 py-1.5 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors shadow-sm active:scale-95"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detalle del recibo — en móvil ocupa pantalla completa cuando hay recibo seleccionado */}
      <div className={`
        bg-gray-50 dark:bg-gray-950 overflow-y-auto
        w-full md:w-2/3
        absolute md:relative inset-0
        transition-transform duration-300
        ${reciboSeleccionado ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        z-20 md:z-auto
      `}>
        {/* Barra de navegación móvil — solo visible en pantallas pequeñas */}
        {reciboSeleccionado && (
          <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
            <button
              onClick={() => setReciboSeleccionado(null)}
              className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm hover:text-blue-800 transition-colors"
            >
              <ArrowLeft size={18} />
              <span>Volver a lista</span>
            </button>
            <span className="text-gray-400 dark:text-gray-600 text-xs">|</span>
            <span className="text-gray-600 dark:text-gray-300 text-sm font-semibold truncate">Folio #{reciboSeleccionado.folio}</span>
          </div>
        )}
        {reciboSeleccionado ? (
          <div className="max-w-2xl mx-auto p-6">
            {/* Cabecera del recibo */}
            <div className="bg-gradient-to-br from-[#1a2f66] to-[#2a4d9e] rounded-2xl p-5 text-white mb-5 shadow-xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
              <div className="relative flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1 opacity-70">
                    <Receipt size={14} />
                    <span className="text-xs font-semibold uppercase tracking-widest">Recibo Digital</span>
                  </div>
                  <p className="text-3xl font-black tracking-tight">#{reciboSeleccionado.folio}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${reciboSeleccionado.estatus === 'ACTIVO' ? 'bg-emerald-500/30 border-emerald-400/50 text-emerald-200' : 'bg-red-500/30 border-red-400/50 text-red-200'}`}>
                      {reciboSeleccionado.estatus}
                    </span>
                    <span className="text-blue-200 text-xs mt-0.5">{reciboSeleccionado.fecha_recibo}</span>
                    {reciboSeleccionado.estatus_factura === 'FACTURADO' && (
                        <span className="text-amber-200 text-[11px] font-mono bg-amber-500/20 px-2 py-0.5 mt-0.5 rounded border border-amber-400/30 shadow-sm" title="Folio Fiscal Asentado">
                          FAC: {reciboSeleccionado.folio_fiscal}
                        </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={handleImprimir}
                    disabled={isGeneratingPDF}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-white/30 shadow-sm disabled:opacity-50"
                  >
                    {isGeneratingPDF ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                    Imprimir
                  </button>
                  {reciboSeleccionado.estatus === 'ACTIVO' && (
                    <button
                      onClick={() => handleCancelar(reciboSeleccionado.id)}
                      className="flex items-center gap-2 bg-red-500/30 hover:bg-red-500/50 text-red-100 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border border-red-400/50"
                    >
                      <XCircle size={15} /> Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {reciboSeleccionado.estatus === 'CANCELADO' && (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-xl font-bold mb-5 text-center border border-red-200 dark:border-red-800 text-sm">
                ⚠️ ESTE RECIBO ESTÁ CANCELADO
              </div>
            )}

            {/* Enlace al plan de pagos si tiene conceptos vinculados */}
            {(reciboSeleccionado.recibos_detalles || []).some(d => d.indice_concepto_plan != null) && onNavigateToPlan && (
              <div className="mb-5 flex justify-center">
                <button
                  onClick={() => onNavigateToPlan(reciboSeleccionado.alumno_id, String(reciboSeleccionado.folio))}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors shadow-sm"
                >
                  Ver Plan de Pagos Asociado
                </button>
              </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Alumno</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm leading-snug">{reciboSeleccionado.nombre_alumno}</p>
                {reciboSeleccionado.licenciatura && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{reciboSeleccionado.licenciatura}</p>
                )}
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Información de Pago</p>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Fecha Recibo:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{reciboSeleccionado.fecha_recibo}</span>
                  </div>
                  <div className="flex items-center justify-between group">
                    <span>Fecha Pago:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                      {reciboSeleccionado.fecha_pago}
                      {currentUser?.rol === 'ADMINISTRADOR' && (
                         <button onClick={() => { setEditingFechaPago(reciboSeleccionado); setFechaPagoInput(reciboSeleccionado.fecha_pago || ''); }} className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity" title="Modificar Fecha de Pago">✎</button>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between group">
                    <span>Forma de Pago:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                      {reciboSeleccionado.forma_pago}
                      {currentUser?.rol === 'ADMINISTRADOR' && (
                         <button onClick={() => { setEditingFormaPago(reciboSeleccionado); setFormaPagoInput(reciboSeleccionado.forma_pago || ''); setBancoInput(reciboSeleccionado.banco || ''); }} className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity" title="Modificar Forma de Pago">✎</button>
                      )}
                    </span>
                  </div>
                  {reciboSeleccionado.banco && reciboSeleccionado.banco !== 'NO APLICA' && (
                    <div className="flex items-center justify-between group">
                      <span>Banco:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                         {reciboSeleccionado.banco}
                         {currentUser?.rol === 'ADMINISTRADOR' && (
                            <button onClick={() => { setEditingFormaPago(reciboSeleccionado); setFormaPagoInput(reciboSeleccionado.forma_pago || ''); setBancoInput(reciboSeleccionado.banco || ''); }} className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity" title="Modificar Banco">✎</button>
                         )}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                    <span>Requiere Factura:</span>
                    {currentUser?.rol === 'ADMINISTRADOR' ? (
                      <button
                        onClick={() => handleToggleFactura(reciboSeleccionado.id, !!reciboSeleccionado.requiere_factura, reciboSeleccionado.estatus_factura || 'NO APLICA')}
                        className={`font-semibold px-2.5 py-0.5 rounded transition-colors text-xs ${
                          reciboSeleccionado.requiere_factura 
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                        title={reciboSeleccionado.requiere_factura ? 'Clic para desactivar' : 'Clic para activar'}
                      >
                        {reciboSeleccionado.requiere_factura ? 'SÍ (Facturable)' : 'NO'}
                      </button>
                    ) : (
                      <span className={`font-semibold px-2.5 py-0.5 rounded text-xs ${
                        reciboSeleccionado.requiere_factura 
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800' 
                          : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                      }`}>
                        {reciboSeleccionado.requiere_factura ? 'SÍ (Facturable)' : 'NO'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de conceptos */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm mb-5">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Conceptos Cobrados</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {(reciboSeleccionado.recibos_detalles || []).map(d => (
                  <div key={d.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">{d.cantidad}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 group">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{d.concepto}</p>
                        {currentUser?.rol === 'ADMINISTRADOR' && editandoConceptoId !== d.id && (
                          <button onClick={() => { setEditandoConceptoId(d.id); setTempConceptoText(d.concepto || ''); }} className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity" title="Editar Concepto">✎</button>
                        )}
                      </div>
                      {editandoConceptoId === d.id && (
                        <div className="mt-1 flex items-center gap-2 bg-blue-50/50 p-1.5 rounded border border-blue-200 shadow-inner mb-1">
                          <input type="text" className="text-xs w-full p-1.5 border border-blue-200 rounded outline-none focus:ring-1 focus:ring-blue-400 bg-white" autoFocus value={tempConceptoText} onChange={e => setTempConceptoText(e.target.value)} placeholder="Nombre del concepto..." />
                          <button disabled={guardandoConcepto} onClick={() => handleUpdateConcepto(d.id)} className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700 ml-auto transition-colors shadow-sm">
                            Guardar
                          </button>
                          <button disabled={guardandoConcepto} onClick={() => setEditandoConceptoId(null)} className="text-[10px] bg-gray-200 text-gray-700 px-3 py-1.5 rounded font-bold hover:bg-gray-300 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      )}
                      {d.observaciones && editandoObsId !== d.id && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] italic font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full px-2 py-0.5 inline-block">
                            ⚠ {d.observaciones}
                          </span>
                          {currentUser?.rol === 'ADMINISTRADOR' && (
                            <button onClick={() => { setEditandoObsId(d.id); setTempObsText(d.observaciones || ''); }} className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Editar Nota">✎</button>
                          )}
                        </div>
                      )}
                      {!d.observaciones && editandoObsId !== d.id && currentUser?.rol === 'ADMINISTRADOR' && (
                        <button onClick={() => { setEditandoObsId(d.id); setTempObsText(''); }} className="mt-1 text-[10px] text-gray-400 hover:text-blue-600 underline">
                          + Agregar nota a concepto
                        </button>
                      )}
                      {editandoObsId === d.id && (
                        <div className="mt-1 flex items-center gap-2 bg-blue-50/50 p-1.5 rounded border border-blue-200 shadow-inner">
                          <input type="text" className="text-xs w-full p-1.5 border border-blue-200 rounded outline-none focus:ring-1 focus:ring-blue-400 bg-white" autoFocus value={tempObsText} onChange={e => setTempObsText(e.target.value)} placeholder="Ej: Pago ajustado manual..." />
                          <button disabled={guardandoObs} onClick={() => handleUpdateObs(d.id)} className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700 ml-auto transition-colors shadow-sm">
                            Guardar
                          </button>
                          <button disabled={guardandoObs} onClick={() => setEditandoObsId(null)} className="text-[10px] bg-gray-200 text-gray-700 px-3 py-1.5 rounded font-bold hover:bg-gray-300 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      )}
                      {d.indice_concepto_plan ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="inline-block text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full font-semibold border border-blue-200 dark:border-blue-800">
                            Plan #{d.indice_concepto_plan}
                          </span>
                          <button 
                             onClick={() => handleUnlinkDetail(d.id, d.indice_concepto_plan as number)} 
                             className="text-red-500 hover:bg-red-50 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors"
                             title="Desvincular del Plan"
                          >
                             ✕
                          </button>
                        </div>
                      ) : reciboSeleccionado.estatus === 'ACTIVO' ? (
                        <button onClick={() => setVincularDetalle(d)} className="mt-0.5 text-[10px] text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 px-2 py-0.5 border border-amber-200 dark:border-amber-800 rounded-full font-bold transition-colors shadow-sm">
                          + Vincular
                        </button>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0 group">
                      <p className="text-[11px] text-gray-400">${d.costo_unitario.toFixed(2)}</p>
                      <div className="flex items-center justify-end gap-1">
                        {currentUser?.rol === 'ADMINISTRADOR' && editandoSubtotalId !== d.id && (
                          <button onClick={() => { setEditandoSubtotalId(d.id); setTempSubtotalMonto(d.subtotal); }} className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity" title="Editar Monto">✎</button>
                        )}
                        <p className="text-sm font-extrabold text-gray-800 dark:text-white">${d.subtotal.toFixed(2)}</p>
                      </div>
                      {editandoSubtotalId === d.id && (
                        <div className="mt-1 flex flex-col items-end gap-1 bg-blue-50/50 p-1.5 rounded border border-blue-200 shadow-inner min-w-[120px]">
                          <div className="flex items-center gap-1 w-full justify-end">
                            <span className="text-gray-500 font-bold text-xs">$</span>
                            <input type="number" className="text-xs w-full p-1 border border-blue-200 rounded outline-none focus:ring-1 focus:ring-blue-400 bg-white font-mono text-right" autoFocus value={tempSubtotalMonto} onChange={e => setTempSubtotalMonto(Number(e.target.value))} step="0.01" />
                          </div>
                          <div className="flex gap-1 justify-end w-full">
                            <button disabled={guardandoSubtotal} onClick={() => handleUpdateSubtotal(d.id, reciboSeleccionado!.id)} className="flex-1 text-[10px] bg-blue-600 text-white py-1 rounded font-bold hover:bg-blue-700 transition-colors shadow-sm">
                              Guardar
                            </button>
                            <button disabled={guardandoSubtotal} onClick={() => setEditandoSubtotalId(null)} className="flex-1 text-[10px] bg-gray-200 text-gray-700 py-1 rounded font-bold hover:bg-gray-300 transition-colors">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Valor Conceptos</p>
                  <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">{(reciboSeleccionado.recibos_detalles || []).length} items</p>
                </div>
                <p className="text-xl font-bold text-gray-700 dark:text-gray-300">${reciboSeleccionado.total.toFixed(2)}</p>
              </div>

              {(reciboSeleccionado.uso_saldo_a_favor || 0) > 0 && (
                <div className="flex items-center justify-between py-2 border-t border-emerald-200/50 dark:border-emerald-800/50">
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Uso de Monedero</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">-${reciboSeleccionado.uso_saldo_a_favor!.toFixed(2)}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t-2 border-emerald-300 dark:border-emerald-700">
                <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">TOTAL PAGADO EN CAJA</p>
                <p className="text-3xl font-black text-emerald-800 dark:text-emerald-300">${(reciboSeleccionado.total - (reciboSeleccionado.uso_saldo_a_favor || 0)).toFixed(2)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-96">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
              <Eye size={28} className="opacity-50" />
            </div>
            <p className="font-semibold text-sm">Selecciona un recibo</p>
            <p className="text-xs text-gray-400 mt-1">para ver sus detalles aquí</p>
          </div>
        )}
      </div>

      {/* Hidden PDF container */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none opacity-0 z-[-100]">
         {reciboSeleccionado && (
           <ReciboPlantillaPDF 
             ref={printRef}
             recibo={reciboSeleccionado}
             detalles={reciboSeleccionado.recibos_detalles || []}
             alumno={alumnos.find(a => a.id === reciboSeleccionado.alumno_id)}
             logoUrl={appConfig?.logoUrl}
             licenciaturasMetadata={catalogos?.licenciaturasMetadata}
           />
         )}
         
         {/* Rendering invisible nodes para exportación masiva */}
         {exportTargetList.map((r) => (
            <div key={`export-${r.id}`} ref={(el) => { exportRefs.current[r.id] = el; }}>
               <ReciboPlantillaPDF 
                 recibo={r}
                 detalles={r.recibos_detalles || []}
                 alumno={alumnos.find(a => a.id === r.alumno_id)}
                 logoUrl={appConfig?.logoUrl}
                 licenciaturasMetadata={catalogos?.licenciaturasMetadata}
               />
            </div>
         ))}
      </div>

      {massStatus.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 bg-blue-50/50 flex flex-col items-center justify-center text-center">
               {isProcessingMass ? <Loader2 size={36} className="text-blue-600 animate-spin mb-3" /> : <CheckSquare size={36} className="text-emerald-600 mb-3" />}
               <h3 className="font-bold text-gray-800 text-lg">Procesamiento Masivo</h3>
               <p className="text-sm font-semibold text-blue-800 mt-1">{massStatus.msg}</p>
            </div>
            {massStatus.results.length > 0 && !isProcessingMass && (
              <div className="p-4 overflow-y-auto max-h-60 bg-gray-50 border-b border-gray-100 divide-y divide-gray-200 text-sm">
                 {massStatus.results.map((res, i) => (
                    <div key={i} className="py-2 flex justify-between items-center pr-2">
                       <div><span className="font-bold text-gray-700 block">Folio #{res.folio}</span><span className="text-xs text-gray-500">{res.note}</span></div>
                       <span className={`px-2 py-1 rounded text-xs font-bold ${res.status === 'Éxito' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{res.status}</span>
                    </div>
                 ))}
              </div>
            )}
            {!isProcessingMass && (
              <div className="p-4 bg-white flex justify-end">
                 <button onClick={() => setMassStatus({ ...massStatus, isOpen: false, results: [] })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors">
                   Cerrar Reporte
                 </button>
              </div>
            )}
          </div>
        </div>
      )}

      {importarVisible && (
        <ImportarRegistrosCSV
          alumnos={alumnos}
          activeCiclo={activeCiclo}
          ciclos={ciclos}
          onImport={() => {
            setImportarVisible(false);
            cargarRecibos();
            if (onDataRefresh) onDataRefresh();
          }}
          onClose={() => setImportarVisible(false)}
        />
      )}

      {/* Modal Vincular Múltiple */}
      {vincularDetalle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800">Vincular a Plan de Pagos</h3>
              <button onClick={() => { setVincularDetalle(null); setVincularSeleccion([]); }} className="p-1 hover:bg-gray-200 rounded-lg"><XCircle size={18} className="text-gray-500" /></button>
            </div>

            {/* Cabecera informativa */}
            <div className="px-6 pt-5 pb-3">
              <p className="text-sm text-gray-600 mb-1">
                Concepto del recibo: <strong className="text-gray-800">{vincularDetalle.concepto}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Monto: <strong className="text-emerald-700">${vincularDetalle.subtotal.toFixed(2)}</strong>
              </p>
              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2 mt-3">
                Selecciona uno o más conceptos del plan a liquidar con este recibo.
              </p>
            </div>

            <div className="px-6 pb-4 overflow-y-auto max-h-72">
              {planesAlumno.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800 text-center">
                  El alumno no tiene un plan de pagos activo en este ciclo escolar.
                </div>
              ) : (
                <div className="space-y-4">
                  {planesAlumno.map(plan => {
                    const pendientes = [];
                    for (let i = 1; i <= 9; i++) {
                      const c = (plan as any)[`concepto_${i}`];
                      const e = (plan as any)[`estatus_${i}`];
                      if (c && !(e || '').toUpperCase().includes('PAGADO')) {
                        pendientes.push({ idx: i, concepto: c });
                      }
                    }
                    return (
                      <div key={plan.id}>
                        <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Plan: {plan.no_plan_pagos}</div>
                        {pendientes.length === 0 ? (
                          <div className="text-sm text-gray-400 italic">No hay conceptos PENDIENTES.</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {pendientes.map(p => {
                              const isSelected = vincularSeleccion.some(s => s.planId === plan.id && s.idx === p.idx);
                              return (
                                <label
                                  key={p.idx}
                                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                    checked={isSelected}
                                    onChange={() => toggleSeleccion(plan.id, p.idx)}
                                  />
                                  <span className="font-semibold text-gray-700 text-sm">{p.idx}. {p.concepto}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                disabled={linking}
                onClick={() => { setVincularDetalle(null); setVincularSeleccion([]); }}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                disabled={linking || vincularSeleccion.length === 0}
                onClick={handleConfirmarVinculacion}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {linking ? <Loader2 size={15} className="animate-spin" /> : null}
                {linking
                  ? 'Vinculando...'
                  : vincularSeleccion.length === 0
                  ? 'Selecciona conceptos'
                  : `Vincular ${vincularSeleccion.length} concepto${vincularSeleccion.length > 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Custom */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200/50 dark:border-gray-800 animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex items-center justify-end gap-3 font-semibold">
                <button 
                  onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl transition-colors"
                >
                  Regresar
                </button>
                <button 
                  onClick={() => {
                    if (confirmModal.onConfirm) confirmModal.onConfirm();
                  }} 
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                  Sí, actualizar nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Facturación */}
      {facturarRecibo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <FileText size={24} />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2">Asentar Factura</h3>
              <p className="text-sm text-gray-500 mb-4">
                Ingresa el folio fiscal o el identificador de la factura emitida para el folio <strong>{facturarRecibo.folio}</strong>.
              </p>
              <input
                type="text"
                autoFocus
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm uppercase mb-6"
                placeholder="Ej. ABC123XYZ, FAC-001..."
                value={folioFiscalInput}
                onChange={e => setFolioFiscalInput(e.target.value)}
              />
              <div className="flex items-center justify-end gap-3 font-semibold">
                <button 
                  onClick={() => { setFacturarRecibo(null); setFolioFiscalInput(''); }} 
                  className="px-4 py-2 hover:bg-gray-100 text-gray-600 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  disabled={!folioFiscalInput.trim()}
                  onClick={async () => {
                     const f = folioFiscalInput.trim().toUpperCase();
                     if (!f) return;
                     const err = await updateReciboFactura(facturarRecibo.id, f);
                     if (err) {
                        alert(`Error guardando factura: ${err}`);
                     } else {
                        // Actualizamos en local para no tener que refrescar toda la data
                        const rIndex = recibos.findIndex(r => r.id === facturarRecibo.id);
                        if (rIndex > -1) {
                           recibos[rIndex].estatus_factura = 'FACTURADO';
                           recibos[rIndex].folio_fiscal = f;
                        }
                        // Refrescar plan view string replacement locally if needed? DataRefresh will handle it, but for now we just close model
                        setFacturarRecibo(null);
                        setFolioFiscalInput('');
                        if (onDataRefresh) onDataRefresh();
                     }
                  }} 
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  Guardar Factura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Forma de Pago */}
      {editingFormaPago && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-black text-gray-900 mb-2">Modificar Forma de Pago</h3>
              <p className="text-sm text-gray-500 mb-4">
                Recibo: <strong>{editingFormaPago.folio}</strong>
              </p>
              
              <div className="space-y-3 mb-6">
                 <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Método</label>
                    <select className="w-full border border-gray-300 rounded-lg p-2.5 outline-none text-sm focus:ring-2 focus:ring-blue-500 bg-white" value={formaPagoInput} onChange={e => setFormaPagoInput(e.target.value)}>
                       <option value="">Seleccione...</option>
                       <option value="Depósito Bancario">Depósito Bancario</option>
                       <option value="Transferencia bancaria">Transferencia bancaria</option>
                       <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                       <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                       <option value="Efectivo">Efectivo</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Banco (Opcional)</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none text-sm focus:ring-2 focus:ring-blue-500 bg-white" placeholder="Ej. BBVA, NO APLICA" value={bancoInput} onChange={e => setBancoInput(e.target.value)} />
                 </div>
              </div>

              <div className="flex items-center justify-end gap-3 font-semibold">
                <button 
                  onClick={() => { setEditingFormaPago(null); }} 
                  className="px-4 py-2 hover:bg-gray-100 text-gray-600 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                     const { error } = await supabase.from('recibos').update({ forma_pago: formaPagoInput, banco: bancoInput || 'NO APLICA' }).eq('id', editingFormaPago.id);
                     if (error) { alert('Error: ' + error.message); return; }
                     
                     const rIndex = recibos.findIndex(r => r.id === editingFormaPago.id);
                     if (rIndex > -1) {
                         recibos[rIndex].forma_pago = formaPagoInput;
                         recibos[rIndex].banco = bancoInput || 'NO APLICA';
                     }
                     if (reciboSeleccionado && reciboSeleccionado.id === editingFormaPago.id) {
                         setReciboSeleccionado({ ...reciboSeleccionado, forma_pago: formaPagoInput, banco: bancoInput || 'NO APLICA' });
                     }
                     setEditingFormaPago(null);
                  }}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fecha de Pago */}
      {editingFechaPago && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-black text-gray-900 mb-2">Modificar Fecha de Pago</h3>
              <p className="text-sm text-gray-500 mb-4">
                Recibo: <strong>{editingFechaPago.folio}</strong>
              </p>
              
              <div className="space-y-3 mb-6">
                 <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Fecha de Pago</label>
                    <input type="date" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none text-sm focus:ring-2 focus:ring-blue-500 bg-white" value={fechaPagoInput} onChange={e => setFechaPagoInput(e.target.value)} />
                 </div>
              </div>

              <div className="flex items-center justify-end gap-3 font-semibold">
                <button 
                  onClick={() => { setEditingFechaPago(null); }} 
                  className="px-4 py-2 hover:bg-gray-100 text-gray-600 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                     const { error } = await supabase.from('recibos').update({ fecha_pago: fechaPagoInput }).eq('id', editingFechaPago.id);
                     if (error) { alert('Error: ' + error.message); return; }
                     
                     const rIndex = recibos.findIndex(r => r.id === editingFechaPago.id);
                     if (rIndex > -1) {
                         recibos[rIndex].fecha_pago = fechaPagoInput;
                     }
                     if (reciboSeleccionado && reciboSeleccionado.id === editingFechaPago.id) {
                         setReciboSeleccionado({ ...reciboSeleccionado, fecha_pago: fechaPagoInput });
                     }
                     setEditingFechaPago(null);
                  }}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
