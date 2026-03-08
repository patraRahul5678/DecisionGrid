const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function summarizeIntent(text) {
    try {
        const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
You are a senior engineering reviewer.

Analyze the developer intent and respond with:

Summary:
- Problem
- Shortcut / technical debt
- Impact

Risk Level:
LOW / MEDIUM / HIGH

Mark HIGH risk if:
- database change
- authentication change
- rollback
- delete operations
- major logic change

Developer Intent:
${text}
`
  });

        return response.text;
    } catch (error) {
        console.error("AI Summary failed:", error.message);
        console.log("Using Gemini key:", process.env.GEMINI_API_KEY?.slice(0, 10));
        return "AI summary unavailable.";

    }
}


module.exports = { summarizeIntent };