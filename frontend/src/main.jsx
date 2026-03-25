import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import './index.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "502863796435-em7ls9t3q8d99li3vvik0hdq6fnprb1h.apps.googleusercontent.com";

if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
  console.warn("VITE_GOOGLE_CLIENT_ID is missing from environment. Using hardcoded fallback.");
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
