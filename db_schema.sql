-- ======================================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS: SISTEMA DE CONTROL DE PAGOS UNIVERSIDAD
-- Alineado con la BD real de Supabase (revisión: 23 de junio de 2026)
-- ======================================================================================
-- INSTRUCCIONES:
--   1. Ejecutar en Supabase → SQL Editor (o psql) en orden.
--   2. Las tablas se crean en orden de dependencia (primero las que no referencian a otras).
--   3. Las políticas RLS están al final.
-- ======================================================================================

-- Habilitar extensión para UUIDs automáticos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. TABLA: CICLOS ESCOLARES
-- (Sin dependencias — se crea primero porque usuarios la referencia)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ciclos_escolares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    meses_abarca TEXT,
    anio INTEGER,
    anio_fin INTEGER,                -- Año de fin (para ciclos que abarcan 2 años, ej. 2026-2027)
    activo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 2. TABLA: USUARIOS
-- (Depende de ciclos_escolares via ultimo_ciclo_id)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT,                    -- Hash bcrypt (legacy, usar Supabase Auth como primario)
    rol TEXT NOT NULL CHECK (rol IN ('ADMINISTRADOR', 'COORDINADOR', 'CAJERO')),
    ultimo_ciclo_id UUID REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL,
    preferencia_tema TEXT DEFAULT 'light',
    auth_id UUID,                    -- UUID de Supabase Auth (vincula la sesión JWT)
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. TABLA: CATÁLOGOS
-- (Sin dependencias)
-- ==========================================
-- NOTA: En la BD real el id es UUID (no TEXT como en versiones anteriores del schema).
-- El CHECK de tipo no existe en la BD real (se controla desde la app),
-- pero se documenta aquí los valores válidos como referencia.
CREATE TABLE IF NOT EXISTS public.catalogos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo TEXT NOT NULL,
    -- Tipos válidos (controlados por la app):
    --   'concepto', 'licenciatura', 'beca_tipo', 'beca_porcentaje',
    --   'grado', 'turno', 'estatus_alumno', 'empresa_ss', 'modalidad_titulacion'
    valor TEXT NOT NULL,
    orden INTEGER,
    activo BOOLEAN DEFAULT true,
    -- Metadatos opcionales (usado principalmente para tipo='licenciatura'):
    -- { "tipo_academico": "LICENCIATURA"|"ESPECIALIDAD", "tipo_periodo": "CUATRIMESTRAL"|"SEMESTRAL",
    --   "rvoe": "...", "rvoe_fecha": "YYYY-MM-DD" }
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 4. TABLA: ALUMNOS
-- (Sin dependencias)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.alumnos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Nombre normalizado (Opción B: conviven nombre_completo + campos separados)
    apellido_paterno TEXT,
    apellido_materno TEXT,
    nombres TEXT,
    nombre_completo TEXT NOT NULL,          -- UPPERCASE concatenado: "APELLIDO_P APELLIDO_M NOMBRES"
    nombre_requiere_revision BOOLEAN,      -- Bandera para revisión post-migración

    -- Datos académicos
    licenciatura TEXT,
    grado_actual TEXT,
    turno TEXT,
    estatus TEXT DEFAULT 'ACTIVO',
    matricula TEXT UNIQUE,                 -- Identificador del sistema legado

    -- Becas y finanzas
    beca_tipo TEXT,
    beca_porcentaje TEXT,
    ciclo_ultima_asignacion_grado UUID,    -- Referencia lógica a ciclos_escolares (sin FK en BD real)
    observaciones_pago_titulacion TEXT,
    saldo_a_favor NUMERIC(10,2) DEFAULT 0,

    -- Dirección
    domicilio TEXT,
    cp VARCHAR,
    municipio TEXT,
    estado TEXT,

    -- Identificación y origen
    curp VARCHAR UNIQUE,
    fecha_nacimiento DATE,
    estado_nacimiento TEXT,
    nacionalidad TEXT,
    escuela_procedencia TEXT,
    estado_escolaridad TEXT,

    -- Contacto y género
    telefono VARCHAR,
    celular VARCHAR,
    email TEXT,
    sexo VARCHAR,                          -- 'H' | 'M'

    -- Datos adicionales
    discapacidad TEXT,
    lengua_indigena TEXT,

    -- Sincronización con sistema externo (GES)
    sincronizado_el TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_alumnos_matricula ON public.alumnos(matricula);
