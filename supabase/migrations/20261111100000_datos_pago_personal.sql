-- Preparada, NO ejecutada. Requiere personal_y_docentes y sus helpers vigentes.
begin;
create table public.personal_datos_pago (
 persona_id uuid primary key references public.personal_personas(id) on delete restrict,
 nss text check(nss is null or nss ~ '^[0-9]{11}$'),
 clabe text check(clabe is null or clabe ~ '^[0-9]{1,18}$'),
 cuenta text check(cuenta is null or cuenta ~ '^[0-9]{1,11}$'),
 tarjeta text check(tarjeta is null or tarjeta ~ '^[0-9]{1,16}$'),
 revision integer not null default 1 check(revision>0), actualizado_en timestamptz not null default now()
);
alter table public.personal_datos_pago enable row level security;
revoke all on public.personal_datos_pago from public,anon,authenticated;

create function public.personal_pago_consultar_v1(p_tipo text,p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); f jsonb; r public.personal_datos_pago;
begin
 if rol not in ('ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS') then raise exception 'Sin acceso a datos privados de pago' using errcode='42501';end if;
 f=public._personal_fuente_v1(p_tipo,p_id);
 if f->'registro'='null'::jsonb then raise exception 'Registro no encontrado';end if;
 select * into r from public.personal_datos_pago where persona_id=(f->>'persona_id')::uuid;
 return jsonb_build_object('persona_id',f->'persona_id','revision',coalesce(r.revision,0),'puede_editar',rol='ADMINISTRADOR',
 'datos',jsonb_build_object('nss',r.nss,'clabe',r.clabe,'cuenta',r.cuenta,'tarjeta',r.tarjeta));
end $$;

create function public.personal_pago_guardar_v1(p_tipo text,p_id uuid,p_persona uuid,p_revision integer,p_datos jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); f jsonb; anterior public.personal_datos_pago; siguiente public.personal_datos_pago; k text; v text; antes jsonb='{}'; despues jsonb='{}';
begin
 if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración puede editar datos de pago' using errcode='42501';end if;
 if p_motivo is null or length(trim(p_motivo)) not between 5 and 1000 or p_revision is null or p_revision<0 then raise exception 'Indica el motivo y la revisión de los datos';end if;
 f=public._personal_fuente_v1(p_tipo,p_id,true);
 if p_persona is null or (f->>'persona_id')::uuid is distinct from p_persona then raise exception 'La identidad cambió. Actualiza la ficha antes de guardar';end if;
 perform 1 from public.personal_personas where id=p_persona for update;
 select * into anterior from public.personal_datos_pago where persona_id=p_persona for update;
 if coalesce(anterior.revision,0)<>p_revision then raise exception 'Los datos cambiaron. Cancela y vuelve a consultar antes de guardar' using errcode='40001';end if;
 if p_datos is null or jsonb_typeof(p_datos)<>'object' or (p_datos - array['nss','clabe','cuenta','tarjeta'])<>'{}'::jsonb then raise exception 'Campos de pago no reconocidos';end if;
 foreach k in array array['nss','clabe','cuenta','tarjeta'] loop
  if p_datos ? k and jsonb_typeof(p_datos->k) not in ('string','null') then raise exception 'Los identificadores deben ser texto numérico';end if;
  v=nullif(p_datos->>k,'');
  if v is not null and (v !~ '^[0-9]+$' or (k='nss' and length(v)<>11) or (k='clabe' and length(v)>18) or (k='cuenta' and length(v)>11) or (k='tarjeta' and length(v)>16)) then raise exception 'Revisa la estructura del campo %',k;end if;
  antes=antes||jsonb_build_object(k,case when to_jsonb(anterior)->>k is null then null else '••••'||right(to_jsonb(anterior)->>k,4) end);
  despues=despues||jsonb_build_object(k,case when v is null then null else '••••'||right(v,4) end);
 end loop;
 insert into public.personal_datos_pago(persona_id,nss,clabe,cuenta,tarjeta,revision) values(p_persona,nullif(p_datos->>'nss',''),nullif(p_datos->>'clabe',''),nullif(p_datos->>'cuenta',''),nullif(p_datos->>'tarjeta',''),p_revision+1)
 on conflict(persona_id) do update set nss=excluded.nss,clabe=excluded.clabe,cuenta=excluded.cuenta,tarjeta=excluded.tarjeta,revision=excluded.revision,actualizado_en=now() returning * into siguiente;
 insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol) values(p_persona,'datos_pago',trim(p_motivo),antes,despues,auth.uid(),rol);
 return jsonb_build_object('revision',siguiente.revision);
end $$;
revoke all on function public.personal_pago_consultar_v1(text,uuid),public.personal_pago_guardar_v1(text,uuid,uuid,integer,jsonb,text) from public,anon;
grant execute on function public.personal_pago_consultar_v1(text,uuid),public.personal_pago_guardar_v1(text,uuid,uuid,integer,jsonb,text) to authenticated;
commit;
