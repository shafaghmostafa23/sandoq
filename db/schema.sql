CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  national_id text NOT NULL DEFAULT '',
  member_no text NOT NULL UNIQUE,
  bale_user_id text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  joined_label text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_no integer NOT NULL UNIQUE,
  name text NOT NULL,
  bank_name text NOT NULL DEFAULT '',
  bank_account text NOT NULL DEFAULT '',
  iban text NOT NULL DEFAULT '',
  account_holder text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))
);

-- Many-to-many by design: one member can be assigned to multiple offices.
CREATE TABLE IF NOT EXISTS member_offices (
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, office_id)
);

CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_no integer NOT NULL UNIQUE,
  member_id uuid NOT NULL REFERENCES members(id),
  office_id uuid NOT NULL REFERENCES offices(id),
  principal_toman bigint NOT NULL CHECK (principal_toman > 0),
  installment_toman bigint NOT NULL CHECK (installment_toman > 0),
  monthly_saving_toman bigint NOT NULL DEFAULT 0 CHECK (monthly_saving_toman >= 0),
  installment_count integer NOT NULL CHECK (installment_count > 0),
  due_day smallint NOT NULL DEFAULT 5 CHECK (due_day BETWEEN 1 AND 31),
  start_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','settled','archived'))
);

CREATE TABLE IF NOT EXISTS installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_no integer NOT NULL,
  due_label text NOT NULL,
  due_sort integer NOT NULL,
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','due','paid','pending_review','rejected')),
  paid_at timestamptz,
  UNIQUE (loan_id, installment_no)
);
CREATE INDEX IF NOT EXISTS installments_due_sort_idx ON installments (due_sort, status);

CREATE TABLE IF NOT EXISTS manual_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id),
  installment_id uuid NOT NULL REFERENCES installments(id),
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  tracking_code text,
  reference_code text UNIQUE,
  receipt_name text,
  receipt_key text,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text
);
CREATE INDEX IF NOT EXISTS manual_payments_review_idx ON manual_payments (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS manual_payments_tracking_idx ON manual_payments (tracking_code) WHERE tracking_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS manual_payments_one_pending_per_installment_idx ON manual_payments (installment_id) WHERE status = 'pending_review';
CREATE UNIQUE INDEX IF NOT EXISTS manual_payments_approved_tracking_idx ON manual_payments (tracking_code) WHERE status = 'approved' AND tracking_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS native_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id),
  bale_user_id text NOT NULL,
  installment_id uuid NOT NULL REFERENCES installments(id),
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  payload text NOT NULL UNIQUE,
  invoice_link text,
  transaction_id text UNIQUE,
  provider_charge_id text UNIQUE,
  notification_claimed_at timestamptz,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','pending','paid','failed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS native_payments_one_open_per_installment_idx ON native_payments (installment_id) WHERE status IN ('created','pending');
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS reference_code text UNIQUE;
ALTER TABLE native_payments ADD COLUMN IF NOT EXISTS notification_claimed_at timestamptz;
ALTER TABLE native_payments ADD COLUMN IF NOT EXISTS transaction_id text UNIQUE;

CREATE TABLE IF NOT EXISTS bale_updates (
  update_id bigint PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES offices(id),
  transaction_date date,
  amount_toman bigint NOT NULL,
  tracking_code text,
  description text NOT NULL DEFAULT '',
  matched_manual_payment_id uuid REFERENCES manual_payments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
