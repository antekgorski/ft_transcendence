# ft_transcendence - 3D Tactical Battleship

## 1. Project Overview
**ft_transcendence** is the final project of the 42 Common Core. Our team has developed a high-end, web-based **3D Battleship** platform. Unlike traditional versions, our project features a real-time multiplayer engine, an AI strategic opponent, and a sleek, retro-futuristic UI. The application is built as a microservices-based Single Page Application (SPA) designed for performance, security, and scalability.



---

## 2. Team Organization and Management
In accordance with Chapter II.1.1, our team is organized into specific roles to ensure professional project delivery:

| Login | Role | Responsibilities |
| :--- | :--- | :--- |
| **mbany** | **Product Owner (PO)** | Feature prioritization, game rules definition, and 14-point goal alignment. |
| **dmodrzej** | **Project Manager (PM)** | Sprint planning, deadline tracking, and Agile process management. |
| **agorski** | **Technical Lead** | System architecture (React + Django), DevOps, and WebSocket orchestration. |
| **ltomasze** | **Developer** | Core game logic implementation, API development, and UI integration. |

---

## 3. Technical Stack
Our architecture is fully containerized using **Docker Compose** and follows a decoupled frontend/backend approach:

* **Frontend:** React.js with Tailwind CSS & Three.js (3D Rendering).
* **Backend:** Python (Django) with Django Channels (WebSockets).
* **Database:** PostgreSQL (Relational data) & Redis (Real-time session state).
* **Proxy/Web Server:** Nginx.



---

## 4. Implemented Modules (14 Points Goal)
We have selected the following modules to meet the project's technical requirements (Chapter IV):

### Web (3 Points)
* **Major Framework:** Django & React (2 pts)
* **Use of an ORM:** Django ORM for database management (1 pt)

### User Management (4 Points)
* **Standard User Management:** Secure registration, login, and profile management (2 pts)
* **Remote Authentication:** OAuth integration with 42 Intra (2 pts)

### Gameplay & Graphics (6 Points)
* **Web-based Game:** Full 3D Battleship implementation (2 pts)
* **Remote Players:** Real-time multiplayer via WebSockets (2 pts)
* **Advanced 3D Graphics:** Three.js integration for an immersive board experience (2 pts)

### Artificial Intelligence (2 Points)
* **AI Opponent:** A strategic bot utilizing a probability-grid algorithm for ship hunting (2 pts)

### Accessibility (1 Point)
* **Multiple Languages:** Support for English, Polish, and French (1 pt)

**Total: 16 Points** (Exceeding the 14-point requirement).

---

## 5. Security and Performance
As per Chapter III requirements:
* **Passwords:** Encrypted using industry-standard hashing (PBKDF2/bcrypt).
* **Validation:** All inputs are sanitized on both Frontend and Backend to prevent XSS and SQL Injection.
* **Compatibility:** Fully optimized for the latest version of Google Chrome.
* **Stability:** No memory leaks; clean browser console with zero errors.

---

## 6. Installation and Usage
The entire project is containerized. To launch the platform, ensure you have **Docker** and **Docker Compose** installed, then run:

```bash
# Clone the repository
git clone [https://github.com/your-repo/ft_transcendence.git](https://github.com/your-repo/ft_transcendence.git)
cd ft_transcendence

# Build and start the containers
docker-compose up --build