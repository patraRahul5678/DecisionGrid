const Info = require("../models/info");
const Ownership = require("../models/ownership");
const postComment = require("./postComment");

async function checkReviewerEscalation(token, owner, repo) {

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

  // if already reviewed → skip
  if (review?.reviewedBy?.length) continue;

  const hoursPassed =
   (now - new Date(pr.firstNotifiedAt)) / (1000 * 60 * 60);

  // 24 hours → tag 2nd dev
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

  // 48 hours → notify owner
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