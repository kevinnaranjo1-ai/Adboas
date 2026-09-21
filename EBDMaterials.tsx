import React, { useState, useMemo } from 'react';
import { collection, query, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { FileText, Plus, Trash2, Edit2, ExternalLink, FileUp, Download, Search, MoreVertical, XCircle, Link2 } from 'lucide-react';
import { createEBDMaterialNotification } from '../../lib/notifications';
import DeleteConfirmationModal from '../DeleteConfirmationModal';
import { motion, AnimatePresence } from 'motion/react';

interface EBDMaterialsProps {
  isEBDAdmin: boolean | null;
}

export default function EBDMaterials({ isEBDAdmin }: EBDMaterialsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<{ id: string, title: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    url: '',
    uploadedFileName: '',
    uploadedBase64: '',
  });

  const [loading, setLoading] = useState(false);

  const [materialsSnapshot, materialsLoading] = useCollection(
    query(collection(db, 'ebd_materials'))
  );

  const materials = useMemo(() => {
    if (!materialsSnapshot) return [];
    return materialsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
  }, [materialsSnapshot]);

  const filteredMaterials = useMemo(() => {
    return materials.filter(mat =>
      mat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [materials, searchTerm]);

  const resetForm = () => {
    setFormData({
      title: '',
      url: '',
      uploadedFileName: '',
      uploadedBase64: '',
    });
    setEditingMaterialId(null);
    setErrorMsg(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mat: any) => {
    setFormData({
      title: mat.title,
      url: mat.url || '',
      uploadedFileName: mat.fileName || '',
      uploadedBase64: mat.fileBase64 || '',
    });
    setEditingMaterialId(mat.id);
    setErrorMsg(null);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);

    if (file.type !== 'application/pdf') {
      setErrorMsg('Por favor, carregue somente arquivos no formato PDF.');
      return;
    }

    // Limit to 600KB because Base64 encoded documents have a 33% overhead.
    // This keeps the final Firestore document size well below the 1MB strict limit.
    if (file.size > 600 * 1024) { 
      setErrorMsg('O arquivo PDF excede o limite recomendado de 600KB para armazenamento direto. Reduza o PDF ou utilize o campo "Link do PDF" acima para colar um link do Google Drive ou Dropbox.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData(prev => ({
          ...prev,
          uploadedFileName: file.name,
          uploadedBase64: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.title.trim() || isEBDAdmin !== true) return;

    if (!formData.url.trim() && !formData.uploadedBase64) {
      setErrorMsg('Por favor, forneca um link ou carregue um arquivo PDF de ate 600KB.');
      return;
    }

    setLoading(true);
    try {
      if (editingMaterialId) {
        await updateDoc(doc(db, 'ebd_materials', editingMaterialId), {
          title: formData.title.trim(),
          url: formData.url.trim(),
          fileBase64: formData.uploadedBase64,
          fileName: formData.uploadedFileName,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'ebd_materials'), {
          title: formData.title.trim(),
          url: formData.url.trim(),
          fileBase64: formData.uploadedBase64,
          fileName: formData.uploadedFileName,
          createdAt: serverTimestamp(),
        });

        // Send notification for new material
        try {
          await createEBDMaterialNotification(formData.title.trim());
        } catch (notifyErr) {
          console.warn('Erro ao enviar notificação de material EBD:', notifyErr);
        }
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error uploading/updating material:', error);
      handleFirestoreError(
        error,
        OperationType.WRITE,
        editingMaterialId ? `ebd_materials/${editingMaterialId}` : 'ebd_materials'
      );
      
      let message = 'Ocorreu um erro ao salvar o material no banco de dados.';
      if (error?.code === 'resource-exhausted' || error?.message?.includes('too large')) {
        message = 'O arquivo selecionado ficou grande demais para o banco de dados após a conversão. Por favor, comprima o PDF ou use a opção de link externo (Google Drive/Dropbox).';
      } else if (error?.code === 'permission-denied') {
        message = 'Você não tem permissão de administrador para salvar materiais.';
      } else if (error?.message) {
        message = `Erro: ${error.message}`;
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, title: string) => {
    if (isEBDAdmin !== true) return;
    setDeletingMaterial({ id, title });
    setActiveMenuId(null);
  };

  const confirmDelete = async () => {
    if (!deletingMaterial || isEBDAdmin !== true) return;
    try {
      await deleteDoc(doc(db, 'ebd_materials', deletingMaterial.id));
      setDeletingMaterial(null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `ebd_materials/${deletingMaterial.id}`);
      alert(`Erro ao excluir material: ${error.message || 'Sem permissão'}`);
    }
  };

  const handleDownload = (material: any) => {
    if (material.fileBase64) {
      const link = document.createElement('a');
      link.href = material.fileBase64;
      link.download = material.fileName || `${material.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (material.url) {
      window.open(material.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-church-gold/5 pb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-church-navy/30" />
          <input
            type="text"
            placeholder="Buscar material de estudo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-church-gold/10 bg-white pl-12 pr-4 py-3 placeholder:text-church-navy/20 focus:outline-none focus:ring-2 focus:ring-church-gold/20"
          />
        </div>
        {isEBDAdmin === true && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-church-navy px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-church-gold" /> Adicionar Material
          </button>
        )}
      </header>

      {materialsLoading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-church-navy/40 font-bold">Carregando materiais...</p>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-church-gold/20">
          <FileText className="h-10 w-10 text-church-gold/30 mx-auto mb-2" />
          <p className="text-sm text-church-navy/50 font-bold">Nenhum material encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredMaterials.map((mat) => {
              const dateStr = mat.createdAt
                ? new Date(mat.createdAt.seconds * 1000).toLocaleDateString('pt-BR')
                : '-';

              return (
                <motion.div
                  key={mat.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative rounded-3xl border border-church-gold/10 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${mat.fileBase64 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                          {mat.fileBase64 ? (
                            <FileText className="h-6 w-6" />
                          ) : (
                            <Link2 className="h-6 w-6" />
                          )}
                        </div>
                        <div>
                          <div className="text-[9px] font-black tracking-widest uppercase text-church-navy/40">
                            {mat.fileBase64 ? 'Arquivo PDF' : 'Link Externo'}
                          </div>
                          <h4 className="font-bold text-church-navy text-base leading-snug mt-0.5 max-w-[170px] truncate" title={mat.title}>
                            {mat.title}
                          </h4>
                        </div>
                      </div>

                      {isEBDAdmin === true && (
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === mat.id ? null : mat.id)}
                            className="rounded-lg p-2 hover:bg-church-navy/5 text-church-navy/40 transition-colors"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                          {activeMenuId === mat.id && (
                            <div className="absolute right-0 top-full mt-2 w-32 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-church-navy/5 z-50">
                              <button
                                onClick={() => handleOpenEditModal(mat)}
                                className="flex w-full items-center px-4 py-3 text-sm font-bold text-church-navy hover:bg-church-navy/5 transition-colors text-left"
                              >
                                <Edit2 className="mr-2 h-4 w-4 text-church-gold" /> Editar
                              </button>
                              <button
                                onClick={() => handleDelete(mat.id, mat.title)}
                                className="flex w-full items-center px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border-t border-church-gold/5 text-left"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-xs font-bold text-church-navy/40 uppercase tracking-wider mb-4">
                      Publicado em: {dateStr}
                    </p>
                  </div>

                  <div className="border-t border-church-gold/5 pt-4 flex items-center justify-between mt-auto">
                    <span className="text-[10px] font-bold text-church-navy/50 truncate max-w-[140px]">
                      {mat.fileName || (mat.url ? 'Link Externo' : 'Arquivo')}
                    </span>

                    <button
                      onClick={() => handleDownload(mat)}
                      className="flex items-center gap-1.5 rounded-xl bg-church-navy px-4 py-2 text-xs font-bold text-white hover:bg-church-navy/90 transition-all cursor-pointer shadow-sm"
                    >
                      {mat.fileBase64 ? (
                        <>
                          <Download className="h-3.5 w-3.5" /> Baixar PDF
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir Link
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal de Upload/Edição de Material */}
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
                  {editingMaterialId ? 'Editar Material de Estudo' : 'Subir Material de Estudo'}
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
                  <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Título da Lição/PDF <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Lição 01 - A Natureza de Deus"
                    className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm"
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-church-navy/60">Link do PDF (Google Drive/Dropbox)</label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={e => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className="w-full rounded-xl border border-church-gold/20 px-4 py-3 font-medium text-church-navy focus:ring-2 focus:ring-church-gold/20 outline-none shadow-sm text-sm"
                    />
                  </div>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-church-gold/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-church-navy/40 font-bold">Ou carregar arquivo</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-church-gold/20 p-5 bg-church-cream/10 flex flex-col items-center justify-center space-y-3">
                    <label className="inline-flex items-center justify-center gap-2 rounded-xl bg-church-navy hover:bg-church-navy/95 text-white px-5 py-2.5 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm">
                      <FileUp className="h-4 w-4 text-church-gold" />
                      <span>{formData.uploadedFileName ? 'Substituir PDF' : 'Escolher PDF'}</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {formData.uploadedFileName ? (
                      <div className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 font-medium truncate max-w-[280px]">
                        ✓ {formData.uploadedFileName}
                      </div>
                    ) : (
                      <span className="text-[10px] text-church-navy/50 font-black uppercase tracking-widest">PDF (Tamanho máximo: 1MB)</span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-church-navy py-4 font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-church-navy/90 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Processando...' : (editingMaterialId ? 'Salvar Alterações' : 'Publicar Material')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={!!deletingMaterial}
        onClose={() => setDeletingMaterial(null)}
        onConfirm={confirmDelete}
        title="Excluir Material"
        message={`Tem certeza que deseja excluir o material "${deletingMaterial?.title}"?\nEsta ação não pode ser desfeita.`}
      />
    </div>
  );
}
