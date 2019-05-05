exports.login = function(req, res) {
	if(!req.session.userID) {
		res.render('login');
	} else {
		res.redirect('/');
	}
}

exports.dashboard = function(req, res) {
	var userID = req.session.userID;
	if(userID) {
		db.query(`SELECT * FROM users WHERE id = "${userID}";`, function(error, results, fields) {
			if(error) {
				console.log(error['sqlMessage']);
				res.render('error', {error: {code: 'Database error', message: error['sqlMessage']}});
			} else {
				if(results.length > 0) {
					db.query('SELECT `groups`.id, `groups`.name, `groups`.private, `groups`.last_message, messages.text FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = `groups`.last_message_id WHERE group_members.user_id = ? AND `groups`.private = 0; SELECT `groups`.id FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id WHERE group_members.user_id = ? AND `groups`.private = 1;', [userID, userID], function(error2, results2, fields2) {
						if(error2) throw error2;
						var privateGroups = results2[1].map(({id}) => id);
						db.query('SELECT group_members.group_id AS id, concat(users.firstname, " ", users.lastname) AS name, `groups`.last_message, messages.text FROM group_members INNER JOIN users ON users.id = group_members.user_id INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = groups.last_message_id WHERE group_members.group_id IN (?) AND group_members.user_id != ?;', [privateGroups, userID], function(error3, results3, fields3) {
							if(error3) throw error3;
							var chats = results2[0].concat(results3);
							chats.sort(compare);
							db.query('SELECT sender_id, text, date_format(sent, "%d.%m.%Y %H:%i") AS sent FROM messages WHERE group_id = ?;', [chats[0].id], function(error4, results4, fields4) {
								if(error4) throw error4;
								res.render('dashboard', {user: results[0], chats: chats.slice(0, 10), messages: results4});
							});
						});
					});
				} else {
					console.log("Error: User not found!");
					res.render('error', {error: {code: 'Database error', message: 'User not found'}});
				}
			}
		});
	} else {
		res.redirect('/login');
	}
}

exports.logout = function(req, res) {
	req.session.destroy(function() {
		res.redirect('/login');
	});
}

exports.auth = function(req, res) {
	var post = req.body;
	db.query(`SELECT * FROM users WHERE username = "${post.username}" AND password = "${post.password}";`, function(error, results, fields) {
		if(error) {
			console.log(error['sqlMessage']);
			res.render('error', {error: {code: 'Database error', message: error['sqlMessage']}});
		} else {
			if(results.length > 0) {
				req.session.userID = results[0].id;
				req.session.user = {firstname: results[0].firstname};
				res.redirect('/');
			} else {
				res.render('login', {message: 'Nieprawidłowy login lub hasło!'});
			}
		}
	});
}