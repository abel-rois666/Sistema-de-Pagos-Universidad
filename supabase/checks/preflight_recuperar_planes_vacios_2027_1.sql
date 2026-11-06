-- SOLO LECTURA. Ejecutar antes de considerar la recuperación de planes 2027-1.
-- Lista cerrada: 125 destinos vacíos y 125 fuentes 2026-3 identificados en el diagnóstico del 18-10-2026.
-- Se muestran conceptos e importes de la fuente para revisión financiera. Ningún dato se modifica.
-- Para proceder: 125 filas, 125 aptas, 0 bloqueadas y 669 detalles esperados.
with candidatos(plan_destino_id, plan_fuente_id, detalles_esperados) as (
  values
  ('b5cba58e-694b-4678-8b41-c122f693d8f4'::uuid, '65f8c5e8-f2ad-4556-939a-487bf00dc409'::uuid, 6),
  ('3e5abaff-0488-4262-91f3-884d9ecdfcb0'::uuid, '9e161d6e-9e37-4fd0-b00f-99cfd8da8445'::uuid, 5),
  ('f0aa0002-5aac-4215-9e44-4026c23f7c79'::uuid, '4214a347-8899-461c-8fe4-509c1b6b1e8f'::uuid, 5),
  ('24a6ac28-76a0-4632-9491-f2beb2f3f07f'::uuid, 'd146fa28-6f57-4a2b-9005-18e1f72534a3'::uuid, 6),
  ('104acf4c-5681-4766-bdb0-0c5789dee733'::uuid, '063300b5-0df8-4c5e-889b-ad429cb9bde3'::uuid, 6),
  ('0682d4d0-0c7f-42e3-97dd-b1035bedf189'::uuid, 'aa61d1a5-dc8f-47f1-b8d7-59678788c4f4'::uuid, 5),
  ('bd9a360e-d0e8-4276-adac-fd5dc46c7682'::uuid, '43d498f7-7c38-481f-8fdb-772b517cae92'::uuid, 5),
  ('e60a874c-7979-40dd-9657-6d3d47b550e4'::uuid, 'fb20218f-eaf2-45de-b4c7-9f8854adc82f'::uuid, 5),
  ('b04f94e5-813e-40f0-91c1-4dc3baeec1c6'::uuid, 'ea99c24a-686e-4c2b-98e3-10b4fc76012b'::uuid, 6),
  ('7ae63e03-f65d-4391-89f0-970c6cd9f4bb'::uuid, 'da9b2ee7-31e2-4dae-be1d-164ca65eab1c'::uuid, 5),
  ('a046ea8c-ce85-4441-8aec-3bdac1ff6b48'::uuid, '588d7adf-47b4-43e2-8892-ca2baf9f287d'::uuid, 4),
  ('cdeed2a4-16c9-4781-9639-8bf7192b10c9'::uuid, 'b69ac78b-9442-4cfb-9b82-68efe11b07b1'::uuid, 6),
  ('4a425ca2-cb1d-4094-91ef-2d92c78d54e5'::uuid, 'f3f1eec2-f0a2-46e4-a7fd-0bed37cf0a7e'::uuid, 5),
  ('fc980b82-1ee0-4fd7-886c-f780ed80ad61'::uuid, 'c4819ca3-7df9-4678-81dd-2aa8232e9617'::uuid, 5),
  ('a2d72eec-8b65-4f60-93e1-399b1286a675'::uuid, 'd634e4a3-3536-463e-8031-dfc664742219'::uuid, 6),
  ('58654e57-1156-400b-97c2-a39810d6cc6f'::uuid, '9069c9c8-0a10-44c2-8515-3fef68008725'::uuid, 5),
  ('709b87f5-e424-435a-aa88-e93cbceda9f5'::uuid, '6ce3fa55-209b-4cc8-98b4-0950231a8ca1'::uuid, 5),
  ('afab668e-297c-4939-9768-749609cbe05f'::uuid, 'e9c4cf9f-cc30-4d39-b3b8-d91dfbaa9fb9'::uuid, 5),
  ('b7d17ff5-0cab-4dfc-bf72-e577393aa0f1'::uuid, '000a0336-442e-4bb9-86b1-820a483aea5d'::uuid, 5),
  ('0db0b0af-4375-4e11-98a5-f127cb26b208'::uuid, '5860e29e-1caf-422a-ad5f-e217f2ca2703'::uuid, 5),
  ('6efe7891-419b-4a3b-914f-a13cc5fe4e53'::uuid, '32c7a3a6-2c3a-4dc0-81f9-88bc59879896'::uuid, 5),
  ('2c324d1b-8fda-4208-b64d-4625f173a137'::uuid, '3963aff4-cb5d-4130-b851-684a06715c60'::uuid, 5),
  ('4a5f305e-74e0-4b86-be81-196bdfd8f4fe'::uuid, 'b719dec9-9ce3-4e47-b2be-c204e6b48e9c'::uuid, 6),
  ('9e90d782-93a3-48c0-9463-0170b3c1b4e7'::uuid, '128c39dd-476f-4473-b3c6-616764450913'::uuid, 5),
  ('0bddbad6-a271-496d-8f9e-9405472065eb'::uuid, 'e13e9849-1be2-42dc-83e6-8e8c2bc2be91'::uuid, 5),
  ('07d4bd1f-01ee-43ae-8039-5fea9078b6e1'::uuid, 'd73a46ce-3f43-4a92-99c3-2cb86f92b103'::uuid, 6),
  ('e52d148b-f055-435c-aeb4-c6d288ab807b'::uuid, 'dc422390-541b-4337-a282-8a6f0a118fa3'::uuid, 5),
  ('71e6e9ae-29d2-4ba8-856e-a88212bf7f07'::uuid, 'f53d589e-a025-4411-8ed5-dda78f9c569c'::uuid, 6),
  ('1d7758cb-9abd-45c7-85a2-1b930dabf576'::uuid, 'c5f9127e-a7ae-4841-bdc9-95fd0e090dbf'::uuid, 6),
  ('ac91f17a-6548-4139-b532-d9b1a0e68923'::uuid, '69ccbadc-f9f0-4ae3-b047-68eb73d4bd04'::uuid, 4),
  ('03e89973-0ac1-4eb7-b562-53559a4c29df'::uuid, '6a7ca3b3-0032-4701-8258-38ba8b640907'::uuid, 5),
  ('b8a6d694-e161-478f-b545-0be399ac7906'::uuid, 'c82a6a4c-7fe6-4fac-aa40-a3c1902bd082'::uuid, 5),
  ('de21edb6-ce4d-4def-a9cd-455f381fc8d5'::uuid, '2642634f-48a3-4771-84d1-8ca5b135ce7a'::uuid, 6),
  ('e0708cc4-f127-4be6-87ff-700b2085a3fd'::uuid, 'a8aa6522-6c34-4bc6-ab09-a62ac525b929'::uuid, 6),
  ('a12f90a7-1f22-4853-8c0c-fb3fa05cf5f9'::uuid, '62daa6d7-3abb-43ea-83f6-1c115fdaf057'::uuid, 5),
  ('b7d683ef-1738-4698-ae92-ede68e787e51'::uuid, '23f47a77-48dd-4186-944c-bdc127b38755'::uuid, 5),
  ('4d1a1d57-2e64-46f6-947d-f259c848128e'::uuid, '76ecddf5-557a-476c-82da-4abe08add99a'::uuid, 6),
  ('5e19a594-ad47-4dcb-9fad-8adc6f0dc087'::uuid, '423eb580-70b3-4295-a1b2-9bec15bc0746'::uuid, 5),
  ('07082963-b0ed-4412-bfcf-70ea8abbf220'::uuid, 'bb42ead1-200d-4141-aad9-168abd8e7ce4'::uuid, 6),
  ('9767b027-09e6-474d-8ed2-06abc5d9088d'::uuid, '35549f70-65ea-40b9-adfc-e6d258046ec6'::uuid, 5),
  ('9dba696e-c11b-4319-aad7-29ab2a0b3ba1'::uuid, 'b2a6177c-86c9-4295-ba32-f860f85a4f5a'::uuid, 6),
  ('8612bfa0-bd67-4dad-a2e2-0ed89e5c10b1'::uuid, 'ba999d32-0711-4aa9-b2ec-1f616e523606'::uuid, 5),
  ('b21adba5-b956-4911-978e-4d91496ba309'::uuid, 'b41c6892-993c-4381-99fb-050efbe7ddc7'::uuid, 6),
  ('492c4b3e-a2e1-4ab0-9e2d-a8b05bb7ea88'::uuid, '39c47a6f-850a-4e6c-94e2-e508338601c3'::uuid, 6),
  ('bbc3d28b-5e9d-4049-bd3b-f2833cd321b3'::uuid, '4607c4fd-758e-4c8e-a697-1943286b32bf'::uuid, 5),
  ('21a5832e-fa61-4253-b276-6e0aa803226a'::uuid, '9077dd43-2bde-4009-b409-a2ab9e542785'::uuid, 5),
  ('a73698cf-c580-40f9-bacd-90d024794061'::uuid, 'a64e8a08-3907-43f7-aa25-050ed4225950'::uuid, 6),
  ('7c95f303-fd01-4f23-82ff-0182e9575993'::uuid, 'decd9cf3-188d-47ee-a615-63244167fde3'::uuid, 6),
  ('9a143245-57c6-4982-b94a-a6480c301568'::uuid, '78d6c238-3d25-44bb-b211-d662326355ed'::uuid, 5),
  ('e59f7171-3ad7-4d84-834f-d5b8b4f7400d'::uuid, 'a08b8ec7-7278-4c43-81fc-b9fc56bea419'::uuid, 4),
  ('d91c97a7-e5c5-4d2e-b119-d878ea71a77f'::uuid, '783d54a6-2b56-49f1-9d4e-7acbebe4c431'::uuid, 5),
  ('47b12dad-40d6-4e93-b5b2-c7f7a5c8543c'::uuid, '3dabcee8-8651-4319-af6c-4e78ab519150'::uuid, 5),
  ('66cbb0f6-659d-4feb-b481-31906fa6bb56'::uuid, '81a34fff-4730-46db-baaa-5d3f76950d8f'::uuid, 6),
  ('1555c484-de2d-450f-8b1f-151b9f16b984'::uuid, '994a0250-1b1b-42c6-93ba-25505ec3e0e3'::uuid, 5),
  ('865d7528-f355-4279-8811-4cbf388f62bf'::uuid, '0e2fc4f7-ba71-4c76-b2e2-68705495454f'::uuid, 5),
  ('7d251793-1ad9-4bae-82ce-b9c9f570e6dd'::uuid, '5452ecdf-b6ab-4c33-bf8d-55a758ec68fe'::uuid, 5),
  ('cc3d84ab-84bc-4c6f-92fe-cd827dbd6a56'::uuid, 'e418d395-b9fa-49ee-91bc-aedb7a4d4aba'::uuid, 5),
  ('d906bca9-00b5-4ac5-8191-031ee87da2dc'::uuid, '6f2c9f8b-3f0f-4728-85c9-3e09c18cb996'::uuid, 6),
  ('89e5d3b6-7dea-44be-ab73-8f1ca2039fdf'::uuid, '9865155e-12c4-4e85-be7b-1279469b56d4'::uuid, 5),
  ('dd95e3af-67d4-484b-9d30-59178cf50dfa'::uuid, 'c1fc448c-c28b-4c4d-9d38-b34424b50428'::uuid, 5),
  ('13f71f93-1f5e-4a0b-ac9d-3337e086f3ab'::uuid, '99edaefd-09b3-4a33-80d2-ac0694425e23'::uuid, 6),
  ('36f72539-c8f7-4cdc-b90d-43188f335c5d'::uuid, '03565198-a67d-43d9-9829-4570e68a1127'::uuid, 6),
  ('2627fb15-a1a6-4ae3-bbcc-42cda96e6078'::uuid, 'af526517-8147-4fee-8be7-7b183cf321c8'::uuid, 6),
  ('13bf1a32-d196-453a-ba13-ed96b9b3ad35'::uuid, 'fd9e55b2-0590-42a6-9ae8-3a47c79d54b2'::uuid, 5),
  ('6758d9fe-182f-430d-94a5-4cb148cb0a9e'::uuid, 'dada2612-07fb-4be5-ae29-2fe5876d8910'::uuid, 5),
  ('bf61cae6-b6f6-48c3-bbf8-6dfbb95bd33c'::uuid, 'e3dd1b64-382c-4adc-9ed1-656c8b7c4f64'::uuid, 5),
  ('2d4bbc8a-eae0-4bc7-b459-2a0eeb8e09ce'::uuid, '9c559558-06c6-417e-a570-a3efb344ba06'::uuid, 6),
  ('e3452396-3e1f-4404-a8ff-fe4cf12117df'::uuid, '9914d100-78f8-4f65-b915-7800f912118c'::uuid, 6),
  ('ba8a75cc-865b-4b72-8346-89d8c562e513'::uuid, '9370f017-10d7-4422-aef9-47f7e8696cdf'::uuid, 5),
  ('61b7e504-655c-4d10-8edf-64be3c943188'::uuid, 'f358707b-628e-420c-8ec0-659e95d26fae'::uuid, 5),
  ('ecfc55b7-7dc9-45a3-9218-2a5a93789378'::uuid, 'ed38cf96-6517-40c7-9907-53cafc693ce0'::uuid, 5),
  ('0b685e8e-8703-4be5-8c0f-b6ad7138440c'::uuid, 'b7fbf728-de9d-428c-b742-cb95e00d90bc'::uuid, 5),
  ('e476c7e8-3b99-4e19-9954-0288645e2d16'::uuid, 'f8be90fd-a282-4385-8f4d-2d189afb5f54'::uuid, 5),
  ('baa3da97-5522-49eb-b8a1-f34057c07161'::uuid, '720822af-a383-436a-8715-194b4a923ab0'::uuid, 5),
  ('1875fa8c-f674-4c60-83b0-d16991c698b1'::uuid, 'd9d89c5d-9b0f-4366-9d36-88922d19b521'::uuid, 5),
  ('cf50b557-e9a6-4942-b1d2-ce3f47bec6c7'::uuid, 'eb6027f2-c3fb-453b-a4fd-a3a6233cbd01'::uuid, 6),
  ('a7d496f7-7ec5-4332-8e9d-94683186fa06'::uuid, 'e7dcd9d0-57f6-41de-a351-f87511759a86'::uuid, 6),
  ('f4d70db6-d450-4762-a10f-2f9a17c88430'::uuid, '6047c86b-5297-40ae-9c86-3dacb38f7463'::uuid, 6),
  ('49a0ad89-640a-4ae6-a648-d310d7fe5f0b'::uuid, 'ff24bce4-cc37-4bdd-add5-b81de141b782'::uuid, 5),
  ('9725a8b0-4cb2-46c3-9cc7-d0506808f73a'::uuid, '643c4bbd-192b-4120-a244-46aeb6144c8e'::uuid, 5),
  ('ff1fe56d-34dc-4f94-b025-e9746026adea'::uuid, '7ed86bd2-863e-40c0-8c5a-0e43d3a55ef4'::uuid, 5),
  ('b28c1961-f28b-4a1f-9120-33e9c165d9fc'::uuid, '4a8a2079-b7dc-435e-85b8-5c96d27461be'::uuid, 5),
  ('a0fc27fe-ce93-49eb-95b8-0dbe4b2d6bcf'::uuid, '7443f849-4db8-465e-9a73-5b7a7dcd038f'::uuid, 5),
  ('99b6f793-2388-4a84-9a95-1acab033ca1c'::uuid, 'e0615b5a-a79b-43dc-bc58-294cf1235204'::uuid, 6),
  ('3deda3ea-5614-4f3d-900e-935ab602146d'::uuid, 'a7a689ac-d52b-49a3-b81c-ead359726733'::uuid, 5),
  ('090f8f46-2a02-4521-b8db-0c633d8dee73'::uuid, '6448fe81-6dac-417e-af88-370a25a28821'::uuid, 5),
  ('510c65bb-2096-4e95-a60a-31e05c6cbbf9'::uuid, 'a42a2db3-c474-4402-93c2-2c4ed16620b8'::uuid, 5),
  ('c7f316d9-1c14-432c-85dd-fbe815bb13ea'::uuid, '81b7efb5-aa70-49df-a2d3-824268097556'::uuid, 5),
  ('964474ea-0056-45fd-b389-57709c6a8944'::uuid, '92faae43-f7b3-4ada-becd-97acd0247094'::uuid, 6),
  ('30d2043d-745f-4ec6-b772-777b2a2163c1'::uuid, '6acb341c-0706-4501-b9c4-a17bb9c18acb'::uuid, 5),
  ('899e71f2-8186-475c-9b34-49b310a058b4'::uuid, 'a95598ee-5106-415c-8232-197a6207b26a'::uuid, 6),
  ('08e0ae2c-bef4-462c-acf8-0e657e94335c'::uuid, 'b766ae88-7359-464b-a55e-c96044e6daed'::uuid, 5),
  ('6b2e2aac-2514-4728-96ec-44e47dddb79e'::uuid, '61938107-b3db-409b-8f73-46b21676e795'::uuid, 5),
  ('29daf6ba-30c3-402d-b859-fc252ae7bc65'::uuid, '228a0e68-3a07-4c0e-b1a3-c553b689dd9f'::uuid, 5),
  ('5334422f-8c56-43a6-844f-2faa3c0dc005'::uuid, '77b38b0a-2a64-4c11-8653-67beab584fcd'::uuid, 6),
  ('2e86fce3-db0a-4657-9c1e-bb5b1c4ec61c'::uuid, '9b48a2b9-3a3b-4675-9b68-c19ac3ddc7ef'::uuid, 6),
  ('f7b670ca-1177-40a7-9b04-b1b9c5583151'::uuid, '562b40e5-998b-4f7a-b76d-df2c79516de4'::uuid, 6),
  ('1402c6eb-2e03-4c17-8eac-9f4af93cbced'::uuid, '291708d9-0504-407c-b0ad-5cf2858a0818'::uuid, 5),
  ('098b4bf2-472c-4627-9acc-98ab8d86203a'::uuid, 'e5295241-4470-4a69-b743-4baf5b9627c6'::uuid, 5),
  ('f2f93e32-7abe-4fa2-a228-2fade90aec86'::uuid, '4b5c2209-fe11-4a3d-bcd1-094c84d9afe6'::uuid, 6),
  ('31f4250f-7314-4794-92f6-5df3deb29265'::uuid, '4e810433-3cd7-4ece-88cf-731afe970241'::uuid, 5),
  ('b2e2bdf0-9976-4c6f-9a7f-f875f5fb6508'::uuid, '990f19b7-02e7-4c37-b98a-7ff23aac4b95'::uuid, 5),
  ('ba72a9fb-5a01-4e15-b07a-242252b39dfc'::uuid, '071fa2b9-c5c6-4020-89dd-0c8f548a89e1'::uuid, 6),
  ('ee35a3bd-b555-4938-a226-fc95ace63988'::uuid, 'dc42af00-71bd-41a6-9152-2c119eee7e2c'::uuid, 6),
  ('f5d8c3ea-02f9-4a80-ad71-67b2016dfb5d'::uuid, 'a2291d7c-5f6c-4bc7-baaa-2e135f52fcbf'::uuid, 6),
  ('8c728d87-3157-46d0-8e9f-55d4d47ac6eb'::uuid, '73b4618f-cc1b-4022-8b9a-a19ffa295ee6'::uuid, 6),
  ('0f72799f-09b2-477c-9cd3-72c327e5041a'::uuid, '0b2ca740-8d60-40ce-9a31-a2fb2c9633c5'::uuid, 6),
  ('d3960b74-672c-45c1-a107-5153336d2e98'::uuid, '0544afbf-a35d-427b-81c4-44353cb1f3bb'::uuid, 6),
  ('b2e878c6-bdf4-4293-b8f5-5c04cd30a900'::uuid, 'd1a74c0a-9b77-4ec5-9347-66901ccd0607'::uuid, 5),
  ('d1fbc24a-d102-4d69-bf00-7a9d3aa3a81c'::uuid, 'ec5c0e86-f6ba-4d20-9595-4e34fb7e4787'::uuid, 5),
  ('880fede3-756b-4b5e-84cd-f08c7299dea7'::uuid, '89045689-085c-4442-ad8a-27668b896b36'::uuid, 5),
  ('19e8cc3c-9868-4d25-ab40-550144c1c754'::uuid, '185f25c5-dd3e-46d0-84e3-18c22bf9244f'::uuid, 5),
  ('4ece7082-781b-424d-904a-ce7ddd0deb4c'::uuid, '5789a233-226c-4fb4-84d4-efe35eee888a'::uuid, 5),
  ('201185d9-a43f-48a8-a464-25267b7318b8'::uuid, '73d79a11-9431-46a3-b4df-33c2109cf0eb'::uuid, 6),
  ('ba493609-00a8-49f0-bc4c-5ff0205c99ab'::uuid, 'f5eb957b-cb77-4c09-b964-86f31eadf473'::uuid, 5),
  ('68f45d88-0e59-4d8d-a89d-2397f64e3798'::uuid, 'fad92533-e8e9-4bf2-a380-947853512b6f'::uuid, 5),
  ('48b5eb70-c2c5-4616-995f-f36c0cb9aee1'::uuid, 'e960ac65-3d3b-409a-91b9-1930db854620'::uuid, 6),
  ('3c9f5142-61f0-4266-8287-e4159f660293'::uuid, '0abe9ffe-f9c6-4a28-9e0f-fcb6460cb706'::uuid, 5),
  ('f25c8fd1-9664-4f66-af6e-107b0dd17425'::uuid, '3a85b6e5-b95f-4171-bf19-22d8068bfa97'::uuid, 4),
  ('dde8450d-d4f8-4650-977f-042b255312f4'::uuid, '59a447a1-6a5e-4ea5-a83e-6861431e2cdf'::uuid, 6),
  ('41259086-1470-4134-a678-b2ea22d13e8a'::uuid, 'bbfa5f73-de46-4d3e-8ebc-863224d03ebd'::uuid, 4),
  ('6ae12e67-8c8c-45c9-9860-c9c9e935b510'::uuid, 'd1738c3d-f92d-42b6-a4ca-aa7c5a293dce'::uuid, 6),
  ('b6aae9a7-4def-4c27-b201-2291a03d902a'::uuid, '24bb53f8-b426-4a90-920d-73817ca70f4c'::uuid, 6),
  ('9329c13b-b32f-43fe-bab4-cd8b87cdd7ed'::uuid, '1aa31bd3-a266-4c3e-b76e-d3c243085713'::uuid, 6),
  ('54057ccf-b9bb-4f42-8247-76412d786fba'::uuid, 'f904f6f5-79b6-42ac-a38b-2fcca5242fee'::uuid, 6)
), diagnostico as (
  select c.*,
    destino.id is not null as destino_existe,
    fuente.id is not null as fuente_existe,
    destino.alumno_id is not distinct from fuente.alumno_id as mismo_alumno,
    (destino.ciclo_id = '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid
      and cd.nombre = '2027-1' and lower(btrim(cd.tipo_periodo)) = 'cuatrimestral'
      and lower(btrim(destino.tipo_plan)) = 'cuatrimestral') as destino_correcto,
    (cf.nombre = '2026-3' and lower(btrim(cf.tipo_periodo)) = 'cuatrimestral'
      and lower(btrim(fuente.tipo_plan)) = 'cuatrimestral') as fuente_correcta,
    (select count(*) from public.planes_pago p
      where p.alumno_id = destino.alumno_id and p.ciclo_id = destino.ciclo_id) as planes_destino,
    (select count(*) from public.recibos r
      where r.alumno_id = destino.alumno_id and r.ciclo_id = destino.ciclo_id) as recibos_destino,
    (select count(*) from public.planes_pago_detalles d
      where d.plan_id = destino.id) as detalles_destino,
    not exists (
      select 1 from generate_series(1, 18) i
      where nullif(btrim(coalesce(to_jsonb(destino)->>('concepto_' || i), '')), '') is not null
        or nullif(btrim(coalesce(to_jsonb(destino)->>('fecha_' || i), '')), '') is not null
        or coalesce((to_jsonb(destino)->>('cantidad_' || i))::numeric, 0) <> 0
        or upper(btrim(coalesce(to_jsonb(destino)->>('estatus_' || i), 'PENDIENTE'))) <> 'PENDIENTE'
    ) and coalesce(destino.desglose_conceptos, '[]'::jsonb) = '[]'::jsonb
      and coalesce(destino.desglose_total_bruto, 0) = 0
      and coalesce(destino.desglose_descuento_porcentaje, 0) = 0
      and coalesce(destino.desglose_descuento_monto, 0) = 0
      and coalesce(destino.desglose_total_neto, 0) = 0 as destino_legado_vacio,
    (select count(*) from public.planes_pago_detalles d
      where d.plan_id = fuente.id) as detalles_fuente,
    (select count(*) from public.planes_pago_detalles d
      where d.plan_id = fuente.id and nullif(btrim(d.concepto), '') is not null
        and d.cantidad is not null and d.cantidad >= 0) as detalles_fuente_validos,
    (select count(distinct d.indice_concepto) from public.planes_pago_detalles d
      where d.plan_id = fuente.id) as indices_fuente_unicos,
    (select coalesce(sum(d.cantidad), 0) from public.planes_pago_detalles d
      where d.plan_id = fuente.id) as importe_fuente,
    (select coalesce(jsonb_agg(jsonb_build_object(
      'indice', d.indice_concepto, 'concepto', d.concepto,
      'cantidad', d.cantidad) order by d.indice_concepto), '[]'::jsonb)
      from public.planes_pago_detalles d where d.plan_id = fuente.id) as filas_fuente
  from candidatos c
  left join public.planes_pago destino on destino.id = c.plan_destino_id
  left join public.planes_pago fuente on fuente.id = c.plan_fuente_id
  left join public.ciclos_escolares cd on cd.id = destino.ciclo_id
  left join public.ciclos_escolares cf on cf.id = fuente.ciclo_id
), evaluacion as (
  select d.*,
    (destino_existe and fuente_existe and mismo_alumno
      and coalesce(destino_correcto, false) and coalesce(fuente_correcta, false)
      and planes_destino = 1 and recibos_destino = 0 and detalles_destino = 0
      and destino_legado_vacio and detalles_fuente = detalles_esperados
      and detalles_fuente_validos = detalles_esperados
      and indices_fuente_unicos = detalles_esperados) as apto,
    array_remove(array[
      case when not destino_existe then 'Falta plan destino' end,
      case when not fuente_existe then 'Falta plan fuente' end,
      case when not mismo_alumno then 'Alumnos distintos' end,
      case when not coalesce(destino_correcto, false) then 'Destino no es 2027-1 Cuatrimestral' end,
      case when not coalesce(fuente_correcta, false) then 'Fuente no es 2026-3 Cuatrimestral' end,
      case when planes_destino <> 1 then 'Hay varios planes del alumno en destino' end,
      case when recibos_destino <> 0 then 'Existen recibos en destino' end,
      case when detalles_destino <> 0 then 'Destino ya tiene detalles' end,
      case when not destino_legado_vacio then 'Destino tiene campos o importes guardados' end,
      case when detalles_fuente <> detalles_esperados then 'Cambió el número de detalles de fuente' end,
      case when detalles_fuente_validos <> detalles_esperados then 'Fuente con concepto o importe inválido' end,
      case when indices_fuente_unicos <> detalles_esperados then 'Fuente con índices duplicados' end
    ]::text[], null) as motivos
  from diagnostico d
)
select plan_destino_id, plan_fuente_id, detalles_esperados, detalles_fuente,
  importe_fuente, filas_fuente, apto, motivos,
  count(*) over () as planes_listados,
  count(*) filter (where apto) over () as planes_aptos,
  count(*) filter (where not apto) over () as planes_bloqueados,
  sum(detalles_esperados) over () as detalles_esperados_total
from evaluacion
order by apto, plan_destino_id;
