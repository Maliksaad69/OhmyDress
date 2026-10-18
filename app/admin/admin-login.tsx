"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage("Veuillez renseigner le mot de passe.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.reload();
      } else {
        setErrorMessage(data.error || "Mot de passe incorrect.");
      }
    } catch {
      setErrorMessage("Erreur lors de la tentative de connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col justify-between items-center px-4 py-12">
      <div className="w-full max-w-md my-auto">
        <div className="bg-white/95 rounded-3xl p-8 sm:p-10 shadow-luxury-lg border border-brand-border/80 backdrop-blur-md text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image
              src="/brand/logo.png"
              alt="Oh My Dress Showroom"
              width={180}
              height={150}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>

          <p className="text-[11px] uppercase tracking-[0.25em] font-semibold text-brand-gold">
            Espace Sécurisé
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-brand-charcoal">
            Administration
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-brand-muted">
            Gestion des encaissements et commandes en direct
          </p>

          {errorMessage && (
            <div className="mt-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-fade-in text-left">
              <svg className="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs uppercase tracking-wider font-semibold text-brand-charcoal mb-1.5"
              >
                Mot de passe administrateur
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoFocus
                  required
                  className="w-full bg-brand-cream/40 border border-brand-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-charcoal text-xs"
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-charcoal hover:bg-brand-gold text-white font-medium text-xs sm:text-sm tracking-widest uppercase py-3.5 px-6 rounded-xl shadow-md transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Vérification...</span>
                </>
              ) : (
                <span>Accéder au tableau de bord</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-brand-border/60">
            <Link
              href="/"
              className="text-xs text-brand-muted hover:text-brand-charcoal transition-colors inline-flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Retour à la boutique</span>
            </Link>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-brand-muted">
        Oh My Dress Showroom © 2026 — Accès réservé à l&apos;équipe de direction
      </p>
    </div>
  );
}
