var axios = require('axios');
var express = require('express');
var bodyParser = require('body-parser');

var fs = require('fs')
  , gm = require('gm')
  , dir = __dirname + "/gm_engine/Images/";
require('gm-base64');
var Engine = require('./gm_engine/Engine');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var Queue = require('bull');

io.on('connection', (client) => {
  console.log('Client connected...');

  client.on('join', function(data) {
    console.log("Join data: " + data);
  });

  client.on('message', function(data) {
    console.log("Message data: ");
    console.log(data);
  });

  client.on('disconnect', function(client) {
    console.log('disconnected');
  });
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

var gifQueue = new Queue('gif combiner', process.env.REDIS_URL);

gifQueue.process(function(job, done) {
  console.log("queueing");

  Engine.runCombiner(
    job.data.imagesURLs,
    job.data.textArr,
    (result) => {
      console.log("CB RESULT");
      done(null, {url: result});
    }
  );
});

app.get('/', function(req, res, next) {
  res.sendFile(__dirname + '/index.html');
});

app.use(bodyParser.json());
app.use(express.static(__dirname + '/node_modules'));
app.use('/public/images', express.static(__dirname + '/gm_engine/Images'));

app.post('/CreateScene', function(req, res) {
  var imagesURLs = req.body.images.map((image) => image.images.downsized_large.url);
  var textArr = req.body.textArr;
  res.send("Request Received. Response coming Back");

  gifQueue.add({imagesURLs, textArr}, {removeOnComplete:true, removeOnFail: true});
  gifQueue.on('completed', function(job, result) {
    io.emit('urlReturn', result.url);
    console.log('completed queue job, emitting result back to react');
  });
});

server.listen(process.env.PORT || 3001, function(){
    console.log('Listening on port ' + this.address().port); //Listening on port 8888
});
