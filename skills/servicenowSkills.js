module.exports = function(controller) {

        // CREATE Conversation - Create a ServiceNow Ticket
        controller.hears(['^create ticket$'], 'direct_mention, direct_message', function(bot, message) {
          let dialogData = {};

            bot.createConversation(message, function(err, convo) {
              // Create Error Thread
              convo.addMessage({
                text: 'I was unable to create your ticket - sorry about that!  {{vars.error}}'
              }, 'error');
  
              convo.addMessage({
                text: "Sorry, I didn't understand, please enter 'yes' or 'no'",
                action: 'default',
              }, 'bad_yesno');

              convo.addMessage({
                text: "Sorry, I didn't understand, please enter 'high', 'medium', or 'low'",
                action: 'default',
              }, 'bad_urgency');

              convo.addMessage({
                text: 'Create a new ServiceNow Ticket?  Oooo yeah, caan doo!',
              }, 'default');

              convo.addQuestion({text: 'Can you give me a description of the problem?'}, function(res, convo) {
                convo.gotoThread('get_urgency');
              },{key: 'short_description'}, 'default');

              convo.addQuestion({text: 'Got it! What level of urgency? [high, medium, low]'}, function(res, convo) {
                convo.gotoThread('add_notes');
              },{key: 'urgency'}, 'get_urgency');
  
              convo.addQuestion('Would you like to add any additional notes? [yes, no]', [
                {
                  pattern:  bot.utterances.yes,
                  callback:  function(response, convo) {
                    convo.gotoThread('get_notes');
                  }, 
                },
                {
                  pattern:  bot.utterances.no,
                  callback:  function(response, convo) {
                    convo.gotoThread('completed');
                  },
                },
                {
                  default:  true,
                  callback:  function(response, convo) {
                    convo.gotoThread('bad_yesno');
                  },
                }
              ],{},'add_notes');

              convo.addQuestion({text: 'What other notes should I add to the ticket?'}, function(res, convo) {
                convo.gotoThread('completed');
              },{key: 'notes'}, 'get_notes');

              convo.addMessage({
                text: 'Successfully created ticket with Incident Number {{vars.ticketnbr}}.  Goodbye.',
              }, 'completed');

              convo.beforeThread('completed', function(convo, next) {
                dialogData.short_description = convo.extractResponse('short_description');
                var urgency = convo.extractResponse('urgency');
                switch(urgency.toLowerCase()) {
                  case 'high':
                    dialogData.urgency = '1';
                    break;
                  case 'medium':
                    dialogData.urgency = '2';
                    break;
                  default:
                    dialogData.urgency = '3';
                }
                dialogData.notes = convo.extractResponse('notes');
                // Add ticket via ServiceNow API
                var serviceNow = require("../backends/servicenow/serviceNow.js");
                serviceNow.createTicket(dialogData, 'mrobinson').then (function(response) {
                  console.log('Status ' + response.status);
                  if (response.status == '201') {
                    console.log('Ticket Number ' + response.data.result.number);
                    convo.setVar('ticketnbr', response.data.result.number);
                    next();
                  }
                  else {
                    convo.setVar('error', 'ServiceNow API returned status ' + response.status + '.');
                    convo.gotoThread('error');
                    next(err);
                  }

                }).catch(function(err) {
                  convo.setVar('error', err);
                  convo.gotoThread('error');
                  next(err);
                });

              });  // before 'completed' thread
  
              // Fire off this conversation
              convo.activate();

              // Fired at end of conversation - displays before ticket number is so this is removed for now
              //convo.on('end', function(convo) {
              //  if (convo.successful()) {
              //    bot.reply(message, 'Goodbye.');
              //  }
              //});

            });  // create conversation
        });  // hears 'create ticket'

        // HELLO Conversation - Display ServiceNow functionality
        controller.hears(['^hello$'], 'direct_mention, direct_message', function(bot, message) {
          bot.reply(message,"What can I do for you? [create ticket or update ticket]");
        });

        // HELP Conversation - Display Usage
        controller.hears(['^help$'], 'direct_mention, direct_message', function(bot, message) {
          var helpstr = 'I am Mr. Meeseeks!  Look at me - the ServiceNow Bot!\n\n' 
          + 'You can use the following commands:\n' 
          + '* create ticket - create a new ServiceNow ticket\n' 
          + '* update ticket - modify an existing ServiceNow ticket';
          bot.reply(message, helpstr);
        });

        // UPDATE Conversation - Update a ServiceNow Ticket
        controller.hears(['^update ticket$'], 'direct_mention, direct_message', function(bot, message) {
          let dialogData = {};
          bot.createConversation(message, function(err, convo) {
            // Update Error Threads
            convo.addMessage({
              text: 'I was unable to find your ticket - sorry about that!  {{vars.error}}'
            }, 'error_find');
            convo.addMessage({
              text: 'I was unable to update your ticket - sorry about that!  {{vars.error}}'
            }, 'error_update');

            convo.addMessage({
              text: "Sorry, I didn't understand, please enter 'work notes' or 'state'",
              action: 'default',
            }, 'bad_field');

            convo.addQuestion({text: "What is the number of the ticket you'd like to update?"}, function(res, convo) {
              convo.gotoThread('lemme_fetch');
            },{key: 'ticketnbr'}, 'default');

            convo.addMessage({
              text: "Let me fetch that ticket for you.",
              action: 'get_field'
            }, 'lemme_fetch');

            convo.addMessage({
              text: 'Successfully updated the notes on Incident Number {{vars.ticketnbr}}.  Goodbye.',
            }, 'completed_notes');

            convo.addMessage({
              text: 'Successfully updated the state on Incident Number {{vars.ticketnbr}}.  Goodbye.',
            }, 'completed_state');

            // Currently, the bot can only update Notes or State
            convo.addQuestion("What field would you like to modify? [work notes, state]", [
              {
                pattern:  'work notes',
                callback:  function(response, convo) {
                  convo.gotoThread('get_notes');
                }, 
              },
              {
                pattern:  'state',
                callback:  function(response, convo) {
                  convo.gotoThread('get_state');
                },
              },
              {
                default:  true,
                callback:  function(response, convo) {
                  convo.gotoThread('bad_field');
                },
              }
            ],{},'get_field');

            // Collect the Notes
            convo.addQuestion({text: 'Please enter the notes you wish to add:'}, function(res, convo) {
              convo.gotoThread('completed_notes');
            },{key: 'notes'}, 'get_notes');

            // Collect the new State
            // ** ToDo:  Get the current state from SN and verify they don't change to the same state - add error message if so
            convo.addQuestion({text: 'What shall I change the state to? [new, in progress, on hold, resolved, closed]'}, function(res, convo) {
              convo.gotoThread('completed_state');
            },{key: 'new_state'}, 'get_state');

            // Thread to look up the ticket number
            // Sets the Ticket Id in the dialog variable to be used
            // by the Put to ServiceNow
            convo.beforeThread('get_field', function(convo, next) {
              // Get ticket via ServiceNow API
              var serviceNow = require("../backends/servicenow/serviceNow.js");
              serviceNow.getTicketByNumber(convo.extractResponse('ticketnbr')).then (function(response) {
                if (response.status == '200') {
                  console.log(response);
                  console.log('Ticket Sys Id ' + response.data.result[0].sys_id);
                  convo.setVar('ticketnbr', convo.extractResponse('ticketnbr').toUpperCase());
                  // Collect the Ticket Id and current state
                  dialogData.ticketId = response.data.result[0].sys_id;
                  //dialogData.current_state = response.data.result[0].state;
                  next();
                }
                else {
                  convo.setVar('error', 'ServiceNow API returned status ' + response.status + '.');
                  convo.gotoThread('error_find');
                  next(err);
                }
              
              }).catch(function(err) {
                convo.setVar('error', err);
                convo.gotoThread('error_find');
                next(err);
              });
            });  // before 'get_field' thread

            // Thread to update the ServiceNow ticket with a new note
            // ** ToDo: collect the caller's ServiceNow User Id either via email address from Spark message or prompt for it
            // ** Currently hard-coded to 'mrobinson'  
            convo.beforeThread('completed_notes', function(convo, next) {
              // Update ticket via ServiceNow API
              var serviceNow = require("../backends/servicenow/serviceNow.js");
              serviceNow.updateTicket(dialogData.ticketId, convo.extractResponse('notes'), 'mrobinson').then (function(response) {
                if (response.status == '200') {
                  console.log('Successfully updated ticket notes');
                  next();
                }
                else {
                  convo.setVar('error', 'ServiceNow API returned status ' + response.status + '.');
                  convo.gotoThread('error_update');
                  next(err);
                }
                            
                }).catch(function(err) {
                  convo.setVar('error', err);
                  convo.gotoThread('error_update');
                  next(err);
                });
            });  // before 'completed_notes' thread

            // Thread to update the ServiceNow ticket state
            // ** ToDo: collect the caller's ServiceNow User Id either via email address from Spark message or prompt for it
            // ** Currently hard-coded to 'mrobinson'
            convo.beforeThread('completed_state', function(convo, next) {
              // Update ticket via ServiceNow API
              var state = convo.extractResponse('new_state');
              var new_state = '';
              switch(state.toLowerCase()) {
                case 'in progress':
                  new_state = '2';
                  break;
                case 'on hold':
                  new_state = '3';
                  break;
                case 'resolved':
                  new_state = '4';
                  break;
                case 'closed':
                  new_state = '5';
                  break;
                default:
                  new_state = '1';
              }
              var serviceNow = require("../backends/servicenow/serviceNow.js");
              serviceNow.updateTicketState(dialogData.ticketId, new_state, 'mrobinson').then (function(response) {
                if (response.status == '200') {
                  console.log('Successfully updated ticket state');
                  next();
                }
                else {
                  convo.setVar('error', 'ServiceNow API returned status ' + response.status + '.');
                  convo.gotoThread('error_update');
                  next(err);
                }
                            
                }).catch(function(err) {
                  convo.setVar('error', err);
                  convo.gotoThread('error_update');
                  next(err);
                });
            });  // before 'completed_state' thread

            // Fire off this conversation
            convo.activate();
            
            // Fired at end of conversation - displays prior to final message, so removed for now
            //convo.on('end', function(convo) {
            //  if (convo.successful()) {
            //    bot.reply(message, 'Goodbye.');
            //  }
            //});
          });  // create conversation
        });  // hears 'update ticket'
    }