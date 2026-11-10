import { questions } from '../data/questions.js'

const questionById = new Map(questions.map((question) => [question.id, question]))
const qualityWeights = { responseTimePlausibility: 20, consistency: 30, interactionCompleteness: 20, repeatedPattern: 30 }
const engagementWeights = { gameCompletion: 40, interactionParticipation: 25, roundProgression: 20, voluntaryReturn: 15 }
const questionIds = questions.map((question) => question.id)

export const RESPONSE_TIME_BOUNDS_MS = Object.fromEntries(
  questionIds.map((questionId) => [questionId, { minMs: 0, maxMs: 300_000 }]),
)

const validTimestamp = (event) => {
  const timestamp = Date.parse(event?.timestamp)
  return Number.isFinite(timestamp) ? timestamp : null
}

function scopeEvents(events, sessionId) {
  return sessionId == null ? events : events.filter((event) => event.sessionId === sessionId)
}

function isValidQuestionAnswer(questionId, answer) {
  const question = questionById.get(questionId)
  return Boolean(question && question.options.some((option) => option.id === answer))
}

function collectStartedSession(events) {
  return events.some((event) => event.event === 'session_started' && validTimestamp(event) !== null)
}

function collectQuestionViews(events) {
  const views = new Map()

  for (const event of events) {
    if (event.event !== 'question_viewed' || !questionById.has(event.questionId)) continue
    if (typeof event.viewId !== 'string' || event.viewId.length === 0 || validTimestamp(event) === null) continue

    let questionViews = views.get(event.questionId)
    if (!questionViews) {
      questionViews = new Map()
      views.set(event.questionId, questionViews)
    }
    if (!questionViews.has(event.viewId)) {
      questionViews.set(event.viewId, event)
    }
  }

  return views
}

function matchingView(views, event) {
  const view = views.get(event.questionId)?.get(event.viewId)
  if (!view) return null
  const viewedAt = validTimestamp(view)
  const occurredAt = validTimestamp(event)
  return viewedAt !== null && occurredAt !== null && occurredAt >= viewedAt ? view : null
}

function collectValidSubmissions(events, views) {
  const latestByQuestion = new Map()

  for (const event of events) {
    if (event.event !== 'answer_submitted' || !questionById.has(event.questionId)) continue
    if (!isValidQuestionAnswer(event.questionId, event.answer)) continue
    if (!matchingView(views, event)) continue
    latestByQuestion.set(event.questionId, event)
  }

  return latestByQuestion
}

function isValidBounds(bounds) {
  return Number.isFinite(bounds?.minMs)
    && Number.isFinite(bounds?.maxMs)
    && bounds.minMs >= 0
    && bounds.maxMs >= bounds.minMs
}

function weightedResult(metrics, weights) {
  const availableMetrics = Object.entries(metrics).filter(([, value]) => value !== null)
  const availablePoints = availableMetrics.reduce((total, [, value]) => total + value, 0)
  const availableWeight = availableMetrics.reduce((total, [metric]) => total + weights[metric], 0)

  return {
    score: availableWeight > 0 ? availablePoints : null,
    availablePoints: availableWeight > 0 ? availablePoints : null,
    availableWeight,
    possiblePoints: 100,
  }
}

