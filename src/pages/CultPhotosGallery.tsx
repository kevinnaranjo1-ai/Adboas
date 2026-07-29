import React, { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Camera, Calendar, User, Trash2, Plus, X, Image as ImageIcon, 
  Search, Filter, Loader2, Maximize2, Sparkles, Check, AlertCircle,
  Download, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import heic2any from 'heic2any';

interface CultPhoto {
  id: string;
  imageUrl: string;
  title: string;
  description?: string;
  date: string;
  category: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: any;
}

const CATEGORIES = [
  'Todos',
  'Culto de Domingo',
  'Culto de Ensino',
  'Círculo de Oração',
  'Festividade',
  'Especial',
  'Missões',
  'Outros'
];

// Utility to resize and compress image to base64 with maximum high quality (up to QHD 2.5K resolution)
const compressImage = (file: File, maxW = 2560, maxH = 2560, initialQuality = 0.96): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
        } else {
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Garante altíssima resolução mantendo abaixo do limite físico de 1MB do Firestore (~960KB em base64)
        let quality = initialQuality;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 960000 && quality > 0.60) {
          quality -= 0.05;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
};

interface CultPhotosProps {
  role: string | null;
}

export default function CultPhotosGallery({ role }: CultPhotosProps) {
  const [user, loadingAuth] = useAuthState(auth);
  const isAdminOrOfficer = role && ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social'].includes(role);

  // Firestore subscription for photos query
  const photosQuery = query(collection(db, 'cult_photos'), orderBy('date', 'desc'));
  const [snapshot, loading, error] = useCollection(user ? photosQuery : null);

  // Throw rich error info if query fails, to assist in debugging security rules
  React.useEffect(() => {
    if (error) {
      console.error("Erro na consulta de cult_photos:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'cult_photos');
      } catch (err) {
        // Log in developer console but don't crash UI, we display the error state nicely
      }
    }
  }, [error]);

  const isDataLoading = loadingAuth || loading;

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<CultPhoto | null>(null);
  
  // Custom delete state to avoid blocked window.confirm inside iframes
  const [photoToDelete, setPhotoToDelete] = useState<CultPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState('Culto de Domingo');
  const [imageType, setImageType] = useState<'upload' | 'url'>('upload');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const fileType = (file.type || '').toLowerCase();
    const isHeifOrHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif') || fileType.includes('heic') || fileType.includes('heif');

    if (!fileType.startsWith('image/') && !isHeifOrHeic) {
      setPreviewError('Por favor selecione um arquivo de imagem válido.');
      return;
    }

    try {
      setPreviewError('');
      if (isHeifOrHeic) {
        try {
          const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.96 });
          const resBlob = Array.isArray(converted) ? converted[0] : converted;
          file = new File([resBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
        } catch (convErr) {
          console.warn('Erro na conversão heic2any:', convErr);
        }
      }
      const compressed = await compressImage(file);
      setUploadedBase64(compressed);
    } catch (err: any) {
      setPreviewError('Erro ao processar imagem: ' + err.message);
    }
  };

  // Submit Photo Creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const finalUrl = imageType === 'upload' ? uploadedBase64 : imageUrlInput;
    if (!finalUrl) {
      setPreviewError('Por favor insira uma imagem (arquivo ou link externo).');
      return;
    }

    if (!formTitle.trim()) {
      setPreviewError('O título é obrigatório.');
      return;
    }

    try {
      setSubmitting(true);
      setPreviewError('');

      await addDoc(collection(db, 'cult_photos'), {
        imageUrl: finalUrl,
        title: formTitle.trim(),
        description: formDescription.trim(),
        date: formDate,
        category: formCategory,
        uploadedById: user.uid,
        uploadedByName: user.displayName || 'Membro',
        createdAt: serverTimestamp()
      });

      // Reset Form State
      setFormTitle('');
      setFormDescription('');
      setUploadedBase64(null);
      setImageUrlInput('');
      setIsUploadOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar foto no Firestore:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'cult_photos');
      } catch (formattedErr: any) {
        setPreviewError('Erro ao publicar foto (permissão negada ou erro interno).');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Photo Action - Sets state to open custom modal alert
  const handleDeletePhoto = (photo: CultPhoto) => {
    if (!user) return;
    const canDelete = photo.uploadedById === user.uid || isAdminOrOfficer;
    if (!canDelete) return;

    setDeleteError('');
    setPhotoToDelete(photo);
  };

  // Actual deletion execution
  const confirmDeletePhoto = async () => {
    if (!photoToDelete || !user) return;
    try {
      setDeleting(true);
      setDeleteError('');
      
      await deleteDoc(doc(db, 'cult_photos', photoToDelete.id));
      
      // If the deleted photo is currently in the lightbox, close the lightbox
      if (lightboxPhoto?.id === photoToDelete.id) {
        setLightboxPhoto(null);
      }
      setPhotoToDelete(null);
    } catch (err: any) {
      console.error("Erro ao excluir foto:", err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `cult_photos/${photoToDelete.id}`);
      } catch (formattedErr: any) {
        setDeleteError('Erro ao excluir foto (permissão negada ou erro interno).');
      }
    } finally {
      setDeleting(false);
    }
  };

  // Baixar Foto para qualquer membro ou visitante
  const handleDownloadPhoto = async (photo: CultPhoto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const response = await fetch(photo.imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${photo.title.toLowerCase().replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // Fallback em caso de bloqueio CORS no fetch de blob
      const link = document.createElement('a');
      link.href = photo.imageUrl;
      link.target = '_blank';
      link.download = `${photo.title.toLowerCase().replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Compartilhar A PRÓPRIA IMAGEM (arquivo HD) no WhatsApp / Redes Sociais
  const handleSharePhoto = async (photo: CultPhoto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    try {
      const response = await fetch(photo.imageUrl);
      const blob = await response.blob();
      const file = new File([blob], `${photo.title.toLowerCase().replace(/\s+/g, '_')}.jpg`, { type: blob.type || 'image/jpeg' });

      // 1. Compartilhamento nativo de ARQUIVO DE IMAGEM (Celulares Android e iPhone)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: photo.title,
          text: photo.description || photo.title,
        });
        return;
      }
    } catch (err) {
      console.log('Erro no compartilhamento nativo de arquivo:', err);
    }

    // 2. Fallback Universal para computadores ou navegadores sem suporte a files:
    // Baixa a imagem HD automaticamente e abre o WhatsApp com a legenda pronta!
    handleDownloadPhoto(photo);
    const caption = `*${photo.title}* 📸✨\n${photo.description ? photo.description + '\n' : ''}\n_Enviado da AD Boas Novas_`;
    const whatsUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`;
    window.open(whatsUrl, '_blank');
    alert("📸 A foto em alta qualidade foi salva no seu dispositivo!\n\nCole ou anexe a imagem na conversa do WhatsApp que abrimos para você.");
  };

  // Process data from Firestore
  const photosList: CultPhoto[] = snapshot ? snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as CultPhoto)) : [];

  // Filter photos based on search and category
  const filteredPhotos = photosList.filter(photo => {
    const matchesSearch = photo.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (photo.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      photo.uploadedByName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || photo.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Format date readable in PT-BR
  const formatDateBR = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      return `${parseInt(day, 10)} de ${months[parseInt(month, 10) - 1]} de ${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Premium Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-church-navy p-8 lg:p-12 text-white border border-church-gold/20 shadow-xl">
        <div className="absolute inset-0 bg-radial-gradient from-white/5 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-church-gold/10 px-3 py-1 rounded-full text-xs font-black text-church-gold border border-church-gold/20 mb-3 uppercase tracking-widest">
              <Sparkles className="h-3 w-3" /> Memórias Congregais
            </div>
            <h1 className="font-serif text-3xl lg:text-4xl font-black tracking-tight leading-none">
              Galeria de Cultos
            </h1>
            <p className="mt-2 text-sm text-white/60 font-medium max-w-xl">
              Nossa jornada de fé em registros visuais. Compartilhe e relembre os momentos marcantes de louvor, pregação e milagres congregais.
            </p>
          </div>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-church-gold hover:bg-church-gold/90 px-6 py-4.5 text-sm font-bold text-church-navy shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0"
          >
            <Camera className="h-4.5 w-4.5" />
            Adicionar Memória
          </button>
        </div>
      </div>

      {/* Filter and Search Bar controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-church-gold/10 p-5 rounded-2xl shadow-sm">
        {/* Search input */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-church-navy/40" />
          <input
            type="text"
            placeholder="Buscar fotos de cultos, testemunhos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-church-cream/40 border border-church-gold/20 hover:border-church-gold/40 focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium text-church-navy transition-all placeholder:text-church-navy/40"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none shrink-0 max-w-full">
          <Filter className="h-4.5 w-4.5 text-church-navy/40 block md:hidden shrink-0" />
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-church-navy text-white shadow-sm'
                  : 'bg-church-navy/5 text-church-navy hover:bg-church-navy/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Photos Grid Stream */}
      {isDataLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-church-gold" />
          <p className="text-sm font-medium text-church-navy/50">Carregando memórias do altar...</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-6 rounded-2xl border border-red-200 bg-red-50 text-red-700 max-w-xl mx-auto">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <div>
            <h4 className="font-bold">Erro ao carregar galeria</h4>
            <p className="text-xs">{error.message}</p>
          </div>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center border-2 border-dashed border-church-gold/20 rounded-3xl bg-white max-w-md mx-auto">
          <div className="rounded-full bg-church-gold/10 p-4 text-church-gold mb-4">
            <ImageIcon className="h-8 w-8" />
          </div>
          <h3 className="font-serif text-lg font-bold text-church-navy">Mural de Memórias Vazio</h3>
          <p className="text-xs text-church-navy/60 font-medium mt-1 leading-relaxed max-w-xs">
            Nenhuma foto foi postada nesta categoria ainda ou nenhum resultado corresponde à sua busca. Compartilhe o primeiro registro!
          </p>
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-church-navy px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-church-navy/90 transition-all active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Postar primeira foto
          </button>
        </div>
      ) : (
        <motion.div 
          layout
          className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredPhotos.map((photo) => {
              const canDelete = user && (photo.uploadedById === user.uid || isAdminOrOfficer);
              return (
                <motion.div
                  key={photo.id}
                  layoutId={`card-container-${photo.id}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-church-gold/10 bg-white shadow-sm hover:shadow-md transition-all h-[360px]"
                >
                  {/* Photo frame */}
                  <div className="relative overflow-hidden h-48 w-full bg-church-navy/5 shrink-0">
                    <img
                      src={photo.imageUrl}
                      alt={photo.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onClick={() => setLightboxPhoto(photo)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all duration-200 flex items-end justify-between p-3 pointer-events-none">
                      <div className="flex items-center gap-1.5 pointer-events-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxPhoto(photo);
                          }}
                          className="bg-white/90 hover:bg-white text-church-navy p-2 rounded-xl shadow transition-transform active:scale-90 flex items-center justify-center cursor-pointer"
                          title="Ampliar Foto"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDownloadPhoto(photo, e)}
                          className="bg-white/90 hover:bg-white text-church-navy p-2 rounded-xl shadow transition-transform active:scale-90 flex items-center justify-center cursor-pointer text-church-gold"
                          title="Baixar Foto"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleSharePhoto(photo, e)}
                          className="bg-white/90 hover:bg-white text-church-navy p-2 rounded-xl shadow transition-transform active:scale-90 flex items-center justify-center cursor-pointer text-emerald-600"
                          title="Compartilhar Imagem"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(photo);
                          }}
                          className="pointer-events-auto bg-red-500/95 hover:bg-red-600 text-white p-2 rounded-xl shadow transition-transform active:scale-90 flex items-center justify-center cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Category Overlay Pill */}
                    <span className="absolute top-3 left-3 bg-church-navy/85 backdrop-blur-sm text-church-gold px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest border border-church-gold/30">
                      {photo.category}
                    </span>
                  </div>

                  {/* Body Text */}
                  <div className="flex flex-1 flex-col justify-between p-4.5">
                    <div>
                      <h4 className="font-serif font-black text-sm text-church-navy line-clamp-1 leading-snug group-hover:text-church-gold transition-colors" title={photo.title}>
                        {photo.title}
                      </h4>
                      {photo.description && (
                        <p className="text-xs text-church-navy/60 font-medium line-clamp-2 mt-1 leading-relaxed">
                          {photo.description}
                        </p>
                      )}
                    </div>

                    {/* Metadata Footer bar */}
                    <div className="mt-3 pt-3 border-t border-church-gold/5 flex flex-col gap-1 text-[10px] text-church-navy/40 font-semibold font-mono">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-church-gold shrink-0" />
                        <span>{formatDateBR(photo.date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 truncate">
                        <User className="h-3 w-3 text-church-gold shrink-0" />
                        <span className="truncate">Publicado por {photo.uploadedByName}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* LIGHTBOX MODAL / LARGE PREVIEW */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 md:p-8 backdrop-blur-md"
            onClick={() => setLightboxPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative max-w-4xl w-full bg-white rounded-3xl overflow-hidden border border-church-gold/20 shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left Column / Enlarged Photo */}
              <div className="relative md:flex-[5] bg-black flex items-center justify-center overflow-hidden min-h-[300px] md:h-[600px]">
                <img
                  src={lightboxPhoto.imageUrl}
                  alt={lightboxPhoto.title}
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => setLightboxPhoto(null)}
                  className="absolute top-4 right-4 rounded-full bg-black/60 hover:bg-black p-2.5 text-white shadow-md transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Right Column / Metadata Sidebar */}
              <div className="md:flex-[3] p-6 lg:p-8 flex flex-col justify-between bg-white text-church-navy min-h-[200px] overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-church-navy px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-church-gold border border-church-gold/10">
                      {lightboxPhoto.category}
                    </span>
                    <span className="text-[10px] font-bold text-church-navy/40 uppercase tracking-wide">
                      Memória registrada
                    </span>
                  </div>

                  <h3 className="font-serif font-black text-xl lg:text-2xl mt-4 leading-snug">
                    {lightboxPhoto.title}
                  </h3>

                  <div className="flex flex-col gap-2.5 bg-church-cream/50 border border-church-gold/10 p-3.5 rounded-xl mt-4 text-xs font-semibold font-mono text-church-navy/70">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-church-gold" />
                      <span>{formatDateBR(lightboxPhoto.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-church-gold" />
                      <span className="truncate">Postado por: {lightboxPhoto.uploadedByName}</span>
                    </div>
                  </div>

                  {lightboxPhoto.description ? (
                    <div className="mt-6">
                      <p className="text-[10px] font-extrabold text-church-navy/40 uppercase tracking-widest">
                        Testemunho / Descrição
                      </p>
                      <p className="text-sm leading-relaxed text-church-navy/80 font-medium mt-1.5 whitespace-pre-line bg-church-cream/20 p-4 rounded-xl border border-dashed border-church-gold/15">
                        {lightboxPhoto.description}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs italic text-church-navy/35 mt-6">
                      Nenhum testemunho adicional fornecido para este culto.
                    </p>
                  )}
                </div>

                <div className="mt-8 pt-4 border-t border-church-gold/10 flex flex-wrap items-center justify-end gap-2.5 shrink-0">
                  <button
                    onClick={(e) => handleDownloadPhoto(lightboxPhoto, e)}
                    className="flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-church-navy border border-church-gold/30 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-church-gold" /> Baixar Foto HD
                  </button>
                  <button
                    onClick={(e) => handleSharePhoto(lightboxPhoto, e)}
                    className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    <Share2 className="h-4 w-4" /> Compartilhar Imagem
                  </button>
                  {user && (lightboxPhoto.uploadedById === user.uid || isAdminOrOfficer) && (
                    <button
                      onClick={() => handleDeletePhoto(lightboxPhoto)}
                      className="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </button>
                  )}
                  <button
                    onClick={() => setLightboxPhoto(null)}
                    className="bg-church-navy hover:bg-church-navy/90 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {photoToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setPhotoToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative max-w-sm w-full bg-white rounded-3xl overflow-hidden border border-church-gold/10 shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-church-navy">Excluir Foto</h3>
                  <p className="text-xs text-church-navy/60 mt-1">
                    Tem certeza de que deseja remover esta foto? Esta ação não pode ser desfeita.
                  </p>
                </div>
                {deleteError && (
                  <div className="w-full text-left p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[11px] leading-relaxed">
                    {deleteError}
                  </div>
                )}
                <div className="flex gap-3 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => setPhotoToDelete(null)}
                    className="flex-1 bg-church-navy/5 hover:bg-church-navy/10 text-church-navy py-3 px-4 rounded-xl text-xs font-bold transition-all active:scale-95"
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeletePhoto}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow active:scale-95"
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Sim, excluir'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UPLOAD NEW MEMORY MODAL FORM */}
      <AnimatePresence>
        {isUploadOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative max-w-xl w-full bg-white rounded-3xl overflow-hidden border border-church-gold/10 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="bg-church-navy p-6 shrink-0 relative flex items-center justify-between border-b border-church-gold/20 text-white">
                <div>
                  <h3 className="font-serif text-lg font-bold">Adicionar Foto do Culto</h3>
                  <p className="text-xs text-white/60">Guarde momentos de adoração em nosso mural de memórias.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="rounded-lg p-2 text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Error Banner inside form */}
                {previewError && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{previewError}</span>
                  </div>
                )}

                {/* Cult Title */}
                <div>
                  <label className="block text-xs font-bold text-church-navy uppercase tracking-wider mb-1.5">
                    Nome / Título do Culto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Grande Culto de Missões, Culto da Família..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-church-cream/30 border border-church-gold/10 hover:border-church-gold/30 focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold px-3.5 py-2.5 rounded-xl text-sm font-medium text-church-navy transition-all"
                    maxLength={100}
                  />
                </div>

                {/* Date and Category Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-church-navy uppercase tracking-wider mb-1.5">
                      Data do Culto *
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-church-cream/30 border border-church-gold/10 hover:border-church-gold/30 focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold px-3.5 py-2.5 rounded-xl text-sm font-medium font-mono text-church-navy transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-church-navy uppercase tracking-wider mb-1.5">
                      Categoria do Culto *
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-church-cream/30 border border-church-gold/10 hover:border-church-gold/30 focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold px-3.5 py-2.5 rounded-xl text-sm font-medium text-church-navy transition-all"
                    >
                      {CATEGORIES.filter(c => c !== 'Todos').map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description Testimonial */}
                <div>
                  <label className="block text-xs font-bold text-church-navy uppercase tracking-wider mb-1.5">
                    Testemunho ou Descrição do culto (Opcional)
                  </label>
                  <textarea
                    placeholder="Compartilhe uma bênção, o texto bíblico lido, as vidas salvas ou descreva o tom desse momento único de adoração..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-church-cream/30 border border-church-gold/10 hover:border-church-gold/30 focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold px-3.5 py-2.5 rounded-xl text-sm font-medium text-church-navy transition-all resize-none"
                    maxLength={1000}
                  />
                </div>

                {/* Image Input Selection Source Toggle */}
                <div className="border border-church-gold/15 p-4 rounded-2xl bg-church-cream/40 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-church-navy uppercase tracking-wider mb-2">
                      Origem da Imagem *
                    </label>
                    <div className="flex gap-2 p-1 bg-church-navy/5 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setImageType('upload');
                          setPreviewError('');
                        }}
                        className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                          imageType === 'upload'
                            ? 'bg-white text-church-navy shadow-sm'
                            : 'text-church-navy/60 hover:text-church-navy'
                        }`}
                      >
                        Upload do Dispositivo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImageType('url');
                          setPreviewError('');
                        }}
                        className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
                          imageType === 'url'
                            ? 'bg-white text-church-navy shadow-sm'
                            : 'text-church-navy/60 hover:text-church-navy'
                        }`}
                      >
                        Link do Google / Externo
                      </button>
                    </div>
                  </div>

                  {/* Form fields based on image selection type */}
                  {imageType === 'upload' ? (
                    <div>
                      {uploadedBase64 ? (
                        <div className="relative h-44 rounded-xl border border-church-gold/20 overflow-hidden bg-black flex items-center justify-center">
                          <img
                            src={uploadedBase64}
                            alt="Preview do Upload"
                            className="h-full w-full object-cover opacity-85"
                          />
                          <button
                            type="button"
                            onClick={() => setUploadedBase64(null)}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/60 hover:bg-black text-white transition-colors"
                            title="Remover Imagem"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-green-500 text-white text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border border-green-400">
                            <Check className="h-3.5 w-3.5" /> Otimizado com sucesso
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-church-gold/20 hover:border-church-gold/40 rounded-xl p-8 cursor-pointer transition-all bg-white hover:bg-church-cream/10 text-center">
                          <ImageIcon className="h-8 w-8 text-church-gold mb-2.5" />
                          <p className="text-xs font-bold text-church-navy">Arraste ou Selecione Foto do Culto</p>
                          <p className="text-[10px] text-church-navy/40 font-semibold mt-1">JPEG, PNG ou HEIF/HEIC (Alta Eficiência de iPhones)</p>
                          <input
                            type="file"
                            accept="image/*,.heic,.heif"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-church-navy/70">
                        Insira a URL da imagem (http:// ou https://)
                      </label>
                      <input
                        type="url"
                        placeholder="https://exemplo.com/minha-foto-culto.jpg"
                        value={imageUrlInput}
                        onChange={(e) => {
                          setImageUrlInput(e.target.value);
                          setPreviewError('');
                        }}
                        className="w-full bg-white border border-church-gold/10 hover:border-church-gold/20 focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold px-3.5 py-2.5 rounded-xl text-xs font-medium font-mono text-church-navy"
                      />
                      {imageUrlInput && (
                        <div className="text-[10px] text-church-navy/40 mt-1 pl-1">
                          Nota: Garanta que o domínio da imagem aceita acesso público.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Controls footer */}
                <div className="pt-4 border-t border-church-gold/10 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="bg-church-navy/5 hover:bg-church-navy/10 text-church-navy px-5 py-3 rounded-xl text-xs font-extrabold transition-all active:scale-95"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1.5 bg-church-navy hover:bg-church-navy/90 text-white px-6 py-3 rounded-xl text-xs font-extrabold transition-all shadow active:scale-95"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-church-gold" />
                        <span>Publicando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 text-church-gold" />
                        <span>Publicar Memória</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
