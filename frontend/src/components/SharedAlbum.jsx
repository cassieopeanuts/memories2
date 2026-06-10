import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Eye, Image as ImageIcon, ChevronLeft, ChevronRight, 
  ArrowLeft, RefreshCw, AlertCircle, Globe
} from 'lucide-react';

export default function SharedAlbum({ shareToken, onBackToApp }) {
  const [albumData, setAlbumData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Lightbox
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const lightboxRef = useRef(null);

  const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

  useEffect(() => {
    const fetchSharedAlbum = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const response = await fetch(`${backendUrl}/api/shared/album/${shareToken}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Ошибка загрузки общего альбома');
        }
        
        setAlbumData(data);
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || 'Не удалось загрузить альбом. Ссылка может быть недействительной.');
      } finally {
        setLoading(false);
      }
    };

    if (shareToken) {
      fetchSharedAlbum();
    }
  }, [shareToken]);

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    if (!albumData || albumData.photos.length === 0) return;
    setSelectedIndex((prev) => (prev === 0 ? albumData.photos.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    if (!albumData || albumData.photos.length === 0) return;
    setSelectedIndex((prev) => (prev === albumData.photos.length - 1 ? 0 : prev + 1));
  };

  // Touch swipe gesture support for mobile carousel
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    
    // Swipe left (next photo)
    if (diff > 50) {
      handleNext();
    }
    // Swipe right (prev photo)
    else if (diff < -50) {
      handlePrev();
    }
    setTouchStartX(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedIndex === null) return;
      if (e.key === 'Escape') setSelectedIndex(null);
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, albumData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-550/10 flex flex-col items-center justify-center text-brand-600">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-brand-400" />
        <span className="text-sm font-medium">Открываем общий доступ к воспоминаниям...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-500 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-xl font-bold text-brand-900 mb-2">Альбом не найден</h2>
        <p className="text-xs text-brand-600 max-w-sm mb-6 leading-relaxed">
          {errorMsg}
        </p>
        <button
          onClick={onBackToApp}
          className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </button>
      </div>
    );
  }

  const { albumName, ownerName, photos } = albumData;
  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col selection:bg-brand-200">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full glass-header py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-400 to-brand-600 flex items-center justify-center text-brand-50 shadow-sm">
              <Globe className="w-4.5 h-4.5" />
            </div>
            <span className="font-serif font-bold text-xl md:text-2xl tracking-tight text-brand-900">
              ЛегкоСохранить.рф
            </span>
          </div>

          <button
            onClick={onBackToApp}
            className="flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-955 transition-colors font-semibold border border-brand-200 hover:bg-brand-100/30 px-4 py-2 rounded-2xl cursor-pointer"
          >
            Войти в облако
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="mb-8 pt-2">
          <h2 className="font-serif text-2xl md:text-3xl text-brand-900 font-bold mb-1">
            Альбом: {albumName}
          </h2>
          <p className="text-xs text-brand-500 font-light">
            Автор: <span className="font-semibold text-brand-700">{ownerName}</span> • {photos.length} фото
          </p>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-20 bg-white border border-brand-200/40 rounded-3xl p-6 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-500 flex items-center justify-center mx-auto mb-3">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-brand-900 mb-1">В альбоме пусто</h4>
            <p className="text-xs text-brand-500 font-light">Владелец пока не добавил ни одной фотографии в этот альбом.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-photo-entry">
            {photos.map((photo, index) => {
              const photoUrl = photo.url.startsWith('http') ? photo.url : `${backendUrl}${photo.url}`;
              return (
                <div
                  key={photo.id}
                  onClick={() => setSelectedIndex(index)}
                  className="aspect-square bg-white border border-brand-200/40 rounded-2xl overflow-hidden cursor-pointer hover:border-brand-400 group relative shadow-sm hover:scale-[1.01] transition-all duration-300"
                >
                  <img
                    src={photoUrl}
                    alt={photo.original_name}
                    loading="lazy"
                    className="w-full h-full object-cover select-none"
                  />
                  <div className="absolute inset-0 bg-brand-950/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/95 text-brand-800 flex items-center justify-center shadow-md">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lightbox */}
      {selectedPhoto && (
        <div 
          ref={lightboxRef}
          onClick={() => setSelectedIndex(null)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 p-4 md:p-6 backdrop-blur-md transition-all duration-300 cursor-pointer select-none"
        >
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between max-w-5xl z-50">
            <div className="font-serif text-sm md:text-base text-brand-100/90 tracking-wide">
              Воспоминание {selectedIndex + 1} из {photos.length}
            </div>
            
            <button 
              onClick={() => setSelectedIndex(null)} 
              className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm active:scale-95"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image Area */}
          <div className="relative w-full flex-1 flex items-center justify-center py-4 max-h-[85vh]">
            {photos.length > 1 && (
              <button
                onClick={handlePrev}
                className="absolute left-2 md:-left-8 z-50 w-12 h-12 bg-white/5 hover:bg-white/10 active:scale-90 text-white/80 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
                title="Предыдущее воспоминание"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              key={selectedIndex}
              src={selectedPhoto.url.startsWith('http') ? selectedPhoto.url : `${backendUrl}${selectedPhoto.url}`}
              alt={selectedPhoto.original_name}
              draggable="false"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl animate-photo-entry select-none cursor-default"
            />

            {photos.length > 1 && (
              <button
                onClick={handleNext}
                className="absolute right-2 md:-right-8 z-50 w-12 h-12 bg-white/5 hover:bg-white/10 active:scale-90 text-white/80 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
                title="Следующее воспоминание"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Bar Spacer */}
          <div className="h-6"></div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-8 text-center text-[10px] text-brand-400 font-semibold tracking-wider uppercase bg-brand-100/20 mt-12 border-t border-brand-200/20">
        © 2026 ЛЕГКОСОХРАНИТЬ.РФ — БЕЗОПАСНАЯ ГАЛЕРЕЯ
      </footer>
    </div>
  );
}
