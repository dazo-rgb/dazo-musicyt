# dazo-musicyt — Audio DSP update

## Changes made
- Removed the forced 192 kHz AudioContext request. The browser now uses the device's native/default sample rate; forcing a high rate does not improve source audio quality and can increase resampling/CPU cost.
- Increased analyser FFT size from 256 to 2048 and added smoothing for a steadier, more informative visualizer.
- Improved visualizer frequency grouping, dynamic bar count, gradient, and high-DPI canvas sizing.
- Added output headroom after EQ and dynamics processing to reduce clipping risk from EQ boosts.
- Smoothed EQ and DSP parameter changes with AudioParam.setTargetAtTime.
- Reduced aggressive ICE/Radar tone boosts and made the compressor profiles less extreme.
- Added play/pause audio initialization error handling.
- Changed the UI's misleading "192kHz/32-bit Resampled Audio" claim to "Browser Audio DSP · EQ 5-Band".

## Important limitation
The browser's Web Audio API can provide EQ, dynamics compression, stereo panning, and tone shaping. The current "Dolby" and "DTS" selectors are only app-defined DSP profiles; they are not certified Dolby/DTS decoding, licensing, or true multichannel spatial audio. Real quality still depends on the source stream, browser/device output, headphones/speakers, and user settings.

## Files changed
- `static/app.js`
- `static/index.html`
- `static/style.css`

Go backend, Rust/WASM sources, and dependency manifests were copied unchanged.
