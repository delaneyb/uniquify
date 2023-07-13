require('dotenv').config()
const express = require('express')  // https://expressjs.com/
var bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json())
const SpotifyWebApi = require('spotify-web-api-node');  // https://github.com/thelinmichael/spotify-web-api-node
const { default: nodeFetch } = require('node-fetch')
const path = require('path')
const { execSync } = require('child_process')
const PORT_NO = 30035;

// NOTE: Getting Unauthorized errors means you need to get a new access token (todo: add ability for backend to refresh access token)

var scopes = ['user-read-private', 'user-read-email', 'playlist-read-private', 'playlist-modify-public', 'playlist-modify-private', 'playlist-read-collaborative'],
    state = 'some-state-of-my-choice';

// Create new spotify node client lib instance
// Before making API calls that require users specific details, use spotifyApi.setAccessToken(...)
// method on this instance to set the accesstoken
// console.log(process.env.SPOTIFY_CLIENT_ID);
// console.log(process.env.SPOTIFY_CLIENT_SECRET);

let spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: 'http://' + (process.env.hostname || 'localhost') + ':' + PORT_NO + '/spotifyAuth'
});

// Serve any static files from static directory to clients. Do not use a relative path here i.e.
// 'static' or static files will not be served as epxected when the script is executed from outside
// its own dir e.g. `node src/main.js`
app.use(express.static(path.join(__dirname, 'static')))

app.use((req, res, next) => {
    console.log(`${req.socket.remoteAddress} requested ${req.url}`);
    if (req.query) console.log('req.query:', req.query);
    if (req.body) console.log('req.body:', req.body);
    if (req.headers.accesstoken) spotifyApi.setAccessToken(req.headers.accesstoken);
    next()
})

// Generate and send user to spotify authorisation page if there is no
// authorisation code in req params

/**
 * Endpoint for obtaining and setting access token on client side
 */
app.get('/spotifyAuth', (req, res) => {

    // Returning from spotify authorization
    if (req.query.code) {
        // Retrieve an access token and a refresh token
        spotifyApi.authorizationCodeGrant(req.query.code).then(
            function (data) {
                console.log('The token expires in ' + data.body['expires_in']);
                console.log('The access token is ' + data.body['access_token']);
                console.log('The refresh token is ' + data.body['refresh_token']);

                // Send only script which will set accesstoken value in localStorage and redirect user back to homepage
                res.send(`<script>localStorage.setItem('accessToken', JSON.stringify("${data.body['access_token']}")); document.location.href = document.location.origin</script>`)

            },
            function (err) {
                console.log('Something went wrong!', err);
                res.send(`Something went wrong!`)
            }
        );

    } else {

        const authURL = spotifyApi.createAuthorizeURL(scopes, state);
        res.redirect(authURL);  // send to spotify auth page

        console.log('Client sent to', authURL);

    }
})

/**
 * Endpoint for retrieving Me object from spotify
 */
app.get('/getMe', async (req, res) => {
    try {
        const data = await spotifyApi.getMe()
        console.log('Retrieved me object:', data.body);
        res.send(data.body);
    } catch (error) {
        res.status(500).send(`Error: ${error.message || error}`);
    }
})

/**
 * Endpoint for retrieving the users playlists
 */
app.get('/getPlaylists', async (req, res) => {
    res.send(await getAll(spotifyApi.getUserPlaylists.bind(spotifyApi), 50, req.query.userID))
})

/**
 * Endpoint for getting tracks in a given playlist
 */
app.get('/getPlaylistTracks', async (req, res) => {
    res.send(await getAll(spotifyApi.getPlaylistTracks.bind(spotifyApi), 100, req.query.userID, req.query.playlistID))
})

/**
 * Not clear why this fails so often. Try getting playlists again then calling it
 */
app.post('/getTracksFeatures', async (req, res) => {
    let resp = []
    const trackIds = req.body.trackIDs
    const batch_size = 100
    for (let i = 0; i < trackIds.length; i = i + batch_size) {
        const current_batch = trackIds.slice(i, i + batch_size)
        try {
            const current_resp = await spotifyApi.getAudioFeaturesForTracks(current_batch).then(data => data.body.audio_features)
            resp = [...resp, ...current_resp]
        } catch (error) {
            console.warn(error)
            res.status(500).send({ error })
            return
        }
    }
    res.send(resp)
});
/**
 * Remove all tracks passed from the specified playlist for the specified user
 */
app.post('/deleteTracks', async (req, res) => {
    const tracksToRemove = req.body.map(uri => ({
        uri
    }))
    // (Max 100 removals at a time)
    for (let i = 0; i < req.body.length; i += 100) {
        try {
            console.log('Request attempt to remove', tracksToRemove.length, 'tracks from', req.query.playlistID);
            
            const resp = await spotifyApi.removeTracksFromPlaylist(req.query.userID, req.query.playlistID, tracksToRemove.slice(i, i + 100))
            console.log('deleteTracks got response from spotify:', resp);
        } catch (error) {
            console.warn('deleteTracks got error from spotify:', error);
            res.status(400)
            res.send({ error })
        }
    }
    res.send({ removeCount: req.body.length })
})

/**
 * Gets in parallel all the items from a particular spotify endpoint that
 * by default can only return a certain maximum number per page
 * @param {(...args: any) => Promise<{ body: any }>} fn spotifyApi function that resolves to an object containing keys for items and total
 * @param {number} maxLimit max per page accepted by the spotify api
 * @param {Array<string>} args arguments to be passed to the function before the limit and offset param
 */
async function getAll(fn, maxLimit, ...args) {
    // Get the initial maxLimit items and determine total number
    let { items, total } = (await fn(...args, { limit: maxLimit })).body
    if (total > maxLimit) {
        // Request all other sets of 50 playlists in parallel so we have the users whole collection
        reqs = []
        for (let offset = maxLimit; offset < total; offset += maxLimit) {
            reqs.push(fn(...args, { limit: maxLimit, offset }))
        }
        (await Promise.all(reqs)).forEach((data, index) => {
            console.log('Appending response/items from request', index, ':', data.body);
            items.push(...data.body.items)
        })
    }
    return items
}


app.listen(PORT_NO, async () => {
    const url = `http://${(process.env.hostname || 'localhost')}:${PORT_NO}/`
    console.log(`Express server listening on ${url}`)

    try {
        // Try activate existing app window or launch new Chrome app window to the page
        const CHROME_CDP_PORT = 9333
        const existingTab = await (await nodeFetch(`http://127.0.0.1:${CHROME_CDP_PORT}/json`)).json()
            .then(tabs => tabs.find(t => t.url === url))
            .catch(err => console.warn(`Unable to get Chrome tabs: ${err}`))
        
            if (existingTab) {
            console.log(`Activating existing Chrome tab ${existingTab.id}`)
            await nodeFetch(`http://127.0.0.1:${CHROME_CDP_PORT}/json/activate/${existingTab.id}`)
        } else {
            console.log(`No existing Chrome tab found, launching new Chrome app window`)
            if (process.platform === 'win32') {
                execSync(`start chrome -ArgumentList "--new-window --app=${url}"`, { shell: 'powershell' })
            } else if (process.platform === 'darwin') {
                execSync(`open -n -b com.google.Chrome --args --app=${url}`)
            }
        }
    } catch (error) {
        console.log(`Unable to launch Chrome app window: ${error}`)
    }
})