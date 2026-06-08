

async function test() {
  const backendUrl = 'http://localhost:5000';
  
  console.log('1. Authenticating as demo user...');
  const authRes = await fetch(`${backendUrl}/api/auth/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'tbank' })
  });
  const authData = await authRes.json();
  if (!authRes.ok) {
    console.error('Auth failed:', authData);
    return;
  }
  const token = authData.token;
  console.log('Authenticated successfully, token received.');

  console.log('\n2. Fetching albums...');
  const albumsRes = await fetch(`${backendUrl}/api/albums`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const albumsData = await albumsRes.json();
  if (!albumsRes.ok) {
    console.error('Fetch albums failed:', albumsData);
    return;
  }
  console.log('Albums:', JSON.stringify(albumsData.albums, null, 2));

  const generalAlbum = albumsData.albums.find(a => a.name === 'Общий');
  if (!generalAlbum) {
    console.error('Error: "Общий" album not found in list!');
    return;
  }

  console.log(`\n3. Fetching photos for "Общий" album (ID: ${generalAlbum.id})...`);
  const photosRes = await fetch(`${backendUrl}/api/albums/${generalAlbum.id}/photos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const photosData = await photosRes.json();
  if (!photosRes.ok) {
    console.error('Fetch photos failed:', photosData);
    return;
  }
  console.log(`Successfully fetched photos. Total count: ${photosData.photos.length}`);
  console.log('Photos:', JSON.stringify(photosData.photos, null, 2));

  console.log('\n4. Creating custom album...');
  const createRes = await fetch(`${backendUrl}/api/albums`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: 'Мой Новый Альбом' })
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    console.error('Create album failed:', createData);
    return;
  }
  console.log('Custom album created successfully:', createData.album);
  const customAlbumId = createData.album.id;

  console.log('\n5. Confirming a mock photo upload...');
  const confirmRes = await fetch(`${backendUrl}/api/photos/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      s3Key: `${authData.user.id}/mock-photo-1.jpg`,
      originalName: 'sunset.jpg',
      size: 102400,
      mimeType: 'image/jpeg'
    })
  });
  const confirmData = await confirmRes.json();
  if (!confirmRes.ok) {
    console.error('Confirm photo failed:', confirmData);
    return;
  }
  console.log('Photo confirmed successfully response data:', confirmData);
  const photoId = confirmData.photo ? confirmData.photo.id : (confirmData.id || null);

  console.log('\n6. Adding confirmed photo to custom album...');
  const addRes = await fetch(`${backendUrl}/api/albums/${customAlbumId}/photos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      photoIds: [photoId]
    })
  });
  const addData = await addRes.json();
  if (!addRes.ok) {
    console.error('Add photo to album failed:', addData);
    return;
  }
  console.log('Photo added to custom album successfully:', addData);

  console.log('\n7. Toggling photo favorite status to true...');
  const favTrueRes = await fetch(`${backendUrl}/api/photos/${photoId}/favorite`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ isFavorite: true })
  });
  const favTrueData = await favTrueRes.json();
  if (!favTrueRes.ok) {
    console.error('Toggle favorite true failed:', favTrueData);
    return;
  }
  console.log('Toggle favorite true succeeded:', favTrueData);

  console.log('\n8. Fetching albums to verify "Избранное" exists...');
  const albumsVerifyRes = await fetch(`${backendUrl}/api/albums`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const albumsVerifyData = await albumsVerifyRes.json();
  console.log('Updated Albums list:', JSON.stringify(albumsVerifyData.albums, null, 2));

  const favAlbum = albumsVerifyData.albums.find(a => a.name === 'Избранное');
  if (!favAlbum) {
    console.error('FAIL: "Избранное" album was not automatically created!');
    return;
  }
  console.log('SUCCESS: "Избранное" album automatically created with photoCount:', favAlbum.photoCount);

  console.log('\n9. Toggling photo favorite status back to false...');
  const favFalseRes = await fetch(`${backendUrl}/api/photos/${photoId}/favorite`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ isFavorite: false })
  });
  const favFalseData = await favFalseRes.json();
  if (!favFalseRes.ok) {
    console.error('Toggle favorite false failed:', favFalseData);
    return;
  }
  console.log('Toggle favorite false succeeded:', favFalseData);

  console.log('\n10. Fetching albums again to verify "Избранное" photoCount updated...');
  const albumsVerifyRes2 = await fetch(`${backendUrl}/api/albums`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const albumsVerifyData2 = await albumsVerifyRes2.json();
  const favAlbum2 = albumsVerifyData2.albums.find(a => a.name === 'Избранное');
  console.log('SUCCESS: "Избранное" album photoCount after unfavorite:', favAlbum2 ? favAlbum2.photoCount : 'not found');

  console.log('\n11. Testing reordering of photos inside "Общий" album...');
  // Fetch general photos again
  const generalPhotosRes = await fetch(`${backendUrl}/api/albums/${generalAlbum.id}/photos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const generalPhotosData = await generalPhotosRes.json();
  const originalPhotos = generalPhotosData.photos;
  
  if (originalPhotos.length >= 2) {
    // Reverse their positions to simulate a drag-and-drop sort
    const reorderedPositions = originalPhotos.map((photo, index) => ({
      photoId: photo.id,
      position: originalPhotos.length - 1 - index
    }));
    
    console.log('Saving new positions to backend...');
    const reorderRes = await fetch(`${backendUrl}/api/albums/${generalAlbum.id}/photos/positions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ photoPositions: reorderedPositions })
    });
    const reorderData = await reorderRes.json();
    console.log('Reorder response:', reorderData);

    console.log('Fetching photos again to confirm new sorting...');
    const verifyPhotosRes = await fetch(`${backendUrl}/api/albums/${generalAlbum.id}/photos`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const verifyPhotosData = await verifyPhotosRes.json();
    
    // The first photo should now be the one we moved to position 0 (which was the last one originally)
    const originalLastId = originalPhotos[originalPhotos.length - 1].id;
    const newFirstId = verifyPhotosData.photos[0].id;
    if (originalLastId === newFirstId) {
      console.log('SUCCESS: Reordering of "Общий" photos worked perfectly!');
    } else {
      console.error('FAIL: Order did not change or sorting is incorrect.', { originalLastId, newFirstId });
    }
  } else {
    console.log('Skipping sorting test (need at least 2 photos).');
  }
}

test().catch(err => console.error('Error in test:', err));
