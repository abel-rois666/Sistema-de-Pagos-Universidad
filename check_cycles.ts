import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCycles() {
  const { data, error } = await supabase
    .from('ciclos_escolares')
    .select('*')
    .like('nombre', '2013%');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Ciclos 2013:', JSON.stringify(data, null, 2));
  }
}

checkCycles();
