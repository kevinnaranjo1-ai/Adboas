import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, DollarSign, Users, Shield, 
  Heart, BookOpen, FileText, Hammer, 
  Calendar, X, Camera, Download, Share2, Check, User, Music, Instagram, ClipboardList,
  Smartphone, Share, Plus, MoreVertical, Youtube, Baby, Store, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from '../Logo';
import { sendSystemNotification } from '../../lib/notifications';

interface SidebarProps {
  role: string | null;
  onClose?: () => void;
}

export default function AdminSidebar({ role, onClose }: SidebarProps) {
  const location = useLocation();
  const isPastorAdmin = role && ['admin', 'pastor', 'pastora'].includes(role);
  const isOfficer = role && ['leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social'].includes(role);
  const isMembro = role === 'membro';
  const showSidebar = isPastorAdmin || isOfficer || isMembro;

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'desktop'>('ios');

  useEffect(() => {
    // Check if app is running in standalone mode (PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      // @ts-ignore
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    
    if (isStandalone) {
      setIsInstalled(true);
    }

    // Listen to the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Track when the app has been successfully installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          setIsInstalled(true);
        }
      } catch (err) {
        console.error('Falha ao acionar prompt de instalação:', err);
      }
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

  const handleShareClick = async () => {
    const shareData = {
      title: 'Boas Novas',
      text: 'Acesse o aplicativo Boas Novas - Tenda da Promessa!',
      url: window.location.origin
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.origin);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2500);
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  const handleForceUpdateApp = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (let key of keys) {
          await caches.delete(key);
        }
      }
      window.location.reload();
    } catch (err) {
      window.location.reload();
    }
  };



  const menuItems = [
    { icon: LayoutDashboard, label: 'Início', path: '/', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: User, label: 'Meu Perfil', path: '/perfil', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: BookOpen, label: 'Bíblia Sagrada', path: '/biblia', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: Music, label: 'Harpa Cristã', path: '/harpa', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: Youtube, label: 'Vídeos e Transmissões', path: '/videos', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: Heart, label: 'Pedidos de Oração', path: '/oracao', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: BookOpen, label: 'Estudos e Ensinos', path: '/estudos', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: FileText, label: 'Minhas Anotações', path: '/anotacoes', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: Store, label: 'Empreendimentos & Serviços', path: '/empreendimentos', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: Shield, label: 'Painel Admin', path: '/admin', roles: ['admin', 'pastor', 'pastora'] },
    { icon: DollarSign, label: 'Financeiro', path: '/admin/financeiro', roles: ['admin', 'pastor', 'pastora'] },
    { icon: Users, label: 'Membros', path: '/admin/membros', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: Users, label: 'Visitantes', path: '/admin/visitantes', roles: ['admin', 'pastor', 'pastora', 'leader', 'diácono', 'obreiro'] },
    { icon: ClipboardList, label: 'Visitas & Cultos Realizados', path: '/admin/visitas-cultos', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: Baby, label: 'Apresentação Crianças', path: '/admin/apresentacao-criancas', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social'] },
    { icon: ClipboardList, label: 'Frequência de Cultos', path: '/admin/presenca', roles: ['admin', 'pastor', 'pastora'] },
    { icon: BookOpen, label: 'EBD', path: '/admin/ebd', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social'] },
    { icon: Shield, label: 'Obreiros', path: '/admin/obreiros', roles: ['admin', 'pastor', 'pastora'] },
    { icon: Heart, label: 'Relatório Espiritual', path: '/admin/espiritual', roles: ['admin', 'pastor', 'pastora'] },
    { icon: BookOpen, label: 'Departamentos', path: '/admin/departamentos', roles: ['admin', 'pastor', 'pastora'] },
    { icon: FileText, label: 'Relatório Pastoral', path: '/admin/pastoral', roles: ['admin', 'pastor', 'pastora'] },
    { icon: Hammer, label: 'Construção/Compras', path: '/admin/construcao', roles: ['admin', 'pastor', 'pastora'] },
    { icon: Calendar, label: 'Agenda', path: '/admin/agenda', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: Camera, label: 'Galeria de Fotos', path: '/admin/galeria', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'] },
    { icon: Smartphone, label: 'Notificações & Avisos', path: '/admin/avisos', roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social'] },
  ];

  if (!showSidebar) return null;

  return (
    <div className="flex h-full flex-col bg-church-navy text-white overflow-hidden">
      <div className="flex items-center justify-between p-6 shrink-0">
        <Link to="/" onClick={onClose} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <Logo 
            size={40} 
            className="border border-church-gold/30 shrink-0" 
          />
          <div className="text-left">
            <h2 className="font-serif text-lg font-bold leading-tight">Boas Novas</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-church-gold/60">TENDA DA PROMESSA</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto space-y-1 px-4 py-4 min-h-0 scrollbar-thin scrollbar-thumb-white/10">
        {menuItems.filter(item => item.roles.includes(role || '')).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-church-gold/10 text-church-gold shadow-sm' 
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`h-5 w-5 transition-colors ${isActive ? 'text-church-gold' : 'group-hover:text-white'}`} />
              {item.label}
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-church-gold"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Botões do Aplicativo (Instalar e Compartilhar) na Lateral */}
      <div className="px-4 py-3 border-t border-white/5 space-y-2 shrink-0">
        {!isInstalled && (
          <button
            onClick={handleInstallClick}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-church-gold hover:bg-church-gold/90 text-church-navy py-2.5 px-4 text-xs font-bold transition-all shadow active:scale-95 cursor-pointer"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>Instalar Aplicativo</span>
          </button>
        )}
        <button
          onClick={handleShareClick}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 text-church-gold hover:text-white py-2.5 px-4 text-xs font-bold border border-church-gold/15 transition-all active:scale-95 cursor-pointer"
        >
          <Share2 className="h-4 w-4 shrink-0" />
          <span>Compartilhar Aplicativo</span>
        </button>

        <button
          onClick={handleForceUpdateApp}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 py-2.5 px-4 text-xs font-bold border border-amber-500/20 transition-all active:scale-95 cursor-pointer"
          title="Forçar atualização e limpar cache do celular"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Atualizar Versão (Limpar Cache)</span>
        </button>

        <a
          href="https://www.instagram.com/ad.tenda.da.promessa?igsh=dGF0YWIydTVpcml5"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 hover:text-pink-300 py-2.5 px-4 text-xs font-bold border border-pink-500/15 transition-all active:scale-95 cursor-pointer"
        >
          <Instagram className="h-4 w-4 shrink-0" />
          <span>Seguir no Instagram</span>
        </a>
      </div>

      <div className="p-6 text-center shrink-0 border-t border-white/5 bg-white/[0.01]">
        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Ministério</p>
          <p className="mt-1 text-sm font-bold text-white/80">Assembleia de Deus</p>
        </div>
      </div>

      {/* Compartilhar Toast feedback */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-xs font-semibold shadow-lg border border-emerald-500/10"
          >
            <Check className="h-4 w-4" />
            <span>Link do app copiado!</span>
          </motion.div>
        )}

        {showInstructions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-church-navy/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl border border-church-gold/20 space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-church-gold/10 pb-4 text-left">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-church-gold" />
                  <h3 className="font-serif text-lg font-bold text-church-navy">Instalar Aplicativo</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstructions(false)}
                  className="rounded-lg p-1.5 hover:bg-church-navy/5 text-church-navy/40 hover:text-church-navy transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1.5 p-1 rounded-xl bg-church-navy/5">
                <button
                  type="button"
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
                  type="button"
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
                  type="button"
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
              <div className="space-y-4 text-sm text-church-navy/80 min-h-[220px] text-left">
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
                type="button"
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
