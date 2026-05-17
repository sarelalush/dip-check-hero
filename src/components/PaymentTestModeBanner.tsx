import { getPaddleEnvironment } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-xs text-orange-800" dir="rtl">
      כל התשלומים בתצוגה המקדימה הם במצב בדיקה (לא נגבה כסף אמיתי).
    </div>
  );
}
