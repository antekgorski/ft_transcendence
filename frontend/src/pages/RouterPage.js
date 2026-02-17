import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Template } from './Components';
import api from '../utils/api';

function Body() {
  const navigate = useNavigate();
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(30);
  const pollTimerRef = useRef(null);
  const countdownRef = useRef(null);

  const stopSearch = async () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setIsSearching(false);
    setSecondsLeft(30);
    try {
      await api.post('/games/matchmake/cancel/');
    } catch (err) {
      // Ignore cancel errors.
    }
  };

  const handlePvpClick = async () => {
    setSearchError('');
    setSecondsLeft(30);
    setIsSearching(true);

    try {
      const response = await api.post('/games/matchmake/');
      if (response.data?.status === 'matched' || response.data?.status === 'active') {
        navigate('/game');
        return;
      }
    } catch (err) {
      setSearchError('Nie udalo sie uruchomic matchmakingu.');
      setIsSearching(false);
      return;
    }

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    pollTimerRef.current = setInterval(async () => {
      try {
        const result = await api.post('/games/matchmake/');
        if (result.data?.status === 'matched' || result.data?.status === 'active') {
          await stopSearch();
          navigate('/game');
        }
      } catch (err) {
        setSearchError('Blad podczas wyszukiwania przeciwnika.');
        await stopSearch();
      }
    }, 2000);
  };

  useEffect(() => {
    if (secondsLeft === 0 && isSearching) {
      setSearchError('Brak przeciwnika. Sprobuj ponownie.');
      stopSearch();
    }
  }, [secondsLeft, isSearching]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-8 min-h-[60vh]">
      <h2 className="text-4xl font-bold text-white">Choose Your Destination</h2>
      <div className="flex gap-6">
        <Link
          to="/game"
          className={`px-8 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-bold text-xl text-white transition-colors shadow-lg flex items-center justify-center ${isSearching ? 'opacity-50 pointer-events-none' : ''}`}
        >
          Play Game
        </Link>
        <button
          onClick={handlePvpClick}
          disabled={isSearching}
          className="px-8 py-4 bg-amber-500 hover:bg-amber-600 rounded-lg font-bold text-xl text-white transition-colors shadow-lg"
        >
          Graj PvP
        </button>
        <Link
          to="/profile"
          className={`px-8 py-4 bg-blue-500 hover:bg-blue-600 rounded-lg font-bold text-xl text-white transition-colors shadow-lg flex items-center justify-center ${isSearching ? 'opacity-50 pointer-events-none' : ''}`}
        >
          View Profile
        </Link>
        <Link
          to="/leaderboard"
          className="px-8 py-4 bg-purple-500 hover:bg-purple-600 rounded-lg font-bold text-xl text-white transition-colors shadow-lg flex items-center justify-center"
        >
          View Leaderboard
        </Link>

      </div>
      {isSearching && (
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-6 py-4 text-center text-white">
          <p className="text-lg font-semibold">Szukam przeciwnika...</p>
          <p className="text-sm text-slate-300">Pozostalo: {secondsLeft}s</p>
          <button
            onClick={stopSearch}
            className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-sm font-semibold"
          >
            Anuluj
          </button>
        </div>
      )}
      {searchError && !isSearching && (
        <div className="bg-red-500/20 border border-red-500/60 rounded-lg px-6 py-3 text-red-200">
          {searchError}
        </div>
      )}
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
