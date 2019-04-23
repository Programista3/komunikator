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
		database: 'Zwb6PCMBNz',
		multipleStatements: true
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
	if(socket.handshake.session.userID == null) {
		socket.disconnect();
		return false;
	} else {
		socket.userID = socket.handshake.session.userID;
		console.log('Connected user with id: '+socket.userID);
	}
	socket.on('msg', function(data) {
		db.query(`SELECT * FROM group_members WHERE group_id = ${data.chat};`, function(error, results) {
			if(error) throw error;
			if(results.length > 0) {
				var users = [];
				for(var i in results) {
					users.push(results[i].user_id);
				}
				if(users.includes(socket.userID)) {
					db.query('INSERT INTO messages (group_id, sender_id, text, sent) VALUES (?, ?, ?, NOW());UPDATE `groups` SET last_message = NOW() WHERE id = ?', [data.chat, socket.userID, data.message, data.chat], function(error, results, fields) {
						if(error) throw error;
						Object.keys(io.sockets.sockets).forEach(function(id) {
							if(users.includes(io.sockets.sockets[id].userID)) {
								io.sockets.sockets[id].emit('msg', {message: data.message});
							}
						});
					});
				}
			}
		});
		console.log('New message: '+data.message+' Chat: '+data.chat);
	});
	socket.on('getMessages', function(data) {
		db.query('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [data.chat, socket.userID], function(error, results, fields) {
			if(error) throw error;
			if(results.length > 0) {
				db.query('SELECT sender_id, text, sent FROM messages WHERE group_id = ? LIMIT 10', [data.chat], function(error2, results2, fields2) {
					if(error2) throw error2;
					socket.emit('messageList', {messages: results2});
				});
			}
		});
	});
	socket.on('search', function(data) {
		db.query(`SELECT firstname, lastname, username FROM users WHERE username LIKE '${data.query}%';`, function(error, results, fields) {
			if(error) throw error;
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