import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import Navbar from './components/layout/Navbar';
import AdminSidebar from './components/layout/AdminSidebar';
import Dashboard from './pages/Dashboard';
import ReportForm from './pages/ReportForm';
import AdminView from './pages/AdminView';
import FinanceManagement from './pages/admin/FinanceManagement';
import MemberManagement from './pages/admin/MemberManagement';
import WorkerManagement from './pages/admin/WorkerManagement';
import DepartmentManagement from './pages/admin/DepartmentManagement';
import CalendarPage from './pages/admin/Calendar';
import ConstructionManagement from './pages/admin/ConstructionManagement';
import AttendanceManagement from './pages/admin/AttendanceManagement';
import EBDManagement from './pages/admin/EBDManagement';
import AnnouncementSettings from './pages/admin/AnnouncementSettings';
import Login from './pages/Login';
import CultPhotosGallery from './pages/CultPhotosGallery';
import Profile from './pages/Profile';
import Bible from './pages/Bible';
import Harpa from './pages/Harpa';
import VideoPage from './pages/VideoPage';
import PrayerRequests from './pages/PrayerRequests';
import Studies from './pages/Studies';
import Notes from './pages/Notes';
import Businesses from './pages/Businesses';
import VisitorManagement from './pages/admin/VisitorManagement';
import ChildPresentationManagement from './pages/admin/ChildPresentationManagement';
import ServiceVisitsManagement from './pages/admin/ServiceVisitsManagement';
import { Loader2, MessageCircle } from 'lucide-react';
import { requestNotificationPermission, createNewMemberNotification, checkAndSendBirthdayNotifications } from './lib/notifications';
import { MiniPlayerProvider } from './context/MiniPlayerContext';
import { GlobalMiniPlayer } from './components/common/GlobalMiniPlayer';

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function checkRole() {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        try {
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            // O primeiro usuário (você) ou o e-mail específico será Admin
            const isAdminEmail = user.email?.toLowerCase() === 'kevinnaranjo1@gmail.com';
            const initialRole = isAdminEmail ? 'admin' : 'membro';
            
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              role: initialRole,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            setUserRole(initialRole);

            // Notifica os administradores do novo cadastro de membro se não for o próprio admin
            if (!isAdminEmail) {
              await createNewMemberNotification(
                user.displayName || 'Novo Usuário',
                user.email || 'sem e-mail',
                'self'
              );
            }
          } else {
            const data = userSnap.data();
            // Só forçamos admin se o dono não tiver cargo algum ou for cargo raso
            if (user.email?.toLowerCase() === 'kevinnaranjo1@gmail.com' && !data.role) {
              await updateDoc(userRef, { role: 'admin', updatedAt: serverTimestamp() });
              setUserRole('admin');
            } else {
              setUserRole(data.role);
            }
          }
          // Request permission for push notifications
          requestNotificationPermission(user.uid);
          
          // Check and send birthday notifications
          checkAndSendBirthdayNotifications();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        setUserRole(null);
      }
      setRoleLoading(false);
    }
    
    if (!loading) {
      checkRole();
    }
  }, [user, loading]);

  // Real-time remote force-reload system listener
  useEffect(() => {
    if (!user) return;
    const startUpTime = Date.now();
    const updateRef = doc(db, 'settings', 'force_update');
    
    const unsubscribe = onSnapshot(updateRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.updatedAt) {
          const updateTime = data.updatedAt.toMillis ? data.updatedAt.toMillis() : new Date(data.updatedAt).getTime();
          // Buffer of 5 seconds to avoid initial state racing reloads
          if (updateTime > startUpTime + 5000) {
            console.log('Forçando recarregamento do site por atualização do administrador...', updateTime);
            window.location.reload();
          }
        }
      }
    }, (error) => {
      console.warn('Erro ao escutar atualizações globais:', error);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading || roleLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-church-cream">
        <Loader2 className="h-12 w-12 animate-spin text-church-gold" />
      </div>
    );
  }

  const isAdmin = userRole && ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social'].includes(userRole.toLowerCase());
  const isPastorAdmin = userRole && ['admin', 'pastor', 'pastora'].includes(userRole.toLowerCase());
  const showSidebar = userRole && ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'].includes(userRole.toLowerCase());

  return (
    <MiniPlayerProvider>
      <Router>
        <div className="flex min-h-screen bg-church-cream">
          {/* Sidebar para Admin/Pastor */}
        {user && showSidebar && (
          <>
            {isSidebarOpen && (
              <div 
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <AdminSidebar role={userRole} onClose={() => setSidebarOpen(false)} />
            </aside>
          </>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {user && (
            <Navbar 
              user={user} 
              role={userRole} 
              onMenuClick={() => setSidebarOpen(true)} 
              showMenuButton={showSidebar} 
            />
          )}
          
          <main className={`flex-1 overflow-y-auto ${user ? "p-4 lg:p-8" : ""}`}>
            <Routes>
              <Route 
                path="/login" 
                element={!user ? <Login /> : <Navigate to="/" />} 
              />
              <Route 
                path="/" 
                element={user ? <Dashboard role={userRole} /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/novo-relatorio" 
                element={user && isAdmin ? <ReportForm /> : <Navigate to="/" />} 
              />
              <Route 
                path="/galeria" 
                element={user ? <CultPhotosGallery role={userRole} /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/perfil" 
                element={user ? <Profile /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/biblia" 
                element={user ? <Bible /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/harpa" 
                element={user ? <Harpa /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/videos" 
                element={user ? <VideoPage role={userRole} /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/oracao" 
                element={user ? <PrayerRequests role={userRole} /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/estudos" 
                element={user ? <Studies role={userRole} /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/anotacoes" 
                element={user ? <Notes /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/empreendimentos" 
                element={user ? <Businesses role={userRole} /> : <Navigate to="/login" />} 
              />
              
              {/* Rotas Administrativas */}
              <Route 
                path="/admin" 
                element={isPastorAdmin || user?.email?.toLowerCase() === 'kevinnaranjo1@gmail.com' ? <AdminView role={userRole} /> : <Navigate to="/" />} 
              />
              <Route 
                path="/admin/galeria" 
                element={user ? <CultPhotosGallery role={userRole} /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/admin/financeiro" 
                element={isPastorAdmin ? <FinanceManagement role={userRole} /> : <Navigate to="/" />} 
              />
              <Route 
                path="/admin/presenca" 
                element={isPastorAdmin ? <AttendanceManagement role={userRole} /> : <Navigate to="/" />} 
              />
              <Route 
                path="/admin/membros" 
                element={showSidebar ? <MemberManagement role={userRole} /> : <Navigate to="/" />} 
              />
              <Route 
                path="/admin/obreiros" 
                element={isAdmin ? <WorkerManagement role={userRole} /> : <Navigate to="/" />} 
              />
              <Route 
                path="/admin/visitantes" 
                element={isAdmin ? <VisitorManagement /> : <Navigate to="/" />} 
              />
              <Route 
                path="/admin/visitas-cultos" 
                element={user ? <ServiceVisitsManagement role={userRole} /> : <Navigate to="/login" />} 
              />
              <Route 
                path="/admin/apresentacao-criancas" 
                element={isAdmin ? <ChildPresentationManagement /> : <Navigate to="/" />} 
              />
              <Route 
                path="/admin/agenda" 
                element={user ? <CalendarPage role={userRole} /> : <Navigate to="/login" />} 
              />
              
              <Route 
                path="/admin/ebd" 
                element={isAdmin ? <EBDManagement role={userRole} /> : <Navigate to="/" />} 
              />
              <Route 
                path="/admin/avisos" 
                element={showSidebar ? <AnnouncementSettings /> : <Navigate to="/" />} 
              />
              {/* Fallbacks para seções não implementadas ainda */}
              <Route path="/admin/espiritual" element={isPastorAdmin ? <AdminView role={userRole} /> : <Navigate to="/" />} />
              <Route path="/admin/departamentos" element={isPastorAdmin ? <DepartmentManagement role={userRole} /> : <Navigate to="/" />} />
              <Route path="/admin/pastoral" element={isPastorAdmin ? <AdminView role={userRole} /> : <Navigate to="/" />} />
              <Route path="/admin/construcao" element={isPastorAdmin ? <ConstructionManagement role={userRole} /> : <Navigate to="/" />} />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>

            {/* Rodapé Oficial do Ministério */}
            <footer className="mt-12 rounded-3xl bg-church-navy p-6 sm:p-8 border border-church-gold/20 text-white shadow-xl relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-church-gold/5 blur-3xl pointer-events-none"></div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 text-center sm:text-left">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-church-gold font-bold text-xs uppercase tracking-widest font-serif">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Canal Oficial de Atendimento
                  </div>
                  <h4 className="text-lg font-serif font-bold tracking-tight text-white">Assembleia de Deus Boas Novas</h4>
                  <p className="text-xs text-church-cream/70 max-w-md">
                    Para mais informações, pedidos de oração, orientações pastorais ou suporte administrativo, entre em contato através do nosso número oficial.
                  </p>
                </div>

                <a
                  href="https://wa.me/5541984604432"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3.5 font-bold text-white shadow-lg hover:shadow-emerald-600/30 hover:scale-105 transition-all shrink-0 border border-emerald-400/30 group"
                >
                  <MessageCircle className="h-5 w-5 fill-current text-white group-hover:rotate-12 transition-transform" />
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] uppercase tracking-wider text-emerald-100 font-extrabold">WhatsApp Oficial</span>
                    <span className="text-sm font-mono tracking-tight font-black">(41) 98460-4432</span>
                  </div>
                </a>
              </div>
            </footer>
          </main>
        </div>
      </div>
      <GlobalMiniPlayer />
    </Router>
  </MiniPlayerProvider>
  );
}
