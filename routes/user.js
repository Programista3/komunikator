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
		res.render('dashboard');
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
		} else {
			if(results.length > 0) {
				console.log(results[0].id);
				req.session.userID = results[0].id;
				res.redirect('/');
			} else {
				res.render('login', {message: 'Nieprawidłowy login lub hasło!'});
			}
		}
	});
}