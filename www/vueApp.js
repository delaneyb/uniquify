/**
 * Methods for persisting our accessToken, playlists and user data to localStorage
 */
var lsCache = {
    fetch(key) {
        return JSON.parse(localStorage.getItem(key))
    },
    save(key, value) {
        localStorage.setItem(key, JSON.stringify(value))
    }
}

var vueApp = new Vue({
    el: '#app',
    data: {
        accessToken: lsCache.fetch('accessToken'),
        /** null if not logged in/undefined */
        me: lsCache.fetch('me'),
        playlists: lsCache.fetch('playlists'),
        playlistsFilter: '',
        /** playlist to remove songs from */
        removeFrom: undefined,
        /** array of playlists to look in for songs to remove from removeFrom */
        removeUsing: []
    },
    // Watch model change for localStorage persistance
    // Use deep watch on any objects that are going to have their child properties changed not just the whole object
    watch: {
        accessToken: lsCache.save.bind(null, 'accessToken'),
        me: lsCache.save.bind(null, 'me'),
        playlists: {
            handler: lsCache.save.bind(null, 'playlists'),
            deep: true  // Also make sure to save when we e.g. fetch the tracks within a playlist
        }
    },
    computed: {
        apiRequestOptions() {
            return {
                headers: {
                    accessToken: this.accessToken
                }
            }
        },
        /**
         * Returns a list of unique tracks in all the playlists we want to remove using
         */
        removeUsingTracks() {
            return this.sortedTracks(
                this.removeUsing.reduce((tracks, playlist) =>
                    // Concat tracks from the next playlist. Note its still possible to have duplicates if the song appears multiple times in a single playlist
                    tracks.concat(playlist.tracks.length ? playlist.tracks.filter(tr => !tracks.some(t => t.track.id == tr.track.id)) : []),
                [])
            )
        },
        removeFromTracks() {
            return (this.removeFrom && this.removeFrom.tracks.length) ? this.sortedTracks(this.removeFrom.tracks) : []
        },
    },
    methods: {
        /**
         * Reset playlists selected to remove from and remove using
         */
        resetSelection() {
            this.removeFrom = undefined;
            this.removeUsing = []
        },
        /**
         * Handler for when user clicks a playlist, either to select it as the one to remove
         * songs from, or as one of the playlists to remove songs using.
         * @param {any} playlist The playlist selected by the user
         */
        select(playlist) {
            // Time to retrieve the tracks within the playlist if we haven't previously
            if (!playlist.tracks.length) {
                this.getPlaylistTracks(playlist);
            }

            if (!this.removeFrom) {
                this.removeFrom = playlist
            } else if (!this.removeUsing.find(p => p.id == playlist.id)) {
                this.removeUsing.push(playlist)
            } else {
                // Take it back out of the list
                this.removeUsing.splice(this.removeUsing.findIndex(pl => pl.id == playlist.id), 1)
            }
        },
        sortedTracks(tracks) {
            return tracks.sort((trackA, trackB) => {
                return (trackA.track.artists.map(a => a.name).join() + trackA.track.name)
                    .localeCompare(trackB.track.artists.map(a => a.name).join() + trackB.track.name)
            })
        },
        async getMyDetails() {
            const resp = await fetch('/getMe', this.apiRequestOptions);
            this.me = await resp.json();
        },
        async getMyPlaylists() {
            const resp = await fetch(`/getPlaylists?userID=${this.me.id}`, this.apiRequestOptions);
            this.playlists = await resp.json();
        },
        async getPlaylistTracks(playlist) {
            const resp = await fetch(`/getPlaylistTracks?userID=${this.me.id}&playlistID=${playlist.id}`, this.apiRequestOptions);
            playlist.tracks = await resp.json();
        },
        async getTracksFeatures(tracks) {
            console.log(tracks.map(tr => tr.track.id))
            const resp = await fetch(`/getTracksFeatures`, {
                method: "POST",
                headers: {
                    ...this.apiRequestOptions,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    trackIDs: tracks.map(tr => tr.track.id)
                })
            });
            // Just update each track object, leaving it inside that particular playlist
            const featuresByTrack = (await resp.json()).body.audio_features.forEach((v, i) => {
                tracks[i].track = { ...tracks[i].track, ...v }
            })
            console.log('Track features:', featuresByTrack);
        },
        async deleteTracks(playlist, tracksToRemove) {
            const removeUsingURIs = this.removeUsingTracks.map(tr => tr.track.uri)
            const trackURIs = Array.from(new Set(removeUsingURIs.filter(uri => this.removeFromTracks.some(tr => tr.track.uri == uri))))
            console.log('Deleting from playlist', playlist.id, 'tracks with uris:', trackURIs);
            const resp = await fetch(`/deleteTracks?userID=${this.me.id}&playlistID=${playlist.id}`, {
                method: "POST", // *GET, POST, PUT, DELETE, etc.
                headers: {
                    ...this.apiRequestOptions.headers,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    trackURIs
                })
            })
            const respObj = await resp.json();
            if (!respObj.error) {
                // Need to request the tracks in the playlist from which tracks were deleted again
                this.getPlaylistTracks(playlist)
            } else {
                console.warn('Backend returned error while trying to delete tracks', respObj.error);
            }
        },
    }
})