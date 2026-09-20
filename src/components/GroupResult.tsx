import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Swords, Zap, Share2, RotateCw, Home, Users, Loader2 } from 'lucide-react';
import { Decision, DecisionOption, GroupRoomDoc } from '../types';
import { resolveTieInFirestore, subscribeToRoom } from '../services/firestore';
import { resolveTie } from '../services/storage';
import { isFirebaseConfigured, ensureAnonymousAuth } from '../services/firebase';

interface GroupResultProps {
  decision: Decision;
  onNewDecision: () => void;
  onShare: (decision: Decision) => void;
  onGoHome: () => void;
}

export const GroupResult: React.FC<GroupResultProps> = ({
  decision: initialDecision,
  onNewDecision,
  onShare,
  onGoHome,
}) => {
  const [decision, setDecision] = useState<Decision>(initialDecision);
  const [isResolvingTie, setIsResolvingTie] = useState<boolean>(false);
  const [tieTickerText, setTieTickerText] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(true);

  const publicCode = decision.publicCode || decision.id;
  const totalVotes = decision.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);

  // Check host identity
  useEffect(() => {
    let isMounted = true;
    if (isFirebaseConfigured()) {
      ensureAnonymousAuth()
        .then((uid) => {
          if (isMounted) {
            setIsHost(uid === decision.creatorId);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [decision.creatorId]);

  // Subscribe to real-time room updates so non-host and host receive tie-break results instantly
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubscribe = subscribeToRoom(decision.id, (updatedRoom: GroupRoomDoc | null) => {
      if (!updatedRoom) return;

      setDecision((prev) => ({
        ...prev,
        status: updatedRoom.status,
        options: updatedRoom.options,
        winnerOptionId: updatedRoom.winnerOptionId || undefined,
        tiedOptionIds: updatedRoom.tiedOptionIds || undefined,
        isTieBreaker: updatedRoom.isTieBreaker,
        finishedAt: updatedRoom.finishedAt,
      }));
    });

    return () => {
      unsubscribe();
    };
  }, [decision.id]);

  // Identify winner or tied options
  const isTie = !!(decision.status === 'tie' || (decision.tiedOptionIds && decision.tiedOptionIds.length > 1));

  const winnerOption = decision.winnerOptionId
    ? decision.options.find((o) => o.id === decision.winnerOptionId)
    : null;

  const tiedOptions = isTie
    ? decision.options.filter((o) => decision.tiedOptionIds?.includes(o.id))
    : [];

  useEffect(() => {
    if (!isTie && winnerOption) {
      confetti({
        particleCount: 70,
        spread: 75,
        origin: { y: 0.55 },
      });
    }
  }, [isTie, winnerOption]);

  const handleRunTieBreaker = async () => {
    if (!tiedOptions.length) return;

    setIsResolvingTie(true);
    let counter = 0;
    const interval = setInterval(async () => {
      counter++;
      const randomOpt = tiedOptions[counter % tiedOptions.length];
      setTieTickerText(`${randomOpt.emoji || '🎲'} ${randomOpt.text}`);

      if (counter > 15) {
        clearInterval(interval);
        const chosen = tiedOptions[Math.floor(Math.random() * tiedOptions.length)];

        try {
          if (isFirebaseConfigured()) {
            await resolveTieInFirestore(decision.id, chosen.id);
          }
        } catch (e) {
          console.error('Error resolving tie in Firestore', e);
        }

        // Local state update
        const updated = resolveTie(decision.id, chosen.id) || {
          ...decision,
          winnerOptionId: chosen.id,
          tiedOptionIds: undefined,
          status: 'finished' as const,
          isTieBreaker: true,
        };

        setDecision(updated);
        setIsResolvingTie(false);

        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.5 },
        });
      }
    }, 100);
  };

  // Sort options by votes descending
  const sortedOptions = [...decision.options].sort((a, b) => (b.votes || 0) - (a.votes || 0));

  return (
    <div className="min-h-[85vh] max-w-md mx-auto px-4 py-6 flex flex-col justify-center animate-in zoom-in-95 duration-200">
      {/* TIE BREAKING SCREEN / STATE (Section 14) */}
      {isTie ? (
        <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-xl p-7 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
            ⚔️
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            DEU EMPATE!
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs mx-auto">
            Houve um empate perfeito entre as opções mais votadas.
          </p>

          {/* Tied options badges */}
          <div className="my-5 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-2">
            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Opções empatadas:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {tiedOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="px-3 py-1.5 rounded-full bg-white border border-amber-300 text-slate-800 text-sm font-black shadow-2xs"
                >
                  {opt.emoji} {opt.text} ({opt.votes} votos)
                </div>
              ))}
            </div>
          </div>

          {/* Tie breaker button or rolling animation */}
          {isResolvingTie ? (
            <div className="py-4 bg-slate-900 rounded-2xl text-white font-black text-lg animate-pulse">
              ⚡ Sorteando desempate: <br />
              <span className="text-amber-400 text-xl">{tieTickerText}</span>
            </div>
          ) : isHost ? (
            <button
              id="resolve-tie-btn"
              onClick={handleRunTieBreaker}
              className="w-full py-4 px-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-95 active:scale-98 text-white font-black text-base rounded-2xl shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Zap className="w-5 h-5 fill-current" />
              <span>DESEMPATAR</span>
            </button>
          ) : (
            <div className="py-3.5 px-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center gap-2.5 text-amber-800 text-xs font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
              <span>Aguardando o anfitrião realizar o desempate...</span>
            </div>
          )}
        </div>
      ) : (
        /* NORMAL OR RESOLVED WINNER SCREEN (Section 15) */
        <div className="space-y-4">
          {/* Winner Banner Card */}
          <div className="bg-white rounded-3xl border-2 border-slate-200/90 shadow-xl overflow-hidden p-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-xs tracking-wider uppercase mb-3">
              <Trophy className="w-3.5 h-3.5" />
              <span>Resultado da Votação #{publicCode}</span>
            </div>

            <h2 className="text-sm font-bold text-slate-500 max-w-xs mx-auto mb-2">
              "{decision.question}"
            </h2>

            {/* Winner Spotlight */}
            {winnerOption && (
              <div className="p-6 rounded-2xl bg-gradient-to-br from-rose-50 via-amber-50 to-orange-50 border border-rose-200 shadow-inner my-2">
                <div className="text-6xl mb-2 select-none">
                  {winnerOption.emoji || '🎉'}
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase">
                  {winnerOption.text} VENCEU!
                </h1>
                {decision.isTieBreaker && (
                  <p className="text-xs font-bold text-rose-600 mt-1">
                    ⚡ O desempate foi decidido pelo DECIDE AÍ.
                  </p>
                )}
              </div>
            )}

            <p className="text-xs font-bold text-slate-400 mt-2 flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>
                {decision.participants?.length || totalVotes} pessoas participaram desta decisão.
              </span>
            </p>
          </div>

          {/* Votes Breakdown (Section 10 & 15) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
              <span>🎉 RESULTADO DETALHADO</span>
              <span className="text-[11px] font-semibold text-slate-400">
                {totalVotes} votos
              </span>
            </h3>

            <div className="space-y-3">
              {sortedOptions.map((opt) => {
                const isWinner = opt.id === winnerOption?.id;
                const percentage = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;

                return (
                  <div key={opt.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <span>{opt.emoji}</span>
                        <span className={isWinner ? 'text-rose-600 font-extrabold' : 'text-slate-700'}>
                          {opt.text}
                        </span>
                        {isWinner && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-full font-black">
                            VENCEDOR
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 font-semibold">
                        {opt.votes || 0} {opt.votes === 1 ? 'voto' : 'votos'} ({percentage}%)
                      </span>
                    </div>

                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isWinner
                            ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${Math.max(percentage, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navigation and Action Buttons */}
      <div className="mt-6 space-y-2.5">
        <button
          id="share-group-result-btn"
          onClick={() => onShare(decision)}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-amber-500 hover:opacity-95 active:scale-98 text-white font-black text-sm rounded-2xl shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>Compartilhar resultado</span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            id="new-decision-btn"
            onClick={onNewDecision}
            className="py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Nova decisão</span>
          </button>

          <button
            id="back-home-btn"
            onClick={onGoHome}
            className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 active:scale-98 text-slate-700 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
