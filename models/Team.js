const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Team name is required'], trim: true },
    logo: { type: String, default: '' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],

    stats: {
      totalMatches: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      totalTeamScore: { type: Number, default: 0 },
      highestTeamBreak: { type: Number, default: 0 },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

teamSchema.virtual('stats.winningPercentage').get(function () {
  const total = this.stats.totalMatches;
  return total ? Math.round((this.stats.wins / total) * 1000) / 10 : 0;
});

teamSchema.virtual('stats.averageScore').get(function () {
  const total = this.stats.totalMatches;
  return total ? Math.round((this.stats.totalTeamScore / total) * 10) / 10 : 0;
});

teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Team', teamSchema);
