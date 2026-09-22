#!/bin/sh
# Photosensitivity luminance-trace suite for the sky (dev server on :5182 must be running)
cd /home/user/Test/automat
run() { node dev/sky-trace.mjs "$1" 390 844 | python3 -c "
import json,sys; d=json.loads(sys.stdin.read()); f=d['full']; t=d['worstTile16']
print(f\"{d['hash']:<55} calm={str(d['calm']):5} | full: {f['maxSwingsPerSec']}/s wcag {f['wcagPerSec']}/s step {f['maxFrameStepPct']}% | worst 1/16 tile: {t['maxSwingsPerSec']}/s wcag {t['wcagPerSec']}/s step {t['maxFrameStepPct']}% | err {len(d['errors'])}\")"; }
for h in "$@"; do run "$h" & done; wait
