import React, { useState } from 'react';
import { Heart, Copy, Check, QrCode, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PixContributionCardProps {
  pixKey?: string;
  pixKeyType?: string;
  bankName?: string;
  accountName?: string;
  agency?: string;
  accountNumber?: string;
}

export default function PixContributionCard({
  pixKey = 'pix@adboasnovas.org.br',
  pixKeyType = 'Chave PIX',
  bankName = 'Banco do Brasil',
  accountName = 'Assembleia de Deus Boas Novas',
  agency = '3456-7',
  accountNumber = '12345-6'
}: PixContributionCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pixKey)}&color=1a365d&bgcolor=ffffff`;

  return (
    <section className="rounded-2xl border border-church-gold/20 bg-white shadow-sm p-3.5 sm:p-4 space-y-2">
      {/* Compact Main Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Title & Subtitle */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-church-navy text-church-gold shadow-sm shrink-0">
            <Heart className="h-4 w-4 fill-church-gold/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-sm font-bold text-church-navy leading-tight">
                Dízimos e Ofertas (PIX)
              </h3>
              <span className="hidden sm:inline-block rounded-md bg-church-gold/15 px-1.5 py-0.2 text-[9px] font-bold text-church-navy uppercase border border-church-gold/30">
                Contribuição
              </span>
            </div>
            <p className="text-[11px] text-church-navy/60 font-medium truncate">
              {accountName}
            </p>
          </div>
        </div>

        {/* Middle/Right: PIX Key display & Actions */}
        <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
          {/* Key Pill */}
          <div className="flex items-center gap-1.5 rounded-xl bg-church-navy/5 border border-church-gold/20 px-3 py-1.5 text-xs text-church-navy">
            <span className="text-[10px] font-bold text-church-navy/50 uppercase">{pixKeyType}:</span>
            <span className="font-mono font-bold text-church-navy select-all text-xs">{pixKey}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-church-gold text-church-navy hover:bg-church-gold/90'
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1 rounded-xl border border-church-navy/15 bg-white px-2.5 py-1.5 text-xs font-bold text-church-navy hover:bg-church-navy hover:text-white transition-all shadow-sm active:scale-95"
              title="Mostrar QR Code"
            >
              <QrCode className="h-3.5 w-3.5 text-church-gold" />
              <span className="hidden xs:inline">QR Code</span>
            </button>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1.5 rounded-xl border border-church-navy/10 text-church-navy/60 hover:text-church-navy hover:bg-church-navy/5 transition-colors"
              title="Mais detalhes"
            >
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Details (Verse + Bank Account) */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pt-1"
          >
            <div className="rounded-xl bg-church-cream/20 border border-church-gold/15 p-3 text-xs text-church-navy space-y-2">
              <p className="font-serif italic text-church-navy/80 text-[11px] text-center">
                "Cada um contribua segundo determinou em seu coração; não com tristeza ou por obrigação, pois Deus ama quem dá com alegria." — 2 Coríntios 9:7
              </p>
              <div className="pt-1 border-t border-church-gold/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-[9px] font-bold text-church-navy/40 uppercase block">Banco</span>
                  <span className="font-bold">{bankName}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-church-navy/40 uppercase block">Agência</span>
                  <span className="font-bold">{agency}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-church-navy/40 uppercase block">Conta Corrente</span>
                  <span className="font-bold">{accountNumber}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-church-navy/40 uppercase block">Favorecido</span>
                  <span className="font-bold truncate block">{accountName}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal QR Code */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-church-navy/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xs bg-white rounded-3xl p-5 text-center space-y-4 shadow-2xl border border-church-gold/30"
            >
              <div className="flex items-center justify-between border-b border-church-gold/15 pb-2">
                <div className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-church-gold fill-church-gold/20" />
                  <span className="font-serif font-bold text-church-navy text-sm">QR Code PIX</span>
                </div>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="rounded-xl p-1 text-church-navy/40 hover:bg-church-navy/5 text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="mx-auto h-44 w-44 rounded-2xl border-2 border-church-gold/30 bg-white p-2 shadow-inner flex items-center justify-center">
                <img src={qrCodeUrl} alt="QR Code PIX" className="h-full w-full object-contain" />
              </div>

              <div className="rounded-xl bg-church-cream/30 p-2.5 border border-church-gold/15 text-left text-xs space-y-0.5">
                <p className="text-[9px] font-bold text-church-navy/50 uppercase">Chave PIX</p>
                <p className="font-mono font-bold text-church-navy select-all break-all text-xs">{pixKey}</p>
                <p className="text-[10px] font-medium text-church-navy/60 truncate">{accountName}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className={`flex-1 rounded-xl py-2.5 font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-church-gold text-church-navy hover:bg-church-gold/90'
                  }`}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar Chave'}</span>
                </button>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="rounded-xl border border-church-navy/15 bg-gray-50 px-3 py-2.5 font-bold text-xs text-church-navy hover:bg-gray-100"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
