import { useEffect, useMemo, useRef, useState } from 'react'
import { journey, questions } from './data/questions'
import { clearSessionEvents, getSessionEvents, logEvent } from './lib/events'
import { scoreAnswerQuality, scoreEngagement } from './lib/scoring'

const questionForStep = (step) => questions[step - 2]
const getSessionId = () => globalThis.crypto?.randomUUID?.() ?? `mq-${Date.now()}-${Math.random().toString(16).slice(2)}`
const formatDuration = (milliseconds) => milliseconds == null ? 'Unavailable' : `${(milliseconds / 1000).toFixed(1)} sec`
const showMetric = (value) => value == null ? 'Unavailable' : value

function App() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [sessionId, setSessionId] = useState(null)
  const [showInsights, setShowInsights] = useState(false)
  const [eventRevision, setEventRevision] = useState(0)
  const loggedQuestionViews = useRef(new Set())
  const questionStartedAt = useRef(0)
  const sessionStartedAt = useRef(0)
  const [questionViewId, setQuestionViewId] = useState(0)
  const changedQuestions = useRef(new Set())
  const completedRounds = useRef(new Set())
  const question = questionForStep(step)
  const progress = step === 0 ? 0 : step === 5 ? 100 : Math.round((step / 4) * 100)
  const progressLabel = step === 1
    ? 'STEP 1 OF 4 · JOURNEY CONTEXT'
    : step >= 2 && step <= 4
      ? `STEP ${step} OF 4 · QUESTION ${step - 1} OF 3`
      : 'COMPLETE'

  const recordEvent = (event, details) => {
    const record = logEvent(event, details)
    setEventRevision((revision) => revision + 1)
    return record
  }

  useEffect(() => {
    if (!question || !sessionId) return
    const viewId = `${question.id}-${questionViewId}`
    const viewKey = `${sessionId}:${viewId}`
    if (loggedQuestionViews.current.has(viewKey)) return
    loggedQuestionViews.current.add(viewKey)
    questionStartedAt.current = performance.now()
    recordEvent('question_viewed', { sessionId, questionId: question.id, viewId })
  }, [question, questionViewId, sessionId])

  const navigateToStep = (nextStep) => {
    if (nextStep >= 2 && nextStep <= 4) setQuestionViewId((current) => current + 1)
    setStep(nextStep)
  }

  const begin = () => {
    if (sessionId) clearSessionEvents(sessionId)
    const id = getSessionId()
    setSessionId(id)
    setAnswers({})
    setShowInsights(false)
    loggedQuestionViews.current = new Set()
    changedQuestions.current = new Set()
    completedRounds.current = new Set()
    setQuestionViewId(0)
    sessionStartedAt.current = performance.now()
    recordEvent('session_started', { sessionId: id })
    setStep(1)
  }

  const selectAnswer = (answer) => {
    const current = answers[question.id]
    if (current === answer) return
    const now = performance.now()
    const changedAnswer = current !== undefined
    if (changedAnswer) changedQuestions.current.add(question.id)
    setAnswers((previous) => ({ ...previous, [question.id]: answer }))
    recordEvent('answer_changed', {
      sessionId, questionId: question.id, viewId: `${question.id}-${questionViewId}`, responseTimeMs: Math.round(now - questionStartedAt.current), answer, changedAnswer,
    })
  }

  const submitRound = () => {
    if (!question || !answers[question.id]) return
    const answer = answers[question.id]
    recordEvent('answer_submitted', { sessionId, questionId: question.id, viewId: `${question.id}-${questionViewId}`, responseTimeMs: Math.round(performance.now() - questionStartedAt.current), answer, changedAnswer: changedQuestions.current.has(question.id) })
    changedQuestions.current.delete(question.id)
    if (!completedRounds.current.has(question.id)) {
      recordEvent('round_completed', { sessionId, questionId: question.id, answer })
      completedRounds.current.add(question.id)
    }
    navigateToStep(step + 1)
  }

  const completeSession = () => {
    recordEvent('session_completed', { sessionId, sessionDurationMs: Math.round(performance.now() - sessionStartedAt.current) })
    setStep(5)
  }

  useEffect(() => {
    if (step === 5 && sessionId && !getSessionEvents(sessionId).some((event) => event.event === 'session_completed')) completeSession()
  }, [step, sessionId])

  const sessionEvents = useMemo(() => sessionId ? getSessionEvents(sessionId) : [], [sessionId, step, showInsights, eventRevision])
  const quality = scoreAnswerQuality({ events: sessionEvents, sessionId })
  const engagement = scoreEngagement({ events: sessionEvents, sessionId })

  const goBack = () => navigateToStep(Math.max(1, step - 1))

  return (
    <main className="app-shell min-h-screen">
      <header className="topbar">
        <a className="brand" href="#top" onClick={(event) => event.preventDefault()} aria-label="MetroQuest home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>METRO<span className="brand-light">QUEST</span></span>
        </a>
        <div className="top-note"><span className="live-dot" /> A small journey, a better commute</div>
      </header>

      {step > 0 && <div className="progress-wrap" aria-label={`Progress: ${progress}%`}>
        <div className="progress-meta"><span>YOUR RIDE RECAP</span><span>{progressLabel}</span></div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
      </div>}

      {step === 0 && <section className="welcome page-grid" id="top">
        <div className="welcome-copy">
          <p className="kicker"><span className="kicker-line" /> A BETTER WAY TO BE HEARD</p>
          <h1>Your commute<br />has a <em>story.</em></h1>
          <p className="lead">A few quick questions can help make everyday metro journeys work better for everyone.</p>
          <div className="welcome-actions"><button className="button button-dark" onClick={begin}>Start your ride recap <span aria-hidden="true">↗</span></button><span className="duration">Estimated 60–90 seconds</span></div>
          <div className="prototype-note"><span className="note-mark">i</span><span><strong>A small prototype.</strong> Your answers stay in this session and are not sent anywhere.</span></div>
        </div>
        <MetroIllustration />
        <div className="welcome-foot"><span>BUILT AROUND REAL RIDES</span><span>04 STEPS · 03 QUESTIONS</span><span>MUMBAI · INDIA</span></div>
      </section>}

      {step === 1 && <section className="journey-stage stage-layout">
        <div className="stage-main">
          <p className="kicker"><span className="kicker-line" /> BEFORE WE BEGIN</p>
          <span className="display-index">01</span>
          <h1>Let’s picture<br />the journey.</h1>
          <p className="lead">We’ll ask about a recent ride. Here’s an illustrative sample route to set the scene; it is not your actual travel history.</p>
          <div className="demo-label"><span className="note-mark">i</span> ILLUSTRATIVE SAMPLE · NOT YOUR ACTUAL TRAVEL HISTORY</div>
          <div className="route-card">
            <div className="route-station"><span className="station-dot origin" /><div><small>FROM</small><strong>{journey.origin}</strong></div></div>
            <div className="route-line"><span>LINE 1 · SAMPLE</span></div>
            <div className="route-station"><span className="station-dot destination" /><div><small>TO</small><strong>{journey.destination}</strong></div></div>
          </div>
          <div className="stage-actions"><button className="button button-dark" onClick={() => navigateToStep(2)}>That’s clear <span aria-hidden="true">→</span></button><button className="text-button" onClick={() => setStep(0)}>Back</button></div>
        </div>
        <div className="route-aside"><span className="aside-number">01</span><p>Think of your <em>most recent</em> metro ride as you answer. There are no right or wrong answers.</p><div className="aside-rule"/><small>ABOUT 10 SECONDS TO READ</small></div>
      </section>}

      {question && <section className="question-stage stage-layout">
        <div className="stage-main">
          <p className="kicker"><span className="kicker-line" /> {question.eyebrow}</p>
          <span className="display-index">0{step}</span>
          <h1 className="question-title">{question.prompt}</h1>
          <p className="question-helper">{question.helper}</p>
          {question.id === 'crowding' && <div className="crowding-options" role="group" aria-label="Train crowding level">{question.options.map((option) => <button key={option.id} className={`crowd-option ${answers[question.id] === option.id ? 'selected' : ''}`} onClick={() => selectAnswer(option.id)} aria-pressed={answers[question.id] === option.id}>
            <TrainCar people={option.people} />
            <span className="option-copy"><strong>{option.label}</strong><small>{option.detail}</small></span>
            <span className="radio" aria-hidden="true" />
          </button>)}</div>}
          {question.id === 'waiting' && <div className="time-options" role="group" aria-label="Platform waiting time">{question.options.map((option, index) => <button key={option.id} className={`time-option ${answers[question.id] === option.id ? 'selected' : ''}`} onClick={() => selectAnswer(option.id)} aria-pressed={answers[question.id] === option.id}><span className="time-tick">{['05','10','15','∞'][index]}</span><strong>{option.label}</strong><span className="radio" aria-hidden="true" /></button>)}</div>}
          {question.id === 'disruption' && <div className="disruption-wrap"><div className={`journey-timeline ${answers[question.id] === 'disrupted' ? 'is-disrupted' : ''}`}><span className="timeline-node start"/><span className="timeline-path"/><span className="timeline-node end"/><span className="timeline-caption left">DEPARTURE</span><span className="timeline-caption right">ARRIVAL</span>{answers[question.id] === 'disrupted' && <span className="timeline-break">!</span>}</div><div className="binary-options">{question.options.map((option) => <button key={option.id} className={`binary-option ${answers[question.id] === option.id ? 'selected' : ''}`} onClick={() => selectAnswer(option.id)} aria-pressed={answers[question.id] === option.id}><span className="radio" aria-hidden="true"/><span>{option.label}</span><span className="option-arrow" aria-hidden="true">↗</span></button>)}</div></div>}
          <div className="stage-actions"><button className="button button-dark" onClick={submitRound} disabled={!answers[question.id]}>Continue <span aria-hidden="true">→</span></button><button className="text-button" onClick={goBack}>Back</button><span className="save-hint">{answers[question.id] ? 'Answer saved for this session' : 'Choose one answer to continue'}</span></div>
        </div>
        <div className="question-aside"><span className="aside-number">0{step - 1} / 03</span><div className="aside-illustration">{question.id === 'crowding' ? <TrainSide /> : question.id === 'waiting' ? <WaitingIllustration /> : <JourneyIllustration />}</div><p>{question.id === 'crowding' ? 'A simple snapshot of how much room there was around you.' : question.id === 'waiting' ? 'A best estimate is useful. No need to check a clock.' : 'We’re interested in what happened, without guessing why.'}</p><div className="aside-rule"/><small>YOUR ANSWER CAN BE CHANGED</small></div>
      </section>}

      {step === 5 && <section className="complete-stage">
        <div className="completion-head"><p className="kicker"><span className="kicker-line" /> RIDE RECAP COMPLETE</p><h1>Thanks for<br />taking the <em>time.</em></h1><p className="lead">Your experience is one small signal that helps make the whole network better.</p></div>
        <div className="summary-panel"><div className="summary-top"><div><small>YOUR SESSION SUMMARY</small><h2>One ride, remembered.</h2></div><span className="check-stamp" aria-label="Complete">✓</span></div><div className="summary-route"><span>{journey.origin}</span><span className="summary-route-line"/><span>{journey.destination}</span><small>DEMO ROUTE</small></div>
          {questions.map((item, index) => { const selected = item.options.find((option) => option.id === answers[item.id]); return <div className="answer-row" key={item.id}><span className="answer-number">0{index + 1}</span><div><small>{item.eyebrow.replace(/^0\d \/ /, '')}</small><p>{selected?.label ?? 'No answer recorded'}</p>{selected?.detail && <span className="answer-detail">{selected.detail}</span>}</div><span className="answer-check">✓</span></div> })}
        </div>
        <div className="credit-note"><div className="credit-stamp">MQ<br/><span>DEMO</span></div><div><strong>A little ride credit, just for fun.</strong><p>In this prototype, your recap earns a demo ride-credit note. No real credits are issued.</p></div><span className="credit-value">+10 <small>DEMO</small></span></div>
        <div className="completion-actions"><button className="button button-dark" onClick={begin}>Take another ride <span aria-hidden="true">↻</span></button><button className="text-button" onClick={() => setShowInsights((value) => !value)}>{showInsights ? 'Hide session indicators' : 'View session indicators'}</button></div>
        {showInsights && <div className="insights-panel"><div><small>ANSWER QUALITY INDICATOR</small><strong>{quality.score ?? '—'}<span> / 100</span></strong><p>{quality.note}</p><small>Response time by question: Train crowding {formatDuration(quality.responseTimesByQuestion.crowding)} · Platform wait {formatDuration(quality.responseTimesByQuestion.waiting)} · Disruption {formatDuration(quality.responseTimesByQuestion.disruption)}</small><small>Total session duration: {formatDuration(quality.sessionDurationMs)}</small><small>Available weight: {quality.availableWeight} / 100 · Response plausibility: {showMetric(quality.metrics.responseTimePlausibility)} / 20 · Completeness: {showMetric(quality.metrics.interactionCompleteness)} / 20 · Consistency: unavailable · Pattern: unavailable</small></div><div><small>ENGAGEMENT INDICATOR</small><strong>{engagement.score ?? '—'}<span> / 100</span></strong><p>{engagement.note}</p><small>Available weight: {engagement.availableWeight} / 100 · Completion: {showMetric(engagement.metrics.gameCompletion)} / 40 · Participation: {showMetric(engagement.metrics.interactionParticipation)} / 25 (selection {showMetric(engagement.participationBreakdown?.selection)}, revision {showMetric(engagement.participationBreakdown?.revision)}, revisit {showMetric(engagement.participationBreakdown?.revisit)}) · Progression: {showMetric(engagement.metrics.roundProgression)} / 20 · Return: unavailable</small></div></div>}
        <p className="completion-foot">THANK YOU FOR HELPING THE CITY MOVE BETTER.</p>
      </section>}
      <footer className="footer"><span>METROQUEST <span className="footer-separator">/</span> A FEEDBACK PROTOTYPE</span><span>MADE FOR THE EVERYDAY RIDE</span></footer>
    </main>
  )
}

