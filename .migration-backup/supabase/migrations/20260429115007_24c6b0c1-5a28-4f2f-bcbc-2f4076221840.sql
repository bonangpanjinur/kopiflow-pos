
REVOKE EXECUTE ON FUNCTION public.expire_overdue_plans() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_unverify_domain(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_pending_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_overdue_plans() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_unverify_domain(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_pending_invoices() TO service_role;
