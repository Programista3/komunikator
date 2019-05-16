#!/usr/bin/env node
var db = require('./database'),
	express  = require('express'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	bodyParser = require('body-parser'),
	session = require('express-session')({
		secret: 'secret',
		resave: true,
		saveUninitialized: true,
		unset: 'destroy'
	}),
	sharedsession = require("express-socket.io-session"),
	version = '2019.4.1 (closed beta)';

app.set('views', __dirname+'/views');
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/'));
app.use(session);
app.use(bodyParser.urlencoded({extended: true}));
io.use(sharedsession(session));

app.get('/login', function(req, res) {
	if(!req.session.userID) {
		res.render('login', {version: version});
	} else {
		res.redirect('/');
	}
});

app.get('/', function(req, res) {
	var userID = req.session.userID;
	if(userID) {
		db.getUserInfo(userID, function(error, user) {
			if(error) {
				res.render('error', {error: {code: 'Database error', message: error}});
			} else {
				db.getChats(userID, function(chats) {
					if(chats.length > 0) {
						db.getChatInfo(chats[0].id, function(chat) {
							if(chat) {
								db.getMessages(chats[0].id, function(messages) {
									res.render('dashboard', {user: user, chats: chats, chat: chat, messages: messages, version: version});
								});
							}
						});
					} else {
						res.render('dashboard', {user: user, chats: chats, messages: [], version: version});
					}
				});
			}
		});
	} else {
		res.redirect('/login');
	}
});

app.get('/logout', function(req, res) {
	req.session.destroy(function() {
		res.redirect('/login');
	});
});

app.post('/login', function(req, res) {
	var post = req.body;
	if(post.username === "" || post.password === "") {
		res.render('login', {message: 'Wypełnij wszystkie pola!', version: version});
	} else {
		db.userExists(post.username, post.password, function(error, exists, user) {
			if(error) {
				res.render('error', {error: {code: 'Database error', message: error}});
			} else {
				if(exists) {
					req.session.userID = user.id;
					req.session.user = {firstname: user.firstname};
					res.redirect('/');
				} else {
					res.render('login', {message: 'Nieprawidłowy login lub hasło!', version: version});
				}
			}
		});
	}
});

app.get('/register', function(req, res) {
	if(!req.session.userID) {
		res.render('register', {version: version});
	} else {
		res.redirect('/');
	}
});

app.get('/changelog', function(req, res) {
	res.render('changelog');
});

app.get('/info', function(req, res) {
	res.render('info');
});

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
		db.sendMessage(data.chat, socket.userID, data.message, function(users) {
			Object.keys(io.sockets.sockets).forEach(function(id) {
				if(users.includes(io.sockets.sockets[id].userID)) {
					db.getChats(io.sockets.sockets[id].userID, function(chats) {
						if(chats.length > 0) {
							db.getMessages(chats[0].id, function(messages) {
								io.sockets.sockets[id].emit('refresh', {type: 'newMessage', userID: io.sockets.sockets[id].userID, chatID: data.chat, chats: chats, messages: messages, own: (io.sockets.sockets[id].userID == socket.userID ? true : false)});
							});
						} else {
							io.sockets.sockets[id].emit('refresh', {type: 'newMessage', userID: io.sockets.sockets[id].userID, chatID: data.chat, chats: chats, messages: [], own: (io.sockets.sockets[id].userID == socket.userID ? true : false)});
						}
					});
				}
			});
		})
		console.log('New message: '+data.message+' Chat: '+data.chat);
	});
	socket.on('getMessages', function(data) {
		db.userInGroup(data.chat, socket.userID, function(inGroup) {
			if(inGroup) {
				db.getChatInfo(data.chat, function(chat) {
					if(chat) {
						db.getMessages(data.chat, function(messages) {
							socket.emit('messageList', {chat: chat, messages: messages, id: socket.userID});
						});
					}
				});
			}
		});
	});
	socket.on('search', function(data) {
		db.searchUser(data.query, socket.userID, function(results) {
			socket.emit('search', {results: results});
		});
	});
	socket.on('getChats', function() {
		db.getChats(socket.userID, function(chats) {
			socket.emit('getChats', {chats: chats});
		});
	})
	socket.on('openChat', function(data) {
		db.privateChatExists(socket.userID, data.id, function(results) {
			if(results.length > 0) {
				db.getChats(socket.userID, function(chats) {
					if(chats.map(({id}) => id).includes(results[0].id) == false) {
						chats.unshift(results[0]);
					}
					if(chats.length > 0) {
						db.getMessages(results[0].id, function(messages) {
							socket.emit('refresh', {type: 'openChat', userID: socket.userID, chatID: results[0].id, chats: chats, messages: messages});
						});
					} else {
						socket.emit('refresh', {type: 'openChat', userID: socket.userID, chatID: results[0].id, chats: chats, messages: []});
					}
				});
			} else {
				db.createPrivateChat({id: socket.userID, firstname: socket.user.firstname}, data.id, function(groupID) {
					db.getChats(socket.userID, function(chats) {
						if(chats.length > 0) {
							db.getMessages(chats[0].id, function(messages) {
								socket.emit('refresh', {type: 'createChat', userID: socket.userID, chatID: groupID, chats: chats, messages: messages, own: true});
							});
						} else {
							socket.emit('refresh', {type: 'createChat', userID: socket.userID, chatID: groupID, chats: chats, messages: [], own: true});
						}
					});
					for(var id in io.sockets.sockets) {
						if(io.sockets.sockets[id].userID == data.id) {
							db.getChats(data.id, function(chats) {
								if(chats.length > 0) {
									db.getMessages(chats[0].id, function(messages) {
										io.sockets.sockets[id].emit('refresh', {type: 'createChat', userID: data.id, chatID: groupID, chats: chats, messages: messages, own: false});
									});
								} else {
									io.sockets.sockets[id].emit('refresh', {type: 'createChat', userID: data.id, chatID: groupID, chats: chats, messages: [], own: false});
								}
							});
							break;
						}
					}
				});
			}
		});
	});
	socket.on('removePrivateChat', function(data) {
		db.getUsersInGroup(data.groupID, function(users) {
			if(users.includes(socket.userID)) {
				db.removeChat(data.groupID, function() {
					Object.keys(io.sockets.sockets).forEach(function(id) {
						if(users.includes(io.sockets.sockets[id].userID)) {
							db.getChats(io.sockets.sockets[id].userID, function(chats) {
								if(chats.length > 0) {
									db.getMessages(chats[0].id, function(messages) {
										io.sockets.sockets[id].emit('refresh', {type: 'removeChat', userID: io.sockets.sockets[id].userID, chatID: data.groupID, chats: chats, messages: messages});
									});
								} else {
									io.sockets.sockets[id].emit('refresh', {type: 'removeChat', userID: io.sockets.sockets[id].userID, chatID: data.groupID, chats: chats, messages: []});
								}
							});
						}
					});
				});
			}
		});
	});
	socket.on('deleteMessage', function(data) {
		db.getMessageInfo(data.messageID, function(message) {
			if(message) {
				if(message.sender_id == socket.userID && message.removed === null) {
					db.getUsersInGroup(message.group_id, function(users) {
						if(users.includes(socket.userID)) {
							db.removeMessage(data.messageID, function() {
								Object.keys(io.sockets.sockets).forEach(function(id) {
									if(users.includes(io.sockets.sockets[id].userID)) {
										db.getMessages(message.group_id, function(messages) {
											io.sockets.sockets[id].emit('deleteMessage', {userID: io.sockets.sockets[id].userID, chatID: message.group_id, messages: messages});
										});
									}
								});
							});
						}
					});
				}
			}
		});
	});
});

http.listen(3000, function(){
	console.log('Listening on port 3000');
});