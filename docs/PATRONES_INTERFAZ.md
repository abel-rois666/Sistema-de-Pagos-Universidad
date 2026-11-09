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
- Ayudas discretas (07/11/2026): un solo icono de 14 px sin círculo exterior ni fondo permanente, con área de interacción de 24 px. El panel usa texto de 12 px, ancho máximo de 288 px, borde y sombra suaves; evita repetir la etiqueta o añadir un pie de instrucciones en cada ayuda. Conserva íntegra la explicación, el contraste y el foco visible en ambos temas.
- Explicar los términos confusos y los requisitos de acciones deshabilitadas sin depender únicamente de un tooltip inaccesible sobre un botón deshabilitado.

Referencias: [CampoConAyuda y AyudaContextual](../src/components/ui/AyudaContextual.tsx), [SelectorCicloModulo](../src/components/ui/SelectorCicloModulo.tsx). La opción `ayuda` del selector permite usar el mismo encabezado de campo; sin ella conserva su presentación previa.

## Orden de opciones

- Ciclos escolares: de más reciente a más antiguo, comparando año y periodo numéricamente. Distinguir ciclos homónimos por periodicidad y mantener su ID exacto; el nombre no es identidad.
- Catálogos de nombres, alumnos, docentes, carreras u opciones similares: orden alfabético A–Z, adecuado al español y con comparación numérica natural para nombres con números.
- Mantener el orden lógico de datos que lo requieren: grados de menor a mayor, pasos de un proceso o estados con una secuencia definida. Estas excepciones deben ser reconocibles por su función.
- Conservar primero las opciones auxiliares como «Selecciona…» o «Todos…». Ordenar las opciones reales sin cambiar los valores almacenados, la selección actual ni los marcados.
- Ordenar antes de paginar y conservar las selecciones entre páginas según las reglas del módulo. Respetar el orden explícito que el usuario haya elegido donde exista esa función.

## Dimensiones según el contexto

- Navegación móvil: hasta cuatro accesos principales más «Más», con icono y etiqueta, en lugar de comprimir siete botones. En Administración: Inicio, C. Escolar, Financiero, Académico y Más; RRHH, Configuración y Salir quedan accesibles dentro de Más. Secciones con hijos abren un panel con todos sus destinos permitidos. Respetar área segura inferior y reservar espacio para que la barra no cubra el contenido; tabletas y escritorio conservan la barra lateral.
- Estados vacíos de Planes: una franja de consulta independiente del mensaje. En escritorio, mensaje y acciones en columnas; en tableta, acciones debajo en dos columnas; en móvil, contenido centrado y acciones apiladas. No convertir el estado vacío en un formulario de búsqueda si el periodo no tiene registros.
- Consulta con planes: regreso visible sobre la barra; periodo, búsqueda y acciones alineados. Un único recorrido anterior/siguiente con contador en la cabecera explica su alcance. Las opciones de planes del alumno se identifican por tipo, ciclo y folio, fuera del documento imprimible; en móvil o con muchas opciones, preferir un selector a pestañas que requieran desplazamiento horizontal. El documento conserva su desplazamiento interno independiente.
- Padrón de alumnos: Nuevo alumno es la acción principal; sincronizaciones y promoción masiva quedan en Herramientas. El ciclo se elige dentro de la operación que lo necesita, sin aparentar un filtro del padrón. En tableta horizontal se compactan columnas relacionadas; en móvil/tableta vertical se usan tarjetas con las mismas acciones, filtros, selección y orden. Ver ficha permanece visible y el resto de acciones tiene un menú identificado por alumno, accesible por teclado y toque. Una marca financiera no debe llamarse inscripción académica.
- Reportes financieros: ubicación principal en Consultas y Reportes, con accesos contextuales que preservan filtros y regreso. La selección de ciclo debe mostrar periodicidad e ID conservado. Los conteos y exportaciones se obtienen del mismo conjunto filtrado; cero resultados no significa restablecer todos. Las identidades sin asociación verificada se muestran como pendientes, sin atribuciones por nombre.


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


### Selectores extensos y fichas de consulta (08/11/2026)

Para listas extensas de ciclos, reutilizar `SelectorBusqueda`: control cerrado de 42 px, lista de altura limitada y búsqueda dentro del panel. Anchura orientativa de 260–300 px para ciclos exactos y 190–230 px para periodos nominales, adaptable al contexto. Nunca convertir la búsqueda en un valor guardado ni agrupar IDs operativos por nombre. Conserva etiqueta superior, ayuda discreta, foco visible, recorrido por flechas, Enter, Escape, salida con Tab y toque. Los controles relacionados de una barra comparten altura (44 px en Planes).

