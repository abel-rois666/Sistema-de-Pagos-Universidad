-- Carga oficial 911 por partes. Ejecutar ESTE archivo completo, individualmente.
-- Lote 76a45a0894459bdf9aab6365294561d80d5fa4981dbb5ae1073d552ab6ddab9f
begin;
do $publicar911$
declare v_meta jsonb=$meta911${"formato":"911-SQL-EDITOR-v1","lote":"76a45a0894459bdf9aab6365294561d80d5fa4981dbb5ae1073d552ab6ddab9f","edicion":"2026-2027","sha256_catalogo":"abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71","sha256_reglas":"d5b93319ed5d17158d4f8a97719f2c991cb1d5affbdcac8801e1a1d8b30428b8","cuestionarios":6,"campos":3209,"reglas":1618,"partes":{"fuentes_0001":{"sha256":"a43765bab7b2429151eed93a24f26f855e7c1f5d68f483a23cae2ebb2cdbaf97","bytes":40000},"fuentes_0002":{"sha256":"b81876b2af22ec5a7646b8d748582dd8b8481e63129ebd04cd6b7ff7910eceb4","bytes":40000},"fuentes_0003":{"sha256":"7789064877d36461b518f4783b85a276e92e5655b6a0eb931d663a651dcad0c6","bytes":40000},"fuentes_0004":{"sha256":"9e136230b369b1f15eea6a998103ce36b188a4b5752f492285960a6a2f5ee975","bytes":40000},"fuentes_0005":{"sha256":"7292b96b8bf86a4104f4e6313e73d6daffd91934a1bd30d22de6841469672b7a","bytes":40000},"fuentes_0006":{"sha256":"798b88ebcd8c2bbc6ee28ff4256fe9608a2df329f2c37bf416c8673ac2b1ac81","bytes":40000},"fuentes_0007":{"sha256":"3e539ab86002f9a696ce59b51c27bea12ac295bab34cbd2f539436b6e47ff74e","bytes":40000},"fuentes_0008":{"sha256":"69feff8c1554af7c3e5a614a69b630f2c9609f3095c94c247d3cc1571d96f4de","bytes":40000},"fuentes_0009":{"sha256":"8f19494e3900dfabba7ca173a36f5911870f9abd3318777727b631c75c5c4490","bytes":40000},"fuentes_0010":{"sha256":"70e272291dae53bc433855f5ead84e3fac8ab7d81b5d71199ae18a9de188b5a7","bytes":40000},"fuentes_0011":{"sha256":"c6b8e9f21064a269b6b94a0214904ca97afae108c6ab0118d0c67ff84f5c2aae","bytes":40000},"fuentes_0012":{"sha256":"430e965f7d0e3ad01b9739165577b4bd3d5f6ccf06fd674834f17eb919fd39cd","bytes":40000},"fuentes_0013":{"sha256":"29bc220f90ebfb1c83a4c524066f58dc92070f80bbd60cb2c4ec3a4d2086c1e2","bytes":40000},"fuentes_0014":{"sha256":"997e63737041d66f031dc623f2c8b452ef229c2dc3786ac1477185ed76676b15","bytes":40000},"fuentes_0015":{"sha256":"2c1cd059fe61b7a2210ce1d0ecff4bda2182cbce6ea1f396cdd8f63e1c4cc17a","bytes":40000},"fuentes_0016":{"sha256":"e8d9096f85ab5329e98f0ba05057a1d05808829eff170a992f51054dc7fa3cef","bytes":20807},"reglas_0001":{"sha256":"87cf22546686d764afed8873f3b9ea3f5e6927966752e9e7b865f233ec6009ea","bytes":40000},"reglas_0002":{"sha256":"6ff7af04cd487277fb9758c70ed009a85fa7d2fba448b4a904dbaa54d842e749","bytes":40000},"reglas_0003":{"sha256":"9b503764bcab98278826d092b22a22d6098b5cc49c11eb48e01717adc34929ed","bytes":40000},"reglas_0004":{"sha256":"e8beb93b6c919f36142d61f038fafd3fbb1482c87a1ee7c375b121452570c2cb","bytes":40000},"reglas_0005":{"sha256":"4968e197fe16e940c83b7d8698a4c609ede250c8f9610c35524a2c0f11e6e3fc","bytes":40000},"reglas_0006":{"sha256":"e011dfe910577ff5f621763f7478ecd70404e7ccfb73d93c0a115adf1d39ae9f","bytes":40000},"reglas_0007":{"sha256":"e78062e09ed0a035889f46def2cb4b3a8c8a8852af8e1db0fb75de44c58d1a57","bytes":40000},"reglas_0008":{"sha256":"4047d079f3a186d9a7ea98bf0edf5ae1151d3a5016b780a407a15ed4675b64de","bytes":40000},"reglas_0009":{"sha256":"d8570de0a5d379c15fd71cffacb18281a953ce9d9337afc193e070b1aeaaae6b","bytes":40000},"reglas_0010":{"sha256":"b0011567220e7e1fa99981a646b27370392db7482fe29f0ff37541a093ea9b2b","bytes":40000},"reglas_0011":{"sha256":"c655f48da211426f5390e399b3b72bdf49a09ccbb253df8a3438745d89fa9fa1","bytes":40000},"reglas_0012":{"sha256":"4567fce08469d46d3127d8782bbc46c4a0bae85bb006cfbe32d30dc49bec511e","bytes":40000},"reglas_0013":{"sha256":"7686136d72d1bddd772e664a5ecba54c882dce00a37b00b48c84c13e676b130d","bytes":40000},"reglas_0014":{"sha256":"4dbdfd750fe183a2ef2fdb3b748f8e18fcc62005df13d71547e5c63f3c0dae68","bytes":40000},"reglas_0015":{"sha256":"664ea5a765a42c864434faa3c9a1826305f42a65fa4740e649adf81636691d94","bytes":40000},"reglas_0016":{"sha256":"1602ef7a6290fb9556bf3c1b6a3022be4c4982ac542181d8fb1b8cfa293d4824","bytes":40000},"reglas_0017":{"sha256":"f34d71b8a81ef4c8ea72b52e4866309fc9fbe94f2f59bd9d8c21d0fbaab1cba2","bytes":34970}}}$meta911$::jsonb;v_datos jsonb;v_item record;
 v_fuentes_texto text;v_reglas_texto text;v_fuentes jsonb;v_reglas jsonb;v_existente record;v_campos integer;
