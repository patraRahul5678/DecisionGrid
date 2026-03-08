const axios = require("axios");
async function getFileContent(owner, repo, path, sha, token) {

    const res = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${sha}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    );

    const content = Buffer.from(res.data.content, "base64").toString("utf8");

    return content;
}

module.exports = { getFileContent };
