import React, { useState, useEffect, useRef, useCallback } from 'react';
import { evaluateHeadlineChallenge } from '../services/geminiService';
import { Clock, Zap, Trophy, AlertTriangle, Play } from 'lucide-react';

const CHALLENGES = [
  {
    id: 1,
    topic: 'Terremoto en Japón',
    keywords: 'Terremoto, Japón, Alerta Tsunami, Magnitud 7.5',
  },
  {
    id: 2,
    topic: 'Resultados Electorales',
    keywords: 'Elecciones 2024, Ganador, Resultados en Vivo, Presidente',
  },
  {
    id: 3,
    topic: 'Lanzamiento Producto Tech',
    keywords: 'iPhone 16, Evento Apple, Precio, Fecha Lanzamiento',
  },
];

const SpeedChallenge: React.FC = () => {
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'scoring' | 'result'>('intro');
  const [currentChallenge, setCurrentChallenge] = useState(CHALLENGES[0]);
  const [headline, setHeadline] = useState('');
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [result, setResult] = useState<string>('');
  const timerRef = useRef<number | null>(null);

  const handleSubmit = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('scoring');
    const evaluation = await evaluateHeadlineChallenge(headline, currentChallenge.keywords);
    setResult(evaluation);
    setGameState('result');
  }, [currentChallenge.keywords, headline]);

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            void handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, handleSubmit]);

  const startGame = (challengeId: number) => {
    setCurrentChallenge(CHALLENGES.find((c) => c.id === challengeId) || CHALLENGES[0]);
    setHeadline('');
    setTimeLeft(120);
    setGameState('playing');
  };


  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 text-slate-900 dark:text-slate-100">
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-3">
            <Zap size={40} className="text-yellow-300" /> Simulador de Última Hora
          </h1>
          <p className="mt-2 text-red-100 font-medium text-lg">
            ¿Puedes optimizar un titular antes que la competencia?
          </p>
        </div>
      </div>

      {gameState === 'intro' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CHALLENGES.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-slate-800 p-6 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-red-500 cursor-pointer transition-all group"
              onClick={() => startGame(c.id)}
            >
              <div className="text-xs font-bold text-red-500 uppercase mb-2">Escenario {c.id}</div>
              <h3 className="font-bold text-xl mb-4 group-hover:text-red-600">{c.topic}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Clock size={16} /> 2:00 Minutos
              </div>
            </div>
          ))}
        </div>
      )}

      {gameState === 'playing' && (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-8">
            <div>
              <span className="text-xs font-bold text-red-500 uppercase tracking-widest animate-pulse">
                Escenario en Vivo
              </span>
              <h2 className="text-3xl font-bold mt-1">{currentChallenge.topic}</h2>
            </div>
            <div className="text-4xl font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-lg">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
              Debe incluir Keywords:
            </h4>
            <p className="font-mono text-sm text-blue-700 dark:text-blue-200">
              {currentChallenge.keywords}
            </p>
          </div>

          <label className="block font-bold mb-2">
            Escribe tu Titular H1 (Máx 70 caracteres recomendado)
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="w-full text-2xl font-bold p-4 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-red-500 outline-none dark:bg-slate-900"
            placeholder="Escribe titular aquí..."
            autoFocus
          />
          <div className="flex justify-between mt-2 text-sm text-slate-400">
            <span>{headline.length} caracteres</span>
            <span>Objetivo: 60-70</span>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full mt-8 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl text-xl transition-colors shadow-lg shadow-red-500/30"
          >
            PUBLICAR AHORA
          </button>
        </div>
      )}

      {gameState === 'scoring' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mb-4"></div>
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">
            Google está indexando...
          </h2>
        </div>
      )}

      {gameState === 'result' && (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="text-center mb-8">
            <Trophy size={64} className="mx-auto text-yellow-400 mb-4" />
            <h2 className="text-3xl font-bold">Análisis Completo</h2>
          </div>

          <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-xl font-mono text-sm whitespace-pre-wrap leading-relaxed">
            {result}
          </div>

          <button
            onClick={() => setGameState('intro')}
            className="w-full mt-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Probar Otro Escenario
          </button>
        </div>
      )}
    </div>
  );
};

export default SpeedChallenge;
