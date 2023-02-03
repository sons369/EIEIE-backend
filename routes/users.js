var express = require('express');
var router = express.Router();
const db = require('../models/db');
const islogined = require('../models/logincheck');
const request = require('request');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, done) {
      done(null, 'uploads/');
    },
    filename(req, file, done) {
      const ext = path.extname(file.originalname);
      done(null, path.basename(file.originalname, ext) + Date.now() + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/login', async (req, res) => {
  const [result] = await db.login(req.body.email, req.body.password);
  if (result && result.email) {
    req.session.islogined = true;
    req.session.email = result.email;
    res.cookie('email', result.email, { maxAge: 100000000 });
    res.status(200).send('login success');
  } else {
    res.status(401).send('login fail');
  }
});

router.post('/register', async (req, res) => {
  const [isMember] = await db.isMember(req.body.email);
  if (isMember) {
    res.status(401).send('register fail');
  } else {
    db.register(req.body.email, req.body.password);
    res.status(200).send('register success');
  }
});

router.get('/logout', islogined, (req, res) => {
  req.session.destroy(function () {
    req.session;
  });
  res.clearCookie('email');
  res.status(200).send('logout success');
});

router.post('/report', upload.single('image'), async (req, res) => {
  const user = req.cookies.email;
  const title = req.body.title;
  const content = req.body.content;
  const addr = req.body.address;
  const image = `/uploads/${req.file.image}`;
  if (user && title && content && addr) {
    db.report(user, title, addr, content, image);
    res.status(200).send('report success');
  } else {
    res.status(401).send('report fail');
  }
});

router.get('/reports', async (req, res) => {
  const user = req.cookies.email;
  const [...result] = await db.reports(user);
  console.log(user);
  if (result) {
    res.status(200).send(result);
  } else {
    res.status(401).send('reports fail or nothing');
  }
});

/**
 *
 * @param {Float} fromLat 출발지 위도
 * @param {Float} fromLon 출발지 경도
 * @param {Float} toLat 도착지 위도
 * @param {Float} toLon 도착지 경도
 * @param {Integer} num 반복 횟수
 */
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
          resultJson['error'] = 'Some error';
          reject(resultJson);
        }
      }
    );
  });
}

