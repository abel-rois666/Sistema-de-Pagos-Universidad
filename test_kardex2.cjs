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

fetch(url + '/rest/v1/alumnos?select=matricula&limit=1&matricula=not.is.null', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}).then(r => r.json()).then(data => {
  const matricula = data[0].matricula;
  console.log('Testing matricula:', matricula);
  return fetch('http://localhost:3001/api/legacy/kardex/' + matricula + '?umbral=6');
}).then(r => r.json()).then(console.log).catch(console.error);
