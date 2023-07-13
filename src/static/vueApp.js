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
        me: null,
        playlists: [],
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
    async mounted() {
        try {
            await this.getMe()
            await this.getMyPlaylists()
        } catch (error) {
            if (/Unauthorized/i.test(error)) {
                // Need to authenticate first
                this.accessToken = ''
            }
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
        }
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
        willBeDeleted(track) {
            return this.removeUsingTracks.some(tr => {
                // Determine if any artists are different
                tr.artists = tr.artists || [];
                track.artists = track.artists || [];
                if (tr.artists.length != track.artists.length) return false;
                for (const artist in tr.artists) {
                    if (!track.artists.includes(artist)) return false;
                }
                return tr.track.name.toLowerCase() == track.track.name.toLowerCase()
            })
        },
        async getMe() {
            const resp = await fetch('/getMe', this.apiRequestOptions);
            if (resp.status !== 200) throw new Error(await resp.text())
            this.me = await resp.json();
        },
        async getMyDetailsClicked() {
            try {
                await this.getMe()
            } catch (error) {
                alert(error)
            }
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
            const featuresByTrack = (await resp.json()).forEach((v, i) => {
                tracks[i].track = { ...tracks[i].track, ...v }
            })
            console.log('Track features:', featuresByTrack);
        },
        async deleteTracks(playlist, deleteURIs) {
            deleteURIs ||= this.removeFromTracks.filter(t => this.willBeDeleted(t)).map(tr => tr.track.uri)
            console.log('Deleting from playlist', playlist.id, 'tracks with uris:', deleteURIs);
            const resp = await fetch(`/deleteTracks?userID=${this.me.id}&playlistID=${playlist.id}`, {
                method: "POST", // *GET, POST, PUT, DELETE, etc.
                headers: {
                    ...this.apiRequestOptions.headers,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(deleteURIs)
            })
            const respObj = await resp.json();
            if (!respObj.error) {
                // Need to request the tracks in the playlist from which tracks were deleted again
                this.getPlaylistTracks(playlist)
            } else {
                console.warn('Backend returned error while trying to delete tracks', respObj.error);
            }
        },
        async removeTracksFromPlaylistOutsideBPMRange() {
            debugger
            // Get the features of all the tracks in the selected playlist if we dont already have them
            if (!this.removeFromTracks.every(tr => tr.track.tempo)) await this.getTracksFeatures(this.removeFromTracks)
            // Collect one or more low and high BPM input ranges via browser prompt comma separated.
            // Example: 85-95,175-185 should result in 2 ranges of 85-95 and 175-185
            const ranges = prompt('Enter one or more BPM ranges to filter tracks by, comma separated. Example: 85-95,175-185', '85-95,175-185')
            // Split the ranges into an array
            const rangesArray = ranges.split(',')
            // Filter out any empty strings
            const rangesArrayFiltered = rangesArray.filter(r => r)
            // For each range, split it into min and max BPM
            const rangesArrayFilteredSplit = rangesArrayFiltered.map(r => r.split('-'))
            // For each range, convert the min and max BPM to numbers
            const rangesArrayFilteredSplitNum = rangesArrayFilteredSplit.map(r => r.map(n => Number(n)))
            // Find tracks to be removed - any that dont fall into at least one of the ranges
            const tracksToRemove = this.removeFromTracks.filter(tr => !rangesArrayFilteredSplitNum.some(r => tr.track.tempo >= r[0] && tr.track.tempo <= r[1]))
            // Confirm
            if (!confirm(`Are you sure you want to remove ${tracksToRemove.length} tracks from ${this.removeFrom.name}?`)) return
            // Delete the tracks from the playlist
            await this.deleteTracks(this.removeFrom, tracksToRemove.map(tr => tr.track.uri))
        }
    }
})