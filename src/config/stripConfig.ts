// AquaChek Pool Test Strips - parameter definitions
export type StripParameter = "freeChlorine" | "ph" | "alkalinity" | "salt";

export const stripConfig: Record<StripParameter, { labelHe: string; unit: string }> = {
  freeChlorine: { labelHe: "כלור חופשי", unit: "ppm" },
  ph: { labelHe: "pH", unit: "" },
  alkalinity: { labelHe: "אלקליניות", unit: "ppm" },
  salt: { labelHe: "מלח", unit: "ppm" },
};
