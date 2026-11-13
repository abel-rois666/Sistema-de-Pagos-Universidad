-- ============================================================================
-- MIGRACIÓN: OPTIMIZACIÓN DE DISK I/O (ÍNDICES, RLS INITPLAN Y PAGOS RPC)
-- Fecha: 2026-11-13
-- Objetivo:
--   1. Eliminar índice único duplicado en alumnos_grupos y crear índices
--      faltantes en inscripciones_academicas, planes_pago y planes_pago_detalles.
--   2. Consolidar las actualizaciones de public.planes_pago dentro de
--      public.registrar_pago_transaccional en un único UPDATE por recibo,
--      reduciendo bloques sucios (dirtied blocks) y ejecuciones repetidas de triggers.
--   3. Evitar escrituras redundantes en public.sincronizar_detalles_plan_pago_editado
--      cuando los valores de planes_pago_detalles ya coinciden (IS NOT DISTINCT FROM).
--   4. Optimizar políticas RLS restrictivas de blindaje académico usando subconsultas
--      escalares (InitPlan) para evaluar el rol una sola vez por consulta en lugar
--      de por cada fila leída en inscripciones_academicas y tablas relacionadas.
-- ============================================================================

-- 1. Índices y limpieza de restricción duplicada
ALTER TABLE public.alumnos_grupos
  DROP CONSTRAINT IF EXISTS alumnos_grupos_alumno_id_grupo_id_asignatura_id_key;

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_id
  ON public.usuarios (auth_id);

CREATE INDEX IF NOT EXISTS idx_inscripciones_academicas_ciclo
  ON public.inscripciones_academicas (ciclo_id);

CREATE INDEX IF NOT EXISTS idx_planes_pago_alumno
  ON public.planes_pago (alumno_id);

CREATE INDEX IF NOT EXISTS idx_planes_pago_ciclo
  ON public.planes_pago (ciclo_id);

CREATE INDEX IF NOT EXISTS idx_pp_detalles_plan_indice
  ON public.planes_pago_detalles (plan_id, indice_concepto);

-- 2. Optimizar registrar_pago_transaccional (un solo UPDATE a planes_pago por cobro)
CREATE OR REPLACE FUNCTION public.registrar_pago_transaccional(
  p_recibo jsonb,
  p_detalles jsonb,
  p_plan_id uuid DEFAULT NULL,
  p_plan_updates jsonb DEFAULT NULL,
  p_alumno_id uuid DEFAULT NULL,
  p_saldo_delta numeric DEFAULT 0
) RETURNS jsonb AS $$
DECLARE
  v_recibo_id uuid;
  v_folio integer;
  v_detalle record;
  v_key text;
  v_val text;
  v_idx integer;
  v_sql text;
