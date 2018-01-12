//Returns image size back to checkImageArrSizes
//In order to resize all images to the same height
function checkImageSize(image) {
  return new Promise(function( resolve, reject) {
    try {
      gm(dir + image)
      .size(function(err, value) {
        if(err) {
          throw(err);
        }
        resolve(value);
      });
    }
    catch (err) {
      reject(err);
    }
  });
}

//Generate a hash for the local filesystem to name the gifs as it saves them
function generateImageHash(length) {
  var charArr = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
                 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
                 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
                 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
                 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7',
                 '8', '9']; // 62 length

  var hash = [];

  for (var i = 0; i < length; i++) {
    var ranIndex = Math.floor(Math.random() * (62));
    hash.push(charArr[ranIndex]);
  }

  return hash.join('');
}

function getImageHeight(image) {
    gm(dir + image)
    .size(function(err, value) {
      if(err) {
        throw(err);
      }
      return value.height;
    })
}

//Loop through the provided Array of images, and find the smallestHeight
//to feed back to resizeImage function
async function checkImageArrSizes(images) {

  var smallestHeight;
  var largestWidth;

  for (var i = 0; i < images.length; i++) {
    await checkImageSize(images[i]).then((result) => {
      if (!smallestHeight)
        smallestHeight = parseInt(result.height);

      if (!largestWidth)
        largestWidth = parseInt(result.width)

      if (parseInt(result.height) < smallestHeight)
        smallestHeight = parseInt(result.height);

      if (parseInt(result.width) > largestWidth)
        largestWidth = parseInt(result.width)
    })
  }

  return { smallestHeight, largestWidth };
}

//Resize all images (proportionally) to have the smallestHeight
//Sides of the images will be padded with black bars to keep the width dimensions
//consistent a cross images (and avoid seeing through layers)
function resizeImage(image, smallestHeight, largestWidth) {
  return new Promise(function( resolve, reject) {
      //console.log("resizing " + image);
      try {
        gm(dir + image)
        .coalesce() // Needed to avoid corrupting of the GIF images, avoids different framesizes from optimizing
        .resize(null, smallestHeight)
        .background("Black")
        .gravity("Center")
        .compose("Copy")
        .extent(largestWidth, smallestHeight)
        .write(dir + image, function (err) {
          if (!err) console.log('\n*********\ndone resizing ' + image + '\n*********\n');
          else console.dir("resize error");
          resolve();
        })
      } catch (err) {
        reject(err);
      }
  });
}

//Adds the provided 'caption' on the client side to the image
function annotateImage(inName, text, outName) {
  return new Promise(function(resolve, reject) {
      //console.log("annotating " + inName);
      try {
        gm(dir + inName)
        .stroke("#fff")
        .drawText(0, 10, text, 'South')
        .font("Roboto-Black.ttf", 40)
        .write(dir + outName, function (err) {
          if (!err) {
            console.log('\n*********\ndone annotating' + inName + '\n*********\n')
            fs.unlink(dir + inName, (err) => {
              if (err) {
                console.log("failed to delete gif: " +err);
              } else {
                console.log("successfully deleted local image: " + inName);
              }
            });
          }
          else console.dir("annotate error"); //arguments
          resolve();
        })
      } catch (err) {
        reject(err);
      }
  });
}

//Recursively creates the gifs (pairs two gifs together at time
//stopping when the end of the array has been reached
//and using the provided call back to send the result back to the client)
function createGif(images, index, outGif, smallestHeight, largestWidth, cb) {
  var baseFile = (index == 1 ? images[0] : outGif)

  if (index < images.length)
    {
      console.log("Combining " + baseFile + " and " + images[index]);
      gm()
      .in(dir + baseFile)
      .in(dir + images[index])
      .write(dir + outGif, function(err) {
        if (err) throw err;

        createGif(images, index+1, outGif, smallestHeight, largestWidth, cb);
      });
    }

  else if (index == images.length) {
    if (images.length==1)
    {
      outGif = baseFile;
    }

    gm(dir + outGif)
      .toBase64('gif', false, function(err, base64){
        //console.log(base64);
        axios.post('https://api.imgur.com/3/image/', { 'image': base64 }, { headers: {'Content-Type': 'application/json', 'Authorization': 'Client-ID 4bb49fd693ae7e5' }} )
        .then(function(response) {
          console.log('\n*********\nSUCCESSFULLY POSTED TO IMGUR' + '\n*********\n');
          cb(response.data.data.link);
        })
        .catch(function(error) {
          console.log('\n*********\nFAILED IN POSTING TO IMGUR' + '\n*********\n');
          console.log(error);
          cb("http://seinfeld-gif-api.herokuapp.com/public/images/" + outGif)
        });

        if (images.length > 1) {
          for (i = 0; i < images.length; i++) {
            fs.unlink(dir + images[i], (err) => {
              if (err) {
                console.log("failed to delete gif: " +err);
              }
            });
          }
        }
      });
  }
}

//Download gif to server disk
function downloadGif(url) {
  return new Promise(function(resolve, reject) {
    try {
      var gifName = generateImageHash(12) + ".gif";

      gm(request(url))
      .write(dir + gifName, function (err) {
      if (!err) {
        console.log('done creating ' + gifName);
        resolve(gifName);
      }
      else console.log(err)
    })
    }
    catch(err) {
      reject(err);
    }
  })
}

//Runs a series of functions returning promises to generate the final result
//First the size of all images is checked to come up with the smallestHeight
//and largestWidth. The images are then resized to the smallest height, and the
//width is used to add black bars on either side so all images have the same
//dimensions. once resized, the images are annotated with the captions. They
// are still seperate files at this point. Once the promises are returned,
//they are all combined. A callback function is passed to the createGif function
//to return the result back to the client.
function Main(images, textArr, imagesOut, finalGifName, cb) {

  checkImageArrSizes(images)
  .then((result) => {
    var smallestHeight = result.smallestHeight;
    var largestWidth = result.largestWidth;
    let promises = [];
    for (i = 0; i < images.length; i++) {
      promises.push(resizeImage(images[i], smallestHeight, largestWidth))
    };
    Promise.all(promises)
    .then(() => {
      let promises = [];
      for (i = 0; i < images.length; i++) {
        promises.push(annotateImage(images[i], textArr[i], imagesOut[i]))
      };
      Promise.all(promises)
      .then(() => {
        createGif(imagesOut, 1, finalGifName, smallestHeight, largestWidth, cb)
      })
    });
  });
}

function runCombiner(imagesArr, textArr, cb) {
  let promises = [];
  for (i = 0; i < imagesArr.length; i++) {
    promises.push(downloadGif(imagesArr[i]))
  }

  Promise.all(promises).then((results) => {
    var images = results;

    Main(images,
        textArr,
        images.map((image) => "annotated_" + image),
        "final_" + generateImageHash(12) + ".gif",
        (result) => cb(result)
    )
  }).catch((err) => console.log(err));
}

var fs = require('fs')
  , gm = require('gm')
  , dir = __dirname + "/Images/";

var axios = require('axios');
var request = require('request');

module.exports = { runCombiner };