begin
 select fuentes into v_datos from public.s911_catalogos where sha256='CARGA911:76a45a0894459bdf9aab6365294561d80d5fa4981dbb5ae1073d552ab6ddab9f' and edicion='CARGA_2026-2027' for update;
 if not found then
  if exists(select 1 from public.s911_catalogos c where c.edicion='2026-2027' and c.sha256='abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71'
    and jsonb_array_length(c.reglas)=1618
    and (select count(*) from public.s911_campos f where f.catalogo_sha256=c.sha256)=3209) then
   raise notice 'El catálogo ya está publicado';return;
  end if;
  raise exception 'Falta la carga. Ejecuta 000 y sus partes antes de publicar';
 end if;
 if v_datos->'metadatos' is distinct from v_meta then raise exception 'Paquete de otra versión';end if;
 if (select count(*) from jsonb_object_keys(v_datos->'fragmentos'))<>33 then
  raise exception 'Faltan partes: ejecuta los archivos numerados antes de publicar';
 end if;
 for v_item in select key,value from jsonb_each(v_meta->'partes') loop
  if encode(sha256(convert_to(v_datos#>>array['fragmentos',v_item.key],'UTF8')),'hex') is distinct from v_item.value->>'sha256' then
   raise exception 'Parte ausente o incorrecta: %',v_item.key;
  end if;
 end loop;
 select string_agg(value#>>'{}','' order by key) into v_fuentes_texto from jsonb_each(v_datos->'fragmentos') where key like 'fuentes_%';
 select string_agg(value#>>'{}','' order by key) into v_reglas_texto from jsonb_each(v_datos->'fragmentos') where key like 'reglas_%';
 if encode(sha256(convert_to(v_fuentes_texto,'UTF8')),'hex')<>'abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71'
 or encode(sha256(convert_to(v_reglas_texto,'UTF8')),'hex')<>'d5b93319ed5d17158d4f8a97719f2c991cb1d5affbdcac8801e1a1d8b30428b8' then
  raise exception 'La reconstrucción no coincide con el catálogo original';
 end if;
 v_fuentes=v_fuentes_texto::jsonb;v_reglas=v_reglas_texto::jsonb;
 select * into v_existente from public.s911_catalogos where sha256='abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71' for update;
 if found then
  if v_existente.edicion is distinct from '2026-2027' or v_existente.fuentes is distinct from v_fuentes or v_existente.reglas is distinct from v_reglas then
   raise exception 'Ya existe un catálogo diferente con esta huella. No se sustituirá';
  end if;
 else
  insert into public.s911_catalogos(edicion,sha256,fuentes,reglas) values('2026-2027','abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71',v_fuentes,v_reglas);
 end if;
 if exists(
  select 1 from public.s911_campos c
  left join (select q.key cuestionario,f->>'codigo' codigo,f definicion from jsonb_each(v_fuentes) q cross join lateral jsonb_array_elements(q.value->'campos') f) e
   on e.cuestionario=c.cuestionario and e.codigo=c.codigo
  where c.catalogo_sha256='abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71' and (e.codigo is null or e.definicion is distinct from c.definicion)
 ) then raise exception 'Los campos existentes difieren. No se sobrescribieron';end if;
 insert into public.s911_campos(catalogo_sha256,cuestionario,codigo,definicion)
 select 'abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71',q.key,f->>'codigo',f from jsonb_each(v_fuentes) q cross join lateral jsonb_array_elements(q.value->'campos') f
 on conflict(catalogo_sha256,cuestionario,codigo) do nothing;
 select count(*) into v_campos from public.s911_campos where catalogo_sha256='abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71';
 if v_campos<>3209 then raise exception 'Catálogo de campos incompleto: %',v_campos;end if;
 -- Limpieza exclusiva del contenedor intermedio de este lote, no de expedientes ni versiones.
 delete from public.s911_catalogos where sha256='CARGA911:76a45a0894459bdf9aab6365294561d80d5fa4981dbb5ae1073d552ab6ddab9f' and edicion='CARGA_2026-2027';
end $publicar911$;
select 'CATALOGO_COMPLETO' estado,c.edicion,c.sha256,
 (select count(*) from jsonb_object_keys(c.fuentes)) cuestionarios,
 jsonb_array_length(c.reglas) reglas,
 (select count(*) from public.s911_campos f where f.catalogo_sha256=c.sha256) campos
from public.s911_catalogos c where c.edicion='2026-2027' and c.sha256='abd724f4565e202924ddaf461378cc70c0051b25f4f0f5374891ab79e7448b71';

commit;
