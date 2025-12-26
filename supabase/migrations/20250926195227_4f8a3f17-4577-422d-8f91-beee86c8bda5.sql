-- Create table for Stripe Connect accounts
CREATE TABLE public.stripe_connect_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE,
  account_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  onboarding_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on stripe_connect_accounts
ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for stripe_connect_accounts
CREATE POLICY "Users can view their own connect account" 
ON public.stripe_connect_accounts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own connect account" 
ON public.stripe_connect_accounts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connect account" 
ON public.stripe_connect_accounts 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Update bookings table to include Stripe payment info
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Add trigger for updated_at on stripe_connect_accounts
CREATE TRIGGER update_stripe_connect_accounts_updated_at
BEFORE UPDATE ON public.stripe_connect_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();