import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function UploadZone({ token, onUploadComplete }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploads, setUploads] = useState({});
  const [zoneError, setZoneError] = useState('');
  const fileInputRef = useRef(null);
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleFiles = (files) => {
    const allowedFiles = [];
    const skippedFiles = [];
    
    files.forEach(file => {
      const type = file.type || '';
      // Support common media file extensions as fallback if file.type is blank
      const ext = file.name.split('.').pop().toLowerCase();
      const isAllowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
      
      const isAllowed = type.startsWith('image/') || type.startsWith('video/') || (type === '' && isAllowedExt);
      if (isAllowed) {
        allowedFiles.push(file);
      } else {
        skippedFiles.push(file.name);
      }
    });

    if (skippedFiles.length > 0) {
      setZoneError(`Неподдерживаемые файлы были пропущены: ${skippedFiles.join(', ')}. Разрешены только фото и видео.`);
      setTimeout(() => setZoneError(''), 5000);
    }

    if (allowedFiles.length === 0) {
      if (skippedFiles.length === 0) {
        setZoneError('Пожалуйста, выберите только фотографии или видеоролики.');
        setTimeout(() => setZoneError(''), 4000);
      }
      return;
    }
    
    allowedFiles.forEach(file => {
      uploadFile(file);
    });
  };

  const uploadFile = async (file) => {
    const uploadId = Math.random().toString(36).substring(7);
    
    // Add to state
    setUploads(prev => ({
      ...prev,
      [uploadId]: {
        name: file.name,
        progress: 0,
        status: 'preparing', // preparing, uploading, success, error
        errorMsg: ''
      }
    }));

    try {
      // 1. Get Presigned PUT URL
      const response = await fetch(`${backendUrl}/api/photos/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось получить разрешение на загрузку.');
      }

      const { uploadUrl, s3Key, mimeType } = data;

      // Update state to uploading
      setUploads(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], status: 'uploading' }
      }));

      // 2. Perform direct upload to S3 using PUT method
      const xhr = new XMLHttpRequest();
      const finalUploadUrl = uploadUrl.startsWith('http') ? uploadUrl : `${backendUrl}${uploadUrl}`;
      xhr.open('PUT', finalUploadUrl, true);
      xhr.setRequestHeader('Content-Type', mimeType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          setUploads(prev => ({
            ...prev,
            [uploadId]: { ...prev[uploadId], progress: percentage }
          }));
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200 || xhr.status === 201) {
          // 3. Confirm upload with Backend
          try {
            const confirmResponse = await fetch(`${backendUrl}/api/photos/confirm`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                s3Key,
                originalName: file.name,
                size: file.size,
                mimeType: file.type
              })
            });

            if (!confirmResponse.ok) {
              const confirmData = await confirmResponse.json();
              throw new Error(confirmData.error || 'Ошибка записи в базу данных.');
            }

            // Success
            setUploads(prev => ({
              ...prev,
              [uploadId]: { ...prev[uploadId], status: 'success', progress: 100 }
            }));
            
            // Refresh gallery
            onUploadComplete();
            
            // Clear successful upload after 3 seconds
            setTimeout(() => {
              setUploads(prev => {
                const next = { ...prev };
                delete next[uploadId];
                return next;
              });
            }, 3000);

          } catch (err) {
            console.error('Confirm error:', err);
            setUploads(prev => ({
              ...prev,
              [uploadId]: { ...prev[uploadId], status: 'error', errorMsg: err.message }
            }));
          }
        } else {
          setUploads(prev => ({
            ...prev,
            [uploadId]: { ...prev[uploadId], status: 'error', errorMsg: 'Ошибка загрузки в облако S3.' }
          }));
        }
      };

      xhr.onerror = () => {
        setUploads(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], status: 'error', errorMsg: 'Сбой сети при передаче файла.' }
        }));
      };

      xhr.send(file);

    } catch (err) {
      console.error('Upload sequence error:', err);
      setUploads(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], status: 'error', errorMsg: err.message }
      }));
    }
  };

  const activeUploads = Object.values(uploads);
  const totalFiles = activeUploads.length;
  const completedFiles = activeUploads.filter(u => u.status === 'success').length;
  const failedFiles = activeUploads.filter(u => u.status === 'error');
  const totalFailedCount = failedFiles.length;
  const isUploading = activeUploads.some(u => u.status === 'uploading' || u.status === 'preparing');
  const isAllFinished = totalFiles > 0 && (completedFiles + totalFailedCount === totalFiles);

  // Calculate overall progress percentage
  const totalProgress = activeUploads.reduce((acc, u) => {
    if (u.status === 'success') return acc + 100;
    if (u.status === 'error') return acc + 100; // Count errors as finished to not block progress bar
    return acc + (u.progress || 0);
  }, 0);
  const overallProgress = totalFiles > 0 ? Math.round(totalProgress / totalFiles) : 0;

  // Auto-clear uploads lists after successful completion
  useEffect(() => {
    if (isAllFinished && totalFailedCount === 0) {
      const timer = setTimeout(() => {
        setUploads({});
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isAllFinished, totalFailedCount]);

  return (
    <div className="w-full mb-6">
      {zoneError && (
        <div className="mb-3 p-3 bg-red-50/90 border border-red-200 text-red-800 text-xs font-semibold rounded-xl text-center backdrop-blur-sm animate-photo-entry">
          {zoneError}
        </div>
      )}
      {/* Sleek, Compact Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`w-full p-2.5 px-4 text-center transition-all duration-300 cursor-pointer flex items-center justify-between gap-4 border border-dashed rounded-xl
          ${isDragActive 
            ? 'border-brand-500 bg-brand-100/40 scale-[1.005]' 
            : 'border-brand-300 bg-white/40 hover:bg-white/60 hover:scale-[1.002]'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,video/*"
          onChange={handleChange}
        />

        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 shrink-0 shadow-inner">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-serif text-xs font-semibold text-brand-900 leading-tight">
              Сохранить новые фото и видео
            </h4>
            <p className="text-[10px] text-brand-900/50 font-light hidden sm:block leading-none mt-0.5">
              Перетащите файлы сюда или нажмите для выбора
            </p>
          </div>
        </div>
        
        <div className="px-3.5 py-1.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:opacity-95 text-white font-semibold rounded-lg text-[10px] transition-all duration-200 shadow-sm inline-flex items-center justify-center gap-1 active:scale-[0.98] shrink-0">
          Выбрать файлы
        </div>
      </div>

      {/* Universal Upload Progress Bar */}
      {totalFiles > 0 && (
        <div className="mt-4 p-4 bg-white border border-brand-200/50 rounded-2xl shadow-sm max-w-md mx-auto animate-photo-entry">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isUploading ? (
                <RefreshCw className="w-4 h-4 text-brand-500 animate-spin" />
              ) : totalFailedCount > 0 ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              <span className="text-xs font-semibold text-brand-900">
                {isUploading 
                  ? `Сохранение воспоминаний: ${completedFiles} из ${totalFiles}...` 
                  : totalFailedCount > 0 
                    ? `Загрузка завершена с ошибками` 
                    : 'Все файлы бережно сохранены!'
                }
              </span>
            </div>
            
            {isUploading && (
              <span className="text-[10px] text-brand-600 font-bold uppercase tracking-wider">
                {overallProgress}%
              </span>
            )}

            {isAllFinished && (
              <button 
                onClick={() => setUploads({})}
                className="text-brand-400 hover:text-brand-600 text-xs font-semibold px-2 py-0.5 rounded-lg hover:bg-brand-100/30 cursor-pointer"
              >
                Очистить
              </button>
            )}
          </div>

          <div className="w-full bg-brand-100 h-2 rounded-full overflow-hidden mb-2">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                totalFailedCount > 0 && overallProgress === 100 
                  ? 'bg-red-400' 
                  : 'bg-gradient-to-r from-brand-500 to-brand-600'
              }`}
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>

          {totalFailedCount > 0 && (
            <div className="mt-3 pt-2 border-t border-brand-100/60 space-y-1">
              <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider block">
                Не удалось сохранить ({totalFailedCount}):
              </span>
              <div className="max-h-20 overflow-y-auto space-y-1">
                {failedFiles.map((upload, fIdx) => (
                  <p key={fIdx} className="text-[10px] text-red-500/80 truncate">
                    • {upload.name}: {upload.errorMsg || 'Ошибка сети'}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
