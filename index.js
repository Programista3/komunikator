var user = require('./routes/user'),
	express  = require('express'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	bodyParser = require('body-parser'),
	mysql = require('mysql'),
	connection,
	dbconfig = {
		host: 'remotemysql.com',
		user: 'Zwb6PCMBNz',
		password: 'ju4LAabhFb',
		database: 'Zwb6PCMBNz',
		multipleStatements: true
	},
	session = require('express-session')({
		secret: 'secret',
		resave: true,
		saveUninitialized: true,
	}),
	sharedsession = require("express-socket.io-session");

global.compare = function(a, b) {
	if (a.last_message < b.last_message) {
		return 1;
	}
	if (a.last_message > b.last_message) {
		return -1;
	}
	return 0;
}

function connect() {
	console.log('Connecting to the database...');
	connection = mysql.createConnection(dbconfig);
	connection.connect(function(err) {
		if(err) {
			console.log('Connecting error ', err);
			setTimeout(connect, 2000);
		}
	});
	connection.on('error', function(err) {
		console.log("Error: ", err);
		if(err.code === 'PROTOCOL_CONNECTION_LOST') {
			connection.end();
			connect();
		} else {
			throw err;
		}
	})
}
connect();

app.set('views', __dirname+'/views');
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/'));
app.use(session);
app.use(bodyParser.urlencoded({extended: true}));
io.use(sharedsession(session));
global.db = connection;

app.get('/login', user.login);
app.get('/', user.dashboard);
app.get('/logout', user.logout);
app.post('/login', user.auth);

function getChats(userID, callback) {
	db.query('SELECT `groups`.id, `groups`.name, `groups`.private, `groups`.last_message, messages.text FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = `groups`.last_message_id WHERE group_members.user_id = ? AND `groups`.private = 0; SELECT `groups`.id FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id WHERE group_members.user_id = ? AND `groups`.private = 1;', [userID, userID], function(error, results, fields) {
		if(error) throw error;
		var privateGroups = '';
		for(var i in results[1]) {
			privateGroups += results[1][i].id;
			if(i < results[1].length-1) {
				privateGroups += ', ';
			}
		}
		db.query('SELECT group_members.group_id AS id, concat(users.firstname, " ", users.lastname) AS name, `groups`.last_message, messages.text FROM group_members INNER JOIN users ON users.id = group_members.user_id INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = groups.last_message_id WHERE group_members.group_id IN (?) AND group_members.user_id != ?;', [privateGroups, userID], function(error2, results2, fields2) {
			if(error2) throw error2;
			var chats = results[0].concat(results2);
			chats.sort(compare);
			callback(chats.slice(0, 10));
		});
	});
}

io.on('connection', function(socket) {
	if(socket.handshake.session.userID == null) {
		socket.disconnect();
		return false;
	} else {
		socket.userID = socket.handshake.session.userID;
		console.log('Connected user with id: '+socket.userID);
	}
	socket.on('msg', function(data) {
		db.query('SELECT * FROM group_members WHERE group_id = ?;', [data.chat], function(error, results, fields) {
			if(error) throw error;
			if(results.length > 0) {
				var users = [];
				for(var i in results) {
					users.push(results[i].user_id);
				}
				if(users.includes(socket.userID)) {
					db.query('INSERT INTO messages (group_id, sender_id, text, sent) VALUES (?, ?, ?, NOW());', [data.chat, socket.userID, data.message], function(error2, results2, fields2) {
						if(error2) throw error2;
						db.query('UPDATE `groups` SET last_message = NOW(), last_message_id = ? WHERE id = ?', [results2.insertId, data.chat], function(error6, results6, fields6) {
							if(error6) throw error6;
							Object.keys(io.sockets.sockets).forEach(function(id) {
								if(users.includes(io.sockets.sockets[id].userID)) {
									db.query('SELECT `groups`.id, `groups`.name, `groups`.private, `groups`.last_message, messages.text FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = `groups`.last_message_id WHERE group_members.user_id = ? AND `groups`.private = 0; SELECT `groups`.id FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id WHERE group_members.user_id = ? AND `groups`.private = 1;', [io.sockets.sockets[id].userID, io.sockets.sockets[id].userID], function(error3, results3, fields3) {
										if(error3) throw error3;
										var privateGroups = '';
										for(var i in results3[1]) {
											privateGroups += results3[1][i].id;
											if(i < results3[1].length-1) {
												privateGroups += ', ';
											}
										}
										db.query('SELECT group_members.group_id AS id, concat(users.firstname, " ", users.lastname) AS name, `groups`.last_message, messages.text FROM group_members INNER JOIN users ON users.id = group_members.user_id INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = groups.last_message_id WHERE group_members.group_id IN (?) AND group_members.user_id != ?;', [privateGroups, io.sockets.sockets[id].userID], function(error4, results4, fields4) {
											if(error4) throw error4;
											var chats = results3[0].concat(results4);
											chats.sort(compare);
											db.query('SELECT sender_id, text, date_format(sent, "%d.%m.%Y %H:%i") AS sent FROM messages WHERE group_id = ?;', [chats[0].id], function(error5, results5, fields5) {
												if(error5) throw error5;
												io.sockets.sockets[id].emit('message', {user_id: io.sockets.sockets[id].userID, chat: data.chat, chats: chats.slice(0, 10), messages: results5});
											});
										});
									});
								}
							});
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
				db.query('SELECT sender_id, text, date_format(sent, "%d.%m.%Y %H:%i") AS sent FROM messages WHERE group_id = ? LIMIT 10', [data.chat], function(error2, results2, fields2) {
					if(error2) throw error2;
					socket.emit('messageList', {messages: results2, id: socket.userID});
				});
			}
		});
	});
	socket.on('search', function(data) {
		db.query(`SELECT id, firstname, lastname, username FROM users WHERE username LIKE '${data.query}%';`, function(error, results, fields) {
			if(error) throw error;
			if(results.length > 0){ 
				socket.emit('search', {results: results});
			}
		});
	});
	socket.on('getChats', function() {
		getChats(socket.userID, function(chats) {
			socket.emit('getChats', {chats: chats});
		});
	})
});

http.listen(3000, function(){
	console.log('Listening on port 3000');
});

setTimeout(function() {
	db.query('SELECT 1');
}, 30000);

//connection.end();