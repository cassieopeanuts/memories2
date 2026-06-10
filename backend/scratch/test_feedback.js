import fs from 'fs';
import path from 'path';

async function testFeedback() {
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
  console.log('Authenticated successfully. Token received.');

  console.log('\n2. Sending test feedback...');
  const feedbackRes = await fetch(`${backendUrl}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Тестировщик Иван',
      email: 'ivan.tester@example.ru',
      message: 'Привет! Это тестовый баг-репорт. При перетаскивании фото в Общем альбоме всё сработало отлично!',
      metadata: {
        url: 'http://localhost:5180/',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        screenSize: '1920x1080'
      }
    })
  });

  const feedbackData = await feedbackRes.json();
  if (!feedbackRes.ok) {
    console.error('Feedback send failed:', feedbackData);
    return;
  }
  console.log('Feedback API response:', feedbackData);

  console.log('\n3. Verifying mock database storage...');
  const mockDbPath = path.join(process.cwd(), 'backend', 'db_mock.json');
  if (fs.existsSync(mockDbPath)) {
    const db = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
    const lastFeedback = db.tester_feedback[db.tester_feedback.length - 1];
    console.log('Last stored feedback entry in db_mock.json:');
    console.log(JSON.stringify(lastFeedback, null, 2));
    
    if (lastFeedback && lastFeedback.message.includes('тестовый баг-репорт')) {
      console.log('\nSUCCESS: Feedback successfully saved in the mock database!');
    } else {
      console.error('\nFAIL: Could not find the feedback in mock DB.');
    }
  } else {
    console.warn('db_mock.json not found in expected folder (using real DB?)');
  }
}

testFeedback().catch(err => console.error('Test error:', err));
