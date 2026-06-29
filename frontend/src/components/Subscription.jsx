import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Heart, Sparkles, CreditCard, RefreshCw, CheckCircle2, X } from 'lucide-react';

const plans = [
  {
    name: 'Бесплатный',
    sizeText: '1 ГБ',
    limitBytes: 1 * 1024 * 1024 * 1024,
    priceText: '0 ₽ в месяц',
    priceTextSmall: 'Всегда бесплатно',
    desc: 'Отличный старт для сохранения самых ценных семейных снимков.',
    badge: null
  },
  {
    name: 'Уютный',
    sizeText: '5 ГБ',
    limitBytes: 5 * 1024 * 1024 * 1024,
    priceText: '99 ₽ в месяц',
    priceTextSmall: 'Меньше чашки чая',
    desc: 'Достаточно места для сотен теплых воспоминаний и детских улыбок.',
    badge: 'Популярный'
  },
  {
    name: 'Семейный',
    sizeText: '20 ГБ',
    limitBytes: 20 * 1024 * 1024 * 1024,
    priceText: '250 ₽ в месяц',
    priceTextSmall: 'Хватит на долгие годы',
    desc: 'Идеальный объем для создания уютных цифровых альбомов всей семьи.',
    badge: 'Выбор заботливых'
  },
  {
    name: 'Бережный',
    sizeText: '100 ГБ',
    limitBytes: 100 * 1024 * 1024 * 1024,
    priceText: '500 ₽ в месяц',
    priceTextSmall: 'Забудьте о памяти',
    desc: 'Для тех, кто сохраняет каждый момент и не хочет выбирать, что оставить.',
    badge: null
  },
  {
    name: 'Архив на век',
    sizeText: '1000 ГБ',
    limitBytes: 1000 * 1024 * 1024 * 1024,
    priceText: '2500 ₽',
    priceTextSmall: 'Разовый платеж навсегда',
    desc: 'Гигантский сейф для абсолютно всех ваших воспоминаний без ежемесячных платежей.',
    badge: 'Лучшее предложение'
  }
];

