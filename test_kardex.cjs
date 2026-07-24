const fs = require('fs');
const envPath = '.env.local';
let env = '';
if (fs.existsSync(envPath)) {
  env = fs.readFileSync(envPath, 'utf8');
} else if (fs.existsSync('.env')) {
  env = fs.readFileSync('.env', 'utf8');
}
const matchUrl = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/);
const matchKey = env.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/);
const url = matchUrl ? matchUrl[1].replace(/["']/g, '').trim() : '';
const key = matchKey ? matchKey[1].replace(/["']/g, '').trim() : '';

fetch(url + '/rest/v1/inscripciones_academicas?select=ciclo_id,ciclo_legado&limit=10', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}).then(r => r.json()).then(console.log);
