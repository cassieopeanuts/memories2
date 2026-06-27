'use client';

import { useState, useEffect } from 'react';
import BetaLock from './BetaLock';

export default function BetaWrapper({ children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isUnlocked = localStorage.getItem('beta_unlocked') === 'true';
      setUnlocked(isUnlocked);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!unlocked) {
    return <BetaLock onSuccess={() => setUnlocked(true)} />;
  }

  return children;
}