function MetroIllustration() {
  return <div className="hero-art" aria-label="Illustration of a metro train arriving at a platform" role="img"><div className="art-label">THE CITY, IN MOTION <span>01—04</span></div><div className="sun-disc"/><div className="skyline"><i/><i/><i/><i/><i/><i/><i/></div><div className="rail-line rail-one"/><div className="rail-line rail-two"/><div className="hero-train"><div className="train-front"><div className="train-window"><span>LINE 1</span><b>GHATKOPAR</b></div><div className="train-headlight"/></div><div className="train-car-body"><div className="car-window"/><div className="car-window"/><div className="car-window"/><div className="car-door"/><div className="car-window"/></div><div className="train-under"/></div><div className="platform-edge"/><div className="art-foot"><span>ANDHERI → GHATKOPAR</span><span>EVERY JOURNEY COUNTS</span></div></div>
}

function TrainCar({ people }) {
  return <span className={`train-car train-car-${people}`} aria-hidden="true"><span className="car-roof"/><span className="car-frame"><span className="car-window"><span className="passengers">{Array.from({ length: people }, (_, index) => <i key={index}/>)}</span></span><span className="door-seam"/><span className="car-window second"><span className="passengers">{Array.from({ length: Math.max(1, people - 1) }, (_, index) => <i key={index}/>)}</span></span></span><span className="car-base"/></span>
}
function TrainSide() { return <svg viewBox="0 0 220 110" role="img" aria-label="Metro train profile illustration"><path d="M24 75V36c0-9 8-16 17-16h137c11 0 19 8 19 19v36H24Z" fill="#e45b2d"/><path d="M36 38c0-5 4-9 9-9h39v29H36V38Zm56-9h32v29H92V29Zm49 0h31c6 0 11 5 11 11v18h-42V29Z" fill="#f5f0e7"/><path d="M26 63h171v8H26zM42 79a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm136 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Z" fill="#20201e"/><path d="M76 68v5m65-5v5" stroke="#f5f0e7" strokeWidth="2"/></svg> }
function WaitingIllustration() { return <svg viewBox="0 0 220 130" role="img" aria-label="Platform clock illustration"><circle cx="108" cy="60" r="44" fill="none" stroke="#d8d1c5" strokeWidth="3"/><circle cx="108" cy="60" r="34" fill="#f5f0e7" stroke="#e45b2d" strokeWidth="2"/><path d="M108 39v22l16 10" fill="none" stroke="#20201e" strokeWidth="3" strokeLinecap="round"/><path d="M36 109h146" stroke="#20201e" strokeWidth="2"/><path d="M55 104V91h22v13m77 0V86h17v18" fill="none" stroke="#647a66" strokeWidth="3"/></svg> }
function JourneyIllustration() { return <svg viewBox="0 0 220 130" role="img" aria-label="Journey timeline illustration"><path d="M28 66h164" stroke="#d8d1c5" strokeWidth="6"/><path d="M28 66h164" stroke="#647a66" strokeWidth="2" strokeDasharray="4 6"/><circle cx="33" cy="66" r="10" fill="#e45b2d"/><circle cx="187" cy="66" r="10" fill="#647a66"/><path d="M108 53l14 13-14 13-14-13 14-13Z" fill="#f5f0e7" stroke="#20201e" strokeWidth="2"/><path d="M108 59v8m0 5v1" stroke="#20201e" strokeWidth="2" strokeLinecap="round"/><text x="24" y="102" fill="#20201e" fontSize="8" letterSpacing="1">START</text><text x="166" y="102" fill="#20201e" fontSize="8" letterSpacing="1">FINISH</text></svg> }

export default App
