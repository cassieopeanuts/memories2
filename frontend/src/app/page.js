'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Hero from '@/components/Hero';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import TesterFeedback from '@/components/TesterFeedback';

export default function Home() {
  const { token, handleEmailLoginSuccess, handleDemoLogin, errorMsg, setErrorMsg, loading, user } = useAuth();
  const { theme, setTheme, font, setFont } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    }
  }, [token, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-brand-50 relative flex flex-col justify-between overflow-x-hidden">
      <Hero 
        onEmailLoginSuccess={handleEmailLoginSuccess}
        onDemoLogin={handleDemoLogin}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
      />
      <ThemeSwitcher 
        currentTheme={theme} 
        onThemeSelect={setTheme} 
        currentFont={font} 
        onFontSelect={setFont} 
      />
      <TesterFeedback token={token} user={user} />
    </div>
  );
}
