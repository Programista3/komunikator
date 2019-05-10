function updateChats(chats) {
	$('#people').html('');
	chats.forEach(function(chat, i) {
		$('#people').append('<li><a href="#'+chat.id+'" class="chat" data-id="'+chat.id+'">'+chat.name+'<span class="details">'+chat.text+'</span></a></li>');
	});
	$('#people').find('[data-id="'+window.location.hash.slice(1)+'"]').addClass('active');
}

function updateMessages(messages, userID) {
	$('#messages').html('');
	messages.forEach(function(message) {
		if(message.sender_id == userID) {
			$('#messages').append('<li style="text-align: right"><span class="message msg-own" title="Wysłano: '+message.sent+'">'+message.text+'</span></li>');
		} else if(message.sender_id == -1) {
			$('#messages').append('<li style="text-align: center"><span class="msg-info" title="'+message.sent+'">'+message.text+'</span></li>');
		} else {
			$('#messages').append('<li><span class="message msg-default" title="Wysłano: '+message.sent+'">'+message.text+'</span></li>');
		}
	});
}

$(function () {
	var search = false;
	var socket = io();
	window.location.hash = $('.active').data('id');

	// Socket.IO
	socket.on('message', function(data) {
		window.location.hash = data.chat;
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
		updateMessages(data.messages, data.id);
	});
	socket.on('getChats', function(data) {
		updateChats(data.chats, data.user_id);
	});
	socket.on('openChat', function(data) {
		window.location.hash = data.chatID;
		updateChats(data.chats);
		updateMessages(data.messages, data.userID);
	});

	// JQuery
	$('#search').on('input', function() {
		if(!search) search = true;
		socket.emit('search', {query: $('#search').val()});
	});
	$('body').click(function(e) {
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
		if(id != '' && $('#msg').val() != '') {
			socket.emit('msg', {message: $('#msg').val(), chat: id});
			$('#msg').val('');
		}
	});
});