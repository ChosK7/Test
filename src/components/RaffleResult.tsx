import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCw, Share2, Heart, Home, Sparkles, Check } from 'lucide-react';
import { Decision, DecisionOption, UserProfile } from '../types';
import { toggleFavoriteDecision } from '../services/storage';

interface RaffleResultProps {
  decision: Decision;
  winnerOption: DecisionOption;
  userProfile: UserProfile;
  onDecideAgain: () => void;
  onShare: (decision: Decision) => void;
  onGoHome: () => void;
  onUpgradeClick: () => void;
}

export const RaffleResult: React.FC<RaffleResultProps> = ({
  decision,
  winnerOption,
  userProfile,
  onDecideAgain,
  onShare,
  onGoHome,
  onUpgradeClick,
}) => {
  const [isFavorited, setIsFavorited] = useState(!!decision.isFavorite);
  const [saveToast, setSaveToast] = useState(false);

  useEffect(() => {
    // Extra victory confetti on load
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.5 },
    });
  }, []);

  const handleToggleSave = () => {
    const nextState = toggleFavoriteDecision(decision.id);
    setIsFavorited(nextState);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8 max-w-md mx-auto animate-in zoom-in-95 duration-200">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-16 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 animate-in slide-in-from-top-2 duration-150">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isFavorited ? 'Salvo nos favoritos!' : 'Removido dos favoritos'}</span>
        </div>
      )}

      {/* Main Winning Card */}
      <div className="w-full bg-white rounded-3xl border-2 border-slate-200/90 shadow-xl overflow-hidden text-center p-7 relative">
        {/* Decorative Top Pill */}
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-xs tracking-wider uppercase mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>O destino decidiu</span>
        </div>

        {/* Question */}
        <h2 className="text-sm font-bold text-slate-500 max-w-xs mx-auto mb-5">
          "{decision.question}"
        </h2>

        {/* Big Winner Reveal */}
        <div className="my-2 p-6 rounded-2xl bg-gradient-to-br from-rose-50 via-amber-50 to-orange-50 border border-rose-200/80 shadow-inner">
          <div className="text-7xl mb-3 transform hover:scale-110 transition-transform select-none">
            {winnerOption.emoji || '🎯'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase break-words">
            {winnerOption.text}!
          </h1>
        </div>

        <p className="text-xs font-bold text-slate-400 mt-4">
          Decidido com 100% de imparcialidade pelo DECIDE AÍ 🎲
        </p>

        {/* Other considered options */}
        {decision.options.length > 1 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Opções consideradas:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {decision.options.map((opt) => (
                <span
                  key={opt.id}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    opt.id === winnerOption.id
                      ? 'bg-rose-600 text-white font-bold shadow-xs'
                      : 'bg-slate-100 text-slate-600 line-through opacity-70'
                  }`}
                >
                  {opt.emoji} {opt.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons (Section 6) */}
      <div className="w-full mt-6 space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            id="decide-again-btn"
            onClick={onDecideAgain}
            className="py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-97 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <RotateCw className="w-4 h-4" />
            <span>Decidir novamente</span>
          </button>

          <button
            id="share-result-btn"
            onClick={() => onShare(decision)}
            className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-500 hover:opacity-95 active:scale-97 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-rose-500/20 transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartilhar</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            id="save-favorite-btn"
            onClick={handleToggleSave}
            className={`py-3 px-4 rounded-2xl border font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-97 ${
              isFavorited
                ? 'bg-rose-50 border-rose-300 text-rose-600'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-600 text-rose-600' : ''}`} />
            <span>{isFavorited ? 'Salvo' : 'Salvar'}</span>
          </button>

          <button
            id="go-home-btn"
            onClick={onGoHome}
            className="py-3 px-4 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-97"
          >
            <Home className="w-4 h-4" />
            <span>Voltar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
