const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function ownershipInsights(text) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `
You are a senior engineering reviewer.

Analyze the pull request context.

Changed Files:
${changedFiles}

Developer Commit Counts:
${commitCounts}

Allowed Developers (can merge PR):
${allowedDevelopers}

Teams in Organization:
${teams}

Recent Commit Messages:
${commitMessages}

Developer Intent:
${text}

Tasks:

1. Identify the developers most familiar with this code based on commit activity.
2. Only consider developers who have merge permissions.
3. If those developers belong to the same team, suggest the team.
4. If no clear team ownership exists, suggest the top 2 developers.

Respond in this format:

Summary:
- Problem
- Shortcut / technical debt
- Impact

Suggested Reviewers:
- Team: @team-name
OR
- Developers: @dev1, @dev2
`
        });

        return response.text;
    } catch (error) {
        console.error("AI Summary failed:", error.message);
        console.log("Using Gemini key:", process.env.GEMINI_API_KEY?.slice(0, 10));
        return "AI summary unavailable.";

    }
}

module.exports = { ownershipInsights };