import AyudaContextual from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';

export default function GuiaUso911() {
  return <details className="s911-card s911-guia-uso"><summary>Cómo llenar el 911 y qué significa cada término</summary><p>Avanza de izquierda a derecha por los pasos. Puedes guardar un borrador incompleto y continuar después.</p>
    <ol><li><strong>Prepara la información.</strong> Define fechas y ciclos, relaciona las ofertas oficiales con los planes internos y revisa los alumnos y el personal que respaldarán las cifras.</li><li><strong>Calcula y revisa.</strong> Confirma que revisaste a toda la población, recalcula y aplica las diferencias. Después confirma cada cifra o documenta una respuesta distinta.</li><li><strong>Guarda y descarga.</strong> Guarda el expediente para generar documentos de la misma revisión. Para una versión final, completa las comprobaciones y revisiones antes de enviarla a revisión y cerrarla.</li></ol>
    <dl className="s911-glosario">{[
      ['Expediente',ayuda.expediente],['Fecha de corte',ayuda.corte],['Fuente o registro de respaldo',ayuda.fuente],
      ['Cobertura completa',ayuda.cobertura],['Cifra calculada',ayuda.calculado],['Respuesta declarada',ayuda.declarado],['Respaldo de alumnos',ayuda.respaldo],
    ].map(([nombre,texto])=><div key={nombre}><dt>{nombre}</dt><dd>{texto}</dd></div>)}</dl>
    <p className="s911-note">Deja pendiente lo que aún no puedas comprobar. Escribe cero únicamente cuando hayas verificado que no hay casos.</p>
    <div className="campo-con-ayuda-etiqueta"><span>¿Cómo se leen las ayudas de los campos?</span><AyudaContextual etiqueta="Usar las ayudas" texto="Acerca el cursor o enfoca el signo de interrogación con Tab. También puedes tocarlo o pulsar Enter para mantener la explicación abierta. Usa Esc, vuelve a pulsarlo o toca fuera para cerrarla. Abrir una ayuda no cambia el campo."/></div>
  </details>;
}
