import React from 'react';
import { Link } from 'react-router-dom';

function TermsOfService() {

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 p-5">
      <div className="flex flex-col items-center gap-6 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white tracking-wide drop-shadow-lg">
            ⚓ BATTLESHIPS
          </h1>
          <p className="text-lg text-emerald-400 mt-2 tracking-wide">
            Tactical Online Game
          </p>
        </div>

        {/* Content */}
        <div className="w-full bg-white/95 rounded-xl shadow-2xl p-10 backdrop-blur-sm max-h-[80vh] overflow-y-auto">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-6">
            Terms of Service
          </h2>

          <p className="text-sm text-gray-600 mb-8 text-center">
            Last updated: February 14, 2026
          </p>

          <div className="space-y-6 text-slate-700">
            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">General Information</h3>
              <p className="mb-2">
                This application ("Battleships - Tactical Online Game") is an educational project developed as part of the 42 School curriculum.
                The application provides a web-based Battleship game featuring real-time multiplayer gameplay, an AI opponent, and user interaction features.
              </p>
              <p>
                The service is provided for educational and demonstration purposes only.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Acceptance of Terms</h3>
              <p className="mb-2">
                By accessing or using the application, you agree to be bound by these Terms of Service.
              </p>
              <p>
                If you do not agree with these terms, you must discontinue use of the application.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">User Accounts and Authentication</h3>
              <p className="mb-2">
                Access to certain features requires user authentication.
                Authentication may be performed using:
              </p>
              <ul className="list-disc list-inside ml-4 mb-2 space-y-1">
                <li>OAuth 2.0 via 42 Intra</li>
                <li>Local account authentication (if enabled)</li>
              </ul>
              <p className="mb-2">
                Users are responsible for maintaining the confidentiality of their account access.
              </p>
              <p>
                The project administrators reserve the right to suspend or remove accounts that violate these terms.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Acceptable Use</h3>
              <p className="mb-2">Users agree not to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Use the application for unlawful purposes</li>
                <li>Attempt to interfere with the application's security or infrastructure</li>
                <li>Exploit bugs, vulnerabilities, or use automated tools to gain unfair advantages</li>
                <li>Harass, abuse, or disrupt other users</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Gameplay and Online Features</h3>
              <p className="mb-2">
                The application includes real-time multiplayer gameplay using WebSockets and AI-based gameplay.
              </p>
              <p>
                Game results, statistics, and rankings are generated automatically based on gameplay activity.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Availability of the Service</h3>
              <p className="mb-2">
                The service is provided "as is" and may be unavailable at times due to maintenance, updates, or technical limitations.
              </p>
              <p>
                Continuous or uninterrupted availability is not guaranteed.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Limitation of Liability</h3>
              <p className="mb-2">
                This application is an educational project and is provided without warranties of any kind.
              </p>
              <p>
                The developers are not responsible for data loss, service interruptions, or damages resulting from the use of the application.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Modifications to the Terms</h3>
              <p className="mb-2">
                These Terms of Service may be updated at any time.
              </p>
              <p>
                Changes become effective upon publication on this page.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Contact</h3>
              <p className="mb-2">
                For questions related to these Terms of Service, please contact:
              </p>
              <ul className="list-none ml-4 space-y-1 text-sm">
                <li>dmodrzej@student.42warsaw.pl</li>
                <li>agorski@student.42warsaw.pl</li>
                <li>mbany@student.42warsaw.pl</li>
                <li>ltomasze@student.42warsaw.pl</li>
                <li>gbuczyns@student.42warsaw.pl</li>
              </ul>
            </section>
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              to="/"
              className="inline-block px-4 py-2 text-sm sm:text-base bg-slate-600 hover:bg-slate-700 rounded-md font-semibold text-white transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-gray-400 text-sm">
          ft_transcendence - 42 School Project
        </p>
      </div>
    </div>
  );
}

export default TermsOfService;
