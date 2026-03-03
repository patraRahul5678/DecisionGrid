const installationSchema = new mongoose.Schema({
  installationId: {
    type: Number,
    required: true,
    unique: true
  }
});

module.exports = mongoose.model("Installation", installationSchema);