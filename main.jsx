import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Get the root element from the HTML
const container = document.getElementById('root');
if (container) {
    // Create a React root and render the App component
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

