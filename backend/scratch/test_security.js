import assert from 'assert';

async function runSecurityTests() {
  const backendUrl = 'http://localhost:5000';
  console.log('=== STARTING SECURITY VERIFICATION TESTS ===\n');

  // Test 1: Path Traversal PUT
  console.log('Test 1: Path Traversal PUT to /api/mock-s3/%2e%2e%2f%2e%2e%2fevil.txt');
  const putRes = await fetch(`${backendUrl}/api/mock-s3/%2e%2e%2f%2e%2e%2fevil.txt`, {
    method: 'PUT',
    body: 'malicious payload'
  });
  console.log(`Status: ${putRes.status} (Expected: 403)`);
  assert.strictEqual(putRes.status, 403, 'Path Traversal PUT was not blocked with 403!');
  console.log('✅ Test 1 Passed: Path Traversal PUT successfully blocked.');

  // Test 2: Path Traversal GET
  console.log('\nTest 2: Path Traversal GET to /api/mock-s3/%2e%2e%2f%2e%2e%2fpackage.json');
  const getRes = await fetch(`${backendUrl}/api/mock-s3/%2e%2e%2f%2e%2e%2fpackage.json`);
  console.log(`Status: ${getRes.status} (Expected: 403)`);
  assert.strictEqual(getRes.status, 403, 'Path Traversal GET was not blocked with 403!');
  console.log('✅ Test 2 Passed: Path Traversal GET successfully blocked.');

  // Test 3: Valid GET (should not return 403, returns 404 since file doesn't exist)
  console.log('\nTest 3: Valid GET path');
  const validGetRes = await fetch(`${backendUrl}/api/mock-s3/user-123/valid-photo.jpg`);
  console.log(`Status: ${validGetRes.status} (Expected: 404)`);
  assert.strictEqual(validGetRes.status, 404, 'Valid path returned unexpected status!');
  console.log('✅ Test 3 Passed: Valid paths are not blocked.');

  // Test 4: Open Redirect Protection on /api/auth/mock-login-confirm
  console.log('\nTest 4: Open Redirect attempt on /api/auth/mock-login-confirm?origin=http://evil.com');
  const redirectRes = await fetch(`${backendUrl}/api/auth/mock-login-confirm?provider=yandex&origin=http://evil.com`, {
    redirect: 'manual'
  });
  const location = redirectRes.headers.get('location');
  console.log(`Redirect Location: ${location}`);
  assert.ok(location, 'No redirect Location header found!');
  assert.ok(!location.startsWith('http://evil.com'), 'Open Redirect vulnerability! Redirected to http://evil.com');
  console.log('✅ Test 4 Passed: Open Redirect blocked (redirected to valid origin instead).');

  // Test 5: Allowed Redirect on /api/auth/mock-login-confirm
  console.log('\nTest 5: Allowed Redirect on /api/auth/mock-login-confirm?origin=http://localhost:5180');
  const allowedRedirectRes = await fetch(`${backendUrl}/api/auth/mock-login-confirm?provider=yandex&origin=http://localhost:5180`, {
    redirect: 'manual'
  });
  const allowedLocation = allowedRedirectRes.headers.get('location');
  console.log(`Redirect Location: ${allowedLocation}`);
  assert.ok(allowedLocation, 'No redirect Location header found!');
  assert.ok(allowedLocation.startsWith('http://localhost:5180'), 'Allowed redirect did not redirect to http://localhost:5180');
  console.log('✅ Test 5 Passed: Redirect to allowed local origin works correctly.');

  console.log('\n=== ALL SECURITY TESTS PASSED SUCCESSFULLY! ===');
}

runSecurityTests().catch(err => {
  console.error('\n❌ SECURITY TEST FAILED:', err.message);
  process.exit(1);
});
