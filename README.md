# SIH26122 — Intelligent Data Capture & Schedule-Linking Layer

An intelligent data capture and schedule-linking system for infrastructure project management (Oil & Gas / EPC). Ingests heterogeneous actual site progress reports (TXT daily reports, CSVs, Excel logs) and links them to baseline L5/L6 project schedule activities using a multi-signal AI matching engine with Human-in-the-Loop review.

---

## Quick Start

### 1. Prerequisites
- **Python 3.10+** (Tested on Python 3.14)
- **Node.js 18+** & **npm**

### 2. Backend Setup & Run

```bash
# Navigate to backend directory
cd backend

# Install Python requirements
python -m pip install -r requirements.txt

# Run FastAPI server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The API server will run at `http://127.0.0.1:8000`.
- API Documentation (Swagger): `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

### 3. Frontend Setup & Run

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Running Tests

```bash
# Run pytest test suite from project root
python -m pytest tests/ -v
```

---

## Key Features

1. **L5/L6 Schedule Baseline Ingestion**: Supports CSV & XLSX format schedules with WBS codes and planned start/finish dates (30+ activities included for Piping, Civil, and Electrical).
2. **Heterogeneous Progress Capture**: Ingests unstructured daily progress reports (TXT) and discipline CSV/Excel updates.
3. **Multi-Signal AI Matching Engine**:
   - Semantic description similarity (TF-IDF + Domain Lexicon)
   - Discipline similarity
   - Token & Activity ID identifier similarity
   - Location fuzzy similarity
   - Date range compatibility
4. **Confidence Policy & HITL Review**:
   - **$\ge 0.85$**: Auto-matched
   - **$0.65 - 0.84$**: Routed to Human-in-the-Loop Review Queue
   - **$< 0.65$**: Retained as unmatched (never discarded)
5. **Interactive Controls Command Center**:
   - Live Dashboard with Recharts visualizations (Discipline coverage, Confidence distribution, Planned vs Actual variances)
   - Data Ingestion & Parser sandbox
   - Schedule WBS Explorer
   - Progress Events Log
   - AI Time Agent conversational assistant
   - Review Queue with Approve/Reject actions
   - Institutional Memory & Domain Lexicon
6. **Provenance & Audit Trail**: Cryptographically timestamped logs for all system interactions.
7. **DEMO MODE**: Works out-of-the-box with deterministic AI fallback (no external API keys required).
