import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, Plus, Search, Users, 
  Calendar, MoreVertical, Trash2, Edit2, 
  Loader2, XCircle, ChevronRight, Info,
  Flame, Globe, Heart, Shield, Users2,
  Phone, MessageSquare, MapPin, UserCheck
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInYears } from 'date-fns';
import { useAuthState } from 'react-firebase-hooks/auth';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

interface Department {
  id: string;
  name: string;
  leader?: string;
  description?: string;
  meetingDay?: string;
  createdAt?: any;
  memberCount?: number;
}

const DEFAULT_DEPARTMENTS = [
  { name: 'Departamento de Jovens', icon: Flame, color: 'bg-orange-500' },
  { name: 'Departamento de Missões', icon: Globe, color: 'bg-blue-600' },
  { name: 'Círculo de Oração', icon: Heart, color: 'bg-pink-500' },
  { name: 'Departamento de Obreiros', icon: Shield, color: 'bg-church-navy' },
  { name: 'Departamento das Famílias', icon: Users2, color: 'bg-green-600' }
];

export default function DepartmentManagement({ role }: { role: string | null }) {
  const [user] = useAuthState(auth);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [viewingMembersDept, setViewingMembersDept] = useState<string | null>(null);
  const [deptToDeleteId, setDeptToDeleteId] = useState<string | null>(null);

  const isPastorAdmin = useMemo(() => {
    return (role && ['admin', 'pastor', 'pastora'].includes(role)) || 
           user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
  }, [role, user]);

  const [formData, setFormData] = useState({
    name: '',
    leader: '',
    description: '',
    meetingDay: ''
  });

  useEffect(() => {
    const qDepts = query(collection(db, 'departments'), orderBy('name', 'asc'));
    const unsubscribeDepts = onSnapshot(qDepts, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Department[];
      setDepartments(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'departments');
    });

    const qMembers = query(collection(db, 'members'));
    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMembers(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
    });

    return () => {
      unsubscribeDepts();
      unsubscribeMembers();
    };
  }, []);

  const departmentStats = useMemo(() => {
    const stats: Record<string, number> = {};
    members.forEach(member => {
      if (member.department) {
        stats[member.department] = (stats[member.department] || 0) + 1;
      }
    });
    return stats;
  }, [members]);

  const departmentsWithCounts = useMemo(() => {
    return departments.map(dept => ({
      ...dept,
      memberCount: departmentStats[dept.name] || 0
    }));
  }, [departments, departmentStats]);

  const getAge = (date?: string) => {
    if (!date) return 'N/A';
    try {
      const age = differenceInYears(new Date(), new Date(date));
      return `${age} anos`;
    } catch (e) {
      return 'N/A';
    }
  };

  const currentDeptMembers = useMemo(() => {
    if (!viewingMembersDept) return [];
    return members.filter(m => m.department === viewingMembersDept);
  }, [members, viewingMembersDept]);

  const handleInitialize = async () => {
    if (!isPastorAdmin) return;
    try {
      setLoading(true);
      for (const dept of DEFAULT_DEPARTMENTS) {
        // Check if already exists by name
        const exists = departments.find(d => d.name === dept.name);
        if (!exists) {
          await addDoc(collection(db, 'departments'), {
            name: dept.name,
            leader: 'A definir',
            description: `Ministério de ${dept.name}`,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'departments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDeptId) {
        await updateDoc(doc(db, 'departments', editingDeptId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'departments'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, editingDeptId ? `departments/${editingDeptId}` : 'departments');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', leader: '', description: '', meetingDay: '' });
    setEditingDeptId(null);
  };

  const handleEdit = (dept: Department) => {
    setFormData({
      name: dept.name,
      leader: dept.leader || '',
      description: dept.description || '',
      meetingDay: dept.meetingDay || ''
    });
    setEditingDeptId(dept.id);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'departments', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `departments/${id}`);
    }
  };

  const filteredDepts = departmentsWithCounts.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDeptIcon = (name: string) => {
    const defaultDept = DEFAULT_DEPARTMENTS.find(d => name.includes(d.name) || d.name.includes(name));
    return defaultDept ? defaultDept.icon : LayoutGrid;
  };

  const getDeptColor = (name: string) => {
    const defaultDept = DEFAULT_DEPARTMENTS.find(d => name.includes(d.name) || d.name.includes(name));
    return defaultDept ? defaultDept.color : 'bg-church-navy';
  };

  return (
    <div className="space-y-8 p-4 lg:p-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h1 className="font-serif text-3xl font-black text-church-navy">Departamentos</h1>
          <p className="text-church-navy/60">Organização e liderança dos ministérios</p>
        </div>
        <div className="flex gap-2">
          {isPastorAdmin && departments.length === 0 && (
            <button 
              onClick={handleInitialize}
              className="flex items-center gap-2 rounded-xl border border-church-navy/10 bg-white px-6 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5"
            >
              Inicializar Padrão
            </button>
          )}
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-church-navy px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Novo Departamento
          </button>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-church-navy/30" />
        <input 
          type="text"
          placeholder="Buscar departamentos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-2xl border border-church-gold/10 bg-white pl-12 pr-4 py-4 shadow-sm placeholder:text-church-navy/20 focus:outline-none focus:ring-2 focus:ring-church-gold/20"
        />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-church-gold" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredDepts.map((dept) => {
              const Icon = getDeptIcon(dept.name);
              return (
                <motion.div
                  key={dept.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative rounded-3xl border border-church-gold/10 bg-white p-8 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${getDeptColor(dept.name)} text-white shadow-lg`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <button 
                        onClick={() => setViewingMembersDept(dept.name)}
                        className="flex flex-col justify-center text-left hover:scale-105 transition-transform"
                      >
                        <div className="flex items-center gap-1.5 text-church-navy/40">
                          <Users className="h-3.5 w-3.5" />
                          <span className="text-xs font-black tracking-widest uppercase">{dept.memberCount} membros</span>
                        </div>
                        <span className="text-[10px] font-bold text-church-gold underline decoration-church-gold/30">Ver lista</span>
                      </button>
                    </div>
                    {isPastorAdmin && (
                      <div className="relative">
                         <button 
                          onClick={() => setActiveMenuId(activeMenuId === dept.id ? null : dept.id)}
                          className="rounded-lg p-2 hover:bg-church-navy/5 text-church-navy/40 transition-colors"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {activeMenuId === dept.id && (
                          <div className="absolute right-0 top-full mt-2 w-32 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-church-navy/5 z-50">
                            <button 
                              onClick={() => handleEdit(dept)}
                              className="flex w-full items-center px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5"
                            >
                              <Edit2 className="mr-2 h-4 w-4" /> Editar
                            </button>
                            <button 
                              onClick={() => {
                                setDeptToDeleteId(dept.id);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 border-t border-church-gold/5"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    <h3 className="font-serif text-2xl font-black text-church-navy">{dept.name}</h3>
                    <p className="mt-2 text-sm text-church-navy/60 leading-relaxed min-h-[40px]">
                      {dept.description || 'Nenhuma descrição informada.'}
                    </p>
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-4 border-t border-church-gold/5 pt-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Líder / Regente</p>
                      <p className="text-sm font-bold text-church-navy">{dept.leader || 'A definir'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Reunião</p>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-church-gold" />
                        <span className="text-sm font-bold text-church-navy">{dept.meetingDay || 'A definir'}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-church-navy/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-church-navy p-6 flex items-center justify-between">
                <h2 className="font-serif text-xl font-bold text-white">
                  {editingDeptId ? 'Editar Departamento' : 'Novo Departamento'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Nome do Departamento</label>
                  <input 
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Departamento de Jovens"
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm"
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Líder / Responsável</label>
                    <input 
                      type="text"
                      value={formData.leader}
                      onChange={e => setFormData({...formData, leader: e.target.value})}
                      placeholder="Nome do líder"
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Dia de Reunião</label>
                    <input 
                      type="text"
                      value={formData.meetingDay}
                      onChange={e => setFormData({...formData, meetingDay: e.target.value})}
                      placeholder="Ex: Sábados, 19h"
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Descrição / Objetivo</label>
                  <textarea 
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Fale um pouco sobre o ministério..."
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full rounded-2xl bg-church-navy py-4 font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-church-navy/90 active:scale-95"
                >
                  {editingDeptId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Members List Modal */}
      <AnimatePresence>
        {viewingMembersDept && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-church-navy/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-4xl h-[85vh] bg-church-cream rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="bg-church-navy p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-white/10 text-white`}>
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-bold text-white">Membros do Departamento</h2>
                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">{viewingMembersDept}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingMembersDept(null)} 
                  className="rounded-xl bg-white/10 p-2 text-white/60 hover:text-white transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                {currentDeptMembers.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center opacity-40">
                    <Users2 className="h-16 w-16 mb-4" />
                    <p className="text-lg font-bold text-church-navy">Nenhum membro cadastrado</p>
                    <p className="text-sm">Os membros cadastrados com este departamento aparecerão aqui.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {currentDeptMembers.map((member) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={member.id}
                        className="bg-white border border-church-gold/10 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col gap-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-church-gold/10 flex items-center justify-center text-church-gold">
                              <span className="font-serif text-lg font-black uppercase">{member.name[0]}</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-church-navy leading-tight">{member.name}</h3>
                              <span className="inline-block mt-1 rounded bg-church-navy/5 px-2 py-0.5 text-[10px] font-black uppercase text-church-navy/60">
                                {member.position || 'Membro'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-church-gold/5 pt-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Idade</p>
                            <p className="text-sm font-bold text-church-navy">{getAge(member.birthDate)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">WhatsApp</p>
                            <div className="flex items-center gap-1 text-sm font-bold text-green-600">
                              <MessageSquare className="h-3 w-3" />
                              <span>{member.whatsapp || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Telefone</p>
                            <div className="flex items-center gap-1 text-sm font-bold text-church-navy">
                              <Phone className="h-3 w-3 text-church-gold" />
                              <span>{member.phone || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30">Batizado</p>
                            <div className="flex items-center gap-1 text-sm font-bold text-church-navy">
                              <UserCheck className="h-3 w-3 text-blue-600" />
                              <span>{member.isBaptized ? 'Sim' : 'Não'}</span>
                            </div>
                          </div>
                        </div>
                        
                        {member.email && (
                          <div className="bg-church-navy/5 p-3 rounded-xl">
                             <p className="text-[10px] font-bold uppercase tracking-widest text-church-navy/30 mb-0.5">E-mail</p>
                             <p className="text-xs font-medium text-church-navy/70 truncate">{member.email}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white p-4 border-t border-church-gold/10 flex justify-end">
                <button 
                  onClick={() => setViewingMembersDept(null)}
                  className="px-6 py-2 bg-church-navy text-white rounded-xl font-bold hover:bg-church-navy/90 transition-all active:scale-95"
                >
                  Fechar Lista
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={deptToDeleteId !== null}
        onClose={() => setDeptToDeleteId(null)}
        onConfirm={async () => {
          if (deptToDeleteId) {
            await handleDelete(deptToDeleteId);
          }
        }}
        title="Excluir Departamento"
        message="Tem certeza que deseja excluir este departamento? Nenhum membro do sistema será excluído, mas a sua associação a este departamento será limpa."
      />
    </div>
  );
}
