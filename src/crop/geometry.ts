export type FocalPoint = { x: number; y: number }

export type CropWindow = { x: number; y: number; width: number; height: number }

export const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)

export const clamp01 = (v: number): number => clamp(v, 0, 1)

/* "9:16" -> 9/16; falls back to portrait on malformed input. */
export const parseAspect = (aspect: string): number => {
   const [w, h] = aspect.split(':').map(Number)
   return w !== undefined && h !== undefined && w > 0 && h > 0 ? w / h : 9 / 16
}

/* The largest window of `targetAspect` that fits inside the source, centred on
   the focal point and clamped so it never runs off an edge. Pure — this is the
   geometry the ffmpeg cropper applies once a detector says where to look. */
export const cropWindowFor = (
   srcW: number,
   srcH: number,
   targetAspect: number,
   focal: FocalPoint
): CropWindow => {
   const srcAspect = srcW / srcH
   const [w, h] =
      targetAspect < srcAspect
         ? [Math.round(srcH * targetAspect), srcH]
         : [srcW, Math.round(srcW / targetAspect)]
   const x = Math.round(clamp(focal.x * srcW - w / 2, 0, srcW - w))
   const y = Math.round(clamp(focal.y * srcH - h / 2, 0, srcH - h))
   return { x, y, width: w, height: h }
}
