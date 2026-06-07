import React, { useState, useEffect, useRef } from 'react';
import { X, Eye, Image as ImageIcon, Heart, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Gallery({ photos, storage, token }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const lightboxRef = useRef(null);
  const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

  // Calculate reassuring space metrics
  const totalPhotos = photos.length;
  const usedBytes = storage.used || 0;
  const limitBytes = storage.limit || 1073741824; // Default 1 GB
  const percentUsed = Math.min(Math.round((usedBytes / limitBytes) * 100), 100);
  const percentFree = 100 - percentUsed;
  
  // Approximate how many photos are left (assuming average size of 1.5MB)
  const avgPhotoSize = 1.5 * 1024 * 1024;
  const remainingPhotosEstimate = Math.max(0, Math.floor((limitBytes - usedBytes) / avgPhotoSize));

  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    if (photos.length <= 1) return;
    setSelectedIndex((prevIndex) => 
      prevIndex === 0 ? photos.length - 1 : prevIndex - 1
    );
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    if (photos.length <= 1) return;
    setSelectedIndex((prevIndex) => 
      prevIndex === photos.length - 1 ? 0 : prevIndex + 1
    );
  };

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        setSelectedIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, photos.length]);

  // Touch/Swipe gestures for mobile
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    // Swipe sensitivity threshold (50px)
    if (diffX > 50) {
      handleNext();
    } else if (diffX < -50) {
      handlePrev();
    }
    setTouchStartX(null);
  };

  // Disable background scrolling on desktop & mobile when lightbox is open
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleTouchMove = (e) => {
      e.preventDefault();
    };

    const element = lightboxRef.current;
    if (element) {
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    document.body.style.overflow = 'hidden';

    return () => {
      if (element) {
        element.removeEventListener('touchmove', handleTouchMove);
      }
      document.body.style.overflow = '';
    };
  }, [selectedIndex]);

  return (
    <div className="w-full max-w-5xl mx-auto px-2">
      {/* Storage Reassuring Banner */}
      <div className="bg-white border border-brand-200/40 p-5 rounded-3xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
            <h4 className="text-sm font-semibold text-brand-900">Ваше уютное хранилище</h4>
          </div>
          <p className="text-xs text-brand-600 font-light leading-relaxed">
            {totalPhotos === 0 
              ? 'Ваш альбом пока пуст. Самое время сохранить первую фотографию!'
              : `Вы бережно сохранили ${totalPhotos} ${getPhotoWord(totalPhotos)}. Место свободно еще примерно для ${remainingPhotosEstimate} фото (${percentFree}% свободно).`
            }
          </p>
        </div>
        
        {/* Progress Bar container */}
        <div className="w-full md:w-64">
          <div className="flex justify-between text-[10px] text-brand-500 font-semibold mb-1 uppercase tracking-wider">
            <span>Заполнено</span>
            <span>{percentUsed}%</span>
          </div>
          <div className="w-full bg-brand-100 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-brand-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${percentUsed}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Grid of Photos */}
      {photos.length === 0 ? (
        <div className="text-center py-20 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-brand-100/50 flex items-center justify-center text-brand-400 mb-4">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="font-serif text-lg text-brand-800 mb-1">Здесь будут ваши снимки</h3>
          <p className="text-sm text-brand-600 font-light max-w-xs">
            Загрузите памятные фотографии с телефона выше, чтобы они всегда оставались с вами в полной безопасности.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              onClick={() => setSelectedIndex(index)}
              className="group relative aspect-square bg-brand-100 rounded-3xl overflow-hidden shadow-sm card-hover cursor-pointer animate-photo-entry"
            >
              {photo.url ? (
                <img
                  src={photo.url.startsWith('http') ? photo.url : `${backendUrl}${photo.url}`}
                  alt={photo.original_name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-brand-400">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              
              {/* Soft overlay on hover */}
              <div className="absolute inset-0 bg-brand-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 text-brand-800 flex items-center justify-center shadow-md">
                  <Eye className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Lightbox / Carousel */}
      {selectedPhoto && (
        <div 
          ref={lightboxRef}
          onClick={() => setSelectedIndex(null)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-brand-950/95 p-4 md:p-6 backdrop-blur-md transition-all duration-300 cursor-pointer select-none"
        >
          {/* Top bar with memory counter and close button */}
          <div className="w-full flex items-center justify-between max-w-5xl z-50">
            {photos.length > 1 ? (
              <div className="font-serif text-sm md:text-base text-brand-100/90 tracking-wide">
                Воспоминание {selectedIndex + 1} из {photos.length}
              </div>
            ) : (
              <div className="font-serif text-sm md:text-base text-brand-100/90 tracking-wide">
                Памятное воспоминание
              </div>
            )}
            
            <button 
              onClick={() => setSelectedIndex(null)} 
              className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm active:scale-95"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Photo Area */}
          <div 
            className="relative w-full flex-1 flex items-center justify-center py-4 max-h-[80vh] md:max-h-[82vh]"
          >
            {/* Left navigation arrow */}
            {photos.length > 1 && (
              <button
                onClick={handlePrev}
                className="absolute left-2 md:-left-8 z-50 w-12 h-12 bg-white/5 hover:bg-white/10 active:scale-90 text-white/80 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
                title="Предыдущее воспоминание"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* The Photo itself */}
            <img
              key={selectedIndex}
              src={selectedPhoto.url.startsWith('http') ? selectedPhoto.url : `${backendUrl}${selectedPhoto.url}`}
              alt={selectedPhoto.original_name}
              draggable="false"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[75vh] md:max-h-[80vh] rounded-2xl object-contain shadow-2xl animate-photo-entry select-none cursor-default"
            />

            {/* Right navigation arrow */}
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

          {/* Bottom space to balance the top bar layout and display user hint */}
          <div className="w-full text-center text-[10px] text-brand-300/50 uppercase tracking-widest pb-2 z-50 pointer-events-none">
            {photos.length > 1 ? 'Смахните в сторону или используйте стрелки для перелистывания' : 'Коснитесь экрана вокруг фото, чтобы закрыть'}
          </div>
        </div>
      )}
    </div>
  );
}

// Grammatical helper for Russian language plurals
function getPhotoWord(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) {
    return 'фотографий';
  }
  if (mod10 === 1) {
    return 'фотографию';
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return 'фотографии';
  }
  return 'фотографий';
}
