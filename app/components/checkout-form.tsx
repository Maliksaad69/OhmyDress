"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const SHIPPING_COST = 5.0;

function formatPrice(value: number) {
  return (
    value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function CheckoutFormContent() {
  const searchParams = useSearchParams();
  const wasCanceled = searchParams.get("canceled") === "true";

  // Form State
  const [amount, setAmount] = useState("");
  const [orderReference, setOrderReference] = useState("OMD-LIVE-4982");
  const [articleName, setArticleName] = useState("");
  const [tiktokUsername, setTiktokUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("FR");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(true);

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCanceledAlert, setShowCanceledAlert] = useState(wasCanceled);

  // Calculations
  const cleanAmountString = amount.trim().replace(",", ".");
  const parsedAmount = parseFloat(cleanAmountString);
  const subtotal = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const total = subtotal > 0 ? subtotal + SHIPPING_COST : 0;
  const vat = total > 0 ? (total * 0.2) / 1.2 : 0;

  const quickAmounts = [25, 35, 50, 75, 100, 150];

  const handlePay = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (subtotal <= 0) {
      setErrorMessage("Veuillez saisir le montant convenu pour votre achat (supérieur à 0 €).");
      const montantInput = document.getElementById("montant-field");
      montantInput?.scrollIntoView({ behavior: "smooth", block: "center" });
      montantInput?.focus();
      return;
    }

    if (subtotal < 0.5) {
      setErrorMessage("Le montant minimum pour un règlement Stripe est de 0,50 €.");
      return;
    }

    if (!termsAccepted) {
      setErrorMessage("Veuillez accepter les conditions générales de vente pour continuer.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: subtotal,
          shippingCost: SHIPPING_COST,
          orderReference,
          articleName,
          tiktokUsername,
          email,
          customer: {
            firstName,
            lastName,
            country,
            address1,
            address2,
            zip,
            city,
            phone,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible d'initialiser le paiement.");
      }

      if (data.url) {
        // Redirect to Stripe Checkout page
        window.location.href = data.url;
      } else {
        throw new Error("L'URL de paiement Stripe n'a pas été renvoyée.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur inattendue est survenue. Veuillez vérifier votre connexion et réessayer.";
      console.error("Erreur de paiement:", err);
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-grow py-8 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Canceled Banner Notification */}
        {showCanceledAlert && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-xs sm:text-sm">Session de paiement annulée</p>
                <p className="text-xs text-amber-800">
                  Votre paiement n&apos;a pas été débité. Vos informations sont conservées ci-dessous pour que vous puissiez réessayer.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCanceledAlert(false)}
              className="text-amber-700 hover:text-amber-950 text-xs font-semibold px-2 py-1 uppercase tracking-wider"
              type="button"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-sm animate-fade-in">
            <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-xs sm:text-sm">Attention</p>
              <p className="text-xs text-red-700 mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 text-xs font-bold"
              type="button"
            >
              ✕
            </button>
          </div>
        )}

        {/* Bannière Hero Showroom */}
        <div className="mb-8 relative overflow-hidden rounded-2xl border border-brand-border/60 shadow-luxury-lg">
          <div className="relative w-full h-[340px] sm:h-[440px] md:h-[520px] lg:h-[580px] overflow-hidden">
            <Image
              alt="Oh My Dress Showroom"
              className="object-cover object-center"
              src="/brand/showroom.jpg"
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1280px"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#faf7f2]/85 from-5% via-[#faf7f2]/20 via-45% to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#faf7f2]/60 via-transparent to-transparent"></div>
            <div className="absolute top-5 right-5 flex items-center gap-2 text-xs text-brand-charcoal bg-white/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/70 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium tracking-wide">Paiement Direct TikTok</span>
            </div>
            <div className="absolute bottom-0 left-0 p-8 sm:p-12 max-w-xl">
              <p className="text-[11px] tracking-[0.35em] uppercase text-brand-gold font-semibold">
                Showroom privé
              </p>
              <h1 className="mt-3 font-serif text-4xl sm:text-5xl md:text-6xl font-medium text-brand-charcoal leading-[1.05] drop-shadow-[0_1px_14px_rgba(250,247,242,0.95)]">
                Réglez votre commande
              </h1>
              <p className="mt-3 text-sm sm:text-base text-brand-muted drop-shadow-[0_1px_10px_rgba(250,247,242,0.95)]">
                Indiquez le montant convenu avec le vendeur et procédez au paiement sécurisé via Stripe.
              </p>
            </div>
          </div>
        </div>

        <nav className="mb-8 flex items-center justify-center sm:justify-start space-x-3 text-xs uppercase tracking-widest text-brand-muted">
          <span className="text-brand-charcoal font-medium">Panier personnalisé</span>
          <span>/</span>
          <span className="text-brand-gold font-bold">Livraison</span>
          <span>/</span>
          <span>Paiement Stripe</span>
        </nav>

        {/* Grid: Left side Form & Right side Summary */}
        <form onSubmit={handlePay} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* ======================= LEFT COLUMN: Forms ======================= */}
          <div className="lg:col-span-7 space-y-8">
            {/* Section 1: Montant personnalisé & référence */}
            <section
              className="bg-white/95 rounded-2xl p-6 sm:p-8 shadow-luxury border border-brand-border/70 backdrop-blur-sm"
              data-purpose="order-details-section"
            >
              <div className="flex items-center justify-between pb-4 border-b border-brand-border/60 mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-brand-alabaster border border-brand-gold/40 flex items-center justify-center text-xs font-semibold text-brand-charcoal">
                    1
                  </span>
                  <h2 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-brand-charcoal">
                    Montant personnalisé &amp; détails
                  </h2>
                </div>
                <span className="text-xs uppercase text-brand-gold font-semibold tracking-wider">
                  Étape 1/3
                </span>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label
                      className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal"
                      htmlFor="montant-field"
                    >
                      Montant convenu à régler au vendeur{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-brand-muted">
                      Montant libre (ex: 45 €)
                    </span>
                  </div>

                  <div className="relative rounded-xl shadow-sm">
                    <input
                      className="lux-input block w-full rounded-xl py-4 pl-4 pr-12 text-2xl font-serif font-bold text-brand-charcoal placeholder-gray-400 focus:border-brand-gold"
                      id="montant-field"
                      min="0.50"
                      name="amount"
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                      <span className="text-xl font-serif font-bold text-brand-charcoal">
                        €
                      </span>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-brand-muted font-medium mr-1">
                      Suggestions :
                    </span>
                    {quickAmounts.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset.toFixed(2))}
                        className={`text-xs px-3 py-1 rounded-lg border transition-all ${
                          subtotal === preset
                            ? "bg-brand-charcoal text-white border-brand-charcoal font-semibold shadow-sm"
                            : "bg-brand-alabaster hover:bg-brand-gold hover:text-white text-brand-charcoal border-brand-border/80"
                        }`}
                      >
                        {preset} €
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                      htmlFor="order-ref"
                    >
                      Référence de vente
                    </label>
                    <input
                      className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400 font-mono"
                      id="order-ref"
                      name="order_reference"
                      value={orderReference}
                      onChange={(e) => setOrderReference(e.target.value)}
                      placeholder="OMD-LIVE-4982"
                      type="text"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                      htmlFor="tiktok-user"
                    >
                      Pseudo TikTok <span className="text-red-500">*</span>
                    </label>
                    <div className="relative rounded-xl">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-brand-muted font-medium text-sm">
                        @
                      </div>
                      <input
                        className="lux-input block w-full rounded-xl py-3 pl-9 pr-4 text-sm text-brand-charcoal placeholder-gray-400"
                        id="tiktok-user"
                        name="tiktok_username"
                        value={tiktokUsername}
                        onChange={(e) => setTiktokUsername(e.target.value)}
                        placeholder="votre_pseudo"
                        type="text"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="order-item"
                  >
                    Description de l&apos;article{" "}
                    <span className="text-brand-muted font-normal lowercase">
                      (facultatif)
                    </span>
                  </label>
                  <input
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400"
                    id="order-item"
                    name="article_name"
                    value={articleName}
                    onChange={(e) => setArticleName(e.target.value)}
                    placeholder="Ex: Robe soirée satin dorée — Taille M"
                    type="text"
                  />
                </div>
              </div>
            </section>

            {/* Section 2: Adresse de livraison */}
            <section
              className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-brand-border/70 shadow-luxury backdrop-blur-sm"
              data-purpose="shipping-address-section"
            >
              <div className="flex items-center justify-between pb-4 border-b border-brand-border/60 mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-brand-alabaster border border-brand-gold/40 flex items-center justify-center text-xs font-semibold text-brand-charcoal">
                    2
                  </span>
                  <h2 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-brand-charcoal">
                    Adresse de livraison
                  </h2>
                </div>
                <span className="text-xs uppercase text-brand-gold font-semibold tracking-wider">
                  Étape 2/3
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="md:col-span-2">
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="email-addr"
                  >
                    E-mail pour le reçu de paiement
                  </label>
                  <input
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400"
                    id="email-addr"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    type="email"
                  />
                </div>
                <div>
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="first-name"
                  >
                    Prénom
                  </label>
                  <input
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400"
                    id="first-name"
                    name="firstname"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Camille"
                    type="text"
                  />
                </div>
                <div>
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="last-name"
                  >
                    Nom
                  </label>
                  <input
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400"
                    id="last-name"
                    name="lastname"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Laurent"
                    type="text"
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="country"
                  >
                    Pays
                  </label>
                  <select
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal cursor-pointer"
                    id="country"
                    name="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    <option value="FR">France métropolitaine</option>
                    <option value="BE">Belgique</option>
                    <option value="LU">Luxembourg</option>
                    <option value="DE">Allemagne</option>
                    <option value="ES">Espagne</option>
                    <option value="CH">Suisse</option>
                    <option value="GB">Royaume-Uni</option>
                    <option value="US">États-Unis</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="street-address"
                  >
                    Adresse de livraison
                  </label>
                  <input
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400"
                    id="street-address"
                    name="address1"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    placeholder="N° et nom de rue"
                    type="text"
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="address2"
                  >
                    Complément{" "}
                    <span className="text-brand-muted font-normal lowercase">
                      (facultatif)
                    </span>
                  </label>
                  <input
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400"
                    id="address2"
                    name="address2"
                    value={address2}
                    onChange={(e) => setAddress2(e.target.value)}
                    placeholder="Bâtiment, étage, interphone…"
                    type="text"
                  />
                </div>
                <div>
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="postal-code"
                  >
                    Code postal
                  </label>
                  <input
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400"
                    id="postal-code"
                    name="zip"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="75008"
                    type="text"
                  />
                </div>
                <div>
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="city"
                  >
                    Ville
                  </label>
                  <input
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400"
                    id="city"
                    name="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Paris"
                    type="text"
                  />
                </div>
                <div className="md:col-span-2">
                  <label
                    className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
                    htmlFor="phone-number"
                  >
                    Téléphone
                  </label>
                  <input
                    className="lux-input block w-full rounded-xl py-3 px-4 text-sm text-brand-charcoal placeholder-gray-400"
                    id="phone-number"
                    name="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    type="tel"
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Mode de livraison (Mondial Relay) */}
            <section
              className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-brand-border/70 shadow-luxury backdrop-blur-sm"
              data-purpose="shipping-method-section"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-brand-border/60 mb-6">
                <span className="w-7 h-7 rounded-full bg-brand-alabaster border border-brand-gold/40 flex items-center justify-center text-xs font-semibold text-brand-charcoal">
                  3
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-brand-charcoal">
                  Mode de livraison
                </h2>
              </div>
              <div className="relative border-2 border-brand-gold/80 bg-brand-cream/40 rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      defaultChecked
                      className="mt-1 h-4 w-4 text-brand-charcoal border-gray-300 focus:ring-brand-gold custom-radio"
                      id="relay-option"
                      name="shipping_method"
                      type="radio"
                      value="mondial_relay"
                    />
                    <div>
                      <label
                        className="font-semibold text-base text-brand-charcoal block cursor-pointer"
                        htmlFor="relay-option"
                      >
                        Mondial Relay — Point Relais
                      </label>
                      <p className="text-xs text-brand-muted mt-0.5">
                        3 à 5 jours ouvrés avec notification SMS
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-serif text-lg font-bold text-brand-charcoal">
                      5,00 € TTC
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: Paiement Sécurisé via Stripe */}
            <section
              className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-brand-border/70 shadow-luxury backdrop-blur-sm"
              data-purpose="payment-section"
            >
              <div className="flex items-center justify-between pb-4 border-b border-brand-border/60 mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-brand-charcoal text-white flex items-center justify-center text-xs font-semibold">
                    4
                  </span>
                  <h2 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-brand-charcoal">
                    Paiement Sécurisé
                  </h2>
                </div>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
                    CB
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#1A1F71] text-white">
                    VISA
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#EB001B] text-white">
                    MC
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-black text-white">
                    APPLE
                  </span>
                </div>
              </div>

              {/* Stripe Info Box */}
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#FAF8F5] to-[#F5EFE6] border border-brand-border/80">
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-full bg-brand-charcoal text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <svg className="w-5 h-5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-brand-charcoal">
                        Paiement 100% sécurisé via la page Stripe
                      </p>
                      <p className="text-xs text-brand-muted leading-relaxed">
                        En cliquant sur « Payer », vous serez redirigé vers la page de paiement officielle et cryptée de Stripe pour finaliser votre règlement par Carte Bancaire ou Apple Pay en toute sécurité.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-brand-border/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-brand-charcoal font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600">✓</span>
                      <span>Chiffrement AES-256</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600">✓</span>
                      <span>Authentification 3D Secure</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-600">✓</span>
                      <span>Zéro coordonnée stockée</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-charcoal focus:ring-brand-gold custom-radio"
                      id="terms-check"
                      name="terms"
                      type="checkbox"
                    />
                    <span className="text-xs text-brand-muted leading-relaxed">
                      J&apos;accepte les{" "}
                      <a
                        className="underline text-brand-charcoal hover:text-brand-gold"
                        href="#"
                        onClick={(e) => e.preventDefault()}
                      >
                        conditions générales de vente
                      </a>{" "}
                      et confirme le montant convenu avec le vendeur.
                    </span>
                  </label>
                </div>

                <div className="pt-2 sm:hidden">
                  <button
                    disabled={isSubmitting}
                    onClick={handlePay}
                    className="w-full bg-[#1F1C1B] hover:bg-brand-gold disabled:bg-gray-400 text-white font-medium text-sm tracking-widest uppercase py-4 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer"
                    type="button"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>Redirection vers Stripe...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>{subtotal > 0 ? `Payer • ${formatPrice(total)}` : "Saisir un montant"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* ======================= RIGHT COLUMN: Récapitulatif (Sticky) ======================= */}
          <aside className="lg:col-span-5 lg:sticky lg:top-32 space-y-6">
            <div
              className="bg-white/95 rounded-2xl p-6 sm:p-8 shadow-luxury-lg border border-brand-border/90 backdrop-blur-md"
              data-purpose="payment-summary-card"
            >
              <h2 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-brand-charcoal pb-4 border-b border-brand-border/70">
                Récapitulatif
              </h2>
              <div className="py-5 space-y-3.5 text-sm">
                <div className="flex items-center justify-between text-brand-muted">
                  <span>Montant article convenu</span>
                  <span className="font-medium text-brand-charcoal text-base">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-brand-muted">
                  <div className="flex items-center gap-1.5">
                    <span>Livraison Point Relais</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-alabaster text-brand-muted border border-brand-border">
                      3-5 j
                    </span>
                  </div>
                  <span className="font-medium text-brand-charcoal">
                    {formatPrice(SHIPPING_COST)}
                  </span>
                </div>
                {subtotal > 0 && (
                  <div className="flex items-center justify-between text-brand-muted text-xs">
                    <span>TVA incluse (20 %)</span>
                    <span>{formatPrice(vat)}</span>
                  </div>
                )}
                <div className="pt-4 border-t border-brand-border/70">
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-xl sm:text-2xl font-bold text-brand-charcoal">
                      Total TTC
                    </span>
                    <span className="font-serif text-3xl font-extrabold text-brand-charcoal">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Checkout Action Button */}
              <div className="mt-4">
                <button
                  disabled={isSubmitting}
                  onClick={handlePay}
                  className="w-full bg-[#1F1C1B] hover:bg-brand-gold disabled:bg-gray-400 text-white font-medium text-sm sm:text-base tracking-widest uppercase py-4 px-6 rounded-xl shadow-lg transition-all duration-300 transform active:scale-[0.99] flex items-center justify-center gap-3 group cursor-pointer"
                  id="btn-submit-payment"
                  type="button"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      <span>Redirection Stripe...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4 text-brand-gold group-hover:text-white transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        ></path>
                      </svg>
                      <span>
                        {subtotal > 0 ? `Payer • ${formatPrice(total)}` : "Saisir un montant"}
                      </span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-brand-border/60 space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-alabaster flex items-center justify-center text-brand-gold shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                    </svg>
                  </div>
                  <strong className="text-xs font-semibold text-brand-charcoal">
                    Paiement Stripe 100% Garanti
                  </strong>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-alabaster flex items-center justify-center text-brand-gold shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      ></path>
                    </svg>
                  </div>
                  <strong className="text-xs font-semibold text-brand-charcoal">
                    Expédition suivie sous 24–48 h
                  </strong>
                </div>
              </div>
            </div>

            {/* Note service client */}
            <div className="bg-brand-pearl/40 rounded-xl p-4 border border-brand-border/60 text-center text-xs text-brand-muted">
              Une question lors de votre live ? Signalez-le en direct à l&apos;animatrice.
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}

export default function CheckoutForm() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-brand-muted">Chargement...</div>}>
      <CheckoutFormContent />
    </Suspense>
  );
}
