const FB_MESSENGER_ACCESS_TOKEN = 'EAAWpbdicWE0BAPHsct3gxpJEOAMvHfDkAXPNlBc2WXLOPgRZBlGp9QmHkIt72DHH2JBxF8T75VNsbDIXid1sgpLZASqHIM2CUqxg12uJOrURjq1iV6L4qfZCpDzU5ZAMGKtbWkJCAl1uO6MQiFr4YOGdTZBQa2D8afODEaK3JVAZDZD';
const FB_MESSENGER_VERIFY_TOKEN = '0a30d0b17b8349d299e98d244c67795e';

const bodyParser = require('body-parser');
const http = require('http');
const express = require('express');
const request = require('request');

const router = express();
router.use(bodyParser.json()); // for parsing application/json

const server = http.createServer(router);

router.get('/test', function(req, res){
  res.send('hello world');
});

router.get('/webhook/', function (req, res) {
  if (req.query['hub.verify_token'] === FB_MESSENGER_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.send('Error, wrong validation token');
  }
});

const sendTextMessage = (sender, text) => {
  const messageData = {
    text
  };

  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:FB_MESSENGER_ACCESS_TOKEN},
    method: 'POST',
    json: {
      recipient: {id:sender},
      message: messageData,
    }
  }, (error, response, body) => {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}

router.post('/webhook/', function (req, res) {
  const messaging_events = req.body.entry[0].messaging;
  for (var i = 0; i < messaging_events.length; i++) {
    const event = req.body.entry[0].messaging[i];
    const sender = event.sender.id;
    if (event.message && event.message.text) {
      const text = event.message.text;
      // Handle a text message from this sender
      console.log('Received a message: ' + text);

      sendTextMessage(sender, text);
    }
  }
  res.sendStatus(200);
});

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", () => {
  const addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});