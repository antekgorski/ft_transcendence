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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8">
      <h2 className="px-4 text-center text-2xl font-bold text-white sm:text-4xl">Choose Your Destination</h2>
      <div className="grid w-full max-w-6xl grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/game"
          state={{ startAI: true }}
          className={`flex w-full items-center justify-center rounded-lg bg-emerald-500 px-6 py-3 text-center text-base font-bold text-white shadow-lg transition-colors hover:bg-emerald-600 sm:py-4 sm:text-lg lg:text-xl ${isSearching ? 'pointer-events-none opacity-50' : ''}`}
        >
          Play Against AI
        </Link>
        <button
          onClick={handlePvpClick}
          disabled={isSearching}
          className="w-full rounded-lg bg-amber-500 px-6 py-3 text-center text-base font-bold text-white shadow-lg transition-colors hover:bg-amber-600 disabled:opacity-50 sm:py-4 sm:text-lg lg:text-xl"
        >
          Play Against Player
        </button>
        <Link
          to="/profile"
          onClick={isSearching ? (e) => { e.preventDefault(); stopSearch().then(() => navigate('/profile')); } : undefined}
          className="flex w-full items-center justify-center rounded-lg bg-blue-500 px-6 py-3 text-center text-base font-bold text-white shadow-lg transition-colors hover:bg-blue-600 sm:py-4 sm:text-lg lg:text-xl"
        >
          View Profile
        </Link>
        <Link
          to="/leaderboard"
          className="flex w-full items-center justify-center rounded-lg bg-purple-500 px-6 py-3 text-center text-base font-bold text-white shadow-lg transition-colors hover:bg-purple-600 sm:py-4 sm:text-lg lg:text-xl"
        >
          View Leaderboard
        </Link>

      </div>
      {isSearching && (
        <div className="mx-4 w-full max-w-md rounded-lg border border-slate-700 bg-slate-900/60 px-6 py-4 text-center text-white">
          <p className="text-lg font-semibold">Looking for an Opponent...</p>
          <p className="text-sm text-slate-300">Time Left: {secondsLeft}s</p>
          <button
            onClick={stopSearch}
            className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-sm font-semibold"
          >
            Cancel Search
          </button>
        </div>
      )}
      {searchError && !isSearching && (
        <div className="mx-4 w-full max-w-md rounded-lg border border-red-500/60 bg-red-500/20 px-6 py-3 text-red-200">
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
