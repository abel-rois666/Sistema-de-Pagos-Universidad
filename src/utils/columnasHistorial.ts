export type ColumnaHistorialId = 'ciclo'|'p1'|'p2'|'p3'|'evaluacion'|'promedio'|'ordinario'|'extra1'|'extra2'|'recursamiento'|'final'|'letra'|'situacion'|'creditos';
export interface ColumnaHistorial {
  id: ColumnaHistorialId; etiqueta: string; nombre: string; fija?: boolean;
  ancho: number; anchoMovil: number; evaluacion?: boolean; ayuda?: string;
}
export const COLUMNAS_INICIALES: ColumnaHistorialId[] = ['ordinario','extra1','extra2','recursamiento','creditos'];
export interface MateriaColumnas {
  ordinario?: {parcial_1?: unknown; parcial_2?: unknown; parcial_3?: unknown; promedio_calculado?: unknown; calificacion_final?: unknown}|null;
  extras: {calificacion_final?: unknown}[];
}
export function catalogoColumnasHistorial(esEspecialidad: boolean): ColumnaHistorial[] {
  return [
    {id:'ciclo',etiqueta:'Ciclo',nombre:'Ciclo ordinario',fija:true,ancho:84,anchoMovil:0},
    ...(esEspecialidad
      ? [{id:'evaluacion' as const,etiqueta:'Eval.',nombre:'Evaluación final',fija:true,ancho:68,anchoMovil:64,ayuda:'Evaluación final registrada para este programa. Se conserva separada de la final ordinaria y del resultado consolidado.'}]
      : [1,2,3].map(n=>({id:`p${n}` as ColumnaHistorialId,etiqueta:`P${n}`,nombre:`Parcial ${n}`,fija:true,ancho:42,anchoMovil:40}))),
    {id:'promedio',etiqueta:'Prom.',nombre:'Promedio calculado',ancho:68,anchoMovil:64,evaluacion:true,ayuda:'Promedio calculado que consta en el registro ordinario. Puede diferir de una calificación final modificada o de otro intento.'},
    {id:'ordinario',etiqueta:'Ord.',nombre:'Final ordinario',ancho:68,anchoMovil:64,evaluacion:true,ayuda:'Calificación final del registro ordinario. En especialidades conserva la evaluación final como alternativa cuando no existe una final registrada.'},
    ...(!esEspecialidad ? [1,2].map(n=>({id:`extra${n}` as ColumnaHistorialId,etiqueta:`Ext. ${n}`,nombre:`Extraordinario ${n}`,ancho:52,anchoMovil:48,evaluacion:true})) : []),
    {id:'recursamiento',etiqueta:'Rec.',nombre:'Recursamiento',ancho:52,anchoMovil:48,evaluacion:true},
    {id:'final',etiqueta:'Final',nombre:'Resultado final',fija:true,ancho:72,anchoMovil:64,ayuda:'Resultado consolidado por la lógica del historial, considerando sus evaluaciones. No reemplaza ni modifica la final ordinaria; consulta los intentos para ver su procedencia.'},
    {id:'letra',etiqueta:'Letra',nombre:'Calificación en letra',ancho:112,anchoMovil:112},
    {id:'situacion',etiqueta:'Situación',nombre:'Situación de la materia',ancho:126,anchoMovil:126},
    {id:'creditos',etiqueta:'Créd.',nombre:'Créditos',ancho:62,anchoMovil:56},
  ];
}
/** Conserva la correspondencia de intentos usada por la tabla previa; no reordena evaluaciones. */
export function valorEvaluacionHistorial(item: MateriaColumnas, columna: ColumnaHistorialId, especialidad: boolean): unknown {
  switch(columna) {
    case 'p1': case 'evaluacion': return item.ordinario?.parcial_1;
    case 'p2': return item.ordinario?.parcial_2;
    case 'p3': return item.ordinario?.parcial_3;
    case 'promedio': return item.ordinario?.promedio_calculado;
    case 'ordinario': return especialidad ? item.ordinario?.calificacion_final ?? item.ordinario?.parcial_1 : item.ordinario?.calificacion_final;
    case 'extra1': return item.extras[0]?.calificacion_final;
    case 'extra2': return item.extras[1]?.calificacion_final;
    case 'recursamiento': return item.extras[especialidad ? 0 : 2]?.calificacion_final;
    default: return undefined;
  }
}
/** La población completa del programa evita que un filtro haga aparecer/desaparecer columnas. */
export function resolverColumnasHistorial(especialidad: boolean, elegidas: readonly ColumnaHistorialId[], ocultarVacias: boolean, poblacion: readonly MateriaColumnas[]) {
  return catalogoColumnasHistorial(especialidad).filter(c=>c.fija || (elegidas.includes(c.id) && (!ocultarVacias || !c.evaluacion || poblacion.some(item=>{
    const v=valorEvaluacionHistorial(item,c.id,especialidad);
    return v!==null && v!==undefined && v!=='';
  }))));
}
