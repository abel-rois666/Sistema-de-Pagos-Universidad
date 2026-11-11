# Borrado de recibos de prueba sin reiniciar folios

Preparación autorizada el 09/11/2026. No ejecutada en Supabase.

## Comportamiento

`borrar_recibo_prueba_v2(uuid)` elimina exclusivamente el recibo elegido, con las restricciones vigentes. No llama a `setval`, `nextval`, sincronización ni reinicio de secuencias. Se conserva el hueco tanto al borrar un recibo antiguo como el último; los recibos existentes no se renumeran.

Exige sesión Auth y un único perfil activo de Administración. Bloquea la fila del recibo durante la operación para impedir que dos solicitudes restituyan dos veces su monedero. Conserva la devolución del saldo a favor utilizado; no introduce movimientos adicionales. Si una FK impide el borrado, se revierte también esa devolución. No retira restricciones, elimina vínculos indirectos ni borra al alumno automáticamente.

La función anterior `borrar_recibo_admin(uuid)` delega a la nueva para proteger también clientes anteriores. El cliente actualizado utiliza únicamente la nueva RPC: si falta, informa qué migración instalar y no utiliza la variante antigua. La confirmación conserva el error y permanece abierta si falla la operación; no cierra ni anuncia éxito antes de la respuesta.

Se conserva el tratamiento manual del texto de estatus del plan al borrar: esta operación no reescribe conceptos de `planes_pago`. Se mantienen las FK instaladas, incluida la restricción de `planes_pago_excedentes_monedero` sobre detalles del recibo; si existe ese antecedente, el borrado se rechaza y la restitución del saldo utilizado también se revierte.

No existe una marca persistida que pruebe que un recibo sea ficticio. Administración sigue siendo responsable de elegir exclusivamente pruebas y confirmar cada eliminación. La instalación no depura registros ni corrige valores de secuencia ajustados en el pasado. La sincronización utilizada por importaciones es independiente y no se modifica en esta entrega.

## Instalación y comprobación

1. Ejecutar **solo lectura**: `supabase/checks/preflight_borrado_recibos_secuencia.sql`. Devuelve una única tabla con cinco filas (`1_firmas_exactas` a `5_disparadores`): funciones instaladas, permisos, secuencia, FK y triggers con sus funciones, sin llamar al borrado ni avanzar el contador. Compartir las cinco filas completas; un arreglo vacío identifica la ausencia de objetos, no un resultado omitido por el editor. No incluye nombres, importes ni claves de usuarios.
2. Revisar esas definiciones. La migración reconoce la implementación anterior versionada, la variante instalada comunicada el 09/11/2026 y su adaptador nuevo. Si hay una variante distinta o triggers de DELETE no revisados, aborta sin sustituir funciones; conservar el resultado para adaptar la corrección a las reglas instaladas. No quitar la guarda para forzar su instalación.

   El error «La función de borrado instalada difiere de la versión revisada» procede de la guarda previa, antes de crear o sustituir funciones. Su comparación ignora espacios, pero conserva comentarios y mayúsculas; también se rechaza una función ausente con la firma esperada. El mensaje por sí solo no demuestra una diferencia de reglas de negocio. Revisar `2_funciones` y `5_disparadores` antes de preparar una variante compatible; no ajustar la secuencia ni borrar recibos para diagnosticarlo.
