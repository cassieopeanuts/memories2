import React, { useState, useEffect } from 'react';
import Hero from './components/Hero.jsx';
import UploadZone from './components/UploadZone.jsx';
import Gallery from './components/Gallery.jsx';
import { Camera, LogOut, ShieldCheck, RefreshCw, User, X } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [storage, setStorage] = useState({ used: 0, limit: 1073741824 });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
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
    
    // Check if path is callback
    if (window.location.pathname === '/auth-callback' && urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      
      // Clean up the URL query string and pathname immediately
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  // 2. Fetch User & Photo Data if Token changes/exists
  const fetchData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${backendUrl}/api/photos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        // Expired/Invalid token
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось получить фотографии.');
      }

      setPhotos(data.photos || []);
      setStorage(data.storage || { used: 0, limit: 1073741824 });
      
      // Decode user info from JWT manually to avoid extra API call
      try {
        const payloadBase64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = payloadBase64.length % 4;
        const padded = pad ? payloadBase64 + '='.repeat(4 - pad) : payloadBase64;
        const decodedClaims = JSON.parse(decodeURIComponent(atob(padded).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')));
        setUser({
          name: decodedClaims.name,
          email: decodedClaims.email
        });
      } catch (e) {
        console.error('Error decoding JWT payload:', e);
        setUser({ name: 'Дорогой пользователь' });
      }

    } catch (err) {
      console.error('Fetch data error:', err);
      setErrorMsg('Не удалось обновить альбом. Проверьте соединение с интернетом.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Logout action
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setPhotos([]);
    setStorage({ used: 0, limit: 1073741824 });
  };

  // One-click demo login for local tests
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
    } catch (e) {
      alert(e.message);
      setLoading(false);
    }
  };

  // If not logged in, show Hero screen
  if (!token) {
    return <Hero onDemoLogin={handleDemoLogin} />;
  }

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col selection:bg-brand-200">
      {/* Authenticated Sticky Glass Header */}
      <header className="sticky top-0 z-40 w-full glass-header py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-400 to-brand-600 flex items-center justify-center text-brand-50 shadow-sm">
              <Camera className="w-4.5 h-4.5" />
            </div>
            <span className="font-serif font-bold text-lg tracking-tight text-brand-900 hidden sm:inline">
              Легко Сохранить
            </span>
          </div>

          {/* User profile & logout controls */}
          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-brand-100/60 px-3 py-1.5 rounded-full border border-brand-200/20">
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

        {loading && photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-brand-600">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-brand-400" />
            <span className="text-sm font-medium">Открываем ваш фотоальбом...</span>
          </div>
        ) : (
          <>
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

            {/* 1. Drag & drop upload box */}
            <UploadZone token={token} onUploadComplete={fetchData} />

            {/* 2. Divider line */}
            <div className="w-full h-[1px] bg-brand-200/50 my-10 max-w-2xl mx-auto"></div>

            {/* 3. Photo gallery list */}
            <Gallery 
              photos={photos} 
              storage={storage} 
              token={token} 
            />
          </>
        )}
      </main>
      
      {/* Footer stamp */}
      <footer className="w-full py-8 text-center text-[10px] text-brand-400 font-semibold tracking-wider uppercase bg-brand-100/20 mt-12 border-t border-brand-200/20">
        © 2026 ЛЕГКОСОХРАНИТЬ.РФ — БЕЗОПАСНАЯ ГАЛЕРЕЯ
      </footer>
    </div>
  );
}
