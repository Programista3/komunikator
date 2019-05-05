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

function twoDigits(number) {
	if(number < 10) return '0'+number.toString();
	else return number.toString();
}

function getDatetime() {
	var date = new Date();
	return date.getFullYear()+'.'+twoDigits(date.getMonth()+1)+'.'+twoDigits(date.getDate())+' '+twoDigits(date.getHours())+':'+twoDigits(date.getMinutes());
}
function getChats(userID, callback) {
	db.query('SELECT `groups`.id, `groups`.name, `groups`.private, `groups`.last_message, messages.text FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = `groups`.last_message_id WHERE group_members.user_id = ? AND `groups`.private = 0; SELECT `groups`.id FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id WHERE group_members.user_id = ? AND `groups`.private = 1;', [userID, userID], function(error, results, fields) {
		if(error) throw error;
		var privateGroups = results[1].map(({id}) => id);
		db.query('SELECT group_members.group_id AS id, concat(users.firstname, " ", users.lastname) AS name, `groups`.last_message, messages.text FROM group_members INNER JOIN users ON users.id = group_members.user_id INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = groups.last_message_id WHERE group_members.group_id IN (?) AND group_members.user_id != ?;', [privateGroups, userID], function(error2, results2, fields2) {
			if(error2) throw error2;
			var chats = results[0].concat(results2);
			chats.sort(compare);
			callback(chats.slice(0, 10));
		});
	});
}

function getMessages(groupID, callback) {
	db.query('SELECT sender_id, text, date_format(sent, "%d.%m.%Y %H:%i") AS sent FROM messages WHERE group_id = ? ORDER BY UNIX_TIMESTAMP(sent) LIMIT 10', [groupID], function(error, results, fields) {
		if(error) throw error;
		callback(results);
	});
}

io.on('connection', function(socket) {
	if(socket.handshake.session.userID == null) {
		socket.disconnect();
		return false;
	} else {
		socket.userID = socket.handshake.session.userID;
		socket.user = socket.handshake.session.user;
		console.log('Connected user with id: '+socket.userID);
	}
	socket.on('msg', function(data) {
		db.query('SELECT * FROM group_members WHERE group_id = ?;', [data.chat], function(error, results, fields) {
			if(error) throw error;
			if(results.length > 0) {
				var users = results.map(({user_id}) => id);
				console.log(users);
				if(users.includes(socket.userID)) {
					db.query('INSERT INTO messages (group_id, sender_id, text, sent) VALUES (?, ?, ?, NOW());', [data.chat, socket.userID, data.message], function(error2, results2, fields2) {
						if(error2) throw error2;
						db.query('UPDATE `groups` SET last_message = NOW(), last_message_id = ? WHERE id = ?', [results2.insertId, data.chat], function(error3, results3, fields3) {
							if(error3) throw error3;
							Object.keys(io.sockets.sockets).forEach(function(id) {
								if(users.includes(io.sockets.sockets[id].userID)) {
									getChats(io.sockets.sockets[id].userID, function(chats) {
										getMessages(chats[0].id, function(messages) {
											io.sockets.sockets[id].emit('message', {user_id: io.sockets.sockets[id].userID, chat: data.chat, chats: chats, messages: messages});
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
				getMessages(data.chat, function(messages) {
					socket.emit('messageList', {messages: messages, id: socket.userID});
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
	socket.on('openChat', function(data) {
		db.query('SELECT group_members.group_id AS id, concat(users.firstname, " ", users.lastname) AS name, `groups`.last_message, messages.text FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN users ON users.id = group_members.user_id INNER JOIN messages ON messages.id = groups.last_message_id WHERE group_members.user_id = ? and group_members.group_id in (SELECT group_id from group_members WHERE user_id = ?) AND `groups`.`private` = 1;', [socket.userID, data.id], function(error, results, fields) {
			if(error) throw error;
			if(results.length > 0) {
				getChats(socket.userID, function(chats) {
					if(chats.map(({id}) => id).includes(results[0].id) == false) {
						chats.unshift(results[0]);
					}
					getMessages(results[0].id, function(messages) {
						socket.emit('openChat', {userID: socket.userID, chatID: results[0].id, chats: chats, messages: messages});
					});
				});
			} else {
				db.query('INSERT INTO `groups` (private, creation_date) VALUES (1, NOW());', function(error2, results2, fields2) {
					if(error2) throw error2;
					db.query('INSERT INTO group_members (group_id, user_id, join_date) VALUES (?, ?, NOW()), (?, ?, NOW());INSERT INTO messages (group_id, sender_id, text, sent) VALUES (?, ?, ?, NOW());', [results2.insertId, data.id, results2.insertId, socket.userID, results2.insertId, -1, (socket.user.firstname+' utworzył(a) czat')], function(error3, results3, fields3) {
						if(error3) throw error3;
						db.query('UPDATE `groups` SET last_message = NOW(), last_message_id = ? WHERE id = ?', [results3[1].insertId, results2.insertId], function(error4, results4, fields4) {
							if(error4) throw error4;
							getChats(socket.userID, function(chats) {
								socket.emit('openChat', {userID: socket.userID, chatID: results2.insertId, chats: chats, messages: [{sender_id: -1, text: socket.user.firstname+' utworzył(a) czat', sent: getDatetime()}]});
							});
						});
					});
				});
			}
		});
	});
});

http.listen(3000, function(){
	console.log('Listening on port 3000');
});

setTimeout(function() {
	db.query('SELECT 1');
}, 5000);

//connection.end();