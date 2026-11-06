-- Solo lectura. Confirmar después de aplicar SQL y antes de desplegar la función.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and
      ((table_name = 'comunicados_emisiones' and column_name = 'boleta_no_aplica') or
       (table_name = 'comunicados_plantilla_mensaje' and column_name in
         ('contenido_nuevo_ingreso', 'contenido_ingles')))
order by table_name, column_name;

select count(*) as emisiones_existentes,
       count(*) filter (where boleta_no_aplica) as emisiones_sin_boleta_explicitamente_autorizadas
from public.comunicados_emisiones;
