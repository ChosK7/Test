import React from 'react';
import { Sparkles, Dices, User } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  userProfile: UserProfile;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ userProfile, onOpenProfile }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-rose-500/20 active:scale-95 transition-transform">
            <span className="text-xl select-none">🎲</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                DECIDE <span className="text-rose-600">AÍ</span>
              </h1>
              {userProfile.plan === 'premium' && (
                <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5 shadow-xs">
                  <Sparkles className="w-2.5 h-2.5 fill-current" /> PRO
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-tight line-clamp-1">
              Você escolhe as opções. A gente decide.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/70 text-amber-800 text-xs font-bold px-2 py-1 rounded-full shadow-2xs">
            <span>🔥</span>
            <span>{userProfile.streakDays}d</span>
          </div>

          <button
            id="header-profile-btn"
            onClick={onOpenProfile}
            aria-label="Abrir Perfil e Configurações"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center transition-all border border-slate-200/80"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
