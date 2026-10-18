import { Suspense } from "react";
import { connection } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { getEmailJsConfig } from "@/lib/emailjs";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import {
  isSupabaseConfigured,
  fetchPaymentsFromSupabase,
  type SupabasePaymentRow,
} from "@/lib/supabase";
import AdminLogin from "./admin-login";
import AdminDashboard from "./admin-dashboard";
import type { FormattedPayment, PaymentStats } from "@/app/api/admin/payments/route";

export const metadata = {
  title: "Administration & Encaissements | Oh My Dress Showroom",
  description: "Tableau de bord de suivi des paiements en direct et alertes de vente",
};

function formatEuros(amount: number): string {
  return (
    amount.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col justify-center items-center px-4">
      <div className="bg-white/95 rounded-3xl p-10 shadow-luxury border border-brand-border text-center max-w-sm w-full">
        <div className="animate-spin w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full mx-auto mb-4" />
        <p className="font-serif text-lg text-brand-charcoal">Chargement de l&apos;administration...</p>
        <p className="text-xs text-brand-muted mt-1">Accès sécurisé en cours</p>
      </div>
    </div>
  );
}

async function AdminContent() {
  await connection();
  const isAuth = await verifyAdminSession();

  if (!isAuth) {
    return <AdminLogin />;
  }

  let payments: FormattedPayment[] = [];
  let stats: PaymentStats = {
    totalRevenue: 0,
    formattedTotalRevenue: "0,00 €",
    totalPaid: 0,
    totalSessions: 0,
    averageBasket: 0,
    formattedAverageBasket: "0,00 €",
    pendingCount: 0,
    todayRevenue: 0,
    formattedTodayRevenue: "0,00 €",
    todayOrders: 0,
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayTimestamp = Math.floor(startOfToday.getTime() / 1000);

  let totalRevenueCents = 0;
  let totalPaid = 0;
  let pendingCount = 0;
  let todayRevenueCents = 0;
  let todayOrders = 0;
  let totalSessionsCount = 0;

  try {
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

    stats = {
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
  } catch (error) {
    console.error("Erreur serveur lors de la récupération des données:", error);
  }

  const emailJsRaw = getEmailJsConfig();
  const emailJsInfo = {
    isConfigured: emailJsRaw.isConfigured,
    hasServiceId: Boolean(emailJsRaw.serviceId),
    hasTemplateId: Boolean(emailJsRaw.templateId),
    hasPublicKey: Boolean(emailJsRaw.publicKey),
    hasPrivateKey: Boolean(emailJsRaw.privateKey),
    adminEmail: emailJsRaw.adminEmail || null,
  };

  return (
    <AdminDashboard
      initialPayments={payments}
      initialStats={stats}
      initialEmailJs={emailJsInfo}
      supabaseConfigured={isSupabaseConfigured()}
    />
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminContent />
    </Suspense>
  );
}
