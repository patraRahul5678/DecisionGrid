const Info = require('../models/info');
const postComment = require('../utils/postComment');
const { generateGitHubJWT } = require('../utils/generateJWT');
const { getInstallationToken } = require('../utils/getInstallationToken');
const { createCheckRun } = require('../utils/CheckRun');
const { isOrganization } = require('../utils/organizationRepo');
const { getChangedFiles } = require('../utils/changedFiles');
const { getNumberOfCommits, getCommitsMessages } = require('../utils/commits');
const { allowed } = require('../utils/permisssions');
const { getTeams } = require('../utils/getTeamNames');
const { ownershipInsights } = require('../services/aiService');
const { extractTeamsFromInsights, extractDevsFromInsights } = require('../utils/extract');

async function prOpenedEvent(req, res) {

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
                    3. What happens after this change, and what will you improve next?
                    
                      
                    
                    Example answer:
                       1. Added a new feature to improve login performance.
                       2. No shortcuts were taken.
                       3. After this change the login process becomes faster, next we will optimize caching.
                    
                       Quick template (copy and edit):
                       
                                /intent
                                1.
                                2.
                                3.
                    `;

    const reversedIntent = `🚀 DecisionGridOps Intent Required

                            This PR looks like a reversal.

                            Please explain using:

                            /intent
                            1. Why are we reversing this previous change?
                            2. What problem did the earlier change cause?
                            3. What is the new plan going forward?

                            Example:

                            /intent
                            1. Reverting the caching change because it caused inconsistent API responses.
                            2. The earlier change introduced stale data issues in production.
                            3. We will revert this fix now and reintroduce caching later with proper invalidation.

                            Quick template (copy and edit):

                            /intent
                            1.
                            2.
                            3.
                            `;

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
                `🤖 **DecisionGridOps Ownership Insights**:\n\n${response}`
            );

            if (repoOrganization) {
                await Info.findOneAndUpdate(
                    { installationId, repositoryName: repo, prNumber },
                    {
                        SuggestedTeam: extractTeamsFromInsights(response, teams) || "",
                        SuggestedDevelopers: ["No developer suggested as it is a organization  repo"],

                    },
                    { upsert: true }
                );
            } else {
                await Info.findOneAndUpdate(
                    { installationId, repositoryName: repo, prNumber },
                    {
                        SuggestedTeam: ["No team suggested as its not an organization repo"],
                        SuggestedDevelopers: extractDevsFromInsights(response, Object.keys(allowedDevelopers)) || ["No specific developer suggested"]
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

module.exports = prOpenedEvent;