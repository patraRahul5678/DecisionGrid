const axios = require("axios");

async function getChangedFiles(token, owner, repo, prNumber) {
  const filesResponse = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  const changedFiles = filesResponse.data.map(file => file.filename);
  return changedFiles;
}

module.exports = { getChangedFiles };