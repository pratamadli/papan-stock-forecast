"""Walk-forward backtest: retrain on an expanding window across several
folds and score each fold's held-out period, instead of trusting a
single train/test split (which can be lucky/unlucky). This is the
right way to sanity-check whether XGBoost is *actually* beating the
simple SMA-trend rule for a given ticker, or just fitting noise.
"""

from sklearn.metrics import accuracy_score
from xgboost import XGBClassifier

from data import fetch_history
from features import FEATURE_COLUMNS, build_feature_frame
from model import _trend_baseline


def walk_forward_backtest(
    symbol_raw: str, market: str, horizon: int = 5, folds: int = 5, period: str = "3y"
) -> dict:
    df, symbol = fetch_history(symbol_raw, market, period=period)
    frame = build_feature_frame(df, horizon=horizon)
    trainable = frame.dropna(subset=FEATURE_COLUMNS + ["label"]).reset_index(drop=True)

    min_train = 100
    if len(trainable) < min_train + folds * 20:
        raise ValueError(
            "Data historis tidak cukup untuk walk-forward backtest dengan "
            f"{folds} fold. Coba kurangi jumlah fold atau perpanjang period."
        )

    fold_size = (len(trainable) - min_train) // folds
    results = []

    for i in range(folds):
        train_end = min_train + i * fold_size
        test_end = min_train + (i + 1) * fold_size if i < folds - 1 else len(trainable)

        train_df = trainable.iloc[:train_end]
        test_df = trainable.iloc[train_end:test_end]
        if len(test_df) == 0:
            continue

        model = XGBClassifier(
            n_estimators=200,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric="logloss",
            random_state=42,
        )
        model.fit(train_df[FEATURE_COLUMNS], train_df["label"])
        preds = model.predict(test_df[FEATURE_COLUMNS])
        baseline_preds = _trend_baseline(test_df)

        results.append(
            {
                "fold": i + 1,
                "train_size": int(len(train_df)),
                "test_size": int(len(test_df)),
                "test_period": {
                    "from": str(test_df["date"].iloc[0].date()),
                    "to": str(test_df["date"].iloc[-1].date()),
                },
                "xgboost_accuracy": round(float(accuracy_score(test_df["label"], preds)), 4),
                "baseline_accuracy": round(
                    float(accuracy_score(test_df["label"], baseline_preds)), 4
                ),
            }
        )

    avg_xgb = round(sum(r["xgboost_accuracy"] for r in results) / len(results), 4)
    avg_baseline = round(sum(r["baseline_accuracy"] for r in results) / len(results), 4)

    return {
        "symbol": symbol,
        "horizon_days": horizon,
        "folds": results,
        "average": {
            "xgboost_accuracy": avg_xgb,
            "baseline_accuracy": avg_baseline,
            "xgboost_wins": avg_xgb > avg_baseline,
        },
    }
