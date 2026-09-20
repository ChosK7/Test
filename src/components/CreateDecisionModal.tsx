import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Dices, Users, Sparkles, X, Lock, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { CategoryTemplate, Decision, DecisionOption, DecisionType, UserProfile } from '../types';
import { generateRoomCode, suggestEmoji } from '../services/storage';
import { createGroupRoom } from '../services/firestore';
import { isFirebaseConfigured } from '../services/firebase';

interface CreateDecisionModalProps {
  initialTemplate?: CategoryTemplate | null;
  initialType?: DecisionType;
  userProfile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onStartDecision: (decision: Decision) => void;
  onUpgradeClick: () => void;
}

const PARTICIPANT_OPTIONS = [2, 3, 4, 5, 6, 10, 20, null] as const;

export const CreateDecisionModal: React.FC<CreateDecisionModalProps> = ({
  initialTemplate,
  initialType = 'raffle',
  userProfile,
  isOpen,
  onClose,
  onStartDecision,
  onUpgradeClick,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<Array<{ id: string; text: string; emoji: string }>>([
    { id: '1', text: 'Pizza', emoji: '🍕' },
    { id: '2', text: 'Hambúrguer', emoji: '🍔' },
    { id: '3', text: 'Sushi', emoji: '🍣' },
  ]);
  const [decisionType, setDecisionType] = useState<DecisionType>(initialType);
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
  const [isSecretVoting, setIsSecretVoting] = useState(true);
  const [category, setCategory] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxAllowedOptions = userProfile.plan === 'premium' ? 12 : 6;

  // Sync initial template if provided
  useEffect(() => {
    if (initialTemplate) {
      setQuestion(initialTemplate.question);
      setCategory(initialTemplate.categoryName);
      setOptions(
        initialTemplate.options.map((optText, idx) => {
          // split emoji if text starts with emoji
          const match = optText.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*(.*)$/u);
          if (match) {
            return {
              id: String(idx + 1),
              emoji: match[1],
              text: match[2] || optText,
            };
          }
          return {
            id: String(idx + 1),
            emoji: suggestEmoji(optText),
            text: optText,
          };
        })
      );
    } else {
      setQuestion('');
      setCategory('');
      setOptions([
        { id: '1', text: 'Pizza', emoji: '🍕' },
        { id: '2', text: 'Hambúrguer', emoji: '🍔' },
        { id: '3', text: 'Sushi', emoji: '🍣' },
      ]);
    }
    setErrorMsg('');
  }, [initialTemplate, isOpen]);

  useEffect(() => {
    if (initialType) {
      setDecisionType(initialType);
    }
  }, [initialType, isOpen]);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length >= maxAllowedOptions) {
      if (userProfile.plan === 'free') {
        setErrorMsg('O plano gratuito permite até 6 opções. Seja Premium para adicionar até 12!');
      }
      return;
    }
    const newId = String(Date.now());
    setOptions([...options, { id: newId, text: '', emoji: '🎯' }]);
    setErrorMsg('');
  };

  const handleOptionChange = (id: string, text: string) => {
    setOptions(
      options.map((opt) => {
        if (opt.id === id) {
          const autoEmoji = suggestEmoji(text);
          return {
            ...opt,
            text,
            emoji: autoEmoji !== '✨' ? autoEmoji : opt.emoji,
          };
        }
        return opt;
      })
    );
    setErrorMsg('');
  };

  const handleEmojiChange = (id: string, emoji: string) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, emoji } : opt)));
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) {
      setErrorMsg('Você precisa de no mínimo 2 opções para decidir!');
      return;
    }
    setOptions(options.filter((opt) => opt.id !== id));
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanQuestion = question.trim() || 'O que vamos escolher?';
    const validOptions = options
      .map((opt) => ({
        id: opt.id,
        text: opt.text.trim(),
        emoji: opt.emoji,
        votes: 0,
      }))
      .filter((opt) => opt.text.length > 0);

    if (validOptions.length < 2) {
      setErrorMsg('Preencha pelo menos 2 opções válidas.');
      return;
    }

    if (decisionType === 'group') {
      setIsSubmitting(true);
      setErrorMsg('');

      try {
        if (isFirebaseConfigured()) {
          const { room, publicCode } = await createGroupRoom({
            creatorId: userProfile.id,
            creatorName: userProfile.name || 'Você',
            question: cleanQuestion,
            options: validOptions,
            category: category || undefined,
            maxParticipants: maxParticipants || null,
            isSecretVoting,
          });

          const newDecision: Decision = {
            id: room.id,
            publicCode,
            creatorId: userProfile.id,
            creatorName: userProfile.name || 'Você',
            question: cleanQuestion,
            type: 'group',
            status: 'waiting',
            options: room.options,
            participants: [
              {
                id: userProfile.id,
                name: userProfile.name || 'Você',
                joinedAt: new Date().toISOString(),
                isHost: true,
                active: true,
              },
            ],
            maxParticipants: maxParticipants || undefined,
            isSecretVoting,
            category: category || undefined,
            createdAt: room.createdAt,
          };

          setIsSubmitting(false);
          onStartDecision(newDecision);
          return;
        } else {
          // Fallback if environment variables are not yet configured
          const roomId = generateRoomCode();
          const newDecision: Decision = {
            id: roomId,
            publicCode: roomId,
            creatorId: userProfile.id,
            creatorName: userProfile.name || 'Você',
            question: cleanQuestion,
            type: 'group',
            status: 'active',
            options: validOptions,
            participants: [
              {
                id: userProfile.id,
                name: userProfile.name || 'Você',
                joinedAt: new Date().toISOString(),
                isHost: true,
              },
            ],
            maxParticipants: maxParticipants || undefined,
            isSecretVoting,
            category: category || undefined,
            createdAt: new Date().toISOString(),
          };

          setIsSubmitting(false);
          onStartDecision(newDecision);
          return;
        }
      } catch (err: any) {
        console.error('Error creating group room:', err);
        setErrorMsg('Erro ao conectar ao Firebase. Verifique sua conexão e credenciais.');
        setIsSubmitting(false);
        return;
      }
    }

    // Individual Raffle Decision (always local and instant)
    const roomId = generateRoomCode();
    const newDecision: Decision = {
      id: roomId,
      creatorId: userProfile.id,
      creatorName: userProfile.name || 'Você',
      question: cleanQuestion,
      type: 'raffle',
      status: 'draft',
      options: validOptions,
      participants: [],
      maxParticipants: undefined,
      isSecretVoting: false,
      category: category || undefined,
      createdAt: new Date().toISOString(),
    };

    onStartDecision(newDecision);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{decisionType === 'raffle' ? '🎲' : '👥'}</span>
            <div>
              <h2 className="font-black text-lg text-slate-900 leading-tight">
                {decisionType === 'raffle' ? 'Sorteio Rápido' : 'Decisão em Grupo'}
              </h2>
              <p className="text-xs text-slate-500">Crie sua decisão em segundos</p>
            </div>
          </div>
          <button
            id="close-create-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center font-bold text-sm transition-all"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Question Section */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
              O que você precisa decidir?
            </label>
            <div className="relative">
              <input
                id="decision-question-input"
                type="text"
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Ex: Vamos jantar onde?"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-rose-500 focus:bg-white text-slate-900 font-semibold text-base placeholder:text-slate-400 focus:outline-none transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Options Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Suas opções ({options.length}/{maxAllowedOptions})
              </label>
              <span className="text-[11px] font-semibold text-slate-400">Mínimo 2</span>
            </div>

            <div className="space-y-2">
              {options.map((opt, index) => (
                <div key={opt.id} className="flex items-center gap-2 group">
                  <div className="w-9 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0 border border-slate-200 select-none">
                    {opt.emoji}
                  </div>
                  <input
                    id={`option-input-${index}`}
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                    placeholder={`Opção ${index + 1}`}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white text-slate-800 font-medium text-sm focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(opt.id)}
                    className="w-9 h-11 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors shrink-0"
                    title="Remover opção"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <button
                type="button"
                id="add-option-btn"
                onClick={handleAddOption}
                disabled={options.length >= maxAllowedOptions}
                className={`w-full py-2.5 px-3 rounded-xl border-2 border-dashed font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  options.length >= maxAllowedOptions
                    ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                    : 'border-rose-300 text-rose-600 hover:bg-rose-50/70 hover:border-rose-400'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar opção</span>
              </button>
            </div>

            {options.length >= maxAllowedOptions && userProfile.plan === 'free' && (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                <span>⭐</span> Limite de 6 opções no plano gratuito.{' '}
                <button
                  type="button"
                  onClick={onUpgradeClick}
                  className="font-bold underline text-amber-700 ml-1"
                >
                  Liberar até 12 no PRO
                </button>
              </p>
            )}
          </div>

          {/* Mode choice: Sorteio vs Grupo */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Como decidir?
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                id="mode-raffle-btn"
                onClick={() => setDecisionType('raffle')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                  decisionType === 'raffle'
                    ? 'border-rose-600 bg-rose-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl">🎲</span>
                  {decisionType === 'raffle' && (
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">Sorteio</h4>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    O sistema escolhe uma opção aleatoriamente
                  </p>
                </div>
              </button>

              <button
                type="button"
                id="mode-group-btn"
                onClick={() => setDecisionType('group')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                  decisionType === 'group'
                    ? 'border-rose-600 bg-rose-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl">👥</span>
                  {decisionType === 'group' && (
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">Votação</h4>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    Cria sala para várias pessoas votarem
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Group Voting Extra Settings (Section 9) */}
          {decisionType === 'group' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Número de participantes:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PARTICIPANT_OPTIONS.map((num) => (
                    <button
                      key={num === null ? 'unlimited' : num}
                      type="button"
                      onClick={() => setMaxParticipants(num)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        maxParticipants === num
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {num === null ? 'Sem número definido' : num}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {maxParticipants === null
                    ? 'O criador encerra a votação manualmente quando quiser.'
                    : `A votação encerra automaticamente assim que atingir ${maxParticipants} votos.`}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-xs text-slate-800 flex items-center gap-1">
                    <EyeOff className="w-3.5 h-3.5 text-slate-500" /> Votação Secreta
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    Resultado oculto até o encerramento
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSecretVoting(!isSecretVoting)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                    isSecretVoting ? 'bg-rose-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      isSecretVoting ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              id="start-decision-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 disabled:opacity-60 text-white font-black text-lg rounded-2xl shadow-lg shadow-rose-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>CRIANDO SALA...</span>
                </>
              ) : (
                <>
                  <span>{decisionType === 'raffle' ? '🎲' : '👥'}</span>
                  <span>DECIDE AÍ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
