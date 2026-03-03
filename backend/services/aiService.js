// const OpenAI = require("openai");
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// async function summarizeIntent(text) {

//     const response = await openai.chat.completions.create({
//         model: "gpt-4o-mini",
//         messages: [
//             {
//                 role: "system",
//                 content: `
// You are an engineering review assistant.

// Summarize the developer's intent in clear bullet points.

// Focus on:
// - Problem and urgency
// - Any shortcut or technical debt
// - Impact and future improvement plan

// Keep it short and professional.
// `
//             },
//             {
//                 role: "user",
//                 content: text
//             }
//         ]
//     });

//     return response.choices[0].message.content;
// }

// module.exports = {
//     summarizeIntent
// }


const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function summarizeIntent(text) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: `
You are an engineering review assistant.

Summarize the developer's intent in clear bullet points.

Focus on:
- Problem and urgency
- Any shortcut or technical debt
- Impact and future improvement plan

Keep it short and professional.

Developer Input:
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