This project has been created as part of the 42 curriculum by dmodrzej[, agorski[, mbany[, ltomasze]]].


---

## Index

- [Description](#description)
- [Instructions](#instructions)
- [Resources](#resources)
- [Team Information](#team-information)
- [Project Management](#project-management)
- [Technical Stack](#technical-stack)
- [Database Schema](#database-schema)
- [Features List](#features-list)
- [Modules](#modules)
- [Individual Contributions](#individual-contributions)
- [GitHub Rules](docs/git_rules.md)

---

# Description

<!--
Section that clearly presents the project, including its goal and a
brief overview.
The "Description" section should also contain a clear name for the
project and its key features.
-->

**3D Tactical Battleship** is the final project of the 42 Common Core.
Our team has developed a high-end, web-based **3D Battleship** platform.
Unlike traditional versions, our project features a real-time multiplayer
engine, an AI strategic opponent, and a sleek, retro-futuristic UI.
The application is built as a microservices-based Single Page Application
(SPA) designed for performance, security, and scalability.

---

# Instructions

<!--
Section containing any relevant information about compilation,
installation, and/or execution.
The "Instructions" section should mention all the needed prerequisites
(software, tools, versions, configuration like .env setup, etc.),
and step-by-step instructions to run the project.
-->

---

# Resources

<!--
Section listing classic references related to the topic (documentation,
articles, tutorials, etc.), as well as a description of how AI was used
- specifying for which tasks and which parts of the project.

Additional sections may be required depending on the project (e.g.,
usage examples, feature list, technical choices, etc.).
Any required additions will be explicitly listed below.
-->

---

# Team Information

<!--
For each team member mentioned at the top of the README.md, you must
provide:
- Assigned role(s): PO, PM, Tech Lead, Developers, etc.
- Brief description of their responsibilities.
-->

| Login        | Role                   | Responsibilities                              |
|:-------------|:-----------------------|:----------------------------------------------|
| **mbany**    | **Product Owner (PO)** | Feature prioritization, game rules, 14-pt goal|
| **dmodrzej** | **Technical Lead**     | Architecture (React+Django), DevOps, WS       |
| **agorski**  | **Project Manager**    | Sprint planning, deadlines, Agile process     |
| **ltomasze** | **Developer**          | Game logic, API development, UI integration   |

---

# Project Management

### Communication

- We communicate primarily via **Slack**, using a dedicated private
  group for the project.
- All day-to-day updates, quick questions, and decisions are shared
  there to keep everyone aligned.

### Meetings

- We meet **once a week**, every **Saturday at 12:00**, **in person
  on campus**.
- Each meeting follows a fixed agenda with pre-agreed discussion points
  (progress review, blockers, upcoming milestones, priority alignment).
- After the discussion, we **split tasks** and assign ownership for
  the next iteration.

### Tools

- We use **GitHub Issues** as our main project management tool.
- Each feature/bug is tracked as an issue with clear acceptance criteria,
  assignees, and status updates.

---

# Technical Stack

<!--
- Frontend technologies and frameworks used.
- Backend technologies and frameworks used.
- Database system and why it was chosen.
- Any other significant technologies or libraries.
- Justification for major technical choices.
-->

---

# Database Schema

<!--
- Visual representation or description of the database structure.
- Tables/collections and their relationships.
- Key fields and data types.
-->

---

# Features List

<!--
- Complete list of implemented features.
- Which team member(s) worked on each feature.
- Brief description of each feature's functionality.
-->

---

# Modules

<!--
- List of all chosen modules (Major and Minor).
- Point calculation (Major = 2pts, Minor = 1pt).
- Justification for each module choice, especially for custom
  "Modules of choice".
- How each module was implemented.
- Which team member(s) worked on each module.
-->

### Web (3 Points)

- **Major Framework:** Django & React (2 pts)
- **Use of an ORM:** Django ORM for database management (1 pt)

### User Management (4 Points)

- **Standard User Management:** Secure registration, login, and
  profile management (2 pts)
- **Remote Authentication:** OAuth integration with 42 Intra (2 pts)

### Gameplay & Graphics (6 Points)

- **Web-based Game:** Full 3D Battleship implementation (2 pts)
- **Remote Players:** Real-time multiplayer via WebSockets (2 pts)
- **Advanced 3D Graphics:** Three.js integration for immersive
  board experience (2 pts)

### Artificial Intelligence (2 Points)

- **AI Opponent:** A strategic bot utilizing a probability-grid
  algorithm for ship hunting (2 pts)

### Accessibility (1 Point)

- **Multiple Languages:** Support for English, Polish, and French (1 pt)

**Total: 16 Points** (exceeding the 14-point requirement).

---

# Individual Contributions

<!--
- Detailed breakdown of what each team member contributed.
- Specific features, modules, or components implemented by each person.
- Any challenges faced and how they were overcome.

Any other useful or relevant information is welcome (usage documentation,
known limitations, license, credits, etc.).
-->
