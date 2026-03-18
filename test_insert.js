import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
  console.log("Testing insert...");
  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ username: 'testuser1', password: 'asd', rol: 'ADMINISTRADOR' }]);
  
  if (error) {
    console.error("SUPABASE ERROR:", error.message);
  } else {
    console.log("SUCCESS. Data:", data);
  }
}

testInsert();
