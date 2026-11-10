const events = []

export function logEvent(event, details = {}) {
  const { sessionId, ...eventDetails } = details
  const record = { ...eventDetails, sessionId, event, timestamp: new Date().toISOString() }
  events.push(record)
  return record
}

export function getAllEvents() {
  return events.map((event) => ({ ...event }))
}

export function getSessionEvents(sessionId) {
  return events.filter((event) => event.sessionId === sessionId).map((event) => ({ ...event }))
}

export function clearSessionEvents(sessionId) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].sessionId === sessionId) events.splice(index, 1)
  }
}
