export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  preferredFormat?: 'image/webp' | 'image/jpeg';
}

export function calculateTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: Math.max(1, maxWidth), height: Math.max(1, maxHeight) };
  }

  if (srcWidth <= maxWidth && srcHeight <= maxHeight) {
    return { width: srcWidth, height: srcHeight };
  }

  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return {
    width: Math.max(1, Math.round(srcWidth * ratio)),
    height: Math.max(1, Math.round(srcHeight * ratio))
  };
}

function replaceExtension(fileName: string, newExtension: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) {
    return `${fileName}${newExtension}`;
  }
  return `${fileName.slice(0, lastDot)}${newExtension}`;
}

async function loadImageSource(file: File | Blob): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Modern browsers handle EXIF orientation automatically with imageOrientation: 'from-image'
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          if (typeof bitmap.close === 'function') {
            bitmap.close();
          }
        }
      };
    } catch {
      // Fall back to HTMLImageElement if createImageBitmap fails with specific options
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl)
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen para optimización.'));
    };

    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), format, quality);
  });
}

/**
 * Optimiza y redimensiona una imagen en el cliente (navegador/tablet/móvil)
 * antes de enviarla al servidor. Ideal para fotos tomadas directamente
 * con cámaras de dispositivos Android/iOS (12-50MP).
 */
export async function compressProductImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  // Solo procesar imágenes y si estamos en entorno de navegador
  if (!file || typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  // Las imágenes vectoriales SVG no deben rasterizarse
  if (file.type === 'image/svg+xml') {
    return file;
  }

  const {
    maxWidth = 1000,
    maxHeight = 1000,
    quality = 0.82,
    preferredFormat = 'image/webp'
  } = options;

  let loaded: {
    source: ImageBitmap | HTMLImageElement;
    width: number;
    height: number;
    cleanup: () => void;
  } | null = null;

  try {
    loaded = await loadImageSource(file);
    const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
      loaded.width,
      loaded.height,
      maxWidth,
      maxHeight
    );

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(loaded.source, 0, 0, targetWidth, targetHeight);

    // Intentar exportar a WebP primero (o el formato preferido)
    let outputBlob = await canvasToBlob(canvas, preferredFormat, quality);
    let outputExt = preferredFormat === 'image/webp' ? '.webp' : '.jpg';

    // Fallback a JPEG si WebP no fue soportado por el navegador
    if (!outputBlob && preferredFormat !== 'image/jpeg') {
      outputBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
      outputExt = '.jpg';
    }

    if (!outputBlob) {
      return file;
    }

    // Si la imagen original ya era más ligera y del mismo formato y dimensiones, conservar la original
    if (file.size <= outputBlob.size && file.type === outputBlob.type && targetWidth === loaded.width && targetHeight === loaded.height) {
      return file;
    }

    const newFileName = replaceExtension(file.name, outputExt);
    return new File([outputBlob], newFileName, {
      type: outputBlob.type,
      lastModified: Date.now()
    });
  } catch (error) {
    // En caso de cualquier excepción (ej: formato no decodificable), devolver el archivo original
    console.warn('[compressProductImage] Error al optimizar la imagen, usando archivo original:', error);
    return file;
  } finally {
    if (loaded) {
      loaded.cleanup();
    }
  }
}
