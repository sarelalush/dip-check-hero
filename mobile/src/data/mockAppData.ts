export const mockUser = {
  name: 'Isarel190',
};

export const mockPools = [
  {
    id: 'main',
    name: 'הבריכה הראשית',
    volume: '32,000 ליטר',
    status: 'המים מאוזנים',
    tone: 'success' as const,
  },
  {
    id: 'kids',
    name: 'בריכת הילדים',
    volume: '8,500 ליטר',
    status: 'נדרש תיקון קל',
    tone: 'warning' as const,
  },
];

export const homeMetrics = [
  { label: 'pH', value: '7.3', status: 'תקין', tone: 'success' as const },
  { label: 'כלור', value: '1.5', status: 'תקין', tone: 'success' as const },
  { label: 'אלקליניות', value: '120', status: 'תקין', tone: 'success' as const },
];

export const resultRows = [
  { label: 'pH', value: '7.3', status: 'תקין', range: 'טווח מומלץ 7.2-7.6', progress: 68, tone: 'success' as const },
  { label: 'כלור', value: '1.5', status: 'תקין', range: 'טווח מומלץ 1.0-3.0', progress: 52, tone: 'success' as const },
  { label: 'אלקליניות', value: '120', status: 'תקין', range: 'טווח מומלץ 80-120', progress: 86, tone: 'success' as const },
  { label: 'מלח', value: '3200', status: 'גבוה', range: 'טווח מומלץ 2700-3400', progress: 74, tone: 'warning' as const },
];

export const historyItems = [
  { date: 'היום, 18 במאי 09:24', time: 'הבריכה הביתית', poolName: 'הבריכה הביתית', status: 'המים מאוזנים', tone: 'success' as const },
  { date: '16 במאי 18:24', time: 'בריכת גג', poolName: 'בריכת גג', status: 'נדרש תיקון קל', tone: 'warning' as const },
  { date: '13 במאי 09:14', time: 'הבריכה הביתית', poolName: 'הבריכה הביתית', status: 'המים מאוזנים', tone: 'success' as const },
  { date: '11 במאי 17:45', time: 'בריכת גג', poolName: 'בריכת גג', status: 'נדרש תיקון קל', tone: 'warning' as const },
  { date: '7 במאי 09:04', time: 'הבריכה הביתית', poolName: 'הבריכה הביתית', status: 'המים מאוזנים', tone: 'success' as const },
];
