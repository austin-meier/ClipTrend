#!/usr/bin/env python3
"""Focal-point detector for the face-saliency crop strategy.

Reads sampled video frames (paths passed as args), finds where the viewer's eye
should land, and prints a single normalized focal point as JSON: {"x": .., "y": ..},
where x=0 is the left edge and y=0 the top. The Node side (crop/detectors/
faceSaliency.ts) shells out to this and applies the crop; keeping the "where to
look" logic here is what makes the detector swappable.

Strategy per frame: prefer detected faces (weighted by area); fall back to the
static-saliency centroid; fall back to dead centre. Frames are then averaged,
weighted by confidence, so a face present in most frames dominates.

Requires: opencv-contrib-python (contrib provides cv2.saliency).
"""

import argparse
import json

import cv2  # type: ignore

_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def focal_for_frame(img):
    """Return (x_norm, y_norm, weight) for one BGR frame."""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    faces = _CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    if len(faces) > 0:
        # Weight each face centre by its area so the dominant face wins.
        total = sum(fw * fh for (_, _, fw, fh) in faces)
        cx = sum((x + fw / 2) * fw * fh for (x, _, fw, fh) in faces) / total
        cy = sum((y + fh / 2) * fw * fh for (_, y, fw, fh) in faces) / total
        return (cx / w, cy / h, 1.0)

    try:
        saliency = cv2.saliency.StaticSaliencySpectralResidual_create()
        ok, smap = saliency.computeSaliency(img)
        if ok:
            moments = cv2.moments((smap * 255).astype("uint8"))
            if moments["m00"] > 0:
                return (moments["m10"] / moments["m00"] / w, moments["m01"] / moments["m00"] / h, 0.5)
    except Exception:
        pass

    return (0.5, 0.5, 0.1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("frames", nargs="+")
    args = parser.parse_args()

    points = [focal_for_frame(img) for img in (cv2.imread(p) for p in args.frames) if img is not None]

    if not points:
        print(json.dumps({"x": 0.5, "y": 0.5}))
        return

    total_weight = sum(p[2] for p in points) or 1.0
    x = sum(p[0] * p[2] for p in points) / total_weight
    y = sum(p[1] * p[2] for p in points) / total_weight
    print(json.dumps({"x": round(x, 4), "y": round(y, 4)}))


if __name__ == "__main__":
    main()
