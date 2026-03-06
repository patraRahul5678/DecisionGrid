const mongoose = require("mongoose");

const ownershipSchema = new mongoose.Schema({
    mergedBy: {
        type: String,
    },
    reviewedBy:{
        type: String,
    },
    installationId:{
        type: Number,
    },
    repositoryName:{
        type: String,
    },
    prNumber:{
        type: Number,
    }
});

const Ownership = mongoose.model("Ownership", ownershipSchema);

module.exports = Ownership;