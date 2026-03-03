const mongoose = require("mongoose");

const snapshotSchema = new mongoose.Schema({
    problem: {
        type: String,
        required: true,
    },
    shortcut: {
        type: String,
        required: true,
    },
    impact: {
        type: String,
        required: true,
    },
    revertReason: {
        type: String,
        required: true,
    },
    earlierProblem: {
        type: String,
    },
    newPlan: {
        type: String,
    },
    summary: {
        type: String,
        required: true,
    },
    prNumber: {
        type: Number,
        required: true,
    },
    installationId: {
        type: Number,
        required: true,
    },
    repositoryName: {
        type: String,
        required: true,
    },
    repositoryOwner: {
        type: String,
        required: true,
    },

});

module.exports = mongoose.model("Snapshot", snapshotSchema);