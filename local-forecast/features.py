"""Feature engineering shared by training, prediction, and backtesting.

Feature set is deliberately similar in spirit to the indicators already
used in the JS app's Holt's-trend + rule-based signal (lib/forecast.js),
so XGBoost has a comparable — but learned, not hand-scored — view of
the same signals.
"""

import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "return_1d",
    "return_3d",
    "return_5d",
    "return_10d",
    "sma20_dist",
    "sma50_dist",
    "rsi14",
    "macd_hist",
    "volatility_10d",
    "volume_change_5d",
]


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)


def _macd_hist(close: pd.Series, fast=12, slow=26, signal=9) -> pd.Series:
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line - signal_line


def build_feature_frame(df: pd.DataFrame, horizon: int = 5) -> pd.DataFrame:
    """
    df: columns [date, open, high, low, close, volume], sorted ascending by date.
    horizon: how many trading days ahead the label looks.

    Returns a frame with FEATURE_COLUMNS + 'label' (1 = price higher in
    `horizon` days, 0 = not) + 'date' + 'close'. The last `horizon` rows
    have label = NaN (unknown future) and are used for live prediction,
    not training.
    """
    out = df.copy()
    close = out["close"]

    out["return_1d"] = close.pct_change(1)
    out["return_3d"] = close.pct_change(3)
    out["return_5d"] = close.pct_change(5)
    out["return_10d"] = close.pct_change(10)

    sma20 = close.rolling(20).mean()
    sma50 = close.rolling(50).mean()
    out["sma20_dist"] = (close - sma20) / sma20
    out["sma50_dist"] = (close - sma50) / sma50

    out["rsi14"] = _rsi(close, 14)
    out["macd_hist"] = _macd_hist(close)

    out["volatility_10d"] = out["return_1d"].rolling(10).std()
    out["volume_change_5d"] = out["volume"].pct_change(5)

    future_close = close.shift(-horizon)
    out["label"] = (future_close > close).astype("float")
    out.loc[out.index[-horizon:], "label"] = np.nan

    out = out.replace([np.inf, -np.inf], np.nan)
    return out
