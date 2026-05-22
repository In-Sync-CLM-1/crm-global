import { QUESTIONS, SECTIONS, TOTAL_MARKS } from "@/data/sdrQuestions";
import type { Question, SectionId } from "@/data/sdrQuestions";

export interface ResponseRow {
  question_id: string;
  response_text: string | null;
}

export interface ScoredResponse {
  question_id: string;
  section: SectionId;
  auto_score: number;
  max_score: number;
  flagged_for_review: boolean;
}

export interface ScoreResult {
  responses: ScoredResponse[];
  total: number;
  bySection: Record<SectionId, { score: number; max: number }>;
  verdict: string;
  verdictBand: "strong" | "hire" | "conditional" | "borderline" | "reject";
}

function normaliseText(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").replace(/\s+/g, " ").trim();
}

function countKeywordMatches(text: string, keywords: string[]): number {
  const haystack = normaliseText(text);
  let hits = 0;
  for (const kw of keywords) {
    const needle = normaliseText(kw);
    if (!needle) continue;
    if (haystack.includes(needle)) hits++;
  }
  return hits;
}

function scoreSingle(q: Question, responseText: string | null): { auto: number; flag: boolean } {
  const text = (responseText || "").trim();
  if (!text) return { auto: 0, flag: false };

  switch (q.type) {
    case "mcq": {
      const correct = (q.correctAnswer || "").trim();
      return { auto: text === correct ? q.marks : 0, flag: false };
    }
    case "short":
    case "long": {
      if (!q.keywords?.length) return { auto: 0, flag: true };
      const min = q.minKeywords || q.keywords.length;
      const matches = countKeywordMatches(text, q.keywords);
      const raw = Math.min(matches / min, 1);
      const score = Math.round(raw * q.marks);
      const flag = q.type === "long" || score === 0;
      return { auto: score, flag };
    }
    case "list": {
      if (q.correctList?.length) {
        // Ordered list — count exact-position matches
        const candidateItems = text
          .split(/\n|,|;|→|->|>/g)
          .map((s) => normaliseText(s))
          .filter(Boolean);
        let hits = 0;
        q.correctList.forEach((item, i) => {
          const expected = normaliseText(item);
          const seen = candidateItems[i];
          if (seen && (seen === expected || seen.includes(expected) || expected.includes(seen))) hits++;
        });
        const perItem = q.marksPerCorrectItem ?? q.marks / q.correctList.length;
        return { auto: Math.min(q.marks, Math.round(hits * perItem)), flag: hits === 0 };
      }
      if (q.acceptedItems?.length) {
        // Unordered "any N from list" — count keyword presence anywhere in text
        const matches = countKeywordMatches(text, q.acceptedItems);
        const perItem = q.marksPerCorrectItem ?? 1;
        const maxItems = Math.floor(q.marks / perItem);
        const counted = Math.min(matches, maxItems);
        return { auto: counted * perItem, flag: counted === 0 };
      }
      return { auto: 0, flag: true };
    }
    case "roleplay":
      // Always manual
      return { auto: 0, flag: true };
  }
}

export function verdictFor(total: number): { band: ScoreResult["verdictBand"]; label: string } {
  if (total >= 90) return { band: "strong", label: "Strong hire — fast-track" };
  if (total >= 80) return { band: "hire", label: "Hire — proceed to mock calls" };
  if (total >= 70) return { band: "conditional", label: "Conditional — proceed with closer supervision" };
  if (total >= 60) return { band: "borderline", label: "Borderline — re-test after 2 days of gap training" };
  return { band: "reject", label: "Reject — do not proceed" };
}

export function scoreAttempt(responses: ResponseRow[]): ScoreResult {
  const responseMap = new Map(responses.map((r) => [r.question_id, r.response_text]));
  const scoredRows: ScoredResponse[] = [];
  const bySection: Record<SectionId, { score: number; max: number }> = {
    A: { score: 0, max: 0 },
    B: { score: 0, max: 0 },
    C: { score: 0, max: 0 },
    D: { score: 0, max: 0 },
    E: { score: 0, max: 0 },
    F: { score: 0, max: 0 },
  };

  let total = 0;
  for (const q of QUESTIONS) {
    const txt = responseMap.get(q.id) ?? null;
    const { auto, flag } = scoreSingle(q, txt);
    scoredRows.push({
      question_id: q.id,
      section: q.section,
      auto_score: auto,
      max_score: q.marks,
      flagged_for_review: flag,
    });
    bySection[q.section].score += auto;
    bySection[q.section].max += q.marks;
    total += auto;
  }

  const v = verdictFor(total);
  return {
    responses: scoredRows,
    total: Math.min(total, TOTAL_MARKS),
    bySection,
    verdict: v.label,
    verdictBand: v.band,
  };
}

export function sectionTitle(id: SectionId): string {
  return SECTIONS.find((s) => s.id === id)?.title ?? id;
}
