import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "רכישות — AquaSense" }] }),
  component: PricingScreen,
});
function PricingScreen() {
  return (
    <main dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 py-8 text-right">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>
        <h1 className="mt-6 text-2xl font-bold">עדכון השירות</h1>
        <p className="mt-4 leading-relaxed">רכישות וניתוחים חדשים באתר אינם זמינים עד השלמת תנאי השירות, הפרטיות והחיבור למסלול ההסכמה החדש.</p>
        <p className="mt-4 leading-relaxed text-muted-foreground">השירות מציג הערכת מדדים מצילום, ללא מינון חומרים וללא אישור לרחצה. אפשר לצפות בתוצאות קיימות.</p>
        <p className="mt-4 leading-relaxed text-muted-foreground">מנוי קיים אינו מתבטל בעקבות חסימת רכישות או מחיקת חשבון. לניהול חיובים או בירור זכויות פנה לתמיכה ולספק שבו רכשת.</p>
        <a className="mt-6 block font-semibold text-primary" href="mailto:razoakii17@gmail.com">תמיכה בנושא מנוי</a>
      </div>
    </main>
  );
}
