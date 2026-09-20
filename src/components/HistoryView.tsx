import React, { useState } from 'react';
import { History, Search, Heart, Share2, RotateCw, Trash2, Calendar, Dices, Users, Sparkles } from 'lucide-react';
import { Decision } from '../types';
import { getDecisions, toggleFavoriteDecision, deleteDecision } from '../services/storage';

interface HistoryViewProps {
  onSelectDecisionToRerun: (decision: Decision) => void;
  onShare: (decision: Decision) => void;
  onCreateNew: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onSelectDecisionToRerun,
  onShare,
  onCreateNew,
}) => {
  const [decisions, setDecisions] = useState<Decision[]>(getDecisions());
  const [filterType, setFilterType] = useState<'all' | 'raffle' | 'group' | 'favorite'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  const refreshList = () => {
    setDecisions(getDecisions());
  };

  const handleToggleFavorite = (decisionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavoriteDecision(decisionId);
    refreshList();
    if (selectedDecision && selectedDecision.id === decisionId) {
      setSelectedDecision({ ...selectedDecision, isFavorite: !selectedDecision.isFavorite });
    }
  };

  const handleDelete = (decisionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Deseja excluir esta decisão do histórico?')) {
      deleteDecision(decisionId);
      refreshList();
      if (selectedDecision && selectedDecision.id === decisionId) {
        setSelectedDecision(null);
      }
    }
  };

  const filteredDecisions = decisions.filter((d) => {
    if (filterType === 'raffle' && d.type !== 'raffle') return false;
    if (filterType === 'group' && d.type !== 'group') return false;
    if (filterType === 'favorite' && !d.isFavorite) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const questionMatch = d.question.toLowerCase().includes(q);
      const winnerMatch = d.options.some(
        (o) => o.id === d.winnerOptionId && o.text.toLowerCase().includes(q)
      );
      return questionMatch || winnerMatch;
    }
    return true;
  });

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return 'Hoje';
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-5 pb-24">
      {/* Title */}
      <div className="mb-4">
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <History className="w-5 h-5 text-rose-600" />
          <span>Minhas decisões</span>
        </h1>
        <p className="text-xs text-slate-500">Histórico de escolhas individuais e em grupo</p>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por pergunta ou resultado..."
          className="w-full pl-9 pr-4 py-2.5 bg-white rounded-2xl border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-500"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none text-xs">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap ${
            filterType === 'all'
              ? 'bg-rose-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todas ({decisions.length})
        </button>
        <button
          onClick={() => setFilterType('raffle')}
          className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
            filterType === 'raffle'
              ? 'bg-rose-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Dices className="w-3.5 h-3.5" />
          <span>Sorteios</span>
        </button>
        <button
          onClick={() => setFilterType('group')}
          className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
            filterType === 'group'
              ? 'bg-rose-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Grupos</span>
        </button>
        <button
          onClick={() => setFilterType('favorite')}
          className={`px-3 py-1.5 rounded-full font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
            filterType === 'favorite'
              ? 'bg-rose-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Favoritas</span>
        </button>
      </div>

      {/* List */}
      {filteredDecisions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center my-6">
          <div className="text-4xl mb-2">📜</div>
          <h3 className="font-extrabold text-slate-800 text-base">Nenhuma decisão encontrada</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {searchQuery
              ? 'Tente outro termo de busca ou limpe o filtro.'
              : 'Suas decisões sorteadas ou votadas aparecerão aqui.'}
          </p>
          <button
            onClick={onCreateNew}
            className="mt-4 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs shadow-xs hover:bg-rose-700 transition-all"
          >
            Tomar uma decisão agora 🎲
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredDecisions.map((item) => {
            const winner = item.options.find((o) => o.id === item.winnerOptionId);

            return (
              <div
                key={item.id}
                onClick={() => setSelectedDecision(item)}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-rose-400 hover:shadow-xs transition-all cursor-pointer text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                          item.type === 'raffle'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {item.type === 'raffle' ? <Dices className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                        <span>{item.type === 'raffle' ? 'Sorteio' : 'Grupo'}</span>
                      </span>

                      <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(item.createdAt)}</span>
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-sm leading-tight line-clamp-2">
                      {item.question}
                    </h3>

                    {/* Winner info formatted as required in Section 14 */}
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      <span className="font-medium text-slate-500">Resultado:</span>
                      <span className="font-black text-rose-600 flex items-center gap-1">
                        <span>{winner?.emoji || '🏆'}</span>
                        <span>{winner?.text || 'Finalizada'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleToggleFavorite(item.id, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Favoritar"
                    >
                      <Heart
                        className={`w-4 h-4 ${item.isFavorite ? 'fill-rose-600 text-rose-600' : ''}`}
                      />
                    </button>
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Detail Drawer if item selected */}
      {selectedDecision && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500">
                Detalhes da Decisão #{selectedDecision.id}
              </span>
              <button
                onClick={() => setSelectedDecision(null)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="my-4 text-center">
              <h2 className="text-lg font-black text-slate-900">
                "{selectedDecision.question}"
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Data: {formatDate(selectedDecision.createdAt)} • {selectedDecision.type === 'raffle' ? 'Sorteio individual' : 'Votação em grupo'}
              </p>

              {/* Winner */}
              {selectedDecision.winnerOptionId && (
                <div className="my-4 p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200">
                  <span className="text-4xl block mb-1">
                    {selectedDecision.options.find((o) => o.id === selectedDecision.winnerOptionId)?.emoji || '🏆'}
                  </span>
                  <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                    Opção Vencedora
                  </p>
                  <h3 className="text-xl font-black text-slate-900 uppercase">
                    {selectedDecision.options.find((o) => o.id === selectedDecision.winnerOptionId)?.text}
                  </h3>
                </div>
              )}

              {/* Options list */}
              <div className="text-left space-y-1.5 mt-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Todas as opções avaliadas:
                </p>
                {selectedDecision.options.map((opt) => (
                  <div
                    key={opt.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs font-bold"
                  >
                    <span>
                      {opt.emoji} {opt.text}
                    </span>
                    {selectedDecision.type === 'group' && (
                      <span className="text-slate-500 font-medium">
                        {opt.votes} {opt.votes === 1 ? 'voto' : 'votos'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  onSelectDecisionToRerun(selectedDecision);
                  setSelectedDecision(null);
                }}
                className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Sortear / Decidir novamente com estas opções</span>
              </button>

              <button
                onClick={() => {
                  onShare(selectedDecision);
                  setSelectedDecision(null);
                }}
                className="w-full py-2.5 bg-rose-50 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartilhar resultado</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
