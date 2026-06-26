import React, { useState } from 'react';
import { 
  Palette, Check, Copy, Sparkles, Heart, Plus, Folder, 
  UploadCloud, ShieldCheck, CreditCard, CheckCircle2, AlertCircle, RefreshCw, Type 
} from 'lucide-react';

const themes = [
  { 
    id: 'classic', 
    name: 'Классическая сакура 🌸', 
    desc: 'Базовая нежная палитра в персиковых и пастельно-розовых тонах.',
    colors: [
      { name: 'Фон (50)', hex: '#fff6eb' },
      { name: 'Карточки (100)', hex: '#fcf0e1' },
      { name: 'Мягкий акцент (200)', hex: '#d69fac' },
      { name: 'Доп. акцент (300)', hex: '#d69fac' },
      { name: 'Приглушенный текст (400)', hex: '#898999' },
      { name: 'Основной бренд (500)', hex: '#ca727f' },
      { name: 'Ховер бренда (600)', hex: '#b8626e' },
      { name: 'Активный бренд (700)', hex: '#a3535f' },
      { name: 'Темный акцент (800)', hex: '#3a3a4d' },
      { name: 'Основной текст (900)', hex: '#232334' }
    ]
  },
  { 
    id: 'lilac', 
    name: 'Сиреневый туман 🪻', 
    desc: 'Изысканные холодные тона сирени, лаванды и глубокой сливы.',
    colors: [
      { name: 'Фон (50)', hex: '#FAF3F1' },
      { name: 'Карточки (100)', hex: '#E1C0BA' },
      { name: 'Мягкий акцент (200)', hex: '#DAB7C7' },
      { name: 'Доп. акцент (300)', hex: '#CFA3B6' },
      { name: 'Приглушенный текст (400)', hex: '#8B787D' },
      { name: 'Основной бренд (500)', hex: '#AD7872' },
      { name: 'Ховер бренда (600)', hex: '#9C6660' },
      { name: 'Активный бренд (700)', hex: '#8A5550' },
      { name: 'Темный акцент (800)', hex: '#5C4353' },
      { name: 'Основной текст (900)', hex: '#2D2325' }
    ]
  },
  { 
    id: 'sakura', 
    name: 'Весенняя сакура 💮', 
    desc: 'Контрастное и уютное сочетание цветов цветущей вишни и коры дерева.',
    colors: [
      { name: 'Фон (50)', hex: '#F8F5F6' },
      { name: 'Карточки (100)', hex: '#E3DADD' },
      { name: 'Мягкий акцент (200)', hex: '#B7A0A7' },
      { name: 'Доп. акцент (300)', hex: '#A68B93' },
      { name: 'Приглушенный текст (400)', hex: '#726756' },
      { name: 'Основной бренд (500)', hex: '#A2747B' },
      { name: 'Ховер бренда (600)', hex: '#8C5F66' },
      { name: 'Активный бренд (700)', hex: '#774D53' },
      { name: 'Темный акцент (800)', hex: '#534136' },
      { name: 'Основной текст (900)', hex: '#33251E' }
    ]
  },
  { 
    id: 'mint', 
    name: 'Мятный дворик 🌿', 
    desc: 'Освежающие оттенки мяты и бирюзы на фоне нежно-пыльной розы.',
    colors: [
      { name: 'Фон (50)', hex: '#FAF4F5' },
      { name: 'Карточки (100)', hex: '#D1B4B6' },
      { name: 'Мягкий акцент (200)', hex: '#93C4C0' },
      { name: 'Доп. акцент (300)', hex: '#7CAEAA' },
      { name: 'Приглушенный текст (400)', hex: '#AA9084' },
      { name: 'Основной бренд (500)', hex: '#7CB488' },
      { name: 'Ховер бренда (600)', hex: '#669E72' },
      { name: 'Активный бренд (700)', hex: '#52875D' },
      { name: 'Темный акцент (800)', hex: '#51505C' },
      { name: 'Основной текст (900)', hex: '#2E2D36' }
    ]
  },
  { 
    id: 'autumn', 
    name: 'Осень в парке 🍁', 
    desc: 'Благородные теплые тона опавших листьев, грецкого ореха и оливы.',
    colors: [
      { name: 'Фон (50)', hex: '#FAF3F0' },
      { name: 'Карточки (100)', hex: '#E1C3B8' },
      { name: 'Мягкий акцент (200)', hex: '#D8A39B' },
      { name: 'Доп. акцент (300)', hex: '#C98E85' },
      { name: 'Приглушенный текст (400)', hex: '#928E5D' },
      { name: 'Основной бренд (500)', hex: '#8B664F' },
      { name: 'Ховер бренда (600)', hex: '#76543F' },
      { name: 'Активный бренд (700)', hex: '#614331' },
      { name: 'Темный акцент (800)', hex: '#574C4A' },
      { name: 'Основной текст (900)', hex: '#332B2A' }
    ]
  },
  { 
    id: 'peony', 
    name: 'Нежный пион 🪷', 
    desc: 'Гармоничное сочетание пыльной розы, мягкого серого сланца и благородного бордо.',
    colors: [
      { name: 'Фон (50)', hex: '#FAF5F6' },
      { name: 'Карточки (100)', hex: '#f8afc9' },
      { name: 'Мягкий акцент (200)', hex: '#c0708b' },
      { name: 'Доп. акцент (300)', hex: '#a95c75' },
      { name: 'Приглушенный текст (400)', hex: '#71737e' },
      { name: 'Основной бренд (500)', hex: '#7e3748' },
      { name: 'Ховер бренда (600)', hex: '#6b2e3c' },
      { name: 'Активный бренд (700)', hex: '#582430' },
      { name: 'Темный акцент (800)', hex: '#54525a' },
      { name: 'Основной текст (900)', hex: '#2c2b30' }
    ]
  }
];

