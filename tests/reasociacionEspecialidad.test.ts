import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20261110110000_reasociar_especialidad_cuatrimestral.sql','utf8');
test('especialidad exige tipo exacto, periodicidad, nivel y programa inequívoco',()=>{assert.match(sql,/<> 'especialidad cuatrimestral'/);assert.match(sql,/v_tipo <> 'cuatrimestral'/);assert.match(sql,/nivel_educativo\)\)='especialidad'/);assert.match(sql,/v_programas <> 1/);assert.match(sql,/v_grupos > 1/);});
test('conserva la categoría y todos los recibos sin escritura financiera adicional',()=>{assert.match(sql,/tipo_plan = v_plan.tipo_plan/);assert.doesNotMatch(sql,/initcap\(v_tipo\)|update public.recibos|delete from|update public.planes_pago_detalles/i);assert.match(sql,/recibos_conservados_ids/);assert.match(sql,/v_plan.tipo_plan, v_plan.tipo_plan/);});
test('añade endpoint sin sustituir funciones existentes y protege autorización',()=>{assert.match(sql,/create function public.revisar_reasociacion_especialidad_pago/);assert.doesNotMatch(sql,/create or replace function/);assert.match(sql,/ADMINISTRADOR.*COORDINADOR FINANCIERO/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/from public, anon/);});
