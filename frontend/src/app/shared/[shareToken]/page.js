import SharedAlbumWrapper from './SharedAlbumWrapper';

export async function generateMetadata({ params }) {
  const { shareToken } = params;
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  try {
    const response = await fetch(`${backendUrl}/api/albums/shared/album/${shareToken}`, {
      next: { revalidate: 60 }
    });
    if (!response.ok) throw new Error('Failed to load shared album metadata');
    
    const data = await response.json();
    const coverPhoto = data.photos?.[0];
    const coverUrl = coverPhoto?.thumbUrl || coverPhoto?.url || '/logo.png';
    
    return {
      title: `${data.albumName || 'Общий Альбом'} — ЛегкоСохранить.РФ`,
      description: `Посмотрите семейный архив "${data.albumName || 'Альбом'}", которым с вами поделился ${data.ownerName || 'пользователь'}.`,
      openGraph: {
        title: `${data.albumName || 'Общий Альбом'} — ЛегкоСохранить.РФ`,
        description: `Посмотрите семейный архив "${data.albumName || 'Альбом'}", которым с вами поделился ${data.ownerName || 'пользователь'}.`,
        images: [
          {
            url: coverUrl,
            width: 800,
            height: 600,
            alt: data.albumName,
          },
        ],
      },
    };
  } catch (err) {
    console.error('Next.js SSR: Failed to generate metadata for shared album:', err);
    return {
      title: 'Общий Альбом — ЛегкоСохранить.РФ',
      description: 'Посмотрите фотографии в общем альбоме на ЛегкоСохранить.РФ.',
    };
  }
}

export default function SharedAlbumPage({ params }) {
  return <SharedAlbumWrapper shareToken={params.shareToken} />;
}
