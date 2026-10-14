// Role-aware labels for one shared group/event engine. The data model and
// logic stay unified — only these labels, icons, placeholders and examples
// change with the group type.
export const GROUP_TYPES = [
  "solo",
  "pair",
  "study",
  "medical",
  "corporate",
  "custom",
];

export const GROUP_TEMPLATES = {
  solo: {
    icon: "👤",
    memberNoun: "Just you",
    eventNoun: "Personal reminder",
    eventPlaceholder: "e.g. Renew passport",
    notePlaceholder: "Personal note…",
    noteExamples: ["Personal note"],
  },
  pair: {
    icon: "👥",
    memberNoun: "Partner",
    eventNoun: "Shared plan",
    eventPlaceholder: "e.g. Saturday hike",
    notePlaceholder: "Message to your partner…",
    noteExamples: ["Can't make it today"],
  },
  study: {
    icon: "📚",
    memberNoun: "Student / Teacher",
    eventNoun: "Class, exam, deadline",
    eventPlaceholder: "e.g. Math midterm",
    notePlaceholder: "Message to the class…",
    noteExamples: ["Sick, will catch up"],
  },
  medical: {
    icon: "⚕️",
    memberNoun: "Patient / Doctor",
    eventNoun: "Appointment, medication",
    eventPlaceholder: "e.g. 8am dose",
    notePlaceholder: "Message about this appointment…",
    noteExamples: ["Missed dose", "Running late"],
  },
  corporate: {
    icon: "🏢",
    memberNoun: "Staff / Manager",
    eventNoun: "Meeting, deadline, shift",
    eventPlaceholder: "e.g. Sprint review",
    notePlaceholder: "Message to the team…",
    noteExamples: ["On leave", "Blocked by another call"],
  },
  custom: {
    icon: "✨",
    memberNoun: "Member",
    eventNoun: "Group event",
    eventPlaceholder: "e.g. Sunday cookout",
    notePlaceholder: "Message to the group…",
    noteExamples: ["Can't make it"],
  },
};

export function templateFor(type) {
  return GROUP_TEMPLATES[type] || GROUP_TEMPLATES.custom;
}

// Reminder-schedule presets (minutes before the event).
export const REMINDER_PRESETS = [
  { label: "1 week before", minutes: 10080 },
  { label: "1 day before", minutes: 1440 },
  { label: "1 hour before", minutes: 60 },
  { label: "15 minutes before", minutes: 15 },
];
