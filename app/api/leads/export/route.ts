import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function csvEscape(value: unknown) {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/\"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchId = url.searchParams.get("searchId");
  const format = url.searchParams.get("format") ?? "csv";

  if (!searchId || !["csv", "xlsx"].includes(format)) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: search } = await supabase
    .from("search_history")
    .select("id,niche")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();

  if (!search) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  const { data: leads } = await supabase
    .from("lead_results")
    .select("business_name,owner_first_name,owner_last_name,email,email_type,email_verified,phone,website,location,source")
    .eq("search_id", searchId)
    .order("created_at", { ascending: true });

  const rows = (leads ?? []).map((lead) => ({
    "Business Name": lead.business_name ?? "",
    "Owner First Name": lead.owner_first_name ?? "",
    "Owner Last Name": lead.owner_last_name ?? "",
    Email: lead.email ?? "",
    "Email Type": lead.email_type ?? "",
    "Email Verified": lead.email_verified ? "true" : "false",
    Phone: lead.phone ?? "",
    Website: lead.website ?? "",
    Location: lead.location ?? "",
    Source: lead.source ?? "",
  }));

  const safeNiche = String(search.niche ?? "search").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const date = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="leads_${safeNiche}_${date}.xlsx"`,
      },
    });
  }

  const headers = [
    "Business Name",
    "Owner First Name",
    "Owner Last Name",
    "Email",
    "Email Type",
    "Email Verified",
    "Phone",
    "Website",
    "Location",
    "Source",
  ];

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads_${safeNiche}_${date}.csv"`,
    },
  });
}
