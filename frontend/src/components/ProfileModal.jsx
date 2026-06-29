import React, { useState } from 'react';
import { User, Mail, CreditCard, Shield, X, HardDrive, RefreshCw, Camera, Loader2 } from 'lucide-react';

export default function ProfileModal({ user, setUser, token, storage, onClose }) {
  const [deletingCard, setDeletingCard] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch(`${backendUrl}/api/auth/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Не удалось обновить аватар');

      setUser(prev => ({
        ...prev,
        avatarUrl: data.avatarUrl
      }));
      setSuccessMsg('Фото профиля успешно обновлено.');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarDelete = async () => {
    setUploadingAvatar(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${backendUrl}/api/auth/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Не удалось удалить аватар');

      setUser(prev => ({
        ...prev,
        avatarUrl: null
      }));
      setSuccessMsg('Фото профиля удалено.');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPlanName = (limit) => {
    const plans = {
      1073741824: 'Бесплатный',
      5368709120: 'Уютный',
      21474836480: 'Семейный',
      107374182400: 'Бережный',
      1073741824000: 'Архив на век'
    };
    return plans[limit] || 'Специальный';
  };

  const usedBytes = storage.used || 0;
  const limitBytes = storage.limit || 1073741824;
  const percentage = Math.min((usedBytes / limitBytes) * 100, 100);

  const getProviderName = () => {
    if (user.id?.toString().startsWith('yd-') || user.yandexId) return 'Яндекс ID';
    if (user.id?.toString().startsWith('sb-')) return 'Сбер ID';
    if (user.id?.toString().startsWith('tb-')) return 'Т-Банк ID';
    if (user.id?.toString().startsWith('vk-') || user.vkId) return 'VK ID';
    return 'Электронная почта';
  };

  const handleDeleteCard = async () => {
    setDeletingCard(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${backendUrl}/api/billing/card`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Не удалось удалить привязанную карту');

      // Update user state locally
      setUser(prev => ({
        ...prev,
        cardMask: null,
        cardBrand: null
      }));

      setSuccessMsg('Карта успешно удалена, автоплатежи немедленно отменены.');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setDeletingCard(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/40 backdrop-blur-md animate-fade-in">
      {/* Modal Card */}
      <div className="bg-white/90 border border-brand-200/40 rounded-[32px] max-w-md w-full shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col relative animate-photo-entry">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-brand-400 hover:text-brand-700 p-1.5 hover:bg-brand-50 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-brand-100/60">
          <h3 className="font-serif text-lg font-bold text-brand-900">
            Личный кабинет
          </h3>
          <p className="text-[10px] text-brand-500 font-bold uppercase tracking-wider mt-0.5">
            Управление профилем и подпиской
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl text-center">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold rounded-2xl text-center">
              {successMsg}
            </div>
          )}

          {/* User Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">
              Данные аккаунта
            </h4>
            <div className="bg-brand-50/20 border border-brand-100/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-4">
                {/* Avatar with upload input */}
                <div className="relative group cursor-pointer w-12 h-12 rounded-full overflow-hidden border border-brand-200/80 bg-brand-100 flex items-center justify-center shrink-0">
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl.startsWith('/') ? `${backendUrl}${user.avatarUrl}` : user.avatarUrl} 
                      alt={user.name} 
                      className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                    />
                  ) : (
                    <User className="w-5 h-5 text-brand-600 group-hover:opacity-75 transition-opacity" />
                  )}
                  
                  {/* Upload Overlay */}
                  <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Camera className="w-4 h-4 text-white" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleAvatarChange} 
                      className="hidden" 
                      disabled={uploadingAvatar}
                    />
                  </label>

                  {/* Loading Spinner */}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-brand-900 truncate">{user.name}</p>
                    {user.avatarUrl && (
                      <button 
                        onClick={handleAvatarDelete}
                        disabled={uploadingAvatar}
                        className="text-[10px] text-red-500 hover:text-red-700 font-semibold cursor-pointer transition-colors bg-transparent border-none p-0"
                        title="Удалить фото"
                      >
                        Удалить фото
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-brand-500 font-light mt-0.5">ФИО пользователя</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-brand-900">{user.email || 'Не указан'}</p>
                  <p className="text-[10px] text-brand-500 font-light">Email / Идентификатор</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-brand-900">{getProviderName()}</p>
                  <p className="text-[10px] text-brand-500 font-light">Способ авторизации</p>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Quota */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                Использование диска
              </h4>
              <span className="text-[10px] font-bold text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full">
                Тариф: {getPlanName(limitBytes)}
              </span>
            </div>
            <div className="bg-brand-50/20 border border-brand-100/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-xs font-semibold text-brand-900 mb-1">
                    <span>{formatBytes(usedBytes)}</span>
                    <span className="text-brand-500">из {formatBytes(limitBytes)}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-brand-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-500 rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Billing / Card Management */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">
              Способ оплаты и подписка
            </h4>
            {user.cardMask ? (
              <div className="space-y-2">
                <div className="bg-brand-50/20 border border-brand-100/30 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-brand-900">
                        {user.cardBrand || 'Карта'} {user.cardMask}
                      </p>
                      <p className="text-[10px] text-brand-500 font-light">
                        Для рекуррентных списаний
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteCard}
                    disabled={deletingCard}
                    className="text-xs font-bold text-red-500 hover:text-white transition-all py-2 px-3 hover:bg-red-500 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1 border border-red-200/50 hover:border-red-500"
                  >
                    {deletingCard ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Удалить карту'
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-brand-500 font-light leading-relaxed px-1">
                  💡 <b>ФЗ № 376-ФЗ:</b> Удаление привязанной карты и отзыв токена автоплатежей производятся мгновенно в один клик без дополнительных условий и подтверждений.
                </p>
              </div>
            ) : (
              <div className="text-center p-6 bg-brand-50/10 border border-brand-100/20 border-dashed rounded-2xl">
                <p className="text-xs text-brand-600 font-light">
                  Нет привязанных карт для автоплатежей.
                </p>
                <p className="text-[10px] text-brand-500 font-light mt-1">
                  Вы можете привязать карту при переходе на платный тариф в разделе «Подписка».
                </p>
              </div>
            )}
          </div>

          {/* Public Offer Accept Info */}
          {user.acceptedOfferAt && (
            <div className="text-center text-[10px] text-brand-400 border-t border-brand-100/60 pt-4">
              Условия сервиса приняты: {new Date(user.acceptedOfferAt).toLocaleString('ru-RU')} ({user.acceptedOfferVersion})
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
