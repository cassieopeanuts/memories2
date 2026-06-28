import React, { useState, useEffect } from 'react';
import { Shield, EyeOff, Check, X, LogOut } from 'lucide-react';

export default function PinLock({ token, mode, onSuccess, onLogout, backendUrl }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1); // 1 = enter pin, 2 = confirm pin (only for setup mode)
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Clear errors when pin changes
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

  // Trigger action when pin reaches 4 digits
  useEffect(() => {
    if (pin.length === 4) {
      // Small timeout for visual dot-filling feedback before checking
      const timer = setTimeout(() => {
        if (mode === 'setup') {
          handleSetupFlow();
        } else {
          handleVerifyFlow();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pin]);

  const handleSetupFlow = async () => {
    if (step === 1) {
      // Save temporary pin and go to confirm
      setConfirmPin(pin);
      setPin('');
      setStep(2);
    } else {
      // Verify match
      if (pin === confirmPin) {
        setIsLoading(true);
        try {
          const response = await fetch(`${backendUrl}/api/auth/set-pin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ pinCode: pin })
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Не удалось сохранить пин-код');
          }
          onSuccess();
        } catch (err) {
          setErrorMsg(err.message);
          // Reset setup flow
          setPin('');
          setConfirmPin('');
          setStep(1);
        } finally {
          setIsLoading(false);
        }
      } else {
        setErrorMsg('Пин-коды не совпадают. Попробуйте еще раз.');
        setPin('');
        setConfirmPin('');
        setStep(1);
      }
    }
  };

  const handleVerifyFlow = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/auth/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pinCode: pin })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Неверный пин-код');
      }
      onSuccess();
    } catch (err) {
      setErrorMsg(err.message);
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-brand-50 to-brand-100 flex flex-col justify-between p-6 select-none animate-photo-entry touch-none">
      
      {/* Top Header info */}
      <div className="text-center mt-10">
        <div className="w-14 h-14 rounded-2xl bg-brand-200/50 text-brand-600 flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Shield className="w-6 h-6 text-brand-500 fill-brand-500/10" />
        </div>
        
        <h2 className="font-serif text-xl md:text-2xl text-brand-900 font-semibold mb-2">
          {mode === 'setup' 
            ? (step === 1 ? 'Защитите свои фото' : 'Повторите пин-код')
            : 'Вход в хранилище'
          }
        </h2>
        
        <p className="text-xs text-brand-600 font-light max-w-xs mx-auto leading-relaxed">
          {mode === 'setup'
            ? (step === 1 
                ? 'Придумайте 4-значный пин-код, чтобы ограничить доступ посторонних к вашим воспоминаниям.' 
                : 'Введите придуманный пин-код еще раз для подтверждения.'
              )
            : 'Введите пин-код для авторизации.'
          }
        </p>

        {/* Passthrough Dot Indicators */}
        <div className="flex gap-4 my-8 justify-center">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border-2 border-brand-300 transition-all duration-150 ${
                pin.length > idx ? 'bg-brand-500 scale-110 border-brand-500' : 'bg-transparent'
              }`}
            ></div>
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs font-semibold text-red-500 mb-2">{errorMsg}</p>
        )}
      </div>

      {/* Numeric Touchpad */}
      <div className="w-full max-w-xs mx-auto mb-8">
        <div className="grid grid-cols-3 gap-y-4 gap-x-6 justify-items-center">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              onTouchStart={() => {}}
              disabled={isLoading}
              className="w-16 h-16 rounded-full border border-brand-200 bg-white/70 active:bg-brand-200/50 hover:bg-white text-brand-900 font-serif font-bold text-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-sm disabled:opacity-50 touch-none"
            >
              {num}
            </button>
          ))}
          
          <button
            onClick={handleClear}
            onTouchStart={() => {}}
            disabled={isLoading || pin.length === 0}
            className="w-16 h-16 text-xs text-brand-500 font-semibold uppercase tracking-wider flex items-center justify-center cursor-pointer hover:text-brand-800 disabled:opacity-30 active:scale-95 transition-all touch-none"
          >
            Сброс
          </button>
          
          <button
            onClick={() => handleKeyPress(0)}
            onTouchStart={() => {}}
            disabled={isLoading}
            className="w-16 h-16 rounded-full border border-brand-200 bg-white/70 active:bg-brand-200/50 hover:bg-white text-brand-900 font-serif font-bold text-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-sm disabled:opacity-50 touch-none"
          >
            0
          </button>
          
          <button
            onClick={handleBackspace}
            onTouchStart={() => {}}
            disabled={isLoading || pin.length === 0}
            className="w-16 h-16 text-xs text-brand-500 font-semibold uppercase tracking-wider flex items-center justify-center cursor-pointer hover:text-brand-800 disabled:opacity-30 active:scale-95 transition-all touch-none"
          >
            Стереть
          </button>
        </div>

        {/* Change account option */}
        <button
          onClick={onLogout}
          onTouchStart={() => {}}
          className="mt-8 mx-auto flex items-center gap-1 text-[11px] font-bold text-brand-500 hover:text-brand-800 uppercase tracking-widest cursor-pointer active:scale-95 transition-colors touch-none"
        >
          <LogOut className="w-3.5 h-3.5" />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