3. Aplicar `supabase/migrations/20261109180000_borrado_recibos_sin_reiniciar_folios.sql` completa, en una sola ejecución, antes de desplegar el cliente actualizado. Instala funciones y permisos en una transacción; no emite ni elimina recibos y no toca la secuencia.
4. Ejecutar **solo lectura**: `supabase/checks/verificar_borrado_recibos_secuencia.sql`. Una única tabla muestra las dos funciones y el contador: `funcion_presente`, `sin_operaciones_de_secuencia`, `controles_esperados` y `security_definer` deben ser verdaderos; ejecución anónima falsa, autenticada verdadera y `search_path` fijado. Comparar el contador con el preflight: sin emisiones concurrentes debería conservarse; emisiones de Caja pueden aumentarlo legítimamente. No utilizar `nextval` como prueba de lectura.
5. Desplegar el cliente. La comprobación estructural no sustituye el ensayo de ejecución en una base de pruebas: recibo antiguo y último, monedero utilizado, doble solicitud, dependencia que rechaza el DELETE y perfiles sin autorización. No realizar esas pruebas borrando cobros reales.

Para depurar un alumno ficticio, abrir y revisar sus recibos, eliminarlos individualmente con «Borrar Físico (Prueba)» y después reintentar el borrado del alumno. Recibos cancelados también conservan su FK hasta eliminarlos físicamente. Si quedan otras dependencias, se mantienen los bloqueos existentes.

## Verificación local

Pruebas de cliente en `tests/borradoReciboPrueba.test.ts`: RPC nueva sin fallback, migración ausente, permisos, FK, desconexión y falta de ID. Las comprobaciones de texto SQL comparan la referencia histórica de la guarda y verifican ausencia de operaciones de secuencia en ambos cuerpos de función; no ejecutan SQL ni acreditan su instalación.

Ensayo de interfaz con datos ficticios y peticiones externas interceptadas: `scripts/ensayoEliminacionAlumnos.html`, acceso «Consultar recibo ficticio». `sin-migracion` simula servidor anterior y `recibo-vinculado` una FK bloqueante. La respuesta de borrado del ensayo es simulada: no prueba el motor PostgreSQL.

Resultado local: tipado y compilación correctos; 374 pruebas aprobadas (7 nuevas). Interfaz comprobada con migración ausente, error conservado y cierre por Escape; respuesta simulada de éxito retira el recibo de la consulta. Diálogo revisado en 390/820/1440 px y ambos temas. Permanecen los avisos previos de paquetes grandes. No se ejecutó SQL ni se verificó la secuencia, los permisos efectivos o el monedero en PostgreSQL real.

## Ajuste tras el preflight comunicado el 09/11/2026

El servidor tiene `borrar_recibo_admin(uuid)` con restitución de saldo utilizado, estatus del plan manual y reajuste por `pg_get_serial_sequence('recibos','folio')`; todavía no tiene la RPC nueva. Sus disparadores reportados son de INSERT/UPDATE, sin DELETE. La referencia anterior de la guarda utilizaba un nombre fijo de secuencia, otras notas y manejo defensivo de nulos; la comparación textual la rechazaba.

Se añadió **solo el cuerpo exacto recibido** como tercera referencia reconocida (dos variantes anteriores y el adaptador nuevo). Se cotejaron el texto recibido, la referencia de prueba y la migración ignorando espacios, sin ejecutar ninguna función. Versiones con otras reglas financieras y disparadores de DELETE desconocidos siguen bloqueadas. El destino continúa sin operaciones de secuencia, con permisos de Administración activa y bloqueo de fila; conserva `COALESCE` para restituir saldo incluso si el campo estaba vacío y la FK conserva los excedentes.

El preflight también confirma que `sync_secuencia_folios()` conserva un `setval` y es llamada por la importación CSV. No se modifica ni se invoca aquí: la protección preparada cubre las dos entradas de borrado, **no garantiza que ninguna otra operación pueda reajustar el contador**. Revisar esa sincronización por separado antes de atribuir una garantía global de no reutilización de folios.

Verificación del ajuste: tipado y compilación aprobados, con el aviso previo de paquetes grandes; 388 pruebas aprobadas (9 de borrado, incluidas las dos referencias y el rechazo de otra regla financiera). No se ejecutó SQL, no se ensayó el borrado real ni se publicó código. La comprobación de cuerpos es textual y no sustituye la validación transaccional en PostgreSQL.
