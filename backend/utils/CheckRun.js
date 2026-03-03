const axios = require("axios");

async function createCheckRun(token, owner, repo, conclusion, headSha,message) {
    const response = await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/check-runs`,
        {
            name: "DevHub Intent Check",
            head_sha: headSha,
            status: "completed",
            conclusion: conclusion,
            output: {
                title: "Intent Required",
                summary: message || "Please submit /intent before merging."
            }
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    );

    return response.data.id;
}


async function updateCheckRun(token, owner, repo, checkRunId, conclusion, message) {
    await axios.patch(
        `https://api.github.com/repos/${owner}/${repo}/check-runs/${checkRunId}`,
        {
            conclusion: conclusion,
            output: {
                title: conclusion === "success" 
                    ? "Intent Verified" 
                    : "Intent Required",
                summary: message
            }
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    );
}

module.exports = {
    createCheckRun,
    updateCheckRun
};