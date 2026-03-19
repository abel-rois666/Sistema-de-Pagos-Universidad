const fs = require('fs');
const bcrypt = require('bcryptjs');

const passwords = [
  { username: 'admin', password: 'admin123' },
  { username: 'coordinador', password: 'coord123' },
];

async function main() {
  console.log("Generando hashes...");
  let sql = "";
  for (const { username, password } of passwords) {
    const hash = await bcrypt.hash(password, 12);
    sql += `UPDATE public.usuarios SET password = '${hash}' WHERE username = '${username}';\n`;
  }
  fs.writeFileSync('./hashes_generados.sql', sql);
  console.log("¡Listo! Se ha creado el archivo 'hashes_generados.sql' en esta carpeta con tus consultas.");
}

main().catch(console.error);
