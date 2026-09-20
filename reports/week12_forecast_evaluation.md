# Week 12 Forecast Evaluation

## Comparison method
- XGBoost baseline uses the official 1-hour target from the Week 10 engineered dataset.
- LSTM is evaluated on the 24-hour sequence-aligned test rows for each horizon.
- The notebook and script document that LSTM evaluation is limited by complete historical context, so sequence-aligned rows may not match the XGBoost test set perfectly.

## Summary metrics
- XGBoost MAE (1h): 4.2527
- Best LSTM MAE: 5.3634 at horizon 1h
- Sequence note: LSTM uses a 24-hour sequence window; only sequence-aligned test rows with complete history are evaluated, so the LSTM comparison is constrained by the windowed train/validation/test split and may not match the full XGBoost test set one-for-one.
