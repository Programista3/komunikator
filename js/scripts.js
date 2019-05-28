var search = false;
var searchMode = 0;
var socket = io();
var pickr;

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
	$('.message-list').html('');
	messages.forEach(function(message) {
		if(message.sender_id == userID) {
			if(message.removed !== null) {
				$('<li style="text-align: right"><span class="message msg-own removed" style="background-color: #'+color+';'+color+';'+(parseInt(color, 16) > 12000000 ? 'color: #2d2d2d;' : '')+'" title="Nadawca: '+message.sender+'\r\nWysłano: '+message.sent+'\r\nUsunięto: '+message.removed+'" data-id="'+message.id+'">'+message.text+'</span></li>').appendTo('.message-list').children().text(message.text);
			} else {
				$('<li style="text-align: right"><span class="message msg-own" style="background-color: #'+color+';'+(parseInt(color, 16) > 12000000 ? 'color: #2d2d2d;' : '')+'" title="Nadawca: '+message.sender+'\r\nWysłano: '+message.sent+'" data-id="'+message.id+'"></span></li>').appendTo('.message-list').children().text(message.text);
			}
		} else if(message.sender_id == null) {
			$('<li style="text-align: center"><span class="msg-info" title="'+message.sent+'">'+message.text+'</span></li>').appendTo('.message-list').children().text(message.text);
		} else {
			if(message.removed !== null) {
				$('<li><span class="message msg-default removed" title="Nadawca: '+message.sender+'\r\nWysłano: '+message.sent+'\r\nUsunięto: '+message.removed+'">'+message.text+'</span></li>').appendTo('.message-list').children().text(message.text);
			} else {
				$('<li><span class="message msg-default" title="Nadawca: '+message.sender+'\r\nWysłano: '+message.sent+'">'+message.text+'</span></li>').appendTo('.message-list').children().text(message.text);
			}
		}
	});
	$('.messages').scrollTop($('.messages').prop('scrollHeight'));
}

function updateChatInfo(chat) {
	if(chat) {
		$('.chat-info > header > h3').text(chat.name);
		if(chat.private) {
			$('.options').html('<li><i class="icon-user"></i>Nazwa użytkownika: '+chat.username+'</li><li><i class="icon-clock"></i>Data rejestracji: '+chat.register_date+'</li><li class="set-color"><i class="icon-color-adjust"></i>Kolor czatu: <span class="color-picker"></span></li><li class="option-active"><i class="icon-pencil"></i>Zmień nick</li>');
		} else {
			$('.options').html('<li><i class="icon-users"></i> '+chat.members+' członków</li><li><i class="icon-clock"></i>Utworzono '+chat.creation_date+'</li><li class="set-color"><i class="icon-color-adjust"></i>Kolor czatu: <span class="color-picker"></span></li><li class="option-active edit-name"><i class="icon-pencil"></i>Zmień nazwę</li><li class="option-active"><i class="icon-pencil"></i>Zmień nicki</li><li class="option-active add-members"><i class="icon-user-plus"></i>Dodaj osoby</li><li class="option-active remove-members"><i class="icon-user-times"></i>Usuń osoby</li>');
		}
	} else {
		$('.chat-info > header > h3').text('');
		$('.options').html('');
	}
	colorPicker("#"+chat.color);
}

function privateContextMenu(position, chatID) {
	$('body').append('<div id="ctmenu-chat" class="contextmenu"><ul><li class="leave-private" data-chat="'+chatID+'">Usuń czat</li></ul></div>');
	$('#ctmenu-chat').css({'top': position.top, 'left': position.left}).show();
}

function groupContextMenu(position, chatID) {
	$('body').append('<div id="ctmenu-chat" class="contextmenu"><ul><li class="leave-group" data-chat="'+chatID+'">Opuść czat</li></ul></div>');
	$('#ctmenu-chat').css({'top': position.top, 'left': position.left}).show();
}

function messageContextMenu(position, messageID) {
	$('body').append('<div id="ctmenu-chat" class="contextmenu"><ul><li class="delete-message" data-message="'+messageID+'">Usuń wiadomość</li></ul></div>');
	$('#ctmenu-chat').css({'top': position.top, 'left': position.left}).show();
}

function colorPicker(color) {
	pickr = new Pickr({
    el: '.color-picker',

    default: color,

    swatches: [
        'rgb(244, 67, 54)',
        'rgb(233, 30, 99)',
        'rgb(156, 39, 176)',
        'rgb(103, 58, 183)',
        'rgb(63, 81, 181)',
        'rgb(33, 150, 243)',
        'rgb(3, 169, 244)',
        'rgb(0, 188, 212)',
        'rgb(0, 150, 136)',
        'rgb(76, 175, 80)',
        'rgb(139, 195, 74)',
        'rgb(205, 220, 57)',
        'rgb(255, 235, 59)',
        'rgb(255, 193, 7)'
    ],

    components: {

        preview: true,
        opacity: false,
        hue: true,

        interaction: {
            hex: false,
            rgba: false,
            hsva: false,
            input: false,
            clear: false,
            save: true
        }
    }
	});
	pickr.on('save', function() {
		socket.emit('setChatColor', {color: pickr.getColor().toHEXA().toString().substr(1), groupID: parseInt(window.location.hash.slice(1))});
	});
}

