"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { FormattedPayment, PaymentStats } from "@/app/api/admin/payments/route";

interface AdminDashboardProps {
  initialPayments: FormattedPayment[];
  initialStats: PaymentStats;
  initialEmailJs?: {
    isConfigured: boolean;
    hasServiceId: boolean;
    hasTemplateId: boolean;
    hasPublicKey: boolean;
    hasPrivateKey: boolean;
    adminEmail: string | null;
  };
  supabaseConfigured?: boolean;
}

export default function AdminDashboard({
  initialPayments,
  initialStats,
  initialEmailJs,
  supabaseConfigured = false,
}: AdminDashboardProps) {
  const [payments, setPayments] = useState<FormattedPayment[]>(initialPayments);
  const [stats, setStats] = useState<PaymentStats>(initialStats);
  const [emailJsInfo, setEmailJsInfo] = useState(initialEmailJs);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "open" | "expired">("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");

  // Selected payment for detail modal
  const [selectedPayment, setSelectedPayment] = useState<FormattedPayment | null>(null);

  // Loading states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Copy notification toast
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette commande ?")) {
      return;
    }
    setDeletingId(paymentId);
    try {
      const res = await fetch(`/api/admin/payments?id=${encodeURIComponent(paymentId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPayments((prev) => prev.filter((p) => p.id !== paymentId));
        if (selectedPayment?.id === paymentId) {
          setSelectedPayment(null);
        }
        setCopiedField("Commande supprimée");
        setTimeout(() => setCopiedField(null), 2500);
      } else {
        const data = await res.json();
        alert(data.error || "Impossible de supprimer la commande.");
      }
    } catch {
      alert("Erreur de connexion.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir vider TOUTES les commandes ? Cette action réinitialisera l'historique."
      )
    ) {
      return;
    }
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/payments?action=clear_all", {
        method: "DELETE",
      });
      if (res.ok) {
        setPayments([]);
        setStats({
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
        });
        setSelectedPayment(null);
        setCopiedField("Toutes les commandes ont été effacées");
        setTimeout(() => setCopiedField(null), 2500);
      }
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/payments");
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setStats(data.stats || stats);
      }
      const authRes = await fetch("/api/admin/auth");
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.emailJs) {
          setEmailJsInfo(authData.emailJs);
        }
      }
    } catch (err) {
      console.error("Erreur de rafraîchissement:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      window.location.reload();
    } catch (err) {
      console.error("Erreur déconnexion:", err);
      setIsLoggingOut(false);
    }
  };

  // Filter & Sort payments
  const filteredPayments = useMemo(() => {
    return payments
      .filter((p) => {
        // Status filter
        if (statusFilter === "paid" && p.paymentStatus !== "paid") return false;
        if (statusFilter === "open" && (p.paymentStatus === "paid" || p.status === "expired")) return false;
        if (statusFilter === "expired" && p.status !== "expired") return false;

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          p.customerName.toLowerCase().includes(q) ||
          p.customerEmail.toLowerCase().includes(q) ||
          p.customerPhone.toLowerCase().includes(q) ||
          p.tiktokUsername.toLowerCase().includes(q) ||
          p.orderReference.toLowerCase().includes(q) ||
          p.articleName.toLowerCase().includes(q) ||
          p.shippingAddress.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === "date-desc") return b.created - a.created;
        if (sortBy === "date-asc") return a.created - b.created;
        if (sortBy === "amount-desc") return b.amountTotal - a.amountTotal;
        if (sortBy === "amount-asc") return a.amountTotal - b.amountTotal;
        return 0;
      });
  }, [payments, searchQuery, statusFilter, sortBy]);

  // CSV Export for Mondial Relay and accounting
  const handleExportCSV = () => {
    if (!filteredPayments.length) return;

    const headers = [
      "Référence Commande",
      "Date",
      "Statut Paiement",
      "Montant Total (€)",
      "Montant Article (€)",
      "Frais Livraison (€)",
      "Pseudo TikTok",
      "Nom Client",
      "Email Client",
      "Téléphone Client",
      "Adresse de Livraison",
      "ID Session Stripe",
      "ID Paiement Intent",
    ];

    const rows = filteredPayments.map((p) => [
      `"${p.orderReference.replace(/"/g, '""')}"`,
      `"${p.formattedDate}"`,
      `"${p.paymentStatus === "paid" ? "Payé" : p.status === "open" ? "En attente" : "Expiré"}"`,
      `"${p.amountTotal.toFixed(2)}"`,
      `"${p.customAmount.toFixed(2)}"`,
      `"${p.shippingCost.toFixed(2)}"`,
      `"${p.tiktokUsername.replace(/"/g, '""')}"`,
      `"${p.customerName.replace(/"/g, '""')}"`,
      `"${p.customerEmail.replace(/"/g, '""')}"`,
      `"${p.customerPhone.replace(/"/g, '""')}"`,
      `"${p.shippingAddress.replace(/"/g, '""')}"`,
      `"${p.id}"`,
      `"${p.paymentIntentId || ""}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `oh-my-dress-commandes-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-brand-charcoal flex flex-col">
      {/* Toast Notification */}
      {copiedField && (
        <div className="fixed bottom-6 right-6 z-50 bg-brand-charcoal text-white px-4 py-3 rounded-xl shadow-luxury-lg flex items-center gap-2 text-xs animate-fade-in border border-brand-gold/40">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span>{copiedField} copié dans le presse-papier !</span>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-brand-border/60 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-serif text-2xl font-medium tracking-tight text-brand-charcoal flex items-center gap-2">
              <span>Oh My Dress</span>
              <span className="text-xs uppercase tracking-widest font-sans font-semibold bg-brand-cream border border-brand-border px-2 py-0.5 rounded text-brand-gold">
                Admin
              </span>
            </Link>

            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Stripe Connecté (Live)
            </span>

            {emailJsInfo?.isConfigured && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 px-2 py-0.5 rounded-full font-medium">
                ✓ Alertes EmailJS Actives
              </span>
            )}

            {supabaseConfigured && (
              <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 px-2 py-0.5 rounded-full font-medium">
                ⚡ Supabase BDD Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-alabaster hover:bg-brand-pearl border border-brand-border px-3.5 py-2 rounded-xl transition-all"
              title="Rafraîchir les paiements"
            >
              <svg className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-brand-gold" : "text-brand-charcoal"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted hover:text-brand-charcoal bg-white border border-brand-border px-3.5 py-2 rounded-xl transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="hidden sm:inline">Voir la boutique</span>
            </Link>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200 px-3.5 py-2 rounded-xl transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Card 1: Revenue */}
          <div className="bg-white/95 rounded-2xl p-5 border border-brand-border shadow-luxury flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-muted">
                Chiffre d&apos;Affaires Encaissé
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-cream border border-brand-border flex items-center justify-center text-brand-gold">
                €
              </div>
            </div>
            <div className="mt-4">
              <p className="font-serif text-3xl font-semibold text-brand-charcoal">
                {stats.formattedTotalRevenue}
              </p>
              <p className="mt-1 text-xs text-emerald-700 font-medium">
                +{stats.formattedTodayRevenue} aujourd&apos;hui
              </p>
            </div>
          </div>

          {/* Card 2: Orders Count */}
          <div className="bg-white/95 rounded-2xl p-5 border border-brand-border shadow-luxury flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-muted">
                Commandes Payées
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="font-serif text-3xl font-semibold text-brand-charcoal">
                {stats.totalPaid}
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                {stats.todayOrders} validée(s) aujourd&apos;hui
              </p>
            </div>
          </div>

          {/* Card 3: Average Basket */}
          <div className="bg-white/95 rounded-2xl p-5 border border-brand-border shadow-luxury flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-muted">
                Panier Moyen
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-cream border border-brand-border flex items-center justify-center text-brand-gold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="font-serif text-3xl font-semibold text-brand-charcoal">
                {stats.formattedAverageBasket}
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                Sur {stats.totalPaid} commande(s)
              </p>
            </div>
          </div>

          {/* Card 4: Pending checkouts */}
          <div className="bg-white/95 rounded-2xl p-5 border border-brand-border shadow-luxury flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-muted">
                Paniers En Cours
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="font-serif text-3xl font-semibold text-brand-charcoal">
                {stats.pendingCount}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Paniers Stripe initiés non finalisés
              </p>
            </div>
          </div>
        </div>

        {/* Orders Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-xl sm:text-2xl font-medium text-brand-charcoal">
              Commandes &amp; Paiements
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-cream border border-brand-border text-brand-gold">
              {payments.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {payments.length > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200 px-3 py-2 rounded-xl transition-all shadow-sm"
                title="Supprimer toutes les commandes actuelles"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="hidden sm:inline">Vider l&apos;historique</span>
              </button>
            )}
            <button
              onClick={handleExportCSV}
              disabled={filteredPayments.length === 0}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white hover:bg-brand-alabaster border border-brand-border px-3 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Exporter CSV ({filteredPayments.length})</span>
            </button>
          </div>
        </div>

        {/* Payments List */}
        <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-white/95 rounded-2xl p-4 border border-brand-border shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-grow max-w-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, TikTok, email, réf..."
                  className="w-full bg-brand-cream/60 border border-brand-border rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
                />
                <svg className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-charcoal text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status and Sort Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-brand-cream/60 border border-brand-border rounded-xl p-0.5 text-xs">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      statusFilter === "all" ? "bg-white shadow-xs text-brand-charcoal" : "text-brand-muted"
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setStatusFilter("paid")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      statusFilter === "paid" ? "bg-white shadow-xs text-emerald-700" : "text-brand-muted"
                    }`}
                  >
                    Payés
                  </button>
                  <button
                    onClick={() => setStatusFilter("open")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      statusFilter === "open" ? "bg-white shadow-xs text-amber-700" : "text-brand-muted"
                    }`}
                  >
                    En attente
                  </button>
                </div>

                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as
                        | "date-desc"
                        | "date-asc"
                        | "amount-desc"
                        | "amount-asc"
                    )
                  }
                  className="bg-brand-cream/60 border border-brand-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-gold text-brand-charcoal"
                >
                  <option value="date-desc">Plus récents d&apos;abord</option>
                  <option value="date-asc">Plus anciens d&apos;abord</option>
                  <option value="amount-desc">Montant décroissant (€)</option>
                  <option value="amount-asc">Montant croissant (€)</option>
                </select>
              </div>
            </div>

            {/* Payments Table */}
            <div className="bg-white/95 rounded-2xl border border-brand-border shadow-luxury overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-brand-cream/60 border-b border-brand-border text-brand-muted uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Date</th>
                      <th className="py-3.5 px-4 sm:px-6">Commande &amp; TikTok</th>
                      <th className="py-3.5 px-4 sm:px-6">Client</th>
                      <th className="py-3.5 px-4 sm:px-6">Article</th>
                      <th className="py-3.5 px-4 sm:px-6">Montant Total</th>
                      <th className="py-3.5 px-4 sm:px-6">Statut</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/60">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-brand-muted">
                          <p className="font-serif text-base text-brand-charcoal">Aucun paiement trouvé</p>
                          <p className="text-xs mt-1">
                            {searchQuery ? "Essayez d'ajuster vos critères de recherche." : "Les sessions Stripe apparaîtront ici dès les premières visites."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => {
                        const isPaid = payment.paymentStatus === "paid";
                        const isOpen = payment.status === "open";

                        return (
                          <tr
                            key={payment.id}
                            className="hover:bg-brand-cream/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedPayment(payment)}
                          >
                            <td className="py-3.5 px-4 sm:px-6 font-mono text-[11px] sm:text-xs text-brand-muted whitespace-nowrap">
                              {payment.formattedDate}
                            </td>
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="font-mono font-medium text-brand-charcoal">
                                {payment.orderReference}
                              </div>
                              <div className="text-[11px] text-brand-gold font-medium">
                                {payment.tiktokUsername}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="font-medium text-brand-charcoal">{payment.customerName}</div>
                              <div className="text-[11px] text-brand-muted truncate max-w-[160px] sm:max-w-[200px]">
                                {payment.customerEmail}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="text-brand-charcoal truncate max-w-[140px] sm:max-w-[180px]">
                                {payment.articleName}
                              </div>
                              <div className="text-[11px] text-brand-muted">
                                + {payment.shippingCost.toFixed(2)} € Mondial Relay
                              </div>
                            </td>
                            <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                              <span className="font-serif font-bold text-base text-brand-charcoal">
                                {payment.formattedAmount}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Payé
                                </span>
                              ) : isOpen ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  En attente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">
                                  Expiré
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setSelectedPayment(payment)}
                                  className="text-xs bg-brand-alabaster hover:bg-brand-pearl border border-brand-border px-2.5 py-1 rounded-lg text-brand-charcoal transition-colors"
                                >
                                  Détails
                                </button>
                                <a
                                  href={payment.stripeDashboardUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs bg-white hover:bg-brand-cream border border-brand-border px-2.5 py-1 rounded-lg text-brand-gold hover:text-brand-gold-hover transition-colors inline-flex items-center gap-1"
                                  title="Voir sur le dashboard Stripe"
                                >
                                  <span>Stripe</span>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                                <button
                                  onClick={() => handleDeletePayment(payment.id)}
                                  disabled={deletingId === payment.id}
                                  className="text-xs bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg text-red-600 hover:text-red-700 transition-colors inline-flex items-center"
                                  title="Supprimer cette commande"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
      </main>

      {/* Slide-over / Modal: Order Detail View */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-luxury-lg border border-brand-border p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-brand-border">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-gold">
                  Détail de la Transaction
                </span>
                <h3 className="font-serif text-2xl font-medium text-brand-charcoal mt-1">
                  {selectedPayment.orderReference}
                </h3>
                <p className="text-xs text-brand-muted mt-0.5">
                  Effectué le {selectedPayment.formattedDate}
                </p>
              </div>

              <button
                onClick={() => setSelectedPayment(null)}
                className="w-8 h-8 rounded-full bg-brand-alabaster hover:bg-brand-pearl text-brand-charcoal flex items-center justify-center transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {/* Status & Amount highlight */}
            <div className="bg-brand-cream/70 rounded-2xl p-5 border border-brand-border/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-muted">Montant total réglé</p>
                <p className="font-serif text-3xl font-bold text-brand-charcoal mt-0.5">
                  {selectedPayment.formattedAmount}
                </p>
                <p className="text-[11px] text-brand-muted mt-0.5">
                  Article: {selectedPayment.customAmount.toFixed(2)} € + Port: {selectedPayment.shippingCost.toFixed(2)} €
                </p>
              </div>

              <div>
                {selectedPayment.paymentStatus === "paid" ? (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Paiement Validé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    En attente de paiement
                  </span>
                )}
              </div>
            </div>

            {/* Client & TikTok Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="bg-white p-4 rounded-xl border border-brand-border space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted">
                  Client Showroom
                </span>
                <p className="font-semibold text-brand-charcoal text-base">
                  {selectedPayment.customerName}
                </p>
                <div className="space-y-1 text-xs">
                  <p className="flex items-center gap-2 text-brand-charcoal">
                    <span>📧</span>
                    <a href={`mailto:${selectedPayment.customerEmail}`} className="hover:text-brand-gold underline truncate">
                      {selectedPayment.customerEmail}
                    </a>
                  </p>
                  <p className="flex items-center gap-2 text-brand-charcoal">
                    <span>📱</span>
                    <a href={`tel:${selectedPayment.customerPhone}`} className="hover:text-brand-gold font-medium">
                      {selectedPayment.customerPhone}
                    </a>
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-brand-border space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted">
                  Compte TikTok &amp; Article
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-brand-gold text-base">
                    {selectedPayment.tiktokUsername}
                  </span>
                  {selectedPayment.tiktokUsername !== "—" && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedPayment.tiktokUsername, "Pseudo TikTok")}
                      className="text-[11px] text-brand-muted hover:text-brand-charcoal bg-brand-alabaster px-2 py-0.5 rounded border border-brand-border"
                    >
                      Copier
                    </button>
                  )}
                </div>
                <p className="text-xs text-brand-charcoal pt-1 border-t border-brand-border/60">
                  <strong className="text-brand-muted">Article :</strong> {selectedPayment.articleName}
                </p>
              </div>
            </div>

            {/* Shipping Address Box */}
            <div className="bg-white p-4 rounded-xl border border-brand-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-muted flex items-center gap-1.5">
                  <span>📦</span>
                  <span>Adresse d&apos;Expédition Mondial Relay</span>
                </span>
                {selectedPayment.shippingAddress && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedPayment.shippingAddress, "Adresse")}
                    className="text-xs text-brand-gold hover:text-brand-gold-hover font-medium underline"
                  >
                    Copier l&apos;adresse
                  </button>
                )}
              </div>
              <p className="font-medium text-brand-charcoal text-xs sm:text-sm bg-brand-cream/60 p-3 rounded-lg border border-brand-border/80 leading-relaxed font-mono">
                {selectedPayment.shippingAddress}
              </p>
            </div>

            {/* Technical Stripe references */}
            <div className="bg-brand-alabaster/60 p-4 rounded-xl border border-brand-border space-y-2 text-[11px] font-mono text-brand-muted">
              <div className="flex items-center justify-between">
                <span>Session ID :</span>
                <span className="truncate max-w-[280px] text-brand-charcoal">{selectedPayment.id}</span>
              </div>
              {selectedPayment.paymentIntentId && (
                <div className="flex items-center justify-between">
                  <span>Payment Intent :</span>
                  <span className="text-brand-charcoal">{selectedPayment.paymentIntentId}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-brand-border">
              <button
                type="button"
                onClick={() => handleDeletePayment(selectedPayment.id)}
                disabled={deletingId === selectedPayment.id}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Supprimer cette commande</span>
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <a
                  href={selectedPayment.stripeDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-charcoal hover:bg-brand-gold text-white px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all"
                >
                  <span>Consulter sur Stripe</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-medium bg-brand-alabaster hover:bg-brand-pearl text-brand-charcoal transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
