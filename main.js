const express = require('express')  // https://expressjs.com/
const app = express()
const SpotifyWebApi = require('spotify-web-api-node');  // https://github.com/thelinmichael/spotify-web-api-node
const PORT_NO = 3000;

// Create new spotify node client lib instance
// Before making API calls that require users specific details, use spotifyApi.setAccessToken(...)
// method on this instance to set the accesstoken
let spotifyApi = new SpotifyWebApi({
    clientId: 'd52be6e576c84c7b977486ab6b5bac6d',
    clientSecret: 'c3f51e944e6545f0b9387719b1c228cb',
    redirectUri: 'http://' + (process.env.hostname || 'localhost') + ':' + PORT_NO + '/spotifyAuth'
});

// Generate and send user to spotify authorisation page if there is no
// authorisation code in req params
app.get('/spotifyAuth', (req, res) => {
    
    console.log('req to /spotifyAuth from', req.socket.remoteAddress, 'req.query:', req.query);

    // Returning from spotify authorization
    if (req.query.code) {
        // Retrieve an access token and a refresh token
        spotifyApi.authorizationCodeGrant(req.query.code).then(
            function (data) {
                console.log('The token expires in ' + data.body['expires_in']);
                console.log('The access token is ' + data.body['access_token']);
                console.log('The refresh token is ' + data.body['refresh_token']);

                // Send only script which will set accesstoken value in localStorage and redirect user back to homepage
                res.send(`<script>localStorage.setItem('accessToken', '${data.body['access_token']}'); document.location.href = document.location.origin</script>`)
            },
            function (err) {
                console.log('Something went wrong!', err);
                res.send(`Something went wrong!`)
            }
        );

    } else {

        const authURL = spotifyApi.createAuthorizeURL(['user-read-private', 'user-read-email'], 'state');
        res.redirect(authURL);  // send to spotify auth page

        console.log('Client sent to', authURL);
        
    }
})

// Retrieve details about the user
app.get('/getMe', (req, res) => {
    console.log('at list playlists', req.headers);

    spotifyApi.setAccessToken(req.headers.accesstoken);

    // Do search using the access token
    spotifyApi.getMe().then(
        function (data) {
            console.log(data.body);
            res.send(data.body);
        },
        function (err) {
            console.log('Something went wrong!', err);
            res.send(`"Something went wrong! ${err.toString()}"`);
        }
    );

})

// Serve any static files from www directory to clients
app.use(express.static('www'))

app.listen(PORT_NO, () => console.log('Express server listening on', (process.env.hostname || 'localhost') + ':' + PORT_NO))