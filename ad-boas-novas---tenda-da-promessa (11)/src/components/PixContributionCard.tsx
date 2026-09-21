import React, { useState } from 'react';
import { Heart, Copy, Check, QrCode, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PixContributionCardProps {
  pixKey?: string;
  pixKeyType?: string;
  bankName?: string;
  accountName?: string;
  beneficiaryRole?: string;
  agency?: string;
  operation?: string;
  accountNumber?: string;
}

export default function PixContributionCard({
  pixKey = 'admbnt.promessa@gmail.com',
  pixKeyType = 'E-mail',
  bankName = 'Caixa Econômica Federal',
  accountName = 'Cleia de Jesus Nunes Correa da Silva',
  beneficiaryRole = 'Tesoureira Missionária',
  agency = '3511',
  operation = '3701',
  accountNumber = '591726609-0'
}: PixContributionCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Official PIX payload string (BR Code static)
  const pixEmvPayload = '00020126470014br.gov.bcb.pix0125admbnt.promessa@gmail.com5204000053039865802BR5925CLEIA DE JESUS NUNES C SI6009SAO PAULO62070503***63042FB0';
  const apiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixEmvPayload)}&color=000000&bgcolor=ffffff`;
  const [qrSrc, setQrSrc] = useState('/pix_qr.png?v=2');

  return (
    <section className="rounded-2xl border border-church-gold/20 bg-white shadow-sm p-3.5 sm:p-4 space-y-3 overflow-hidden">
      {/* Compact Main Banner Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Title & Subtitle */}
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-church-navy text-church-gold shadow-sm shrink-0 mt-0.5">
            <Heart className="h-4 w-4 fill-church-gold/20" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-sm font-bold text-church-navy leading-tight">
                Dízimos e Ofertas (PIX)
              </h3>
              <span className="rounded-md bg-church-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-church-navy uppercase border border-church-gold/30 shrink-0">
                Contribuição
              </span>
            </div>
            <div className="text-[11px] text-church-navy/80 font-medium leading-snug mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-church-navy/60">Beneficiária:</span>
              <span className="font-bold text-church-navy break-words">{accountName}</span>
              <span className="inline-flex items-center text-[9.5px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md shrink-0">
                {beneficiaryRole}
              </span>
            </div>
          </div>
        </div>

        {/* Middle/Right: PIX Key display & Actions */}
        <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end min-w-0">
          {/* Key Pill */}
          <div className="flex items-center gap-1.5 rounded-xl bg-church-navy/5 border border-church-gold/20 px-2.5 py-1.5 text-xs text-church-navy min-w-0 max-w-full">
            <span className="text-[10px] font-bold text-church-navy/50 uppercase shrink-0">{pixKeyType}:</span>
            <span className="font-mono font-bold text-church-navy select-all text-xs break-all truncate">{pixKey}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
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
              className="flex items-center gap-1 rounded-xl border border-church-navy/15 bg-white px-2.5 py-1.5 text-xs font-bold text-church-navy hover:bg-church-navy hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Mostrar QR Code"
            >
              <QrCode className="h-3.5 w-3.5 text-church-gold" />
              <span className="hidden xs:inline">QR Code</span>
            </button>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1.5 rounded-xl border border-church-navy/10 text-church-navy/60 hover:text-church-navy hover:bg-church-navy/5 transition-colors cursor-pointer"
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
              <div className="pt-2 border-t border-church-gold/15 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-[11px]">
                <div>
                  <span className="text-[9px] font-bold text-church-navy/40 uppercase block">Banco</span>
                  <span className="font-bold text-church-navy block leading-snug">{bankName}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-church-navy/40 uppercase block">Agência</span>
                  <span className="font-bold text-church-navy block">{agency}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-church-navy/40 uppercase block">Operação</span>
                  <span className="font-bold text-church-navy block">{operation}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-church-navy/40 uppercase block">Conta Corrente</span>
                  <span className="font-bold text-church-navy block">{accountNumber}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 pt-2 sm:pt-0 border-church-gold/10">
                  <span className="text-[9px] font-bold text-church-navy/40 uppercase block">Beneficiária</span>
                  <span className="font-bold text-church-navy block leading-tight">{accountName}</span>
                  <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">{beneficiaryRole}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal QR Code */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-church-navy/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-[340px] bg-white rounded-3xl p-4 sm:p-5 text-center space-y-3.5 shadow-2xl border border-church-gold/30 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-church-gold/15 pb-2">
                <div className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-church-gold fill-church-gold/20" />
                  <span className="font-serif font-bold text-church-navy text-sm">QR Code PIX</span>
                </div>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="rounded-xl p-1 text-church-navy/40 hover:bg-church-navy/5 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="mx-auto h-44 w-44 sm:h-48 sm:w-48 rounded-2xl border-2 border-church-gold/30 bg-white p-2 shadow-inner flex items-center justify-center">
                <img 
                  src={qrSrc} 
                  alt="QR Code PIX Boas Novas" 
                  className="h-full w-full object-contain"
                  onError={() => setQrSrc(apiQrCodeUrl)}
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="rounded-xl bg-church-cream/30 p-2.5 border border-church-gold/15 text-left text-xs space-y-1.5">
                <div>
                  <p className="text-[9px] font-bold text-church-navy/50 uppercase">Chave PIX (E-mail)</p>
                  <p className="font-mono font-bold text-church-navy select-all break-all text-xs">{pixKey}</p>
                </div>
                <div className="pt-1.5 border-t border-church-gold/10">
                  <p className="text-[9px] font-bold text-church-navy/50 uppercase">Beneficiária</p>
                  <p className="text-[11px] font-bold text-church-navy leading-tight">{accountName}</p>
                  <p className="text-[10px] font-semibold text-amber-700 mt-0.5">{beneficiaryRole}</p>
                </div>
                <div className="pt-1.5 border-t border-church-gold/10 text-[9.5px] text-church-navy/60 font-medium leading-relaxed">
                  {bankName} • Ag. {agency} • Op. {operation} • C/C {accountNumber}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className={`flex-1 rounded-xl py-2.5 font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
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
                  className="rounded-xl border border-church-navy/15 bg-gray-50 px-3 py-2.5 font-bold text-xs text-church-navy hover:bg-gray-100 cursor-pointer"
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
