const express = require('express');
const bombbellRouter = require('./bombbell');

const router = express.Router();

// SKJmod関連のルート
router.use('/skjmod', bombbellRouter);

module.exports = router;