function blurAnimation(element, blur, time, callback) {
	$(element).css({
		'filter': 'blur('+blur+'px)',
		'webkitFilter': 'blur('+blur+'px)',
		'mozFilter': 'blur('+blur+'px)',
		'oFilter': 'blur('+blur+'px)',
		'msFilter': 'blur('+blur+'px)',
		'transition':'all '+time+'s ease-out',
		'-webkit-transition':'all '+time+'s ease-out',
		'-moz-transition':'all '+time+'s ease-out',
		'-o-transition':'all '+time+'s ease-out'
	});
	setTimeout(callback, time*1000);
}

$(function () {
	if($('.color-picker').length > 0) {
		colorPicker('#'+$('.color-picker').text());
	}
	if($('.active').length) {
		window.location.hash = $('.active').data('id');
	}
	$('.message-list').scrollTop($('.message-list').prop('scrollHeight'));

	// Socket.IO
	socket.on('refresh', function(data) {
		if(['createChat', 'newMessage'].includes(data.type) && data.own === false) {
			$.playSound('/notification.mp3');
		} else if(data.type == 'createGroupChat') {
			$('.group-name').val('');
			$('.create-group-form').stop().animate({width: 'toggle'});
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
	socket.on('editMembers', function(data) {
		updateChatInfo(data.chat);
		updateMessages(data.messages, data.user2, data.chat.color);
		$('#people').find('li > div[data-id='+data.user1+']').parent().remove();
	});
	socket.on('error1', function(error) {
		alert(error.text);
	});
	socket.on('getChatName', function(data) {
		$('.chat-name').text(data.chat.name);
	});
	socket.on('changeTheme', function(theme) {
		if(theme) {
			blurAnimation('body', 10, 1, function() {
				$('body').addClass('dark');
				$('.btn-theme').prop('title', 'Włącz jasny motyw');
				blurAnimation('body', 0, 1);
			});
		} else {
			blurAnimation('body', 10, 1, function() {
				$('body').removeClass('dark');
				$('.btn-theme').prop('title', 'Włącz ciemny motyw');
				blurAnimation('body', 0, 1);
			});
		}
	});

	// JQuery
	$('.search-text').on('input', function() {
		if(!search) search = true;
		socket.emit('search', {query: $('.search-text').val(), mode: searchMode, groupID: parseInt(window.location.hash.slice(1))});
	});
	$('body').click(function(e) {
		if($('#ctmenu-chat').length) {
			$('#ctmenu-chat').remove();
		}
		if($(e.target).closest('.list').length == 0 && search && !$(e.target).hasClass('option-active')) {
			$('.search-text').val('');
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
		$('.search-text').val('');
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
			groupContextMenu({left: e.pageX, top: e.pageY}, $(this).data('id'));
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
	$(document.body).on('click', '.leave-group', function() {
		socket.emit('leaveGroupChat', {groupID: $(this).data('chat')});
	});
	$(document.body).on('click', '.delete-message', function() {
		socket.emit('deleteMessage', {messageID: $(this).data('message')});
	});
	$('#create-group-chat').click(function() {
		$('.create-group-form > input[type=text]').val('');
		$('.create-group-form').stop().animate({width: 'toggle'});
	});
	$('.create-group').click(function() {
		if($('.group-name').val() != "") {
			socket.emit('createGroupChat', {name: $('.group-name').val()});
		}
	});
	$(document.body).on('click', '.add-members', function() {
		if(!search) search = true;
		searchMode = 1;
		socket.emit('search', {query: '', mode: searchMode, groupID: parseInt(window.location.hash.slice(1))});
	});
	$(document.body).on('click', '.add-member', function() {
		socket.emit('addMember', {groupID: parseInt(window.location.hash.slice(1)), userID: $(this).data('id')});
	});
	$(document.body).on('click', '.remove-members', function() {
		if(!search) search = true;
		searchMode = 2;
		socket.emit('search', {query: '', mode: searchMode, groupID: parseInt(window.location.hash.slice(1))});
	});
	$(document.body).on('click', '.remove-member', function() {
		socket.emit('removeMember', {groupID: parseInt(window.location.hash.slice(1)), userID: $(this).data('id')});
	});
	$(document.body).on('click', '.edit-name', function() {
		if($('.chat-name').children().length == 0) {
			$('.chat-name').html('<input type="text" value="'+$('.chat-name').text().trim()+'"><i class="icon-ok edit-ok"></i><i class="icon-cancel edit-cancel"></i>');
		} else {
			socket.emit('getChatName', {groupID: parseInt(window.location.hash.slice(1))});
		}
	});
	$(document.body).on('click', '.edit-ok', function() {
		socket.emit('setChatName', {groupID: parseInt(window.location.hash.slice(1)), name: $('.chat-name > input').val()});
	});
	$(document.body).on('click', '.edit-cancel', function() {
		socket.emit('getChatName', {groupID: parseInt(window.location.hash.slice(1))});
	});
	$('.btn-theme').click(function() {
		socket.emit('changeTheme');
	});
});