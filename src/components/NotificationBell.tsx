import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckSquare, MailOpen, Calendar, HelpCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { sendSystemNotification } from '../lib/notifications';

interface NotificationBellProps {
  userId: string;
  userRole: string | null;
}

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type?: string;
  createdAt?: any;
  senderName?: string;
  senderId?: string;
  reportId?: string;
  roles?: string[];
  readBy?: string[];
  targetUserId?: string;
  targetGroup?: string;
  targetGroupLabel?: string;
  targetUrl?: string;
}

export default function NotificationBell({ userId, userRole }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isInitialLoad = useRef(true);
  const notificationsRef = useRef<AppNotification[]>([]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Subscreve às notificações do Firestore em tempo real
  useEffect(() => {
    if (!userId || !userRole) return;

    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AppNotification[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        // Verifica se o usuário atual já limpou/excluiu esta notificação
        const clearedBy = data.clearedBy || [];
        if (clearedBy.includes(userId)) {
          return;
        }
        
        // Normaliza e limpa as roles para comparação robusta
        const roles = (data.roles || []).map((r: string) => r.toLowerCase().trim());
        const currentUserRoleLower = userRole.toLowerCase().trim();
        const targetGroup = data.targetGroup || 'todos';
        
        // Verifica se a notificação é destinada ao usuário atual
        const isTargeted = 
          targetGroup === 'todos' ||
          roles.length === 0 ||
          roles.includes(currentUserRoleLower) || 
          currentUserRoleLower === 'admin' || 
          currentUserRoleLower === 'pastor' || 
          currentUserRoleLower === 'pastora' ||
          (targetGroup === 'midia' && currentUserRoleLower === 'mídia social') ||
          (targetGroup === 'obreiros' && ['obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'leader'].includes(currentUserRoleLower));
        
        if (isTargeted) {
          items.push({
            id: docSnap.id,
            ...data
          } as AppNotification);
        }
      });

      // Se não for o carregamento inicial, envia alertas visuais reais na tela do admin do relatório recebido
      if (!isInitialLoad.current) {
        const previousIds = notificationsRef.current.map((n) => n.id);
        const newlyAdded = items.filter((n) => !previousIds.includes(n.id));

        newlyAdded.forEach((newNotify) => {
          const isUnread = !newNotify.readBy || !newNotify.readBy.includes(userId);
          if (isUnread) {
            let targetUrl = '/';
            if (newNotify.type === 'new_report') targetUrl = '/admin';
            else if (newNotify.type === 'prayer_request') targetUrl = '/oracao';
            else if (newNotify.type === 'study_publish') targetUrl = '/estudos';

            sendSystemNotification(newNotify.title, newNotify.body, targetUrl);
          }
        });
      }

      notificationsRef.current = items;
      setNotifications(items);
      isInitialLoad.current = false;
    }, (error) => {
      console.error('Erro ao escutar notificações:', error);
    });

    return () => unsubscribe();
  }, [userId, userRole]);

  // Filtra as notificações não lidas por este usuário
  const unreadNotifications = notifications.filter(
    (n) => !n.readBy || !n.readBy.includes(userId)
  );

  // Marca uma única notificação como lida
  const markAsRead = async (id: string) => {
    try {
      const notifyRef = doc(db, 'notifications', id);
      await updateDoc(notifyRef, {
        readBy: arrayUnion(userId)
      });
    } catch (err) {
      console.error('Erro ao marcar como lida:', err);
    }
  };

  // Marca todas as notificações exibidas como lidas
  const markAllAsRead = async () => {
    if (unreadNotifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      unreadNotifications.forEach((n) => {
        const ref = doc(db, 'notifications', n.id);
        batch.update(ref, {
          readBy: arrayUnion(userId)
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
    }
  };

  // Limpa (exclui de vista) todas as notificações para o usuário atual
  const clearAllNotifications = async () => {
    if (notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        const ref = doc(db, 'notifications', n.id);
        batch.update(ref, {
          clearedBy: arrayUnion(userId)
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Erro ao limpar notificações:', err);
    }
  };

  // Formata data de forma amigável
  const formatTime = (createdAt: any) => {
    if (!createdAt) return 'Agora';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'numeric' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-xl p-2.5 text-church-navy hover:bg-church-navy/5 transition-colors focus:outline-none"
        title="Notificações"
      >
        <Bell className="h-5.5 w-5.5 text-church-navy" />
        {unreadNotifications.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
            {unreadNotifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed top-16 right-4 left-4 max-w-none md:absolute md:top-auto md:left-auto md:right-0 md:mt-2 md:w-96 rounded-2xl border border-church-gold/15 bg-white shadow-xl max-h-[480px] flex flex-col overflow-hidden z-50">
          <header className="flex items-center justify-between border-b border-church-gold/10 p-4 bg-church-cream/40">
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-church-navy">Notificações</span>
              {unreadNotifications.length > 0 && (
                <span className="rounded-full bg-church-navy/10 px-2 py-0.5 text-[10px] font-black text-church-navy">
                  {unreadNotifications.length} novas
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {unreadNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-bold text-church-gold hover:text-church-navy transition-colors cursor-pointer"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Lidas todas
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                  title="Limpar todas"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar
                </button>
              )}
            </div>
          </header>

          <div className="overflow-y-auto flex-1 divide-y divide-church-gold/5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-church-navy/40">
                <MailOpen className="h-8 w-8 text-church-gold/60 mb-2" />
                <p className="text-xs font-semibold">Tudo lido por aqui!</p>
                <p className="text-[10px] mt-0.5">As notificações sobre relatórios de líderes aparecerão aqui.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.readBy || !n.readBy.includes(userId);
                return (
                  <div
                    key={n.id}
                    className={`p-4 transition-colors flex gap-3 ${isUnread ? 'bg-church-gold/5' : 'hover:bg-church-navy/5'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-church-gold uppercase tracking-wider">
                          {n.type === 'new_report' ? 'Novo Relatório' : 
                           n.type === 'prayer_request' ? 'Pedido de Oração' : 
                           n.type === 'study_publish' ? 'Estudo Bíblico' : 
                           n.type === 'event_add' ? 'Agenda' : 
                           n.type === 'segmented_push' ? (`📣 ${n.targetGroupLabel || 'Aviso Segmentado'}`) : 'Aviso'}
                        </span>
                        <span className="text-[9px] text-church-navy/40 font-semibold font-mono">
                          {formatTime(n.createdAt)}
                        </span>
                      </div>
                      <h4 className={`text-xs mt-1 font-serif ${isUnread ? 'font-extrabold text-church-navy' : 'font-medium text-church-navy/60'}`}>
                        {n.title}
                      </h4>
                      <p className="text-[11px] text-church-navy/70 mt-1 leading-relaxed">
                        {n.body}
                      </p>
                      
                      {n.type === 'prayer_request' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                            setIsOpen(false);
                            navigate('/oracao');
                          }}
                          className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-church-gold hover:text-church-navy hover:underline cursor-pointer bg-church-cream/40 px-2 py-1 rounded-md"
                        >
                          Ir para Pedidos →
                        </button>
                      )}
                      {n.type === 'study_publish' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                            setIsOpen(false);
                            navigate('/estudos');
                          }}
                          className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-church-gold hover:text-church-navy hover:underline cursor-pointer bg-church-cream/40 px-2 py-1 rounded-md"
                        >
                          Ir para Estudos →
                        </button>
                      )}
                      {n.type === 'new_report' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                            setIsOpen(false);
                            navigate('/admin');
                          }}
                          className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-church-gold hover:text-church-navy hover:underline cursor-pointer bg-church-cream/40 px-2 py-1 rounded-md"
                        >
                          Ir para Relatórios →
                        </button>
                      )}
                      {n.type === 'event_add' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                            setIsOpen(false);
                            navigate('/admin/agenda');
                          }}
                          className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-church-gold hover:text-church-navy hover:underline cursor-pointer bg-church-cream/40 px-2 py-1 rounded-md"
                        >
                          Ir para Agenda →
                        </button>
                      )}
                      {n.type === 'video_publish' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                            setIsOpen(false);
                            navigate('/videos');
                          }}
                          className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-church-gold hover:text-church-navy hover:underline cursor-pointer bg-church-cream/40 px-2 py-1 rounded-md"
                        >
                          Ir para Vídeos →
                        </button>
                      )}
                      {n.type === 'birthday' && n.targetUserId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                            setIsOpen(false);
                            navigate(`/admin/membros?highlight=${n.targetUserId}`);
                          }}
                          className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-church-gold hover:text-church-navy hover:underline cursor-pointer bg-church-cream/40 px-2 py-1 rounded-md"
                        >
                          Parabenizar →
                        </button>
                      )}
                      {n.targetUrl && n.targetUrl !== '/' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                            setIsOpen(false);
                            navigate(n.targetUrl);
                          }}
                          className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-church-navy hover:text-church-gold hover:underline cursor-pointer bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300/50"
                        >
                          Ver Detalhes →
                        </button>
                      )}
                    </div>
                    {isUnread && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="self-center rounded-lg p-1.5 text-church-gold hover:text-church-navy hover:bg-church-navy/5 transition-all"
                        title="Marcar como lida"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
