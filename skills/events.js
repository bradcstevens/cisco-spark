module.exports = function(controller) {
    
        controller.on('bot_space_join', function(bot,message) {
          bot.reply(message, 'Hello, ' + message.original_message.data.personDisplayName + ', I am Mr. Meeseeks, the ServiceNow Bot!');
        });
    
    }