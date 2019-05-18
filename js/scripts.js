function updateChats(chats) {
	$('#people').html('');
	if(chats.length > 0) {
		chats.forEach(function(chat, i) {
			$('#people').append('<li><a href="#'+chat.id+'" class="chat" data-id="'+chat.id+'" data-type="'+(chat.private ? 'private': 'public')+'">'+chat.name+'<span class="details">'+chat.text+'</span></a></li>');
		});
		$('#people').find('[data-id="'+window.location.hash.slice(1)+'"]').addClass('active');
	} else {
		$('#people').append('<div class="center"><i class="demo-icon icon-up"></i><br>Brak utworzonych czatów.<br>Wyszukaj osoby aby utworzyć czat</div>');
	}
}

function updateMessages(messages, userID, color) {
	$('#messages').html('');
	messages.forEach(function(message) {
		if(message.sender_id == userID) {
			if(message.removed !== null) {
				$('<li style="text-align: right"><span class="message msg-own removed" style="background-color: #'+color+';" title="Nadawca: '+message.sender+'\r\nWysłano: '+message.sent+'\r\nUsunięto: '+message.removed+'" data-id="'+message.id+'">'+message.text+'</span></li>').appendTo('#messages').children().text(message.text);
			} else {
				$('<li style="text-align: right"><span class="message msg-own" style="background-color: #'+color+';" title="Nadawca: '+message.sender+'\r\nWysłano: '+message.sent+'" data-id="'+message.id+'"></span></li>').appendTo('#messages').children().text(message.text);
			}
		} else if(message.sender_id == null) {
			$('<li style="text-align: center"><span class="msg-info" title="'+message.sent+'">'+message.text+'</span></li>').appendTo('#messages').children().text(message.text);
		} else {
			if(message.removed !== null) {
				$('<li><span class="message msg-default removed" title="Nadawca: '+message.sender+'\r\nWysłano: '+message.sent+'\r\nUsunięto: '+message.removed+'">'+message.text+'</span></li>').appendTo('#messages').children().text(message.text);
			} else {
				$('<li><span class="message msg-default" title="Nadawca: '+message.sender+'\r\nWysłano: '+message.sent+'">'+message.text+'</span></li>').appendTo('#messages').children().text(message.text);
			}
		}
	});
	$('.messages').scrollTop($('.messages').prop('scrollHeight'));
}

function updateChatInfo(chat) {
	if(chat) {
		$('.chat-info > header > h3').text(chat.name);
		if(chat.private) {
			$('.options').html('<li><i class="icon-user"></i>Nazwa użytkownika: '+chat.username+'</li><li><i class="icon-clock"></i>Data rejestracji: '+chat.register_date+'</li><li class="option-active"><i class="icon-pencil"></i>Zmień nick</li><li class="option-active"><i class="icon-color-adjust"></i>Zmień kolor czatu</li>');
		} else {
			$('.options').html('<li><i class="icon-users"></i> '+chat.members+' członków</li><li><i class="icon-clock"></i>Utworzono '+chat.creation_date+'</li><li class="option-active"><i class="icon-pencil"></i>Zmień nazwę</li><li class="option-active"><i class="icon-pencil"></i>Zmień nicki</li><li class="option-active"><i class="icon-color-adjust"></i>Zmień kolor czatu</li><li class="option-active"><i class="icon-user-plus"></i>Dodaj osoby</li><li class="option-active"><i class="icon-user-times"></i>Usuń osoby</li>');
		}
	} else {
		$('.chat-info > header > h3').text('');
		$('.options').html('');
	}
	
}

function privateContextMenu(position, chatID) {
	$('body').append('<div id="ctmenu-chat" class="contextmenu"><ul><li class="leave-private" data-chat="'+chatID+'">Usuń czat</li></ul></div>');
	$('#ctmenu-chat').css({'top': position.top, 'left': position.left}).show();
}

function messageContextMenu(position, messageID) {
	$('body').append('<div id="ctmenu-chat" class="contextmenu"><ul><li class="delete-message" data-message="'+messageID+'">Usuń wiadomość</li></ul></div>');
	$('#ctmenu-chat').css({'top': position.top, 'left': position.left}).show();
}

