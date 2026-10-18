-- ==============================================================================
-- OH MY DRESS SHOWROOM — SUPABASE DATABASE SCHEMA
-- Table des Paiements et Commandes TikTok Live
-- ==============================================================================

-- 1. Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Création de la table 'payments'
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifiants Stripe
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_payment_intent_id TEXT,
    
    -- Détails de la commande
    order_reference TEXT NOT NULL,
    tiktok_username TEXT,
    article_name TEXT,
    
    -- Montants financiers (en Euros)
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    
    -- Statuts
    payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid', -- 'paid', 'unpaid', 'failed', 'refunded'
    session_status VARCHAR(50) NOT NULL DEFAULT 'open',   -- 'open', 'complete', 'expired'
    
    -- Informations Client
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    
    -- Livraison Mondial Relay
    shipping_address TEXT,
    shipping_address1 TEXT,
    shipping_address2 TEXT,
    shipping_city TEXT,
    shipping_postal_code TEXT,
    shipping_country VARCHAR(10) DEFAULT 'FR',
    
    -- Données additionnelles et métadonnées
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Suivi de l'alerte EmailJS
    email_alert_sent BOOLEAN DEFAULT FALSE,
    email_alert_sent_at TIMESTAMPTZ,
    
    -- Horodatages
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEX POUR PERFORMANCES OPTIMALES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session_id ON public.payments (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_intent ON public.payments (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_ref ON public.payments (order_reference);
CREATE INDEX IF NOT EXISTS idx_payments_tiktok ON public.payments (tiktok_username);
CREATE INDEX IF NOT EXISTS idx_payments_email ON public.payments (customer_email);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments (created_at DESC);

-- ==============================================================================
-- TRIGGER AUTOMATIQUE POUR LE CHAMP 'updated_at'
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_payments_updated_at ON public.payments;
CREATE TRIGGER trigger_set_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- PERMISSIONS & DROITS D'ACCÈS (POUR CLÉ PUBLIQUE & SERVICE)
-- ==============================================================================
GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- ==============================================================================
-- SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on payments" ON public.payments;
CREATE POLICY "Allow all operations on payments"
ON public.payments
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- VUE RÉCAPITULATIVE DES VENTES (ANALYTICS)
-- ==============================================================================
CREATE OR REPLACE VIEW public.payments_stats AS
SELECT
    COUNT(*) FILTER (WHERE payment_status = 'paid') AS total_paid_orders,
    COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) AS total_revenue,
    COALESCE(AVG(total_amount) FILTER (WHERE payment_status = 'paid'), 0) AS average_order_value,
    COUNT(*) FILTER (WHERE payment_status = 'unpaid' AND session_status = 'open') AS pending_orders,
    COUNT(*) FILTER (WHERE payment_status = 'paid' AND created_at >= CURRENT_DATE) AS today_paid_orders,
    COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid' AND created_at >= CURRENT_DATE), 0) AS today_revenue
FROM public.payments;

GRANT SELECT ON public.payments_stats TO anon, authenticated, service_role;
