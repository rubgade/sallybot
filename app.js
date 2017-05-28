require('dotenv-extended').load();


var restify = require('restify');
var builder = require('botbuilder');
var Promise = require('bluebird');
var request = require('request-promise').defaults({ encoding: null });


var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var oauth2Client = new OAuth2(
  process.env.YOUR_CLIENT_ID,
  process.env.YOUR_CLIENT_SECRET,
  process.env.YOUR_REDIRECT_URL
);


var scopes = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly'
];

var url = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: 'offline',

  // If you only need one scope you can pass it as a string
  scope: scopes,

  // Optional property that passes state parameters to redirect URI
  // state: { foo: 'bar' }
});

// Setup Restify Server
var server = restify.createServer();
server.use(restify.queryParser());


server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

var savedAddress;

// Listen for messages from users
server.post('/api/messages', connector.listen());

server.get('/accesstoken', savetoken);

/*
// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector, function (session) {
    session.send("You said: %s", session.message.text);
});
*/



var bot = new builder.UniversalBot(connector);

bot.dialog('/', [
    function (session) {
        session.beginDialog('/askName', session.userData.profile);
    },
    function (session, results) {
        session.send('Hello %s!', results.response);
    },

]);
bot.dialog('/askName', [
    function (session,args,next) {
        session.dialogData.profile = args || {};
        if (!session.dialogData.profile.name) {
            builder.Prompts.text(session, "What's your name?");
        } else {
            next();
        }
    },
      function(session, results){
        if (results.response) {
            session.dialogData.profile.name = results.response;
        }
      savedAddress = session.message.address;
      var msg = new builder.Message(session)
          .text ("Hello %s!  To help you further you need to connect your google account", results.response)
          	.suggestedActions(
		            builder.SuggestedActions.create(
				session, [
					builder.CardAction.openUrl(session, url, "Google Login"),

				]
			));
      msg.attachmentLayout(builder.AttachmentLayout.carousel)
      msg.attachments( [
                new builder.SigninCard(session)
                .button('SignIn to Google',url )
      ]

      )

      session.send(msg);

    }

]);



function savetoken(req, res, next) {
 console.log("Code: %s" , req.params.code);
  //res.send('hello ' + req.params.code);
  sendProactiveMessage(savedAddress,req.params.code);
  res.send( "You have logged in successfully. Please continue your conversation with the Sally ");
  return next();


}


function listfiles () {

  var drive = google.drive({
  version: 'v3',
  auth: oauth2Client
  });

    var params = {pageSize: 3};

    drive.files.list(params, function (err, result) {
    if (err) {
      console.error(err);
      return;
    }
    console.log(result.files);
    });



}

function sendProactiveMessage(addr,code) {


  oauth2Client.getToken(code, function (err, tokens) {
  // Now tokens contains an access_token and an optional refresh_token. Save them.
  if (!err) {
    oauth2Client.setCredentials(tokens);
    console.log(tokens);
    listfiles();


  }
  });


  var msg = new builder.Message().address(addr);

  msg.text('You have successfully logged in and your OAuthCode is  :  %s', code);
  msg.textLocale('en-US');
  bot.send(msg);

}
