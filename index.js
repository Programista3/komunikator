var user = require('./routes/user'),
	express  = require('express'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	bodyParser = require('body-parser'),
	mysql = require('mysql'),
	connection = mysql.createConnection({
		host: 'remotemysql.com',
		user: 'Zwb6PCMBNz',
		password: 'ju4LAabhFb',
		database: 'Zwb6PCMBNz'
	}),
	session = require('express-session')({
		secret: 'secret',
		resave: true,
		saveUninitialized: true,
	}),
	sharedsession = require("express-socket.io-session");

app.set('views', __dirname+'/views');
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/'));
app.use(session);
app.use(bodyParser.urlencoded({extended: true}));
io.use(sharedsession(session));
connection.connect();
global.db = connection;

function ifLogged(req, res, next) {
	if(req.session.userID) {
		next();
	} else {
		req.session.error = 'Access denied!';
		res.redirect('/login');
	}
}

function ifNotLogged(req, res, next) {
	if(!req.session.userID) {
		next();
	} else {
		res.redirect('/');
	}
}

app.get('/login', user.login);
app.get('/', user.dashboard);
app.get('/logout', user.logout);
app.post('/login', user.auth);

io.on('connection', function(socket) {
	console.log('Connected user with id: '+socket.handshake.session.userID);
	socket.on('msg', function(msg) {
		console.log('New message: '+msg.message);
		io.emit('msg', {message: msg.message});
	});
	socket.on('search', function(data) {
		console.log(data.query);
		db.query(`SELECT firstname, lastname, username FROM users WHERE username LIKE '${data.query}%';`, function(error, results, fields) {
			if(error) throw error;
			console.log(results);
			if(results.length > 0){ 
				socket.emit('search', {results: results});
			}
		});
	});
});

http.listen(3000, function(){
	console.log('Listening on port 3000');
});

//connection.end();