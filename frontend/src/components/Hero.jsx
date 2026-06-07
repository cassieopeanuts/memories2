import React from 'react';
import { Camera, ShieldCheck, Heart, Sparkles } from 'lucide-react';

export default function Hero({ onDemoLogin }) {
  const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

  const handleYandexLogin = () => {
    window.location.href = `${backendUrl}/api/auth/yandex?origin=${encodeURIComponent(window.location.origin)}`;
  };

  const handleSberLogin = () => {
    window.location.href = `${backendUrl}/api/auth/sber?origin=${encodeURIComponent(window.location.origin)}`;
  };

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-12 md:py-20 bg-brand-50 selection:bg-brand-200">
      {/* Header / Brand Logo */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-400 to-brand-600 flex items-center justify-center text-brand-50 shadow-md">
            <Camera className="w-5 h-5" />
          </div>
          <span className="font-serif font-bold text-xl tracking-tight text-brand-900">
            Легко Сохранить
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-brand-500 uppercase tracking-widest bg-brand-100/50 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-4 h-4 text-brand-500" />
          Сервера в РФ • ФЗ-152
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="max-w-xl mx-auto w-full my-auto flex flex-col items-center text-center">
        {/* Soft Badge */}
        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-100 text-brand-800 text-sm font-medium mb-8 animate-pulse">
          <Sparkles className="w-4 h-4 text-brand-500" />
          Новый способ хранить дорогие сердцу фото
        </div>

        {/* Title */}
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-brand-900 leading-tight font-medium mb-6">
          Память на телефоне <br className="hidden sm:inline"/>
          <span className="italic font-normal text-brand-600">больше не закончится</span>
        </h1>

        {/* Reassuring Subtitle */}
        <p className="text-base md:text-lg text-brand-700 font-light leading-relaxed mb-10 max-w-lg">
          Самое простое облако для ваших фотографий. Забудьте о нехватке места, зарубежных картах оплаты и сложных настройках. Сохраняйте то, что дорого, в один клик.
        </p>

        {/* SSO Buttons */}
        <div className="w-full flex flex-col gap-4 max-w-sm mb-12">
          {/* Yandex ID Button */}
          <button
            onClick={handleYandexLogin}
            className="w-full h-14 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 font-medium rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
          >
            {/* Yandex Logo */}
            <div className="w-7 h-7 bg-[#FC3F1D] rounded-lg flex items-center justify-center text-white font-bold text-lg font-sans">
              Я
            </div>
            <span className="text-base">Войти с Яндекс ID</span>
          </button>

          {/* Sber ID Button */}
          <button
            onClick={handleSberLogin}
            className="w-full h-14 bg-gradient-to-r from-[#21A038] to-[#128024] hover:opacity-95 text-white font-medium rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-[0.98] shadow-md cursor-pointer"
          >
            {/* Sber Logo representation */}
            <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-[#21A038]">
              <span className="text-xs font-black">✔</span>
            </div>
            <span className="text-base">Войти через Сбер ID</span>
          </button>
        </div>

        {/* Dev Mode Demo login */}
        <div className="w-full max-w-sm p-5 rounded-2xl bg-brand-100/40 border border-brand-200/50">
          <p className="text-xs text-brand-600 font-medium mb-3 uppercase tracking-wider">
            Режим разработки (Вход без ключей)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onDemoLogin('yandex')}
              className="py-2.5 px-3 bg-brand-200/50 hover:bg-brand-200 text-brand-800 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
            >
              Демо Яндекс 👩‍🦰
            </button>
            <button
              onClick={() => onDemoLogin('sber')}
              className="py-2.5 px-3 bg-brand-200/50 hover:bg-brand-200 text-brand-800 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
            >
              Демо Сбер 👩
            </button>
          </div>
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
