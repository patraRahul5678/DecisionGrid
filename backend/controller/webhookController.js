const express = require('express');
const router = express.Router();
const Info = require('../models/info');
const postComment = require('../utils/postComment');
const { generateGitHubJWT } = require('../utils/generateJWT');
const { getInstallationToken } = require('../utils/getInstallationToken');
const { createCheckRun, updateCheckRun } = require('../utils/CheckRun');
const { summarizeIntent } = require('../services/aiService');
const snapshot = require('../models/snapshots');
const { isOrganization } = require('../utils/organizationRepo');
const { getChangedFiles } = require('../utils/changedFiles');
const { getNumberOfCommits, getCommitsMessages } = require('../utils/commits');
const { allowed } = require('../utils/permisssions');
const { getTeams } = require('../utils/getTeamNames');
const info = require('../models/info');
const Ownership = require('../models/ownership');
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

            const intentMessage = `🚀 DecisionGridOps Active!

                    Before merging, please provide intent using:

                    /intent
                    1. What is the problem and why fix it now?
                    2. Did you take any shortcut?
                    3. What happens after this change, and what will you improve next?`;

            const reversedIntent = `🚀 DecisionGridOps Intent Required

                    This PR looks like a reversal.

                    Please explain:

                    /intent
                    1. Why are we reversing this previous change?
                    2. What problem did the earlier change cause?
                    3. What is the new plan going forward?`;

            await Info.findOneAndUpdate(
                { installationId, repositoryName: repo, prNumber },
                {
                    installationId,
                    repositoryName: repo,
                    repositoryOwner: owner,
                    prNumber,
                    checkRunId,
                    isRevert,
                },
                { upsert: true, new: true }
            );


            const message = isRevert ? reversedIntent : intentMessage;
            await postComment(token, owner, repo, prNumber, message);



            //NO CLEAR OWNERSHIP OF CODE AND SERVICES
            try {
                const organization = await isOrganization(token, owner, repo, prNumber);
                const ownerType = req.body.repository.owner.type;
                const repoOrganization = ownerType === "Organization";
                const changedFiles = await getChangedFiles(token, owner, repo, prNumber);
                const commitCounts = await getNumberOfCommits(token, owner, repo, prNumber);
                const allowedDevelopers = await allowed(token, owner, repo);
                const commitMessages = await getCommitsMessages(token, owner, repo, prNumber);

                let ownershipMessage = `Changed Files:
                        ${changedFiles.join("\n")}

                        Developer Commit Counts:
                        ${JSON.stringify(commitCounts, null, 2)}

                        Allowed Developers (can merge PR):
                        ${Object.keys(allowedDevelopers).join(", ")}

                        Recent Commit Messages:
                        ${JSON.stringify(commitMessages, null, 2)}
                        `;

                let teams = [];
                if (repoOrganization) {

                    teams = await getTeams(token, owner);

                    ownershipMessage += `
                        Teams Present in Organization:
                        ${JSON.stringify(teams, null, 2)}
                        `;
                }

                if (organization || repoOrganization) {
                    const response = await ownershipInsights(ownershipMessage);

                    await postComment(
                        token,
                        owner,
                        repo,
                        prNumber,
                        `🤖 **DecisionGrid Ownership Insights**:\n\n${response}`
                    );

                    if (repoOrganization) {
                        await info.findOneAndUpdate(
                            { installationId, repositoryName: repo, prNumber },
                            {
                                SuggestedTeam: extractTeamsFromInsights(response, teams) || " No specific team suggested",
                                SuggestedDevelopers: "No specific developer suggested as it's an organization repo"
                            },
                            { upsert: true }
                        );
                    } else {
                        await info.findOneAndUpdate(
                            { installationId, repositoryName: repo, prNumber },
                            {
                                SuggestedTeam: "No specific team suggested,it's not an organization repo",
                                SuggestedDevelopers: extractDevsFromInsights(response, Object.keys(allowedDevelopers)) || " No specific developer suggested",
                                firstNotifiedAt: new Date()
                            },
                            { upsert: true }
                        );
                    }

                }

            } catch (error) {

                console.error(
                    "Error occurred while checking organization:",
                    error.message
                );
            }

            return res.sendStatus(200);
        }

        // ISSUE COMMENT EVENT
        if (event === "issue_comment" && action === "created") {

            if (!req.body.issue.pull_request) {
                return res.sendStatus(200);
            }

            if (req.body.comment?.user?.type === "Bot") {
                return res.sendStatus(200);
            }

            const installationId = req.body.installation?.id;
            const prNumber = req.body.issue?.number;
            const owner = req.body.repository?.owner?.login;
            const repo = req.body.repository?.name;
            const commentText = req.body.comment?.body;
            const ownerType = req.body.repository.owner.type;
            const repoOrganization = ownerType === "Organization";
            const jwt = generateGitHubJWT(
                process.env.GITHUB_APP_ID,
                process.env.GITHUB_PRIVATE_KEY
            );
            const token = await getInstallationToken(jwt, installationId);

            if (!installationId || !prNumber || !owner || !repo || !commentText) {
                return res.status(400).send("Missing required comment data");
            }

            const trimmedText = commentText.trim();
            const lowerText = trimmedText.toLowerCase();

            if (!lowerText.startsWith("/intent") &&
                !lowerText.includes("/approve-risk") &&
                !lowerText.includes("/reject-risk") && !lowerText.startsWith("/accept") && !lowerText.startsWith("/decline")) {
                return res.sendStatus(200);
            }


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

            // Handle risk approval/rejection commands
            if (lowerText.startsWith("/approve-risk")) {
                await updateCheckRun(
                    token,
                    owner,
                    repo,
                    record.checkRunId,
                    "success",
                    "Risk acknowledged by developer."
                );
                await postComment(
                    token,
                    owner,
                    repo,
                    prNumber,
                    "✅ Risk accepted. Check passed."
                );
                return res.sendStatus(200);
            }

            if (lowerText.startsWith("/reject-risk")) {
                await updateCheckRun(
                    token,
                    owner,
                    repo,
                    record.checkRunId,
                    "failure",
                    "PR rejected due to high risk."
                );
                await postComment(
                    token,
                    owner,
                    repo,
                    prNumber,
                    "❌ PR blocked due to risk."
                );
                return res.sendStatus(200);
            }


            let suggestedAction = await info.findOne({
                installationId,
                repositoryName: repo,
                prNumber
            });

            let suggestedActionToBeTaken = '';

            if (repoOrganization) {
                suggestedActionToBeTaken += suggestedAction.SuggestedTeam || " No team suggested";
            } else {
                suggestedActionToBeTaken += suggestedAction.SuggestedDevelopers[0] || "No specific developer suggested";
            }

            if (lowerText.startsWith("/accept")) {
                await postComment(
                    token,
                    owner,
                    repo,
                    prNumber,
                    `✅ Tagging the developer for PR review @${suggestedActionToBeTaken}`
                );

                await updateCheckRun(
                    token,
                    owner,
                    repo,
                    record.checkRunId,
                    "success",
                    "Tagging accept by the developer."
                );

                return res.sendStatus(200);
            }

            if (lowerText.startsWith("/decline")) {
                await updateCheckRun(
                    token,
                    owner,
                    repo,
                    record.checkRunId,
                    "failure",
                    "Suggested ownership declined by the developer. No tagging will be done."
                );

                await postComment(
                    token,
                    owner,
                    repo,
                    prNumber,
                    "Tag the Reviewer you want to review this PR @mention"
                );

                await updateCheckRun(
                    token,
                    owner,
                    repo,
                    record.checkRunId,
                    "success",
                    "Tagging is done by the developer by its own."
                );
                return res.sendStatus(200);
            }

            // validation
            let isValid = false;

            const has1 = /(^|\n)\s*1\./.test(trimmedText);
            const has2 = /(^|\n)\s*2\./.test(trimmedText);
            const has3 = /(^|\n)\s*3\./.test(trimmedText);
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

            await Info.findOneAndUpdate(
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
                }, { new: true }
            );


            // AI Summary
            try {
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


                await postComment(token, owner, repo, prNumber, `🤖 DecisionGrid Summary and Insights:\n\n${insights}`);

                const insightsText = insights.toLowerCase();
                const riskyKeywords = ["delete", "drop", "migration", "auth", "security"];
                const isRisky =
                    insightsText.includes("high") ||
                    insightsText.includes("risk") ||
                    riskyKeywords.some(keyword => insightsText.includes(keyword));

                if (isRisky) {
                    await updateCheckRun(
                        token,
                        owner,
                        repo,
                        record.checkRunId,
                        "failure",
                        "High risk change detected. Awaiting developer confirmation."
                    );

                    await postComment(
                        token,
                        owner,
                        repo,
                        prNumber,
                        `⚠️ **DecisionGridOps Risk Warning**

                            This pull request appears **HIGH RISK**.

                            Think carefully before merging.

                            Reply with:

                            /approve-risk → Accept risk and allow merge  
                            /reject-risk → Block this PR`
                    );


                } else {
                    await updateCheckRun(
                        token,
                        owner,
                        repo,
                        record.checkRunId,
                        "success",
                        "Intent verified and summarized successfully."
                    );
                }


            } catch (aiError) {
                console.error("AI Summary failed:", aiError.message);
                await updateCheckRun(
                    token,
                    owner,
                    repo,
                    record.checkRunId,
                    "failure",
                    "Failed to generate summary. Please try again."
                );
                await postComment(
                    token,
                    owner,
                    repo,
                    prNumber,
                    "❌ Failed to generate AI summary. Please try /intent again."
                );
            }

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

            if (repoOrganization || await isOrganization(token, owner, repo)) {
                await Ownership.findOneAndUpdate(
                    { installationId, repositoryName: repo, prNumber },
                    {
                        mergedBy: req.body.pull_request.merged_by.login || "",
                    }, { upsert: true }
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

        return res.sendStatus(200);

    } catch (error) {
        console.error(error.response?.data || error.message);
        return res.sendStatus(500);
    }
});

module.exports = router;