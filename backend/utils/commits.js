const axios = require("axios");
const { getChangedFiles } = require("./changedFiles");

async function getNumberOfCommits(token, owner, repo, prNumber) {
    let developerCommits = {};

    const changedFiles = await getChangedFiles(token, owner, repo, prNumber);

    for (const file of changedFiles) {

        const commitsResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/commits`,
            {
                params: { path: file },
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github+json"
                }
            }
        );

        commitsResponse.data.forEach(commit => {

            const dev = commit.author?.login;

            if (!dev) return;

            developerCommits[dev] = (developerCommits[dev] || 0) + 1;

        });

    }
    return developerCommits;
}

async function getCommitsMessages(token, owner, repo, prNumber) {

    let messages = [];

    const changedFiles = await getChangedFiles(token, owner, repo, prNumber);
    for (const file of changedFiles) {
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/commits`,
            {
                params: {
                    path: file,
                    per_page: 20
                },
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github+json"
                }
            }
        );

        response.data.forEach(commit => {

            const message = commit.commit.message;
            const author = commit.author?.login;
            messages.push({ author, message });

        });
    }
    return messages;

}


module.exports = { getNumberOfCommits, getCommitsMessages };