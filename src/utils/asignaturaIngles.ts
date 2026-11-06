/** Evita confundir una materia de Inglés con asignaturas cuyo nombre solo lo menciona. */
export function esAsignaturaIngles(nombre: string | null | undefined): boolean {
  return /^ingl[eé]s\b/i.test((nombre || '').trim());
}
