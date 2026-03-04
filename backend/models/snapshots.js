const mongoose = require("mongoose");

const snapshotSchema = new mongoose.Schema({
    problem: {
        type: String
    },
    shortcut: {
        type: String
    },
    impact: {
        type: String
    },
    revertReason: {
        type: String
    },
    earlierProblem: {
        type: String
    },
    newPlan: {
        type: String
    },
    prNumber: {
        type: Number,
        required: true
    },
    installationId: {
        type: Number,
        required: true
    },
    repositoryName: {
        type: String,
        required: true
    },
    repositoryOwner: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model("Snapshot", snapshotSchema);