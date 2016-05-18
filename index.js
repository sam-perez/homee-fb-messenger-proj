const http = require('http');
const express = require('express');

const router = express();
const server = http.createServer(router);
router.get('/test', function(req, res){
  res.send('hello world');
});

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", () => {
  const addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});