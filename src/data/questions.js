export const journey = { origin: 'Andheri', destination: 'Ghatkopar' }

export const questions = [
  {
    id: 'crowding',
    eyebrow: '01 / ON THE TRAIN',
    prompt: 'How crowded was the train during your most recent metro journey?',
    helper: 'Think back to the busiest part of your ride.',
    options: [
      { id: 'space', label: 'Plenty of space', detail: 'Could move freely', people: 1 },
      { id: 'some', label: 'Some crowding', detail: 'Comfortable enough', people: 3 },
      { id: 'quite', label: 'Quite crowded', detail: 'Limited standing space', people: 6 },
      { id: 'extreme', label: 'Extremely crowded', detail: 'Difficult to move', people: 9 },
    ],
  },
  {
    id: 'waiting',
    eyebrow: '02 / ON THE PLATFORM',
    prompt: 'Approximately how long did you wait on the platform for your train?',
    helper: 'Choose the closest estimate; an exact time is not needed.',
    options: [
      { id: 'under-5', label: 'Under 5 minutes' },
      { id: '5-10', label: '5–10 minutes' },
      { id: '11-15', label: '11–15 minutes' },
      { id: 'over-15', label: 'Over 15 minutes' },
    ],
  },
  {
    id: 'disruption',
    eyebrow: '03 / THE WHOLE JOURNEY',
    prompt: 'Did you experience any delay or disruption during your most recent metro journey?',
    helper: 'Just your experience. We won’t ask you to guess the cause or duration.',
    options: [
      { id: 'smooth', label: 'No, the journey was smooth.' },
      { id: 'disrupted', label: 'Yes, there was a delay or disruption.' },
    ],
  },
]
