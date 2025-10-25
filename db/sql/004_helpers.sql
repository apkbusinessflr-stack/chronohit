-- db/sql/004_helpers.sql
-- Helper function for idempotent crediting

-- Ensure wallets table exists (adjust if you already created it)
CREATE TABLE IF NOT EXISTS wallets (
  user_id uuid PRIMARY KEY,
  credits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure purchases table exists (adjust if you already created it)
CREATE TABLE IF NOT EXISTS purchases (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  stripe_event_id text UNIQUE,
  stripe_session_id text,
  amount_cents integer,
  currency text,
  credits integer,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Function: credit_if_new(event_id, user_id, credits, session_id, amount_cents, currency, status)
CREATE OR REPLACE FUNCTION credit_if_new(
  p_event_id text,
  p_user_id uuid,
  p_credits integer,
  p_session_id text,
  p_amount_cents integer,
  p_currency text,
  p_status text
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  inserted boolean := false;
BEGIN
  -- Record purchase if not seen before
  INSERT INTO purchases (user_id, stripe_event_id, stripe_session_id, amount_cents, currency, credits, status)
  VALUES (p_user_id, p_event_id, p_session_id, p_amount_cents, p_currency, p_credits, p_status)
  ON CONFLICT (stripe_event_id) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT = 1;

  IF inserted THEN
    -- Upsert wallet & add credits
    INSERT INTO wallets (user_id, credits)
    VALUES (p_user_id, GREATEST(p_credits,0))
    ON CONFLICT (user_id) DO UPDATE
      SET credits = wallets.credits + GREATEST(p_credits,0),
          updated_at = now();
  END IF;

  RETURN inserted;
END;
$$;
