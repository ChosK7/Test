import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, Users, Clock, EyeOff, Play, PlusCircle, ArrowLeft } from 'lucide-react';
import { Decision, UserProfile } from '../types';
import { castVoteInRoom, finishGroupDecision, getLocalVoteForRoom, subscribeToSync, findDecisionById } from '../services/storage';

interface GroupRoomProps {
  decision: Decision;
  userProfile: UserProfile;
  onDecisionFinished: (finishedDecision: Decision) => void;
  onBack: () => void;
}

export const GroupRoom: React.FC<GroupRoomProps> = ({
  decision: initialDecision,
  userProfile,
  onDecisionFinished,
  onBack,
}) => {
  const [decision, setDecision] = useState<Decision>(initialDecision);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>(
    userProfile.name !== 'Visitante' ? userProfile.name : ''
  );
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Check if current device has already voted
  useEffect(() => {
    const existing = getLocalVoteForRoom(decision.id);
    if (existing) {
      setHasVoted(true);
      setSelectedOptionId(existing.optionId);
    }
  }, [decision.id]);

  // Subscribe to real-time storage/broadcast sync across tabs
  useEffect(() => {
    const unsubscribe = subscribeToSync(() => {
      const refreshed = findDecisionById(decision.id);
      if (refreshed) {
        setDecision(refreshed);
        if (refreshed.status === 'finished') {
          onDecisionFinished(refreshed);
        }
      }
    });

    return () => unsubscribe();
  }, [decision.id, onDecisionFinished]);

  const isCreator = decision.creatorId === userProfile.id;

  const handleVoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOptionId) {
      setErrorMsg('Escolha uma das opções para votar!');
      return;
    }

    const nameToUse = participantName.trim() || `Convidado ${decision.participants.length + 1}`;
    const updated = castVoteInRoom(decision.id, nameToUse, selectedOptionId);

    if (updated) {
      setDecision(updated);
      setHasVoted(true);
      setErrorMsg('');

      if (updated.status === 'finished') {
        onDecisionFinished(updated);
      }
    }
  };

  const handleFinishManually = () => {
    const finished = finishGroupDecision(decision.id, decision);
    if (finished) {
      setDecision(finished);
      onDecisionFinished(finished);
    }
  };

  // Helper to simulate a friend's vote for testing and demonstration
  const handleSimulateFriendVote = () => {
    const randomOption = decision.options[Math.floor(Math.random() * decision.options.length)];
    const friendNames = ['Lucas', 'Camila', 'Rafael', 'Beatriz', 'Felipe', 'Mariana', 'Thiago', 'Larissa'];
    const randomName = friendNames[Math.floor(Math.random() * friendNames.length)] + ` #${Math.floor(Math.random() * 90 + 10)}`;

    const updated = castVoteInRoom(decision.id, randomName, randomOption.id);
    if (updated) {
      setDecision(updated);
      if (updated.status === 'finished') {
        onDecisionFinished(updated);
      }
    }
  };

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${decision.id}`
    : `https://decideai.app/?room=${decision.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🎲 *DECIDE AÍ: Votação em Grupo*\n\n"${decision.question}"\n\nEntre na sala *#${decision.id}* e vote agora pelo link:\n${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-[85vh] max-w-md mx-auto px-4 py-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-extrabold text-rose-700 tracking-wider">
            DECIDE AÍ #{decision.id}
          </span>
        </div>
      </div>

      {/* Main Room Card */}
      <div className="bg-white rounded-3xl border-2 border-slate-200/90 shadow-xl overflow-hidden p-6 mb-4">
        {/* Title */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-2">
            <Users className="w-3 h-3" /> Decisão em Grupo
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {decision.question}
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-1">
            Criada por {decision.creatorName}
          </p>
        </div>

        {/* Voting State: Already Voted vs Need to Vote */}
        {hasVoted ? (
          <div className="text-center py-6 px-4 rounded-2xl bg-slate-50 border border-slate-200/80 my-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl mb-3 shadow-inner">
              ✓
            </div>
            <h3 className="font-extrabold text-slate-900 text-lg">
              ✅ Voto registrado!
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-1 max-w-xs mx-auto">
              Agora aguarde o resultado.
              {decision.maxParticipants
                ? ` Faltam ${Math.max(0, decision.maxParticipants - decision.participants.length)} votos para encerrar.`
                : ' O criador pode encerrar a votação a qualquer momento.'}
            </p>

            {/* Secret voting badge */}
            {decision.isSecretVoting && (
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full mt-4">
                <EyeOff className="w-3 h-3" />
                <span>Votos ocultos até o encerramento</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleVoteSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                Seu nome ou apelido:
              </label>
              <input
                id="participant-name-input"
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Ex: Carlos ou Jogador 1"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white text-slate-800 font-medium text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                Escolha uma opção:
              </label>
              <div className="space-y-2">
                {decision.options.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      id={`vote-option-${opt.id}`}
                      onClick={() => {
                        setSelectedOptionId(opt.id);
                        setErrorMsg('');
                      }}
                      className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all active:scale-98 ${
                        isSelected
                          ? 'border-rose-600 bg-rose-50 text-slate-900 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl select-none">{opt.emoji || '🎯'}</span>
                        <span className="font-bold text-sm">{opt.text}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-rose-600 bg-rose-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <span className="text-xs font-black">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs font-bold text-rose-600 text-center">{errorMsg}</p>
            )}

            <button
              id="confirm-vote-btn"
              type="submit"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-amber-500 hover:opacity-95 active:scale-98 text-white font-black text-base rounded-2xl shadow-lg shadow-rose-500/20 transition-all"
            >
              CONFIRMAR VOTO
            </button>
          </form>
        )}

        {/* Live Participants Counter */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              {decision.participants.length}{' '}
              {decision.maxParticipants
                ? `de ${decision.maxParticipants} pessoas votaram`
                : 'voto(s) registrado(s)'}
            </span>
          </div>

          <div className="flex -space-x-1.5 overflow-hidden">
            {decision.participants.slice(0, 4).map((p, i) => (
              <div
                key={p.id || i}
                title={p.name}
                className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center uppercase"
              >
                {p.name.charAt(0)}
              </div>
            ))}
            {decision.participants.length > 4 && (
              <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">
                +{decision.participants.length - 4}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Section (Section 7) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs mb-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
          Convidar amigos para votar
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            id="copy-group-link-btn"
            className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link da Sala'}</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            id="share-whatsapp-btn"
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
          >
            <span>WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Creator Actions & Testing Helpers */}
      <div className="space-y-2">
        {/* End voting manually */}
        <button
          onClick={handleFinishManually}
          id="finish-voting-btn"
          className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Clock className="w-4 h-4" />
          <span>Encerrar votação e ver resultado agora</span>
        </button>

        {/* Demo Helper: Simulate Friend Vote */}
        <button
          onClick={handleSimulateFriendVote}
          id="simulate-friend-vote-btn"
          className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 active:scale-98 border border-amber-200/80 text-amber-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>Simular voto de amigo (Testar grupo)</span>
        </button>
      </div>
    </div>
  );
};
