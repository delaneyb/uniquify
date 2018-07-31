WIP express + spotify-web-api-node simple web interface and API



### Clone & install dependencies

`git clone https://github.com/delaneyb/uniquify.git`

`cd uniquify`

`npm i`





### VS Code development setup:

1. Create the following VS code launch configuration in launch.json

```json
{
    "type": "node",
    "request": "attach",
    "name": "Attach",
    "port": 9229,
    "restart": true,
}
```

2. Install Nodemon: `npm i -g nodemon`
3. Run VS Code attach task
4. Launch Nodemon with debugging enabled `nodemon --inspect .\main.js`, wait for VS code attach