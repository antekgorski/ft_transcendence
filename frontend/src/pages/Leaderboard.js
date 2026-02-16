import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';
import { Template } from './Components';
import api from '../utils/api';
import { ReturnToMenuButton } from './Components';


const MEDIA_BASE_URL = '';


function LeaderboardTable() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setError('');
        const response = await api.get('/games/leaderboard/?limit=100');
        setLeaderboard(response.data || []);
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Failed to fetch leaderboard';
        setError(errorMsg);
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Global Leaderboard</h2>

      {error && (
        <p className="text-red-400 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-gray-400">Loading leaderboard...</p>
      ) : leaderboard.length === 0 ? (
        <p className="text-gray-400">No leaderboard data available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead>
              <tr className="border-b border-slate-600">
                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Rank</th>
                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Username</th>
                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Games Played</th>
                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Games Won</th>
                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Win Rate</th>
                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player, index) => (
                <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-emerald-400">{player.rank}</td>
                  <td className="py-3 px-4">{player.username}</td>
                  <td className="py-3 px-4">{player.games_played}</td>
                  <td className="py-3 px-4">{player.games_won}</td>
                  <td className="py-3 px-4">{player.win_rate}%</td>
                  <td className="py-3 px-4">{player.accuracy_percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function Body() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto text-white">
      <ReturnToMenuButton />
      <LeaderboardTable />
    </div>
  );
}

function LeaderboardPage() {
  return (
    <Template>
      <Body />
    </Template>
  );
}

export default LeaderboardPage;