$(function () {
	var search = false;
	var searchMode = 0;
	var socket = io();
	if($('.active').length) {
		window.location.hash = $('.active').data('id');
	}
	$('.messages').scrollTop($('.messages').prop('scrollHeight'));

	// Socket.IO
	socket.on('refresh', function(data) {
		if(['createChat', 'newMessage'].includes(data.type) && data.own === false) {
			$.playSound('/notification.mp3');
		}
		if(data.chats.length > 0) {
			window.location.hash = data.chat.id;
			updateChats(data.chats);
			updateMessages(data.messages, data.userID, data.chat.color);
			updateChatInfo(data.chat);
		} else {
			updateChats([]);
			updateMessages([]);
			updateChatInfo(false);
		}
	});
	socket.on('search', function(data) {
		$('#people').html('');
		data.results.forEach(user => {
			if(searchMode == 0) {
				$('#people').append('<li><div class="person">'+user.firstname+' '+user.lastname+' (@'+user.username+')</div><div title="Utwórz czat" class="search-btn openChat" data-id="'+user.id+'"><i class="demo-icon icon-comment"></div></li>');
			} else if(searchMode == 1) {
				$('#people').append('<li><div class="person">'+user.firstname+' '+user.lastname+' (@'+user.username+')</div><div title="Dodaj do czatu" class="search-btn add-member" data-id="'+user.id+'"><i class="demo-icon icon-plus"></div></li>');
			} else if(searchMode == 2) {
				$('#people').append('<li><div class="person">'+user.firstname+' '+user.lastname+' (@'+user.username+')</div><div title="Usuń z czatu" class="search-btn remove-member" data-id="'+user.id+'"><i class="demo-icon icon-minus"></div></li>');
			}
		});
	});
	/*socket.on('disconnect', function() {
		window.location.href = '/login';
	});*/
	socket.on('messageList', function(data) {
		updateMessages(data.messages, data.id, data.chat.color);
		updateChatInfo(data.chat);
	});
	socket.on('getChats', function(data) {
		updateChats(data.chats, data.user_id);
	});
	socket.on('deleteMessage', function(data) {
		if(window.location.hash == "#"+data.chat.id.toString()) {
			updateMessages(data.messages, data.userID, data.chat.color);
		}
	});

	// JQuery
	$('#search').on('input', function() {
		if(!search) search = true;
		socket.emit('search', {query: $('#search').val(), mode: searchMode, groupID: parseInt(window.location.hash.slice(1))});
	});
	$('body').click(function(e) {
		if($('#ctmenu-chat').length) {
			$('#ctmenu-chat').remove();
		}
		if($(e.target).closest('.list').length == 0 && search && !$(e.target).hasClass('option-active')) {
			$('#search').val('');
			socket.emit('getChats');
			search = false;
			searchMode = 0;
		}
	});
	$(document.body).on('click', '.chat', function() {
		$('.active').removeClass('active');
		$(this).addClass('active');
		socket.emit('getMessages', {chat: $(this).data('id')});
	});
	$(document.body).on('click', '.openChat', function() {
		socket.emit('openChat', {id: $(this).data('id')});
		$('#search').val('');
	});
	$('#send').click(function(e) {
		e.preventDefault();
		var id = window.location.hash.substr(1);
		if(id !== '' && $('#msg').val() !== '') {
			socket.emit('msg', {message: $('#msg').val(), chat: id});
			$('#msg').val('');
		}
	});
	$(document.body).on('contextmenu', function(e) {
		e.preventDefault();
	});
	$(document.body).on('contextmenu', '.chat', function(e) {
		if($('.contextmenu').length) {
			$('.contextmenu').remove();
		}
		if($(this).data('type') == 'private') {
			privateContextMenu({left: e.pageX, top: e.pageY}, $(this).data('id'));
		} else if($(this).data('type') == 'public') {
			// public chat context menu
		}
	});
	$(document.body).on('contextmenu', '.msg-own', function(e) {
		if($('.contextmenu').length) {
			$('.contextmenu').remove();
		}
		if(!$(this).hasClass('removed')) {
			messageContextMenu({left: e.pageX, top: e.pageY}, $(this).data('id'));
		}
	});
	$(document.body).on('click', '.leave-private', function() {
		socket.emit('removePrivateChat', {groupID: $(this).data('chat')});
	});
	$(document.body).on('click', '.delete-message', function() {
		socket.emit('deleteMessage', {messageID: $(this).data('message')});
	});
	$('#create-group-chat').click(function() {
		$('.create-group-form > input[type=text]').val('');
		$('.create-group-form').stop().animate({width: 'toggle'});
	});
	$(document.body).on('click', '.add-members', function() {
		if(!search) search = true;
		searchMode = 1;
		socket.emit('search', {query: '', mode: searchMode, groupID: parseInt(window.location.hash.slice(1))});
	});
	$(document.body).on('click', '.add-member', function() {
		socket.emit('addMember', {groudID: parseInt(window.location.hash.slice(1)), userID: $(this).data('id')});
		$('#search').val('');
	});
	$(document.body).on('click', '.remove-members', function() {
		if(!search) search = true;
		searchMode = 2;
		socket.emit('search', {query: '', mode: searchMode, groupID: parseInt(window.location.hash.slice(1))});
	});
});