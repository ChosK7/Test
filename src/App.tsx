import React, { useState, useEffect } from 'react';
import {
  Users,
  Dices,
  Sparkles,
  ArrowRight,
  KeyRound,
  Loader2,
  AlertCircle,
  Home,
  X,
} from 'lucide-react';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { BannerAd } from './components/BannerAd';
import { QuickCategories } from './components/QuickCategories';
import { CreateDecisionModal } from './components/CreateDecisionModal';
import { RaffleAnimation } from './components/RaffleAnimation';
import { RaffleResult } from './components/RaffleResult';
import { GroupRoom } from './components/GroupRoom';
import { GroupResult } from './components/GroupResult';
import { ShareModal } from './components/ShareModal';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import {
  CategoryTemplate,
  Decision,
  DecisionOption,
  DecisionType,
  UserProfile,
  GroupRoomDoc,
} from './types';
import {
  getUserProfile,
  saveDecision,
  incrementUserDecisions,
  findDecisionById,
} from './services/storage';
import { findRoomByPublicCode, getRoomById } from './services/firestore';
import { isFirebaseConfigured } from './services/firebase';

export default function App() {
  // Navigation & Screen states
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [userProfile, setUserProfile] = useState<UserProfile>(getUserProfile());

  // Decision flow state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createInitialType, setCreateInitialType] = useState<DecisionType>('raffle');
  const [createInitialTemplate, setCreateInitialTemplate] = useState<CategoryTemplate | null>(null);

  // Active in-progress states
  const [activeRaffleDecision, setActiveRaffleDecision] = useState<Decision | null>(null);
  const [isRaffleAnimating, setIsRaffleAnimating] = useState(false);
  const [raffleWinner, setRaffleWinner] = useState<DecisionOption | null>(null);

  // Group room state
  const [activeGroupDecision, setActiveGroupDecision] = useState<Decision | null>(null);
  const [activeGroupResult, setActiveGroupResult] = useState<Decision | null>(null);

  // Room lookup & code entry states
  const [isLoadingRoom, setIsLoadingRoom] = useState<boolean>(false);
  const [roomNotFoundCode, setRoomNotFoundCode] = useState<string | null>(null);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [joinCodeError, setJoinCodeError] = useState<string>('');
  const [isSearchingCode, setIsSearchingCode] = useState<boolean>(false);

  // Share modal state
  const [shareDecision, setShareDecision] = useState<Decision | null>(null);

  // Check URL params for room / decision sharing (e.g. ?room=8F72 or /group/8F72) (Section 8 & 16)
  useEffect(() => {
    const handleUrlResolution = async () => {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const queryRoom = params.get('room');
      const decisionCode = params.get('decision');

      // Also support pathname /group/:code
      const pathMatch = window.location.pathname.match(/\/group\/([a-zA-Z0-9_-]+)/i);
      const targetRoomCode = queryRoom || (pathMatch ? pathMatch[1] : null);

      if (targetRoomCode) {
        setIsLoadingRoom(true);
        setRoomNotFoundCode(null);

        try {
          if (isFirebaseConfigured()) {
            const firestoreRoom: GroupRoomDoc | null =
              (await findRoomByPublicCode(targetRoomCode)) ||
              (await getRoomById(targetRoomCode));

            if (firestoreRoom) {
              const dec: Decision = {
                id: firestoreRoom.id,
                publicCode: firestoreRoom.publicCode,
                creatorId: firestoreRoom.hostId,
                creatorName: firestoreRoom.hostName,
                question: firestoreRoom.question,
                type: 'group',
                status: firestoreRoom.status,
                options: firestoreRoom.options,
                participants: [],
                maxParticipants: firestoreRoom.maxParticipants,
                isSecretVoting: firestoreRoom.isSecretVoting,
                category: firestoreRoom.category,
                createdAt: firestoreRoom.createdAt,
                finishedAt: firestoreRoom.finishedAt,
                winnerOptionId: firestoreRoom.winnerOptionId || undefined,
                tiedOptionIds: firestoreRoom.tiedOptionIds || undefined,
                isTieBreaker: firestoreRoom.isTieBreaker,
              };

              if (firestoreRoom.status === 'finished') {
                setActiveGroupResult(dec);
                setActiveGroupDecision(null);
              } else {
                setActiveGroupDecision(dec);
                setActiveGroupResult(null);
              }
              setIsLoadingRoom(false);
              return;
            }
          }

          // Fallback to local storage if offline or not in Firestore
          const localFound = findDecisionById(targetRoomCode);
          if (localFound) {
            if (localFound.status === 'finished') {
              setActiveGroupResult(localFound);
              setActiveGroupDecision(null);
            } else {
              setActiveGroupDecision(localFound);
              setActiveGroupResult(null);
            }
            setIsLoadingRoom(false);
            return;
          }

          // Room not found anywhere
          setRoomNotFoundCode(targetRoomCode);
        } catch (err) {
          console.error('Error resolving room URL:', err);
          setRoomNotFoundCode(targetRoomCode);
        } finally {
          setIsLoadingRoom(false);
        }
      } else if (decisionCode) {
        const found = findDecisionById(decisionCode);
        if (found) {
          if (found.type === 'raffle') {
            const winOpt = found.options.find((o) => o.id === found.winnerOptionId) || found.options[0];
            setActiveRaffleDecision(found);
            setRaffleWinner(winOpt);
          } else {
            setActiveGroupResult(found);
          }
        }
      }
    };

    handleUrlResolution();
  }, []);

  // Handle open create modal
  const handleOpenCreate = (type: DecisionType = 'raffle', template: CategoryTemplate | null = null) => {
    setCreateInitialType(type);
    setCreateInitialTemplate(template);
    setIsCreateModalOpen(true);
  };

  // Start decision (from Create modal)
  const handleStartDecision = (newDecision: Decision) => {
    setIsCreateModalOpen(false);

    if (newDecision.type === 'raffle') {
      setActiveRaffleDecision(newDecision);
      setRaffleWinner(null);
      setIsRaffleAnimating(true);
    } else {
      // Group decision
      saveDecision(newDecision);
      const updatedUser = incrementUserDecisions(true);
      setUserProfile(updatedUser);
      setActiveGroupDecision(newDecision);
      setActiveGroupResult(null);
    }
  };

  // When raffle animation finishes
  const handleRaffleAnimationFinish = (winner: DecisionOption) => {
    setIsRaffleAnimating(false);
    if (!activeRaffleDecision) return;

    const finishedDecision: Decision = {
      ...activeRaffleDecision,
      status: 'finished',
      winnerOptionId: winner.id,
      finishedAt: new Date().toISOString(),
    };

    saveDecision(finishedDecision);
    const updatedUser = incrementUserDecisions(false);
    setUserProfile(updatedUser);

    setActiveRaffleDecision(finishedDecision);
    setRaffleWinner(winner);
  };

  // Re-run raffle with the same options
  const handleDecideAgain = () => {
    if (!activeRaffleDecision) return;
    setRaffleWinner(null);
    setIsRaffleAnimating(true);
  };

  // Return to home and clean query / path params
  const handleResetToHome = () => {
    setActiveRaffleDecision(null);
    setRaffleWinner(null);
    setIsRaffleAnimating(false);
    setActiveGroupDecision(null);
    setActiveGroupResult(null);
    setRoomNotFoundCode(null);
    setActiveTab('home');

    // Clean URL query params without reloading
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, '/');
    }
  };

  // Re-run from history
  const handleRerunFromHistory = (decision: Decision) => {
    if (decision.type === 'raffle') {
      setActiveRaffleDecision({
        ...decision,
        id: Math.random().toString(36).substring(2, 6).toUpperCase(),
        createdAt: new Date().toISOString(),
      });
      setRaffleWinner(null);
      setIsRaffleAnimating(true);
      setActiveTab('home');
    } else {
      handleOpenCreate('group', {
        id: 'rerun',
        categoryId: 'custom',
        categoryName: decision.category || 'Geral',
        categoryEmoji: '👥',
        question: decision.question,
        options: decision.options.map((o) => `${o.emoji || ''} ${o.text}`.trim()),
      });
    }
  };

  // Join Room by Code action
  const handleSearchRoomByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().toUpperCase().replace('#', '');
    if (!cleanCode) {
      setJoinCodeError('Digite o código da sala.');
      return;
    }

    setIsSearchingCode(true);
    setJoinCodeError('');

    try {
      if (isFirebaseConfigured()) {
        const firestoreRoom =
          (await findRoomByPublicCode(cleanCode)) ||
          (await getRoomById(cleanCode));

        if (firestoreRoom) {
          const dec: Decision = {
            id: firestoreRoom.id,
            publicCode: firestoreRoom.publicCode,
            creatorId: firestoreRoom.hostId,
            creatorName: firestoreRoom.hostName,
            question: firestoreRoom.question,
            type: 'group',
            status: firestoreRoom.status,
            options: firestoreRoom.options,
            participants: [],
            maxParticipants: firestoreRoom.maxParticipants,
            isSecretVoting: firestoreRoom.isSecretVoting,
            category: firestoreRoom.category,
            createdAt: firestoreRoom.createdAt,
            finishedAt: firestoreRoom.finishedAt,
            winnerOptionId: firestoreRoom.winnerOptionId || undefined,
            tiedOptionIds: firestoreRoom.tiedOptionIds || undefined,
            isTieBreaker: firestoreRoom.isTieBreaker,
          };

          setIsJoinCodeModalOpen(false);
          setJoinCodeInput('');

          if (firestoreRoom.status === 'finished') {
            setActiveGroupResult(dec);
            setActiveGroupDecision(null);
          } else {
            setActiveGroupDecision(dec);
            setActiveGroupResult(null);
          }
          return;
        }
      }

      // Check local storage fallback
      const localFound = findDecisionById(cleanCode);
      if (localFound) {
        setIsJoinCodeModalOpen(false);
        setJoinCodeInput('');

        if (localFound.status === 'finished') {
          setActiveGroupResult(localFound);
          setActiveGroupDecision(null);
        } else {
          setActiveGroupDecision(localFound);
          setActiveGroupResult(null);
        }
        return;
      }

      setJoinCodeError(`Sala #${cleanCode} não encontrada. Verifique o código e tente novamente.`);
    } catch (err) {
      console.error('Error finding room by code:', err);
      setJoinCodeError('Erro ao buscar a sala. Verifique sua conexão.');
    } finally {
      setIsSearchingCode(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center">
      <div className="w-full max-w-md min-h-screen bg-slate-50 flex flex-col shadow-2xl relative pb-16">
        {/* Persistent Top Header */}
        <Header
          userProfile={userProfile}
          onOpenProfile={() => setActiveTab('profile')}
        />

        {/* Free Plan Subtle Banner Ad */}
        {userProfile.plan === 'free' && (
          <BannerAd onUpgradeClick={() => setActiveTab('profile')} />
        )}

        {/* Main Content Areas based on active flow or tab */}
        <main className="flex-1">
          {/* Loading Room State */}
          {isLoadingRoom && (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
              <Loader2 className="w-10 h-10 text-rose-600 animate-spin mb-3" />
              <h2 className="text-lg font-black text-slate-800">Conectando à sala...</h2>
              <p className="text-xs text-slate-500 mt-1">Carregando opções e participantes em tempo real</p>
            </div>
          )}

          {/* Room Not Found Error State (Section 8) */}
          {!isLoadingRoom && roomNotFoundCode && (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center text-3xl mb-4 shadow-sm">
                🔍
              </div>
              <h2 className="text-xl font-black text-slate-900">
                Sala #{roomNotFoundCode} não encontrada
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-1.5 max-w-xs mx-auto mb-6">
                Verifique se o código está correto ou se a sala já foi encerrada e removida.
              </p>
              <button
                onClick={handleResetToHome}
                className="py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Voltar ao Início</span>
              </button>
            </div>
          )}

          {/* Active Group Room View */}
          {!isLoadingRoom && !roomNotFoundCode && activeGroupDecision && (
            <GroupRoom
              decision={activeGroupDecision}
              userProfile={userProfile}
              onDecisionFinished={(finished) => {
                setActiveGroupDecision(null);
                setActiveGroupResult(finished);
              }}
              onBack={handleResetToHome}
            />
          )}

          {/* Active Group Result View */}
          {!isLoadingRoom && !roomNotFoundCode && !activeGroupDecision && activeGroupResult && (
            <GroupResult
              decision={activeGroupResult}
              onNewDecision={() => handleOpenCreate('group')}
              onShare={(d) => setShareDecision(d)}
              onGoHome={handleResetToHome}
            />
          )}

          {/* Active Raffle Result View */}
          {!isLoadingRoom && !roomNotFoundCode && !activeGroupDecision && !activeGroupResult && activeRaffleDecision && raffleWinner && (
            <RaffleResult
              decision={activeRaffleDecision}
              winnerOption={raffleWinner}
              userProfile={userProfile}
              onDecideAgain={handleDecideAgain}
              onShare={(d) => setShareDecision(d)}
              onGoHome={handleResetToHome}
              onUpgradeClick={() => setActiveTab('profile')}
            />
          )}

          {/* Standard Navigation Tabs when no active decision session is open */}
          {!isLoadingRoom && !roomNotFoundCode && !activeGroupDecision && !activeGroupResult && (!activeRaffleDecision || !raffleWinner) && (
            <>
              {/* TAB 1: HOME */}
              {activeTab === 'home' && (
                <div className="py-5 space-y-6">
                  {/* Hero Prompt Section */}
                  <div className="px-4 text-center">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
                      <span>🤔</span> Tá difícil decidir?
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs mx-auto">
                      Coloque as opções na mesa. O DECIDE AÍ resolve no dado ou na votação com a galera.
                    </p>
                  </div>

                  {/* Primary & Secondary Decision Buttons */}
                  <div className="px-4 space-y-2.5">
                    {/* Big Primary Button: 🎲 DECIDE AÍ */}
                    <button
                      id="main-decide-ai-btn"
                      onClick={() => handleOpenCreate('raffle')}
                      className="w-full py-5 px-6 rounded-3xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 active:scale-98 text-white shadow-xl shadow-rose-500/25 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-13 h-13 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform select-none">
                          🎲
                        </div>
                        <div className="text-left">
                          <span className="block text-2xl font-black tracking-tight leading-tight">
                            DECIDE AÍ
                          </span>
                          <span className="text-xs font-bold text-white/90">
                            Sorteio rápido e individual
                          </span>
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                        <ArrowRight className="w-5 h-5 text-white stroke-[2.5]" />
                      </div>
                    </button>

                    {/* Secondary Button: 👥 DECISÃO EM GRUPO */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        id="group-decision-btn"
                        onClick={() => handleOpenCreate('group')}
                        className="w-full py-3.5 px-4 rounded-2xl bg-white border-2 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50 active:scale-98 text-slate-800 font-extrabold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Users className="w-4 h-4 text-rose-600" />
                        <span>Criar em Grupo</span>
                      </button>

                      <button
                        id="join-group-btn"
                        onClick={() => {
                          setJoinCodeError('');
                          setJoinCodeInput('');
                          setIsJoinCodeModalOpen(true);
                        }}
                        className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-extrabold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 text-amber-400" />
                        <span>Entrar com Código</span>
                      </button>
                    </div>
                  </div>

                  {/* Section: 🔥 Escolha rápida */}
                  <QuickCategories
                    onSelectTemplate={(tpl) => handleOpenCreate('raffle', tpl)}
                  />
                </div>
              )}

              {/* TAB 2: CRIAR */}
              {activeTab === 'create' && (
                <div className="p-4 text-center py-10">
                  <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-3xl mx-auto mb-3 shadow-xs">
                    ✨
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    O que vamos resolver hoje?
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto mb-6">
                    Crie uma decisão em segundos para sortear ou votar com amigos em tempo real.
                  </p>

                  <div className="space-y-3 max-w-xs mx-auto">
                    <button
                      onClick={() => handleOpenCreate('raffle')}
                      className="w-full py-4 px-4 bg-gradient-to-r from-rose-600 to-amber-500 text-white font-black text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                    >
                      <span>🎲 Iniciar Sorteio Individual</span>
                    </button>

                    <button
                      onClick={() => handleOpenCreate('group')}
                      className="w-full py-3.5 px-4 bg-white border border-slate-200 text-slate-800 font-bold text-sm rounded-2xl shadow-xs flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                    >
                      <span>👥 Criar Votação em Grupo</span>
                    </button>

                    <button
                      onClick={() => {
                        setJoinCodeError('');
                        setJoinCodeInput('');
                        setIsJoinCodeModalOpen(true);
                      }}
                      className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>Entrar em sala com código</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: HISTÓRICO */}
              {activeTab === 'history' && (
                <HistoryView
                  onSelectDecisionToRerun={handleRerunFromHistory}
                  onShare={(d) => setShareDecision(d)}
                  onCreateNew={() => handleOpenCreate('raffle')}
                />
              )}

              {/* TAB 4: PERFIL & PREMIUM */}
              {activeTab === 'profile' && (
                <ProfileView
                  userProfile={userProfile}
                  onProfileUpdated={(updated: UserProfile) => setUserProfile(updated)}
                />
              )}
            </>
          )}
        </main>

        {/* Persistent Bottom Tab Bar */}
        <BottomNav
          activeTab={activeTab}
          onSelectTab={(tab: NavTab) => {
            if (tab === 'create') {
              handleOpenCreate('raffle');
            } else {
              setActiveRaffleDecision(null);
              setRaffleWinner(null);
              setActiveGroupDecision(null);
              setActiveGroupResult(null);
              setRoomNotFoundCode(null);
              setActiveTab(tab);
            }
          }}
        />

        {/* Suspense Raffle Animation Modal */}
        {isRaffleAnimating && activeRaffleDecision && (
          <RaffleAnimation
            decision={activeRaffleDecision}
            onFinished={handleRaffleAnimationFinish}
          />
        )}

        {/* Create Decision Modal */}
        <CreateDecisionModal
          initialTemplate={createInitialTemplate}
          initialType={createInitialType}
          userProfile={userProfile}
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setCreateInitialTemplate(null);
          }}
          onStartDecision={handleStartDecision}
          onUpgradeClick={() => {
            setIsCreateModalOpen(false);
            setActiveTab('profile');
          }}
        />

        {/* Join Group Room by Code Modal (Section 8) */}
        {isJoinCodeModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95">
              <button
                onClick={() => setIsJoinCodeModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-2">
                  🔑
                </div>
                <h3 className="font-black text-lg text-slate-900">Entrar em uma Sala</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Digite o código compartilhado pelo anfitrião
                </p>
              </div>

              <form onSubmit={handleSearchRoomByCode} className="space-y-4">
                <div>
                  <input
                    type="text"
                    maxLength={10}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ex: 8F72"
                    className="w-full py-3 px-4 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-rose-500 text-center text-2xl font-mono font-black tracking-widest text-slate-800 uppercase focus:outline-none"
                    autoFocus
                  />
                </div>

                {joinCodeError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{joinCodeError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSearchingCode || !joinCodeInput.trim()}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 active:scale-98 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSearchingCode ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>BUSCANDO...</span>
                    </>
                  ) : (
                    <span>ENTRAR NA SALA</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Share Modal with Text & Generated Visual Card */}
        {shareDecision && (
          <ShareModal
            decision={shareDecision}
            isOpen={!!shareDecision}
            onClose={() => setShareDecision(null)}
          />
        )}
      </div>
    </div>
  );
}
