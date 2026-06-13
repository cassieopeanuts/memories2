import React, { useState, useEffect } from 'react';
import { ShieldCheck, HelpCircle } from 'lucide-react';

export default function BetaLock({ onSuccess }) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setErrorMsg('');
  }, [pin]);

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  // Check pin when it reaches 4 digits
  useEffect(() => {
    if (pin.length === 4) {
      const timer = setTimeout(() => {
        if (pin === '6969') {
          localStorage.setItem('beta_unlocked', 'true');
          onSuccess();
        } else {
          setErrorMsg('Неверный код доступа. Пожалуйста, попробуйте еще раз.');
          setPin('');
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pin, onSuccess]);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-brand-50 to-brand-100 flex flex-col justify-between p-6 select-none animate-photo-entry">
      
      {/* Top Header info */}
      <div className="text-center mt-12">
        <div className="w-16 h-16 rounded-3xl bg-brand-200/50 text-brand-600 flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
          <ShieldCheck className="w-8 h-8 text-brand-500 fill-brand-500/10" />
        </div>
        
        <h2 className="font-serif text-2xl md:text-3xl text-brand-900 font-bold mb-3">
          Доступ к тестированию
        </h2>
        
        <p className="text-xs md:text-sm text-brand-600 font-light max-w-xs mx-auto leading-relaxed">
          Этот веб-сайт находится на этапе приватного бета-тестирования. Пожалуйста, введите код доступа для входа.
        </p>

        {/* Pin Dot Indicators */}
        <div className="flex gap-4 my-8 justify-center">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 border-brand-300 transition-all duration-150 ${
                pin.length > idx ? 'bg-brand-500 scale-110 border-brand-500' : 'bg-transparent'
              }`}
            ></div>
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs font-semibold text-red-500 mb-2 animate-bounce">{errorMsg}</p>
        )}
      </div>

      {/* Numeric Touchpad */}
      <div className="w-full max-w-xs mx-auto mb-12">
        <div className="grid grid-cols-3 gap-y-4 gap-x-6 justify-items-center">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="w-16 h-16 rounded-full border border-brand-200 bg-white/70 active:bg-brand-200/50 hover:bg-white text-brand-900 font-serif font-bold text-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              {num}
            </button>
          ))}
          
          <button
            onClick={handleClear}
            disabled={pin.length === 0}
            className="w-16 h-16 text-xs text-brand-500 font-semibold uppercase tracking-wider flex items-center justify-center cursor-pointer hover:text-brand-800 disabled:opacity-30 active:scale-95 transition-all"
          >
            Сброс
          </button>
          
          <button
            onClick={() => handleKeyPress(0)}
            className="w-16 h-16 rounded-full border border-brand-200 bg-white/70 active:bg-brand-200/50 hover:bg-white text-brand-900 font-serif font-bold text-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            0
          </button>
          
          <button
            onClick={handleBackspace}
            disabled={pin.length === 0}
            className="w-16 h-16 text-xs text-brand-500 font-semibold uppercase tracking-wider flex items-center justify-center cursor-pointer hover:text-brand-800 disabled:opacity-30 active:scale-95 transition-all"
          >
            Стереть
          </button>
        </div>
      </div>

      {/* Footer stamp */}
      <div className="text-center pb-4 text-[10px] text-brand-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
        <HelpCircle className="w-3.5 h-3.5" />
        <span>ЛегкоСохранить.РФ — Зона Тестирования</span>
      </div>
    </div>
  );
}