export function scoreAnswerQuality({ events = [], sessionId, responseTimeBounds = RESPONSE_TIME_BOUNDS_MS } = {}) {
  const sessionEvents = scopeEvents(events, sessionId)
  const hasStartedSession = collectStartedSession(sessionEvents)
  const views = collectQuestionViews(sessionEvents)
  const submissions = hasStartedSession ? collectValidSubmissions(sessionEvents, views) : new Map()
  const responseTimesByQuestion = Object.fromEntries(questionIds.map((questionId) => {
    const responseTimeMs = submissions.get(questionId)?.responseTimeMs
    return [questionId, Number.isFinite(responseTimeMs) && responseTimeMs >= 0 ? responseTimeMs : null]
  }))

  const measurableResponseTimes = questionIds.flatMap((questionId) => {
    const responseTimeMs = responseTimesByQuestion[questionId]
    const bounds = responseTimeBounds?.[questionId]
    return responseTimeMs !== null && isValidBounds(bounds) ? [{ responseTimeMs, bounds }] : []
  })
  const plausibleCount = measurableResponseTimes.filter(({ responseTimeMs, bounds }) => (
    responseTimeMs >= bounds.minMs && responseTimeMs <= bounds.maxMs
  )).length

  const metrics = {
    responseTimePlausibility: measurableResponseTimes.length
      ? Math.round((plausibleCount / measurableResponseTimes.length) * qualityWeights.responseTimePlausibility)
      : null,
    consistency: null,
    interactionCompleteness: hasStartedSession
      ? Math.round((submissions.size / questionIds.length) * qualityWeights.interactionCompleteness)
      : null,
    repeatedPattern: null,
  }

  const scored = weightedResult(metrics, qualityWeights)
  const completedEvent = [...sessionEvents].reverse().find((event) => event.event === 'session_completed')
  const sessionDurationMs = Number.isFinite(completedEvent?.sessionDurationMs) && completedEvent.sessionDurationMs >= 0
    ? completedEvent.sessionDurationMs
    : null

  return {
    ...scored,
    metrics,
    viewedQuestions: views.size,
    responseTimesByQuestion,
    sessionDurationMs,
    note: 'Response-time plausibility is one limited signal about response conditions, never proof that an answer is truthful or dishonest.',
  }
}

function collectParticipation(events, views) {
  const priorAnswerByQuestion = new Map()
  let hasValidSelection = false
  let hasGenuineRevision = false

  for (const event of events) {
    if (event.event !== 'answer_changed' || !questionById.has(event.questionId)) continue
    if (!isValidQuestionAnswer(event.questionId, event.answer) || !matchingView(views, event)) continue

    hasValidSelection = true
    const previousAnswer = priorAnswerByQuestion.get(event.questionId)
    if (previousAnswer !== undefined && previousAnswer !== event.answer && event.changedAnswer === true) {
      hasGenuineRevision = true
    }
    priorAnswerByQuestion.set(event.questionId, event.answer)
  }

  const revisitedQuestion = questionIds.some((questionId) => (views.get(questionId)?.size ?? 0) > 1)
  const breakdown = {
    selection: hasValidSelection ? 10 : 0,
    revision: hasGenuineRevision ? 10 : 0,
    revisit: revisitedQuestion ? 5 : 0,
  }

  return { points: Object.values(breakdown).reduce((sum, points) => sum + points, 0), breakdown }
}

function collectCompletedRounds(events) {
  const completedQuestionIds = new Set()
  for (const event of events) {
    if (event.event === 'round_completed'
      && isValidQuestionAnswer(event.questionId, event.answer)
      && validTimestamp(event) !== null) {
      completedQuestionIds.add(event.questionId)
    }
  }
  return Math.min(completedQuestionIds.size, questionIds.length)
}

export function scoreEngagement({ events = [], sessionId } = {}) {
  const sessionEvents = scopeEvents(events, sessionId)
  const hasStartedSession = collectStartedSession(sessionEvents)
  const completed = sessionEvents.some((event) => event.event === 'session_completed' && validTimestamp(event) !== null)
  const metrics = {
    gameCompletion: hasStartedSession ? (completed ? engagementWeights.gameCompletion : 0) : null,
    interactionParticipation: null,
    roundProgression: hasStartedSession ? 0 : null,
    voluntaryReturn: null,
  }
  let participationBreakdown = null

  if (hasStartedSession) {
    const views = collectQuestionViews(sessionEvents)
    const participation = collectParticipation(sessionEvents, views)
    const completedRounds = collectCompletedRounds(sessionEvents)
    metrics.interactionParticipation = participation.points
    metrics.roundProgression = Math.round((completedRounds / questionIds.length) * engagementWeights.roundProgression)
    participationBreakdown = participation.breakdown
  }

  return {
    ...weightedResult(metrics, engagementWeights),
    metrics,
    participationBreakdown,
    note: 'Participation reflects distinct in-session interaction types. Voluntary return behaviour is unavailable in a single session.',
  }
}
