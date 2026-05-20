import { LeadRow } from "@/components/LeadRow";

interface ResultsTableProps {
  leads: Array<{
    business_name: string;
    owner_first_name: string | null;
    owner_last_name: string | null;
    email: string | null;
    email_type: "personal" | "direct-business" | "generic" | "not_found";
    email_verified: boolean;
    phone: string | null;
    website: string | null;
    location: string | null;
  }>;
}

export function ResultsTable({ leads }: ResultsTableProps) {
  return (
    <div className="overflow-x-auto rounded border border-[#2a2a2a]">
      <table className="min-w-full border-collapse">
        <thead className="bg-[#141414] text-left text-xs uppercase text-[#c7c2b9]">
          <tr>
            <th className="p-2">#</th>
            <th className="p-2">Business</th>
            <th className="p-2">Owner</th>
            <th className="p-2">Email</th>
            <th className="p-2">Type</th>
            <th className="p-2">Verified</th>
            <th className="p-2">Phone</th>
            <th className="p-2">Website</th>
            <th className="p-2">Location</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, index) => (
            <LeadRow key={`${lead.business_name}-${index}`} index={index} lead={lead} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
