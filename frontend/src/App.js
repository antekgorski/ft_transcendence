import React, { useState } from 'react';
import WelcomePage from './pages/WelcomePage';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return <WelcomePage onLogin={() => setIsLoggedIn(true)} />;
  }

  // TODO: Add main app content after login
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Battleship!</h1>
        <p className="text-gray-400 mb-6">Game content coming soon...</p>
        <button
          onClick={() => setIsLoggedIn(false)}
          className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-md font-semibold transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default App;
