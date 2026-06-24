const mongoose = require('mongoose');

// Global, app-wide configuration stored as a single document.
const configSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    ballValues: {
      red: { type: Number, default: 1 },
      yellow: { type: Number, default: 2 },
      green: { type: Number, default: 3 },
      brown: { type: Number, default: 4 },
      blue: { type: Number, default: 5 },
      pink: { type: Number, default: 6 },
      black: { type: Number, default: 7 },
    },
  },
  { timestamps: true }
);

// Fetch the singleton, creating it with defaults on first access.
configSchema.statics.getSingleton = async function () {
  let cfg = await this.findOne({ key: 'global' });
  if (!cfg) cfg = await this.create({ key: 'global' });
  return cfg;
};

module.exports = mongoose.model('Config', configSchema);
