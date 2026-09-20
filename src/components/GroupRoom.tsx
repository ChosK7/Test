import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  Users,
  Clock,
  EyeOff,
  Crown,
  Play,
  PlusCircle,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Wifi,
  Sparkles,
} from 'lucide-react';
import { Decision, UserProfile, Participant, Vote, GroupRoomDoc } from '../types';
import {
  subscribeToRoom,
  subscribeToParticipants,
  subscribeToVotes,
  submitVote,
  startVoting,
  finishVoting,
  joinGroupRoom,
  getLocalParticipant,
  getLocalVote,
} from '../services/firestore';
import {
  castVoteInRoom,
  finishGroupDecision,
  getLocalVoteForRoom,
  findDecisionById,
} from '../services/storage';
import { isFirebaseConfigured, ensureAnonymousAuth } from '../services/firebase';

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
  const [participants, setParticipants] = useState<Participant[]>(initialDecision.participants || []);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  
  // Local identity & participation
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [participantName, setParticipantName] = useState<string>(
    userProfile.name !== 'Visitante' ? userProfile.name : ''
  );
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState<boolean>(false);
  const [isEndingVoting, setIsEndingVoting] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const roomId = decision.id;
  const publicCode = decision.publicCode || decision.id;
  const useFirebase = isFirebaseConfigured();

  // Initialize or restore local participant session
  useEffect(() => {
    let isMounted = true;

    if (useFirebase) {
      ensureAnonymousAuth()
        .then((authUid) => {
          if (!isMounted) return;
          const local = getLocalParticipant(roomId);
          const isHost = authUid === decision.creatorId;

          if (local) {
            setCurrentParticipant({
              id: authUid,
              name: local.name,
              joinedAt: new Date().toISOString(),
              isHost: isHost || local.id === decision.creatorId,
            });
            setParticipantName(local.name);
          } else if (isHost) {
            setCurrentParticipant({
              id: authUid,
              name: userProfile.name || 'Criador',
              joinedAt: decision.createdAt,
              isHost: true,
            });
          }
        })
        .catch((err) => console.error('Error ensuring auth in GroupRoom:', err));
    } else {
      const local = getLocalParticipant(roomId);
      if (local) {
        setCurrentParticipant({
          id: local.id,
          name: local.name,
          joinedAt: new Date().toISOString(),
          isHost: local.id === decision.creatorId || local.id === userProfile.id,
        });
        setParticipantName(local.name);
      } else if (decision.creatorId === userProfile.id) {
        // Current user is creator
        setCurrentParticipant({
          id: userProfile.id,
          name: userProfile.name || 'Criador',
          joinedAt: decision.createdAt,
          isHost: true,
        });
      }
    }

    // Check if this device has already cast a vote
    const localVote = useFirebase ? getLocalVote(roomId) : getLocalVoteForRoom(roomId)?.optionId;
    if (localVote) {
      setHasVoted(true);
      setSelectedOptionId(localVote);
    }

    return () => {
      isMounted = false;
    };
  }, [roomId, decision.creatorId, userProfile.id, userProfile.name, useFirebase, decision.createdAt]);

  // Subscribe to real-time Firestore listeners if Firebase is enabled
  useEffect(() => {
    if (!useFirebase) return;

    const unsubRoom = subscribeToRoom(
      roomId,
      (updatedRoom: GroupRoomDoc | null) => {
        if (!updatedRoom) return;

        setDecision((prev) => {
          const merged: Decision = {
            ...prev,
            status: updatedRoom.status,
            options: updatedRoom.options,
            winnerOptionId: updatedRoom.winnerOptionId || undefined,
            tiedOptionIds: updatedRoom.tiedOptionIds || undefined,
            isTieBreaker: updatedRoom.isTieBreaker,
            finishedAt: updatedRoom.finishedAt,
            maxParticipants: updatedRoom.maxParticipants,
          };

          if (updatedRoom.status === 'finished' || updatedRoom.status === 'tie') {
            onDecisionFinished(merged);
          }

          return merged;
        });
      },
      () => setIsOnline(false)
    );

    const unsubParticipants = subscribeToParticipants(roomId, (list) => {
      setParticipants(list);
    });

    const unsubVotes = subscribeToVotes(roomId, (voteList) => {
      setVotes(voteList);
      // If local participant ID matches any vote, lock voted state
      const local = getLocalParticipant(roomId);
      if (local && voteList.some((v) => v.participantId === local.id)) {
        setHasVoted(true);
      }
    });

    return () => {
      unsubRoom();
      unsubParticipants();
      unsubVotes();
    };
  }, [roomId, useFirebase, onDecisionFinished]);

  const isCreator =
    decision.creatorId === userProfile.id ||
    currentParticipant?.id === decision.creatorId ||
    currentParticipant?.isHost === true;

  // Join Room handler
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = participantName.trim();
    if (!cleanName) {
      setErrorMsg('Por favor, informe seu nome ou apelido para entrar.');
      return;
    }

    setIsJoining(true);
    setErrorMsg('');

    try {
      if (useFirebase) {
        const participant = await joinGroupRoom(roomId, cleanName);
        setCurrentParticipant(participant);
      } else {
        const newPart: Participant = {
          id: 'p_' + Math.random().toString(36).substring(2, 9),
          name: cleanName,
          joinedAt: new Date().toISOString(),
          isHost: false,
        };
        setCurrentParticipant(newPart);
        setParticipants((prev) => [...prev, newPart]);
      }
    } catch (err: any) {
      console.error('Error joining room:', err);
      setErrorMsg('Não foi possível entrar na sala. Tente novamente.');
    } finally {
      setIsJoining(false);
    }
  };

  // Vote submit handler
  const handleVoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOptionId) {
      setErrorMsg('Escolha uma das opções para votar!');
      return;
    }

    const voterName =
      currentParticipant?.name ||
      participantName.trim() ||
      `Participante ${participants.length + 1}`;

    const voterId = currentParticipant?.id || userProfile.id;

    setIsSubmittingVote(true);
    setErrorMsg('');

    try {
      if (useFirebase) {
        await submitVote(roomId, voterId, voterName, selectedOptionId);
        setHasVoted(true);
      } else {
        // Local fallback
        const updated = castVoteInRoom(roomId, voterName, selectedOptionId);
        if (updated) {
          setDecision(updated);
          setHasVoted(true);
          if (updated.status === 'finished' || updated.status === 'tie') {
            onDecisionFinished(updated);
          }
        }
      }
    } catch (err: any) {
      console.error('Vote error:', err);
      const message =
        err?.message && err.message.includes('já votou')
          ? 'Você já votou nesta rodada!'
          : 'Erro ao registrar voto. Verifique sua conexão e tente novamente.';
      setErrorMsg(message);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  // Host finishes voting
  const handleFinishManually = async () => {
    if (isEndingVoting) return;
    setIsEndingVoting(true);
    setErrorMsg('');

    try {
      if (useFirebase) {
        const updatedRoom = await finishVoting(roomId);
        const finishedDecision: Decision = {
          ...decision,
          status: updatedRoom.status,
          options: updatedRoom.options,
          winnerOptionId: updatedRoom.winnerOptionId || undefined,
          tiedOptionIds: updatedRoom.tiedOptionIds || undefined,
          finishedAt: updatedRoom.finishedAt,
          isTieBreaker: updatedRoom.isTieBreaker,
        };
        setDecision(finishedDecision);
        onDecisionFinished(finishedDecision);
      } else {
        const finished = finishGroupDecision(roomId, decision);
        if (finished) {
          setDecision(finished);
          onDecisionFinished(finished);
        }
      }
    } catch (err: any) {
      console.error('Error ending voting:', err);
      setErrorMsg('Não foi possível encerrar a votação. Tente novamente.');
    } finally {
      setIsEndingVoting(false);
    }
  };

  // Host opens voting from waiting
  const handleStartVotingState = async () => {
    try {
      if (useFirebase) {
        await startVoting(roomId);
      }
      setDecision((prev) => ({ ...prev, status: 'voting' }));
    } catch (err) {
      console.error('Error opening voting:', err);
    }
  };

  // Simulation of friend vote for testing multi-user flow
  const handleSimulateFriendVote = async () => {
    if (useFirebase) {
      setErrorMsg('No modo multiplayer real com Firebase, cada participante possui sua própria identidade segura. Abra o link da sala em uma aba anônima ou outro celular para votar como outro amigo!');
      return;
    }

    const randomOption = decision.options[Math.floor(Math.random() * decision.options.length)];
    const friendNames = ['Lucas', 'Camila', 'Rafael', 'Beatriz', 'Felipe', 'Mariana', 'Thiago', 'Larissa'];
    const randomName =
      friendNames[Math.floor(Math.random() * friendNames.length)] +
      ` #${Math.floor(Math.random() * 90 + 10)}`;

    const updated = castVoteInRoom(roomId, randomName, randomOption.id);
    if (updated) {
      setDecision(updated);
      if (updated.status === 'finished') {
        onDecisionFinished(updated);
      }
    }
  };

  // Share URL generation (Sections 6 & 16)
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/group/${publicCode}`
      : `https://decideai.app/group/${publicCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🎲 *DECIDE AÍ: Votação em Grupo*\n\n"${decision.question}"\n\nEntre na sala *#${publicCode}* e vote agora pelo link:\n${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `DECIDE AÍ: ${decision.question}`,
          text: `Vote agora na decisão em grupo: "${decision.question}" no DECIDE AÍ!`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or unsupported
      }
    } else {
      handleCopyLink();
    }
  };

  const totalVotesCount = votes.length || participants.filter((p) => p.chosenOptionId).length;

  return (
    <div className="min-h-[85vh] max-w-md mx-auto px-4 py-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-2">
          {isCreator && (
            <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/90 px-2.5 py-0.5 rounded-full">
              <Crown className="w-3 h-3 fill-amber-500 text-amber-600" />
              <span>Host</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-extrabold text-rose-700 tracking-wider uppercase">
              #{publicCode}
            </span>
          </div>
        </div>
      </div>

      {/* Main Room Card */}
      <div className="bg-white rounded-3xl border-2 border-slate-200/90 shadow-xl overflow-hidden p-6 mb-4">
        {/* Title & Creator metadata */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              <Users className="w-3 h-3" /> Decisão em Grupo
            </span>
            {useFirebase && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <Wifi className="w-2.5 h-2.5" /> Tempo Real
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
            {decision.question}
          </h1>

          <p className="text-xs font-medium text-slate-400 mt-1.5">
            Criada por <strong className="text-slate-600">{decision.creatorName}</strong>
          </p>
        </div>

        {/* Status: Waiting for host to open voting (if applicable) */}
        {decision.status === 'waiting' && isCreator && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2">
            <p className="text-xs font-bold text-amber-800">
              A sala está aberta! Quando todos entrarem, inicie a votação:
            </p>
            <button
              onClick={handleStartVotingState}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Iniciar Rodada de Votação</span>
            </button>
          </div>
        )}

        {/* Participant Name Prompt if not registered yet */}
        {!currentParticipant && !hasVoted ? (
          <form onSubmit={handleJoinRoom} className="space-y-4 py-2">
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-center">
              <span className="text-3xl mb-1 block">👋</span>
              <h3 className="font-extrabold text-slate-800 text-sm">
                Entre na decisão!
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Digite seu nome ou apelido para participar e votar.
              </p>

              <div className="mt-3">
                <input
                  id="join-participant-name-input"
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Ex: Carlos ou Amigo"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-rose-500 text-slate-800 font-bold text-sm focus:outline-none text-center"
                />
              </div>

              {errorMsg && (
                <p className="text-xs font-bold text-rose-600 mt-2">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={isJoining}
                className="w-full mt-3 py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isJoining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>ENTRAR NA SALA</span>
                )}
              </button>
            </div>
          </form>
        ) : hasVoted ? (
          /* Already Voted State (Section 10) */
          <div className="text-center py-6 px-4 rounded-2xl bg-slate-50 border border-slate-200/80 my-2 animate-in fade-in-50 duration-300">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl mb-3 shadow-inner">
              ✓
            </div>
            <h3 className="font-extrabold text-slate-900 text-lg">
              ✅ Voto registrado!
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-1 max-w-xs mx-auto">
              Agora aguarde o encerramento da rodada.
              {decision.maxParticipants
                ? ` Faltam ${Math.max(0, decision.maxParticipants - totalVotesCount)} votos para fechar.`
                : ' O anfitrião pode encerrar a votação a qualquer momento.'}
            </p>

            {/* Secret voting badge */}
            {decision.isSecretVoting && (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full mt-4 shadow-2xs">
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Votos secretos até a revelação final</span>
              </div>
            )}
          </div>
        ) : (
          /* Active Voting Form */
          <form onSubmit={handleVoteSubmit} className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
                Escolha sua opção:
              </label>
              {currentParticipant && (
                <span className="text-[11px] font-bold text-slate-400">
                  Votando como: <strong className="text-slate-700">{currentParticipant.name}</strong>
                </span>
              )}
            </div>

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
                    className={`w-full p-3.5 rounded-2xl border-2 text-left flex items-center justify-between transition-all active:scale-98 cursor-pointer ${
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

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              id="confirm-vote-btn"
              type="submit"
              disabled={isSubmittingVote || !selectedOptionId}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-amber-500 hover:opacity-95 disabled:opacity-50 active:scale-98 text-white font-black text-base rounded-2xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingVote ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>REGISTRANDO VOTO...</span>
                </>
              ) : (
                <span>CONFIRMAR VOTO</span>
              )}
            </button>
          </form>
        )}

        {/* Live Participants Counter (Section 9) */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              {totalVotesCount}{' '}
              {decision.maxParticipants
                ? `de ${decision.maxParticipants} votos registrados`
                : 'voto(s) registrado(s)'}
            </span>
          </div>

          <div className="flex -space-x-1.5 overflow-hidden">
            {participants.slice(0, 4).map((p, i) => (
              <div
                key={p.id || i}
                title={p.name}
                className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gradient-to-tr from-slate-700 to-slate-900 text-white text-[10px] font-black flex items-center justify-center uppercase shadow-2xs"
              >
                {p.name.charAt(0)}
              </div>
            ))}
            {participants.length > 4 && (
              <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                +{participants.length - 4}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Section (Sections 6 & 16) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Convidar amigos para votar
          </h3>
          <span className="text-[11px] font-bold text-slate-400 font-mono">
            Código #{publicCode}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            id="copy-group-link-btn"
            className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            id="share-whatsapp-btn"
            className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span>WhatsApp</span>
          </button>

          <button
            onClick={handleNativeShare}
            id="share-native-btn"
            className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer"
            title="Compartilhar"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Host Controls & Actions */}
      <div className="space-y-2">
        {isCreator && (
          <button
            onClick={handleFinishManually}
            id="finish-voting-btn"
            disabled={isEndingVoting}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isEndingVoting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Calculando resultado...</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>Encerrar votação e ver resultado agora</span>
              </>
            )}
          </button>
        )}

        {/* Demo Helper: Simulate Friend Vote for effortless multi-user testing */}
        <button
          onClick={handleSimulateFriendVote}
          id="simulate-friend-vote-btn"
          className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 active:scale-98 border border-amber-200/80 text-amber-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>Simular voto de amigo (Testar grupo)</span>
        </button>
      </div>
    </div>
  );
};
