'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('classic');
  const [font, setFont] = useState('classic');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'classic';
    const savedFont = localStorage.getItem('font') || 'classic';
    setTheme(savedTheme);
    setFont(savedFont);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme, mounted]);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-font', font);
      localStorage.setItem('font', font);
    }
  }, [font, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, font, setFont, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
