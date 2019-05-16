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
				$('<li style="text-align: right"><span class="message msg-own removed" style="background-color: #'+color+';" title="Wysłano: '+message.sent+'\r\nUsunięto: '+message.removed+'" data-id="'+message.id+'">'+message.text+'</span></li>').appendTo('#messages').children().text(message.text);
			} else {
				$('<li style="text-align: right"><span class="message msg-own" style="background-color: #'+color+';" title="Wysłano: '+message.sent+'" data-id="'+message.id+'"></span></li>').appendTo('#messages').children().text(message.text);
			}
		} else if(message.sender_id == -1) {
			$('<li style="text-align: center"><span class="msg-info" title="'+message.sent+'">'+message.text+'</span></li>').appendTo('#messages').children().text(message.text);
		} else {
			if(message.removed !== null) {
				$('<li><span class="message msg-default removed" title="Wysłano: '+message.sent+'\r\nUsunięto: '+message.removed+'">'+message.text+'</span></li>').appendTo('#messages').children().text(message.text);
			} else {
				$('<li><span class="message msg-default" title="Wysłano: '+message.sent+'">'+message.text+'</span></li>').appendTo('#messages').children().text(message.text);
			}
		}
	});
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
	var socket = io();
	if($('.active').length) {
		window.location.hash = $('.active').data('id');
	}

	// Socket.IO
	socket.on('refresh', function(data) {
		if(['createChat', 'newMessage'].includes(data.type) && data.own === false) {
			$.playSound('/notification.mp3');
		}
		window.location.hash = data.chatID;
		updateChats(data.chats);
		updateMessages(data.messages, data.userID);
	});
	socket.on('search', function(data) {
		$('#people').html('');
		data.results.forEach(user => {
			$('#people').append('<li><div class="person">'+user.firstname+' '+user.lastname+' (@'+user.username+')</div><div class="openChat" data-id="'+user.id+'"><i class="demo-icon icon-comment"></div></li>');
		});
	});
	/*socket.on('disconnect', function() {
		window.location.href = '/login';
	});*/
	socket.on('messageList', function(data) {
		updateMessages(data.messages, data.id, data.chat.color);
	});
	socket.on('getChats', function(data) {
		updateChats(data.chats, data.user_id);
	});
	socket.on('deleteMessage', function(data) {
		if(window.location.hash == "#"+data.chatID.toString()) {
			updateMessages(data.messages, data.userID);
		}
	});

	// JQuery
	$('#search').on('input', function() {
		if(!search) search = true;
		socket.emit('search', {query: $('#search').val()});
	});
	$('body').click(function(e) {
		if($('#ctmenu-chat').length) {
			$('#ctmenu-chat').remove();
		}
		if($(e.target).closest('.list').length == 0 && search) {
			$('#search').val('');
			socket.emit('getChats');
			search = false;
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
		messageContextMenu({left: e.pageX, top: e.pageY}, $(this).data('id'));
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
});