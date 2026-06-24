const asyncHandler = require('express-async-handler');
const Config = require('../models/Config');

const BALL_NAMES = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];

// @route GET /api/config
const getConfig = asyncHandler(async (req, res) => {
  const cfg = await Config.getSingleton();
  res.json(cfg);
});

// @route PUT /api/config
const updateConfig = asyncHandler(async (req, res) => {
  const cfg = await Config.getSingleton();
  const { ballValues } = req.body;

  if (ballValues) {
    BALL_NAMES.forEach((name) => {
      const v = Number(ballValues[name]);
      if (Number.isFinite(v) && v >= 0) cfg.ballValues[name] = v;
    });
  }

  await cfg.save();
  res.json(cfg);
});

module.exports = { getConfig, updateConfig };
