import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, Search, Filter, Mail, Phone, 
  Calendar, CheckCircle2, XCircle, MoreVertical, 
  ChevronRight, ArrowLeft, Loader2, IdCard, PenTool
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInYears } from 'date-fns';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ptBR } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';
import BirthdayPicker from '../../components/BirthdayPicker';
import MemberIDCardModal from '../../components/MemberIDCardModal';
import SignatureCanvas from '../../components/SignatureCanvas';
import { createNewMemberNotification } from '../../lib/notifications';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  cpf?: string;
  birthDate?: string;
  department?: string;
  position?: string;
  conversionDate?: string;
  isBaptized: boolean;
  isSpiritBaptized: boolean;
  isTither: boolean;
  status: 'active' | 'inactive' | 'visitor';
  createdAt: any;
  photoUrl?: string;
}

interface Department {
  id: string;
  name: string;
}

interface MemberManagementProps {
  role: string | null;
}

export default function MemberManagement({ role }: MemberManagementProps) {
  const [user] = useAuthState(auth);
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedMemberForCard, setSelectedMemberForCard] = useState<Member | null>(null);
  const [memberToDeleteId, setMemberToDeleteId] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  
  const location = useLocation();
  const highlightId = new URLSearchParams(location.search).get('highlight');
  
  useEffect(() => {
    if (highlightId && members.length > 0) {
      const target = members.find(m => m.id === highlightId);
      if (target) {
        setSearchTerm(target.name);
      }
    }
  }, [highlightId, members]);
  
  const isPastorAdmin = useMemo(() => {
    return (role && ['admin', 'pastor', 'pastora'].includes(role)) || 
           user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
  }, [role, user]);

  const canManageMembers = useMemo(() => {
    return (role && ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'].includes(role)) || 
           user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
  }, [role, user]);

  const isAdminOnly = useMemo(() => {
    return (role && ['admin', 'pastor', 'pastora'].includes(role)) || 
           user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
  }, [role, user]);

  useEffect(() => {
    if (isAdminOnly) {
      const fetchSignature = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'settings', 'pastor_signature'));
          if (docSnap.exists()) {
            setCurrentSignature(docSnap.data().signature);
          }
        } catch (err) {
          console.error("Error fetching signature:", err);
        }
      };
      fetchSignature();
    }
  }, [isAdminOnly]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuId && !(event.target as Element).closest('.relative')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);
  
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      cpf: '',
      birthDate: '',
      department: '',
      position: 'Membro',
      conversionDate: '',
      isBaptized: false,
      isSpiritBaptized: false,
      isTither: false,
      status: 'active',
      photoUrl: ''
    });
    setEditingMemberId(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member: Member) => {
    setFormData({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      whatsapp: member.whatsapp || '',
      cpf: member.cpf || '',
      birthDate: member.birthDate || '',
      department: member.department || '',
      position: member.position || 'Membro',
      conversionDate: member.conversionDate || '',
      isBaptized: member.isBaptized,
      isSpiritBaptized: member.isSpiritBaptized,
      isTither: member.isTither,
      status: member.status,
      photoUrl: member.photoUrl || ''
    });
    setEditingMemberId(member.id);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    cpf: '',
    birthDate: '',
    department: '',
    position: 'Membro',
    conversionDate: '',
    isBaptized: false,
    isSpiritBaptized: false,
    isTither: false,
    status: 'active' as 'active' | 'inactive' | 'visitor',
    photoUrl: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });

    const qDepts = query(collection(db, 'departments'), orderBy('name', 'asc'));
    const unsubscribeDepts = onSnapshot(qDepts, (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    return () => {
      unsubscribe();
      unsubscribeDepts();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMemberId) {
        await updateDoc(doc(db, 'members', editingMemberId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'members'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        
        // Notifica administradores do novo cadastro de membro feito via painel
        await createNewMemberNotification(formData.name, formData.email || '', 'admin');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, editingMemberId ? `members/${editingMemberId}` : 'members');
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'members', id));
      setActiveMenuId(null);
    } catch (error: any) {
      console.error("Delete error:", error);
      alert("Erro ao excluir: " + (error.message || "Erro desconhecido"));
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFaithAge = (date?: string) => {
    if (!date) return 'Não informado';
    const years = differenceInYears(new Date(), new Date(date));
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  };

  const getAge = (date?: string) => {
    if (!date) return 'N/A';
    const age = differenceInYears(new Date(), new Date(date));
    return `${age} anos`;
  };

  const handleSaveSignature = async (base64: string) => {
    try {
      await setDoc(doc(db, 'settings', 'pastor_signature'), {
        signature: base64,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid
      });
      setCurrentSignature(base64);
      setIsSignatureModalOpen(false);
      alert('Assinatura do Pastor salva com sucesso!');
    } catch (err) {
      console.error("Error saving signature:", err);
      alert('Erro ao salvar assinatura.');
    }
  };

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black text-church-navy">Membros da Igreja</h1>
          <p className="text-church-navy/60">Gestão e acompanhamento espiritual da membresia</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPastorAdmin && (
            <button 
              onClick={() => setIsSignatureModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border-2 border-church-gold/20 bg-white px-4 py-3 text-sm font-bold text-church-navy shadow-sm transition-all hover:bg-church-gold/5 active:scale-95"
              title="Configurar Assinatura do Pastor"
            >
              <PenTool className="h-4 w-4 text-church-gold" /> 
              <span className="hidden sm:inline">Assinatura do Pastor</span>
            </button>
          )}
          {canManageMembers && (
            <button 
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 rounded-xl bg-church-navy px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <UserPlus className="h-4 w-4" /> Novo Membro
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-church-navy/30" />
          <input 
            type="text"
            placeholder="Buscar por nome ou e-mail..."
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
            {filteredMembers.map((member) => (
              <motion.div
                key={member.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group relative rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm hover:shadow-md transition-all ${activeMenuId === member.id ? 'z-20' : 'z-0'}`}
              >
                <div className="flex items-start justify-between">
                  {canManageMembers ? (
                    <button 
                      onClick={() => setSelectedMemberForCard(member)}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl border border-church-gold/10 bg-church-navy/5 text-church-navy overflow-hidden hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="Ver Carteirinha"
                    >
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Users className="h-7 w-7 text-church-navy/60" />
                      )}
                    </button>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-church-gold/10 bg-church-navy/5 text-church-navy overflow-hidden">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Users className="h-7 w-7 text-church-navy/60" />
                      )}
                    </div>
                  )}
                  <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                    member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-church-gold/10 text-church-navy/40'
                  }`}>
                    {member.status === 'active' ? 'Ativo' : 'Inativo'}
                  </div>
                </div>

                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-xl font-black text-church-navy">{member.name}</h3>
                      {member.position && member.position !== 'Membro' && (
                        <span className="rounded-md bg-church-navy text-[10px] font-bold uppercase py-0.5 px-2 text-white">
                          {member.position}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      <p className="text-xs font-medium text-church-navy/40">{member.email || 'Email não informado'}</p>
                      {member.whatsapp && (
                        <a 
                          href={`https://wa.me/${member.whatsapp.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] font-bold text-green-600 hover:underline flex items-center gap-1"
                        >
                          WhatsApp: {member.whatsapp}
                        </a>
                      )}
                      {member.department && (
                        <p className="text-[10px] font-bold text-church-gold uppercase tracking-wider">{member.department}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Idade</p>
                      <p className="text-sm font-bold text-church-navy">{getAge(member.birthDate)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Tempo de Crente</p>
                      <p className="text-sm font-bold text-church-navy">{getFaithAge(member.conversionDate)}</p>
                    </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Batizado</p>
                    <div className="flex items-center gap-1">
                      {member.isBaptized ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-church-navy/20" />
                      )}
                      <span className="text-sm font-bold text-church-navy">{member.isBaptized ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Batismo No Espírito</p>
                    <div className="flex items-center gap-1">
                       <span className={`h-1.5 w-1.5 rounded-full ${member.isSpiritBaptized ? 'bg-church-gold' : 'bg-church-navy/10'}`} />
                       <span className="font-bold text-church-navy">{member.isSpiritBaptized ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Dizimista</p>
                    <div className="flex items-center gap-1">
                       <span className={`h-1.5 w-1.5 rounded-full ${member.isTither ? 'bg-green-500' : 'bg-church-navy/10'}`} />
                       <span className="font-bold text-church-navy">{member.isTither ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-church-gold/5 pt-4">
                  <span className="text-xs text-church-navy/40">Membro desde {member.createdAt ? format(member.createdAt.toDate(), 'MM/yyyy') : '-'}</span>
                  {canManageMembers && (
                    <div className="relative">
                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                        className="rounded-lg p-2 hover:bg-church-navy/5 text-church-navy/40 transition-colors"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      {activeMenuId === member.id && (
                        <div className="absolute bottom-full right-0 mb-2 w-32 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-church-navy/5 z-50">
                          <button 
                            onClick={() => {
                              setSelectedMemberForCard(member);
                              setActiveMenuId(null);
                            }}
                            className="flex w-full items-center px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5 transition-colors"
                          >
                            Carteirinha
                          </button>
                          <button 
                            onClick={() => handleOpenEditModal(member)}
                            className="flex w-full items-center px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5 transition-colors border-t border-church-gold/5"
                          >
                            Editar
                          </button>
                          {isAdminOnly && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setMemberToDeleteId(member.id);
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
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal de Adição/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-church-navy/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
          >
            <div className="bg-church-navy p-6 flex items-center justify-between shrink-0">
              <h2 className="font-serif text-xl font-bold text-white">
                {editingMemberId ? 'Editar Membro' : 'Cadastrar Novo Membro'}
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
                    <label className="text-xs font-bold uppercase text-church-navy/60">WhatsApp</label>
                    <input 
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60">CPF</label>
                    <input 
                      type="text"
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                  <BirthdayPicker 
                    label="Data de Nascimento"
                    value={formData.birthDate}
                    onChange={(val) => setFormData({...formData, birthDate: val})}
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60">Departamento</label>
                    <select 
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none appearance-none"
                    >
                      <option value="">Selecione um Departamento</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60">E-mail</label>
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 focus:ring-2 focus:ring-church-gold/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-church-navy/60">Cargo / Função</label>
                    <select 
                      value={formData.position}
                      onChange={(e) => setFormData({...formData, position: e.target.value})}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none appearance-none"
                    >
                      <option value="Membro">Membro</option>
                      {isPastorAdmin && (
                        <>
                          <option value="Pastor">Pastor</option>
                          <option value="Pastora">Pastora</option>
                        </>
                      )}
                      <option value="Presbítero">Presbítero</option>
                      <option value="Missionário">Missionário</option>
                      <option value="Missionária">Missionária</option>
                      <option value="Diácono">Diácono</option>
                      <option value="Evangelista">Evangelista</option>
                    </select>
                  </div>
                  <BirthdayPicker 
                    label="Data de Conversão"
                    value={formData.conversionDate}
                    onChange={(val) => setFormData({...formData, conversionDate: val})}
                  />
                </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <label className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl border border-church-gold/10 bg-church-cream/30 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.isBaptized}
                    onChange={(e) => setFormData({...formData, isBaptized: e.target.checked})}
                    className="h-5 w-5 rounded border-church-gold text-church-navy focus:ring-church-gold"
                  />
                  <span className="text-[10px] sm:text-xs font-bold uppercase text-church-navy">Batizado</span>
                </label>
                <label className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl border border-church-gold/10 bg-church-cream/30 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formData.isSpiritBaptized}
                    onChange={(e) => setFormData({...formData, isSpiritBaptized: e.target.checked})}
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
                  <span className="text-[10px] sm:text-xs font-bold uppercase text-church-navy">Dizimista</span>
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
                    <option value="visitor">Visitante</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 sm:pt-6">
                <button 
                  type="submit"
                  className="w-full rounded-2xl bg-church-navy py-4 font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-church-navy/90 active:scale-95"
                >
                  {editingMemberId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {selectedMemberForCard && (
        <MemberIDCardModal 
          member={selectedMemberForCard}
          onClose={() => setSelectedMemberForCard(null)}
          canUploadPhoto={true}
          onPhotoUpdated={(memberId, newPhotoUrl) => {
            setMembers(prev => prev.map(m => m.id === memberId ? { ...m, photoUrl: newPhotoUrl } : m));
            if (selectedMemberForCard?.id === memberId) {
              setSelectedMemberForCard(prev => prev ? { ...prev, photoUrl: newPhotoUrl } : null);
            }
          }}
        />
      )}

      <DeleteConfirmationModal
        isOpen={memberToDeleteId !== null}
        onClose={() => setMemberToDeleteId(null)}
        onConfirm={async () => {
          if (memberToDeleteId) {
            await handleDeleteMember(memberToDeleteId);
          }
        }}
        title="Excluir Membro"
        message="Tem certeza que deseja excluir este membro? Esta ação não pode ser desfeita."
      />

      {isSignatureModalOpen && (
        <SignatureCanvas 
          onClose={() => setIsSignatureModalOpen(false)}
          onSave={handleSaveSignature}
          title="Assinatura do Pastor Luiz Farias"
        />
      )}
    </div>
  );
}
