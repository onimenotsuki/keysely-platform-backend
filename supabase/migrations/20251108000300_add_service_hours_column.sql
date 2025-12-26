ALTER TABLE public.spaces
ADD COLUMN IF NOT EXISTS service_hours JSONB;

COMMENT ON COLUMN public.spaces.service_hours IS 'Weekly service hours schedule for the space (per-day time ranges).';