export default function Subscription({ token, storage, onUpgradeSuccess, onRedirectToGallery }) {
  const [selectedPlan, setSelectedPlan] = useState(null); // null or plan object
  const [paymentMethod, setPaymentMethod] = useState(null); // 'tbank' | 'sber' | 'yandex' | 'sbp'
  const [paymentStep, setPaymentStep] = useState('select_method'); // 'select_method', 'processing', 'success'
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('payment') === 'success') {
        setPaymentStep('success');
        const currentLimit = storage.limit;
        const matchingPlan = plans.find(p => p.limitBytes === currentLimit) || plans[1];
        setSelectedPlan(matchingPlan);
      }
    }
  }, [storage.limit]);

  const handlePlanClick = (plan) => {
    // Prevent clicking current plan (or lower plan just for simulation sake, but let them change to whatever they want)
    if (storage.limit === plan.limitBytes) return;
    setSelectedPlan(plan);
    setPaymentMethod(null);
    setPaymentStep('select_method');
  };

  const handlePay = async (method) => {
    setPaymentMethod(method);
    setPaymentStep('processing');

    // Map limits to standard prices
    let price = 0;
    if (selectedPlan.limitBytes === 5 * 1024 * 1024 * 1024) price = 99;
    else if (selectedPlan.limitBytes === 20 * 1024 * 1024 * 1024) price = 250;
    else if (selectedPlan.limitBytes === 100 * 1024 * 1024 * 1024) price = 500;
    else if (selectedPlan.limitBytes === 1000 * 1024 * 1024 * 1024) price = 2500;

    try {
      const response = await fetch(`${backendUrl}/api/billing/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          limitBytes: selectedPlan.limitBytes,
          planName: selectedPlan.name,
          price: price,
          method: method
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка активации тарифа');
      
      if (data.confirmationUrl) {
        // Redirect user to the secure payment checkout page
        window.location.href = data.confirmationUrl;
      } else if (data.downgraded) {
        setPaymentStep('success');
        onUpgradeSuccess(data.storageLimit);
      }
    } catch (err) {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 5000);
      setSelectedPlan(null);
    }
  };

  const currentLimit = storage.limit || 1073741824;

  return (
    <div className="w-full max-w-5xl mx-auto px-2 animate-photo-entry">
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl text-center animate-photo-entry">
          {errorMsg}
        </div>
      )}
      
      {/* Title block */}
      <div className="text-center max-w-lg mx-auto mb-10">
        <h3 className="font-serif text-2xl md:text-3xl text-brand-900 font-semibold mb-3">Увеличьте хранилище воспоминаний</h3>
        <p className="text-xs text-brand-900 font-light leading-relaxed">
          Сохраняйте дорогие сердцу фотографии в оригинальном качестве. Выберите объем, который подходит вашей семье. Локальная оплата российскими картами.
        </p>
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {plans.map((plan, idx) => {
          const isCurrent = currentLimit === plan.limitBytes;
          return (
            <div
              key={idx}
              onClick={() => handlePlanClick(plan)}
              className={`bg-white border rounded-3xl p-6 flex flex-col justify-between relative select-none transition-all duration-300 shadow-sm
                ${isCurrent 
                  ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-100/20' 
                  : 'border-brand-200/40 hover:border-brand-400 hover:scale-[1.01] cursor-pointer card-hover'
                }
              `}
            >
              {plan.badge && (
                <span className="absolute -top-3 right-6 px-3 py-1 bg-brand-500 text-white text-[9px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                  {plan.badge}
                </span>
              )}
              
              <div>
                <h4 className="font-serif font-bold text-lg text-brand-900 mb-1">{plan.name}</h4>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-serif font-bold text-brand-500">{plan.sizeText}</span>
                </div>
                <p className="text-xs text-brand-900 font-light leading-relaxed mb-6">
                  {plan.desc}
                </p>
              </div>

              <div>
                <div className="border-t border-brand-100 my-4"></div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-brand-900 block">{plan.priceText}</span>
                    <span className="text-[10px] text-brand-900 font-medium">{plan.priceTextSmall}</span>
                  </div>
                  
                  {isCurrent ? (
                    <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest bg-brand-200/50 px-3 py-1.5 rounded-full">
                      Активен
                    </span>
                  ) : (
                    <button
                      className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-2xl transition-colors cursor-pointer shadow-sm active:scale-95"
                    >
                      Выбрать
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reassurance list */}
      <div className="max-w-2xl mx-auto p-6 rounded-3xl bg-brand-100/30 border border-brand-200/40 grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-brand-900 mb-0.5">Безопасно и надежно</h4>
            <p className="text-[10px] text-brand-900 font-light">
              Хранилище размещено в РФ. Ваши данные защищены в соответствии с ФЗ-152.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 shrink-0">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-brand-900 mb-0.5">Без скрытых подписок</h4>
            <p className="text-[10px] text-brand-900 font-light">
              Никаких скрытых списаний. Уведомление на почту за 3 дня до оплаты. Отмена в один клик.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Overlay Modal */}
      {selectedPlan && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-md">
          <div className="bg-white/90 rounded-[28px] p-6 max-w-sm w-full border border-brand-200/40 shadow-2xl backdrop-blur-lg animate-photo-entry">
            
            {paymentStep === 'select_method' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif text-lg font-semibold text-brand-900">Оплата тарифа</h3>
                  <button 
                    onClick={() => setSelectedPlan(null)}
                    className="text-brand-400 hover:text-brand-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-brand-50 border border-brand-200/60 mb-6 text-center">
                  <span className="text-xs font-semibold text-brand-600 uppercase tracking-widest block mb-1">
                    Подключение объема
                  </span>
                  <span className="text-3xl font-serif font-bold text-brand-500 block mb-1">
                    {selectedPlan.sizeText}
                  </span>
                  <span className="text-sm font-bold text-brand-900 block">
                    {selectedPlan.priceText}
                  </span>
                </div>

                <p className="text-xs text-brand-900 font-light mb-4 text-center">
                  Выберите удобный способ безопасной оплаты:
                </p>

                <div className="space-y-3">
                  {/* T-Bank Payment */}
                  <button
                    onClick={() => handlePay('tbank')}
                    className="w-full h-12 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
                    title="Оплатить через Т-Банк"
                  >
                    <img src="/tbank.svg" className="h-5 w-auto object-contain shrink-0" alt="Т-Банк" />
                    <span className="text-sm font-bold text-[#232334]">Оплатить через Т-Банк</span>
                  </button>

                  {/* Sber Payment */}
                  <button
                    onClick={() => handlePay('sber')}
                    className="w-full h-12 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
                    title="Оплатить через Сбербанк"
                  >
                    <img src="/sber.svg" className="h-5 w-auto object-contain shrink-0" alt="Сбербанк" />
                    <span className="text-sm font-bold text-[#232334]">Оплатить через Сбербанк</span>
                  </button>

                  {/* Yandex Payment */}
                  <button
                    onClick={() => handlePay('yandex')}
                    className="w-full h-12 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
                    title="Оплатить через Яндекс Пэй"
                  >
                    <img src="/yandex.svg" className="h-5 w-auto object-contain shrink-0" alt="Яндекс Пэй" />
                    <span className="text-sm font-bold text-[#232334]">Оплатить через Яндекс Пэй</span>
                  </button>

                  {/* SBP Payment */}
                  <button
                    onClick={() => handlePay('sbp')}
                    className="w-full h-12 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-sm cursor-pointer"
                    title="Оплатить через СБП"
                  >
                    <div className="h-5 w-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-md flex items-center justify-center text-white font-serif font-black text-[9px] tracking-tighter shrink-0 select-none">СБП</div>
                    <span className="text-sm font-bold text-[#232334]">Оплатить через СБП</span>
                  </button>
                </div>
              </>
            )}

            {paymentStep === 'processing' && (
              <div className="text-center py-12 flex flex-col items-center justify-center select-none">
                <RefreshCw className="w-10 h-10 animate-spin text-brand-500 mb-6" />
                <h4 className="font-serif text-lg font-semibold text-brand-900 mb-2">Безопасный платеж</h4>
                <p className="text-xs text-brand-900 font-light max-w-xs leading-relaxed">
                  Соединяемся со шлюзом {paymentMethod === 'tbank' ? 'Т-Банка' : paymentMethod === 'sber' ? 'Сбербанка' : paymentMethod === 'yandex' ? 'Яндекса' : 'СБП'}... Пожалуйста, не закрывайте это окно.
                </p>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="text-center py-8 flex flex-col items-center justify-center select-none">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-500 flex items-center justify-center mb-4 shadow-inner">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-serif text-lg font-semibold text-brand-900 mb-2">Оплата прошла успешно!</h4>
                <p className="text-xs text-brand-900 font-light max-w-xs leading-relaxed mb-6">
                  Мы бережно расширили ваше хранилище воспоминаний до **{selectedPlan ? selectedPlan.sizeText : ''}**. Приятного использования!
                </p>
                <button
                  onClick={() => {
                    setSelectedPlan(null);
                    onRedirectToGallery();
                  }}
                  className="py-3 px-6 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-xs font-semibold transition-colors cursor-pointer shadow-md"
                >
                  Вернуться в альбом
                </button>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
