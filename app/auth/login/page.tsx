"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 border border-[#2a2a2a] p-6 rounded-lg bg-[#111]">
        <h1 className="text-2xl font-semibold">LeadForge Login</h1>
        <p className="text-sm text-[#c7c2b9]">Use your admin-provisioned account credentials.</p>

        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            className="mt-1 w-full rounded border border-[#353535] bg-[#0f0f0f] p-2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="block text-sm">
          Password
          <input
            type="password"
            required
            className="mt-1 w-full rounded border border-[#353535] bg-[#0f0f0f] p-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#c8a97e] text-black px-4 py-2 font-medium disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
