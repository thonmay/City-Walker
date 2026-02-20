# 🚶 City Walker

AI-powered walking tour generator. Discover landmarks, hidden gems, cafes, and restaurants in any city — then generate optimized walking routes with 3D map visualization.

## Architecture

```
backend/        → Python FastAPI (AI reasoning, route optimization, geocoding)
frontend-next/  → Next.js 16 (map-first UI, MapLibre GL 3D, AI SDK chat)
```

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add your API keys
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend-next
npm install
cp .env.example .env.local  # Add your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

1. Enter a city → AI suggests landmarks + hidden gems, geocoded via Nominatim
2. POIs appear on a 3D map → accept or reject places
3. Add cafes/restaurants/bars with one click
4. Generate an optimized walking route with polyline overlay
5. Multi-day trips split POIs into themed daily itineraries
6. Open the final route in Google Maps

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI (primary) | Groq LPU — Llama 3.1 8B Instant (~1.5s) |
| AI (fallback) | Google Gemini — Gemma 3 4B (~6s) |
| Maps | MapLibre GL JS with MapTiler 3D tiles |
| Geocoding | Nominatim (OpenStreetMap) |
| POI Images | Wikipedia + Wikimedia Commons |
| Route Engine | OSRM (nearest-neighbor + 2-opt optimization) |
| Frontend | Next.js 16, React 19, Tailwind CSS, Vercel AI SDK |
| Backend | FastAPI, Python, Redis (optional caching) |

## Deployment

### Frontend → Vercel
1. Import repo on [vercel.com](https://vercel.com)
2. Set Root Directory to `frontend-next`
3. Add environment variables:
   - `GOOGLE_GENERATIVE_AI_API_KEY` — for AI chat
   - `NEXT_PUBLIC_MAPTILER_KEY` — for 3D map tiles
   - `NEXT_PUBLIC_API_URL` — your backend URL + `/api`
   - `BACKEND_URL` — your backend URL (no `/api`)

### Backend → Render / Railway
1. Create a new Web Service pointing to `backend/`
2. Build: `pip install -r requirements.txt`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables:
   - `GROQ_API_KEY` — primary AI provider
   - `GEMINI_API_KEY` — fallback AI provider
   - `REDIS_URL` — optional, for caching

## Environment Variables

See `backend/.env.example` and `frontend-next/.env.example` for all required keys.

## License

MIT