const fontsList = [
  { id: 'classic', name: 'Стандартный (Inter) 🌸', family: 'Inter, sans-serif', desc: 'Строгий, современный гротеск. Отличная читаемость для больших объемов текста.' },
  { id: 'poiret-one', name: 'Пуаре Ван (Poiret One) 📐', family: '"Poiret One", sans-serif', desc: 'Элегантный геометрический гротеск в стиле арт-деко. Отлично подходит для заголовков.' },
  { id: 'raleway', name: 'Рэйлвэй (Raleway) 🌸', family: '"Raleway", sans-serif', desc: 'Стильный и чистый нео-гротеск с характерными начертаниями букв. Универсальный выбор.' },
  { id: 'tenor-sans', name: 'Тенор Санс (Tenor Sans) 📅', family: '"Tenor Sans", sans-serif', desc: 'Гуманистический гротеск, разработанный специально для высокой моды и премиального брендинга.' },
  { id: 'ysabeau-infant', name: 'Изабо Инфант (Ysabeau Infant) ✍️', family: '"Ysabeau Infant", sans-serif', desc: 'Изящный и изысканный шрифт без засечек, вдохновленный классическими антиквами.' },
  { id: 'bona-nova', name: 'Бона Нова (Bona Nova) 📜', family: '"Bona Nova", serif', desc: 'Элегантный контрастный шрифт с засечками, воссозданный на основе исторических польских шрифтовых традиций.' },
  { id: 'fira-code', name: 'Фира Код (Fira Code) 💻', family: '"Fira Code", monospace', desc: 'Моноширинный шрифт со специальными программными лигатурами. Отличается высокой геометрической строгостью.' }
];

