require('dotenv').config({ path: '.env' });

const express  = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session')({
		secret: 'secret',
		resave: true,
		saveUninitialized: true,
		unset: 'destroy'
	});
const sharedsession = require("express-socket.io-session");
const routes = require('./routes/index');

global.db = require('./lib/database');
global.version = '2019.9.5';

app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '/public/')));
app.use(session);
app.use(bodyParser.urlencoded({extended: true}));
io.use(sharedsession(session));

app.use('/', routes);

require('./sockets')(io);

const port = process.env.PORT || 3000;
http.listen(port, function() {
	console.log('Listening on port '+port);
});