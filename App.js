var axios = require('axios');
var express = require('express');
var bodyParser = require('body-parser');

var fs = require('fs')
  , gm = require('gm')
  , dir = __dirname + "/gm_engine/Images/";
require('gm-base64');
var Engine = require('./gm_engine/Engine');

var app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
})

app.use(bodyParser.json())

app.use('/public/images', express.static(__dirname + '/gm_engine/Images'));

app.post('/CreateScene', function(req, res) {
  var imagesURLs = req.body.images.map((image) => image.images.downsized_large.url);
  var textArr = req.body.textArr;

  Engine.runCombiner(imagesURLs, textArr, (result) => res.send(result));
})

app.get('/CreateScene', function(req, res) {
  res.sendFile(dir + 'seinfeld_final.gif');
})

app.listen(process.env.PORT || 3001);
