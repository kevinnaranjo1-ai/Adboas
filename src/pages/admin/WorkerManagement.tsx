import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, UserPlus, Search, Filter, Mail, Phone, 
  Calendar, CheckCircle2, XCircle, MoreVertical, 
  ChevronRight, ArrowLeft, Loader2, MessageCircle
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ptBR } from 'date-fns/locale';
import BirthdayPicker from '../../components/BirthdayPicker';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

interface Worker {
  id: string;
  name: string;
  email?: string;
  whatsapp: string;
  category: string;
  birthDate?: string;
  ministryStartDate?: string;
  isBaptizedInWater: boolean;
  isBaptizedInSpirit: boolean;
  isTither: boolean;
  status: 'active' | 'inactive';
  createdAt: any;
}

interface WorkerManagementProps {
  role: string | null;
}

export default function WorkerManagement({ role }: WorkerManagementProps) {
  const [user] = useAuthState(auth);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [workerToDeleteId, setWorkerToDeleteId] = useState<string | null>(null);
  
  const isPastorAdmin = useMemo(() => {
    return (role && ['admin', 'pastor', 'pastora'].includes(role)) || 
           user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
  }, [role, user]);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    category: 'Obreiro',
    birthDate: '',
    ministryStartDate: '',
    isBaptizedInWater: false,
    isBaptizedInSpirit: false,
    isTither: false,
    status: 'active' as 'active' | 'inactive'
  });

  useEffect(() => {
    const q = query(collection(db, 'workers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Worker[];
      setWorkers(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'workers');
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      whatsapp: '',
      category: 'Obreiro',
      birthDate: '',
      ministryStartDate: '',
      isBaptizedInWater: false,
      isBaptizedInSpirit: false,
      isTither: false,
      status: 'active'
    });
    setEditingWorkerId(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (worker: Worker) => {
    setFormData({
      name: worker.name,
      email: worker.email || '',
      whatsapp: worker.whatsapp || '',
      category: worker.category || 'Obreiro',
      birthDate: worker.birthDate || '',
      ministryStartDate: worker.ministryStartDate || '',
      isBaptizedInWater: worker.isBaptizedInWater,
      isBaptizedInSpirit: worker.isBaptizedInSpirit,
      isTither: worker.isTither,
      status: worker.status
    });
    setEditingWorkerId(worker.id);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWorkerId) {
        await updateDoc(doc(db, 'workers', editingWorkerId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'workers'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, editingWorkerId ? `workers/${editingWorkerId}` : 'workers');
    }
  };

  const handleDeleteWorker = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'workers', id));
      setActiveMenuId(null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `workers/${id}`);
    }
  };

  const getMinistryTime = (date?: string) => {
    if (!date) return 'Não informado';
    const start = new Date(date);
    const years = differenceInYears(new Date(), start);
    const months = differenceInMonths(new Date(), start) % 12;
    
    if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    return `${years} ${years === 1 ? 'ano' : 'anos'}${months > 0 ? ` e ${months} ${months === 1 ? 'mês' : 'meses'}` : ''}`;
  };

  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 p-4 lg:p-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black text-church-navy">Corpo de Obreiros</h1>
          <p className="text-church-navy/60">Gestão e registro do ministério e liderança</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 rounded-xl bg-church-navy px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <UserPlus className="h-4 w-4" /> Novo Obreiro
        </button>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-church-navy/30" />
          <input 
            type="text"
            placeholder="Buscar por nome ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-church-gold/10 bg-white pl-12 pr-4 py-3 placeholder:text-church-navy/20 focus:outline-none focus:ring-2 focus:ring-church-gold/20"
          />
        </div>
        <button className="flex items-center justify-center gap-2 rounded-2xl border border-church-gold/10 bg-white px-6 py-3 font-bold text-church-navy hover:bg-church-navy/5 transition-colors">
          <Filter className="h-4 w-4" /> Filtros
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-church-gold" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredWorkers.map((worker) => (
              <motion.div
                key={worker.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group relative rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm hover:shadow-md transition-all ${activeMenuId === worker.id ? 'z-20' : 'z-0'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-church-navy/5 text-church-navy">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                    worker.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-church-gold/10 text-church-navy/40'
                  }`}>
                    {worker.status === 'active' ? 'Ativo' : 'Inativo'}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-xl font-black text-church-navy">{worker.name}</h3>
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-church-navy text-[10px] font-bold uppercase py-0.5 px-2 text-white">
                        {worker.category}
                      </span>
                      {worker.birthDate && (
                        <span className="text-[10px] font-bold text-church-navy/40">
                          {differenceInYears(new Date(), new Date(worker.birthDate))} anos
                        </span>
                      )}
                    </div>
                    {worker.whatsapp && (
                      <a 
                        href={`https://wa.me/${worker.whatsapp.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:underline"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Tempo como Obreiro</p>
                    <p className="text-sm font-bold text-church-navy">{getMinistryTime(worker.ministryStartDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Batismo Águas</p>
                    <div className="flex items-center gap-1">
                      {worker.isBaptizedInWater ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-church-navy/20" />
                      )}
                      <span className="text-sm font-bold text-church-navy">{worker.isBaptizedInWater ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Batismo No Espírito</p>
                    <div className="flex items-center gap-1">
                       <span className={`h-1.5 w-1.5 rounded-full ${worker.isBaptizedInSpirit ? 'bg-church-gold' : 'bg-church-navy/10'}`} />
                       <span className="font-bold text-church-navy">{worker.isBaptizedInSpirit ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Dizimista</p>
                    <div className="flex items-center gap-1">
                       <span className={`h-1.5 w-1.5 rounded-full ${worker.isTither ? 'bg-green-500' : 'bg-church-navy/10'}`} />
                       <span className="font-bold text-church-navy">{worker.isTither ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-church-gold/5 pt-4">
                  <span className="text-xs text-church-navy/40">Registrado em {worker.createdAt ? format(worker.createdAt.toDate(), 'MM/yyyy') : '-'}</span>
                  <div className="relative">
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === worker.id ? null : worker.id)}
                      className="rounded-lg p-2 hover:bg-church-navy/5 text-church-navy/40 transition-colors"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {activeMenuId === worker.id && (
                      <div className="absolute bottom-full right-0 mb-2 w-32 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-church-navy/5 z-50">
                        <button 
                          onClick={() => handleOpenEditModal(worker)}
                          className="flex w-full items-center px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5 transition-colors"
                        >
                          Editar
                        </button>
                        {isPastorAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setWorkerToDeleteId(worker.id);
                              setActiveMenuId(null);
                            }}
                            className="flex w-full items-center px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border-t border-church-gold/5"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal de Adição/Edição */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-church-navy/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
            >
              <div className="bg-church-navy p-6 flex items-center justify-between shrink-0">
                <h2 className="font-serif text-xl font-bold text-white">
                  {editingWorkerId ? 'Editar Obreiro' : 'Cadastrar Novo Obreiro'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-white/60 hover:text-white"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 overflow-y-auto">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60">Nome Completo</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60">WhatsApp / Telefone</label>
                    <input 
                      required
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60">Categoria / Cargo</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none h-[50px] appearance-none"
                    >
                      <option value="Pastor">Pastor</option>
                      <option value="Pastora">Pastora</option>
                      <option value="Evangelista">Evangelista</option>
                      <option value="Missionário">Missionário</option>
                      <option value="Missionária">Missionária</option>
                      <option value="Presbítero">Presbítero</option>
                      <option value="Diácono">Diácono</option>
                      <option value="Obreiro">Obreiro</option>
                      <option value="Auxiliar">Auxiliar</option>
                    </select>
                  </div>
                  <BirthdayPicker 
                    label="Data de Nascimento"
                    value={formData.birthDate || ''}
                    onChange={(val) => setFormData({...formData, birthDate: val})}
                  />
                  <BirthdayPicker 
                    label="Início no Ministério"
                    value={formData.ministryStartDate || ''}
                    onChange={(val) => setFormData({...formData, ministryStartDate: val})}
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60">E-mail (Opcional)</label>
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <label className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl border border-church-gold/10 bg-church-cream/30 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={formData.isBaptizedInWater}
                      onChange={(e) => setFormData({...formData, isBaptizedInWater: e.target.checked})}
                      className="h-5 w-5 rounded border-church-gold text-church-navy focus:ring-church-gold"
                    />
                    <span className="text-[10px] sm:text-xs font-bold uppercase text-church-navy">Batizado Águas</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl border border-church-gold/10 bg-church-cream/30 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={formData.isBaptizedInSpirit}
                      onChange={(e) => setFormData({...formData, isBaptizedInSpirit: e.target.checked})}
                      className="h-5 w-5 rounded border-church-gold text-church-navy focus:ring-church-gold"
                    />
                    <span className="text-[10px] sm:text-xs font-bold uppercase text-church-navy text-balance leading-tight">Batismo No Espírito</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl border border-church-gold/10 bg-church-cream/30 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={formData.isTither}
                      onChange={(e) => setFormData({...formData, isTither: e.target.checked})}
                      className="h-5 w-5 rounded border-church-gold text-church-navy focus:ring-church-gold"
                    />
                    <span className="text-[10px] sm:text-xs font-bold uppercase text-church-navy text-balance leading-tight">Dizimista</span>
                  </label>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-church-navy/40">Status</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="w-full rounded-xl border border-church-gold/20 px-2 py-2 text-xs font-bold"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 sm:pt-6">
                  <button 
                    type="submit"
                    className="w-full rounded-2xl bg-church-navy py-4 font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-church-navy/90 active:scale-95"
                  >
                    {editingWorkerId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={workerToDeleteId !== null}
        onClose={() => setWorkerToDeleteId(null)}
        onConfirm={async () => {
          if (workerToDeleteId) {
            await handleDeleteWorker(workerToDeleteId);
          }
        }}
        title="Excluir Obreiro"
        message="Tem certeza que deseja excluir este obreiro? Esta ação removerá permanentemente o registro de ministério e liderança correspondente."
      />
    </div>
  );
}
