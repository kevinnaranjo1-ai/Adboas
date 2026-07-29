import React, { useEffect, useRef, useState } from 'react';
import { Minimize2, Maximize2, X, Radio, Info, PictureInPicture2, Smartphone } from 'lucide-react';
import { useMiniPlayer } from '../../context/MiniPlayerContext';

export const GlobalMiniPlayer: React.FC = () => {
  const { playerState, isMinimized, toggleMinimize, closePlayer } = useMiniPlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const [isInPip, setIsInPip] = useState(false);
  const [playerSize, setPlayerSize] = useState<'md' | 'lg' | 'xl'>('md');

  useEffect(() => {
    if (playerState && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: playerState.title,
          artist: 'Portal Assembleia de Deus',
          album: 'Hinos, Pregações e Louvores',
          artwork: [
            { src: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?w=512&auto=format&fit=crop&q=80', sizes: '512x512', type: 'image/jpeg' }
          ]
        });
      } catch (err) {
        console.warn('MediaSession erro:', err);
      }
    }
  }, [playerState]);

  if (!playerState) return null;

  const triggerNativePiP = async () => {
    // 1. API moderna Document Picture-in-Picture (Chrome Desktop / Edge)
    if ('documentPictureInPicture' in window) {
      try {
        // @ts-ignore
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 480,
          height: 270,
        });

        setIsInPip(true);

        const style = pipWindow.document.createElement('style');
        style.textContent = `
          * { box-sizing: border-box; }
          body { margin: 0; background: #0b1a30; display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
          .pip-header { background: #0b1a30; color: #d4af37; padding: 6px 12px; font-size: 11px; font-weight: bold; border-bottom: 1px solid rgba(212,175,55,0.3); display: flex; align-items: center; justify-content: space-between; z-index: 10; flex-shrink: 0; }
          .pip-content { flex: 1; position: relative; background: #000; width: 100%; height: 100%; display: flex; }
          .pip-content > div { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; display: block !important; opacity: 1 !important; pointer-events: auto !important; }
          iframe { width: 100% !important; height: 100% !important; border: none; display: block; }
        `;
        pipWindow.document.head.appendChild(style);

        const header = pipWindow.document.createElement('div');
        header.className = 'pip-header';
        const titleShort = playerState.title.length > 38 ? playerState.title.slice(0, 38) + '...' : playerState.title;
        header.innerHTML = `<span>📻 AD PORTAL</span><span style="color:#fff;font-size:10px;">${titleShort}</span>`;
        pipWindow.document.body.appendChild(header);

        const content = pipWindow.document.createElement('div');
        content.className = 'pip-content';
        pipWindow.document.body.appendChild(content);

        if (iframeContainerRef.current) {
          content.appendChild(iframeContainerRef.current);
        }

        pipWindow.addEventListener('pagehide', () => {
          setIsInPip(false);
          if (iframeContainerRef.current && containerRef.current) {
            containerRef.current.appendChild(iframeContainerRef.current);
          }
        });
        return;
      } catch (err) {
        console.warn('Erro Document PiP:', err);
      }
    } else {
      alert("Seu dispositivo/navegador não suporta a API de Vídeo Flutuante nativa ainda. Tente usar o botão de tela cheia do próprio vídeo.");
    }
  };

  const isPiPSupported = 'documentPictureInPicture' in window;

  const sizeClasses = {
    md: 'sm:w-96',
    lg: 'sm:w-[480px]',
    xl: 'sm:w-[640px]'
  };

  const cycleSize = () => {
    setPlayerSize(prev => prev === 'md' ? 'lg' : prev === 'lg' ? 'xl' : 'md');
  };

  return (
    <div className={`fixed z-50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${isMinimized ? 'bottom-20 right-4 sm:bottom-4' : `bottom-4 right-4 left-4 sm:left-auto ${sizeClasses[playerSize]}`}`}>
      
      <div 
        className={`bg-church-navy rounded-full shadow-xl border-2 border-church-gold text-white p-2 flex items-center gap-2 cursor-pointer hover:bg-church-navy/90 ${isMinimized ? 'block' : 'hidden'}`}
        onClick={toggleMinimize}
        title="Expandir Vídeo"
      >
         <div className="flex h-3 w-3 relative shrink-0 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-church-gold opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-church-gold"></span>
         </div>
         <span className="text-[10px] uppercase font-bold tracking-wider text-church-gold pr-1">Tocando</span>
         <button
            onClick={(e) => { e.stopPropagation(); closePlayer(); }}
            className="p-1 rounded-full bg-red-500/20 text-red-300 hover:text-red-200 transition-colors"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
      </div>

      <div className={`bg-church-navy rounded-2xl shadow-2xl border-2 border-church-gold text-white ${isMinimized ? 'h-0 w-0 border-0 opacity-0 pointer-events-none overflow-hidden absolute' : 'block overflow-hidden'}`}>
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-church-navy border-b border-white/10">
          <div className="flex items-center gap-2.5 overflow-hidden pr-2">
            <div className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-church-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-church-gold"></span>
            </div>
            <div className="flex flex-col truncate">
              <span className="text-[9px] uppercase font-bold tracking-wider text-church-gold flex items-center gap-1">
                <Radio className="h-2.5 w-2.5" /> {isInPip ? "Flutuando no Sistema" : "2º Plano Ativo"}
              </span>
              <span className="text-xs font-bold truncate text-white">{playerState.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isPiPSupported && (
              <button
                onClick={triggerNativePiP}
                title="Ativar Janela Flutuante (Ficar flutuando sobre a tela do celular ou computador em qualquer app)"
                className="px-2.5 py-1 rounded-lg bg-church-gold text-church-navy font-bold text-[10px] hover:bg-church-gold/90 transition-transform active:scale-95 cursor-pointer flex items-center gap-1 shadow"
              >
                <PictureInPicture2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Flutuar</span>
              </button>
            )}
            <button
              onClick={cycleSize}
              title="Ajustar Tamanho"
              className="hidden sm:flex p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer text-[10px] font-bold items-center justify-center min-w-[28px]"
            >
              {playerSize === 'md' ? '1x' : playerSize === 'lg' ? '1.5x' : '2x'}
            </button>
            <button
              onClick={toggleMinimize}
              title={isMinimized ? "Expandir Vídeo" : "Minimizar (Apenas Áudio)"}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={closePlayer}
              title="Fechar Reprodução"
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-300 hover:text-red-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Barra de Instrução PiP */}
        {!isMinimized && !isInPip && isPiPSupported && (
          <div className="bg-church-gold/15 px-3 py-1.5 border-b border-church-gold/20 flex items-center justify-between gap-2 text-[11px] text-church-cream/90">
            <span className="flex items-center gap-1.5 truncate">
              <Smartphone className="h-3 w-3 text-church-gold shrink-0" />
              <span>Usar outros apps? Clique em <strong className="text-church-gold">Vídeo Flutuante</strong></span>
            </span>
            <button
              onClick={triggerNativePiP}
              className="text-[10px] bg-church-gold text-church-navy font-bold px-2 py-0.5 rounded shadow hover:bg-church-gold/90 transition-transform active:scale-95 shrink-0 cursor-pointer inline-flex items-center gap-1"
            >
              <PictureInPicture2 className="h-3 w-3" /> Flutuar
            </button>
          </div>
        )}

        {/* Video Container */}
        <div ref={containerRef} className="relative w-full">
          {isInPip && (
            <div className="aspect-video w-full bg-church-navy/95 flex flex-col items-center justify-center p-4 text-center border-t border-white/10 animate-in fade-in">
              <PictureInPicture2 className="h-10 w-10 text-church-gold animate-bounce mb-2" />
              <p className="text-sm font-bold text-white">Janela Flutuante Nativa Ativa</p>
              <p className="text-xs text-church-cream/80 mt-1 max-w-[260px]">
                O vídeo está flutuando sobre a tela do seu dispositivo. Você pode usar outros apps livremente!
              </p>
            </div>
          )}

          <div 
            ref={iframeContainerRef}
            className={
              isMinimized
                ? "h-0 w-0 opacity-0 pointer-events-none overflow-hidden absolute" 
                : isInPip ? "aspect-video w-full bg-black opacity-0 pointer-events-none absolute" : "aspect-video w-full bg-black relative"
            }
          >
            <iframe
              width="100%"
              height="100%"
              src={playerState.url}
              title={playerState.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
};



