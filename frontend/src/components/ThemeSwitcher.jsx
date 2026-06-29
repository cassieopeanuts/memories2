import React, { useState, useEffect, useRef } from 'react';
import { Palette, Check, Type } from 'lucide-react';

const themes = [
  { id: 'classic', name: 'Классика 🌸', colors: ['#fff6eb', '#fcf0e1', '#d69fac', '#ca727f', '#232334'] },
  { id: 'lilac', name: 'Сирень 🪻', colors: ['#FAF3F1', '#E1C0BA', '#DAB7C7', '#AD7872', '#2D2325'] },
  { id: 'sakura', name: 'Сакура 💮', colors: ['#F8F5F6', '#E3DADD', '#B7A0A7', '#A2747B', '#33251E'] },
  { id: 'mint', name: 'Мята 🌿', colors: ['#FAF4F5', '#D1B4B6', '#93C4C0', '#7CB488', '#2E2D36'] },
  { id: 'autumn', name: 'Осень 🍁', colors: ['#FAF3F0', '#E1C3B8', '#D8A39B', '#8B664F', '#332B2A'] },
  { id: 'peony', name: 'Пион 🪷', colors: ['#FAF5F6', '#f8afc9', '#c0708b', '#7e3748', '#54525a'] },
  { id: 'black-peony', name: 'Черный Пион 🖤', colors: ['#110b0d', '#1c1215', '#572f37', '#d95c7b', '#FAF5F6'] },
  { id: 'flamingo', name: 'Фламинго 🦩', colors: ['#F7F2F1', '#c5bbba', '#c685b2', '#733651', '#000000'] },
  { id: 'peony2', name: 'Пеон 2 🪷', colors: ['#FCF8F9', '#F5DFE4', '#c27a92', '#8a2b40', '#1c1214'] },
  { id: 'marshmallow', name: 'Зефир ☕', colors: ['#FAF6F8', '#eed1e2', '#ae84a0', '#7f2852', '#0a0a18'] },
  { id: 'dark-classic', name: 'Темная Классика 🖤', colors: ['#120d08', '#1d1610', '#33251c', '#ca727f', '#fff6eb'] },
  { id: 'dark-lilac', name: 'Темная Сирень 🖤', colors: ['#0f0b0d', '#1c1218', '#33202d', '#AD7872', '#FAF3F1'] },
  { id: 'dark-sakura', name: 'Темная Сакура 🖤', colors: ['#100b0c', '#1d1215', '#331e24', '#A2747B', '#F8F5F6'] },
  { id: 'dark-mint', name: 'Темная Мята 🖤', colors: ['#0b0f0c', '#121c16', '#1e3328', '#7CB488', '#FAF4F5'] },
  { id: 'dark-autumn', name: 'Темная Осень 🖤', colors: ['#0f0c0b', '#1c1512', '#33241d', '#8B664F', '#FAF3F0'] },
  { id: 'dark-peony', name: 'Темный Пион 🖤', colors: ['#110b0d', '#1c1215', '#382025', '#d95c7b', '#FAF5F6'] },
  { id: 'dark-peony2', name: 'Темный Пион 2 🖤', colors: ['#12090b', '#1e1013', '#3a1c22', '#a83950', '#FCF8F9'] },
  { id: 'dark-flamingo', name: 'Темный Фламинго 🖤', colors: ['#0c0708', '#1a1012', '#331a20', '#c685b2', '#F7F2F1'] },
  { id: 'dark-marshmallow', name: 'Темный Зефир 🖤', colors: ['#0b090a', '#1a1417', '#33222b', '#ae84a0', '#FAF6F8'] },
];

