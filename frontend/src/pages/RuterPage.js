import React, { useState, useEffect, useContext } from 'react';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';
import { Templete } from './Components';

const MEDIA_BASE_URL = process.env.REACT_APP_MEDIA_URL || API_BASE_URL.replace(/\/api\/?$/, '');




function Body({ onNavigate }) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 min-h-[60vh]">
      <h2 className="text-4xl font-bold text-white">Choose Your Destination</h2>
      <div className="flex gap-6">
        <button
          onClick={() => onNavigate('game')}
          className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-bold text-xl text-white transition-colors shadow-lg"
        >
          Play Game
        </button>
        <button
          onClick={() => onNavigate('profile')}
          className="px-8 py-4 bg-blue-500 hover:bg-blue-600 rounded-lg font-bold text-xl text-white transition-colors shadow-lg"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}

function RuterPage({ onNavigate }) {
  return (
    <Templete>
      <Body onNavigate={onNavigate} />
    </Templete>
  );
}

export default RuterPage;
