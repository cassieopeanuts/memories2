'use client';

import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-brand-100 flex flex-col items-center justify-center p-6 text-center select-none animate-photo-entry">
      
      {/* 404 Icon & Shield */}
      <div className="w-20 h-20 rounded-3xl bg-brand-200/40 text-brand-600 flex items-center justify-center mb-8 shadow-inner">
        <FileQuestion className="w-10 h-10 text-brand-500 fill-brand-500/10 animate-pulse" />
      </div>

      {/* Error status */}
      <h1 className="font-serif text-5xl md:text-6xl text-brand-500 font-extrabold mb-4 tracking-tighter">
        404
      </h1>

      {/* Branded Message */}
      <h2 className="font-serif text-xl md:text-2xl text-brand-900 font-bold mb-3">
        Страница не найдена
      </h2>
      
      <p className="text-xs md:text-sm text-brand-600 font-light max-w-sm mx-auto leading-relaxed mb-10">
        Упс! Запрашиваемая страница не существует, была удалена или перемещена.
      </p>

      {/* Action Button to escape 404 */}
      <Link 
        href="/"
        className="flex items-center gap-2 text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-md hover:shadow-lg"
      >
        <Home className="w-4 h-4" />
        Вернуться на главную
      </Link>
    </div>
  );
}
