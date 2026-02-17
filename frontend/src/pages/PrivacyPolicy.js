import React from 'react';
import { Link } from 'react-router-dom';

function PrivacyPolicy() {

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 p-5">
      <div className="flex flex-col items-center gap-6 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white tracking-wide drop-shadow-lg">
            ⚓ BATTLESHIP
          </h1>
          <p className="text-lg text-emerald-400 mt-2 tracking-wide">
            3D Tactical Multiplayer Game
          </p>
        </div>

        {/* Content */}
        <div className="w-full bg-white/95 rounded-xl shadow-2xl p-10 backdrop-blur-sm max-h-[80vh] overflow-y-auto">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-6">
            Privacy Policy
          </h2>

          <p className="text-sm text-gray-600 mb-8 text-center">
            Last updated: February 14, 2026
          </p>

          <div className="space-y-6 text-slate-700">
            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Data Controller</h3>
              <p>
                This application is developed and maintained by students as part of the 42 School educational program.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Data We Collect</h3>
              <p className="mb-2">
                Depending on enabled features, the application may collect:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Username or display name</li>
                <li>Email address (provided via OAuth 2.0 authentication or account registration)</li>
                <li>Avatar or profile information</li>
                <li>Game-related data (match history, statistics, rankings)</li>
                <li>Technical data (IP address, session identifiers, logs for security purposes)</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Authentication Data</h3>
              <p className="mb-2">
                Authentication via 42 Intra OAuth 2.0 is handled according to OAuth standards.
                The application does not store user passwords when OAuth authentication is used.
              </p>
              <p>
                Session-based authentication is implemented using secure server-side sessions stored in Redis.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Purpose of Data Processing</h3>
              <p className="mb-2">Collected data is used exclusively to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Authenticate users</li>
                <li>Enable gameplay and multiplayer functionality</li>
                <li>Display statistics, leaderboards, and game history</li>
                <li>Ensure application security and stability</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Legal Basis</h3>
              <p>
                Data processing is based on user consent and the necessity of providing the service.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Data Storage and Retention</h3>
              <p className="mb-2">
                Personal data is stored only for the duration necessary to operate the project.
              </p>
              <p>
                Data is not sold, shared, or transferred to third parties.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">User Rights</h3>
              <p className="mb-2">Users have the right to:</p>
              <ul className="list-disc list-inside ml-4 mb-2 space-y-1">
                <li>Access their personal data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of their account and associated data</li>
              </ul>
              <p>
                Requests can be submitted via the project contact email.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Security</h3>
              <p className="mb-2">
                Reasonable technical and organizational measures are applied to protect user data.
              </p>
              <p>
                However, no system can guarantee absolute security.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Contact</h3>
              <p className="mb-2">
                For questions regarding this Privacy Policy or personal data processing, please contact:
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

export default PrivacyPolicy;
