REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_shop_plan(uuid, text, timestamptz) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_suspend_shop(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_unsuspend_shop(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_shop_detail(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_shop_plan(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_shop(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend_shop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_shop_detail(uuid) TO authenticated;