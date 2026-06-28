import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Eye, Image as ImageIcon, Heart, ChevronLeft, ChevronRight, 
  Folder, FolderPlus, Plus, MoreVertical, Check, Trash2, ArrowLeft, Move, RefreshCw,
  AlertCircle, CheckCircle, Info, Share2, Copy, Globe, ExternalLink, Play, Search
} from 'lucide-react';
import UploadZone from './UploadZone.jsx';

const getShareUrl = (shareToken) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const targetOrigin = origin.includes('xn--80affoidsgaujr8a0h.xn--p1ai')
    ? origin.replace('xn--80affoidsgaujr8a0h.xn--p1ai', 'легкосохранить.рф')
    : origin;
  return `${targetOrigin}/shared/${shareToken}`;
};

export default function Gallery({ token, storage, onUploadComplete, activeTab }) {
  const [albums, setAlbums] = useState([]);
  const [activeAlbum, setActiveAlbum] = useState(null); // null = show albums grid
  const [photos, setPhotos] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Custom album creation modal
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [createdAlbumContext, setCreatedAlbumContext] = useState(null);

  // Album selector modal & search query
  const [showAlbumSelector, setShowAlbumSelector] = useState(false);
  const [albumSearchQuery, setAlbumSearchQuery] = useState('');

  // Lightbox & Carousel
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const lightboxRef = useRef(null);

  // Selection Mode (iPhone Style)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [showAddToAlbum, setShowAddToAlbum] = useState(false);
  const [targetAlbumForSelect, setTargetAlbumForSelect] = useState(null);

  // Drag & Drop local states
  const [draggedAlbumIndex, setDraggedAlbumIndex] = useState(null);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState(null);
  const [isTouchOnly, setIsTouchOnly] = useState(false);
  const [toast, setToast] = useState({ message: '', type: null });
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', onConfirm: null });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleStartSelectForAlbum = (album) => {
    setTargetAlbumForSelect(album);
    const generalAlbum = albums.find(a => a.name === 'Общий');
    if (generalAlbum) {
      setActiveAlbum(generalAlbum);
    }
    setIsSelectMode(true);
    setSelectedPhotoIds([]);
  };

  // Album Sharing States
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);

  const handleEnableSharing = async () => {
    if (!activeAlbum) return;
    setSharingLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`}/api/albums/${activeAlbum.id}/share`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        const updatedAlbum = { ...activeAlbum, share_token: data.shareToken };
        setActiveAlbum(updatedAlbum);
        setAlbums(prev => prev.map(a => a.id === activeAlbum.id ? { ...a, share_token: data.shareToken } : a));
        showToast('Доступ по ссылке включен!');
      } else {
        showToast(data.error || 'Не удалось включить доступ', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Ошибка сети', 'error');
    } finally {
      setSharingLoading(false);
    }
  };

  const handleDisableSharing = async () => {
    if (!activeAlbum) return;
    setSharingLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`}/api/albums/${activeAlbum.id}/share`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        const updatedAlbum = { ...activeAlbum, share_token: null };
        setActiveAlbum(updatedAlbum);
        setAlbums(prev => prev.map(a => a.id === activeAlbum.id ? { ...a, share_token: null } : a));
        showToast('Доступ по ссылке отключен.');
      } else {
        showToast(data.error || 'Не удалось отключить доступ', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Ошибка сети', 'error');
    } finally {
      setSharingLoading(false);
    }
  };

  useEffect(() => {
    if (toast.message) {
      const timer = setTimeout(() => setToast({ message: '', type: null }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.message]);

  useEffect(() => {
    if (isSelectMode) {
      document.body.classList.add('selection-mode-active');
    } else {
      document.body.classList.remove('selection-mode-active');
    }
    return () => {
      document.body.classList.remove('selection-mode-active');
    };
  }, [isSelectMode]);

  useEffect(() => {
    // Check if the device has no fine pointer (mouse/trackpad) i.e. it is a touch-only mobile device (phone/tablet)
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    setIsTouchOnly(!hasFinePointer);

    // Initialize touch-drag-drop polyfill on the client side
    if (typeof window !== 'undefined') {
      import('mobile-drag-drop').then((mod) => {
        mod.polyfill({
          holdToDrag: 300 // 300ms hold to start dragging (helps distinguish scrolling from dragging)
        });
      });
    }
  }, []);



  const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';

  // Fetch albums on mount or token change
  const fetchAlbums = async (selectDefault = false) => {
    setLoadingAlbums(true);
    try {
      const response = await fetch(`${backendUrl}/api/albums`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка загрузки альбомов');
      const fetchedAlbums = data.albums || [];
      setAlbums(fetchedAlbums);
      
      // Auto-select "Общий" if not selected yet or requested
      if (fetchedAlbums.length > 0) {
        if (selectDefault || !activeAlbum) {
          const generalAlbum = fetchedAlbums.find(a => a.name === 'Общий') || fetchedAlbums[0];
          setActiveAlbum(generalAlbum);
        } else {
          // If activeAlbum is already set, update it from the new fetched list to preserve fields like photoCount
          const updatedActive = fetchedAlbums.find(a => a.id === activeAlbum.id);
          if (updatedActive) {
            setActiveAlbum(updatedActive);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Не удалось загрузить ваши альбомы.');
    } finally {
      setLoadingAlbums(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAlbums(true);
    }
  }, [token]);

  // Fetch photos whenever active album changes
  const fetchAlbumPhotos = async (albumId, silent = false) => {
    if (!albumId) return;
    if (!silent) setLoadingPhotos(true);
    try {
      let response;
      if (albumId === 'trash') {
        response = await fetch(`${backendUrl}/api/photos/trash`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        response = await fetch(`${backendUrl}/api/albums/${albumId}/photos`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка загрузки фото');
      setPhotos(data.photos || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('Не удалось загрузить фотографии альбома.');
    } finally {
      if (!silent) setLoadingPhotos(false);
    }
  };

  useEffect(() => {
    if (activeAlbum) {
      fetchAlbumPhotos(activeAlbum.id);
    }
  }, [activeAlbum, token]);

  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;
    try {
      const response = await fetch(`${backendUrl}/api/albums`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newAlbumName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка создания альбома');
      
      setNewAlbumName('');
      setShowCreateAlbum(false);
      await fetchAlbums();
      setCreatedAlbumContext(data.album);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAlbum = (albumId, e) => {
    if (e) e.stopPropagation();
    setConfirmConfig({
      isOpen: true,
      message: 'Вы действительно хотите удалить этот альбом? Фотографии останутся в общем альбоме.',
      onConfirm: async () => {
        setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
        try {
          const response = await fetch(`${backendUrl}/api/albums/${albumId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Не удалось удалить альбом');
          }
          
          showToast('Альбом успешно удален.');
          
          // If deleted album was active, reset to default "Общий"
          if (activeAlbum && activeAlbum.id === albumId) {
            setActiveAlbum(null); // will be auto-selected in fetchAlbums(true)
            fetchAlbums(true);
          } else {
            fetchAlbums(false);
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  };

  // Carousel controls
  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    if (photos.length <= 1) return;
    setSelectedIndex((prevIndex) => 
      prevIndex === 0 ? photos.length - 1 : prevIndex - 1
    );
    setShowOptionsDropdown(false);
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    if (photos.length <= 1) return;
    setSelectedIndex((prevIndex) => 
      prevIndex === photos.length - 1 ? 0 : prevIndex + 1
    );
    setShowOptionsDropdown(false);
  };

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'Escape') setSelectedIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, photos.length]);

  // Disable background scrolling on open
  useEffect(() => {
    if (selectedIndex === null) return;
    const handleTouchMove = (e) => e.preventDefault();
    const element = lightboxRef.current;
    if (element) {
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    document.body.style.overflow = 'hidden';
    return () => {
      if (element) element.removeEventListener('touchmove', handleTouchMove);
      document.body.style.overflow = '';
    };
  }, [selectedIndex]);

  // Touch swiping
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;
    if (diffX > 50) handleNext();
    else if (diffX < -50) handlePrev();
    setTouchStartX(null);
  };

  // Toggle Favorite
  const toggleFavorite = async (photo, e) => {
    if (e) e.stopPropagation();
    const newFav = !photo.is_favorite;
    try {
      const response = await fetch(`${backendUrl}/api/photos/${photo.id}/favorite`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isFavorite: newFav })
      });
      if (!response.ok) throw new Error('Ошибка обновления статуса Избранного');
      
      // Update local state
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_favorite: newFav } : p));
      
      // Refresh albums list to show / update the "Избранное" album
      fetchAlbums(false);
      
      // If we are currently inside "Избранное" album, or removing from favorite,
      // refresh the photos in the active album.
      if (activeAlbum) {
        fetchAlbumPhotos(activeAlbum.id, true);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getNextIndexAfterDelete = (currentIndex, photoList) => {
    if (photoList.length <= 1) {
      return null;
    }
    if (currentIndex === photoList.length - 1) {
      return currentIndex - 1;
    }
    return currentIndex;
  };

  // Remove photo from custom album
  const handleRemovePhotoFromAlbum = async (photoId) => {
    if (!activeAlbum || activeAlbum.name === 'Общий') return;
    try {
      const response = await fetch(`${backendUrl}/api/albums/${activeAlbum.id}/photos/${photoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Не удалось убрать фото из альбома');
      
      const nextIndex = getNextIndexAfterDelete(selectedIndex, photos);
      setSelectedIndex(nextIndex);
      setShowOptionsDropdown(false);
      fetchAlbumPhotos(activeAlbum.id, true);
      showToast('Фотография убрана из альбома.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Delete photo (soft-delete to trash)
  const handleDeletePhoto = async (photoId) => {
    setConfirmConfig({
      isOpen: true,
      message: 'Вы действительно хотите переместить эту фотографию в корзину? Она будет храниться там в течение 30 дней, после чего автоматически удалится навсегда.',
      onConfirm: async () => {
        try {
          const response = await fetch(`${backendUrl}/api/photos/${photoId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error('Не удалось переместить фото в корзину');
          
          const nextIndex = getNextIndexAfterDelete(selectedIndex, photos);
          setSelectedIndex(nextIndex);
          setShowOptionsDropdown(false);
          if (activeAlbum) {
            fetchAlbumPhotos(activeAlbum.id, true);
          }
          if (onUploadComplete) {
            onUploadComplete();
          }
          fetchAlbums(); // update counts
          showToast('Фотография перемещена в корзину.');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  };

  // Restore a single soft-deleted photo from Trash
  const handleRestoreSinglePhoto = async (photoId) => {
    try {
      const response = await fetch(`${backendUrl}/api/photos/${photoId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Не удалось восстановить фотографию');
      
      const nextIndex = getNextIndexAfterDelete(selectedIndex, photos);
      setSelectedIndex(nextIndex);
      if (activeAlbum) {
        fetchAlbumPhotos(activeAlbum.id, true);
      }
      fetchAlbums(); // update count
      showToast('Фотография восстановлена.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Permanently delete a single photo from Trash
  const handleDeletePhotoPermanent = (photoId) => {
    setConfirmConfig({
      isOpen: true,
      message: 'Вы уверены, что хотите удалить эту фотографию навсегда? Данные будут полностью удалены из хранилища воспоминаний Selectel S3, и восстановить их будет невозможно.',
      onConfirm: async () => {
        try {
          const response = await fetch(`${backendUrl}/api/photos/bulk-delete-permanent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ photoIds: [photoId] })
          });
          if (!response.ok) throw new Error('Не удалось окончательно удалить фотографию');
          
          const nextIndex = getNextIndexAfterDelete(selectedIndex, photos);
          setSelectedIndex(nextIndex);
          if (activeAlbum) {
            fetchAlbumPhotos(activeAlbum.id, true);
          }
          if (onUploadComplete) {
            onUploadComplete();
          }
          fetchAlbums();
          showToast('Фотография навсегда удалена.');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  };

  // Bulk restore photos from Trash
  const handleBulkRestore = async () => {
    if (selectedPhotoIds.length === 0) return;
    try {
      const response = await fetch(`${backendUrl}/api/photos/bulk-restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photoIds: selectedPhotoIds })
      });
      if (!response.ok) throw new Error('Не удалось восстановить выбранные фотографии');
      
      setIsSelectMode(false);
      setSelectedPhotoIds([]);
      if (activeAlbum) {
        fetchAlbumPhotos(activeAlbum.id, true);
      }
      fetchAlbums();
      showToast('Выбранные фотографии восстановлены.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Bulk permanent delete photos from Trash
  const handleBulkDeletePermanent = () => {
    if (selectedPhotoIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      message: `Вы уверены, что хотите окончательно удалить ${selectedPhotoIds.length} ${getPhotoWord(selectedPhotoIds.length)}? Это действие сотрет все файлы из хранилища воспоминаний и будет абсолютно необратимо.`,
      onConfirm: async () => {
        try {
          const response = await fetch(`${backendUrl}/api/photos/bulk-delete-permanent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ photoIds: selectedPhotoIds })
          });
          if (!response.ok) throw new Error('Не удалось окончательно удалить выбранные фотографии');
          
          setIsSelectMode(false);
          setSelectedPhotoIds([]);
          if (activeAlbum) {
            fetchAlbumPhotos(activeAlbum.id, true);
          }
          if (onUploadComplete) {
            onUploadComplete();
          }
          fetchAlbums();
          showToast('Выбранные фотографии навсегда удалены из хранилища.');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  };

  // Empty Trash Bin
  const handleEmptyTrash = () => {
    setConfirmConfig({
      isOpen: true,
      message: 'Вы уверены, что хотите полностью очистить корзину? Все удаленные фотографии будут безвозвратно удалены из хранилища воспоминаний Selectel S3.',
      onConfirm: async () => {
        try {
          const response = await fetch(`${backendUrl}/api/photos/trash/empty`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error('Не удалось очистить корзину');
          
          if (activeAlbum) {
            fetchAlbumPhotos(activeAlbum.id, true);
          }
          if (onUploadComplete) {
            onUploadComplete();
          }
          fetchAlbums();
          showToast('Корзина успешно очищена.');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  };

  // Multiple Selection logic
  const handlePhotoSelect = (photoId, e) => {
    if (e) e.stopPropagation();
    setSelectedPhotoIds(prev => 
      prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]
    );
  };

  const handleAddSelectedToAlbum = async (targetAlbumId) => {
    try {
      const response = await fetch(`${backendUrl}/api/albums/${targetAlbumId}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photoIds: selectedPhotoIds })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Не удалось добавить фото в альбом');
      }
      
      setIsSelectMode(false);
      setSelectedPhotoIds([]);
      setShowAddToAlbum(false);
      fetchAlbums(); // update counts
      showToast('Фотографии успешно добавлены в альбом.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateAlbumAndAddSelected = async (name) => {
    if (!name.trim()) return;
    try {
      // 1. Create album
      const response = await fetch(`${backendUrl}/api/albums`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка создания альбома');
      
      // 2. Add selected photos to this new album
      await handleAddSelectedToAlbum(data.album.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Drag and Drop Album reordering
  const handleAlbumDragStart = (e, idx) => {
    setDraggedAlbumIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleAlbumDragOver = (e, idx) => {
    e.preventDefault();
    if (idx === 0) return; // Prevent dragging onto "Общий"
  };

  const handleAlbumDrop = async (e, targetIdx) => {
    e.preventDefault();
    if (draggedAlbumIndex === null || draggedAlbumIndex === targetIdx || targetIdx === 0) return;

    const updatedAlbums = [...albums];
    const [draggedItem] = updatedAlbums.splice(draggedAlbumIndex, 1);
    updatedAlbums.splice(targetIdx, 0, draggedItem);

    // Update positions locally
    const reordered = updatedAlbums.map((album, index) => ({
      ...album,
      position: index
    }));
    setAlbums(reordered);
    setDraggedAlbumIndex(null);

    // Save positions to backend
    try {
      await fetch(`${backendUrl}/api/albums/positions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          positions: reordered.map(a => ({ albumId: a.id, position: a.position }))
        })
      });
    } catch (err) {
      console.error('Error saving album positions:', err);
    }
  };

  const handleAlbumDragEnd = () => {
    setDraggedAlbumIndex(null);
  };

  // Drag photo to album card
  const handlePhotoDragStart = (e, idx, id) => {
    setDraggedPhotoIndex(idx);
    setDraggedPhotoId(id);
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('photoId', id);
    e.dataTransfer.setData('text/plain', id);

    // Set custom drag image to the raw image/video element within the card container.
    // This stops browsers from rendering extra overlays (checkboxes, eye icons) and native white borders.
    try {
      const cardEl = e.currentTarget;
      const imgEl = cardEl.querySelector('img');
      if (imgEl) {
        e.dataTransfer.setDragImage(imgEl, imgEl.clientWidth / 2 || 100, imgEl.clientHeight / 2 || 100);
      } else {
        const videoEl = cardEl.querySelector('video');
        if (videoEl) {
          e.dataTransfer.setDragImage(videoEl, videoEl.clientWidth / 2 || 100, videoEl.clientHeight / 2 || 100);
        }
      }
    } catch (err) {
      console.warn('Could not set custom drag image:', err.message);
    }
  };

  const handleDropPhotoOnAlbum = async (e, albumId) => {
    e.preventDefault();
    const photoId = e.dataTransfer.getData('photoId') || draggedPhotoId;
    if (!photoId) return;

    try {
      const response = await fetch(`${backendUrl}/api/albums/${albumId}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photoIds: [photoId] })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Не удалось переместить фото');
      }
      fetchAlbums(); // Refresh photo counts
      showToast('Фотография добавлена в альбом.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDraggedPhotoId(null);
      setDraggedPhotoIndex(null);
    }
  };

  // Drag photo inside custom album for sorting
  const handlePhotoDragOver = (e) => {
    e.preventDefault();
  };

  const handlePhotoDropInsideAlbum = async (e, targetIdx) => {
    e.preventDefault();
    if (draggedPhotoIndex === null || draggedPhotoIndex === targetIdx || !activeAlbum) {
      return;
    }

    const updatedPhotos = [...photos];
    const [draggedItem] = updatedPhotos.splice(draggedPhotoIndex, 1);
    updatedPhotos.splice(targetIdx, 0, draggedItem);

    // Update positions locally
    const reordered = updatedPhotos.map((photo, index) => ({
      ...photo,
      position: index
    }));
    setPhotos(reordered);
    setDraggedPhotoIndex(null);
    setDraggedPhotoId(null);

    // Save positions to backend
    try {
      await fetch(`${backendUrl}/api/albums/${activeAlbum.id}/photos/positions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          photoPositions: reordered.map(p => ({ photoId: p.id, position: p.position }))
        })
      });
    } catch (err) {
      console.error('Error saving photo positions:', err);
    }
  };

  const handlePhotoDragEnd = () => {
    setDraggedPhotoIndex(null);
    setDraggedPhotoId(null);
  };

  // Grammatical plurals helper
  const getPhotoWord = (count) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'фотографий';
    if (mod10 === 1) return 'фотографию';
    if (mod10 >= 2 && mod10 <= 4) return 'фотографии';
    return 'фотографий';
  };

  const getAlbumCountText = (count, albumName) => {
    if (albumName === 'Видео') {
      return `${count} видео`;
    }
    return `${count} ${getPhotoWord(count)}`;
  };

  const handleCycleAlbum = (direction) => {
    if (albums.length <= 1 || !activeAlbum) return;
    const currentIndex = albums.findIndex(a => a.id === activeAlbum.id);
    if (currentIndex === -1) return;
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = albums.length - 1;
    if (nextIndex >= albums.length) nextIndex = 0;
    
    const nextAlbum = albums[nextIndex];
    setActiveAlbum(nextAlbum);
    setIsSelectMode(false);
    setSelectedPhotoIds([]);
  };

  const renderMobileDeck = () => {
    if (!activeAlbum) return null;
    const photoCount = activeAlbum.photoCount || 0;
    
    return (
      <div className="relative w-full max-w-sm mx-auto h-28 my-6">
        {/* Card 3 (Back) */}
        {albums.length > 2 && (
          <div className="absolute top-4 left-4 right-4 h-20 bg-white/40 border border-brand-200/10 rounded-2xl scale-[0.92] opacity-40 shadow-sm transition-all duration-300 pointer-events-none"></div>
        )}
        {/* Card 2 (Middle) */}
        {albums.length > 1 && (
          <div className="absolute top-2 left-2 right-2 h-20 bg-white/80 border border-brand-200/20 rounded-2xl scale-[0.96] opacity-80 shadow-sm transition-all duration-300 pointer-events-none"></div>
        )}
        
        {/* Card 1 (Front - Active Album) */}
        <div 
          onClick={() => setShowAlbumSelector(true)}
          className="absolute top-0 left-0 right-0 h-20 bg-white border border-brand-500 ring-2 ring-brand-500/10 rounded-2xl shadow-md p-3.5 flex items-center justify-between cursor-pointer transition-all duration-300 hover:border-brand-600"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-500 flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5 fill-brand-500/10" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase tracking-wider text-brand-500 font-bold">Активный альбом</span>
              <h4 className="font-serif font-bold text-sm text-brand-900 truncate">
                {activeAlbum.name}
              </h4>
              <p className="text-[10px] text-brand-600 font-medium">
                {getAlbumCountText(photoCount, activeAlbum.name)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Cycle Prev */}
            {albums.length > 1 && (
              <button 
                onClick={() => handleCycleAlbum(-1)}
                className="w-8 h-8 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Предыдущий альбом"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            
            {/* Show All */}
            <button 
              onClick={() => setShowAlbumSelector(true)}
              className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-[10px] uppercase tracking-wider transition-colors cursor-pointer shadow-sm animate-pulse-subtle"
            >
              Все ({albums.length})
            </button>
            
            {/* Cycle Next */}
            {albums.length > 1 && (
              <button 
                onClick={() => handleCycleAlbum(1)}
                className="w-8 h-8 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Следующий альбом"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const totalPhotos = photos.length;
  const usedBytes = storage.used || 0;
  const limitBytes = storage.limit || 1073741824;
  const percentUsed = Math.min(Math.round((usedBytes / limitBytes) * 100), 100);
  const percentFree = 100 - percentUsed;

  // Render unified view
  return (
    <div className="w-full max-w-5xl mx-auto px-2">
      {/* 1. Storage Reassuring Banner */}
      <div className="bg-white border border-brand-200/30 px-4 py-3 rounded-2xl mb-6 flex flex-wrap items-center justify-between gap-3 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
          <span className="font-semibold text-brand-900">Ваше уютное хранилище:</span>
          <span className="text-brand-600 font-light">Свободно еще {percentFree}%</span>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-32 bg-brand-100 h-1.5 rounded-full overflow-hidden shrink-0">
            <div 
              className="bg-brand-50 h-full rounded-full transition-all duration-500"
              style={{ width: `${percentUsed}%` }}
            ></div>
          </div>
          <span className="text-[10px] text-brand-900 font-bold uppercase tracking-wider shrink-0">{percentUsed}%</span>
        </div>
      </div>

      {/* 2. Upload Zone (compact, above albums) */}
      {activeAlbum && (
        <UploadZone 
          token={token} 
          albumId={activeAlbum.id}
          onUploadComplete={() => {
            fetchAlbumPhotos(activeAlbum.id, true);
            fetchAlbums(false);
            onUploadComplete();
          }} 
        />
      )}

      {/* 3. Album Selection Area (fanned card deck horizontal carousel) */}
      <div className="mb-6 overflow-y-visible">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-base font-bold text-brand-900">Ваши Альбомы</h3>
          <button
            onClick={() => setShowCreateAlbum(true)}
            className="flex items-center gap-1 text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-xl cursor-pointer transition-colors shadow-sm"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Создать альбом
          </button>
        </div>

        {loadingAlbums ? (
          <div className="text-center py-6 text-brand-500 text-xs font-semibold">Загрузка альбомов...</div>
        ) : (
          <div className="albums-carousel overflow-y-visible">
            {/* Create Album Card at the first position */}
            <div
              onClick={() => setShowCreateAlbum(true)}
              className="album-card border border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50/20 rounded-2xl p-4 cursor-pointer flex flex-col items-center justify-center gap-2 text-brand-600 hover:text-brand-900 transition-all font-semibold text-xs h-32"
            >
              <FolderPlus className="w-5 h-5 text-brand-500" />
              <span>Создать альбом</span>
            </div>

            {albums.map((album, index) => {
              const isActive = activeAlbum && activeAlbum.id === album.id;
              const photoCount = album.photoCount || 0;
              return (
                <div
                  key={album.id}
                  onClick={() => {
                    if (activeAlbum && activeAlbum.id === album.id) {
                      fetchAlbumPhotos(album.id, true);
                    } else {
                      setActiveAlbum(album);
                    }
                    setIsSelectMode(false);
                    setSelectedPhotoIds([]);
                    setTargetAlbumForSelect(null);
                  }}
                  draggable={!isSelectMode && album.name !== 'Общий' && album.id !== 'trash'}
                  onDragStart={(e) => handleAlbumDragStart(e, index)}
                  onDragOver={(e) => {
                    if (draggedAlbumIndex !== null) {
                      handleAlbumDragOver(e, index);
                    } else if (draggedPhotoId !== null) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={(e) => {
                    if (draggedPhotoId !== null || e.dataTransfer.getData('photoId')) {
                      handleDropPhotoOnAlbum(e, album.id);
                    } else {
                      handleAlbumDrop(e, index);
                    }
                  }}
                  onDragEnd={handleAlbumDragEnd}
                  className={`album-card bg-white border rounded-2xl p-4 cursor-pointer select-none flex flex-col justify-between h-32
                    ${isActive 
                      ? 'active-card border-brand-500 ring-2 ring-brand-500/10 bg-brand-50/20 shadow-sm' 
                      : 'border-brand-200/40 hover:border-brand-400'
                    }
                  `}
                >
                  <div className="flex justify-between items-start w-full">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-500 flex items-center justify-center shrink-0">
                      <Folder className="w-4.5 h-4.5 fill-brand-500/10" />
                    </div>
                    
                    {album.name !== 'Общий' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAlbum(album.id);
                        }}
                        className="w-6 h-6 rounded-full hover:bg-red-50 text-brand-400 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="Удалить альбом"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="min-w-0 mt-3">
                    <h4 className="font-serif font-bold text-xs text-brand-900 truncate">
                      {album.name}
                    </h4>
                    <p className="text-[9px] text-brand-500 font-semibold mt-0.5 uppercase tracking-wide leading-none">
                      {getAlbumCountText(photoCount, album.name)}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {/* Show All Card */}
            <div
              onClick={() => setShowAlbumSelector(true)}
              className="album-card border border-dashed border-brand-300 hover:border-brand-500 hover:bg-brand-50/20 rounded-2xl p-4 cursor-pointer flex flex-col items-center justify-center gap-2 text-brand-600 hover:text-brand-900 transition-all font-semibold text-xs h-32"
            >
              <Folder className="w-5 h-5 text-brand-500" />
              <span className="text-[10px] text-center leading-tight">Все альбомы ({albums.length})</span>
            </div>

            {/* Trash Bin Card */}
            <div
              onClick={() => {
                setActiveAlbum({ id: 'trash', name: 'Корзина' });
                setIsSelectMode(false);
                setSelectedPhotoIds([]);
              }}
              className={`album-card bg-white border rounded-2xl p-4 cursor-pointer select-none flex flex-col justify-between h-32 transition-all
                ${activeAlbum && activeAlbum.id === 'trash'
                  ? 'active-card border-red-500 ring-2 ring-red-500/10 bg-red-50/10 shadow-sm'
                  : 'border-brand-200/40 hover:border-red-450'
                }
              `}
            >
              <div className="flex justify-between items-start w-full">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors
                  ${activeAlbum && activeAlbum.id === 'trash'
                    ? 'bg-red-100 text-red-500'
                    : 'bg-brand-100 text-brand-500'
                  }
                `}>
                  <Trash2 className="w-4.5 h-4.5" />
                </div>
              </div>

              <div className="min-w-0 mt-3">
                <h4 className="font-serif font-bold text-xs text-brand-900 truncate">
                  Корзина
                </h4>
                <p className="text-[9px] text-brand-500 font-semibold mt-0.5 uppercase tracking-wide leading-none">
                  Удаленные снимки
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Active Album Photos Area */}
      {activeAlbum && (
        <div className="animate-photo-entry">
          {targetAlbumForSelect && (
            <div className="mb-6 p-4 bg-brand-100/70 border border-brand-300/40 rounded-2xl flex items-center justify-between shadow-inner animate-photo-entry">
              <div className="flex items-center gap-2.5">
                <Folder className="w-5 h-5 text-brand-500 shrink-0" />
                <div className="text-xs text-brand-900 font-semibold leading-snug">
                  Выберите фотографии для добавления в альбом «{targetAlbumForSelect.name}».
                </div>
              </div>
              <button
                onClick={() => {
                  setTargetAlbumForSelect(null);
                  setIsSelectMode(false);
                  setSelectedPhotoIds([]);
                  setActiveAlbum(targetAlbumForSelect);
                }}
                className="text-xs font-bold text-brand-500 hover:text-brand-850 cursor-pointer underline px-2 py-1 shrink-0 uppercase tracking-wider"
              >
                Отмена
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-4 border-t border-brand-200/30">
            <div>
              <h3 className="font-serif text-lg md:text-xl text-brand-900 font-semibold">
                {activeAlbum.id === 'trash' 
                  ? 'Корзина' 
                  : (activeAlbum.name === 'Видео' ? 'Видео' : `Фотографии: ${activeAlbum.name}`)}
              </h3>
              <p className="text-[11px] text-brand-900 font-light mt-0.5">
                {getAlbumCountText(totalPhotos, activeAlbum.name)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {activeAlbum.id === 'trash' && !isSelectMode && totalPhotos > 0 && (
                <button
                  onClick={handleEmptyTrash}
                  className="flex items-center gap-1.5 text-xs font-semibold border border-red-200 hover:bg-red-50 text-red-600 px-3.5 py-2 rounded-2xl cursor-pointer transition-colors shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Очистить корзину
                </button>
              )}

              {activeAlbum.name !== 'Общий' && activeAlbum.id !== 'trash' && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold border border-brand-200 hover:bg-brand-100/30 text-brand-800 px-3.5 py-2 rounded-2xl cursor-pointer transition-colors shadow-sm"
                >
                  <Share2 className="w-3.5 h-3.5 text-brand-500" />
                  Поделиться
                </button>
              )}

              {!isSelectMode ? (
                <button
                  onClick={() => setIsSelectMode(true)}
                  disabled={totalPhotos === 0}
                  className="text-xs font-semibold border border-brand-200 hover:bg-brand-100/30 text-brand-800 px-3.5 py-2 rounded-2xl cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Выбрать фото
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsSelectMode(false);
                    setSelectedPhotoIds([]);
                  }}
                  className="text-xs font-semibold border border-brand-300 text-brand-600 hover:text-brand-950 px-3.5 py-2 rounded-2xl cursor-pointer transition-colors"
                >
                  Выйти из выбора
                </button>
              )}
            </div>
          </div>

          <div className="w-full h-[1px] bg-brand-200/20 my-8"></div>

          {/* Album Photos Grid */}
          {loadingPhotos ? (
            <div className="text-center py-12 text-brand-500 text-xs font-semibold">Загрузка воспоминаний...</div>
          ) : totalPhotos === 0 ? (
            <div className="text-center py-16 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-brand-100/60 flex items-center justify-center text-brand-400 mb-4">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h4 className="font-serif text-base text-brand-800 mb-1">
                {activeAlbum.id === 'trash' ? 'Корзина пуста' : 'В альбоме пока пусто'}
              </h4>
              <p className="text-xs text-brand-600 font-light max-w-xs mx-auto leading-relaxed mb-4">
                {activeAlbum.id === 'trash' 
                  ? 'Сюда попадают фотографии, которые вы удаляете из альбомов. Они будут храниться 30 дней, после чего автоматически удалятся навсегда.' 
                  : 'Сделайте снимок на камеру или выберите готовые кадры из галереи телефона выше, чтобы они сохранились в альбоме.'
                }
              </p>
              {activeAlbum.id !== 'trash' && activeAlbum.name !== 'Общий' && (
                <button
                  onClick={() => handleStartSelectForAlbum(activeAlbum)}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-2xl cursor-pointer transition-colors shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Выбрать из существующих воспоминаний
                </button>
              )}
            </div>
          ) : (
            <>
              {activeAlbum.id === 'trash' && (
                <div className="mb-6 p-4 bg-brand-50 border border-brand-200/40 rounded-2xl flex items-start gap-3 shadow-inner">
                  <span className="text-lg">💡</span>
                  <div className="text-xs text-brand-800 font-light leading-relaxed">
                    <b>Очистка файлов:</b> Файлы из корзины автоматически удаляются на 31-й день после перемещения. Вы также можете удалить их навсегда вручную или восстановить в любой момент.
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
              {photos.map((photo, index) => {
                const isSelected = selectedPhotoIds.includes(photo.id);
                return (
                  <div
                    key={photo.id}
                    draggable={!isSelectMode}
                    onDragStart={(e) => handlePhotoDragStart(e, index, photo.id)}
                    onDragEnd={handlePhotoDragEnd}
                    onDragOver={handlePhotoDragOver}
                    onDrop={(e) => handlePhotoDropInsideAlbum(e, index)}
                    onClick={() => {
                      if (isSelectMode) {
                        handlePhotoSelect(photo.id);
                      } else {
                        setSelectedIndex(index);
                      }
                    }}
                    className={`group relative aspect-square bg-brand-100 rounded-3xl overflow-hidden shadow-sm card-hover cursor-pointer
                      ${isSelected ? 'ring-4 ring-brand-500 ring-offset-2' : ''}
                    `}
                  >
                    {photo.url ? (
                      photo.mime_type && photo.mime_type.startsWith('video/') ? (
                        <div className="relative w-full h-full">
                          <video
                            src={`${photo.url.startsWith('http') ? photo.url : `${backendUrl}${photo.url}`}#t=0.001`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none"
                            preload="metadata"
                            playsInline
                            muted
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className="w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center text-brand-600 transition-transform group-hover:scale-110">
                              <Play className="w-4 h-4 fill-brand-600 ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={photo.url.startsWith('http') ? photo.url : `${backendUrl}${photo.url}`}
                          alt={photo.original_name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 select-none pointer-events-none"
                          loading="lazy"
                          draggable="false"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-400">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                    
                    {/* Favorite badge indicator */}
                    {photo.is_favorite && (
                      <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm text-brand-500">
                        <Heart className="w-4 h-4 fill-brand-500 text-brand-500" />
                      </div>
                    )}

                    {/* iPhone style selection indicator overlay */}
                    {isSelectMode ? (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full border-2 border-white bg-black/30 flex items-center justify-center shadow-sm transition-all">
                        {isSelected && (
                          <div className="w-full h-full bg-brand-500 rounded-full flex items-center justify-center text-white">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Soft overlay on hover (desktop only) */
                      <div className="absolute inset-0 bg-brand-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-white/90 text-brand-800 flex items-center justify-center shadow-md">
                          <Eye className="w-5 h-5" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      )}

      {/* Sticky Bottom Actions Bar for Selection Mode */}
      {isSelectMode && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 bg-white/90 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-3.5 rounded-[24px] sm:rounded-3xl border border-brand-200/50 shadow-2xl flex items-center justify-between gap-3 sm:gap-6 max-w-md mx-auto animate-photo-entry">
          <span className="text-xs font-semibold text-brand-800 shrink-0">
            Выбрано: {selectedPhotoIds.length}
          </span>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button 
              onClick={() => {
                setIsSelectMode(false);
                setSelectedPhotoIds([]);
                setTargetAlbumForSelect(null);
              }}
              className="text-xs font-medium text-brand-600 hover:text-brand-950 px-3 py-2 border border-brand-200 rounded-2xl cursor-pointer transition-colors active:scale-95 shrink-0"
            >
              Отмена
            </button>
            
            {activeAlbum && activeAlbum.id === 'trash' ? (
              <>
                <button 
                  onClick={handleBulkRestore}
                  disabled={selectedPhotoIds.length === 0}
                  className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white px-3.5 py-2 rounded-2xl cursor-pointer disabled:opacity-50 transition-all active:scale-95 shadow-sm shrink-0"
                >
                  Восстановить
                </button>
                <button 
                  onClick={handleBulkDeletePermanent}
                  disabled={selectedPhotoIds.length === 0}
                  className="text-xs font-semibold bg-red-500 hover:bg-red-650 text-white px-3.5 py-2 rounded-2xl cursor-pointer disabled:opacity-50 transition-all active:scale-95 shadow-sm shrink-0"
                >
                  Удалить
                </button>
              </>
            ) : targetAlbumForSelect ? (
              <button 
                onClick={async () => {
                  await handleAddSelectedToAlbum(targetAlbumForSelect.id);
                  setActiveAlbum(targetAlbumForSelect);
                  setTargetAlbumForSelect(null);
                }}
                disabled={selectedPhotoIds.length === 0}
                className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white px-3.5 py-2 rounded-2xl cursor-pointer disabled:opacity-50 transition-all active:scale-95 shadow-sm shrink-0"
              >
                Добавить
              </button>
            ) : (
              <button 
                onClick={() => setShowAddToAlbum(true)}
                disabled={selectedPhotoIds.length === 0}
                className="text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white px-3.5 py-2 rounded-2xl cursor-pointer disabled:opacity-50 transition-all active:scale-95 shadow-sm shrink-0"
              >
                В альбом
              </button>
            )}
          </div>
        </div>
      )}

      {/* Popup Dialog: Add selected photos to album */}
      {showAddToAlbum && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-md">
          <div className="bg-white/90 rounded-[28px] p-6 max-w-sm w-full border border-brand-200/40 shadow-2xl backdrop-blur-lg animate-photo-entry">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-lg font-semibold text-brand-900">Выберите альбом</h3>
              <button 
                onClick={() => setShowAddToAlbum(false)}
                className="text-brand-400 hover:text-brand-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-brand-600 font-light mb-4">
              Выберите, в какой альбом переместить {selectedPhotoIds.length} выбр. {getPhotoWord(selectedPhotoIds.length)}:
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {albums
                .filter(a => a.name !== 'Общий' && (!activeAlbum || a.id !== activeAlbum.id))
                .map(album => (
                  <button
                    key={album.id}
                    onClick={() => handleAddSelectedToAlbum(album.id)}
                    className="w-full text-left p-3.5 rounded-2xl bg-brand-50 hover:bg-brand-100/50 font-serif font-bold text-xs text-brand-900 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>{album.name}</span>
                    <Folder className="w-4 h-4 text-brand-400" />
                  </button>
                ))
              }
              
              {albums.filter(a => a.name !== 'Общий' && (!activeAlbum || a.id !== activeAlbum.id)).length === 0 && (
                <div className="text-center py-4 text-xs text-brand-500 font-light">
                  Нет других альбомов. Создайте новый ниже!
                </div>
              )}
            </div>

            <div className="border-t border-brand-100 my-4 pt-4">
              <button
                onClick={() => {
                  const name = prompt('Введите название нового альбома:');
                  if (name) handleCreateAlbumAndAddSelected(name);
                }}
                className="w-full py-3 border-2 border-dashed border-brand-200 hover:border-brand-400 hover:bg-brand-50 rounded-2xl text-xs font-semibold text-brand-600 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Создать новый альбом
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Album */}
      {showCreateAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-md">
          <form 
            onSubmit={handleCreateAlbum}
            className="bg-white/90 rounded-[28px] p-6 max-w-sm w-full border border-brand-200/40 shadow-2xl backdrop-blur-lg animate-photo-entry"
          >
            <h3 className="font-serif text-lg font-semibold text-brand-900 mb-4">Новый фотоальбом</h3>
            <input
              type="text"
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              placeholder="Название (например, Отпуск 2026)"
              required
              className="w-full px-4 py-3 bg-brand-50 border border-brand-200/60 rounded-2xl text-base text-brand-900 focus:outline-none focus:border-brand-500 font-medium mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateAlbum(false)}
                className="flex-1 py-3 border border-brand-200 text-brand-600 rounded-2xl text-xs font-semibold hover:bg-brand-50 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-xs font-semibold cursor-pointer shadow-sm"
              >
                Создать
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Modal: Album Created Action Prompt */}
      {createdAlbumContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-md">
          <div className="bg-white/90 rounded-[28px] p-6 max-w-sm w-full border border-brand-200/40 shadow-2xl backdrop-blur-lg animate-photo-entry text-center">
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4">
              <FolderPlus className="w-6 h-6" />
            </div>
            
            <h3 className="font-serif text-lg font-semibold text-brand-900 mb-2">
              Альбом создан!
            </h3>
            
            <p className="text-xs text-brand-900/60 font-light mb-6 leading-relaxed">
              Вы успешно создали альбом <strong>«{createdAlbumContext.name}»</strong>. Что вы хотите сделать дальше?
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Select existing photos */}
              <button
                onClick={() => {
                  const general = albums.find(a => a.name === 'Общий');
                  if (general) {
                    setActiveAlbum(general);
                  }
                  setIsSelectMode(true);
                  setSelectedPhotoIds([]);
                  setTargetAlbumForSelect(createdAlbumContext);
                  setCreatedAlbumContext(null);
                  showToast('Выберите воспоминания в галерее для добавления.');
                }}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-xs font-semibold cursor-pointer transition-colors shadow-sm"
              >
                Выбрать воспоминания из галереи
              </button>

              {/* Option 2: Upload new photos */}
              <button
                onClick={() => {
                  setActiveAlbum(createdAlbumContext);
                  setCreatedAlbumContext(null);
                  showToast('Используйте область загрузки выше для добавления новых файлов.');
                }}
                className="w-full py-3 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-900 rounded-2xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Загрузить новые файлы
              </button>

              {/* Option 3: Do nothing / Close */}
              <button
                onClick={() => {
                  setActiveAlbum(createdAlbumContext);
                  setCreatedAlbumContext(null);
                }}
                className="w-full py-3 text-brand-500 hover:text-brand-700 text-xs font-semibold cursor-pointer"
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Modal: Share Album */}
      {showShareModal && activeAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-md">
          <div className="bg-white/90 rounded-[28px] p-6 max-w-md w-full border border-brand-200/40 shadow-2xl backdrop-blur-lg animate-photo-entry">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-lg font-semibold text-brand-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-brand-500" />
                Общий доступ к альбому
              </h3>
              <button 
                onClick={() => { setShowShareModal(false); setCopied(false); }}
                className="text-brand-400 hover:text-brand-900 transition-colors p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-brand-600 font-light leading-relaxed mb-5">
              Создайте публичную ссылку, чтобы поделиться этим альбомом с близкими. Все, у кого есть ссылка, смогут просматривать фотографии.
            </p>

            {sharingLoading ? (
              <div className="text-center py-6 text-brand-500 text-xs font-semibold">
                Загрузка...
              </div>
            ) : activeAlbum.share_token ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-brand-50/60 border border-brand-200/40 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand-400 block mb-1">
                    Публичная ссылка
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getShareUrl(activeAlbum.share_token)}
                      className="flex-1 bg-transparent border-none focus:outline-none text-xs font-semibold text-brand-800 truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(getShareUrl(activeAlbum.share_token));
                        setCopied(true);
                        showToast('Ссылка скопирована в буфер обмена!');
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="p-2 bg-white hover:bg-brand-100/50 border border-brand-200 rounded-xl text-brand-600 hover:text-brand-900 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                      title="Копировать ссылку"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={getShareUrl(activeAlbum.share_token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white hover:bg-brand-100/50 border border-brand-200 rounded-xl text-brand-600 hover:text-brand-900 transition-all flex items-center justify-center shrink-0"
                      title="Открыть ссылку"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand-400 block mb-1">
                    Поделиться в соцсетях
                  </span>
                  <div className="flex gap-2">
                    {/* Telegram */}
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(getShareUrl(activeAlbum.share_token))}&text=${encodeURIComponent(`Посмотри мой фотоальбом «${activeAlbum.name}»!`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-[#229ED9] hover:opacity-90 text-white text-center text-xs font-bold rounded-2xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      Telegram
                    </a>
                    {/* WhatsApp */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Посмотри мой фотоальбом «${activeAlbum.name}»: ${getShareUrl(activeAlbum.share_token)}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-[#25D366] hover:opacity-90 text-white text-center text-xs font-bold rounded-2xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      WhatsApp
                    </a>
                    {/* VK */}
                    <a
                      href={`https://vk.com/share.php?url=${encodeURIComponent(getShareUrl(activeAlbum.share_token))}&title=${encodeURIComponent(`Фотоальбом «${activeAlbum.name}»`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-[#0077FF] hover:opacity-90 text-white text-center text-xs font-bold rounded-2xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      ВКонтакте
                    </a>
                  </div>
                </div>

                <button
                  onClick={handleDisableSharing}
                  className="w-full py-3 mt-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl text-xs font-semibold hover:text-red-700 transition-colors border border-red-200/50 cursor-pointer"
                >
                  Отключить доступ по ссылке
                </button>
              </div>
            ) : (
              <button
                onClick={handleEnableSharing}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl text-xs font-semibold cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                <Globe className="w-4 h-4" />
                Включить доступ по ссылке
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen iPhone-style Lightbox */}
      {selectedPhoto && (
        <div 
          ref={lightboxRef}
          onClick={() => {
            setSelectedIndex(null);
            setShowOptionsDropdown(false);
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 p-4 md:p-6 backdrop-blur-md transition-all duration-300 cursor-pointer select-none"
        >
          {/* Top bar: Memory count, Options Menu & Close */}
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
            
            {/* Options Dropdown list (iPhone style) */}
            <div className="flex items-center gap-2 relative">
              <div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptionsDropdown(!showOptionsDropdown);
                  }}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm"
                  title="Опции"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                
                {showOptionsDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-neutral-900/95 border border-neutral-800 rounded-2xl shadow-xl z-[60] overflow-hidden py-1.5 animate-photo-entry backdrop-blur-md">
                    {activeAlbum && activeAlbum.id === 'trash' ? (
                      <>
                        {/* Восстановить */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setShowOptionsDropdown(false);
                            await handleRestoreSinglePhoto(selectedPhoto.id);
                          }}
                          className="w-full text-left px-4 py-3 text-xs text-white hover:bg-white/5 transition-colors font-medium cursor-pointer flex items-center justify-between"
                        >
                          <span>Восстановить</span>
                          <RefreshCw className="w-4 h-4 text-white/60" />
                        </button>

                        {/* Удалить навсегда */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowOptionsDropdown(false);
                            handleDeletePhotoPermanent(selectedPhoto.id);
                          }}
                          className="w-full text-left px-4 py-3 text-xs text-red-400 hover:text-red-350 hover:bg-red-950/20 transition-colors font-semibold cursor-pointer flex items-center justify-between border-t border-neutral-800/40"
                        >
                          <span>Удалить навсегда</span>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </>
                    ) : (
                      <>
                        {/* В избранное / Из избранного */}
                        <button
                          onClick={(e) => {
                            toggleFavorite(selectedPhoto, e);
                            setShowOptionsDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 text-xs text-white hover:bg-white/5 transition-colors font-medium cursor-pointer flex items-center justify-between"
                        >
                          <span>{selectedPhoto.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}</span>
                          <Heart className={`w-4 h-4 ${selectedPhoto.is_favorite ? 'text-brand-500 fill-brand-500' : 'text-white/60'}`} />
                        </button>

                        {/* Добавить в альбом */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowOptionsDropdown(false);
                            setSelectedPhotoIds([selectedPhoto.id]);
                            setShowAddToAlbum(true);
                          }}
                          className="w-full text-left px-4 py-3 text-xs text-white hover:bg-white/5 transition-colors font-medium cursor-pointer flex items-center justify-between"
                        >
                          <span>Добавить в альбом</span>
                          <FolderPlus className="w-4 h-4 text-white/60" />
                        </button>

                        {/* Убрать из этого альбома */}
                        {activeAlbum && activeAlbum.name !== 'Общий' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowOptionsDropdown(false);
                              handleRemovePhotoFromAlbum(selectedPhoto.id);
                            }}
                            className="w-full text-left px-4 py-3 text-xs text-white hover:bg-white/5 transition-colors font-medium cursor-pointer flex items-center justify-between border-t border-neutral-800/40"
                          >
                            <span>Убрать из этого альбома</span>
                            <X className="w-4 h-4 text-white/60" />
                          </button>
                        )}

                        {/* Удалить */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowOptionsDropdown(false);
                            handleDeletePhoto(selectedPhoto.id);
                          }}
                          className="w-full text-left px-4 py-3 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors font-semibold cursor-pointer flex items-center justify-between border-t border-neutral-800/40"
                        >
                          <span>Удалить</span>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={() => {
                  setSelectedIndex(null);
                  setShowOptionsDropdown(false);
                }} 
                className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm active:scale-95"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Photo Area flanked by navigation arrows */}
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

            {/* The Photo or Video */}
            {selectedPhoto.mime_type && selectedPhoto.mime_type.startsWith('video/') ? (
              <div 
                onClick={(e) => e.stopPropagation()} 
                className="max-w-full max-h-[75vh] md:max-h-[80vh] flex items-center justify-center"
              >
                <video
                  key={selectedIndex}
                  src={selectedPhoto.url.startsWith('http') ? selectedPhoto.url : `${backendUrl}${selectedPhoto.url}`}
                  controls
                  autoPlay
                  className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl animate-photo-entry cursor-default"
                />
              </div>
            ) : (
              <img
                key={selectedIndex}
                src={selectedPhoto.url.startsWith('http') ? selectedPhoto.url : `${backendUrl}${selectedPhoto.url}`}
                alt={selectedPhoto.original_name}
                draggable="false"
                onClick={(e) => e.stopPropagation()}
                className="max-w-full max-h-[75vh] md:max-h-[80vh] rounded-2xl object-contain shadow-2xl animate-photo-entry select-none cursor-default"
              />
            )}

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

          {/* Bottom actions panel (iPhone Style) */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm rounded-3xl p-4 flex items-center justify-around shadow-2xl z-50 mb-2"
          >
            {/* Toggle Favorite heart button */}
            <button
              onClick={(e) => toggleFavorite(selectedPhoto, e)}
              className="flex flex-col items-center gap-1 text-[10px] font-bold text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <Heart className={`w-5 h-5 transition-all ${
                selectedPhoto.is_favorite ? 'text-brand-500 fill-brand-500 scale-110' : 'text-white/70'
              }`} />
              <span>{selectedPhoto.is_favorite ? 'В избранном' : 'В избранное'}</span>
            </button>

            {/* Select this photo button (exits to Grid selection mode) */}
            <button
              onClick={() => {
                const photoId = selectedPhoto.id;
                setSelectedIndex(null);
                setIsSelectMode(true);
                setSelectedPhotoIds([photoId]);
              }}
              className="flex flex-col items-center gap-1 text-[10px] font-bold text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <Check className="w-5 h-5 text-white/70" />
              <span>Выбрать</span>
            </button>
          </div>
        </div>
      )}

      {/* Custom Toast Alert */}
      {toast.message && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] animate-slide-in">
          <div className={`px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md border text-sm font-semibold transition-all duration-300
            ${toast.type === 'error'
              ? 'bg-red-50/90 border-red-200 text-red-800'
              : toast.type === 'info'
                ? 'bg-brand-50/90 border-brand-200 text-brand-800'
                : 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
            }
          `}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
            ) : toast.type === 'info' ? (
              <Info className="w-4.5 h-4.5 text-brand-500 shrink-0" />
            ) : (
              <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 bg-brand-950/50 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white/90 border border-brand-200/40 max-w-sm w-full rounded-[28px] p-6 shadow-2xl backdrop-blur-lg animate-scale-in">
            <h4 className="font-serif text-base font-bold text-brand-900 mb-2">Подтверждение</h4>
            <p className="text-xs text-brand-700 font-light leading-relaxed mb-6">
              {confirmConfig.message}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmConfig({ isOpen: false, message: '', onConfirm: null })}
                className="px-4 py-2 rounded-xl border border-brand-200 hover:bg-brand-50 text-xs font-semibold text-brand-700 cursor-pointer transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  const onConfirmCallback = confirmConfig.onConfirm;
                  setConfirmConfig({ isOpen: false, message: '', onConfirm: null });
                  if (onConfirmCallback) {
                    await onConfirmCallback();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-semibold text-white cursor-pointer transition-colors shadow-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Searchable Album Selector Modal */}
      {showAlbumSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden animate-scale-in flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-brand-900">Выбор альбома</h3>
              <button 
                onClick={() => {
                  setShowAlbumSelector(false);
                  setAlbumSearchQuery('');
                }}
                className="w-8 h-8 rounded-full hover:bg-brand-50 text-brand-400 hover:text-brand-900 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Search input */}
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Поиск альбома..."
                  value={albumSearchQuery}
                  onChange={(e) => setAlbumSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-brand-50 border border-brand-200 rounded-xl text-base focus:outline-none focus:border-brand-400 text-brand-900 font-light"
                />
                <Search className="w-4 h-4 text-brand-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              
              {/* Albums list */}
              <div className="space-y-2">
                {albums
                  .filter(a => a.name.toLowerCase().includes(albumSearchQuery.toLowerCase()))
                  .map(album => {
                    const isActive = activeAlbum && activeAlbum.id === album.id;
                    const photoCount = album.photoCount || 0;
                    return (
                      <div
                        key={album.id}
                        onClick={() => {
                          setActiveAlbum(album);
                          setShowAlbumSelector(false);
                          setAlbumSearchQuery('');
                          setIsSelectMode(false);
                          setSelectedPhotoIds([]);
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-200
                          ${isActive 
                            ? 'border-brand-500 bg-brand-50/40 font-bold' 
                            : 'border-brand-100 hover:border-brand-300 hover:bg-brand-50/10'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-500 flex items-center justify-center shrink-0">
                            <Folder className="w-4 h-4 fill-brand-500/10" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-serif text-xs text-brand-900 truncate">{album.name}</h4>
                            <p className="text-[10px] text-brand-500 font-medium">{getAlbumCountText(photoCount, album.name)}</p>
                          </div>
                        </div>
                        
                        {isActive && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
                      </div>
                    );
                  })}
                {albums.filter(a => a.name.toLowerCase().includes(albumSearchQuery.toLowerCase())).length === 0 && (
                  <div className="text-center py-8 text-brand-500 text-xs">Альбомы не найдены</div>
                )}
              </div>
            </div>

            {/* Footer with inline quick-create */}
            <div className="p-4 bg-brand-50/60 border-t border-brand-100">
              <button
                onClick={() => {
                  setShowAlbumSelector(false);
                  setShowCreateAlbum(true);
                }}
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-xl cursor-pointer transition-colors text-center shadow-sm flex items-center justify-center gap-1.5"
              >
                <FolderPlus className="w-4 h-4" />
                Создать новый альбом
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
