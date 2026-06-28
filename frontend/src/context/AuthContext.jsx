'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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

  const registerPushNotifications = async (activeToken) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Web Push notifications are not supported in this browser.');
      return;
    }

    console.log('[Push SDK] Checking service worker and push manager...');

    try {
      // 1. Fetch VAPID public key
      const res = await fetch(`${backendUrl}/api/auth/vapid-public-key`);
      const { publicKey } = await res.json();
      console.log('[Push SDK] Public Key loaded:', publicKey);
      if (!publicKey) return;

      // 2. Request permission
      console.log('[Push SDK] Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('[Push SDK] Notification permission status:', permission);
      if (permission !== 'granted') {
        console.log('Push notification permission denied.');
        return;
      }

      // 3. Subscribe
      console.log('[Push SDK] Subscribing via Service Worker...');
      const registration = await navigator.serviceWorker.ready;
      console.log('[Push SDK] Service Worker registration ready:', registration);
      
      let subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Compare the existing subscription key with the new VAPID public key
        const currentKey = subscription.options.applicationServerKey;
        const newKey = urlBase64ToUint8Array(publicKey);
        let keyMatches = false;
        
        if (currentKey) {
          const currentKeyArray = new Uint8Array(currentKey);
          if (currentKeyArray.length === newKey.length) {
            keyMatches = currentKeyArray.every((val, index) => val === newKey[index]);
          }
        }
        
        if (!keyMatches) {
          console.log('[Push SDK] VAPID key changed/mismatched. Unsubscribing old subscription...');
          await subscription.unsubscribe();
          subscription = null;
        } else {
          console.log('[Push SDK] Existing subscription VAPID key matches current server key.');
        }
      }

      if (!subscription) {
        console.log('[Push SDK] Creating new subscription with VAPID key...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }
      console.log('[Push SDK] Final subscription:', subscription);

      // 4. Save to backend
      console.log('[Push SDK] Sending subscription to backend...');
      const saveRes = await fetch(`${backendUrl}/api/auth/push-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify(subscription)
      });
      const saveResult = await saveRes.json();
      console.log('[Push SDK] Backend registration result:', saveResult);

      console.log('Web Push subscription successfully registered!');
    } catch (error) {
      console.error('Error setting up Web Push:', error);
    }
  };

  useEffect(() => {
    if (mounted && token) {
      checkProfile();
      registerPushNotifications(token);
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
