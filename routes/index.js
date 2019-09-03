const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
	const userID = req.session.userID;
	if(userID) {
		db.getUserInfo(userID, function(error, user) {
			if(error) {
				res.render('error', {error: {code: 'Database error', message: error}});
			} else {
				db.getChats(userID, function(chats) {
					if(chats.length > 0) {
						db.getChatInfo(chats[0].id,	userID, function(chat) {
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
		res.redirect(process.env.BASE_URL+'/login');
	}
});

router.get('/login', (req, res) => {
	if(!req.session.userID) {
		res.render('login', {version: version});
	} else {
		res.redirect(process.env.BASE_URL+'/');
	}
});

router.post('/login', (req, res) => {
	const post = req.body;
	if(post.username === "" || post.password === "") {
		res.render('login', {message: 'Wypełnij wszystkie pola!', version: version});
	} else {
		db.userExists({login: post.username, password: post.password}, function(error, exists, user) {
			if(error) {
				res.render('error', {error: {code: 'Database error', message: error}});
			} else {
				if(exists) {
					if(user.blocked == false) {
						req.session.userID = user.id;
						req.session.user = {firstname: user.firstname};
						res.redirect(process.env.BASE_URL+'/');
					} else {
						res.render('login', {message: 'Twoje konto zostało zablokowane!', version: version});
					}
				} else {
					res.render('login', {message: 'Nieprawidłowy login lub hasło!', version: version});
				}
			}
		});
	}
});

router.get('/logout', (req, res) => {
	req.session.destroy(function() {
		res.redirect(process.env.BASE_URL+'/login');
	});
});

router.get('/register', (req, res) => {
	if(!req.session.userID) {
		res.render('register', {version: version});
	} else {
		res.redirect(process.env.BASE_URL+'/');
	}
});

router.post('/register', (req, res) => {
	const post = req.body;
	if(post.username === "" || post.password === "" || post.firstname === "" || post.lastname === "" || post.email === "" || post.passwordRepeat === "") {
		res.render('register', {message: 'Wypełnij wszystkie pola!', version: version});
	} else {
		if(!/^[a-zA-Zążźćęłńóś]+$/.test(post.firstname)) {
			res.render('register', {message: 'Imię zawiera niedozwolone znaki!', version: version});
		} else if(!/^[a-zA-Zążźćęłńóś]+$/.test(post.lastname)) {
			res.render('register', {message: 'Nazwisko zawiera niedozwolone znaki!', version: version});
		} else if(!/^[a-zA-Z0-9_]{3,15}$/.test(post.username)) {
			res.render('register', {message: "Nazwa użytkownika może zawierać tylko litery, cyfry, znak '_' i musi mieć od 3 do 15 znaków!", version: version});
		} else if(!/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(post.email)) {
			res.render('register', {message: 'Nieprawidłowy email!', version: version});
		} else if(!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(post.password)) {
			res.render('register', {message: 'Hasło musi zawierać conajmniej 8 znaków (litery oraz cyfry)!', version: version});
		} else if(post.password != post.passwordRepeat) {
			res.render('register', {message: 'Podane hasła nie są takie same!', version: version});
		} else {
			db.userExists({username: post.username, email: post.email}, function(error, exists, user) {
				if(!exists) {
					db.createUser(post, function() {
						res.redirect(process.env.BASE_URL+'/login');
					});
				} else {
					res.render('register', {message: 'Użytkownik o podanym loginie lub emailu już istnieje!', version: version});
				}
			});
		}
	}
});

router.get('/changelog', (req, res) => {
	res.render('changelog');
});

router.get('/info', (req, res) => {
	res.render('info');
});

module.exports = router;