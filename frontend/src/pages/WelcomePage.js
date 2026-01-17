import React, { useState } from 'react';
import '../styles/WelcomePage.css';

function WelcomePage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // Po zalogowaniu/rejestracji
    if (onLogin) {
      onLogin();
    }
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setFormData({
      username: '',
      email: '',
      password: '',
      passwordConfirm: ''
    });
  };

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <div className="game-header">
          <h1 className="game-title">⚓ BATTLESHIP</h1>
          <p className="game-subtitle">3D Tactical Multiplayer Game</p>
        </div>

        <div className="auth-form-container">
          {isLogin ? (
            <form onSubmit={handleSubmit} className="auth-form">
              <h2>Login</h2>
              
              <div className="form-group">
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <button type="submit" className="submit-btn">
                LOGIN
              </button>

              <p className="toggle-text">
                Don't have an account?{' '}
                <button type="button" onClick={toggleForm} className="toggle-btn">
                  Sign Up
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <h2>Register</h2>

              <div className="form-group">
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="password"
                  name="passwordConfirm"
                  placeholder="Confirm Password"
                  value={formData.passwordConfirm}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <button type="submit" className="submit-btn">
                REGISTER
              </button>

              <p className="toggle-text">
                Already have an account?{' '}
                <button type="button" onClick={toggleForm} className="toggle-btn">
                  Login
                </button>
              </p>
            </form>
          )}
        </div>

        <div className="footer-text">
          <p>ft_transcendence - 42 School Project</p>
        </div>
      </div>
    </div>
  );
}

export default WelcomePage;
