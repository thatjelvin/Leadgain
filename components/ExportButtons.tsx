export function ExportButtons({ searchId, disabled }: { searchId: string; disabled?: boolean }) {
  return (
    <div className="flex gap-2">
      <a
        href={`/api/leads/export?searchId=${searchId}&format=csv`}
        className={`rounded px-3 py-2 text-sm ${disabled ? "pointer-events-none bg-[#2b2b2b] text-[#888]" : "bg-[#c8a97e] text-black"}`}
      >
        Download CSV
      </a>
      <a
        href={`/api/leads/export?searchId=${searchId}&format=xlsx`}
        className={`rounded px-3 py-2 text-sm ${disabled ? "pointer-events-none bg-[#2b2b2b] text-[#888]" : "bg-[#c8a97e] text-black"}`}
      >
        Download XLSX
      </a>
    </div>
  );
}