BEGIN
  -- 1. Insertar Recibo
  INSERT INTO public.recibos (
    fecha_recibo, fecha_pago, alumno_id, ciclo_id, total, forma_pago, banco,
    estatus, requiere_factura, estatus_factura, uso_saldo_a_favor
  )
  VALUES (
    (p_recibo->>'fecha_recibo')::date,
    (p_recibo->>'fecha_pago')::date,
    (p_recibo->>'alumno_id')::uuid,
    (p_recibo->>'ciclo_id')::uuid,
    (p_recibo->>'total')::numeric,
    p_recibo->>'forma_pago',
    p_recibo->>'banco',
    COALESCE(p_recibo->>'estatus', 'ACTIVO'),
    COALESCE((p_recibo->>'requiere_factura')::boolean, false),
    CASE WHEN COALESCE((p_recibo->>'requiere_factura')::boolean, false) THEN 'PENDIENTE' ELSE 'NO APLICA' END,
    COALESCE((p_recibo->>'uso_saldo_a_favor')::numeric, 0)
  ) RETURNING id, folio INTO v_recibo_id, v_folio;

  -- 2. Insertar Detalles
  FOR v_detalle IN SELECT * FROM jsonb_array_elements(p_detalles) LOOP
    INSERT INTO public.recibos_detalles (
      recibo_id, cantidad, concepto, costo_unitario, subtotal, indice_concepto_plan, observaciones
    )
    VALUES (
      v_recibo_id,
      (v_detalle.value->>'cantidad')::integer,
      v_detalle.value->>'concepto',
      (v_detalle.value->>'costo_unitario')::numeric,
      (v_detalle.value->>'subtotal')::numeric,
      NULLIF(v_detalle.value->>'indice_concepto_plan', '')::integer,
      v_detalle.value->>'observaciones'
    );
  END LOOP;

  -- 3. Actualizar Plan de Pagos (consolidado en un único UPDATE sobre planes_pago)
  IF p_plan_id IS NOT NULL AND p_plan_updates IS NOT NULL THEN
    v_sql := '';
    FOR v_key, v_val IN SELECT key, value#>>'{}' FROM jsonb_each(p_plan_updates) LOOP
      v_val := replace(v_val, '{{FOLIO}}', v_folio::text);
      IF v_key LIKE 'estatus_%' THEN
        v_idx := cast(split_part(v_key, '_', 2) as integer);
        UPDATE public.planes_pago_detalles
          SET estatus = v_val
          WHERE plan_id = p_plan_id
            AND indice_concepto = v_idx
            AND estatus IS DISTINCT FROM v_val;
      END IF;
      v_sql := CASE
        WHEN v_sql = '' THEN format('%I = %L', v_key, v_val)
        ELSE v_sql || ', ' || format('%I = %L', v_key, v_val)
      END;
    END LOOP;

    IF v_sql <> '' THEN
      EXECUTE format('UPDATE public.planes_pago SET %s WHERE id = %L', v_sql, p_plan_id);
    END IF;
  END IF;

  -- 4. Actualizar Monedero / Saldo a favor
  IF p_alumno_id IS NOT NULL AND p_saldo_delta <> 0 THEN
    UPDATE public.alumnos SET saldo_a_favor = COALESCE(saldo_a_favor, 0) + p_saldo_delta WHERE id = p_alumno_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'folio', v_folio, 'recibo_id', v_recibo_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Si sincronizar_detalles_plan_pago_editado está instalado, evitar UPDATE redundante cuando los valores ya coinciden
