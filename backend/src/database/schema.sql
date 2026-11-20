-- Lumen Quest schema (PostgreSQL / Neon)

CREATE TABLE IF NOT EXISTS users (
  user_id       SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'user'   CHECK (role IN ('user', 'admin')),
  status        VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS plans (
  plan_id              SERIAL PRIMARY KEY,
  plan_name            VARCHAR(50)   NOT NULL,
  price                NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  quota_sessions       INT           NOT NULL CHECK (quota_sessions >= 0),
  validity_days        INT           NOT NULL DEFAULT 30,
  auto_renewal_allowed VARCHAR(3)    NOT NULL DEFAULT 'Yes' CHECK (auto_renewal_allowed IN ('Yes', 'No')),
  description          TEXT,
  status               VARCHAR(10)   NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  sub_id            SERIAL PRIMARY KEY,
  user_id           INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  plan_id           INT NOT NULL REFERENCES plans(plan_id) ON DELETE RESTRICT,
  type              VARCHAR(10) NOT NULL DEFAULT 'monthly',
  status            VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'cancelled')),
  start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date          DATE,
  last_billed_date  DATE,
  last_renewed_date DATE,
  terminated_date   DATE,
  grace_time        INT NOT NULL DEFAULT 5,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_plan_idx ON subscriptions (plan_id);

CREATE TABLE IF NOT EXISTS billing (
  billing_id       SERIAL PRIMARY KEY,
  sub_id           INT NOT NULL REFERENCES subscriptions(sub_id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL,
  discount_applied NUMERIC(5,2)  NOT NULL DEFAULT 0,
  billing_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_status   VARCHAR(10) NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'failed')),
  payment_method   VARCHAR(20) NOT NULL DEFAULT 'credit_card',
  transaction_id   VARCHAR(100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_sub_idx ON billing (sub_id);
CREATE INDEX IF NOT EXISTS billing_date_idx ON billing (billing_date);
