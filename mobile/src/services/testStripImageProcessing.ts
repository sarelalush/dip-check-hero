import * as ImageManipulator from 'expo-image-manipulator';

export interface TestStripFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  previewWidth: number;
  previewHeight: number;
}

export interface TestStripImageProcessingInput {
  frame: TestStripFrame;
  height: number;
  uri: string;
  width: number;
}

export type TestStripProcessingErrorCode =
  | 'missingFrame'
  | 'stripOutsideFrame'
  | 'stripTooSmall'
  | 'notStraight'
  | 'blurry'
  | 'reflection'
  | 'notDetected'
  | 'processingFailed';

export class TestStripProcessingError extends Error {
  code: TestStripProcessingErrorCode;
  userMessage: string;

  constructor(code: TestStripProcessingErrorCode, userMessage: string) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
  }
}

export interface ProcessedTestStripImage {
  debugLog: string[];
  finalCrop: ImageCropBounds;
  finalSize: ImageSize;
  firstCrop: ImageCropBounds;
  frame: TestStripFrame;
  originalSize: ImageSize;
  originalUri: string;
  uri: string;
}

interface ImageSize {
  height: number;
  width: number;
}

interface ImageCropBounds {
  height: number;
  originX: number;
  originY: number;
  width: number;
}

const FRAME_PADDING_RATIO = 0.015;
const MIN_STRIP_HEIGHT_PX = 420;
const MIN_STRIP_WIDTH_PX = 55;
const MIN_STRIP_ASPECT = 3.4;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundCrop(crop: ImageCropBounds, image: ImageSize): ImageCropBounds {
  const originX = clamp(Math.round(crop.originX), 0, Math.max(0, image.width - 1));
  const originY = clamp(Math.round(crop.originY), 0, Math.max(0, image.height - 1));
  const width = clamp(Math.round(crop.width), 1, image.width - originX);
  const height = clamp(Math.round(crop.height), 1, image.height - originY);

  return { originX, originY, width, height };
}

function computeImageCropFromFrame(frame: TestStripFrame, image: ImageSize): ImageCropBounds {
  const coverScale = Math.max(frame.previewWidth / image.width, frame.previewHeight / image.height);
  const renderedWidth = image.width * coverScale;
  const renderedHeight = image.height * coverScale;
  const hiddenX = Math.max(0, (renderedWidth - frame.previewWidth) / 2);
  const hiddenY = Math.max(0, (renderedHeight - frame.previewHeight) / 2);
  const padX = frame.width * FRAME_PADDING_RATIO;
  const padY = frame.height * FRAME_PADDING_RATIO;

  return roundCrop(
    {
      originX: (frame.x + hiddenX - padX) / coverScale,
      originY: (frame.y + hiddenY - padY) / coverScale,
      width: (frame.width + padX * 2) / coverScale,
      height: (frame.height + padY * 2) / coverScale,
    },
    image,
  );
}

function validateFrame(frame: TestStripFrame, image: ImageSize, crop: ImageCropBounds) {
  if (!frame.width || !frame.height || !frame.previewWidth || !frame.previewHeight) {
    throw new TestStripProcessingError(
      'missingFrame',
      'לא הצלחנו לזהות את גבולות המסגרת. נסה לפתוח את המצלמה מחדש.',
    );
  }

  if (crop.originX < 0 || crop.originY < 0 || crop.originX + crop.width > image.width || crop.originY + crop.height > image.height) {
    throw new TestStripProcessingError(
      'stripOutsideFrame',
      'חלק מהסטיק מחוץ למסגרת. מקם את כל הסטיק בתוך הקווים וצלם שוב.',
    );
  }

  if (crop.width < MIN_STRIP_WIDTH_PX || crop.height < MIN_STRIP_HEIGHT_PX || crop.height / crop.width < MIN_STRIP_ASPECT) {
    throw new TestStripProcessingError(
      'stripTooSmall',
      'הסטיק קטן מדי בתמונה. קרב את המצלמה כך שהסטיק ימלא את המסגרת.',
    );
  }
}

function logProcessing(lines: string[]) {
  for (const line of lines) {
    console.info(`[test-strip-processing] ${line}`);
  }
}

export async function processTestStripImage(input: TestStripImageProcessingInput): Promise<ProcessedTestStripImage> {
  const originalSize = { width: input.width, height: input.height };

  if (!input.uri || input.width <= 0 || input.height <= 0) {
    throw new TestStripProcessingError(
      'notDetected',
      'לא זוהה קובץ תמונה תקין. נסה לצלם שוב.',
    );
  }

  try {
    const firstCrop = computeImageCropFromFrame(input.frame, originalSize);
    validateFrame(input.frame, originalSize, firstCrop);

    const cropped = await ImageManipulator.manipulateAsync(
      input.uri,
      [{ crop: firstCrop }],
      {
        compress: 0.98,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    const finalCrop = {
      height: firstCrop.height,
      originX: 0,
      originY: 0,
      width: firstCrop.width,
    };
    const finalSize = { width: cropped.width, height: cropped.height };
    const debugLog = [
      `original=${originalSize.width}x${originalSize.height}`,
      `frame=${Math.round(input.frame.x)},${Math.round(input.frame.y)},${Math.round(input.frame.width)}x${Math.round(input.frame.height)} preview=${Math.round(input.frame.previewWidth)}x${Math.round(input.frame.previewHeight)}`,
      `firstCrop=${firstCrop.originX},${firstCrop.originY},${firstCrop.width}x${firstCrop.height}`,
      `finalCrop=${finalCrop.originX},${finalCrop.originY},${finalCrop.width}x${finalCrop.height}`,
      `final=${finalSize.width}x${finalSize.height}`,
    ];

    logProcessing(debugLog);

    return {
      debugLog,
      finalCrop,
      finalSize,
      firstCrop,
      frame: input.frame,
      originalSize,
      originalUri: input.uri,
      uri: cropped.uri,
    };
  } catch (error) {
    if (error instanceof TestStripProcessingError) {
      throw error;
    }

    console.warn('[test-strip-processing] failed', error);
    throw new TestStripProcessingError(
      'processingFailed',
      'לא הצלחנו לחתוך את הסטיק. ודא שהוא ישר, חד וממלא את המסגרת.',
    );
  }
}