router.get('/poisearch', async (req, res) => {
  let coordinates = [{}];
  let passLists = '';
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
  let ori_x = req.query.fromLon - req.query.toLon;
  let ori_y = req.query.fromLat - req.query.toLat;
  let dis_u = Math.sqrt(ori_x * ori_x + ori_y * ori_y);
  let norm_x = ori_x / dis_u;
  let norm_y = ori_y / dis_u;
  let lonArr = [];
  let latArr = [];
  for (let i = 1; i < 6; i++) {
    if (Object.keys(coordinates[i]).length != 0) {
      let dif_x, dif_y;
      if (i == 1) {
        dif_x = req.query.fromLon - coordinates[i].lon;
        dif_y = req.query.fromLat - coordinates[i].lat;
      } else {
        dif_x = coordinates[i - 1].lon - coordinates[i].lon;
        dif_y = coordinates[i - 1].lat - coordinates[i].lon;
      }
      let dis_v = Math.sqrt(dif_x * dif_x + dif_y * dif_y);
      let norm_x2 = dif_x / dis_v;
      let norm_y2 = dif_y / dis_v;
      let theta = norm_x * norm_x2 + norm_y * norm_y2;
      theta = Math.acos(theta);
      let degree = theta * (180 / 3.141592);
      if (degree < 20) {
        lonArr.push(coordinates[i].lon);
        latArr.push(coordinates[i].lat);
      }
    }
  }
  const lonSet = new Set(lonArr);
  const latSet = new Set(latArr);
  lonArr = Array.from(lonSet);
  latArr = Array.from(latSet);

  for (let i = 0; i < lonArr.length; i++) {
    passLists += lonArr[i] + ',' + latArr[i] + '_';
  }
  passLists = passLists.substring(0, passLists.length - 1);
  let options = {
    uri: 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version={version}&callback={callback}',
    method: 'POST',
    form: {
      startX: req.query.fromLon,
      startY: req.query.fromLat,
      angle: 10,
      speed: 4,
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

router.get('/electric', async (req, res) => {
  let fg = await findgu(req.query.lat, req.query.lon);
  let signgu = fg.addressInfo.gu_gun;

  const url =
    'http://api.data.go.kr/openapi/tn_pubr_public_electr_whlchairhgh_spdchrgr_api';
  let queryParams =
    '?' + encodeURIComponent('serviceKey') + '=' + `${process.env.OPEN_KEY}`;
  queryParams +=
    '&' + encodeURIComponent('pageNo') + '=' + encodeURIComponent('0');
  queryParams +=
    '&' + encodeURIComponent('numOfRows') + '=' + encodeURIComponent('5');
  queryParams +=
    '&' + encodeURIComponent('type') + '=' + encodeURIComponent('json');
  queryParams +=
    '&' +
    encodeURIComponent('ctprvnNm') +
    '=' +
    encodeURIComponent('서울특별시');
  queryParams +=
    '&' +
    encodeURIComponent('signguNm') +
    '=' +
    encodeURIComponent(`${signgu}`);
  if (signgu == '동작구') {
    resultJson = {
      response: {
        body: {
          items: [
            {
              fcltyNm: '서울 시립 남부 장애인 종합복지관',
              rdnmadr: '서울특별시 동작구 신대방동 395번지 보라매공원 내',
              latitude: '37.490147',
              longitude: '126.916894',
            },
            {
              fcltyNm: '이수 자이',
              rdnmadr: '서울특별시 동작구 사당1동 148-16',
              latitude: '37.4845',
              longitude: '126.98',
            },
            {
              fcltyNm: '상도 1동 동사무소',
              rdnmadr: '서울특별시 동작구 상도1동 상도로53길 9 주민센터',
              latitude: '37.498043',
              longitude: '126.953090',
            },
            {
              fcltyNm: '총신대학교 종합관',
              rdnmadr: '서울특별시 동작구 사당로 143',
              latitude: '37.489732',
              longitude: '126.966511',
            },
            {
              fcltyNm: '국립 서울 현충 만남의집',
              rdnmadr:
                '동작동 산41-2번지 동작동국립서울현충만남의집내서점 동작구 서울특별시 KR',
              latitude: '37.503194',
              longitude: '126.969335',
            },
            {
              fcltyNm: '사당역',
              rdnmadr:
                'KR 서울특별시 동작구 사당동 588-44번지 지하층 지하3층 사당역4 433동 106호',
              latitude: '37.476825',
              longitude: '126.981591',
            },
            {
              fcltyNm: '동작구차근린공원',
              rdnmadr:
                '서울특별시 동작구 현충로 220 동작역 9호선 청년창업스튜디오',
              latitude: '37.503667',
              longitude: '126.977298',
            },
            {
              fcltyNm: '노량진역 지하 1층',
              rdnmadr: '서울특별시 동작구 노량진동 60-11 노량진역 지하 1층',
              latitude: '37.513547',
              longitude: '126.940842',
            },
          ],
        },
      },
    };
    res.send(resultJson).status(200);
  } else {
    request(
      {
        url: url + queryParams,
        method: 'GET',
      },
      function (err, response, body) {
        if (!err && res.statusCode === 200) {
          resultJson = JSON.parse(body);
          res.status(200).send(resultJson);
        } else {
          res.status(401).send('error');
        }
      }
    );
  }
});

/**
 * @param {Float} lat 위도
 * @param {Float} lon 경도
 */
async function findgu(lat, lon) {
  const url =
    'https://apis.openapi.sk.com/tmap/geo/reversegeocoding?version={version}';

  let queryParams = '&' + encodeURIComponent('lat') + '=' + lat;
  queryParams += '&' + encodeURIComponent('lon') + '=' + lon;
  queryParams +=
    '&' + encodeURIComponent('appKey') + '=' + `${process.env.TMAP_KEY}`;

  return new Promise((resolve, reject) => {
    let resultJson = {};
    request(
      {
        url: url + queryParams,
        method: 'GET',
      },

      function (err, res, body) {
        if (!err && res.statusCode === 200) {
          resultJson = JSON.parse(body);
          resolve(resultJson);
        } else {
          resultJson['error'] = 'Some error';
          reject(resultJson);
        }
      }
    );
  });
}

module.exports = router;
