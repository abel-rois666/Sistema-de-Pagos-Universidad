// Requiere un servidor PostgreSQL desechable ya iniciado; nunca reutiliza ni borra una base.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const psql=process.env.PSQL_LOCAL||'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const conexion='host=127.0.0.1 hostaddr=127.0.0.1 port=55449 user=postgres connect_timeout=5 sslmode=disable';
function sql(base,texto){
 const r=spawnSync(psql,['-X','-w',conexion+' dbname='+base,'-v','ON_ERROR_STOP=1','-f','-'],{input:texto,encoding:'utf8',windowsHide:true,maxBuffer:2e6});
 if(r.error)throw r.error;
 if(r.status!==0)throw new Error(r.stderr||r.stdout);
 process.stdout.write(r.stderr);return r.stdout;
}
sql('postgres',"do $$begin if inet_server_port()<>55449 then raise exception 'Puerto no autorizado';end if;if exists(select 1 from pg_database where datname='ensayo_titulacion') then raise exception 'La base ensayo_titulacion ya existe: se requiere un servidor desechable vacío';end if;end$$;create database ensayo_titulacion;");
const original=await readFile('supabase/migrations/20261110100000_titulacion_por_programa.sql','utf8');
const inicio=original.indexOf('create function public.titulacion_guardar_v1(');
const fin=original.indexOf('to authenticated;',original.indexOf('grant execute on function public.titulacion_guardar_v1(',inicio))+'to authenticated;'.length;
if(inicio<0||fin<=inicio)throw new Error('No se encontró la función base revisada');
for(const texto of [
 await readFile('scripts/tests/requisitosTitulacion.base.local.sql','utf8'),
 original.slice(inicio,fin),
 await readFile('supabase/migrations/20261118150000_requisitos_titulacion_por_programa.sql','utf8'),
 await readFile('scripts/tests/requisitosTitulacion.casos.local.sql','utf8'),
 await readFile('supabase/checks/verificar_requisitos_titulacion.sql','utf8')
])sql('ensayo_titulacion',texto);
console.log('Migración, requisitos, permisos, auditoría y finalización aprobados en la base ficticia local.');
