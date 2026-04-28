REVOKE EXECUTE ON FUNCTION public.has_outlet_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_outlet_access(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.next_order_no(uuid) FROM anon;