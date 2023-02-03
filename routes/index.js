const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.locals.title = 'Node Chat';
  res.render('index');
});

module.exports = router;
