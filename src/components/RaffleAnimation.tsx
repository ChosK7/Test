import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Decision, DecisionOption } from '../types';

interface RaffleAnimationProps {
  decision: Decision;
  onFinished: (winnerOption: DecisionOption) => void;
}

export const RaffleAnimation: React.FC<RaffleAnimationProps> = ({ decision, onFinished }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSlowingDown, setIsSlowingDown] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Pick winner once beforehand so it decelerates smoothly to the true outcome
  const winnerOptionRef = useRef<DecisionOption>(
    decision.options[Math.floor(Math.random() * decision.options.length)]
  );

  useEffect(() => {
    let timeoutId: any;
    let stepCount = 0;
    const totalSteps = 24; // about 2.5 seconds total
    let currentDelay = 60; // start fast (60ms)

    const runStep = () => {
      stepCount++;

      // Pulse visual effect
      setPulse(true);
      setTimeout(() => setPulse(false), 40);

      // In the final 5 steps, steer the carousel index to land right on the winner!
      if (stepCount >= totalSteps) {
        // Find winner index
        const winnerIdx = decision.options.findIndex((o) => o.id === winnerOptionRef.current.id);
        setCurrentIndex(winnerIdx >= 0 ? winnerIdx : 0);

        // Burst confetti
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF4343', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'],
        });

        setTimeout(() => {
          onFinished(winnerOptionRef.current);
        }, 500);
        return;
      }

      // Next random or cycling option
      setCurrentIndex((prev) => (prev + 1) % decision.options.length);

      // Decelerate progressively
      if (stepCount > 12) {
        setIsSlowingDown(true);
        currentDelay += 35; // slow down progressively
      } else if (stepCount > 18) {
        currentDelay += 70;
      }

      timeoutId = setTimeout(runStep, currentDelay);
    };

    timeoutId = setTimeout(runStep, currentDelay);

    return () => clearTimeout(timeoutId);
  }, [decision.options, onFinished]);

  const currentOption = decision.options[currentIndex] || decision.options[0];

  const handleSkip = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
    onFinished(winnerOptionRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {/* Suspense Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs uppercase tracking-widest animate-pulse">
            <span>🎲</span> Sorteando agora...
          </div>
          <h2 className="text-xl font-extrabold text-white mt-2 max-w-xs mx-auto line-clamp-2">
            {decision.question}
          </h2>
        </div>

        {/* Rolling Card / Roulette Box */}
        <div className="relative my-4">
          <div className="absolute -inset-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 rounded-3xl blur-md opacity-75 animate-pulse" />
          <div
            className={`relative bg-slate-900 border-2 border-rose-500/80 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[220px] transition-transform duration-75 shadow-2xl ${
              pulse ? 'scale-103' : 'scale-100'
            }`}
          >
            <div className="text-6xl mb-3 select-none animate-bounce">
              {currentOption.emoji || '🎲'}
            </div>
            <p className="text-2xl font-black text-white tracking-tight uppercase px-2 text-center">
              {currentOption.text}
            </p>

            <div className="mt-4 flex items-center gap-1.5">
              {decision.options.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-100 ${
                    idx === currentIndex
                      ? 'w-6 bg-rose-500'
                      : 'w-1.5 bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-slate-400 text-xs font-medium mt-3">
          {isSlowingDown ? 'Desacelerando... Quem será o escolhido?' : 'Misturando as opções...'}
        </p>

        {/* Skip button for ultra-fast UX */}
        <button
          onClick={handleSkip}
          className="mt-6 text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
        >
          ⚡ Pular animação
        </button>
      </div>
    </div>
  );
};
