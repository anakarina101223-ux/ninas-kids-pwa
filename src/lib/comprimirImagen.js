export async function comprimirImagen(archivo, ladoMax = 800, calidad = 0.8) {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad))
}