DO $opt_sync_plan$
BEGIN
  IF to_regprocedure('public.sincronizar_detalles_plan_pago_editado()') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.sincronizar_detalles_plan_pago_editado()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
      DECLARE
        v_anterior jsonb := to_jsonb(old);
        v_actual jsonb := to_jsonb(new);
        v_indice integer;
        v_cambio_concepto boolean;
        v_cambio_fecha boolean;
        v_cambio_cantidad boolean;
        v_cambio_estatus boolean;
        v_concepto text;
        v_fecha_texto text;
        v_fecha date;
        v_cantidad numeric;
        v_estatus text;
        v_detalle public.planes_pago_detalles%rowtype;
        v_total integer;
        v_aplicado numeric;
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM public.planes_pago_detalles d WHERE d.plan_id = new.id) THEN
          RETURN new;
        END IF;

        FOR v_indice IN 1..18 LOOP
          v_cambio_concepto := v_anterior ->> ('concepto_' || v_indice)
            IS DISTINCT FROM v_actual ->> ('concepto_' || v_indice);
          v_cambio_fecha := v_anterior ->> ('fecha_' || v_indice)
            IS DISTINCT FROM v_actual ->> ('fecha_' || v_indice);
          v_cambio_cantidad := v_anterior ->> ('cantidad_' || v_indice)
            IS DISTINCT FROM v_actual ->> ('cantidad_' || v_indice);
          v_cambio_estatus := v_anterior ->> ('estatus_' || v_indice)
            IS DISTINCT FROM v_actual ->> ('estatus_' || v_indice);
          IF NOT (v_cambio_concepto OR v_cambio_fecha OR v_cambio_cantidad OR v_cambio_estatus) THEN
            CONTINUE;
          END IF;

          SELECT count(*) INTO v_total FROM public.planes_pago_detalles d
            WHERE d.plan_id = new.id AND d.indice_concepto = v_indice;
          IF v_total > 1 THEN
            RAISE EXCEPTION 'El concepto % tiene detalles duplicados; revisa el plan antes de editarlo', v_indice;
          END IF;
          SELECT * INTO v_detalle FROM public.planes_pago_detalles d
            WHERE d.plan_id = new.id AND d.indice_concepto = v_indice FOR UPDATE;
          v_concepto := nullif(btrim(v_actual ->> ('concepto_' || v_indice)), '');

          IF v_concepto IS NULL THEN
            IF v_detalle.id IS NOT NULL THEN
              IF coalesce(v_detalle.estatus, 'PENDIENTE') <> 'PENDIENTE'
                OR EXISTS (SELECT 1 FROM public.planes_pago_vinculos_recibo v
                  WHERE v.plan_id = new.id AND v.indice_concepto = v_indice AND v.anulado_en IS NULL) THEN
                RAISE EXCEPTION 'El concepto % tiene pagos o vínculos; no puede eliminarse', v_indice;
              END IF;
              DELETE FROM public.planes_pago_detalles WHERE id = v_detalle.id;
            END IF;
            CONTINUE;
          END IF;

          v_cantidad := CASE WHEN v_cambio_cantidad OR v_detalle.id IS NULL
            THEN coalesce((v_actual ->> ('cantidad_' || v_indice))::numeric, 0)
            ELSE v_detalle.cantidad END;
          IF v_cantidad < 0 THEN
            RAISE EXCEPTION 'El concepto % no admite importe negativo', v_indice;
          END IF;
          SELECT coalesce(sum(v.importe), 0) INTO v_aplicado
            FROM public.planes_pago_vinculos_recibo v
            WHERE v.plan_id = new.id AND v.indice_concepto = v_indice AND v.anulado_en IS NULL;
          IF v_cantidad + 0.005 < v_aplicado THEN
            RAISE EXCEPTION 'El importe del concepto % es menor que sus vínculos confirmados', v_indice;
          END IF;

          IF NOT v_cambio_fecha AND v_detalle.id IS NOT NULL THEN
            v_fecha := v_detalle.fecha_vencimiento;
          ELSE
            v_fecha_texto := nullif(btrim(v_actual ->> ('fecha_' || v_indice)), '');
            IF v_fecha_texto IS NULL THEN
              v_fecha := NULL;
            ELSIF v_fecha_texto ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
              v_fecha := v_fecha_texto::date;
            ELSIF v_fecha_texto ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN
              v_fecha := to_date(v_fecha_texto, 'DD/MM/YYYY');
              IF to_char(v_fecha, 'DD/MM/YYYY')
                <> lpad(split_part(v_fecha_texto, '/', 1), 2, '0') || '/'
                  || lpad(split_part(v_fecha_texto, '/', 2), 2, '0') || '/'
                  || split_part(v_fecha_texto, '/', 3) THEN
                RAISE EXCEPTION 'Fecha inválida en el concepto %', v_indice;
              END IF;
            ELSE
              RAISE EXCEPTION 'Fecha inválida en el concepto %', v_indice;
            END IF;
          END IF;
          v_estatus := coalesce(nullif(btrim(v_actual ->> ('estatus_' || v_indice)), ''), 'PENDIENTE');

          IF v_detalle.id IS NULL THEN
            INSERT INTO public.planes_pago_detalles
              (plan_id, indice_concepto, concepto, fecha_vencimiento, cantidad, estatus)
            VALUES (new.id, v_indice, v_concepto, v_fecha, v_cantidad, v_estatus);
          ELSIF (v_cambio_concepto AND v_detalle.concepto IS DISTINCT FROM v_concepto)
            OR (v_cambio_fecha AND v_detalle.fecha_vencimiento IS DISTINCT FROM v_fecha)
            OR (v_detalle.cantidad IS DISTINCT FROM v_cantidad)
            OR (v_cambio_estatus AND v_detalle.estatus IS DISTINCT FROM v_estatus) THEN
            UPDATE public.planes_pago_detalles SET
              concepto = CASE WHEN v_cambio_concepto THEN v_concepto ELSE v_detalle.concepto END,
              fecha_vencimiento = CASE WHEN v_cambio_fecha THEN v_fecha ELSE v_detalle.fecha_vencimiento END,
              cantidad = v_cantidad,
              estatus = CASE WHEN v_cambio_estatus THEN v_estatus ELSE v_detalle.estatus END
            WHERE id = v_detalle.id;
          END IF;
        END LOOP;
        RETURN new;
      END;
      $$;
    $fn$;
  END IF;
