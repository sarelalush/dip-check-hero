export function readZeroBasedImageScriptRgb(image, colorToRgb, x, y) {
  if (!image || image.width < 1 || image.height < 1) {
    throw new RangeError('Cannot read pixels from an empty image.');
  }

  const zeroBasedX = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const zeroBasedY = Math.max(0, Math.min(image.height - 1, Math.floor(y)));

  // ImageScript exposes one-based pixel coordinates, while the CV pipeline
  // intentionally uses conventional zero-based image coordinates.
  return colorToRgb(image.getPixelAt(zeroBasedX + 1, zeroBasedY + 1));
}
