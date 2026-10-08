# Asesoría de IA para horarios

La IA propone hasta tres ajustes acotados. El motor de horarios prueba cada uno en un Worker y el usuario decide si adopta un resultado. Groq no genera sesiones publicables ni escribe en la base de datos. Esta función no requiere migración SQL.

## Preparación en Groq y Supabase

1. Crea una clave de API en GroqCloud. No la pegues en el código, en archivos `VITE_*`, en Git ni en un chat.
2. En Supabase Dashboard → **Edge Functions → Secrets**, crea `GROQ_API_KEY` con esa clave. Opcionalmente, `GROQ_HORARIOS_MODEL` puede ser `openai/gpt-oss-20b`; el valor predeterminado y recomendado inicialmente es `openai/gpt-oss-120b`. La función ignora otros valores para ese ajuste.
3. Despliega `supabase/functions/asesorar-horario/index.ts` como Edge Function llamada **`asesorar-horario`**. Con la CLI de Supabase enlazada al proyecto, el comando es `supabase functions deploy asesorar-horario`. Conserva la verificación de JWT habilitada.
4. Inicia sesión como `ADMINISTRADOR` o `COORDINADOR ACADEMICO`, genera un borrador o revisa un intento fallido y pulsa **Analizar con IA**. La función comprueba de nuevo el usuario y su rol mediante `get_my_rol()`; ver el botón no concede acceso.

No se ha creado ni configurado la clave desde el repositorio. Hasta desplegar la función y guardar el secreto, la asesoría mostrará un error y el generador seguirá disponible.

## Datos, límites y seguridad

- La petición solo incluye modo, política, cantidades, preferencias diarias, métricas, códigos de incidencia y referencias temporales como `c1`. Los UUID, nombres de docentes, alumnos, materias, textos libres de las incidencias y sesiones completas permanecen en el navegador.
- La función acepta cuerpos pequeños y acciones de una lista cerrada. Filtra nuevamente la respuesta de Groq; el cliente vuelve a filtrar y el motor valida los escenarios. Ninguna respuesta de IA se convierte directamente en una sesión o publicación.
- La función limita reintentos por usuario dentro de cada instancia; esto **no** sustituye un límite distribuido. El plan gratuito de Groq tiene límites compartidos por organización y puede devolver 429. Si crece el uso, añade un límite centralizado antes de abrir esta función a más roles.
- Los escenarios son pruebas locales. Adoptar uno modifica la configuración del borrador y, si existe una propuesta completa, sus sesiones; las restricciones duras y la validación de publicación siguen vigentes. Las vacantes impiden publicar.
- Consulta los controles de retención de datos de Groq antes de usar el servicio en producción institucional. El resumen enviado minimiza datos, pero sigue siendo una petición a un proveedor externo.

## Verificación recomendada tras desplegar

1. Con un usuario sin rol autorizado, confirma que la función responde 403 y no consulta Groq.
2. Con rol autorizado, confirma que las sugerencias aparecen junto a resultados del motor y que un escenario sin solución no ofrece «Usar este resultado».
3. Inspecciona la petición de red: debe contener referencias `c1`, códigos y números, sin nombres, UUID ni claves. El navegador solo llama a Supabase; la llamada a Groq sale de la Edge Function.
4. Cancela durante la consulta y durante un ensayo. El borrador previo debe conservarse.
5. Adopta una propuesta con vacante y confirma que «Publicar horario» sigue bloqueado. Prueba también una propuesta Estricta y verifica la validación final antes de publicar.
