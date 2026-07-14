import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findInconsistentStudents() {
  const { data: ciclos, error: errC } = await supabase
    .from('ciclos_escolares')
    .select('id')
    .eq('nombre', '2013-2');

  if (errC || !ciclos || ciclos.length === 0) return console.error('No ciclo 2013-2');
  const cicloId = ciclos[0].id;

  const { data: asignaturas, error: errA } = await supabase
    .from('asignaturas')
    .select('id')
    .eq('numero_periodo', 1);

  if (errA || !asignaturas || asignaturas.length === 0) return console.error('No asignaturas periodo 1');
  const asigIds = asignaturas.map(a => a.id);

  const { data: insc, error: errI } = await supabase
    .from('inscripciones_academicas')
    .select('alumno_id, alumno:alumnos(nombre_completo)')
    .eq('ciclo_id', cicloId)
    .in('asignatura_id', asigIds);

  if (errI) return console.error(errI);
  
  // unique students
  const map = new Map();
  for(const i of insc) {
    if(!map.has(i.alumno_id)) map.set(i.alumno_id, i.alumno?.nombre_completo);
  }

  console.log('Alumnos con 2013-2 en el bloque 1:');
  for(const [id, nombre] of map.entries()) {
    console.log(`- ${nombre} (${id})`);
  }
}

findInconsistentStudents();