const fonts = [
  { id: 'classic', name: 'Стандартный (Inter) 🌸', family: 'Inter, sans-serif' },
  { id: 'poiret-one', name: 'Пуаре Ван (Poiret) 📐', family: '"Poiret One", sans-serif' },
  { id: 'raleway', name: 'Рэйлвэй (Raleway) 🌸', family: '"Raleway", sans-serif' },
  { id: 'tenor-sans', name: 'Тенор Санс (Tenor) 📅', family: '"Tenor Sans", sans-serif' },
  { id: 'ysabeau-infant', name: 'Изабо Инфант (Ysabeau) ✍️', family: '"Ysabeau Infant", sans-serif' },
  { id: 'bona-nova', name: 'Бона Нова (Bona Nova) 📜', family: '"Bona Nova", serif' },
  { id: 'fira-code', name: 'Фира Код (Fira Code) 💻', family: '"Fira Code", monospace' }
];

export default function ThemeSwitcher({ currentTheme, onThemeSelect, currentFont, onFontSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('themes'); // 'themes' or 'fonts'
  const containerRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="fixed bottom-6 left-6 z-[999]">
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-brand-400/20 group"
        title="Оформление сайта"
      >
        <Palette className="w-6 h-6 transition-transform duration-500 group-hover:rotate-12" />
      </button>

      {/* Theme/Font Picker Dropup Panel */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 w-72 bg-white/90 border border-brand-200/40 rounded-3xl p-4 shadow-2xl backdrop-blur-xl animate-photo-entry select-none">
          
          {/* Header & Sub-tab Switcher */}
          <div className="mb-3 pb-2 border-b border-brand-100/60">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-serif text-sm font-bold text-brand-900">
                Оформление
              </h4>
              <span className="text-[9px] text-brand-500 font-bold uppercase tracking-wider">
                Кастомизация
              </span>
            </div>
            
            {/* Tabs toggle */}
            <div className="flex bg-brand-100/60 p-0.5 rounded-xl border border-brand-200/20 text-[10px] font-bold uppercase tracking-wider">
              <button
                onClick={() => setActiveSubTab('themes')}
                className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                  activeSubTab === 'themes' 
                    ? 'bg-white text-brand-900 shadow-sm' 
                    : 'text-brand-600 hover:text-brand-900'
                }`}
              >
                Палитры
              </button>
              <button
                onClick={() => setActiveSubTab('fonts')}
                className={`flex-1 py-1 rounded-lg transition-all cursor-pointer text-center ${
                  activeSubTab === 'fonts' 
                    ? 'bg-white text-brand-900 shadow-sm' 
                    : 'text-brand-600 hover:text-brand-900'
                }`}
              >
                Шрифты
              </button>
            </div>
          </div>

          {/* Sub-tab Content: Themes */}
          {activeSubTab === 'themes' && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {themes.map((theme) => {
                const isActive = currentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      onThemeSelect(theme.id);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer text-left
                      ${isActive 
                        ? 'bg-brand-100/40 border-brand-500/50 shadow-sm' 
                        : 'border-transparent hover:bg-brand-100/20'
                      }
                    `}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-brand-900">
                        {theme.name}
                      </span>
                      <div className="flex gap-1.5 mt-0.5">
                        {theme.colors.map((color, cIdx) => (
                          <span
                            key={cIdx}
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    {isActive && (
                      <Check className="w-4 h-4 text-brand-500 shrink-0 mr-1" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sub-tab Content: Fonts */}
          {activeSubTab === 'fonts' && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {fonts.map((f) => {
                const isActive = currentFont === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      onFontSelect(f.id);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer text-left
                      ${isActive 
                        ? 'bg-brand-100/40 border-brand-500/50 shadow-sm' 
                        : 'border-transparent hover:bg-brand-100/20'
                      }
                    `}
                  >
                    <div className="flex flex-col">
                      <span 
                        className="text-xs text-brand-900"
                        style={{ fontFamily: f.family, fontWeight: 'normal' }}
                      >
                        {f.name}
                      </span>
                      <span 
                        className="text-[9px] text-brand-400 mt-0.5"
                        style={{ fontFamily: f.family }}
                      >
                        Быстрая лиса прыгает через ленивую собаку
                      </span>
                    </div>
                    {isActive && (
                      <Check className="w-4 h-4 text-brand-500 shrink-0 mr-1 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
