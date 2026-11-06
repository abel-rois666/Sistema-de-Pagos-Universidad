import { fetchAllSupabase, supabase } from '../lib/supabase';
/** Solo nombres accesibles por RLS; no atribuye un autor ausente a la sesión actual. */
export async function conResponsablesHistorial<T extends {creado_por?:string}>(filas:T[]):Promise<(T&{responsable?:string})[]>{
 const ids=[...new Set(filas.map(f=>f.creado_por).filter((id):id is string=>Boolean(id&&/^[0-9a-f-]{36}$/i.test(id))))];
 const perfiles:{id:string;auth_id:string|null;username:string}[]=[];
 for(let i=0;i<ids.length;i+=100){
  const lote=ids.slice(i,i+100).join(',');
  try{const {data,error}=await fetchAllSupabase(()=>supabase.from('usuarios').select('id,auth_id,username').or(`auth_id.in.(${lote}),id.in.(${lote})`).order('id'));
  if(!error)perfiles.push(...data||[]);}catch{/* La bitácora permanece visible cuando el perfil no es accesible. */}
 }
 return filas.map(f=>({...f,responsable:perfiles.find(p=>p.auth_id===f.creado_por)?.username||perfiles.find(p=>p.id===f.creado_por)?.username}));
}
