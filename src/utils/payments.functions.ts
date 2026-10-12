import { createServerFn } from "@tanstack/react-start";
import type { PaddleEnv } from "@/lib/paddle.server";

// Old web offers have not been reconciled with the current plan, disclosures
// and consent flow. Existing signed billing webhooks are left operational.
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async (): Promise<string> => {
    throw new Error("רכישות חדשות באתר אינן זמינות עד השלמת עדכון השירות.");
  });
