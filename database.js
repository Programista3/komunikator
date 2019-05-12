var mysql = require('mysql'),
	pool = mysql.createPool({
		host: 'remotemysql.com',
		user: 'Zwb6PCMBNz',
		password: 'ju4LAabhFb',
		database: 'Zwb6PCMBNz',
		multipleStatements: true
	});

exports.compare = function(a, b) {
	if (a.last_message < b.last_message) {
		return 1;
	}
	if (a.last_message > b.last_message) {
		return -1;
	}
	return 0;
}

exports.getChats = function(userID, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT `groups`.id, `groups`.name, `groups`.private, `groups`.last_message, messages.text FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = `groups`.last_message_id WHERE group_members.user_id = ? AND `groups`.private = 0; SELECT `groups`.id FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id WHERE group_members.user_id = ? AND `groups`.private = 1;', [userID, userID], function(error, results, fields) {
			if(error) throw error;
			if(results[1].length > 0) {
				var privateGroups = results[1].map(({id}) => id);
				connection.query('SELECT group_members.group_id AS id, concat(users.firstname, " ", users.lastname) AS name, `groups`.private, `groups`.last_message, messages.text FROM group_members INNER JOIN users ON users.id = group_members.user_id INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = groups.last_message_id WHERE group_members.group_id IN (?) AND group_members.user_id != ?;', [privateGroups, userID], function(error2, results2, fields2) {
					connection.release();
					if(error2) throw error2;
					var chats = results[0].concat(results2);
					chats.sort(exports.compare);
					callback(chats.slice(0, 10));
				});
			} else {
				connection.release();
				results[0].sort(exports.compare);
				callback(results[0].slice(0, 10));
			}
		});
	});
}
	
exports.getMessages = function(groupID, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT id, sender_id, text, DATE_FORMAT(CONVERT_TZ(sent, "+00:00", "+02:00"), "%d.%m.%Y %H:%i") AS sent, DATE_FORMAT(CONVERT_TZ(removed, "+00:00", "+02:00"), "%d.%m.%Y %H:%i") AS removed FROM messages WHERE group_id = ? ORDER BY UNIX_TIMESTAMP(sent) DESC LIMIT 15', [groupID], function(error, results, fields) {
			connection.release();
			if(error) throw error;
			callback(results.reverse());
		});
	});
}

exports.getUserInfo = function(userID, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT * FROM users WHERE id = ?;', userID, function(error, results, fields) {
			connection.release();
			if(error) callback(error['sqlMessage'], results);
			if(results.length > 0) {
				callback(null, results[0]);
			} else {
				callback('User not found', results);
			}
		});
	});
}

exports.userExists = function(username, password, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?;', [username, username, password], function(error, results, fields) {
			connection.release();
			if(error) {
				callback(error['sqlMessage'], false, null);
			} else {
				if(results.length > 0) {
					callback(null, true, results[0]);
				} else {
					callback(null, false, null);
				}
			}
		});
	});
}

exports.getUsersInGroup = function(groupID, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT * FROM group_members WHERE group_id = ?;', [groupID], function(error, results, fields) {
			connection.release();
			if(error) throw error;
			var users = results.map(({user_id}) => user_id);
			callback(users);
		});
	});
}

exports.sendMessage = function(groupID, userID, message, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT * FROM group_members WHERE group_id = ?;', [groupID], function(error, results, fields) {
			if(error) throw error;
			if(results.length > 0) {
				var users = results.map(({user_id}) => user_id);
				if(users.includes(userID)) {
					connection.query('INSERT INTO messages (group_id, sender_id, text, sent) VALUES (?, ?, ?, NOW());', [groupID, userID, message], function(error2, results2, fields2) {
						if(error2) throw error2;
						connection.query('UPDATE `groups` SET last_message = NOW(), last_message_id = ? WHERE id = ?', [results2.insertId, groupID], function(error3, results3, fields3) {
							connection.release();
							if(error3) throw error3;
							callback(users);
						});
					});
				}
			}
		});
	});
}

exports.userInGroup = function(groupID, userID, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupID, userID], function(error, results, fields) {
			connection.release();
			if(error) throw error;
			if(results.length > 0) {
				callback(true);
			} else {
				callback(false);
			}
		});
	});
}

exports.searchUser = function(q, userID, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT id, firstname, lastname, username FROM users WHERE (username LIKE ? OR concat(firstname, " ", lastname) LIKE ? OR lastname LIKE ?) AND id != ?;', [q+'%', q+'%', q+'%', userID], function(error, results, fields) {
			connection.release();
			if(error) throw error;
			callback(results);
		});
	});
}

exports.privateChatExists = function(user1, user2, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT group_members.group_id AS id, concat(users.firstname, " ", users.lastname) AS name, `groups`.last_message, messages.text FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN users ON users.id = group_members.user_id INNER JOIN messages ON messages.id = groups.last_message_id WHERE group_members.user_id = ? and group_members.group_id in (SELECT group_id from group_members WHERE user_id = ?) AND `groups`.`private` = 1;', [user1, user2], function(error, results, fields) {
			connection.release();
			if(error) throw error;
			callback(results);
		});
	});
}

exports.createPrivateChat = function(user1, user2, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('INSERT INTO `groups` (private, creation_date) VALUES (1, NOW());', function(error, results, fields) {
			if(error) throw error;
			connection.query('INSERT INTO group_members (group_id, user_id, join_date) VALUES (?, ?, NOW()), (?, ?, NOW());INSERT INTO messages (group_id, sender_id, text, sent) VALUES (?, ?, ?, NOW());', [results.insertId, user2, results.insertId, user1.id, results.insertId, -1, (user1.firstname+' utworzył(a) czat')], function(error2, results2, fields2) {
				if(error2) throw error2;
				connection.query('UPDATE `groups` SET last_message = NOW(), last_message_id = ? WHERE id = ?', [results2[1].insertId, results.insertId], function(error3, results3, fields3) {
					connection.release();
					if(error3) throw error3;
					callback(results.insertId);
				});
			});
		});
	});
}

exports.removeChat = function(groupID, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('DELETE FROM messages WHERE group_id = ?;DELETE FROM group_members WHERE group_id = ?;DELETE FROM `groups` WHERE id = ?;', [groupID, groupID, groupID], function(error, results, fields) {
			connection.release();
			if(error) throw error;
			callback();
		});
	});
}

exports.getMessageInfo = function(messageID, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('SELECT * FROM messages WHERE id = ?', [messageID], function(error, results, fields) {
			connection.release();
			if(error) throw error;
			callback(results.length ? results[0] : null);
		})
	});
}

exports.removeMessage = function(messageID, callback) {
	pool.getConnection(function(err, connection) {
		if(err) throw err;
		connection.query('UPDATE messages SET removed = NOW(), text = "Wiadomość została usunięta" WHERE id = ?', [messageID], function(error, results, fields) {
			if(error) throw error;
			callback(results);
		});
	});
}