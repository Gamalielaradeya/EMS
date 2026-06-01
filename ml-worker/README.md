# ML Worker

Python LSTM worker foundation for EMS Thermal LSTM.

The worker will resample PostgreSQL sensor readings to one-minute intervals, use a 30-point input window, and predict S2 temperature five minutes ahead. Final inference results will be submitted to the protected backend endpoint.

Implementation begins in Milestone `6`.
