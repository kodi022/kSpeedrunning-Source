# kSpeedrunning
A plugin for [omegga](https://github.com/brickadia-community/omegga).

Create and race on 'courses for the lowest time on your own course or between multiple courses!
Ability to edit your courses name, speed and checkpoint order and save it

## Install
`omegga install gh:Kodi022/kSpeedrunning`

## Usage

### Course Creation
Use certain bricks in a certain color to create a unique course
![Brickadia-Win64-Shipping_K7YyPoOPSi](https://user-images.githubusercontent.com/29390269/164554600-55087980-2a91-4d7b-9531-4b5ca21d4449.png)
For example this is a valid course made out of 3 zones,

The start zone uses Rooks

The checkpoint zone(s) uses Pawns

The end zone uses Knights

and all of the bricks are the exact same color. You can make the zones any size you want, the brick edge generation will handle it (unless its larger than a microbrick can be)


You can also have multiple checkpoints
![Brickadia-Win64-Shipping_phuRq2hqdD](https://user-images.githubusercontent.com/29390269/164557760-6aac11cb-65ed-4643-9b6d-37b0f91fc801.png)
But make sure you space the checkpoints out enough to not interfere with eachother

With multiple checkpoints, be sure you run /zoneorder to ensure people follow the correct path, as the auto generation does not know the correct order

A note about data in courses, they contain a editable speed option that is default to 1. It allows the getposition to run quicker for that course, allowing for accuracy at speeds faster than sprinting

### Commands
The common commands first,

`/start` will start you in the course you are in

`/stop` will stop your run and teleport you to the starting zone of that course

Now for the interesting one
`/speedrun` nests many other commands inside it that will be valuable for course makers. Many of them require Authorization through the config, and some even the config debug tick too

All options are not required in this command, allowing you to leave blank to get more info

`/speedrun` `(option)` `(option 2)` `(text)`
- save
- regen
- paintindex
- edit
  - name
  - order
  - speed
- debug
  - zoneinfo
  - mapcount
  - clearbricks
  - clearsavedmaps

examples `/speedrun save`  `/speedrun edit speed 4`  `/speedrun debug zoneinfo`

## Things to note
This plugin is fairly WIP, meaning it could unexpectedly error, and is also missing a few features that could be nice.

Features that may be planned
- records, with store saving
- teleport zones to send a player back a checkpoint
- afk player removal
- leaderboard generated out of bricks

..wip
