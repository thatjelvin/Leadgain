const OWNER_PROMPT = `You are a data extraction assistant. Given the text content of a company's website,
extract the name of the business owner, founder, or director.
Return ONLY a JSON object: { "firstName": "...", "lastName": "...", "title": "..." }
If no owner is found, return: { "firstName": null, "lastName": null, "title": null }
Do not include any explanation or markdown.`;

export async function extractOwnerWithGroq(text: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key || !text.trim()) {
    return { firstName: null, lastName: null, title: null };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages: [
        { role: "system", content: OWNER_PROMPT },
        { role: "user", content: text.slice(0, 12000) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content);
    return {
      firstName: parsed.firstName ?? null,
      lastName: parsed.lastName ?? null,
      title: parsed.title ?? null,
    };
  } catch {
    return { firstName: null, lastName: null, title: null };
  }
}
