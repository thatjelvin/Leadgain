interface LeadRowProps {
  index: number;
  lead: {
    business_name: string;
    owner_first_name: string | null;
    owner_last_name: string | null;
    email: string | null;
    email_type: "personal" | "direct-business" | "generic" | "not_found";
    email_verified: boolean;
    phone: string | null;
    website: string | null;
    location: string | null;
  };
}

const typeClass: Record<LeadRowProps["lead"]["email_type"], string> = {
  personal: "bg-green-900/40 text-green-200",
  "direct-business": "bg-blue-900/40 text-blue-200",
  generic: "bg-yellow-900/40 text-yellow-100",
  not_found: "bg-red-900/40 text-red-200",
};

export function LeadRow({ index, lead }: LeadRowProps) {
  return (
    <tr className="border-b border-[#232323] text-sm">
      <td className="p-2">{index + 1}</td>
      <td className="p-2">{lead.business_name}</td>
      <td className="p-2">{lead.owner_first_name || lead.owner_last_name ? `${lead.owner_first_name ?? ""} ${lead.owner_last_name ?? ""}`.trim() : "—"}</td>
      <td className="p-2">{lead.email ?? "Not found"}</td>
      <td className="p-2">
        <span className={`rounded px-2 py-1 text-xs ${typeClass[lead.email_type]}`}>{lead.email_type}</span>
      </td>
      <td className="p-2">{lead.email_verified ? "✅" : "⚠️"}</td>
      <td className="p-2">{lead.phone ?? "—"}</td>
      <td className="p-2">{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer">{lead.website}</a> : "—"}</td>
      <td className="p-2">{lead.location ?? "—"}</td>
    </tr>
  );
}
