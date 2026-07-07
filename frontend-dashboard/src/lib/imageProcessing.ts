const DARK_FLOORPLAN_SUFFIX = "-dark"

export async function createDarkFloorplanFile(file: File): Promise<File> {
  const image = await loadImage(file)
  const blob = await createDarkFloorplanBlob(image)
  return new File([blob], darkFloorplanName(file.name), { type: "image/png", lastModified: Date.now() })
}

export interface PreparedFloorplanImage {
  converted: boolean
  revoke: () => void
  url: string
}

export async function prepareFloorplanDisplayImage(imageUrl: string): Promise<PreparedFloorplanImage> {
  return { converted: false, revoke: () => undefined, url: imageUrl }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Uploaded layout image could not be decoded."))
    }
    image.src = url
  })
}

function createDarkFloorplanBlob(image: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height

  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Browser canvas is unavailable for layout conversion.")

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha === 0) continue

    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    data[index] = 255 - red
    data[index + 1] = 255 - green
    data[index + 2] = 255 - blue
  }

  context.putImageData(pixels, 0, 0)
  return canvasToPngBlob(canvas)
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Dark layout image could not be generated."))
    }, "image/png")
  })
}

function darkFloorplanName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "layout"
  return `${base}${DARK_FLOORPLAN_SUFFIX}.png`
}
