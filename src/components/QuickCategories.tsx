import React from 'react';
import { CATEGORIES_DATA, CategoryInfo } from '../data/categories';
import { CategoryTemplate } from '../types';
import { ChevronRight } from 'lucide-react';

interface QuickCategoriesProps {
  onSelectTemplate: (template: CategoryTemplate) => void;
}

export const QuickCategories: React.FC<QuickCategoriesProps> = ({ onSelectTemplate }) => {
  const [activeCategory, setActiveCategory] = React.useState<CategoryInfo | null>(null);

  const handleCardClick = (cat: CategoryInfo) => {
    // If the category has templates, pick the first flagship template directly, or open quick drawer
    // The prompt: "Ao tocar em uma categoria, abrir automaticamente a tela de criação de decisão com uma pergunta/modelo correspondente."
    if (cat.templates.length > 0) {
      // Open selector drawer or pick the primary flagship template
      setActiveCategory(cat);
    }
  };

  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
          <span>🔥</span> Escolha rápida
        </h2>
        <span className="text-xs font-semibold text-slate-400">30+ modelos</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {CATEGORIES_DATA.map((cat) => (
          <button
            key={cat.id}
            id={`cat-card-${cat.id}`}
            onClick={() => handleCardClick(cat)}
            className="group relative flex flex-col items-start p-3.5 rounded-2xl bg-white border border-slate-200/90 hover:border-rose-400/80 hover:shadow-md active:scale-97 transition-all text-left overflow-hidden"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-2xl mb-2 group-hover:scale-110 transition-transform shadow-2xs">
              {cat.emoji}
            </div>
            <h3 className="font-bold text-sm text-slate-800 leading-tight group-hover:text-rose-600 transition-colors">
              {cat.name}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
              {cat.templates.length} perguntas
            </p>
          </button>
        ))}
      </div>

      {/* Template Quick Selection Drawer/Modal if clicked */}
      {activeCategory && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{activeCategory.emoji}</span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    {activeCategory.name}
                  </h3>
                  <p className="text-xs text-slate-500">{activeCategory.description}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveCategory(null)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-full text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Escolha um modelo pronto:
              </p>
              {activeCategory.templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    onSelectTemplate(tpl);
                    setActiveCategory(null);
                  }}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-rose-50 border border-slate-200/80 hover:border-rose-300 text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 group-hover:text-rose-700">
                      {tpl.question}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {tpl.options.join(' • ')}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 shrink-0 ml-2" />
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  // Direct default
                  onSelectTemplate(activeCategory.templates[0]);
                  setActiveCategory(null);
                }}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-500 text-white font-bold rounded-xl shadow-md text-sm hover:opacity-95 active:scale-98 transition-all"
              >
                Usar o modelo principal 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
