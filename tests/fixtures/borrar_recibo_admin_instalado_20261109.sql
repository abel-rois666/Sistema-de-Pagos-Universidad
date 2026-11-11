DECLARE
  v_uso_saldo numeric;
  v_alumno_id uuid;
  v_recibo record;
BEGIN
  -- 1. Obtener info del recibo
  SELECT * INTO v_recibo FROM recibos WHERE id = p_recibo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo no encontrado';
  END IF;

  v_uso_saldo := v_recibo.uso_saldo_a_favor;
  v_alumno_id := v_recibo.alumno_id;

  -- 2. Devolver saldo a favor si se usó
  IF v_uso_saldo > 0 THEN
    UPDATE alumnos
    SET saldo_a_favor = saldo_a_favor + v_uso_saldo
    WHERE id = v_alumno_id;
  END IF;

  -- Nota: El estatus del Plan de Pagos (planes_pago) se debe revertir manualmente
  -- en la interfaz, igual que sucede cuando se cancela un recibo.

  -- 3. Borrar el recibo (y en cascada sus detalles)
  DELETE FROM recibos WHERE id = p_recibo_id;

  -- 4. Reajustar el folio al MAX(folio) actual para no dejar huecos
  PERFORM setval(
    pg_get_serial_sequence('recibos', 'folio'),
    COALESCE((SELECT MAX(folio) FROM recibos), 1),
    (SELECT MAX(folio) IS NOT NULL FROM recibos)
  );

END;
