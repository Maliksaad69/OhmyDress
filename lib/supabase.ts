import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  supabaseInstance = createClient(url.trim(), key.trim(), {
    auth: {
      persistSession: false,
    },
  });

  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export interface SavePaymentRecord {
  stripe_session_id: string;
  stripe_payment_intent_id?: string | null;
  order_reference: string;
  tiktok_username?: string | null;
  article_name?: string | null;
  amount: number;
  shipping_cost: number;
  total_amount: number;
  currency?: string;
  payment_status: string;
  session_status?: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  shipping_address?: string | null;
  shipping_address1?: string | null;
  shipping_address2?: string | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
  metadata?: Record<string, unknown>;
  email_alert_sent?: boolean;
}

/**
 * Upsert a payment session into the Supabase 'payments' table.
 */
export async function savePaymentToSupabase(
  data: SavePaymentRecord
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase credentials not configured" };
  }

  try {
    const { error } = await client.from("payments").upsert(
      {
        stripe_session_id: data.stripe_session_id,
        stripe_payment_intent_id: data.stripe_payment_intent_id || null,
        order_reference: data.order_reference,
        tiktok_username: data.tiktok_username || null,
        article_name: data.article_name || null,
        amount: data.amount,
        shipping_cost: data.shipping_cost,
        total_amount: data.total_amount,
        currency: data.currency || "EUR",
        payment_status: data.payment_status,
        session_status: data.session_status || "open",
        customer_name: data.customer_name || null,
        customer_email: data.customer_email || null,
        customer_phone: data.customer_phone || null,
        shipping_address: data.shipping_address || null,
        shipping_address1: data.shipping_address1 || null,
        shipping_address2: data.shipping_address2 || null,
        shipping_city: data.shipping_city || null,
        shipping_postal_code: data.shipping_postal_code || null,
        shipping_country: data.shipping_country || "FR",
        metadata: data.metadata || {},
        email_alert_sent: data.email_alert_sent ?? false,
      },
      { onConflict: "stripe_session_id" }
    );

    if (error) {
      console.warn("Supabase save payment notice:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.warn("Supabase save payment exception:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Update an existing payment status in Supabase.
 */
export async function updateSupabasePaymentStatus(
  stripeSessionId: string,
  updates: {
    payment_status?: string;
    session_status?: string;
    stripe_payment_intent_id?: string;
    email_alert_sent?: boolean;
    email_alert_sent_at?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const { error } = await client
      .from("payments")
      .update(updates)
      .eq("stripe_session_id", stripeSessionId);

    if (error) {
      console.warn("Supabase update payment status notice:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export interface SupabasePaymentRow {
  id: string;
  stripe_session_id: string;
  stripe_payment_intent_id?: string | null;
  order_reference: string;
  tiktok_username?: string | null;
  article_name?: string | null;
  amount: number;
  shipping_cost: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  session_status: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  shipping_address?: string | null;
  metadata?: Record<string, unknown>;
  email_alert_sent?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all payments directly from the Supabase database.
 */
export async function fetchPaymentsFromSupabase(): Promise<{
  success: boolean;
  rows: SupabasePaymentRow[];
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, rows: [], error: "Supabase not configured" };
  }

  try {
    const { data, error } = await client
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return { success: false, rows: [], error: error.message };
    }

    return { success: true, rows: (data as SupabasePaymentRow[]) || [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, rows: [], error: msg };
  }
}

/**
 * Delete a payment from the Supabase database by ID or Stripe session ID.
 */
export async function deletePaymentFromSupabase(
  identifier: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const { error } = await client
      .from("payments")
      .delete()
      .or(`id.eq.${identifier},stripe_session_id.eq.${identifier}`);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

/**
 * Clear all dummy/test payments from the Supabase database.
 */
export async function clearAllPaymentsFromSupabase(): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const { error } = await client
      .from("payments")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
