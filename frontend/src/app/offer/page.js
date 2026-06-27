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
        <Offer onBack={() => router.back()} />
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
