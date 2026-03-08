const { updateCheckRun } = require("./commitCheckRun");

async function issueCommentEvent(req, res,checkRunId) {

    const comment = req.body.comment.body;
    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const installationId = req.body.installation.id;

    if (!comment) return res.sendStatus(200);

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
            "✔ DecisionGridOps Review Completed"
        );
    }

    res.sendStatus(200);
}

module.exports = {
    issueCommentEvent
};