import Image from "next/image";

export default function LoneAlphaBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <a
        href="https://www.linkedin.com/in/malik-saad-ahmed-93404a318/"
        target="_blank"
        rel="noopener noreferrer"
        title="Voir le profil LinkedIn de Saad Ahmed — LoneAlpha"
        className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 hover:bg-white border border-brand-border/90 hover:border-brand-gold/70 shadow-xs hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
      >
        <span className="text-[11px] tracking-wide text-brand-muted font-normal">
          Propulsé par
        </span>
        <span className="w-px h-3.5 bg-brand-border/80" />
        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6 rounded-full bg-white ring-1 ring-brand-charcoal/15 group-hover:ring-brand-gold shadow-2xs flex items-center justify-center p-0.5 transition-all duration-300">
            <Image
              src="/brand/lone-alpha.png"
              alt="LoneAlpha Logo"
              width={24}
              height={24}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <span className="text-xs font-semibold tracking-wider uppercase text-brand-charcoal group-hover:text-brand-gold transition-colors">
            LoneAlpha
          </span>
          <svg
            className="w-3.5 h-3.5 text-brand-muted/70 group-hover:text-brand-gold group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </div>
      </a>
    </div>
  );
}
