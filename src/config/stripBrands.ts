// Pool test strip brand registry. 5 well-known strips, hardcoded for MVP.

export type StripParameter =
  | "freeChlorine"
  | "totalChlorine"
  | "bromine"
  | "ph"
  | "alkalinity"
  | "cyanuricAcid"
  | "hardness"
  | "salt";

export const PARAM_LABEL_HE: Record<StripParameter, { labelHe: string; unit: string }> = {
  freeChlorine: { labelHe: "כלור חופשי", unit: "ppm" },
  totalChlorine: { labelHe: "כלור כולל", unit: "ppm" },
  bromine: { labelHe: "ברום", unit: "ppm" },
  ph: { labelHe: "pH", unit: "" },
  alkalinity: { labelHe: "אלקליניות", unit: "ppm" },
  cyanuricAcid: { labelHe: "חומצה ציאנורית", unit: "ppm" },
  hardness: { labelHe: "קשיות כללית", unit: "ppm" },
  salt: { labelHe: "מלח", unit: "ppm" },
};

export interface StripBrand {
  id: string;
  nameHe: string;
  /** order matches the printed order of pads on the strip (top→bottom). */
  parameters: StripParameter[];
  /** short Hebrew description for UI. */
  descriptionHe: string;
}

export const STRIP_BRANDS: StripBrand[] = [
  {
    id: "aquachek-pro-5in1",
    nameHe: "AquaChek Pro (5-in-1)",
    descriptionHe: "ברירת מחדל לדמו. כלור כולל, ברום כולל, כלור חופשי, pH, אלקליניות",
    parameters: ["totalChlorine", "bromine", "freeChlorine", "ph", "alkalinity"],
  },
  {
    id: "aquachek-yellow-4",
    nameHe: "AquaChek Yellow (4-in-1)",
    descriptionHe: "כלור חופשי, pH, אלקליניות, חומצה ציאנורית",
    parameters: ["freeChlorine", "ph", "alkalinity", "cyanuricAcid"],
  },
  {
    id: "aquachek-silver-salt",
    nameHe: "AquaChek Silver (4-in-1 + מלח)",
    descriptionHe: "מותאם לבריכות מלח. כלור חופשי, pH, אלקליניות, מלח",
    parameters: ["freeChlorine", "ph", "alkalinity", "salt"],
  },
  {
    id: "aquachek-7",
    nameHe: "AquaChek 7-in-1",
    descriptionHe: "קשיות, כלור כולל, כלור חופשי, ברום, pH, אלקליניות, ציאנורית",
    parameters: [
      "hardness",
      "totalChlorine",
      "freeChlorine",
      "bromine",
      "ph",
      "alkalinity",
      "cyanuricAcid",
    ],
  },
  {
    id: "hth-6-way",
    nameHe: "HTH 6-Way",
    descriptionHe: "כלור כולל, כלור חופשי, ברום, pH, אלקליניות, ציאנורית",
    parameters: [
      "totalChlorine",
      "freeChlorine",
      "bromine",
      "ph",
      "alkalinity",
      "cyanuricAcid",
    ],
  },
  {
    id: "clorox-3in1",
    nameHe: "Clorox 3-in-1",
    descriptionHe: "כלור חופשי, pH, אלקליניות",
    parameters: ["freeChlorine", "ph", "alkalinity"],
  },
];

export const DEFAULT_BRAND_ID = "aquachek-yellow-4";

export function getBrand(id?: string): StripBrand {
  return STRIP_BRANDS.find((b) => b.id === id) ?? STRIP_BRANDS[0];
}
