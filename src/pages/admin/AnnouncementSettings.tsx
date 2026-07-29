import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { createSegmentedNotification } from '../../lib/notifications';
import { 
  Megaphone, 
  Trash2, 
  Send, 
  Bell, 
  Radio, 
  Users, 
  Video, 
  Music, 
  Baby, 
  Shield, 
  Heart, 
  Sparkles, 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  RotateCcw,
  ExternalLink,
  Flame,
  Layers,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface SegmentGroup {
  id: string;
  name: string;
  description: string;
  roles: string[];
  icon: any;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

const SEGMENT_GROUPS: SegmentGroup[] = [
  {
    id: 'todos',
    name: 'Todos os Membros',
    description: 'Envia para toda a comunidade da igreja sem exceção',
    roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'],
    icon: Users,
    color: 'from-amber-500 to-orange-600',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    borderColor: 'border-amber-400'
  },
  {
    id: 'midia',
    name: 'Equipe de Mídia & Som',
    description: 'Apenas para responsáveis por som, transmissão, redes sociais e foto',
    roles: ['mídia social', 'admin', 'pastor'],
    icon: Video,
    color: 'from-purple-500 to-indigo-600',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    borderColor: 'border-purple-400'
  },
  {
    id: 'jovens',
    name: 'Ministério de Jovens',
    description: 'Direcionado para a mocidade, liderança jovem e adolescentes',
    roles: ['leader', 'membro'],
    icon: Flame,
    color: 'from-rose-500 to-red-600',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    borderColor: 'border-rose-400'
  },
  {
    id: 'louvor',
    name: 'Ministério de Louvor',
    description: 'Para instrumentistas, cantores, coral e equipe de adoração',
    roles: ['leader', 'membro'],
    icon: Music,
    color: 'from-blue-500 to-cyan-600',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    borderColor: 'border-blue-400'
  },
  {
    id: 'infantil',
    name: 'Ministério Infantil (EBD Kids)',
    description: 'Tias, professores do departamento infantil e pais',
    roles: ['leader', 'obreiro', 'membro'],
    icon: Baby,
    color: 'from-emerald-500 to-teal-600',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    borderColor: 'border-emerald-400'
  },
  {
    id: 'obreiros',
    name: 'Corpo de Obreiros & Líderes',
    description: 'Diáconos, diaconisas, presbíteros, evangelistas e missionários',
    roles: ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa'],
    icon: Shield,
    color: 'from-slate-700 to-slate-900',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    borderColor: 'border-slate-500'
  },
  {
    id: 'mulheres',
    name: 'Grupo de Mulheres',
    description: 'Círculo de Oração, Varotas e irmãs da igreja',
    roles: ['pastora', 'missionária', 'diaconisa', 'membro'],
    icon: Heart,
    color: 'from-pink-500 to-rose-600',
    badgeBg: 'bg-pink-100',
    badgeText: 'text-pink-800',
    borderColor: 'border-pink-400'
  },
  {
    id: 'casais',
    name: 'Ministério de Casais',
    description: 'Casais e famílias cadastradas na igreja',
    roles: ['membro', 'leader'],
    icon: Sparkles,
    color: 'from-amber-600 to-yellow-600',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    borderColor: 'border-amber-500'
  }
];

interface NotificationHistoryItem {
  id: string;
  title: string;
  body: string;
  type?: string;
  targetGroup?: string;
  targetGroupLabel?: string;
  category?: string;
  targetUrl?: string;
  senderName?: string;
  createdAt?: any;
}

export default function AnnouncementSettings() {
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [activeTab, setActiveTab] = useState<'push' | 'history' | 'banner'>('push');

  // Push notification state
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('todos');
  const [category, setCategory] = useState<string>('lembrete');
  const [targetUrl, setTargetUrl] = useState<string>('/admin/agenda');
  const [sendingPush, setSendingPush] = useState(false);
  const [pushSuccessToast, setPushSuccessToast] = useState(false);

  // History state
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('todos');

  // Global Banner state
  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerDescription, setBannerDescription] = useState('');
  const [bannerActive, setBannerActive] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  useEffect(() => {
    loadBannerAnnouncement();
    loadNotificationHistory();
  }, []);

  const loadBannerAnnouncement = async () => {
    try {
      const q = query(collection(db, 'settings'), where('type', '==', 'announcement'));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0];
        setAnnouncementId(docRef.id);
        const data = docRef.data();
        setBannerTitle(data.title || '');
        setBannerDescription(data.description || '');
        setBannerActive(data.active || false);
      }
    } catch (error) {
      console.error('Error loading announcement:', error);
    }
  };

  const loadNotificationHistory = async () => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const items: NotificationHistoryItem[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as NotificationHistoryItem);
      });
      setHistory(items);
    } catch (error) {
      console.error('Error loading notification history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) {
      alert('Por favor, preencha o título e a mensagem da notificação.');
      return;
    }

    setSendingPush(true);
    try {
      const targetGroupObj = SEGMENT_GROUPS.find(g => g.id === selectedGroup);
      
      await createSegmentedNotification({
        title: pushTitle,
        body: pushBody,
        targetGroup: selectedGroup,
        targetGroupLabel: targetGroupObj ? targetGroupObj.name : 'Geral',
        targetRoles: targetGroupObj ? targetGroupObj.roles : [],
        category,
        targetUrl,
        senderName: currentUser?.displayName || 'Liderança',
        senderId: currentUser?.uid || ''
      });

      setPushSuccessToast(true);
      setTimeout(() => setPushSuccessToast(false), 4000);

      // Limpa formulário
      setPushTitle('');
      setPushBody('');

      // Atualiza histórico
      await loadNotificationHistory();
    } catch (err) {
      console.error('Erro ao enviar notificação:', err);
      alert('Ocorreu um erro ao enviar a notificação push.');
    } finally {
      setSendingPush(false);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    if (!confirm('Deseja realmente remover esta notificação do histórico?')) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Erro ao excluir do histórico:', err);
      alert('Não foi possível excluir.');
    }
  };

  const handleResendNotification = (item: NotificationHistoryItem) => {
    setPushTitle(item.title);
    setPushBody(item.body);
    if (item.targetGroup) setSelectedGroup(item.targetGroup);
    if (item.category) setCategory(item.category);
    if (item.targetUrl) setTargetUrl(item.targetUrl);
    setActiveTab('push');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveBanner = async (shouldActivate: boolean = false) => {
    if (!bannerTitle.trim()) {
      alert('Por favor, informe um título para o aviso do topo.');
      return;
    }

    setSavingBanner(true);
    try {
      const isNowActive = shouldActivate ? true : bannerActive;

      if (announcementId) {
        await updateDoc(doc(db, 'settings', announcementId), {
          title: bannerTitle,
          description: bannerDescription,
          active: isNowActive,
          updatedAt: new Date()
        });
      } else {
        const docRef = await addDoc(collection(db, 'settings'), {
          type: 'announcement',
          title: bannerTitle,
          description: bannerDescription,
          active: isNowActive,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        setAnnouncementId(docRef.id);
      }
      
      setBannerActive(isNowActive);
      if (shouldActivate) {
        alert('Aviso do topo ativado e publicado!');
        navigate('/');
      } else {
        alert('Aviso salvo com sucesso!');
      }
    } catch (error) {
      console.error('Error saving announcement:', error);
      alert('Erro ao salvar o aviso.');
    } finally {
      setSavingBanner(false);
    }
  };

  const handleClearBanner = async () => {
    setBannerTitle('');
    setBannerDescription('');
    setBannerActive(false);
    if (announcementId) {
      await updateDoc(doc(db, 'settings', announcementId), {
        active: false,
        title: '',
        description: ''
      });
      alert('Aviso do topo desativado.');
    }
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          item.body.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesGroup = groupFilter === 'todos' || item.targetGroup === groupFilter;
    return matchesSearch && matchesGroup;
  });

  const selectedGroupObj = SEGMENT_GROUPS.find(g => g.id === selectedGroup) || SEGMENT_GROUPS[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-church-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-church-gold"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-church-gold font-serif">Comunicação Oficial</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-church-navy flex items-center gap-2.5 mt-1">
            <Radio className="h-7 w-7 text-church-gold shrink-0 animate-pulse" />
            <span>Notificações & Avisos App</span>
          </h1>
          <p className="text-xs sm:text-sm text-church-navy/60 mt-0.5">
            Envie lembretes e avisos push direcionados por departamento ou ative avisos globais.
          </p>
        </div>

        {/* Action counter badge */}
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/80 px-3.5 py-2 rounded-2xl shrink-0 self-start md:self-auto">
          <Bell className="h-4 w-4 text-church-gold" />
          <div className="text-xs">
            <span className="font-bold text-church-navy">{history.length}</span>
            <span className="text-slate-500 font-medium"> notificações no histórico</span>
          </div>
        </div>
      </header>

      {/* TABS SELECTOR */}
      <div className="flex p-1 rounded-2xl bg-slate-100 border border-slate-200 max-w-2xl gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('push')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'push'
              ? 'bg-church-navy text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Send className="h-4 w-4 text-church-gold" />
          <span>Enviar Push Segmentado</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-church-navy text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Clock className="h-4 w-4 text-church-gold" />
          <span>Histórico de Notificações</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('banner')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'banner'
              ? 'bg-church-navy text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Megaphone className="h-4 w-4 text-church-gold" />
          <span>Aviso Fixo no Topo</span>
        </button>
      </div>

      {/* TAB 1: ENVIAR PUSH SEGMENTADO */}
      {activeTab === 'push' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Form */}
          <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="h-5 w-5 text-church-gold" />
                <span>Nova Notificação Push Segmentada</span>
              </h2>
              <p className="text-xs text-slate-500">
                Selecione o grupo e insira os dados para alertar os membros direto no celular.
              </p>
            </div>

            <form onSubmit={handleSendPush} className="space-y-5 text-xs">
              {/* Seleção do Grupo de Destino */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block flex items-center justify-between">
                  <span>1. Escolha o Público-Alvo / Grupo *</span>
                  <span className="text-[10px] text-church-gold font-bold uppercase">{selectedGroupObj.name}</span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SEGMENT_GROUPS.map((group) => {
                    const GroupIcon = group.icon;
                    const isSelected = selectedGroup === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroup(group.id)}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? `bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-church-gold/50 scale-[1.02]`
                            : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/10 text-church-gold' : 'bg-white text-slate-700 border border-slate-200'}`}>
                            <GroupIcon className="h-4 w-4" />
                          </div>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-church-gold" />}
                        </div>
                        <div className="mt-2">
                          <span className="font-bold block text-[11px] leading-tight truncate">{group.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 leading-relaxed italic">
                  💡 {selectedGroupObj.description}
                </p>
              </div>

              {/* Categoria do Alerta */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">2. Categoria / Tipo de Alerta *</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'lembrete', label: '⏰ Lembrete de Ensaio/Escala' },
                    { id: 'reuniao', label: '🗣️ Reunião de Equipe' },
                    { id: 'urgente', label: '🚨 Comunicado Urgente' },
                    { id: 'evento', label: '📅 Evento / Culto' },
                    { id: 'geral', label: '💬 Recado Geral' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        category === cat.id
                          ? 'bg-church-gold text-church-navy border-church-gold shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Título da Notificação */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">3. Título da Notificação Push *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ensaio do Louvor e Mídia neste Sábado!"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-church-gold/50"
                />
              </div>

              {/* Conteúdo / Mensagem */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">4. Mensagem Completa / Lembrete *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Atenção equipe: teremos passagem de som às 18h30. Por favor, confirmem presença com a liderança..."
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-church-gold/50"
                />
              </div>

              {/* Destino ao Clicar */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">5. Para onde o membro vai ao clicar? (Opcional)</label>
                <select
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 cursor-pointer text-xs focus:outline-none focus:ring-2 focus:ring-church-gold/50"
                >
                  <option value="/admin/agenda">📅 Abrir Agenda e Calendário de Eventos</option>
                  <option value="/videos">📺 Abrir Vídeos e Transmissões</option>
                  <option value="/oracao">🙏 Abrir Pedidos de Oração</option>
                  <option value="/estudos">📚 Abrir Estudos e Ensinos</option>
                  <option value="/admin/ebd">🏫 Abrir Escola Bíblica (EBD)</option>
                  <option value="/admin/visitas-cultos">📋 Abrir Visitas & Cultos</option>
                  <option value="/">🏠 Abrir Tela Inicial do App</option>
                </select>
              </div>

              {/* Botão Enviar */}
              <button
                type="submit"
                disabled={sendingPush}
                className="w-full py-3.5 px-6 rounded-2xl bg-church-gold hover:bg-church-gold/90 text-church-navy font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {sendingPush ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-church-navy border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Disparar Notificação Push para {selectedGroupObj.name}</span>
              </button>
            </form>
          </div>

          {/* Device Live Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-church-gold" />
                  <span className="font-serif font-bold text-sm">Simulador de Tela do Celular</span>
                </div>
                <span className="text-[10px] bg-church-gold/20 text-church-gold px-2.5 py-0.5 rounded-full font-bold uppercase">
                  Pré-visualização
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Veja exatamente como a notificação push aparecerá para a equipe de <strong className="text-white">{selectedGroupObj.name}</strong>:
              </p>

              {/* Mockup Smartphone Screen */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>BOAS NOVAS PUSH</span>
                  <span>Agora</span>
                </div>

                <div className="p-3.5 bg-slate-900/90 border border-church-gold/30 rounded-2xl shadow-lg space-y-2 relative">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-church-gold/20 flex items-center justify-center text-church-gold shrink-0">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-bold text-church-gold uppercase tracking-wider block">
                        AD BOAS NOVAS • {selectedGroupObj.name.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-white leading-snug">
                    {pushTitle || 'Título da notificação aparecerá aqui...'}
                  </h4>

                  <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                    {pushBody || 'A mensagem enviada para o grupo selecionado será exibida neste espaço no celular do membro.'}
                  </p>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-bold text-church-gold">
                    <span>Clique para interagir</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/60 p-3.5 rounded-2xl text-[11px] text-slate-300 space-y-1 border border-slate-700/50">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Entrega em Tempo Real</span>
                </p>
                <p className="text-slate-400">
                  Ao disparar, todos os membros com o aplicativo aberto ou cadastrados no grupo receberão o alerta instantaneamente na barra do topo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTÓRICO DE NOTIFICAÇÕES */}
      {activeTab === 'history' && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-church-gold" />
                <span>Histórico de Notificações Enviadas</span>
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhe o registro de alertas enviados para os membros da igreja.
              </p>
            </div>

            <button
              onClick={loadNotificationHistory}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-church-navy bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="h-3.5 w-3.5 text-church-gold" />
              <span>Atualizar Histórico</span>
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por título ou conteúdo..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-church-gold/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-700 cursor-pointer"
              >
                <option value="todos">Todos os Grupos</option>
                {SEGMENT_GROUPS.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* History List */}
          {loadingHistory ? (
            <div className="flex items-center justify-center p-12 text-slate-400">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-church-gold border-t-transparent" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center p-12 text-slate-400 space-y-2">
              <Bell className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Nenhuma notificação encontrada.</p>
              <p className="text-[11px]">Envie um comunicado na aba "Enviar Push Segmentado".</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredHistory.map((item) => {
                const groupObj = SEGMENT_GROUPS.find(g => g.id === item.targetGroup);
                const formattedDate = item.createdAt?.toDate 
                  ? item.createdAt.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) 
                  : 'Data recente';

                return (
                  <div key={item.id} className="py-4 hover:bg-slate-50/60 transition-colors rounded-2xl p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${groupObj ? `${groupObj.badgeBg} ${groupObj.badgeText}` : 'bg-slate-100 text-slate-700'}`}>
                          {groupObj ? groupObj.name : (item.targetGroupLabel || 'Geral')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formattedDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleResendNotification(item)}
                          className="px-2.5 py-1 text-[11px] font-bold text-church-navy bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="Reenviar notificação"
                        >
                          <Send className="h-3 w-3" />
                          <span>Reenviar</span>
                        </button>

                        <button
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir histórico"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-serif text-xs font-bold text-slate-900">
                      {item.title}
                    </h4>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.body}
                    </p>

                    {item.senderName && (
                      <p className="text-[10px] text-slate-400 italic">
                        Enviado por: {item.senderName}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AVISO FIXO NO TOPO DO APP */}
      {activeTab === 'banner' && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl space-y-5"
        >
          <div>
            <h2 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-church-gold" />
              <span>Aviso Importante Global (Topo do App)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Configure um banner destacado que aparecerá no topo da tela inicial de todos os membros.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="mb-1 block font-bold text-slate-700">Título do Banner (Curto) *</label>
              <input
                type="text"
                required
                value={bannerTitle}
                onChange={(e) => setBannerTitle(e.target.value)}
                placeholder="Ex: Culto Especial de Ação de Graças neste Domingo!"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-church-gold focus:ring-1 focus:ring-church-gold"
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">Descrição Detalhada (Opcional)</label>
              <textarea
                value={bannerDescription}
                onChange={(e) => setBannerDescription(e.target.value)}
                placeholder="Ex: Teremos Santa Ceia e recepção de novos membros às 19:00. Venha com sua família..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-church-gold focus:ring-1 focus:ring-church-gold"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleSaveBanner(true)}
                disabled={savingBanner}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                {savingBanner ? 'Ativando...' : 'Ativar e Publicar Banner Global'}
              </button>

              <button
                onClick={handleClearBanner}
                type="button"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-red-500/20 px-6 py-3 font-bold text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                Desativar / Limpar
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Push success toast */}
      <AnimatePresence>
        {pushSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-500 text-xs font-bold"
          >
            <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
            <div>
              <p className="font-serif text-sm leading-tight">Notificação Enviada!</p>
              <p className="text-[11px] text-emerald-100 font-normal">O alerta push foi entregue ao grupo com sucesso.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
