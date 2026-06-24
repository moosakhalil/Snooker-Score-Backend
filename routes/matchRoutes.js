const express = require('express');
const router = express.Router();
const {
  createMatch,
  getMatches,
  getMatch,
  startMatch,
  scoreAction,
  editScore,
  endMatch,
  deleteMatch,
} = require('../controllers/matchController');

router.route('/').get(getMatches).post(createMatch);
router.route('/:id').get(getMatch).delete(deleteMatch);

router.post('/:id/start', startMatch);
router.post('/:id/action', scoreAction);
router.put('/:id/edit-score', editScore);
router.put('/:id/end', endMatch);

module.exports = router;
