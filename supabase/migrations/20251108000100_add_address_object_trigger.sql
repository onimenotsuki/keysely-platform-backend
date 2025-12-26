ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS address_object JSONB;

COMMENT ON COLUMN public.spaces.address_object IS 'Structured address information for the space (streetAddress, city, state, postalCode, country, coordinates).';

CREATE OR REPLACE FUNCTION public.update_spaces_address_from_object()
RETURNS trigger AS
$$
DECLARE
  street text;
  city text;
  state text;
  country text;
  postal_code text;
BEGIN
  IF NEW.address_object IS NOT NULL THEN
    street := NEW.address_object ->> 'streetAddress';
    city := NEW.address_object ->> 'city';
    state := NEW.address_object ->> 'state';
    country := NEW.address_object ->> 'country';
    postal_code := NEW.address_object ->> 'postalCode';

    NEW.address := trim(both ', ' FROM concat_ws(', ', street, city, state, postal_code, country));
  END IF;

  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_spaces_address_object ON public.spaces;

CREATE TRIGGER trg_spaces_address_object
BEFORE INSERT OR UPDATE OF address_object ON public.spaces
FOR EACH ROW
EXECUTE FUNCTION public.update_spaces_address_from_object();
