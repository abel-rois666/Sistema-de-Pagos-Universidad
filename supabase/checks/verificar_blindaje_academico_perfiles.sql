-- Solo lectura; no ejecuta escrituras ni cambia roles de la conexión.
select tablename,policyname,cmd,permissive,roles
from pg_policies where schemaname='public' and policyname like 'guardia_%_v1'
order by tablename,cmd,policyname;
select
  has_column_privilege('anon','public.usuarios','username','SELECT') lectura_anon_esperada_false,
  has_column_privilege('authenticated','public.usuarios','password','SELECT') password_autenticado_esperado_false,
  has_column_privilege('authenticated','public.usuarios','preferencia_tema','SELECT') preferencias_esperado_true;
select tgrelid::regclass tabla,tgname from pg_trigger where not tgisinternal
  and tgname in ('guardia_captura_docente_v1','guardia_preferencias_usuario_v1') order by tgname;
