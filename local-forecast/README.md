# local-forecast — advanced XGBoost service (runs on your machine only)

Optional companion to the main Next.js app. Adds a learned direction
forecast (XGBoost) on top of the rule-based Holt's-trend signal, plus a
walk-forward backtest so you can see whether it's actually beating a
simple SMA-trend baseline for a given ticker — not just assumed to.

This is **not deployed to Vercel**. It's meant to run locally next to
`npm run dev`; the Next.js API route (`app/api/stock/route.js`) tries to
reach it at `http://localhost:8000` and silently skips it if it's not
running, so the deployed app is unaffected either way.

## Setup

```bash
cd local-forecast
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Then run the Next.js app as usual (`npm run dev` in the project root) —
once both are up, the "XGBoost (local)" panel appears automatically
under the main signal on the page.

## Endpoints

- `GET /predict?symbol=BBCA&market=IDX&horizon=5` — trains the model on
  first call (cached to `models/`, retrain by passing `retrain=true`),
  then returns direction (UP/DOWN), probability, and backtest metrics.
- `POST /train?symbol=BBCA&market=IDX&horizon=5` — force (re)train.
- `GET /backtest?symbol=BBCA&market=IDX&horizon=5&folds=5` — walk-forward
  validation across multiple folds; use this before trusting a ticker's
  predictions, since a single train/test split can be lucky or unlucky.

`horizon` = how many trading days ahead the model predicts direction for
(default 5). `market` is `IDX` or `US`, same convention as the main app.

## How it works

- **Label**: is the close price higher `horizon` trading days from now
  than today? (binary classification — direction, not an exact price)
- **Features**: multi-day returns, distance from SMA20/SMA50, RSI(14),
  MACD histogram, 10-day volatility, 5-day volume change — see
  `features.py`.
- **Model**: `XGBClassifier`, shallow trees (max_depth=3) to reduce
  overfitting on a few hundred/thousand rows of daily data.
- **Baseline for comparison**: "predict UP whenever price is above its
  own 20-day average" — the same SMA-crossover logic already used in
  the JS app's rule-based signal. If XGBoost can't beat this on a
  ticker, the extra complexity probably isn't earning its keep for
  that stock.

## Honest caveat

Stock price direction is genuinely hard to predict — an accuracy
meaningfully above ~50-55% on out-of-sample folds is a good result for
short-horizon daily direction, not evidence of a "solved" model. Always
check `/backtest` before trusting `/predict` for a ticker you haven't
tried before, and treat this as one more input, not a certainty.
