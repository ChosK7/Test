import React, { useState } from 'react';
import { User, Flame, Trophy, Crown, Check, Sparkles, LogIn, Mail, ShieldCheck, Zap } from 'lucide-react';
import { UserProfile } from '../types';
import { getAchievements, saveUserProfile, updateUserPlan } from '../services/storage';

interface ProfileViewProps {
  userProfile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  openPremiumDirectly?: boolean;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  onProfileUpdated,
  openPremiumDirectly = false,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [mockEmail, setMockEmail] = useState('');
  const [mockName, setMockName] = useState('');
  const [feedbackToast, setFeedbackToast] = useState('');

  const achievements = getAchievements(userProfile.totalDecisions);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(false as any), 3000);
  };

  const handleToggleDemoPremium = () => {
    const nextPlan = userProfile.plan === 'free' ? 'premium' : 'free';
    const updated = updateUserPlan(nextPlan);
    onProfileUpdated(updated);
    showToast(
      nextPlan === 'premium'
        ? '⭐ Modo Demonstração PRO ativado! Anúncios removidos e limite estendido.'
        : 'Plano Gratuito reativado.'
    );
  };

  const handleSimulateLogin = (provider: 'google' | 'email') => {
    const updated: UserProfile = {
      ...userProfile,
      name: mockName.trim() || (provider === 'google' ? 'Usuário Google' : 'Carlos Silva'),
      email: mockEmail.trim() || (provider === 'google' ? 'usuario@gmail.com' : 'carlos@exemplo.com'),
      isLoggedIn: true,
    };
    saveUserProfile(updated);
    onProfileUpdated(updated);
    setShowLoginModal(false);
    showToast(`Conectado como ${updated.name}! Histórico sincronizado.`);
  };

  const handleLogout = () => {
    const updated: UserProfile = {
      ...userProfile,
      name: 'Visitante',
      email: undefined,
      isLoggedIn: false,
    };
    saveUserProfile(updated);
    onProfileUpdated(updated);
    showToast('Você voltou para o modo visitante.');
  };

  return (
    <div className="max-w-md mx-auto px-4 py-5 pb-24 space-y-5">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="fixed top-16 left-4 right-4 max-w-md mx-auto z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* User Card */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-400 text-white flex items-center justify-center font-black text-xl shadow-md shadow-rose-500/20 uppercase">
            {userProfile.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-base text-slate-900 leading-tight">
                {userProfile.name}
              </h2>
              {userProfile.plan === 'premium' ? (
                <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  PRO
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-600 font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                  FREE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {userProfile.isLoggedIn ? userProfile.email : 'Modo Visitante (sem cadastro)'}
            </p>
          </div>
        </div>

        <div>
          {userProfile.isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 px-2 py-1"
            >
              Sair
            </button>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors shadow-2xs"
            >
              Entrar
            </button>
          )}
        </div>
      </div>

      {/* Light Gamification Section (Section 16) */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent border border-amber-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shadow-2xs">
              🔥
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                Sequência de decisões
              </h3>
              <p className="text-xs text-slate-500">
                Você tomou <strong className="text-amber-600">{userProfile.totalDecisions} decisões</strong> esta semana.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-amber-600">{userProfile.streakDays}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none">dias seguidos</span>
          </div>
        </div>

        {/* Progress Badges */}
        <div className="mt-4 pt-3 border-t border-amber-200/60">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Conquistas</span>
          </p>

          <div className="grid grid-cols-2 gap-2">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`p-3 rounded-2xl border flex items-start gap-2.5 transition-all ${
                  ach.unlocked
                    ? 'bg-white border-amber-200 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200 opacity-60'
                }`}
              >
                <span className="text-2xl select-none">{ach.icon}</span>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-slate-900 leading-tight truncate">
                    {ach.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                    {ach.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monetization / Premium Subscription Section (Section 17) */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white leading-tight">
                DECIDE AÍ Premium
              </h3>
              <p className="text-xs text-slate-400">Decida com poder total e sem limites</p>
            </div>
          </div>
        </div>

        {/* Pricing Toggle */}
        <div className="bg-white/10 p-1 rounded-2xl flex items-center mb-5 text-xs font-bold">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`flex-1 py-2 rounded-xl transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Mensal (R$ 9,90/mês)
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
              billingCycle === 'annual'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Anual (R$ 59,90)</span>
            <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.2 rounded-full uppercase">
              -50%
            </span>
          </button>
        </div>

        {/* Features Checklist */}
        <div className="space-y-2 mb-6 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span><strong>Remoção total de anúncios</strong></span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span><strong>Mais opções por decisão</strong> (até 12 opções ao invés de 6)</span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Decisões e sorteios <strong>ilimitados</strong></span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Histórico completo sincronizado</span>
          </div>
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Exportação de cards visuais em alta resolução</span>
          </div>
        </div>

        {/* Prototype Demo Mode Toggle as required in Section 17 */}
        <div className="pt-2">
          <button
            id="toggle-premium-demo-btn"
            onClick={handleToggleDemoPremium}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 ${
              userProfile.plan === 'premium'
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 hover:opacity-95 shadow-amber-500/20'
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>
              {userProfile.plan === 'premium'
                ? 'Voltar ao Plano Gratuito (Demo)'
                : 'Ativar Demonstração do Premium ⭐'}
            </span>
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            * Ambiente de protótipo: clique acima para testar todos os recursos do PRO sem cobrança real.
          </p>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-1.5">
                <LogIn className="w-4 h-4 text-rose-600" />
                <span>Entrar na sua conta</span>
              </h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-500">
                Acesse para sincronizar seu histórico e manter seus favoritos em qualquer aparelho.
              </p>

              <button
                onClick={() => handleSimulateLogin('google')}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs text-slate-700 flex items-center justify-center gap-2 shadow-2xs transition-colors"
              >
                <span>🌐 Continuar com Google</span>
              </button>

              <div className="relative my-2 text-center">
                <span className="bg-white px-2 text-[11px] text-slate-400 font-semibold relative z-10">
                  ou por e-mail
                </span>
                <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-200" />
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={mockName}
                  onChange={(e) => setMockName(e.target.value)}
                  placeholder="Seu nome (ex: Carlos)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-rose-500"
                />
                <input
                  type="email"
                  value={mockEmail}
                  onChange={(e) => setMockEmail(e.target.value)}
                  placeholder="Seu e-mail"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-rose-500"
                />
                <button
                  onClick={() => handleSimulateLogin('email')}
                  className="w-full py-3 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors shadow-2xs"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
