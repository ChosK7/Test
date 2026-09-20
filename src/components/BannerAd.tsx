import React from 'react';
import { Sparkles, Crown, X } from 'lucide-react';

interface BannerAdProps {
  onUpgradeClick: () => void;
}

export const BannerAd: React.FC<BannerAdProps> = ({ onUpgradeClick }) => {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <div className="mx-4 my-2 p-3 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-2.5 shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
          <Crown className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-sm">
              Anúncio
            </span>
            <p className="text-xs font-bold text-slate-800 truncate">DECIDE AÍ Premium</p>
          </div>
          <p className="text-[11px] text-slate-500 truncate">Sem anúncios, opções ilimitadas e temas VIP.</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onUpgradeClick}
          className="text-xs font-bold bg-slate-900 text-white px-2.5 py-1.5 rounded-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-1 shadow-xs"
        >
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span>Ver</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          aria-label="Dispensar banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
