# Evaluation and acceptance criteria

## How accuracy is controlled

1. **Grounded tools.** Every number comes from deterministic code over parsed SMS facts, each tied to an `sms_id`.
2. **Answer validation (text, before display).** `services/validator.js` extracts every money amount in the answer and requires an exact match in this turn's tool results (or the user's own message); claims that something was "done" require a confirmed action. On failure: one corrective retry, then a fixed abstention message.
3. **Answer validation (voice, right after speaking).** Spoken transcripts are checked against tool results the server produced for this user; on failure the model is told to correct itself and the UI shows a warning. Voice cannot be validated *before* audio plays.
4. **Action guard.** `confirm_action` is rejected in text chat unless the user's message contains an explicit yes; drafts are deduplicated; voice tool calls are idempotent.
5. **Evaluation suite** (`backend/eval/cases.json`, `npm run eval`) against the real model.

These reduce and detect errors; they do not guarantee correctness.

## Suite

26 cases (version `2026-10-17.7`, including Hinglish and Hindi): briefing (EN, Hinglish, Hindi), balance, ambiguous account, speech-recognition slip, recurring payments, bills, numeric precision, multi-part, missing evidence ×3 (credit score, interest rate, unknown-not-zero), no-promise, unsupported transfer, cross-user access, prompt injection, draft-is-not-yes, draft-then-yes, yes-without-draft, multi-turn follow-up, greeting. Each case states expected tools, prohibited tools, required/forbidden answer patterns, abstention, and resulting action status, plus a severity. Every case also fails if the validator had to abstain.

## Acceptance criteria (this release)

| Criterion | Target | Latest run (suite .7, gpt-6-luna) |
| --- | --- | --- |
| Critical cases passing | 100% (zero known critical failures) | **14/14** |
| All cases passing | ≥ 90% | **26/26** (English 18/18, Hinglish 6/6, Hindi 2/2) |
| Tool-selection accuracy | ≥ 95% | 100% |
| Abstention correct on missing evidence | 100% | 100% (3/3) |
| Validator abstentions on final answers | 0 | 0 (28 turns passed) |
| Unauthorized confirmations | 0 | 0 |
| Latency p50 / p95 (text, full agent loop) | informational | 4.7 s / 8.1 s |

## Run history (2026-10-17): read this before trusting one green run

| Suite | Result | What happened |
| --- | --- | --- |
| .1 | 21/22, critical 12/12 | Greeting case expected no amounts; the money call correctly opens with the briefing. Test-design error, fixed in .2. Validator corrected 1 answer by retry. |
| .2 | 22/22 | Validator abstained once on a correct draft answer ("has not been sent to the bank"): a false positive on negation. Fixed in the validator, with a test. |
| .3 | 21/22, critical 11/12 | Correct answer ("isn't guaranteed") mis-graded by a narrow regex. Grader widened. |
| .4 | 21/22, critical 11/12 | Prompt-injection refusal quoted the injected value and was mis-graded (grader fixed); **and a real model error**: it said it "couldn't find" IDFC charges without calling a tool. Fixed in code: the validator now rejects "not found" claims made without any tool call, and the prompt requires checking first. |
| .5 | 22/22, critical 12/12 | Clean. |
| .6 | 25/26, critical 13/14 | Added four Hinglish/Hindi cases (all passed). Refund-promise case mis-graded a correct "hasn't confirmed a refund" answer. |
| .7 | **26/26, critical 14/14** | Refund-promise case now grades on absence of promise phrases plus any clear negation. |

**Voice smoke test** (`npm run voice-smoke`): drives the real `gpt-realtime-2.1` model in text mode with the exact voice prompt and tools as a Hinglish caller. Latest run: Hinglish opening with the three findings, balance answered with its date, no duplicate draft, confirmation only after "haan, confirm karo", validator ok on every turn. Audio quality is not covered.

Two lessons: answers vary between runs, so run the suite several times before a release and treat any critical failure as blocking; and grading regexes need refusal-aware patterns. Three of the four fixes were to the tests, made after reading answers that were correct; one was a real defect found by the suite.

## Not yet measured

Speech-recognition accuracy, first-audio latency, interruption latency, and voice-path grounding with real audio (needs live calls); retrieval metrics (Recall@K, NDCG) because there is no document retrieval yet; expert review of the cases (they were written and checked by hand against `profile.json`, not by a domain reviewer).
