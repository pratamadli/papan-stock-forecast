"""Historical OHLCV data fetching via yfinance.

Runs locally, so no CORS / rate-limit concerns like the Vercel-deployed
Next.js app has to worry about with the raw Yahoo endpoints.
"""

import yfinance as yf
import pandas as pd


def normalize_symbol(raw_symbol: str, market: str) -> str:
    symbol = raw_symbol.strip().upper()
    if market == "IDX" and not symbol.endswith(".JK"):
        symbol = f"{symbol}.JK"
    return symbol


def fetch_history(raw_symbol: str, market: str, period: str = "3y") -> pd.DataFrame:
    """Fetch daily OHLCV history. Longer default period than the JS app
    (3y vs 1y) since ML models benefit from more training examples."""
    symbol = normalize_symbol(raw_symbol, market)
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval="1d", auto_adjust=True)

    if df.empty:
        raise ValueError(f'Ticker "{symbol}" tidak ditemukan atau tidak ada data')

    df = df.reset_index()
    df = df.rename(
        columns={
            "Date": "date",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    )
    df = df[["date", "open", "high", "low", "close", "volume"]].dropna(
        subset=["close"]
    )
    df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)
    df = df.reset_index(drop=True)
    return df, symbol
