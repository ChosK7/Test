import React from 'react';
import { Home, PlusCircle, History, User } from 'lucide-react';

export type NavTab = 'home' | 'create' | 'history' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg pb-safe">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        <button
          id="nav-home-btn"
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center w-14 py-1 gap-1 transition-all ${
            activeTab === 'home'
              ? 'text-rose-600 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[11px]">Início</span>
        </button>

        <button
          id="nav-create-btn"
          onClick={() => onSelectTab('create')}
          className="flex flex-col items-center justify-center relative -top-3 group"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 group-hover:scale-105 group-active:scale-95 transition-all">
            <PlusCircle className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-[11px] font-bold text-slate-800 mt-1">Criar</span>
        </button>

        <button
          id="nav-history-btn"
          onClick={() => onSelectTab('history')}
          className={`flex flex-col items-center justify-center w-14 py-1 gap-1 transition-all ${
            activeTab === 'history'
              ? 'text-rose-600 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <History className={`w-5 h-5 ${activeTab === 'history' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[11px]">Histórico</span>
        </button>

        <button
          id="nav-profile-btn"
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center justify-center w-14 py-1 gap-1 transition-all ${
            activeTab === 'profile'
              ? 'text-rose-600 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[11px]">Perfil</span>
        </button>
      </div>
    </nav>
  );
};
