## Description
Thrown together in about 5 hours, also my first Vue project.

**Frontend:**
Vue.js 2
Single page app, single component

**Backend:**
Node JS
Express
[spotify-web-api-node](https://github.com/thelinmichael/spotify-web-api-node)

## Repository structure
**main.js** API (Express) and Spotify API functions


**src/static**

 - **index.html** Served by default on visiting /. Contains main vue component template
 
 - **vueApp.js** Vue js component definition
 
 - **style.css** basic box-sizing fix, fonts and some flexbox/grid layout

 

## Setup
### Clone & install dependencies
```
git clone https://github.com/delaneyb/uniquify.git
cd uniquify
npm i
```


## Running:
- Create a new file named .env in the same directory as main.js and add your spotify client id and secret using this template:
```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```
- run `npm start` or `nodemon --inspect main.js`
- debug your running node instance by visiting chrome://inspect/
