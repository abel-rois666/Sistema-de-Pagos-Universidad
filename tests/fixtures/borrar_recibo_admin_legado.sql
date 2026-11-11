
DECLARE
  v_uso_saldo numeric;
  v_alumno_id uuid;
  v_recibo record;
BEGIN
  SELECT * INTO v_recibo FROM public.recibos WHERE id = p_recibo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo no encontrado';
  END IF;

  v_uso_saldo := v_recibo.uso_saldo_a_favor;
  v_alumno_id := v_recibo.alumno_id;

  -- Devolver saldo a favor si se usó
  IF v_uso_saldo > 0 AND v_alumno_id IS NOT NULL THEN
    UPDATE public.alumnos
    SET saldo_a_favor = COALESCE(saldo_a_favor, 0) + v_uso_saldo
    WHERE id = v_alumno_id;
  END IF;

  -- Borrar recibo (en cascada sus detalles)
  DELETE FROM public.recibos WHERE id = p_recibo_id;

  -- Reajustar secuencia de folios
  PERFORM setval(
    'public.recibos_folio_seq', 
    COALESCE((SELECT MAX(folio) FROM public.recibos), 1000), 
    (SELECT MAX(folio) IS NOT NULL FROM public.recibos)
  );
END;
