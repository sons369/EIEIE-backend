var express = require('express');
var router = express.Router();
const db = require('../models/db');
const islogined = require('../models/logincheck');
const request = require('request');
const multer = require('multer');
const path = require('path');

async function callbackLatLon(fromLat, fromLon, toLat, toLon, num) {
  const url =
    'https://apis.openapi.sk.com/tmap/pois/search/around?version=1&format=json&callback=result';
  let queryParmas =
    '&' +
    encodeURIComponent('categories') +
    '=' +
    encodeURIComponent('초등학교');
  queryParmas +=
    '&' +
    encodeURIComponent('appKey') +
    '=' +
    encodeURIComponent(`${process.env.TMAP_KEY}`);
  queryParmas +=
    '&' + encodeURIComponent('count') + '=' + encodeURIComponent('1');
  queryParmas +=
    '&' + encodeURIComponent('radius') + '=' + encodeURIComponent('1');

  const maps = {
    lon: [
      (fromLon * 1 + toLon * 5) / 6,
      (fromLon * 2 + toLon * 4) / 6,
      (fromLon * 3 + toLon * 3) / 6,
      (fromLon * 4 + toLon * 2) / 6,
      (fromLon * 5 + toLon * 1) / 6,
    ],
    lat: [
      (fromLat * 1 + toLat * 5) / 6,
      (fromLat * 2 + toLat * 4) / 6,
      (fromLat * 3 + toLat * 3) / 6,
      (fromLat * 4 + toLat * 2) / 6,
      (fromLat * 5 + toLat * 1) / 6,
    ],
  };

  let qp = queryParmas;
  qp +=
    '&' +
    encodeURIComponent('centerLon') +
    '=' +
    encodeURIComponent(`${parseFloat(maps.lon[num])}`);
  qp +=
    '&' +
    encodeURIComponent('centerLat') +
    '=' +
    encodeURIComponent(`${parseFloat(maps.lat[num])}`);

  return new Promise((resolve, reject) => {
    let resultJson = {};
    request(
      {
        url: url + qp,
        method: 'GET',
      },

      function (err, res, body) {
        if (!err && res.statusCode === 200) {
          resultJson = JSON.parse(body);
          resolve(resultJson);
        } else {
          console.log(err);
          resultJson['error'] = 'Some error';
          reject(resultJson);
        }
      }
    );
  });
}

router.get('users/poisearch', async (req, res) => {
  let coordinates = [{}];
  let passLists;
  for (let i = 0; i < 5; i++) {
    let tmp = await callbackLatLon(
      req.query.fromLat,
      req.query.fromLon,
      req.query.toLat,
      req.query.toLon,
      i
    );
    coordinates.push({
      lat: tmp.searchPoiInfo.pois.poi[0].frontLat,
      lon: tmp.searchPoiInfo.pois.poi[0].frontLon,
    });
  }
  console.log(coordinates);
  for (let i = 1; i < 6; i++) {
    if (Object.keys(coordinates[i]).length != 0) {
      passLists += coordinates[i].lon + ',' + coordinates[i].lat + '_';
    }
  }

  passLists = passLists.substring(9, passLists.length - 1);

  let options = {
    uri: 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version={version}&callback={callback}',
    method: 'POST',
    form: {
      startX: req.query.fromLon,
      startY: req.query.fromLat,
      angle: 20,
      speed: 30,
      endX: req.query.toLon,
      endY: req.query.toLat,
      searchOption: 4,
      appkey: process.env.TMAP_KEY,
      reqCoordType: 'WGS84GEO',
      startName: encodeURIComponent(`${req.query.startName}`),
      endName: encodeURIComponent(`${req.query.endName}`),
      passList: passLists,
    },
  };
  request.post(options, function (err, response, body) {
    let result = JSON.parse(body);
    res.status(200).send(result);
  });
});
