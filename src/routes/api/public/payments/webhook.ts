import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

function getSupabase() {
  return supabaseAdmin as any;
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData, scheduledChange } = data;

  const userId = customData?.userId;
  if (!userId) {
    console.error("No userId in customData");
    return;
  }

  // A subscription can contain multiple items (base plan + extra pools addon)
  // Persist one row per item so we can track quantity of extras separately.
  for (const item of items) {
    const priceId = item.price?.importMeta?.externalId;
    const productId = item.product?.importMeta?.externalId;
    if (!priceId || !productId) {
      console.warn("Skipping item: missing importMeta.externalId", {
        rawPriceId: item.price?.id,
        rawProductId: item.product?.id,
      });
      continue;
    }

    await getSupabase().from("subscriptions").upsert(
      {
        user_id: userId,
        paddle_subscription_id: `${id}:${productId}`,
        paddle_customer_id: customerId,
        product_id: productId,
        price_id: priceId,
        status: status,
        quantity: item.quantity ?? 1,
        current_period_start: currentBillingPeriod?.startsAt,
        current_period_end: currentBillingPeriod?.endsAt,
        cancel_at_period_end: scheduledChange?.action === "cancel",
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" }
    );
  }
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, items, status, currentBillingPeriod, scheduledChange } = data;

  for (const item of items) {
    const productId = item.product?.importMeta?.externalId;
    const priceId = item.price?.importMeta?.externalId;
    if (!productId || !priceId) continue;

    await getSupabase().from("subscriptions").upsert(
      {
        paddle_subscription_id: `${id}:${productId}`,
        user_id: data.customData?.userId,
        paddle_customer_id: data.customerId,
        product_id: productId,
        price_id: priceId,
        status,
        quantity: item.quantity ?? 1,
        current_period_start: currentBillingPeriod?.startsAt,
        current_period_end: currentBillingPeriod?.endsAt,
        cancel_at_period_end: scheduledChange?.action === "cancel",
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" }
    );
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .like("paddle_subscription_id", `${data.id}:%`)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
