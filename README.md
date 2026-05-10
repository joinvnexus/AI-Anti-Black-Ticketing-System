# Bangladesh Railway Anti-Fraud Platform

Initial implementation includes:

- `apps/api`: NestJS API gateway + core booking modules
- `services/risk-service`: FastAPI risk scoring service
- `infra/schema.sql`: initial PostgreSQL schema
- `docker-compose.yml`: local development stack

## Run

### API

```bash
cd apps/api
npm install
npm run start:dev
```

### Risk service

```bash
cd services/risk-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Local infra

```bash
docker compose up -d
```

## Next build targets

1. Replace in-memory stores with PostgreSQL + Redis repositories
2. Add NID verification provider integration
3. Add Kafka producers for auth, queue, booking, and risk events
4. Add payment gateway integration and booking finalization

