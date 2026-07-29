import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Compass, Navigation, Copy, Check } from 'lucide-react';

export default function ChurchAddressMap() {
  const [copied, setCopied] = useState(false);
  const fullAddress = "Travessa Verona, 155 - Nações, Fazenda Rio Grande - PR";

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar endereço: ', err);
    }
  };

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;
  const wazeUrl = `https://waze.com/ul?ll=-25.6601445,-49.3082539&q=${encodeURIComponent(fullAddress)}&navigate=yes`;
  
  // Embedded Google Map query URL (compact & iframe-friendly)
  const embedMapUrl = `https://maps.google.com/maps?q=${encodeURIComponent("Travessa Verona 155, Fazenda Rio Grande, PR")}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-church-gold/10 bg-white p-4 shadow-sm"
      id="localizacao-e-endereco"
    >
      <div className="grid gap-4 md:grid-cols-12 md:items-center">
        
        {/* Left Side: Address Info and GPS shortcuts */}
        <div className="md:col-span-6 lg:col-span-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-church-gold/15 p-1.5 text-church-gold">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-serif text-sm font-bold text-church-navy">Nosso Endereço</h3>
              <p className="font-mono text-[10px] uppercase tracking-wider text-church-navy/50">Tenda da Promessa</p>
            </div>
          </div>

          <div className="rounded-xl bg-church-cream/15 p-3 border border-church-gold/5 space-y-1.5">
            <p className="font-serif text-xs font-bold leading-relaxed text-church-navy">
              Travessa Verona, 155 - Nações <br />
              Fazenda Rio Grande - PR
            </p>
            
            <button
              onClick={handleCopyAddress}
              id="btn-copy-address-compact"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-church-navy/60 hover:text-church-gold transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-green-600 animate-scale" />
                  <span className="text-green-600 font-semibold">Endereço Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-church-gold" />
                  <span>Copiar endereço</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Route Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="link-google-maps-compact"
              className="inline-flex items-center gap-1.5 rounded-lg bg-church-navy hover:bg-church-navy/95 text-white px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 cursor-pointer border border-white/5"
            >
              <Compass className="h-3 w-3 text-church-gold" />
              <span>Google Maps</span>
            </a>
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="link-waze-compact"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#05c4e3] hover:bg-[#05c4e3]/90 text-white px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
            >
              <Navigation className="h-3 w-3 text-white" />
              <span>Waze GPS</span>
            </a>
          </div>
        </div>

        {/* Right Side: Ultra Compact Map Frame */}
        <div className="md:col-span-6 lg:col-span-7 h-[150px] md:h-[135px] relative rounded-xl border border-church-gold/10 overflow-hidden shadow-inner bg-church-cream/5">
          <iframe
            src={embedMapUrl}
            title="Localização AD Tenda da Promessa Fazenda Rio Grande"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen={true}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 w-full h-full"
          />
        </div>

      </div>
    </motion.section>
  );
}
