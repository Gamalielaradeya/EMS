# Current Thesis Notes After Pre-Defense

This document explains how Codex should interpret the latest thesis document.

Primary thesis file:

* `Dokumentasi/SKRIPSI_CURRENT_BAB1_BAB5_AFTER_PRASIDANG.pdf`

Current thesis framing:

* `Early Warning System pada EMS Server Menggunakan Algoritma Long Short-Term Memory`

Important terminology:

* Use `Early Warning System` for the overall system framing.
* Use `estimasi suhu S2` or `prediksi suhu S2 lima menit ke depan` for LSTM output.
* Use `sensor health` for technical sensor/gateway condition.
* Use `current thermal status` for actual/current threshold classification.
* Use `prediction status` for LSTM-based status.
* S1 is `ambient/reference`.
* S2 is `hotspot/exhaust` and the LSTM target.

Do not use old framing as the main title:

* `Prediksi Anomali Termal`
* `Thermal Anomaly Prediction`
* `PUE`
* `energy efficiency`

Scope boundaries:

* No PUE calculation.
* No energy optimization.
* No fan, AC, relay, or cooling control.
* No training on Raspberry Pi.
* No enterprise monitoring expansion.
* No replacement of LSTM as the main model.

Implementation expectation:

* Only align user-facing wording and evidence readiness unless explicit approval is given for behavior changes.
* Do not expose secrets in screenshots or logs.
* Do not break current hardware collection or ML inference loop.
