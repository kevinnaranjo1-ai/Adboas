import { useState, useMemo } from 'react';
import { collection, query, where, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Plus, Trash2, Edit2, ArrowLeft, UserPlus, User, Search, MoreVertical, XCircle, ArrowRightLeft } from 'lucide-react';
import DeleteConfirmationModal from '../DeleteConfirmationModal';
import { motion, AnimatePresence } from 'motion/react';

interface EBDStudentListProps {
  classId: string;
  className: string;
  onBack: () => void;
  isEBDAdmin: boolean | null;
}

export default function EBDStudentList({ classId, className, onBack, isEBDAdmin }: EBDStudentListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<{ id: string, name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    targetClassId: classId, // default to the current class
  });

  // Fetch students for the current class
  const [studentsSnapshot, loading] = useCollection(
    classId ? query(
      collection(db, 'ebd_students'),
      where('classId', '==', classId)
    ) : null
  );

  // Fetch all classes so the user can transfer students between classes
  const [classesSnapshot] = useCollection(collection(db, 'ebd_classes'));

  const classes = useMemo(() => {
    return classesSnapshot?.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)) || [];
  }, [classesSnapshot]);

  const students = useMemo(() => {
    if (!studentsSnapshot) return [];
    return [...studentsSnapshot.docs]
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [studentsSnapshot]);

  const filteredStudents = useMemo(() => {
    return students.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const resetForm = () => {
    setFormData({ name: '', age: '', targetClassId: classId });
    setEditingStudentId(null);
    setErrorMsg(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student: any) => {
    setFormData({
      name: student.name,
      age: student.age || '',
      targetClassId: student.classId || classId,
    });
    setEditingStudentId(student.id);
    setErrorMsg(null);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || isEBDAdmin !== true) return;
    setErrorMsg(null);

    try {
      if (editingStudentId) {
        await updateDoc(doc(db, 'ebd_students', editingStudentId), {
          name: formData.name.trim(),
          age: formData.age ? Number(formData.age) : null,
          classId: formData.targetClassId,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'ebd_students'), {
          name: formData.name.trim(),
          age: formData.age ? Number(formData.age) : null,
          classId: formData.targetClassId,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        editingStudentId ? `ebd_students/${editingStudentId}` : 'ebd_students'
      );
      setErrorMsg(error?.message || 'Erro ao salvar aluno.');
    }
  };

  const handleDeleteStudent = (id: string, name: string) => {
    if (isEBDAdmin !== true) return;
    setDeletingStudent({ id, name });
    setActiveMenuId(null);
  };

  const confirmDelete = async () => {
    if (!deletingStudent || isEBDAdmin !== true) return;
    try {
      await deleteDoc(doc(db, 'ebd_students', deletingStudent.id));
      setDeletingStudent(null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `ebd_students/${deletingStudent.id}`);
      alert(`Erro ao excluir aluno: ${error.message || 'Sem permissão'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-church-gold/5 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-church-navy/5 rounded-full transition-colors cursor-pointer">
            <ArrowLeft className="h-6 w-6 text-church-navy" />
          </button>
          <div>
            <h2 className="font-serif text-2xl font-black text-church-navy leading-tight">Alunos da Classe: {className}</h2>
            <p className="text-sm text-church-navy/60">Lista e gerenciamento de alunos matriculados nesta classe</p>
          </div>
        </div>

        {isEBDAdmin === true && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-church-navy px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
          >
            <UserPlus className="h-4 w-4 text-church-gold" /> Adicionar Aluno
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-church-navy/30" />
        <input
          type="text"
          placeholder="Buscar aluno por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-2xl border border-church-gold/10 bg-white pl-12 pr-4 py-3 placeholder:text-church-navy/20 focus:outline-none focus:ring-2 focus:ring-church-gold/20"
        />
      </div>

      {/* Visualização de Tabela (Desktop) */}
      <div className="hidden md:block bg-white rounded-3xl border border-church-gold/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-church-navy/5 text-church-navy text-xs font-black uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Nome do Aluno</th>
                <th className="px-6 py-4">Idade</th>
                {isEBDAdmin === true && <th className="px-6 py-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-church-gold/10">
              {loading ? (
                <tr>
                  <td colSpan={isEBDAdmin === true ? 3 : 2} className="px-6 py-12 text-center text-church-navy/40 font-bold">
                    Carregando alunos...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={isEBDAdmin === true ? 3 : 2} className="px-6 py-12 text-center text-church-navy/40 font-bold">
                    Nenhum aluno cadastrado nesta classe.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => {
                  return (
                    <tr key={student.id} className="hover:bg-church-cream/30 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-church-navy/10 flex items-center justify-center text-church-navy">
                          <User className="h-4.5 w-4.5 text-church-gold" />
                        </div>
                        <span className="font-semibold text-church-navy">{student.name}</span>
                      </td>
                      <td className="px-6 py-4 text-church-navy/70 text-sm font-medium">
                        {student.age ? `${student.age} anos` : '-'}
                      </td>
                      {isEBDAdmin === true && (
                        <td className="px-6 py-4 text-right">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === student.id ? null : student.id)}
                              className="rounded-lg p-2 hover:bg-church-navy/5 text-church-navy/40 transition-colors animate-fade-in"
                            >
                              <MoreVertical className="h-5 w-5" />
                            </button>
                            {activeMenuId === student.id && (
                              <div className="absolute right-0 mt-2 w-36 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-church-navy/5 z-50">
                                <button
                                  onClick={() => handleOpenEditModal(student)}
                                  className="flex w-full items-center px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5 transition-colors text-left"
                                >
                                  <Edit2 className="mr-2 h-4 w-4 text-church-gold" /> Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(student.id, student.name)}
                                  className="flex w-full items-center px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border-t border-church-gold/5 text-left"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visualização de Cards (Mobile) */}
      <div className="block md:hidden space-y-4">
        {loading ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-church-gold/10 text-church-navy/40 font-bold">
            Carregando alunos...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-church-gold/10 text-church-navy/40 font-bold">
            Nenhum aluno cadastrado nesta classe.
          </div>
        ) : (
          filteredStudents.map(student => (
            <div key={student.id} className="bg-white rounded-3xl border border-church-gold/10 p-5 shadow-sm space-y-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-church-navy/10 flex items-center justify-center text-church-navy">
                    <User className="h-5 w-5 text-church-gold" />
                  </div>
                  <div>
                    <h4 className="font-bold text-church-navy text-base leading-snug">{student.name}</h4>
                    <p className="text-xs text-church-navy/50 font-medium">
                      {student.age ? `${student.age} anos` : 'Idade não informada'}
                    </p>
                  </div>
                </div>

                {isEBDAdmin === true && (
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === student.id ? null : student.id)}
                      className="rounded-lg p-2 hover:bg-church-navy/5 text-church-navy/40 transition-colors"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {activeMenuId === student.id && (
                      <div className="absolute right-0 mt-1 w-36 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-church-navy/5 z-50">
                        <button
                          onClick={() => handleOpenEditModal(student)}
                          className="flex w-full items-center px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5 transition-colors text-left"
                        >
                          <Edit2 className="mr-2 h-4 w-4 text-church-gold" /> Editar
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          className="flex w-full items-center px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border-t border-church-gold/5 text-left"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Criação e Edição de Aluno */}
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
                  {editingStudentId ? 'Editar Aluno EBD' : 'Cadastrar Aluno EBD'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                {errorMsg && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl leading-relaxed">
                    {errorMsg}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Nome do Aluno</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome completo do aluno"
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm"
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Idade</label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={e => setFormData({ ...formData, age: e.target.value })}
                      placeholder="Idade (opcional)"
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Classe EBD</label>
                    <select
                      value={formData.targetClassId}
                      onChange={e => setFormData({ ...formData, targetClassId: e.target.value })}
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-bold text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm appearance-none bg-white"
                    >
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-church-navy py-4 font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-church-navy/90 active:scale-95 cursor-pointer"
                >
                  {editingStudentId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={!!deletingStudent}
        onClose={() => setDeletingStudent(null)}
        onConfirm={confirmDelete}
        title="Excluir Aluno"
        message={`Tem certeza que deseja remover o aluno "${deletingStudent?.name}"?\nEsta ação não pode ser desfeita.`}
      />
    </div>
  );
}
