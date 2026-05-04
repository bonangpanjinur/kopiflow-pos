-- =========================================================
-- G3 — Security hardening: revoke PUBLIC EXECUTE on
-- functions that should only run from authenticated context
-- or from internal cron paths.
-- =========================================================

-- Authenticated-only RPCs (called from logged-in app UI).
-- has_role / has_outlet_access internal checks still gate per-shop access,
-- so revoking anon avoids reconnaissance against unauthenticated callers.
REVOKE EXECUTE ON FUNCTION public.accept_staff_invitation(text)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.open_shift(uuid, numeric)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_shift(uuid, numeric, text)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_order(uuid, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.void_order(uuid, text)               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_plan_invoice(uuid)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_plan_invoice(uuid, text)      FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_shift(uuid, numeric)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_shift(uuid, numeric, text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_order(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_order(uuid, text)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_plan_invoice(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_plan_invoice(uuid, text)       TO authenticated;

-- Internal/cron-only — called by service role from /api/public/cron/* with CRON_SECRET.
-- These do not need anon or authenticated grants.
REVOKE EXECUTE ON FUNCTION public.expire_overdue_plans()               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_stale_pending_invoices()      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_owner_reminders()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_unverify_domain(uuid, text)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_custom_domain_verified(uuid, boolean) FROM PUBLIC;

-- Public storefront helpers — keep callable without login (storefront uses anon).
-- get_billing_settings_public(): used by /s/{slug}/pay to show bank/QRIS info.
-- get_order_tracking(): used by /track/{orderId} for guest tracking.
-- validate_promo(): used by storefront cart.
-- These already filter inside the function body.

-- Already restricted in G1 by being called via service role and not granted to anon:
-- admin_dashboard_stats, admin_shop_detail, admin_set_shop_plan,
-- admin_suspend_shop, admin_unsuspend_shop — leave as-is.

-- Trigger-only / called by RLS policies (must stay PUBLIC):
--   has_role, has_shop_role, has_outlet_access, next_order_no,
--   apply_stock_movement, consume_stock_for_order_item,
--   handle_new_user, handle_new_customer_signup,
--   apply_loyalty_post_order, increment_promo_usage, log_system_event
-- These are linter false positives and intentionally remain callable.
