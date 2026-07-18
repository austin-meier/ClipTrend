import type { CropConfig } from '../config'
import { Err, Ok, type Result } from '../lib/utils/result'
import { aiVisionDetector } from './detectors/aiVision'
import { faceSaliencyDetector } from './detectors/faceSaliency'
import type { FocalPointDetector } from './types'

/* The single place a detector is chosen from config. Add a new strategy here
   and it's reachable via crop.detector — nothing else in the pipeline changes. */
export const makeDetector = (crop: CropConfig): Result<FocalPointDetector, Error> => {
   switch (crop.detector) {
      case 'face-saliency':
         return Ok(faceSaliencyDetector(crop.faceSaliency))
      case 'ai-vision':
         return Ok(aiVisionDetector(crop.aiVision))
      default:
         return Err(new Error(`unknown crop detector: ${crop.detector as string}`))
   }
}
