import React, { useRef } from 'react';
import { 
  Music, Info, ExternalLink, Globe
} from 'lucide-react';

export default function Harpa() {
  const topRef = useRef<HTMLDivElement>(null);

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-fade-in px-0 sm:px-4" ref={topRef}>
      {/* Header section with direct access link */}
      <div className="mx-2 sm:mx-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 sm:p-6 bg-white rounded-2xl sm:rounded-3xl border border-church-gold/10 shadow-sm">
        <div className="flex items-center gap-3 text-left">
          <div className="p-2.5 bg-church-navy/5 text-church-navy rounded-xl sm:rounded-2xl border border-church-gold/15">
            <Music className="h-5 sm:h-6 w-5 sm:w-6 text-church-navy" />
          </div>
          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-black text-church-navy">
              Harpa Cristã
            </h1>
            <p className="text-[10px] sm:text-xs text-church-navy/50 font-medium">Hinário Oficial das Assembleias de Deus</p>
          </div>
        </div>

        {/* External direct links */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-church-gold/10 text-church-navy text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-lg sm:rounded-xl border border-church-gold/25">
            <Globe className="h-3.5 w-3.5 text-church-gold" />
            <span>harpacrista.org</span>
          </span>
          <a
            href="https://harpacrista.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-church-navy hover:bg-church-navy/90 text-white hover:text-church-gold text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all cursor-pointer"
          >
            <span>Navegador</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Main Portal Area: Just the Embedded Web View */}
      <div className="space-y-4 sm:space-y-6">
        <div className="bg-white rounded-none sm:rounded-3xl border-y sm:border border-church-gold/10 px-0 sm:px-5 py-3 sm:py-5 shadow-sm space-y-3 sm:space-y-4">
          <div className="mx-3 sm:mx-0 p-3 bg-church-cream/40 border border-church-gold/10 rounded-xl sm:rounded-2xl flex items-center gap-3 text-left">
            <Info className="h-4.5 w-4.5 text-church-gold shrink-0" />
            <p className="text-[10.5px] text-church-navy/70 leading-relaxed font-semibold">
              Use a visualização integrada abaixo. Clique em &ldquo;Navegador&rdquo; acima para abrir em tela cheia externamente.
            </p>
          </div>

          <div className="relative w-full h-[78vh] sm:h-[700px] rounded-none sm:rounded-2xl border-y sm:border border-church-gold/10 overflow-hidden bg-church-cream/10">
            <iframe
              src="https://harpacrista.org/"
              title="Harpa Cristã Oficial"
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="mx-2 sm:mx-0 p-4 rounded-xl sm:rounded-2xl bg-church-navy/5 border border-church-gold/10 flex items-start gap-3 text-left">
        <Info className="h-5 w-5 text-church-gold shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-church-navy">Louvai ao Senhor, porque é bom cantar louvores ao nosso Deus (Salmo 147:1)</p>
          <p className="text-[10px] text-church-navy/50 leading-relaxed">
            O site oficial HarpaCrista.org é uma ferramenta excelente disponível de forma integrada diretamente aqui para você consultar letras, acordes e playbacks.
          </p>
        </div>
      </div>
    </div>
  );
}
