import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function UploadZone({ token, onUploadComplete }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploads, setUploads] = useState({});
  const [zoneError, setZoneError] = useState('');
  const fileInputRef = useRef(null);
  const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

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
    // Allow images and videos
    const allowedFiles = files.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (allowedFiles.length === 0) {
      setZoneError('Пожалуйста, выберите только фотографии или видеоролики.');
      setTimeout(() => setZoneError(''), 4000);
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

      {/* Upload Status List */}
      {activeUploads.length > 0 && (
        <div className="mt-4 space-y-2 max-w-md mx-auto">
          {activeUploads.map((upload, idx) => (
            <div 
              key={idx} 
              className="p-3 bg-white border border-brand-200/50 rounded-2xl flex items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-brand-900 truncate">
                  {upload.name}
                </p>
                
                {/* Upload Status Message */}
                <div className="mt-1 flex items-center gap-2">
                  {upload.status === 'preparing' && (
                    <span className="text-[10px] text-brand-500 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Подготовка памяти...
                    </span>
                  )}
                  {upload.status === 'uploading' && (
                    <div className="w-full flex items-center gap-2">
                      <div className="flex-1 bg-brand-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-brand-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${upload.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-brand-600 font-medium">
                        Сохранено {upload.progress}%
                      </span>
                    </div>
                  )}
                  {upload.status === 'success' && (
                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Бережно сохранено
                    </span>
                  )}
                  {upload.status === 'error' && (
                    <span className="text-[10px] text-red-500 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" /> {upload.errorMsg}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
