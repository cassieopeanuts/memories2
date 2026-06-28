import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, Heart, Sparkles, Mail, ChevronDown, ChevronUp, X, Trash2, Lock, Share2, HelpCircle, Check } from 'lucide-react';
import Script from 'next/script';

// Brand SVG Icons using official SVGs
const YandexIcon = () => (
  <img src="/yandex.svg" className="h-5 w-auto object-contain shrink-0" alt="Yandex" />
);

const SberIcon = () => (
  <img src="/sber.svg" className="h-5 w-auto object-contain shrink-0" alt="Sber" />
);

const TBankIcon = () => (
  <img src="/tbank.svg" className="h-5 w-auto object-contain shrink-0" alt="T-Bank" />
);

const VKIcon = () => (
  <img src="/vk.svg" className="h-5 w-auto object-contain shrink-0" alt="VK" />
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
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const timerRef = useRef(null);
  const backendUrl = typeof window !== 'undefined' ? (import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`) : 'http://localhost:5000';

  const [yandexAccounts, setYandexAccounts] = useState([]);
  const [showYandexAccountsModal, setShowYandexAccountsModal] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('yandex_accounts');
      if (saved) {
        setYandexAccounts(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading Yandex accounts from localStorage:', e);
    }
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  const handleYandexLogin = () => {
    if (yandexAccounts && yandexAccounts.length > 0) {
      setShowYandexAccountsModal(true);
    } else {
      redirectToYandexOAuth();
    }
  };

  const redirectToYandexOAuth = () => {
    window.location.href = `${backendUrl}/api/auth/yandex?origin=${encodeURIComponent(window.location.origin)}`;
  };

  const handleSelectYandexAccount = (account) => {
    setShowYandexAccountsModal(false);
    onEmailLoginSuccess({
      token: account.token,
      user: {
        id: account.id,
        name: account.name,
        email: account.email
      }
    });
  };

  const handleDeleteYandexAccount = (e, indexToDelete) => {
    e.stopPropagation(); // Prevent triggering selection login
    const updated = yandexAccounts.filter((_, idx) => idx !== indexToDelete);
    setYandexAccounts(updated);
    try {
      localStorage.setItem('yandex_accounts', JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving updated Yandex accounts list:', err);
    }
  };

  const handleSberLogin = () => {
    window.location.href = `${backendUrl}/api/auth/sber?origin=${encodeURIComponent(window.location.origin)}`;
  };

  const handleTBankLogin = () => {
    window.location.href = `${backendUrl}/api/auth/tbank?origin=${encodeURIComponent(window.location.origin)}`;
  };

  const handleVkLogin = () => {
    window.location.href = `${backendUrl}/api/auth/vk?origin=${encodeURIComponent(window.location.origin)}`;
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
      const normalizedEmail = email.toLowerCase().trim();

      // Step 1: If email is not checked yet, check registration status
      if (!isEmailChecked) {
        const checkRes = await fetch(`${backendUrl}/api/auth/check-email?email=${encodeURIComponent(normalizedEmail)}`);
        const checkData = await checkRes.json();
        if (!checkRes.ok) {
          throw new Error(checkData.error || 'Ошибка проверки почты');
        }

        if (checkData.exists) {
          // User exists! Immediately request code (no name needed)
          const sendRes = await fetch(`${backendUrl}/api/auth/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail })
          });
          const sendData = await sendRes.json();
          if (!sendRes.ok) {
            throw new Error(sendData.error || 'Ошибка отправки кода');
          }

          setIsEmailChecked(true);
          setShowCodeForm(true);
          setCountdown(60);
        } else {
          // User does not exist. Prompt for name first
          setIsEmailChecked(true);
          setIsNewUser(true);
        }
      } else {
        // Step 2: For new user, they have entered their name. Send request with email and name
        const sendRes = await fetch(`${backendUrl}/api/auth/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, name })
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) {
          throw new Error(sendData.error || 'Ошибка отправки кода');
        }

        setShowCodeForm(true);
        setCountdown(60);
      }
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
    <div className="min-h-screen selection:bg-brand-200 flex flex-col">
      {/* Hero Top Screen */}
      <div className="min-h-screen flex flex-col justify-between px-6 py-12 md:py-20 max-w-4xl mx-auto w-full">
        {/* Header / Brand Logo */}
        <header className="w-full flex items-center justify-between">
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

            {/* VK ID */}
            <button
              onClick={handleVkLogin}
              className="w-full h-14 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
              title="Войти через ВКонтакте ID"
            >
              <VKIcon />
              <div className="flex items-center gap-1.5">
                <span className="text-base font-medium text-[#232334]">ВКонтакте</span>
                <span className="text-base font-bold text-[#232334]">ID</span>
              </div>
            </button>
          </div>

          {/* Email collapsible trigger */}
          <button
            onClick={() => {
              setShowEmailForm(!showEmailForm);
              setErrorMsg('');
              setIsEmailChecked(false);
              setIsNewUser(false);
              setName('');
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
                        disabled={isEmailChecked}
                        className="w-full px-4 py-3 bg-brand-50 border border-brand-200/60 rounded-2xl text-base text-brand-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium disabled:opacity-70"
                      />
                    </div>
                    {isEmailChecked && isNewUser && (
                      <div className="animate-photo-entry">
                        <p className="text-[10px] text-brand-600 font-semibold mb-1.5 uppercase tracking-wide">
                          Похоже, вы у нас впервые. Укажите ваше имя:
                        </p>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ваше имя"
                          required
                          className="w-full px-4 py-3 bg-brand-50 border border-brand-200/60 rounded-2xl text-base text-brand-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium"
                        />
                      </div>
                    )}
                    {errorMsg && (
                      <p className="text-[11px] font-semibold text-red-500">{errorMsg}</p>
                    )}
                    <div className="flex gap-2">
                      {isEmailChecked && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEmailChecked(false);
                            setIsNewUser(false);
                            setName('');
                            setErrorMsg('');
                          }}
                          className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl text-xs font-semibold transition-all cursor-pointer"
                        >
                          Назад
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white rounded-2xl text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-98"
                      >
                        {isLoading 
                          ? 'Проверяем...' 
                          : (!isEmailChecked ? 'Далее' : 'Получить код')}
                      </button>
                    </div>
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
                        placeholder="000000"
                        required
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
                          setIsEmailChecked(false);
                          setIsNewUser(false);
                          setName('');
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
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => onDemoLogin('yandex')}
              className="py-2.5 px-1 bg-brand-200/50 hover:bg-brand-200 text-brand-800 rounded-xl text-[10px] font-semibold transition-all duration-200 cursor-pointer"
            >
              Яндекс 👩‍🦰
            </button>
            <button
              onClick={() => onDemoLogin('sber')}
              className="py-2.5 px-1 bg-brand-200/50 hover:bg-brand-200 text-brand-800 rounded-xl text-[10px] font-semibold transition-all duration-200 cursor-pointer"
            >
              Сбер 👩
            </button>
            <button
              onClick={() => onDemoLogin('tbank')}
              className="py-2.5 px-1 bg-brand-200/50 hover:bg-brand-200 text-brand-800 rounded-xl text-[10px] font-semibold transition-all duration-200 cursor-pointer"
            >
              Т-Банк 🧔
            </button>
            <button
              onClick={() => onDemoLogin('vk')}
              className="py-2.5 px-1 bg-brand-200/50 hover:bg-brand-200 text-brand-800 rounded-xl text-[10px] font-semibold transition-all duration-200 cursor-pointer"
            >
              VK 👨
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

      {/* SEO-Optimized Landing Page Content */}
      <div className="max-w-4xl mx-auto w-full px-6 pb-24 space-y-28">
        
        {/* Showcase Section: Interactive CSS mockup */}
        <section id="showcase" className="w-full animate-photo-entry">
          <div className="text-center mb-10">
            <span className="text-xs font-bold text-brand-600 uppercase tracking-widest bg-brand-100/60 px-3 py-1 rounded-full">Интуитивный интерфейс</span>
            <h2 className="font-serif text-3xl md:text-4xl text-brand-900 mt-3 font-semibold">
              Как выглядит ваше личное облако
            </h2>
            <p className="text-sm text-brand-600 mt-2 max-w-lg mx-auto font-light">
              Мы убрали все лишнее, чтобы вы могли сосредоточиться на главном — ваших воспоминаниях.
            </p>
          </div>

          {/* Interactive CSS Mockup Frame */}
          <div className="bg-white/60 border border-brand-200/40 rounded-[32px] p-4 md:p-8 shadow-xl backdrop-blur-lg transition-all duration-500 hover:shadow-2xl">
            {/* Mockup Header */}
            <div className="flex items-center justify-between border-b border-brand-200/30 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-400"></span>
                  <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                  <span className="w-3 h-3 rounded-full bg-green-400"></span>
                </div>
                <span className="text-xs text-brand-500 font-mono hidden sm:inline">легкосохранить.рф/галерея</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-brand-100 text-brand-700 px-3 py-1 rounded-lg">1 ГБ свободен</span>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              </div>
            </div>

            {/* Mockup Gallery UI */}
            <div className="space-y-6">
              {/* Tab Simulator */}
              <div className="flex gap-2 border-b border-brand-200/20 pb-3">
                <button className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-500 text-white shadow-sm cursor-default">Все фотографии</button>
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg text-brand-600 hover:bg-brand-100/50 cursor-default">Альбомы</button>
                <button className="text-xs font-medium px-3 py-1.5 rounded-lg text-brand-600 hover:bg-brand-100/50 cursor-default">Избранное</button>
              </div>

              {/* Photo Grid Simulator */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Photo 1 */}
                <div className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-md cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-tr from-rose-300 to-pink-400 flex items-center justify-center">
                    <Heart className="w-10 h-10 text-white/40 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-left">
                    <p className="text-white text-xs font-medium truncate">Семейный пикник</p>
                    <p className="text-white/70 text-[9px]">Май 2026</p>
                  </div>
                </div>

                {/* Photo 2 */}
                <div className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-md cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-300 to-orange-400 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-white/40 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-left">
                    <p className="text-white text-xs font-medium truncate">Выпускной вечер</p>
                    <p className="text-white/70 text-[9px]">Июнь 2026</p>
                  </div>
                </div>

                {/* Photo 3 */}
                <div className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-md cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-300 to-teal-400 flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-white/40 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-left">
                    <p className="text-white text-xs font-medium truncate">Поездка в горы</p>
                    <p className="text-white/70 text-[9px]">Февраль 2026</p>
                  </div>
                </div>

                {/* Photo 4 */}
                <div className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-md cursor-pointer hidden md:block">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-300 to-purple-400 flex items-center justify-center">
                    <Lock className="w-10 h-10 text-white/40 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-left">
                    <p className="text-white text-xs font-medium truncate">Личный архив</p>
                    <p className="text-white/70 text-[9px]">Январь 2026</p>
                  </div>
                </div>

                {/* Photo 5 */}
                <div className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-md cursor-pointer hidden md:block">
                  <div className="absolute inset-0 bg-gradient-to-tr from-sky-300 to-blue-400 flex items-center justify-center">
                    <Share2 className="w-10 h-10 text-white/40 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-left">
                    <p className="text-white text-xs font-medium truncate">Совместный альбом</p>
                    <p className="text-white/70 text-[9px]">Март 2026</p>
                  </div>
                </div>

                {/* Photo 6 */}
                <div className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm border-2 border-dashed border-brand-200/50 flex flex-col items-center justify-center p-4 hover:border-brand-400 transition-colors cursor-pointer hidden md:flex">
                  <span className="text-xs font-bold text-brand-500 group-hover:text-brand-700 transition-colors">+ Загрузить</span>
                  <span className="text-[9px] text-brand-400 text-center mt-1">Перетащите файлы сюда</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Detailed Features Section */}
        <section id="features" className="w-full">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-brand-600 uppercase tracking-widest bg-brand-100/60 px-3 py-1 rounded-full">Преимущества сервиса</span>
            <h2 className="font-serif text-3xl md:text-4xl text-brand-900 mt-3 font-semibold">
              Почему выбирают ЛегкоСохранить.рф
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <article className="bg-white/40 border border-brand-200/30 rounded-3xl p-6 transition-all duration-300 hover:bg-white/60 hover:shadow-md">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 mb-5">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-brand-900 mb-2">Безопасность и ПИН-код</h3>
              <p className="text-xs text-brand-600 leading-relaxed font-light">
                Дополнительная защита вашей галереи. Даже если кто-то получит доступ к вашему телефону, ваши личные фотографии останутся под защитой уникального ПИН-кода.
              </p>
            </article>

            {/* Feature 2 */}
            <article className="bg-white/40 border border-brand-200/30 rounded-3xl p-6 transition-all duration-300 hover:bg-white/60 hover:shadow-md">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 mb-5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-brand-900 mb-2">Российские сервера (ФЗ-152)</h3>
              <p className="text-xs text-brand-600 leading-relaxed font-light">
                Все данные физически хранятся на территории РФ в сертифицированных дата-центрах. Полное соответствие закону о персональных данных и стабильный доступ без сбоев.
              </p>
            </article>

            {/* Feature 3 */}
            <article className="bg-white/40 border border-brand-200/30 rounded-3xl p-6 transition-all duration-300 hover:bg-white/60 hover:shadow-md">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 mb-5">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-brand-900 mb-2">Альбомы по ссылке в 1 клик</h3>
              <p className="text-xs text-brand-600 leading-relaxed font-light">
                Создавайте публичные или приватные веб-альбомы. Ваши друзья и родственники смогут мгновенно открыть их на любом устройстве без необходимости скачивать приложения и регистрироваться.
              </p>
            </article>
          </div>
        </section>

        {/* Competitor Comparison Section */}
        <section id="comparison" className="w-full">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-brand-600 uppercase tracking-widest bg-brand-100/60 px-3 py-1 rounded-full">Честное сравнение</span>
            <h2 className="font-serif text-3xl md:text-4xl text-brand-900 mt-3 font-semibold">
              Как мы выглядим на фоне аналогов
            </h2>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-brand-200/40 bg-white/30 backdrop-blur-md shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-brand-200/40 bg-brand-100/50">
                  <th className="p-4 text-xs font-bold text-brand-900 uppercase tracking-wider">Возможности</th>
                  <th className="p-4 text-xs font-bold text-brand-900 uppercase tracking-wider bg-brand-100/80">ЛегкоСохранить.рф</th>
                  <th className="p-4 text-xs font-bold text-brand-900 uppercase tracking-wider">Зарубежные облака</th>
                  <th className="p-4 text-xs font-bold text-brand-900 uppercase tracking-wider">Обычные диски</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200/20 text-xs text-brand-800">
                <tr>
                  <td className="p-4 font-medium text-brand-900">Навязчивая реклама</td>
                  <td className="p-4 bg-brand-50/50 text-emerald-600 font-semibold">
                    <span className="flex items-center gap-1"><Check className="w-4 h-4" /> Полностью нет</span>
                  </td>
                  <td className="p-4 text-brand-500">Часто есть на бесплатных</td>
                  <td className="p-4 text-brand-500">Много рекламных баннеров</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-brand-900">Защита папок ПИН-кодом</td>
                  <td className="p-4 bg-brand-50/50 text-emerald-600 font-semibold">
                    Да, на любом тарифе
                  </td>
                  <td className="p-4 text-brand-400">Только общий пароль от аккаунта</td>
                  <td className="p-4 text-brand-400">Нет защиты отдельных альбомов</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-brand-900">Скорость доступа в РФ</td>
                  <td className="p-4 bg-brand-50/50 text-emerald-600 font-semibold">
                    Максимальная (сервера в РФ)
                  </td>
                  <td className="p-4 text-brand-500">Возможны блокировки и замедления</td>
                  <td className="p-4 text-brand-500">Зависит от загрузки сервиса</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-brand-900">Простота интерфейса</td>
                  <td className="p-4 bg-brand-50/50 text-emerald-600 font-semibold">
                    Минимализм, без лишних кнопок
                  </td>
                  <td className="p-4 text-brand-400">Сложные кабинеты и настройки</td>
                  <td className="p-4 text-brand-400">Перегружены файловыми структурами</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Interactive FAQ Section with JSON-LD ready structure */}
        <section id="faq" className="w-full">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-brand-600 uppercase tracking-widest bg-brand-100/60 px-3 py-1 rounded-full">Часто задаваемые вопросы</span>
            <h2 className="font-serif text-3xl md:text-4xl text-brand-900 mt-3 font-semibold">
              Отвечаем на популярные вопросы
            </h2>
          </div>

          <div className="space-y-4 max-w-2xl mx-auto">
            {/* FAQ 1 */}
            <div className="bg-white/40 border border-brand-200/30 rounded-2xl overflow-hidden transition-all duration-300 hover:bg-white/50">
              <button 
                onClick={() => toggleFaq(0)}
                className="w-full flex items-center justify-between p-5 text-left font-semibold text-brand-900 text-xs md:text-sm cursor-pointer select-none"
              >
                <span>Каков размер бесплатного хранилища и как его увеличить?</span>
                {openFaqIndex === 0 ? <ChevronUp className="w-4 h-4 text-brand-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-brand-500 shrink-0" />}
              </button>
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${openFaqIndex === 0 ? 'max-h-40 opacity-100 border-t border-brand-200/10' : 'max-h-0 opacity-0'}`}
              >
                <div className="p-5 text-xs text-brand-600 leading-relaxed font-light">
                  Каждый зарегистрированный пользователь бесплатно получает 1 ГБ пространства навсегда. Этого достаточно для безопасного хранения сотен фотографий высокого разрешения. При необходимости вы можете расширить хранилище, выбрав один из выгодных тарифов в личном кабинете.
                </div>
              </div>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white/40 border border-brand-200/30 rounded-2xl overflow-hidden transition-all duration-300 hover:bg-white/50">
              <button 
                onClick={() => toggleFaq(1)}
                className="w-full flex items-center justify-between p-5 text-left font-semibold text-brand-900 text-xs md:text-sm cursor-pointer select-none"
              >
                <span>Насколько безопасно хранить фотографии на ЛегкоСохранить.рф?</span>
                {openFaqIndex === 1 ? <ChevronUp className="w-4 h-4 text-brand-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-brand-500 shrink-0" />}
              </button>
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${openFaqIndex === 1 ? 'max-h-40 opacity-100 border-t border-brand-200/10' : 'max-h-0 opacity-0'}`}
              >
                <div className="p-5 text-xs text-brand-600 leading-relaxed font-light">
                  Безопасность ваших воспоминаний — наш главный приоритет. Сервера физически находятся в сертифицированных дата-центрах на территории РФ (соответствие ФЗ-152 о персональных данных). Передача данных шифруется SSL-сертификатом, а защита ПИН-кодом исключает несанкционированный доступ, даже если кто-то взял ваш разблокированный телефон.
                </div>
              </div>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white/40 border border-brand-200/30 rounded-2xl overflow-hidden transition-all duration-300 hover:bg-white/50">
              <button 
                onClick={() => toggleFaq(2)}
                className="w-full flex items-center justify-between p-5 text-left font-semibold text-brand-900 text-xs md:text-sm cursor-pointer select-none"
              >
                <span>Как поделиться альбомом с родственниками или друзьями?</span>
                {openFaqIndex === 2 ? <ChevronUp className="w-4 h-4 text-brand-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-brand-500 shrink-0" />}
              </button>
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${openFaqIndex === 2 ? 'max-h-40 opacity-100 border-t border-brand-200/10' : 'max-h-0 opacity-0'}`}
              >
                <div className="p-5 text-xs text-brand-600 leading-relaxed font-light">
                  Создайте альбом в личном кабинете, выберите фотографии и нажмите кнопку «Поделиться». Система сгенерирует защищенную уникальную ссылку. Любой человек, имеющий эту ссылку, сможет просматривать и скачивать ваши фотографии на любом устройстве без регистрации на нашем сайте.
                </div>
              </div>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white/40 border border-brand-200/30 rounded-2xl overflow-hidden transition-all duration-300 hover:bg-white/50">
              <button 
                onClick={() => toggleFaq(3)}
                className="w-full flex items-center justify-between p-5 text-left font-semibold text-brand-900 text-xs md:text-sm cursor-pointer select-none"
              >
                <span>Работает ли сервис на смартфонах как приложение?</span>
                {openFaqIndex === 3 ? <ChevronUp className="w-4 h-4 text-brand-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-brand-500 shrink-0" />}
              </button>
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${openFaqIndex === 3 ? 'max-h-45 opacity-100 border-t border-brand-200/10' : 'max-h-0 opacity-0'}`}
              >
                <div className="p-5 text-xs text-brand-600 leading-relaxed font-light">
                  Да! Наш сайт разработан как современное прогрессивное веб-приложение (PWA). Вы можете добавить его на домашний экран вашего iPhone или Android-смартфона через меню вашего браузера (например, Safari на iOS: нажмите «Поделиться» &rarr; «На экран Домой»). Он будет работать в полноэкранном режиме как стандартное приложение, экономя место.
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Modal: Yandex Account Selector */}
      {showYandexAccountsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-white/90 rounded-[28px] p-6 max-w-sm w-full border border-brand-200/40 shadow-2xl backdrop-blur-lg animate-photo-entry">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-serif text-lg font-semibold text-brand-900 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#FC3F1D] text-white font-bold text-xs">Я</span>
                Вход через Яндекс
              </h3>
              <button 
                onClick={() => setShowYandexAccountsModal(false)}
                className="text-brand-400 hover:text-brand-900 transition-colors p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-brand-600 font-light leading-relaxed mb-5 text-center">
              Выберите сохраненный аккаунт для входа:
            </p>

            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-1">
              {yandexAccounts.map((account, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleSelectYandexAccount(account)}
                  className="group relative flex items-center justify-between p-4 bg-brand-50/40 hover:bg-brand-50 border border-brand-200/30 hover:border-brand-300/60 rounded-2xl cursor-pointer transition-all duration-300 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm select-none shadow-inner group-hover:bg-brand-200 transition-colors">
                      {account.name ? account.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-brand-900 group-hover:text-brand-950 transition-colors truncate max-w-[160px]">
                        {account.name || 'Пользователь'}
                      </div>
                      <div className="text-xs font-light text-brand-500 truncate max-w-[160px]">
                        {account.email}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => handleDeleteYandexAccount(e, idx)}
                    className="p-2 text-neutral-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all z-10 shrink-0 cursor-pointer"
                    title="Забыть этот аккаунт"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowYandexAccountsModal(false);
                  redirectToYandexOAuth();
                }}
                className="w-full h-12 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Выбрать другой аккаунт
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
