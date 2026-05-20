import { promises as dns } from "node:dns";
import { smtpVerifyMailbox } from "@/lib/utils/smtp";
import type { EmailCandidate } from "@/lib/types";

const SYNTAX_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function verifyCandidates(candidates: EmailCandidate[]) {
  const verified: EmailCandidate[] = [];

  for (const candidate of candidates) {
    if (!SYNTAX_REGEX.test(candidate.email)) {
      continue;
    }

    const domain = candidate.email.split("@")[1];
    try {
      const mx = await dns.resolveMx(domain);
      if (!mx.length) continue;

      const sorted = [...mx].sort((a, b) => a.priority - b.priority);
      const isVerified = await smtpVerifyMailbox(sorted[0].exchange, candidate.email);
      verified.push({ ...candidate, verified: isVerified });
    } catch {
      verified.push({ ...candidate, verified: false });
    }
  }

  return verified;
}
