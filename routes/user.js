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
					db.query('SELECT `groups`.id, `groups`.name, `groups`.private, `groups`.last_message FROM group_members INNER JOIN `groups` ON `groups`.id = group_members.group_id WHERE group_members.user_id = '+userID+' AND `groups`.private = 0;', function(error2, results2) {
						if(error2) throw error;
						res.render('dashboard', {user: results[0], publicChat: results2});
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