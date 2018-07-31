const express = require('express')
const app = express()
const SpotifyWebApi = require('spotify-web-api-node');
const PORT_NO = 3000;

// credentials are optional
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


app.get('/playlists', (req, res) => {
    console.log('at list playlists', req.headers);

    spotifyApi.setAccessToken(req.headers.accesstoken);

    // Do search using the access token
    spotifyApi.getMe().then(
        function (data) {
            console.log(data.body);
        },
        function (err) {
            console.log('Something went wrong!', err);
        }
    );

})

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
        }
    );

})


app.use(express.static('www'))

app.listen(PORT_NO, () => console.log('Express server listening on', (process.env.hostname || 'localhost') + ':' + PORT_NO))