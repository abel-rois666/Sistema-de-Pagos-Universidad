-- Solo lee metadatos. Debe devolver LIBRE, PRESENTE y PRESENTE respectivamente.
select 'tabla horarios_borradores' as objeto,
  case when to_regclass('public.horarios_borradores') is null then 'LIBRE' else 'REVISAR: ya existe' end as resultado
union all
select 'tabla ciclos_escolares',
  case when to_regclass('public.ciclos_escolares') is not null then 'PRESENTE' else 'FALTA' end
union all
select 'función get_my_rol()',
  case when to_regprocedure('public.get_my_rol()') is not null then 'PRESENTE' else 'FALTA' end;
