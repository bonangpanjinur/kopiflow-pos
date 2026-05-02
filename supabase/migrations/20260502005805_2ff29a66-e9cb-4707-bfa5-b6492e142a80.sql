REVOKE EXECUTE ON FUNCTION public.user_belongs_to_shop(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_shop(uuid, uuid) TO authenticated;