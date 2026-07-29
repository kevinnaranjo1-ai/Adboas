import { Link } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { LogOut, LayoutDashboard, FilePlus, ShieldCheck, User as UserIcon, Menu, Camera } from 'lucide-react';
import type { User } from 'firebase/auth';
import Logo from '../Logo';
import NotificationBell from '../NotificationBell';

interface NavbarProps {
  user: User;
  role: string | null;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export default function Navbar({ user, role, onMenuClick, showMenuButton }: NavbarProps) {
  const isAdmin = role && ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social'].includes(role);
  const hasSidebar = role && ['admin', 'pastor', 'pastora', 'leader', 'obreiro', 'presbítero', 'missionário', 'missionária', 'diácono', 'evangelista', 'diaconisa', 'mídia social', 'membro'].includes(role);

  const getRoleLabel = (r: string | null) => {
    if (!r) return '';
    const labels: Record<string, string> = {
      admin: 'Admin',
      pastor: 'Pastor',
      pastora: 'Pastora',
      leader: 'Líder',
      obreiro: 'Obreiro',
      presbítero: 'Presbítero',
      missionário: 'Missionário',
      missionária: 'Missionária',
      diácono: 'Diácono',
      evangelista: 'Evangelista',
      diaconisa: 'Diaconisa',
      'mídia social': 'Mídia social',
      membro: 'Membro'
    };
    return labels[r] || r.charAt(0).toUpperCase() + r.slice(1);
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-church-gold/10 bg-white/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-4">
          {showMenuButton && (
            <button 
              onClick={onMenuClick}
              className="lg:hidden rounded-xl p-2 text-church-navy hover:bg-church-navy/5 transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <Link to="/" className="flex items-center gap-2 group">
            <Logo 
              size={36} 
              className="border border-church-gold/25 transition-transform group-hover:scale-110" 
            />
            {!showMenuButton && (
              <div className="flex flex-col leading-none">
                <span className="font-serif font-bold text-church-navy">AD Boas Novas</span>
                <span className="text-[10px] text-church-gold uppercase tracking-tighter font-medium">Tenda da Promessa</span>
              </div>
            )}
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-4">
          {!hasSidebar && (
            <>
              <Link 
                to="/" 
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-church-navy hover:text-church-gold transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Início</span>
              </Link>

              <Link 
                to="/galeria" 
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-church-navy hover:text-church-gold transition-colors"
              >
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline font-bold">Galeria</span>
              </Link>
            </>
          )}

          <div className="h-6 w-px bg-church-gold/20 mx-2 hidden sm:block" />

          <div className="flex items-center gap-3 pl-2">
            <NotificationBell userId={user.uid} userRole={role} />
            
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs font-semibold text-church-navy truncate max-w-[120px]">
                {user.displayName}
              </span>
              <span className="text-[10px] text-church-gold uppercase font-bold">
                {getRoleLabel(role)}
              </span>
            </div>
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || ''} 
                className="h-8 w-8 rounded-full border border-church-gold/20"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-church-gold/10 flex items-center justify-center text-church-gold">
                <UserIcon className="h-5 w-5" />
              </div>
            )}
            <button
              onClick={() => auth.signOut()}
              className="flex h-8 w-8 items-center justify-center rounded-full text-church-navy/40 hover:text-red-500 hover:bg-red-50 transition-all font-bold"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
