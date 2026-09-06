import React, { useState } from 'react';
import { Delete, RotateCcw } from 'lucide-react';

interface CalculatorDecoyProps {
  onSecretUnlock?: () => void;
}

export const CalculatorDecoy: React.FC<CalculatorDecoyProps> = ({ onSecretUnlock }) => {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [historySequence, setHistorySequence] = useState<string>('');

  const inputDigit = (digit: string) => {
    const newSeq = (historySequence + digit).slice(-10);
    setHistorySequence(newSeq);

    // Secret master emergency unlock code: typing 7777 followed by '=' or directly in sequence
    if (newSeq.endsWith('7777')) {
      onSecretUnlock?.();
    }

    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clearAll = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const toggleSign = () => {
    const value = parseFloat(display);
    if (value !== 0) {
      setDisplay(String(-value));
    }
  };

  const inputPercent = () => {
    const value = parseFloat(display);
    setDisplay(String(value / 100));
  };

  const performOperation = (nextOp: string) => {
    const inputValue = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operation) {
      const current = prevValue || 0;
      let result = 0;
      switch (operation) {
        case '+':
          result = current + inputValue;
          break;
        case '-':
          result = current - inputValue;
          break;
        case '×':
          result = current * inputValue;
          break;
        case '÷':
          result = inputValue !== 0 ? current / inputValue : 0;
          break;
        default:
          result = inputValue;
      }
      setPrevValue(result);
      setDisplay(String(Number(result.toFixed(8))));
    }

    setWaitingForOperand(true);
    setOperation(nextOp === '=' ? null : nextOp);
  };

  return (
    <div className="min-h-screen bg-[#0E0E12] text-white flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-[#181820] border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Calculatrice Système</span>
          </div>
          <button
            onClick={clearAll}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Réinitialiser"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="bg-[#0A0A0E] rounded-2xl p-5 mb-6 text-right border border-white/5 shadow-inner">
          <div className="text-xs text-gray-500 h-4 mb-1">
            {prevValue !== null && operation ? `${prevValue} ${operation}` : ''}
          </div>
          <div className="text-4xl font-mono font-bold tracking-tight text-white truncate">
            {display}
          </div>
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-3">
          {/* Row 1 */}
          <button
            onClick={clearAll}
            className="h-14 rounded-2xl bg-rose-500/20 text-rose-300 font-bold hover:bg-rose-500/30 active:scale-95 transition-all text-sm"
          >
            AC
          </button>
          <button
            onClick={toggleSign}
            className="h-14 rounded-2xl bg-white/5 text-gray-300 font-bold hover:bg-white/10 active:scale-95 transition-all text-sm"
          >
            ±
          </button>
          <button
            onClick={inputPercent}
            className="h-14 rounded-2xl bg-white/5 text-gray-300 font-bold hover:bg-white/10 active:scale-95 transition-all text-sm"
          >
            %
          </button>
          <button
            onClick={() => performOperation('÷')}
            className={`h-14 rounded-2xl font-bold active:scale-95 transition-all text-lg ${
              operation === '÷' ? 'bg-amber-500 text-black' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            onClick={() => inputDigit('7')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            7
          </button>
          <button
            onClick={() => inputDigit('8')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            8
          </button>
          <button
            onClick={() => inputDigit('9')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            9
          </button>
          <button
            onClick={() => performOperation('×')}
            className={`h-14 rounded-2xl font-bold active:scale-95 transition-all text-lg ${
              operation === '×' ? 'bg-amber-500 text-black' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            onClick={() => inputDigit('4')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            4
          </button>
          <button
            onClick={() => inputDigit('5')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            5
          </button>
          <button
            onClick={() => inputDigit('6')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            6
          </button>
          <button
            onClick={() => performOperation('-')}
            className={`h-14 rounded-2xl font-bold active:scale-95 transition-all text-lg ${
              operation === '-' ? 'bg-amber-500 text-black' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            -
          </button>

          {/* Row 4 */}
          <button
            onClick={() => inputDigit('1')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            1
          </button>
          <button
            onClick={() => inputDigit('2')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            2
          </button>
          <button
            onClick={() => inputDigit('3')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            3
          </button>
          <button
            onClick={() => performOperation('+')}
            className={`h-14 rounded-2xl font-bold active:scale-95 transition-all text-lg ${
              operation === '+' ? 'bg-amber-500 text-black' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
            }`}
          >
            +
          </button>

          {/* Row 5 */}
          <button
            onClick={() => inputDigit('0')}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium col-span-2 text-left px-6"
          >
            0
          </button>
          <button
            onClick={inputDot}
            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xl font-medium"
          >
            .
          </button>
          <button
            onClick={() => performOperation('=')}
            className="h-14 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold active:scale-95 transition-all text-xl shadow-lg shadow-purple-600/30"
          >
            =
          </button>
        </div>

        {/* Subtle Decoy Footer */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-gray-500 tracking-wide">
            Module Arithmétique Standard v1.0
          </p>
        </div>
      </div>
    </div>
  );
};
