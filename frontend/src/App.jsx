import React, { useState, useEffect } from 'react';
import Hero from './components/Hero.jsx';
import Gallery from './components/Gallery.jsx';
import PinLock from './components/PinLock.jsx';
import Subscription from './components/Subscription.jsx';
import BetaLock from './components/BetaLock.jsx';
import TesterFeedback from './components/TesterFeedback.jsx';
import SharedAlbum from './components/SharedAlbum.jsx';
import Offer from './components/Offer.jsx';
import { Camera, LogOut, ShieldCheck, RefreshCw, User, X, CreditCard } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [betaUnlocked, setBetaUnlocked] = useState(() => localStorage.getItem('beta_unlocked') === 'true');
  const [user, setUser] = useState(null);
  const [hasPin, setHasPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [storage, setStorage] = useState({ used: 0, limit: 1073741824 });
  const [loading, setLoading] = useState(true);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' or 'subscription'
  const [sharedAlbumToken, setSharedAlbumToken] = useState(() => {
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'shared' && pathParts[2]) {
      return pathParts[2];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('share') || null;
  });
  const [showOffer, setShowOffer] = useState(false);
  
  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

  // Detect PWA installation capability and device
  useEffect(() => {
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

  // 1. Handle SSO OAuth Callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (window.location.pathname === '/auth-callback' && urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  // 2. Load user profile on token boot
  const checkProfile = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setIsCheckingProfile(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${backendUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          return;
        }
        throw new Error(data.error || 'Ошибка загрузки профиля');
      }

      setUser({
        id: data.id,
        name: data.name,
        email: data.email
      });
      setStorage(prev => ({ ...prev, limit: data.storageLimit }));
      setHasPin(data.hasPin);
    } catch (err) {
      console.error(err);
      setErrorMsg('Не удалось загрузить данные пользователя. Проверьте интернет-соединение.');
    } finally {
      setIsCheckingProfile(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    checkProfile();
  }, [token]);

  // 3. Fetch storage details after PIN code is unlocked
  const fetchStorageStats = async () => {
    if (!token || !pinVerified) return;
    try {
      const response = await fetch(`${backendUrl}/api/photos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setStorage(data.storage || { used: 0, limit: 1073741824 });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    if (pinVerified) {
      fetchStorageStats();
    }
  }, [pinVerified]);

  // Logout action
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setHasPin(false);
    setPinVerified(false);
    setStorage({ used: 0, limit: 1073741824 });
    setActiveTab('gallery');
  };

  // Demo login callback
  const handleDemoLogin = async (provider) => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/auth/demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ provider })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка демо-входа');
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setHasPin(data.user.hasPin);
      setPinVerified(false); // Require entering PIN
    } catch (e) {
      setErrorMsg(e.message);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Email login callback
  const handleEmailLoginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    setHasPin(data.status === 'verify_pin');
    setPinVerified(false); // Require entering/setting PIN
  };

  // Plan upgrade success
  const handleUpgradeSuccess = (newLimit) => {
    setStorage(prev => ({ ...prev, limit: newLimit }));
  };

  // BETA LOCK SITE GATE (PIN 6969 REQUIRED FOR ACCESS)
  if (!betaUnlocked) {
    return (
      <BetaLock 
        onSuccess={() => setBetaUnlocked(true)} 
      />
    );
  }

  // PUBLIC OFFER PAGE
  if (showOffer) {
    return (
      <>
        <Offer onBack={() => setShowOffer(false)} />
        <TesterFeedback token={token} user={user} />
      </>
    );
  }

  // PUBLIC SHARED ALBUM PAGE
  if (sharedAlbumToken) {
    return (
      <>
        <SharedAlbum 
          shareToken={sharedAlbumToken} 
          onBackToApp={() => {
            setSharedAlbumToken(null);
            window.history.replaceState({}, document.title, '/');
          }} 
        />
        <TesterFeedback token={token} user={user} />
      </>
    );
  }

  // LOADING STATE
  if (loading || (token && isCheckingProfile)) {
    return (
      <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center text-brand-600">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-brand-400" />
        <span className="text-sm font-medium">Открываем сейф воспоминаний...</span>
      </div>
    );
  }

  // NOT LOGGED IN
  if (!token) {
    return (
      <>
        {errorMsg && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] p-4 bg-red-50/90 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl text-center shadow-lg backdrop-blur-sm animate-photo-entry">
            {errorMsg}
          </div>
        )}
        <Hero 
          onDemoLogin={handleDemoLogin} 
          onEmailLoginSuccess={handleEmailLoginSuccess} 
          onViewOffer={() => setShowOffer(true)}
        />
        <TesterFeedback token={token} user={user} />
      </>
    );
  }

  // LOCK SCREEN (PIN REQUIRED)
  if (!pinVerified) {
    return (
      <>
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
        <TesterFeedback token={token} user={user} />
      </>
    );
  }

  // MAIN SYSTEM (LOGGED IN & UNLOCKED)
  return (
    <div className="min-h-screen bg-brand-50 flex flex-col selection:bg-brand-200">
      {/* Authenticated Sticky Glass Header */}
      <header className="sticky top-0 z-40 w-full glass-header py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div 
            onClick={() => setActiveTab('gallery')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-400 to-brand-600 flex items-center justify-center text-brand-50 shadow-sm">
              <Camera className="w-4.5 h-4.5" />
            </div>
            <span className="font-serif font-bold text-xl md:text-2xl tracking-tight text-brand-900 hidden sm:inline">
              ЛегкоСохранить.рф
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
          </div>

          {/* User profile & logout */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 bg-brand-100/60 px-3 py-1.5 rounded-full border border-brand-200/20">
                <div className="w-6 h-6 rounded-full bg-brand-300 flex items-center justify-center text-brand-800">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-brand-800">
                  {user.name}
                </span>
              </div>
              
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
              <h4 className="text-sm font-semibold text-brand-900 mb-0.5">Установите фотоальбом на главный экран</h4>
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
                Нажмите кнопку <span className="font-semibold">«Поделиться» 📤</span> внизу экрана Safari, затем выберите <span className="font-semibold">«На экран Домой» ➕</span>. Иконка появится на рабочем столе телефона!
              </p>
            </div>
            <button 
              onClick={dismissIOSTip}
              className="text-brand-500 hover:bg-brand-200/40 p-2 rounded-full transition-colors cursor-pointer animate-fade-in"
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
        ) : (
          <Subscription 
            token={token} 
            storage={storage} 
            onUpgradeSuccess={handleUpgradeSuccess} 
            onRedirectToGallery={() => setActiveTab('gallery')}
          />
        )}
      </main>
      
      {/* Footer stamp */}
      <footer className="w-full py-8 text-center text-[10px] text-brand-400 font-semibold tracking-wider uppercase bg-brand-100/20 mt-12 border-t border-brand-200/20">
        © 2026 ЛЕГКОСОХРАНИТЬ.РФ — БЕЗОПАСНАЯ ГАЛЕРЕЯ
      </footer>
      <TesterFeedback token={token} user={user} />
    </div>
  );
}
