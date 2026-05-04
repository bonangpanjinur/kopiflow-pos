-- Supabase pre-grants EXECUTE to anon + authenticated separately from PUBLIC.
-- Need explicit REVOKE FROM anon for the hardening to take effect.
REVOKE EXECUTE ON FUNCTION public.accept_staff_invitation(text)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.open_shift(uuid, numeric)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_shift(uuid, numeric, text)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_order(uuid, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.void_order(uuid, text)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_plan_invoice(uuid)           FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_plan_invoice(uuid, text)      FROM anon;

-- Cron / internal — also revoke from authenticated; only service_role calls them.
REVOKE EXECUTE ON FUNCTION public.expire_overdue_plans()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_pending_invoices()      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_owner_reminders()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_unverify_domain(uuid, text)     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_custom_domain_verified(uuid, boolean) FROM anon, authenticated;
