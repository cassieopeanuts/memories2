'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RefreshCw } from 'lucide-react';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setToken, setTokenCookie, setPinVerified } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Save token in localStorage and cookie
      localStorage.setItem('token', token);
      setTokenCookie(token);
      setToken(token);
      setPinVerified(false);
      
      // Redirect to dashboard
      router.replace('/dashboard');
    } else {
      // If no token, redirect to home
      router.replace('/');
    }
  }, [searchParams, router, setToken, setTokenCookie, setPinVerified]);

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-brand-200/50 text-brand-600 flex items-center justify-center mb-6 shadow-inner animate-spin">
        <RefreshCw className="w-6 h-6 text-brand-500" />
      </div>
      <h2 className="font-serif text-xl md:text-2xl text-brand-900 font-bold mb-2">
        Вход в систему...
      </h2>
      <p className="text-xs text-brand-600 font-light max-w-xs leading-relaxed">
        Пожалуйста, подождите. Мы настраиваем ваше личное семейное хранилище.
      </p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-200/50 text-brand-600 flex items-center justify-center mb-6 shadow-inner animate-spin">
          <RefreshCw className="w-6 h-6 text-brand-500" />
        </div>
        <h2 className="font-serif text-xl md:text-2xl text-brand-900 font-bold mb-2">
          Загрузка...
        </h2>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
