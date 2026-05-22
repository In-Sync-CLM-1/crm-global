export type QuestionType = "mcq" | "short" | "long" | "list" | "roleplay";
export type SectionId = "A" | "B" | "C" | "D" | "E" | "F";

export interface Question {
  id: string;
  section: SectionId;
  marks: number;
  prompt: string;
  type: QuestionType;
  options?: string[];
  correctAnswer?: string;
  correctList?: string[];
  acceptedItems?: string[];
  marksPerCorrectItem?: number;
  keywords?: string[];
  minKeywords?: number;
  rubric?: string;
}

export interface Section {
  id: SectionId;
  title: string;
  marks: number;
  timeMinutes: number;
  description?: string;
}

export const SECTIONS: Section[] = [
  { id: "A", title: "Product Knowledge", marks: 25, timeMinutes: 12 },
  { id: "B", title: "Call Flow", marks: 20, timeMinutes: 10 },
  { id: "C", title: "Objection Handling", marks: 20, timeMinutes: 15, description: "Write your response to each objection. Aim for the natural way you'd actually say it on a call." },
  { id: "D", title: "Competitive Awareness", marks: 15, timeMinutes: 10 },
  { id: "E", title: "CRM & Process", marks: 10, timeMinutes: 5 },
  { id: "F", title: "Role-play", marks: 10, timeMinutes: 8, description: "Manual review only — write your actual opening as you would say it." },
];

export const TOTAL_MARKS = 100;
export const TIME_LIMIT_MINUTES = 60;
export const PASS_MARK = 70;

