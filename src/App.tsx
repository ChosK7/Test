import React, { useState, useEffect } from 'react';
import { Users, Dices, Sparkles, ArrowRight } from 'lucide-react';
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
} from './types';
import {
  getUserProfile,
  saveDecision,
  incrementUserDecisions,
  findDecisionById,
} from './services/storage';

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

  // Share modal state
  const [shareDecision, setShareDecision] = useState<Decision | null>(null);

  // Check URL params for room / decision sharing (e.g. ?room=8F72 or ?decision=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    const decisionCode = params.get('decision');

    if (roomCode) {
      const found = findDecisionById(roomCode);
      if (found) {
        if (found.status === 'finished') {
          setActiveGroupResult(found);
        } else {
          setActiveGroupDecision(found);
        }
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
      const updatedUser = incrementUserDecisions();
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
    const updatedUser = incrementUserDecisions();
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

  // Return to home
  const handleResetToHome = () => {
    setActiveRaffleDecision(null);
    setRaffleWinner(null);
    setIsRaffleAnimating(false);
    setActiveGroupDecision(null);
    setActiveGroupResult(null);
    setActiveTab('home');

    // Clean URL query params without reloading
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
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
          {/* Active Group Room View */}
          {activeGroupDecision && (
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
          {!activeGroupDecision && activeGroupResult && (
            <GroupResult
              decision={activeGroupResult}
              onNewDecision={() => handleOpenCreate('group')}
              onShare={(d) => setShareDecision(d)}
              onGoHome={handleResetToHome}
            />
          )}

          {/* Active Raffle Result View */}
          {!activeGroupDecision && !activeGroupResult && activeRaffleDecision && raffleWinner && (
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
          {!activeGroupDecision && !activeGroupResult && (!activeRaffleDecision || !raffleWinner) && (
            <>
              {/* TAB 1: HOME */}
              {activeTab === 'home' && (
                <div className="py-5 space-y-6">
                  {/* Hero Prompt Section (Section 4) */}
                  <div className="px-4 text-center">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
                      <span>🤔</span> Tá difícil decidir?
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs mx-auto">
                      Coloque as opções na mesa. O DECIDE AÍ resolve no dado ou na votação com a galera.
                    </p>
                  </div>

                  {/* Primary & Secondary Decision Buttons (Section 4) */}
                  <div className="px-4 space-y-3">
                    {/* Big Primary Button: 🎲 DECIDE AÍ */}
                    <button
                      id="main-decide-ai-btn"
                      onClick={() => handleOpenCreate('raffle')}
                      className="w-full py-5 px-6 rounded-3xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 active:scale-98 text-white shadow-xl shadow-rose-500/25 transition-all flex items-center justify-between group"
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
                    <button
                      id="group-decision-btn"
                      onClick={() => handleOpenCreate('group')}
                      className="w-full py-3.5 px-5 rounded-2xl bg-white border-2 border-slate-200/90 hover:border-slate-300 hover:bg-slate-50 active:scale-98 text-slate-800 font-extrabold text-sm shadow-xs transition-all flex items-center justify-center gap-2"
                    >
                      <Users className="w-4 h-4 text-rose-600" />
                      <span>👥 DECISÃO EM GRUPO</span>
                    </button>
                  </div>

                  {/* Section: 🔥 Escolha rápida (Section 4) */}
                  <QuickCategories
                    onSelectTemplate={(tpl) => handleOpenCreate('raffle', tpl)}
                  />
                </div>
              )}

              {/* TAB 2: CRIAR (Direct create shortcut) */}
              {activeTab === 'create' && (
                <div className="p-4 text-center py-10">
                  <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-3xl mx-auto mb-3 shadow-xs">
                    ✨
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    O que vamos resolver hoje?
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto mb-6">
                    Crie uma decisão em segundos para sortear ou votar com amigos.
                  </p>

                  <div className="space-y-3 max-w-xs mx-auto">
                    <button
                      onClick={() => handleOpenCreate('raffle')}
                      className="w-full py-4 px-4 bg-gradient-to-r from-rose-600 to-amber-500 text-white font-black text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-98"
                    >
                      <span>🎲 Iniciar Sorteio Individual</span>
                    </button>

                    <button
                      onClick={() => handleOpenCreate('group')}
                      className="w-full py-3.5 px-4 bg-white border border-slate-200 text-slate-800 font-bold text-sm rounded-2xl shadow-xs flex items-center justify-center gap-2 active:scale-98"
                    >
                      <span>👥 Criar Votação em Grupo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: HISTÓRICO (Section 14) */}
              {activeTab === 'history' && (
                <HistoryView
                  onSelectDecisionToRerun={handleRerunFromHistory}
                  onShare={(d) => setShareDecision(d)}
                  onCreateNew={() => handleOpenCreate('raffle')}
                />
              )}

              {/* TAB 4: PERFIL & MONETIZAÇÃO (Section 15, 16, 17) */}
              {activeTab === 'profile' && (
                <ProfileView
                  userProfile={userProfile}
                  onProfileUpdated={(updated) => setUserProfile(updated)}
                />
              )}
            </>
          )}
        </main>

        {/* Bottom Navigation (Section 27) */}
        <BottomNav
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === 'create') {
              handleOpenCreate('raffle');
            } else {
              // If currently in a result/room screen, allow returning
              setActiveRaffleDecision(null);
              setRaffleWinner(null);
              setActiveGroupDecision(null);
              setActiveGroupResult(null);
              setActiveTab(tab);
            }
          }}
        />

        {/* Suspense Raffle Animation Modal (Section 6) */}
        {isRaffleAnimating && activeRaffleDecision && (
          <RaffleAnimation
            decision={activeRaffleDecision}
            onFinished={handleRaffleAnimationFinish}
          />
        )}

        {/* Create Decision Modal (Section 5) */}
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

        {/* Share Modal with Text & Generated Visual Card (Section 12) */}
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
