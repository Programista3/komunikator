module.exports = (io) => {
	io.on('connection', function(socket) {
		if(socket.handshake.session.userID == null) {
			socket.disconnect();
			return false;
		} else {
			socket.userID = socket.handshake.session.userID;
			socket.user = socket.handshake.session.user;
			//console.log('Connected user with id: '+socket.userID);
		}
		socket.on('msg', function(data) {
			db.sendMessage(data.chat, socket.userID, data.message, function(users) {
				Object.keys(io.sockets.sockets).forEach(function(id) {
					if(users.includes(io.sockets.sockets[id].userID)) {
						db.getChats(io.sockets.sockets[id].userID, function(chats) {
							if(chats.length > 0) {
								db.getChatInfo(chats[0].id, io.sockets.sockets[id].userID, function(chat) {
									if(chat) {
										db.getMessages(chats[0].id, function(messages) {
											io.sockets.sockets[id].emit('refresh', {type: 'newMessage', userID: io.sockets.sockets[id].userID, chat: chat, chats: chats, messages: messages, own: (io.sockets.sockets[id].userID == socket.userID ? true : false)});
										});
									}
								});
							} else {
								io.sockets.sockets[id].emit('refresh', {type: 'newMessage', userID: io.sockets.sockets[id].userID, chats: chats, messages: [], own: (io.sockets.sockets[id].userID == socket.userID ? true : false)});
							}
						});
					}
				});
			})
			console.log('New message: '+data.message+' Chat: '+data.chat);
		});
		socket.on('getMessages', function(data) {
			db.userInGroup(data.chat, socket.userID, function(inGroup) {
				if(inGroup) {
					db.getChatInfo(data.chat, socket.userID, function(chat) {
						if(chat) {
							db.getMessages(data.chat, function(messages) {
								socket.emit('messageList', {chat: chat, messages: messages, id: socket.userID});
							});
						}
					});
				}
			});
		});
		socket.on('search', function(data) {
			if(data.mode == 0) {
				db.searchUser(data.query, socket.userID, function(results) {
					socket.emit('search', {mode: 0, results: results});
				});
			} else if(data.mode == 1) {
				db.userInGroup(data.groupID, socket.userID, function(inGroup) {
					if(inGroup) {
						db.searchOutsideGroup(data.query, data.groupID, function(results) {
							socket.emit('search', {mode: 1, results: results});
						});
					}
				});
			} else if(data.mode == 2) {
				db.userInGroup(data.groupID, socket.userID, function(inGroup) {
					if(inGroup) {
						db.searchInsideGroup(data.query, data.groupID, socket.userID, function(results) {
							socket.emit('search', {mode: 2, results: results});
						});
					}
				});
			}
		});
		socket.on('getChats', function() {
			db.getChats(socket.userID, function(chats) {
				socket.emit('getChats', {chats: chats});
			});
		})
		socket.on('openChat', function(data) {
			db.privateChatExists(socket.userID, data.id, function(results) {
				if(results.length > 0) {
					db.getChats(socket.userID, function(chats) {
						if(chats.map(({id}) => id).includes(results[0].id) == false) {
							chats.unshift(results[0]);
						}
						db.getChatInfo(results[0].id, socket.userID, function(chat) {
							if(chat) {
								db.getMessages(results[0].id, function(messages) {
									socket.emit('refresh', {type: 'openChat', userID: socket.userID, chat: chat, chats: chats, messages: messages});
								});
							}
						});
					});
				} else {
					db.createPrivateChat({id: socket.userID, firstname: socket.user.firstname}, data.id, function(groupID) {
						db.getChats(socket.userID, function(chats) {
							if(chats.length > 0) {
								db.getChatInfo(chats[0].id, socket.userID, function(chat) {
									if(chat) {
										db.getMessages(chats[0].id, function(messages) {
											socket.emit('refresh', {type: 'createChat', userID: socket.userID, chat: chat, chats: chats, messages: messages, own: true});
										});
									}
								});
							} else {
								socket.emit('refresh', {type: 'createChat', userID: socket.userID, chats: chats, messages: [], own: true});
							}
						});
						for(var id in io.sockets.sockets) {
							if(io.sockets.sockets[id].userID == data.id) {
								db.getChats(data.id, function(chats) {
									if(chats.length > 0) {
										db.getChatInfo(chats[0].id, data.id, function(chat) {
											if(chat) {
												db.getMessages(chats[0].id, function(messages) {
													io.sockets.sockets[id].emit('refresh', {type: 'createChat', userID: data.id, chat: chat, chats: chats, messages: messages, own: false});
												});
											}
										});
									} else {
										io.sockets.sockets[id].emit('refresh', {type: 'createChat', userID: data.id, chats: chats, messages: [], own: false});
									}
								});
								break;
							}
						}
					});
				}
			});
		});
		socket.on('removePrivateChat', function(data) {
			db.getUsersInGroup(data.groupID, function(users) {
				if(users.includes(socket.userID)) {
					db.removeChat(data.groupID, function() {
						Object.keys(io.sockets.sockets).forEach(function(id) {
							if(users.includes(io.sockets.sockets[id].userID)) {
								db.getChats(io.sockets.sockets[id].userID, function(chats) {
									if(chats.length > 0) {
										db.getChatInfo(chats[0].id, io.sockets.sockets[id].userID, function(chat) {
											if(chat) {
												db.getMessages(chats[0].id, function(messages) {
													io.sockets.sockets[id].emit('refresh', {type: 'removeChat', userID: io.sockets.sockets[id].userID, chat:chat, chats: chats, messages: messages});
												});
											}
										});
									} else {
										io.sockets.sockets[id].emit('refresh', {type: 'removeChat', userID: io.sockets.sockets[id].userID, chats: chats, messages: []});
									}
								});
							}
						});
					});
				}
			});
		});
		socket.on('leaveGroupChat', function(data) {
			db.getUsersInGroup(data.groupID, function(users) {
				if(users.includes(socket.userID)) {
					db.leaveGroupChat(data.groupID, {id: socket.userID, firstname: socket.user.firstname}, function() {
						Object.keys(io.sockets.sockets).forEach(function(id) {
							if(users.includes(io.sockets.sockets[id].userID)) {
								db.getChats(io.sockets.sockets[id].userID, function(chats) {
									if(chats.length > 0) {
										db.getChatInfo(chats[0].id, io.sockets.sockets[id].userID, function(chat) {
											if(chat) {
												db.getMessages(chats[0].id, function(messages) {
													io.sockets.sockets[id].emit('refresh', {type: 'leaveChat', userID: io.sockets.sockets[id].userID, chat:chat, chats: chats, messages: messages});
												});
											}
										});
									} else {
										io.sockets.sockets[id].emit('refresh', {type: 'leaveChat', userID: io.sockets.sockets[id].userID, chats: chats, messages: []});
									}
								});
							}
						});
					});
				}
			});
		});
		socket.on('deleteMessage', function(data) {
			db.getMessageInfo(data.messageID, function(message) {
				if(message) {
					if(message.sender_id == socket.userID && message.removed === null) {
						db.getUsersInGroup(message.group_id, function(users) {
							if(users.includes(socket.userID)) {
								db.removeMessage(data.messageID, function() {
									Object.keys(io.sockets.sockets).forEach(function(id) {
										if(users.includes(io.sockets.sockets[id].userID)) {
											db.getChatInfo(message.group_id, io.sockets.sockets[id].userID, function(chat) {
												if(chat) {
													db.getMessages(message.group_id, function(messages) {
														io.sockets.sockets[id].emit('deleteMessage', {userID: io.sockets.sockets[id].userID, chat: chat, messages: messages});
													});
												}
											});
										}
									});
								});
							}
						});
					}
				}
			});
		});
		socket.on('addMember', function(data) {
			db.userInGroup(data.groupID, socket.userID, function(inGroup) {
				if(inGroup) {
					db.getUserInfo(data.userID, function(error, user) {
						if(error == null) {
							db.getUsersInGroup(data.groupID, function(users) {
								if(!users.includes(data.userID)) {
									db.addMember(data.groupID, {id: socket.userID, firstname: socket.user.firstname}, {id: data.userID, fullname: (user.firstname+' '+user.lastname)}, function() {
										db.getChatInfo(data.groupID, socket.userID, function(chat) {
											db.getMessages(data.groupID, function(messages) {
												socket.emit('editMembers', {user1: data.userID, user2: socket.userID, chat: chat, messages: messages});
											});
										});
										Object.keys(io.sockets.sockets).forEach(function(id) {
											if(users.includes((io.sockets.sockets[id].userID) && io.sockets.sockets[id].userID != socket.userID) || io.sockets.sockets[id].userID == data.userID) {
												db.getChats(io.sockets.sockets[id].userID, function(chats) {
													if(chats.length > 0) {
														db.getChatInfo(chats[0].id, io.sockets.sockets[id].userID, function(chat) {
															if(chat) {
																db.getMessages(chats[0].id, function(messages) {
																	io.sockets.sockets[id].emit('refresh', {type: 'newMessage', userID: io.sockets.sockets[id].userID, chat: chat, chats: chats, messages: messages, own: false});
																});
															}
														});
													} else {
														io.sockets.sockets[id].emit('refresh', {type: 'newMessage', userID: io.sockets.sockets[id].userID, chats: chats, messages: [], own: false});
													}
												});
											}
										});
									});
								}
							});
						}
					});
				}
			});
		});
		socket.on('removeMember', function(data) {
			db.userInGroup(data.groupID, socket.userID, function(inGroup) {
				if(inGroup) {
					db.getUserInfo(data.userID, function(error, user) {
						if(error == null) {
							db.getUsersInGroup(data.groupID, function(users) {
								if(users.includes(data.userID)) {
									db.removeMember(data.groupID, {id: socket.userID, firstname: socket.user.firstname}, {id: data.userID, fullname: (user.firstname+' '+user.lastname)}, function() {
										db.getChatInfo(data.groupID, socket.userID, function(chat) {
											db.getMessages(data.groupID, function(messages) {
												socket.emit('editMembers', {user1: data.userID, user2: socket.userID, chat: chat, messages: messages});
											});
										});
										Object.keys(io.sockets.sockets).forEach(function(id) {
											if(users.includes(io.sockets.sockets[id].userID) && io.sockets.sockets[id].userID != socket.userID) {
												db.getChats(io.sockets.sockets[id].userID, function(chats) {
													if(chats.length > 0) {
														db.getChatInfo(chats[0].id, io.sockets.sockets[id].userID, function(chat) {
															if(chat) {
																db.getMessages(chats[0].id, function(messages) {
																	io.sockets.sockets[id].emit('refresh', {type: 'newMessage', userID: io.sockets.sockets[id].userID, chat: chat, chats: chats, messages: messages, own: false});
																});
															}
														});
													} else {
														io.sockets.sockets[id].emit('refresh', {type: 'newMessage', userID: io.sockets.sockets[id].userID, chats: chats, messages: [], own: false});
													}
												});
											}
										});
									});
								}
							});
						}
					});
				}
			});
		});
		socket.on('createGroupChat', function(data) {
			data.name.trim();
			if(/^[a-zA-Z0-9 !@#$%&()?_\-,.]+$/.test(data.name)) {
				db.createGroupChat(data.name, {id: socket.userID, firstname: socket.user.firstname}, function(groupID) {
					db.getChats(socket.userID, function(chats) {
						if(chats.length > 0) {
							db.getChatInfo(chats[0].id, socket.userID, function(chat) {
								if(chat) {
									db.getMessages(chats[0].id, function(messages) {
										socket.emit('refresh', {type: 'createGroupChat', userID: socket.userID, chat: chat, chats: chats, messages: messages, own: true});
									});
								}
							});
						} else {
							socket.emit('refresh', {type: 'createGroupChat', userID: socket.userID, chats: chats, messages: [], own: true});
						}
					});
				});
			} else {
				socket.emit('error1', {code: 0, text: 'Nazwa zawiera niedozwolone znaki!\r\nDozwolone znaki: a-zA-Z0-9 !@#$%&()?_-.,'});
			}
		});
		socket.on('getChatName', function(data) {
			db.userInGroup(data.groupID, socket.userID, function(inGroup){
				if(inGroup) {
					db.getChatInfo(data.groupID, socket.userID, function(chat) {
						socket.emit('getChatName', {chat: chat});
					});
				}
			});
		});
		socket.on('setChatName', function(data) {
			data.name.trim();
			if(/^[a-zA-Z0-9 !@#$%&()?_\-,.]+$/.test(data.name)) {
				db.getUsersInGroup(data.groupID, function(users) {
					if(users.includes(socket.userID)) {
						db.setChatName(data.groupID, data.name, {firstname: socket.user.firstname}, function() {
							Object.keys(io.sockets.sockets).forEach(function(id) {
								if(users.includes(io.sockets.sockets[id].userID)) {
									db.getChats(io.sockets.sockets[id].userID, function(chats) {
										if(chats.length > 0) {
											db.getChatInfo(chats[0].id, io.sockets.sockets[id].userID, function(chat) {
												if(chat) {
													db.getMessages(chats[0].id, function(messages) {
														io.sockets.sockets[id].emit('refresh', {type: 'rename', userID: io.sockets.sockets[id].userID, chat: chat, chats: chats, messages: messages, own: false});
													});
												}
											});
										} else {
											io.sockets.sockets[id].emit('refresh', {type: 'rename', userID: io.sockets.sockets[id].userID, chats: chats, messages: [], own: false});
										}
									});
								}
							});
						});
					}
				});
			} else {
				socket.emit('error1', {code: 0, text: 'Nazwa zawiera niedozwolone znaki!\r\nDozwolone znaki: a-zA-Z0-9 !@#$%&()?_-.,'});
			}
		});
		socket.on('setChatColor', function(data) {
			db.getUsersInGroup(data.groupID, function(users) {
				if(users.includes(socket.userID)) {
					db.setChatColor(data.groupID, data.color, {firstname: socket.user.firstname}, function() {
						Object.keys(io.sockets.sockets).forEach(function(id) {
							if(users.includes(io.sockets.sockets[id].userID)) {
								db.getChats(io.sockets.sockets[id].userID, function(chats) {
									if(chats.length > 0) {
										db.getChatInfo(chats[0].id, io.sockets.sockets[id].userID, function(chat) {
											if(chat) {
												db.getMessages(chats[0].id, function(messages) {
													io.sockets.sockets[id].emit('refresh', {type: 'setColor', userID: io.sockets.sockets[id].userID, chat: chat, chats: chats, messages: messages, own: false});
												});
											}
										});
									} else {
										io.sockets.sockets[id].emit('refresh', {type: 'setColor', userID: io.sockets.sockets[id].userID, chats: chats, messages: [], own: false});
									}
								});
							}
						});
					});
				}
			});
		});
		socket.on('changeTheme', function() {
			db.changeTheme(socket.userID, function(theme) {
				socket.emit('changeTheme', theme);
			});
		});
	});
};