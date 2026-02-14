import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';

function WelcomePage() {
  const navigate = useNavigate();
  const { checkAuth } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.username || !formData.password) {
      setError('Username and password are required');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login/', {
        identifier: formData.username,
        password: formData.password,
      });

      if (response.status === 200) {
        const data = response.data;
        localStorage.setItem('user', JSON.stringify(data.user));
        setSuccess('Login successful!');
        
        await checkAuth();
        navigate('/');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 
                       err.response?.data?.error_pl || 
                       'Login failed';
      setError(errorMsg);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 p-5">
      <div className="flex flex-col items-center gap-10 max-w-md w-full">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white tracking-wide drop-shadow-lg">
            ⚓ BATTLESHIP
          </h1>
          <p className="text-lg text-emerald-400 mt-2 tracking-wide">
            3D Tactical Multiplayer Game
          </p>
        </div>

        {/* Auth Form */}
        <div className="w-full bg-white/95 rounded-xl shadow-2xl p-10 backdrop-blur-sm">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-center">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
              Login
            </h2>

            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleInputChange}
              required
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-base 
                         focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                         disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-base 
                         focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                         disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-gradient-to-r from-emerald-500 to-emerald-600 
                         text-white font-bold uppercase tracking-wider rounded-md
                         hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'LOGGING IN...' : 'LOGIN'}
            </button>
            
          <button
              type="button"
              onClick={() => window.location.href = `${API_BASE_URL}/auth/oauth/42/start/`}
              className="w-full py-3 bg-blue-600 text-white font-bold uppercase rounded-md
                         hover:bg-blue-700 transition-all"
            >
              Sign in with 42
            </button>

            <p className="text-center text-gray-600 mt-2">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="text-emerald-600 font-semibold hover:text-emerald-700"
              >
                Sign Up
              </Link>
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-2">
            ft_transcendence - 42 School Project
          </p>
          <div className="flex gap-4 justify-center text-sm">
            <Link to="/terms" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Terms of Service
            </Link>
            <span className="text-gray-500">|</span>
            <Link to="/privacy" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePage;
