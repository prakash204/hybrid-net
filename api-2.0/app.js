'use strict';
const log4js = require('log4js');
const logger = log4js.getLogger('BasicNetwork');
const bodyParser = require('body-parser');
const http = require('http')
const util = require('util');
const express = require('express')
const app = express();
const expressJWT = require('express-jwt');
const jwt = require('jsonwebtoken');
const bearerToken = require('express-bearer-token');
const cors = require('cors');
const constants = require('./config/constants.json')
const sha256 = require('sha256');


const host = "localhost";
const port = 4000;


const query = require('./app/query')
const helper = require('./app/helper')
const invoke = require('./app/invoke')

app.options('*', cors());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
// set secret variable
app.set('secret', 'thisismysecret');
app.use(expressJWT({
    secret: 'thisismysecret'
}).unless({
    path: ['/user/login', '/user/register', '/device/getUniqueId']
}));
app.use(bearerToken());

logger.level = 'debug';


app.use((req, res, next) => {
    logger.debug('New req for %s', req.originalUrl);
    if (req.originalUrl.indexOf('/device/getUniqueId') >= 0 || req.originalUrl.indexOf('/user') >= 0 || req.originalUrl.indexOf('/user/login') >= 0 || req.originalUrl.indexOf('/user/register') >= 0) {
        return next();
    }
    var token = req.token;
    jwt.verify(token, app.get('secret'), (err, decoded) => {
        if (err) {
            console.log(`Error ================:${err}`)
            res.send({
                success: false,
                message: 'Failed to authenticate token. Make sure to include the ' +
                    'token returned from /users call in the authorization header ' +
                    ' as a Bearer token'
            });
            return;
        } else {
            req.username = decoded.userName;
            req.orgname = decoded.orgName;
            logger.debug(util.format('Decoded from JWT token: username - %s, orgname - %s', decoded.userName, decoded.orgName));
            return next();
        }
    });
});

var server = http.createServer(app).listen(port, function () { console.log(`Server started on ${port}`) });
logger.info('****************** SERVER STARTED ************************');
logger.info('******************  http://%s:%s  ************************', host, port);
server.timeout = 240000;

function getErrorMessage(field) {
    var response = {
        success: false,
        message: field + ' field is missing or Invalid in the request'
    };
    return response;
}

// Register and enroll user
app.post('/user/register', async function (req, res) {
    
    var userName = req.body.userName
    var orgName = req.body.orgName

    // if (orgName != 'Org1') {
    //     res.json(getErrorMessage('\'You are not authorized'))
    //     return;
    // }
    // var username = sha256(rollnum + "*" + password);
    

    if (!userName) {
        res.json(getErrorMessage('\' username is missing\''));
        return;
    }

    if (!orgName) {
        res.json(getErrorMessage('\'org name is missing\''));
        return;
    }

    let response = await helper.getRegisteredUser(userName, orgName);

    logger.debug('-- returned from registering the username %s for organization %s', userName, orgName);
    if (response && typeof response !== 'string') {
        logger.debug('Successfully registered the username %s in organization %s', userName, orgName);
        // response.token = token;
        res.json({success: true, message: response});
    } else {
        logger.debug('Failed to register the username %s with::%s', userName, response);
        res.json({ success: false, message: response });
    }

});

// Login and get jwt
app.post('/user/login', async function (req, res) {
    var userName = req.body.userName;
    var orgName = req.body.orgName;

    // logger.debug('End point : /users');
    logger.debug('User name : ' + userName);
    logger.debug('Org name  : ' + orgName);
    
    if (!userName) {
        res.json(getErrorMessage('\'username\''));
        return;
    }
    
    if (!orgName) {
        res.json(getErrorMessage('\'orgName\''));
        return;
    }

    var token = jwt.sign({
        exp: Math.floor(Date.now() / 1000) + parseInt(constants.jwt_expiretime),
        userName: userName,
        orgName: orgName
    }, app.get('secret'));


    let isUserRegistered = await helper.isUserRegistered(userName, orgName);

    if (isUserRegistered) {
        res.json({ success: true, message: { token: token } });

    } else {
        res.json({ success: false, message: `User with username ${userName} is not registered with ${orgName}, Please register first.` });
    }

});

// Add device
app.post('/device/add', async function (req, res) {
    try {

        if (req.orgname != 'Org1') {
            res.json(getErrorMessage('\'You are not authorized\''));
            return;
        }

        var ri = req.body.ri;
        var deviceId = "";
        var addedAt = Math.floor(Date.now() / 1000);

        // logger.debug(devPuf);
        logger.debug(ri);
        // logger.debug(devPuf);
        // logger.debug(devSec);

        // var i = 0;
        // while( i<devPuf.length) {
        //     ri = ri + ri.concat(devPuf[i]^devSec[i]);
        //     i++;
        // }

        deviceId = sha256(ri)
        logger.debug(ri);
        logger.debug(deviceId);

        var deviceData = {
            id : deviceId,
            yuniq : ri,
            owner : req.username,
            addedAt : addedAt
        }

        let message = await invoke.invokeTransaction("mychannel", "maincode", "CreateDevice", JSON.stringify(deviceData), req.username, req.orgname);
        console.log(`message result is : ${message}`)

        const response_payload = {
            result: {
                deviceId : deviceId
            },
            error: null,
            errorData: null
        }
        res.send(response_payload);
    } catch (error) {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }

    // logger.debug('End point : /users');
    // logger.debug('User name : ' + puf);
    // logger.debug('Org name  : ' + orgName);
});

app.get('/device/getUniqueId', async function (req, res) {
    try {

        console.log(req.query)
        var deviceId = req.query.deviceId

        console.log(deviceId)

        let message = await query.query("mychannel", "maincode", deviceId, "GetDeviceById", "benz", "Org1");

        const response_payload = {
            result: message.yuniq,
            error: null,
            errorData: null
        }
        res.send(response_payload);

    } catch (error) {
        
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)

    }
});