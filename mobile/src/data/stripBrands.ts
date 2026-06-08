export interface MobileStripBrand {
  id: string;
  nameHe: string;
  descriptionHe: string;
  supported: boolean;
  recommended?: boolean;
  swatches: string[];
}

export const stripBrands: MobileStripBrand[] = [
  {
    id: 'aquachek-pro-5in1',
    nameHe: 'AquaChek Pro',
    descriptionHe: 'ברירת המחדל לסלייס הראשון. 4 פדים פיזיים עם כלור, ברום, pH ואלקליניות.',
    supported: true,
    recommended: true,
    swatches: ['#F9D86C', '#EE8D4A', '#D94C5C', '#8FD1D4', '#4C86A8'],
  },
  {
    id: 'aquachek-yellow-4',
    nameHe: 'AquaChek Yellow 4-in-1',
    descriptionHe: 'כלור חופשי, pH, אלקליניות וחומצה ציאנורית. תמיכה מלאה תתווסף בהמשך.',
    supported: false,
    swatches: ['#F4E36B', '#F49A55', '#D96072', '#B8D7A3'],
  },
  {
    id: 'aquachek-silver-salt',
    nameHe: 'AquaChek Silver Salt',
    descriptionHe: 'מיועד לבריכות מלח. כולל כלור, pH, אלקליניות ומלח.',
    supported: false,
    swatches: ['#F5D76E', '#EF8C59', '#9DD2D5', '#C6C8D6'],
  },
  {
    id: 'aquachek-7',
    nameHe: 'AquaChek 7-in-1',
    descriptionHe: 'בדיקה רחבה יותר הכוללת קשיות, כלור, ברום, pH, אלקליניות וציאנורית.',
    supported: false,
    swatches: ['#A875B6', '#F3D65F', '#EFA25A', '#D85E7A', '#8AC8D0', '#6AA6B7'],
  },
  {
    id: 'hth-6-way',
    nameHe: 'HTH 6-Way',
    descriptionHe: 'סטיק נפוץ עם מדדים דומים. נמצא ברשימת תמיכה עתידית.',
    supported: false,
    swatches: ['#F0D46A', '#EBA05E', '#D85A6D', '#81C4CF', '#68A6B2'],
  },
  {
    id: 'clorox-3in1',
    nameHe: 'Clorox 3-in-1',
    descriptionHe: 'סטיק בסיסי לכלור חופשי, pH ואלקליניות.',
    supported: false,
    swatches: ['#F2D869', '#E78A58', '#91CBD3'],
  },
];
