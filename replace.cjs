const fs = require('fs');

const file = 'src/components/ConsultarRegistros.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports and state
content = content.replace(
  "import { useAppStore } from '../store/useAppStore';",
  "import { useAppStore } from '../store/useAppStore';\nimport ModalConfirmacion, { ModalConfirmacionProps } from './ui/ModalConfirmacion';"
);

content = content.replace(
  "  const [isProcessingMass, setIsProcessingMass] = useState(false);",
  "  const [isProcessingMass, setIsProcessingMass] = useState(false);\n  const [systemConfirmModal, setSystemConfirmModal] = useState<ModalConfirmacionProps>({ isOpen: false, title: '', message: '', onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })) });"
);

// 2. executeMassCancel
content = content.replace(
  "    if (!window.confirm(`¿Estás seguro de cancelar ${selectedReceiptIds.size} recibos seleccionados de forma permanente?`)) return;\n    \n    setIsProcessingMass(true);",
  `    setSystemConfirmModal({
      isOpen: true,
      title: 'Cancelación Masiva',
      message: \`¿Estás seguro de cancelar \${selectedReceiptIds.size} recibos seleccionados de forma permanente?\`,
      type: 'danger',
      onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setSystemConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsProcessingMass(true);`
);
content = content.replace(
  "    setIsProcessingMass(false);\n  };",
  "    setIsProcessingMass(false);\n      }\n    });\n  };"
);

// 3. handleUnlinkDetail
content = content.replace(
  "      if (!window.confirm(`¿Estás seguro de desvincular este cobro del Plan #${idx}? Su estatus en el plan regresará a PENDIENTE.`)) return;\n\n      const { error } = await supabase.from('recibos_detalles').update({ indice_concepto_plan: null, observaciones: null }).eq('id', detalleId);",
  `      setSystemConfirmModal({
        isOpen: true,
        title: 'Desvincular Cobro',
        message: \`¿Estás seguro de desvincular este cobro del Plan #\${idx}? Su estatus en el plan regresará a PENDIENTE.\`,
        type: 'warning',
        onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })),
        onConfirm: async () => {
          setSystemConfirmModal(prev => ({ ...prev, isOpen: false }));
          const { error } = await supabase.from('recibos_detalles').update({ indice_concepto_plan: null, observaciones: null }).eq('id', detalleId);`
);
content = content.replace(
  "      });\n      if (onDataRefresh) onDataRefresh();\n  };\n\n  useEffect(() => {",
  "      });\n      if (onDataRefresh) onDataRefresh();\n        }\n      });\n  };\n\n  useEffect(() => {"
);

// 4. handleCancelar
content = content.replace(
  "    if (!window.confirm('¿Estás seguro de cancelar este recibo? El estatus del Plan de Pagos NO se revertirá automáticamente.')) return;\n    const err = await cancelarRecibo(id);",
  `    setSystemConfirmModal({
      isOpen: true,
      title: 'Cancelar Recibo',
      message: '¿Estás seguro de cancelar este recibo? El estatus del Plan de Pagos NO se revertirá automáticamente.',
      type: 'danger',
      onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setSystemConfirmModal(prev => ({ ...prev, isOpen: false }));
        const err = await cancelarRecibo(id);`
);
content = content.replace(
  "      alert('Error cancelando recibo: ' + err);\n    }\n  };",
  "      alert('Error cancelando recibo: ' + err);\n        }\n      }\n    });\n  };"
);

// 5. handleToggleFactura
const toggleBlockOld = `    if (!newStatus && currentFacturaEstatus === 'FACTURADO') {
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
  };`;

const toggleBlockNew = `    const performFacturaToggle = async (status: boolean) => {
      const newEstatusFactura = status ? 'PENDIENTE' : 'NO APLICA';
      const updatePayload: any = {
          requiere_factura: status,
          estatus_factura: newEstatusFactura,
      };
      if (!status) {
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

    if (!newStatus && currentFacturaEstatus === 'FACTURADO') {
       setSystemConfirmModal({
         isOpen: true,
         title: 'Desvincular Factura',
         message: 'Este recibo ya tiene un folio fiscal asignado. Si quitas la opción de factura, perderás el folio fiscal registrado en este recibo. ¿Deseas continuar?',
         type: 'warning',
         onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })),
         onConfirm: async () => {
           setSystemConfirmModal(prev => ({ ...prev, isOpen: false }));
           await performFacturaToggle(newStatus);
         }
       });
       return;
    }

    await performFacturaToggle(newStatus);
  };`;
content = content.replace(toggleBlockOld, toggleBlockNew);

// 6. handleRepararHistoricos
content = content.replace(
  "    if (!window.confirm('¿Estás seguro de ejecutar la reparación masiva? Esto reasignará los recibos mal vinculados a sus ciclos históricos empleando cercanía de fechas.')) return;\n    \n    setLoading(true);",
  `    setSystemConfirmModal({
      isOpen: true,
      title: 'Reparación Masiva de Históricos',
      message: '¿Estás seguro de ejecutar la reparación masiva? Esto reasignará los recibos mal vinculados a sus ciclos históricos empleando cercanía de fechas.',
      type: 'warning',
      onCancel: () => setSystemConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setSystemConfirmModal(prev => ({ ...prev, isOpen: false }));
        setLoading(true);`
);
content = content.replace(
  "    setTimeout(() => {\n      setMassStatus(prev => ({ ...prev, isOpen: false }));\n    }, 8000);\n  };",
  "    setTimeout(() => {\n      setMassStatus(prev => ({ ...prev, isOpen: false }));\n    }, 8000);\n      }\n    });\n  };"
);

// 7. Render Modal
content = content.replace(
  "        </div>\n      )}\n\n    </div>\n  );\n}",
  "        </div>\n      )}\n\n      <ModalConfirmacion {...systemConfirmModal} />\n    </div>\n  );\n}"
);

fs.writeFileSync(file, content, 'utf8');
