async function createCheckRun(owner, repo, sha, token) {
    await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/check-runs`,
        {
            name: "DecisionGridOps AI Review",
            head_sha: sha,
            status: "in_progress"
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    );
}

async function updateCheckRun(owner, repo, checkRunId, token,responseMessage) {
    await axios.patch(
        `https://api.github.com/repos/${owner}/${repo}/check-runs/${checkRunId}`,
        {
            status: "completed",
            conclusion: "neutral",
            output: {
                title: "DecisionGridOps Feedback",
                summary: "AI code analysis completed",
                text: responseMessage
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

module.exports={createCheckRun,updateCheckRun};
