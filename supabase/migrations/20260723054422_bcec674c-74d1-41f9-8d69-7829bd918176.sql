
REVOKE EXECUTE ON FUNCTION public.choose_comarca(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.choose_comarca(uuid, uuid) TO service_role;
