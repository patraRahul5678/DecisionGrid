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


const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function summarizeIntent(text) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `
You are an engineering review assistant.

Summarize the developer's intent in clear bullet points.

Focus on:
- Problem and urgency
- Any shortcut or technical debt
- Impact and future improvement plan

Keep it short and professional.

Developer Input:
${text}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
}

module.exports = {
    summarizeIntent
};