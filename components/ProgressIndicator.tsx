import type { PipelineStep } from "@/lib/types";

const STEPS: PipelineStep[] = [
  "discovery",
  "owner_identification",
  "email_discovery",
  "verification",
  "complete",
];

const LABELS: Record<PipelineStep, string> = {
  discovery: "Discovery",
  owner_identification: "Owner ID",
  email_discovery: "Email Discovery",
  verification: "Verification",
  complete: "Complete",
};

export function ProgressIndicator({ currentStep }: { currentStep: PipelineStep }) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {STEPS.map((step, index) => {
        const active = index <= currentIndex;
        return (
          <li
            key={step}
            className={`rounded border px-3 py-2 text-sm ${
              active
                ? "border-[#c8a97e] bg-[#1a1610] text-[#f5f0e8]"
                : "border-[#2e2e2e] bg-[#121212] text-[#9d9d9d]"
            }`}
          >
            {LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}
