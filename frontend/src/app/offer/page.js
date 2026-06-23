'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Offer from '@/components/Offer';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import TesterFeedback from '@/components/TesterFeedback';
import { X } from 'lucide-react';

export default function OfferPage() {
  const { token, user } = useAuth();
  const { theme, setTheme, font, setFont } = useTheme();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-brand-50 relative flex flex-col justify-between overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 py-8 relative">
        <button 
          onClick={() => router.back()}
          className="absolute top-8 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-200 hover:bg-brand-100/50 text-brand-600 transition cursor-pointer text-xs font-semibold"
        >
          <X className="w-3.5 h-3.5" /> Назад
        </button>
        <Offer />
      </div>
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
