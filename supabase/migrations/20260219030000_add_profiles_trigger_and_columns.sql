-- Solo añade lo que falta respecto a 20260218165236_create_profile_table.sql:
-- columnas email/full_name/avatar_url, GRANT en profiles, función handle_new_user y trigger.
-- Tabla profiles, RLS y políticas ya existen.

-- Permisos para profiles (USAGE en public ya está en 20260219020044)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated;

-- Columnas opcionales para sincronizar con auth (si no existen)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Función que crea una fila en public.profiles al registrarse un usuario.
-- Respeta first_name/last_name NOT NULL usando meta o valores por defecto.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta jsonb;
  fname text;
  lname text;
  full_str text;
BEGIN
  meta := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  full_str := trim(COALESCE(meta ->> 'full_name', meta ->> 'name', ''));
  fname := trim(COALESCE(meta ->> 'first_name', nullif(split_part(full_str || ' ', ' ', 1), '')));
  lname := trim(COALESCE(meta ->> 'last_name', nullif(trim(substring(full_str from position(' ' in full_str || ' ') + 1)), '')));
  fname := COALESCE(nullif(fname, ''), 'Usuario');
  lname := COALESCE(nullif(lname, ''), '');

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    first_name,
    last_name
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(nullif(full_str, ''), nullif(meta ->> 'full_name', ''), meta ->> 'name'),
    meta ->> 'avatar_url',
    fname,
    lname
  );
  RETURN new;
END;
$$;

-- Trigger: crear perfil al insertar en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
