'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Gallery from '@/components/Gallery.jsx';
import PinLock from '@/components/PinLock.jsx';
import Subscription from '@/components/Subscription.jsx';
import WelcomeAcceptance from '@/components/WelcomeAcceptance.jsx';
import ProfileModal from '@/components/ProfileModal.jsx';
import ThemeSwitcher from '@/components/ThemeSwitcher.jsx';
import TesterFeedback from '@/components/TesterFeedback.jsx';
import PalettesPlayground from '@/components/PalettesPlayground.jsx';
import { LogOut, User, X, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const {
    token,
    loading,
    isCheckingProfile,
    user,
    setUser,
    hasPin,
    setHasPin,
    pinVerified,
    setPinVerified,
    storage,
    setStorage,
    handleLogout,
    fetchStorageStats,
    errorMsg
  } = useAuth();

  const { theme, setTheme, font, setFont } = useTheme();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery', 'subscription', or 'palettes'
  const [showProfileModal, setShowProfileModal] = useState(false);

  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';

  // Redirect to landing if token is removed/expired
  useEffect(() => {
    if (!loading && !token) {
      router.push('/');
    }
  }, [token, loading, router]);

  // Parse URL search parameters to sync activeTab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'subscription' || tab === 'gallery' || tab === 'palettes') {
        setActiveTab(tab);
      }
    }
  }, []);

  // Detect PWA installation capability and device
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    
    if (isIOSDevice && !isStandalone) {
      const hasDismissed = localStorage.getItem('pwa_ios_tip_dismissed');
      if (!hasDismissed) {
        setTimeout(() => setShowIOSTip(true), 2000);
      }
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const hasDismissed = localStorage.getItem('pwa_banner_dismissed');
      if (!hasDismissed && !isStandalone) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const dismissInstallBanner = () => {
    localStorage.setItem('pwa_banner_dismissed', 'true');
    setShowInstallBanner(false);
  };

  const dismissIOSTip = () => {
    localStorage.setItem('pwa_ios_tip_dismissed', 'true');
    setShowIOSTip(false);
  };

  const handleUpgradeSuccess = (newLimit) => {
    setStorage(prev => ({ ...prev, limit: newLimit }));
  };

  // LOADING STATE
  if (loading || (token && isCheckingProfile)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-brand-600 bg-brand-50">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-brand-400" />
        <span className="text-sm font-medium">Открываем сейф воспоминаний...</span>
      </div>
    );
  }

  // Double check if token exists (handled by middleware but keeps React render safe)
  if (!token) {
    return null;
  }

  // WELCOME ACCEPTANCE (CLICKWRAP)
  if (user && !user.acceptedOffer) {
    return (
      <div className="min-h-screen bg-brand-50 relative flex flex-col justify-between overflow-x-hidden">
        <WelcomeAcceptance
          user={user}
          onAccept={() => setUser(prev => ({ ...prev, acceptedOffer: true }))}
          onViewOffer={() => router.push('/offer')}
          onLogout={handleLogout}
        />
        <ThemeSwitcher currentTheme={theme} onThemeSelect={setTheme} currentFont={font} onFontSelect={setFont} />
        <TesterFeedback token={token} user={user} />
      </div>
    );
  }

  // LOCK SCREEN (PIN REQUIRED)
  if (!pinVerified) {
    return (
      <div className="min-h-screen bg-brand-50 relative flex flex-col justify-between overflow-x-hidden">
        <PinLock
          token={token}
          mode={hasPin ? 'verify' : 'setup'}
          onSuccess={() => {
            setHasPin(true);
            setPinVerified(true);
          }}
          onLogout={handleLogout}
          backendUrl={backendUrl}
        />
        <ThemeSwitcher currentTheme={theme} onThemeSelect={setTheme} currentFont={font} onFontSelect={setFont} />
        <TesterFeedback token={token} user={user} />
      </div>
    );
  }

  // MAIN SYSTEM (LOGGED IN & UNLOCKED)
  return (
    <div className="min-h-screen flex flex-col selection:bg-brand-200 bg-brand-50 overflow-x-hidden">
      {/* Authenticated Sticky Glass Header */}
      <header className="sticky top-0 z-40 w-full glass-header py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div 
            onClick={() => setActiveTab('gallery')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <img src="/logo.png" className="w-9 h-9 object-contain" alt="Логотип" />
            <span className="font-serif font-bold text-xl md:text-2xl tracking-tight text-brand-900 hidden sm:inline">
              ЛегкоСохранить.РФ
            </span>
          </div>

          {/* Navigation tabs */}
          <div className="flex bg-brand-100/60 p-1 rounded-full border border-brand-200/20 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'gallery' 
                  ? 'bg-white text-brand-900 shadow-sm' 
                  : 'text-brand-600 hover:text-brand-900'
              }`}
            >
              Альбомы
            </button>
            <button
              onClick={() => setActiveTab('subscription')}
              className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'subscription' 
                  ? 'bg-white text-brand-900 shadow-sm' 
                  : 'text-brand-600 hover:text-brand-900'
              }`}
            >
              Подписка
            </button>
            <button
              onClick={() => setActiveTab('palettes')}
              className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'palettes' 
                  ? 'bg-white text-brand-900 shadow-sm' 
                  : 'text-brand-600 hover:text-brand-900'
              }`}
            >
              Палитры
            </button>
          </div>

          {/* User profile & logout */}
          {user && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2 bg-brand-100/60 hover:bg-brand-200/60 px-3 py-1.5 rounded-full border border-brand-200/20 transition-all cursor-pointer group"
                title="Личный кабинет"
              >
                <div className="w-6 h-6 rounded-full bg-brand-300 group-hover:bg-brand-400 flex items-center justify-center text-brand-800 shrink-0 transition-colors overflow-hidden">
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl.startsWith('/') ? `${backendUrl}${user.avatarUrl}` : user.avatarUrl} 
                      alt={user.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-xs font-semibold text-brand-800 hidden xs:inline max-w-[120px] truncate">
                  {user.name}
                </span>
              </button>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-900 transition-colors font-medium border border-brand-200 hover:bg-brand-100/30 px-3 py-1.5 rounded-full cursor-pointer"
                title="Выйти"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Выйти</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        
        {/* Error notification banner */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl text-center">
            {errorMsg}
          </div>
        )}

        {/* PWA Install Banner for Android/Chrome */}
        {showInstallBanner && (
          <div className="mb-6 max-w-2xl mx-auto p-5 bg-gradient-to-r from-brand-100/60 to-brand-200/60 border border-brand-300/30 rounded-3xl flex items-center justify-between gap-4 shadow-sm">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-brand-900 mb-0.5">Установите приложение на главный экран</h4>
              <p className="text-xs text-brand-700 font-light leading-relaxed">
                Сохраняйте дорогие сердцу фотографии в одно нажатие, без открытия браузера.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleInstallClick}
                className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl transition-all duration-200 shadow-sm cursor-pointer"
              >
                Установить
              </button>
              <button 
                onClick={dismissInstallBanner}
                className="text-brand-500 hover:bg-brand-200/40 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PWA Install Helper Tip for iOS/Safari */}
        {showIOSTip && (
          <div className="mb-6 max-w-2xl mx-auto p-5 bg-gradient-to-r from-brand-100/60 to-brand-200/60 border border-brand-300/30 rounded-3xl flex items-start gap-4 shadow-sm">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-brand-900 mb-1">Как установить на iPhone 📱</h4>
              <p className="text-xs text-brand-700 font-light leading-relaxed">
                Нажмите кнопку <span className="font-semibold">«Поделиться» 📤</span> внизу экрана Safari, затем нажмите <span className="font-semibold">«Показать больше»</span> (или прокрутите меню вниз) и выберите <span className="font-semibold">«На экран Домой» ➕</span>. Иконка появится на рабочем столе телефона!
              </p>
            </div>
            <button 
              onClick={dismissIOSTip}
              className="text-brand-500 hover:bg-brand-200/40 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Tab render */}
        {activeTab === 'gallery' ? (
          <Gallery 
            token={token} 
            storage={storage} 
            onUploadComplete={fetchStorageStats} 
            activeTab={activeTab}
          />
        ) : activeTab === 'subscription' ? (
          <Subscription 
            token={token} 
            storage={storage} 
            onUpgradeSuccess={handleUpgradeSuccess} 
            onRedirectToGallery={() => setActiveTab('gallery')}
          />
        ) : (
          <PalettesPlayground 
            currentTheme={theme} 
            onThemeChange={setTheme}
            currentFont={font}
            onFontChange={setFont}
          />
        )}
      </main>
      
      {/* Footer stamp */}
      <footer className="w-full py-8 text-center text-[10px] text-brand-400 font-semibold tracking-wider uppercase bg-brand-100/20 mt-12 border-t border-brand-200/20">
        © 2026 ЛЕГКОСОХРАНИТЬ.РФ — БЕЗОПАСНЫЙ СЕМЕЙНЫЙ АРХИВ
      </footer>
      <ThemeSwitcher currentTheme={theme} onThemeSelect={setTheme} currentFont={font} onFontSelect={setFont} />
      <TesterFeedback token={token} user={user} />
      {showProfileModal && (
        <ProfileModal
          user={user}
          setUser={setUser}
          token={token}
          storage={storage}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
