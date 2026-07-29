import { useState, useMemo } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Plus, Trash2, Edit2, ChevronRight, Users, Search, MoreVertical, XCircle, BookOpen } from 'lucide-react';
import DeleteConfirmationModal from '../DeleteConfirmationModal';
import { motion, AnimatePresence } from 'motion/react';

interface EBDClassListProps {
  classes: any[];
  loading: boolean;
  isEBDAdmin: boolean | null;
  onSelectClass: (id: string, name: string) => void;
}

export default function EBDClassList({ classes, loading, isEBDAdmin, onSelectClass }: EBDClassListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deletingClass, setDeletingClass] = useState<{ id: string, name: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    teacher: '',
    description: '',
  });

  // Fetch students to count them in real-time per class
  const [studentsSnapshot] = useCollection(collection(db, 'ebd_students'));

  const studentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (studentsSnapshot) {
      studentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.classId) {
          counts[data.classId] = (counts[data.classId] || 0) + 1;
        }
      });
    }
    return counts;
  }, [studentsSnapshot]);

  const resetForm = () => {
    setFormData({ name: '', teacher: '', description: '' });
    setEditingClassId(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cls: any) => {
    setFormData({
      name: cls.name,
      teacher: cls.teacher || '',
      description: cls.description || '',
    });
    setEditingClassId(cls.id);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || isEBDAdmin !== true) return;

    try {
      if (editingClassId) {
        await updateDoc(doc(db, 'ebd_classes', editingClassId), {
          name: formData.name.trim(),
          teacher: formData.teacher.trim(),
          description: formData.description.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'ebd_classes'), {
          name: formData.name.trim(),
          teacher: formData.teacher.trim(),
          description: formData.description.trim(),
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(
        error, 
        OperationType.WRITE, 
        editingClassId ? `ebd_classes/${editingClassId}` : 'ebd_classes'
      );
      alert('Erro ao salvar classe.');
    }
  };

  const handleDeleteClass = (id: string, name: string) => {
    if (isEBDAdmin !== true) return;
    setDeletingClass({ id, name });
    setActiveMenuId(null);
  };

  const confirmDelete = async () => {
    if (!deletingClass || isEBDAdmin !== true) return;
    try {
      await deleteDoc(doc(db, 'ebd_classes', deletingClass.id));
      setDeletingClass(null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `ebd_classes/${deletingClass.id}`);
      alert(`Erro ao excluir classe: ${error.message || 'Sem permissão'}`);
    }
  };

  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cls.teacher && cls.teacher.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-church-navy/30" />
          <input
            type="text"
            placeholder="Buscar por classe ou professor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-church-gold/10 bg-white pl-12 pr-4 py-3 placeholder:text-church-navy/20 focus:outline-none focus:ring-2 focus:ring-church-gold/20"
          />
        </div>
        {isEBDAdmin === true && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-church-navy px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4" /> Nova Classe
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-church-navy/40 font-bold">Carregando classes...</p>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
          <BookOpen className="h-12 w-12 text-church-navy mb-2" />
          <p className="text-sm font-bold text-church-navy">Nenhuma classe encontrada.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredClasses.map((cls) => {
              const count = studentCounts[cls.id] || 0;
              return (
                <motion.div
                  key={cls.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-church-navy/5 text-church-navy">
                          <Users className="h-6 w-6 text-church-gold" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black tracking-widest uppercase text-church-navy/40 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{count} {count === 1 ? 'aluno' : 'alunos'}</span>
                          </div>
                          <h3 className="font-serif text-xl font-black text-church-navy leading-tight mt-0.5">{cls.name}</h3>
                        </div>
                      </div>

                      {isEBDAdmin === true && (
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === cls.id ? null : cls.id)}
                            className="rounded-lg p-2 hover:bg-church-navy/5 text-church-navy/40 transition-colors"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                          {activeMenuId === cls.id && (
                            <div className="absolute right-0 top-full mt-2 w-32 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-church-navy/5 z-50">
                              <button
                                onClick={() => handleOpenEditModal(cls)}
                                className="flex w-full items-center px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5 transition-colors"
                              >
                                <Edit2 className="mr-2 h-4 w-4 text-church-gold" /> Editar
                              </button>
                              <button
                                onClick={() => handleDeleteClass(cls.id, cls.name)}
                                className="flex w-full items-center px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border-t border-church-gold/5"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-church-navy/60 leading-relaxed min-h-[40px] mb-4">
                      {cls.description || 'Nenhuma descrição fornecida.'}
                    </p>
                  </div>

                  <div className="border-t border-church-gold/5 pt-4 flex items-center justify-between mt-auto">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-church-navy/30">Professor(a)</p>
                      <p className="text-xs font-bold text-church-navy truncate max-w-[150px]">{cls.teacher || 'A definir'}</p>
                    </div>

                    <button
                      onClick={() => onSelectClass(cls.id, cls.name)}
                      className="flex items-center gap-1 rounded-lg bg-church-navy/5 px-3 py-1.5 text-xs font-bold text-church-navy hover:bg-church-navy hover:text-white transition-all cursor-pointer"
                    >
                      Alunos <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal de Criação e Edição */}
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
                  {editingClassId ? 'Editar Classe EBD' : 'Nova Classe EBD'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white/60 hover:text-white"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Nome da Classe</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Adultos, Jovens, Crianças"
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Professor / Responsável</label>
                  <input
                    type="text"
                    value={formData.teacher}
                    onChange={e => setFormData({ ...formData, teacher: e.target.value })}
                    placeholder="Nome do professor ou ministrador"
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Descrição / Faixa Etária</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Fale um pouco sobre a classe..."
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-church-navy py-4 font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-church-navy/90 active:scale-95"
                >
                  {editingClassId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={!!deletingClass}
        onClose={() => setDeletingClass(null)}
        onConfirm={confirmDelete}
        title="Excluir Classe"
        message={`Tem certeza que deseja excluir a classe "${deletingClass?.name}"?\nTodos os alunos vinculados serão mantidos no banco, mas não estarão mais acessíveis por esta interface.`}
      />
    </div>
  );
}
