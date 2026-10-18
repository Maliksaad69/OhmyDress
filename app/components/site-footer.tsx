import Image from "next/image";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer
      className="border-t border-brand-border/80 bg-white/80 backdrop-blur-md mt-16 pt-12 pb-8"
      data-purpose="site-footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Logo centered in the middle */}
        <div className="flex flex-col items-center justify-center pb-8 border-b border-brand-border/60 gap-4 text-center">
          <Link className="block group" href="/">
            <Image
              alt="Oh My Dress Showroom"
              className="h-14 md:h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              src="/brand/logo.png"
              width={300}
              height={256}
            />
          </Link>
          <div className="text-xs text-brand-charcoal bg-brand-alabaster px-4 py-2.5 rounded-xl border border-brand-border/80 tracking-wide">
            Service client : lundi – vendredi, 9h – 17h
          </div>
        </div>

        {/* Navigation Links */}
        <div className="py-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs tracking-wider uppercase text-brand-muted items-center text-center">
          <a className="hover:text-brand-charcoal transition-colors" href="#">
            Mentions légales
          </a>
          <a className="hover:text-brand-charcoal transition-colors" href="#">
            CGV
          </a>
          <a className="hover:text-brand-charcoal transition-colors" href="#">
            Confidentialité
          </a>
          <a className="hover:text-brand-charcoal transition-colors" href="#">
            Livraison &amp; retours
          </a>
          <a className="hover:text-brand-charcoal transition-colors" href="#">
            Contact
          </a>
          <Link
            className="text-brand-gold hover:text-brand-charcoal transition-colors font-medium flex items-center gap-1"
            href="/admin"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Espace Vendeur (Admin)</span>
          </Link>
        </div>

        {/* Bottom copyright & locations */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-brand-muted border-t border-brand-border/40 gap-2">
          <p>© 2026 Oh My Dress Showroom — Tous droits réservés.</p>
          <p className="tracking-widest uppercase">Paris • Lyon • Bruxelles</p>
        </div>
      </div>
    </footer>
  );
}