END
$opt_sync_plan$;

-- 4. Si el blindaje académico por perfil está instalado, optimizar sus políticas RLS (InitPlan) y trigger
DO $opt_rls_academico$
DECLARE
  v_tabla text;
  v_roles text;
  v_rol_sql text;
BEGIN
  IF to_regprocedure('public.academico_alcance_docente_v1(uuid,uuid,uuid,uuid,uuid)') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'inscripciones_academicas' AND policyname = 'guardia_calificaciones_lectura_v1'
    ) THEN
      DROP POLICY IF EXISTS guardia_grupos_lectura_v1 ON public.grupos;
      CREATE POLICY guardia_grupos_lectura_v1 ON public.grupos AS RESTRICTIVE FOR SELECT TO public
      USING (
        (SELECT public.academico_usuario_activo_v1())
        AND ((SELECT coalesce(public.get_my_rol(), '') <> 'DOCENTE') OR public.academico_alcance_docente_v1(id))
      );

      DROP POLICY IF EXISTS guardia_relaciones_alumnos_lectura_v1 ON public.alumnos_grupos;
      CREATE POLICY guardia_relaciones_alumnos_lectura_v1 ON public.alumnos_grupos AS RESTRICTIVE FOR SELECT TO public
      USING (
        (SELECT public.academico_usuario_activo_v1())
        AND ((SELECT coalesce(public.get_my_rol(), '') <> 'DOCENTE') OR public.academico_alcance_docente_v1(grupo_id, alumno_id))
      );

      DROP POLICY IF EXISTS guardia_cargas_lectura_v1 ON public.docentes_grupos_asignaturas;
      CREATE POLICY guardia_cargas_lectura_v1 ON public.docentes_grupos_asignaturas AS RESTRICTIVE FOR SELECT TO public
      USING (
        (SELECT public.academico_usuario_activo_v1())
        AND (
          (SELECT coalesce(public.get_my_rol(), '') <> 'DOCENTE')
          OR (
            public.academico_alcance_docente_v1(grupo_id, null, null, asignatura_id)
            AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_id = auth.uid() AND u.docente_id = docentes_grupos_asignaturas.docente_id)
          )
        )
      );

      DROP POLICY IF EXISTS guardia_programas_lectura_v1 ON public.alumno_programas;
      CREATE POLICY guardia_programas_lectura_v1 ON public.alumno_programas AS RESTRICTIVE FOR SELECT TO public
      USING (
        (SELECT public.academico_usuario_activo_v1())
        AND ((SELECT coalesce(public.get_my_rol(), '') <> 'DOCENTE') OR public.academico_alcance_docente_v1(null, alumno_id, null, null, plan_id))
      );

      DROP POLICY IF EXISTS guardia_calificaciones_lectura_v1 ON public.inscripciones_academicas;
      CREATE POLICY guardia_calificaciones_lectura_v1 ON public.inscripciones_academicas AS RESTRICTIVE FOR SELECT TO public
      USING (
        (SELECT public.academico_usuario_activo_v1())
        AND ((SELECT coalesce(public.get_my_rol(), '') <> 'DOCENTE') OR public.academico_alcance_docente_v1(null, alumno_id, ciclo_id, asignatura_id))
      );

      FOREACH v_tabla IN ARRAY ARRAY['grupos', 'alumnos_grupos', 'docentes_grupos_asignaturas', 'alumno_programas', 'inscripciones_academicas'] LOOP
        v_roles := CASE
          WHEN v_tabla = 'alumno_programas' THEN '(''ADMINISTRADOR'',''COORDINADOR CONTROL ESCOLAR'')'
          WHEN v_tabla = 'inscripciones_academicas' THEN '(''ADMINISTRADOR'',''COORDINADOR CONTROL ESCOLAR'',''COORDINADOR ACADEMICO'',''DOCENTE'')'
          ELSE '(''ADMINISTRADOR'',''COORDINADOR CONTROL ESCOLAR'',''COORDINADOR ACADEMICO'')'
        END;
        v_rol_sql := '(SELECT public.academico_usuario_activo_v1() AND public.get_my_rol() IN ' || v_roles || ')';
        EXECUTE format('DROP POLICY IF EXISTS guardia_insertar_v1 ON public.%I', v_tabla);
        EXECUTE format('CREATE POLICY guardia_insertar_v1 ON public.%I AS RESTRICTIVE FOR INSERT TO public WITH CHECK (%s)', v_tabla, v_rol_sql);
        EXECUTE format('DROP POLICY IF EXISTS guardia_actualizar_v1 ON public.%I', v_tabla);
        EXECUTE format('CREATE POLICY guardia_actualizar_v1 ON public.%I AS RESTRICTIVE FOR UPDATE TO public USING (%s) WITH CHECK (%s)', v_tabla, v_rol_sql, v_rol_sql);
        EXECUTE format('DROP POLICY IF EXISTS guardia_eliminar_v1 ON public.%I', v_tabla);
        EXECUTE format('CREATE POLICY guardia_eliminar_v1 ON public.%I AS RESTRICTIVE FOR DELETE TO public USING (%s)', v_tabla, v_rol_sql);
      END LOOP;
    END IF;

    IF to_regprocedure('public.blindar_captura_docente_v1()') IS NOT NULL THEN
      EXECUTE $fn_blindar$
        CREATE OR REPLACE FUNCTION public.blindar_captura_docente_v1()
        RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
        DECLARE v_campo text; v_bloqueo text; v_nota numeric; v_promedio numeric; v_cambio boolean; v_rol text;
        BEGIN
          IF auth.role() = 'service_role' OR (auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN
            IF tg_op = 'DELETE' THEN RETURN old; ELSE RETURN new; END IF;
          END IF;
          SELECT u.rol INTO v_rol FROM public.usuarios u WHERE u.auth_id = auth.uid() AND u.activo IS TRUE LIMIT 1;
          IF v_rol IS NULL THEN RAISE EXCEPTION 'Se requiere un usuario activo.' USING ERRCODE = '42501'; END IF;
          IF v_rol NOT IN ('ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR', 'COORDINADOR ACADEMICO', 'DOCENTE') THEN
            RAISE EXCEPTION 'No tienes permiso para modificar calificaciones.' USING ERRCODE = '42501';
          END IF;
          IF v_rol <> 'DOCENTE' THEN IF tg_op = 'DELETE' THEN RETURN old; ELSE RETURN new; END IF; END IF;
          IF tg_op = 'DELETE' THEN RAISE EXCEPTION 'Un docente no puede eliminar la inscripción del alumno. Usa el guardado de la captura.' USING ERRCODE = '42501'; END IF;
          IF NOT public.academico_alcance_docente_v1(null, new.alumno_id, new.ciclo_id, new.asignatura_id) THEN RAISE EXCEPTION 'La materia y el alumno no pertenecen a tu carga.' USING ERRCODE = '42501'; END IF;
          IF tg_op = 'INSERT' AND (new.id_observacion_certificacion IS NOT NULL OR new.ciclo_legado IS NOT NULL) THEN
            RAISE EXCEPTION 'La información de certificación e importación corresponde a Control Escolar.' USING ERRCODE = '42501';
          END IF;
          FOREACH v_campo IN ARRAY ARRAY['parcial_1', 'parcial_2', 'parcial_3', 'calificacion_final', 'promedio_calculado'] LOOP
            v_nota := (to_jsonb(new) ->> v_campo)::numeric;
            IF v_nota IS NOT NULL AND v_nota <> -555 AND NOT (v_nota BETWEEN 0 AND 10) THEN RAISE EXCEPTION 'La calificación debe estar entre 0 y 10 o ser NP.'; END IF;
          END LOOP;
          IF new.modificada_manualmente IS TRUE AND nullif(trim(new.observaciones), '') IS NULL THEN
            RAISE EXCEPTION 'Justifica la modificación de la calificación final.';
          END IF;
          v_cambio := tg_op = 'INSERT';
          IF tg_op = 'UPDATE' THEN
            v_cambio := row(new.parcial_1, new.parcial_2, new.parcial_3, new.calificacion_final, new.promedio_calculado)
              IS DISTINCT FROM row(old.parcial_1, old.parcial_2, old.parcial_3, old.calificacion_final, old.promedio_calculado);
          END IF;
          IF v_cambio AND new.calificacion_final IS NOT NULL AND NOT coalesce(new.modificada_manualmente, false) THEN
            IF new.parcial_1 IS NULL OR new.parcial_2 IS NULL OR new.parcial_3 IS NULL THEN
              RAISE EXCEPTION 'La final capturada directamente requiere modificación manual y justificación.';
            END IF;
            v_promedio := CASE WHEN new.parcial_1 = -555 AND new.parcial_2 = -555 AND new.parcial_3 = -555 THEN -555 ELSE
              ((CASE WHEN new.parcial_1 = -555 THEN 0 ELSE new.parcial_1 END)
              + (CASE WHEN new.parcial_2 = -555 THEN 0 ELSE new.parcial_2 END)
              + (CASE WHEN new.parcial_3 = -555 THEN 0 ELSE new.parcial_3 END)) / 3 END;
            IF new.calificacion_final IS DISTINCT FROM round(v_promedio)
              OR new.promedio_calculado IS DISTINCT FROM round(v_promedio, 2) THEN
              RAISE EXCEPTION 'La final automática debe corresponder a sus parciales. Justifica una final manual.';
            END IF;
          END IF;
          IF tg_op = 'UPDATE' THEN
            IF (to_jsonb(new) - ARRAY['parcial_1', 'parcial_2', 'parcial_3', 'promedio_calculado', 'calificacion_final', 'modificada_manualmente', 'observaciones', 'estatus', 'tipo_evaluacion', 'bloqueo_p1', 'bloqueo_p2', 'bloqueo_p3', 'bloqueo_final', 'solicitud_p1', 'solicitud_p2', 'solicitud_p3', 'solicitud_final', 'updated_at'])
              IS DISTINCT FROM (to_jsonb(old) - ARRAY['parcial_1', 'parcial_2', 'parcial_3', 'promedio_calculado', 'calificacion_final', 'modificada_manualmente', 'observaciones', 'estatus', 'tipo_evaluacion', 'bloqueo_p1', 'bloqueo_p2', 'bloqueo_p3', 'bloqueo_final', 'solicitud_p1', 'solicitud_p2', 'solicitud_p3', 'solicitud_final', 'updated_at']) THEN
              RAISE EXCEPTION 'No puedes modificar la identidad ni los datos institucionales de la inscripción.' USING ERRCODE = '42501';
            END IF;
            FOREACH v_campo IN ARRAY ARRAY['parcial_1', 'parcial_2', 'parcial_3', 'calificacion_final'] LOOP
              v_bloqueo := CASE v_campo WHEN 'parcial_1' THEN 'bloqueo_p1' WHEN 'parcial_2' THEN 'bloqueo_p2' WHEN 'parcial_3' THEN 'bloqueo_p3' ELSE 'bloqueo_final' END;
              IF coalesce((to_jsonb(old) ->> v_bloqueo)::boolean, false) AND (
                to_jsonb(old) -> v_campo IS DISTINCT FROM to_jsonb(new) -> v_campo OR NOT coalesce((to_jsonb(new) ->> v_bloqueo)::boolean, false)
              ) THEN RAISE EXCEPTION 'Solicita autorización para corregir una calificación bloqueada.' USING ERRCODE = '42501'; END IF;
            END LOOP;
          END IF;
          RETURN new;
        END $$;
      $fn_blindar$;
    END IF;
  END IF;
END
$opt_rls_academico$;
