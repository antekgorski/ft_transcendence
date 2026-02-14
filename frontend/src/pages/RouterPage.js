import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Template } from './Components';

function Body() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center gap-8 min-h-[60vh]">
      <h2 className="text-4xl font-bold text-white">Choose Your Destination</h2>
      <div className="flex gap-6">
        <button
          onClick={() => navigate('/game')}
          className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-bold text-xl text-white transition-colors shadow-lg"
        >
          Play Game
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="px-8 py-4 bg-blue-500 hover:bg-blue-600 rounded-lg font-bold text-xl text-white transition-colors shadow-lg"
        >
          View Profile
        </button>
          <button
          onClick={() => navigate('/leaderboard')}
          className="px-8 py-4 bg-purple-500 hover:bg-purple-600 rounded-lg font-bold text-xl text-white transition-colors shadow-lg"
        >
          View Leaderboard
        </button>

      </div>
    </div>
  );
}

function RouterPage() {
  return (
    <Template>
      <Body />
    </Template>
  );
}

export default RouterPage;
