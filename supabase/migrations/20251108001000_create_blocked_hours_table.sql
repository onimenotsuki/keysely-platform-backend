-- Create blocked_hours table to store owner-defined unavailable time ranges per space
CREATE TABLE public.blocked_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blocked_hours_time_range CHECK (end_time > start_time),
  CONSTRAINT blocked_hours_one_hour CHECK (end_time = (start_time + interval '1 hour')),
  CONSTRAINT blocked_hours_unique_slot UNIQUE (space_id, blocked_date, start_time, end_time)
);

-- Index to speed up lookups by space and date
CREATE INDEX blocked_hours_space_date_idx ON public.blocked_hours (space_id, blocked_date);

-- Enable Row Level Security
ALTER TABLE public.blocked_hours ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read blocked hours for availability checks
CREATE POLICY "Anyone can view blocked hours"
ON public.blocked_hours
FOR SELECT
USING (true);

-- Allow space owners to insert blocked hours for their spaces
CREATE POLICY "Owners can create blocked hours"
ON public.blocked_hours
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.spaces
    WHERE spaces.id = blocked_hours.space_id
      AND spaces.owner_id = auth.uid()
  )
);

-- Allow space owners to update their blocked hours
CREATE POLICY "Owners can update blocked hours"
ON public.blocked_hours
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.spaces
    WHERE spaces.id = blocked_hours.space_id
      AND spaces.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.spaces
    WHERE spaces.id = blocked_hours.space_id
      AND spaces.owner_id = auth.uid()
  )
);

-- Allow space owners to delete their blocked hours
CREATE POLICY "Owners can delete blocked hours"
ON public.blocked_hours
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.spaces
    WHERE spaces.id = blocked_hours.space_id
      AND spaces.owner_id = auth.uid()
  )
);

-- Reuse trigger to keep updated_at in sync
CREATE TRIGGER update_blocked_hours_updated_at
  BEFORE UPDATE ON public.blocked_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

