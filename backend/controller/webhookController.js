const express = require('express');
const router = express.Router();
const Info = require('../models/info');
const postComment = require('../utils/postComment');
const { generateGitHubJWT } = require('../utils/generateJWT');
const { getInstallationToken } = require('../utils/getInstallationToken');
const { createCheckRun, updateCheckRun } = require('../utils/CheckRun');
const { summarizeIntent } = require('../services/aiService');
const snapshot = require('../models/snapshots');

router.post("/webhook", async (req, res) => {

    try {

        const event = req.headers['x-github-event'];
        const action = req.body.action;

        // INSTALLATION EVENT
        if (event === "installation") {
            const installationId = req.body.installation?.id;

            if (!installationId) {
                return res.status(400).send("Missing installation ID");
            }

            await Info.create({
                installationId
            });

            console.log(`Installation stored: ${installationId}`);
            return res.sendStatus(200);
        }

        // PR OPENED EVENT
        if (
            event === "pull_request" &&
            (action === "opened" || action === "synchronize")
        ) {
            const installationId = req.body.installation?.id;
            const prNumber = req.body.pull_request?.number;
            const owner = req.body.repository?.owner?.login;
            const repo = req.body.repository?.name;
            const headSha = req.body.pull_request?.head?.sha;
            const title = req.body.pull_request?.title;

            if (!installationId || !prNumber || !owner || !repo || !headSha || !title) {
                return res.status(400).send("Missing required PR data");
            }

            const isRevert = title.toLowerCase().includes("revert") ||
                title.toLowerCase().includes("rollback") ||
                title.toLowerCase().includes("undo") ||
                title.toLowerCase().includes("remove");

            const jwt = generateGitHubJWT(
                process.env.GITHUB_APP_ID,
                process.env.GITHUB_PRIVATE_KEY
            );

            const token = await getInstallationToken(jwt, installationId);

            const checkRunId = await createCheckRun(
                token,
                owner,
                repo,
                "failure",
                headSha,
                "Intent required. Please provide complete intent using /intent command."
            );

            const intentMessage = `🚀 DevHub Active!

Before merging, please provide intent using:

/intent
1. What is the problem and why fix it now?
2. Did you take any shortcut?
3. What happens after this change, and what will you improve next?`;

            const reversedIntent = `🚀 DevHub Intent Required

This PR looks like a reversal.

Please explain:

/intent
1. Why are we reversing this previous change?
2. What problem did the earlier change cause?
3. What is the new plan going forward?`;

            await Info.create({
                installationId,
                repositoryName: repo,
                repositoryOwner: owner,
                prNumber,
                checkRunId,
                isRevert,
            });


            const message = isRevert ? reversedIntent : intentMessage;
            await postComment(token, owner, repo, prNumber, message);

            return res.sendStatus(200);
        }

        // ISSUE COMMENT EVENT
        if (event === "issue_comment" && action === "created") {
            if (req.body.comment?.user?.type === "Bot") {
                return res.sendStatus(200);
            }

            const installationId = req.body.installation?.id;
            const prNumber = req.body.issue?.number;
            const owner = req.body.repository?.owner?.login;
            const repo = req.body.repository?.name;
            const commentText = req.body.comment?.body;

            if (!installationId || !prNumber || !owner || !repo || !commentText) {
                return res.status(400).send("Missing required comment data");
            }

            if (!commentText.startsWith("/intent")) {
                return res.sendStatus(200);
            }

            const jwt = generateGitHubJWT(
                process.env.GITHUB_APP_ID,
                process.env.GITHUB_PRIVATE_KEY
            );

            const token = await getInstallationToken(jwt, installationId);

            const record = await Info.findOne({
                installationId,
                repositoryName: repo,
                prNumber
            });

            if (!record) {
                await postComment(
                    token,
                    owner,
                    repo,
                    prNumber,
                    "❌ No active PR record found. Please reopen the PR."
                );
                return res.sendStatus(200);
            }

            // validation
            let isValid = false;
            const lowerText = commentText.toLowerCase();

            const has1 = lowerText.includes("1.");
            const has2 = lowerText.includes("2.");
            const has3 = lowerText.includes("3.");
            const hasNumbers = has1 && has2 && has3;

            if (record.isRevert === true) {

                const hasRevertTerms =
                    lowerText.includes("revers") || lowerText.includes("why");

                const hasProblemTerms =
                    lowerText.includes("problem") || lowerText.includes("cause");

                const hasPlanTerms =
                    lowerText.includes("plan") || lowerText.includes("forward");

                if (hasNumbers && hasRevertTerms && hasProblemTerms && hasPlanTerms) {
                    isValid = true;
                }

            } else {

                const hasProblemTerms =
                    lowerText.includes("problem") || lowerText.includes("why");

                const hasShortcutTerms =
                    lowerText.includes("shortcut") || lowerText.includes("trade");

                const hasImpactTerms =
                    lowerText.includes("improve") ||
                    lowerText.includes("next") ||
                    lowerText.includes("happen");

                if (hasNumbers && hasProblemTerms && hasShortcutTerms && hasImpactTerms) {
                    isValid = true;
                }
            }

            if (!isValid) {

                let failureMessage = "";

                if (record.isRevert === true) {
                    failureMessage = "Please answer all 3 reversal questions with proper numbering (1., 2., 3.)";
                } else {
                    failureMessage = "Please answer all 3 intent questions with proper numbering (1., 2., 3.)";
                }

                await updateCheckRun(
                    token,
                    owner,
                    repo,
                    record.checkRunId,
                    "failure",
                    failureMessage
                );

                await postComment(
                    token,
                    owner,
                    repo,
                    prNumber,
                    `❌ ${failureMessage}`
                );

                return res.sendStatus(200);
            }

            let informationToUpdate = await Info.findOneAndUpdate(
                { installationId, repositoryName: repo, prNumber },
                {
                    problem: !record.isRevert
                        ? commentText.split("1.")[1]?.split("2.")[0]?.trim()
                        : null,

                    shortcut: !record.isRevert
                        ? commentText.split("2.")[1]?.split("3.")[0]?.trim()
                        : null,

                    impact: !record.isRevert
                        ? commentText.split("3.")[1]?.trim()
                        : null,

                    revertReason: record.isRevert
                        ? commentText.split("1.")[1]?.split("2.")[0]?.trim()
                        : null,

                    earlierProblem: record.isRevert
                        ? commentText.split("2.")[1]?.split("3.")[0]?.trim()
                        : null,

                    newPlan: record.isRevert
                        ? commentText.split("3.")[1]?.trim()
                        : null
                }
            );


            // AI Summary

            const pastInsights = await snapshot.find({
                installationId,
                repositoryName: repo,
                repositoryOwner: owner
            }).sort({ createdAt: -1 }).limit(5);

            let formattedPast = pastInsights.map((p, index) => {
                return `
Decision ${index + 1}:
Problem: ${p.problem || ""}
Shortcut: ${p.shortcut || ""}
Impact: ${p.impact || ""}
Revert Reason: ${p.revertReason || ""}
Earlier Problem: ${p.earlierProblem || ""}
New Plan: ${p.newPlan || ""}
`;
            }).join("\n");

            //summary of current intent    
            const summary = await summarizeIntent(commentText);

            //summary of the pattern and insights by comparing with past decisions
            const insights = await summarizeIntent(`
Past Decisions:
${formattedPast}

Current Decision:
${commentText}

Compare:
- Is this repeating something?
- Is it conflicting?
- Any pattern?
`);

            await postComment(
                token,
                owner,
                repo,
                prNumber,
                `🤖 DecisionGrid Summary:\n\n${summary}`
            );

            await postComment(token, owner, repo, prNumber, `🤖 DecisionGrid Summary:\n\n${insights}`)

            await updateCheckRun(
                token,
                owner,
                repo,
                record.checkRunId,
                "success",
                "Intent verified and summarized successfully."
            );

            return res.sendStatus(200);
        }

        if (
            event === "pull_request" &&
            action === "closed" &&
            req.body.pull_request.merged === true
        ) {
            const installationId = req.body.installation?.id;
            const prNumber = req.body.pull_request?.number;
            const owner = req.body.repository?.owner?.login;
            const repo = req.body.repository?.name;

            const information = await Info.findOne({
                installationId,
                repo,
                prNumber
            });


            if (information) {
                await snapshot.create({
                    problem: information.problem,
                    shortcut: information.shortcut,
                    impact: information.impact,
                    revertReason: information.revertReason,
                    earlierProblem: information.earlierProblem,
                    newPlan: information.newPlan,
                    prNumber,
                    installationId,
                    repositoryName: repo,
                    repositoryOwner: owner
                })
            }

            await Info.updateOne(
                { installationId, repositoryName: repo, prNumber },
                {
                    $unset: {
                        problem: "",
                        shortcut: "",
                        impact: "",
                        revertReason: "",
                        earlierProblem: "",
                        newPlan: ""
                    }
                }
            )
        }

        return res.sendStatus(200);


    } catch (error) {
        console.error(error.response?.data || error.message);
        return res.sendStatus(500);
    }
});

module.exports = router;