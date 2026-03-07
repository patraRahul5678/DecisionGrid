const Info = require('../models/info');
const postComment = require('../utils/postComment');
const { generateGitHubJWT } = require('../utils/generateJWT');
const { getInstallationToken } = require('../utils/getInstallationToken');
const { updateCheckRun } = require('../utils/CheckRun');
const { summarizeIntent } = require('../services/aiService');
const snapshot = require('../models/snapshots');
const info = require('../models/info');


async function issueComment(req, res) {


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

    if (!suggestedAction) {
        await postComment(token, owner, repo, prNumber, "No reviewer suggestion found.");
        return res.sendStatus(200);
    }

    let suggestedActionToBeTaken = '';

    if (repoOrganization) {
        suggestedActionToBeTaken += suggestedAction.SuggestedTeam?.[0] || "No team suggested";
    } else {
        suggestedActionToBeTaken += suggestedAction.SuggestedDevelopers?.[0] || "No specific developer suggested";
    }

    if (!suggestedActionToBeTaken) {
        await postComment(token, owner, repo, prNumber, "No reviewer suggestion found.");
        return res.sendStatus(200);
    }

    const reviewerTag = suggestedActionToBeTaken.startsWith("@")
        ? suggestedActionToBeTaken
        : `@${suggestedActionToBeTaken}`;

    if (lowerText.startsWith("/accept")) {
        await postComment(
            token,
            owner,
            repo,
            prNumber,
            `✅ Tagging the developer for PR review ${reviewerTag}`
        );

        if (repoOrganization) {
            await info.findOneAndUpdate(
                { installationId, repositoryName: repo, prNumber },
                {
                    SuggestedTeam: [suggestedActionToBeTaken],
                    SuggestedDevelopers: [],
                    firstNotifiedAt: new Date()
                },
                { upsert: true }
            );

        } else {

            await info.findOneAndUpdate(
                { installationId, repositoryName: repo, prNumber },
                {
                    SuggestedTeam: [],
                    SuggestedDevelopers: [suggestedActionToBeTaken],
                    firstNotifiedAt: new Date()
                },
                { upsert: true }
            );
        }

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

    //IF USER DECLINE THE SUGGESTION
    const mentions = commentText.match(/@([a-zA-Z0-9-_]+)/g);
    let userSelectedReviewer = null;

    if (mentions && mentions.length > 0) {
        userSelectedReviewer = mentions[0].replace("@", "");
    }

    if (lowerText.startsWith("/decline")) {
        await postComment(
            token,
            owner,
            repo,
            prNumber,
            "Please tag the reviewer you want to review this PR using @mention."
        );

        if (repoOrganization) {
            await info.findOneAndUpdate(
                { installationId, repositoryName: repo, prNumber },
                {
                    SuggestedTeam: [userSelectedReviewer],
                    SuggestedDevelopers: ["No developer suggested as it is a organization  repo"],
                    firstNotifiedAt: new Date()
                },
                { upsert: true }
            );
        } else {
            await info.findOneAndUpdate(
                { installationId, repositoryName: repo, prNumber },
                {
                    SuggestedTeam: ["No team suggested as its not an organization repo"],
                    SuggestedDevelopers: [userSelectedReviewer],
                    firstNotifiedAt: new Date()
                },
                { upsert: true }
            );
        }

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
    // let isValid = false;

    // const has1 = /(^|\n)\s*1\./.test(trimmedText);
    // const has2 = /(^|\n)\s*2\./.test(trimmedText);
    // const has3 = /(^|\n)\s*3\./.test(trimmedText);
    // const hasNumbers = has1 && has2 && has3;

    // if (record.isRevert === true) {

    //     const hasRevertTerms =
    //         lowerText.includes("revers") || lowerText.includes("why");

    //     const hasProblemTerms =
    //         lowerText.includes("problem") || lowerText.includes("cause");

    //     const hasPlanTerms =
    //         lowerText.includes("plan") || lowerText.includes("forward");

    //     if (hasNumbers && hasRevertTerms && hasProblemTerms && hasPlanTerms) {
    //         isValid = true;
    //     }

    // } else {

    //     const hasProblemTerms =
    //         lowerText.includes("problem") || lowerText.includes("why");

    //     const hasShortcutTerms =
    //         lowerText.includes("shortcut") || lowerText.includes("trade");

    //     const hasImpactTerms =
    //         lowerText.includes("improve") ||
    //         lowerText.includes("next") ||
    //         lowerText.includes("happen");

    //     if (hasNumbers && hasProblemTerms && hasShortcutTerms && hasImpactTerms) {
    //         isValid = true;
    //     }
    // }

    // if (!isValid) {

    //     let failureMessage = "";

    //     if (record.isRevert === true) {
    //         failureMessage = "Please answer all 3 reversal questions with proper numbering (1., 2., 3.)";
    //     } else {
    //         failureMessage = "Please answer all 3 intent questions with proper numbering (1., 2., 3.)";
    //     }

    //     await updateCheckRun(
    //         token,
    //         owner,
    //         repo,
    //         record.checkRunId,
    //         "failure",
    //         failureMessage
    //     );

    //     await postComment(
    //         token,
    //         owner,
    //         repo,
    //         prNumber,
    //         `❌ ${failureMessage}`
    //     );

    //     return res.sendStatus(200);
    // }



    // validation
    let isValid = false;

    const has1 = /(^|\n)\s*1\./.test(trimmedText);
    const has2 = /(^|\n)\s*2\./.test(trimmedText);
    const has3 = /(^|\n)\s*3\./.test(trimmedText);

    const hasNumbers = has1 && has2 && has3;

    if (hasNumbers) {
        isValid = true;
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
            `❌ ${failureMessage}

Example:

/intent
1. What problem does this change solve?
2. Did you take any shortcut?
3. What happens after this change?

Example answer:

/intent
1. Added a new feature for login optimization.
2. No shortcuts were taken.
3. Next we will improve caching.

Quick template:

/intent
1.
2.
3.
`
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

module.exports = issueComment;