"""Local-only forecasting service. Run this on your laptop, not deployed —
the Next.js app (deployed to Vercel) will optionally call this at
http://localhost:8000 when it's running, and silently fall back to its
built-in Holt's-trend signal when it's not.

Run:
    pip install -r requirements.txt
    uvicorn app:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backtest import walk_forward_backtest
from model import predict_latest, train_model

app = FastAPI(title="Papan — Local Advanced Forecast")

# The Next.js dev server runs on :3000 and calls this from the browser's
# perspective via its own API route (server-to-server), but CORS is opened
# up for convenience in case you call this directly from the browser too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/predict")
def predict(
    symbol: str = Query(...),
    market: str = Query("IDX", pattern="^(IDX|US)$"),
    horizon: int = Query(5, ge=1, le=30),
    retrain: bool = Query(False),
):
    try:
        return predict_latest(symbol, market, horizon=horizon, retrain=retrain)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal memproses: {e}")


@app.post("/train")
def train(
    symbol: str = Query(...),
    market: str = Query("IDX", pattern="^(IDX|US)$"),
    horizon: int = Query(5, ge=1, le=30),
):
    try:
        payload = train_model(symbol, market, horizon=horizon)
        return {
            "symbol": payload["symbol"],
            "horizon_days": payload["horizon"],
            "metrics": payload["metrics"],
            "feature_importances": payload["feature_importances"],
            "trained_at": payload["trained_at"],
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal training: {e}")


@app.get("/backtest")
def backtest(
    symbol: str = Query(...),
    market: str = Query("IDX", pattern="^(IDX|US)$"),
    horizon: int = Query(5, ge=1, le=30),
    folds: int = Query(5, ge=2, le=10),
):
    try:
        return walk_forward_backtest(symbol, market, horizon=horizon, folds=folds)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal backtest: {e}")
