import assert from 'assert';

async function testShareFlow() {
  const backendUrl = 'http://localhost:5000';
  console.log('=== STARTING ALBUM SHARING INTEGRATION TESTS ===\n');

  // 1. Authenticate
  console.log('Step 1: Authenticating demo user...');
  const authRes = await fetch(`${backendUrl}/api/auth/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'tbank' })
  });
  const authData = await authRes.json();
  assert.ok(authRes.ok, 'Authentication failed');
  const token = authData.token;
  console.log('Authenticated successfully.');

  // 2. Create custom album
  console.log('\nStep 2: Creating a custom album...');
  const createRes = await fetch(`${backendUrl}/api/albums`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: 'Тестовый Альбом Шаринга' })
  });
  const createData = await createRes.json();
  assert.ok(createRes.ok, 'Failed to create album');
  const albumId = createData.album.id;
  console.log(`Album created: "${createData.album.name}" (ID: ${albumId})`);
  assert.strictEqual(createData.album.share_token, null, 'Album should have null share_token initially');

  // 3. Enable sharing
  console.log('\nStep 3: Enabling sharing for the album...');
  const shareRes = await fetch(`${backendUrl}/api/albums/${albumId}/share`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const shareData = await shareRes.json();
  assert.ok(shareRes.ok, 'Failed to enable album sharing');
  const shareToken = shareData.shareToken;
  console.log(`Sharing enabled. Received shareToken: ${shareToken}`);
  assert.ok(shareToken, 'Received empty shareToken');

  // 4. Retrieve album publicly
  console.log('\nStep 4: Fetching shared album photos publicly (unauthenticated)...');
  const publicRes = await fetch(`${backendUrl}/api/shared/album/${shareToken}`);
  const publicData = await publicRes.json();
  assert.ok(publicRes.ok, 'Failed to retrieve album publicly');
  console.log('Public shared album data:');
  console.log(`- Album Name: ${publicData.albumName}`);
  console.log(`- Owner Name: ${publicData.ownerName}`);
  console.log(`- Photos count: ${publicData.photos.length}`);
  assert.strictEqual(publicData.albumName, 'Тестовый Альбом Шаринга', 'Shared album name mismatch');
  assert.ok(Array.isArray(publicData.photos), 'Photos should be an array');

  // 5. Disable sharing
  console.log('\nStep 5: Disabling sharing...');
  const unshareRes = await fetch(`${backendUrl}/api/albums/${albumId}/share`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const unshareData = await unshareRes.json();
  assert.ok(unshareRes.ok, 'Failed to disable sharing');
  console.log('Disabled sharing response:', unshareData.message);

  // 6. Verify link is now dead (returns 404)
  console.log('\nStep 6: Verifying public link is now dead (should return 404)...');
  const publicResAfter = await fetch(`${backendUrl}/api/shared/album/${shareToken}`);
  const publicDataAfter = await publicResAfter.json();
  console.log(`Status code: ${publicResAfter.status} (Expected: 404)`);
  assert.strictEqual(publicResAfter.status, 404, 'Public album should return 404 after sharing disabled');
  console.log(`Error message returned: "${publicDataAfter.error}"`);

  console.log('\n=== ALL ALBUM SHARING TESTS PASSED SUCCESSFULLY! ===');
}

testShareFlow().catch(err => {
  console.error('\n❌ ALBUM SHARING TEST FAILED:', err.message);
  process.exit(1);
});
