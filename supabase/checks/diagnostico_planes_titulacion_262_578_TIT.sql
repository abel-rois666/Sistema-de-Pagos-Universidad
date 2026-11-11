-- SOLO LECTURA. Caso del folio mostrado en el reporte; no decide qué plan eliminar.
-- No incluye nombre, matrícula, importes ni datos fiscales.
select p.id plan_pago_id,p.alumno_id,p.ciclo_id,c.nombre ciclo,c.tipo_periodo,
       p.tipo_plan,p.no_plan_pagos,p.fecha_plan,
       (select count(*) from public.planes_pago_detalles d where d.plan_id=p.id) detalles_registrados,
       (select count(*) from public.planes_pago_detalles d where d.plan_id=p.id
         and btrim(coalesce(d.concepto,'')) not in ('','0')) conceptos_normalizados_validos,
       (select count(*) from jsonb_each_text(to_jsonb(p)) as x(clave,valor)
         where clave ~ '^concepto_([1-9]|1[0-8])$'
           and btrim(coalesce(valor,'')) not in ('','0')) conceptos_legados_validos,
       (select count(*) from public.vista_planes_pago v where v.id=p.id) filas_en_vista,
       to_jsonb(p)->>'created_at' creado_en_si_existe
from public.planes_pago p
left join public.ciclos_escolares c on c.id=p.ciclo_id
where btrim(p.no_plan_pagos)='262-578-TIT'
order by p.alumno_id,p.ciclo_id,p.id;
