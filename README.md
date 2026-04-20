# Smart Attendance Management System 🏫✨

A sophisticated, full-stack Role-Based Attendance Management System built with a monolithic architecture containing React, Express, Prisma, and an AI-Module mock service.

It features a high-end, premium glassmorphism dark mode aesthetic and strictly enforced security protocols for multi-role workflows.

## 🚀 Key Features

### 1. Robust Role-Based Access Control (RBAC)
*   **Encrypted Authentication:** Fully integrates JWT tokens and BCrypt password hashing.
*   **Secure API Gateway:** Express middlewares rigorously block endpoint probing by unauthorized roles.

### 2. Multi-Portal Dashboards
*   **Super Admin Portal:** The highest tier capable of managing system infrastructure. 
    *   **Features:** Create class sessions, register robust user accounts with precise roles, and globally audit chronological attendance of individual students securely through glassmorphic overlays.
*   **Teacher Portal:** Features an intelligent camera mock interface to simulate facial recognition workflows, real-time manual attendance overrides, and finalizing tools to securely permanently seal classroom records.
*   **Student Portal:** A private environment giving students comprehensive insights into their attendance across individual subjects with fractions, percentage thresholds, and an exact historical log.

### 3. Sleek Aesthetics
*   The entire frontend was handcrafted without extreme UI frameworks—achieving dynamic Apple-level glassmorphic UI components, smooth fade-in animations, opacity transition icons, and dark-mode elegance.

---

## 🛠 Technology Stack
*   **Frontend:** React (Vite) + Vanilla CSS (Custom Glassmorphism Design System)
*   **Backend:** Node.js + Express
*   **Database:** Prisma ORM with SQLite
*   **Security:** JSON Web Tokens (JWT), BCryptJS

## 📦 Setup & Installation

**1. Clone the repository:**
```bash
git clone https://github.com/Ayushch27/Attendence-Management-System.git
cd Attendence-Management-System
```

**2. Setup Backend Server:**
```bash
cd backend
npm install
npx prisma db push
node seed.js      # Populates test users and environment
node server.js    # Starts the REST API on http://localhost:3001
```

**3. Setup Mock AI Service:**
```bash
cd ../ai-module
npm install
node server.js    # Sets up internal webhook listener on port 3002
```

**4. Setup Frontend Client:**
```bash
cd ../frontend
npm install
npm run dev       # Starts Vite React Server on http://localhost:5173
```

## 🔒 Default Test Accounts
If initialized with `seed.js`, use these out-of-the-box accounts:
| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@gmail.com` | `password123` |
| **Teacher** | `bijayacse@gmail.com` | `password123` |
| **Student** | `aryan@gmail.com` | `password123` |

---
**Developed by Ayush (@Ayushch27)**
