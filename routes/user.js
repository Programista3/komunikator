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
						if(error2) throw error;
						var privateGroups = '';
						for(var i in results2[1]) {
							privateGroups += results2[1][i].id;
							if(i < results2[1].length-1) {
								privateGroups += ', ';
							}
						}
						db.query('SELECT group_members.group_id AS id, users.firstname, users.lastname, `groups`.last_message, messages.text FROM group_members INNER JOIN users ON users.id = group_members.user_id INNER JOIN `groups` ON `groups`.id = group_members.group_id INNER JOIN messages ON messages.id = groups.last_message_id WHERE group_members.group_id IN (?) AND group_members.user_id != ?;', [privateGroups, userID], function(error3, results3, fields3) {
							if(error3) throw error3;
							res.render('dashboard', {user: results[0], publicChat: results2[0], privateChat: results3});
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
				res.redirect('/');
			} else {
				res.render('login', {message: 'Nieprawidłowy login lub hasło!'});
			}
		}
	});
}