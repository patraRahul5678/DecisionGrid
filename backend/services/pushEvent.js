const { generateGitHubJWT } = require("../utils/generateJWT");
const { getCommitFiles } = require("../utils/getCommitFiles");
const { getInstallationToken } = require("../utils/getInstallationToken");
const { duplicateDetector } = require("../services/duplicateDetector");
const { postCommitComment } = require("../utils/postCommitMessages");
const { createCheckRun, updateCheckRun } = require("../utils/commitCheckRun");
const { issueCommentEvent } = require("../utils/isssueCommentCommitEvent");
const info = require("../models/info");

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

        const checkRunId = await createCheckRun(owner, repo, sha, token);

        await info.findOneAndUpdate(
            {
                installationId,
                repositoryName: repo,
                commitSha: sha,
                repositoryOwner: owner
            },
            {
                installationId,
                repositoryName: repo,
                commitSha: sha,
                checkRunId,
                repositoryOwner: owner
            },
            { upsert: true }
        );

        const files = await getCommitFiles(owner, repo, sha, token);
        let filesCode = "";

        for (const file of files) {

            if (!file.code) continue;

            //Skip unnecessary files
            if (
                file.filename.includes("node_modules") ||
                file.filename.includes("dist") ||
                file.filename.endsWith(".json") ||
                file.filename.endsWith(".lock")
            ) continue;

            // Limit file size to prevent huge AI prompts
            if (file.code.length > 6000) continue;


            filesCode += `
               File: ${file.filename}
                    ${file.code}
                `;
        }

        const responseMessage = await duplicateDetector({
            filesCode,
            commitMessage
        });

        await postCommitComment(
            owner,
            repo,
            sha,
            `🕵️ **DecisionGridOps Feedback**

            ${responseMessage}

                  ---

           💡 **Next Step**

                After fixing the issues, comment:

                \`/reviewed\`

               to mark this commit as reviewed.`,
            token
        );

        res.status(200);


    } catch (error) {

        console.error("Push Event Error:", error);
        res.sendStatus(500);

    }
}

module.exports = pushEvent;