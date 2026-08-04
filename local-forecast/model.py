"""Train, persist, and query the XGBoost direction-classifier per ticker.

Label definition: will the close price be higher `horizon` trading days
from now than it is today? (binary classification, not a price target).
This is intentionally a simpler, more honest target than "predict the
exact price" — direction is what actually drives a buy/sell decision,
and is far more learnable than exact price levels.
"""

from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score
from xgboost import XGBClassifier

from data import fetch_history
from features import FEATURE_COLUMNS, build_feature_frame

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


def _model_path(symbol: str, horizon: int) -> Path:
    safe = symbol.replace(".", "_")
    return MODELS_DIR / f"{safe}_h{horizon}.joblib"


def _trend_baseline(frame: pd.DataFrame) -> pd.Series:
    """Naive baseline to compare XGBoost against: predict 'up' whenever
    price is currently above its 20-day average, mirroring the
    SMA-crossover rule already used in the JS app's signal logic."""
    return (frame["sma20_dist"] > 0).astype(int)


def train_model(symbol_raw: str, market: str, horizon: int = 5, period: str = "3y") -> dict:
    df, symbol = fetch_history(symbol_raw, market, period=period)
    frame = build_feature_frame(df, horizon=horizon)

    trainable = frame.dropna(subset=FEATURE_COLUMNS + ["label"]).reset_index(drop=True)
    if len(trainable) < 120:
        raise ValueError(
            f"Data historis tidak cukup untuk training ({len(trainable)} baris). "
            "Coba ticker lain atau period lebih panjang."
        )

    split_idx = int(len(trainable) * 0.8)
    train_df = trainable.iloc[:split_idx]
    test_df = trainable.iloc[split_idx:]

    X_train, y_train = train_df[FEATURE_COLUMNS], train_df["label"]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df["label"]

    model = XGBClassifier(
        n_estimators=200,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=42,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    baseline_preds = _trend_baseline(test_df)

    metrics = {
        "xgboost": {
            "accuracy": round(float(accuracy_score(y_test, preds)), 4),
            "precision": round(float(precision_score(y_test, preds, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, preds, zero_division=0)), 4),
        },
        "baseline_sma_trend": {
            "accuracy": round(float(accuracy_score(y_test, baseline_preds)), 4),
            "precision": round(
                float(precision_score(y_test, baseline_preds, zero_division=0)), 4
            ),
            "recall": round(float(recall_score(y_test, baseline_preds, zero_division=0)), 4),
        },
        "test_samples": int(len(test_df)),
        "train_samples": int(len(train_df)),
    }

    importances = dict(
        zip(FEATURE_COLUMNS, [round(float(v), 4) for v in model.feature_importances_])
    )

    payload = {
        "model": model,
        "symbol": symbol,
        "horizon": horizon,
        "metrics": metrics,
        "feature_importances": importances,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    joblib.dump(payload, _model_path(symbol, horizon))
    return payload


def load_model(symbol: str, horizon: int):
    path = _model_path(symbol, horizon)
    if not path.exists():
        return None
    return joblib.load(path)


def predict_latest(symbol_raw: str, market: str, horizon: int = 5, retrain: bool = False) -> dict:
    df, symbol = fetch_history(symbol_raw, market, period="3y")
    frame = build_feature_frame(df, horizon=horizon)

    payload = None if retrain else load_model(symbol, horizon)
    if payload is None:
        payload = train_model(symbol_raw, market, horizon=horizon)

    latest_row = frame.dropna(subset=FEATURE_COLUMNS).iloc[[-1]]
    x_latest = latest_row[FEATURE_COLUMNS]

    model = payload["model"]
    proba_up = float(model.predict_proba(x_latest)[0][1])

    direction = "UP" if proba_up >= 0.5 else "DOWN"
    confidence = proba_up if direction == "UP" else 1 - proba_up

    return {
        "symbol": symbol,
        "horizon_days": horizon,
        "direction": direction,
        "probability_up": round(proba_up, 4),
        "confidence": round(confidence, 4),
        "last_close": float(df["close"].iloc[-1]),
        "last_date": str(df["date"].iloc[-1].date()),
        "backtest_metrics": payload["metrics"],
        "feature_importances": payload["feature_importances"],
        "trained_at": payload["trained_at"],
    }
