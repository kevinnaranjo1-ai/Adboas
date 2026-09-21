import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogIn, Download, X, Smartphone, Share, Plus, MoreVertical, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from '../components/Logo';
import { useState, useEffect } from 'react';

export default function Login() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAlreadyInstalled, setIsAlreadyInstalled] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'desktop'>('ios');

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
    setIsAlreadyInstalled(isStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsAlreadyInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Auto detect user platform to set default tab
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (/android/.test(userAgent)) {
        setActiveTab('android');
      } else if (/iphone|ipad|ipod/.test(userAgent)) {
        setActiveTab('ios');
      } else {
        setActiveTab('desktop');
      }
      setShowInstructions(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-church-cream p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl border border-church-gold/20"
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-church-navy/5 p-2">
              <Logo 
                size={96} 
                className="border-2 border-church-gold/30 shadow-md" 
              />
            </div>
          </div>
          <h1 className="font-serif text-3xl font-bold text-church-navy">
            AD Boas Novas
          </h1>
          <p className="text-sm font-medium text-church-navy/60 uppercase tracking-widest">
            Tenda da Promessa
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-church-navy px-4 py-3.5 font-bold text-white shadow-lg transition-all hover:bg-church-navy/90 hover:shadow-xl active:scale-95 cursor-pointer text-sm"
          >
            <LogIn className="h-5 w-5" />
            Entrar com Google
          </button>

          {!isAlreadyInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-church-gold bg-church-gold/10 hover:bg-church-gold/20 active:scale-95 px-4 py-3 font-black text-church-navy transition-all cursor-pointer text-xs uppercase"
            >
              <Download className="h-4.5 w-4.5 text-church-gold shrink-0 animate-bounce" />
              Instalar Aplicativo Oficial
            </button>
          )}

          {isAlreadyInstalled && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 px-4 py-2 text-xs font-bold text-green-700">
              <Check className="h-4 w-4 shrink-0" />
              Aplicativo Instalado no Mobile
            </div>
          )}
        </div>
      </motion.div>

      {/* Instructional Modal Overlay */}
      <AnimatePresence>
        {showInstructions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-church-navy/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl border border-church-gold/20 space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-church-gold/10 pb-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-church-gold" />
                  <h3 className="font-serif text-lg font-bold text-church-navy">Instalar Aplicativo</h3>
                </div>
                <button
                  onClick={() => setShowInstructions(false)}
                  className="rounded-lg p-1.5 hover:bg-church-navy/5 text-church-navy/40 hover:text-church-navy transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1.5 p-1 rounded-xl bg-church-navy/5">
                <button
                  onClick={() => setActiveTab('ios')}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer ${
                    activeTab === 'ios'
                      ? 'bg-white text-church-navy shadow-sm border border-church-gold/10'
                      : 'text-church-navy/50 hover:text-church-navy'
                  }`}
                >
                  iPhone (iOS)
                </button>
                <button
                  onClick={() => setActiveTab('android')}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer ${
                    activeTab === 'android'
                      ? 'bg-white text-church-navy shadow-sm border border-church-gold/10'
                      : 'text-church-navy/50 hover:text-church-navy'
                  }`}
                >
                  Android
                </button>
                <button
                  onClick={() => setActiveTab('desktop')}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer ${
                    activeTab === 'desktop'
                      ? 'bg-white text-church-navy shadow-sm border border-church-gold/10'
                      : 'text-church-navy/50 hover:text-church-navy'
                  }`}
                >
                  Computador
                </button>
              </div>

              {/* Instructions steps */}
              <div className="space-y-4 text-sm text-church-navy/80 min-h-[220px]">
                {activeTab === 'ios' ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-church-gold uppercase tracking-wider mb-1">No Safari (iPhone):</p>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">1</div>
                      <p className="text-xs leading-relaxed">Abra o site no navegador oficial <span className="font-bold">Safari</span>.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">2</div>
                      <p className="text-xs leading-relaxed">
                        Toque no botão de <span className="font-bold">Compartilhar</span> <Share className="inline h-4 w-4 mx-1 text-church-gold shrink-0 bg-church-navy/5 rounded p-0.5" /> (o ícone de quadrado com seta para cima na barra inferior).
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">3</div>
                      <p className="text-xs leading-relaxed">
                        Role a tela e selecione <span className="font-bold">Adicionar à Tela de Início</span> <Plus className="inline h-4 w-4 mx-1 text-church-gold shrink-0 bg-church-navy/5 rounded p-0.5" />.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">4</div>
                      <p className="text-xs leading-relaxed">Toque em <span className="font-bold">Adicionar</span> no canto superior direito para finalizar.</p>
                    </div>
                  </div>
                ) : activeTab === 'android' ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-church-gold uppercase tracking-wider mb-1">No Chrome (Android):</p>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">1</div>
                      <p className="text-xs leading-relaxed">Abra o site usando o <span className="font-bold">Google Chrome</span>.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">2</div>
                      <p className="text-xs leading-relaxed">
                        Toque no botão de menu <span className="font-bold">três pontinhos</span> <MoreVertical className="inline h-4 w-4 mx-1 text-church-gold shrink-0 bg-church-navy/5 rounded p-0.5" /> no canto superior direito.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">3</div>
                      <p className="text-xs leading-relaxed">Selecione <span className="font-bold">Instalar aplicativo</span> ou <span className="font-bold">Adicionar à tela inicial</span>.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">4</div>
                      <p className="text-xs leading-relaxed">Confirme na tela e o aplicativo será instalado instantaneamente!</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-church-gold uppercase tracking-wider mb-1">No Computador (Chrome/Edge/Safari):</p>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">1</div>
                      <p className="text-xs leading-relaxed">Na barra de endereços (URL) no topo do navegador, procure pelo ícone de monitor com seta para baixo no lado direito.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">2</div>
                      <p className="text-xs leading-relaxed">Toque nesse ícone e clique em <span className="font-bold">Instalar</span>.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">3</div>
                      <p className="text-xs leading-relaxed">
                        Se preferir, clique nas opções <span className="font-bold">três pontinhos</span> <MoreVertical className="inline h-4 w-4 mx-1 text-church-gold shrink-0 bg-church-navy/5 rounded p-0.5" /> da barra superior e escolha <span className="font-bold">Salvar e compartilhar</span> e então <span className="font-bold">Instalar aplicativo</span>.
                      </p>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-church-navy/5 text-[11px] font-bold text-church-navy">4</div>
                      <p className="text-xs leading-relaxed">No Safari (Mac), use o menu <span className="font-bold">Compartilhar</span> <Share className="inline h-4 w-4 mx-1 text-church-gold shrink-0 bg-church-navy/5 rounded p-0.5" /> e escolha <span className="font-bold">Adicionar ao Dock</span>.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action */}
              <button
                onClick={() => setShowInstructions(false)}
                className="flex w-full items-center justify-center rounded-xl bg-church-navy px-4 py-3 font-semibold text-white shadow-md hover:bg-church-navy/90 transition-all cursor-pointer text-xs uppercase tracking-wider"
              >
                Entendi, fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
