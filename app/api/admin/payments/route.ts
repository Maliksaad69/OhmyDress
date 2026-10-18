import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import {
  isSupabaseConfigured,
  fetchPaymentsFromSupabase,
  deletePaymentFromSupabase,
  clearAllPaymentsFromSupabase,
  type SupabasePaymentRow,
} from "@/lib/supabase";
import type Stripe from "stripe";

export interface FormattedPayment {
  id: string;
  created: number;
  formattedDate: string;
  amountTotal: number;
  formattedAmount: string;
  currency: string;
  status: Stripe.Checkout.Session.Status | null;
  paymentStatus: Stripe.Checkout.Session.PaymentStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  tiktokUsername: string;
  orderReference: string;
  articleName: string;
  shippingAddress: string;
  shippingCost: number;
  customAmount: number;
  paymentIntentId: string | null;
  livemode: boolean;
  stripeDashboardUrl: string;
}

export interface PaymentStats {
  totalRevenue: number;
  formattedTotalRevenue: string;
  totalPaid: number;
  totalSessions: number;
  averageBasket: number;
  formattedAverageBasket: string;
  pendingCount: number;
  todayRevenue: number;
  formattedTodayRevenue: string;
  todayOrders: number;
}

function formatEuros(amount: number): string {
  return (
    amount.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

export async function GET(request: NextRequest) {
  void request.url;
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json(
      { error: "Accès refusé. Veuillez vous connecter à l'espace administrateur." },
      { status: 401 }
    );
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayTimestamp = Math.floor(startOfToday.getTime() / 1000);

  let totalRevenueCents = 0;
  let totalPaid = 0;
  let pendingCount = 0;
  let todayRevenueCents = 0;
  let todayOrders = 0;
  let payments: FormattedPayment[] = [];
  let totalSessionsCount = 0;

  try {
    // If Supabase is connected, it is our primary source of truth
    if (isSupabaseConfigured()) {
      const supabaseRes = await fetchPaymentsFromSupabase();

      if (supabaseRes.success) {
        totalSessionsCount = supabaseRes.rows.length;
        payments = supabaseRes.rows.map((r: SupabasePaymentRow) => {
          const isPaid = r.payment_status === "paid";
          const amountTotalEur = Number(r.total_amount) || 0;
          const amountTotalCents = Math.round(amountTotalEur * 100);

          if (isPaid) {
            totalRevenueCents += amountTotalCents;
            totalPaid += 1;

            const rowDate = new Date(r.created_at);
            if (Math.floor(rowDate.getTime() / 1000) >= startOfTodayTimestamp) {
              todayRevenueCents += amountTotalCents;
              todayOrders += 1;
            }
          } else if (r.session_status === "open") {
            pendingCount += 1;
          }

          const dateObj = new Date(r.created_at);
          const formattedDate = dateObj.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          const stripeDashboardUrl = r.stripe_payment_intent_id
            ? `https://dashboard.stripe.com/payments/${r.stripe_payment_intent_id}`
            : `https://dashboard.stripe.com/checkout/sessions/${r.stripe_session_id}`;

          return {
            id: r.id,
            created: Math.floor(dateObj.getTime() / 1000),
            formattedDate,
            amountTotal: amountTotalEur,
            formattedAmount: formatEuros(amountTotalEur),
            currency: r.currency || "EUR",
            status: r.session_status as Stripe.Checkout.Session.Status,
            paymentStatus: r.payment_status as Stripe.Checkout.Session.PaymentStatus,
            customerName: r.customer_name || "Client",
            customerEmail: r.customer_email || "Non renseigné",
            customerPhone: r.customer_phone || "Non renseigné",
            tiktokUsername: r.tiktok_username
              ? `@${r.tiktok_username.replace(/^@/, "")}`
              : "—",
            orderReference: r.order_reference || "—",
            articleName: r.article_name || "Commande Showroom",
            shippingAddress: r.shipping_address || "Adresse non renseignée",
            shippingCost: Number(r.shipping_cost || 5),
            customAmount: Number(r.amount || 0),
            paymentIntentId: r.stripe_payment_intent_id || null,
            livemode: true,
            stripeDashboardUrl,
          };
        });
      }
    } else {
      // Fallback to Stripe if Supabase is not configured
      const stripeResponse = await stripe.checkout.sessions.list({
        limit: 100,
      });

      const sessions = stripeResponse.data;
      totalSessionsCount = sessions.length;

      payments = sessions.map((s) => {
        const isPaid = s.payment_status === "paid";
        const amountTotalCents = s.amount_total || 0;
        const amountTotalEur = amountTotalCents / 100;

        if (isPaid) {
          totalRevenueCents += amountTotalCents;
          totalPaid += 1;

          if (s.created >= startOfTodayTimestamp) {
            todayRevenueCents += amountTotalCents;
            todayOrders += 1;
          }
        } else if (s.status === "open") {
          pendingCount += 1;
        }

        const meta = s.metadata || {};
        const customerDetails = s.customer_details;

        const dateObj = new Date(s.created * 1000);
        const formattedDate = dateObj.toLocaleString("fr-FR", {
          timeZone: "Europe/Paris",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const paymentIntentId =
          typeof s.payment_intent === "string"
            ? s.payment_intent
            : s.payment_intent?.id || null;

        let addressStr = meta.shipping_address || "";
        if (!addressStr && customerDetails?.address) {
          const a = customerDetails.address;
          addressStr = [a.line1, a.line2, a.postal_code, a.city, a.country]
            .filter(Boolean)
            .join(", ");
        }

        const customAmount = meta.custom_amount ? parseFloat(meta.custom_amount) : amountTotalEur;
        const shippingCost = meta.shipping_cost ? parseFloat(meta.shipping_cost) : 5.0;

        const stripePrefix = s.livemode ? "" : "test/";
        const stripeDashboardUrl = paymentIntentId
          ? `https://dashboard.stripe.com/${stripePrefix}payments/${paymentIntentId}`
          : `https://dashboard.stripe.com/${stripePrefix}checkout/sessions/${s.id}`;

        return {
          id: s.id,
          created: s.created,
          formattedDate,
          amountTotal: amountTotalEur,
          formattedAmount: formatEuros(amountTotalEur),
          currency: s.currency ? s.currency.toUpperCase() : "EUR",
          status: s.status,
          paymentStatus: s.payment_status,
          customerName:
            meta.customer_name ||
            customerDetails?.name ||
            "Client",
          customerEmail:
            meta.customer_email ||
            customerDetails?.email ||
            s.customer_email ||
            "Non renseigné",
          customerPhone:
            meta.customer_phone ||
            customerDetails?.phone ||
            "Non renseigné",
          tiktokUsername: meta.tiktok_username
            ? `@${meta.tiktok_username.replace(/^@/, "")}`
            : "—",
          orderReference: meta.order_reference || "—",
          articleName: meta.article_name || "Commande Showroom",
          shippingAddress: addressStr || "Adresse non renseignée",
          shippingCost,
          customAmount,
          paymentIntentId,
          livemode: s.livemode,
          stripeDashboardUrl,
        };
      });
    }

    const totalRevenueEur = totalRevenueCents / 100;
    const averageBasketEur = totalPaid > 0 ? totalRevenueEur / totalPaid : 0;
    const todayRevenueEur = todayRevenueCents / 100;

    const stats: PaymentStats = {
      totalRevenue: totalRevenueEur,
      formattedTotalRevenue: formatEuros(totalRevenueEur),
      totalPaid,
      totalSessions: totalSessionsCount,
      averageBasket: averageBasketEur,
      formattedAverageBasket: formatEuros(averageBasketEur),
      pendingCount,
      todayRevenue: todayRevenueEur,
      formattedTodayRevenue: formatEuros(todayRevenueEur),
      todayOrders,
    };

    return NextResponse.json({
      success: true,
      stats,
      payments,
      dataSource: isSupabaseConfigured() ? "supabase" : "stripe",
    });
  } catch (error: unknown) {
    console.error("Erreur lors de la récupération des paiements:", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les paiements." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json(
      { error: "Accès refusé. Veuillez vous connecter." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const action = searchParams.get("action");

  try {
    if (action === "clear_all") {
      const res = await clearAllPaymentsFromSupabase();
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: "Tous les paiements ont été supprimés." });
    }

    if (!id) {
      return NextResponse.json(
        { error: "Identifiant du paiement manquant." },
        { status: 400 }
      );
    }

    const res = await deletePaymentFromSupabase(id);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Paiement supprimé avec succès." });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur de suppression" },
      { status: 500 }
    );
  }
}