export const QUESTIONS: Question[] = [
  // ── Section A — Product Knowledge (25 marks) ──
  {
    id: "A1",
    section: "A",
    marks: 3,
    type: "long",
    prompt: "In one sentence, explain what Work-Sync does.",
    keywords: ["task", "accountability", "whatsapp", "hierarchy", "indian", "assignee", "assigner"],
    minKeywords: 3,
  },
  {
    id: "A2",
    section: "A",
    marks: 2,
    type: "short",
    prompt: "What is the one-line problem statement Work-Sync solves?",
    keywords: ["tasks", "lost", "whatsapp", "tracked", "accountability", "forgotten"],
    minKeywords: 2,
  },
  {
    id: "A3",
    section: "A",
    marks: 4,
    type: "list",
    prompt: "List the four steps of the Work-Sync workflow in order.",
    correctList: ["Assign", "Notify", "Update", "Confirm"],
    marksPerCorrectItem: 1,
  },
  {
    id: "A4",
    section: "A",
    marks: 2,
    type: "mcq",
    prompt: "Which of the following is a feature that NO competitor (Asana, ClickUp, Monday) offers?",
    options: [
      "Email notifications",
      "Mobile app",
      "Satisfaction Confirmation by the assigner",
      "Project deadlines",
    ],
    correctAnswer: "Satisfaction Confirmation by the assigner",
  },
  {
    id: "A5",
    section: "A",
    marks: 3,
    type: "short",
    prompt: "What is the price of the Team Plan, and how is it billed?",
    keywords: ["199", "user", "month", "quarterly"],
    minKeywords: 3,
  },
  {
    id: "A6",
    section: "A",
    marks: 2,
    type: "short",
    prompt: "What happens to notifications if the WhatsApp wallet runs out of balance?",
    keywords: ["email", "fallback", "automatic"],
    minKeywords: 2,
  },
  {
    id: "A7",
    section: "A",
    marks: 3,
    type: "list",
    prompt: "Name any three industries where Work-Sync is a strong fit.",
    acceptedItems: ["NBFC", "DSA", "Trading", "Logistics", "Professional Services", "Insurance", "Real Estate", "EdTech"],
    marksPerCorrectItem: 1,
  },
  {
    id: "A8",
    section: "A",
    marks: 3,
    type: "list",
    prompt: "Name any three customer brands you can mention to build credibility.",
    acceptedItems: ["Quess Corp", "Motherson", "Hiranandani", "Audi", "College Dekho", "Zolve", "Capital India", "Ecofy", "Zopper", "Alice Blue", "InCred"],
    marksPerCorrectItem: 1,
  },
  {
    id: "A9",
    section: "A",
    marks: 3,
    type: "short",
    prompt: "What is the length and cost of the free trial?",
    keywords: ["14", "days", "free", "no card", "no credit card"],
    minKeywords: 3,
  },

  // ── Section B — Call Flow (20 marks) ──
  {
    id: "B1",
    section: "B",
    marks: 5,
    type: "list",
    prompt: "List the five steps of a structured outbound call, in order.",
    correctList: ["Greet & verify", "Permission", "Pitch (30s)", "Qualify", "Demo ask"],
    marksPerCorrectItem: 1,
  },
  {
    id: "B2",
    section: "B",
    marks: 2,
    type: "mcq",
    prompt: "After the prospect picks up, what is the very first thing you must do — even before pitching?",
    options: [
      "Start the 30-second pitch immediately",
      "Confirm you are speaking to the right person and ask permission for 30 seconds",
      "Ask about their pricing budget",
      "Ask if they want a demo",
    ],
    correctAnswer: "Confirm you are speaking to the right person and ask permission for 30 seconds",
  },
  {
    id: "B3",
    section: "B",
    marks: 6,
    type: "long",
    prompt: "Write down three qualifying questions you would ask before pitching a demo.",
    keywords: ["team size", "current tool", "whatsapp", "pain", "tasks", "tracking", "decision", "industry", "budget"],
    minKeywords: 4,
  },
  {
    id: "B4",
    section: "B",
    marks: 2,
    type: "short",
    prompt: "Which two time slots during the day are the BEST for reaching decision-makers?",
    keywords: ["10-12", "4-6", "morning", "evening", "before lunch", "after 4"],
    minKeywords: 2,
  },
  {
    id: "B5",
    section: "B",
    marks: 2,
    type: "mcq",
    prompt: "What is the maximum number of attempts you should make on a 'Did Not Pick Up' lead before marking and moving on?",
    options: ["1 attempt", "3 attempts", "5 attempts", "Unlimited"],
    correctAnswer: "3 attempts",
  },
  {
    id: "B6",
    section: "B",
    marks: 3,
    type: "short",
    prompt: "After booking a demo, within how many minutes must the calendar invite and WhatsApp confirmation be sent?",
    keywords: ["15", "minutes", "immediately", "immediate"],
    minKeywords: 1,
  },

  // ── Section C — Objection Handling (20 marks) ──
  {
    id: "C1",
    section: "C",
    marks: 4,
    type: "long",
    prompt: "Prospect says: \"We already use Asana.\" Write your response.",
    keywords: ["whatsapp", "field", "notifications", "agents", "daily", "where they are", "satisfaction", "quality", "sign off"],
    minKeywords: 3,
  },
  {
    id: "C2",
    section: "C",
    marks: 4,
    type: "long",
    prompt: "Prospect says: \"It's too expensive.\" Write your response.",
    keywords: ["manager time", "productivity", "hour", "roi", "missed deadlines", "compliance", "value"],
    minKeywords: 3,
  },
  {
    id: "C3",
    section: "C",
    marks: 4,
    type: "long",
    prompt: "Prospect says: \"Send me an email, I'll review.\" Write your response.",
    keywords: ["15 minute", "demo", "specific time", "calendar", "before sending", "commitment"],
    minKeywords: 3,
  },
  {
    id: "C4",
    section: "C",
    marks: 4,
    type: "long",
    prompt: "Prospect says: \"I'm not the decision-maker.\" Write your response.",
    keywords: ["who", "connect", "introduce", "relevant", "decision", "name", "forward"],
    minKeywords: 3,
  },
  {
    id: "C5",
    section: "C",
    marks: 4,
    type: "long",
    prompt: "Prospect says: \"We use WhatsApp groups already.\" Write your response.",
    keywords: ["lost", "buried", "accountability", "audit", "trail", "record", "structure", "memory", "tracked"],
    minKeywords: 3,
  },

  // ── Section D — Competitive Awareness (15 marks) ──
  {
    id: "D1",
    section: "D",
    marks: 3,
    type: "list",
    prompt: "Name three things Work-Sync does that Asana, ClickUp, and Monday do NOT do.",
    acceptedItems: [
      "WhatsApp-native notifications",
      "Satisfaction confirmation",
      "Designation hierarchy",
      "Pay-per-message wallet",
      "Email fallback",
    ],
    marksPerCorrectItem: 1,
  },
  {
    id: "D2",
    section: "D",
    marks: 2,
    type: "mcq",
    prompt: "What is the SINGLE biggest competitor we lose deals to — more than Asana, ClickUp, or any Indian tool?",
    options: [
      "Zoho Projects",
      "ClickUp free tier",
      "Google Sheets + WhatsApp groups (the status quo)",
      "SmartTask",
    ],
    correctAnswer: "Google Sheets + WhatsApp groups (the status quo)",
  },
  {
    id: "D3",
    section: "D",
    marks: 4,
    type: "long",
    prompt: "A prospect says \"We just use a Google Sheet and a WhatsApp group, it works fine.\" Write your response.",
    keywords: ["manager time", "hours", "chasing", "buried", "audit", "quality", "done", "accountability", "attrition", "compliance"],
    minKeywords: 4,
  },
  {
    id: "D4",
    section: "D",
    marks: 2,
    type: "mcq",
    prompt: "Which Indian competitor offers a \"free forever\" tier and is therefore the hardest to win on price?",
    options: ["TaskOPad", "Task Tracker", "SmartTask", "Kissflow"],
    correctAnswer: "SmartTask",
  },
  {
    id: "D5",
    section: "D",
    marks: 4,
    type: "list",
    prompt: "Name two known weaknesses of Work-Sync that competitors may exploit. (Honest answer expected.)",
    acceptedItems: [
      "No free tier",
      "English-only UI",
      "No Indian languages",
      "Less feature depth than Zoho or Kissflow",
      "Limited integrations",
      "No Gantt charts",
    ],
    marksPerCorrectItem: 2,
  },

  // ── Section E — CRM & Process (10 marks) ──
  {
    id: "E1",
    section: "E",
    marks: 5,
    type: "list",
    prompt: "Name the five CRM status codes a lead can have, in the order they typically progress.",
    correctList: ["New", "Contacted", "Qualified", "Demo Booked", "Closed Won/Lost"],
    marksPerCorrectItem: 1,
  },
  {
    id: "E2",
    section: "E",
    marks: 3,
    type: "list",
    prompt: "After every call, what three things must you log in the CRM, at minimum?",
    acceptedItems: [
      "Outcome",
      "Next action",
      "Date of next action",
      "Pain points",
      "Decision-maker name",
      "Objection raised",
    ],
    marksPerCorrectItem: 1,
  },
  {
    id: "E3",
    section: "E",
    marks: 2,
    type: "mcq",
    prompt: "What is the daily minimum call target during the ramp-up week?",
    options: ["10 calls", "20 calls", "50 calls", "80 calls"],
    correctAnswer: "20 calls",
  },

  // ── Section F — Role-play (10 marks, manual review) ──
  {
    id: "F1",
    section: "F",
    marks: 10,
    type: "roleplay",
    prompt:
      "Write a 30-second cold opener for a prospect who is the Operations Head at a 50-person NBFC. Include greeting, permission ask, hook, and what you want next.",
    rubric:
      "Greeting + permission ask (2) | NBFC-relevant pain hook (3) | Mentions WhatsApp / accountability / satisfaction confirmation (2) | Clear next ask — demo / 15-min call (2) | Under 30 seconds read aloud (1)",
  },
];

export function getQuestionsBySection(section: SectionId): Question[] {
  return QUESTIONS.filter((q) => q.section === section);
}
