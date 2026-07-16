const BIDI_CONTROL_CHARS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

function normalizeDigit(char: string) {
  const code = char.charCodeAt(0);
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
  return char;
}

export function normalizeNumericInput(value: string) {
  const normalizedDigits = value
    .replace(BIDI_CONTROL_CHARS, '')
    .split('')
    .map(normalizeDigit)
    .join('')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');

  const firstDecimal = normalizedDigits.indexOf('.');
  if (firstDecimal === -1) return normalizedDigits;

  return `${normalizedDigits.slice(0, firstDecimal + 1)}${normalizedDigits
    .slice(firstDecimal + 1)
    .replace(/\./g, '')}`;
}

export function parseNumberInput(value: string) {
  const parsed = Number.parseFloat(normalizeNumericInput(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
