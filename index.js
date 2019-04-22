var user = require('./routes/user'),
	app = require('express')(),
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

/*app.get('/', ifLogged, function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});

app.get('/login', ifNotLogged, function(req, res) {
	//res.sendFile(__dirname + '/client/login.html');
});*/
app.get('/login', user.login);
app.get('/', user.dashboard);
app.get('/logout', user.logout);
app.post('/login', user.auth);

/*app.post('/login', function(req, res) {
	var post = req.body;
	connection.query(`SELECT * FROM users WHERE username = "${post.username}" AND password = "${post.password}";`, function(error, results, fields) {
		if(error) {
			console.log(error['sqlMessage']);
				res.send('Database error!');
			} else {
			if(results.length > 0) {
				console.log(results[0].id);
				req.session.userID = results[0].id;
				res.redirect('/');
			} else {
				res.send('Nieprawidłowy login lub hasło!');
			}
		}
	});
});*/

/*app.get('/logout', function(req, res) {
	delete req.session.userID;
	res.redirect('/login');
});*/

io.on('connection', function(socket) {
	console.log('an user connected');
	console.log(socket.handshake.session.userID);
	socket.on('msg', function(msg) {
		console.log('New message: '+msg.message);
		io.emit('msg', {message: msg.message});
	});
});

http.listen(3000, function(){
	console.log('Listening on port 3000');
});

//connection.end();