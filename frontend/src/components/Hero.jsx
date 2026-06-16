import React, { useState } from 'react';
import { ShieldCheck, Heart, Sparkles, Mail, ChevronDown, ChevronUp } from 'lucide-react';

// Brand SVG Icons
const YandexIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" fill="#FC3F1D" />
    <path d="M13.8 16V8.5H12.2C11.1 8.5 10.4 9.1 10.4 10C10.4 10.9 10.9 11.4 11.8 11.6L9.8 16H11.4L13 12.3V16H13.8ZM12.2 9.4C12.6 9.4 12.9 9.6 12.9 10C12.9 10.4 12.6 10.7 12.2 10.7H11.8C11.5 10.7 11.3 10.5 11.3 10C11.3 9.6 11.5 9.4 11.8 9.4H12.2Z" fill="white" />
  </svg>
);

const SberIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" fill="url(#sberGrad)" />
    <path d="M8.5 12.5L11 15L16 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="sberGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#21A038" />
        <stop offset="1" stopColor="#128024" />
      </linearGradient>
    </defs>
  </svg>
);

const TBankIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 5V11C4 16.5 8 21 12 22C16 21 20 16.5 20 11V5L12 2Z" fill="#FFDD2D" />
    <path d="M7 8H17V10H13V17H11V10H7V8Z" fill="black" />
  </svg>
);

export default function Hero({ onDemoLogin, onEmailLoginSuccess, onViewOffer }) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

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
        throw new Error(data.error || 'Ошибка входа по почте');
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

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-12 md:py-20 bg-brand-50 selection:bg-brand-200">
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
          <div className="w-full flex gap-3 mb-4">
            {/* Yandex ID */}
            <button
              onClick={handleYandexLogin}
              className="flex-1 h-12 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
              title="Войти с Яндекс ID"
            >
              <YandexIcon />
              <span className="text-sm font-semibold text-[#232334]">ID</span>
            </button>

            {/* Sber ID */}
            <button
              onClick={handleSberLogin}
              className="flex-1 h-12 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
              title="Войти через Сбер ID"
            >
              <SberIcon />
              <span className="text-sm font-semibold text-[#232334]">ID</span>
            </button>

            {/* T-Bank ID */}
            <button
              onClick={handleTBankLogin}
              className="flex-1 h-12 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
              title="Войти с Т-Банк ID"
            >
              <TBankIcon />
              <span className="text-sm font-semibold text-[#232334]">ID</span>
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
            <form 
              onSubmit={handleEmailSubmit}
              className="w-full p-5 rounded-2xl bg-white border border-brand-200/50 shadow-sm text-left animate-photo-entry"
            >
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
