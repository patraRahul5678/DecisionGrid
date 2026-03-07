const express = require('express');
const router = express.Router();
const Info = require('../models/info');
const { generateGitHubJWT } = require('../utils/generateJWT');
const { getInstallationToken } = require('../utils/getInstallationToken');
const snapshot = require('../models/snapshots');
const { isOrganization } = require('../utils/organizationRepo');
const Ownership = require('../models/ownership');
const prOpenedEvent = require('../services/prOpenedEvent');
const issueComment = require('../services/issueCommentEvent');
const postComment = require('../utils/postComment');
const { createCheckRun, updateCheckRun } = require('../utils/CheckRun');
const { summarizeIntent } = require('../services/aiService');
const { getChangedFiles } = require('../utils/changedFiles');
const { getNumberOfCommits, getCommitsMessages } = require('../utils/commits');
const { allowed } = require('../utils/permisssions');
const { getTeams } = require('../utils/getTeamNames');
const { ownershipInsights } = require('../services/aiService');
const { extractTeamsFromInsights, extractDevsFromInsights } = require('../utils/extract');



router.post("/webhook", async (req, res) => {

    try {

        const event = req.headers['x-github-event'];
        const action = req.body.action;

        // INSTALLATION EVENT
        if (event === "installation") {
            return res.sendStatus(200);

        }

        // PR OPENED EVENT
        if (
            event === "pull_request" &&
            (action === "opened" || action === "synchronize")
        ) {
            return await prOpenedEvent(req, res);
        }

        // ISSUE COMMENT EVENT
        if (event === "issue_comment" && action === "created") {
            return await issueComment(req, res);
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
            const ownerType = req.body.repository.owner.type;
            const repoOrganization = ownerType === "Organization";

            const jwt = generateGitHubJWT(
                process.env.GITHUB_APP_ID,
                process.env.GITHUB_PRIVATE_KEY
            );

            const token = await getInstallationToken(jwt, installationId);

            const information = await Info.findOne({
                installationId,
                repositoryName: repo,
                prNumber
            });


            if (information) {
                await snapshot.create({
                    problem: information.problem || "",
                    shortcut: information.shortcut || "",
                    impact: information.impact || "",
                    revertReason: information.revertReason || "",
                    earlierProblem: information.earlierProblem || "",
                    newPlan: information.newPlan || "",
                    prNumber,
                    installationId,
                    repositoryName: repo,
                    repositoryOwner: owner
                });
            }

            if (information) {


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

            if (repoOrganization || await isOrganization(token, owner, repo)) {
                await Ownership.findOneAndUpdate(
                    { installationId, repositoryName: repo, prNumber },
                    {
                        mergedBy: req.body.pull_request.merged_by?.login || ""
                    }, { upsert: true }
                );
            }

            const ownership = await Ownership.findOne({
                installationId,
                repositoryName: repo,
                prNumber
            });

            const reviewedBy = ownership?.reviewedBy || [];
            const mergedBy = ownership?.mergedBy || "Unknown";
            const reviewedText = reviewedBy.length
                ? reviewedBy.map(dev => `@${dev}`).join(", ")
                : "No reviewer";
            const mergedText = mergedBy ? `@${mergedBy}` : "Unknown";

            await postComment(
                token,
                owner,
                repo,
                prNumber,
                `
                        🤖 **DecisionGrid Ownership Summary**

                        Reviewed By:
                        ${reviewedText}

                        Merged By:
                        ${mergedText}
                `
            );

            if (information?.checkRunId) {
                await updateCheckRun(
                    token,
                    owner,
                    repo,
                    information.checkRunId,
                    "success",
                    "Ownership summary posted in comments"
                );
            }
        }

        if (
            event === "pull_request_review" &&
            action === "submitted"
        ) {

            const installationId = req.body.installation?.id;
            const prNumber = req.body.pull_request.number;
            const repo = req.body.repository?.name;
            const reviewer = req.body.review?.user?.login;
            const state = req.body.review?.state;

            if (state === "approved") {
                await Ownership.findOneAndUpdate(
                    { installationId, repositoryName: repo, prNumber },
                    {
                        $setOnInsert: {
                            installationId,
                            repositoryName: repo,
                            prNumber
                        },
                        $addToSet: {
                            reviewedBy: reviewer
                        }
                    },
                    { upsert: true }
                );
            }
        }

        return res.sendStatus(200);

    } catch (error) {
        console.error(error.response?.data || error.message);
        return res.sendStatus(500);
    }
});

module.exports = router;