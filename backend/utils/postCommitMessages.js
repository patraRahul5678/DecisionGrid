const axios = require("axios")
async function postCommitComment(owner, repo, sha, body, token) {

    await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/comments`,
        { body },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    );
}

module.exports = { postCommitComment }