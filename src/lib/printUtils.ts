/**
 * Utilidad de impresión y PDF.
 * - printElement: abre un iframe aislado con estilos computados y ejecuta print()
 * - downloadElementAsPDF: convierte el elemento a imagen vía html-to-image y genera PDF con jsPDF
 */

// ─── Inline computed styles ─────────────────────────────────────────────────
function inlineComputedStyles(original: HTMLElement, clone: HTMLElement) {
  const computed = window.getComputedStyle(original);
  const props = [
    'display', 'flex-direction', 'align-items', 'justify-content', 'flex-wrap', 'flex', 'flex-shrink', 'flex-grow',
    'position', 'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
    'margin', 'padding', 'border', 'border-width', 'border-style', 'border-color', 'border-radius',
    'background', 'background-color', 'color',
    'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'line-height',
    'text-align', 'text-transform', 'text-decoration', 'white-space', 'word-break', 'text-overflow', 'overflow',
    'box-sizing', 'box-shadow',
    'table-layout', 'border-collapse', 'vertical-align',
    'opacity', 'visibility',
    'gap', 'row-gap', 'column-gap',
    'grid-template-columns', 'grid-template-rows',
  ];
  let style = '';
  for (const prop of props) {
    const val = computed.getPropertyValue(prop);
    if (val && val !== 'initial' && val !== 'normal' && val !== 'none' && val !== '0px' && val !== 'auto' && val !== 'start') {
      style += `${prop}:${val};`;
    }
  }
  style += `display:${computed.display};`;
  style += `box-sizing:${computed.boxSizing};`;
  if (computed.width !== 'auto') style += `width:${computed.width};`;

  clone.setAttribute('style', style);

  const origChildren = original.children;
  const cloneChildren = clone.children;
  for (let i = 0; i < origChildren.length && i < cloneChildren.length; i++) {
    inlineComputedStyles(origChildren[i] as HTMLElement, cloneChildren[i] as HTMLElement);
  }
}

// ─── printElement ───────────────────────────────────────────────────────────
/**
 * Imprime un elemento HTML en un iframe aislado.
 * Clona el contenido, inlinea estilos computados, y ejecuta print() en el iframe.
 */
export function printElement(sourceElement: HTMLElement, options?: { landscape?: boolean }): void {
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  inlineComputedStyles(sourceElement, clone);
  const isLandscape = options?.landscape ?? false;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;top:-10000px;left:-10000px;width:${isLandscape ? '1400' : '1100'}px;height:${isLandscape ? '1100' : '1400'}px;border:none;`;
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; margin: 0; padding: 0; }
    @page { size: letter ${isLandscape ? 'landscape' : 'portrait'}; margin: 0.4cm; }
    img { max-width: 100%; }
  </style>
</head>
<body></body>
</html>`);
  iframeDoc.close();

  iframeDoc.body.appendChild(clone);

  // Resetear propiedades del clon que impiden el flujo natural del contenido
  // (el div fuente usa position:fixed para estar fuera de pantalla)
  clone.style.position = 'static';
  clone.style.top = 'auto';
  clone.style.left = 'auto';
  clone.style.overflow = 'visible';
  clone.style.height = 'auto';
  clone.style.width = '100%';

  // Redimensionar iframe a la altura real del contenido para que el navegador pagine correctamente
  const contentHeight = iframeDoc.body.scrollHeight;
  iframe.style.height = `${contentHeight + 100}px`;

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 300);
}

// ─── downloadElementAsPDF ──────────────────────────────────────────────────
/**
 * Convierte todas las imágenes del clone a data URLs para evitar problemas CORS.
 */
async function convertImagesToDataURL(element: HTMLElement): Promise<void> {
  const imgs = element.querySelectorAll('img');
  const promises = Array.from(imgs).map(async (img) => {
    if (!img.src || img.src.startsWith('data:')) return;
    try {
      const response = await fetch(img.src, { mode: 'cors' });
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      img.src = dataUrl;
    } catch {
      // Si falla el CORS, crear un canvas proxy
      try {
        const proxyImg = new Image();
        proxyImg.crossOrigin = 'anonymous';
        proxyImg.src = img.src;
        await new Promise<void>((resolve) => {
          proxyImg.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = proxyImg.naturalWidth;
            canvas.height = proxyImg.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(proxyImg, 0, 0);
              try {
                img.src = canvas.toDataURL('image/png');
              } catch {
                // Canvas taint — remove the image to avoid blocking PDF
                img.style.display = 'none';
              }
            }
            resolve();
          };
          proxyImg.onerror = () => {
            img.style.display = 'none'; // Hide broken image
            resolve();
          };
        });
      } catch {
        img.style.display = 'none';
      }
    }
  });
  await Promise.all(promises);
}

/**
 * Genera un PDF descargable a partir de un elemento HTML usando html-to-image + jsPDF.
 */
export async function downloadElementAsPDF(
  sourceElement: HTMLElement,
  fileName: string
): Promise<void> {
  const { toPng } = await import('html-to-image');
  const { default: jsPDF } = await import('jspdf');

  // Clonar e inlinear estilos
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  inlineComputedStyles(sourceElement, clone);

  // Crear contenedor temporal visible pero fuera de vista
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:816px;background:white;z-index:-1;';
  container.appendChild(clone);
  document.body.appendChild(container);

  // Convertir imágenes a data URL para evitar CORS
  await convertImagesToDataURL(clone);

  // Esperar renderizado
  await new Promise(r => setTimeout(r, 300));

  try {
    const dataUrl = await toPng(clone, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      // Si hay imágenes que siguen fallando, usar placeholder transparente
      imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xMkMEa+wAAAANSURBVBhXY2BgYPgPAAEEAQBWpOvLAAAAAElFTkSuQmCC',
    });

    // Cargar imagen para obtener dimensiones
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Error al cargar imagen generada'));
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [img.width / 2, img.height / 2],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, img.width / 2, img.height / 2);
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Genera un PDF a partir de un elemento HTML y lo retorna como Blob (útil para ZIPs masivos).
 */
export async function generatePDFBlob(
  sourceElement: HTMLElement
): Promise<Blob> {
  const { toPng } = await import('html-to-image');
  const { default: jsPDF } = await import('jspdf');

  const clone = sourceElement.cloneNode(true) as HTMLElement;
  inlineComputedStyles(sourceElement, clone);

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:816px;background:white;z-index:-1;';
  container.appendChild(clone);
  document.body.appendChild(container);

  await convertImagesToDataURL(clone);
  await new Promise(r => setTimeout(r, 250));

  try {
    const dataUrl = await toPng(clone, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xMkMEa+wAAAANSURBVBhXY2BgYPgPAAEEAQBWpOvLAAAAAElFTkSuQmCC',
    });

    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Error al cargar imagen generada'));
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [img.width / 2, img.height / 2],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, img.width / 2, img.height / 2);
    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}
