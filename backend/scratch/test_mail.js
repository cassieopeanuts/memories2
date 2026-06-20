import { sendVerificationCode, sendStorageWarning } from '../src/mail.js';

async function runTests() {
  console.log('--- Testing Mail Simulation ---');
  
  console.log('1. Testing Verification Code...');
  await sendVerificationCode('test@example.com', 'Test User', '123456');

  console.log('2. Testing Storage Warning (90%)...');
  await sendStorageWarning('user-123', 'test@example.com', 'Test User', 966367641, 1073741824, false);

  console.log('3. Testing Storage Full Alert (100%)...');
  await sendStorageWarning('user-123', 'test@example.com', 'Test User', 1073741824, 1073741824, true);

  console.log('4. Testing Warning Throttling (should not print anything because of 24h throttling)...');
  await sendStorageWarning('user-123', 'test@example.com', 'Test User', 1073741824, 1073741824, true);

  console.log('--- Mail Tests Finished ---');
}

runTests().catch(console.error);
