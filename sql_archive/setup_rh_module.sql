-- =====================================================================================
-- MÓDULO DE RECURSOS HUMANOS Y NOM-035 (Guía II)
-- =====================================================================================

-- 1. Tabla de Empleados
CREATE TABLE IF NOT EXISTS empleados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombres TEXT NOT NULL,
    apellido_paterno TEXT NOT NULL,
    apellido_materno TEXT,
    rfc VARCHAR(13),
    curp VARCHAR(18),
    clave_puesto INT4,
    puesto TEXT,
    departamento TEXT,
    tipo_contratacion TEXT,
    tipo_jornada TEXT,
    estatus VARCHAR(50) DEFAULT 'activo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Evaluaciones NOM-035
CREATE TABLE IF NOT EXISTS nom035_evaluaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID REFERENCES empleados(id) ON DELETE CASCADE,
    respuestas JSONB NOT NULL,
    calificacion_final NUMERIC NOT NULL,
    nivel_riesgo VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Planes de Acción
CREATE TABLE IF NOT EXISTS nom035_planes_accion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    descripcion TEXT,
    nivel_intervencion VARCHAR(50) NOT NULL,
    estatus VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =====================================================================================

-- Empleados
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de empleados"
ON empleados FOR SELECT USING (true);

CREATE POLICY "Todos pueden insertar empleados"
ON empleados FOR INSERT WITH CHECK (true);

CREATE POLICY "Todos pueden actualizar empleados"
ON empleados FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Todos pueden eliminar empleados"
ON empleados FOR DELETE USING (true);

-- Evaluaciones
ALTER TABLE nom035_evaluaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de evaluaciones"
ON nom035_evaluaciones FOR SELECT USING (true);

CREATE POLICY "Todos pueden insertar evaluaciones"
ON nom035_evaluaciones FOR INSERT WITH CHECK (true);

CREATE POLICY "Todos pueden actualizar evaluaciones"
ON nom035_evaluaciones FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Todos pueden eliminar evaluaciones"
ON nom035_evaluaciones FOR DELETE USING (true);

-- Planes de Acción
ALTER TABLE nom035_planes_accion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de planes"
ON nom035_planes_accion FOR SELECT USING (true);

CREATE POLICY "Todos pueden insertar planes"
ON nom035_planes_accion FOR INSERT WITH CHECK (true);

CREATE POLICY "Todos pueden actualizar planes"
ON nom035_planes_accion FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Todos pueden eliminar planes"
ON nom035_planes_accion FOR DELETE USING (true);
