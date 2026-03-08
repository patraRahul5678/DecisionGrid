const axios = require("axios");
const { getFileContent } = require("./getFileContents");

async function getCommitFiles(owner, repo, sha, token) {

    const res = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    );

    const files = res.data.files;

    const filesWithCode = [];

    for (const file of files) {

        const code = await getFileContent(owner,repo,file.filename,sha,token);

        filesWithCode.push({
            filename: file.filename,
            code
        });
    }

    return filesWithCode;
}

module.exports = { getCommitFiles };