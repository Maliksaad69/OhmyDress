import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-brand-border/50 bg-white/70 backdrop-blur-md sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 md:h-28 flex items-center justify-between">
        {/* Retour */}
        <Link
          className="inline-flex items-center gap-2 text-xs md:text-sm font-medium tracking-wider text-brand-charcoal hover:text-brand-gold uppercase transition-colors duration-200"
          href="/"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M15 19l-7-7 7-7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            ></path>
          </svg>
          <span className="hidden sm:inline">Retour boutique</span>
        </Link>

        {/* Logo */}
        <Link className="block group" href="/">
          <Image
            alt="Oh My Dress Showroom"
            className="h-14 md:h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            src="/brand/logo.png"
            width={300}
            height={256}
            priority
          />
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50/90 border border-emerald-200/60 px-2.5 py-1 rounded-full">
            <svg className="w-3.5 h-3.5 text-emerald-700" fill="currentColor" viewBox="0 0 20 20">
              <path
                clipRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                fillRule="evenodd"
              ></path>
            </svg>
            <span className="text-[11px] uppercase tracking-wider font-semibold">
              Paiement Sécurisé
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
