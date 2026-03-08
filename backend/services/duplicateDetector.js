const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function duplicateDetector(text) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `
You are an expert GitHub code review assistant helping students improve their coding practices.

Your job is to analyze repository code and provide useful feedback.

----------------------------
TASKS
----------------------------

1. Detect duplicate code or duplicated logic across files.
2. Detect weak or unclear commit messages.
3. Provide learning tips for beginner developers.

----------------------------
RULES
----------------------------

• Detect duplicate functions or repeated logic even if variable names differ.
• Ignore small similarities like imports or comments.
• Focus on repeated business logic or algorithms.
• Be concise and beginner-friendly.
• If no duplicate code is found, say "No duplicate logic detected."

----------------------------
INPUT DATA
----------------------------

Commit Message:
${text.commitMessage}

Repository Files and Code:
${text.filesCode}

----------------------------
RESPONSE FORMAT
----------------------------

Duplicate Code Report
---------------------

Duplicate Group (if any):
Files involved:
- file1
- file2

Reason:
Explain why they are duplicates.

Refactor Suggestion:
Explain how to refactor the duplicated logic.

Commit Message Review
---------------------

Original Commit Message:
<commit message>

Issue:
Explain why the message is weak (if applicable).

Suggested Commit Message:
<better commit message>

Learning Tips
-------------

• Tip 1
• Tip 2
• Tip 3
`
        });

        return response.text;

    } catch (error) {
        console.error("AI Summary failed:", error.message);
        console.log("Using Gemini key:", process.env.GEMINI_API_KEY?.slice(0, 10));
        return "AI summary unavailable.";

    }
}

module.exports = { duplicateDetector };