const express = require('express');
const router = express.Router();
const { matchReport } = require('../controllers/reportController');

router.get('/match/:id', matchReport);

module.exports = router;
