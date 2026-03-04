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

Analyze the developer's intent and provide:

1. Decision Summary
- Problem and urgency
- Technical debt or shortcut
- Impact and future plan

2. Risk Assessment
Classify the change as:
LOW / MEDIUM / HIGH risk.

HIGH risk if:
- rollback/revert of production change
- major logic change
- database schema change
- security related change
- unclear intent

3. Recommendation
If HIGH risk, warn reviewers to carefully review before merging.

Developer Intent:
${commentText}
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