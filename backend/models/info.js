const mongoose = require("mongoose");

const infoSchema = new mongoose.Schema(
    {
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
        checkRunId: {
            type: Number,
            required: true,
        },
        isRevert: {
            type: Boolean,
            required: true,
        },
        problem:{
            type: String,
        },
        shortcut:{
            type: String,
        },
        impact:{
            type: String,
        },
        revertReason:{
            type: String,
        },
        earlierProblem:{
            type: String,
        },
        newPlan:{
            type: String,
        },
        SuggestedTeam:[
            {
                type: String,
            }
        ],
        SuggestedDevelopers:[
            {
                type: String,
            }
        ],
        firstNotifiedAt:{
            type: Date,
            default: null
        },
        secondNotifiedAt:{
            type: Date,
            default: null
        },
        ownerNotified:{
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

infoSchema.index(
    { installationId: 1, repositoryName: 1, prNumber: 1 },
    { unique: true }
);

module.exports = mongoose.model("Info", infoSchema);
