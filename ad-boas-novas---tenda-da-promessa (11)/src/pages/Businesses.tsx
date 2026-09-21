import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { 
  ShoppingBag, 
  Store, 
  Briefcase, 
  Plus, 
  Search, 
  Phone, 
  MessageCircle, 
  Instagram, 
  MapPin, 
  Trash2, 
  Edit3, 
  X, 
  Image as ImageIcon, 
  ChevronLeft, 
  ChevronRight, 
  Share2, 
  User, 
  Sparkles, 
  Tag, 
  Eye, 
  Upload, 
  Check, 
  Building2, 
  Wrench, 
  Utensils, 
  Scissors, 
  GraduationCap, 
  Laptop, 
  HelpCircle,
  ZoomIn,
  AlertTriangle,
  Star,
  MessageSquare,
  Quote,
  ThumbsUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BusinessListing {
  id: string;
  title: string;
  category: string;
  type: string;
  description: string;
  ownerId: string;
  ownerName: string;
  ownerPhoto?: string;
  phone?: string;
  whatsapp: string;
  instagram?: string;
  address?: string;
  photos: string[];
  status?: string;
  rating?: number;
  reviewCount?: number;
  createdAt?: any;
  updatedAt?: any;
}

interface BusinessReview {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt?: any;
}

const CATEGORIES = [
  { id: 'Serviços Profissionais', label: 'Serviços Profissionais', icon: Briefcase, color: 'bg-blue-500' },
  { id: 'Lojas & Vendas', label: 'Lojas & Vendas', icon: Store, color: 'bg-purple-500' },
  { id: 'Alimentação & Gastronomia', label: 'Alimentação & Gastronomia', icon: Utensils, color: 'bg-amber-500' },
  { id: 'Estética & Beleza', label: 'Estética & Beleza', icon: Scissors, color: 'bg-pink-500' },
  { id: 'Construção & Reformas', label: 'Construção & Reformas', icon: Wrench, color: 'bg-orange-500' },
  { id: 'Tecnologia & Design', label: 'Tecnologia & Design', icon: Laptop, color: 'bg-indigo-500' },
  { id: 'Aulas & Educação', label: 'Aulas & Educação', icon: GraduationCap, color: 'bg-emerald-500' },
  { id: 'Outros', label: 'Outros', icon: HelpCircle, color: 'bg-slate-500' }
];

const TYPES = [
  'Loja / Produtos',
  'Serviço Prestado',
  'Profissional Liberal',
  'Trabalho Autônomo',
  'Outros'
];

interface BusinessesProps {
  role?: string | null;
}

// Compress image helper function (max 1000px, jpeg quality 0.8)
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1000;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUrl);
        } else {
          reject(new Error('Canvas context error'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export default function Businesses({ role }: BusinessesProps) {
  const user = auth.currentUser;
  const isAdminOrPastor = role && ['admin', 'pastor', 'pastora'].includes(role.toLowerCase());

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedType, setSelectedType] = useState<string>('Todos');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BusinessListing | null>(null);
  const [detailItem, setDetailItem] = useState<BusinessListing | null>(null);
  const [itemToDelete, setItemToDelete] = useState<BusinessListing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lightbox Zoom States
  const [zoomedPhotos, setZoomedPhotos] = useState<string[] | null>(null);
  const [zoomedIndex, setZoomedIndex] = useState<number>(0);

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [type, setType] = useState(TYPES[0]);
  const [description, setDescription] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [address, setAddress] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Firestore Query
  const businessesQuery = query(
    collection(db, 'businesses'),
    orderBy('createdAt', 'desc')
  );

  const [snapshot, loading, error] = useCollection(businessesQuery);

  const listings: BusinessListing[] = snapshot ? snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as BusinessListing[] : [];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenForm = (itemToEdit?: BusinessListing) => {
    if (itemToEdit) {
      setEditingItem(itemToEdit);
      setTitle(itemToEdit.title || '');
      setCategory(itemToEdit.category || CATEGORIES[0].id);
      setType(itemToEdit.type || TYPES[0]);
      setDescription(itemToEdit.description || '');
      setWhatsapp(itemToEdit.whatsapp || '');
      setPhone(itemToEdit.phone || '');
      setInstagram(itemToEdit.instagram || '');
      setAddress(itemToEdit.address || '');
      setPhotos(itemToEdit.photos || []);
    } else {
      setEditingItem(null);
      setTitle('');
      setCategory(CATEGORIES[0].id);
      setType(TYPES[0]);
      setDescription('');
      setWhatsapp('');
      setPhone('');
      setInstagram('');
      setAddress('');
      setPhotos([]);
    }
    setErrorMessage('');
    setIsFormOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length >= 4) {
      setErrorMessage('Você já atingiu o limite de 4 fotos.');
      return;
    }

    const remainingSlots = 4 - photos.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    setIsCompressing(true);
    setErrorMessage('');

    try {
      const compressed: string[] = [];
      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) continue;
        const base64 = await compressImage(file);
        compressed.push(base64);
      }
      setPhotos(prev => [...prev, ...compressed].slice(0, 4));
    } catch (err) {
      console.error('Error compressing image:', err);
      setErrorMessage('Ocorreu um erro ao processar as fotos. Tente novamente.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim()) {
      setErrorMessage('Por favor, informe o nome do negócio ou serviço.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Por favor, adicione uma descrição detalhada.');
      return;
    }

    if (!whatsapp.trim()) {
      setErrorMessage('Por favor, informe pelo menos o número do WhatsApp.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const payload = {
        title: title.trim(),
        category,
        type,
        description: description.trim(),
        ownerId: user.uid,
        ownerName: user.displayName || user.email?.split('@')[0] || 'Membro da Igreja',
        ownerPhoto: user.photoURL || '',
        whatsapp: whatsapp.replace(/\D/g, ''),
        phone: phone.trim(),
        instagram: instagram.trim().replace(/^@/, ''),
        address: address.trim(),
        photos: photos.slice(0, 4),
        status: 'active',
        updatedAt: serverTimestamp()
      };

      if (editingItem) {
        await updateDoc(doc(db, 'businesses', editingItem.id), payload);
        showToast('Anúncio atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'businesses'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        showToast('Seu anúncio foi publicado com sucesso!');
      }

      setIsFormOpen(false);
    } catch (err) {
      console.error('Error saving business listing:', err);
      handleFirestoreError(err, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'businesses');
      setErrorMessage('Erro ao salvar anúncio. Verifique sua conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteListing = (item: BusinessListing) => {
    setItemToDelete(item);
  };

  const confirmDeleteListing = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'businesses', itemToDelete.id));
      showToast('Anúncio excluído com sucesso!');
      if (detailItem?.id === itemToDelete.id) {
        setDetailItem(null);
      }
      setItemToDelete(null);
    } catch (err) {
      console.error('Error deleting listing:', err);
      handleFirestoreError(err, OperationType.DELETE, `businesses/${itemToDelete.id}`);
      showToast('Erro ao excluir anúncio. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtering
  const filteredListings = listings.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
    const matchesType = selectedType === 'Todos' || item.type === selectedType;

    return matchesSearch && matchesCategory && matchesType;
  });

  const getWhatsAppLink = (num: string, titleName: string) => {
    const cleanNum = num.replace(/\D/g, '');
    const formatted = cleanNum.length <= 11 ? `55${cleanNum}` : cleanNum;
    const message = `Olá! Vi seu anúncio "${titleName}" no aplicativo da igreja Boas Novas e gostaria de mais informações!`;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6 pb-24">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-medium text-sm"
          >
            <Check className="h-5 w-5 bg-white/20 rounded-full p-1" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner / Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-church-navy via-slate-900 to-church-navy p-6 sm:p-8 text-white shadow-xl border border-church-gold/20">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-church-gold/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-church-gold/20 border border-church-gold/40 px-3 py-1 text-xs font-semibold text-church-gold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Apoie os Irmãos da Igreja</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
              Empreendimentos & Serviços
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Guia Comercial e Profissional. Ofereça seus serviços, divulgue sua loja, produtos e trabalhos para toda a comunidade!
            </p>
          </div>

          <button
            onClick={() => handleOpenForm()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-church-gold text-church-navy hover:bg-church-gold/90 font-bold px-6 py-3.5 text-sm uppercase tracking-wider shadow-lg hover:shadow-church-gold/20 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="h-5 w-5" />
            <span>Anunciar Meu Negócio</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por serviço, loja, profissional ou palavra-chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-church-gold/50 focus:border-church-gold text-sm transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Type Filter Select */}
          <div className="w-full md:w-56 shrink-0">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-church-gold/50 focus:border-church-gold"
            >
              <option value="Todos">Todos os Tipos</option>
              {TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-2">
          <button
            onClick={() => setSelectedCategory('Todos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'Todos'
                ? 'bg-church-navy text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos os Categorias
          </button>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-church-gold text-church-navy shadow-md font-extrabold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isSelected ? 'text-church-navy' : 'text-slate-500'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-church-gold border-t-transparent mb-3" />
          <p className="text-slate-500 text-xs font-medium">Carregando empreendimentos...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-3xl text-center space-y-2">
          <p className="font-bold">Não foi possível carregar os anúncios.</p>
          <p className="text-sm text-red-600">Por favor, tente novamente mais tarde.</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 shadow-sm space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 text-church-gold flex items-center justify-center">
            <Store className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-bold text-slate-800">
              {searchTerm || selectedCategory !== 'Todos' || selectedType !== 'Todos'
                ? 'Nenhum resultado encontrado'
                : 'Nenhum empreendimento publicado ainda'}
            </h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              {searchTerm || selectedCategory !== 'Todos' || selectedType !== 'Todos'
                ? 'Tente mudar os filtros de busca ou pesquisar por outros termos.'
                : 'Seja o primeiro a publicar seu serviço, loja ou trabalho na nossa comunidade!'}
            </p>
          </div>
          <button
            onClick={() => handleOpenForm()}
            className="inline-flex items-center gap-2 rounded-2xl bg-church-navy text-white hover:bg-church-navy/90 font-bold px-5 py-2.5 text-xs uppercase tracking-wider shadow transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 text-church-gold" />
            <span>Publicar Meu Anúncio Agora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredListings.map(item => {
            const isOwner = user?.uid === item.ownerId;
            const canManage = isOwner || isAdminOrPastor;
            const hasPhotos = item.photos && item.photos.length > 0;
            const mainPhoto = hasPhotos ? item.photos[0] : null;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Photo Thumbnail Header */}
                  <div 
                    onClick={() => setDetailItem(item)}
                    className="relative h-36 bg-slate-900 overflow-hidden cursor-pointer group-hover:opacity-95 transition-opacity"
                  >
                    {mainPhoto ? (
                      <img
                        src={mainPhoto}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-800 via-church-navy to-slate-900 flex flex-col items-center justify-center text-white/40 p-3 text-center">
                        <Store className="h-8 w-8 mb-1 text-church-gold/40" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                          {item.category}
                        </span>
                      </div>
                    )}

                    {/* Category & Photo Count Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 flex-wrap max-w-[85%]">
                      <span className="bg-church-navy/90 text-church-gold text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-md border border-church-gold/30">
                        {item.category}
                      </span>
                    </div>

                    {/* Rating & Photo Count Badges */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1">
                      {item.rating && item.reviewCount && item.reviewCount > 0 ? (
                        <div className="bg-black/75 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 border border-amber-400/40">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span>{item.rating.toFixed(1)}</span>
                          <span className="text-white/70 font-normal">({item.reviewCount})</span>
                        </div>
                      ) : (
                        <div className="bg-black/50 text-slate-300 text-[9px] font-medium px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 border border-white/10">
                          <Star className="h-2.5 w-2.5 text-amber-300/80" />
                          <span>Novo</span>
                        </div>
                      )}
                    </div>

                    {hasPhotos && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 border border-white/20">
                        <ImageIcon className="h-3 w-3 text-church-gold" />
                        <span>{item.photos.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 space-y-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {item.type}
                        </span>
                        {canManage && (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleOpenForm(item)}
                              title="Editar"
                              className="p-1 rounded-lg text-slate-400 hover:text-church-navy hover:bg-slate-100 transition-colors"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteListing(item)}
                              title="Excluir"
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 
                        onClick={() => setDetailItem(item)}
                        className="font-serif text-base font-bold text-slate-800 line-clamp-1 hover:text-church-navy cursor-pointer leading-snug"
                      >
                        {item.title}
                      </h3>
                    </div>

                    <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">
                      {item.description}
                    </p>

                    {/* Owner & Location Info */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {item.ownerPhoto ? (
                          <img
                            src={item.ownerPhoto}
                            alt={item.ownerName}
                            className="h-5 w-5 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                            <User className="h-3 w-3" />
                          </div>
                        )}
                        <span className="truncate font-medium text-slate-700">{item.ownerName}</span>
                      </div>

                      {item.address && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0 max-w-[100px] truncate" title={item.address}>
                          <MapPin className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                          <span className="truncate">{item.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center gap-1.5">
                  {item.whatsapp && (
                    <a
                      href={getWhatsAppLink(item.whatsapp, item.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-2.5 text-[11px] shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  <button
                    onClick={() => setDetailItem(item)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold py-1.5 px-2.5 text-[11px] transition-all cursor-pointer"
                  >
                    <Eye className="h-3 w-3 text-slate-500" />
                    <span>Ver</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL WITH SLIDER GALLERY */}
      <AnimatePresence>
        {detailItem && (
          <div 
            onClick={() => setDetailItem(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-hidden"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Header Image Gallery */}
              <div className="relative bg-slate-900 h-48 sm:h-52 shrink-0 group">
                {detailItem.photos && detailItem.photos.length > 0 ? (
                  <DetailPhotoSlider 
                    photos={detailItem.photos} 
                    title={detailItem.title} 
                    onZoom={(photos, idx) => {
                      setZoomedPhotos(photos);
                      setZoomedIndex(idx);
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-church-navy to-slate-900 flex flex-col items-center justify-center text-white/50 p-4 text-center">
                    <Store className="h-12 w-12 mb-1.5 text-church-gold" />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-300">
                      {detailItem.category}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setDetailItem(null)}
                  className="absolute top-3 right-3 z-20 rounded-full bg-black/60 text-white p-1.5 hover:bg-black/80 transition-colors backdrop-blur-md cursor-pointer"
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="bg-church-navy text-church-gold text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                      {detailItem.category}
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                      {detailItem.type}
                    </span>
                  </div>

                  <h2 className="font-serif text-lg font-bold text-slate-900 leading-snug">
                    {detailItem.title}
                  </h2>
                </div>

                {/* Owner info */}
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  {detailItem.ownerPhoto ? (
                    <img
                      src={detailItem.ownerPhoto}
                      alt={detailItem.ownerName}
                      className="h-8 w-8 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-church-navy text-church-gold font-bold flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Oferecido por</p>
                    <p className="text-xs font-bold text-slate-800">{detailItem.ownerName}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Sobre o Negócio / Serviço
                  </h4>
                  <p className="text-slate-700 text-xs whitespace-pre-line leading-relaxed">
                    {detailItem.description}
                  </p>
                </div>

                {/* Info List */}
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {detailItem.address && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 text-slate-700 text-[11px]">
                      <MapPin className="h-3.5 w-3.5 text-church-gold shrink-0" />
                      <span>{detailItem.address}</span>
                    </div>
                  )}

                  {detailItem.phone && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 text-slate-700 text-[11px]">
                      <Phone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span>{detailItem.phone}</span>
                    </div>
                  )}

                  {detailItem.instagram && (
                    <a
                      href={`https://instagram.com/${detailItem.instagram.replace(/^@/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 text-slate-700 text-[11px] hover:bg-slate-100 transition-colors"
                    >
                      <Instagram className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                      <span>@{detailItem.instagram.replace(/^@/, '')}</span>
                    </a>
                  )}
                </div>

                {/* Reviews & Testimonials Section */}
                <ReviewsSection
                  businessItem={detailItem}
                  currentUser={user}
                  isAdminOrPastor={isAdminOrPastor}
                  showToast={showToast}
                />

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                  {detailItem.whatsapp && (
                    <a
                      href={getWhatsAppLink(detailItem.whatsapp, detailItem.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </a>
                  )}

                  {(user?.uid === detailItem.ownerId || isAdminOrPastor) && (
                    <>
                      <button
                        onClick={() => {
                          const targetItem = detailItem;
                          setDetailItem(null);
                          handleOpenForm(targetItem);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3 text-xs transition-all cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => {
                          const targetItem = detailItem;
                          setItemToDelete(targetItem);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 px-3 text-xs transition-all cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Excluir</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FORM MODAL (CREATE / EDIT) */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[88vh] flex flex-col p-4 sm:p-6 border border-slate-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-church-gold/20 text-church-navy">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-slate-900 leading-tight">
                      {editingItem ? 'Editar Anúncio' : 'Publicar Anúncio'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Preencha os dados do seu serviço/loja (até 4 fotos).
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-xl my-2 shrink-0">
                  {errorMessage}
                </div>
              )}

              {/* Scrollable Form Body */}
              <form onSubmit={handleSaveListing} className="flex-1 overflow-y-auto pr-1 space-y-4 pt-3 text-xs scrollbar-thin">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Nome do Negócio / Serviço <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Doces Gourmet da Maria, Eletricista"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-church-gold/50 focus:border-church-gold text-xs"
                  />
                </div>

                {/* Category & Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Categoria <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs font-medium"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Tipo de Atuação <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs font-medium"
                    >
                      {TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Descrição Detalhada <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Descreva o que você oferece, horários de atendimento, ofertas especiais, etc."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-church-gold/50 focus:border-church-gold text-xs"
                  />
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: (11) 99999-9999"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Instagram (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: @seunegocio"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Telefone Fixo (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: (11) 3333-4444"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Endereço / Local (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Rua das Flores, 123"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-church-gold/50 text-xs"
                    />
                  </div>
                </div>

                {/* Photo Upload Gallery (Up to 4 photos) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                        Fotos de Amostra (Máximo 4)
                      </label>
                      <p className="text-[10px] text-slate-400">
                        Envie fotos dos seus produtos ou serviços.
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold text-church-navy bg-slate-100 px-2 py-0.5 rounded-full">
                      {photos.length} / 4 fotos
                    </span>
                  </div>

                  {/* Photo Preview Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    {photos.map((photo, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden bg-slate-100 aspect-square border border-slate-200">
                        <img
                          src={photo}
                          alt={`Amostra ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors cursor-pointer"
                          title="Remover Foto"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1 rounded">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}

                    {photos.length < 4 && (
                      <label className="border-2 border-dashed border-slate-300 hover:border-church-gold rounded-xl aspect-square flex flex-col items-center justify-center p-1 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-amber-50/50">
                        <Upload className="h-4 w-4 text-slate-400 mb-0.5" />
                        <span className="text-[10px] font-bold text-slate-600">Adicionar</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoUpload}
                          disabled={isCompressing || photos.length >= 4}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {isCompressing && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-amber-600 border-t-transparent" />
                      <span>Processando imagens...</span>
                    </div>
                  )}
                </div>

                {/* Form Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 sticky bottom-0 bg-white pb-1">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving || isCompressing}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-church-navy hover:bg-church-navy/90 text-white font-bold px-5 py-2 text-xs uppercase tracking-wider shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 text-church-gold" />
                        <span>{editingItem ? 'Salvar' : 'Publicar'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 border border-slate-200"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  Confirmar Exclusão
                </h3>
                <p className="text-xs text-slate-500">
                  Tem certeza de que deseja excluir o anúncio <strong className="text-slate-800">"{itemToDelete.title}"</strong>? Esta ação não poderá ser desfeita.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteListing}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isDeleting ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>Excluir</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX FULLSCREEN PHOTO ZOOM */}
      <AnimatePresence>
        {zoomedPhotos && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl w-full h-full max-h-[90vh] flex flex-col items-center justify-center"
            >
              <button
                type="button"
                onClick={() => setZoomedPhotos(null)}
                className="absolute top-2 right-2 z-50 rounded-full bg-white/20 text-white p-2 hover:bg-white/30 transition-colors backdrop-blur-md cursor-pointer"
                title="Fechar"
              >
                <X className="h-6 w-6" />
              </button>

              <img
                src={zoomedPhotos[zoomedIndex]}
                alt="Foto ampliada"
                className="max-h-[82vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
              />

              {zoomedPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setZoomedIndex((prev) => (prev === 0 ? zoomedPhotos.length - 1 : prev - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2.5 rounded-full backdrop-blur-md transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomedIndex((prev) => (prev === zoomedPhotos.length - 1 ? 0 : prev + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2.5 rounded-full backdrop-blur-md transition-all cursor-pointer"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>

                  <div className="absolute bottom-2 bg-black/60 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md border border-white/20">
                    {zoomedIndex + 1} / {zoomedPhotos.length}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponent for Detail Photo Gallery Slider with Zoom Support
function DetailPhotoSlider({ 
  photos, 
  title, 
  onZoom 
}: { 
  photos: string[]; 
  title: string; 
  onZoom?: (photos: string[], index: number) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const nextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  return (
    <div 
      onClick={() => onZoom?.(photos, currentIndex)}
      className="relative w-full h-full overflow-hidden bg-slate-900 group cursor-pointer"
      title="Clique para ampliar a imagem"
    >
      <img
        src={photos[currentIndex]}
        alt={`${title} - foto ${currentIndex + 1}`}
        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
      />

      {/* Zoom indicator badge */}
      <div className="absolute top-2.5 left-2.5 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-md flex items-center gap-1 border border-white/20 opacity-90 group-hover:opacity-100">
        <ZoomIn className="h-3 w-3 text-church-gold" />
        <span>Ampliar Foto</span>
      </div>

      {/* Slide Navigation Buttons */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all cursor-pointer opacity-80 group-hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all cursor-pointer opacity-80 group-hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-md">
            {photos.map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === currentIndex ? 'w-4 bg-church-gold' : 'w-1.5 bg-white/50 hover:bg-white'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Subcomponent for Reviews and Testimonials
function ReviewsSection({
  businessItem,
  currentUser,
  isAdminOrPastor,
  showToast
}: {
  businessItem: BusinessListing;
  currentUser: any;
  isAdminOrPastor: boolean;
  showToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [reviewsSnapshot, reviewsLoading] = useCollection(
    query(
      collection(db, 'businesses', businessItem.id, 'reviews'),
      orderBy('createdAt', 'desc')
    )
  );

  const reviews: BusinessReview[] = reviewsSnapshot
    ? reviewsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as BusinessReview))
    : [];

  const totalReviews = reviews.length;
  const avgRating =
    totalReviews > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / totalReviews
      : 0;

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('Faça login para avaliar este empreendimento.');
      return;
    }
    if (!comment.trim()) {
      showToast('Escreva uma breve avaliação antes de enviar.');
      return;
    }

    setIsSubmitting(true);
    try {
      const reviewData = {
        businessId: businessItem.id,
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Irmão(ã) em Cristo',
        userPhoto: currentUser.photoURL || '',
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'businesses', businessItem.id, 'reviews'), reviewData);

      const newCount = totalReviews + 1;
      const newAvg = (reviews.reduce((s, r) => s + r.rating, 0) + rating) / newCount;

      await updateDoc(doc(db, 'businesses', businessItem.id), {
        rating: newAvg,
        reviewCount: newCount,
        updatedAt: serverTimestamp()
      });

      setComment('');
      setRating(5);
      setShowForm(false);
      showToast('Depoimento e avaliação publicados!');
    } catch (err) {
      console.error('Error adding review:', err);
      showToast('Erro ao publicar avaliação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Excluir este depoimento?')) return;

    try {
      await deleteDoc(doc(db, 'businesses', businessItem.id, 'reviews', reviewId));

      const remaining = reviews.filter((r) => r.id !== reviewId);
      const newCount = remaining.length;
      const newAvg = newCount > 0 ? remaining.reduce((s, r) => s + r.rating, 0) / newCount : 0;

      await updateDoc(doc(db, 'businesses', businessItem.id), {
        rating: newAvg,
        reviewCount: newCount,
        updatedAt: serverTimestamp()
      });

      showToast('Depoimento removido com sucesso.');
    } catch (err) {
      console.error('Error deleting review:', err);
      showToast('Erro ao excluir depoimento.');
    }
  };

  const ratingLabels = ['Péssimo', 'Ruim', 'Regular', 'Muito Bom!', 'Excelente!'];

  return (
    <div className="pt-3 border-t border-slate-100 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
            <Quote className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>Depoimentos & Avaliações</span>
              {totalReviews > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                  <span>{avgRating.toFixed(1)}</span>
                  <span className="text-amber-600 font-normal">({totalReviews})</span>
                </span>
              )}
            </h4>
            <p className="text-[10px] text-slate-500">
              {totalReviews === 0
                ? 'Nenhum depoimento ainda'
                : `${totalReviews} ${totalReviews === 1 ? 'membro avaliou' : 'membros avaliaram'}`}
            </p>
          </div>
        </div>

        {currentUser && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-church-navy bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
          >
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>{showForm ? 'Fechar Form' : 'Avaliar'}</span>
          </button>
        )}
      </div>

      {/* Review Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddReview}
            className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 space-y-2.5 overflow-hidden"
          >
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-[11px] font-bold text-slate-700">Sua Nota:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => {
                  const isFilled = (hoverRating !== null ? hoverRating : rating) >= s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(s)}
                      className="p-0.5 cursor-pointer transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          isFilled
                            ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="text-[10px] font-bold text-amber-700 ml-1">
                  {ratingLabels[(hoverRating !== null ? hoverRating : rating) - 1]}
                </span>
              </div>
            </div>

            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escreva seu depoimento sobre a qualidade do serviço ou atendimento do irmão..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-church-gold/50"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3.5 py-1 text-[11px] font-bold text-church-navy bg-church-gold hover:bg-church-gold/90 rounded-xl shadow transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-church-navy border-t-transparent" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Enviar Depoimento</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Reviews List */}
      {reviewsLoading ? (
        <div className="text-center py-2 text-[11px] text-slate-400">
          Carregando depoimentos...
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100 space-y-1">
          <Quote className="h-4 w-4 text-slate-300 mx-auto" />
          <p className="text-[11px] text-slate-500 font-medium">
            Nenhum depoimento publicado ainda.
          </p>
          <p className="text-[10px] text-slate-400">
            Já contratou ou comprou com este irmão? Clique em "Avaliar" para recomendar aos irmãos!
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
          {reviews.map((rev) => {
            const isAuthor = currentUser?.uid === rev.userId;
            const canDeleteRev = isAuthor || isAdminOrPastor;

            return (
              <div
                key={rev.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 relative group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {rev.userPhoto ? (
                      <img
                        src={rev.userPhoto}
                        alt={rev.userName}
                        className="h-6 w-6 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-church-navy text-church-gold font-bold flex items-center justify-center text-[10px]">
                        <User className="h-3 w-3" />
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] font-bold text-slate-800 leading-tight">
                        {rev.userName}
                      </p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-2.5 w-2.5 ${
                              s <= rev.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {canDeleteRev && (
                    <button
                      onClick={() => handleDeleteReview(rev.id)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Excluir Depoimento"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed italic pl-1 border-l-2 border-amber-300">
                  "{rev.comment}"
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
