ALTER TABLE empleados 
ADD COLUMN fecha_nacimiento DATE,
ADD COLUMN sexo VARCHAR(20),
ADD COLUMN estado_civil VARCHAR(50),
ADD COLUMN nivel_estudios VARCHAR(100),
ADD COLUMN nivel_estudios_estado VARCHAR(50),
ADD COLUMN direccion TEXT,
ADD COLUMN telefono VARCHAR(20),
ADD COLUMN fecha_ingreso DATE,
ADD COLUMN documentos_entregados JSONB DEFAULT '{}'::jsonb,
ADD COLUMN enlace_drive TEXT;
