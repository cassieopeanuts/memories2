import fs from 'fs';
import path from 'path';

const files = [
  's:/PROJECTS/ANTIGRAVITY/memories2/frontend/src/components/Gallery.jsx',
  's:/PROJECTS/ANTIGRAVITY/memories2/frontend/src/components/Hero.jsx',
  's:/PROJECTS/ANTIGRAVITY/memories2/frontend/src/components/ProfileModal.jsx',
  's:/PROJECTS/ANTIGRAVITY/memories2/frontend/src/components/SharedAlbum.jsx',
  's:/PROJECTS/ANTIGRAVITY/memories2/frontend/src/components/Subscription.jsx',
  's:/PROJECTS/ANTIGRAVITY/memories2/frontend/src/components/TesterFeedback.jsx',
  's:/PROJECTS/ANTIGRAVITY/memories2/frontend/src/components/UploadZone.jsx',
  's:/PROJECTS/ANTIGRAVITY/memories2/frontend/src/components/WelcomeAcceptance.jsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    const target = 'const backendUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;';
    const replacement = "const backendUrl = typeof window !== 'undefined' ? (import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`) : 'http://localhost:5000';";
    
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated backendUrl in ${path.basename(file)}`);
    } else {
      console.log(`Target not found in ${path.basename(file)}`);
    }
  } else {
    console.log(`File not found: ${file}`);
  }
});

const galleryFile = 's:/PROJECTS/ANTIGRAVITY/memories2/frontend/src/components/Gallery.jsx';
if (fs.existsSync(galleryFile)) {
  let content = fs.readFileSync(galleryFile, 'utf8');
  const target = 'const origin = window.location.origin;';
  const replacement = "const origin = typeof window !== 'undefined' ? window.location.origin : '';";
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(galleryFile, content, 'utf8');
    console.log('Updated origin in Gallery.jsx');
  }
}
