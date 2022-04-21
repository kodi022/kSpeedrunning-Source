const prettyMs = require('pretty-ms');

module.exports = class kSpeedrunning 
{
    constructor(omegga, config, store) 
    {
        this.omegga = omegga;
        this.config = config;
        this.store = store;
    }
    async init()
    {
        // Feature ideas:
        // Store saving for records
        // perhaps teleport zones to take you back to last cp
        // removal of afk players from actively watched players
        // brick generated leaderboard
        
        const debug = this.config['enable-debug'];
        const auth = this.config['authorized-users'];
        const sequential = this.config['force-checkpoint-sequence'];
        const saveOwnerName = this.config['bricks-owner-name'];
        const colorWhitelist = this.config['color-whitelist'];
        const startColor = this.config['zone-start-color'].split(',');
        const checkpointColor = this.config['zone-checkpoint-color'].split(',');
        const endColor = this.config['zone-end-color'].split(',');
        const brickMat = this.config['zone-brick-material'].split(',');
        const zoneThickness = Clamp(this.config['zone-brick-thiccness'], 1, 5);
        const sizeConsideration = this.config['checkpoint-size-consideration'];

        let zones = [];
        let storeZones = await this.store.get('zones') || [];
        let error = false;

        Generate();
        async function Generate() 
        {
            const save = await Omegga.getSaveData();
            
            if (save == undefined) 
            {
                GenerateError("No bricks to use");
                return;
            }

            const checkBrick = save.brick_assets.indexOf("B_Pawn");
            const startBrick = save.brick_assets.indexOf("B_Rook");
            const endBrick = save.brick_assets.indexOf("B_Knight");
            Omegga.clearBricks('ffffffff-ffff-ffff-ffff-ffffffff097b', {quiet: true});
            const saveOwner = {
                name: saveOwnerName,
                id: 'ffffffff-ffff-ffff-ffff-ffffffff097b'
            };
            let zonesBRS = {
                author: saveOwner,
                brick_assets: ['PB_DefaultMicrobrick'],
                materials: ['BMC_Glass', 'BMC_Glow', 'BMC_Hologram'],
                brick_owners: [saveOwner],
                bricks: [],
            };

            let pairs = [];
            let checkpoints = [];
            let starts = [];
            let ends = [];
            let colors = [];
            let brickAmount = 0;
            // collect all chosen zone bricks on map
            if (colorWhitelist.length == 0) 
            {
                for (let brick of save.bricks) 
                {
                    if (brick.asset_name_index == checkBrick) 
                    {
                        brickAmount++;
                        checkpoints.push({pos: brick.position, color: brick.color});     
                    } else if (brick.asset_name_index == startBrick) 
                    {
                        brickAmount++;
                        starts.push({pos: brick.position, color: brick.color});  
                    } else if (brick.asset_name_index == endBrick) 
                    {
                        brickAmount++;
                        ends.push({pos: brick.position, color: brick.color});
                    }
                }
            } else 
            {
                for (let brick of save.bricks) 
                {
                    if (colorWhitelist.includes(brick.color)) 
                    {
                        if (brick.asset_name_index == checkBrick) 
                        {
                            brickAmount++;
                            checkpoints.push({pos: brick.position, color: brick.color});     
                        } else if (brick.asset_name_index == startBrick) 
                        {
                            brickAmount++;
                            starts.push({pos: brick.position, color: brick.color});  
                        } else if (brick.asset_name_index == endBrick) 
                        {
                            brickAmount++;
                            ends.push({pos: brick.position, color: brick.color});
                        }
                    }
                }
            }

            // loop for each type of brick
            for (let i = 0; i < 3; i++) 
            {
                let iterator;
                switch (i) 
                {
                    case 0:
                        iterator = starts;
                        if (iterator.length % 2 == 1) 
                        {
                            error = true;
                            GenerateError("Odd number of valid start bricks");
                        }
                        break;
                    case 1:
                        iterator = checkpoints;
                        if (iterator.length % 2 == 1) 
                        {
                            error = true;
                            GenerateError("Odd number of valid checkpoint bricks");
                        }
                        break;
                    case 2:
                        iterator = ends;
                        if (iterator.length % 2 == 1) 
                        {
                            error = true;
                            GenerateError("Odd number of valid end bricks");
                        }
                        break;
                }
                if (error) return;

                // this gets a brick, finds distances of all bricks to it, and combines it and the closest one into a object in pairs
                while (iterator.length > 1)
                {
                    let brick1 = iterator[0];
                    let diffs = [];
    
                    for (let b in iterator)
                    {
                        let brick2 = iterator[b];
                        if (!colors.find(a => a == brick2.color)) colors.push(brick2.color);

                        if (b != 0 && brick2.color === brick1.color) 
                        {
                            let diff = Distance(brick1.pos, 0, brick2.pos);
                            diffs.push({diff: diff, key: b});
                        }
                    }
                    // split diff value from diff object to iterate to find smallest, then refind original key to remove
                    let diffsValues = [];
                    for (let b of diffs) diffsValues.push(b.diff);
    
                    let smallest = Math.min(...diffsValues);
                    let smallestdiff = diffs.find(p => p.diff == smallest);
                    pairs.push({point1: brick1.pos, point2: iterator[smallestdiff.key].pos, color: brick1.color, type: i});
                    iterator.splice(smallestdiff.key, 1);
                    iterator.splice(0,1);
                    setTimeout(() => {}, 15);
                }
            }

            CreateCourse();
            // this creates the final zone objects and generates bricks
            function CreateCourse()
            {
                let zonesObj = {name: "", start: {}, checkpoints: [], end: {}, data: {color: 0, speed: 1, modified: 0}};
                for (let cur of pairs) 
                {
                    for (let i = 0; i < 3; i++) 
                    {
                        if (cur.point1[i] == cur.point2[i]) 
                        {
                            switch(cur.type) 
                            {
                                case 0:
                                    GenerateError("Both bricks at a start zone share a coordinate");
                                    return;
                                case 1:
                                    GenerateError("Both bricks at a checkpoint zone share a coordinate");
                                    return;
                                case 2:
                                    GenerateError("Both bricks at a end zone share a coordinate");
                                    return;
                            }
                        }
                    }
                    // match current zone color  AND  is in colors array    OR    zone color is empty  AND  is in color array
                    if (zonesObj.data.color == (cur.color || 0) && colors.find(a => a == cur.color) != undefined || zonesObj.data.color == 0 && colors.find(a => a == cur.color) != undefined) 
                    {
                        let points = {point1: cur.point1, point2: cur.point2, center: [0,0,0], size: 0};
                        for (let i = 0; i < 3; i++)
                        {
                            if (points.point1[i] < points.point2[i])
                            {
                                let temp = points.point1[i];
                                points.point1[i] = points.point2[i];
                                points.point2[i] = temp;
                            }
                            points.center[i] = (points.point1[i] + points.point2[i]) / 2;   
                        }
                        points.size = Math.floor((Math.abs(points.point1[0]-points.point2[0]) + Math.abs(points.point1[1]-points.point2[1]) + Math.abs(points.point1[1]-points.point2[1])) / 3);

                        let brickColor;
                        switch (cur.type) 
                        {
                            case 0:
                                zonesObj.start = points;
                                brickColor = startColor;
                                break;
                            case 1:
                                zonesObj.checkpoints.push(points);
                                brickColor = checkpointColor;
                                break;
                            case 2:
                                zonesObj.end = points;
                                brickColor = endColor;
                                break;
                        }
                        zonesObj.data.color = cur.color;

                        // ending piece is taller so offset a little
                        let hOffset = 0;
                        if (cur.type === 2) hOffset = 2;

                        // maths to make the 12 bricks
                        for (let i = 0; i < 12; i++) 
                        {
                            let coord1;
                            let coord2;
                            (i % 2 == 0) ? coord1 = cur.point1 : coord1 = cur.point2;
                            (Math.floor(i/2) % 2 == 0) ? coord2 = cur.point1 : coord2 = cur.point2;
                            if (i < 4) 
                            {
                                zonesBRS.bricks.push( // horizontal 1
                                {
                                    size: [Math.abs(cur.point1[0]-cur.point2[0]) /2 -5, zoneThickness, zoneThickness], 
                                    position:[((cur.point1[0]-cur.point2[0]) /2) +cur.point2[0],
                                    (coord1[1]),
                                    (coord2[2]) -hOffset],
                                    collision: false, material_index: brickMat[0], material_intensity: brickMat[1],
                                    color: brickColor
                                });
                            } else if (i < 8) 
                            {
                                zonesBRS.bricks.push( // horizontal 2
                                {
                                    size: [zoneThickness, Math.abs(cur.point1[1]-cur.point2[1]) /2 -5, zoneThickness], 
                                    position:[coord1[0],
                                    (((cur.point1[1]-cur.point2[1]) /2) +cur.point2[1]),
                                    (coord2[2]) -hOffset],
                                    collision: false, material_index: brickMat[0], material_intensity: brickMat[1],
                                    color: brickColor
                                });
                            } else 
                            {
                                zonesBRS.bricks.push( // vertical
                                {
                                    size: [zoneThickness, zoneThickness, Math.abs(cur.point1[2]-cur.point2[2]) /2 -(8+hOffset)], 
                                    position:[coord1[0],
                                    coord2[1],
                                    (((cur.point1[2]-cur.point2[2]) /2) +cur.point2[2]) -hOffset],
                                    collision: false, material_index: brickMat[0], material_intensity: brickMat[1],
                                    color: brickColor
                                });
                            }
                        }
                    }        
                }
                if (zonesBRS.bricks.length == 0) 
                {
                    GenerateError("No zone bricks found")
                    return;
                }

                colors.splice(colors.indexOf(zonesObj.data.color), 1);
         
                zonesObj.name = `${zones.length}`;
                zones.push(zonesObj);
                Omegga.loadSaveData(zonesBRS, {quiet: true});

                if (colors.length > 0) 
                {
                    if (debug) console.info(`Courses left: ${colors.length}`);
                    setTimeout(() => {CreateCourse();}, 200);
                } else 
                {
                    // this loads saved zones.
                    for (let z in zones) 
                    {
                        let zn = zones[z];
                        for (let sz of storeZones) 
                        {
                            let matching = 0;
                            for (let i = 0; i < 3; i++) 
                            {
                                if (zn.end.point1[i] == sz.end.point1[i] && zn.end.point2[i] == sz.end.point2[i]) matching++;
                                if (zn.start.point1[i] == sz.start.point1[i] && zn.start.point2[i] == sz.start.point2[i]) matching++;
                            }
                            if (matching == 6)
                            {
                                if (debug) console.info(`Loaded saved zone`);
                                zones[z] = sz;
                            }
                        }
                    }
                    if (debug) 
                    {
                        console.info("Courses Generated.");
                        console.log(`zone-amount: ${zones.length}, zone-brick-amount: ${brickAmount}`);
                        console.log(`generated-brick-amount: ${zonesBRS.bricks.length}`);
                    }
                    error = false;
                    MainLoopInit();
                }
            }
        }



        const record = {map: "", data: {name: "", id: "", time: 0}};
        let playerArray = [];

        // allows loop to start after plugin init if course regen command is used
        function MainLoopInit() 
        {
            let initPlayers = Omegga.getPlayers();
            for (let i in initPlayers)
            {
                if (i >= 0) ModifyPlayerArray(false, initPlayers[i].id);
            }
            MainLoop();
        }

        let loopSpeed = 10; // ms
        let tick = 0;
        let tickThreshold = 99999;
        
        function MainLoop()
        {
            setTimeout(async () => 
            {
                for (let p of playerArray)
                {
                    if (p.active && p.data.nextUpdate <= tick) 
                    {
                        let distance;
                        let pos = await Omegga.getPlayer(p.name).getPosition();
                        let z = zones.find(z => z.name == p.data.currentMap);
                        let segment = p.data.checkpoint.findIndex(p => p === 0);
                        switch (sequential)
                        {
                            case true: // find distance to next checkpoint
                                if (segment != -1) // if all checkpoints passed, use end
                                {
                                    distance = ({distance: Distance(z.checkpoints[segment].center, z.checkpoints[segment].size, pos), key: segment});
                                    if (await InZone(z.checkpoints[segment], pos)) 
                                    {
                                        p.data.checkpoint[segment] = 1;
                                        let time = new Date().getTime();
                                        Omegga.whisper(p.name, `Checkpoint ${parseInt(segment)+1} / ${z.checkpoints.length} passed in ${prettyMs((time - p.data.startTime), {formatSubMilliseconds: true})}`);
                                    }
                                } else 
                                {
                                    if (await InZone(z.end, pos)) 
                                    {
                                        FinishedPlayer(p);
                                        continue;
                                    } else distance = ({distance: Distance(z.end.center, z.end.size, pos), key: 0});
                                }
                                break;
                            case false: // find distance to closest unpassed checkpoint
                                if (segment != -1) // if all checkpoints passed, use end
                                {
                                    for (let segment in z.checkpoints)
                                    {
                                        if (p.data.checkpoint[segment] == 0) 
                                        {
                                            let d = Distance(z.checkpoints[segment].center, z.checkpoints[segment].size, pos);
                                            if (distance == undefined || d < distance.distance) 
                                            {
                                                distance = ({distance: d, key: segment});
                                                if (await InZone(z.checkpoints[segment], pos)) 
                                                {
                                                    p.data.checkpoint[segment] = 1;
                                                    let time = new Date().getTime();
                                                    Omegga.whisper(p.name, `Checkpoint ${parseInt(segment)+1} passed in ${prettyMs((time - p.data.startTime), {formatSubMilliseconds: true})}`);
                                                }
                                            }
                                        }
                                    }
                                } else 
                                {
                                    if (await InZone(z.end, pos)) 
                                    {
                                        FinishedPlayer(p);
                                        continue;
                                    } else distance = ({distance: Distance(z.end.center, z.end.size, pos), key: 0});
                                }
                                break;
                        }

                        let speedExponent = 0.82;
                        let minCheck = 2;
                        switch (z.data.speed)
                        {
                            case 1:
                                speedExponent = 0.85;
                                minCheck = 2;
                                break;
                            case 2:
                                speedExponent = 0.77; // maybe some ramp boost
                                minCheck = 2;
                                break;
                            case 3:
                                speedExponent = 0.71; 
                                minCheck = 2;
                                break;
                            case 4: 
                                speedExponent = 0.65; // maybe rocketjump
                                minCheck = 1;
                                break;
                            case 5:
                                speedExponent = 0.59; // fast rocketjump/rampboostmap
                                minCheck = 1;
                                break;
                        }
                        let newNextUpdate = Math.ceil(Clamp(tick + (Math.max(distance.distance / 3, minCheck) ** speedExponent), 0, tick + 100));
                        if (newNextUpdate > tickThreshold) newNextUpdate -= tickThreshold;
                        p.data.nextUpdate = newNextUpdate;
                        if (debug) console.info(`${p.name}: distance: ${Math.ceil(distance.distance)}, NextPos:${(newNextUpdate - tick) * loopSpeed} ms`);
                    }
                }
                tick++;
                if (tick > tickThreshold)
                {
                    if (debug) console.info(`Tick reset to 0`);
                    tick = 0;
                }
            MainLoop();
            }, loopSpeed);
        }
        function FinishedPlayer(player) 
        {
            let time = new Date().getTime();
            let formattedTime = prettyMs((time - player.data.startTime), {formatSubMilliseconds: true});
            Omegga.broadcast(`${player.name} finished ${player.data.currentMap} in ${formattedTime}`);
            console.info(`${player.name} finished ${player.data.currentMap} in ${formattedTime}`);
            // also needs a record made, eventually saved on store too probably.
            ResetPlrData(player);
        }
        function ResetPlrData(plrObj) 
        {
            if (plrObj != undefined) 
            {
                plrObj.active = false;
                setTimeout(() => 
                {
                    plrObj.data.currentMap = "";
                    plrObj.data.startTime = 0;
                    plrObj.data.nextUpdate = 0;
                    plrObj.data.checkpoint = [];
                }, 20);
            }
        }


        // ADD LIST MAPS COMMAND
        Omegga.on("join", (player) => 
        {
            // timeout because Omegga.getPlayer() fails if ran immediately
            setTimeout(() => 
            {
                ModifyPlayerArray(false, player.id);
            }, 100)
        })
        Omegga.on("leave", (player) => 
        {
            ModifyPlayerArray(true, player.id);
        })


        Omegga.on("cmd:start", async (name) => 
        {
            let p = playerArray.find(p => p.name == name);
            if (p.active == 0) 
            {
                let inzone = false;
                for (let z of zones)
                {
                    if (await InZone(z.start, name))
                    {
                        inzone = true;
                        console.info(`${name} started map "${z.name}"`)
                        Omegga.whisper(name, "Go!");
                    
                        p.active = true;
                        p.data.currentMap = z.name;
                        p.data.checkpoint = new Array(z.checkpoints.length).fill(0);
                        p.data.startTime = new Date().getTime();
                        break;
                    }
                }
                if (!inzone) Omegga.whisper(name, "Not inside a start zone!");
            } else 
            {
                Omegga.whisper(name, "Already in a run, use <code>/stop</> to exit run");
            }
        })

        Omegga.on("cmd:stop", (name) => 
        {
            let plr = playerArray.find(p => p.name == name);
            if (plr.active) 
            {
                let zone = zones.find(z => z.name == plr.data.currentMap);
                this.omegga.writeln(`Chat.Command /TP "${name}" ${zone.start.center.join(" ")}`);
                Omegga.whisper(name, "Stopped run");
                setTimeout(() => 
                {
                    ResetPlrData(plr);
                }, 10)
            } else 
            {
                Omegga.whisper(name, "You are not in a run");
            }
        })

        Omegga.on("cmd:speedrun", async (name, option, value, ...value2) =>
        {
            switch (option) 
            {
                case 'save':
                    let savingZ = [];
                    for (let z of zones) 
                    {
                        if (z.data.modified == 1) 
                        {
                            savingZ.push(z);
                        }
                    }
                    await this.store.set('zones', savingZ);
                    Omegga.whisper(name, "Saved all modified zones");
                    break;
                case 'edit':
                    if (auth.find(c => c.name == name) != undefined) 
                    {
                        let inzone = false;
                        for (let z of zones) 
                        {
                            if (await InZone(z.start, name))
                            {
                                inzone = true;
                                switch (value) 
                                {
                                    case "name":
                                        if (value2 == "") 
                                        {
                                            Omegga.whisper(name, "Write out the command but now with mapname at the end");
                                            Omegga.whisper(name, "Example <code>/speedrun edit name Fun Course</>");
                                        } else 
                                        {
                                            let e = value2.join(" ");
                                            Omegga.whisper(name, `Set name of ${z.name} to ${e}`);
                                            z.name = e;
                                            z.data.modified = 1;
                                        }
                                        break;
                                    case "order":
                                        Omegga.whisper(name, "Order requires it's own command");
                                        Omegga.whisper(name, "So run <code>/zoneorder<'> to begin");
                                        break;
                                    case "speed":
                                        if (value2 == "") 
                                        {
                                            Omegga.whisper(name, "Write out the command but now with a speed number at the end");
                                            Omegga.whisper(name, "example <code>/speedrun edit speed 2</>");
                                        } else 
                                        {
                                            let num = parseInt(value2) || 1;
                                            let e = Clamp(num, 1, 5);
                                            Omegga.whisper(name, `Set speed of ${z.name} to ${e}`);
                                            z.data.speed = e
                                            z.data.modified = 1;
                                        }
                                        break;
                                    default:
                                        Omegga.whisper(name, "Options are (name, order, speed)");
                                        Omegga.whisper(name, "Example <code>/speedrun edit speed</>");
                                        break;
                                }
                                break;
                            }
                        }
                        if (!inzone) Omegga.whisper(name, "Not inside a start zone");
                    } else 
                    {
                        Omegga.whisper(name, "You are not authorized");
                        console.log(`${name} tried to run /speedrun edit!`);
                    }
                    break;
                case 'paintindex':
                    let selection = await Omegga.getPlayer(name).getTemplateBoundsData();
                    if (selection != undefined) 
                    {
                        if (selection.bricks.length == 1) 
                        {
                            Omegga.whisper(name, `Your selected paint index is ${selection.bricks[0].color}`);
                        } else  Omegga.whisper(name, `Too many bricks copied! One required`);    
                    } else 
                    {
                        Omegga.whisper(name, 'This command is purely for the color whitelist config');
                        Omegga.whisper(name, 'It requires you to use the selector and ctrl+c a single checkpoint brick');
                        Omegga.whisper(name, 'Run command again after doing so');
                    }
                    break;
                case 'regen':
                    if (auth.find(c => c.name == name) != undefined) 
                    {
                        Generate();
                        Omegga.whisper(name, "Regenerating all zones...");  
                    } else 
                    {
                        Omegga.whisper(name, "You are not authorized");
                        console.log(`${name} tried to run /speedrun regen!`);
                    }
                    break;
                case 'debug':
                    switch (value) 
                    {
                        case 'zoneinfo':
                            if (AuthDebug(name)) 
                            {
                                let inzone = false;
                                for (let z of zones) 
                                {
                                    if (await InZone(z.start, name)) 
                                    {
                                        inzone = true;
                                        console.info(z);
                                    }
                                }
                                if (inzone) 
                                {
                                    Omegga.whisper(name, `Wrote map to console.`);
                                } else Omegga.whisper(name, "Not inside a start zone");
                            } else 
                            {
                                Omegga.whisper(name, "Debug is off, or you are not authorized");
                                console.log(`${name} tried to run /speedrun zonesinfo!`);
                            }
                            break;
                        case 'mapcount':
                            if (AuthDebug(name)) 
                            {
                                Omegga.whisper(name, `There are ${zones.length} maps`);
                            } else 
                            {
                                Omegga.whisper(name, "Debug is off, or you are not authorized");
                                console.log(`${name} tried to run /speedrun debug mapcount!`);
                            }
                            break;
                        case 'clearbricks':
                            if (AuthDebug(name)) 
                            {
                                Omegga.clearBricks(saveOwner.id, {quiet: false});
                                Omegga.whisper(name, `Clearing ${saveOwner.name}'s bricks`);
                            } else 
                            {
                                Omegga.whisper(name, "Debug is off, or you are not authorized");
                                console.log(`${name} tried to run /speedrun debug clearbricks!`);
                            }
                            break;
                        case 'clearsavedmaps':
                            if (AuthDebug(name)) 
                            {
                                this.store.set('zones', []);
                                Omegga.whisper(name, 'Cleared saved maps');
                            } else 
                            {
                                Omegga.whisper(name, "Debug is off, or you are not authorized");
                                console.log(`${name} tried to run /speedrun debug clearsavedmaps!`);
                            }
                            break;
                        default:
                            Omegga.whisper(name, "Options are (mapcount, zoneinfo, clearbricks, clearsavedmaps)");
                            Omegga.whisper(name, "Example <code>/speedrun debug zoneinfo</>");
                            console.log(value2)
                            break;
                    }
                    break;
                default:
                    Omegga.whisper(name, "Options are (save, edit, paintindex, regen, debug)");
                    Omegga.whisper(name, "Example <code>/speedrun edit</>");
                    break;
            }
        })

        let activeOrders = [];
        Omegga.on("cmd:zoneorder", async (name) => // used to fix ordering of checkpoints on a map. Fairly important
        {
            if (auth.find(c => c.name == name) != undefined) 
            {
                let curOrder = activeOrders.find(a => a.name == name);
                if (curOrder == undefined) 
                {
                    let inzone = false;
                    let orderObj = {name: name, map: "", checkpoints: []};
                    for (let z of zones)
                    {
                        if (await InZone(z.start, name)) 
                        {
                            orderObj.map = z.name;
                            activeOrders.push(orderObj);
                            inzone = true;
                            Omegga.whisper(name, "Now run same command in checkpoint 1");
                            break;
                        }
                    }
                    if (!inzone) Omegga.whisper(name, "Not inside a start zone");
                } else 
                {
                    let z = zones.find(z => z.name == curOrder.map);
                    for (let check of z.checkpoints)
                    {
                        if (await InZone(check, name))
                        {
                            curOrder.checkpoints.push(check);
                            Omegga.whisper(name, "Now run command in next checkpoint");
                        }
                    }
                    if (curOrder.checkpoints.length == z.checkpoints.length) 
                    {
                        z.checkpoints = curOrder.checkpoints;
                        z.data.modified = 1;
                        activeOrders.splice(activeOrders.indexOf(curOrder));
                        Omegga.whisper(name, `${z.name}'s checkpoints are now ordered!`);
                        Omegga.whisper(name, `Be sure to try editing the name or speed, and save the course using <code>/speedrun save</>!`);
                    }
                }
            } else 
            {
                Omegga.whisper(name, "You are not authorized");
                console.log(`${name} tried to run /speedrun order!`);
            }
        })


        function ModifyPlayerArray(remove, id) //bool remove: true = remove, false = add (sorry if weird)
        {
            if (remove) 
            {
                let leaver = playerArray.find(p => p.id == id);
                if (leaver != undefined) 
                {
                    playerArray.splice(playerArray.indexOf(leaver), 1);
                    if (debug) console.info(`Removed ${leaver.name} from active players. ${playerArray.length} players`);
                } else 
                {
                    if (debug) console.info('Leave fail. weird');
                }
            } else 
            {
                let joiner = Omegga.getPlayer(id);
                if (playerArray.find(p => p.id == id) == undefined) 
                {
                    let playerObj = {name: "", id: "", active: false, data: {currentMap: "", checkpoint: [], startTime: 0, nextUpdate: 0}};
                    playerObj.name = joiner.name;
                    playerObj.id = joiner.id;
                    playerArray.push(playerObj);
                    if (debug) console.info(`Added ${joiner.name} to active players. ${playerArray.length} players`);
                } else 
                {
                    if (debug) console.info('Join fail, Player already in');
                }
            }    
        }
        const AuthDebug = (name) =>
        {
            if (debug) 
            {
                if (auth.find(c => c.name == name) != undefined) return true; else return false;
            } else return false;
        }
        function Distance(baseCenter, baseSize, object)
        {
            let distance = Math.abs(Math.sqrt((object[0] - baseCenter[0])**2 + (object[1] - baseCenter[1])**2 + (object[2] - baseCenter[2])**2));
            if (sizeConsideration) distance -= baseSize;
            return distance;
        }
        async function InZone(zone, value) // true if player is in given zone. supports playerpos OR name.
        {
            if (zone.center == undefined) return false;
            let passedAxis = 0;
            if (Array.isArray(value))
            {
                for (let i = 0; i < 3; i++)
                {
                    if (value[i] <= zone.point1[i] && value[i] >= zone.point2[i]) passedAxis++;
                }
            } else 
            {
                let pos = await Omegga.getPlayer(value).getPosition();
                for (let i = 0; i < 3; i++)
                {
                    if (pos[i] <= zone.point1[i] && pos[i] >= zone.point2[i]) passedAxis++;
                }
            }
            if (passedAxis === 3) return true; else return false;
        }
        function Clamp(value, minValue, maxValue) 
        {
            return Math.min(Math.max(value, minValue), maxValue);
        }
        function GenerateError(error) 
        {
            console.error(error);
            console.warn("Stopping generation, restart plugin or run regen command after fixing");
            Omegga.broadcast("kSpeedrunning - Wrote error to console, restart plugin or run !speedrun:regen command after fixing")
            return;
        }
        return { registeredCommands: ['speedrun', 'zoneorder', 'start', 'stop'] };
    }
    async stop() {}
}