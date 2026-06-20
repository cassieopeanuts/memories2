import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, LogOut, Check } from 'lucide-react';

export default function WelcomeAcceptance({ user, onAccept, onViewOffer, onLogout }) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${backendUrl}/api/auth/accept-offer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ version: 'Редакция № 4' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось принять соглашение');

      onAccept();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col justify-between p-6 selection:bg-brand-200">
      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" className="w-10 h-10 object-contain" alt="Логотип" />
          <span className="font-serif font-bold text-2xl md:text-3xl tracking-tight text-brand-900">
            ЛегкоСохранить.РФ
          </span>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center py-10">
        <div className="bg-white border border-brand-200/40 rounded-[32px] p-6 md:p-10 max-w-md w-full shadow-xl text-center backdrop-blur-lg animate-photo-entry">
          
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-500 mx-auto mb-6 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <h2 className="font-serif text-2xl text-brand-900 font-bold mb-3 leading-snug">
            Добро пожаловать, {user.name.split(' ')[0]}!
          </h2>
          
          <p className="text-xs text-brand-600 font-light mb-8 leading-relaxed">
            Мы рады видеть вас в безопасном фотохранилище «ЛегкоСохранить.РФ». 
            Для продолжения работы и защиты ваших данных нам необходимо ваше согласие с юридическими условиями сервиса.
          </p>

          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="text-left space-y-6">
            {/* Custom Checkbox */}
            <label className="flex gap-3 cursor-pointer group select-none">
              <div className="relative shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center
                  ${agreed 
                    ? 'bg-brand-500 border-brand-500 text-white shadow-sm' 
                    : 'border-brand-300 bg-white group-hover:border-brand-400'
                  }
                `}>
                  {agreed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
              <span className="text-[11px] md:text-xs text-brand-700 font-light leading-relaxed">
                Я ознакомился и согласен с условиями{' '}
                <button
                  type="button"
                  onClick={onViewOffer}
                  className="font-semibold text-brand-500 hover:text-brand-700 underline cursor-pointer inline"
                >
                  Публичной оферты
                </button>
                {' '}и{' '}
                <a
                  href="/public_offer.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-500 hover:text-brand-700 underline inline font-medium"
                >
                  Политикой обработки персональных данных
                </a>.
              </span>
            </label>

            {/* Accept Button */}
            <button
              type="submit"
              disabled={!agreed || loading}
              className="w-full h-12 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-200 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed shadow-md shadow-brand-500/10 active:scale-[0.99]"
            >
              <span>{loading ? 'Секунду...' : 'Принять и продолжить'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Logout Action */}
          <div className="mt-8 border-t border-brand-100 pt-6">
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-900 transition-colors font-medium cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти из аккаунта</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-[10px] text-brand-400 font-semibold tracking-wider uppercase py-4">
        © 2026 ЛЕГКОСОХРАНИТЬ.РФ — БЕЗОПАСНАЯ ГАЛЕРЕЯ
      </footer>
    </div>
  );
}
