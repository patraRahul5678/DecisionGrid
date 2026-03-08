const { generateGitHubJWT } = require("../utils/generateJWT");
const { getCommitFiles } = require("../utils/getCommitFiles");
const { getInstallationToken } = require("../utils/getInstallationToken");
const { duplicateDetector } = require("../services/duplicateDetector");
const { postCommitComment } = require("../utils/postCommitMessages");

async function pushEvent(req, res) {

    try {

        const commit = req.body.head_commit;

        if (!commit) {
            return res.sendStatus(200);
        }

        const commitMessage = commit.message;
        const sha = commit.id;

        const owner = req.body.repository.owner.login;
        const repo = req.body.repository.name;
        const installationId = req.body.installation.id;

        const jwt = generateGitHubJWT(
            process.env.GITHUB_APP_ID,
            process.env.GITHUB_PRIVATE_KEY
        );

        const token = await getInstallationToken(jwt, installationId);

        const files = await getCommitFiles(owner, repo, sha, token);

        // Convert files to AI-friendly text
        let filesCode = "";

        for (const file of files) {

            if (!file.code) continue;

            filesCode += `
               File: ${file.filename}
                    ${file.code}
                `;
        }

        let allInformation = `Files code=${filesCode} and Commit Message: ${commitMessage}`;

        const responseMessage = await duplicateDetector({
            allInformation
        });

        await postCommitComment(owner, repo, sha, `🕵️ DecisionGridOps FeedBack:\n\n${responseMessage}`, token);

        res.sendStatus(200);

    } catch (error) {

        console.error("Push Event Error:", error);
        res.sendStatus(500);

    }
}

module.exports = pushEvent;