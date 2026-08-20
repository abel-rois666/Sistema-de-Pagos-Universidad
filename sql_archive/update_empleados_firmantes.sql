-- Script para agregar campos de firmantes y título académico a la tabla de empleados

ALTER TABLE empleados 
ADD COLUMN IF NOT EXISTS firmante_certificados BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS firmante_titulos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS titulo_academico VARCHAR(50);
