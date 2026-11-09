# Conciliación de recibos entre periodos

Preparada el 06/11/2026 con autorización de SQL y código. No aplicada a Supabase ni publicada. Amplía la entrega inicial de consulta financiera; no reasocia recibos ni planes al instalarse.

## Flujo operativo

Desde el plan, alumno/plan/concepto son el destino fijo. Se consultan inicialmente los recibos del periodo del plan; «Buscar en otros periodos» abre el historial paginado. Desde el recibo, se elige el periodo, el plan exacto y su concepto. En ambas entradas se usa el mismo diálogo y servicio.

Cuando los nombres de los periodos difieren (por ejemplo 2026-3 y 2027-1), Administración o Coordinación Financiera debe seleccionar un motivo y escribir una referencia verificable de respaldo. Los textos de los conceptos no tienen que coincidir. Un ciclo desconocido no se sustituye por el activo.

La conciliación entre periodos se realiza sobre un concepto por vez:

- **Registrar vínculo histórico:** reconoce un pago ya efectuado. Guarda el vínculo y la auditoría; conserva íntegros el recibo, el detalle, el texto del plan y el monedero. El folio/abono/resta se deriva de los vínculos cuando la observación es PENDIENTE o NO PAGADO. El remanente histórico no genera saldo nuevo.
- **Aplicar anticipo disponible:** exige ausencia de aplicaciones o conciliaciones previas, incluso anuladas, índice legado y antecedentes de monedero. Aplica hasta cubrir el pendiente comprobado; el excedente nuevo se acredita una sola vez con su bitácora. Si el dinero ya está en el monedero se utiliza mediante el cobro con monedero existente, sin recrearlo aquí.

La revisión muestra origen, destino, importe, vínculos previos, excedente previo, motivo, respaldo y efecto económico. Confirmar exige aceptar ese resumen. Cambiar importe, selección, motivo, respaldo o datos del servidor invalida la revisión. Un reintento posterior a la confirmación no crea una segunda aplicación.

## Garantías y límites

- Solo recibo activo, mismo alumno, ciclos existentes, tipo de plan coherente con destino y concepto real. Los detalles normalizados no se completan desde columnas residuales.
- La disponibilidad del recibo descuenta vínculos activos y excedentes registrados. Una referencia de monedero sin importe verificable requiere revisión. No se presume que registros históricos incompletos acrediten dinero disponible.
- Los vínculos nunca superan el importe del detalle ni la capacidad del concepto. Las aplicaciones habituales también consideran los vínculos históricos aunque el texto siga diciendo Pendiente; texto y vínculo no se suman dos veces.
- La operación histórica admite reconocer un concepto previamente liquidado sin cobrarlo de nuevo. La aplicación nueva sí exige saldo pendiente comprobable. Observaciones manuales distintas se conservan en la presentación tradicional.
- El ciclo original, fechas, folio, total y datos fiscales del recibo permanecen intactos. La facturación pendiente no bloquea por sí misma una conciliación que no altera esos datos.
- Hay bloqueos transaccionales de detalle/recibo/plan, comparación de revisión y auditoría dentro de la misma transacción. Si falla la auditoría se revierte todo.
- Caja conserva su recorrido habitual del mismo ciclo; no puede confirmar conciliaciones entre periodos. No se cambian las funciones de emisión o cancelación, ni se transfieren saldos existentes entre alumnos.

## Instalación

1. Revisar la [instalación financiera anterior](APLICACION_CORRECCIONES_FINANCIERAS_20261106.md). Instalar y verificar `20261106120000_consulta_y_operaciones_financieras.sql` si aún falta; no reejecutar indiscriminadamente las migraciones históricas.
2. Ejecutar `supabase/checks/preflight_conciliacion_entre_periodos_20261106.sql` (solo lectura) y contrastar las definiciones y triggers con el servidor real. Conservar definiciones previas y respaldo.
3. Instalar completa `supabase/migrations/20261106150000_conciliacion_recibos_entre_periodos.sql`. Añade una RPC y un helper privado; mantiene las firmas de `vinculacion_financiera_v1` y `vincular_recibo_detalle_planes_v2`, actualizando el límite de saldo por vínculos y la protección de antecedentes auditados. No desactiva RLS ni triggers.
4. Ejecutar `supabase/checks/verificar_conciliacion_entre_periodos_20261106.sql`: RPC instalada, anónima false, autenticada true; ambas funciones limitan por vínculos true; helper directo/anónimo false; auditoría RLS true, escritura directa/lectura anónima false.
5. Publicar el cliente después del servidor. Una función ausente produce error explícito y conserva la captura; no existe fallback que mueva el recibo o aplique dinero con las funciones antiguas.
6. Verificar operaciones reales autorizadas por rol y comparar el saldo antes/después. No crear ni cancelar recibos ficticios en producción.

## Verificación local

Las pruebas de SQL usan exclusivamente `ensayo_finanzas`, datos ficticios y PostgreSQL 18.3 local. Incluyen recibo con factura pendiente intacto, abonos históricos sucesivos, aplicación habitual limitada por vínculos, anticipo y excedente único, reintentos, falta de respaldo, alumno distinto, cancelación, permisos, revisión caducada, índice residual y rollback posterior al movimiento. No equivalen a comprobar los triggers adicionales o PostgreSQL 17.6 de producción.

El ensayo de interfaz `scripts/ensayoFinanzas.html?vinculo=plan` y `?vinculo=recibo` intercepta conexiones externas. Los valores y RPC simulados sirven para verificar presentación e interacción; las reglas económicas se comprueban aparte en PostgreSQL.

Resultado de esta entrega: tipado y compilación aprobados, 255 pruebas de la aplicación y 84 comprobaciones SQL locales (41 previas y 43 de la ampliación). Revisados ambos recorridos, motivo/respaldo obligatorios, invalidación de revisión al editar el respaldo, descarte protegido y confirmación ficticia de vínculo/anticipo. Revisadas vistas de 390, 820 y 1280 px en ambos temas, con acciones visibles y sin desbordamiento horizontal de página en los casos comprobados. La compilación conserva los avisos previos de chunks grandes. No se midió carga real ni se realizaron operaciones o pruebas simultáneas en producción. El servidor PostgreSQL de ensayo y el servidor web local se detienen al finalizar.
