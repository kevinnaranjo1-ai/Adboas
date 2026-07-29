import React, { useState } from 'react';
import { Sparkles, ArrowLeft, Share2, Plus, Trash2, ExternalLink, Video, Loader2, X, Search, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { createVideoLinkNotification } from '../lib/notifications';
import { useMiniPlayer } from '../context/MiniPlayerContext';

interface VideoPageProps {
  role?: string | null;
}

interface VideoLinkItem {
  id: string;
  title: string;
  url: string;
  platform: 'youtube' | 'facebook' | 'tiktok' | 'instagram' | 'other';
  description?: string;
  addedBy?: string;
}

export default function VideoPage({ role }: VideoPageProps) {
  const [user] = useAuthState(auth);
  const isAdmin = role && ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social'].includes(role);
  const { startPlaying } = useMiniPlayer();

  const linksQuery = query(collection(db, 'video_links'), orderBy('createdAt', 'desc'));
  const [linksSnap, linksLoading] = useCollection(linksQuery);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('harpa cristã louvores selecionados');
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    platform: 'facebook',
    description: ''
  });

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.url) return;
    setIsSubmitting(true);
    try {
      const addedAuthor = user?.displayName || user?.email || 'Liderança';
      await addDoc(collection(db, 'video_links'), {
        title: formData.title,
        url: formData.url.startsWith('http') ? formData.url : `https://${formData.url}`,
        platform: formData.platform,
        description: formData.description,
        addedBy: addedAuthor,
        createdAt: serverTimestamp()
      });

      createVideoLinkNotification(formData.title, formData.platform, addedAuthor).catch(err => {
        console.warn('Erro ao notificar publicação de vídeo:', err);
      });

      setIsModalOpen(false);
      setFormData({ title: '', url: '', platform: 'facebook', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'video_links');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteLink = async () => {
    if (!linkToDelete) return;
    try {
      await deleteDoc(doc(db, 'video_links', linkToDelete));
      setLinkToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `video_links/${linkToDelete}`);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveSearch(searchInput.trim());
    }
  };

  const getYoutubeEmbedUrl = (queryOrUrl: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = queryOrUrl.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
    }
    return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(queryOrUrl)}`;
  };

  const getPlatformStyle = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return { badge: 'bg-[#1877F2] text-white', border: 'hover:border-[#1877F2]/50', label: 'Facebook', icon: '🔵' };
      case 'tiktok':
        return { badge: 'bg-black text-white border border-gray-800', border: 'hover:border-black/50', label: 'TikTok', icon: '🎵' };
      case 'youtube':
        return { badge: 'bg-[#FF0000] text-white', border: 'hover:border-[#FF0000]/50', label: 'YouTube', icon: '▶️' };
      case 'instagram':
        return { badge: 'bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 text-white', border: 'hover:border-pink-500/50', label: 'Instagram', icon: '📸' };
      default:
        return { badge: 'bg-church-navy text-white', border: 'hover:border-church-navy/50', label: 'Link Exclusivo', icon: '🔗' };
    }
  };

  return (
    <div className="min-h-screen bg-church-cream p-4 md:p-8 pb-24">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-church-gold/20 text-church-navy font-bold text-xs uppercase tracking-wider hover:bg-church-gold/10 transition-colors shadow-sm">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Início
          </Link>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2 py-4"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-church-gold/15 border border-church-gold/30 text-church-navy font-bold text-xs uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-church-gold animate-spin" /> Transmissões & Playlists
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-church-navy">
            Vídeos e Transmissões
          </h1>
          <p className="text-church-navy/70 text-sm md:text-base max-w-xl mx-auto font-medium">
            Acompanhe nossas mensagens postadas, cultos ao vivo e louvores selecionados para edificação espiritual.
          </p>
        </motion.div>

        {/* Banner Siga o Pastor Luiz */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-r from-blue-950 via-church-navy to-blue-900 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-blue-400/30 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 font-bold text-xs uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" /> Cultos ao Vivo
            </div>
            <h3 className="font-serif text-2xl md:text-3xl font-bold text-white">
              Siga nosso Pastor Luiz Farias
            </h3>
            <p className="text-blue-100 text-sm max-w-xl">
              Para assistir aos nossos cultos ao vivo e receber palavras abençoadas, siga nosso Pastor Luiz no Facebook.
            </p>
          </div>
          <a
            href="https://www.facebook.com/luiz.farias.9809"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 bg-white text-blue-950 px-6 py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-50 transition-all transform hover:scale-105 shrink-0 text-sm md:text-base w-full md:w-auto"
          >
            <Share2 className="h-5 w-5 text-blue-600" />
            Assistir Cultos ao Vivo
          </a>
        </motion.div>

        {/* Seção: Buscador de Vídeos do YouTube */}
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-church-gold/20 space-y-6"
        >
          <div className="border-b border-church-navy/10 pb-5">
            <h2 className="font-serif text-2xl font-bold text-church-navy flex items-center gap-2">
              <Search className="h-6 w-6 text-church-gold" /> Buscador do YouTube (Sem Sair do Site)
            </h2>
            <p className="text-church-navy/60 text-xs sm:text-sm mt-1">
              Cole um link direto do YouTube para assistir no player abaixo Sem Anúncios.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-church-navy/40" />
              <input
                type="text"
                placeholder="Cole o link direto do YouTube (ex: https://youtu.be/...) ou digite o nome"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-church-navy/20 bg-church-cream/30 text-church-navy text-sm font-medium focus:outline-none focus:border-church-gold transition-colors"
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-church-navy text-white font-bold text-sm hover:bg-church-navy/90 transition-transform active:scale-95 shadow-md cursor-pointer flex-1 sm:flex-initial"
              >
                <Search className="h-4 w-4 text-church-gold" /> Assistir
              </button>
              <button
                type="button"
                onClick={() => {
                  const queryToPlay = searchInput.trim() || activeSearch;
                  startPlaying(getYoutubeEmbedUrl(queryToPlay), queryToPlay);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-church-gold text-church-navy font-bold text-sm hover:bg-church-gold/90 transition-transform active:scale-95 shadow-md cursor-pointer flex-1 sm:flex-initial"
                title="Tocar em segundo plano no miniplayer flutuante para continuar ouvindo enquanto navega pelo site"
              >
                <Radio className="h-4 w-4 text-church-navy animate-pulse" /> 2º Plano
              </button>
            </div>
          </form>

          {/* Player Embutido do YouTube */}
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-inner border border-church-navy/10">
            <iframe
              width="100%"
              height="100%"
              src={getYoutubeEmbedUrl(activeSearch)}
              title="YouTube Search Player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </motion.section>

        {/* Seção: Links de Vídeos Compartilhados (Facebook, TikTok, YouTube, etc.) */}
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-church-gold/20 space-y-6"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-church-navy/10 pb-5">
            <div>
              <h2 className="font-serif text-2xl font-bold text-church-navy flex items-center gap-2">
                <Video className="h-6 w-6 text-church-gold" /> Links e Vídeos Compartilhados
              </h2>
              <p className="text-church-navy/60 text-xs sm:text-sm mt-1">
                Acesse mensagens, pregações e louvores postados pela nossa liderança nas redes sociais.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-church-gold text-church-navy font-extrabold text-xs uppercase tracking-wider hover:bg-church-gold/90 transition-all shadow-md shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Postar Link
              </button>
            )}
          </div>

          {linksLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 text-church-gold animate-spin" />
            </div>
          ) : !linksSnap || linksSnap.empty ? (
            <div className="text-center py-12 bg-church-cream/40 rounded-2xl border border-dashed border-church-navy/10 p-6 space-y-3">
              <div className="text-4xl">📱</div>
              <h3 className="font-serif text-lg font-bold text-church-navy">Nenhum link postado ainda</h3>
              <p className="text-church-navy/60 text-sm max-w-sm mx-auto">
                {isAdmin 
                  ? 'Clique em "Postar Link" acima para compartilhar vídeos do Facebook, TikTok, YouTube ou Instagram com a igreja.'
                  : 'Em breve os líderes e obreiros postarão novos links de vídeos aqui.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {linksSnap.docs.map((docSnap) => {
                const item = { id: docSnap.id, ...docSnap.data() } as VideoLinkItem;
                const style = getPlatformStyle(item.platform);
                return (
                  <div 
                    key={item.id}
                    className={`bg-church-cream/30 rounded-2xl p-5 border border-church-navy/10 transition-all flex flex-col justify-between gap-4 ${style.border}`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${style.badge}`}>
                          <span>{style.icon}</span> {style.label}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setLinkToDelete(item.id)}
                            title="Excluir Link"
                            className="p-1.5 rounded-lg text-church-navy/40 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <h3 className="font-serif font-bold text-church-navy text-lg leading-snug">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-church-navy/70 text-xs sm:text-sm line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-church-navy/5 flex items-center justify-between text-xs text-church-navy/50">
                      <span>Por: {item.addedBy || 'Liderança'}</span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-church-navy text-white font-bold hover:bg-church-navy/90 transition-transform active:scale-95 shadow-sm text-xs"
                      >
                        Assistir Agora <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Modal: Adicionar Link de Vídeo */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-church-gold/20 relative space-y-5"
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-6 right-6 p-2 rounded-full text-church-navy/40 hover:text-church-navy hover:bg-church-cream transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-church-gold/15 text-church-navy font-bold text-[10px] uppercase tracking-wider">
                    <Plus className="h-3 w-3 text-church-gold" /> Nova Postagem
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-church-navy">
                    Compartilhar Link de Vídeo
                  </h3>
                  <p className="text-church-navy/60 text-xs sm:text-sm">
                    Cole o link do Facebook, TikTok, YouTube ou Instagram para que os obreiros e membros assistam.
                  </p>
                </div>

                <form onSubmit={handleAddLink} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-church-navy/80 mb-1">
                      Plataforma *
                    </label>
                    <select
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-church-navy/20 bg-church-cream/30 text-church-navy text-sm font-bold focus:outline-none focus:border-church-gold"
                    >
                      <option value="facebook">🔵 Facebook (Cultos ao Vivo, Reels, Postagens)</option>
                      <option value="tiktok">🎵 TikTok (Vídeos curtos)</option>
                      <option value="youtube">▶️ YouTube (Mensagens, Cultos, Hinos)</option>
                      <option value="instagram">📸 Instagram (Reels, Cultos, IGTV)</option>
                      <option value="other">🔗 Outro link externo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-church-navy/80 mb-1">
                      Título do Vídeo ou Mensagem *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Culto da Vitória - Pr. Luiz Farias"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-church-navy/20 bg-white text-church-navy text-sm font-medium focus:outline-none focus:border-church-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-church-navy/80 mb-1">
                      Link / URL *
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://www.facebook.com/..."
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-church-navy/20 bg-white text-church-navy text-sm font-mono focus:outline-none focus:border-church-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-church-navy/80 mb-1">
                      Descrição ou Observação (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Assista a esta poderosa palavra ministrada nesta terça-feira..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-church-navy/20 bg-white text-church-navy text-sm font-medium focus:outline-none focus:border-church-gold resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 rounded-xl border border-church-navy/10 text-church-navy/70 font-bold text-xs uppercase tracking-wider hover:bg-church-cream transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-church-gold text-church-navy font-black text-xs uppercase tracking-wider hover:bg-church-gold/90 transition-all shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Postando...
                        </>
                      ) : (
                        'Compartilhar Agora'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Seção solicitada com o código de incorporação */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-xl border border-church-gold/20 overflow-hidden" 
          style={{ padding: '20px' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-2xl font-bold text-church-navy flex items-center gap-2.5">
              <span>📺</span> Vídeos e Transmissões
            </h2>
            <button
              onClick={() => startPlaying("https://www.youtube.com/embed/videoseries?list=PLW8w2IZEAxsUJ0fizojp4AUuAUWaOWm-g", "Vídeos e Transmissões")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-church-gold/20 hover:bg-church-gold text-church-navy font-bold text-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Radio className="h-3.5 w-3.5 text-church-navy" /> Reproduzir em 2º Plano
            </button>
          </div>
          <div className="w-full aspect-video md:h-[600px] rounded-2xl overflow-hidden bg-black shadow-inner border border-church-navy/10">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/videoseries?list=PLW8w2IZEAxsUJ0fizojp4AUuAUWaOWm-g"
              title="Vídeos e Transmissões"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen>
            </iframe>
          </div>
        </motion.section>

        {/* Segunda Lista Solicitada */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl shadow-xl border border-church-gold/20 overflow-hidden" 
          style={{ padding: '20px' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-2xl font-bold text-church-navy flex items-center gap-2.5">
              <span>🎶</span> Mais Louvores e Hinos
            </h2>
            <button
              onClick={() => startPlaying("https://www.youtube.com/embed/videoseries?list=PLzWjmBOf3rY3hAXmvMI1-W52a23u-3U4o", "Mais Louvores e Hinos")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-church-gold/20 hover:bg-church-gold text-church-navy font-bold text-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Radio className="h-3.5 w-3.5 text-church-navy" /> Reproduzir em 2º Plano
            </button>
          </div>
          <div className="w-full aspect-video md:h-[600px] rounded-2xl overflow-hidden bg-black shadow-inner border border-church-navy/10">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/videoseries?list=PLzWjmBOf3rY3hAXmvMI1-W52a23u-3U4o"
              title="Mais Louvores e Hinos"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen>
            </iframe>
          </div>
        </motion.section>

        {/* Fundo Musical para Oração */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-xl border border-church-gold/20 overflow-hidden" 
          style={{ padding: '20px' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-serif text-2xl font-bold text-church-navy flex items-center gap-2.5">
              <span>🙏</span> Fundo Musical para Oração
            </h2>
            <button
              onClick={() => startPlaying("https://www.youtube.com/embed/0igy6bQN0hI", "Fundo Musical para Oração")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-church-gold/20 hover:bg-church-gold text-church-navy font-bold text-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Radio className="h-3.5 w-3.5 text-church-navy" /> Reproduzir em 2º Plano
            </button>
          </div>
          <div className="w-full aspect-video md:h-[600px] rounded-2xl overflow-hidden bg-black shadow-inner border border-church-navy/10">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/0igy6bQN0hI"
              title="Fundo Musical para Oração"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen>
            </iframe>
          </div>
        </motion.section>
      </div>

      <DeleteConfirmationModal
        isOpen={!!linkToDelete}
        onClose={() => setLinkToDelete(null)}
        onConfirm={confirmDeleteLink}
        title="Excluir Link de Vídeo"
        message="Tem certeza de que deseja excluir este link de vídeo compartilhado?"
      />
    </div>
  );
}
