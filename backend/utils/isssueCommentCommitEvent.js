const info = require("../models/info");
const { updateCheckRun } = require("./commitCheckRun");
const { generateGitHubJWT } = require("./generateJWT");
const { getInstallationToken } = require("./getInstallationToken");

async function issueCommentEvent(req, res) {

    const comment = req.body.comment.body;
    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const installationId = req.body.installation.id;
    const sha = req.body.comment.commit_id;

    if (!comment || !comment.toLowerCase().includes("/reviewed")) {
        return res.sendStatus(200);
    }
    
    const Info = await info.findOne({
        repositoryName: repo,
        commitSha: sha
    });

    const checkRunId = Info?.checkRunId;

    if (!checkRunId) {
        console.log("No checkRunId found for commit:", sha);
        return res.sendStatus(200);
    }


    if (comment.toLowerCase().includes("/reviewed")) {

        const jwt = generateGitHubJWT(
            process.env.GITHUB_APP_ID,
            process.env.GITHUB_PRIVATE_KEY
        );

        const token = await getInstallationToken(jwt, installationId);

        await updateCheckRun(
            owner,
            repo,
            checkRunId,
            token,
            "This commit has been marked as reviewed by the user."
        );

    }

    return res.sendStatus(200);
}

module.exports = {
    issueCommentEvent
};