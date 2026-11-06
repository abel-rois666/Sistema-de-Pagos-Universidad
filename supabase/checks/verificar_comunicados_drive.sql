-- Solo lectura. Verificar después de aplicar la migración.
select c.relname as tabla, c.relrowsecurity as rls_activa,
  has_table_privilege('anon', c.oid, 'SELECT') as lectura_anon,
  has_table_privilege('authenticated', c.oid, 'SELECT') as lectura_authenticated,
  has_table_privilege('authenticated', c.oid, 'INSERT') as insercion_authenticated
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
  ('comunicados_drive_conexion', 'comunicados_oauth_estados',
   'comunicados_emisiones', 'comunicados_documentos')
order by c.relname;
