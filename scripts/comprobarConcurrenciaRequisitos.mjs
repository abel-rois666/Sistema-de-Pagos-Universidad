// Exclusivo del ensayo desechable autorizado; no acepta URL de Supabase ni otra base.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const ejecutable=process.env.PSQL_LOCAL||'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const conexion='host=127.0.0.1 hostaddr=127.0.0.1 port=55449 user=postgres dbname=ensayo_titulacion connect_timeout=5 sslmode=disable';
const guardia="do $$begin if current_database()<>'ensayo_titulacion' or inet_server_port()<>55449 then raise exception 'Solo ensayo local ficticio';end if;end$$;";
const autorizar="select set_config('request.jwt.claim.sub',u('admin')::text,false);";
function ejecutar(sql,alLeer=()=>{}){
 const hijo=spawn(ejecutable,['-X','-w',conexion,'-v','ON_ERROR_STOP=1','-f','-'],{windowsHide:true});
 let salida='';
 const fin=new Promise((resolve,reject)=>{
  hijo.on('error',reject);
  hijo.stdout.on('data',b=>{salida+=b;alLeer(String(b));});
  hijo.stderr.on('data',b=>salida+=b);
  hijo.on('close',codigo=>resolve({codigo,salida}));
 });
 hijo.stdin.end(guardia+'\n'+sql);return fin;
}
const preparada=await ejecutar(autorizar+"select titulacion_guardar_v1(u('a'),u('pr'),(select id from ficha_titulacion where alumno_programa_id=u('pr')),2,'{}','REABRIR','Ensayo simultáneo ficticio');");
assert.equal(preparada.codigo,0,preparada.salida);
let liberar;
const bloqueada=new Promise(resolve=>liberar=resolve);
const cancelacion=ejecutar("begin;update recibos set estatus='CANCELADO' where id=u('r');\n\\echo RECIBO_BLOQUEADO\nselect pg_sleep(2);commit;",s=>{if(s.includes('RECIBO_BLOQUEADO'))liberar();});
// Si la sesión falla antes del marcador, no dejar una espera pendiente.
await Promise.race([bloqueada,cancelacion.then(r=>{if(r.codigo!==0)throw new Error(r.salida);})]);
const inicio=Date.now();
const completar=await ejecutar(autorizar+"set lock_timeout='5s';select titulacion_guardar_v1(u('a'),u('pr'),(select id from ficha_titulacion where alumno_programa_id=u('pr')),3,'{}','COMPLETAR','Ensayo simultáneo ficticio');");
assert.equal((await cancelacion).codigo,0);
assert.notEqual(completar.codigo,0,'No puede completar con el recibo cancelado');
assert.match(completar.salida,/Faltan requisitos o datos del acta/);
assert.ok(Date.now()-inicio>=500,'La finalización esperó el bloqueo del recibo');
const final=await ejecutar("select comprobar('la ficha sigue abierta y sin revisión parcial',exists(select 1 from ficha_titulacion where alumno_programa_id=u('pr') and not tramite_completado and revision=3));");
assert.equal(final.codigo,0,final.salida);
console.log('Dos conexiones locales ficticias: COMPLETAR espera la cancelación y después rechaza el pago; ficha abierta y revisión sin cambios parciales.');
