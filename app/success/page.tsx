import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { stripe } from "@/lib/stripe";
import { sendPaymentAlert } from "@/lib/emailjs";
import { syncStripeSessionToSupabase, updateSupabasePaymentStatus } from "@/lib/supabase";
import AnnouncementBar from "@/app/components/announcement-bar";
import SiteHeader from "@/app/components/site-header";
import SiteFooter from "@/app/components/site-footer";

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

function formatPrice(cents: number) {
  return (
    (cents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

async function SuccessContent({ searchParams }: SuccessPageProps) {
  await connection();
  const { session_id } = await searchParams;

  let session = null;
  if (session_id) {
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);

      // Trigger EmailJS confirmation alert and update Supabase if paid
      if (session && session.payment_status === "paid") {
        // 1. Sync full session data to Supabase (upsert ensures row exists)
        try {
          await syncStripeSessionToSupabase(session);
        } catch (dbErr) {
          console.warn("Notice Supabase sync in success page:", dbErr);
        }

        // 2. Await sending confirmation email to customer (and alert to admin)
        try {
          const emailRes = await sendPaymentAlert(session);
          if (emailRes.success && !emailRes.skipped) {
            console.log("Confirmation email sent successfully:", session.id);
          }
        } catch (err) {
          console.error("Erreur lors de l'envoi de l'alerte EmailJS:", err);
        }

        // 3. Mark payment status as paid in Supabase
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        try {
          await updateSupabasePaymentStatus(session.id, {
            payment_status: "paid",
            session_status: session.status || "complete",
            stripe_payment_intent_id: paymentIntentId,
            email_alert_sent: true,
            email_alert_sent_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn("Notice Supabase status update in success page:", dbErr);
        }
      }
    } catch (err) {
      console.error("Erreur lors de la récupération de la session Stripe:", err);
    }
  }

  const amountTotal = session?.amount_total ? formatPrice(session.amount_total) : null;
  const orderRef = session?.metadata?.order_reference || null;
  const tiktokUser = session?.metadata?.tiktok_username || null;
  const customerEmail = session?.customer_details?.email || session?.customer_email || null;

  return (
    <main className="flex-grow py-12 md:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/95 rounded-3xl p-8 sm:p-12 shadow-luxury-lg border border-brand-border/80 backdrop-blur-md text-center">
          {/* Success icon */}
          <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-6 shadow-sm">
            <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <p className="text-xs uppercase tracking-[0.3em] font-semibold text-brand-gold">
            Paiement Confirmé
          </p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl md:text-5xl font-medium text-brand-charcoal">
            Merci pour votre commande
          </h1>
          <p className="mt-3 text-sm sm:text-base text-brand-muted max-w-lg mx-auto leading-relaxed">
            Votre règlement a bien été reçu et sécurisé via Stripe. Le showroom Oh My Dress prépare votre colis avec le plus grand soin.
          </p>

          {/* Order details summary card */}
          <div className="mt-8 bg-brand-cream/60 rounded-2xl p-6 border border-brand-border/60 text-left space-y-3.5 text-xs sm:text-sm">
            {amountTotal && (
              <div className="flex items-center justify-between pb-3 border-b border-brand-border/60">
                <span className="text-brand-muted">Montant total réglé</span>
                <span className="font-serif font-bold text-lg text-brand-charcoal">
                  {amountTotal}
                </span>
              </div>
            )}
            {orderRef && (
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Référence de commande</span>
                <span className="font-mono font-medium text-brand-charcoal bg-brand-alabaster px-2.5 py-1 rounded border border-brand-border">
                  {orderRef}
                </span>
              </div>
            )}
            {tiktokUser && (
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Compte TikTok associé</span>
                <span className="font-medium text-brand-charcoal">
                  @{tiktokUser.replace(/^@/, "")}
                </span>
              </div>
            )}
            {customerEmail && (
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Confirmation envoyée à</span>
                <span className="font-medium text-brand-charcoal">
                  {customerEmail}
                </span>
              </div>
            )}
            {session?.id && (
              <div className="flex items-center justify-between pt-2 border-t border-brand-border/40 text-[11px] text-brand-muted">
                <span>Règlement Stripe</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Paiement sécurisé validé
                </span>
              </div>
            )}
          </div>

          {/* Next steps note */}
          <div className="mt-6 p-4 rounded-xl bg-[#FAF3E9] border border-[#E9D9C3] flex items-center gap-3 text-left">
            <span className="text-xl shrink-0">📦</span>
            <p className="text-xs text-[#7D5E37] leading-relaxed">
              <strong className="font-semibold text-brand-charcoal">Expédition rapide :</strong> Votre numéro de suivi Mondial Relay vous sera envoyé par email dès l&apos;envoi de votre commande.
            </p>
          </div>

          {/* Back action button */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="w-full sm:w-auto bg-brand-charcoal hover:bg-brand-gold text-white font-medium text-xs sm:text-sm tracking-widest uppercase py-3.5 px-8 rounded-xl shadow-md transition-all duration-300"
            >
              Retourner à la boutique
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function SuccessLoading() {
  return (
    <main className="flex-grow py-16 px-4 text-center">
      <div className="max-w-md mx-auto bg-white/90 rounded-3xl p-12 shadow-luxury border border-brand-border/70">
        <div className="animate-spin w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full mx-auto mb-4" />
        <p className="font-serif text-lg text-brand-charcoal">Chargement de votre confirmation...</p>
      </div>
    </main>
  );
}

export default function SuccessPage(props: SuccessPageProps) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <Suspense fallback={<SuccessLoading />}>
        <SuccessContent searchParams={props.searchParams} />
      </Suspense>
      <SiteFooter />
    </>
  );
}
