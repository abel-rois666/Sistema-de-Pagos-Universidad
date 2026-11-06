# Patrón de diseño de la interfaz

Acuerdo del usuario del 29/10/2026. Aplicar en pantallas nuevas y al modificar componentes existentes, conservando las reglas de cada módulo. Las correcciones de Inscripciones y Estadística 911 sirven de referencia; este documento no supone una auditoría completa del resto de las pantallas.

## Alineación y tipografía por jerarquía

- Componentes equivalentes en una misma fila comparten alineación, altura, espaciado y tratamiento visual. Revisar etiquetas, ayudas, bordes y contenido de los controles, no solo sus contenedores.
- Etiquetas de la misma jerarquía y función usan la misma familia, tamaño, peso y altura de línea. Títulos, subtítulos, etiquetas, valores y ayudas mantienen niveles diferenciados y coherentes con la escala de la aplicación.
- Usar las fuentes y colores del sistema en `src/index.css`. Evitar una identidad gráfica distinta para cada módulo.
- No forzar tamaños idénticos entre elementos de funciones distintas ni centrar todos los contenidos para conseguir simetría. La alineación debe facilitar la lectura y la tarea.

## Etiquetas y ayudas

- En campos con tooltip, colocar la etiqueta y el icono de ayuda en una fila superior al control, con una ubicación uniforme para elementos equivalentes. Permitir que las etiquetas largas ocupen varias líneas sin desbordar.
- Mantener una asociación accesible entre etiqueta y campo; abrir la ayuda no debe activar ni cambiar el campo.
- Un contexto fijo que no se puede editar, como el ciclo de destino de un modal, se presenta como información rotulada, no como un campo de captura. Debe quedar claro dónde se cambia; evitar caret, foco de edición o un cursor que sugiera escritura. Permitir copiar su texto cuando sea útil.
- Las ayudas se pueden consultar con ratón, teclado y toque, también en formularios de solo lectura. Conservar foco visible y cierre con Escape o interacción fuera del panel.
- Explicar los términos confusos y los requisitos de acciones deshabilitadas sin depender únicamente de un tooltip inaccesible sobre un botón deshabilitado.

Referencias: [CampoConAyuda y AyudaContextual](../src/components/ui/AyudaContextual.tsx), [SelectorCicloModulo](../src/components/ui/SelectorCicloModulo.tsx). La opción `ayuda` del selector permite usar el mismo encabezado de campo; sin ella conserva su presentación previa.

## Orden de opciones

- Ciclos escolares: de más reciente a más antiguo, comparando año y periodo numéricamente. Distinguir ciclos homónimos por periodicidad y mantener su ID exacto; el nombre no es identidad.
- Catálogos de nombres, alumnos, docentes, carreras u opciones similares: orden alfabético A–Z, adecuado al español y con comparación numérica natural para nombres con números.
- Mantener el orden lógico de datos que lo requieren: grados de menor a mayor, pasos de un proceso o estados con una secuencia definida. Estas excepciones deben ser reconocibles por su función.
- Conservar primero las opciones auxiliares como «Selecciona…» o «Todos…». Ordenar las opciones reales sin cambiar los valores almacenados, la selección actual ni los marcados.
- Ordenar antes de paginar y conservar las selecciones entre páginas según las reglas del módulo. Respetar el orden explícito que el usuario haya elegido donde exista esa función.

## Dimensiones según el contexto

- Dar a cada campo el espacio que necesita su contenido y su uso. Una fecha, un ciclo o un estado corto no debe expandirse automáticamente para rellenar el espacio sobrante.
- Usar anchos y límites adaptables; reservar más espacio para nombres largos, búsquedas, documentos y texto libre. Las medidas concretas dependen de la pantalla y no constituyen un tamaño universal obligatorio.
- Alinear las acciones relacionadas con los campos y evitar que el ancho de un componente desplace o rompa los demás.
- En móvil, apilar cuando sea necesario y aprovechar el ancho disponible. Evitar desplazamiento horizontal de la página; las tablas extensas pueden conservarlo dentro de su contenedor.
- Como referencia local, Inscripciones usa ciclo de hasta 20 rem, fecha de 16 rem y controles de 42 px. Mantener alturas iguales entre controles equivalentes de la fila, incluso cuando el navegador dibuje distinto un selector y una fecha.

## Temas y contraste

- Comprobar por separado temas claro y oscuro: texto principal, secundario, etiquetas, valores, placeholders, iconos, bordes, tooltips y controles nativos.
- Revisar estados normal, hover, foco, seleccionado, error, éxito y deshabilitado. Un texto secundario o un estado deshabilitado deben seguir siendo comprensibles; no resolverlos con opacidad excesiva.
- Evitar texto oscuro sobre fondo oscuro, texto claro sobre fondo claro e iconos que desaparezcan al cambiar de tema. No comunicar un estado únicamente por color.
- Priorizar variables y estilos compartidos sobre colores aislados. [El tema de los módulos escolares](../src/components/ui/temaModulosEscolares.css) conecta Inscripciones y 911 con las superficies neutras, el azul de marca y las fuentes de la aplicación.

## Avisos, confirmaciones y captura

- No usar `window.alert`, `window.confirm` ni `window.prompt`, tampoco sus llamadas abreviadas `alert()`, `confirm()` o `prompt()`, para los flujos de la aplicación. Usar componentes propios que respeten el tema, la accesibilidad y el contexto de la pantalla.
- Para errores, validaciones y avisos breves, usar el sistema de toast existente. Los requisitos persistentes o que requieren explicación deben permanecer visibles junto al formulario o la acción correspondiente.
- Para confirmar acciones que eliminan información o descartan cambios capturados, usar [ModalConfirmacion](../src/components/ui/ModalConfirmacion.tsx), con una explicación concreta de la consecuencia y opciones claras para confirmar o cancelar.
- Para solicitar datos, usar un formulario o modal de la aplicación con etiquetas y validaciones. Al cancelar, conservar lo capturado y el contexto que corresponda; ejecutar la acción únicamente después de confirmar.
- Reutilizar estos componentes y comprobar su lectura, foco y contraste en ambos temas.

## Comprobación al entregar una mejora visual

**Bases compartidas (05/11/2026):** `ModalConfirmacion` incorpora título/descripcion con IDs únicos, foco inicial y retorno, recorrido de Tab, Escape, fondo inerte y estado ocupado. Las confirmaciones asíncronas deben devolver su promesa o pasar `busy`; capturar un error sin devolverlo impide que el diálogo lo presente junto a la acción. `EstadoError` diferencia una consulta fallida de un listado vacío. `SeleccionVisible` muestra estado parcial y limita el alcance a los IDs recibidos. Son piezas reutilizables; no se considera migrado un diálogo o listado que todavía no las utiliza.

1. Comparar elementos equivalentes: tipografía, alineación de etiquetas e iconos y altura de controles. Medir sus posiciones cuando haya diferencias sutiles.
2. Verificar el orden de las opciones, los ciclos homónimos y la conservación de selección y filtros.
3. Revisar un ancho móvil, uno de tableta y uno de escritorio en ambos temas, incluyendo textos largos, ayudas abiertas y estados deshabilitados.
4. Conservar permisos, contratos, reglas de datos y operaciones existentes. Documentar el alcance realmente revisado, sin presentar una comprobación local como validación de producción.
