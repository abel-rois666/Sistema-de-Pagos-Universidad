-- ====================================================================================
-- SCRIPT DE ACTUALIZACIÓN DE ASIGNATURAS - CLAVE DE CERTIFICACIÓN POR PLAN DE ESTUDIOS
-- ====================================================================================

-- 1. Añadir la columna clave_certificacion a la tabla asignaturas
ALTER TABLE asignaturas ADD COLUMN IF NOT EXISTS clave_certificacion INT;

-- 2. Ejecutar las actualizaciones de forma segura buscando el plan de estudios correspondiente
DO $$
DECLARE
  pid_admin_2001 UUID;
  pid_admin_2017 UUID;
  pid_conta_2001 UUID;
  pid_conta_2017 UUID;
  pid_derecho_2001 UUID;
  pid_derecho_2017 UUID;
  pid_merca_2001 UUID;
  pid_peda_2001 UUID;
  pid_peda_2017 UUID;
  pid_psico_2009 UUID;
  pid_admin_neg_2009 UUID;
  pid_derecho_penal_2009 UUID;
  pid_docencia_2009 UUID;
BEGIN
  -- Intentamos buscar los planes por el nombre de la carrera y el nombre del plan, contemplando carrera_id o licenciatura_id
  SELECT p.id INTO pid_admin_2001 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Administración%' AND c.nombre NOT ILIKE '%Negocios%' AND (p.nombre ILIKE '%2001%' OR p.clave_legado ILIKE '%2001%') LIMIT 1;
  SELECT p.id INTO pid_admin_2017 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Administración%' AND c.nombre NOT ILIKE '%Negocios%' AND (p.nombre ILIKE '%2017%' OR p.clave_legado ILIKE '%2017%') LIMIT 1;
  SELECT p.id INTO pid_conta_2001 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Contaduría%' AND (p.nombre ILIKE '%2001%' OR p.clave_legado ILIKE '%2001%') LIMIT 1;
  SELECT p.id INTO pid_conta_2017 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Contaduría%' AND (p.nombre ILIKE '%2017%' OR p.clave_legado ILIKE '%2017%') LIMIT 1;
  SELECT p.id INTO pid_derecho_2001 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Derecho%' AND c.nombre NOT ILIKE '%Penal%' AND (p.nombre ILIKE '%2001%' OR p.clave_legado ILIKE '%2001%') LIMIT 1;
  SELECT p.id INTO pid_derecho_2017 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Derecho%' AND c.nombre NOT ILIKE '%Penal%' AND (p.nombre ILIKE '%2017%' OR p.clave_legado ILIKE '%2017%') LIMIT 1;
  SELECT p.id INTO pid_merca_2001 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Mercadotecnia%' AND (p.nombre ILIKE '%2001%' OR p.clave_legado ILIKE '%2001%') LIMIT 1;
  SELECT p.id INTO pid_peda_2001 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Pedagogía%' AND (p.nombre ILIKE '%2001%' OR p.clave_legado ILIKE '%2001%') LIMIT 1;
  SELECT p.id INTO pid_peda_2017 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Pedagogía%' AND (p.nombre ILIKE '%2017%' OR p.clave_legado ILIKE '%2017%') LIMIT 1;
  SELECT p.id INTO pid_psico_2009 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Psicología%' AND (p.nombre ILIKE '%2009%' OR p.clave_legado ILIKE '%2009%') LIMIT 1;
  SELECT p.id INTO pid_admin_neg_2009 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Administración de Negocios%' AND (p.nombre ILIKE '%2009%' OR p.clave_legado ILIKE '%2009%') LIMIT 1;
  SELECT p.id INTO pid_derecho_penal_2009 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Derecho Penal%' AND (p.nombre ILIKE '%2009%' OR p.clave_legado ILIKE '%2009%') LIMIT 1;
  SELECT p.id INTO pid_docencia_2009 FROM planes_estudio p JOIN carreras c ON (p.carrera_id = c.id OR p.licenciatura_id = c.id) WHERE c.nombre ILIKE '%Docencia%' AND (p.nombre ILIKE '%2009%' OR p.clave_legado ILIKE '%2009%') LIMIT 1;

  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 1 WHERE plan_id = pid_admin_2001 AND clave_legado = '0101';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 2 WHERE plan_id = pid_admin_2001 AND clave_legado = '0102';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 3 WHERE plan_id = pid_admin_2001 AND clave_legado = '0103';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 4 WHERE plan_id = pid_admin_2001 AND clave_legado = '0104';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 5 WHERE plan_id = pid_admin_2001 AND clave_legado = '0105';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 6 WHERE plan_id = pid_admin_2001 AND clave_legado = '0106';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 7 WHERE plan_id = pid_admin_2001 AND clave_legado = '0107';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 8 WHERE plan_id = pid_admin_2001 AND clave_legado = '0208';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 9 WHERE plan_id = pid_admin_2001 AND clave_legado = '0209';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 10 WHERE plan_id = pid_admin_2001 AND clave_legado = '0210';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 11 WHERE plan_id = pid_admin_2001 AND clave_legado = '0211';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 12 WHERE plan_id = pid_admin_2001 AND clave_legado = '0212';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 13 WHERE plan_id = pid_admin_2001 AND clave_legado = '0213';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 14 WHERE plan_id = pid_admin_2001 AND clave_legado = '0214';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 15 WHERE plan_id = pid_admin_2001 AND clave_legado = '0315';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 16 WHERE plan_id = pid_admin_2001 AND clave_legado = '0316';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 17 WHERE plan_id = pid_admin_2001 AND clave_legado = '0317';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 18 WHERE plan_id = pid_admin_2001 AND clave_legado = '0318';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 19 WHERE plan_id = pid_admin_2001 AND clave_legado = '0319';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 20 WHERE plan_id = pid_admin_2001 AND clave_legado = '0320';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 21 WHERE plan_id = pid_admin_2001 AND clave_legado = '0321';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 22 WHERE plan_id = pid_admin_2001 AND clave_legado = '0422';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 23 WHERE plan_id = pid_admin_2001 AND clave_legado = '0423';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 24 WHERE plan_id = pid_admin_2001 AND clave_legado = '0424';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 25 WHERE plan_id = pid_admin_2001 AND clave_legado = '0425';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 26 WHERE plan_id = pid_admin_2001 AND clave_legado = '0426';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 27 WHERE plan_id = pid_admin_2001 AND clave_legado = '0427';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 28 WHERE plan_id = pid_admin_2001 AND clave_legado = '0428';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 29 WHERE plan_id = pid_admin_2001 AND clave_legado = '0529';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 30 WHERE plan_id = pid_admin_2001 AND clave_legado = '0530';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 31 WHERE plan_id = pid_admin_2001 AND clave_legado = '0531';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 32 WHERE plan_id = pid_admin_2001 AND clave_legado = '0532';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 33 WHERE plan_id = pid_admin_2001 AND clave_legado = '0533';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 34 WHERE plan_id = pid_admin_2001 AND clave_legado = '0534';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 35 WHERE plan_id = pid_admin_2001 AND clave_legado = '0535';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 36 WHERE plan_id = pid_admin_2001 AND clave_legado = '0636';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 37 WHERE plan_id = pid_admin_2001 AND clave_legado = '0637';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 38 WHERE plan_id = pid_admin_2001 AND clave_legado = '0638';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 39 WHERE plan_id = pid_admin_2001 AND clave_legado = '0639';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 40 WHERE plan_id = pid_admin_2001 AND clave_legado = '0640';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 41 WHERE plan_id = pid_admin_2001 AND clave_legado = '0641';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 42 WHERE plan_id = pid_admin_2001 AND clave_legado = '0742';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 43 WHERE plan_id = pid_admin_2001 AND clave_legado = '0743';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 44 WHERE plan_id = pid_admin_2001 AND clave_legado = '0744';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 45 WHERE plan_id = pid_admin_2001 AND clave_legado = '0745';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 46 WHERE plan_id = pid_admin_2001 AND clave_legado = '0746';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 47 WHERE plan_id = pid_admin_2001 AND clave_legado = '0747';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 48 WHERE plan_id = pid_admin_2001 AND clave_legado = '0848';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 49 WHERE plan_id = pid_admin_2001 AND clave_legado = '0849';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 50 WHERE plan_id = pid_admin_2001 AND clave_legado = '0850';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 51 WHERE plan_id = pid_admin_2001 AND clave_legado = '0851';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 52 WHERE plan_id = pid_admin_2001 AND clave_legado = '0852';
  END IF;
  IF pid_admin_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 53 WHERE plan_id = pid_admin_2001 AND clave_legado = '0853';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 54 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD001';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 55 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD002';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 56 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD003';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 57 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD004';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 58 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD005';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 59 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD006';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 60 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD007';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 61 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD008';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 62 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD009';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 63 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD010';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 64 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD011';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 65 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD012';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 66 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD013';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 67 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD014';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 68 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD015';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 69 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD016';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 70 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD101';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 71 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD102';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 72 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD103';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 73 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD104';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 74 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD105';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 75 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD106';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 76 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD107';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 77 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD108';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 78 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD109';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 79 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD110';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 80 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD111';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 81 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD112';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 82 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD113';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 83 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD114';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 84 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD115';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 85 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD116';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 86 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD201';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 87 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD202';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 88 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD203';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 89 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD204';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 90 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD205';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 91 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD206';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 92 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD017';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 93 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD018';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 94 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD019';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 95 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD020';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 96 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD021';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 97 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD022';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 98 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD023';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 99 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD024';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 100 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD025';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 101 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD026';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 102 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD027';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 103 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD117';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 104 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD118';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 105 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD119';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 106 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD120';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 107 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD121';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 108 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD122';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 109 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD123';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 110 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD207';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 111 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD208';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 112 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD209';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 113 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD210';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 114 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD211';
  END IF;
  IF pid_admin_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 115 WHERE plan_id = pid_admin_2017 AND clave_legado = 'AD212';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 116 WHERE plan_id = pid_conta_2001 AND clave_legado = '0101';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 117 WHERE plan_id = pid_conta_2001 AND clave_legado = '0102';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 118 WHERE plan_id = pid_conta_2001 AND clave_legado = '0103';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 119 WHERE plan_id = pid_conta_2001 AND clave_legado = '0104';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 120 WHERE plan_id = pid_conta_2001 AND clave_legado = '0105';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 121 WHERE plan_id = pid_conta_2001 AND clave_legado = '0106';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 122 WHERE plan_id = pid_conta_2001 AND clave_legado = '0107';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 123 WHERE plan_id = pid_conta_2001 AND clave_legado = '0208';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 124 WHERE plan_id = pid_conta_2001 AND clave_legado = '0209';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 125 WHERE plan_id = pid_conta_2001 AND clave_legado = '0210';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 126 WHERE plan_id = pid_conta_2001 AND clave_legado = '0211';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 127 WHERE plan_id = pid_conta_2001 AND clave_legado = '0212';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 128 WHERE plan_id = pid_conta_2001 AND clave_legado = '0213';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 129 WHERE plan_id = pid_conta_2001 AND clave_legado = '0214';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 130 WHERE plan_id = pid_conta_2001 AND clave_legado = '0315';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 131 WHERE plan_id = pid_conta_2001 AND clave_legado = '0316';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 132 WHERE plan_id = pid_conta_2001 AND clave_legado = '0317';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 133 WHERE plan_id = pid_conta_2001 AND clave_legado = '0318';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 134 WHERE plan_id = pid_conta_2001 AND clave_legado = '0319';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 135 WHERE plan_id = pid_conta_2001 AND clave_legado = '0320';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 136 WHERE plan_id = pid_conta_2001 AND clave_legado = '0321';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 137 WHERE plan_id = pid_conta_2001 AND clave_legado = '0422';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 138 WHERE plan_id = pid_conta_2001 AND clave_legado = '0423';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 139 WHERE plan_id = pid_conta_2001 AND clave_legado = '0424';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 140 WHERE plan_id = pid_conta_2001 AND clave_legado = '0425';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 141 WHERE plan_id = pid_conta_2001 AND clave_legado = '0426';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 142 WHERE plan_id = pid_conta_2001 AND clave_legado = '0427';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 143 WHERE plan_id = pid_conta_2001 AND clave_legado = '0428';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 144 WHERE plan_id = pid_conta_2001 AND clave_legado = '0529';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 145 WHERE plan_id = pid_conta_2001 AND clave_legado = '0530';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 146 WHERE plan_id = pid_conta_2001 AND clave_legado = '0531';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 147 WHERE plan_id = pid_conta_2001 AND clave_legado = '0532';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 148 WHERE plan_id = pid_conta_2001 AND clave_legado = '0533';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 149 WHERE plan_id = pid_conta_2001 AND clave_legado = '0534';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 150 WHERE plan_id = pid_conta_2001 AND clave_legado = '0535';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 151 WHERE plan_id = pid_conta_2001 AND clave_legado = '0636';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 152 WHERE plan_id = pid_conta_2001 AND clave_legado = '0637';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 153 WHERE plan_id = pid_conta_2001 AND clave_legado = '0638';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 154 WHERE plan_id = pid_conta_2001 AND clave_legado = '0639';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 155 WHERE plan_id = pid_conta_2001 AND clave_legado = '0640';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 156 WHERE plan_id = pid_conta_2001 AND clave_legado = '0641';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 157 WHERE plan_id = pid_conta_2001 AND clave_legado = '0742';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 158 WHERE plan_id = pid_conta_2001 AND clave_legado = '0743';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 159 WHERE plan_id = pid_conta_2001 AND clave_legado = '0744';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 160 WHERE plan_id = pid_conta_2001 AND clave_legado = '0745';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 161 WHERE plan_id = pid_conta_2001 AND clave_legado = '0746';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 162 WHERE plan_id = pid_conta_2001 AND clave_legado = '0747';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 163 WHERE plan_id = pid_conta_2001 AND clave_legado = '0848';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 164 WHERE plan_id = pid_conta_2001 AND clave_legado = '0849';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 165 WHERE plan_id = pid_conta_2001 AND clave_legado = '0850';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 166 WHERE plan_id = pid_conta_2001 AND clave_legado = '0851';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 167 WHERE plan_id = pid_conta_2001 AND clave_legado = '0852';
  END IF;
  IF pid_conta_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 168 WHERE plan_id = pid_conta_2001 AND clave_legado = '0853';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 169 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC001';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 170 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC002';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 171 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC003';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 172 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC004';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 173 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC005';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 174 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC006';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 175 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC007';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 176 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC008';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 177 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC009';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 178 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC010';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 179 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC011';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 180 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC012';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 181 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC013';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 182 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC014';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 183 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC015';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 184 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC016';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 185 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC101';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 186 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC102';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 187 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC103';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 188 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC104';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 189 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC105';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 190 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC106';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 191 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC107';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 192 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC108';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 193 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC109';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 194 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC110';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 195 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC111';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 196 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC112';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 197 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC113';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 198 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC114';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 199 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC115';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 200 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC116';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 201 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC201';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 202 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC202';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 203 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC203';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 204 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC204';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 205 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC017';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 206 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC018';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 207 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC019';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 208 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC020';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 209 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC021';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 210 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC022';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 211 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC023';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 212 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC024';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 213 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC025';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 214 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC026';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 215 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC027';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 216 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC028';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 217 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC117';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 218 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC118';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 219 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC119';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 220 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC120';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 221 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC121';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 222 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC122';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 223 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC123';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 224 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC124';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 225 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC125';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 226 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC126';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 227 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC127';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 228 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC205';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 229 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC206';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 230 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC207';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 231 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC208';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 232 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC209';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 233 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC210';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 234 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC211';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 235 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC212';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 236 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC213';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 237 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC214';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 238 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC215';
  END IF;
  IF pid_conta_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 239 WHERE plan_id = pid_conta_2017 AND clave_legado = 'LC216';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 240 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0101';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 241 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0102';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 242 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0103';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 243 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0104';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 244 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0105';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 245 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0106';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 246 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0107';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 247 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0208';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 248 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0209';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 249 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0210';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 250 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0211';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 251 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0212';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 252 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0213';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 253 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0214';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 254 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0315';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 255 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0316';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 256 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0317';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 257 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0318';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 258 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0319';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 259 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0320';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 260 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0321';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 261 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0422';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 262 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0423';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 263 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0424';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 264 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0425';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 265 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0426';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 266 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0427';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 267 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0428';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 268 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0529';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 269 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0530';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 270 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0531';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 271 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0532';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 272 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0533';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 273 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0534';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 274 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0535';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 275 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0636';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 276 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0637';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 277 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0638';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 278 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0639';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 279 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0640';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 280 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0641';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 281 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0742';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 282 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0743';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 283 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0744';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 284 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0745';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 285 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0746';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 286 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0747';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 287 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0848';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 288 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0849';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 289 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0850';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 290 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0851';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 291 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0852';
  END IF;
  IF pid_derecho_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 292 WHERE plan_id = pid_derecho_2001 AND clave_legado = '0853';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 293 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ001';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 294 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ002';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 295 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ003';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 296 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ004';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 297 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ005';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 298 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ006';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 299 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ007';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 300 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ008';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 301 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ009';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 302 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ010';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 303 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ011';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 304 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ012';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 305 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ013';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 306 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ014';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 307 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ015';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 308 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ016';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 309 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ101';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 310 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ102';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 311 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ103';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 312 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ104';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 313 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ105';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 314 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ106';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 315 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ107';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 316 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ108';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 317 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ109';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 318 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ110';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 319 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ111';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 320 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ112';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 321 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ113';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 322 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ114';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 323 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ115';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 324 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ116';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 325 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ201';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 326 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ202';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 327 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ203';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 328 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ204';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 329 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ017';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 330 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ018';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 331 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ019';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 332 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ020';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 333 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ021';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 334 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ022';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 335 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ023';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 336 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ024';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 337 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ025';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 338 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ026';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 339 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ027';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 340 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ028';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 341 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ117';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 342 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ118';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 343 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ119';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 344 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ120';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 345 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ121';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 346 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ122';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 347 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ123';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 348 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ124';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 349 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ125';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 350 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ126';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 351 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ127';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 352 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ205';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 353 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ206';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 354 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ207';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 355 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ208';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 356 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ209';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 357 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ210';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 358 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ211';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 359 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ212';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 360 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ213';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 361 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ214';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 362 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ215';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 363 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ216';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 364 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ217';
  END IF;
  IF pid_derecho_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 365 WHERE plan_id = pid_derecho_2017 AND clave_legado = 'CJ218';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 366 WHERE plan_id = pid_merca_2001 AND clave_legado = '0101';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 367 WHERE plan_id = pid_merca_2001 AND clave_legado = '0102';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 368 WHERE plan_id = pid_merca_2001 AND clave_legado = '0103';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 369 WHERE plan_id = pid_merca_2001 AND clave_legado = '0104';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 370 WHERE plan_id = pid_merca_2001 AND clave_legado = '0105';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 371 WHERE plan_id = pid_merca_2001 AND clave_legado = '0106';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 372 WHERE plan_id = pid_merca_2001 AND clave_legado = '0107';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 373 WHERE plan_id = pid_merca_2001 AND clave_legado = '0208';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 374 WHERE plan_id = pid_merca_2001 AND clave_legado = '0209';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 375 WHERE plan_id = pid_merca_2001 AND clave_legado = '0210';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 376 WHERE plan_id = pid_merca_2001 AND clave_legado = '0211';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 377 WHERE plan_id = pid_merca_2001 AND clave_legado = '0212';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 378 WHERE plan_id = pid_merca_2001 AND clave_legado = '0213';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 379 WHERE plan_id = pid_merca_2001 AND clave_legado = '0214';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 380 WHERE plan_id = pid_merca_2001 AND clave_legado = '0315';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 381 WHERE plan_id = pid_merca_2001 AND clave_legado = '0316';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 382 WHERE plan_id = pid_merca_2001 AND clave_legado = '0317';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 383 WHERE plan_id = pid_merca_2001 AND clave_legado = '0318';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 384 WHERE plan_id = pid_merca_2001 AND clave_legado = '0319';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 385 WHERE plan_id = pid_merca_2001 AND clave_legado = '0320';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 386 WHERE plan_id = pid_merca_2001 AND clave_legado = '0321';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 387 WHERE plan_id = pid_merca_2001 AND clave_legado = '0422';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 388 WHERE plan_id = pid_merca_2001 AND clave_legado = '0423';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 389 WHERE plan_id = pid_merca_2001 AND clave_legado = '0424';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 390 WHERE plan_id = pid_merca_2001 AND clave_legado = '0425';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 391 WHERE plan_id = pid_merca_2001 AND clave_legado = '0426';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 392 WHERE plan_id = pid_merca_2001 AND clave_legado = '0427';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 393 WHERE plan_id = pid_merca_2001 AND clave_legado = '0428';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 394 WHERE plan_id = pid_merca_2001 AND clave_legado = '0529';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 395 WHERE plan_id = pid_merca_2001 AND clave_legado = '0530';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 396 WHERE plan_id = pid_merca_2001 AND clave_legado = '0531';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 397 WHERE plan_id = pid_merca_2001 AND clave_legado = '0532';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 398 WHERE plan_id = pid_merca_2001 AND clave_legado = '0533';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 399 WHERE plan_id = pid_merca_2001 AND clave_legado = '0534';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 400 WHERE plan_id = pid_merca_2001 AND clave_legado = '0535';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 401 WHERE plan_id = pid_merca_2001 AND clave_legado = '0636';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 402 WHERE plan_id = pid_merca_2001 AND clave_legado = '0637';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 403 WHERE plan_id = pid_merca_2001 AND clave_legado = '0638';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 404 WHERE plan_id = pid_merca_2001 AND clave_legado = '0639';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 405 WHERE plan_id = pid_merca_2001 AND clave_legado = '0640';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 406 WHERE plan_id = pid_merca_2001 AND clave_legado = '0641';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 407 WHERE plan_id = pid_merca_2001 AND clave_legado = '0642';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 408 WHERE plan_id = pid_merca_2001 AND clave_legado = '0743';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 409 WHERE plan_id = pid_merca_2001 AND clave_legado = '0744';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 410 WHERE plan_id = pid_merca_2001 AND clave_legado = '0745';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 411 WHERE plan_id = pid_merca_2001 AND clave_legado = '0746';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 412 WHERE plan_id = pid_merca_2001 AND clave_legado = '0747';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 413 WHERE plan_id = pid_merca_2001 AND clave_legado = '0748';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 414 WHERE plan_id = pid_merca_2001 AND clave_legado = '0749';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 415 WHERE plan_id = pid_merca_2001 AND clave_legado = '0850';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 416 WHERE plan_id = pid_merca_2001 AND clave_legado = '0851';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 417 WHERE plan_id = pid_merca_2001 AND clave_legado = '0852';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 418 WHERE plan_id = pid_merca_2001 AND clave_legado = '0853';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 419 WHERE plan_id = pid_merca_2001 AND clave_legado = '0854';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 420 WHERE plan_id = pid_merca_2001 AND clave_legado = '0855';
  END IF;
  IF pid_merca_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 421 WHERE plan_id = pid_merca_2001 AND clave_legado = '0856';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 422 WHERE plan_id = pid_peda_2001 AND clave_legado = '0101';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 423 WHERE plan_id = pid_peda_2001 AND clave_legado = '0102';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 424 WHERE plan_id = pid_peda_2001 AND clave_legado = '0103';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 425 WHERE plan_id = pid_peda_2001 AND clave_legado = '0104';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 426 WHERE plan_id = pid_peda_2001 AND clave_legado = '0105';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 427 WHERE plan_id = pid_peda_2001 AND clave_legado = '0106';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 428 WHERE plan_id = pid_peda_2001 AND clave_legado = '0107';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 429 WHERE plan_id = pid_peda_2001 AND clave_legado = '0208';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 430 WHERE plan_id = pid_peda_2001 AND clave_legado = '0209';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 431 WHERE plan_id = pid_peda_2001 AND clave_legado = '0210';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 432 WHERE plan_id = pid_peda_2001 AND clave_legado = '0211';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 433 WHERE plan_id = pid_peda_2001 AND clave_legado = '0212';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 434 WHERE plan_id = pid_peda_2001 AND clave_legado = '0213';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 435 WHERE plan_id = pid_peda_2001 AND clave_legado = '0214';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 436 WHERE plan_id = pid_peda_2001 AND clave_legado = '0315';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 437 WHERE plan_id = pid_peda_2001 AND clave_legado = '0316';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 438 WHERE plan_id = pid_peda_2001 AND clave_legado = '0317';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 439 WHERE plan_id = pid_peda_2001 AND clave_legado = '0318';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 440 WHERE plan_id = pid_peda_2001 AND clave_legado = '0319';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 441 WHERE plan_id = pid_peda_2001 AND clave_legado = '0320';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 442 WHERE plan_id = pid_peda_2001 AND clave_legado = '0321';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 443 WHERE plan_id = pid_peda_2001 AND clave_legado = '0422';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 444 WHERE plan_id = pid_peda_2001 AND clave_legado = '0423';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 445 WHERE plan_id = pid_peda_2001 AND clave_legado = '0424';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 446 WHERE plan_id = pid_peda_2001 AND clave_legado = '0425';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 447 WHERE plan_id = pid_peda_2001 AND clave_legado = '0426';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 448 WHERE plan_id = pid_peda_2001 AND clave_legado = '0427';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 449 WHERE plan_id = pid_peda_2001 AND clave_legado = '0428';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 450 WHERE plan_id = pid_peda_2001 AND clave_legado = '0529';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 451 WHERE plan_id = pid_peda_2001 AND clave_legado = '0530';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 452 WHERE plan_id = pid_peda_2001 AND clave_legado = '0531';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 453 WHERE plan_id = pid_peda_2001 AND clave_legado = '0532';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 454 WHERE plan_id = pid_peda_2001 AND clave_legado = '0533';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 455 WHERE plan_id = pid_peda_2001 AND clave_legado = '0534';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 456 WHERE plan_id = pid_peda_2001 AND clave_legado = '0535';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 457 WHERE plan_id = pid_peda_2001 AND clave_legado = '0636';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 458 WHERE plan_id = pid_peda_2001 AND clave_legado = '0637';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 459 WHERE plan_id = pid_peda_2001 AND clave_legado = '0638';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 460 WHERE plan_id = pid_peda_2001 AND clave_legado = '0639';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 461 WHERE plan_id = pid_peda_2001 AND clave_legado = '0640';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 462 WHERE plan_id = pid_peda_2001 AND clave_legado = '0641';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 463 WHERE plan_id = pid_peda_2001 AND clave_legado = '0642';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 464 WHERE plan_id = pid_peda_2001 AND clave_legado = '0743';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 465 WHERE plan_id = pid_peda_2001 AND clave_legado = '0744';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 466 WHERE plan_id = pid_peda_2001 AND clave_legado = '0745';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 467 WHERE plan_id = pid_peda_2001 AND clave_legado = '0746';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 468 WHERE plan_id = pid_peda_2001 AND clave_legado = '0747';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 469 WHERE plan_id = pid_peda_2001 AND clave_legado = '0748';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 470 WHERE plan_id = pid_peda_2001 AND clave_legado = '0749';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 471 WHERE plan_id = pid_peda_2001 AND clave_legado = '0850';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 472 WHERE plan_id = pid_peda_2001 AND clave_legado = '0851';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 473 WHERE plan_id = pid_peda_2001 AND clave_legado = '0852';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 474 WHERE plan_id = pid_peda_2001 AND clave_legado = '0853';
  END IF;
  IF pid_peda_2001 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 475 WHERE plan_id = pid_peda_2001 AND clave_legado = '0854';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 476 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP10';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 477 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP35';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 478 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP12';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 479 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP16';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 480 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP14';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 481 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP53';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 482 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP54';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 483 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP20';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 484 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP04';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 485 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP01';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 486 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP40';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 487 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP45';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 488 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP56';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 489 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP24';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 490 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP58';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 491 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP22';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 492 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP05';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 493 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP02';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 494 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP13';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 495 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP08';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 496 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP50';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 497 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP19';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 498 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP52';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 499 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP32';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 500 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP26';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 501 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP17';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 502 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP11';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 503 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP29';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 504 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP25';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 505 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP28';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 506 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP57';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 507 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP31';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 508 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP06';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 509 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP30';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 510 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP59';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 511 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP09';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 512 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP61';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 513 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP03';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 514 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP33';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 515 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP15';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 516 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP62';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 517 WHERE plan_id = pid_peda_2017 AND clave_legado = 'AF112';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 518 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP63';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 519 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP27';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 520 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP34';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 521 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP38';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 522 WHERE plan_id = pid_peda_2017 AND clave_legado = 'AF13';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 523 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP07';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 524 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP51';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 525 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP23';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 526 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP55';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 527 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP65';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 528 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP46';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 529 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP47';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 530 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP48';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 531 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP49';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 532 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP18';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 533 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP41';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 534 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP42';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 535 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP44';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 536 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP39';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 537 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP60';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 538 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP64';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 539 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP37';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 540 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP43';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 541 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP36';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 542 WHERE plan_id = pid_peda_2017 AND clave_legado = 'LP67';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 543 WHERE plan_id = pid_peda_2017 AND clave_legado = 'AF23';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 544 WHERE plan_id = pid_peda_2017 AND clave_legado = 'AF50';
  END IF;
  IF pid_peda_2017 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 545 WHERE plan_id = pid_peda_2017 AND clave_legado = 'AF104';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 546 WHERE plan_id = pid_psico_2009 AND clave_legado = '0101';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 547 WHERE plan_id = pid_psico_2009 AND clave_legado = '0102';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 548 WHERE plan_id = pid_psico_2009 AND clave_legado = '0103';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 549 WHERE plan_id = pid_psico_2009 AND clave_legado = '0104';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 550 WHERE plan_id = pid_psico_2009 AND clave_legado = '0105';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 551 WHERE plan_id = pid_psico_2009 AND clave_legado = '0106';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 552 WHERE plan_id = pid_psico_2009 AND clave_legado = '0107';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 553 WHERE plan_id = pid_psico_2009 AND clave_legado = '0208';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 554 WHERE plan_id = pid_psico_2009 AND clave_legado = '0209';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 555 WHERE plan_id = pid_psico_2009 AND clave_legado = '0210';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 556 WHERE plan_id = pid_psico_2009 AND clave_legado = '0211';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 557 WHERE plan_id = pid_psico_2009 AND clave_legado = '0212';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 558 WHERE plan_id = pid_psico_2009 AND clave_legado = '0213';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 559 WHERE plan_id = pid_psico_2009 AND clave_legado = '0214';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 560 WHERE plan_id = pid_psico_2009 AND clave_legado = '0315';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 561 WHERE plan_id = pid_psico_2009 AND clave_legado = '0316';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 562 WHERE plan_id = pid_psico_2009 AND clave_legado = '0317';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 563 WHERE plan_id = pid_psico_2009 AND clave_legado = '0318';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 564 WHERE plan_id = pid_psico_2009 AND clave_legado = '0319';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 565 WHERE plan_id = pid_psico_2009 AND clave_legado = '0320';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 566 WHERE plan_id = pid_psico_2009 AND clave_legado = '0321';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 567 WHERE plan_id = pid_psico_2009 AND clave_legado = '0422';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 568 WHERE plan_id = pid_psico_2009 AND clave_legado = '0423';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 569 WHERE plan_id = pid_psico_2009 AND clave_legado = '0424';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 570 WHERE plan_id = pid_psico_2009 AND clave_legado = '0425';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 571 WHERE plan_id = pid_psico_2009 AND clave_legado = '0426';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 572 WHERE plan_id = pid_psico_2009 AND clave_legado = '0427';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 573 WHERE plan_id = pid_psico_2009 AND clave_legado = '0428';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 574 WHERE plan_id = pid_psico_2009 AND clave_legado = '0529';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 575 WHERE plan_id = pid_psico_2009 AND clave_legado = '0530';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 576 WHERE plan_id = pid_psico_2009 AND clave_legado = '0531';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 577 WHERE plan_id = pid_psico_2009 AND clave_legado = '0532';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 578 WHERE plan_id = pid_psico_2009 AND clave_legado = '0533';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 579 WHERE plan_id = pid_psico_2009 AND clave_legado = '0534';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 580 WHERE plan_id = pid_psico_2009 AND clave_legado = '0535';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 581 WHERE plan_id = pid_psico_2009 AND clave_legado = '0636';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 582 WHERE plan_id = pid_psico_2009 AND clave_legado = '0637';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 583 WHERE plan_id = pid_psico_2009 AND clave_legado = '0638';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 584 WHERE plan_id = pid_psico_2009 AND clave_legado = '0639';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 585 WHERE plan_id = pid_psico_2009 AND clave_legado = '0640';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 586 WHERE plan_id = pid_psico_2009 AND clave_legado = '0641';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 587 WHERE plan_id = pid_psico_2009 AND clave_legado = '0742';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 588 WHERE plan_id = pid_psico_2009 AND clave_legado = '0743';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 589 WHERE plan_id = pid_psico_2009 AND clave_legado = '0744';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 590 WHERE plan_id = pid_psico_2009 AND clave_legado = '0745';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 591 WHERE plan_id = pid_psico_2009 AND clave_legado = '0746';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 592 WHERE plan_id = pid_psico_2009 AND clave_legado = '0747';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 593 WHERE plan_id = pid_psico_2009 AND clave_legado = '0848';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 594 WHERE plan_id = pid_psico_2009 AND clave_legado = '0849';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 595 WHERE plan_id = pid_psico_2009 AND clave_legado = '0850';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 596 WHERE plan_id = pid_psico_2009 AND clave_legado = '0851';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 597 WHERE plan_id = pid_psico_2009 AND clave_legado = '0852';
  END IF;
  IF pid_psico_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 598 WHERE plan_id = pid_psico_2009 AND clave_legado = '0853';
  END IF;
  IF pid_admin_neg_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 599 WHERE plan_id = pid_admin_neg_2009 AND clave_legado = 'EN01';
  END IF;
  IF pid_admin_neg_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 600 WHERE plan_id = pid_admin_neg_2009 AND clave_legado = 'EN02';
  END IF;
  IF pid_admin_neg_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 601 WHERE plan_id = pid_admin_neg_2009 AND clave_legado = 'EN03';
  END IF;
  IF pid_admin_neg_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 602 WHERE plan_id = pid_admin_neg_2009 AND clave_legado = 'EN04';
  END IF;
  IF pid_admin_neg_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 603 WHERE plan_id = pid_admin_neg_2009 AND clave_legado = 'EN05';
  END IF;
  IF pid_admin_neg_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 604 WHERE plan_id = pid_admin_neg_2009 AND clave_legado = 'EN06';
  END IF;
  IF pid_admin_neg_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 605 WHERE plan_id = pid_admin_neg_2009 AND clave_legado = 'EN07';
  END IF;
  IF pid_admin_neg_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 606 WHERE plan_id = pid_admin_neg_2009 AND clave_legado = 'EN08';
  END IF;
  IF pid_admin_neg_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 607 WHERE plan_id = pid_admin_neg_2009 AND clave_legado = 'EN09';
  END IF;
  IF pid_derecho_penal_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 608 WHERE plan_id = pid_derecho_penal_2009 AND clave_legado = 'EPE01';
  END IF;
  IF pid_derecho_penal_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 609 WHERE plan_id = pid_derecho_penal_2009 AND clave_legado = 'EPE02';
  END IF;
  IF pid_derecho_penal_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 610 WHERE plan_id = pid_derecho_penal_2009 AND clave_legado = 'EPE03';
  END IF;
  IF pid_derecho_penal_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 611 WHERE plan_id = pid_derecho_penal_2009 AND clave_legado = 'EPE04';
  END IF;
  IF pid_derecho_penal_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 612 WHERE plan_id = pid_derecho_penal_2009 AND clave_legado = 'EPE05';
  END IF;
  IF pid_derecho_penal_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 613 WHERE plan_id = pid_derecho_penal_2009 AND clave_legado = 'EPE06';
  END IF;
  IF pid_derecho_penal_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 614 WHERE plan_id = pid_derecho_penal_2009 AND clave_legado = 'EPE07';
  END IF;
  IF pid_docencia_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 615 WHERE plan_id = pid_docencia_2009 AND clave_legado = 'ED01';
  END IF;
  IF pid_docencia_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 616 WHERE plan_id = pid_docencia_2009 AND clave_legado = 'ED02';
  END IF;
  IF pid_docencia_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 617 WHERE plan_id = pid_docencia_2009 AND clave_legado = 'ED03';
  END IF;
  IF pid_docencia_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 618 WHERE plan_id = pid_docencia_2009 AND clave_legado = 'ED04';
  END IF;
  IF pid_docencia_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 619 WHERE plan_id = pid_docencia_2009 AND clave_legado = 'ED05';
  END IF;
  IF pid_docencia_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 620 WHERE plan_id = pid_docencia_2009 AND clave_legado = 'ED06';
  END IF;
  IF pid_docencia_2009 IS NOT NULL THEN
    UPDATE asignaturas SET clave_certificacion = 621 WHERE plan_id = pid_docencia_2009 AND clave_legado = 'ED07';
  END IF;
END $$;