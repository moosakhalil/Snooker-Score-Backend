const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Player name is required'], trim: true },
    nickname: { type: String, trim: true, default: '' },
    profilePicture: { type: String, default: '' },
    contactNumber: { type: String, trim: true, default: '' },

    // Aggregated career statistics (updated when a match completes)
    stats: {
      matchesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      framesWon: { type: Number, default: 0 },
      totalScore: { type: Number, default: 0 },
      highestBreak: { type: Number, default: 0 },
      centuryCount: { type: Number, default: 0 },
      halfCenturyCount: { type: Number, default: 0 },
      missCount: { type: Number, default: 0 },
      foulCount: { type: Number, default: 0 },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Winning percentage virtual
playerSchema.virtual('stats.winningPercentage').get(function () {
  const played = this.stats.matchesPlayed;
  return played ? Math.round((this.stats.wins / played) * 1000) / 10 : 0;
});

playerSchema.virtual('stats.averageScore').get(function () {
  const played = this.stats.matchesPlayed;
  return played ? Math.round((this.stats.totalScore / played) * 10) / 10 : 0;
});

playerSchema.set('toJSON', { virtuals: true });
playerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Player', playerSchema);
