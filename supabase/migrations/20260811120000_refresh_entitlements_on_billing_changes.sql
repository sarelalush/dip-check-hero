CREATE OR REPLACE FUNCTION public.refresh_account_entitlements_from_billing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  v_account_id := COALESCE(NEW.account_id, OLD.account_id);

  IF v_account_id IS NOT NULL THEN
    PERFORM public.refresh_usage_period(v_account_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_account_entitlements_from_billing_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_refresh_entitlements_after_subscription_change ON public.subscriptions;
CREATE TRIGGER trg_refresh_entitlements_after_subscription_change
AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.refresh_account_entitlements_from_billing_change();

DROP TRIGGER IF EXISTS trg_refresh_entitlements_after_subscription_addon_change ON public.subscription_addons;
CREATE TRIGGER trg_refresh_entitlements_after_subscription_addon_change
AFTER INSERT OR UPDATE OR DELETE ON public.subscription_addons
FOR EACH ROW
EXECUTE FUNCTION public.refresh_account_entitlements_from_billing_change();
