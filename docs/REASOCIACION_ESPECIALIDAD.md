# Reasociación de Especialidad Cuatrimestral

Preparada el 10/11/2026, no ejecutada. El mensaje «otro ciclo ordinario» procedía de una lista cerrada que rechazaba Especialidad Cuatrimestral antes de revisar antecedentes. No demuestra ausencia de programas o grupos. El formulario ahora diferencia No evaluado de cero.

El cliente utiliza `revisar_reasociacion_especialidad_pago` exclusivamente para ese tipo financiero. No intenta mover recibos con la revisión ordinaria ni recurre a ella si falta la actualización. Mantiene el tipo Especialidad Cuatrimestral, el mismo periodo nominal y un destino Cuatrimestral distinto por UUID. Exige un programa vigente único de nivel Especialidad y periodicidad coincidente. Admite ausencia de grupo, pero bloquea grupos contradictorios, grupo en origen u otro plan en los ciclos involucrados.

La operación conserva recibos (también con factura), folios, montos, conceptos, índices, estados de pago y vínculos explícitos en sus ciclos originales. No acredita pagos ni monedero. Los detalles pendientes de conciliación se siguen informando; no se corrigen automáticamente. Audita exclusivamente el cambio del ID de ciclo del plan. Especialidad Completa y Titulación no están incluidas.

## Instalación pendiente

1. Revisar `supabase/checks/preflight_reasociacion_especialidad.sql`. Contrastar auditoría, vínculos, columnas, permisos y triggers instalados. Requiere la conciliación previa y su auditoría con recibos_conservados_ids.
2. Ensayar con datos ficticios la migración `20261110110000_reasociar_especialidad_cuatrimestral.sql`, que solo añade una función. No modifica planes al instalar.
3. Aplicar completa cuando se haya revisado el preflight y verificar `supabase/checks/verificar_reasociacion_especialidad.sql`: una función, SECURITY DEFINER, search_path vacío, acceso anónimo false y autenticado true (la función verifica el rol).
4. Publicar el cliente coordinadamente; abrir Revisar asociación, comprobar destino y confirmar expresamente el movimiento. Instalar SQL no mueve registros.

Pruebas locales de contrato no sustituyen ensayos de permisos, concurrencia y rollback en PostgreSQL. No se ejecutó SQL ni se modificaron datos reales; revisión visual pendiente.

Verificación local: tipado y compilación correctos, 408 pruebas aprobadas; se conserva el aviso previo de paquetes grandes. Las tres pruebas nuevas verifican contratos de tipo, conservación de categoría/recibos y autorización; no ejecutan PostgreSQL.
