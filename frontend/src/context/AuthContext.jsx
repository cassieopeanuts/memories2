'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [betaUnlocked, setBetaUnlocked] = useState(false);
  const [user, setUser] = useState(null);
  const [hasPin, setHasPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [storage, setStorage] = useState({ used: 0, limit: 1073741824 });
  const [loading, setLoading] = useState(true);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';

  // Helper to set cookie for Next.js middleware access
  const setTokenCookie = (jwtToken) => {
    if (jwtToken) {
      const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
      document.cookie = `token=${jwtToken}; path=/; max-age=31536000; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    } else {
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedBeta = localStorage.getItem('beta_unlocked') === 'true';
    setToken(savedToken);
    setBetaUnlocked(savedBeta);
    setMounted(true);
  }, []);

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
          try {
            const accountsStr = localStorage.getItem('yandex_accounts') || '[]';
            const accounts = JSON.parse(accountsStr);
            const updated = accounts.filter(acc => acc.token !== token);
            localStorage.setItem('yandex_accounts', JSON.stringify(updated));
          } catch (e) {
            console.error('Error cleaning up yandex_accounts on auth failure:', e);
          }
          handleLogout();
          return;
        }
        throw new Error(data.error || 'Ошибка загрузки профиля');
      }

      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        acceptedOffer: data.acceptedOffer,
        acceptedOfferAt: data.acceptedOfferAt,
        acceptedOfferVersion: data.acceptedOfferVersion,
        cardMask: data.cardMask,
        cardBrand: data.cardBrand
      });

      if (data.yandexId) {
        try {
          const accountsStr = localStorage.getItem('yandex_accounts') || '[]';
          const accounts = JSON.parse(accountsStr);
          const updated = accounts.filter(acc => acc.yandexId !== data.yandexId && acc.email !== data.email);
          updated.push({
            id: data.id,
            name: data.name,
            email: data.email,
            yandexId: data.yandexId,
            token: token
          });
          localStorage.setItem('yandex_accounts', JSON.stringify(updated));
        } catch (e) {
          console.error('Error saving Yandex account to localStorage:', e);
        }
      }
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
    if (mounted && token) {
      checkProfile();
    } else if (mounted && !token) {
      setLoading(false);
    }
  }, [token, mounted]);

  useEffect(() => {
    if (mounted && pinVerified) {
      fetchStorageStats();
    }
  }, [pinVerified, mounted]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setTokenCookie(null);
    setToken(null);
    setUser(null);
    setHasPin(false);
    setPinVerified(false);
    setStorage({ used: 0, limit: 1073741824 });
  };

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
      setTokenCookie(data.token);
      setToken(data.token);
      setUser(data.user);
      setHasPin(data.user.hasPin);
      setPinVerified(false);
    } catch (e) {
      setErrorMsg(e.message);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLoginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    setTokenCookie(data.token);
    setToken(data.token);
    setUser(data.user);
    setHasPin(data.status === 'verify_pin');
    setPinVerified(false);
  };

  const unlockBeta = () => {
    localStorage.setItem('beta_unlocked', 'true');
    setBetaUnlocked(true);
  };

  return (
    <AuthContext.Provider value={{
      token,
      setToken,
      setTokenCookie,
      betaUnlocked,
      unlockBeta,
      user,
      setUser,
      hasPin,
      setHasPin,
      pinVerified,
      setPinVerified,
      storage,
      setStorage,
      loading,
      isCheckingProfile,
      errorMsg,
      setErrorMsg,
      checkProfile,
      fetchStorageStats,
      handleLogout,
      handleDemoLogin,
      handleEmailLoginSuccess,
      mounted
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
