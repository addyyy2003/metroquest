# Challenge 1 — Feedback event and evaluation proposal

This proposal describes a future measurement design. MetroQuest only records events in memory in the current browser session; it does not send them to a service.

## Event model

Use one append-only event per user action, with an ISO 8601 UTC timestamp and a session-scoped random identifier. Keep optional fields absent when they do not apply.

| Event | Example fields |
| --- | --- |
| `session_started` | `sessionId`, `event`, `timestamp` |
| `question_viewed` | common fields, `questionId`, `viewId` |
| `answer_changed` | common fields, `questionId`, `viewId`, `responseTimeMs`, `answer`, `changedAnswer` |
| `answer_submitted` | common fields, `questionId`, `viewId`, `responseTimeMs`, `answer`, `changedAnswer` |
| `round_completed` | common fields, `questionId`, `answer` |
| `session_completed` | common fields, `sessionDurationMs` |

Example: `{ "sessionId": "session-uuid", "event": "answer_submitted", "questionId": "waiting", "timestamp": "2026-11-11T10:00:12.000Z", "responseTimeMs": 8200, "answer": "5-10", "changedAnswer": false }`.

Do not emit synthetic interactions or silently retry event writes. If a future collector is added, define idempotency around a stable event ID and document delivery failures.

## Independent indicators

The prototype calculates answer quality and engagement as separate outputs. It counts only defined question IDs and answer values. Missing metrics remain `unavailable`; report earned points against the available/possible weight and do not normalize a partial score to 100. For example, `40/40` means 40 points earned from the metrics available in that session; it is not a perfect score across all possible metrics.

**Implemented answer quality (weights total 100):**

- **Response-time plausibility (20):** pair a valid submitted response with its question view through `viewId`; exclude submissions without a valid matching question view. `responseTimeMs` is elapsed time from that question view; `timestamp` is the event timestamp. Use the configured per-question bounds, initially 0–300,000 ms, and award points in proportion to measured responses within bounds. Timing is a limited response-condition signal, not evidence that an answer is truthful or dishonest.
- **Consistency (30):** unavailable in this single-session prototype.
- **Completeness (20):** distinct valid submitted question IDs divided by the three defined questions, so repeated submissions for one question cannot inflate the score.
- **Patterned behaviour (30):** unavailable in this prototype.

**Implemented engagement (weights total 100):**

- **Completion (40):** awarded from an actual `session_completed` event.
- **Participation (25):** 10 points for at least one valid answer selection, 10 for a genuine answer revision where the value changed, and 5 for revisiting a question using a distinct `viewId`. Each category can earn points once per session.
- **Progression (20):** based on distinct valid completed question IDs, capped at three.
- **Voluntary return (15):** unavailable in a single-session prototype.

These are the implemented prototype rules. Consistency analysis, patterned-response detection, longitudinal return measurement, aggregate bias analysis, and AI-assisted question evaluation below are future capabilities, not implemented MetroQuest features. Do not use the prototype indicators to reject an individual’s feedback.

## Detection and question improvement

- **Rushed:** flag only for aggregate review when response time is implausibly short for the question after accounting for device and accessibility context. Do not treat a quick response as invalid by itself.
- **Patterned:** look for repeated sequences across enough independent responses, compare with a suitable baseline, and report uncertainty. A person choosing the same option in multiple questions is not automatically suspicious.
- **Potentially biased:** check response distributions by route, time, language, accessibility needs and recruitment channel where lawful and sufficiently aggregated. Compare the respondent mix with the intended rider population; disclose sampling limits and avoid sensitive individual profiling.

Use response insights to identify confusing wording, missing answer ranges, ceiling/floor effects, and questions that take unusually long. Draft small, traceable wording variants and compare comprehension and measurement continuity before rollout.

## AI-assisted evaluation and human publishing gate

AI can group de-identified feedback themes, flag ambiguous or leading wording for review, and propose alternative phrasings against a versioned question specification. It must not invent evidence, change the measured construct, or publish questions autonomously. Keep source examples, model/version, prompt, output, and evaluator decisions in a restricted review record with retention limits. Human research and product reviewers check meaning, accessibility, bias, and continuity against the original measurement. Run a documented pilot and approve a versioned release before any revised question reaches riders.
