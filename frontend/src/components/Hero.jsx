import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Heart, Sparkles, Mail, ChevronDown, ChevronUp } from 'lucide-react';

import yandexLogo from '../assets/yandex.svg';
import sberLogo from '../assets/sber.svg';
import tbankLogo from '../assets/tbank.svg';

// Brand SVG Icons using official SVGs
const YandexIcon = () => (
  <img src={yandexLogo} className="h-5.5 w-auto object-contain shrink-0" alt="Yandex" />
);

const SberIcon = () => (
  <img src={sberLogo} className="h-5 w-auto object-contain shrink-0" alt="Sber" />
);

const TBankIcon = () => (
  <img src={tbankLogo} className="h-5.5 w-auto object-contain shrink-0" alt="T-Bank" />
);

export default function Hero({ onDemoLogin, onEmailLoginSuccess, onViewOffer }) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);
  const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  const handleYandexLogin = () => {
    window.location.href = `${backendUrl}/api/auth/yandex?origin=${encodeURIComponent(window.location.origin)}`;
  };

  const handleSberLogin = () => {
    window.location.href = `${backendUrl}/api/auth/sber?origin=${encodeURIComponent(window.location.origin)}`;
  };

  const handleTBankLogin = () => {
    window.location.href = `${backendUrl}/api/auth/tbank?origin=${encodeURIComponent(window.location.origin)}`;
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Пожалуйста, введите e-mail.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${backendUrl}/api/auth/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, name })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отправки кода');
      }
      setShowCodeForm(true);
      setCountdown(60); // 60 seconds cooldown
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setErrorMsg('Пожалуйста, введите 6-значный код подтверждения.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${backendUrl}/api/auth/email/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, code })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка проверки кода');
      }
      // Pass authentication details up to App.jsx
      onEmailLoginSuccess(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${backendUrl}/api/auth/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, name })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отправки кода');
      }
      setCountdown(60);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-12 md:py-20 selection:bg-brand-200">
      {/* Header / Brand Logo */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" className="w-10 h-10 object-contain" alt="Логотип" />
          <span className="font-serif font-bold text-2xl md:text-3xl tracking-tight text-brand-900">
            ЛегкоСохранить.РФ
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-brand-500 uppercase tracking-widest bg-brand-100/50 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          Сервера в РФ • ФЗ-152
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="max-w-xl mx-auto w-full my-auto flex flex-col items-center text-center py-6">
        {/* Soft Badge */}
        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-100 text-brand-800 text-sm font-medium mb-8 animate-pulse">
          <Sparkles className="w-4 h-4 text-brand-500" />
          Легкий способ хранить дорогие сердцу фото
        </div>

        {/* Title */}
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-brand-900 leading-tight font-medium mb-6">
          Память на телефоне <br className="hidden sm:inline"/>
          <span className="italic font-normal text-brand-500">больше не закончится</span>
        </h1>

        {/* Reassuring Subtitle */}
        <p className="text-base md:text-lg text-brand-900 font-light leading-relaxed mb-10 max-w-lg">
          Простое хранилище для ваших воспоминаний. Сохраняйте то, что дорого, легко.
        </p>

        {/* SSO Buttons & Email */}
        <div className="w-full flex flex-col items-center mb-12 max-w-sm">
          <span className="text-xs font-bold text-brand-900 uppercase tracking-widest mb-4">Войти с помощью</span>
          <div className="w-full flex flex-col gap-3.5 mb-4">
            {/* Yandex ID */}
            <button
              onClick={handleYandexLogin}
              className="w-full h-14 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
              title="Войти с Яндекс ID"
            >
              <YandexIcon />
              <span className="text-base font-bold text-[#232334]">ID</span>
            </button>

            {/* Sber ID */}
            <button
              onClick={handleSberLogin}
              className="w-full h-14 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
              title="Войти через Сбер ID"
            >
              <SberIcon />
              <span className="text-base font-bold text-[#232334]">ID</span>
            </button>

            {/* T-Bank ID */}
            <button
              onClick={handleTBankLogin}
              className="w-full h-14 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
              title="Войти с Т-Банк ID"
            >
              <TBankIcon />
              <span className="text-base font-bold text-[#232334]">ID</span>
            </button>
          </div>

          {/* Email collapsible trigger */}
          <button
            onClick={() => {
              setShowEmailForm(!showEmailForm);
              setErrorMsg('');
            }}
            className="w-full py-3 text-brand-600 hover:text-brand-900 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
          >
            <Mail className="w-4 h-4" />
            Или войти по почте
            {showEmailForm ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Email form container */}
          {showEmailForm && (
            <div className="w-full p-5 rounded-2xl bg-white border border-brand-200/50 shadow-sm text-left animate-photo-entry">
              {!showCodeForm ? (
                <form onSubmit={handleEmailSubmit}>
                  <h4 className="text-xs font-bold text-brand-900 uppercase tracking-wider mb-3">Вход по почте</h4>
                  <div className="space-y-3">
                    <div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Ваш e-mail (например, anna@mail.ru)"
                        required
                        className="w-full px-4 py-3 bg-brand-50 border border-brand-200/60 rounded-2xl text-xs text-brand-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ваше имя (для новых пользователей)"
                        className="w-full px-4 py-3 bg-brand-50 border border-brand-200/60 rounded-2xl text-xs text-brand-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium"
                      />
                    </div>
                    {errorMsg && (
                      <p className="text-[11px] font-semibold text-red-500">{errorMsg}</p>
                    )}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white rounded-2xl text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-98"
                    >
                      {isLoading ? 'Проверяем почту...' : 'Получить доступ к альбому'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCodeSubmit}>
                  <h4 className="text-xs font-bold text-brand-900 uppercase tracking-wider mb-1">Подтверждение входа</h4>
                  <p className="text-[11px] text-brand-600 mb-4 font-medium">
                    Код отправлен на <span className="text-brand-900 font-semibold">{email}</span>
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="0 0 0 0 0 0"
                        required
                        maxLength={6}
                        pattern="\d{6}"
                        className="w-full px-4 py-3 text-center tracking-[12px] font-mono text-2xl bg-brand-50 border border-brand-200/60 rounded-2xl text-brand-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-bold"
                      />
                    </div>
                    
                    {errorMsg && (
                      <p className="text-[11px] font-semibold text-red-500 text-center">{errorMsg}</p>
                    )}
                    
                    <button
                      type="submit"
                      disabled={isLoading || code.length !== 6}
                      className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white rounded-2xl text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-98"
                    >
                      {isLoading ? 'Проверяем код...' : 'Подтвердить и войти'}
                    </button>

                    <div className="flex flex-col gap-2.5 pt-1 text-center">
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={isLoading || countdown > 0}
                        className="text-brand-600 hover:text-brand-900 disabled:text-brand-400 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        {countdown > 0 ? `Отправить повторно через ${countdown}с` : 'Отправить код повторно'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCodeForm(false);
                          setCode('');
                          setErrorMsg('');
                        }}
                        className="text-neutral-500 hover:text-neutral-800 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Изменить e-mail
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Dev Mode Demo login */}
        <div className="w-full max-w-sm p-5 rounded-2xl bg-brand-100/40 border border-brand-200/50">
          <p className="text-xs text-brand-600 font-medium mb-3 uppercase tracking-wider">
            Режим разработки (Вход без ключей)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onDemoLogin('yandex')}
              className="py-2.5 px-2 bg-brand-200/50 hover:bg-brand-200 text-brand-800 rounded-xl text-[10px] font-semibold transition-all duration-200 cursor-pointer"
            >
              Яндекс 👩‍🦰
            </button>
            <button
              onClick={() => onDemoLogin('sber')}
              className="py-2.5 px-2 bg-brand-200/50 hover:bg-brand-200 text-brand-800 rounded-xl text-[10px] font-semibold transition-all duration-200 cursor-pointer"
            >
              Сбер 👩
            </button>
            <button
              onClick={() => onDemoLogin('tbank')}
              className="py-2.5 px-2 bg-brand-200/50 hover:bg-brand-200 text-brand-800 rounded-xl text-[10px] font-semibold transition-all duration-200 cursor-pointer"
            >
              Т-Банк 🧔
            </button>
          </div>
        </div>

        {/* Public Offer Link */}
        <div className="mt-8 text-center text-[11px] text-brand-400 font-light max-w-xs leading-relaxed">
          Авторизуясь на сайте, вы принимаете условия{' '}
          <a
            href="/offer"
            onClick={(e) => {
              e.preventDefault();
              onViewOffer();
            }}
            className="text-brand-500 hover:text-brand-700 underline font-medium cursor-pointer"
          >
            Публичной оферты
          </a>{' '}
          и даете согласие на обработку персональных данных.
        </div>
      </main>

      {/* Footer Benefits */}
      <footer className="max-w-4xl mx-auto w-full grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-brand-200/40 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-brand-900">Ваша конфиденциальность</h4>
            <p className="text-[11px] text-brand-600">Фото доступны только вам на серверах в РФ</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-brand-900">Забота в деталях</h4>
            <p className="text-[11px] text-brand-600">Никакой рекламы, сложных кнопок и настроек</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-brand-900">1 ГБ навсегда бесплатно</h4>
            <p className="text-[11px] text-brand-600">Начните сохранять фото без оплаты</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
