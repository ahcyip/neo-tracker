const Promise = require('bluebird');
const express = require('express');
const router  = express.Router();
const sqlite = require('../lib/db').sqlite;
const stringify = Promise.promisify( require('csv-stringify') );

router.get('/:symbol',
  async (req, res, next) => {
    try {
      const priceRow = await sqlite().get(
        'SELECT price FROM current_price JOIN stock USING (stock_id) WHERE symbol = ?',
        req.params.symbol
      );
      if ( typeof(priceRow) === 'undefined' ) {
        return res.sendStatus(404);
      }
      const query =
        'SELECT avg(price) AS avg FROM' +
        ' (SELECT price FROM daily_price JOIN stock USING (stock_id)' +
        ' WHERE symbol = ? AND date >= date(?,?) )';
      const [maxmin,day50ma,day200ma] = await Promise.all([
        sqlite().get(
          'SELECT MAX(price) AS max, MIN(price) AS min' +
          ' FROM daily_price JOIN stock USING (stock_id)' +
          ' WHERE symbol = ? AND date > date(?,?)',
          req.params.symbol,
          'now',
          '-1 year'
        ),
        sqlite().get(query, req.params.symbol, 'now', '-50 days'),
        sqlite().get(query, req.params.symbol, 'now', '-200 days')
      ]);
      const parsed50day  = Number.parseFloat(day50ma.avg).toFixed(2);
      const parsed200day = Number.parseFloat(day200ma.avg).toFixed(2);
      res.type('csv');
      stringify([[maxmin.min, maxmin.max, parsed50day, parsed200day, priceRow.price]])
      .then(output => res.send(output));
    }
    catch (err) {
      next(err);
    }
  }
);

module.exports = router;
