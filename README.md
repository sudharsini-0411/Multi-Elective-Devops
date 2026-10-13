# Multi-Elective Allocation Induced Fairness

A fairness-aware elective allocation system designed to allocate electives based on student preference points while considering historical satisfaction across semesters.

## Overview

The Multi-Elective Allocation Induced Fairness System aims to improve transparency and fairness in academic elective allocation. Students submit their elective preferences and bidding points, while the admin manages the allocation process and publishes the results. The system uses historical satisfaction to help students who have received lower-ranked preferences in previous allocations.

## Key Features

- **Student Portal:** Login, enter student details, select required electives, assign preference points, and submit preferences.
- **Admin Dashboard:** Manage allocation cycles, process allocations, and publish results.
- **Fair Allocation Algorithm:** Combines preference points with a fairness adjustment to determine allocation priority.
- **PRSM:** Preference Rank Satisfaction Mapping calculates satisfaction based on the rank of the allocated elective.
- **Running Average Algorithm (RAA):** Updates historical satisfaction after each allocation.
- **Allocation History:** Stores published results and historical satisfaction for future allocation cycles.
- **Semester-wise Management:** Supports new preference submissions and allocation cycles across semesters.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, JavaScript, HTML, CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL (Supabase) |
| Algorithms | PRSM, RAA, Priority Queue, Dynamic Fairness Weight (λ) |

## Allocation Workflow

1. Students log in and submit their elective preferences and bidding points.
2. The admin closes preference submission.
3. The system calculates priority scores using bidding points and the fairness adjustment.
4. Electives are allocated according to priority, seat availability, and student limits.
5. PRSM calculates satisfaction for each allocated elective.
6. RAA updates historical satisfaction using:

   `H_new = (H_prev + S_curr) / 2`

7. The admin publishes the final allocation results.
8. Published allocations are stored in allocation history and used as historical data for future semesters.

## Core Algorithms

### Preference Rank Satisfaction Mapping (PRSM)

Calculates current satisfaction according to the allocated elective's rank:

`S_curr = 1 - (rank - 1) / total_preferences`

### Running Average Algorithm (RAA)

Updates historical satisfaction using the previous historical satisfaction and current satisfaction:

`H_new = (H_prev + S_curr) / 2`

### Priority Score

`Priority Score = Preference Points + λ × (1 - H_prev) × 100`

Here, `λ` is the fairness weight that adjusts the priority based on historical satisfaction.

## System Architecture

```text
Student / Admin
       |
       v
React.js Frontend
       |
       v
Python FastAPI Backend
       |
       v
Supabase PostgreSQL
       |
       v
Allocation Results & History
```

## Installation and Setup

### Prerequisites

- Python 3.10+
- Node.js and npm
- A Supabase account
- Git

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <PROJECT_FOLDER>
```

### 2. Configure the Backend

Navigate to the backend directory:

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file and configure your environment variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

Start the backend using the command appropriate for your FastAPI entry point. For example:

```bash
uvicorn main:app --reload
```

### 3. Configure the Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Configure the frontend API URL according to your backend setup.

## Expected Outcome

The system provides a structured and transparent elective allocation process, combines student preferences with historical fairness, and maintains semester-wise allocation records to support consistent future decisions.

## Future Enhancements

- Automated semester creation and management.
- Improved allocation optimization for limited elective seats.
- Detailed fairness analytics and visual dashboards.
- Notifications when results are published.
- Enhanced audit logs and allocation reports.

## Research Context

Developed as part of a research internship at **National Institute of Technology Calicut (NIT Calicut)**, focusing on fairness-aware elective allocation and historical satisfaction.

## Contributors

- Sudharsini R
- Add other team members here

## License

Add an appropriate license before distributing the project publicly.
