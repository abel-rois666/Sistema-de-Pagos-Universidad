require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testUpdate() {
  // 1. Fetch one student to test with
  const { data: alumnos, error: fetchErr } = await supabase
    .from('alumnos')
    .select('*')
    .limit(1);

  if (fetchErr) {
    console.error('Fetch error:', fetchErr.message);
    return;
  }

  if (!alumnos || alumnos.length === 0) {
    console.log('No students found to test.');
    return;
  }

  const student = alumnos[0];
  console.log('Original Student:', student.nombre_completo, '- Grado:', student.grado_actual, '- Licenciatura:', student.licenciatura);

  const oldGrado = student.grado_actual;
  const newGrado = (oldGrado === 'TEST_GRADO') ? 'OTHER_GRADO' : 'TEST_GRADO';

  // 2. Try to update using upsert with the same shape as the app
  const payload = {
    id: student.id,
    nombre_completo: student.nombre_completo,
    licenciatura: student.licenciatura,
    grado_actual: newGrado,
    turno: student.turno,
    estatus: student.estatus || 'ACTIVO',
    beca_porcentaje: student.beca_porcentaje || '0%',
    beca_tipo: student.beca_tipo || 'NINGUNA',
    ciclo_ultima_asignacion_grado: student.ciclo_ultima_asignacion_grado || null
  };

  const { error: upsertErr } = await supabase.from('alumnos').upsert(
    [payload],
    { onConflict: 'id' }
  );

  if (upsertErr) {
    console.error('Upsert Error:', upsertErr.message);
    return;
  }

  // 3. Fetch again to verify
  const { data: verify, error: verifyErr } = await supabase
    .from('alumnos')
    .select('*')
    .eq('id', student.id)
    .single();

  if (verifyErr) {
    console.error('Verify error:', verifyErr.message);
    return;
  }

  console.log('Updated Student:', verify.nombre_completo, '- Grado:', verify.grado_actual, '- Licenciatura:', verify.licenciatura);
  console.log('Update Successful?', verify.grado_actual === newGrado);
  
  // Revert
  await supabase.from('alumnos').upsert([{ ...payload, grado_actual: oldGrado }], { onConflict: 'id' });
}

testUpdate();
