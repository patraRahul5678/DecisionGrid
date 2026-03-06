const cron = require("node-cron");
const checkReviewerEscalation = require("./jobsEscalation");

cron.schedule("0 * * * *", async () => {
 console.log("Running reviewer escalation job...");
 await checkReviewerEscalation();
});