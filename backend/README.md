# City Walker Backend

A trustworthy city itinerary planner backend built with FastAPI.

## Overview

City Walker creates optimal walking, driving, or transit routes between multiple points of interest (POIs). The backend serves as an API gateway for all external API calls, ensuring data accuracy by using Google APIs as the single source of truth.

## Tech Stack

- **FastAPI**: High-performance async web framework
- **Pydantic**: Data validation and serialization
- **Redis**: Response caching
- **GeminiAPI**: Gemma 3, 27b, AI reasoning for input interpretation and POI ranking
- **NetworkX**: Graph-based route optimization
- **NumPy**: Numerical operations for distance matrices

## Setup

### Prerequisites

- Python 3.11+
- Redis server (for caching)

### Installation

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -e ".[dev]"
   ```
   
   Or using requirements.txt:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy the environment template and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

### Running the Server

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

### API Documentation

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Testing

Run all tests:
```bash
pytest
```

Run with coverage:
```bash
pytest --cov=app --cov-report=html
```

Run property-based tests only:
```bash
pytest tests/property/
```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # API route definitions
│   ├── models/
│   │   ├── __init__.py
│   │   ├── poi.py           # POI and related models
│   │   ├── route.py         # Route and itinerary models
│   │   └── errors.py        # Error types
│   └── services/
│       ├── __init__.py
│       ├── ai_reasoning/    # AI interpretation and ranking
│       ├── cache/           # Redis caching
│       ├── place_validator/ # Google Places API integration
│       └── route_optimizer/ # Route optimization with NetworkX
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Pytest fixtures
│   ├── unit/                # Unit tests
│   └── property/            # Property-based tests (Hypothesis)
├── pyproject.toml
├── requirements.txt
└── README.md
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_PLACES_API_KEY` | Google Places API key | Yes |
| `GOOGLE_DIRECTIONS_API_KEY` | Google Directions API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `REDIS_URL` | Redis connection URL | No (defaults to localhost) |

## License

MIT
