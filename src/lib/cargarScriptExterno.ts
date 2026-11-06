const cargas = new Map<string, Promise<void>>();

/** Comparte cargas simultáneas y permite reintentar tras un fallo, sin espera indefinida. */
export function cargarScriptExterno(url: string): Promise<void> {
  const existente = cargas.get(url);
  if (existente) return existente;
  const carga = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const fallo = () => { clearTimeout(limite); script.remove(); cargas.delete(url); reject(new Error('No se pudo cargar Google Drive. Revisa la conexión o el bloqueo de ventanas e inténtalo de nuevo.')); };
    const limite = window.setTimeout(fallo, 15000);
    script.src = url; script.async = true;
    script.onload = () => { clearTimeout(limite); resolve(); };
    script.onerror = fallo;
    document.head.appendChild(script);
  });
  cargas.set(url, carga);
  return carga;
}
