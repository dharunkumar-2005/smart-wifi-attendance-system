
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Verify root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Root element not found! Check index.html for <div id="root"></div>');
  throw new Error('Could not find root element with id="root"');
}

// Create and render React root
const root = ReactDOM.createRoot(rootElement);
console.log('✅ React root created successfully');

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('✅ App rendered successfully');
