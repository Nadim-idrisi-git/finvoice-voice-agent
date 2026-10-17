# Voice evaluation plan

No provider credential or audio device is available in this repository assessment, so no naturalness or latency benchmark is claimed. Before release, test English, Hindi, and code-switched Hinglish with multiple speakers and devices. Record connection time, end-of-turn delay, first generated and audible audio, interruption detection, cancellation, tool latency, reconnect rate, and p50/p95/p99 over representative networks.

Scenarios: short and long INR amounts; food-only follow-up during speech; two rapid interruptions; user speaks over model; noisy room; headphones vs speakers; permission denied; hidden tab; network loss; tool delay; tool action awaiting confirmation. Rate naturalness, pacing, language switching, number pronunciation, turn-taking, and grounding. Reject stale audio and verify that authorized actions are not silently cancelled by speech interruption.

Browser-native speech recognition/synthesis, where supported, is fallback only and is not evidence of the production real-time experience.