CREATE INDEX IF NOT EXISTS idx_alumnos_nombre ON public.alumnos(nombre_completo);
CREATE INDEX IF NOT EXISTS idx_alumnos_curp ON public.alumnos(curp);

-- ==========================================
-- 5. TABLA: CONFIGURACIÓN APP
-- (Sin dependencias)
-- ==========================================
-- NOTA: En la BD real el id es TEXT (se usa como clave descriptiva: 'app_title', 'app_logo', etc.)
CREATE TABLE IF NOT EXISTS public.configuracion_app (
    id TEXT PRIMARY KEY,                   -- Clave descriptiva: 'app_title', 'app_logo', 'director_nombre', etc.
    valor TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- Valores esperados por la app:
--   'app_title'            → Título de la app (ej. "Sistema de Control de Pagos")
--   'app_logo'             → URL del logo institucional
--   'director_nombre'      → Nombre del director (constancias)
--   'director_cargo'       → Cargo del director (constancias)
--   'constancia_ss_params' → JSON con parámetros de formato de constancias

-- ==========================================
-- 6. TABLA: PLANTILLAS DE PLAN
-- (Depende de ciclos_escolares)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.plantillas_plan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id) ON DELETE SET NULL,
    tipo_plan TEXT,
    -- Valores válidos: 'Cuatrimestral', 'Semestral', 'Titulación',
    --                  'Especialidad Completa', 'Especialidad Cuatrimestral'
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,

    -- Conceptos 1 a 9 (fecha como TEXT para compatibilidad con formatos legacy DD/MM/YYYY)
    concepto_1 TEXT, fecha_1 TEXT, cantidad_1 NUMERIC(10,2),
    concepto_2 TEXT, fecha_2 TEXT, cantidad_2 NUMERIC(10,2),
    concepto_3 TEXT, fecha_3 TEXT, cantidad_3 NUMERIC(10,2),
    concepto_4 TEXT, fecha_4 TEXT, cantidad_4 NUMERIC(10,2),
    concepto_5 TEXT, fecha_5 TEXT, cantidad_5 NUMERIC(10,2),
    concepto_6 TEXT, fecha_6 TEXT, cantidad_6 NUMERIC(10,2),
    concepto_7 TEXT, fecha_7 TEXT, cantidad_7 NUMERIC(10,2),
    concepto_8 TEXT, fecha_8 TEXT, cantidad_8 NUMERIC(10,2),
    concepto_9 TEXT, fecha_9 TEXT, cantidad_9 NUMERIC(10,2),

    -- Conceptos 10 a 15 (fecha como DATE — agregados después para Especialidades)
    concepto_10 TEXT, fecha_10 DATE, cantidad_10 NUMERIC(10,2),
    concepto_11 TEXT, fecha_11 DATE, cantidad_11 NUMERIC(10,2),
    concepto_12 TEXT, fecha_12 DATE, cantidad_12 NUMERIC(10,2),
    concepto_13 TEXT, fecha_13 DATE, cantidad_13 NUMERIC(10,2),
    concepto_14 TEXT, fecha_14 DATE, cantidad_14 NUMERIC(10,2),
    concepto_15 TEXT, fecha_15 DATE, cantidad_15 NUMERIC(10,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 7. TABLA: PLANES DE PAGO
-- (Depende de alumnos y ciclos_escolares)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.planes_pago (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id) ON DELETE RESTRICT,

    no_plan_pagos TEXT,                    -- Folio auto-generado (ej. "262-001")
    fecha_plan TEXT,                       -- Fecha del plan (TEXT por formatos legacy)
    beca_porcentaje TEXT,
    beca_tipo TEXT,
    grado_turno_inscrito TEXT,             -- Snapshot del grado/turno al momento de crear el plan
    grado TEXT,                            -- Grado separado
    turno TEXT,                            -- Turno separado
    tipo_plan TEXT,
    -- Valores válidos: 'Cuatrimestral', 'Semestral', 'Titulación',
    --                  'Especialidad Completa', 'Especialidad Cuatrimestral'
    licenciatura TEXT,

    -- Conceptos 1 a 9 (fecha como TEXT por compatibilidad con formatos legacy)
    concepto_1 TEXT, fecha_1 TEXT, cantidad_1 NUMERIC(10,2), estatus_1 TEXT DEFAULT 'PENDIENTE',
    concepto_2 TEXT, fecha_2 TEXT, cantidad_2 NUMERIC(10,2), estatus_2 TEXT DEFAULT 'PENDIENTE',
    concepto_3 TEXT, fecha_3 TEXT, cantidad_3 NUMERIC(10,2), estatus_3 TEXT DEFAULT 'PENDIENTE',
    concepto_4 TEXT, fecha_4 TEXT, cantidad_4 NUMERIC(10,2), estatus_4 TEXT DEFAULT 'PENDIENTE',
    concepto_5 TEXT, fecha_5 TEXT, cantidad_5 NUMERIC(10,2), estatus_5 TEXT DEFAULT 'PENDIENTE',
    concepto_6 TEXT, fecha_6 TEXT, cantidad_6 NUMERIC(10,2), estatus_6 TEXT DEFAULT 'PENDIENTE',
    concepto_7 TEXT, fecha_7 TEXT, cantidad_7 NUMERIC(10,2), estatus_7 TEXT DEFAULT 'PENDIENTE',
    concepto_8 TEXT, fecha_8 TEXT, cantidad_8 NUMERIC(10,2), estatus_8 TEXT DEFAULT 'PENDIENTE',
    concepto_9 TEXT, fecha_9 TEXT, cantidad_9 NUMERIC(10,2), estatus_9 TEXT DEFAULT 'PENDIENTE',

    -- Conceptos 10 a 15 (fecha como DATE — agregados para Especialidades/Titulación extendida)
    concepto_10 TEXT, fecha_10 DATE, cantidad_10 NUMERIC(10,2), estatus_10 TEXT DEFAULT 'PENDIENTE',
    concepto_11 TEXT, fecha_11 DATE, cantidad_11 NUMERIC(10,2), estatus_11 TEXT DEFAULT 'PENDIENTE',
    concepto_12 TEXT, fecha_12 DATE, cantidad_12 NUMERIC(10,2), estatus_12 TEXT DEFAULT 'PENDIENTE',
    concepto_13 TEXT, fecha_13 DATE, cantidad_13 NUMERIC(10,2), estatus_13 TEXT DEFAULT 'PENDIENTE',
    concepto_14 TEXT, fecha_14 DATE, cantidad_14 NUMERIC(10,2), estatus_14 TEXT DEFAULT 'PENDIENTE',
    concepto_15 TEXT, fecha_15 DATE, cantidad_15 NUMERIC(10,2), estatus_15 TEXT DEFAULT 'PENDIENTE',

    -- Metadatos para Especialidad Completa (Cotización dinámica)
    desglose_conceptos JSONB,
    desglose_total_bruto NUMERIC(15,2),
    desglose_descuento_porcentaje NUMERIC(5,2),
    desglose_descuento_monto NUMERIC(15,2),
    desglose_total_neto NUMERIC(15,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_planes_pago_alumno ON public.planes_pago(alumno_id);
CREATE INDEX IF NOT EXISTS idx_planes_pago_ciclo ON public.planes_pago(ciclo_id);

-- ==========================================
-- 8. VISTA: VISTA_PLANES_PAGO
-- Integra planes_pago + alumnos + ciclos para la aplicación
-- ==========================================
CREATE OR REPLACE VIEW public.vista_planes_pago AS
SELECT
    p.id,
    p.alumno_id,
    p.ciclo_id,
    a.nombre_completo AS nombre_alumno,
    p.no_plan_pagos,
    p.fecha_plan,
    p.beca_porcentaje,
    p.beca_tipo,
    c.nombre AS ciclo_escolar,

    p.concepto_1, p.fecha_1, p.cantidad_1, p.estatus_1,
    p.concepto_2, p.fecha_2, p.cantidad_2, p.estatus_2,
    p.concepto_3, p.fecha_3, p.cantidad_3, p.estatus_3,
    p.concepto_4, p.fecha_4, p.cantidad_4, p.estatus_4,
    p.concepto_5, p.fecha_5, p.cantidad_5, p.estatus_5,
    p.concepto_6, p.fecha_6, p.cantidad_6, p.estatus_6,
    p.concepto_7, p.fecha_7, p.cantidad_7, p.estatus_7,
    p.concepto_8, p.fecha_8, p.cantidad_8, p.estatus_8,
    p.concepto_9, p.fecha_9, p.cantidad_9, p.estatus_9,
    p.concepto_10, p.fecha_10, p.cantidad_10, p.estatus_10,
    p.concepto_11, p.fecha_11, p.cantidad_11, p.estatus_11,
    p.concepto_12, p.fecha_12, p.cantidad_12, p.estatus_12,
    p.concepto_13, p.fecha_13, p.cantidad_13, p.estatus_13,
    p.concepto_14, p.fecha_14, p.cantidad_14, p.estatus_14,
    p.concepto_15, p.fecha_15, p.cantidad_15, p.estatus_15,

    -- Desglose (Especialidades)
    p.desglose_conceptos,
    p.desglose_total_bruto,
    p.desglose_descuento_porcentaje,
    p.desglose_descuento_monto,
    p.desglose_total_neto,

    COALESCE(p.licenciatura, a.licenciatura) AS licenciatura,
    (COALESCE(p.grado, a.grado_actual) || ' - ' || COALESCE(p.turno, a.turno)) AS grado_turno,
    p.grado,
    p.turno,
    p.tipo_plan
FROM public.planes_pago p
LEFT JOIN public.alumnos a ON p.alumno_id = a.id
LEFT JOIN public.ciclos_escolares c ON p.ciclo_id = c.id;

-- ==========================================
-- 9. TABLA: RECIBOS (CONTROL DE INGRESOS)
-- (Depende de alumnos y ciclos_escolares)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.recibos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    folio SERIAL UNIQUE NOT NULL,          -- Folio secuencial automático
    folio_fiscal VARCHAR,                  -- Para cuando se factura un recibo
    fecha_recibo DATE NOT NULL,
    fecha_pago DATE NOT NULL,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE RESTRICT,
    ciclo_id UUID REFERENCES public.ciclos_escolares(id) ON DELETE RESTRICT,
    total NUMERIC(15,2) NOT NULL,
    forma_pago TEXT NOT NULL,
    banco TEXT NOT NULL,
    estatus TEXT DEFAULT 'ACTIVO' CHECK (estatus IN ('ACTIVO', 'CANCELADO')),

    -- Funcionalidades de facturación y monedero
    uso_saldo_a_favor NUMERIC(10,2),       -- Monto del saldo a favor usado en este recibo
    requiere_factura BOOLEAN DEFAULT false,
    estatus_factura VARCHAR DEFAULT 'NO APLICA',  -- 'NO APLICA', 'PENDIENTE', 'FACTURADO'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recibos_alumno ON public.recibos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_recibos_ciclo ON public.recibos(ciclo_id);

-- ==========================================
-- 10. TABLA: RECIBOS_DETALLES
-- (Depende de recibos)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.recibos_detalles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recibo_id UUID REFERENCES public.recibos(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL,
    concepto TEXT NOT NULL,
    costo_unitario NUMERIC(15,2) NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL,
    indice_concepto_plan INTEGER,           -- 1 a 15, vincula a qué concepto del plan se abonó
    observaciones TEXT,                     -- Nota de abono parcial: "Abono $X — Restante: $Y"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recibos_detalles_recibo ON public.recibos_detalles(recibo_id);

-- ==========================================
-- 11. TABLA: SERVICIO SOCIAL
-- (Depende de alumnos)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.servicio_social (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE NOT NULL,
    nombre_empresa TEXT NOT NULL,
    tipo_empresa TEXT NOT NULL,             -- 'PRIVADA' | 'PUBLICA'
    fecha_registro DATE NOT NULL,
    fecha_inicio DATE,
    fecha_termino DATE,
    horas_cubrir INTEGER NOT NULL,
    estatus TEXT NOT NULL DEFAULT 'EN_CURSO',  -- 'EN_CURSO' | 'LIBERADO'
    nombre_programa TEXT,

    -- Variante legal
    variante_legal TEXT NOT NULL DEFAULT 'ART_55',  -- 'ART_55' | 'ART_52' | 'ART_91'

    -- ART. 52 — Exención por condición personal
    art52_motivo TEXT,                     -- 'EDAD' | 'ENFERMEDAD'
    art52_doc_acta TEXT NOT NULL DEFAULT 'PENDIENTE',       -- 'PENDIENTE' | 'ENTREGADO'
    art52_doc_expediente TEXT NOT NULL DEFAULT 'PENDIENTE',  -- 'PENDIENTE' | 'ENTREGADO'

    -- ART. 91 — Experiencia laboral
    art91_req_constancia BOOLEAN NOT NULL DEFAULT false,
    art91_req_comprobantes BOOLEAN NOT NULL DEFAULT false,
    art91_req_informe BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_servicio_social_alumno ON public.servicio_social(alumno_id);

-- ==========================================
-- 12. TABLA: FICHA DE TITULACIÓN
-- (Nombre real en Supabase: ficha_titulacion — singular)
-- (Depende de alumnos; alumno_id es UNIQUE — 1 ficha por alumno)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ficha_titulacion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID UNIQUE REFERENCES public.alumnos(id) ON DELETE CASCADE,

    -- Requisitos
    modalidad TEXT,
    pago_titulacion TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    certificado_estudios TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    ingles TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    servicio_social_req TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    fotografias TEXT NOT NULL DEFAULT 'PENDIENTES',
    promedio_alto_rendimiento TEXT NOT NULL DEFAULT 'SIN_INICIAR',

    -- Documentos oficiales
    doc_antecedente TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_antecedente_nota TEXT,
    doc_acta_nacimiento TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_acta_nacimiento_nota TEXT,
    doc_curp TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_curp_nota TEXT,
    doc_titulo_profesional TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_titulo_profesional_nota TEXT,
    doc_cedula_profesional TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_cedula_profesional_nota TEXT,

    -- Seguimiento del trámite
    fecha_inicio_tramite DATE,
    fecha_estimada_culminacion DATE,
    tramite_completado BOOLEAN NOT NULL DEFAULT false,
    fecha_completado TIMESTAMP WITH TIME ZONE,
    enlace_drive TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ficha_titulacion_alumno ON public.ficha_titulacion(alumno_id);

-- ==========================================
-- 13. TABLA: FICHA DE CERTIFICACIÓN
-- (Nombre real en Supabase: ficha_certificacion — singular)
-- (Depende de alumnos; alumno_id es UNIQUE — 1 ficha por alumno)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ficha_certificacion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID UNIQUE REFERENCES public.alumnos(id) ON DELETE CASCADE,

    pago_certificado TEXT NOT NULL DEFAULT 'SIN_INICIAR',

    -- Documentos oficiales
    doc_acta_nacimiento TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_acta_nacimiento_nota TEXT,
    doc_curp TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_curp_nota TEXT,
    doc_antecedente TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_antecedente_nota TEXT,
    doc_titulo_profesional TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_titulo_profesional_nota TEXT,
    doc_cedula_profesional TEXT NOT NULL DEFAULT 'SIN_INICIAR',
    doc_cedula_profesional_nota TEXT,

    tipo_certificado TEXT,                 -- 'TOTAL' | 'PARCIAL'

    -- Seguimiento del trámite
    fecha_inicio_tramite DATE,
    fecha_termino_tramite DATE,
    tramite_completado BOOLEAN NOT NULL DEFAULT false,
    fecha_completado TIMESTAMP WITH TIME ZONE,
    enlace_drive TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ficha_certificacion_alumno ON public.ficha_certificacion(alumno_id);

-- ==========================================
-- 14. TABLA: PLANES DE ESTUDIO (ACADÉMICO)
-- (Depende de catalogos via licenciatura_id)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.planes_estudio (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    licenciatura_id UUID,                  -- Referencia lógica a catalogos.id (tipo='licenciatura')
    clave_legado TEXT UNIQUE NOT NULL,     -- Clave del sistema legado (GES)
    nombre TEXT NOT NULL,
    estatus TEXT,
    creditos_obligatorios NUMERIC,
    tipo_periodo TEXT,                     -- 'CUATRIMESTRAL' | 'SEMESTRAL'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 15. TABLA: ASIGNATURAS
-- (Depende de planes_estudio)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.asignaturas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id UUID REFERENCES public.planes_estudio(id) ON DELETE CASCADE,
    clave_legado TEXT NOT NULL,            -- Clave del sistema legado (GES)
    nombre TEXT NOT NULL,
    creditos NUMERIC,
    etapa_clave TEXT,
    etapa_nombre TEXT,
    clasificacion_nombre TEXT,
    clasificacion_clave TEXT,
    activo BOOLEAN DEFAULT true,
    numero_periodo INTEGER,               -- Cuatrimestre/Semestre al que pertenece
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_asignaturas_plan ON public.asignaturas(plan_id);

-- ==========================================
-- 16. TABLA: UI PREFERENCIAS (PERSISTENCIA DE UI POR USUARIO/MÓDULO)
-- (Sin dependencia FK — usuario_id es TEXT para flexibilidad)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ui_preferencias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id TEXT NOT NULL,              -- ID del usuario (como texto)
    modulo TEXT NOT NULL,                  -- Identificador del módulo de la app
    preferencias JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_ui_preferencias_usuario ON public.ui_preferencias(usuario_id, modulo);

-- ==========================================
-- 17. TABLA LEGACY: CONTROL_PAGOS
-- (Tabla original del sistema — mantenida por compatibilidad/histórico.
--  Los datos activos están en planes_pago + vista_planes_pago)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.control_pagos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre_alumno TEXT NOT NULL,
    no_plan_pagos TEXT,
    fecha_plan TEXT,
    beca_porcentaje TEXT,
    beca_tipo TEXT,
    concepto_1 TEXT, fecha_1 TEXT, cantidad_1 NUMERIC, estatus_1 TEXT,
    concepto_2 TEXT, fecha_2 TEXT, cantidad_2 NUMERIC, estatus_2 TEXT,
    concepto_3 TEXT, fecha_3 TEXT, cantidad_3 NUMERIC, estatus_3 TEXT,
    concepto_4 TEXT, fecha_4 TEXT, cantidad_4 NUMERIC, estatus_4 TEXT,
    concepto_5 TEXT, fecha_5 TEXT, cantidad_5 NUMERIC, estatus_5 TEXT,
    licenciatura TEXT,
    grado_turno TEXT
);

-- ==========================================
-- 18. POLÍTICAS DE SEGURIDAD (RLS)
-- ==========================================
-- Habilitar RLS en todas las tablas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciclos_escolares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_app ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicio_social ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha_titulacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha_certificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_estudio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_preferencias ENABLE ROW LEVEL SECURITY;

-- ── Políticas actuales: Acceso abierto para usuarios autenticados ──
-- NOTA: La sesión del usuario se gestiona vía Supabase Auth (JWT).
-- Todas las operaciones pasan por el Anon Key con sesión activa.
-- *Recomendación Futura*: Restringir con auth.uid() y roles de Supabase.
-- ── Función de Seguridad para RLS ──
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT rol FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ── Políticas de Seguridad Estrictas ──
-- USUARIOS: Solo lectura para todos, escritura solo para Administrador
CREATE POLICY "Lectura usuarios" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Modificar usuarios" ON public.usuarios FOR ALL USING (public.get_user_role() = 'ADMINISTRADOR');

-- ALUMNOS: Lectura para todos, modificación solo para Admin/Coordinador
CREATE POLICY "Lectura alumnos" ON public.alumnos FOR SELECT USING (true);
CREATE POLICY "Modificar alumnos" ON public.alumnos FOR INSERT WITH CHECK (public.get_user_role() IN ('ADMINISTRADOR', 'COORDINADOR'));
CREATE POLICY "Actualizar alumnos" ON public.alumnos FOR UPDATE USING (public.get_user_role() IN ('ADMINISTRADOR', 'COORDINADOR'));
CREATE POLICY "Eliminar alumnos" ON public.alumnos FOR DELETE USING (public.get_user_role() IN ('ADMINISTRADOR', 'COORDINADOR'));

-- RECIBOS: Lectura e Inserción para todos, Delete solo Admin/Coordinador
CREATE POLICY "Lectura recibos" ON public.recibos FOR SELECT USING (true);
CREATE POLICY "Insertar recibos" ON public.recibos FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualizar recibos" ON public.recibos FOR UPDATE USING (true);
CREATE POLICY "Eliminar recibos" ON public.recibos FOR DELETE USING (public.get_user_role() IN ('ADMINISTRADOR', 'COORDINADOR'));

-- Políticas actuales (Abiertas temporalmente):
CREATE POLICY "Acceso total - ciclos" ON public.ciclos_escolares FOR ALL USING (true);
CREATE POLICY "Acceso total - catalogos" ON public.catalogos FOR ALL USING (true);
CREATE POLICY "Acceso total - configuracion" ON public.configuracion_app FOR ALL USING (true);
CREATE POLICY "Acceso total - plantillas" ON public.plantillas_plan FOR ALL USING (true);
CREATE POLICY "Acceso total - planes" ON public.planes_pago FOR ALL USING (true);
CREATE POLICY "Acceso total - recibos_detalles" ON public.recibos_detalles FOR ALL USING (true);
CREATE POLICY "Acceso total - servicio_social" ON public.servicio_social FOR ALL USING (true);
CREATE POLICY "Acceso total - ficha_titulacion" ON public.ficha_titulacion FOR ALL USING (true);
CREATE POLICY "Acceso total - ficha_certificacion" ON public.ficha_certificacion FOR ALL USING (true);
CREATE POLICY "Acceso total - planes_estudio" ON public.planes_estudio FOR ALL USING (true);
CREATE POLICY "Acceso total - asignaturas" ON public.asignaturas FOR ALL USING (true);
CREATE POLICY "Acceso total - ui_preferencias" ON public.ui_preferencias FOR ALL USING (true);

-- ======================================================================================
-- 19. MIGRACIÓN GRADUAL: NORMALIZACIÓN DE PLANES DE PAGO A 1NF
-- ======================================================================================

-- 1. Crear la nueva tabla relacional para los conceptos detallados
CREATE TABLE IF NOT EXISTS public.planes_pago_detalles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id UUID REFERENCES public.planes_pago(id) ON DELETE CASCADE NOT NULL,
    indice_concepto INTEGER NOT NULL CHECK (indice_concepto BETWEEN 1 AND 15),
    concepto TEXT NOT NULL,
    fecha_vencimiento DATE,
    cantidad NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    estatus TEXT DEFAULT 'PENDIENTE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexar para optimizar las queries financieras y reportes de morosidad
CREATE INDEX IF NOT EXISTS idx_pp_detalles_plan ON public.planes_pago_detalles(plan_id);
CREATE INDEX IF NOT EXISTS idx_pp_detalles_vencimiento ON public.planes_pago_detalles(fecha_vencimiento);

-- 2. Función PL/pgSQL para sincronizar automáticamente el formato viejo al nuevo
CREATE OR REPLACE FUNCTION public.sync_planes_pago_to_detalles()
RETURNS TRIGGER AS $$
DECLARE
    i INT;
    v_concepto TEXT;
    v_fecha_txt TEXT;
    v_fecha_date DATE;
    v_cantidad NUMERIC(10,2);
    v_estatus TEXT;
BEGIN
    -- Limpiar detalles existentes del plan modificado para reescribir de forma limpia
    DELETE FROM public.planes_pago_detalles WHERE plan_id = NEW.id;

    -- Procesar Conceptos 1 al 9 (Manejo de fechas tipo TEXT legacy)
    FOR i IN 1..9 LOOP
        EXECUTE format('SELECT ($1).concepto_%s, ($1).fecha_%s, ($1).cantidad_%s, ($1).estatus_%s', i, i, i, i)
        USING NEW
        INTO v_concepto, v_fecha_txt, v_cantidad, v_estatus;

        IF v_concepto IS NOT NULL AND v_concepto != '' THEN
            -- Intento de casteo seguro de TEXT a DATE
            BEGIN
                IF v_fecha_txt ~ '^\d{2}/\d{2}/\d{4}$' THEN
                    v_fecha_date := to_date(v_fecha_txt, 'DD/MM/YYYY');
                ELSIF v_fecha_txt ~ '^\d{4}-\d{2}-\d{2}$' THEN
                    v_fecha_date := v_fecha_txt::DATE;
                ELSE
                    v_fecha_date := NULL;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_fecha_date := NULL;
            END;

            INSERT INTO public.planes_pago_detalles (plan_id, indice_concepto, concepto, fecha_vencimiento, cantidad, estatus)
            VALUES (NEW.id, i, v_concepto, v_fecha_date, COALESCE(v_cantidad, 0), COALESCE(v_estatus, 'PENDIENTE'));
        END IF;
    END LOOP;

    -- Procesar Conceptos 10 al 15 (Fechas nativas DATE)
    FOR i IN 10..15 LOOP
        EXECUTE format('SELECT ($1).concepto_%s, ($1).fecha_%s, ($1).cantidad_%s, ($1).estatus_%s', i, i, i, i)
        USING NEW
        INTO v_concepto, v_fecha_date, v_cantidad, v_estatus;

        IF v_concepto IS NOT NULL AND v_concepto != '' THEN
            INSERT INTO public.planes_pago_detalles (plan_id, indice_concepto, concepto, fecha_vencimiento, cantidad, estatus)
            VALUES (NEW.id, i, v_concepto, v_fecha_date, COALESCE(v_cantidad, 0), COALESCE(v_estatus, 'PENDIENTE'));
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el disparador para mantener la consistencia en tiempo real
DROP TRIGGER IF EXISTS tg_sync_planes_pago_detalles ON public.planes_pago;
CREATE TRIGGER tg_sync_planes_pago_detalles
    AFTER INSERT OR UPDATE ON public.planes_pago
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_planes_pago_to_detalles();

-- 4. FASE 2: Forzar la migración de todos los registros históricos existentes
-- UPDATE public.planes_pago SET created_at = created_at;

-- Política de RLS para planes_pago_detalles
ALTER TABLE public.planes_pago_detalles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total - planes_pago_detalles" ON public.planes_pago_detalles FOR ALL USING (true);
