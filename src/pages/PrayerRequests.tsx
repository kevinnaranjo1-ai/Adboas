import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, Plus, Trash2, Clock, Filter, CheckCircle2, 
  Phone, Shield, HelpCircle, HeartHandshake, Sparkles, User, 
  Send, Calendar, AlertCircle, RefreshCw
} from 'lucide-react';
import { 
  collection, addDoc, getDocs, updateDoc, doc, deleteDoc, 
  query, orderBy, serverTimestamp, getFirestore 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { createPrayerRequestNotification } from '../lib/notifications';

interface PrayerRequest {
  id: string;
  name: string;
  userId: string;
  content: string;
  phone?: string;
  isAnonymous: boolean;
  status: 'pending' | 'praying' | 'answered';
  category: string;
  prayersCount?: number;
  prayingUsers?: string[]; // list of userIds praying for this
  createdAt: any;
}

const CATEGORIES = [
  'Saúde & Cura',
  'Família & Lar',
  'Vida Financeira',
  'Vida Espiritual',
  'Libertação & Paz',
  'Crianças & Jovens',
  'Outros'
];

export default function PrayerRequests({ role }: { role: string | null }) {
  const [user] = useAuthState(auth);
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Form State
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formContent, setFormContent] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Vida Espiritual');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formIsAnonymous, setFormIsAnonymous] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isAdminOrPastor = role && ['admin', 'pastor', 'pastora'].includes(role);
  const isLeadershipUser = role && [
    'admin', 'pastor', 'pastora', 'leader', 'obreiro', 
    'presbítero', 'missionário', 'missionária', 'diácono', 
    'evangelista', 'diaconisa', 'mídia social'
  ].includes(role);

  // Fetch Prayer Requests
  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const q = query(collection(db, 'prayer_requests'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data: PrayerRequest[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data();
        data.push({
          id: docSnap.id,
          name: item.name || 'Anônimo',
          userId: item.userId || '',
          content: item.content || '',
          phone: item.phone || '',
          isAnonymous: !!item.isAnonymous,
          status: item.status || 'pending',
          category: item.category || 'Outros',
          prayersCount: item.prayersCount || 0,
          prayingUsers: item.prayingUsers || [],
          createdAt: item.createdAt ? item.createdAt.toDate() : new Date()
        });
      });
      setRequests(data);
    } catch (err) {
      console.error(err);
      setErrorMessage('Não foi possível carregar os pedidos de oração.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  // Handle support/clicking "Amém / Estou Orando"
  const handleIHavePrayed = async (requestId: string) => {
    if (!user) return;
    try {
      const clickedRequest = requests.find(r => r.id === requestId);
      if (!clickedRequest) return;

      const userList = clickedRequest.prayingUsers || [];
      const hasAlreadyPrayed = userList.includes(user.uid);

      let newPrayingUsers = [...userList];
      if (hasAlreadyPrayed) {
        // Remove
        newPrayingUsers = newPrayingUsers.filter(uid => uid !== user.uid);
      } else {
        // Add
        newPrayingUsers.push(user.uid);
      }

      const requestDocRef = doc(db, 'prayer_requests', requestId);
      await updateDoc(requestDocRef, {
        prayingUsers: newPrayingUsers,
        prayersCount: newPrayingUsers.length
      });

      // Update state locally
      setRequests(prev => prev.map(req => {
        if (req.id === requestId) {
          return {
            ...req,
            prayingUsers: newPrayingUsers,
            prayersCount: newPrayingUsers.length
          };
        }
        return req;
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `prayer_requests/${requestId}`);
    }
  };

  // Handle changing status to: pending | praying | answered
  const handleUpdateStatus = async (requestId: string, newStatus: 'pending' | 'praying' | 'answered') => {
    try {
      const requestDocRef = doc(db, 'prayer_requests', requestId);
      await updateDoc(requestDocRef, { status: newStatus });
      
      setRequests(prev => prev.map(req => {
        if (req.id === requestId) {
          return { ...req, status: newStatus };
        }
        return req;
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `prayer_requests/${requestId}`);
    }
  };

  // Handle Delete Request (own or admin)
  const handleDeleteRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'prayer_requests', requestId));
      setRequests(prev => prev.filter(req => req.id !== requestId));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `prayer_requests/${requestId}`);
    }
  };

  // Submit new request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formContent.trim()) {
      setErrorMessage('O conteúdo do pedido de oração não pode estar em branco.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const finalName = formIsAnonymous ? 'Anônimo' : (formName.trim() || user.displayName || 'Membro');
      const payload = {
        name: finalName,
        userId: user.uid,
        content: formContent,
        category: formCategory,
        phone: formPhone.trim(),
        isAnonymous: formIsAnonymous,
        status: 'pending' as const,
        prayersCount: 0,
        prayingUsers: [],
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'prayer_requests'), payload);
      
      // Envia notificação para pastores, admins e membros
      try {
        await createPrayerRequestNotification(finalName, formCategory, formContent);
      } catch (notifyErr) {
        console.warn('Erro ao enviar notificação de oração:', notifyErr);
      }
      
      // Update local state instantly with temp date
      const newReq: PrayerRequest = {
        id: docRef.id,
        ...payload,
        createdAt: new Date()
      };
      setRequests(prev => [newReq, ...prev]);

      // Reset
      setFormContent('');
      setFormPhone('');
      setFormIsAnonymous(false);
      setFormName('');
      setShowFormModal(false);
      setSuccessMessage('Pedido de oração enviado com sucesso! Estaremos intercedendo por você.');
      
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'prayer_requests');
      setErrorMessage('Ocorreu um erro ao enviar seu pedido de oração. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter computation
  const filteredRequests = requests.filter(req => {
    const matchesTab = activeTab === 'all' || req.userId === user?.uid;
    const matchesCategory = filterCategory === 'all' || req.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    return matchesTab && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6" id="pag-pedidos-oracao">
      {/* Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl lg:text-3xl font-extrabold text-church-navy">
            Pedidos de Oração
          </h1>
          <p className="text-sm text-church-navy/60">
            "Clame a mim e eu responderei e direi a você coisas grandiosas e insondáveis..." — Jeremias 33:3
          </p>
        </div>
        
        <button
          onClick={() => {
            setFormName(user?.displayName || '');
            setShowFormModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-church-gold hover:bg-church-gold/90 text-church-navy py-3 px-5 text-sm font-black shadow-md transition-all active:scale-95 cursor-pointer"
          id="btn-novo-pedido-oracao"
        >
          <Plus className="h-4 w-4" />
          <span>Fazer Pedido de Oração</span>
        </button>
      </div>

      {/* Stats/Information Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-church-gold/10 bg-gradient-to-br from-white to-church-cream/10 p-5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-church-gold/20 p-3 text-church-gold">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold font-serif text-church-navy">
              {requests.length}
            </p>
            <p className="text-xs text-church-navy/60 font-semibold uppercase tracking-wider">
              Total de Pedidos
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-church-gold/10 bg-gradient-to-br from-white to-church-cream/10 p-5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-red-100 p-3 text-red-600">
            <Heart className="h-6 w-6 fill-red-600 animate-pulse" />
          </div>
          <div>
            <p className="text-xl font-bold font-serif text-church-navy">
              {requests.filter(r => r.status === 'praying').length}
            </p>
            <p className="text-xs text-church-navy/60 font-semibold uppercase tracking-wider">
              Em Intercessão Ativa
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-church-gold/10 bg-gradient-to-br from-white to-church-cream/10 p-5 shadow-sm flex items-center gap-4">
          <div className="rounded-xl bg-green-100 p-3 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold font-serif text-church-navy">
              {requests.filter(r => r.status === 'answered').length}
            </p>
            <p className="text-xs text-church-navy/60 font-semibold uppercase tracking-wider">
              Bençãos Alcançadas / Testemunhos
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3 text-green-800 text-sm font-medium"
        >
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-center gap-3 text-red-800 text-sm font-medium"
        >
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </motion.div>
      )}

      {/* Tabs / Filters Section */}
      <div className="rounded-2xl border border-church-gold/10 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-church-gold/5 pb-4">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-church-navy text-white shadow-sm'
                  : 'bg-church-navy/5 text-church-navy/60 hover:bg-church-navy/10'
              }`}
            >
              Todos os Pedidos
            </button>
            <button
              onClick={() => setActiveTab('mine')}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'mine'
                  ? 'bg-church-navy text-white shadow-sm'
                  : 'bg-church-navy/5 text-church-navy/60 hover:bg-church-navy/10'
              }`}
            >
              Meus Pedidos
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-church-navy/60 font-bold">
              <Filter className="h-3.5 w-3.5 text-church-gold animate-pulse" />
              <span>Filtrar:</span>
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl border border-church-gold/15 bg-white px-3 py-1.5 text-xs font-medium text-church-navy outline-none focus:border-church-gold"
            >
              <option value="all">Todas as Áreas</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-church-gold/15 bg-white px-3 py-1.5 text-xs font-medium text-church-navy outline-none focus:border-church-gold"
            >
              <option value="all">Todos os Estados</option>
              <option value="pending">Aguardando intercessão</option>
              <option value="praying">Em oração ativa</option>
              <option value="answered">Respondido / Vitória</option>
            </select>

            <button
              onClick={fetchRequests}
              className="flex p-2 hover:bg-church-navy/5 rounded-xl text-church-navy/60 transition-colors cursor-pointer"
              title="Recarregar lista"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-church-gold mx-auto mb-2" />
            <p className="text-xs text-church-navy/50 font-bold uppercase tracking-wider">Carregando pedidos...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-church-cream/10 border border-dashed border-church-gold/10">
            <HelpCircle className="h-10 w-10 text-church-gold/50 mx-auto mb-3" />
            <h3 className="font-serif text-base font-bold text-church-navy mb-1">Nenhum pedido de oração encontrado</h3>
            <p className="text-xs text-church-navy/60 max-w-sm mx-auto">
              Que tal compartilhar seu motivo de oração ou mudar as opções de filtro para ver outros pedidos? Estamos prontos para interceder!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {filteredRequests.map((req) => {
                const userPrayed = req.prayingUsers?.includes(user?.uid || '');
                return (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`relative rounded-2xl border p-5 shadow-sm transition-all flex flex-col justify-between gap-4 ${
                      req.status === 'answered'
                        ? 'border-green-200 bg-gradient-to-br from-green-50/20 via-white to-green-50/5'
                        : req.status === 'praying'
                        ? 'border-church-gold/25 bg-gradient-to-br from-church-gold/5 via-white to-church-cream/5'
                        : 'border-church-gold/10 bg-white'
                    }`}
                  >
                    {/* Header: Area + Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-church-navy/5 px-2.5 py-0.5 text-[9px] font-extrabold tracking-widest text-church-navy uppercase">
                        {req.category}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {req.status === 'answered' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-black uppercase text-green-800">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Respondido!</span>
                          </span>
                        ) : req.status === 'praying' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800 animate-pulse">
                            <Heart className="h-3 w-3 fill-amber-600 text-amber-600" />
                            <span>Em Oração</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase text-blue-800">
                            <Clock className="h-3 w-3" />
                            <span>Aguardando</span>
                          </span>
                        )}
                        
                        {/* Admin Action Menu or Deletion */}
                        {(isLeadershipUser || req.userId === user?.uid) && (
                          <button
                            onClick={() => setDeleteConfirmId(req.id)}
                            className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                            title="Remover pedido de oração"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="space-y-2 flex-grow">
                      <p className="text-xs text-church-navy/80 whitespace-pre-wrap leading-relaxed italic font-serif">
                        "{req.content}"
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-church-navy/50 font-bold">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-church-gold" />
                          <span>{req.isAnonymous ? 'Pedido Anônimo' : req.name}</span>
                        </span>
                        
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{req.createdAt.toLocaleDateString('pt-BR')}</span>
                        </span>

                        {!req.isAnonymous && req.phone && (
                          <a 
                            href={`https://wa.me/55${req.phone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-1 text-green-600 hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            <span>Entrar em contato</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Pane */}
                    <div className="flex items-center justify-between pt-3 border-t border-church-gold/5">
                      {/* Intercession button */}
                      <button
                        onClick={() => handleIHavePrayed(req.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold tracking-wide uppercase transition-all duration-300 transform active:scale-95 cursor-pointer ${
                          userPrayed 
                            ? 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-200' 
                            : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        }`}
                        id={`btn-orar-oracao-${req.id}`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${userPrayed ? 'fill-current scale-110' : ''}`} />
                        <span>{userPrayed ? 'Orando! (Amém)' : 'Vou Orar por isso'}</span>
                        {req.prayersCount !== undefined && req.prayersCount > 0 && (
                          <span className="rounded-full bg-black/10 px-1.5 py-0.2 ml-1 text-[9px] font-bold">
                            {req.prayersCount}
                          </span>
                        )}
                      </button>

                      {/* Admin management tools */}
                      {isLeadershipUser && (
                        <div className="flex gap-1">
                          {req.status !== 'praying' && (
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'praying')}
                              className="rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                            >
                              Interceder
                            </button>
                          )}
                          {req.status !== 'answered' && (
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'answered')}
                              className="rounded-lg bg-green-50 hover:bg-green-100 text-green-700 hover:text-green-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                            >
                              Alcançado
                            </button>
                          )}
                          {req.status !== 'pending' && (
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'pending')}
                              className="rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-800 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                            >
                              Reiniciar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* NEW PRAYER REQUEST DIALOG MODAL */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFormModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl max-h-[90vh] flex flex-col"
            >
              {/* Gold Top Border & Header */}
              <div className="border-b border-church-gold/10 bg-church-navy px-6 py-4 text-white">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-church-gold/20 p-1.5 text-church-gold">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold">Fazer Pedido de Oração</h3>
                    <p className="text-[10px] text-white/60">Sua petição será guardada e levada ao altar de Deus</p>
                  </div>
                </div>
              </div>

              {/* Form container */}
              <form onSubmit={handleSubmitRequest} className="p-6 space-y-4 overflow-y-auto">
                {/* Content Section */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-church-navy">
                    Seu Pedido de Oração <span className="text-church-gold">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Escreva aqui seu motivo, intenção de oração ou agradecimento por testemunho..."
                    className="w-full rounded-2xl border border-church-gold/15 bg-church-cream/5 p-4 text-sm text-church-navy outline-none focus:border-church-gold ring-0 transition-all font-serif"
                    id="input-prayer-content"
                  />
                </div>

                {/* Grid for parameters */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Category select */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-church-navy">
                      Área do Pedido
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full rounded-2xl border border-church-gold/15 bg-white p-3 text-xs font-medium text-church-navy outline-none focus:border-church-gold cursor-pointer"
                      id="input-prayer-category"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Phone number */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-church-navy">
                      <span>WhatsApp (Opcional)</span>
                      <Shield className="h-3 w-3 text-church-gold" />
                    </label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="DDD + Número (ex: 41999999999)"
                      className="w-full rounded-2xl border border-church-gold/15 bg-white p-3 text-xs text-church-navy outline-none focus:border-church-gold"
                      id="input-prayer-phone"
                    />
                  </div>
                </div>

                {/* Anonymous switch / customized name */}
                <div className="space-y-3 bg-church-cream/10 p-3.5 rounded-2xl border border-church-gold/5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsAnonymous}
                      onChange={(e) => setFormIsAnonymous(e.target.checked)}
                      className="rounded border-church-gold text-church-navy accent-church-gold focus:ring-0 h-4 w-4"
                      id="input-prayer-anonymous"
                    />
                    <span className="text-xs font-bold text-church-navy">
                      Desejo enviar de forma Anônima
                    </span>
                  </label>

                  {!formIsAnonymous && (
                    <div className="pt-2 border-t border-church-gold/5 space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-church-navy/70">
                        Como deseja ser identificado(a)?
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full rounded-xl border border-church-gold/15 bg-white p-2.5 text-xs text-church-navy outline-none focus:border-church-gold"
                        id="input-prayer-name"
                      />
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex gap-3 pt-3 border-t border-church-gold/5">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="flex-1 rounded-2xl bg-gray-100 hover:bg-gray-200 py-3 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-2 rounded-2xl bg-church-gold hover:bg-church-gold/90 py-3 text-xs font-black uppercase tracking-wider text-church-navy flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                    id="btn-submit-prayer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Enviar Motivo</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl p-6 border border-church-gold/10 space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-red-100 p-2.5 text-red-600">
                  <AlertCircle className="h-6 w-6 shrink-0" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-church-navy">
                    Confirmar Exclusão
                  </h3>
                  <p className="text-xs text-church-navy/70 leading-relaxed mt-1">
                    Tem certeza que deseja remover permanentemente este pedido de oração? Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-church-gold/5">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 rounded-2xl bg-gray-100 hover:bg-gray-200 py-3 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRequest(deleteConfirmId)}
                  className="flex-1 rounded-2xl bg-red-600 hover:bg-red-700 py-3 text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer shadow-md"
                  id="btn-confirm-delete-prayer"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
