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
  try {
    const image = await loadImageUrl(imageUrl)
    const analysis = analyzeImageBrightness(image)
    if (analysis.averageLuminance < 145) {
      return { converted: false, revoke: () => undefined, url: imageUrl }
    }
    const blob = await createDarkFloorplanBlob(image)
    const objectUrl = URL.createObjectURL(blob)
    return { converted: true, revoke: () => URL.revokeObjectURL(objectUrl), url: objectUrl }
  } catch {
    return { converted: false, revoke: () => undefined, url: imageUrl }
  }
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

function loadImageUrl(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Layout image could not be decoded."))
    image.src = imageUrl
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
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

    // CAD floorplans are usually white background + dark strokes. Map them to
    // Apilogik-style dark monitoring imagery: near-white becomes black, dark
    // lines become light gray, and colored annotations keep a restrained tint.
    if (isNearlyNeutral(red, green, blue)) {
      const inverted = 255 - luminance
      const value = Math.round(clamp(18 + inverted * 0.86, 0, 235))
      data[index] = value
      data[index + 1] = value
      data[index + 2] = value
    } else {
      data[index] = Math.round(clamp(255 - red, 24, 235))
      data[index + 1] = Math.round(clamp(255 - green, 24, 235))
      data[index + 2] = Math.round(clamp(255 - blue, 24, 235))
    }
  }

  context.putImageData(pixels, 0, 0)
  return canvasToPngBlob(canvas)
}

function analyzeImageBrightness(image: HTMLImageElement) {
  const canvas = document.createElement("canvas")
  const width = Math.min(160, image.naturalWidth || image.width)
  const height = Math.min(120, image.naturalHeight || image.height)
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Browser canvas is unavailable for layout analysis.")

  context.drawImage(image, 0, 0, width, height)
  const data = context.getImageData(0, 0, width, height).data
  let totalLuminance = 0
  let count = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha < 16) continue
    totalLuminance += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]
    count += 1
  }

  return { averageLuminance: count > 0 ? totalLuminance / count : 0 }
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

function isNearlyNeutral(red: number, green: number, blue: number) {
  return Math.max(red, green, blue) - Math.min(red, green, blue) < 28
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
