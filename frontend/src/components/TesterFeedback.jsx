import React, { useState } from 'react';
import { MessageSquare, X, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function TesterFeedback({ token, user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });

  const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    setStatus({ type: null, message: '' });

    // Gather client metadata
    const metadata = {
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio,
      language: window.navigator.language,
      timestamp: new Date().toISOString()
    };

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${backendUrl}/api/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name.trim() || (user ? user.name : ''),
          email: email.trim() || (user ? user.email : ''),
          message: message.trim(),
          metadata
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка при отправке отзыва');
      }

      setStatus({
        type: 'success',
        message: 'Спасибо! Ваша обратная связь успешно отправлена и сохранена.'
      });
      setMessage('');
      
      // Close modal after a short delay
      setTimeout(() => {
        setIsOpen(false);
        setStatus({ type: null, message: '' });
      }, 3000);

    } catch (err) {
      setStatus({
        type: 'error',
        message: err.message || 'Не удалось отправить отзыв. Попробуйте еще раз.'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[45] w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-brand-400/20 group"
        title="Обратная связь тестировщика"
      >
        <MessageSquare className="w-6 h-6 transition-transform duration-300 group-hover:rotate-6" />
        <span className="absolute right-16 bg-neutral-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap shadow-md uppercase tracking-wider">
          Сообщить о проблеме
        </span>
      </button>

      {/* Feedback Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-white/90 border border-brand-200/40 max-w-md w-full rounded-[28px] p-6 shadow-2xl backdrop-blur-lg animate-scale-in relative overflow-hidden">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-brand-100/60">
              <div>
                <h3 className="font-serif text-lg font-bold text-brand-900">
                  Обратная связь тестировщика
                </h3>
                <p className="text-[10px] text-brand-500 font-semibold uppercase tracking-wider mt-0.5">
                  Баг-репорт / Отзыв
                </p>
              </div>
              <button
                onClick={() => {
                  if (!isSending) {
                    setIsOpen(false);
                    setStatus({ type: null, message: '' });
                  }
                }}
                className="w-8 h-8 rounded-full hover:bg-brand-50 text-brand-400 hover:text-brand-700 flex items-center justify-center transition-colors cursor-pointer"
                disabled={isSending}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status alerts */}
            {status.message && (
              <div className={`mb-5 p-4 rounded-2xl flex items-start gap-3 border text-xs font-medium animate-photo-entry
                ${status.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
                }
              `}>
                {status.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <span className="leading-relaxed">{status.message}</span>
              </div>
            )}

            {/* Form */}
            {status.type !== 'success' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Implicit fields or fallback inputs */}
                {!user ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-1">
                        Ваше имя
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Алексей"
                        className="w-full px-3 py-2.5 bg-brand-50 border border-brand-200/60 rounded-xl text-xs text-brand-900 focus:outline-none focus:border-brand-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-1">
                        Ваш Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@example.ru"
                        className="w-full px-3 py-2.5 bg-brand-50 border border-brand-200/60 rounded-xl text-xs text-brand-900 focus:outline-none focus:border-brand-500 font-medium"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-brand-50/50 border border-brand-200/40 p-3 rounded-xl flex items-center justify-between">
                    <span className="text-[10px] text-brand-500 font-bold uppercase tracking-wider">
                      Отправитель:
                    </span>
                    <span className="text-xs font-semibold text-brand-800">
                      {user.name} ({user.email})
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-1">
                    Опишите проблему или пожелание <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows="4"
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Например: Кнопка 'Создать альбом' не нажимается на экране выбора..."
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-200/60 rounded-xl text-xs text-brand-900 focus:outline-none focus:border-brand-500 font-medium resize-none leading-relaxed"
                  />
                </div>

                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                  <p className="text-[9px] text-neutral-400 font-medium leading-relaxed">
                    * Мы автоматически прикрепим отладочную информацию (адрес текущей страницы, разрешение экрана, тип браузера), чтобы помочь быстрее воспроизвести и исправить баг.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSending || !message.trim()}
                    className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-5 py-3 rounded-2xl cursor-pointer disabled:opacity-50 transition-all shadow-sm active:scale-95 shrink-0"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Отправка...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Отправить отзыв</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