Las fichas conservan el mismo ancho entre secciones. El historial prioriza la tabla, con indicadores compactos, acciones secundarias agrupadas, parciales siempre visibles y columnas secundarias configurables. La ampliación es explícita y reversible sin pérdida del estado. En móvil se reorganiza la identidad de la materia (ciclo bajo el nombre), manteniendo los parciales y el desplazamiento dentro de la tabla. Los intentos adicionales se consultan como información secundaria, sin ocultar las calificaciones principales. Las cabeceras de programa/bloque son neutras y las notas se distinguen también mediante situación textual.

### Separación de consulta y administración del programa (08/11/2026)

Datos Generales presenta un resumen breve y un enlace a Trayectoria. Evitar repetir allí el editor y el historial completo de programas. En Trayectoria, consultar un programa y hacerlo principal son acciones distintas y explícitas. Usar «Principal» para la marca del expediente, separada del estatus curricular y la inscripción de cada ciclo. Agrupar el alta/edición bajo «Administrar programas»; mostrar el listado completo y las fechas de captura en apartados secundarios desplegables, sin ocultar el ingreso acreditado ni el historial de inscripciones. Mantener anchos acotados del selector, acciones alineadas y apilado adaptable. No derivar fechas de ingreso de fechas de captura.

### Fichas de personal y perfiles relacionados (08/11/2026)

Compartir la identidad y el contacto sin duplicar formularios independientes por función. Datos laborales, formación y documentos se consultan en secciones separadas; la configuración académica conserva su ciclo y guardado propios. En escritorio, navegación lateral; en tableta/móvil, selector vertical de sección, sin una fila extensa de pestañas. Cabecera y acciones permanecen visibles, con controles y ayudas alineados y contraste explícito en ambos temas.

Consultar o abrir no crea registros ni completa fechas. Mostrar referencias legadas como referencias y preservar la consulta anterior mientras no se inicie el perfil compartido. Diferenciar Sin registrar, Pendiente, Entregado, Revisado y No aplica; este último requiere motivo y no se cuenta como faltante después de justificarlo. Sin requisitos definidos no inventar 0 % o 100 %. Guardar por sección, conservar captura ante conflictos y pedir confirmación antes de recargar/descartar; incluir también notas de una relación de identidad en preparación. Las funciones institucionales de firmantes y NOM-035 conservan accesos propios y no se deducen de la formación principal ni de la habilitación docente.


Los nombres de Personal se capturan mediante tres campos equivalentes, alineados y de igual jerarquía: primer apellido, segundo apellido opcional y nombres. El nombre compuesto es una salida de lectura. Los registros sin desglose muestran una referencia histórica discreta y no rellenan campos por suposición. La revisión por lotes distingue capturar, cargar una propuesta, marcar revisado y confirmar; importar nunca equivale a guardar.


Una persona utiliza una ficha y una navegación común, accesible desde sus distintos directorios. Mostrar secciones según funciones y permisos; separar los cambios de situación administrativa de habilitación docente. Antes de dar de alta otra función, buscar la persona existente y mostrar sus funciones, conservando la confirmación de identidad y motivo. Las pantallas de compatibilidad no deben ofrecer una segunda ficha alternativa al usuario cuando ya existe el marco compartido.

La ficha de Personal conserva un marco de altura estable al cambiar de sección, con desplazamiento interno, cabecera y acciones visibles. Las funciones registradas permanecen identificables también en móvil; los accesos de tarjetas equivalentes se alinean por su base.

Los directorios de Personal comparten cabecera con una acción principal y herramientas secundarias, barra de búsqueda/filtros, chips removibles y cantidad de resultados. Priorizar identidad, función operativa y situación; documentos y datos complementarios son opcionales. Nombre y Ver ficha abren el mismo expediente; Más agrupa edición y acciones secundarias, con teclado, Escape y retorno de foco. No inferir una cuenta activa de la mera existencia de un usuario, ni una doble función de la similitud del nombre. Distinguir situación administrativa, habilitación docente y cuenta de usuario.

En escritorio usar tablas con acciones accesibles incluso al consultar columnas opcionales; en tableta vertical y móvil, tarjetas con igual contenido operativo, filtros y orden. Mantener búsqueda, página y selección al cerrar o guardar una ficha. La selección masiva muestra su alcance e incluye solo los IDs de la página al usar Seleccionar página. Los estados de carga, error con reintento y cero resultados deben ser distintos. Personal y NOM-035 tienen accesos separados dentro de RH; consultar el directorio no exige cargar evaluaciones ni planes de acción.
