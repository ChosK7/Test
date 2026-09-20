import React, { useRef, useState } from 'react';
import { X, Copy, Check, Share2, Download, MessageSquare } from 'lucide-react';
import { Decision } from '../types';

interface ShareModalProps {
  decision: Decision;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ decision, isOpen, onClose }) => {
  const [copiedText, setCopiedText] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const winner = decision.winnerOptionId
    ? decision.options.find((o) => o.id === decision.winnerOptionId)
    : decision.options[0];

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?decision=${decision.id}`
    : `https://decideai.app/?decision=${decision.id}`;

  // Formatted share message as requested in Section 12
  const shareText = `🎲 DECIDE AÍ\n\n"${decision.question}"\n\n${decision.options
    .map((o) => `${o.emoji || '•'} ${o.text}`)
    .join('\n')}\n\n🏆 Resultado: ${winner ? `${winner.emoji || ''} ${winner.text.toUpperCase()}` : 'Aguardando'}\n\nO DECIDE AÍ decidiu.\n${shareUrl}`;

  const handleCopyText = () => {
    navigator.clipboard.writeText(shareText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleTelegram = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encoded}`, '_blank');
  };

  // Download Card as high-res PNG image via HTML5 Canvas
  const handleDownloadCard = async () => {
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const scale = 2; // high res
      canvas.width = 400 * scale;
      canvas.height = 480 * scale;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.scale(scale, scale);

        // Background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 400, 480);
        bgGrad.addColorStop(0, '#0F172A'); // slate-900
        bgGrad.addColorStop(1, '#1E1B4B'); // slate-950
        ctx.fillStyle = bgGrad;
        ctx.roundRect(0, 0, 400, 480, 24);
        ctx.fill();

        // Accent top glow
        const glow = ctx.createRadialGradient(200, 0, 10, 200, 0, 200);
        glow.addColorStop(0, 'rgba(244, 63, 94, 0.4)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 400, 200);

        // Top Header Logo
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎲 DECIDE AÍ', 200, 48);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px sans-serif';
        ctx.fillText('Você escolhe as opções. A gente decide.', 200, 68);

        // Card Container for Question
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.roundRect(30, 90, 340, 65, 16);
        ctx.fill();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 15px sans-serif';
        // Wrap question text
        const q = decision.question.length > 38 ? decision.question.substring(0, 38) + '...' : decision.question;
        ctx.fillText(`"${q}"`, 200, 128);

        // Winner Card
        const winGrad = ctx.createLinearGradient(30, 175, 370, 340);
        winGrad.addColorStop(0, '#E11D48');
        winGrad.addColorStop(1, '#F59E0B');
        ctx.fillStyle = winGrad;
        ctx.roundRect(30, 175, 340, 160, 20);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('O DESTINO DECIDIU', 200, 205);

        ctx.font = '48px sans-serif';
        ctx.fillText(winner?.emoji || '🎯', 200, 260);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px sans-serif';
        const winText = (winner?.text || 'Vencedor').toUpperCase();
        ctx.fillText(winText.length > 20 ? winText.substring(0, 18) + '...' : winText, 200, 305);

        // Options pills
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.roundRect(30, 350, 340, 65, 14);
        ctx.fill();

        ctx.fillStyle = '#CBD5E1';
        ctx.font = '12px sans-serif';
        const optsSummary = decision.options.map((o) => `${o.emoji} ${o.text}`).slice(0, 3).join(' • ');
        ctx.fillText(optsSummary, 200, 388);

        // Bottom Footer
        ctx.fillStyle = '#64748B';
        ctx.font = '11px sans-serif';
        ctx.fillText(`Sala #${decision.id} • Compartilhe com amigos`, 200, 450);

        // Trigger download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `decide-ai-${decision.id}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (e) {
      console.error('Error generating card image', e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-rose-600" />
            <h3 className="font-extrabold text-slate-900 text-base">
              Compartilhar Decisão
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Share Card (Section 12 requirement) */}
        <div className="my-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Card Visual Oficial:
          </p>

          <div
            ref={cardRef}
            className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-lg border border-slate-800 text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500" />

            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-extrabold tracking-tight text-white flex items-center gap-1">
                <span>🎲</span> DECIDE AÍ
              </span>
              <span className="font-bold text-slate-400">#{decision.id}</span>
            </div>

            <p className="text-xs text-slate-300 font-semibold mb-3 line-clamp-2">
              "{decision.question}"
            </p>

            {/* Winner spotlight */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 text-white shadow-md my-2">
              <span className="text-4xl block mb-1">{winner?.emoji || '🎯'}</span>
              <p className="text-lg font-black uppercase tracking-tight line-clamp-1">
                {winner?.text}
              </p>
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-90">
                O destino decidiu
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1 mt-3">
              {decision.options.map((o) => (
                <span
                  key={o.id}
                  className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-300 font-medium"
                >
                  {o.emoji} {o.text}
                </span>
              ))}
            </div>

            <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-white/10">
              Você escolhe as opções. A gente decide.
            </p>
          </div>

          <button
            onClick={handleDownloadCard}
            disabled={isDownloading}
            className="w-full mt-2.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Gerando imagem...' : 'Salvar Card como Imagem'}</span>
          </button>
        </div>

        {/* Share buttons */}
        <div className="space-y-2 mt-4 pt-3 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Enviar para amigos:
          </p>

          <button
            onClick={handleWhatsApp}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <span>WhatsApp</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleTelegram}
              className="py-2.5 px-3 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <span>Telegram</span>
            </button>

            <button
              onClick={handleCopyText}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