export default function PalettesPlayground({ currentTheme, onThemeChange, currentFont, onFontChange }) {
  const [activeTab, setActiveTab] = useState('buttons'); // 'buttons', 'cards', 'alerts', 'lockscreen', 'system'
  const [copiedColor, setCopiedColor] = useState(null);
  const [pinDots, setPinDots] = useState('');
  const selectedThemeInfo = themes.find(t => t.id === currentTheme) || themes[0];

  const handleCopyPalette = (themeObj) => {
    const hexList = themeObj.colors.map(c => `${c.name}: ${c.hex}`).join('\n');
    navigator.clipboard.writeText(hexList);
    setCopiedColor(themeObj.id);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const handleCopySingleColor = (hex) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 1500);
  };

  const handlePinClick = (num) => {
    if (pinDots.length < 4) {
      setPinDots(prev => prev + num);
    }
  };

  return (
    <div className="space-y-10 animate-photo-entry">
      
      {/* Page Title & Intro */}
      <div className="text-center max-w-xl mx-auto">
        <div className="inline-flex bg-brand-100 p-2 rounded-2xl mb-4 border border-brand-200/40 text-brand-500">
          <Palette className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="font-serif text-2xl md:text-3xl text-brand-900 font-semibold mb-3">
          Тестирование дизайна и палитр
        </h3>
        <p className="text-xs text-brand-900 font-light leading-relaxed">
          Переключайте цветовые схемы и наблюдайте, как мгновенно преображается весь интерфейс. На этой странице вы можете увидеть все компоненты сайта в реальном времени.
        </p>
      </div>

      {/* Theme Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map((t) => {
          const isActive = t.id === currentTheme;
          return (
            <div 
              key={t.id}
              className={`bg-white border rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 relative select-none
                ${isActive 
                  ? 'border-brand-500 ring-2 ring-brand-500/25 bg-brand-100/10' 
                  : 'border-brand-200/40 hover:border-brand-400 hover:scale-[1.01] card-hover'
                }
              `}
            >
              {isActive && (
                <span className="absolute -top-3 right-6 px-3 py-1 bg-brand-500 text-white text-[9px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                  Активна
                </span>
              )}
              
              <div>
                <h4 className="font-serif font-bold text-base text-brand-900 mb-1">
                  {t.name}
                </h4>
                <p className="text-[11px] text-brand-400 font-medium mb-3">
                  ID: <code className="bg-brand-100/50 px-1 py-0.5 rounded text-brand-600">{t.id}</code>
                </p>
                <p className="text-xs text-brand-900 font-light leading-relaxed mb-4">
                  {t.desc}
                </p>

                {/* Color swatches preview */}
                <div className="grid grid-cols-5 gap-1.5 mb-5 bg-brand-50/50 p-2.5 rounded-2xl border border-brand-200/10">
                  {t.colors.slice(0, 5).map((c, idx) => (
                    <div 
                      key={idx} 
                      className="group/swatch relative flex flex-col items-center cursor-pointer"
                      onClick={() => handleCopySingleColor(c.hex)}
                      title={`Нажмите, чтобы скопировать ${c.hex}`}
                    >
                      <div 
                        className="w-full h-8 rounded-lg border border-black/10 transition-transform active:scale-90"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-[8px] font-mono text-brand-600 mt-1 scale-90">
                        {c.hex}
                      </span>
                    </div>
                  ))}
                  {t.colors.slice(5, 10).map((c, idx) => (
                    <div 
                      key={idx} 
                      className="group/swatch relative flex flex-col items-center cursor-pointer"
                      onClick={() => handleCopySingleColor(c.hex)}
                      title={`Нажмите, чтобы скопировать ${c.hex}`}
                    >
                      <div 
                        className="w-full h-8 rounded-lg border border-black/10 transition-transform active:scale-90"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-[8px] font-mono text-brand-600 mt-1 scale-90">
                        {c.hex}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 border-t border-brand-100/50 pt-4">
                <button
                  onClick={() => onThemeChange(t.id)}
                  disabled={isActive}
                  className={`flex-1 text-[11px] font-bold uppercase tracking-wider py-2 rounded-xl transition-all cursor-pointer text-center
                    ${isActive 
                      ? 'bg-brand-100 text-brand-400 cursor-default' 
                      : 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm hover:scale-[1.02] active:scale-95'
                    }
                  `}
                >
                  Применить
                </button>
                <button
                  onClick={() => handleCopyPalette(t)}
                  className="px-3 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-xl border border-brand-200 transition-colors flex items-center justify-center cursor-pointer"
                  title="Скопировать HEX-коды палитры"
                >
                  {copiedColor === t.id ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Font Cards Grid */}
      <div className="space-y-4 pt-4 border-t border-brand-200/20">
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-brand-100 p-1.5 rounded-xl border border-brand-200/20 text-brand-500">
            <Type className="w-4 h-4" />
          </div>
          <h4 className="font-serif text-base font-bold text-brand-900">Выбор шрифта для сайта</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fontsList.map((f) => {
            const isActive = f.id === currentFont;
            return (
              <div 
                key={f.id}
                className={`bg-white border rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 relative select-none
                  ${isActive 
                    ? 'border-brand-500 ring-2 ring-brand-500/25 bg-brand-100/10' 
                    : 'border-brand-200/40 hover:border-brand-400 hover:scale-[1.01] card-hover'
                  }
                `}
              >
                {isActive && (
                  <span className="absolute -top-3 right-6 px-3 py-1 bg-brand-500 text-white text-[9px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                    Активен
                  </span>
                )}
                
                <div>
                  <h4 className="text-base text-brand-900 mb-1" style={{ fontFamily: f.family, fontWeight: 'bold' }}>
                    {f.name}
                  </h4>
                  <p className="text-[10px] text-brand-400 font-medium mb-3">
                    Семейство: <code className="bg-brand-100/50 px-1 py-0.5 rounded text-brand-600">{f.family.split(',')[0]}</code>
                  </p>
                  <p className="text-xs text-brand-900 font-light leading-relaxed mb-4">
                    {f.desc}
                  </p>

                  {/* Font Pangram Preview */}
                  <div className="bg-brand-50/50 p-3.5 rounded-2xl border border-brand-200/10 mb-5 select-text">
                    <p className="text-sm text-brand-900 leading-normal" style={{ fontFamily: f.family }}>
                      Съешь ещё этих мягких французских булок, да выпей же чаю.
                    </p>
                    <p className="text-[9px] text-brand-400 mt-2 font-semibold uppercase tracking-wider leading-none">
                      ABCDEF abcdef 12345
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-brand-100/50 pt-4">
                  <button
                    onClick={() => onFontChange(f.id)}
                    disabled={isActive}
                    className={`flex-1 text-[11px] font-bold uppercase tracking-wider py-2 rounded-xl transition-all cursor-pointer text-center
                      ${isActive 
                        ? 'bg-brand-100 text-brand-400 cursor-default' 
                        : 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm hover:scale-[1.02] active:scale-95'
                      }
                    `}
                  >
                    Применить шрифт
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected theme details banner */}
      <div className="bg-white/70 border border-brand-200/30 p-6 rounded-[28px] shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 backdrop-blur-sm">
        <div className="flex-1 space-y-2 text-center lg:text-left">
          <h4 className="font-serif text-lg font-bold text-brand-900">
            Детальный состав: {selectedThemeInfo.name}
          </h4>
          <p className="text-xs text-brand-900 font-light max-w-xl">
            Ниже приведены переменные, которые переназначаются в файле <code className="bg-brand-100/50 px-1 py-0.5 rounded text-brand-600 font-mono text-[10px]">index.css</code>. Вы можете скопировать отдельный цвет, кликнув по его Hex-коду.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {selectedThemeInfo.colors.map((c, idx) => (
            <div 
              key={idx}
              onClick={() => handleCopySingleColor(c.hex)}
              className="bg-white hover:bg-brand-50 border border-brand-200/40 pl-2 pr-3 py-1.5 rounded-2xl flex items-center gap-2 cursor-pointer transition-colors shadow-sm select-none"
              title="Скопировать Hex"
            >
              <span className="w-4 h-4 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: c.hex }} />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-brand-500 uppercase tracking-wide leading-none">{c.name}</span>
                <span className="text-[10px] font-mono text-brand-900 font-bold leading-none mt-0.5">
                  {c.hex} {copiedColor === c.hex && '✓'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COMPONENT TEST BENCH CONTAINER */}
      <div className="border border-brand-200/30 rounded-[32px] overflow-hidden bg-white/40 shadow-md backdrop-blur-md">
        
        {/* Test Bench Header */}
        <div className="bg-brand-100/50 px-6 py-5 border-b border-brand-200/20 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h4 className="font-serif text-lg font-bold text-brand-900">
              Тестовый стенд компонентов (Интерактивный)
            </h4>
            <p className="text-[10px] text-brand-500 font-semibold uppercase tracking-wider mt-0.5">
              Живое отображение элементов интерфейса
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-white/70 p-1 rounded-full border border-brand-200/20 text-[10px] font-bold uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('buttons')}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'buttons' ? 'bg-brand-500 text-white shadow-sm' : 'text-brand-600 hover:text-brand-900'
              }`}
            >
              Кнопки
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'cards' ? 'bg-brand-500 text-white shadow-sm' : 'text-brand-600 hover:text-brand-900'
              }`}
            >
              Карточки
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'system' ? 'bg-brand-500 text-white shadow-sm' : 'text-brand-600 hover:text-brand-900'
              }`}
            >
              Система
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'alerts' ? 'bg-brand-500 text-white shadow-sm' : 'text-brand-600 hover:text-brand-900'
              }`}
            >
              Статусы
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="p-8 bg-white/60">
          
          {/* 1. BUTTONS & CONTROLS */}
          {activeTab === 'buttons' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                
                {/* Primary Button */}
                <div className="space-y-2 border border-brand-200/20 p-4 rounded-2xl bg-white/50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand-500">Кнопка действия (Primary)</span>
                  <button className="w-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.98]">
                    Сохранить изменения
                  </button>
                </div>

                {/* Secondary Button */}
                <div className="space-y-2 border border-brand-200/20 p-4 rounded-2xl bg-white/50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand-500">Второстепенная (Secondary)</span>
                  <button className="w-full text-xs text-brand-600 hover:text-brand-900 transition-colors font-medium border border-brand-200 hover:bg-brand-100/30 px-4 py-3 rounded-2xl cursor-pointer">
                    Отмена
                  </button>
                </div>

                {/* Icon Button */}
                <div className="space-y-2 border border-brand-200/20 p-4 rounded-2xl bg-white/50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand-500">Смешанная с иконкой</span>
                  <button className="w-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    <span>Добавить фото</span>
                  </button>
                </div>
              </div>

              {/* Inputs and selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-brand-100/50">
                <div className="space-y-3">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand-500 block">Поля ввода (Inputs)</span>
                  <input 
                    type="text" 
                    placeholder="Введите название альбома..." 
                    className="w-full px-3.5 py-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-brand-900 focus:outline-none focus:border-brand-500 transition-colors font-medium"
                    defaultValue="Сентябрьская поездка"
                  />
                  <textarea 
                    rows="2"
                    placeholder="Описание..." 
                    className="w-full px-3.5 py-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-brand-900 focus:outline-none focus:border-brand-500 transition-colors font-medium resize-none"
                    defaultValue="Теплые дни у воды, семейный пикник и много смеха."
                  />
                </div>

                {/* mini tabs preview */}
                <div className="space-y-4">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand-500 block">Переключатель вкладок</span>
                  <div className="flex bg-brand-100/60 p-1 rounded-full border border-brand-200/20 text-xs font-semibold w-max">
                    <button className="bg-white text-brand-900 shadow-sm px-4 py-1.5 rounded-full cursor-pointer">Сетка</button>
                    <button className="text-brand-600 hover:text-brand-900 px-4 py-1.5 rounded-full cursor-pointer">Список</button>
                  </div>
                  
                  {/* tag chips */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-brand-500 block">Метки (Chips)</span>
                    <div className="flex gap-2 flex-wrap">
                      <span className="bg-brand-500 text-white text-[10px] font-medium px-2.5 py-1 rounded-full shadow-sm">Семья</span>
                      <span className="bg-brand-100 text-brand-800 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-brand-200/30">Природа</span>
                      <span className="bg-brand-100 text-brand-800 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-brand-200/30">2026</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CONTENT CARDS */}
          {activeTab === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Photo Card Mockup */}
              <div className="bg-white border border-brand-200/40 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between select-none">
                <div className="relative aspect-[4/3] bg-brand-100/50 flex items-center justify-center overflow-hidden">
                  {/* Decorative placeholder representing image */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand-300/30 to-brand-500/20 flex flex-col items-center justify-center p-4">
                    <Sparkles className="w-10 h-10 text-brand-500/70 mb-2" />
                    <span className="text-[10px] text-brand-600 font-bold uppercase tracking-wider">Момент воспоминания</span>
                  </div>
                  
                  <span className="absolute top-3 left-3 bg-white/80 backdrop-blur-sm text-brand-900 text-[9px] font-bold px-2 py-0.5 rounded-full border border-brand-200/10">
                    20 июня 2026
                  </span>

                  <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-brand-600 hover:text-red-500 flex items-center justify-center transition-colors shadow-sm cursor-pointer">
                    <Heart className="w-4 h-4 fill-brand-500/10" />
                  </button>
                </div>

                <div className="p-4 space-y-2">
                  <h5 className="font-serif font-bold text-sm text-brand-900 truncate">Прогулка в лесу</h5>
                  <p className="text-[10px] text-brand-400 font-medium truncate">Альбом: Семейный архив</p>
                  <div className="flex gap-1.5 pt-1">
                    <span className="bg-brand-100 text-brand-800 text-[8px] font-semibold px-2 py-0.5 rounded-full border border-brand-200/30">Лето</span>
                    <span className="bg-brand-100 text-brand-800 text-[8px] font-semibold px-2 py-0.5 rounded-full border border-brand-200/30">Природа</span>
                  </div>
                </div>
              </div>

              {/* Folder Card Mockup */}
              <div className="bg-white border border-brand-200/40 rounded-3xl p-5 flex flex-col justify-between shadow-sm h-full select-none cursor-pointer hover:border-brand-500 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-500 flex items-center justify-center shadow-inner">
                    <Folder className="w-6 h-6 fill-brand-500/10" />
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-brand-500 font-bold bg-brand-100/40 px-2.5 py-1 rounded-full">
                    Активный
                  </span>
                </div>
                <div>
                  <h5 className="font-serif font-bold text-sm text-brand-900 mb-1">День Рождения</h5>
                  <p className="text-[10px] text-brand-400 font-medium">148 фотографий · 450 МБ</p>
                </div>
              </div>

              {/* Upload Zone Mockup */}
              <div className="bg-brand-50/50 upload-border h-full p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer select-none">
                <div className="w-12 h-12 rounded-full bg-white text-brand-500 flex items-center justify-center shadow-sm">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-brand-900 block mb-0.5">Перетащите фотографии сюда</span>
                  <span className="text-[10px] text-brand-400 font-medium">JPEG, PNG до 20 МБ</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. SYSTEM PANELS */}
          {activeTab === 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Mini PIN Lock Mockup */}
              <div className="bg-brand-50/50 border border-brand-200/30 rounded-3xl p-5 flex flex-col items-center justify-center text-center select-none">
                <div className="w-10 h-10 rounded-2xl bg-brand-200/50 text-brand-600 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5 text-brand-500 fill-brand-500/10" />
                </div>
                <h5 className="font-serif font-bold text-xs text-brand-900 mb-2">Введите код доступа</h5>
                
                {/* Dots indicator */}
                <div className="flex gap-2 mb-4 justify-center">
                  {[...Array(4)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-2.5 h-2.5 rounded-full border-2 border-brand-300 transition-all ${
                        pinDots.length > i ? 'bg-brand-500 border-brand-500 scale-105' : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>

                {/* Pad grid */}
                <div className="grid grid-cols-3 gap-1.5 max-w-[150px] mx-auto mb-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button 
                      key={num} 
                      onClick={() => handlePinClick(num)}
                      className="w-8 h-8 rounded-full border border-brand-200 bg-white/70 hover:bg-white text-brand-900 font-serif font-bold text-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-sm"
                    >
                      {num}
                    </button>
                  ))}
                  <button 
                    onClick={() => setPinDots('')}
                    className="col-span-3 text-[8px] text-brand-500 font-bold uppercase tracking-wider py-1 hover:text-brand-800 transition-colors cursor-pointer"
                  >
                    Сбросить
                  </button>
                </div>
              </div>

              {/* Progress Storage Bar */}
              <div className="bg-white border border-brand-200/40 rounded-3xl p-5 flex flex-col justify-between shadow-sm select-none">
                <div>
                  <h5 className="font-serif font-bold text-sm text-brand-900 mb-1">Сейф воспоминаний</h5>
                  <p className="text-[10px] text-brand-400 font-medium mb-4">Облачное хранилище</p>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-brand-100/50 h-3 rounded-full overflow-hidden mb-3 border border-brand-200/10">
                    <div className="bg-brand-500 h-full rounded-full transition-all duration-500" style={{ width: '42%' }} />
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] font-semibold">
                    <span className="text-brand-900">Свободно еще 58%</span>
                    <span className="text-brand-600">4.2 ГБ из 10 ГБ</span>
                  </div>
                </div>
                
                <button className="w-full bg-brand-500 hover:bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wider py-2.5 rounded-xl transition-all cursor-pointer mt-4">
                  Увеличить сейф
                </button>
              </div>

              {/* Mini Pricing Card */}
              <div className="bg-white border border-brand-500 ring-2 ring-brand-500/10 rounded-3xl p-5 flex flex-col justify-between relative select-none">
                <span className="absolute -top-3 right-5 px-2.5 py-0.5 bg-brand-500 text-white text-[8px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                  Популярный
                </span>
                <div>
                  <h5 className="font-serif font-bold text-sm text-brand-900 mb-1">Уютный тариф</h5>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-2xl font-serif font-bold text-brand-500">5 ГБ</span>
                  </div>
                  <p className="text-[10px] text-brand-900 font-light leading-relaxed mb-4">
                    Достаточно места для сотен теплых семейных фотографий.
                  </p>
                </div>

                <div className="border-t border-brand-100 my-2"></div>
                <div className="flex justify-between items-center pt-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-brand-900 leading-none">99 ₽</span>
                    <span className="text-[8px] text-brand-400 font-bold uppercase tracking-wider mt-0.5">в месяц</span>
                  </div>
                  <button className="bg-brand-500 hover:bg-brand-600 text-white text-[9px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all cursor-pointer">
                    Выбрать
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. ALERTS & NOTIFICATIONS */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              
              {/* Success Notification */}
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-2xl flex items-start gap-3 shadow-sm select-none">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Фотографии успешно загружены!</span>
                  <span className="text-[10px] text-emerald-600 leading-relaxed font-light">3 новых снимка добавлены в альбом &quot;Весенний пикник&quot;. Резервная копия создана.</span>
                </div>
              </div>

              {/* Error Notification */}
              <div className="p-4 bg-red-50/80 border border-red-200 text-red-800 text-xs font-medium rounded-2xl flex items-start gap-3 shadow-sm select-none">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Превышен лимит хранилища!</span>
                  <span className="text-[10px] text-red-600 leading-relaxed font-light">Не удалось загрузить файл &quot;IMG_2026.JPG&quot; (18.4 МБ). В вашем сейфе осталось всего 12 МБ. Пожалуйста, обновите тариф.</span>
                </div>
              </div>

              {/* Info Notification */}
              <div className="p-4 bg-brand-50 border border-brand-200/50 text-brand-900 text-xs font-medium rounded-2xl flex items-start gap-3 shadow-sm select-none">
                <Sparkles className="w-5 h-5 text-brand-500 shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Попробуйте новые возможности</span>
                  <span className="text-[10px] text-brand-900/70 leading-relaxed font-light">Теперь вы можете делиться целыми альбомами с друзьями с помощью безопасных ссылок. Создайте ссылку в меню настроек альбома.</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
