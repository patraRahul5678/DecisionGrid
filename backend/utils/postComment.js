const axios = require("axios");

async function postComment(token, owner, repo, prNumber, message) {
    await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        {
            body: message
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    );
}

module.exports = postComment;