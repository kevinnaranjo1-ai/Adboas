import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { User as UserIcon, Mail, Shield, Check, Loader2, Save, Calendar, Smartphone, Award, ThumbsUp, IdCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MemberIDCardModal from '../components/MemberIDCardModal';

export default function Profile() {
  const user = auth.currentUser;
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [memberData, setMemberData] = useState<any | null>(null);
  const [userDoc, setUserDoc] = useState<any | null>(null);
  const [isIDCardOpen, setIsIDCardOpen] = useState(false);

  useEffect(() => {
    async function fetchUserData() {
      if (!user) return;
      try {
        setDisplayName(user.displayName || '');

        // Fetch /users/{userId} document
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uDoc = userSnap.data();
          setUserDoc(uDoc);
          if (uDoc.displayName) {
            setDisplayName(uDoc.displayName);
          }
        }

        // Search matching record in /members collection by email
        if (user.email) {
          const memberQuery = query(
            collection(db, 'members'),
            where('email', '==', user.email),
            where('status', '==', 'active')
          );
          const memberSnap = await getDocs(memberQuery);
          if (!memberSnap.empty) {
            setMemberData({
              id: memberSnap.docs[0].id,
              ...memberSnap.docs[0].data()
            });
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados do perfil:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setStatusMessage({ type: 'error', text: 'O nome de perfil não pode estar em branco.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      // 1. Update Firebase Auth Profile info
      await updateProfile(user, { displayName: trimmedName });

      // 2. Update Firestore /users/{uid} document
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: trimmedName,
        updatedAt: new Date()
      });

      // 3. Update Firestore /members/{memberId} document if it exists
      if (memberData) {
        const memberRef = doc(db, 'members', memberData.id);
        await updateDoc(memberRef, {
          name: trimmedName
        });
        setMemberData((prev: any) => ({ ...prev, name: trimmedName }));
      }

      setStatusMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      
      // Auto close/clear status message after 3 seconds
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      setStatusMessage({ type: 'error', text: 'Ocorreu um erro ao salvar suas alterações.' });
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (r: string | null) => {
    if (!r) return 'Membro';
    const labels: Record<string, string> = {
      admin: 'Administrador (Pastor)',
      pastor: 'Pastor',
      pastora: 'Pastora',
      leader: 'Líder de Ministério',
      obreiro: 'Obreiro',
      presbítero: 'Presbítero',
      missionário: 'Missionário',
      missionária: 'Missionária',
      diácono: 'Diácono',
      evangelista: 'Evangelista',
      diaconisa: 'Diaconisa',
      'mídia social': 'Mídia Social',
      membro: 'Membro'
    };
    return labels[r] || r.charAt(0).toUpperCase() + r.slice(1);
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-church-gold" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header section */}
      <header className="text-left py-2">
        <h1 className="font-serif text-3xl font-bold text-church-navy">Meu Perfil</h1>
        <p className="text-church-navy/60">Gerencie suas informações de acesso e credenciais de membro.</p>
      </header>

      {/* Main card */}
      <div className="bg-white rounded-3xl border border-church-gold/10 shadow-sm overflow-hidden">
        {/* Top visual banner */}
        <div className="bg-gradient-to-r from-church-navy to-church-navy/90 p-8 text-white relative">
          <div className="absolute top-0 right-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-church-gold/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-center gap-6 relative z-10 text-left">
            {/* User photo/avatar */}
            <div className="h-24 w-24 rounded-full border-4 border-church-gold/30 bg-church-cream flex items-center justify-center text-church-navy shrink-0 shadow-lg overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif font-black text-3xl text-church-navy/80">
                  {getInitials(displayName || user?.email || '')}
                </span>
              )}
            </div>

            <div className="space-y-1 text-center md:text-left flex-1">
              <h2 className="font-serif text-2xl font-black">{displayName || 'Nome de Membro'}</h2>
              <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-church-gold/20 text-church-gold border border-church-gold/30 text-xs font-bold leading-none uppercase tracking-wide">
                  <Shield className="h-3 w-3" />
                  {getRoleLabel(userDoc?.role || 'membro')}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/80 border border-white/10 text-xs font-mono">
                  <Mail className="h-3 w-3" />
                  {user?.email}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsIDCardOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-church-gold text-church-navy hover:bg-church-gold/90 font-bold px-5 py-2.5 text-xs uppercase tracking-wider shadow transition-all active:scale-95 cursor-pointer border border-white/20 shrink-0"
            >
              <IdCard className="h-4 w-4" />
              <span>Abrir Credencial Digital</span>
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 md:p-8 space-y-8 text-left">
          {/* Notification Messages */}
          <AnimatePresence>
            {statusMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex items-center gap-3 p-4 rounded-xl text-sm font-bold border ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                <div className={`p-1 rounded-lg ${statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {statusMessage.type === 'success' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="font-black">!</span>
                  )}
                </div>
                <span>{statusMessage.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="displayName" className="block text-sm font-bold text-church-navy">
                Nome de Perfil
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-church-navy/40">
                  <UserIcon className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  id="displayName"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="block w-full rounded-xl border border-church-gold/20 bg-church-cream/5 py-3.5 pl-11 pr-4 text-church-navy placeholder-church-navy/30 focus:border-church-gold focus:outline-none focus:ring-1 focus:ring-church-gold text-base"
                  placeholder="Seu nome completo ou como gosta de ser chamado"
                />
              </div>
              <p className="text-xs text-church-navy/50">
                Este nome será exibido nos cumprimentos, listas de membros e relatórios que você preencher.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-xl bg-church-navy hover:bg-church-navy/95 text-white py-3.5 px-6 text-sm font-black transition-all shadow active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-church-gold" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Member Card Details if authenticated as linked church member */}
          {memberData && (
            <div className="border-t border-church-gold/10 pt-8 space-y-6">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-church-gold" />
                <h3 className="font-serif text-lg font-bold text-church-navy">Sua Ficha de Membro Oficial</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-2xl bg-church-cream/40 border border-church-gold/5 flex gap-3">
                  <Calendar className="h-5 w-5 text-church-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-church-navy/40">Data de Aniversário</p>
                    <p className="text-sm font-bold text-church-navy mt-0.5">
                      {memberData.birthDate ? memberData.birthDate.split('-').reverse().join('/') : 'Não informada'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-church-cream/40 border border-church-gold/5 flex gap-3">
                  <Smartphone className="h-5 w-5 text-church-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-church-navy/40">WhatsApp / Telefone</p>
                    <p className="text-sm font-bold text-church-navy mt-0.5">
                      {memberData.whatsapp || memberData.phone || 'Não informado'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-church-cream/40 border border-church-gold/5 flex gap-3">
                  <Award className="h-5 w-5 text-church-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-church-navy/40">Cargo Ministerial</p>
                    <p className="text-sm font-bold text-church-navy mt-0.5">
                      {memberData.position || 'Membro'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-church-cream/40 border border-church-gold/5 flex gap-3">
                  <ThumbsUp className="h-5 w-5 text-church-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-church-navy/40">Batismo nas Águas</p>
                    <p className="text-sm font-bold text-church-navy mt-0.5">
                      {memberData.isBaptized ? 'Sim, batizado(a)' : 'Não'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isIDCardOpen && user && (
        <MemberIDCardModal
          member={{
            id: memberData?.id || user.uid,
            name: memberData?.name || displayName || user.displayName || user.email?.split('@')[0] || 'Membro',
            email: memberData?.email || user.email || '',
            phone: memberData?.phone || memberData?.whatsapp || '',
            whatsapp: memberData?.whatsapp || '',
            cpf: memberData?.cpf || '',
            birthDate: memberData?.birthDate || '',
            department: memberData?.department || '',
            position: memberData?.position || getRoleLabel(userDoc?.role || 'membro'),
            isBaptized: memberData?.isBaptized ?? true,
            isSpiritBaptized: memberData?.isSpiritBaptized ?? false,
            isTither: memberData?.isTither ?? true,
            status: memberData?.status || 'active',
            photoUrl: memberData?.photoUrl || user.photoURL || undefined
          }}
          onClose={() => setIsIDCardOpen(false)}
          canUploadPhoto={true}
          onPhotoUpdated={(memberId, newPhoto) => {
            setMemberData((prev: any) => prev ? { ...prev, photoUrl: newPhoto } : null);
          }}
        />
      )}
    </div>
  );
}
