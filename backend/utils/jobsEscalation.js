const Info = require("../models/info");
const Ownership = require("../models/ownership");
const postComment = require("../utils/postComment");
const { generateGitHubJWT } = require("../utils/generateJWT");
const { getInstallationToken } = require("../utils/getInstallationToken");

async function checkReviewerEscalation() {

    const now = new Date();

    const prs = await Info.find({
        firstNotifiedAt: { $exists: true }
    });

    for (const pr of prs) {

        const review = await Ownership.findOne({
            installationId: pr.installationId,
            repositoryName: pr.repositoryName,
            prNumber: pr.prNumber
        });

        // If already reviewed skip
        if (review?.reviewedBy?.length) continue;

        const hoursPassed =
            (now - new Date(pr.firstNotifiedAt)) / (1000 * 60 * 60);

        const jwt = generateGitHubJWT(
            process.env.GITHUB_APP_ID,
            process.env.GITHUB_PRIVATE_KEY
        );

        const token = await getInstallationToken(jwt, pr.installationId);

        // -------- TEAM LOGIC --------
        if (pr.SuggestedTeam) {

            if (hoursPassed > 24 && !pr.ownerNotified) {

                await postComment(
                    token,
                    pr.repositoryOwner,
                    pr.repositoryName,
                    pr.prNumber,
                    `🚨 Team ${pr.SuggestedTeam} did not review within 24 hours. Notifying repo owner @${pr.repositoryOwner}`
                );

                pr.ownerNotified = true;
                await pr.save();
            }

            continue;
        }

        // -------- DEVELOPER LOGIC --------

        if (hoursPassed > 24 && !pr.secondNotifiedAt) {

            const secondDev = pr.SuggestedDevelopers?.[1];

            if (secondDev) {

                await postComment(
                    token,
                    pr.repositoryOwner,
                    pr.repositoryName,
                    pr.prNumber,
                    `⏰ No review in 24 hours. Tagging second reviewer @${secondDev}`
                );

                pr.secondNotified = true;
                await pr.save();
            }
        }

        if (hoursPassed > 48 && !pr.ownerNotified) {

            await postComment(
                token,
                pr.repositoryOwner,
                pr.repositoryName,
                pr.prNumber,
                `🚨 No review after 48 hours. Notifying repo owner @${pr.repositoryOwner}`
            );

            pr.ownerNotified = true;
            await pr.save();
        }

    }

}

module.exports = checkReviewerEscalation;