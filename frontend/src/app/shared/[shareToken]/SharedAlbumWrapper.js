'use client';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import SharedAlbum from '@/components/SharedAlbum';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import TesterFeedback from '@/components/TesterFeedback';

export default function SharedAlbumWrapper({ shareToken }) {
  const { token, user } = useAuth();
  const { theme, setTheme, font, setFont } = useTheme();

  return (
    <div className="min-h-screen bg-brand-50 relative flex flex-col justify-between overflow-x-hidden">
      <SharedAlbum 
        shareToken={shareToken}
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
